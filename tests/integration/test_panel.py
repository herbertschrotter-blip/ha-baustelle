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
