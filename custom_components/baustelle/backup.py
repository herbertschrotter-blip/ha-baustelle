"""HA-Sicherung: vorher die eigene Datenbank abschließen, danach weiter schreiben (docs/bauplan-datenbank.md §3.7)."""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from .db import DATA_DB


async def async_pre_backup(hass: HomeAssistant) -> None:
    """Warteschlange schreiben, WAL in die Datei, Schreiben anhalten – die Sicherung kopiert eine stimmige Datei."""
    if (db := hass.data.get(DATA_DB)) is not None:
        await db.async_anhalten()


async def async_post_backup(hass: HomeAssistant) -> None:
    """Schreiben wieder freigeben; was in der Zwischenzeit anfiel, wird jetzt geschrieben."""
    if (db := hass.data.get(DATA_DB)) is not None:
        await db.async_fortsetzen()
