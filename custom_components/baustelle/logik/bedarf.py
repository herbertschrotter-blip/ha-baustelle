"""Bedarf eines Containers in °C für die Rangfolge der Staffelung – ohne Home-Assistant-Code (Herbert 01.10.2026).

Statt „wie weit ist der Raum jetzt unter dem Soll“ zählt, **wie weit er am Ende eines Takts (`HORIZONT_MIN`) unter dem
Soll wäre** – in Grad, damit jeder Teil nachvollziehbar bleibt (Mockup staffel-rang.html):

- **jetzt:** Soll − innen.
- **Abkühlen:** so viel kühlt der Raum in dieser Zeit **ohne Heizen** ab – die Trägheit des Containers. Ist er gerade
  aus, gilt die gemessene Abkühlung (Steigung der letzten `TREND_FENSTER_MIN`, z. B. bei offener Tür oder Kälte);
  heizt er, die gelernte Abkühlrate (Zähler `abkuehl:<id>`, wie im Vergleich Ölradiator/Konvektor) – der Trend beim
  Heizen sagt nichts darüber, wie schnell er ohne Heizung auskühlt (Herbert 01.10.2026).
- **Nachlauf:** ein laufender Heizkörper heizt nach dem Ausschalten noch nach (gelernt, Ölradiator) – so viel weniger.
- **Ziel:** schafft der Container sein Soll bis zur Zielzeit nicht mehr (Arbeitsbeginn bzw. „Soll erreicht … min
  vorher“), kommt dazu, was ihm bei durchgehendem Heizen mit der gelernten Aufheizrate dann noch fehlt.
- **Gerecht:** wer in der letzten Stunde weniger Heizzeit hatte als der Schnitt der Container, rückt vor
  (`GERECHT_JE_10MIN` °C je 10 min weniger) – so verliert kein Container dauernd.

Ohne Fühler gibt es weder jetzt noch Trend, Nachlauf oder Ziel: der Bedarf ist nur der Gerechtigkeits-Zuschlag, so
kommt der Container reihum dran.

Vorbilder (Recherche 01.10.2026): Prioritätspunkte aus dem Abstand zum Soll (regelbasierter Lastabwurf in Gebäuden),
Rotating Load Shedding (gleiche Anteile) und – stark vereinfacht auf einen Takt – vorausschauende Regelung (MPC).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

HORIZONT_MIN = 15          # so weit voraus (ein Rundlauf-Takt)
TREND_FENSTER_MIN = 20     # Steigung über so viele Minuten …
TREND_MIN_MIN = 10         # … aber erst ab so vielen Minuten Messung
TREND_GRENZE = 10.0        # °C/h – mehr ist ein Messfehler (Fühler neu, Sonne aufs Gerät)
GERECHT_JE_10MIN = 0.1     # °C Zuschlag je 10 min weniger Heizzeit als der Schnitt (letzte Stunde)
GERECHT_MAX = 1.0
ZIEL_VORAUS_MIN = 240      # weiter voraus zählt die Zielzeit nicht


@dataclass(frozen=True)
class Bedarf:
    """Bedarf in °C und woraus er sich zusammensetzt (None = gibt es nicht, z. B. ohne Fühler)."""

    summe: float
    jetzt: float | None = None
    abkuehlen: float | None = None  # Beitrag in °C (≥ 0): so viel kälter in HORIZONT_MIN ohne Heizen
    abkuehl_h: float | None = None  # verwendete Abkühlrate in °C/h
    gemessen: bool = False          # Abkühlrate gemessen (gerade aus) statt gelernt
    trend_h: float | None = None    # Steigung der Raumtemperatur jetzt in °C/h
    nachlauf: float = 0.0           # Beitrag (≤ 0)
    ziel: float = 0.0               # Beitrag (≥ 0)
    gerecht: float = 0.0            # Beitrag (≥ 0)


def trend_c_h(punkte: Sequence[tuple[datetime, float]], jetzt: datetime) -> float | None:
    """Steigung der Raumtemperatur in °C/h (Ausgleichsgerade über `TREND_FENSTER_MIN`); None bei zu wenig Messung."""
    fenster = [(t, v) for t, v in punkte if 0 <= (jetzt - t).total_seconds() / 60 <= TREND_FENSTER_MIN]
    if len(fenster) < 2 or (fenster[-1][0] - fenster[0][0]).total_seconds() / 60 < TREND_MIN_MIN:
        return None
    xs = [(t - fenster[0][0]).total_seconds() / 3600 for t, _ in fenster]
    ys = [v for _, v in fenster]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    nenner = sum((x - mx) ** 2 for x in xs)
    if nenner <= 0:
        return None
    k = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / nenner
    return max(-TREND_GRENZE, min(TREND_GRENZE, k))


def ziel_fehlt(innen: float | None, soll: float, rate_c_h: float | None, minuten_bis: float | None) -> float:
    """So viel °C fehlen zur Zielzeit noch, wenn ab jetzt durchgehend mit der gelernten Rate geheizt wird (≥ 0)."""
    if innen is None or rate_c_h is None or rate_c_h <= 0 or minuten_bis is None or not 0 < minuten_bis <= ZIEL_VORAUS_MIN:
        return 0.0
    return max(0.0, (soll - innen) - rate_c_h * minuten_bis / 60)


def gerecht(heiz_min: float, schnitt_min: float) -> float:
    """Zuschlag für wenig Heizzeit in der letzten Stunde gegenüber dem Schnitt der Container."""
    return min(GERECHT_MAX, max(0.0, (schnitt_min - heiz_min) / 10 * GERECHT_JE_10MIN))


def abkuehl_rate(trend_h: float | None, gelernt_h: float | None, laeuft: bool) -> tuple[float | None, bool]:
    """Abkühlrate ohne Heizen in °C/h (≥ 0) und ob sie gemessen ist: aus → gemessene Abkühlung, sonst die gelernte."""
    if not laeuft and trend_h is not None:
        return max(0.0, -trend_h), True
    if gelernt_h is not None:
        return max(0.0, gelernt_h), False
    return None, False


def bedarf(
    *, innen: float | None, soll: float, trend_h: float | None = None, abkuehl_gelernt_h: float | None = None,
    nachlauf: float = 0.0, laeuft: bool = False, ziel: float = 0.0, zuschlag_gerecht: float = 0.0,
) -> Bedarf:
    """Bedarf in °C in `HORIZONT_MIN` Minuten (siehe Modul)."""
    g = round(zuschlag_gerecht, 3)
    if innen is None:
        return Bedarf(summe=g, gerecht=g)
    jetzt = soll - innen
    rate, gemessen = abkuehl_rate(trend_h, abkuehl_gelernt_h, laeuft)
    ab = rate * HORIZONT_MIN / 60 if rate is not None else 0.0
    nach = -max(0.0, nachlauf) if laeuft else 0.0
    summe = jetzt + ab + nach + ziel + g
    return Bedarf(summe=round(summe, 3), jetzt=round(jetzt, 3), abkuehlen=round(ab, 3) if rate is not None else None,
                  abkuehl_h=round(rate, 2) if rate is not None else None, gemessen=gemessen,
                  trend_h=round(trend_h, 2) if trend_h is not None else None, nachlauf=round(nach, 3), ziel=round(ziel, 3), gerecht=g)
