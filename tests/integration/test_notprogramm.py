"""Notprogramm in den Plugs einrichten und aktuell halten (BSM-017) – mit nachgebautem Shelly (RPC über HTTP)."""

from __future__ import annotations

import json
import re
from typing import Any

import aiohttp
import pytest
from yarl import URL

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker, AiohttpClientMockResponse

from custom_components.baustelle import notprogramm as np_modul
from custom_components.baustelle.logik import notprogramm as logik
from custom_components.baustelle.logik.warnungen import titel
from custom_components.baustelle.notprogramm import DATA_NOTPROGRAMM, SKRIPT_NAME, Notprogramm, skript_lesen

from .conftest import baustelle_anlegen

BT_FUEHLER = "AA:BB:CC:DD:EE:01"
BT_TUER = "08:B9:5F:00:00:02"
VERSION = skript_lesen()[0]


class FakePlug:
    """Ein Shelly Plug S Gen3 von außen gesehen: Skripte, KVS, BTHome-Komponenten, Endpunkt `hb`."""

    def __init__(self) -> None:
        self.skripte: dict[int, dict[str, Any]] = {1: {"name": "aioshelly_ble_integration", "enable": False, "running": True, "code": ""}}
        self.kvs: dict[str, str] = {}
        self.geladen: int | None = None
        self.aufrufe: list[str] = []
        self.erreichbar = True
        self.nb = 0   # „Notbetrieb seit“ (Unix-Sekunden), das das Skript beim nächsten Lebenszeichen meldet
        self.komponenten = [
            {"key": "bthomedevice:200", "config": {"id": 200, "addr": BT_FUEHLER.lower()}},
            {"key": "bthomesensor:200", "config": {"id": 200, "addr": BT_FUEHLER.lower(), "obj_id": 1}},
            {"key": "bthomesensor:202", "config": {"id": 202, "addr": BT_FUEHLER.lower(), "obj_id": 69}},
            {"key": "bthomesensor:203", "config": {"id": 203, "addr": "11:22:33:44:55:66", "obj_id": 69}},
        ]

    def rpc(self, methode: str, p: dict[str, Any]) -> Any:
        self.aufrufe.append(methode)
        s = self.skripte
        match methode:
            case "Script.List":
                return {"scripts": [{"id": i, "name": x["name"], "enable": x["enable"], "running": x["running"]} for i, x in s.items()]}
            case "Script.Create":
                neu = max(s) + 1
                s[neu] = {"name": p["name"], "enable": False, "running": False, "code": ""}
                return {"id": neu}
            case "Script.PutCode":
                assert not s[p["id"]]["running"], "PutCode bei laufendem Skript"
                assert len(p["code"]) <= np_modul.STUECK
                s[p["id"]]["code"] = (s[p["id"]]["code"] if p["append"] else "") + p["code"]
                return {"len": len(s[p["id"]]["code"])}
            case "Script.SetConfig":
                s[p["id"]].update(p["config"])
                return {"restart_required": False}
            case "Script.Start" | "Script.Stop":
                s[p["id"]]["running"] = methode == "Script.Start"
                return {"was_running": True}
            case "KVS.GetMany":
                muster = re.compile("^" + p["match"].replace("*", ".*") + "$")
                return {"items": [{"key": k, "value": w, "etag": "x"} for k, w in self.kvs.items() if muster.match(k)]}
            case "KVS.Set":
                assert len(p["value"]) <= logik.MAX_WERT
                self.kvs[p["key"]] = p["value"]
                return {"etag": "x"}
            case "BTHome.DeleteSensor" | "BTHome.DeleteDevice":
                art = "bthomesensor" if methode.endswith("Sensor") else "bthomedevice"
                self.komponenten = [k for k in self.komponenten if k["key"] != f"{art}:{p['id']}"]
                return None
            case "BTHome.AddDevice" | "BTHome.AddSensor":
                art = "bthomedevice" if methode.endswith("Device") else "bthomesensor"
                nr = max([int(k["key"].split(":")[1]) for k in self.komponenten if k["key"].startswith(art)] + [199]) + 1
                self.komponenten.append({"key": f"{art}:{nr}", "config": {"id": nr, **p["config"]}})
                return {"added": f"{art}:{nr}"}
            case "BTHomeDevice.SetConfig" | "BTHomeSensor.SetConfig":
                art = "bthomedevice" if methode.startswith("BTHomeDevice") else "bthomesensor"
                next(k for k in self.komponenten if k["key"] == f"{art}:{p['id']}")["config"].update(p["config"])
                return {"restart_required": False}
            case "Shelly.GetComponents":
                teile = self.komponenten[p.get("offset", 0):][:3]   # wie das Gerät: seitenweise
                return {"components": teile, "offset": p.get("offset", 0), "total": len(self.komponenten)}
        raise AssertionError(methode)

    def eigenes(self) -> tuple[int, dict[str, Any]] | None:
        return next(((i, x) for i, x in self.skripte.items() if x["name"] == SKRIPT_NAME), None)

    async def antwort(self, method: str, url: URL, data: Any) -> AiohttpClientMockResponse:
        if not self.erreichbar:
            return AiohttpClientMockResponse(method, url, exc=aiohttp.ClientConnectionError())
        if url.path == "/rpc":
            anfrage = json.loads(data)
            if anfrage["method"] == "BTHome.AddDevice":   # wie das Gerät: legt an, antwortet aber nicht
                self.rpc(anfrage["method"], anfrage["params"])
                return AiohttpClientMockResponse(method, url, exc=TimeoutError())
            return AiohttpClientMockResponse(method, url, json={"id": 1, "result": self.rpc(anfrage["method"], anfrage["params"])})
        treffer = re.fullmatch(r"/script/(\d+)/hb", url.path)
        x = self.skripte.get(int(treffer.group(1))) if treffer else None
        if x is None or not x["running"]:
            return AiohttpClientMockResponse(method, url, status=404, text="")
        self.aufrufe.append("hb?neu" if "neu" in url.query_string else "hb")
        version = int(m.group(1)) if (m := re.search(r"let VERSION = (\d+);", x["code"])) else None
        antwort = {"v": version, "programm": self.geladen, "fenster": 0, "nb": self.nb, "taste": 0}
        self.nb = 0   # das Lebenszeichen beendet den Notbetrieb
        if "neu" in url.query_string:
            self.geladen = json.loads(self.kvs["bs_cfg"])["v"] if "bs_cfg" in self.kvs else None
        return AiohttpClientMockResponse(method, url, json=antwort)


