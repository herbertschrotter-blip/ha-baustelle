"""Abrechnung nach Firma – reine Fachlogik ohne Home-Assistant-Code.

Vorbild ist das abgenommene Mockup (`mockups/quelle/glas-app.js`: `abrechnung()`, `csv('firma')`,
`quellen()` mit Gruppe „firma“).

- `zuordnung` ist der Verlauf der Firmen je Container (Store §1): es gilt der letzte Eintrag mit `ab <= Zeitpunkt`.
  Frühere Werte bleiben bei der bisherigen Firma. Fehlt ein Eintrag, gehört der Container der eigenen Firma (`eigen`).
- Verbrauch kommt je Container und Tag. Ein Tag gehört der Firma, der der Container zu Tagesbeginn (00:00 in der
  Zeitzone des Zuordnungs-Eintrags) gehört. Ein Wechsel mitten am Tag gilt damit ab dem Folgetag; der angebrochene Tag
  bleibt bei der bisherigen Firma („Frühere Werte bleiben bei der bisherigen Firma“, Mockup Firmen-Dialog).
- Unbekannte Firmen-IDs (Firma gelöscht) zählen zur eigenen Firma, wenn die Firmenliste übergeben wird – wie
  `firma(id)` im Mockup (`find(...) || firmen[0]`).
- CSV wie im Mockup: Semikolon, Dezimalkomma ohne Tausendertrennung (Excel liest es als Zahl), BOM, CRLF, keine
  Zeilenumschaltung am Ende. Abweichend vom Mockup werden Felder mit Semikolon, Anführungszeichen oder Zeilenumbruch
  nach RFC 4180 in Anführungszeichen gesetzt (Bauplan §2.5; das Mockup quotet gar nicht).
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import date, datetime, time
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

EIGEN = "eigen"

CSV_KOPF_FIRMA = ["Zeitraum", "Firma", "Baustelle", "Container", "kWh", "Preis €/kWh", "Betrag €"]
"""Spalten der Abrechnung als CSV (Mockup `csv('firma')`)."""


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


def _firma_am_tag(eintraege: list[tuple[datetime, str]], tag: date) -> str:
    """Firma zu Tagesbeginn (00:00 in der Zeitzone des jeweiligen Eintrags)."""
    firma = EIGEN
    for ab, wer in eintraege:
        if ab <= datetime.combine(tag, time.min, tzinfo=ab.tzinfo):
            firma = wer
    return firma


def aufteilen(
    kwh_je_bereich_und_tag: dict[str, dict[date, float]],
    zuordnung: list[dict],
    preis: float,
    *,
    firmen: list[dict] | None = None,
) -> dict[str, dict]:
    """Verbrauch je Firma: `firma → {"kwh", "eur", "container": {bereich: kwh}}`.

    Ein Container, der im Zeitraum die Firma wechselt, erscheint bei beiden Firmen mit seinem jeweiligen Anteil.
    Mit `firmen` (Store-Liste) kommen die Firmen in deren Reihenfolge, unbekannte IDs zählen zu `eigen`;
    sonst in der Reihenfolge des ersten Auftretens. Firmen ohne Verbrauch im Zeitraum fehlen.
    """
    bekannt = {f["id"] for f in firmen} if firmen is not None else None
    ergebnis: dict[str, dict] = {}
    for bereich, tage in kwh_je_bereich_und_tag.items():
        eintraege = _eintraege(zuordnung, bereich)
        for tag in sorted(tage):
            kwh = float(tage[tag] or 0.0)
            firma = _firma_am_tag(eintraege, tag)
            if bekannt is not None and firma not in bekannt:
                firma = EIGEN
            eintrag = ergebnis.setdefault(firma, {"kwh": 0.0, "eur": 0.0, "container": {}})
            eintrag["kwh"] += kwh
            eintrag["container"][bereich] = eintrag["container"].get(bereich, 0.0) + kwh
    for eintrag in ergebnis.values():
        eintrag["eur"] = eintrag["kwh"] * preis
    if firmen is not None:
        reihenfolge = [f["id"] for f in firmen]
        if EIGEN not in reihenfolge:
            reihenfolge.insert(0, EIGEN)
        ergebnis = {f: ergebnis[f] for f in reihenfolge if f in ergebnis}
    return ergebnis


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


def _feld(wert: Any) -> str:
    """Ein CSV-Feld als Text; Zahlen mit Dezimalkomma (2 Stellen), Datum als TT.MM.JJJJ."""
    if wert is None:
        text = ""
    elif isinstance(wert, bool):
        text = "ja" if wert else "nein"
    elif isinstance(wert, int):
        text = str(wert)
    elif isinstance(wert, (float, Decimal)):
        text = zahl(wert)
    elif isinstance(wert, datetime):
        text = wert.strftime("%d.%m.%Y %H:%M")
    elif isinstance(wert, date):
        text = wert.strftime("%d.%m.%Y")
    else:
        text = str(wert)
    if any(z in text for z in (";", '"', "\r", "\n")):
        text = '"' + text.replace('"', '""') + '"'
    return text


def csv_zeilen(kopf: list[str], zeilen: list[list]) -> str:
    """CSV für Excel: BOM, Semikolon, Dezimalkomma ohne Tausendertrennung, CRLF.

    Kommazahlen (`float`, `Decimal`) erscheinen mit 2 Nachkommastellen; wer andere Stellen braucht (Mockup:
    Verbrauch je Stunde mit 3), übergibt den Text von `zahl(wert, 3)`.
    """
    return "﻿" + "\r\n".join(";".join(_feld(w) for w in zeile) for zeile in [kopf, *zeilen])


def abrechnung_zeilen(
    aufteilung: dict[str, dict],
    *,
    zeitraum: str,
    baustelle: str,
    firmen: list[dict],
    container_namen: Mapping[str, str],
    preis: float,
) -> list[list]:
    """Zeilen der Abrechnung je Firma und Container (Spalten `CSV_KOPF_FIRMA`, Mockup `csv('firma')`)."""
    namen = {f["id"]: f["name"] for f in firmen}
    eigen_name = next((f["name"] for f in firmen if f.get("eigen")), namen.get(EIGEN, "Eigene Firma"))
    zeilen: list[list] = []
    for firma, eintrag in aufteilung.items():
        for bereich, kwh in eintrag["container"].items():
            zeilen.append(
                [
                    zeitraum,
                    namen.get(firma, eigen_name),
                    baustelle,
                    container_namen.get(bereich, bereich),
                    float(kwh),
                    float(preis),
                    kwh * preis,
                ]
            )
    return zeilen
