"""WebSocket-Befehle fürs Container-Inventar (BSM-031.05, docs/api-0.7.md §10, Bauplan Inventar).

`baustelle/inventar` liest (alle Benutzer), `baustelle/inventar_aendern` ändert (nur Admins). Die Daten liegen in der
Datenbank über allen Baustellen; Namen, Labels und Nummern kommen aus `logik/inventar.py`.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .db import DATA_DB
from .db import inventar as db_inventar
from .logik.inventar import CONTAINER_ARTEN, STATUS_AUSRUESTUNG, InventarFehler, aufbereiten, firmenkuerzel_pruefen
from .logik.rechte import darf

AKTIONEN = ("container_anlegen", "container_status", "ausruestung_status", "firma_kuerzel")


def _db(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> Any:
    db = hass.data.get(DATA_DB)
    if db is None or not db.bereit:
        connection.send_error(msg["id"], "nicht_bereit", "Datenbank nicht erreichbar – das Inventar braucht sie")
        return None
    return db


@websocket_api.websocket_command({vol.Required("type"): "baustelle/inventar"})
@websocket_api.async_response
async def ws_inventar(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Das ganze Inventar, aufbereitet (Namen, Labels, aktueller Einsatz, Geschichte, freie Ausrüstung)."""
    if (db := _db(hass, connection, msg)) is None:
        return
    roh = await db.async_ausfuehren(db_inventar.lesen)
    if roh is None:
        connection.send_error(msg["id"], "nicht_bereit", db.fehler or "Datenbank nicht lesbar")
        return
    connection.send_result(msg["id"], {**aufbereiten(roh),
                                       "aendern": bool(connection.user and connection.user.is_admin)})


@websocket_api.websocket_command({
    vol.Required("type"): "baustelle/inventar_aendern",
    vol.Required("aktion"): vol.In(AKTIONEN),
    vol.Optional("entry_id"): str,
    vol.Optional("art"): vol.In(list(CONTAINER_ARTEN)),
    vol.Optional("firma_kuerzel"): vol.Any(None, str),
    vol.Optional("bereich_id"): vol.Any(None, str),
    vol.Optional("container_id"): str,
    vol.Optional("ausruestung_id"): str,
    vol.Optional("firma_id"): str,
    vol.Optional("kuerzel"): str,
    vol.Optional("status"): vol.In(["aktiv", "ausgeschieden", *STATUS_AUSRUESTUNG]),
})
@websocket_api.async_response
async def ws_inventar_aendern(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Container anlegen (eigen oder fremd, optional mit Bereich), Status setzen, Firmenkürzel – nur Admins."""
    if not darf(bool(connection.user and connection.user.is_admin), "inventar_aendern"):
        connection.send_error(msg["id"], websocket_api.ERR_UNAUTHORIZED, "Nur Admins dürfen ändern")
        return
    if (db := _db(hass, connection, msg)) is None:
        return
    aktion, jetzt = msg["aktion"], dt_util.utcnow()
    try:   # Eingaben vorher prüfen – ein Fehler in der Transaktion würde den Zustand der Datenbank auf „fehler“ setzen
        for feld in ("firma_kuerzel", "kuerzel"):
            if msg.get(feld):
                msg[feld] = firmenkuerzel_pruefen(msg[feld])
        if aktion == "container_status" and msg.get("status") not in ("aktiv", "ausgeschieden"):
            raise InventarFehler("Container: Status aktiv oder ausgeschieden")
        if aktion == "ausruestung_status" and msg.get("status") not in STATUS_AUSRUESTUNG:
            raise InventarFehler("Ausrüstung: Status aktiv, verliehen oder defekt")
    except InventarFehler as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return

    def fehlt(*felder: str) -> bool:
        if all(msg.get(f) for f in felder):
            return False
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, f"{aktion} braucht {', '.join(felder)}")
        return True

    if aktion == "container_anlegen":
        if fehlt("entry_id", "art"):
            return
        entry = hass.config_entries.async_get_entry(msg["entry_id"])
        if entry is None or entry.domain != DOMAIN:
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Baustelle nicht gefunden")
            return

        def arbeit(v: Any) -> Any:
            return db_inventar.container_anlegen(v, art=msg["art"], baustelle_id=msg["entry_id"], instanz_id=db.instanz_id,
                                                 jetzt=jetzt, firma_kuerzel=msg.get("firma_kuerzel"),
                                                 bereich_id=msg.get("bereich_id"))
    elif aktion == "container_status":
        if fehlt("container_id", "status"):
            return

        def arbeit(v: Any) -> Any:
            return db_inventar.container_status(v, msg["container_id"], msg["status"], jetzt)
    elif aktion == "ausruestung_status":
        if fehlt("ausruestung_id", "status"):
            return

        def arbeit(v: Any) -> Any:
            return db_inventar.ausruestung_status(v, msg["ausruestung_id"], msg["status"])
    else:   # firma_kuerzel
        if fehlt("entry_id", "firma_id", "kuerzel"):
            return

        def arbeit(v: Any) -> Any:
            return db_inventar.firma_kuerzel(v, msg["entry_id"], msg["firma_id"], msg["kuerzel"])

    ergebnis = await db.async_ausfuehren(arbeit)
    if ergebnis is None or ergebnis is False:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, db.fehler or "nicht gefunden")
        return
    connection.send_result(msg["id"], ergebnis if isinstance(ergebnis, dict) else {"ok": True})


BEFEHLE = (ws_inventar, ws_inventar_aendern)
