"""Strompreis mit „gilt ab“ (Herbert 04.10.2026, Mockup strompreis.html) – ohne Home-Assistant-Code.

Die Baustelle hat eine Preisliste `[{"ab": "2026-09-01", "preis": 0.28}, {"ab": "2026-10-04", "preis": 0.20}]`. Jeder Tag
gilt mit dem Preis des jüngsten Eintrags, der an dem Tag schon begonnen hat; vor dem ersten Eintrag gilt der erste.
Für einen Zeitraum ist der Preis das Mittel der Tagespreise, gewichtet mit dem Verbrauch je Tag – so ergibt kWh × Preis
genau die Summe der Tage, und alle € einer Auswertung passen zusammen.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from datetime import date, datetime
from typing import Any


def liste(roh: Sequence[Mapping[str, Any]] | None, standard: float) -> list[tuple[date, float]]:
    """Preisliste aus dem Store, nach Datum; ohne Liste der eine Preis `standard` (für immer)."""
    eintraege = []
    for x in roh or []:
        try:
            eintraege.append((date.fromisoformat(str(x["ab"])), float(x["preis"])))
        except (KeyError, TypeError, ValueError):
            continue
    return sorted(eintraege) or [(date.min, float(standard))]


def preis_am(preise: Sequence[tuple[date, float]], tag: date) -> float:
    """Preis, der am `tag` galt."""
    gilt = preise[0][1]
    for ab, preis in preise:
        if ab <= tag:
            gilt = preis
    return gilt


def preis_mittel(preise: Sequence[tuple[date, float]], verbrauch: Iterable[tuple[date | datetime, float | None]], bis: date) -> float:
    """Preis eines Zeitraums: Tagespreise gewichtet mit dem Verbrauch; ohne Verbrauch der Preis am letzten Tag (`bis`)."""
    kwh = geld = 0.0
    for t, v in verbrauch:
        if v is None or v <= 0:
            continue
        tag = t.date() if isinstance(t, datetime) else t
        kwh += v
        geld += v * preis_am(preise, tag)
    return geld / kwh if kwh > 0 else preis_am(preise, bis)


def speichern(roh: Sequence[Mapping[str, Any]], ab: date, preis: float) -> list[dict[str, Any]]:
    """Eintrag ab `ab` setzen (ersetzt einen am selben Tag), nach Datum sortiert."""
    andere = [dict(x) for x in roh if str(x.get("ab")) != ab.isoformat()]
    return sorted([*andere, {"ab": ab.isoformat(), "preis": round(float(preis), 4)}], key=lambda x: x["ab"])
