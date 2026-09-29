"""Diagnose-Download: Einrichtung, Einstellungen, Zähler, Laufzeit und die Entitäten der Baustelle.

Dient auch als Quelle für den Dashboard-Generator (`tools/dashboard.py`).
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from . import BaustelleConfigEntry
from .const import CONF_EMPFAENGER

GESCHWAERZT = {CONF_EMPFAENGER}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: BaustelleConfigEntry) -> dict[str, Any]:
    st = entry.runtime_data
    registry = er.async_get(hass)
    return {
        "baustelle": {
            "entry_id": entry.entry_id,
            "titel": entry.title,
            "optionen": async_redact_data(dict(entry.options), GESCHWAERZT),
        },
        "bereiche": [asdict(b) for b in st.bereiche.values()],
        "geraete": [asdict(g) for g in st.geraete.values()],
        "entitaeten": {
            e.unique_id: e.entity_id for e in er.async_entries_for_config_entry(registry, entry.entry_id)
        },
        "einstellungen": {k: v for k, v in st.einstellungen.daten.items() if k != "zaehler"},
        "zaehler": {k: v for k, v in st.zaehler.items() if not k.startswith("stand:")},
        "laufzeit": {
            "status": st.daten.status,
            "naechste": st.daten.naechste.isoformat() if st.daten.naechste else None,
            "grund": {k: v.value for k, v in st.daten.grund.items()},
            "probleme": st.daten.probleme,
            "pumpe_laeuft": st.daten.pumpe_laeuft,
            "erreichbar": st.daten.erreichbar,
            "wetter": asdict(st.daten.wetter),
        },
    }
