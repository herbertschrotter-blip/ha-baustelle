"""Minutenwerte aus Zustandsfolgen (docs/bauplan-datenbank.md §3.2, BSM-007) – ohne HA-Code.

Je Gerät und Minute: Sekunden eingeschaltet, mittlere und höchste Leistung (zeitgewichtet), Energiezuwachs aus dem
Zählerstand (Regeln aus `logik/zaehlen`, auch nach einer Lücke) bzw. ohne Zähler aus der Leistung, letzter Zählerstand
und ob das Gerät die ganze Minute erreichbar war. Je Container: mittlere Temperatur und Sekunden mit offener Tür.

Ein Sammler bekommt jede Änderung mit Zeitpunkt; `abschliessen(ende)` liefert die Werte seit dem letzten Abschluss
und beginnt den nächsten Abschnitt mit den aktuellen Werten.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .zaehlen import energie_zuwachs


class Zeitmittel:
    """Zeitgewichtetes Mittel und Höchstwert eines Messwerts (None = unbekannt, zählt nicht)."""

    def __init__(self, t: datetime, wert: float | None) -> None:
        self._t, self._wert = t, wert
        self._summe = self._bekannt = 0.0
        self._max = wert

    def setzen(self, t: datetime, wert: float | None) -> None:
        self._bis(t)
        self._wert = wert
        if wert is not None and (self._max is None or wert > self._max):
            self._max = wert

    def _bis(self, t: datetime) -> None:
        dauer = (t - self._t).total_seconds()
        if dauer > 0:
            if self._wert is not None:
                self._summe += self._wert * dauer
                self._bekannt += dauer
            self._t = t

    def abschliessen(self, ende: datetime) -> tuple[float | None, float | None, float]:
        """(Mittel, Höchstwert, Wert·Sekunden) seit dem letzten Abschluss."""
        self._bis(ende)
        mittel = self._summe / self._bekannt if self._bekannt > 0 else None
        ergebnis = (mittel, self._max if self._bekannt > 0 else None, self._summe)
        self._summe = self._bekannt = 0.0
        self._max = self._wert
        return ergebnis


class Zeitanteil:
    """Sekunden, in denen ein Zustand wahr war (None = unbekannt)."""

    def __init__(self, t: datetime, wert: bool | None) -> None:
        self._t, self._wert = t, wert
        self._wahr = 0.0
        self._unbekannt = wert is None

    def setzen(self, t: datetime, wert: bool | None) -> None:
        self._bis(t)
        self._wert = wert
        if wert is None:
            self._unbekannt = True

    def _bis(self, t: datetime) -> None:
        dauer = (t - self._t).total_seconds()
        if dauer > 0:
            if self._wert:
                self._wahr += dauer
            self._t = t

    def abschliessen(self, ende: datetime) -> tuple[float, bool]:
        """(Sekunden wahr, irgendwann unbekannt) seit dem letzten Abschluss."""
        self._bis(ende)
        ergebnis = (self._wahr, self._unbekannt)
        self._wahr = 0.0
        self._unbekannt = self._wert is None
        return ergebnis


@dataclass(frozen=True)
class GeraetMinute:
    dauer_s: int
    sekunden_ein: int
    leistung_w: float | None
    leistung_w_max: float | None
    energie_wh: float | None
    zaehlerstand_kwh: float | None
    erreichbar: bool


class GeraetSammler:
    """Schalter, Leistung und Energiezähler eines Shelly."""

    def __init__(self, t: datetime, an: bool | None, leistung: float | None, stand: float | None, *, mit_zaehler: bool) -> None:
        self._start = t
        self._an = Zeitanteil(t, an)
        self._leistung = Zeitmittel(t, leistung)
        self._mit_zaehler = mit_zaehler
        self._stand = stand
        self._stand_alt, self._stand_alt_zeit = stand, (t if stand is not None else None)

    def schalter(self, t: datetime, an: bool | None) -> None:
        self._an.setzen(t, an)

    def leistung(self, t: datetime, watt: float | None) -> None:
        self._leistung.setzen(t, watt)

    def zaehler(self, _t: datetime, kwh: float | None) -> None:
        if kwh is not None:
            self._stand = kwh

    def abschliessen(self, ende: datetime) -> GeraetMinute:
        ein, unbekannt = self._an.abschliessen(ende)
        mittel, hoechst, wattsekunden = self._leistung.abschliessen(ende)
        energie: float | None
        if self._mit_zaehler:
            if self._stand is None or self._stand_alt is None or self._stand_alt_zeit is None:
                energie = None
            else:   # Zuwachs seit dem letzten bekannten Stand – nach einer Lücke mit der Grenze je Stunde der Lücke
                stunden = (ende - self._stand_alt_zeit).total_seconds() / 3600
                energie = energie_zuwachs(self._stand_alt, self._stand, stunden) * 1000
            if self._stand is not None and self._stand != self._stand_alt:
                self._stand_alt, self._stand_alt_zeit = self._stand, ende
            elif self._stand is not None and self._stand_alt_zeit is None:
                self._stand_alt, self._stand_alt_zeit = self._stand, ende
        else:
            energie = wattsekunden / 3600 if mittel is not None else None
        dauer = int(round((ende - self._start).total_seconds()))
        self._start = ende
        return GeraetMinute(dauer, int(round(ein)), None if mittel is None else round(mittel, 1),
                            hoechst, None if energie is None else round(energie, 3), self._stand, not unbekannt)


@dataclass(frozen=True)
class BereichMinute:
    dauer_s: int
    temperatur: float | None
    tuer_offen_s: int | None


class BereichSammler:
    """Temperatur und Tür eines Containers."""

    def __init__(self, t: datetime, temperatur: float | None, tuer_offen: bool | None, *, mit_tuer: bool) -> None:
        self._start = t
        self._temp = Zeitmittel(t, temperatur)
        self._tuer = Zeitanteil(t, tuer_offen)
        self._mit_tuer = mit_tuer

    def temperatur(self, t: datetime, wert: float | None) -> None:
        self._temp.setzen(t, wert)

    def tuer(self, t: datetime, offen: bool | None) -> None:
        self._tuer.setzen(t, offen)

    def abschliessen(self, ende: datetime) -> BereichMinute:
        mittel, _hoechst, _summe = self._temp.abschliessen(ende)
        offen, _unbekannt = self._tuer.abschliessen(ende)
        dauer = int(round((ende - self._start).total_seconds()))
        self._start = ende
        return BereichMinute(dauer, None if mittel is None else round(mittel, 2), int(round(offen)) if self._mit_tuer else None)