def _plug_eintragen(hass: HomeAssistant, host: str, schalter: str, mac: str) -> None:
    entry = MockConfigEntry(domain="shelly", data={"host": host, "gen": 3}, unique_id=mac)
    entry.add_to_hass(hass)
    geraet = dr.async_get(hass).async_get_or_create(config_entry_id=entry.entry_id, connections={(dr.CONNECTION_NETWORK_MAC, mac)})
    er.async_get(hass).async_get_or_create("switch", "shelly", f"{mac}-switch:0", suggested_object_id=schalter.split(".")[1],
                                           device_id=geraet.id, config_entry=entry)


@pytest.fixture
async def anlage(hass: HomeAssistant, freezer, shellys, nachrichten, aioclient_mock: AiohttpClientMocker, monkeypatch):
    """Baustelle B1 mit zwei Heizungs-Plugs (Shelly-Integration) und dem Fühler von Container 1 als BTHome-Gerät."""
    monkeypatch.setattr(np_modul, "WARTEN_S", 0)
    _plug_eintragen(hass, "plug1", "switch.hk1", "aa:00:00:00:00:01")
    _plug_eintragen(hass, "plug2", "switch.hk2", "aa:00:00:00:00:02")
    bthome = MockConfigEntry(domain="bthome", unique_id=BT_FUEHLER)
    bthome.add_to_hass(hass)
    fuehler = dr.async_get(hass).async_get_or_create(config_entry_id=bthome.entry_id, connections={(dr.CONNECTION_BLUETOOTH, BT_FUEHLER)},
                                                     name="001_C_TEMP_C1")
    tuer = dr.async_get(hass).async_get_or_create(config_entry_id=bthome.entry_id, connections={(dr.CONNECTION_BLUETOOTH, BT_TUER)},
                                                  name="SBDW-103C 142B")
    dr.async_get(hass).async_update_device(tuer.id, name_by_user="002_C_DOOR_C2")   # von Herbert umbenannt
    er.async_get(hass).async_get_or_create("binary_sensor", "bthome", f"{BT_TUER}-window", suggested_object_id="tuer_c2",
                                           device_id=tuer.id, config_entry=bthome)
    er.async_get(hass).async_get_or_create("sensor", "bthome", f"{BT_FUEHLER}-temperature", suggested_object_id="temp_c1",
                                           device_id=fuehler.id, config_entry=bthome)
    plugs = {"plug1": FakePlug(), "plug2": FakePlug()}
    for host, plug in plugs.items():
        aioclient_mock.post(f"http://{host}/rpc", side_effect=plug.antwort)
        aioclient_mock.get(re.compile(rf"^http://{host}/script/"), side_effect=plug.antwort)
    entry = await baustelle_anlegen(hass, freezer)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    shellys.anmelden()
    np: Notprogramm = hass.data[DATA_NOTPROGRAMM][entry.entry_id]
    return entry, np, plugs


