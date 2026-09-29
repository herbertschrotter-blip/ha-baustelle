"""Aufbau einer Baustelle für die eigene Seite (WebSocket) und den Diagnose-Download."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er


def struktur(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
    """Einrichtung, Entitäten (Schlüssel → entity_id), Einstellungen, Zähler und Laufzeit einer Baustelle."""
    registry = er.async_get(hass)
    daten: dict[str, Any] = {
        "baustelle": {"entry_id": entry.entry_id, "titel": entry.title, "optionen": dict(entry.options),
                      "geladen": hasattr(entry, "runtime_data")},
        "entitaeten": {e.unique_id: e.entity_id for e in er.async_entries_for_config_entry(registry, entry.entry_id)},
    }
    st = getattr(entry, "runtime_data", None)
    if st is None:
        daten.update(bereiche=[], geraete=[], einstellungen={}, zaehler={}, laufzeit={})
        return daten
    daten.update(
        bereiche=[asdict(b) for b in st.bereiche.values()],
        geraete=[asdict(g) for g in st.geraete.values()],
        einstellungen={k: v for k, v in st.einstellungen.daten.items() if k != "zaehler"},
        zaehler={k: v for k, v in st.zaehler.items() if not k.startswith("stand:")},
        laufzeit={
            "status": st.daten.status,
            "naechste": st.daten.naechste.isoformat() if st.daten.naechste else None,
            "grund": {k: v.value for k, v in st.daten.grund.items()},
            "probleme": st.daten.probleme,
            "pumpe_laeuft": st.daten.pumpe_laeuft,
            "erreichbar": st.daten.erreichbar,
            "wetter": asdict(st.daten.wetter),
        },
    )
    return daten
