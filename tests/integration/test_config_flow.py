"""Einrichtung: Baustelle anlegen, Bereiche und Shellys zuordnen, Optionen."""

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.baustelle.const import DOMAIN, SUB_BEREICH, SUB_GERAET


async def test_baustelle_anlegen_und_ersten_container(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"name": "Wohnanlage Nord", "beginn": "2026-09-01", "heizung": True, "pumpen": False}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = result["result"]
    assert entry.title == "Wohnanlage Nord"
    assert entry.options["status"] == "aktiv"
    # direkt danach: ersten Container anlegen
    assert result["next_flow"][0] == "config_subentries_flow"
    await hass.async_block_till_done()


async def test_keine_funktion_gewaehlt(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"name": "X", "beginn": "2026-09-01", "heizung": False, "pumpen": False}
    )
    assert result["errors"] == {"base": "keine_funktion"}


def _entry(hass: HomeAssistant, status: str = "aktiv", title: str = "B1") -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN, title=title, data={"name": title},
        options={"heizung": True, "pumpen": True, "status": status, "beginn": "2026-09-01",
                 "heizperiode_von": "10", "heizperiode_bis": "4", "empfaenger": []},
    )
    entry.add_to_hass(hass)
    return entry


async def _bereich(hass, entry, name="Container 1", art="container"):
    r = await hass.config_entries.subentries.async_init((entry.entry_id, SUB_BEREICH), context={"source": "user"})
    r = await hass.config_entries.subentries.async_configure(r["flow_id"], {"name": name, "art": art})
    assert r["type"] is FlowResultType.CREATE_ENTRY
    return next(s for s in entry.subentries.values() if s.title == name)


async def test_shelly_zuordnen_und_pruefungen(hass: HomeAssistant) -> None:
    entry = _entry(hass)
    # ohne Bereich: abbrechen
    r = await hass.config_entries.subentries.async_init((entry.entry_id, SUB_GERAET), context={"source": "user"})
    assert r["type"] is FlowResultType.ABORT and r["reason"] == "kein_bereich"

    container = await _bereich(hass, entry)
    schacht = await _bereich(hass, entry, "Schacht", "pumpenschacht")
    daten = {"bereich": container.subentry_id, "schalter": "switch.plug_1", "name": "Heizkörper 1",
             "rolle": "heizkoerper", "typ": "oelradiator"}
    r = await hass.config_entries.subentries.async_init((entry.entry_id, SUB_GERAET), context={"source": "user"})
    r = await hass.config_entries.subentries.async_configure(r["flow_id"], daten)
    assert r["type"] is FlowResultType.CREATE_ENTRY

    # derselbe Shelly nochmal → Fehler
    r = await hass.config_entries.subentries.async_init((entry.entry_id, SUB_GERAET), context={"source": "user"})
    r = await hass.config_entries.subentries.async_configure(r["flow_id"], {**daten, "name": "Doppelt"})
    assert r["errors"] == {"base": "schalter_vergeben"}

    # Pumpe im Container → Fehler
    r = await hass.config_entries.subentries.async_init((entry.entry_id, SUB_GERAET), context={"source": "user"})
    r = await hass.config_entries.subentries.async_configure(
        r["flow_id"], {**daten, "schalter": "switch.plug_2", "rolle": "pumpe"}
    )
    assert r["errors"] == {"base": "rolle_passt_nicht"}
    r = await hass.config_entries.subentries.async_configure(
        r["flow_id"], {**daten, "schalter": "switch.plug_2", "rolle": "pumpe", "bereich": schacht.subentry_id, "name": "Pumpe 1"}
    )
    assert r["type"] is FlowResultType.CREATE_ENTRY


async def test_shelly_einer_anderen_aktiven_baustelle(hass: HomeAssistant) -> None:
    alt = _entry(hass, title="Alt")
    c = await _bereich(hass, alt)
    r = await hass.config_entries.subentries.async_init((alt.entry_id, SUB_GERAET), context={"source": "user"})
    await hass.config_entries.subentries.async_configure(
        r["flow_id"], {"bereich": c.subentry_id, "schalter": "switch.plug_1", "name": "HK", "rolle": "heizkoerper", "typ": "konvektor"}
    )
    neu = _entry(hass, title="Neu")
    c2 = await _bereich(hass, neu)
    daten = {"bereich": c2.subentry_id, "schalter": "switch.plug_1", "name": "HK", "rolle": "heizkoerper", "typ": "konvektor"}
    r = await hass.config_entries.subentries.async_init((neu.entry_id, SUB_GERAET), context={"source": "user"})
    r = await hass.config_entries.subentries.async_configure(r["flow_id"], daten)
    assert r["errors"] == {"base": "schalter_andere_baustelle"}

    # alte Baustelle abschließen → Shelly frei
    hass.config_entries.async_update_entry(alt, options={**alt.options, "status": "abgeschlossen"})
    r = await hass.config_entries.subentries.async_configure(r["flow_id"], daten)
    assert r["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()


async def test_optionen_abschliessen_setzt_ende(hass: HomeAssistant) -> None:
    entry = _entry(hass)
    r = await hass.config_entries.options.async_init(entry.entry_id)
    assert r["type"] is FlowResultType.FORM
    r = await hass.config_entries.options.async_configure(
        r["flow_id"],
        {"status": "abgeschlossen", "beginn": "2026-09-01", "heizung": True, "pumpen": True,
         "heizperiode_von": "10", "heizperiode_bis": "4"},
    )
    assert r["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["status"] == "abgeschlossen"
    assert entry.options["ende"]
    await hass.async_block_till_done()