async def test_startet_aus_und_spielt_nichts_ein(hass: HomeAssistant, anlage) -> None:
    entry, np, plugs = anlage
    assert entry.runtime_data.e["heizung"]["notprogramm"] is False
    await np.async_runde()
    for plug in plugs.values():
        assert plug.aufrufe == ["Script.List"]   # nur nachsehen, ob ein altes Skript läuft
        assert plug.eigenes() is None and plug.kvs == {}
    await np.async_runde()
    assert plugs["plug1"].aufrufe == ["Script.List"]   # einmal je Start


async def test_einrichten_programm_und_lebenszeichen(hass: HomeAssistant, anlage) -> None:
    entry, np, plugs = anlage
    st = entry.runtime_data
    st.e["heizung"]["notprogramm"] = True
    await np.async_runde()
    p1 = plugs["plug1"]
    i, skript = p1.eigenes()
    assert skript["enable"] and skript["running"]
    assert f"let VERSION = {VERSION};" in skript["code"] and "// Notprogramm" not in skript["code"]   # ohne Kommentare
    assert p1.aufrufe.count("Script.PutCode") > 1   # in Stücken
    assert set(p1.kvs) == {"bs_cfg"} | {f"bs_p{w}" for w in range(7)}
    cfg1 = json.loads(p1.kvs["bs_cfg"])
    assert cfg1["m"] == "hand" and cfg1["fe"] is None   # Automatik aus: nicht anfassen, kein Frostschutz
    assert cfg1["t"] == 202                             # genau der Fühler des Containers, über die Bluetooth-Adresse
    assert json.loads(plugs["plug2"].kvs["bs_cfg"])["t"] is None   # Container 2 hat keinen Fühler
    assert p1.geladen == cfg1["v"] and "hb?neu" in p1.aufrufe
    # Di 29.09.2026 16:50: heute vorbei (Arbeitszeit bis 16:30, Nachheizen 15 min), Mi ab 06:15 (Vorheizen 45 min), Sa/So frei
    assert p1.kvs["bs_p1"] == logik.LEER and p1.kvs["bs_p5"] == logik.LEER and p1.kvs["bs_p6"] == logik.LEER
    von, bis, soll = p1.kvs["bs_p2"].split(",")
    assert dt_util.utc_from_timestamp(int(von)).astimezone(dt_util.get_default_time_zone()).strftime("%a %H:%M") == "Wed 06:15"
    assert dt_util.utc_from_timestamp(int(bis)).astimezone(dt_util.get_default_time_zone()).strftime("%H:%M") == "16:45"
    assert np.stand[next(g for g in st.geraete if st.geraete[g].schalter == "switch.hk1")].info()["fehler"] is None

    # nächste Runde: nichts Neues → nur Lebenszeichen, kein Schreiben
    p1.aufrufe.clear()
    await np.async_runde()
    assert "KVS.Set" not in p1.aufrufe and "Script.PutCode" not in p1.aufrufe and p1.aufrufe.count("hb") == 1

    # Automatik ein → nur bs_cfg ändert sich (Fenster bleiben)
    p1.aufrufe.clear()
    st.e["automatik"] = True
    await np.async_runde()
    assert p1.aufrufe.count("KVS.Set") == 1 and "hb?neu" in p1.aufrufe
    cfg = json.loads(p1.kvs["bs_cfg"])
    assert cfg["m"] == "thermo" and (cfg["fe"], cfg["fa"]) == (5.0, 7.0) and p1.geladen == cfg["v"]
    assert json.loads(plugs["plug2"].kvs["bs_cfg"])["m"] == "plan"   # ohne Fühler am Plug: in der Heizzeit an


