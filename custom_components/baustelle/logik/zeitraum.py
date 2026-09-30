"""Zeitraum einer Baustelle: Beginn und Ende automatisch (AN-0002) – ohne Home-Assistant-Code."""

from __future__ import annotations

from datetime import date

AKTIV = "aktiv"
ABGESCHLOSSEN = "abgeschlossen"


def beginn(eingetragen: date | None, angelegt: date) -> date:
    """Beginn der Baustelle: der eingetragene Tag, sonst der Tag, an dem sie angelegt wurde."""
    return eingetragen or angelegt


def ende_beim_speichern(status_alt: str, status_neu: str, ende: date | None, heute: date) -> date | None:
    """Ende, das beim Speichern der Einstellungen gilt.

    - wird abgeschlossen: immer der Tag des Abschließens (ein geplantes Ende dient nur der Hochrechnung),
    - bleibt abgeschlossen: das eingetragene Ende (nachträglich korrigierbar), sonst heute,
    - wieder aktiv gesetzt: kein Ende (das alte Ende war das des Abschließens),
    - bleibt aktiv: das geplante Ende, wie eingetragen.
    """
    if status_neu == ABGESCHLOSSEN:
        return heute if status_alt != ABGESCHLOSSEN else (ende or heute)
    if status_alt == ABGESCHLOSSEN:
        return None
    return ende
