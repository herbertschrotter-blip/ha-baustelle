"""Laufzeit einer Baustelle: Zustände lesen, Fachlogik anwenden, Shellys schalten, melden.

Ereignisgesteuert (Zustandsänderungen der beteiligten Entitäten) plus ein Takt je Minute für
Schaltzeiten. Geschaltet wird nur, wenn die Baustelle aktiv und die Automatik eingeschaltet ist.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_TEMPERATURE, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Context, Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er, issue_registry as ir
from homeassistant.helpers.event import (
    async_track_state_change_event,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.util import dt as dt_util

from .const import (
    ART_CONTAINER,
    CONF_ART,
    CONF_BEREICH,
    CONF_EMPFAENGER,
    CONF_ENERGIE,
    CONF_FEIERTAG_KALENDER,
    CONF_FUEHLER,
    CONF_HEIZPERIODE_BIS,
    CONF_HEIZPERIODE_VON,
    CONF_HEIZUNG,
    CONF_LEISTUNG,
    CONF_PUMPEN,
    CONF_REGEN_SENSOR,
    CONF_ROLLE,
    CONF_SCHALTER,
    CONF_STATUS,
    CONF_TEMP_SENSOR,
    CONF_TYP,
    CONF_URLAUB_KALENDER,
    CONF_WETTER,
    DOMAIN,
    HEIZROLLEN,
    KEINE_LEISTUNG_MIN,
    KEINE_LEISTUNG_W,
    ROLLE_HEIZKOERPER,
    ROLLE_PUMPE,
    STATUS_AKTIV,
    SUB_BEREICH,
    SUB_GERAET,
    WETTER_INTERVALL_MIN,
    WOCHENTAGE,
)
from .einstellungen import Einstellungen
from .logik.heizung import (
    Basis,
    Bereich,
    Grund,
    Lage,
    Modus,
    Regeln,
    Tagesplan,
    UrlaubModus,
    Wetter,
    entscheide,
    naechste_schaltzeit,
    pause,
    zu_warm,
)
from .logik.pumpen import Problem, PumpenRegeln, PumpenZustand, baustelle_offline, laeuft, pruefe
from .logik.zaehlen import (
    ABKUEHL_MIN_H,
    AUFHEIZ_MIN_H,
    energie_zuwachs,
    gradstunden,
    mittel,
    rate,
    hochrechnung,
    leistung_integriert,
    mittel_im_betrieb,
    tage_heizperiode,
)

_LOGGER = logging.getLogger(__name__)

PROBLEM_KEINE_LEISTUNG = "keine_leistung"
ZAEHLER_SPEICHERN_S = 30
MAX_SCHRITT_H = 5 / 60  # längere Lücken (Neustart) zählen nicht als Laufzeit
FEHLT_NACH = timedelta(minutes=10)  # so lange darf eine Entität nach dem Start fehlen (andere Integrationen laden)
MELDETEXT = {
    Problem.OFFLINE.value: "{geraet} ({bereich}) ist nicht erreichbar – Stromausfall oder Verbindung weg?",
    Problem.TROCKENLAUF.value: "{geraet} ({bereich}) läuft, zieht aber nur {leistung} W – Trockenlauf?",
    Problem.DAUERLAUF.value: "{geraet} ({bereich}) läuft seit über {stunden} h ohne Pause – Schwimmer oder starker Zufluss?",
}


def _minuten(text: str) -> int:
    stunde, minute = text.split(":")[:2]
    return int(stunde) * 60 + int(minute)


def _zahl(state: State | None) -> float | None:
    if state is None or state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return None
    try:
        return float(state.state)
    except ValueError:
        return None


@dataclass
class BereichInfo:
    """Ein Container oder Pumpenschacht aus der Einrichtung."""

    id: str
    name: str
    art: str
    fuehler: str | None


@dataclass
class GeraetInfo:
    """Ein Shelly aus der Einrichtung."""

    id: str
    name: str
    bereich: str
    schalter: str
    rolle: str
    typ: str
    leistung: str | None
    energie: str | None


@dataclass
class Laufzeit:
    """Ergebnis der letzten Auswertung, von den Entitäten angezeigt."""

    status: str = "automatik_aus"
    naechste: datetime | None = None
    grund: dict[str, Grund] = field(default_factory=dict)
    leistung: dict[str, float | None] = field(default_factory=dict)
    probleme: dict[str, list[str]] = field(default_factory=dict)
    pumpe_laeuft: dict[str, bool] = field(default_factory=dict)
    erreichbar: bool | None = None
    wetter: Wetter = field(default_factory=Wetter)


class Steuerung:
    """Alles, was eine Baustelle im Betrieb tut."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.einstellungen = Einstellungen(hass, entry.entry_id)
        self.bereiche: dict[str, BereichInfo] = {}
        self.geraete: dict[str, GeraetInfo] = {}
        self.daten = Laufzeit()
        self._prognose: dict[str, float | None] = {}
        self._prognose_laeuft = False
        self._listener: list[CALLBACK_TYPE] = []
        self._abmelden: list[CALLBACK_TYPE] = []
        self._eigene_kontexte: deque[str] = deque(maxlen=50)
        self._letzter_befehl: dict[str, tuple[bool, datetime]] = {}
        self._frost: dict[str, bool] = {}
        self._offline_seit: dict[str, datetime] = {}
        self._laeuft_seit: dict[str, datetime] = {}
        self._keine_leistung_seit: dict[str, datetime] = {}  # eingeschaltet seit
        self._hat_geheizt: set[str] = set()  # seit dem Einschalten schon Strom gezogen
        self._gemeldet: set[str] = set()
        self.geraet_ids: dict[str, str] = {}  # Baustelle/Bereich → Geräte-ID in der Geräteverwaltung
        self._letzte_auswertung: datetime | None = None
        self._gestartet = dt_util.now()
        self._phase: dict[str, tuple[bool, datetime, float]] = {}  # Bereich → (heizt, seit, Temperatur beim Beginn)

    # ------------------------------------------------------------------ Einrichtung
    @property
    def aktiv(self) -> bool:
        return self.entry.options.get(CONF_STATUS, STATUS_AKTIV) == STATUS_AKTIV

    @property
    def heizung(self) -> bool:
        return bool(self.entry.options.get(CONF_HEIZUNG, True))

    @property
    def pumpen(self) -> bool:
        return bool(self.entry.options.get(CONF_PUMPEN, False))

    def _einrichtung_lesen(self) -> None:
        registry = er.async_get(self.hass)
        for sub in self.entry.subentries.values():
            if sub.subentry_type == SUB_BEREICH:
                self.bereiche[sub.subentry_id] = BereichInfo(
                    sub.subentry_id, sub.title, sub.data[CONF_ART], sub.data.get(CONF_FUEHLER)
                )
        for sub in self.entry.subentries.values():
            if sub.subentry_type != SUB_GERAET or sub.data[CONF_BEREICH] not in self.bereiche:
                continue
            schalter = sub.data[CONF_SCHALTER]
            self.geraete[sub.subentry_id] = GeraetInfo(
                id=sub.subentry_id,
                name=sub.title,
                bereich=sub.data[CONF_BEREICH],
                schalter=schalter,
                rolle=sub.data[CONF_ROLLE],
                typ=sub.data[CONF_TYP],
                leistung=sub.data.get(CONF_LEISTUNG) or _sensor_am_geraet(registry, schalter, "power"),
                energie=sub.data.get(CONF_ENERGIE) or _sensor_am_geraet(registry, schalter, "energy"),
            )

    def geraete_in(self, bereich_id: str) -> list[GeraetInfo]:
        return [g for g in self.geraete.values() if g.bereich == bereich_id]

    async def async_start(self) -> None:
        """Einstellungen laden, auf Änderungen hören, erste Auswertung."""
        self._einrichtung_lesen()
        await self.einstellungen.async_laden(list(self.bereiche))
        # aktuellen Zählerstand übernehmen; was seit dem letzten gespeicherten Stand dazukam, zählt mit
        for g in self.geraete.values():
            if g.energie:
                self._energie_zaehlen(g, _zahl(self.hass.states.get(g.energie)))

        beobachtet: set[str] = set()
        for g in self.geraete.values():
            beobachtet.update(e for e in (g.schalter, g.leistung, g.energie) if e)
        for b in self.bereiche.values():
            if b.fuehler:
                beobachtet.add(b.fuehler)
        o = self.entry.options
        for key in (CONF_WETTER, CONF_TEMP_SENSOR, CONF_REGEN_SENSOR, CONF_FEIERTAG_KALENDER, CONF_URLAUB_KALENDER):
            if o.get(key):
                beobachtet.add(o[key])
        if beobachtet:
            self._abmelden.append(async_track_state_change_event(self.hass, list(beobachtet), self._zustand_geaendert))
        self._abmelden.append(async_track_time_change(self.hass, self._takt, second=0))
        if o.get(CONF_WETTER):
            self._abmelden.append(
                async_track_time_interval(self.hass, self._async_prognose, timedelta(minutes=WETTER_INTERVALL_MIN))
            )
            self.entry.async_create_background_task(self.hass, self._async_prognose(), "baustelle_prognose")
        self.auswerten()

    @callback
    def async_stop(self) -> None:
        while self._abmelden:
            self._abmelden.pop()()

    @callback
    def async_add_listener(self, update: CALLBACK_TYPE) -> Callable[[], None]:
        """Entitäten melden sich an, um nach jeder Auswertung neu zu schreiben."""
        self._listener.append(update)

        def entfernen() -> None:
            self._listener.remove(update)

        return entfernen

    # ------------------------------------------------------------------ Einstellungen ändern
    @callback
    def einstellung_setzen(self, pfad: tuple[str, ...], wert: Any) -> None:
        """Eine Einstellung ändern, speichern und sofort neu auswerten."""
        ziel = self.einstellungen.daten
        for teil in pfad[:-1]:
            ziel = ziel[teil]
        ziel[pfad[-1]] = wert
        self.einstellungen.speichern()
        self.auswerten()

    # ------------------------------------------------------------------ Ereignisse
    @callback
    def _takt(self, _now: datetime) -> None:
        self.auswerten()
        self._fehlende_pruefen(dt_util.now())

    def _erwartete_entitaeten(self) -> set[str]:
        o = self.entry.options
        erwartet = {o[k] for k in (CONF_WETTER, CONF_TEMP_SENSOR, CONF_REGEN_SENSOR, CONF_FEIERTAG_KALENDER, CONF_URLAUB_KALENDER) if o.get(k)}
        for g in self.geraete.values():
            erwartet.update(e for e in (g.schalter, g.leistung, g.energie) if e)
        erwartet.update(b.fuehler for b in self.bereiche.values() if b.fuehler)
        return erwartet

    def _fehlende_pruefen(self, jetzt: datetime) -> None:
        """Reparatur-Hinweis, wenn eine eingestellte Entität fehlt (z. B. Shelly umbenannt oder entfernt)."""
        if jetzt - self._gestartet < FEHLT_NACH:
            return
        for entity_id in self._erwartete_entitaeten():
            issue_id = f"fehlt_{self.entry.entry_id}_{entity_id}"
            if self.aktiv and self.hass.states.get(entity_id) is None:
                ir.async_create_issue(
                    self.hass, DOMAIN, issue_id, is_fixable=False, severity=ir.IssueSeverity.WARNING,
                    translation_key="entitaet_fehlt",
                    translation_placeholders={"entitaet": entity_id, "baustelle": self.entry.title},
                )
            else:
                ir.async_delete_issue(self.hass, DOMAIN, issue_id)

    @callback
    def _zustand_geaendert(self, event: Event[EventStateChangedData]) -> None:
        neu, alt = event.data["new_state"], event.data["old_state"]
        for g in self.geraete.values():
            if g.energie == event.data["entity_id"]:
                self._energie_zaehlen(g, _zahl(neu))
        if (
            event.data["entity_id"] == self.entry.options.get(CONF_WETTER)
            and neu is not None and neu.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
            and not self._prognose and not self._prognose_laeuft
        ):
            # Wetter erst nach uns geladen (HA-Start): Vorhersage sofort holen statt nach 30 min
            self.entry.async_create_background_task(self.hass, self._async_prognose(), "baustelle_prognose")
        if neu is not None and alt is not None and neu.state != alt.state:
            self._handbedienung_erkennen(event.data["entity_id"], neu)
        self.auswerten()

    def _handbedienung_erkennen(self, entity_id: str, neu: State) -> None:
        """Wer einen Heizkörper von Hand schaltet, stellt den Container auf Handbetrieb (wie im Entwurf)."""
        if not (self.aktiv and self.heizung and self.einstellungen.daten["automatik"]):
            return
        kontext = neu.context
        if kontext.user_id is None or kontext.id in self._eigene_kontexte or kontext.parent_id in self._eigene_kontexte:
            return
        for g in self.geraete.values():
            if g.schalter != entity_id or g.rolle not in HEIZROLLEN:
                continue
            b = self.einstellungen.bereich(g.bereich)
            if b["modus"] != Modus.HAND.value:
                _LOGGER.info("%s von Hand geschaltet – %s auf Handbetrieb", g.name, self.bereiche[g.bereich].name)
                b["modus"] = Modus.HAND.value
                self.einstellungen.speichern()

    async def _async_prognose(self, _now: datetime | None = None) -> None:
        """Vorhersage holen (bewährt: Dienst weather.get_forecasts)."""
        wetter = self.entry.options.get(CONF_WETTER)
        if not wetter or self.hass.states.get(wetter) is None or self._prognose_laeuft:
            return
        self._prognose_laeuft = True
        try:
            await self._async_prognose_holen(wetter)
        finally:
            self._prognose_laeuft = False
        self.auswerten()

    async def _async_prognose_holen(self, wetter: str) -> None:
        jetzt = dt_util.now()
        for art in ("hourly", "daily"):
            try:
                antwort = await self.hass.services.async_call(
                    "weather", "get_forecasts", {"type": art}, target={"entity_id": wetter},
                    blocking=True, return_response=True,
                )
            except HomeAssistantError as err:
                _LOGGER.debug("Vorhersage %s von %s nicht verfügbar: %s", art, wetter, err)
                continue
            liste = (antwort or {}).get(wetter, {}).get("forecast") or []
            if liste:
                self._prognose = _prognose_auswerten(liste, art, jetzt)
                break

    # ------------------------------------------------------------------ Auswertung
    def _wetter(self) -> Wetter:
        o = self.entry.options
        aussen = _zahl(self.hass.states.get(o[CONF_TEMP_SENSOR])) if o.get(CONF_TEMP_SENSOR) else None
        if aussen is None and o.get(CONF_WETTER) and (w := self.hass.states.get(o[CONF_WETTER])):
            aussen = w.attributes.get(ATTR_TEMPERATURE)
        regen = _zahl(self.hass.states.get(o[CONF_REGEN_SENSOR])) if o.get(CONF_REGEN_SENSOR) else None
        if regen is None:
            regen = self._prognose.get("regen_heute")
        aussen_max = self._prognose.get("max_heute")
        if aussen is not None and (aussen_max is None or aussen > aussen_max):
            aussen_max = aussen
        return Wetter(aussen=aussen, aussen_max=aussen_max, frueh_prognose=self._prognose.get("frueh"), regen_24h=regen)

    def _kalender_an(self, key: str) -> bool:
        entity_id = self.entry.options.get(key)
        return bool(entity_id) and (s := self.hass.states.get(entity_id)) is not None and s.state == STATE_ON

    def _temperatur(self, fuehler: str | None) -> float | None:
        if not fuehler or (s := self.hass.states.get(fuehler)) is None:
            return None
        if fuehler.startswith("climate."):
            wert = s.attributes.get("current_temperature")
            return float(wert) if isinstance(wert, (int, float)) else None
        return _zahl(s)

    def regeln(self) -> Regeln:
        r = self.einstellungen.daten["regeln"]
        return Regeln(
            kaelte_schwelle=r["kaelte_schwelle"],
            kaelte_frueher_min=int(r["kaelte_frueher_min"]),
            trocknen_ab_mm=r["trocknen_ab_mm"],
            trocknen_laenger_min=int(r["trocknen_laenger_min"]),
            trocknen_frueher_min=int(r["trocknen_frueher_min"]),
            heizgrenze_aktiv=r["heizgrenze_aktiv"],
            heizgrenze=r["heizgrenze"],
            heizgrenze_basis=Basis(r["heizgrenze_basis"]),
            frost_aktiv=r["frost_aktiv"],
            frost_ein=r["frost_ein"],
            frost_aus=r["frost_aus"],
            urlaub_modus=UrlaubModus(r["urlaub_modus"]),
            absenk_temp=r["absenk_temp"],
        )

    def lage(self, jetzt: datetime) -> Lage:
        tag = self.einstellungen.daten["plan"][WOCHENTAGE[jetzt.weekday()]]
        return Lage(
            minute=jetzt.hour * 60 + jetzt.minute,
            plan=Tagesplan(_minuten(tag["ein"]), _minuten(tag["aus"]), tag["aktiv"]),
            wetter=self._wetter(),
            automatik=self.aktiv and self.heizung and self.einstellungen.daten["automatik"],
            feiertag=self._kalender_an(CONF_FEIERTAG_KALENDER),
            urlaub=self._kalender_an(CONF_URLAUB_KALENDER),
        )

    @callback
    def auswerten(self) -> None:
        """Einmal alles durchrechnen, bei Bedarf schalten und melden, Entitäten aktualisieren."""
        jetzt = dt_util.now()
        lage = self.lage(jetzt)
        regeln = self.regeln()
        daten = self.daten
        daten.wetter = lage.wetter
        heizt = False
        bereiche_logik: list[Bereich] = []

        for bid, info in self.bereiche.items():
            geraete = self.geraete_in(bid)
            leistungen = [_zahl(self.hass.states.get(g.leistung)) for g in geraete if g.leistung]
            daten.leistung[bid] = sum(x for x in leistungen if x is not None) if leistungen else None
            if info.art != ART_CONTAINER:
                continue
            e = self.einstellungen.bereich(bid)
            bereich = Bereich(
                modus=Modus(e["modus"]), soll=float(e["soll"]), trocknen=bool(e["trocknen"]),
                temperatur=self._temperatur(info.fuehler),
            )
            bereiche_logik.append(bereich)
            frost = False
            grund: Grund | None = None
            for g in geraete:
                if g.rolle not in HEIZROLLEN:
                    continue
                zustand = self.hass.states.get(g.schalter)
                war_ein = zustand is not None and zustand.state == STATE_ON
                d = entscheide(
                    bereich, lage, regeln, war_ein=war_ein, frost_vorher=self._frost.get(bid, False),
                    frostschutz_gilt=g.rolle == ROLLE_HEIZKOERPER,
                )
                frost = frost or d.frost
                if grund is None or g.rolle == ROLLE_HEIZKOERPER:
                    grund = d.grund
                heizt = heizt or bool(d.ein)
                if d.ein is not None:
                    self._schalten(g, zustand, d.ein, jetzt)
            self._frost[bid] = frost
            daten.grund[bid] = grund or (Grund.AUTOMATIK_AUS if not lage.automatik else Grund.AUSSERHALB)

        naechste = naechste_schaltzeit(lage, regeln, bereiche_logik) if self.heizung else None
        mitternacht = jetzt.replace(hour=0, minute=0, second=0, microsecond=0)
        daten.naechste = mitternacht + timedelta(minutes=naechste[0]) if naechste else None
        if daten.naechste is None and lage.automatik and bereiche_logik:
            # heute nichts mehr: nächster aktiver Tag laut Plan (Urlaub/Feiertag erst am Tag selbst bekannt)
            for tage in range(1, 8):
                tag = self.einstellungen.daten["plan"][WOCHENTAGE[(jetzt.weekday() + tage) % 7]]
                if tag["aktiv"]:
                    daten.naechste = mitternacht + timedelta(days=tage, minutes=_minuten(tag["ein"]))
                    break
        daten.status = self._status(lage, regeln, heizt)
        self._geraete_pruefen(jetzt)
        self._zeiten_zaehlen(jetzt)
        for update in list(self._listener):
            update()

    def _status(self, lage: Lage, regeln: Regeln, heizt: bool) -> str:
        if not self.aktiv:
            return "abgeschlossen"
        if not self.heizung:
            return "nur_pumpen"
        if not lage.automatik:
            return "automatik_aus"
        if zu_warm(regeln, lage.wetter):
            return "heizgrenze"
        if (p := pause(lage)) is not None:
            return p.value
        return "heizt" if heizt else "bereit"

    def _schalten(self, g: GeraetInfo, zustand: State | None, ein: bool, jetzt: datetime) -> None:
        if zustand is None or zustand.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
            return
        if (zustand.state == STATE_ON) == ein:
            return
        letzter = self._letzter_befehl.get(g.id)
        if letzter and letzter[0] == ein and jetzt - letzter[1] < timedelta(seconds=55):
            return
        kontext = Context()
        self._eigene_kontexte.append(kontext.id)
        self._letzter_befehl[g.id] = (ein, jetzt)
        _LOGGER.debug("%s → %s", g.schalter, "ein" if ein else "aus")
        self.hass.async_create_task(
            self.hass.services.async_call(
                "switch", "turn_on" if ein else "turn_off", {"entity_id": g.schalter}, context=kontext
            ),
            f"baustelle_schalten_{g.schalter}",
        )

    # ------------------------------------------------------------------ Überwachung
    def pumpen_regeln(self) -> PumpenRegeln:
        p = self.einstellungen.daten["pumpen"]
        return PumpenRegeln(
            offline_min=p["offline_min"], trocken_unter_w=p["trocken_unter_w"], dauerlauf_h=p["dauerlauf_h"]
        )

    def _geraete_pruefen(self, jetzt: datetime) -> None:
        # Uhr zurückgestellt: „seit“-Zeitpunkte in der Zukunft ab jetzt zählen
        for merker in (self._offline_seit, self._laeuft_seit, self._keine_leistung_seit):
            for gid, seit in merker.items():
                if seit > jetzt:
                    merker[gid] = jetzt
        regeln = self.pumpen_regeln()
        erreichbar_liste: list[bool] = []
        neue_probleme: list[tuple[GeraetInfo, str, float | None]] = []
        for g in self.geraete.values():
            zustand = self.hass.states.get(g.schalter)
            erreichbar = zustand is not None and zustand.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
            erreichbar_liste.append(erreichbar)
            leistung = _zahl(self.hass.states.get(g.leistung)) if g.leistung else None
            if erreichbar:
                self._offline_seit.pop(g.id, None)
            else:
                self._offline_seit.setdefault(g.id, jetzt)
            offline_min = (jetzt - self._offline_seit[g.id]).total_seconds() / 60 if g.id in self._offline_seit else 0.0

            if g.rolle == ROLLE_PUMPE:
                z = PumpenZustand(erreichbar=erreichbar, leistung=leistung, offline_seit_min=offline_min)
                if laeuft(z, regeln):
                    self._laeuft_seit.setdefault(g.id, jetzt)
                else:
                    self._laeuft_seit.pop(g.id, None)
                laeuft_min = (jetzt - self._laeuft_seit[g.id]).total_seconds() / 60 if g.id in self._laeuft_seit else 0.0
                z = PumpenZustand(erreichbar, leistung, offline_min, laeuft_min)
                probleme = [p.value for p in pruefe(z, regeln)]
                laeuft_jetzt = laeuft(z, regeln)
                if laeuft_jetzt and self.daten.pumpe_laeuft.get(g.id) is False and self.aktiv:
                    self._zaehler_plus(f"zyklen:{g.id}", 1)
                self.daten.pumpe_laeuft[g.id] = laeuft_jetzt
            else:
                probleme = []
                if not erreichbar and offline_min >= regeln.offline_min:
                    probleme.append(Problem.OFFLINE.value)
                an = zustand is not None and zustand.state == STATE_ON
                if g.rolle in HEIZROLLEN and an and leistung is not None:
                    if leistung >= KEINE_LEISTUNG_W:
                        self._hat_geheizt.add(g.id)
                    seit = self._keine_leistung_seit.setdefault(g.id, jetzt)
                    if g.id not in self._hat_geheizt and (jetzt - seit).total_seconds() / 60 >= KEINE_LEISTUNG_MIN:
                        probleme.append(PROBLEM_KEINE_LEISTUNG)
                else:
                    # aus (oder ohne Messung): beim nächsten Einschalten neu beobachten
                    self._keine_leistung_seit.pop(g.id, None)
                    self._hat_geheizt.discard(g.id)

            vorher = set(self.daten.probleme.get(g.id, []))
            self.daten.probleme[g.id] = probleme
            if g.rolle == ROLLE_PUMPE:
                for p in probleme:
                    if p not in vorher:
                        neue_probleme.append((g, p, leistung))
                for p in vorher - set(probleme):
                    self._gemeldet.discard(f"{g.id}:{p}")

        self.daten.erreichbar = None if not erreichbar_liste else not baustelle_offline(erreichbar_liste)
        if not self.aktiv or not self.pumpen:
            return
        if self.daten.erreichbar is False and "offline" not in self._gemeldet:
            self._gemeldet.add("offline")
            self.melden(f"Alle {len(erreichbar_liste)} Geräte sind nicht erreichbar – Stromausfall oder Internet weg?")
            return
        if self.daten.erreichbar:
            self._gemeldet.discard("offline")
        for g, p, leistung in neue_probleme:
            schluessel = f"{g.id}:{p}"
            if schluessel in self._gemeldet:
                continue
            self._gemeldet.add(schluessel)
            self.melden(
                MELDETEXT[p].format(
                    geraet=g.name, bereich=self.bereiche[g.bereich].name,
                    leistung=round(leistung or 0), stunden=round(regeln.dauerlauf_h, 1),
                )
            )

    def melden(self, text: str) -> None:
        """Nachricht an die gewählten Empfänger (z. B. notify.mobile_app_<handy>)."""
        for dienst in self.entry.options.get(CONF_EMPFAENGER, []):
            if not self.hass.services.has_service("notify", dienst):
                _LOGGER.warning("Benachrichtigungsdienst notify.%s gibt es nicht", dienst)
                continue
            self.hass.async_create_task(
                self.hass.services.async_call(
                    "notify", dienst, {"title": f"Baustelle {self.entry.title}", "message": text}
                ),
                "baustelle_melden",
            )

    # ------------------------------------------------------------------ Zählen (Stufe 4)
    @property
    def zaehler(self) -> dict[str, Any]:
        """Dauerhafte Zähler der Baustelle (im Store, in der Sicherung)."""
        return self.einstellungen.daten["zaehler"]

    def _zaehler_plus(self, key: str, wert: float) -> None:
        if wert <= 0:
            return
        z = self.zaehler
        z[key] = z.get(key, 0.0) + wert
        z.setdefault("seit", dt_util.now().isoformat())
        self.einstellungen.speichern(ZAEHLER_SPEICHERN_S)

    def _energie_buchen(self, g: GeraetInfo, kwh: float) -> None:
        """Energie eines Shelly der Baustelle und seinem Bereich zurechnen; Kosten zum aktuellen Preis."""
        if kwh <= 0 or not self.aktiv:
            return
        preis = float(self.einstellungen.daten["preis"])
        for key in ("energie", f"energie:{g.bereich}"):
            self._zaehler_plus(key, kwh)
        for key in ("kosten", f"kosten:{g.bereich}"):
            self._zaehler_plus(key, kwh * preis)
        if g.rolle in HEIZROLLEN:
            self._zaehler_plus("energie_heizen", kwh)
        if g.rolle == ROLLE_HEIZKOERPER:
            self._zaehler_plus(f"energie_typ:{g.typ}", kwh)

    def _energie_zaehlen(self, g: GeraetInfo, stand: float | None) -> None:
        """Neuer Stand des Energiezählers eines Shelly; der letzte Stand ist gespeichert (übersteht Neustarts)."""
        if stand is None:
            return
        key = f"stand:{g.id}"
        alt = self.zaehler.get(key)
        self.zaehler[key] = stand
        self._energie_buchen(g, energie_zuwachs(alt, stand))
        self.einstellungen.speichern(ZAEHLER_SPEICHERN_S)

    def _zeiten_zaehlen(self, jetzt: datetime) -> None:
        """Heiz- und Pumpzeit, mittlere Leistung, „ohne Automatik“ und Energie ohne Zähler seit der letzten Auswertung."""
        vorher, self._letzte_auswertung = self._letzte_auswertung, jetzt
        if vorher is None or not self.aktiv:
            return
        stunden = (jetzt - vorher).total_seconds() / 3600
        if stunden <= 0 or stunden > MAX_SCHRITT_H:
            return
        ohne_w = 0.0
        for bid in self.bereiche:
            heizt = False
            for g in self.geraete_in(bid):
                zustand = self.hass.states.get(g.schalter)
                an = zustand is not None and zustand.state == STATE_ON
                leistung = _zahl(self.hass.states.get(g.leistung)) if g.leistung else None
                if g.rolle in HEIZROLLEN:
                    mittel = mittel_im_betrieb(self.zaehler.get(f"mittel:{g.id}"), leistung if an else None)
                    if mittel is not None:
                        self.zaehler[f"mittel:{g.id}"] = mittel
                        if self.heizung:
                            ohne_w += mittel
                    if an:
                        heizt = True
                        if g.rolle == ROLLE_HEIZKOERPER:
                            self._zaehler_plus(f"heizzeit_typ:{g.typ}", stunden)
                if g.rolle == ROLLE_PUMPE and self.daten.pumpe_laeuft.get(g.id):
                    self._zaehler_plus(f"pumpzeit:{g.id}", stunden)
                if not g.energie and an:
                    self._energie_buchen(g, leistung_integriert(leistung, stunden))
            if heizt:
                self._zaehler_plus(f"heizzeit:{bid}", stunden)
            self._temperaturverhalten(bid, heizt, jetzt, stunden)
        self._zaehler_plus("ohne", ohne_w * stunden / 1000)

    def _temperaturverhalten(self, bid: str, heizt: bool, jetzt: datetime, stunden: float) -> None:
        """Aufheiz- und Abkühlrate (°C/h) und Gradstunden innen–außen eines Containers mit Fühler."""
        info = self.bereiche[bid]
        innen = self._temperatur(info.fuehler)
        if info.art != ART_CONTAINER or innen is None:
            self._phase.pop(bid, None)
            return
        self._zaehler_plus(f"gradh:{bid}", gradstunden(innen, self.daten.wetter.aussen, stunden))
        phase = self._phase.get(bid)
        if phase is None or phase[0] != heizt:
            self._phase[bid] = (heizt, jetzt, innen)
            return
        dauer = (jetzt - phase[1]).total_seconds() / 3600
        if dauer < (AUFHEIZ_MIN_H if heizt else ABKUEHL_MIN_H):
            return
        aenderung = rate(phase[2], innen, dauer)
        key = f"aufheiz:{bid}" if heizt else f"abkuehl:{bid}"
        if aenderung is not None and (aenderung > 0 if heizt else aenderung < 0):
            self.zaehler[key] = mittel(self.zaehler.get(key), abs(aenderung))
            self.einstellungen.speichern(ZAEHLER_SPEICHERN_S)
        self._phase[bid] = (heizt, jetzt, innen)

    def ersparnis_kwh(self) -> float:
        """Was 24-h-Dauerbetrieb mehr verbraucht hätte als tatsächlich geheizt wurde."""
        return max(0.0, self.zaehler.get("ohne", 0.0) - self.zaehler.get("energie_heizen", 0.0))

    def hochrechnung_heizperiode(self, key: str) -> float | None:
        """Tagesschnitt seit Zählbeginn auf die ganze Heizperiode hochgerechnet (kWh)."""
        seit = dt_util.parse_datetime(self.zaehler["seit"]) if self.zaehler.get("seit") else None
        if seit is None:
            return None
        jetzt = dt_util.now()
        von = int(self.entry.options.get(CONF_HEIZPERIODE_VON, 10))
        bis = int(self.entry.options.get(CONF_HEIZPERIODE_BIS, 4))
        jahr = jetzt.year if jetzt.month >= von else jetzt.year - 1
        tage = (jetzt - seit).total_seconds() / 86400
        return hochrechnung(self.zaehler.get(key, 0.0), tage, tage_heizperiode(von, bis, jahr))

    def mittel_typ(self, typ: str) -> float | None:
        """Mittlere Leistung im Betrieb aller Heizkörper eines Typs (Vergleich Ölradiator/Konvektor)."""
        werte = [
            self.zaehler[f"mittel:{g.id}"]
            for g in self.geraete.values()
            if g.rolle == ROLLE_HEIZKOERPER and g.typ == typ and f"mittel:{g.id}" in self.zaehler
        ]
        return sum(werte) / len(werte) if werte else None


