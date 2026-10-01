"""Schnittstelle einer Funktion der Baustelle (Bauplan Module §3).

Eine Funktion (Heizung, Pumpen, später z. B. Kühlung) gehört zu bestimmten Bereichsarten und Geräterollen. Der Kern
(`steuerung.py`) legt alle Funktionen aus `funktionen.FUNKTIONEN` an, kennt keine Einzelheiten der Funktionen und ruft
in jeder Auswertung nur diese Methoden auf:

1. `aufraeumen` – abgelaufene Laufzeitdaten der Funktion entfernen,
2. `soll` – nur aktive Funktionen: was die Bereiche jetzt tun sollen (die Staffelung schaltet danach gemeinsam),
3. Staffelung: `schaltbar` (Gerät wird geschaltet), `geraet_ein` (Ziel je Gerät, Standard: wie der Bereich),
   `standard_kw` (Leistung ohne Messung), `staffel_vorrang`
   (Vorrang in der Staffelung), `staffel_feld` (Feld der Leistung in der Anzeige der Anschlüsse),
4. `nach_soll` / `nach_schalten` – nur bei eingeschalteter Automatik (z. B. Handbetrieb endet am nächsten Schaltpunkt,
   Wetter-Entscheidung ins Protokoll); ohne Automatik schaltet der Kern nur, wenn `schaltet_ohne_automatik`,
5. `geraet_warnung` / `warnungen` / `warn_einstellungen` / `warnung_protokoll` – Zustände und Einstellungen für
   `logik/warnungen.py` (Bereiche nur aktiver Funktionen) und der Protokolltext einer neuen Warnung,
6. `anzeige` – Zustand und Text je Bereich (Kacheln),
7. `zaehlen_geraet` / `zaehlen_bereich` / `zaehlen_ende` / `energie_buchen` – Zähler der Funktion,
8. `status` – Status der Baustelle (die erste aktive Funktion bestimmt ihn),

dazu `entitaeten` (worauf die Baustelle zusätzlich hört), `async_kalender` / `kalender_neu` (Kalender der Funktion lesen),
`hand_setzen` / `hand_seit` (Handbetrieb eines Geräts im Bereich der Funktion) und `einstellung_text` (Protokolltext einer
Einstellung der Funktion). `schaltet` sagt, ob die Funktion Geräte schaltet (nur dann gibt es die Automatik),
`braucht_wetter`, ob ohne Wettervorhersage gewarnt wird.

`baustelle/struktur` nennt die eingeschalteten Funktionen mit ihrem `name` (`funktionen.aktive`, api-0.7 §8).

Anzeige, Zählen und Überwachen laufen für alle Bereiche, die es gibt (wie vor dem Umbau: gemessen wird immer, nur
geschaltet wird allein über `soll` aktiver Funktionen).
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date, datetime, time
from typing import TYPE_CHECKING, Any, Self, cast

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import State
from homeassistant.util import dt as dt_util

from ..logik import warnungen as warn_logik
from ..logik.regelung import LageContainer, Soll

if TYPE_CHECKING:
    from ..logik.warnungen import Warnung
    from ..steuerung import BereichInfo, GeraetInfo, Steuerung, WetterWerte

SollJeBereich = dict[str, tuple[Soll, LageContainer]]  # was jeder Bereich jetzt tun soll (`soll` der Funktionen)

ZAEHLER_SPEICHERN_S = 30


def zahl(state: State | None) -> float | None:
    if state is None or state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return None
    try:
        return float(state.state)
    except ValueError:
        return None


def zeit(text: Any) -> datetime | None:
    if not text:
        return None
    wert = dt_util.parse_datetime(str(text))
    return dt_util.as_local(wert) if wert is not None else None


def mitternacht(tag: date) -> datetime:
    return datetime.combine(tag, time.min, tzinfo=dt_util.get_default_time_zone())


def ev_zeit(wert: Any) -> datetime | None:
    """Beginn/Ende eines Kalendereintrags (ganztägig „2026-10-26“ oder mit Uhrzeit)."""
    if not wert:
        return None
    text = str(wert)
    if len(text) == 10:
        try:
            return mitternacht(date.fromisoformat(text))
        except ValueError:
            return None
    return zeit(text)


def minuten_seit(seit: datetime | None, jetzt: datetime) -> float:
    return 1e9 if seit is None else max(0.0, (jetzt - seit).total_seconds() / 60)


class Funktion:
    """Eine Funktion der Baustelle; die Standardmethoden tun nichts."""

    name: str = ""
    option: str = ""  # Option der Baustelle, die die Funktion einschaltet
    standard: bool = False  # Wert der Option, wenn sie fehlt
    arten: tuple[str, ...] = ()  # Bereichsarten der Funktion (Container, Pumpenschacht …)
    rollen: tuple[str, ...] = ()  # Geräterollen der Funktion
    schaltet: bool = False  # schaltet Geräte (nur dann gibt es die Automatik)
    braucht_wetter: bool = False  # Warnung, wenn die Wettervorhersage fehlt
    standard_kw: float = 0.0  # Leistung eines Geräts der Funktion ohne Messung (Staffelung)
    staffel_feld: str = ""  # Feld der Leistung ihrer Geräte in der Anzeige der Anschlüsse (api `staffel`)

    def __init__(self, st: Steuerung) -> None:
        self.st = st

    @classmethod
    def von(cls, st: Steuerung) -> Self:
        """Die Funktion dieser Art einer Baustelle (für Seite, Nachrichten und Entitäten)."""
        return cast(Self, st.funktion(cls.name))

    def aktiv(self) -> bool:
        return bool(self.st.entry.options.get(self.option, self.standard))

    def bereiche(self) -> list[BereichInfo]:
        return [b for b in self.st.bereiche.values() if b.art in self.arten]

    def entitaeten(self) -> set[str]:
        """Entitäten aus den Einstellungen der Funktion, auf deren Änderung die Baustelle hört."""
        return set()

    async def async_kalender(self, start: datetime, ende: datetime) -> None:
        """Kalender der Funktion lesen (mit Feiertagen und Urlaub, alle 15 min)."""
        return None

    def kalender_neu(self, pfad: tuple[str, ...]) -> bool:
        """Nach dieser Einstellung den Kalender gleich neu lesen?"""
        return False

    def aufraeumen(self, jetzt: datetime) -> bool:
        """Zu Beginn jeder Auswertung: Abgelaufenes entfernen; True, wenn gespeichert werden muss."""
        return False

    def soll(self, jetzt: datetime, wetter: WetterWerte) -> SollJeBereich:
        return {}

    def schaltbar(self, g: GeraetInfo) -> bool:
        """Gerät der Funktion, das die Staffelung schaltet (die anderen zählen nur mit)."""
        return False

    def geraet_ein(self, g: GeraetInfo, soll: Soll) -> bool | None:
        """Ziel eines geschalteten Geräts; Standard wie sein Bereich (z. B. hält die Heizung einen Zusatz zurück)."""
        return soll.ein

    def staffel_vorrang(self, soll: tuple[Soll, LageContainer], schaltet: bool) -> dict[str, Any]:
        """Vorrang eines Geräts in der Staffelung (Felder von `staffel.Last`) aus dem Soll seines Bereichs."""
        return {}

    def schaltet_ohne_automatik(self) -> bool:
        """Schaltet die Funktion auch bei ausgeschalteter Automatik (nur, was `soll` dann noch schalten will)?"""
        return False

    def nach_soll(self, soll: SollJeBereich) -> None:
        return None

    def nach_schalten(self, jetzt: datetime, wetter: WetterWerte) -> None:
        return None

    def hand_setzen(self, g: GeraetInfo, an: bool) -> bool:
        """Gerät des Bereichs von Hand geschaltet; False, wenn die Funktion keinen Handbetrieb kennt."""
        return False

    def hand_seit(self, g: GeraetInfo) -> datetime | None:
        """Seit wann das Gerät auf Hand steht (sonst None)."""
        return None

    def geraet_warnung(
        self, g: GeraetInfo, erreichbar: bool, leistung: float | None, jetzt: datetime
    ) -> tuple[warn_logik.Typ, datetime | None, int]:
        """Typ, „läuft seit“ und Starts der letzten Stunde eines Geräts der Funktion (für die Warnungen)."""
        return warn_logik.Typ.SONST, None, 0

    def warnungen(self, jetzt: datetime, soll: SollJeBereich) -> list[warn_logik.ContainerZustand]:
        return []

    def warn_einstellungen(self) -> Mapping[str, Any]:
        """Einstellungen der Funktion für die Warnungen (`WarnEinstellungen.aus_store`)."""
        return {}

    def warnung_protokoll(self, w: Warnung) -> tuple[str, str] | None:
        """(art, text) für das Protokoll einer neuen Warnung; None = allgemeiner Text des Kerns."""
        return None

    def anzeige(
        self, bid: str, info: BereichInfo, jetzt: datetime, soll: SollJeBereich, offline: bool, an: bool
    ) -> tuple[str, str, str]:
        """(zustand, text, grund) eines Bereichs der Funktion; `an` = ein Gerät des Bereichs ist eingeschaltet."""
        return "aus", "", "aus"

    def zaehlen_geraet(self, g: GeraetInfo, an: bool, leistung: float | None, stunden: float) -> bool:
        """Zeiten eines Geräts zählen; True, wenn der Bereich damit als in Betrieb zählt (Heizung: „heizt“)."""
        return False

    def zaehlen_bereich(self, bid: str, in_betrieb: bool, jetzt: datetime, stunden: float) -> None:
        return None

    def zaehlen_ende(self, jetzt: datetime, stunden: float) -> None:
        return None

    def energie_buchen(self, g: GeraetInfo, kwh: float) -> None:
        """Zusätzliche Energiezähler der Funktion für ein Gerät (Energie und Kosten je Bereich bucht der Kern)."""
        return None

    def status(self, jetzt: datetime) -> tuple[str, str, datetime | None] | None:
        """(status, text, nächster Schaltpunkt) der Baustelle; None = die nächste Funktion bestimmt ihn."""
        return None

    def einstellung_text(self, pfad: tuple[str, ...], wert: Any) -> str | None:
        """Protokolltext einer Einstellung der Funktion; None = allgemeiner Text des Kerns."""
        return None
