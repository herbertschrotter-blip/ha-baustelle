"""Kern einer Baustelle: Einrichtung, Ereignisse, Wetter, Kalender, Staffelung, Schalten, Protokoll, Status (Bauplan
0.7 §3, Bauplan Module §3).

Jede Minute und bei jeder Zustandsänderung der beteiligten Entitäten:

1. `soll` der aktiven Funktionen (was jeder Bereich jetzt tun soll),
2. `staffel.staffeln` über alle Anschlüsse (`frei_stabil` = kleinster freier Wert der letzten 60 s),
3. schalten – nur Geräte, die eine Funktion `schaltbar` nennt; alle anderen zählen nur mit,
4. Warnungen (`logik/warnungen.py`), Handy-Nachrichten, Protokoll, Anzeige, Status, Zähler.

Was eine Funktion tut, steht in `funktionen/` (angelegt aus `funktionen.FUNKTIONEN`); der Kern ruft nur deren
Schnittstelle (`funktionen/basis.py`) und kennt keine Einzelheiten einer Funktion.

Geschaltet wird nur, wenn die Baustelle aktiv und die Automatik eingeschaltet ist (oder eine Funktion
`schaltet_ohne_automatik`). Wer ein Gerät von Hand schaltet, übergibt es seiner Funktion (`hand_setzen`, wie 0.6).
"""

from __future__ import annotations

