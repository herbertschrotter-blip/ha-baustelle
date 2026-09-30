"""Firma eines Containers und Zahlen für die Abrechnung – reine Fachlogik ohne Home-Assistant-Code.

- `zuordnung` ist der Verlauf der Firmen je Container (Store §1): es gilt der letzte Eintrag mit `ab <= Zeitpunkt`.
  Frühere Werte bleiben bei der bisherigen Firma. Fehlt ein Eintrag, gehört der Container der eigenen Firma (`eigen`).
- Unbekannte Firmen-IDs (Firma gelöscht) zählen zur eigenen Firma (`firma_von`) – wie `firma(id)` im Mockup
  (`find(...) || firmen[0]`).

Die Abrechnung selbst (Firma je Tag: Verbrauch gehört der Firma zu Tagesbeginn, Tabelle und CSV) steht einmal in
`logik/auswertung.py` (`firma_am_tag`, `abrechnung`, `csv_firma`); Seite, Bericht und CSV-Anhang nehmen sie von dort.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

EIGEN = "eigen"


def _zeit(wert: datetime | str) -> datetime:
    """ISO-Text oder datetime als datetime."""
    return wert if isinstance(wert, datetime) else datetime.fromisoformat(wert)


def _vergleichbar(ab: datetime, zeit: datetime) -> datetime:
    """`ab` so angleichen, dass es mit `zeit` vergleichbar ist (naiv gegen zeitzonenbewusst)."""
    if (ab.tzinfo is None) == (zeit.tzinfo is None):
        return ab
    if ab.tzinfo is None:
        return ab.replace(tzinfo=zeit.tzinfo)
    return ab.astimezone().replace(tzinfo=None)


def _eintraege(zuordnung: Iterable[Mapping[str, Any]], bereich: str) -> list[tuple[datetime, str]]:
    """Zuordnungen eines Containers, zeitlich sortiert (bei gleichem `ab` gilt der spätere Listeneintrag)."""
    liste = [(_zeit(z["ab"]), str(z["firma"])) for z in zuordnung if z.get("bereich") == bereich]
    return sorted(liste, key=lambda x: x[0].timestamp())


def firma_am(zuordnung: list[dict], bereich: str, zeit: datetime) -> str:
    """Firma, der der Container `bereich` zum Zeitpunkt `zeit` gehört; ohne Eintrag `eigen`."""
    firma = EIGEN
    for ab, wer in _eintraege(zuordnung, bereich):
        if _vergleichbar(ab, zeit) <= zeit:
            firma = wer
    return firma


def firma_von(zuordnung: list[dict], firmen: Iterable[Mapping[str, Any]], bereich: str, zeit: datetime) -> str:
    """Wie `firma_am`, aber eine Firma, die nicht (mehr) in `firmen` steht, zählt zur eigenen Firma."""
    fid = firma_am(zuordnung, bereich, zeit)
    return fid if any(f.get("id") == fid for f in firmen) else EIGEN


def zahl(wert: float | int | Decimal, stellen: int = 2) -> str:
    """Zahl mit Dezimalkomma und ohne Tausendertrennung (Mockup `zahl`).

    Gerundet wie `toFixed` im Mockup: exakter Wert der Zahl, bei genau halb weg von null (3693,125 → 3693,13).
    Pythons Formatierung würde auf gerade runden (3693,12).
    """
    genau = wert if isinstance(wert, Decimal) else Decimal(wert)
    text = f"{genau.quantize(Decimal(1).scaleb(-stellen), rounding=ROUND_HALF_UP):f}"
    if text.startswith("-") and float(text) == 0:
        text = text[1:]
    return text.replace(".", ",")
