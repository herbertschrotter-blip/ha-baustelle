"""Funktionen einer Baustelle, je Funktion ein Modul mit der Schnittstelle aus `basis.py` (Bauplan Module §3)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .basis import Funktion
from .heizung import Heizung
from .pumpen import Pumpen

FUNKTIONEN: tuple[type[Funktion], ...] = (Heizung, Pumpen)


def aktive(optionen: Mapping[str, Any]) -> list[str]:
    """Namen der eingeschalteten Funktionen einer Baustelle (Optionen `heizung`, `pumpen`)."""
    return [f.name for f in FUNKTIONEN if optionen.get(f.option, f.standard)]
