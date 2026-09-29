"""Wochen- und Monatsbericht – reine Fachlogik ohne Home-Assistant-Code.

Vorbild ist das abgenommene Mockup (`mockups/quelle/glas-app.js`, Einstellungen „Bericht“ und Einblendung
„Bericht · Beispiel“):

- Häufigkeit `aus`, `woche` (jeden Montag 07:00 für die Vorwoche Mo–So), `monat` (am 1. des Monats 07:00 für den
  Vormonat), `beides`.
- Betreff „Baustelle <Name> – Woche 21.–27.09.2026“ bzw. „Baustelle <Name> – September 2026“; Inhalt: Summe mit
  Vergleich zum Zeitraum davor, Je Firma, Je Container, Heizung (Heiztage, gespart durch Automatik),
  Offene Warnungen. CSV-Anhang `abrechnung-kw39.csv` bzw. `abrechnung-2026-09.csv`.
- Handy: Kurzfassung (Summe, Kosten, Warnungen).

Entscheidungen, wo der Bauplan offen ist (im Sinne des Mockups):

- Fallen Wochen- und Monatsbericht bei `beides` auf denselben Zeitpunkt (Montag, der 1.), liefert
  `naechster_bericht` die Art `beides`; der Aufrufer schickt dann beide Berichte.
- Ein Bericht gilt als „nächster“, wenn er echt nach `jetzt` liegt (Mo 07:00:00 selbst → der folgende Montag).
- Wochen über einen Monats- oder Jahreswechsel: „Woche 28.09.–04.10.2026“ bzw. „Woche 29.12.2025–04.01.2026“.
- Monatsnamen österreichisch („Jänner“). Zahlen wie das Mockup (`de()`, de-AT): Dezimalkomma, Tausender mit
  geschütztem Leerzeichen.
- Das Mockup hat keinen Text für „keine offenen Warnungen“; hier steht dann „keine“.
- „Je Firma“ zeigt wie das Mockup nur Firmen mit Verbrauch > 0; „Je Container“ zeigt alle übergebenen Container.
- Rundung wie JavaScript im Mockup (bei genau halb weg von null), nicht Pythons Runden auf gerade.

`daten` für `text_kurz`/`text_mail` (dict, alle Beträge in €, Energie in kWh):

    baustelle: str; art: "woche"|"monat"; von: date; bis: date; kwh: float; eur: float
    vergleich_prozent: float | None      # Änderung zum Zeitraum davor in %
    firmen: list[{"name", "kwh", "eur"}]; container: list[{"name", "kwh"}]
    heiztage: int; gespart_eur: float | None
    warnungen: list[{"bereich": str | None, "titel": str}]  (nur offene, nicht stumme)

Empfänger und CSV-Anhang (`anhang_name`, `abrechnung.csv_zeilen`) setzt der Aufrufer beim Versand.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum
from typing import Any

BERICHT_UHRZEIT = time(7, 0)

MONATE = [
    "Jänner",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
]


class Haeufigkeit(StrEnum):
    """Wie oft der Bericht kommt (Einstellung `bericht.haeufigkeit`)."""

    AUS = "aus"
    WOCHE = "woche"
    MONAT = "monat"
    BEIDES = "beides"


class Art(StrEnum):
    """Art eines fälligen Berichts."""

    WOCHE = "woche"
    MONAT = "monat"
    BEIDES = "beides"


def _um_sieben(tag: date, jetzt: datetime) -> datetime:
    return datetime.combine(tag, BERICHT_UHRZEIT, tzinfo=jetzt.tzinfo)


def _naechster_montag(jetzt: datetime) -> datetime:
    tag = jetzt.date() - timedelta(days=jetzt.weekday())
    kandidat = _um_sieben(tag, jetzt)
    while kandidat <= jetzt:
        tag += timedelta(days=7)
        kandidat = _um_sieben(tag, jetzt)
    return kandidat


def _naechster_erster(jetzt: datetime) -> datetime:
    tag = jetzt.date().replace(day=1)
    kandidat = _um_sieben(tag, jetzt)
    if kandidat <= jetzt:
        tag = (tag + timedelta(days=32)).replace(day=1)
        kandidat = _um_sieben(tag, jetzt)
    return kandidat


def naechster_bericht(jetzt: datetime, haeufigkeit: str) -> tuple[datetime, str] | None:
    """Nächster Berichtszeitpunkt nach `jetzt` und seine Art; None bei `aus`.

    Mo 07:00 → „woche“, am 1. 07:00 → „monat“; bei `beides` der frühere, fallen beide zusammen → „beides“.
    """
    h = Haeufigkeit(haeufigkeit)
    if h is Haeufigkeit.AUS:
        return None
    if h is Haeufigkeit.WOCHE:
        return _naechster_montag(jetzt), Art.WOCHE.value
    if h is Haeufigkeit.MONAT:
        return _naechster_erster(jetzt), Art.MONAT.value
    woche, monat = _naechster_montag(jetzt), _naechster_erster(jetzt)
    if woche == monat:
        return woche, Art.BEIDES.value
    return (woche, Art.WOCHE.value) if woche < monat else (monat, Art.MONAT.value)


def zeitraum(art: str, zeitpunkt: datetime) -> tuple[date, date]:
    """Berichtszeitraum (erster und letzter Tag, beide eingeschlossen): Vorwoche Mo–So bzw. Vormonat."""
    tag = zeitpunkt.date() if isinstance(zeitpunkt, datetime) else zeitpunkt
    a = Art(art)
    if a is Art.WOCHE:
        montag = tag - timedelta(days=tag.weekday() + 7)
        return montag, montag + timedelta(days=6)
    if a is Art.MONAT:
        letzter = tag.replace(day=1) - timedelta(days=1)
        return letzter.replace(day=1), letzter
    raise ValueError("zeitraum gibt es nur für „woche“ oder „monat“")


def zeitraum_text(art: str, von: date, bis: date) -> str:
    """„Woche 21.–27.09.2026“ bzw. „September 2026“ (Mockup Betreff)."""
    if Art(art) is Art.MONAT:
        return f"{MONATE[von.month - 1]} {von.year}"
    if von.year != bis.year:
        anfang = von.strftime("%d.%m.%Y")
    elif von.month != bis.month:
        anfang = von.strftime("%d.%m.")
    else:
        anfang = von.strftime("%d.")
    return f"Woche {anfang}–{bis.strftime('%d.%m.%Y')}"


def anhang_name(art: str, von: date) -> str:
    """Name des CSV-Anhangs: `abrechnung-kw39.csv` bzw. `abrechnung-2026-09.csv` (Mockup)."""
    if Art(art) is Art.MONAT:
        return f"abrechnung-{von.year}-{von.month:02d}.csv"
    return f"abrechnung-kw{von.isocalendar().week:02d}.csv"


def heiztage(kwh_je_bereich_und_tag: dict[str, dict[date, float]], von: date, bis: date) -> int:
    """Tage im Zeitraum, an denen irgendein Container Energie verbraucht hat."""
    tage = {
        t for je_tag in kwh_je_bereich_und_tag.values() for t, kwh in je_tag.items() if (kwh or 0) > 0 and von <= t <= bis
    }
    return len(tage)


def _runden(wert: float, stellen: int) -> Decimal:
    """Kaufmännisch runden wie JavaScript (`toFixed`, `toLocaleString`, `Math.round` bei positiven Zahlen)."""
    genau = wert if isinstance(wert, Decimal) else Decimal(wert)
    return genau.quantize(Decimal(1).scaleb(-stellen), rounding=ROUND_HALF_UP)


def de(wert: float, stellen: int = 1) -> str:
    """Zahl wie das Mockup (`de()`, de-AT): Dezimalkomma, Tausender mit geschütztem Leerzeichen.

    Gerundet wie `toLocaleString` (exakter Wert, bei genau halb weg von null: 2,5 → 3), nicht auf gerade.
    """
    text = f"{_runden(wert, stellen):,f}"
    if text.startswith("-") and float(text.replace(",", "")) == 0:
        text = text[1:]
    return text.replace(",", " ").replace(".", ",")


def _prozent(wert: float) -> str:
    zahl = int(_runden(wert, 0))
    if zahl > 0:
        return f"+{zahl} %"
    if zahl < 0:
        return f"−{-zahl} %"
    return "±0 %"


def _vergleich(daten: dict[str, Any]) -> str:
    """„(−4 % zur Woche davor)“ bzw. „(+31 % zum August)“; leer ohne Vergleichswert."""
    wert = daten.get("vergleich_prozent")
    if wert is None:
        return ""
    if Art(daten["art"]) is Art.MONAT:
        vorher = MONATE[(daten["von"].month - 2) % 12]
        return f" ({_prozent(wert)} zum {vorher})"
    return f" ({_prozent(wert)} zur Woche davor)"


def _summe(daten: dict[str, Any]) -> str:
    """„Vorwoche: 1 234 kWh · 345,67 €“ bzw. „September: …“."""
    was = MONATE[daten["von"].month - 1] if Art(daten["art"]) is Art.MONAT else "Vorwoche"
    return f"{was}: {de(daten['kwh'], 0)} kWh · {de(daten['eur'], 2)} €"


def _warnung(w: dict[str, Any]) -> str:
    return f"{w['bereich']}: {w['titel']}" if w.get("bereich") else str(w["titel"])


def betreff(daten: dict[str, Any]) -> str:
    """„Baustelle <Name> – <Zeitraum>“."""
    return f"Baustelle {daten['baustelle']} – {zeitraum_text(daten['art'], daten['von'], daten['bis'])}"


def text_kurz(daten: dict[str, Any]) -> str:
    """Kurzfassung fürs Handy: Summe, Kosten, Warnungen."""
    warnungen = daten.get("warnungen") or []
    zeilen = [_summe(daten) + _vergleich(daten)]
    if warnungen:
        anzahl = "1 offene Warnung" if len(warnungen) == 1 else f"{len(warnungen)} offene Warnungen"
        zeilen.append(f"{anzahl}: " + " · ".join(_warnung(w) for w in warnungen))
    else:
        zeilen.append("Keine offenen Warnungen")
    return "\n".join(zeilen)


def text_mail(daten: dict[str, Any]) -> tuple[str, str]:
    """Betreff und Inhalt der Mail (wie Mockup „Bericht · Beispiel“), als Klartext."""
    zeilen = [_summe(daten) + _vergleich(daten), "", "Je Firma"]
    # Wie Mockup: nur Firmen mit Verbrauch im Zeitraum (`.filter(x => x[1] > 0)`)
    zeilen += [
        f"{f['name']}: {de(f['kwh'], 0)} kWh · {de(f['eur'], 2)} €"
        for f in daten.get("firmen") or []
        if (f.get("kwh") or 0) > 0
    ]
    zeilen += ["", "Je Container"]
    zeilen += [f"{c['name']}: {de(c['kwh'], 0)} kWh" for c in daten.get("container") or []]
    zeilen += ["", "Heizung", f"Heiztage: {daten.get('heiztage', 0)}"]
    if daten.get("gespart_eur") is not None:
        zeilen.append(f"gespart durch Automatik: {de(daten['gespart_eur'], 0)} €")
    zeilen += ["", "Offene Warnungen"]
    warnungen = daten.get("warnungen") or []
    zeilen += [_warnung(w) for w in warnungen] if warnungen else ["keine"]
    return betreff(daten), "\n".join(zeilen)
