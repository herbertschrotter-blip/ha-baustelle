"""Hochrechnung der Heizperiode mit Energiesignatur und Heizgradtagen (BSM-033.02, Bauplan Hochrechnung §4) – ohne HA-Code.

Je Container:
- **Welche Tage zählen** (`tag_zaehlt`): ganze Tage vor heute, mit Verbrauch und Außentemperatur (Tagesmittel über 24 h),
  zu mindestens `VOLL_ANTEIL` mitgeschrieben (HA oder übernommen) – Tage mit Ausfall oder Notbetrieb fallen weg (Herbert 10.10.2026).
- **Rest der Heizperiode** (morgen bis zum Ende): je Tag der erwartete Verbrauch aus der Signatur (`logik/signatur`)
  bei der Außentemperatur des Tages – aus der Vorhersage, sonst aus den Klimamitteln (Monatsmittel, zwischen den
  Monatsmitten linear). Solange die Signatur lernt oder unsicher ist: Tagesschnitt der gezählten Tage × Resttage
  (wie bisher), dann ohne Spanne.
- **Spanne**: wärmerer bzw. kälterer Winter (alle Tage ohne Vorhersage um `WINTER_K` wärmer/kälter) und die Streuung der
  Signatur (1,645 · rmse · √Tage, rund 90 %).

Für die Baustelle: bisher (Zähler) + Summe der Reste; Spanne nur, wenn jeder Container eine Signatur hat.
**Heizgradtage** nach ÖNORM B 8135 (HGT 20/12): je Tag 20 − außen, wenn außen unter 12 °C. **Witterungsbereinigt**
(Normjahr): die ganze Heizperiode bei Klimamitteln – damit lassen sich Baustellen und Jahre vergleichen.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from math import sqrt

from .signatur import Signatur, Tag, berechnen, erwartet

VOLL_ANTEIL = 0.95          # so viel des Tages muss HA mitgeschrieben haben
WINTER_K = 1.5              # wärmerer/kälterer Winter für die Spanne (Streuung der Monatsmittel im Winter)
Z90 = 1.645                 # rund 90 % bei Normalverteilung
HGT_INNEN, HGT_GRENZE = 20.0, 12.0

# Klimamittel je Monat (°C), Näherung für Graz 1991–2020 (GeoSphere Austria) – je Baustelle als Einstellung
# `klimamittel` (12 Werte, Jänner zuerst) zu ersetzen, bis dahin Vorgabe.
KLIMA_GRAZ: tuple[float, ...] = (0.3, 2.0, 6.3, 11.1, 15.6, 19.4, 21.1, 20.6, 15.8, 10.6, 5.4, 1.0)


@dataclass(frozen=True)
class TagRoh:
    datum: date
    kwh: float | None
    aussen: float | None
    erfasst_s: float              # mitgeschriebene Sekunden des Tages (ohne Stunden aus dem Notprogramm)
    dauer_s: float = 86400.0      # Länge des Tages (Sommerzeit: 23 h / 25 h)


@dataclass(frozen=True)
class ContainerRest:
    rest_kwh: float
    unten_kwh: float | None
    oben_kwh: float | None
    methode: str                  # "signatur" | "tagesschnitt" | "keine"
    signatur: Signatur
    normjahr_kwh: float | None    # ganze Heizperiode bei Klimamitteln (nur mit Signatur)


def klimamittel(werte: Sequence[float] | None) -> tuple[float, ...]:
    """Gültige 12 Monatsmittel aus der Einstellung, sonst die Vorgabe."""
    if werte is not None and len(werte) == 12 and all(isinstance(v, (int, float)) for v in werte):
        return tuple(float(v) for v in werte)
    return KLIMA_GRAZ


def klima_tag(tag: date, klima: Sequence[float]) -> float:
    """Klimamittel eines Tages: zwischen den Monatsmitten (15.) linear."""
    m = tag.month - 1
    mitte = date(tag.year, tag.month, 15)
    if tag >= mitte:
        nach = date(tag.year + (tag.month == 12), tag.month % 12 + 1, 15)
        a, b, t0, t1 = klima[m], klima[(m + 1) % 12], mitte, nach
    else:
        vor = date(tag.year - (tag.month == 1), (tag.month - 2) % 12 + 1, 15)
        a, b, t0, t1 = klima[(m - 1) % 12], klima[m], vor, mitte
    return a + (b - a) * (tag - t0).days / (t1 - t0).days


def hgt(aussen: float) -> float:
    """Heizgradtag 20/12 (ÖNORM B 8135)."""
    return HGT_INNEN - aussen if aussen < HGT_GRENZE else 0.0


def tag_zaehlt(t: TagRoh, heute: date) -> bool:
    return t.datum < heute and t.kwh is not None and t.aussen is not None and t.erfasst_s >= VOLL_ANTEIL * t.dauer_s


def tage(von: date, bis: date) -> list[date]:
    """Tage von … bis (einschließlich); leer, wenn bis vor von."""
    return [von + timedelta(days=i) for i in range((bis - von).days + 1)]


def temperaturen(rest: Iterable[date], vorhersage: Mapping[date, float], klima: Sequence[float]) -> list[tuple[float, bool]]:
    """Je Tag (außen °C, aus der Vorhersage?)."""
    return [(vorhersage[d], True) if d in vorhersage else (klima_tag(d, klima), False) for d in rest]


def container_rest(
    roh: Sequence[TagRoh], heute: date, ende: date, vorhersage: Mapping[date, float], klima: Sequence[float],
    beginn: date,
) -> ContainerRest:
    """Rest der Heizperiode eines Containers (morgen bis `ende`); `beginn` = erster Tag der Heizperiode (Normjahr)."""
    gezaehlt = [t for t in roh if tag_zaehlt(t, heute)]
    sig = berechnen(Tag(t.aussen, t.kwh) for t in gezaehlt)    # type: ignore[arg-type]  # tag_zaehlt prüft None
    rest_tage = tage(heute + timedelta(days=1), ende)
    temps = temperaturen(rest_tage, vorhersage, klima)
    if erwartet(sig, 0.0) is None:
        if not gezaehlt:
            return ContainerRest(0.0, None, None, "keine", sig, None)
        schnitt = sum(t.kwh or 0.0 for t in gezaehlt) / len(gezaehlt)
        return ContainerRest(schnitt * len(rest_tage), None, None, "tagesschnitt", sig, None)

    def summe(verschiebung: float) -> float:
        return sum(erwartet(sig, t + (0.0 if fest else verschiebung)) or 0.0 for t, fest in temps)

    mitte = summe(0.0)
    streuung = Z90 * (sig.rmse or 0.0) * sqrt(len(rest_tage))
    unten = max(0.0, summe(WINTER_K) - streuung)
    oben = summe(-WINTER_K) + streuung
    norm = sum(erwartet(sig, klima_tag(d, klima)) or 0.0 for d in tage(beginn, ende))
    return ContainerRest(mitte, unten, oben, "signatur", sig, norm)


def baustelle(bisher_kwh: float | None, reste: Mapping[str, ContainerRest]) -> dict[str, float | str | None]:
    """Hochrechnung der Baustelle: bisher + Reste; Spanne nur, wenn alle Container eine Signatur haben."""
    if bisher_kwh is None:
        return {"mit_kwh": None, "unten_kwh": None, "oben_kwh": None, "methode": "keine", "normjahr_kwh": None}
    werte = list(reste.values())
    alle = bool(werte) and all(r.methode == "signatur" for r in werte)
    methode = "signatur" if alle else "tagesschnitt" if any(r.methode != "keine" for r in werte) else "keine"
    return {
        "mit_kwh": bisher_kwh + sum(r.rest_kwh for r in werte) if methode != "keine" else None,
        "unten_kwh": bisher_kwh + sum(r.unten_kwh or 0.0 for r in werte) if alle else None,
        "oben_kwh": bisher_kwh + sum(r.oben_kwh or 0.0 for r in werte) if alle else None,
        "methode": methode,
        "normjahr_kwh": sum(r.normjahr_kwh or 0.0 for r in werte) if alle else None,
    }


def hgt_summe(temps: Iterable[float]) -> float:
    return sum(hgt(t) for t in temps)
