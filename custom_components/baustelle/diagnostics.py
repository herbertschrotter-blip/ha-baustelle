"""Diagnose-Download: Einrichtung, Einstellungen, Zähler, Laufzeit und die Entitäten der Baustelle."""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from . import BaustelleConfigEntry
from .const import CONF_EMPFAENGER
from .daten import struktur
from .db import DATA_DB

GESCHWAERZT = {CONF_EMPFAENGER}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: BaustelleConfigEntry) -> dict[str, Any]:
    daten = struktur(hass, entry)
    daten["baustelle"]["optionen"] = async_redact_data(daten["baustelle"]["optionen"], GESCHWAERZT)
    daten["einstellungen"] = async_redact_data(daten["einstellungen"], {*GESCHWAERZT, "mail_an"})
    daten["datenbank"] = db.info() if (db := hass.data.get(DATA_DB)) is not None else None
    return daten
