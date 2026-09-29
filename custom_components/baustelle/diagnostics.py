"""Diagnose-Download: Einrichtung, Einstellungen, Zähler, Laufzeit und die Entitäten der Baustelle.

Dient auch als Quelle für den Dashboard-Generator (`tools/dashboard.py`).
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from . import BaustelleConfigEntry
from .const import CONF_EMPFAENGER
from .daten import struktur

GESCHWAERZT = {CONF_EMPFAENGER}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: BaustelleConfigEntry) -> dict[str, Any]:
    daten = struktur(hass, entry)
    daten["baustelle"]["optionen"] = async_redact_data(daten["baustelle"]["optionen"], GESCHWAERZT)
    return daten