from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_TEMPERATURE, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import (
    CALLBACK_TYPE, Context, Event, EventStateChangedData, HomeAssistant, ServiceResponse, State, callback,
)
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er, issue_registry as ir
from homeassistant.helpers.event import (
    async_call_later,
    async_track_point_in_time,
    async_track_state_change_event,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.util import dt as dt_util

from .const import (
    CONF_ART,
    CONF_BEREICH,
    CONF_EMPFAENGER,
    CONF_ENERGIE,
    CONF_FEIERTAG_KALENDER,
    CONF_FUEHLER,
    CONF_LEISTUNG,
    CONF_REGEN_SENSOR,
    CONF_ROLLE,
    CONF_SCHALTER,
    CONF_STATUS,
    CONF_TEMP_SENSOR,
    CONF_TYP,
    CONF_URLAUB_KALENDER,
    CONF_WETTER,
    DOMAIN,
    EVENT_PROTOKOLL,
    STATUS_AKTIV,
    SUB_BEREICH,
    SUB_GERAET,
    TERMINE_INTERVALL_MIN,
    WETTER_INTERVALL_MIN,
    ZIEHT_STROM_W,
)
from .einstellungen import Einstellungen
from .funktionen import FUNKTIONEN
from .funktionen.basis import (
    ZAEHLER_SPEICHERN_S,
    Funktion,
    SollJeBereich,
    ev_zeit as _ev_zeit,
    minuten_seit as _minuten_seit,
    mitternacht as _mitternacht,
    zahl as _zahl,
    zeit as _zeit,
)
from .logik import staffel as staffel_logik, warnungen as warn_logik
from .logik.arbeitszeit import Arbeitszeit, Ausnahme, WetterTag
from .logik.zaehlen import energie_zuwachs, leistung_integriert
from . import texte
from .texte import GRUND_TEXT

_LOGGER = logging.getLogger(__name__)

MAX_SCHRITT_H = 5 / 60  # längere Lücken (Neustart) zählen nicht als Laufzeit
FEHLT_NACH = timedelta(minutes=10)  # so lange darf eine Entität nach dem Start fehlen (andere Integrationen laden)
STABIL_S = 60  # Staffelung: kleinster freier Wert der letzten Minute
ANLAUF_S = 20  # Staffelung: Geräte gehen nacheinander an, höchstens eines je 20 s (kein gemeinsamer Einschaltstoß)
PRIO = {"niedrig": staffel_logik.Prio.NIEDRIG, "normal": staffel_logik.Prio.NORMAL, "hoch": staffel_logik.Prio.HOCH}
WARTE_TEXT = {
    "anschluss_voll": "Anschluss voll",
    "max_gleichzeitig": "höchstens {max} gleichzeitig",
    "mindestpause": "Mindestpause",
    "rundlauf": "Rundlauf {takt} min",
    "anlauf": "Anlauf",
}


def morgen_frueh(jetzt: datetime) -> datetime:
    """„Bis morgen“: nächster Tag 07:00 (Arbeitsbeginn im Mockup)."""
    return datetime.combine(jetzt.date() + timedelta(days=1), time(7, 0), tzinfo=jetzt.tzinfo)


@dataclass
class BereichInfo:
    """Ein Bereich der Einrichtung (Art je Funktion, z. B. Container oder Pumpenschacht)."""

    id: str
    name: str
    art: str
    fuehler: str | None
    nr: int = 0


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
class WetterWerte:
    """Wetter, mit dem die Regeln gerade rechnen."""

    aussen: float | None = None
    aussen_max: float | None = None
    frueh: float | None = None
    regen_vortag: float | None = None
    regen_heute: float | None = None
    zustand: str | None = None

    # Namen wie 0.6 für die Wetter-Sensoren
    @property
    def frueh_prognose(self) -> float | None:
        return self.frueh

    @property
    def regen_24h(self) -> float | None:
        return self.regen_heute


@dataclass
class Laufzeit:
    """Ergebnis der letzten Auswertung, von Entitäten und Seite angezeigt."""

    status: str = "automatik_aus"
    status_text: str = ""
    naechste: datetime | None = None
    grund: dict[str, str] = field(default_factory=dict)
    zustand: dict[str, str] = field(default_factory=dict)
    text: dict[str, str] = field(default_factory=dict)
    temperatur: dict[str, float | None] = field(default_factory=dict)
    leistung: dict[str, float | None] = field(default_factory=dict)
    probleme: dict[str, list[str]] = field(default_factory=dict)
    erreichbar: bool | None = None
    wetter: WetterWerte = field(default_factory=WetterWerte)
    warnungen: list[warn_logik.Warnung] = field(default_factory=list)
    warte: dict[str, dict[str, Any]] = field(default_factory=dict)
    staffel: dict[str, Any] = field(default_factory=dict)


class Steuerung:
    """Alles, was eine Baustelle im Betrieb tut."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.einstellungen = Einstellungen(hass, entry.entry_id)
        self.bereiche: dict[str, BereichInfo] = {}
        self.geraete: dict[str, GeraetInfo] = {}
        self.daten = Laufzeit()
        self.geraet_ids: dict[str, str] = {}  # Baustelle/Bereich → Geräte-ID in der Geräteverwaltung
        self._prognose_laeuft = False
        self._prognose_da = False
        self._listener: list[CALLBACK_TYPE] = []
        self._abmelden: list[CALLBACK_TYPE] = []
        self._bericht_abmelden: CALLBACK_TYPE | None = None
        self._eigene_kontexte: deque[str] = deque(maxlen=100)
        self._letzter_befehl: dict[str, tuple[bool, datetime]] = {}
        self._offline_seit: dict[str, datetime] = {}
        self._wartet_seit: dict[str, datetime] = {}
        self._frei_verlauf: deque[tuple[datetime, dict[str, float]]] = deque()
        self._letzter_anlauf: datetime | None = None
        self._anlauf_geplant: CALLBACK_TYPE | None = None
        self._letzte_soll: dict[str, tuple[bool | None, str]] = {}
        self._letztes_warten: dict[str, str] = {}
        self._warn_alt: dict[str, warn_logik.Warnung] = {}
        self._letzte_auswertung: datetime | None = None
        self._gestartet = dt_util.now()
        self.kalender_tage: dict[str, set[date]] = {"feiertag": set(), "urlaub": set()}
        self.kalender_namen: dict[date, str] = {}
        self.nachrichten: Any = None  # Nachrichten (nachrichten.py), nach dem Start gesetzt
        self._in_auswertung = False
        self._nochmal = False
        self._gestoppt = False
        self._beobachtet: set[str] = set()
        # Funktionen der Baustelle (funktionen/): Bereiche je Art, Geräte je Rolle gehören genau einer Funktion
        self.funktionen: list[Funktion] = [f(self) for f in FUNKTIONEN]
        self._je_name = {f.name: f for f in self.funktionen}
        self._je_art = {art: f for f in self.funktionen for art in f.arten}
        self._je_rolle = {rolle: f for f in self.funktionen for rolle in f.rollen}

    # ------------------------------------------------------------------ Einrichtung
    @property
    def aktiv(self) -> bool:
        return bool(self.entry.options.get(CONF_STATUS, STATUS_AKTIV) == STATUS_AKTIV)

    @property
    def e(self) -> dict[str, Any]:
        """Die gespeicherten Einstellungen (Store v2)."""
        return self.einstellungen.daten

    @property
    def lz(self) -> dict[str, Any]:
        """Laufzeitdaten im Store (der Funktionen, Warnungen, Wetter je Tag)."""
        laufzeit: dict[str, Any] = self.einstellungen.daten["laufzeit"]
        return laufzeit

    @property
    def automatik_moeglich(self) -> bool:
        """Eine aktive Funktion schaltet Geräte – nur dann gibt es die Automatik."""
        return any(f.schaltet and f.aktiv() for f in self.funktionen)

    @property
    def automatik(self) -> bool:
        return self.aktiv and self.automatik_moeglich and bool(self.e["automatik"])

    def _einrichtung_lesen(self) -> None:
        registry = er.async_get(self.hass)
        for sub in self.entry.subentries.values():
            if sub.subentry_type == SUB_BEREICH:
                self.bereiche[sub.subentry_id] = BereichInfo(
                    sub.subentry_id, sub.title, sub.data[CONF_ART], sub.data.get(CONF_FUEHLER), len(self.bereiche)
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

    def funktion(self, name: str) -> Funktion:
        return self._je_name[name]

    def funktion_von(self, g: GeraetInfo) -> Funktion:
        """Die Funktion des Bereichs, in dem das Gerät steckt (Bereichsart → Funktion, `Funktion.arten`)."""
        return self._je_art[self.bereiche[g.bereich].art]

    async def async_start(self) -> None:
        """Einstellungen laden, auf Änderungen hören, erste Auswertung."""
        from .nachrichten import Nachrichten  # noqa: PLC0415  (gegenseitiger Import)

        self._einrichtung_lesen()
        await self.einstellungen.async_laden(list(self.bereiche), self.entry.options.get(CONF_EMPFAENGER))
        if self.einstellungen.von_v1:
            self.protokoll("einstellung", None, "Umstellung auf 0.7.0: Einstellungen neu, Zähler übernommen")
        self._warnungen_laden()
        self.nachrichten = Nachrichten(self)
        # aktuellen Zählerstand übernehmen; was seit dem letzten gespeicherten Stand dazukam, zählt mit
        for g in self.geraete.values():
            if g.energie:
                self._energie_zaehlen(g, _zahl(self.hass.states.get(g.energie)))

        self._beobachten()
        o = self.entry.options
        self._abmelden.append(async_track_time_change(self.hass, self._takt, second=0))
        if o.get(CONF_WETTER):
            self._abmelden.append(
                async_track_time_interval(self.hass, self._async_prognose, timedelta(minutes=WETTER_INTERVALL_MIN))
            )
            self.entry.async_create_background_task(self.hass, self._async_prognose(), "baustelle_prognose")
        self._abmelden.append(
            async_track_time_interval(self.hass, self._async_kalender, timedelta(minutes=TERMINE_INTERVALL_MIN))
        )
        self.entry.async_create_background_task(self.hass, self._async_kalender(), "baustelle_kalender")
        self._abmelden.append(self.nachrichten.async_start())
        self.bericht_planen()
        self.auswerten()

    @callback
    def async_stop(self) -> None:
        self._gestoppt = True
        while self._abmelden:
            self._abmelden.pop()()
        if self._anlauf_geplant is not None:
            self._anlauf_geplant()
            self._anlauf_geplant = None
        if self._bericht_abmelden:
            self._bericht_abmelden()
            self._bericht_abmelden = None

    @callback
    def async_add_listener(self, update: CALLBACK_TYPE) -> Callable[[], None]:
        """Entitäten melden sich an, um nach jeder Auswertung neu zu schreiben."""
        self._listener.append(update)

        def entfernen() -> None:
            self._listener.remove(update)

        return entfernen

    def _beobachten(self) -> None:
        """Auf Änderungen aller beteiligten Entitäten hören; neue (z. B. aus einer Einstellung) kommen dazu."""
        beobachtet = self._erwartete_entitaeten()
        for f in self.funktionen:
            beobachtet |= f.entitaeten()
        if neu := beobachtet - self._beobachtet:
            self._beobachtet |= neu
            self._abmelden.append(async_track_state_change_event(self.hass, list(neu), self._zustand_geaendert))

    # ------------------------------------------------------------------ Protokoll
    @callback
    def protokoll(self, art: str, bereich: str | None, text: str, zeit: datetime | None = None) -> None:
        """Eintrag ins dauerhafte Protokoll (neueste zuerst, max. 1000) und ins HA-Logbuch."""
        zeit = zeit or dt_util.now()
        self.einstellungen.protokoll([zeit.isoformat(timespec="seconds"), art, bereich, text])
        self.hass.bus.async_fire(
            EVENT_PROTOKOLL,
            {
                "entry_id": self.entry.entry_id,
                "baustelle": self.entry.title,
                "art": art,
                "bereich": bereich,
                "bereich_name": self.bereiche[bereich].name if bereich in self.bereiche else None,
                "text": text,
            },
        )

    # ------------------------------------------------------------------ Einstellungen ändern
    @callback
    def einstellung_setzen(self, pfad: tuple[str, ...] | list[str], wert: Any, *, protokoll: bool = True) -> None:
        """Eine Einstellung ändern, speichern und sofort neu auswerten."""
        pfad = tuple(pfad)
        ziel = self.e
        for teil in pfad[:-1]:
            ziel = ziel[teil]
        alt = ziel.get(pfad[-1])
        ziel[pfad[-1]] = wert
        self.einstellungen.speichern()
        if protokoll and alt != wert:
            text = next((t for f in self.funktionen if (t := f.einstellung_text(pfad, wert)) is not None), None)
            self.protokoll("einstellung", pfad[1] if pfad[0] == "bereiche" else None, text or _einstellung_text(pfad, wert))
        if pfad[0] == "bericht":
            self.bericht_planen()
        if any(f.kalender_neu(pfad) for f in self.funktionen):
            self.entry.async_create_background_task(self.hass, self._async_kalender(), "baustelle_kalender")
        if not self._gestoppt:
            # neue Entität in einer Einstellung: sofort auf ihre Änderungen reagieren (sonst erst im Minutentakt)
            self._beobachten()
        self.auswerten()

    # ------------------------------------------------------------------ Ereignisse
    @callback
    def _takt(self, _now: datetime) -> None:
        self.auswerten()
        jetzt = dt_util.now()
        self._fehlende_pruefen(jetzt)
        self.nachrichten.fruehstart_pruefen(jetzt)

    def _erwartete_entitaeten(self) -> set[str]:
        o = self.entry.options
        erwartet = {o[k] for k in (CONF_WETTER, CONF_TEMP_SENSOR, CONF_REGEN_SENSOR, CONF_FEIERTAG_KALENDER, CONF_URLAUB_KALENDER) if o.get(k)}
        for g in self.geraete.values():
            erwartet.update(x for x in (g.schalter, g.leistung, g.energie) if x)
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
        # Gerät ohne Leistungssensor: zählt weder Leistung noch Verbrauch (FE-0003)
        for g in self.geraete.values():
            issue_id = f"ohne_leistung_{self.entry.entry_id}_{g.id}"
            if self.aktiv and not g.leistung and not g.energie:
                ir.async_create_issue(
                    self.hass, DOMAIN, issue_id, is_fixable=False, severity=ir.IssueSeverity.WARNING,
                    translation_key="ohne_leistung",
                    translation_placeholders={"geraet": g.name, "schalter": g.schalter, "baustelle": self.entry.title},
                )
            else:
                ir.async_delete_issue(self.hass, DOMAIN, issue_id)

    @callback
    def _zustand_geaendert(self, event: Event[EventStateChangedData]) -> None:
        neu, alt = event.data["new_state"], event.data["old_state"]
        entity_id = event.data["entity_id"]
        for g in self.geraete.values():
            if g.energie == entity_id:
                self._energie_zaehlen(g, _zahl(neu))
        if (
            entity_id == self.entry.options.get(CONF_WETTER)
            and neu is not None and neu.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
            and not self._prognose_da and not self._prognose_laeuft
        ):
            # Wetter erst nach uns geladen (HA-Start): Vorhersage sofort holen statt nach 30 min
            self.entry.async_create_background_task(self.hass, self._async_prognose(), "baustelle_prognose")
        if neu is not None and alt is not None and neu.state != alt.state:
            self._handbedienung_erkennen(entity_id, neu)
        self.auswerten()

    def _handbedienung_erkennen(self, entity_id: str, neu: State) -> None:
        """Wer einen Shelly in HA von Hand schaltet, übergibt ihn seiner Funktion (Handbetrieb, wie 0.6)."""
        if not self.automatik or neu.state not in ("on", "off"):
            return
        kontext = neu.context
        if kontext.user_id is None or kontext.id in self._eigene_kontexte or kontext.parent_id in self._eigene_kontexte:
            return
        for g in self.geraete.values():
            if g.schalter == entity_id:
                self.funktion_von(g).hand_setzen(g, neu.state == STATE_ON)

    # ------------------------------------------------------------------ Wetter
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
        tage: dict[date, dict[str, float | None]] = {}
        for art in ("daily", "hourly"):
            try:
                antwort = await self.hass.services.async_call(
                    "weather", "get_forecasts", {"type": art}, target={"entity_id": wetter},
                    blocking=True, return_response=True,
                )
            except HomeAssistantError as err:
                _LOGGER.debug("Vorhersage %s von %s nicht verfügbar: %s", art, wetter, err)
                continue
            liste = _antwort_liste(antwort, wetter, "forecast")
            for tag, werte in _prognose_je_tag(liste, art).items():
                ziel = tage.setdefault(tag, {})
                ziel.update({k: v for k, v in werte.items() if v is not None})
        if tage:
            self._prognose_da = True
            self._wetter_tage_merken(tage, jetzt)

    def _wetter_tage_merken(self, tage: dict[date, dict[str, float | None]], jetzt: datetime) -> None:
        """Vorhersage je Tag im Store merken; vergangene Morgen/Regen von heute bleiben (die Vorhersage vergisst sie)."""
        gemerkt = self.lz.setdefault("wetter_tage", {})
        heute = jetzt.date()
        for tag, werte in tage.items():
            alt = gemerkt.setdefault(tag.isoformat(), {})
            for key, wert in werte.items():
                if tag == heute and alt.get(key) is not None:
                    if key == "frueh" and jetzt.hour >= 8:
                        continue
                    if key in ("regen", "max"):
                        wert = max(wert, alt[key])
                alt[key] = wert
        grenze = (heute - timedelta(days=10)).isoformat()
        for iso in [k for k in gemerkt if k < grenze]:
            del gemerkt[iso]
        self.einstellungen.speichern(ZAEHLER_SPEICHERN_S)

    def _wetter_tag(self, tag: date) -> dict[str, Any]:
        tag_werte: dict[str, Any] = self.lz.get("wetter_tage", {}).get(tag.isoformat(), {})
        return tag_werte

    def _wetter(self, jetzt: datetime) -> WetterWerte:
        o = self.entry.options
        heute = jetzt.date()
        zustand = None
        aussen = _zahl(self.hass.states.get(o[CONF_TEMP_SENSOR])) if o.get(CONF_TEMP_SENSOR) else None
        if o.get(CONF_WETTER) and (w := self.hass.states.get(o[CONF_WETTER])):
            zustand = w.state if w.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN) else None
            if aussen is None and isinstance(w.attributes.get(ATTR_TEMPERATURE), (int, float)):
                aussen = float(w.attributes[ATTR_TEMPERATURE])
        tag = self._wetter_tag(heute)
        regen = _zahl(self.hass.states.get(o[CONF_REGEN_SENSOR])) if o.get(CONF_REGEN_SENSOR) else None
        if regen is not None:
            # gemessen (Wetterstation): für „nach Regen früher“ am nächsten Tag merken
            gemerkt = self.lz.setdefault("wetter_tage", {}).setdefault(heute.isoformat(), {})
            if gemerkt.get("regen") is None or regen > gemerkt["regen"]:
                gemerkt["regen"] = regen
        else:
            regen = tag.get("regen")
        aussen_max = tag.get("max")
        if aussen is not None and (aussen_max is None or aussen > aussen_max):
            aussen_max = aussen
        # Früh-Prognose: der nächste Morgen (vor 8 Uhr heute, danach morgen) – wie 0.6
        frueh = self._wetter_tag(heute if jetzt.hour < 8 else heute + timedelta(days=1)).get("frueh")
        return WetterWerte(
            aussen=aussen, aussen_max=aussen_max, frueh=frueh,
            regen_vortag=self._wetter_tag(heute - timedelta(days=1)).get("regen"),
            regen_heute=regen, zustand=zustand,
        )

    def wetter_tag_plan(self, tag: date) -> WetterTag:
        """Wetter eines Tages (Morgen-Tiefstwert, Regen am Vortag und heute) für die Pläne der Funktionen."""
        heute = self._wetter_tag(tag)
        return WetterTag(
            frueh_min_temp=heute.get("frueh"),
            regen_vortag_mm=self._wetter_tag(tag - timedelta(days=1)).get("regen"),
            regen_heute_mm=heute.get("regen"),
        )

    # ------------------------------------------------------------------ Kalender
    async def _async_kalender(self, _now: datetime | None = None) -> None:
        """Feiertage, Urlaub und Kalender der Funktionen, laufende und nächste Woche (Dienst calendar.get_events)."""
        heute = dt_util.now().date()
        start = _mitternacht(heute - timedelta(days=heute.weekday()))
        ende = start + timedelta(days=15)
        o = self.entry.options
        for art, key in (("feiertag", CONF_FEIERTAG_KALENDER), ("urlaub", CONF_URLAUB_KALENDER)):
            tage: set[date] = set()
            for ev in await self.async_events(o.get(key), start, ende):
                von, bis = _ev_zeit(ev.get("start")), _ev_zeit(ev.get("end"))
                if von is None or bis is None:
                    continue
                tag = von.date()
                while _mitternacht(tag) < bis:
                    tage.add(tag)
                    if art == "feiertag":
                        self.kalender_namen[tag] = str(ev.get("summary") or "Feiertag")
                    tag += timedelta(days=1)
            self.kalender_tage[art] = tage
        for f in self.funktionen:
            await f.async_kalender(start, ende)
        self.auswerten()

    async def async_events(self, entity_id: str | None, start: datetime, ende: datetime) -> list[dict[str, Any]]:
        if not entity_id or self.hass.states.get(entity_id) is None:
            return []
        try:
            antwort = await self.hass.services.async_call(
                "calendar", "get_events",
                {"start_date_time": start.isoformat(), "end_date_time": ende.isoformat()},
                target={"entity_id": entity_id}, blocking=True, return_response=True,
            )
        except (HomeAssistantError, ValueError) as err:
            _LOGGER.debug("Kalender %s nicht lesbar: %s", entity_id, err)
            return []
        return _antwort_liste(antwort, entity_id, "events")

    async def async_event_details(
        self, entity_id: str | None, start: datetime, ende: datetime
    ) -> dict[tuple[str, str], tuple[str, str | None]]:
        """uid und rrule je Kalendereintrag (liefert calendar.get_events nicht) – direkt von der Kalender-Entität."""
        try:
            from homeassistant.components.calendar.const import DATA_COMPONENT  # noqa: PLC0415

            entity = self.hass.data[DATA_COMPONENT].get_entity(entity_id or "")
            if entity is None:
                return {}
            events = await entity.async_get_events(self.hass, start, ende)
        except (KeyError, HomeAssistantError, AttributeError, NotImplementedError) as err:
            _LOGGER.debug("Kalender-Details von %s nicht lesbar: %s", entity_id, err)
            return {}
        details = {}
        for ev in events:
            von = ev.start if isinstance(ev.start, datetime) else _mitternacht(ev.start)
            details[(dt_util.as_local(von).isoformat(), ev.summary)] = (ev.uid or "", ev.rrule or None)
        return details

    def frei_art(self, tag: date) -> str | None:
        """„feiertag“, „urlaub“ oder None – aus den Kalendern (heute zusätzlich aus deren Zustand)."""
        heute = dt_util.now().date()
        o = self.entry.options
        if tag in self.kalender_tage["feiertag"] or (tag == heute and self._kalender_an(o.get(CONF_FEIERTAG_KALENDER))):
            return "feiertag"
        if tag in self.kalender_tage["urlaub"] or (tag == heute and self._kalender_an(o.get(CONF_URLAUB_KALENDER))):
            return "urlaub"
        return None

    def _kalender_an(self, entity_id: str | None) -> bool:
        return entity_id is not None and (s := self.hass.states.get(entity_id)) is not None and s.state == STATE_ON

    # ------------------------------------------------------------------ Arbeitszeit
    def arbeitszeiten(self) -> list[Arbeitszeit]:
        liste = []
        for x in self.e["arbeitszeiten"]:
            try:
                liste.append(Arbeitszeit.aus_store(x))
            except (KeyError, ValueError, TypeError, IndexError):
                _LOGGER.warning("Arbeitszeit %s ist ungültig und wird übergangen", x)
        return liste

    def ausnahmen(self) -> list[Ausnahme]:
        liste = []
        for x in self.e["ausnahmen"]:
            try:
                liste.append(Ausnahme.aus_store(x))
            except (KeyError, ValueError, TypeError):
                _LOGGER.warning("Ausnahme %s ist ungültig und wird übergangen", x)
        return liste

    # ------------------------------------------------------------------ Auswertung
    def temperatur(self, fuehler: str | None) -> float | None:
        if not fuehler or (s := self.hass.states.get(fuehler)) is None:
            return None
        if fuehler.startswith("climate."):
            wert = s.attributes.get("current_temperature")
            return float(wert) if isinstance(wert, (int, float)) else None
        return _zahl(s)

    def _laufzeit_aufraeumen(self, jetzt: datetime) -> None:
        geaendert = False
        for f in self.funktionen:
            geaendert = f.aufraeumen(jetzt) or geaendert
        for key, bis in list(self.e["stumm"].items()):
            if (ende := _zeit(bis)) is None or ende <= jetzt:
                del self.e["stumm"][key]
                geaendert = True
        if geaendert:
            self.einstellungen.speichern()

    def nenn_kw(self, g: GeraetInfo) -> float:
        """Leistung eines Geräts für die Staffelung: gemessenes Mittel im Betrieb, sonst `standard_kw` seiner Funktion."""
        mittel_w = self.zaehler.get(f"mittel:{g.id}")
        if isinstance(mittel_w, (int, float)) and mittel_w > ZIEHT_STROM_W:
            return round(mittel_w / 1000, 3)
        return f.standard_kw if (f := self._je_rolle.get(g.rolle)) is not None else 0.0

    def _staffeln(self, jetzt: datetime, soll: SollJeBereich) -> tuple[set[str], dict[str, bool | None]]:
        """Staffelung über alle Anschlüsse; liefert die Geräte, die laufen sollen, und das Ziel je geschaltetem Gerät."""
        s = self.e["staffel"]
        anschluesse = [
            staffel_logik.anschluss(a["id"], float(a["ampere"]), int(a["phasen"]), float(a["reserve_kw"]),
                                    float(s["nutzbar_prozent"]))
            for a in self.e["anschluesse"]
        ]
        lasten: list[staffel_logik.Last] = []
        ziel: dict[str, bool | None] = {}
        for g in self.geraete.values():
            zustand = self.hass.states.get(g.schalter)
            erreichbar = zustand is not None and zustand.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
            an = erreichbar and zustand is not None and zustand.state == STATE_ON
            letzter = self._letzter_befehl.get(g.id)
            if erreichbar and letzter is not None and jetzt - letzter[1] < timedelta(seconds=55):
                an = letzter[0]   # eigener Befehl noch unterwegs: zählt schon als geschaltet
            e = self.einstellungen.bereich(g.bereich)
            leistung_w = _zahl(self.hass.states.get(g.leistung)) if g.leistung else None
            s_c = soll.get(g.bereich)
            f = self._je_rolle.get(g.rolle)
            ein = (f.geraet_ein(g, s_c[0]) if f is not None else s_c[0].ein) if s_c is not None else None
            schaltet = (
                f is not None and f.schaltbar(g) and ein is not None
                and self.funktion_von(g).hand_seit(g) is None and erreichbar and self.geraet_aktiv(g)
            )
            if schaltet:
                kw = self.nenn_kw(g)  # vorsichtig: auch wenn das Gerät gerade nicht zieht (Thermostat)
                ziel[g.id] = bool(ein)
            else:
                kw = (leistung_w / 1000 if leistung_w is not None else (self.nenn_kw(g) if an else 0.0)) if an else 0.0
            if schaltet and ein and not an:
                self._wartet_seit.setdefault(g.id, jetzt)
            else:
                self._wartet_seit.pop(g.id, None)
            seit = dt_util.as_local(zustand.last_changed) if zustand is not None else None
            if seit is not None and seit > jetzt:
                seit = None  # Uhr zurückgestellt: Zeitpunkt unbekannt
            vorrang = self.funktion_von(g).staffel_vorrang(s_c, schaltet) if s_c is not None else {}
            lasten.append(
                staffel_logik.Last(
                    id=g.id, anschluss=e.get("anschluss") or "", kw=kw, heizer=schaltet, an=an, gruppe=g.bereich,
                    will=bool(schaltet and ein), prio=PRIO.get(e.get("prio") or "normal", 1), **vorrang,
                    an_seit_min=_minuten_seit(seit, jetzt) if an else 0.0,
                    aus_seit_min=_minuten_seit(seit, jetzt) if not an else 1e9,
                    wartet_seit_min=_minuten_seit(self._wartet_seit.get(g.id), jetzt) if g.id in self._wartet_seit else 0.0,
                )
            )
        frei_jetzt = staffel_logik.frei_je_anschluss(anschluesse, lasten)
        self._frei_verlauf.append((jetzt, frei_jetzt))
        while self._frei_verlauf and not 0 <= (jetzt - self._frei_verlauf[0][0]).total_seconds() <= STABIL_S:
            self._frei_verlauf.popleft()
        stabil = {
            a.id: min(werte[a.id] for _, werte in self._frei_verlauf if a.id in werte) for a in anschluesse
        }
        self.daten.warte = {}
        if s["an"]:
            ergebnis = staffel_logik.staffeln(
                anschluesse, lasten,
                staffel_logik.StaffelRegeln(
                    max_gleichzeitig=int(s["max_gleichzeitig"]), min_lauf_min=float(s["min_lauf_min"]),
                    min_pause_min=float(s["min_pause_min"]), takt_min=float(s["takt_min"]),
                ),
                stabil,
            )
            an_set = set(ergebnis.an)
            for gid, grund in ergebnis.wartet.items():
                dran = ergebnis.dran_in_min.get(gid)
                self.daten.warte[gid] = {"grund": grund, "dran_in_min": None if dran is None else max(0, round(dran))}
            self._anlauf_begrenzen(jetzt, lasten, an_set)
            frei_nach = ergebnis.frei_kw
        else:
            an_set = {l.id for l in lasten if l.heizer and l.will}
            frei_nach = {a: round(f, 3) for a, f in frei_jetzt.items()}
        self._staffel_anzeige(anschluesse, lasten, frei_nach)
        return an_set, ziel

    def _anlauf_begrenzen(self, jetzt: datetime, lasten: list[staffel_logik.Last], an_set: set[str]) -> None:
        """Anlaufstaffel: von den neu einzuschaltenden Geräten höchstens eines je ANLAUF_S; die übrigen warten
        („anlauf“) und werden nach ANLAUF_S erneut ausgewertet. Reihenfolge `staffel.anlauf_folge`."""
        neue = staffel_logik.anlauf_folge([l for l in lasten if l.id in an_set and not l.an])
        if not neue:
            return
        frei = self._letzter_anlauf is None or not 0 <= (jetzt - self._letzter_anlauf).total_seconds() < ANLAUF_S
        erlaubt = {neue[0].id} if frei else set()
        if erlaubt:
            self._letzter_anlauf = jetzt
        zurueck = [l.id for l in neue if l.id not in erlaubt]
        for gid in zurueck:
            an_set.discard(gid)
            self.daten.warte[gid] = {"grund": "anlauf", "dran_in_min": 0}
        if zurueck and self._anlauf_geplant is None:
            @callback
            def _weiter(_now: datetime) -> None:
                self._anlauf_geplant = None
                self.auswerten()
            self._anlauf_geplant = async_call_later(self.hass, ANLAUF_S, _weiter)

    def _staffel_anzeige(
        self, anschluesse: list[staffel_logik.Anschluss], lasten: list[staffel_logik.Last], frei: dict[str, float]
    ) -> None:
        """Anschlüsse mit Leistung je Funktion (`staffel_feld`, sonst `sonst_kw`) und die laufenden geschalteten Geräte."""
        s = self.e["staffel"]
        feld = {g.id: f.staffel_feld if (f := self._je_rolle.get(g.rolle)) is not None else "" for g in self.geraete.values()}
        felder = [f.staffel_feld for f in self.funktionen if f.staffel_feld]
        liste = []
        for a, roh in zip(anschluesse, self.e["anschluesse"], strict=True):
            laufend = [l for l in lasten if l.an and l.anschluss == a.id]
            eintrag: dict[str, Any] = {
                "id": a.id, "name": roh.get("name", a.id),
                "voll_kw": round(float(roh["ampere"]) * 230 * int(roh["phasen"]) / 1000, 3),
                "grenze_kw": round(a.grenze_kw, 3), "reserve_kw": a.reserve_kw,
            }
            for name in [*felder, "sonst_kw"]:
                eintrag[name] = round(sum(l.kw for l in laufend if (feld.get(l.id) or "sonst_kw") == name), 3)
            eintrag["frei_kw"] = frei.get(a.id, 0.0)
            liste.append(eintrag)
        geschaltet = [g for g in self.geraete.values() if (f := self._je_rolle.get(g.rolle)) is not None and f.schaltbar(g)]
        self.daten.staffel = {
            "an": bool(s["an"]),
            "laufen": sum(1 for g in geschaltet if (st := self.hass.states.get(g.schalter)) is not None and st.state == STATE_ON),
            "warten": len(self.daten.warte),
            "max": int(s["max_gleichzeitig"]),
            "anschluesse": liste,
        }

    @callback
    def auswerten(self) -> None:
        """Einmal alles durchrechnen, wenn nötig schalten und melden, Entitäten aktualisieren.

        Nie verschachtelt: kommt während einer Auswertung eine Zustandsänderung (z. B. ein Schalter meldet sofort),
        wird danach noch einmal ausgewertet.
        """
        if self._gestoppt:
            return
        if self._in_auswertung:
            self._nochmal = True
            return
        self._in_auswertung = True
        try:
            self._auswerten()
        finally:
            self._in_auswertung = False
        if self._nochmal:
            self._nochmal = False
            self.hass.loop.call_soon(self.auswerten)

    def _auswerten(self) -> None:
        jetzt = dt_util.now()
        self._laufzeit_aufraeumen(jetzt)
        wetter = self._wetter(jetzt)
        self.daten.wetter = wetter
        soll: SollJeBereich = {}
        for f in self.funktionen:
            if f.aktiv():
                soll.update(f.soll(jetzt, wetter))
        an_set, ziel = self._staffeln(jetzt, soll)
        if self.automatik:
            for f in self.funktionen:
                f.nach_soll(soll)
            self._schalten_alle(jetzt, soll, an_set, ziel)
            for f in self.funktionen:
                f.nach_schalten(jetzt, wetter)
        elif any(f.aktiv() and f.schaltet_ohne_automatik() for f in self.funktionen):
            # Automatik aus, aber eine Funktion schaltet trotzdem: ziel enthält nur, was ihr `soll` dann noch schalten will
            self._schalten_alle(jetzt, soll, an_set, ziel)
        self._warnungen(jetzt, soll)
        self._anzeige(jetzt, soll)
        self._status(jetzt)
        self._zeiten_zaehlen(jetzt)
        for update in list(self._listener):
            update()

    def _schalten_alle(
        self, jetzt: datetime, soll: SollJeBereich, an_set: set[str], ziel: dict[str, bool | None]
    ) -> None:
        geschaltet: dict[str, list[tuple[GeraetInfo, bool]]] = {}
        for gid in sorted(ziel, key=lambda x: x in an_set):   # erst alle aus, dann ein – nie kurz Überlast
            g = self.geraete[gid]
            zustand = self.hass.states.get(g.schalter)
            ein = gid in an_set
            if self._schalten(g, zustand, ein, jetzt):
                geschaltet.setdefault(g.bereich, []).append((g, ein))
        if geschaltet:
            self._frei_verlauf.clear()   # eigene Schaltung: der freie Strom von vorhin gilt nicht mehr
        # Staffelung: neu wartende Geräte ins Protokoll (Mockup „Staffelung: Konvektor wartet …“)
        s = self.e["staffel"]
        for gid, w in self.daten.warte.items():
            # „anlauf“ (einer nach dem anderen, dauert Sekunden) ist kein Warten, das ins Protokoll gehört
            if self._letztes_warten.get(gid) != w["grund"] and gid in self.geraete and w["grund"] != "anlauf":
                g = self.geraete[gid]
                text = WARTE_TEXT.get(w["grund"], w["grund"]).format(max=s["max_gleichzeitig"], takt=s["takt_min"])
                self.protokoll("schalten", g.bereich, f"Staffelung: {g.name} wartet ({text})")
        self._letztes_warten = {gid: w["grund"] for gid, w in self.daten.warte.items()}
        if not geschaltet:
            return
        eintraege: dict[tuple[str, bool], list[str]] = {}
        for bid, liste in geschaltet.items():
            s_c = soll[bid][0]
            for ein in {e for _, e in liste}:
                eintraege.setdefault((s_c.grund, ein), []).append(bid)
        alle = {bid for bid, (s_c, _) in soll.items() if s_c.ein is not None}
        for (grund, ein), bids in eintraege.items():
            titel = GRUND_TEXT.get(grund, str(grund))
            if len(bids) > 1 and set(bids) == alle:
                self.protokoll("schalten", None, f"{titel} – alle Container {'ein' if ein else 'aus'}")
                continue
            for bid in bids:
                namen = ", ".join(g.name for g, e in geschaltet[bid] if e == ein)
                self.protokoll("schalten", bid, f"{titel} – {namen} {'ein' if ein else 'aus'}")

    def _schalten(self, g: GeraetInfo, zustand: State | None, ein: bool, jetzt: datetime) -> bool:
        if zustand is None or zustand.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
            return False
        if (zustand.state == STATE_ON) == ein:
            return False
        letzter = self._letzter_befehl.get(g.id)
        if letzter and letzter[0] == ein and jetzt - letzter[1] < timedelta(seconds=55):
            return False
        kontext = Context()
        self._eigene_kontexte.append(kontext.id)
        self._letzter_befehl[g.id] = (ein, jetzt)
        _LOGGER.debug("%s → %s", g.schalter, "ein" if ein else "aus")
        self.hass.async_create_task(
            self.hass.services.async_call(
                "switch", "turn_on" if ein else "turn_off", {"entity_id": g.schalter}, context=kontext
            ),
            f"baustelle_schalten_{g.schalter}",
            eager_start=False,
        )
        return True

    def geraet_aktiv(self, g: GeraetInfo) -> bool:
        """Inaktive Geräte (z. B. ausgeliehen oder defekt) schaltet die Automatik nicht, sie zählen nicht in der
        Staffelung und melden nichts (WU-0004)."""
        return (self.e.get("geraete") or {}).get(g.id, {}).get("aktiv", True) is not False

    def geraet_aktiv_setzen(self, g: GeraetInfo, aktiv: bool) -> None:
        """Aktiv/inaktiv setzen; beim Deaktivieren einmal ausschalten und den Handbetrieb beenden."""
        self.e.setdefault("geraete", {}).setdefault(g.id, {})["aktiv"] = aktiv
        self.lz["hand"].pop(g.id, None)
        self.protokoll("einstellung", g.bereich, f"{g.name}: {'aktiv' if aktiv else 'inaktiv – die Automatik lässt es aus'}")
        zustand = self.hass.states.get(g.schalter)
        if not aktiv and zustand is not None and zustand.state == STATE_ON:
            kontext = Context()
            self._eigene_kontexte.append(kontext.id)
            self.hass.async_create_task(
                self.hass.services.async_call("switch", "turn_off", {"entity_id": g.schalter}, context=kontext),
                f"baustelle_inaktiv_{g.schalter}", eager_start=False,
            )
        self.einstellungen.speichern()
        self.auswerten()

    def geraet_schalten(self, g: GeraetInfo, an: bool) -> None:
        """Gerät von der Seite aus schalten: Handbetrieb bis zum nächsten Schaltpunkt (api §2 `schalten`)."""
        zustand = self.hass.states.get(g.schalter)
        if not (self.automatik and self.funktion_von(g).hand_setzen(g, an)):
            self.protokoll("schalten", g.bereich, f"{g.name} von Hand {'eingeschaltet' if an else 'ausgeschaltet'}")
        self._letzter_befehl.pop(g.id, None)
        if zustand is not None and zustand.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN):
            kontext = Context()
            self._eigene_kontexte.append(kontext.id)
            self.hass.async_create_task(
                self.hass.services.async_call(
                    "switch", "turn_on" if an else "turn_off", {"entity_id": g.schalter}, context=kontext
                ),
                f"baustelle_hand_{g.schalter}",
                eager_start=False,
            )

    def _anzeige(self, jetzt: datetime, soll: SollJeBereich) -> None:
        """Zustand und Text je Bereich wie die Kacheln im Mockup (`TEXT(b)`) – von der Funktion des Bereichs."""
        d = self.daten
        for bid, info in self.bereiche.items():
            geraete = self.geraete_in(bid)
            leistungen = [_zahl(self.hass.states.get(g.leistung)) for g in geraete if g.leistung]
            d.leistung[bid] = sum(x for x in leistungen if x is not None) if leistungen else None
            d.temperatur[bid] = self.temperatur(info.fuehler)
            zustaende = [self.hass.states.get(g.schalter) for g in geraete]
            erreichbar = [z is not None and z.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN) for z in zustaende]
            an = any(z is not None and z.state == STATE_ON for z in zustaende)
            offline = bool(geraete) and not any(erreichbar)
            d.zustand[bid], d.text[bid], d.grund[bid] = self._je_art[info.art].anzeige(bid, info, jetzt, soll, offline, an)

    def _status(self, jetzt: datetime) -> None:
        """Status der Baustelle und Text neben dem Automatik-Chip (Mockup `statusText`)."""
        d = self.daten
        d.naechste = None
        if not self.aktiv:
            d.status, d.status_text = "abgeschlossen", "abgeschlossen"
            return
        for f in self.funktionen:
            if f.aktiv() and (status := f.status(jetzt)) is not None:
                d.status, d.status_text, d.naechste = status
                return

    # ------------------------------------------------------------------ Warnungen
    def warn_einstellungen(self) -> warn_logik.WarnEinstellungen:
        einst: dict[str, Any] = {}
        for f in self.funktionen:
            einst.update(f.warn_einstellungen())
        return warn_logik.WarnEinstellungen.aus_store(self.e["meldungen_einst"], einst)

    def _warnungen_laden(self) -> None:
        """Offene Warnungen vom letzten Lauf (für Beginn und „schon gemeldet“ über einen Neustart hinweg)."""
        for key, w in (self.lz.get("warnungen_offen") or {}).items():
            if isinstance(w, dict) and (zeit := _zeit(w.get("seit"))) is not None:
                art = key.split(":", 1)[0]
                self._warn_alt[key] = warn_logik.Warnung(
                    key, art, str(warn_logik.stufe_von(art)), w.get("bereich"), w.get("geraet"), zeit,
                    dict(w.get("werte") or {}),
                )

    def _geraete_zustand(self, jetzt: datetime) -> list[warn_logik.GeraetZustand]:
        liste = []
        for g in self.geraete.values():
            if not self.geraet_aktiv(g):
                continue   # inaktiv: keine Warnungen (WU-0004)
            zustand = self.hass.states.get(g.schalter)
            erreichbar = zustand is not None and zustand.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
            # Protokoll von HA einmal beim Ausfall und einmal, wenn der Shelly wieder antwortet
            if erreichbar:
                if self._offline_seit.pop(g.id, None) is not None:
                    _LOGGER.info("%s (%s) ist wieder erreichbar", g.name, g.schalter)
            elif g.id not in self._offline_seit:
                self._offline_seit[g.id] = jetzt
                _LOGGER.info("%s (%s) ist nicht erreichbar", g.name, g.schalter)
            leistung = _zahl(self.hass.states.get(g.leistung)) if g.leistung else None
            an = erreichbar and zustand is not None and zustand.state == STATE_ON
            f = self._je_rolle.get(g.rolle)
            typ, laeuft_seit, zyklen = (
                f.geraet_warnung(g, erreichbar, leistung, jetzt) if f is not None else (warn_logik.Typ.SONST, None, 0)
            )
            liste.append(
                warn_logik.GeraetZustand(
                    id=g.id, bereich=g.bereich, typ=typ, name=g.name, erreichbar=erreichbar,
                    offline_seit=self._offline_seit.get(g.id), leistung=leistung, an=an,
                    an_seit=dt_util.as_local(zustand.last_changed) if an and zustand is not None else None,
                    hand_seit=self.funktion_von(g).hand_seit(g), laeuft_seit=laeuft_seit, zyklen_h=zyklen,
                )
            )
        return liste

    def warnung_vergessen(self, bereich: str, art: str) -> None:
        """Eine Warnung still beenden (ohne „wieder ok“ im Protokoll), z. B. nach dem Knopf „Trotzdem heizen“."""
        self._warn_alt = {k: w for k, w in self._warn_alt.items() if not (w.bereich == bereich and w.art == art)}

    def _warnungen(self, jetzt: datetime, soll: SollJeBereich) -> None:
        geraete = self._geraete_zustand(jetzt)
        bereiche = [c for f in self.funktionen if f.aktiv() for c in f.warnungen(jetzt, soll)]
        erreichbar = [g.erreichbar for g in geraete]
        self.daten.erreichbar = None if not erreichbar else not warn_logik.baustelle_offline(erreichbar)
        wetter_da = (
            not any(f.braucht_wetter and f.aktiv() for f in self.funktionen)
            or not self.entry.options.get(CONF_WETTER) or self._prognose_da
            or jetzt - self._gestartet < FEHLT_NACH
        )
        zustand = warn_logik.BaustellenZustand(geraete=tuple(geraete), container=tuple(bereiche), wetter_vorhanden=wetter_da)
        neu = warn_logik.behalte_seit(warn_logik.pruefe(zustand, self.warn_einstellungen(), jetzt), self._warn_alt.values())
        self.daten.warnungen = neu
        self.daten.probleme = {g.id: [] for g in self.geraete.values()}
        for w in neu:
            if w.geraet in self.daten.probleme and w.stufe == warn_logik.Stufe.STOERUNG:
                self.daten.probleme[w.geraet].append(w.art)
        if not self.aktiv:
            self._warn_alt = {w.key: w for w in neu}
            return
        stumm = {k: z for k, v in self.e["stumm"].items() if (z := _zeit(v)) is not None}
        alt = self._warn_alt
        for w in neu:
            if w.key not in alt:
                art, text = next(
                    (t for f in self.funktionen if (t := f.warnung_protokoll(w)) is not None),
                    ("warnung", texte.protokoll_warnung(w)),
                )
                self.protokoll(art, w.bereich, text)
        neu_keys = {w.key for w in neu}
        for key, w in alt.items():
            if key not in neu_keys:
                self.protokoll("ok", w.bereich, texte.wieder_ok(w))
        bisher = set(self.lz.get("gemeldet") or [])
        gemeldet = warn_logik.zu_melden(neu, bisher, stumm, jetzt)
        for w in gemeldet:
            self.nachrichten.warnung_melden(w)
        self.lz["gemeldet"] = sorted(warn_logik.gemeldet_merken(neu, bisher, gemeldet))
        offen = {
            w.key: {"seit": w.seit.isoformat(timespec="seconds"), "bereich": w.bereich, "geraet": w.geraet,
                    "werte": {k: v for k, v in w.werte.items() if isinstance(v, (str, int, float, bool))}}
            for w in neu
        }
        if set(offen) != set(self.lz.get("warnungen_offen") or {}) or gemeldet:
            self.lz["warnungen_offen"] = offen
            self.einstellungen.speichern()
        else:
            self.lz["warnungen_offen"] = offen
        self._warn_alt = {w.key: w for w in neu}

    # ------------------------------------------------------------------ Bericht
    def bericht_planen(self) -> None:
        """Nächsten Wochen-/Monatsbericht einplanen (logik/bericht.naechster_bericht)."""
        if self._bericht_abmelden:
            self._bericht_abmelden()
            self._bericht_abmelden = None
        if self.nachrichten is None:
            return
        naechster = self.nachrichten.naechster_bericht(dt_util.now())
        if naechster is None:
            return
        zeitpunkt, art = naechster

        @callback
        def faellig(_now: datetime) -> None:
            self._bericht_abmelden = None
            if self.aktiv:
                self.entry.async_create_background_task(
                    self.hass, self.nachrichten.async_bericht_senden(art, zeitpunkt), "baustelle_bericht"
                )
            self.bericht_planen()

        self._bericht_abmelden = async_track_point_in_time(self.hass, faellig, zeitpunkt)

    # ------------------------------------------------------------------ Zählen (Energie; Zeiten zählen die Funktionen)
    @property
    def zaehler(self) -> dict[str, Any]:
        """Dauerhafte Zähler der Baustelle (im Store, in der Sicherung)."""
        zaehler: dict[str, Any] = self.einstellungen.daten["zaehler"]
        return zaehler

    def zaehler_plus(self, key: str, wert: float) -> None:
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
        preis = float(self.e["preis"])
        for key in ("energie", f"energie:{g.bereich}"):
            self.zaehler_plus(key, kwh)
        for key in ("kosten", f"kosten:{g.bereich}"):
            self.zaehler_plus(key, kwh * preis)
        if (f := self._je_rolle.get(g.rolle)) is not None:
            f.energie_buchen(g, kwh)

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
        """Zeiten der Funktionen (`zaehlen_geraet`, `zaehlen_bereich`, `zaehlen_ende`) und Energie der Shellys ohne Energiezähler."""
        vorher, self._letzte_auswertung = self._letzte_auswertung, jetzt
        if vorher is None or not self.aktiv:
            return
        stunden = (jetzt - vorher).total_seconds() / 3600
        if stunden <= 0 or stunden > MAX_SCHRITT_H:
            return
        for bid, info in self.bereiche.items():
            in_betrieb = False
            for g in self.geraete_in(bid):
                zustand = self.hass.states.get(g.schalter)
                an = zustand is not None and zustand.state == STATE_ON
                leistung = _zahl(self.hass.states.get(g.leistung)) if g.leistung else None
                if (f := self._je_rolle.get(g.rolle)) is not None and f.zaehlen_geraet(g, an, leistung, stunden):
                    in_betrieb = True
                if not g.energie and an:
                    self._energie_buchen(g, leistung_integriert(leistung, stunden))
            self._je_art[info.art].zaehlen_bereich(bid, in_betrieb, jetzt, stunden)
        for f in self.funktionen:
            f.zaehlen_ende(jetzt, stunden)


def _einstellung_text(pfad: tuple[str, ...], wert: Any) -> str:
    """Protokolltext einer geänderten Einstellung (Einstellungen einer Funktion: `Funktion.einstellung_text`)."""
    if pfad == ("automatik",):
        return "Automatik eingeschaltet" if wert else "Automatik ausgeschaltet"
    if isinstance(wert, bool):
        wert_text = "ein" if wert else "aus"
    elif wert is None:
        wert_text = "–"
    else:
        wert_text = str(wert).replace(".", ",") if isinstance(wert, float) else str(wert)
    name = ".".join(pfad[2:]) if pfad[0] == "bereiche" else ".".join(pfad)
    return f"Einstellung {name}: {wert_text}"


# Sensoren am Shelly, die nie Verbrauch sind (Shelly: Energieeinspeisung)
KEIN_VERBRAUCH = {"energy_returned"}


def _sensor_am_geraet(registry: er.EntityRegistry, schalter: str, device_class: str) -> str | None:
    """Leistungs- bzw. Energiesensor desselben Shelly finden.

    Eigene Sensoren der Baustelle (hängen am Shelly-Gerät) und die Einspeisung zählen nicht; bei Mehrkanal gleicher
    Namensanfang; bleiben mehrere (z. B. „Energie“ und „Energieverbrauch“), der mit dem kürzesten Namen – der
    Hauptsensor. Vorher gab es bei mehreren gar keinen, der Container zählte dann nichts (FE-0003).
    """
    eintrag = registry.async_get(schalter)
    if eintrag is None or eintrag.device_id is None:
        return None
    kandidaten = [
        x.entity_id
        for x in er.async_entries_for_device(registry, eintrag.device_id)
        if x.domain == "sensor" and x.platform != DOMAIN and not x.disabled
        and (x.device_class or x.original_device_class) == device_class and x.translation_key not in KEIN_VERBRAUCH
    ]
    if len(kandidaten) > 1:
        stamm = schalter.split(".", 1)[1]
        kandidaten = [k for k in kandidaten if k.split(".", 1)[1].startswith(stamm)]
    return min(kandidaten, key=lambda k: (len(k), k)) if kandidaten else None


def _antwort_liste(antwort: ServiceResponse, entity_id: str, key: str) -> list[dict[str, Any]]:
    """Liste `key` einer Entität aus der Antwort eines Dienstes (`weather.get_forecasts`, `calendar.get_events`)."""
    je_entitaet = (antwort or {}).get(entity_id)
    liste = je_entitaet.get(key) if isinstance(je_entitaet, dict) else None
    return [x for x in liste if isinstance(x, dict)] if isinstance(liste, list) else []


def _prognose_je_tag(liste: list[dict[str, Any]], art: str) -> dict[date, dict[str, float | None]]:
    """Je Tag: tiefster Wert 4–8 Uhr („frueh“), Tageshöchstwert („max“), Niederschlag („regen“)."""
    tage: dict[date, dict[str, float | None]] = {}
    for eintrag in liste:
        zeit = dt_util.parse_datetime(str(eintrag.get("datetime", "")))
        if zeit is None:
            continue
        zeit = dt_util.as_local(zeit)
        tag = tage.setdefault(zeit.date(), {"frueh": None, "max": None, "regen": None})
        temp = eintrag.get("temperature")
        regen = eintrag.get("precipitation")
        if art == "hourly":
            if temp is not None:
                tag["max"] = temp if tag["max"] is None else max(tag["max"], temp)
                if 4 <= zeit.hour <= 8:
                    tag["frueh"] = temp if tag["frueh"] is None else min(tag["frueh"], temp)
            if regen is not None:
                tag["regen"] = (tag["regen"] or 0.0) + float(regen)
        else:
            tag["max"] = temp
            tag["frueh"] = eintrag.get("templow")
            tag["regen"] = float(regen) if regen is not None else None
    return tage


def _prognose_auswerten(liste: list[dict[str, Any]], art: str, jetzt: datetime) -> dict[str, float | None]:
    """Wie 0.6: Tageshöchstwert, Früh-Prognose (nächster Morgen) und Regen heute."""
    tage = _prognose_je_tag(liste, art)
    heute = jetzt.date()
    morgen = heute if (jetzt.hour < 8 and art == "hourly") else heute + timedelta(days=1)
    return {
        "max_heute": tage.get(heute, {}).get("max"),
        "frueh": tage.get(morgen, {}).get("frueh"),
        "regen_heute": tage.get(heute, {}).get("regen"),
    }
