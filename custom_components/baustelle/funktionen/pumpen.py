"""Funktion Pumpen: Grundwasserpumpen in Pumpenschächten überwachen (Bauplan 0.7, Bauplan Module §3).

Pumpen werden nie geschaltet (kein Handbetrieb), nur gemessen: läuft (`logik/pumpen.laeuft`), Zyklen (Starts je Stunde und Zähler),
Pumpzeit, Anzeige des Schachts und die Zustände für die Pumpen-Warnungen (Trockenlauf, Dauerlauf, Zyklen).
"""

from __future__ import annotations

from collections import deque
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from ..const import ART_PUMPENSCHACHT, CONF_PUMPEN, ROLLE_PUMPE
from ..logik import warnungen as warn_logik
from ..logik.pumpen import PumpenZustand, laeuft
from .basis import Funktion

if TYPE_CHECKING:
    from ..steuerung import BereichInfo, GeraetInfo, Steuerung
    from .basis import SollJeBereich


class Pumpen(Funktion):
    """Pumpen in Pumpenschächten."""

    name = "pumpen"
    option = CONF_PUMPEN
    standard = False
    arten = (ART_PUMPENSCHACHT,)
    rollen = (ROLLE_PUMPE,)
    staffel_feld = "pumpe_kw"

    def __init__(self, st: Steuerung) -> None:
        super().__init__(st)
        self.pumpe_laeuft: dict[str, bool] = {}  # Pumpe → läuft (Binärsensor „Pumpe läuft“, Struktur `pumpe_laeuft`)
        self._laeuft_seit: dict[str, datetime] = {}
        self._starts: dict[str, deque[datetime]] = {}

    def geraet_warnung(
        self, g: GeraetInfo, erreichbar: bool, leistung: float | None, jetzt: datetime
    ) -> tuple[warn_logik.Typ, datetime | None, int]:
        """Läuft die Pumpe? Neuer Lauf = ein Zyklus (Zähler und Starts der letzten Stunde)."""
        st = self.st
        z = PumpenZustand(erreichbar=erreichbar, leistung=leistung)
        laeuft_jetzt = laeuft(z, st.warn_einstellungen().pumpen_regeln())
        if laeuft_jetzt:
            if g.id not in self._laeuft_seit:
                self._laeuft_seit[g.id] = jetzt
                if self.pumpe_laeuft.get(g.id) is False and st.aktiv:
                    st.zaehler_plus(f"zyklen:{g.id}", 1)
                    self._starts.setdefault(g.id, deque()).append(jetzt)
        else:
            self._laeuft_seit.pop(g.id, None)
        self.pumpe_laeuft[g.id] = laeuft_jetzt
        starts = self._starts.get(g.id, deque())
        while starts and (jetzt - starts[0]) > timedelta(hours=1):
            starts.popleft()
        return warn_logik.Typ.PUMPE, self._laeuft_seit.get(g.id), len(starts)

    def anzeige(
        self, bid: str, info: BereichInfo, jetzt: datetime, soll: SollJeBereich, offline: bool, an: bool
    ) -> tuple[str, str, str]:
        laeuft_jetzt = any(self.pumpe_laeuft.get(g.id) for g in self.st.geraete_in(bid))
        zustand = "offline" if offline else ("laeuft" if laeuft_jetzt else "aus")
        return zustand, {"offline": "nicht erreichbar", "laeuft": "Pumpe läuft", "aus": "Pumpe aus"}[zustand], zustand

    def zaehlen_geraet(self, g: GeraetInfo, an: bool, leistung: float | None, stunden: float) -> bool:
        if self.pumpe_laeuft.get(g.id):
            self.st.zaehler_plus(f"pumpzeit:{g.id}", stunden)
        return False

    def status(self, jetzt: datetime) -> tuple[str, str, datetime | None] | None:
        return "nur_pumpen", "", None
