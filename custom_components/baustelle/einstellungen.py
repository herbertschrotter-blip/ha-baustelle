"""Einstellungen, die im Betrieb oft geändert werden (Zeitplan, Regeln, Modi).

Sie liegen je Baustelle in einem `Store` (JSON unter `.storage/`, in der Sicherung enthalten)
und werden im Dashboard als Einstellungs-Entitäten bedient.
"""

from __future__ import annotations

import copy
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, WOCHENTAGE
from .logik.heizung import Modus

STORE_VERSION = 1
SPEICHER_VERZOEGERUNG_S = 2

STANDARD: dict[str, Any] = {
    "automatik": False,
    "plan": {
        tag: {
            "ein": "06:00" if tag not in ("sa", "so") else "07:00",
            "aus": "13:00" if tag == "fr" else ("12:00" if tag in ("sa", "so") else "16:30"),
            "aktiv": tag not in ("sa", "so"),
        }
        for tag in WOCHENTAGE
    },
    "regeln": {
        "kaelte_schwelle": 3.0,
        "kaelte_frueher_min": 30,
        "trocknen_ab_mm": 2.0,
        "trocknen_laenger_min": 60,
        "trocknen_frueher_min": 30,
        "heizgrenze_aktiv": True,
        "heizgrenze": 15.0,
        "heizgrenze_basis": "jetzt",
        "frost_aktiv": True,
        "frost_ein": 5.0,
        "frost_aus": 8.0,
        "urlaub_modus": "frost",
        "absenk_temp": 10.0,
    },
    "pumpen": {"offline_min": 5.0, "trocken_unter_w": 300.0, "dauerlauf_h": 4.0},
    "preis": 0.28,
    "bereiche": {},
    # Zähler (Stufe 4): Energie, Kosten, Zeiten, Zyklen, Mittel; „stand:<gerät>“ = letzter Zählerstand des Shelly
    "zaehler": {},
}

STANDARD_BEREICH: dict[str, Any] = {"modus": Modus.ZEITPLAN.value, "soll": 18.0, "trocknen": False}


def _ergaenzen(ziel: dict[str, Any], vorlage: dict[str, Any]) -> dict[str, Any]:
    """Fehlende Schlüssel aus der Vorlage übernehmen (neue Einstellungen nach Updates)."""
    for schluessel, wert in vorlage.items():
        if schluessel not in ziel:
            ziel[schluessel] = copy.deepcopy(wert)
        elif isinstance(wert, dict) and isinstance(ziel[schluessel], dict):
            _ergaenzen(ziel[schluessel], wert)
    return ziel


class Einstellungen:
    """Gespeicherte Einstellungen einer Baustelle."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, f"{DOMAIN}.{entry_id}")
        self.daten: dict[str, Any] = copy.deepcopy(STANDARD)

    async def async_laden(self, bereich_ids: list[str]) -> None:
        """Laden, fehlende Werte ergänzen, Einstellungen gelöschter Bereiche entfernen."""
        gespeichert = await self._store.async_load()
        self.daten = _ergaenzen(gespeichert or {}, STANDARD)
        bereiche = self.daten["bereiche"]
        for bid in list(bereiche):
            if bid not in bereich_ids:
                del bereiche[bid]
        for bid in bereich_ids:
            _ergaenzen(bereiche.setdefault(bid, {}), STANDARD_BEREICH)

    def speichern(self, verzoegerung: float = SPEICHER_VERZOEGERUNG_S) -> None:
        """Verzögert speichern (mehrere Änderungen hintereinander → ein Schreibvorgang)."""
        self._store.async_delay_save(lambda: self.daten, verzoegerung)

    async def async_entfernen(self) -> None:
        """Datei beim Löschen der Baustelle entfernen."""
        await self._store.async_remove()

    def bereich(self, bereich_id: str) -> dict[str, Any]:
        """Einstellungen eines Bereichs."""
        return self.daten["bereiche"].setdefault(bereich_id, copy.deepcopy(STANDARD_BEREICH))