def _sensor_am_geraet(registry: er.EntityRegistry, schalter: str, device_class: str) -> str | None:
    """Leistungs- bzw. Energiesensor desselben Shelly finden (bei Mehrkanal: gleicher Namensanfang)."""
    eintrag = registry.async_get(schalter)
    if eintrag is None or eintrag.device_id is None:
        return None
    kandidaten = [
        e.entity_id
        for e in er.async_entries_for_device(registry, eintrag.device_id)
        if e.domain == "sensor" and (e.device_class or e.original_device_class) == device_class and not e.disabled
    ]
    if len(kandidaten) == 1:
        return kandidaten[0]
    stamm = schalter.split(".", 1)[1]
    passend = [k for k in kandidaten if k.split(".", 1)[1].startswith(stamm)]
    return passend[0] if len(passend) == 1 else None


def _prognose_auswerten(liste: list[dict[str, Any]], art: str, jetzt: datetime) -> dict[str, float | None]:
    """Tageshöchstwert, Früh-Prognose (tiefster Wert 4–8 Uhr des nächsten Morgens) und Regen heute."""
    heute = jetzt.date()
    morgen_tag = heute if jetzt.hour < 8 else heute + timedelta(days=1)
    max_heute: float | None = None
    frueh: float | None = None
    regen = 0.0
    regen_da = False
    for eintrag in liste:
        zeit = dt_util.parse_datetime(str(eintrag.get("datetime", "")))
        if zeit is None:
            continue
        zeit = dt_util.as_local(zeit)
        temp = eintrag.get("temperature")
        if art == "hourly":
            if zeit.date() == heute and temp is not None:
                max_heute = temp if max_heute is None else max(max_heute, temp)
                if eintrag.get("precipitation") is not None:
                    regen += float(eintrag["precipitation"])
                    regen_da = True
            if zeit.date() == morgen_tag and 4 <= zeit.hour <= 8 and temp is not None:
                frueh = temp if frueh is None else min(frueh, temp)
        else:
            if zeit.date() == heute:
                max_heute = temp
                if eintrag.get("precipitation") is not None:
                    regen, regen_da = float(eintrag["precipitation"]), True
            if zeit.date() == heute + timedelta(days=1) and eintrag.get("templow") is not None:
                frueh = eintrag["templow"]
    return {"max_heute": max_heute, "frueh": frueh, "regen_heute": regen if regen_da else None}

