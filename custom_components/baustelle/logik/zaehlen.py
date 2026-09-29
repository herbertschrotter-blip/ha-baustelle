"""Zählen: Energie aus Zählerständen, mittlere Leistung im Betrieb, Hochrechnungen – ohne Home-Assistant-Code."""

from __future__ import annotations

from datetime import date

# Sprung eines Zählerstands, den wir nicht glauben (z. B. falscher Sensor gewählt), in kWh
MAX_SPRUNG_KWH = 50.0
# Gewicht eines neuen Messwerts im gleitenden Mittel der Leistung im Betrieb
MITTEL_GEWICHT = 0.05
# ab dieser Leistung gilt ein Heizgerät als „heizt gerade“ (W)
BETRIEB_AB_W = 5.0


def energie_zuwachs(alt: float | None, neu: float | None) -> float:
    """Zuwachs zwischen zwei Ständen eines Energiezählers (kWh).

    Zählt der Shelly neu (Stand kleiner als vorher), gilt der neue Stand als Zuwachs.
    Unglaubwürdige Sprünge und fehlende Werte zählen nicht.
    """
    if alt is None or neu is None:
        return 0.0
    zuwachs = neu - alt if neu >= alt else neu
    return zuwachs if 0.0 <= zuwachs <= MAX_SPRUNG_KWH else 0.0


def leistung_integriert(leistung_w: float | None, stunden: float) -> float:
    """Energie aus Leistung × Zeit (kWh), für Shellys ohne Energiezähler."""
    if leistung_w is None or leistung_w <= 0 or stunden <= 0:
        return 0.0
    return leistung_w * stunden / 1000


def mittel_im_betrieb(bisher: float | None, leistung_w: float | None) -> float | None:
    """Gleitendes Mittel der Leistung, nur während das Gerät heizt."""
    if leistung_w is None or leistung_w < BETRIEB_AB_W:
        return bisher
    if bisher is None:
        return leistung_w
    return bisher + MITTEL_GEWICHT * (leistung_w - bisher)


def tage_heizperiode(von_monat: int, bis_monat: int, jahr_beginn: int) -> int:
    """Tage einer Heizperiode, z. B. Oktober bis April (über den Jahreswechsel)."""
    beginn = date(jahr_beginn, von_monat, 1)
    ende_jahr = jahr_beginn if bis_monat >= von_monat else jahr_beginn + 1
    ende = date(ende_jahr + (bis_monat == 12), 1 if bis_monat == 12 else bis_monat + 1, 1)
    return (ende - beginn).days


def hochrechnung(summe: float, tage_gezaehlt: float, tage_ziel: int) -> float | None:
    """Bisherigen Tagesschnitt auf einen Zeitraum hochrechnen; erst ab einem Tag Daten."""
    if tage_gezaehlt < 1:
        return None
    return summe / tage_gezaehlt * tage_ziel


# Temperaturverhalten eines Containers (Vergleich Ölradiator/Konvektor)
RATE_GEWICHT = 0.3
AUFHEIZ_MIN_H = 0.5   # so lange muss durchgehend geheizt werden, bevor eine Aufheizrate zählt
ABKUEHL_MIN_H = 1.0   # so lange muss durchgehend aus sein, bevor eine Abkühlrate zählt


def rate(t_start: float, t_jetzt: float, stunden: float) -> float | None:
    """Temperaturänderung in °C je Stunde; None, wenn die Zeit zu kurz ist."""
    if stunden <= 0:
        return None
    return (t_jetzt - t_start) / stunden


def mittel(bisher: float | None, neu: float | None, gewicht: float = RATE_GEWICHT) -> float | None:
    """Gleitendes Mittel für Raten."""
    if neu is None:
        return bisher
    return neu if bisher is None else bisher + gewicht * (neu - bisher)


def gradstunden(innen: float | None, aussen: float | None, stunden: float) -> float:
    """Temperaturunterschied innen–außen × Zeit (nur wenn innen wärmer ist)."""
    if innen is None or aussen is None or stunden <= 0:
        return 0.0
    return max(0.0, innen - aussen) * stunden
