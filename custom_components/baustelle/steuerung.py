"""Laufzeit einer Baustelle: Zustände lesen, Fachlogik anwenden, Shellys schalten, melden (Bauplan 0.7 §3).

Jede Minute und bei jeder Zustandsänderung der beteiligten Entitäten:

1. je Container `regelung.soll_container` (Plan aus `arbeitszeit.tagesplan`, Feiertag/Urlaub aus den Kalendern, Wetter,
   Termine aus `termine_kalender`, Türkontakt, Bedarf/Boost/„alle jetzt heizen“ aus `laufzeit`),
2. `staffel.staffeln` über alle Anschlüsse (`frei_stabil` = kleinster freier Wert der letzten 60 s),
3. schalten – nur Heizkörper; Pumpen, Steckdosen und Trockner zählen nur mit (Mockup „geschaltet werden nur Heizungen“),
4. Warnungen (`logik/warnungen.py`), Handy-Nachrichten, Protokoll, Zähler.

Geschaltet wird nur, wenn die Baustelle aktiv und die Automatik eingeschaltet ist. Wer einen Heizkörper von Hand
schaltet, stellt ihn bis zum nächsten Schaltpunkt auf Hand (wie 0.6).
"""

from __future__ import annotations

from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import date, datetime, time, timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_TEMPERATURE, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Context, Event, EventStateChangedData, HomeAssistant, State, callback
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
    ART_CONTAINER,
    ART_PUMPENSCHACHT,
    CONF_ART,
    CONF_BEREICH,
    CONF_EMPFAENGER,
    CONF_ENDE,
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
    EVENT_PROTOKOLL,
    HEIZROLLEN,
    ROLLE_HEIZKOERPER,
    ROLLE_PUMPE,
    STATUS_AKTIV,
    SUB_BEREICH,
    SUB_GERAET,
    TERMINE_INTERVALL_MIN,
    WETTER_INTERVALL_MIN,
)
from .einstellungen import Einstellungen
from .logik import staffel as staffel_logik, warnungen as warn_logik
from .logik.arbeitszeit import (
    Arbeitszeit,
    Ausnahme,
    AusnahmeArt,
    HeizRegeln,
    Plan,
    StatusArt,
    WetterTag,
    bedarf_fenster,
    im_fenster,
    status as plan_status,
    tagesplan,
    uhrzeit,
)
from .logik.pumpen import PumpenZustand, baustelle_offline, laeuft
from .logik.regelung import LageContainer, Soll, SollGrund, soll_container
from .logik.zaehlen import (
    ABKUEHL_MIN_H,
    AUFHEIZ_MIN_H,
    energie_zuwachs,
    gradstunden,
    hochrechnung,
    leistung_integriert,
    mittel,
    mittel_im_betrieb,
    rate,
    tage_heizperiode,
)
from . import texte

_LOGGER = logging.getLogger(__name__)

ZAEHLER_SPEICHERN_S = 30
MAX_SCHRITT_H = 5 / 60  # längere Lücken (Neustart) zählen nicht als Laufzeit
FEHLT_NACH = timedelta(minutes=10)  # so lange darf eine Entität nach dem Start fehlen (andere Integrationen laden)
STABIL_S = 60  # Staffelung: kleinster freier Wert der letzten Minute
ANLAUF_S = 20  # Staffelung: Heizkörper gehen nacheinander an, höchstens einer je 20 s (kein gemeinsamer Einschaltstoß)
STANDARD_HEIZ_KW = 2.0  # Heizkörper ohne Messung (Mockup: 2,0 kW)
ZIEHT_STROM_W = 50  # „über 50 W = zieht Strom“ (api-0.7 §1)
FRUEHSTART_NACHRICHT = time(18, 0)  # Abend vorher: „Morgen −4 °C – Vorheizen startet schon um …“
FRUEHER_MIN = 30  # Knopf „Noch früher“
WETTER_PROTOKOLL_AB = time(5, 0)  # Mockup: „05:00 wetter …“
PRIO = {"niedrig": staffel_logik.Prio.NIEDRIG, "normal": staffel_logik.Prio.NORMAL, "hoch": staffel_logik.Prio.HOCH}
ROLLE_API = {"heizkoerper": "heizung", "bautrockner": "trockner", "pumpe": "pumpe", "steckdose": "steckdose"}
HEIZ_GRUENDE = {
    SollGrund.FRUEHSTART, SollGrund.VORHEIZEN, SollGrund.ARBEITSZEIT, SollGrund.NACHHEIZEN, SollGrund.TROCKNEN,
    SollGrund.BEDARF, SollGrund.BOOST, SollGrund.FROST, SollGrund.ABSENKEN,
}
MODI = ("plan", "thermo", "bedarf", "hand", "aus")
GRUND_TEXT = {
    SollGrund.FRUEHSTART: "Frühstart",
    SollGrund.VORHEIZEN: "Vorheizen",
    SollGrund.ARBEITSZEIT: "Arbeitszeit",
    SollGrund.NACHHEIZEN: "Nachheizen",
    SollGrund.TROCKNEN: "Kleidung trocknen",
    SollGrund.BEDARF: "Bei Bedarf",
    SollGrund.BOOST: "Schnell aufheizen",
    SollGrund.FROST: "Frostschutz",
    SollGrund.TUER_OFFEN: "Tür offen – Heizung pausiert",
    SollGrund.BEREIT: "Bedarf vorbei",
    SollGrund.FREI: "Frei",
    SollGrund.HEIZGRENZE: "Heizgrenze",
    SollGrund.AUSSERHALB: "Heizzeit vorbei",
    SollGrund.AUS: "Aus – nur Frostschutz",
    SollGrund.ABSENKEN: "Abgesenkt",
}
WARTE_TEXT = {
    "anschluss_voll": "Anschluss voll",
    "max_gleichzeitig": "höchstens {max} gleichzeitig",
    "mindestpause": "Mindestpause",
    "rundlauf": "Rundlauf {takt} min",
    "anlauf": "Anlauf",
}


def _zahl(state: State | None) -> float | None:
    if state is None or state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return None
    try:
        return float(state.state)
    except ValueError:
        return None


def _zeit(text: Any) -> datetime | None:
    if not text:
        return None
    zeit = dt_util.parse_datetime(str(text))
    return dt_util.as_local(zeit) if zeit is not None else None


def _minuten_seit(seit: datetime | None, jetzt: datetime) -> float:
    return 1e9 if seit is None else max(0.0, (jetzt - seit).total_seconds() / 60)


def _mitternacht(tag: date) -> datetime:
    return datetime.combine(tag, time.min, tzinfo=dt_util.get_default_time_zone())


def morgen_frueh(jetzt: datetime) -> datetime:
    """„Bis morgen“: nächster Tag 07:00 (Arbeitsbeginn im Mockup)."""
    return datetime.combine(jetzt.date() + timedelta(days=1), time(7, 0), tzinfo=jetzt.tzinfo)


