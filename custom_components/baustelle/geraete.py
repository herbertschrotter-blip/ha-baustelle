"""WebSocket-Befehl `baustelle/geraet`: Geräte ändern über die eine Stelle `kern/geraete` (BSM-034.02, docs/api-0.7.md
§11, Bauplan Geräte §4). Nur Admins. Lieferung 1: `aktion: status` (aktiv / inaktiv / verliehen / defekt).
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .db import einstellung_merken
from .logik.geraete import STATUS
from .logik.rechte import darf

AKTIONEN = ("status",)


@websocket_api.websocket_command({
    vol.Required("type"): "baustelle/geraet",
    vol.Required("entry_id"): str,
    vol.Required("geraet"): str,
    vol.Required("aktion"): vol.In(AKTIONEN),
    vol.Optional("status"): vol.In(STATUS),
})
@websocket_api.async_response
async def ws_geraet(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if not darf(bool(connection.user and connection.user.is_admin), "geraet"):
        connection.send_error(msg["id"], websocket_api.ERR_UNAUTHORIZED, "Nur Admins dürfen ändern")
        return
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    st = getattr(entry, "runtime_data", None) if entry is not None and entry.domain == DOMAIN else None
    g = st.geraete.get(msg["geraet"]) if st is not None else None
    if st is None or g is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Baustelle oder Gerät nicht gefunden")
        return
    if "status" not in msg:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, "status fehlt")
        return
    geaendert = st.geraet_status_setzen(g, msg["status"])
    if geaendert:
        einstellung_merken(hass, st.entry.entry_id, "geraet.status", {"geraet": g.id, "status": msg["status"]},
                           connection.user.name if connection.user else None, bereich_id=g.bereich, geraet_id=g.id)
    connection.send_result(msg["id"], {"ok": True, "status": st.geraet_status(g), "geaendert": geaendert})


BEFEHLE = (ws_geraet,)
