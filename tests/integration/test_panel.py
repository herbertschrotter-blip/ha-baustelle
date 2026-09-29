"""Eigene Seite: Anmeldung in der Seitenleiste, JavaScript ausgeliefert, WebSocket-Befehl liefert den Aufbau."""

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.baustelle.const import DOMAIN

from .test_steuerung import C1, HK1, baustelle  # noqa: F401  (Fixture)


async def test_panel_und_websocket(hass: HomeAssistant, baustelle, hass_ws_client, hass_client) -> None:
    assert await async_setup_component(hass, "frontend", {})
    panels = hass.data["frontend_panels"]
    assert "baustelle" in panels
    assert panels["baustelle"].sidebar_title == "Baustelle"

    client = await hass_client()
    antwort = await client.get(f"/baustelle_static/baustelle-panel.js")
    assert antwort.status == 200
    assert "baustelle-panel" in await antwort.text()

    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "baustelle/struktur"})
    msg = await ws.receive_json()
    assert msg["success"]
    b = msg["result"][0]
    assert b["baustelle"]["titel"] == "B1"
    assert b["baustelle"]["optionen"]["empfaenger"] == ["mobile_app_test"]
    assert {x["id"] for x in b["bereiche"]} >= {C1}
    assert b["entitaeten"][f"{HK1}_problem"].startswith("binary_sensor.")
    assert b["laufzeit"]["status"] == "automatik_aus"


async def test_dialoge_wie_die_seite(hass: HomeAssistant, baustelle, hass_client) -> None:
    """Die Seite legt über dieselben REST-Dialoge an wie HA selbst – mit genau diesen Daten."""
    assert await async_setup_component(hass, "config", {})
    client = await hass_client()
    entry_id = baustelle.entry_id

    async def dialog(pfad, start, daten):
        r = await client.post(f"/api/{pfad}", json=start)
        assert r.status == 200, await r.text()
        form = await r.json()
        r = await client.post(f"/api/{pfad}/{form['flow_id']}", json=daten)
        assert r.status == 200, await r.text()
        return await r.json()

    # Container anlegen
    r = await dialog("config/config_entries/subentries/flow", {"handler": [entry_id, "bereich"]}, {"name": "Container Neu", "art": "container"})
    assert r["type"] == "create_entry"
    await hass.async_block_till_done()
    neu = next(s for s in baustelle.subentries.values() if s.title == "Container Neu")
    # Shelly zuordnen
    hass.states.async_set("switch.neu", "off")
    r = await dialog("config/config_entries/subentries/flow", {"handler": [entry_id, "geraet"]},
                     {"bereich": neu.subentry_id, "schalter": "switch.neu", "name": "Heizkörper Neu", "rolle": "heizkoerper", "typ": "oelradiator"})
    assert r["type"] == "create_entry"
    await hass.async_block_till_done()
    # Container ändern (Fühler setzen)
    r = await dialog("config/config_entries/subentries/flow", {"handler": [entry_id, "bereich"], "subentry_id": neu.subentry_id},
                     {"name": "Container Neu", "art": "container", "fuehler": "sensor.temp_c1"})
    assert r["type"] == "abort" and r["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()
    # Optionen: alle bisherigen plus Änderung (so schickt es die Seite)
    optionen = {**baustelle.options, "wetter": "weather.baustelle"}
    hass.states.async_set("weather.baustelle", "sunny", {"temperature": 5})
    r = await dialog("config/config_entries/options/flow", {"handler": entry_id}, optionen)
    assert r["type"] == "create_entry"
    await hass.async_block_till_done()
    assert baustelle.options["wetter"] == "weather.baustelle"
    assert baustelle.options["empfaenger"] == ["mobile_app_test"]
    # Neue Baustelle
    r = await dialog("config/config_entries/flow", {"handler": "baustelle", "show_advanced_options": False},
                     {"name": "Zweite", "beginn": "2026-10-01", "heizung": True, "pumpen": False})
    assert r["type"] == "create_entry"
    assert r["result"]["entry_id"]
    if r.get("next_flow"):
        weg = await client.delete(f"/api/config/config_entries/subentries/flow/{r['next_flow'][1]}")
        assert weg.status == 200
    await hass.async_block_till_done()
