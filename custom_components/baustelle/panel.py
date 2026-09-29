"""Eigene Seite „Baustelle“ in der Seitenleiste (wie Alarmo/HACS) und der WebSocket-Befehl dafür."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .daten import struktur

URL_PANEL = "baustelle"
URL_STATISCH = "/baustelle_static"
WEBCOMPONENT = "baustelle-panel"


async def async_panel_anmelden(hass: HomeAssistant, version: str) -> None:
    """JavaScript ausliefern und Seite in der Seitenleiste anmelden (einmal je HA-Start)."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(URL_STATISCH, str(Path(__file__).parent / "frontend"), cache_headers=False)]
    )
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=URL_PANEL,
        webcomponent_name=WEBCOMPONENT,
        sidebar_title="Baustelle",
        sidebar_icon="mdi:crane",
        module_url=f"{URL_STATISCH}/baustelle-panel.js?v={version}",
        require_admin=False,
        config={"version": version},
    )
    websocket_api.async_register_command(hass, ws_struktur)


@websocket_api.websocket_command({vol.Required("type"): "baustelle/struktur"})
@callback
def ws_struktur(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Alle Baustellen (auch abgeschlossene) mit Bereichen, Geräten, Entitäten, Zählern und Laufzeit."""
    connection.send_result(
        msg["id"], [struktur(hass, entry) for entry in hass.config_entries.async_entries(DOMAIN)]
    )
