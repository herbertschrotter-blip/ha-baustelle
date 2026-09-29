"""Baustelle: Heizung in Baustellencontainern und Pumpenüberwachung mit Shellys."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import PLATFORMS
from .einstellungen import Einstellungen
from .steuerung import Steuerung

type BaustelleConfigEntry = ConfigEntry[Steuerung]


async def async_setup_entry(hass: HomeAssistant, entry: BaustelleConfigEntry) -> bool:
    """Baustelle starten."""
    steuerung = Steuerung(hass, entry)
    entry.runtime_data = steuerung
    await steuerung.async_start()
    entry.async_on_unload(steuerung.async_stop)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    # Optionen und Subentries (Bereiche, Geräte) geändert → neu laden (Muster der Kern-Helfer)
    entry.async_on_unload(entry.add_update_listener(_neu_laden))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: BaustelleConfigEntry) -> bool:
    """Baustelle entladen."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry: BaustelleConfigEntry) -> None:
    """Gespeicherte Einstellungen löschen; die Langzeitstatistik bleibt in HA erhalten."""
    await Einstellungen(hass, entry.entry_id).async_entfernen()


async def _neu_laden(hass: HomeAssistant, entry: BaustelleConfigEntry) -> None:
    hass.config_entries.async_schedule_reload(entry.entry_id)