async def test_skript_geloescht_oder_veraltet(hass: HomeAssistant, anlage) -> None:
    entry, np, plugs = anlage
    entry.runtime_data.e["heizung"]["notprogramm"] = True
    await np.async_runde()
    p1 = plugs["plug1"]
    i, _ = p1.eigenes()
    del p1.skripte[i]                 # jemand löscht das Skript
    p1.kvs.clear()
    await np.async_runde()
    assert p1.eigenes() is not None and p1.eigenes()[1]["running"] and len(p1.kvs) == 8
    i, skript = p1.eigenes()
    skript["code"] = skript["code"].replace(f"let VERSION = {VERSION};", "let VERSION = 0;")   # alte Version
    p1.aufrufe.clear()
    await np.async_runde()
    assert p1.aufrufe[:3] == ["Script.List", "hb", "Script.Stop"] and f"let VERSION = {VERSION};" in p1.eigenes()[1]["code"]
    skript = p1.eigenes()[1]
    skript["running"] = False         # angehalten (z. B. Absturz)
    await np.async_runde()
    assert p1.eigenes()[1]["running"]


async def test_ausschalten_haelt_das_skript_an(hass: HomeAssistant, anlage) -> None:
    entry, np, plugs = anlage
    st = entry.runtime_data
    st.e["heizung"]["notprogramm"] = True
    await np.async_runde()
    st.e["heizung"]["notprogramm"] = False
    await np.async_runde()
    for plug in plugs.values():
        skript = plug.eigenes()[1]
        assert not skript["running"] and not skript["enable"]   # übernimmt nicht nach 15 min ohne Lebenszeichen


async def test_plug_nicht_erreichbar(hass: HomeAssistant, anlage) -> None:
    entry, np, plugs = anlage
    st = entry.runtime_data
    st.e["heizung"]["notprogramm"] = True
    plugs["plug1"].erreichbar = False
    await np.async_runde()
    stand = {st.geraete[g].schalter: s for g, s in np.stand.items()}
    assert stand["switch.hk1"].fehler and stand["switch.hk2"].fehler is None   # der andere läuft weiter
    assert plugs["plug2"].eigenes() is not None
    plugs["plug1"].erreichbar = True
    await np.async_runde()
    assert stand["switch.hk1"].fehler is None and len(plugs["plug1"].kvs) == 8
    assert np.info()["plugs"]["Heizkörper 1"]["programm"] is not None


async def test_kopplungen_in_ordnung_halten(hass: HomeAssistant, anlage) -> None:
    """BSM-030: Fühler und Tür des Containers koppeln und benennen, Fremdes entfernen, Protokoll; danach Ruhe."""
    entry, np, plugs = anlage
    st = entry.runtime_data
    st.einstellungen.bereich("sub_c2")["tuer"] = "binary_sensor.tuer_c2"
    st.e["heizung"]["notprogramm"] = True
    await np.async_runde()
    k1 = {k["key"]: k["config"] for k in plugs["plug1"].komponenten}
    assert {c["name"] for c in k1.values()} == {"001_C_TEMP_C1", "001_C_TEMP_C1_Batterie", "001_C_TEMP_C1_Feuchte",
                                                "001_C_TEMP_C1_Temperatur"}   # fremder Messwert weg, Feuchte neu
    assert k1["bthomesensor:202"]["obj_id"] == 69                             # vorhandener Messwert bleibt (Nummer)
    k2 = {c["name"]: c for c in (k["config"] for k in plugs["plug2"].komponenten)}
    assert set(k2) == {"002_C_DOOR_C2", "002_C_DOOR_C2_Batterie", "002_C_DOOR_C2_Tuer", "002_C_DOOR_C2_Drehung",
                       "002_C_DOOR_C2_Lichtstufe"}   # Fühler von Container 1 an Plug 2 entfernt, Tür gekoppelt
    cfg2 = json.loads(plugs["plug2"].kvs["bs_cfg"])
    assert cfg2["d"] == k2["002_C_DOOR_C2_Tuer"]["id"] and cfg2["t"] is None
    texte = [e[3] for e in st.einstellungen.daten["protokoll"] if e[3].startswith("Notprogramm")]
    assert any("002_C_DOOR_C2 gekoppelt" in t for t in texte) and any("001_C_TEMP_C1 umbenannt" in t for t in texte)
    for plug in plugs.values():
        plug.aufrufe.clear()
    await np.async_runde()
    for plug in plugs.values():
        assert not [a for a in plug.aufrufe if a.startswith("BTHome")], plug.aufrufe   # alles in Ordnung: nichts zu tun
    assert {k["key"] for k in plugs["plug1"].komponenten if k["key"].startswith("bthome")} == set(k1)


