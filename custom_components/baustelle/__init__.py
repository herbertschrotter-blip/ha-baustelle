"""Baustelle: Heizung in Baustellencontainern und Pumpenüberwachung mit Shellys."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr

from .const import DOMAIN, PLATFORMS
from .einstellungen import Einstellungen
from .entity import HERSTELLER, MODELL
from .steuerung import Steuerung

type BaustelleConfigEntry = ConfigEntry[Steuerung]


async def async_setup_entry(hass: HomeAssistant, entry: BaustelleConfigEntry) -> bool:
    """Baustelle starten."""
    steuerung = Steuerung(hass, entry)
    entry.runtime_data = steuerung
    await steuerung.async_start()
    entry.async_on_unload(steuerung.async_stop)
    _geraete_anlegen(hass, entry, steuerung)
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


def _geraete_anlegen(hass: HomeAssistant, entry: BaustelleConfigEntry, steuerung: Steuerung) -> None:
    """Gerät der Baustelle und je Bereich ein Gerät darunter anlegen (Verknüpfung über via_device_id)."""
    registry = dr.async_get(hass)
    haupt = registry.async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={(DOMAIN, entry.entry_id)},
        name=entry.title, manufacturer=HERSTELLER, model="Baustelle",
    )
    steuerung.geraet_ids[entry.entry_id] = haupt.id
    for bid, info in steuerung.bereiche.items():
        bereich = registry.async_get_or_create(
            config_entry_id=entry.entry_id, config_subentry_id=bid, identifiers={(DOMAIN, bid)},
            name=info.name, manufacturer=HERSTELLER, model=MODELL[info.art], via_device_id=haupt.id,
        )
        steuerung.geraet_ids[bid] = bereich.id


async def _neu_laden(hass: HomeAssistant, entry: BaustelleConfigEntry) -> None:
    hass.config_entries.async_schedule_reload(entry.entry_id)
