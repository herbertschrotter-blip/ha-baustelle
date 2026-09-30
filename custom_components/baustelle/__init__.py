"""Baustelle: Heizung in Baustellencontainern und Pumpenüberwachung mit Shellys."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration
from homeassistant.helpers import device_registry as dr, entity_registry as er, issue_registry as ir

from .const import ALTE_PLATTFORMEN, CONF_REGEN_SENSOR, CONF_TEMP_SENSOR, CONF_WETTER, DOMAIN, PLATFORMS
from .einstellungen import Einstellungen
from .entity import HERSTELLER, MODELL
from .panel import async_panel_anmelden
from .steuerung import Steuerung

type BaustelleConfigEntry = ConfigEntry[Steuerung]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Eigene Seite „Baustelle“ anmelden (unabhängig von den einzelnen Baustellen)."""
    version = str((await async_get_integration(hass, DOMAIN)).version)
    await async_panel_anmelden(hass, version)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: BaustelleConfigEntry) -> bool:
    """Baustelle starten."""
    _eigene_quellen_entfernen(hass, entry)
    _alte_entitaeten_entfernen(hass, entry)
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
    """Baustelle entladen (Einstellungen und Zähler vorher sicher speichern).

    Erst anhalten, dann speichern: sonst zählt ein Messwert zwischen Speichern und Anhalten noch mit und plant einen
    verzögerten Schreibvorgang ein, der nach dem Neu-Laden die Datei der neuen Instanz überschreibt.
    """
    entry.runtime_data.async_stop()
    await entry.runtime_data.einstellungen.async_jetzt_speichern()
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry: BaustelleConfigEntry) -> None:
    """Gespeicherte Einstellungen und Reparatur-Hinweise löschen; die Langzeitstatistik bleibt in HA erhalten."""
    await Einstellungen(hass, entry.entry_id).async_entfernen()
    for (domain, issue_id) in list(ir.async_get(hass).issues):
        if domain == DOMAIN and issue_id.startswith(f"fehlt_{entry.entry_id}_"):
            ir.async_delete_issue(hass, DOMAIN, issue_id)


def _eigene_quellen_entfernen(hass: HomeAssistant, entry: BaustelleConfigEntry) -> None:
    """Eigene Sensoren der Integration taugen nicht als Wetterquelle (Kreis): aus den Optionen nehmen."""
    registry = er.async_get(hass)
    optionen = dict(entry.options)
    for key in (CONF_TEMP_SENSOR, CONF_REGEN_SENSOR, CONF_WETTER):
        eintrag = registry.async_get(optionen.get(key) or "")
        if eintrag is not None and eintrag.platform == DOMAIN:
            optionen.pop(key)
    if optionen != dict(entry.options):
        hass.config_entries.async_update_entry(entry, options=optionen)


def _alte_entitaeten_entfernen(hass: HomeAssistant, entry: BaustelleConfigEntry) -> None:
    """Einstellungs-Entitäten aus 0.6 (Zeitplan, Regeln, Modus, Soll, Test-Meldung …) aus der Registry räumen."""
    registry = er.async_get(hass)
    for eintrag in er.async_entries_for_config_entry(registry, entry.entry_id):
        if eintrag.domain in ALTE_PLATTFORMEN or (
            eintrag.domain == "switch" and eintrag.unique_id != f"{entry.entry_id}_automatik"
        ):
            registry.async_remove(eintrag.entity_id)


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