async def test_anzeige_pruefen_dienst_rechte(hass: HomeAssistant, anlage, hass_ws_client, hass_admin_user) -> None:
    """BSM-019: Zustand je Plug in der Struktur, „Jetzt prüfen“ (nur Admins) und Dienst."""
    from custom_components.baustelle.daten import laufzeit
    entry, np, plugs = anlage
    st = entry.runtime_data
    hk1 = next(g for g in st.geraete if st.geraete[g].schalter == "switch.hk1")
    p1 = next(g for g in st.geraete if st.geraete[g].rolle == "pumpe")
    lz = laufzeit(st)
    assert lz["notprogramm"] == {"an": False, "geprueft": None}
    assert lz["geraete"][hk1]["notprogramm"]["zustand"] == "aus" and lz["geraete"][p1]["notprogramm"] is None
    st.e["heizung"]["notprogramm"] = True
    assert laufzeit(st)["geraete"][hk1]["notprogramm"]["zustand"] == "offen"   # eingeschaltet, noch nicht geprüft

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "baustelle/notprogramm_pruefen", "entry_id": entry.entry_id})
    antwort = await client.receive_json()
    assert antwort["success"] and antwort["result"]["an"] is True and antwort["result"]["geprueft"]
    n = laufzeit(st)["geraete"][hk1]["notprogramm"]
    assert n["zustand"] == "bereit" and n["version"] == VERSION and n["programm"] is not None and n["fuehler"] == 202
    assert n["modus"] == "hand" and n["bis"] is not None and n["soll"] is not None   # Automatik aus → Hand im Plug
    hk2 = next(g for g in st.geraete if st.geraete[g].schalter == "switch.hk2")
    assert n["fuehler_fehlt"] is False and laufzeit(st)["geraete"][hk2]["notprogramm"]["fuehler_fehlt"] is False   # C2 ohne Fühler

    plugs["plug1"].aufrufe.clear()
    await hass.services.async_call("baustelle", "notprogramm_pruefen", {}, blocking=True)
    assert "hb" in plugs["plug1"].aufrufe

    hass_admin_user.groups = []   # ohne Admin-Recht
    await client.send_json({"id": 2, "type": "baustelle/notprogramm_pruefen", "entry_id": entry.entry_id})
    antwort = await client.receive_json()
    assert not antwort["success"] and antwort["error"]["code"] == "unauthorized"


async def test_notbetrieb_ins_protokoll_und_warnung(hass: HomeAssistant, anlage, freezer) -> None:
    """Meldet der Plug „Notbetrieb seit …“, steht er im Protokoll; ein Fehler über 15 min wird zur Warnung."""
    from custom_components.baustelle.daten import laufzeit
    entry, np, plugs = anlage
    st = entry.runtime_data
    st.e["heizung"]["notprogramm"] = True
    await np.async_runde()
    p1 = plugs["plug1"]
    p1.nb = int(dt_util.utcnow().timestamp()) - 40 * 60   # HA war 40 min weg, der Plug im Notbetrieb
    await np.async_runde()
    texte = [e[3] for e in st.einstellungen.daten["protokoll"]]
    assert any(t.startswith("Notbetrieb Heizkörper 1:") and "(40 min)" in t for t in texte), texte[:3]
    hk1 = next(g for g in st.geraete if st.geraete[g].schalter == "switch.hk1")
    assert laufzeit(st)["geraete"][hk1]["notprogramm"]["notbetrieb_zuletzt"] is not None

    # Fehler: erst nach 15 min eine Warnung
    plugs["plug2"].erreichbar = False
    await np.async_runde()
    st.auswerten(); await hass.async_block_till_done()
    assert not [w for w in st.daten.warnungen if w.art == "notprogramm"]
    freezer.tick(16 * 60)
    await np.async_runde()
    st.auswerten(); await hass.async_block_till_done()
    (w,) = [w for w in st.daten.warnungen if w.art == "notprogramm"]
    assert "Notprogramm nicht bereit" in titel(w)
    plugs["plug2"].erreichbar = True
    await np.async_runde()
    st.auswerten(); await hass.async_block_till_done()
    assert not [w for w in st.daten.warnungen if w.art == "notprogramm"]
