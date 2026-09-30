"""Schnittstelle einer Funktion der Baustelle (Bauplan Module §3).

Eine Funktion (Heizung, Pumpen, später z. B. Kühlung) gehört zu bestimmten Bereichsarten und Geräterollen. Der Kern
(`steuerung.py`) kennt keine Einzelheiten der Funktionen, er ruft in jeder Auswertung nur diese Methoden auf:

1. `aufraeumen` – abgelaufene Laufzeitdaten der Funktion entfernen,
2. `soll` – nur aktive Funktionen: was die Bereiche jetzt tun sollen (die Staffelung schaltet danach gemeinsam),
3. `nach_soll` – nur bei eingeschalteter Automatik (z. B. Handbetrieb endet am nächsten Schaltpunkt),
4. `geraet_warnung` / `warnungen` – Zustände für `logik/warnungen.py` (Bereiche nur aktiver Funktionen),
5. `anzeige` – Zustand und Text je Bereich (Kacheln),
6. `zaehlen_geraet` / `zaehlen_bereich` / `zaehlen_ende` – Zähler der Funktion,
7. `struktur` – Name der Funktion für `baustelle/struktur` (api-0.7 §8).

Anzeige, Zählen und Überwachen laufen für alle Bereiche, die es gibt (wie vor dem Umbau: gemessen wird immer, nur
geschaltet wird allein über `soll` aktiver Funktionen).
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import State
from homeassistant.util import dt as dt_util

from ..logik import warnungen as warn_logik

if TYPE_CHECKING:
    from ..logik.regelung import LageContainer, Soll
    from ..steuerung import BereichInfo, GeraetInfo, Steuerung, WetterWerte

    SollJeBereich = dict[str, tuple[Soll, LageContainer]]

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


def minuten_seit(seit: datetime | None, jetzt: datetime) -> float:
    return 1e9 if seit is None else max(0.0, (jetzt - seit).total_seconds() / 60)


class Funktion:
    """Eine Funktion der Baustelle; die Standardmethoden tun nichts."""

    name: str = ""
    option: str = ""  # Option der Baustelle, die die Funktion einschaltet
    standard: bool = False  # Wert der Option, wenn sie fehlt
    arten: tuple[str, ...] = ()  # Bereichsarten der Funktion (Container, Pumpenschacht …)
    rollen: tuple[str, ...] = ()  # Geräterollen der Funktion

    def __init__(self, st: Steuerung) -> None:
        self.st = st

    def aktiv(self) -> bool:
        return bool(self.st.entry.options.get(self.option, self.standard))

    def bereiche(self) -> list[BereichInfo]:
        return [b for b in self.st.bereiche.values() if b.art in self.arten]

    def aufraeumen(self, jetzt: datetime) -> bool:
        """Abgelaufenes entfernen; True, wenn gespeichert werden muss."""
        return False

    def soll(self, jetzt: datetime, wetter: WetterWerte, zu_warm: bool) -> SollJeBereich:
        return {}

    def nach_soll(self, soll: SollJeBereich) -> None:
        return None

    def geraet_warnung(
        self, g: GeraetInfo, erreichbar: bool, leistung: float | None, jetzt: datetime
    ) -> tuple[warn_logik.Typ, datetime | None, int]:
        """Typ, „läuft seit“ und Starts der letzten Stunde eines Geräts der Funktion (für die Warnungen)."""
        return warn_logik.Typ.SONST, None, 0

    def warnungen(self, jetzt: datetime, soll: SollJeBereich) -> list[warn_logik.ContainerZustand]:
        return []

    def anzeige(
        self, bid: str, info: BereichInfo, jetzt: datetime, soll: SollJeBereich, offline: bool, an: bool
    ) -> tuple[str, str, str]:
        """(zustand, text, grund) eines Bereichs der Funktion; `an` = ein Gerät des Bereichs ist eingeschaltet."""
        return "aus", "", "aus"

    def zaehlen_geraet(self, g: GeraetInfo, an: bool, leistung: float | None, stunden: float) -> bool:
        """Zeiten eines Geräts zählen; True, wenn es für den Bereich als „heizt“ zählt."""
        return False

    def zaehlen_bereich(self, bid: str, heizt: bool, jetzt: datetime, stunden: float) -> None:
        return None

    def zaehlen_ende(self, jetzt: datetime, stunden: float) -> None:
        return None

    def struktur(self) -> str:
        return self.name
