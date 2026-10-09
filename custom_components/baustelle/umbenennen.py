"""Umbenennen nach dem Schema in HA ausführen (BSM-031.06b, docs/bauplan-inventar.md §6).

`baustelle/inventar_umbenennen` (nur Admins) bildet die Vorschau neu (nie die der Seite übernehmen), lehnt bei
Konflikten ab und führt in fester Reihenfolge aus: Entitätsregister (Name und Entity-ID), HA-Gerät (`name_by_user`),
Labels (nur eigene entfernen), dann die eigenen Verweise der Integration (Unter-Einträge, Optionen, Einstellungen des
Bereichs wie Tür und Symbol). Währenddessen ist die Steuerung der Baustelle angehalten; danach lädt sie einmal neu und
schaltet wie vorher. Plug-Name und BTHome-Kopplungen bleiben offen (06c, Kopplungspflege). Jede Umbenennung steht mit
allen Schritten in der Tabelle `umbenennung` und als eine Zeile im Protokoll der Baustelle.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er, label_registry as lr
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .db import einstellung_merken
from .db import inventar as db_inventar
from .inventar import _db, async_vorschau
from .logik.inventar import ausfuehrbar, ids_getauscht, status, verweise_tauschen
from .logik.rechte import darf

if TYPE_CHECKING:
    from .steuerung import Steuerung


def _label_id(labels: lr.LabelRegistry, name: str) -> str:
    vorhanden = labels.async_get_label_by_name(name)
    return vorhanden.label_id if vorhanden is not None else labels.async_create(name).label_id


@callback
def _in_ha(hass: HomeAssistant, schritt: dict[str, Any]) -> None:
    """Einen zusammengefassten Schritt aus `logik.inventar.ausfuehrbar` in HA ausführen (wirft bei Fehler)."""
    art, ref = schritt["art"], schritt["ref"]
    if art == "entitaet":
        werte: dict[str, Any] = {}
        if "name" in schritt:
            werte["name"] = schritt["name"]
        if "entity_id" in schritt:
            werte["new_entity_id"] = schritt["entity_id"]
        er.async_get(hass).async_update_entity(ref, **werte)
    elif art == "geraet":
        dr.async_get(hass).async_update_device(ref, name_by_user=schritt["name"])
    elif art == "label":
        geraete, labels = dr.async_get(hass), lr.async_get(hass)
        if (geraet := geraete.async_get(ref)) is None:
            raise ValueError("HA-Gerät nicht gefunden")
        weg = {lab.label_id for n in schritt["weg"] if (lab := labels.async_get_label_by_name(n)) is not None}
        geraete.async_update_device(ref, labels=(set(geraet.labels) - weg) | {_label_id(labels, n) for n in schritt["dazu"]})
    # unter_eintrag: Name des Unter-Eintrags, kommt mit den Verweisen (_verweise)


def _ergebnisse(schritte: list[dict[str, Any]], fehler: dict[tuple[str, str], str]) -> list[dict[str, Any]]:
    """Ergebnis je Schritt der Vorschau: ok, gleich, fehler (mit Text) oder offen (Plug-Name, BTHome – 06c)."""
    aus = []
    for s in schritte:
        art = "entitaet" if s["ziel"] in ("entitaet_name", "entitaet_id") else s["ziel"]
        if s["zustand"] == "gleich":
            ergebnis = {"ergebnis": "gleich"}
        elif s["ziel"] in ("plug", "bthome"):
            ergebnis = {"ergebnis": "offen"}
        elif (text := fehler.get((art, s["ref"]))) is not None:
            ergebnis = {"ergebnis": "fehler", "fehler": text}
        else:
            ergebnis = {"ergebnis": "ok"}
        aus.append({**s, **ergebnis})
    return aus


@callback
def _verweise(hass: HomeAssistant, st: Steuerung, ids: dict[str, str], namen: dict[str, str], benutzer: str | None
              ) -> list[str]:
    """Eigene Verweise der Integration auf die neuen Entity-IDs bringen und Heizkörper umbenennen; liefert, was sich
    änderte. Die Unter-Einträge lösen kein Neu-Laden aus (`neu_laden_folgt`), das kommt einmal am Ende."""
    entry, geaendert = st.entry, []
    for sub in list(entry.subentries.values()):
        data = verweise_tauschen(dict(sub.data), ids)
        titel = namen.get(sub.subentry_id, sub.title)
        if titel != sub.title:
            data["name"] = titel
        if hass.config_entries.async_update_subentry(entry, sub, data=data, title=titel):
            geaendert.append(f"Unter-Eintrag {titel}")
    optionen = verweise_tauschen(dict(entry.options), ids)
    if optionen != dict(entry.options):
        hass.config_entries.async_update_entry(entry, options=optionen)
        geaendert.append("Optionen")
    for bid, alt in list(st.e["bereiche"].items()):
        neu = verweise_tauschen(alt, ids)
        for schluessel in [k for k in neu if neu[k] != alt.get(k)]:
            st.e["bereiche"][bid][schluessel] = neu[schluessel]
            einstellung_merken(hass, entry.entry_id, f"bereiche.{bid}.{schluessel}", neu[schluessel], benutzer,
                               bereich_id=bid, quelle="umbenennen")
            geaendert.append(f"Einstellung {schluessel}")
    st.einstellungen.speichern()
    return geaendert


async def async_ausfuehren(hass: HomeAssistant, db: Any, container_id: str, benutzer: str | None) -> dict[str, Any]:
    """Umbenennung eines Containers ausführen; wirft `LookupError` (nicht gefunden) bzw. `ValueError` (Konflikt)."""
    if (ergebnis := await async_vorschau(hass, db, container_id)) is None:
        raise LookupError("Container ohne Bereich auf einer geladenen Baustelle")
    eingabe, v = ergebnis
    if v["konflikte"]:
        raise ValueError("Konflikt: " + ", ".join(f"{a} → {n}" for a, n in v["konflikte"].items()))
    plan = ausfuehrbar(v["schritte"])
    if not plan:
        return {"id": None, "status": "nichts", "schritte": v["schritte"], "geaendert": []}
    entry = hass.config_entries.async_get_entry(eingabe["baustelle_id"])
    assert entry is not None and entry.domain == DOMAIN
    st: Steuerung = entry.runtime_data
    # Schalten anhalten (Verweise werden getauscht) – alles Folgende läuft ohne await am Stück, danach einmal neu laden
    st.neu_laden_folgt = True
    st.async_stop()
    fehler: dict[tuple[str, str], str] = {}
    for schritt in plan:
        try:
            _in_ha(hass, schritt)
        except (ValueError, KeyError) as err:
            fehler[(schritt["art"], schritt["ref"])] = str(err) or type(err).__name__
    schritte = _ergebnisse(v["schritte"], fehler)
    namen = {s["ref"]: s["neu"] for s in schritte if s["ziel"] == "unter_eintrag" and s["ergebnis"] == "ok"}
    geaendert = _verweise(hass, st, ids_getauscht(schritte), namen, benutzer)
    stand = status(schritte)
    st.protokoll("einstellung", eingabe["bereich_id"],
                 f"Umbenannt nach Schema ({eingabe['praefix']}_C_{eingabe['art']}): "
                 f"{sum(1 for s in schritte if s['ergebnis'] == 'ok')} Schritte"
                 + (f", {len(fehler)} fehlgeschlagen" if fehler else "")
                 + (", Plug-Name folgt" if any(s["ergebnis"] == "offen" for s in schritte) else ""))
    hass.config_entries.async_schedule_reload(entry.entry_id)
    nr = await db.async_ausfuehren(lambda verbindung: db_inventar.umbenennung_merken(
        verbindung, container_id=container_id, benutzer=benutzer, jetzt=dt_util.utcnow(), schritte=schritte, status=stand))
    return {"id": nr, "status": stand, "schritte": schritte, "geaendert": geaendert}


@websocket_api.websocket_command({vol.Required("type"): "baustelle/inventar_umbenennen", vol.Required("container_id"): str})
@websocket_api.async_response
async def ws_inventar_umbenennen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Namen und Entity-IDs eines Containers nach dem Schema übernehmen (BSM-031.06b) – nur Admins."""
    if not darf(bool(connection.user and connection.user.is_admin), "inventar_umbenennen"):
        connection.send_error(msg["id"], websocket_api.ERR_UNAUTHORIZED, "Nur Admins dürfen umbenennen")
        return
    if (db := _db(hass, connection, msg)) is None:
        return
    try:
        ergebnis = await async_ausfuehren(hass, db, msg["container_id"], connection.user.name if connection.user else None)
    except LookupError as err:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, str(err))
        return
    except ValueError as err:
        connection.send_error(msg["id"], "konflikt", str(err))
        return
    connection.send_result(msg["id"], ergebnis)


BEFEHLE = (ws_inventar_umbenennen,)