@dataclass
class BereichInfo:
    """Ein Container oder Pumpenschacht aus der Einrichtung."""

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
    pumpe_laeuft: dict[str, bool] = field(default_factory=dict)
    erreichbar: bool | None = None
    wetter: WetterWerte = field(default_factory=WetterWerte)
    zu_warm: bool = False
    warnungen: list[warn_logik.Warnung] = field(default_factory=list)
    warte: dict[str, dict[str, Any]] = field(default_factory=dict)
    staffel: dict[str, Any] = field(default_factory=dict)
    plaene: dict[str, Plan | None] = field(default_factory=dict)


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
        self._frost: dict[str, bool] = {}
        self._offline_seit: dict[str, datetime] = {}
        self._laeuft_seit: dict[str, datetime] = {}
        self._starts: dict[str, deque[datetime]] = {}
        self._unter_soll_seit: dict[str, datetime] = {}
        self._wartet_seit: dict[str, datetime] = {}
        self._hand_phase: dict[str, bool] = {}
        self._frei_verlauf: deque[tuple[datetime, dict[str, float]]] = deque()
        self._letzter_anlauf: datetime | None = None
        self._anlauf_geplant: CALLBACK_TYPE | None = None
        self._tuer_trotzdem: set[str] = set()
        self._letzte_soll: dict[str, tuple[bool | None, str]] = {}
        self._letztes_warten: dict[str, str] = {}
        self._warn_alt: dict[str, warn_logik.Warnung] = {}
        self._zu_warm_vorher: bool | None = None
        self._letzte_auswertung: datetime | None = None
        self._gestartet = dt_util.now()
        self._phase: dict[str, tuple[bool, datetime, float]] = {}  # Bereich → (heizt, seit, Temperatur beim Beginn)
        self.kalender_tage: dict[str, set[date]] = {"feiertag": set(), "urlaub": set()}
        self.kalender_namen: dict[date, str] = {}
        self.termine: list[dict[str, Any]] = []
        self.nachrichten: Any = None  # Nachrichten (nachrichten.py), nach dem Start gesetzt
        self._in_auswertung = False
        self._nochmal = False
        self._gestoppt = False
        self._plan_cache: dict[tuple[date, bool], Plan | None] = {}

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

    @property
    def e(self) -> dict[str, Any]:
        """Die gespeicherten Einstellungen (Store v2)."""
        return self.einstellungen.daten

    @property
    def lz(self) -> dict[str, Any]:
        """Laufzeitdaten im Store (Bedarf, Boost, „alle jetzt heizen“, Hand)."""
        return self.einstellungen.daten["laufzeit"]

    @property
    def automatik(self) -> bool:
        return self.aktiv and self.heizung and bool(self.e["automatik"])

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

    def container(self) -> list[BereichInfo]:
        return [b for b in self.bereiche.values() if b.art == ART_CONTAINER]

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

        beobachtet: set[str] = set()
        for g in self.geraete.values():
            beobachtet.update(x for x in (g.schalter, g.leistung, g.energie) if x)
        for b in self.bereiche.values():
            if b.fuehler:
                beobachtet.add(b.fuehler)
            if tuer := self.einstellungen.bereich(b.id).get("tuer"):
                beobachtet.add(tuer)
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
            self.protokoll("einstellung", pfad[1] if pfad[0] == "bereiche" else None, _einstellung_text(pfad, wert))
        if pfad[0] == "bericht":
            self.bericht_planen()
        if pfad[0] == "termine_kalender" or pfad[-1] == "bedarf":
            # Termine gehören nur zu Bedarfs-Containern: nach dem Umstellen gleich neu zuordnen, nicht erst in 15 min
            self.entry.async_create_background_task(self.hass, self._async_kalender(), "baustelle_kalender")
        if pfad[0] == "bereiche" and pfad[-1] == "tuer" and wert and not self._gestoppt:
            # neuer Türkontakt: sofort auf Öffnen/Schließen reagieren (sonst erst im Minutentakt)
            self._abmelden.append(async_track_state_change_event(self.hass, [wert], self._zustand_geaendert))
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
        """Wer einen Shelly in HA von Hand schaltet, stellt ihn bis zum nächsten Schaltpunkt auf Hand (wie 0.6)."""
        if not self.automatik or neu.state not in ("on", "off"):
            return
        kontext = neu.context
        if kontext.user_id is None or kontext.id in self._eigene_kontexte or kontext.parent_id in self._eigene_kontexte:
            return
        for g in self.geraete.values():
            if g.schalter == entity_id and g.rolle != ROLLE_PUMPE:
                self.hand_setzen(g, neu.state == STATE_ON)

    def hand_setzen(self, g: GeraetInfo, an: bool) -> None:
        """Gerät auf Hand: Heizkörper bis zum nächsten Schaltpunkt, andere, solange sie eingeschaltet sind."""
        hand = self.lz["hand"]
        if g.rolle != ROLLE_HEIZKOERPER and not an:
            if hand.pop(g.id, None) is not None:
                self.einstellungen.speichern()
            return
        if g.id not in hand:
            hand[g.id] = dt_util.now().isoformat(timespec="seconds")
            self._hand_phase.pop(g.id, None)
            self.einstellungen.speichern()
        self.protokoll("schalten", g.bereich, f"{g.name} von Hand {'eingeschaltet' if an else 'ausgeschaltet'}")

    def hand_beenden(self, gid: str, grund: str = "") -> None:
        if self.lz["hand"].pop(gid, None) is not None:
            self._hand_phase.pop(gid, None)
            self.einstellungen.speichern()
            g = self.geraete.get(gid)
            if g is not None and grund:
                self.protokoll("schalten", g.bereich, f"{g.name}: {grund}")

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
            liste = (antwort or {}).get(wetter, {}).get("forecast") or []
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
        return self.lz.get("wetter_tage", {}).get(tag.isoformat(), {})

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
        """Wetter eines Tages für den Plan (Frühstart, nach Regen früher, Kleidung trocknen)."""
        heute = self._wetter_tag(tag)
        return WetterTag(
            frueh_min_temp=heute.get("frueh"),
            regen_vortag_mm=self._wetter_tag(tag - timedelta(days=1)).get("regen"),
            regen_heute_mm=heute.get("regen"),
        )

    def zu_warm(self, wetter: WetterWerte) -> bool:
        h = self.e["heizung"]
        wert = wetter.aussen_max if h["heizgrenze_basis"] == "tageshoechst" else wetter.aussen
        return wert is not None and wert > float(h["heizgrenze"])

    # ------------------------------------------------------------------ Kalender
    async def _async_kalender(self, _now: datetime | None = None) -> None:
        """Feiertage, Urlaub und Termine der laufenden und nächsten Woche (Dienst calendar.get_events)."""
        heute = dt_util.now().date()
        start = _mitternacht(heute - timedelta(days=heute.weekday()))
        ende = start + timedelta(days=15)
        o = self.entry.options
        for art, key in (("feiertag", CONF_FEIERTAG_KALENDER), ("urlaub", CONF_URLAUB_KALENDER)):
            tage: set[date] = set()
            for ev in await self._async_events(o.get(key), start, ende):
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
        await self._async_termine(start, ende)
        self.auswerten()

    async def _async_events(self, entity_id: str | None, start: datetime, ende: datetime) -> list[dict[str, Any]]:
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
        return list((antwort or {}).get(entity_id, {}).get("events") or [])

    async def _async_termine(self, start: datetime, ende: datetime) -> None:
        """Termine der Bedarfs-Container aus `termine_kalender` (Serien löst der Kalender auf)."""
        kalender = self.e.get("termine_kalender")
        events = await self._async_events(kalender, start, ende)
        details = await self._async_event_details(kalender, start, ende) if events else {}
        bedarf = [b for b in self.container() if self.einstellungen.bereich(b.id).get("bedarf")]
        termine: list[dict[str, Any]] = []
        for ev in events:
            von, bis = _ev_zeit(ev.get("start")), _ev_zeit(ev.get("end"))
            if von is None or bis is None:
                continue
            bid = _termin_bereich(ev, bedarf)
            if bid is None:
                continue
            uid, rrule = details.get((von.isoformat(), str(ev.get("summary") or "")), ("", None))
            termine.append({
                "bereich": bid, "von": von.isoformat(), "bis": bis.isoformat(),
                "titel": str(ev.get("summary") or ""), "uid": uid, "rrule": rrule,
                "wiederholung": _wiederholung(rrule), "boost": "boost" in str(ev.get("description") or "").lower(),
            })
        self.termine = sorted(termine, key=lambda t: t["von"])

    async def _async_event_details(
        self, entity_id: str | None, start: datetime, ende: datetime
    ) -> dict[tuple[str, str], tuple[str, str | None]]:
        """uid und rrule je Termin (liefert calendar.get_events nicht) – direkt von der Kalender-Entität."""
        try:
            from homeassistant.components.calendar import DATA_COMPONENT  # noqa: PLC0415

            entity = self.hass.data[DATA_COMPONENT].get_entity(entity_id or "")
            if entity is None:
                return {}
            events = await entity.async_get_events(self.hass, start, ende)
        except (KeyError, HomeAssistantError, AttributeError, NotImplementedError) as err:
            _LOGGER.debug("Termin-Details von %s nicht lesbar: %s", entity_id, err)
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
        return bool(entity_id) and (s := self.hass.states.get(entity_id)) is not None and s.state == STATE_ON

    # ------------------------------------------------------------------ Plan
    def heiz_regeln(self) -> HeizRegeln:
        h = self.e["heizung"]
        return HeizRegeln(
            vorheizen_min=int(h["vorheizen_min"]), nachheizen_min=int(h["nachheizen_min"]),
            fruehstart=bool(h["fruehstart"]), fruehstart_unter=float(h["fruehstart_unter"]),
            fruehstart_min=int(h["fruehstart_min"]), trocknen_ab_mm=float(h["trocknen_ab_mm"]),
            trocknen_laenger_min=int(h["trocknen_laenger_min"]), trocknen_frueher_min=int(h["trocknen_frueher_min"]),
        )

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

    def ist_frei(self, tag: date) -> bool:
        art = self.frei_art(tag)
        return art == "urlaub" or (art == "feiertag" and bool(self.e["heizung"]["feiertag_frei"]))

    def plan(self, tag: date, trocknen: bool) -> Plan | None:
        """Heizplan eines Tages (logik/arbeitszeit.tagesplan), dazu „Noch früher“ aus der Nachricht.

        Je Auswertung zwischengespeichert (sie läuft bei jeder Zustandsänderung, z. B. jedem Leistungswert).
        """
        if (tag, trocknen) in self._plan_cache:
            return self._plan_cache[(tag, trocknen)]
        p = tagesplan(
            tag, self.arbeitszeiten(), self.ausnahmen(), self.heiz_regeln(), self.wetter_tag_plan(tag), trocknen,
            frei=self.ist_frei(tag),
        )
        extra = int(self.lz.get("frueher", {}).get(tag.isoformat()) or 0)
        if p is not None and extra:
            p = replace(p, start=max(0, p.start - extra))
        self._plan_cache[(tag, trocknen)] = p
        return p

    def plan_neu(self) -> None:
        """Nach einer Änderung an Arbeitszeit, Ausnahmen oder „Noch früher“ neu rechnen."""
        self._plan_cache.clear()

    # ------------------------------------------------------------------ Auswertung
    def temperatur(self, fuehler: str | None) -> float | None:
        if not fuehler or (s := self.hass.states.get(fuehler)) is None:
            return None
        if fuehler.startswith("climate."):
            wert = s.attributes.get("current_temperature")
            return float(wert) if isinstance(wert, (int, float)) else None
        return _zahl(s)

    def modus(self, bid: str) -> str:
        """Modus eines Containers (neu 0.7.8): gesetzt oder wie bisher aus `auto`, `bedarf` und dem Fühler abgeleitet."""
        e = self.einstellungen.bereich(bid)
        if e.get("modus") in MODI:
            return str(e["modus"])
        if e["bedarf"]:
            return "bedarf"
        if not e["auto"]:
            return "hand"
        info = self.bereiche.get(bid)
        return "thermo" if info is not None and info.fuehler else "plan"

    def soll_temperatur(self, bid: str) -> float:
        b = self.einstellungen.bereich(bid)
        return float(b["soll"] if b.get("soll") is not None else self.e["heizung"]["soll"])

    def jetzt_bis(self, jetzt: datetime) -> datetime | None:
        bis = _zeit(self.lz.get("jetzt_bis"))
        return bis if bis is not None and bis > jetzt else None

    def bis(self, art: str, bid: str, jetzt: datetime) -> datetime | None:
        bis = _zeit(self.lz[art].get(bid))
        return bis if bis is not None and bis > jetzt else None

    def _laufzeit_aufraeumen(self, jetzt: datetime) -> None:
        geaendert = False
        for art in ("bedarf_bis", "boost_bis"):
            for bid, bis in list(self.lz[art].items()):
                ende = _zeit(bis)
                if ende is None or ende <= jetzt or bid not in self.bereiche:
                    del self.lz[art][bid]
                    geaendert = True
                    if art == "bedarf_bis" and bid in self.bereiche and ende is not None:
                        self.protokoll("schalten", bid, "Bedarf vorbei – heizt wieder nur bei Bedarf")
        if self.lz.get("jetzt_bis") and self.jetzt_bis(jetzt) is None:
            self.lz["jetzt_bis"] = None
            geaendert = True
            self.protokoll("schalten", None, "„Alle jetzt heizen“ beendet")
        for key, bis in list(self.e["stumm"].items()):
            if (ende := _zeit(bis)) is None or ende <= jetzt:
                del self.e["stumm"][key]
                geaendert = True
        for gid in [g for g in self.lz["hand"] if g not in self.geraete]:
            del self.lz["hand"][gid]
            geaendert = True
        grenze = (jetzt.date() - timedelta(days=1)).isoformat()
        for iso in [k for k in self.lz.get("frueher", {}) if k < grenze]:
            del self.lz["frueher"][iso]
        if geaendert:
            self.einstellungen.speichern()

    def _termin_fenster(self, bid: str) -> list[tuple[datetime, datetime, bool]]:
        """Termine eines Bedarfs-Containers als (von, bis, boost)."""
        return [
            (von, bis, bool(t.get("boost")))
            for t in self.termine
            if t["bereich"] == bid and (von := _zeit(t["von"])) is not None and (bis := _zeit(t["bis"])) is not None
        ]

    def _soll_je_container(self, jetzt: datetime, wetter: WetterWerte, zu_warm: bool) -> dict[str, tuple[Soll, LageContainer]]:
        heute, minute = jetzt.date(), jetzt.hour * 60 + jetzt.minute
        h = self.e["heizung"]
        jetzt_bis = self.jetzt_bis(jetzt)
        frei_heute = self.ist_frei(heute)
        ergebnis: dict[str, tuple[Soll, LageContainer]] = {}
        for info in self.container():
            bid = info.id
            e = self.einstellungen.bereich(bid)
            plan = self.plan(heute, bool(e["trocknen"]))
            self.daten.plaene[bid] = plan
            frei, warm = frei_heute, zu_warm
            if jetzt_bis is not None:
                # „alle jetzt heizen“: wie in der Arbeitszeit, auch an freien Tagen und über der Heizgrenze (§5)
                ende = 24 * 60 if jetzt_bis.date() > heute else jetzt_bis.hour * 60 + jetzt_bis.minute
                if plan is None or not (plan.start <= minute < plan.ende):
                    plan = Plan(start=minute, vor=minute, a=minute, b=max(minute + 1, ende), nach=max(minute + 1, ende),
                                ende=max(minute + 1, ende))
                frei, warm = False, False
            temp = self.temperatur(info.fuehler)
            soll_t = self.soll_temperatur(bid)
            tuer_min = None
            tuer = e.get("tuer")
            if tuer and (s := self.hass.states.get(tuer)) is not None and s.state == STATE_ON:
                if bid not in self._tuer_trotzdem:
                    tuer_min = _minuten_seit(dt_util.as_local(s.last_changed), jetzt)
            else:
                self._tuer_trotzdem.discard(bid)
            fenster = self._termin_fenster(bid)
            aktive = [f for f in fenster if im_fenster(bedarf_fenster([(f[0], f[1])], int(h["vorheizen_min"])), jetzt)]
            bedarf_aktiv = self.bis("bedarf_bis", bid, jetzt) is not None or bool(aktive) or jetzt_bis is not None
            boost = self.bis("boost_bis", bid, jetzt) is not None or any(f[2] for f in aktive)
            if boost and temp is not None and temp >= soll_t and bid in self.lz["boost_bis"]:
                del self.lz["boost_bis"][bid]  # Soll erreicht: Boost beendet (Aufrufer, Bauplan §2.2)
                self.einstellungen.speichern()
                boost = False
            heizer = [g for g in self.geraete_in(bid) if g.rolle == ROLLE_HEIZKOERPER and g.id not in self.lz["hand"]]
            heizt = any((s := self.hass.states.get(g.schalter)) is not None and s.state == STATE_ON for g in heizer)
            lage = LageContainer(
                minute=minute, plan=plan, automatik=self.automatik, auto=bool(e["auto"]), temperatur=temp, soll=soll_t,
                frost=bool(h["frost"]), frost_grenze=float(h["frost_grenze"]), zu_warm=warm, frei=frei,
                tuer_offen_min=tuer_min, bedarf=bool(e["bedarf"]), bedarf_aktiv=bedarf_aktiv, boost=boost,
                heizt_gerade=heizt, toleranz=float(h["toleranz"]), frost_vorher=self._frost.get(bid, False),
                modus=self.modus(bid), frost_aus=None if h.get("frost_aus") is None else float(h["frost_aus"]),
                frei_modus=str(h.get("frei_modus") or "frost"), absenk=float(h.get("absenk") or 10.0),
                frost_immer=bool(h.get("frost_immer")),
            )
            soll = soll_container(lage, int(h["tuer_pause_min"]))
            self._frost[bid] = soll.grund == SollGrund.FROST
            ergebnis[bid] = (soll, lage)
        return ergebnis

    def nenn_kw(self, g: GeraetInfo) -> float:
        """Leistung eines Geräts für die Staffelung: gemessenes Mittel im Betrieb, sonst 2,0 kW (Heizkörper)."""
        mittel_w = self.zaehler.get(f"mittel:{g.id}")
        if isinstance(mittel_w, (int, float)) and mittel_w > ZIEHT_STROM_W:
            return round(mittel_w / 1000, 3)
        return STANDARD_HEIZ_KW if g.rolle in HEIZROLLEN else 0.0

    def _staffeln(
        self, jetzt: datetime, soll: dict[str, tuple[Soll, LageContainer]]
    ) -> tuple[set[str], dict[str, bool | None]]:
        """Staffelung über alle Anschlüsse; liefert die Heizer, die laufen sollen, und das Ziel je Heizer."""
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
            e = self.einstellungen.bereich(g.bereich)
            leistung_w = _zahl(self.hass.states.get(g.leistung)) if g.leistung else None
            s_c = soll.get(g.bereich)
            heizer = (
                g.rolle == ROLLE_HEIZKOERPER and s_c is not None and s_c[0].ein is not None
                and g.id not in self.lz["hand"] and erreichbar
            )
            if heizer:
                kw = self.nenn_kw(g)  # vorsichtig: auch wenn der Thermostat gerade nicht zieht
                ziel[g.id] = bool(s_c[0].ein)
            else:
                kw = (leistung_w / 1000 if leistung_w is not None else (self.nenn_kw(g) if an else 0.0)) if an else 0.0
            if heizer and s_c[0].ein and not an:
                self._wartet_seit.setdefault(g.id, jetzt)
            else:
                self._wartet_seit.pop(g.id, None)
            seit = dt_util.as_local(zustand.last_changed) if zustand is not None else None
            if seit is not None and seit > jetzt:
                seit = None  # Uhr zurückgestellt: Zeitpunkt unbekannt
            lage = s_c[1] if s_c is not None else None
            lasten.append(
                staffel_logik.Last(
                    id=g.id, anschluss=e.get("anschluss") or "", kw=kw, heizer=heizer, an=an,
                    will=bool(heizer and s_c[0].ein), prio=PRIO.get(e.get("prio") or "normal", 1),
                    frost=bool(heizer and s_c[0].grund == SollGrund.FROST),
                    boost=bool(heizer and s_c[0].grund == SollGrund.BOOST),
                    defizit=(lage.soll - lage.temperatur) if lage is not None and lage.temperatur is not None else None,
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
        """Anlaufstaffel: von den neu einzuschaltenden Heizkörpern höchstens einen je ANLAUF_S; die übrigen warten
        („anlauf“) und werden nach ANLAUF_S erneut ausgewertet. Frost und Boost zuerst, dann Vorrang."""
        neue = sorted((l for l in lasten if l.id in an_set and not l.an),
                      key=lambda l: (not l.frost, not l.boost, -l.prio, l.id))
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
        s = self.e["staffel"]
        rolle = {g.id: g.rolle for g in self.geraete.values()}
        liste = []
        for a, roh in zip(anschluesse, self.e["anschluesse"], strict=True):
            laufend = [l for l in lasten if l.an and l.anschluss == a.id]
            summe = lambda pruef, laufend=laufend: round(sum(l.kw for l in laufend if pruef(rolle.get(l.id))), 3)  # noqa: E731
            liste.append({
                "id": a.id, "name": roh.get("name", a.id),
                "voll_kw": round(float(roh["ampere"]) * 230 * int(roh["phasen"]) / 1000, 3),
                "grenze_kw": round(a.grenze_kw, 3), "reserve_kw": a.reserve_kw,
                "heiz_kw": summe(lambda r: r in HEIZROLLEN), "pumpe_kw": summe(lambda r: r == ROLLE_PUMPE),
                "sonst_kw": summe(lambda r: r not in HEIZROLLEN and r != ROLLE_PUMPE),
                "frei_kw": frei.get(a.id, 0.0),
            })
        heizkoerper = [g for g in self.geraete.values() if g.rolle == ROLLE_HEIZKOERPER]
        self.daten.staffel = {
            "an": bool(s["an"]),
            "laufen": sum(1 for g in heizkoerper if (st := self.hass.states.get(g.schalter)) is not None and st.state == STATE_ON),
            "warten": len(self.daten.warte),
            "max": int(s["max_gleichzeitig"]),
            "anschluesse": liste,
        }

    @callback
    def auswerten(self) -> None:
        """Einmal alles durchrechnen, bei Bedarf schalten und melden, Entitäten aktualisieren.

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
        self._plan_cache.clear()
        jetzt = dt_util.now()
        self._laufzeit_aufraeumen(jetzt)
        wetter = self._wetter(jetzt)
        zu_warm = self.zu_warm(wetter)
        self.daten.wetter, self.daten.zu_warm = wetter, zu_warm
        soll = self._soll_je_container(jetzt, wetter, zu_warm) if self.heizung else {}
        an_set, ziel = self._staffeln(jetzt, soll)
        if self.automatik:
            self._hand_pruefen(soll)
            self._schalten_alle(jetzt, soll, an_set, ziel)
            self._wetter_protokoll(jetzt, wetter, zu_warm)
        elif self.e["heizung"].get("frost_immer"):
            # Automatik aus, aber „Frostschutz auch bei Automatik aus“: nur Frost-Container schalten (ziel enthält nur sie)
            self._schalten_alle(jetzt, soll, an_set, ziel)
        self._warnungen(jetzt, soll)
        self._anzeige(jetzt, soll)
        self._status(jetzt, soll, zu_warm)
        self._zeiten_zaehlen(jetzt)
        for update in list(self._listener):
            update()

    def _hand_pruefen(self, soll: dict[str, tuple[Soll, LageContainer]]) -> None:
        """Hand endet am nächsten Schaltpunkt: wenn die Automatik den Heizkörper anders schalten würde als bisher."""
        for gid in list(self.lz["hand"]):
            g = self.geraete.get(gid)
            if g is None or g.rolle != ROLLE_HEIZKOERPER or g.bereich not in soll:
                continue
            s, lage = soll[g.bereich]
            if s.ein is None:
                continue
            phase = bool(s.ein) if lage.temperatur is None else s.grund in HEIZ_GRUENDE
            vorher = self._hand_phase.setdefault(gid, phase)
            if phase != vorher:
                self.hand_beenden(gid, f"Automatik übernimmt ({GRUND_TEXT.get(s.grund, s.grund)})")

    def _schalten_alle(
        self, jetzt: datetime, soll: dict[str, tuple[Soll, LageContainer]], an_set: set[str], ziel: dict[str, bool | None]
    ) -> None:
        geschaltet: dict[str, list[tuple[GeraetInfo, bool]]] = {}
        for gid in ziel:
            g = self.geraete[gid]
            zustand = self.hass.states.get(g.schalter)
            ein = gid in an_set
            if self._schalten(g, zustand, ein, jetzt):
                geschaltet.setdefault(g.bereich, []).append((g, ein))
        # Staffelung: neu wartende Heizer ins Protokoll (Mockup „Staffelung: Konvektor wartet …“)
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
        alle = {b.id for b in self.container() if soll.get(b.id) and soll[b.id][0].ein is not None}
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

    def geraet_schalten(self, g: GeraetInfo, an: bool) -> None:
        """Gerät von der Seite aus schalten: Handbetrieb bis zum nächsten Schaltpunkt (api §2 `schalten`)."""
        zustand = self.hass.states.get(g.schalter)
        if self.automatik and g.rolle != ROLLE_PUMPE:
            self.hand_setzen(g, an)
        else:
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

    def _wetter_protokoll(self, jetzt: datetime, wetter: WetterWerte, zu_warm: bool) -> None:
        """Einmal am Morgen die Wetter-Entscheidung ins Protokoll (Mockup „05:00 wetter …“), dazu jeder Wechsel."""
        heute = jetzt.date().isoformat()
        h = self.e["heizung"]
        if jetzt.time() >= WETTER_PROTOKOLL_AB and self.lz.get("wetter_protokoll") != heute:
            self.lz["wetter_protokoll"] = heute
            wt = self.wetter_tag_plan(jetzt.date())
            teile = []
            if wt.regen_vortag_mm is not None and wt.regen_vortag_mm >= float(h["trocknen_ab_mm"]):
                teile.append(f"Regen {texte._zahl(wt.regen_vortag_mm, 0)} mm seit gestern – heute Kleidung trocknen")
            if wt.frueh_min_temp is not None and h["fruehstart"] and wt.frueh_min_temp < float(h["fruehstart_unter"]):
                teile.append(f"Kalter Morgen {texte._zahl(wt.frueh_min_temp)} °C – Frühstart {h['fruehstart_min']} min früher")
            bezug = wetter.aussen_max if h["heizgrenze_basis"] == "tageshoechst" else wetter.aussen
            if bezug is not None:
                was = "Höchstwert" if h["heizgrenze_basis"] == "tageshoechst" else "jetzt"
                teile.append(
                    f"Heizgrenze überschritten ({was} {texte._zahl(bezug, 0)} °C) – heute wird nicht geheizt" if zu_warm
                    else f"Heizgrenze nicht erreicht ({was} {texte._zahl(bezug, 0)} °C) – es wird geheizt"
                )
            for text in teile:
                self.protokoll("wetter", None, text)
            self._zu_warm_vorher = zu_warm
            self.einstellungen.speichern()
        elif self._zu_warm_vorher is not None and zu_warm != self._zu_warm_vorher:
            self.protokoll("wetter", None, "Heizgrenze überschritten – Heizung aus" if zu_warm else "Heizgrenze unterschritten – es wird wieder geheizt")
        self._zu_warm_vorher = zu_warm

    def _anzeige(self, jetzt: datetime, soll: dict[str, tuple[Soll, LageContainer]]) -> None:
        """Zustand und Text je Bereich wie die Kacheln im Mockup (`TEXT(b)`)."""
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
            if info.art == ART_PUMPENSCHACHT:
                laeuft_jetzt = any(d.pumpe_laeuft.get(g.id) for g in geraete)
                d.zustand[bid] = "offline" if offline else ("laeuft" if laeuft_jetzt else "aus")
                d.text[bid] = {"offline": "nicht erreichbar", "laeuft": "Pumpe läuft", "aus": "Pumpe aus"}[d.zustand[bid]]
                d.grund[bid] = d.zustand[bid]
                continue
            s_c = soll.get(bid)
            grund = s_c[0].grund if s_c else SollGrund.AUTOMATIK_AUS
            d.grund[bid] = str(grund)
            heizer_an = any(
                (z := self.hass.states.get(g.schalter)) is not None and z.state == STATE_ON
                for g in geraete if g.rolle in HEIZROLLEN
            )
            # „heizt“ (Glühen, Flammen im Symbol) nur bei echtem Verbrauch: ein eingeschalteter Heizkörper zieht über
            # ZIEHT_STROM_W; ohne Leistungssensor zählt der Schalter (Meldung Herbert, 30.09.2026)
            zieht = any(self._zieht_strom(g) for g in geraete if g.rolle in HEIZROLLEN)
            e = self.einstellungen.bereich(bid)
            if offline:
                zustand, text = "offline", "nicht erreichbar"
            elif heizer_an and not zieht and grund not in (SollGrund.TUER_OFFEN, SollGrund.BEREIT):
                zustand, text = "aus", "an · zieht keinen Strom"
            elif grund == SollGrund.FROST and zieht:
                zustand, text = "frost", "Frostschutz"
            elif grund == SollGrund.TUER_OFFEN:
                zustand, text = "pause", "pausiert · Tür offen"
            elif grund == SollGrund.BOOST and zieht:
                zustand, text = "heizt", "⚡ schnell aufheizen"
            elif grund == SollGrund.BEREIT:
                zustand, text = "bereit", "bei Bedarf · nur Frostschutz"
            elif grund == SollGrund.AUS and not heizer_an:
                zustand, text = "aus", "aus · nur Frostschutz"
            elif heizer_an and grund == SollGrund.TROCKNEN:
                zustand, text = "trocknen", "Kleidung trocknen"
            elif heizer_an:
                zustand = "heizt"
                if grund == SollGrund.BEDARF:
                    bis = self.bis("bedarf_bis", bid, jetzt) or self._termin_ende(bid, jetzt)
                    text = f"heizt bis {bis.strftime('%H:%M')}" if bis else "heizt · bei Bedarf"
                elif d.temperatur[bid] is None:
                    text = "an · Thermostat regelt"
                elif grund == SollGrund.HAND or not e["auto"]:
                    text = "heizt · Hand"
                elif grund == SollGrund.ABSENKEN:
                    text = "heizt · abgesenkt"
                else:
                    text = "heizt · Arbeitszeit"
            else:
                zustand = "aus"
                naechster = self._naechster_start(jetzt, bid)
                text = f"aus bis {naechster}" if naechster else "aus"
            if an and not heizer_an and zustand == "aus":
                text = "aus · Steckdose an"
            d.zustand[bid], d.text[bid] = zustand, text

    def _zieht_strom(self, g: GeraetInfo) -> bool:
        """Eingeschaltet und – falls gemessen – über ZIEHT_STROM_W."""
        z = self.hass.states.get(g.schalter)
        if z is None or z.state != STATE_ON:
            return False
        if not g.leistung:
            return True
        w = _zahl(self.hass.states.get(g.leistung))
        return w is None or w > ZIEHT_STROM_W  # Sensor ohne Wert: wie ohne Messung

    def _termin_ende(self, bid: str, jetzt: datetime) -> datetime | None:
        for von, bis, _ in self._termin_fenster(bid):
            if von - timedelta(minutes=int(self.e["heizung"]["vorheizen_min"])) <= jetzt < bis:
                return bis
        return None

    def _naechster_start(self, jetzt: datetime, bid: str) -> str | None:
        e = self.einstellungen.bereich(bid)
        if e["bedarf"] or not e["auto"] or not self.automatik:
            return None
        s = plan_status(jetzt.date(), jetzt.hour * 60 + jetzt.minute, lambda t: self.plan(t, bool(e["trocknen"])))
        if s.minute is None or s.art == StatusArt.HEIZT:
            return None
        if s.tag in (jetzt.date(), jetzt.date() + timedelta(days=1)):
            return uhrzeit(s.minute)  # Mockup „aus bis 06:15“
        return f"{texte_wochentag(s.tag)} {uhrzeit(s.minute)}"

    def _status(self, jetzt: datetime, soll: dict[str, tuple[Soll, LageContainer]], zu_warm: bool) -> None:
        """Status der Baustelle und Text neben dem Automatik-Chip (Mockup `statusText`)."""
        d = self.daten
        heute, minute = jetzt.date(), jetzt.hour * 60 + jetzt.minute
        d.naechste = None
        jetzt_bis = self.jetzt_bis(jetzt)
        if not self.aktiv:
            d.status, d.status_text = "abgeschlossen", "abgeschlossen"
            return
        if not self.heizung:
            d.status, d.status_text = "nur_pumpen", ""
            return
        if not self.automatik:
            d.status, d.status_text = "automatik_aus", "Handbetrieb – nichts wird geschaltet"
            return
        s = plan_status(heute, minute, lambda t: self.plan(t, True))
        if s.minute is not None and s.tag is not None:
            d.naechste = _mitternacht(s.tag) + timedelta(minutes=s.minute)
        heizt = any(z in ("heizt", "trocknen", "frost") for z in d.zustand.values())
        ausnahme = next((a for a in self.ausnahmen() if a.datum == heute), None)
        if jetzt_bis is not None:
            d.status, d.status_text = "heizt", f"♨ alle heizen bis {jetzt_bis.strftime('%H:%M')}"
            d.naechste = jetzt_bis
            return
        if ausnahme is not None and ausnahme.art == AusnahmeArt.FREI:
            d.status = "frei"
        elif self.ist_frei(heute) and (ausnahme is None or ausnahme.art == AusnahmeArt.FREI):
            d.status = self.frei_art(heute) or "frei"
        elif zu_warm:
            d.status = "heizgrenze"
        else:
            d.status = "heizt" if heizt else "bereit"
        if s.art == StatusArt.HEIZT:
            d.status_text = f"♨ heizt bis {uhrzeit(s.minute or 0)}"
        elif s.art == StatusArt.START:
            d.status_text = f"Start um {uhrzeit(s.minute or 0)}"
        elif s.tag is not None:
            wann = "morgen" if s.tag == heute + timedelta(days=1) else texte_wochentag(s.tag)
            d.status_text = f"aus · {wann} ab {uhrzeit(s.minute or 0)}"
        else:
            d.status_text = "aus"

    # ------------------------------------------------------------------ Warnungen
    def warn_einstellungen(self) -> warn_logik.WarnEinstellungen:
        return warn_logik.WarnEinstellungen.aus_store(self.e["meldungen_einst"], self.e["heizung"])

    def _warnungen_laden(self) -> None:
        """Offene Warnungen vom letzten Lauf (für Beginn und „schon gemeldet“ über einen Neustart hinweg)."""
        for key, w in (self.lz.get("warnungen_offen") or {}).items():
            if isinstance(w, dict) and (zeit := _zeit(w.get("seit"))) is not None:
                art = key.split(":", 1)[0]
                self._warn_alt[key] = warn_logik.Warnung(
                    key, art, str(warn_logik.stufe_von(art)), w.get("bereich"), w.get("geraet"), zeit,
                    dict(w.get("werte") or {}),
                )

    def _geraete_zustand(self, jetzt: datetime, soll: dict[str, tuple[Soll, LageContainer]]) -> list[warn_logik.GeraetZustand]:
        regeln = self.warn_einstellungen().pumpen_regeln()
        liste = []
        for g in self.geraete.values():
            zustand = self.hass.states.get(g.schalter)
            erreichbar = zustand is not None and zustand.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
            if erreichbar:
                self._offline_seit.pop(g.id, None)
            else:
                self._offline_seit.setdefault(g.id, jetzt)
            leistung = _zahl(self.hass.states.get(g.leistung)) if g.leistung else None
            an = erreichbar and zustand is not None and zustand.state == STATE_ON
            typ = warn_logik.Typ.SONST
            laeuft_seit = None
            zyklen = 0
            if g.rolle == ROLLE_PUMPE:
                typ = warn_logik.Typ.PUMPE
                z = PumpenZustand(erreichbar=erreichbar, leistung=leistung)
                laeuft_jetzt = laeuft(z, regeln)
                if laeuft_jetzt:
                    if g.id not in self._laeuft_seit:
                        self._laeuft_seit[g.id] = jetzt
                        if self.daten.pumpe_laeuft.get(g.id) is False and self.aktiv:
                            self._zaehler_plus(f"zyklen:{g.id}", 1)
                            self._starts.setdefault(g.id, deque()).append(jetzt)
                else:
                    self._laeuft_seit.pop(g.id, None)
                self.daten.pumpe_laeuft[g.id] = laeuft_jetzt
                starts = self._starts.get(g.id, deque())
                while starts and (jetzt - starts[0]) > timedelta(hours=1):
                    starts.popleft()
                zyklen = len(starts)
                laeuft_seit = self._laeuft_seit.get(g.id)
            elif g.rolle == ROLLE_HEIZKOERPER:
                typ = warn_logik.Typ.HEIZUNG
            liste.append(
                warn_logik.GeraetZustand(
                    id=g.id, bereich=g.bereich, typ=typ, name=g.name, erreichbar=erreichbar,
                    offline_seit=self._offline_seit.get(g.id), leistung=leistung, an=an,
                    an_seit=dt_util.as_local(zustand.last_changed) if an and zustand is not None else None,
                    hand_seit=_zeit(self.lz["hand"].get(g.id)), laeuft_seit=laeuft_seit, zyklen_h=zyklen,
                )
            )
        return liste

    def _container_zustand(self, jetzt: datetime, soll: dict[str, tuple[Soll, LageContainer]]) -> list[warn_logik.ContainerZustand]:
        liste = []
        for info in self.container():
            s_c = soll.get(info.id)
            temp = self.temperatur(info.fuehler)
            soll_t = self.soll_temperatur(info.id)
            in_az = bool(s_c) and s_c[0].grund == SollGrund.ARBEITSZEIT and self.automatik
            if in_az and temp is not None and temp < soll_t - 1.0:
                self._unter_soll_seit.setdefault(info.id, jetzt)
            else:
                self._unter_soll_seit.pop(info.id, None)
            tuer_seit = None
            tuer = self.einstellungen.bereich(info.id).get("tuer")
            if tuer and info.id not in self._tuer_trotzdem and (s := self.hass.states.get(tuer)) is not None and s.state == STATE_ON:
                tuer_seit = dt_util.as_local(s.last_changed)
            liste.append(
                warn_logik.ContainerZustand(
                    id=info.id, temperatur=temp, soll=soll_t, in_arbeitszeit=in_az, fuehler=bool(info.fuehler),
                    unter_soll_seit=self._unter_soll_seit.get(info.id), tuer_offen_seit=tuer_seit,
                )
            )
        return liste

    def _warnungen(self, jetzt: datetime, soll: dict[str, tuple[Soll, LageContainer]]) -> None:
        geraete = self._geraete_zustand(jetzt, soll)
        container = self._container_zustand(jetzt, soll) if self.heizung else []
        erreichbar = [g.erreichbar for g in geraete]
        self.daten.erreichbar = None if not erreichbar else not baustelle_offline(erreichbar)
        wetter_da = (
            not self.heizung or not self.entry.options.get(CONF_WETTER) or self._prognose_da
            or jetzt - self._gestartet < FEHLT_NACH
        )
        zustand = warn_logik.BaustellenZustand(geraete=tuple(geraete), container=tuple(container), wetter_vorhanden=wetter_da)
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
                if w.art == warn_logik.Art.TUER_OFFEN:
                    self.protokoll("schalten", w.bereich, "Tür offen – Heizung pausiert")
                else:
                    self.protokoll("warnung", w.bereich, texte.protokoll_warnung(w))
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

    # ------------------------------------------------------------------ Zählen (wie 0.6, dazu Heiztage)
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
        preis = float(self.e["preis"])
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
        """Heiz- und Pumpzeit, mittlere Leistung, „ohne Automatik“, Energie ohne Zähler und Heiztage."""
        vorher, self._letzte_auswertung = self._letzte_auswertung, jetzt
        if vorher is None or not self.aktiv:
            return
        stunden = (jetzt - vorher).total_seconds() / 3600
        if stunden <= 0 or stunden > MAX_SCHRITT_H:
            return
        ohne_w = 0.0
        heiztag = False
        for bid in self.bereiche:
            heizt = False
            for g in self.geraete_in(bid):
                zustand = self.hass.states.get(g.schalter)
                an = zustand is not None and zustand.state == STATE_ON
                leistung = _zahl(self.hass.states.get(g.leistung)) if g.leistung else None
                if g.rolle in HEIZROLLEN:
                    mittel_w = mittel_im_betrieb(self.zaehler.get(f"mittel:{g.id}"), leistung if an else None)
                    if mittel_w is not None:
                        self.zaehler[f"mittel:{g.id}"] = mittel_w
                        if self.heizung:
                            ohne_w += mittel_w
                    if an:
                        heizt = True
                        if g.rolle == ROLLE_HEIZKOERPER:
                            self._zaehler_plus(f"heizzeit_typ:{g.typ}", stunden)
                if g.rolle == ROLLE_PUMPE and self.daten.pumpe_laeuft.get(g.id):
                    self._zaehler_plus(f"pumpzeit:{g.id}", stunden)
                if not g.energie and an:
                    self._energie_buchen(g, leistung_integriert(leistung, stunden))
            if heizt:
                heiztag = True
                self._zaehler_plus(f"heizzeit:{bid}", stunden)
            self._temperaturverhalten(bid, heizt, jetzt, stunden)
        self._zaehler_plus("ohne", ohne_w * stunden / 1000)
        if heiztag and self.zaehler.get("heiztag_letzter") != jetzt.date().isoformat():
            self.zaehler["heiztag_letzter"] = jetzt.date().isoformat()
            self._zaehler_plus("heiztage", 1)

    def _temperaturverhalten(self, bid: str, heizt: bool, jetzt: datetime, stunden: float) -> None:
        """Aufheiz- und Abkühlrate (°C/h) und Gradstunden innen–außen eines Containers mit Fühler."""
        info = self.bereiche[bid]
        innen = self.temperatur(info.fuehler)
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
        ende = self.entry.options.get(CONF_ENDE)
        bis_tag = date.fromisoformat(ende) if ende else None   # geplantes Ende der Baustelle (neu 0.7.8)
        return hochrechnung(self.zaehler.get(key, 0.0), tage, tage_heizperiode(von, bis, jahr, bis_tag))

    def mittel_typ(self, typ: str) -> float | None:
        """Mittlere Leistung im Betrieb aller Heizkörper eines Typs (Vergleich Ölradiator/Konvektor)."""
        werte = [
            self.zaehler[f"mittel:{g.id}"]
            for g in self.geraete.values()
            if g.rolle == ROLLE_HEIZKOERPER and g.typ == typ and f"mittel:{g.id}" in self.zaehler
        ]
        return sum(werte) / len(werte) if werte else None


MODUS_TEXT = {"plan": "Zeitplan", "thermo": "Thermostat", "bedarf": "Bei Bedarf", "hand": "Hand", "aus": "Aus"}
TAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


def texte_wochentag(tag: date) -> str:
    return TAGE_KURZ[tag.weekday()]


def _einstellung_text(pfad: tuple[str, ...], wert: Any) -> str:
    """Protokolltext einer geänderten Einstellung."""
    if pfad == ("automatik",):
        return "Automatik eingeschaltet" if wert else "Automatik ausgeschaltet"
    if pfad[0] == "bereiche" and pfad[-1] == "modus":
        return f"Modus: {MODUS_TEXT.get(wert, wert)}"
    if isinstance(wert, bool):
        wert_text = "ein" if wert else "aus"
    elif wert is None:
        wert_text = "–"
    else:
        wert_text = str(wert).replace(".", ",") if isinstance(wert, float) else str(wert)
    name = ".".join(pfad[2:]) if pfad[0] == "bereiche" else ".".join(pfad)
    return f"Einstellung {name}: {wert_text}"


def _ev_zeit(wert: Any) -> datetime | None:
    """Beginn/Ende eines Kalendereintrags (ganztägig „2026-10-26“ oder mit Uhrzeit)."""
    if not wert:
        return None
    text = str(wert)
    if len(text) == 10:
        try:
            return _mitternacht(date.fromisoformat(text))
        except ValueError:
            return None
    return _zeit(text)


def _termin_bereich(ev: dict[str, Any], bedarf: list[BereichInfo]) -> str | None:
    """Container eines Termins: `baustelle:<bid>` in der Beschreibung, sonst der Name im Titel/Ort, sonst der einzige
    Bedarfs-Container (api-0.7 §1 `termine`)."""
    beschreibung = str(ev.get("description") or "")
    for b in bedarf:
        if f"baustelle:{b.id}" in beschreibung:
            return b.id
    for feld in ("location", "summary"):
        text = str(ev.get(feld) or "").lower()
        for b in bedarf:
            if b.name.lower() and b.name.lower() in text:
                return b.id
    return bedarf[0].id if len(bedarf) == 1 else None


def _wiederholung(rrule: str | None) -> str:
    if not rrule:
        return "einmal"
    teile = dict(t.split("=", 1) for t in rrule.split(";") if "=" in t)
    if teile.get("FREQ") == "WEEKLY":
        return "2wochen" if teile.get("INTERVAL") == "2" else "woche"
    return "einmal"


def _sensor_am_geraet(registry: er.EntityRegistry, schalter: str, device_class: str) -> str | None:
    """Leistungs- bzw. Energiesensor desselben Shelly finden (bei Mehrkanal: gleicher Namensanfang)."""
    eintrag = registry.async_get(schalter)
    if eintrag is None or eintrag.device_id is None:
        return None
    kandidaten = [
        x.entity_id
        for x in er.async_entries_for_device(registry, eintrag.device_id)
        if x.domain == "sensor" and (x.device_class or x.original_device_class) == device_class and not x.disabled
    ]
    if len(kandidaten) == 1:
        return kandidaten[0]
    stamm = schalter.split(".", 1)[1]
    passend = [k for k in kandidaten if k.split(".", 1)[1].startswith(stamm)]
    return passend[0] if len(passend) == 1 else None


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
