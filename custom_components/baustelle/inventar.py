"""WebSocket-Befehle fürs Container-Inventar (BSM-031.05, docs/api-0.7.md §10, Bauplan Inventar).

`baustelle/inventar` liest (alle Benutzer), `baustelle/inventar_aendern` ändert (nur Admins). Die Daten liegen in der
Datenbank über allen Baustellen; Namen, Labels und Nummern kommen aus `logik/inventar.py`.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er, label_registry as lr
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .db import DATA_DB
from .db import inventar as db_inventar
from .logik.inventar import (
    CONTAINER_ARTEN, STATUS_AUSRUESTUNG, InventarFehler, aufbereiten, firmenkuerzel_pruefen, praefix, vorschau,
)
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


def _geraet(hass: HomeAssistant, entity_id: str | None) -> tuple[dict[str, Any] | None, list[dict[str, Any]], list[str]]:
    """HA-Gerät hinter einer Entität: ({id, name}, Entitäten des Geräts mit Klasse, Label-Namen)."""
    ents, devs, labs = er.async_get(hass), dr.async_get(hass), lr.async_get(hass)
    eintrag = ents.async_get(entity_id or "")
    geraet = devs.async_get(eintrag.device_id) if eintrag is not None and eintrag.device_id else None
    if geraet is None:
        return None, [], []
    entitaeten = [{"entity_id": e.entity_id, "name": e.name or e.original_name,
                   "klasse": e.device_class or e.original_device_class}
                  for e in er.async_entries_for_device(ents, geraet.id) if e.disabled_by is None]
    namen = [lab.name for i in geraet.labels if (lab := labs.async_get_label(i)) is not None]
    return {"id": geraet.id, "name": geraet.name_by_user or geraet.name, "original": geraet.name}, entitaeten, namen


def vorschau_eingabe(hass: HomeAssistant, roh: dict[str, Any], container_id: str) -> dict[str, Any] | None:
    """Ist-Zustand eines Containers aus HA für `logik.inventar.vorschau` (liest nur)."""
    c = next((x for x in roh["container"] if x["id"] == container_id), None)
    einsatz = next((e for e in roh["einsaetze"] if e["container_id"] == container_id and not e.get("bis")), None)
    if c is None or einsatz is None or not einsatz.get("bereich_id"):
        return None
    entry = hass.config_entries.async_get_entry(einsatz["baustelle_id"])
    st = getattr(entry, "runtime_data", None)
    if st is None or einsatz["bereich_id"] not in st.bereiche:
        return None
    bid = einsatz["bereich_id"]
    gg_vorher = {e["geraet_id"]: e["gg"] for e in roh["ausruestung_einsaetze"]
                 if e["container_id"] == container_id and not e.get("bis") and e.get("geraet_id") and e.get("gg")}
    geraete = sorted(st.geraete_in(bid), key=lambda g: (gg_vorher.get(g.id) is None, gg_vorher.get(g.id) or 0, g.name))
    plugs, naechstes = [], max(gg_vorher.values(), default=0)
    for g in geraete:
        if (gg := gg_vorher.get(g.id)) is None:
            naechstes += 1
            gg = naechstes
        geraet, entitaeten, namen = _geraet(hass, g.schalter)
        schalter = next((e for e in entitaeten if e["entity_id"] == g.schalter), None) or {"entity_id": g.schalter, "name": None}
        plugs.append({"gg": gg, "geraet_id": g.id, "name": g.name, "rolle": g.rolle, "typ": g.typ, "geraet": geraet,
                      "schalter": schalter, "entitaeten": [e for e in entitaeten if e["entity_id"] != g.schalter],
                      "plug_name": geraet["original"] if geraet else None, "labels": namen})
    sensoren = []
    for typ, entity_id in (("TEMP", st.bereiche[bid].fuehler), ("DOOR", st.einstellungen.bereich(bid).get("tuer"))):
        if entity_id:
            geraet, entitaeten, namen = _geraet(hass, entity_id)
            sensoren.append({"typ": typ, "geraet": geraet, "entitaeten": entitaeten, "labels": namen})
    firma = next((f["name"] for f in roh["firmen"] if c.get("firma_kuerzel") and f.get("kuerzel") == c["firma_kuerzel"]), None)
    return {"art": c["art"], "firma": firma, "plugs": plugs, "sensoren": sensoren,
            "praefix": praefix(nr=c.get("nr"), firma=c.get("firma_kuerzel"), fremd_nr=c.get("fremd_nr"))}


@websocket_api.websocket_command({vol.Required("type"): "baustelle/inventar_vorschau", vol.Required("container_id"): str})
@websocket_api.async_response
async def ws_inventar_vorschau(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Vorschau alt → neu für einen Container (BSM-031.06a) – ändert nichts."""
    if (db := _db(hass, connection, msg)) is None:
        return
    roh = await db.async_ausfuehren(db_inventar.lesen)
    eingabe = vorschau_eingabe(hass, roh, msg["container_id"]) if roh is not None else None
    if eingabe is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Container ohne Bereich auf einer geladenen Baustelle")
        return
    belegt = set(er.async_get(hass).entities) | set(hass.states.async_entity_ids())
    connection.send_result(msg["id"], {**vorschau(eingabe, belegt),
                                       "hinweis": "BTHome-Namen an den Plugs zieht die Kopplungspflege nach"})


BEFEHLE = (ws_inventar, ws_inventar_aendern, ws_inventar_vorschau)
