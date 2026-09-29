"""Pumpenüberwachung – reine Fachlogik ohne Home-Assistant-Code.

Eine Pumpe hängt dauerhaft an einem eingeschalteten Shelly und läuft über ihren Schwimmer.
Ob sie läuft, zeigt die Leistung.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Problem(StrEnum):
    """Mögliche Probleme einer Pumpe."""

    OFFLINE = "offline"
    TROCKENLAUF = "trockenlauf"
    DAUERLAUF = "dauerlauf"


@dataclass(frozen=True)
class PumpenRegeln:
    """Einstellungen der Pumpenüberwachung."""

    offline_min: float = 5.0
    laeuft_ab_w: float = 20.0
    trocken_unter_w: float = 300.0
    trocken_nach_min: float = 1.0
    dauerlauf_h: float = 4.0


@dataclass(frozen=True)
class PumpenZustand:
    """Messwerte einer Pumpe; Dauern in Minuten seit dem letzten Wechsel."""

    erreichbar: bool
    leistung: float | None = None
    offline_seit_min: float = 0.0
    laeuft_seit_min: float = 0.0


def laeuft(zustand: PumpenZustand, regeln: PumpenRegeln) -> bool:
    """Die Pumpe läuft, wenn sie spürbar Leistung zieht."""
    return zustand.erreichbar and zustand.leistung is not None and zustand.leistung >= regeln.laeuft_ab_w


def pruefe(zustand: PumpenZustand, regeln: PumpenRegeln) -> list[Problem]:
    """Probleme einer Pumpe nach den Regeln der Baustelle."""
    if not zustand.erreichbar:
        return [Problem.OFFLINE] if zustand.offline_seit_min >= regeln.offline_min else []
    probleme: list[Problem] = []
    if laeuft(zustand, regeln):
        if (
            zustand.leistung is not None
            and zustand.leistung < regeln.trocken_unter_w
            and zustand.laeuft_seit_min >= regeln.trocken_nach_min
        ):
            probleme.append(Problem.TROCKENLAUF)
        if zustand.laeuft_seit_min >= regeln.dauerlauf_h * 60:
            probleme.append(Problem.DAUERLAUF)
    return probleme


def baustelle_offline(erreichbar: list[bool]) -> bool:
    """Alle Geräte der Baustelle antworten nicht: Stromausfall oder Internet weg."""
    return bool(erreichbar) and not any(erreichbar)
