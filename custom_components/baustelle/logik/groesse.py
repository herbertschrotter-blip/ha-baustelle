"""Containergröße (AN-0014, Herbert 04.10.2026, Mockup containergroesse.html) – ohne Home-Assistant-Code.

Standard-Baucontainer: außen 6,06 × 2,45 m, Wände ca. 8 cm, innen ca. 2,30 m hoch. Einzel innen 5,90 × 2,29 m ≈ 13,5 m²
(≈ 31 m³), Doppel 5,90 × 4,74 m ≈ 28 m² (≈ 64 m³). Die Fläche dient den Vergleichen (kWh je m²), der Rauminhalt dem
Startwert der lernenden Regelung: Solange ein Container noch nichts gelernt hat, schätzt er das Aufheizen aus der Größe –
ein Einzelcontainer mit einem Heizkörper ≈ 2,5 °C je Stunde, größere entsprechend langsamer.
"""

from __future__ import annotations

from math import ceil

EINZEL_M2 = 13.5
DOPPEL_M2 = 28.0
HOEHE_M = 2.30
RATE_EINZEL = 2.5               # °C je Stunde, Einzelcontainer, ein Heizkörper (Startwert)
RASTER_MIN = 5                  # wie lernen.AUF_RASTER_MIN
TYPEN = {"einzel": (5.90, 2.29, EINZEL_M2), "doppel": (5.90, 4.74, DOPPEL_M2)}   # innen Länge, Breite (m), Fläche


def flaeche(m2: float | None) -> float:
    """Fläche innen; ohne Angabe ein Einzelcontainer."""
    return float(m2) if m2 and m2 > 0 else EINZEL_M2


def volumen(m2: float | None) -> float:
    """Rauminhalt in m³ (Fläche × 2,30 m)."""
    return flaeche(m2) * HOEHE_M


def rate_geschaetzt(m2: float | None) -> float:
    """Geschätzte Aufheizrate in °C je Stunde – umgekehrt zum Rauminhalt, Einzelcontainer = `RATE_EINZEL`."""
    return RATE_EINZEL * EINZEL_M2 / flaeche(m2)   # gleiche Höhe: Rauminhalt wie Fläche


def aufheiz_min(m2: float | None, *, innen: float | None, soll: float) -> int | None:
    """Minuten bis zum Soll mit der geschätzten Rate (auf 5 min aufgerundet); None ohne Innentemperatur."""
    if innen is None:
        return None
    roh = max(0.0, soll - innen) / rate_geschaetzt(m2) * 60
    return int(ceil(roh / RASTER_MIN - 1e-9) * RASTER_MIN)


def je_m2(wert: float | None, m2: float | None) -> float | None:
    """Wert je m² Fläche (None bleibt None)."""
    return None if wert is None else float(wert) / flaeche(m2)


def art(m2: float | None) -> str:
    """„einzel“ (auch ohne Angabe), „doppel“ oder „frei“."""
    w = flaeche(m2)
    return next((k for k, t in TYPEN.items() if abs(w - t[2]) < 0.01), "frei")


def anzeige(m2: float | None) -> dict[str, object]:
    """Größe für die Seite: Art, Fläche, Rauminhalt, Höhe, geschätzte Aufheizrate und die Standardgrößen."""
    return {"art": art(m2), "m2": flaeche(m2), "m3": volumen(m2), "hoehe": HOEHE_M, "rate": rate_geschaetzt(m2),
            "typen": {k: {"laenge": t[0], "breite": t[1], "m2": t[2], "m3": volumen(t[2])} for k, t in TYPEN.items()}}
