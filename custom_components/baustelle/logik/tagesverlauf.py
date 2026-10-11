"""Verlauf 24 h eines Tages der Heizperiode (BSM-033.04 Teil b, Mockup hochrechnung-j4b.html) – ohne HA-Code.

Je Stunde: gemessener Verbrauch (bis jetzt), Prognose mit Automatik, ohne Automatik und die Außentemperatur.
- **Prognose je Stunde** (`verlauf`): der Tageswert aus der Hochrechnung (heute: der Rest des Tages) verteilt auf die
  Stunden nach Heizplan und Temperatur – in der Heizzeit voll, außerhalb nur `FROST_ANTEIL` (Frostschutz), je Stunde
  gewichtet mit dem Abstand zur Heizgrenze (kälter = mehr). Die Summe bleibt der Tageswert der Signatur.
- **Ohne Automatik je Stunde**: der Tageswert verteilt nach dem gemessenen Stundenprofil der Baseline-Tage
  (`ohne_profil`: mittlerer Anteil je Stunde), solange es keine gibt gleichmäßig – wie die Schätzung „jeder Heizkörper
  rund um die Uhr“ selbst rechnet.
- **Obergrenze** (`max_kwh_h`): keine Stunde über der Leistung aller Heizkörper; was darüber läge, geht anteilig auf die
  übrigen Stunden (die Summe bleibt, solange sie überhaupt in die Stunden passt).
- **Außentemperatur**: gemessen, sonst stündliche Vorhersage, sonst ein typischer Tagesgang (`tagesgang`) um das
  Tagesmittel (Vorhersage oder Klimamittel).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from math import pi, sin

FROST_ANTEIL = 0.05         # außerhalb der Heizzeit: so viel Gewicht wie in der Heizzeit (Frostschutz)
TAGESGANG_K = 3.0           # halbe Spanne des typischen Tagesgangs (tiefster Wert gegen 03:00, höchster gegen 15:00)
GRENZE_VORGABE = 15.0       # Heizgrenze, wenn die Signatur keine kennt
MIN_GRAD = 0.5              # auch über der Heizgrenze ein kleines Gewicht (Grundlast)


@dataclass(frozen=True)
class Stunde:
    h: int
    ist: float | None           # gemessen (kWh)
    prog: float | None          # Prognose mit Automatik (kWh)
    ohne: float | None          # ohne Automatik (kWh)
    aussen: float               # °C
    quelle: str                 # Herkunft der Temperatur: "gemessen" | "vorhersage" | "tagesgang"


def tagesgang(mittel: float, h: int) -> float:
    """Typische Außentemperatur der Stunde h um das Tagesmittel (Mitte der Stunde)."""
    return mittel + TAGESGANG_K * sin(2 * pi * (h + 0.5 - 9) / 24)


def plan_anteile(fenster: Sequence[tuple[int, int]]) -> list[float]:
    """Je Stunde der Anteil in der Heizzeit (0–1), aus Zeitfenstern in Minuten (von, bis)."""
    aus = [0.0] * 24
    for von, bis in fenster:
        for h in range(24):
            a, b = max(von, h * 60), min(bis, (h + 1) * 60)
            if b > a:
                aus[h] = min(1.0, aus[h] + (b - a) / 60)
    return aus


def gewichte(anteile: Sequence[float], temps: Sequence[float], grenze: float | None) -> list[float]:
    g = GRENZE_VORGABE if grenze is None else grenze
    return [(FROST_ANTEIL + (1 - FROST_ANTEIL) * a) * max(MIN_GRAD, g - t) for a, t in zip(anteile, temps)]


def verteilen(kwh: float, stunden: Sequence[int], w: Sequence[float],
              grenze: Mapping[int, float] | None = None) -> dict[int, float]:
    """`kwh` auf die Stunden `stunden` nach den Gewichten `w` (je Stunde des Tages); ohne Gewicht gleichmäßig. Mit
    `grenze` (je Stunde höchstens) geht, was darüber läge, anteilig auf die anderen Stunden."""
    if not stunden:
        return {}
    aus: dict[int, float] = {}
    offen, rest = list(stunden), kwh
    while offen and rest > 1e-9:
        summe = sum(w[h] for h in offen)
        teil = {h: rest * (w[h] / summe if summe > 0 else 1 / len(offen)) for h in offen}
        voll = [h for h in offen if grenze is not None and teil[h] > grenze.get(h, teil[h])]
        if not voll:
            aus.update(teil)
            return {h: aus.get(h, 0.0) for h in stunden}
        for h in voll:
            aus[h] = grenze[h]   # type: ignore[index]  # voll nur mit grenze
            rest -= grenze[h]    # type: ignore[index]
            offen.remove(h)
    return {h: aus.get(h, 0.0) for h in stunden}


def ohne_profil(tage: Sequence[Sequence[float]]) -> list[float] | None:
    """Mittlerer Anteil je Stunde aus gemessenen Baseline-Tagen (je Tag 24 Werte kWh); None ohne brauchbaren Tag."""
    anteile = [[v / s for v in t] for t in tage if len(t) == 24 and (s := sum(t)) > 0]
    if not anteile:
        return None
    return [sum(a[h] for a in anteile) / len(anteile) for h in range(24)]


def verlauf(
    *, ist: Mapping[int, float], aussen_gemessen: Mapping[int, float], aussen_vorhersage: Mapping[int, float],
    mittel: float | None, ab: int, prog_kwh: float, ohne_kwh: float | None, fenster: Sequence[tuple[int, int]],
    grenze: float | None, profil: Sequence[float] | None, max_kwh_h: float | None = None,
) -> list[Stunde]:
    """Die 24 Stunden eines Tages. `ab` = erste Stunde der Prognose (0 = ganzer Tag Prognose, 24 = vorbei; heute die
    laufende Stunde – ihr gemessener Teil steht in `ist`). `prog_kwh` = Prognose für die Stunden ab `ab` (heute: Rest
    des Tages), `ohne_kwh` = ganzer Tag ohne Automatik."""
    temps: list[float] = []
    quellen: list[str] = []
    for h in range(24):
        if h in aussen_gemessen:
            temps.append(aussen_gemessen[h])
            quellen.append("gemessen")
        elif h in aussen_vorhersage:
            temps.append(aussen_vorhersage[h])
            quellen.append("vorhersage")
        else:
            temps.append(tagesgang(mittel if mittel is not None else GRENZE_VORGABE, h))
            quellen.append("tagesgang")
    ab = min(max(ab, 0), 24)
    deckel = None if max_kwh_h is None else {h: max(0.0, max_kwh_h - (ist.get(h, 0.0) if h == ab else 0.0)) for h in range(24)}
    prog = verteilen(prog_kwh, list(range(ab, 24)), gewichte(plan_anteile(fenster), temps, grenze), deckel)
    ohne: dict[int, float] | None = None
    if ohne_kwh is not None:
        ohne = verteilen(ohne_kwh, list(range(24)), profil if profil else [1.0] * 24,
                         None if max_kwh_h is None else {h: max_kwh_h for h in range(24)})
    return [Stunde(h, round(ist.get(h, 0.0), 3) if h < ab or h in ist else None,
                   round(prog[h], 3) if h in prog else None, round(ohne[h], 3) if ohne is not None else None,
                   round(temps[h], 1), quellen[h]) for h in range(24)]


def heizzeit(fenster: Sequence[tuple[int, int]]) -> list[list[float]]:
    """Heizzeit für die Anzeige: zusammenhängende Fenster in Stunden [von, bis]."""
    aus: list[list[float]] = []
    for a, b in sorted((max(0, a), min(1440, b)) for a, b in fenster if b > a):
        if aus and a <= aus[-1][1] * 60:
            aus[-1][1] = max(aus[-1][1], b / 60)
        else:
            aus.append([a / 60, b / 60])
    return [[round(a, 2), round(b, 2)] for a, b in aus]
