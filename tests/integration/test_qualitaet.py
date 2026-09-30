"""Regeln der Qualitätsskala von HA (quality_scale.yaml): Fehlertexte, Umbenennen, verwaiste Geräte, Protokoll, Kategorien."""

from __future__ import annotations

import logging

import pytest

from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr, entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.baustelle import async_remove_config_entry_device
from custom_components.baustelle.const import DOMAIN

from .conftest import C1, HK1, baustelle_anlegen


async def test_ticket_fehlt_mit_uebersetztem_fehler(hass: HomeAssistant, baustelle) -> None:
    """exception-translations: der Dienst meldet ein unbekanntes Ticket mit Übersetzungsschlüssel."""
    with pytest.raises(ServiceValidationError) as fehler:
        await hass.services.async_call(DOMAIN, "ticket", {"ticket": "FE-9999", "status": "angenommen"}, blocking=True)
    assert fehler.value.translation_domain == DOMAIN
    assert fehler.value.translation_key == "ticket_fehlt"
    assert fehler.value.translation_placeholders == {"ticket": "FE-9999"}


async def test_baustelle_umbenennen(hass: HomeAssistant, baustelle) -> None:
    """reconfiguration-flow: Name ändern; ein Name einer anderen Baustelle ist nicht erlaubt."""
    MockConfigEntry(domain=DOMAIN, title="Andere", data={"name": "Andere"}).add_to_hass(hass)
    automatik = er.async_get(hass).async_get_entity_id("switch", DOMAIN, f"{baustelle.entry_id}_automatik")
    assert automatik is not None
    r = await baustelle.start_reconfigure_flow(hass)
    assert r["type"] is FlowResultType.FORM and r["step_id"] == "reconfigure"
    r = await hass.config_entries.flow.async_configure(r["flow_id"], {"name": "Andere"})
    assert r["errors"] == {"base": "name_vergeben"}
    r = await hass.config_entries.flow.async_configure(r["flow_id"], {"name": " B1 Nord "})
    assert r["type"] is FlowResultType.ABORT and r["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()
    assert baustelle.title == "B1 Nord" and baustelle.data["name"] == "B1 Nord"
    assert baustelle.state is ConfigEntryState.LOADED
    # Entitäten behalten ihre ID
    assert er.async_get(hass).async_get_entity_id("switch", DOMAIN, f"{baustelle.entry_id}_automatik") == automatik


async def test_verwaiste_geraete(hass: HomeAssistant, freezer, shellys, nachrichten) -> None:
    """stale-devices: Geräte ohne Bereich/Shelly verschwinden beim Start; nur verwaiste lassen sich in HA löschen."""
    entry = await baustelle_anlegen(hass, freezer)
    registry = dr.async_get(hass)
    alt = registry.async_get_or_create(config_entry_id=entry.entry_id, identifiers={(DOMAIN, "sub_geloescht")}, name="Alt")
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert registry.async_get(alt.id) is None
    geraete = {k: g for g in dr.async_entries_for_config_entry(registry, entry.entry_id) for (_, k) in g.identifiers}
    assert await async_remove_config_entry_device(hass, entry, geraete[C1]) is False
    assert await async_remove_config_entry_device(hass, entry, geraete[entry.entry_id]) is False
    weg = registry.async_get_or_create(config_entry_id=entry.entry_id, identifiers={(DOMAIN, "sub_weg")}, name="Weg")
    assert await async_remove_config_entry_device(hass, entry, weg) is True


async def test_nicht_erreichbar_einmal_im_protokoll(hass: HomeAssistant, baustelle, caplog) -> None:
    """log-when-unavailable: Ausfall eines Shelly einmal melden, Rückkehr einmal."""
    st = baustelle.runtime_data
    caplog.set_level(logging.INFO, logger="custom_components.baustelle")
    hass.states.async_set("switch.hk1", "unavailable")
    await hass.async_block_till_done()
    st.auswerten()
    st.auswerten()
    await hass.async_block_till_done()
    weg = [r for r in caplog.records if "Heizkörper 1 (switch.hk1) ist nicht erreichbar" in r.getMessage()]
    assert len(weg) == 1 and weg[0].levelno == logging.INFO
    hass.states.async_set("switch.hk1", "off")
    await hass.async_block_till_done()
    st.auswerten()
    st.auswerten()
    await hass.async_block_till_done()
    assert sum("Heizkörper 1 (switch.hk1) ist wieder erreichbar" in r.getMessage() for r in caplog.records) == 1
    assert HK1 in st.geraete


async def test_kategorien_und_standardmaessig_aus(hass: HomeAssistant, baustelle) -> None:
    """entity-category / entity-disabled-by-default: Erreichbar ist Diagnose; selten gebrauchte Wetterwerte sind aus."""
    reg = er.async_get(hass)
    eid = baustelle.entry_id

    def eintrag(platform: str, key: str) -> er.RegistryEntry:
        entity_id = reg.async_get_entity_id(platform, DOMAIN, f"{eid}_{key}")
        assert entity_id is not None, key
        e = reg.async_get(entity_id)
        assert e is not None
        return e

    assert eintrag("binary_sensor", "erreichbar").entity_category is EntityCategory.DIAGNOSTIC
    for key in ("tageshoechst", "frueh_prognose", "regen"):
        assert eintrag("sensor", key).disabled_by is er.RegistryEntryDisabler.INTEGRATION
    assert eintrag("sensor", "aussen").disabled_by is None
    assert hass.states.get(eintrag("sensor", "aussen").entity_id) is not None
