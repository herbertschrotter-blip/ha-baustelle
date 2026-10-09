"""BSM-031.07/.08: Ausrüstung aus HA zuordnen (mit Verdrahtung), Bestand beim Anlegen, feste Nummer, Status, Verweise."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import C1, C2, HK1
from .test_umbenennen import baustelle_register  # noqa: F401  (Fixture)


async def _senden(ws, mid: int, **daten):
    """Wie in test_umbenennen, aber ohne Namenskonflikt mit dem Feld `nr` (feste Containernummer)."""
    await ws.send_json({"id": mid, **daten})
    return await ws.receive_json()


def _neuer_shelly(hass: HomeAssistant) -> str:
    """Ein Shelly, den HA kennt, der aber noch in keiner Baustelle steckt; liefert die Geräte-ID."""
    quelle = MockConfigEntry(domain="shelly", title="Neu", data={})
    quelle.add_to_hass(hass)
    geraet = dr.async_get(hass).async_get_or_create(config_entry_id=quelle.entry_id, identifiers={("shelly", "plug9")},
                                                    connections={(dr.CONNECTION_NETWORK_MAC, "aa:bb:cc:00:00:09")},
                                                    name="Plug Lager 09", model="Shelly Plug S Gen3")
    er.async_get(hass).async_get_or_create("switch", "shelly", "plug9-s", suggested_object_id="plug_lager_09",
                                           config_entry=quelle, device_id=geraet.id)
    hass.states.async_set("switch.plug_lager_09", "off")
    return geraet.id


async def _anlegen(ws, mid: int, entry, **mehr):
    a = await _senden(ws, mid, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=entry.entry_id, **mehr)
    assert a["success"], a
    return a["result"]


async def test_bestand_beim_anlegen_und_feste_nummer(hass: HomeAssistant, baustelle_register, hass_ws_client) -> None:
    entry = baustelle_register
    ws = await hass_ws_client(hass)
    c = await _anlegen(ws, 1, entry, art="POL", bereich_id=C1, nr=7)
    assert c["nr"] == 7
    assert sorted(a["typ"] for a in c["ausruestung"]) == ["PLUG", "TEMP"]   # Shelly und Fühler des Bereichs kommen mit
    plug = next(a for a in c["ausruestung"] if a["typ"] == "PLUG")
    assert plug["gg"] == 1
    doppelt = await _senden(ws, 2, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=entry.entry_id,
                            art="MAN", nr=7)
    assert not doppelt["success"] and "vergeben" in doppelt["error"]["message"]
    weiter = await _anlegen(ws, 3, entry, art="MAN")
    assert weiter["nr"] == 8   # nächste nach der größten, nie eine Lücke
    alles = (await _senden(ws, 4, type="baustelle/inventar"))["result"]
    pol = next(x for x in alles["container"] if x["nr"] == 7)
    assert [a["name"] for a in pol["ausruestung"]][:1] == ["007-01_C_PLUG_POL"]
    assert next(a for a in pol["ausruestung"] if a["typ"] == "PLUG")["geraet_id"] == HK1


async def test_zuordnen_neuer_shelly(hass: HomeAssistant, baustelle_register, hass_ws_client) -> None:
    entry = baustelle_register
    device_id = _neuer_shelly(hass)
    ws = await hass_ws_client(hass)
    c = await _anlegen(ws, 1, entry, art="MAN", bereich_id=C2)
    kand = (await _senden(ws, 2, type="baustelle/inventar_kandidaten"))["result"]["geraete"]
    neu = next(k for k in kand if k["device_id"] == device_id)
    assert neu["typ"] == "PLUG" and neu["verwendet"] is None and neu["entity_id"] == "switch.plug_lager_09"
    hk1 = next(k for k in kand if k["entity_id"] == "switch.hk1")
    assert hk1["verwendet"] == "B1 › Container 1"   # noch nicht im Inventar, aber in der Baustelle verwendet

    z = await _senden(ws, 3, type="baustelle/inventar_aendern", aktion="ausruestung_zuordnen", container_id=c["id"],
                      device_id=device_id, haengt="radiator")
    await hass.async_block_till_done()
    assert z["success"], z
    assert z["result"]["typ"] == "PLUG" and z["result"]["verdrahtet"] == "Shelly im Bereich angelegt"
    sub = next(s for s in entry.subentries.values() if s.data.get("schalter") == "switch.plug_lager_09")
    assert sub.data["bereich"] == C2 and sub.data["rolle"] == "heizkoerper" and sub.data["typ"] == "oelradiator"
    assert "switch.plug_lager_09" in {g.schalter for g in entry.runtime_data.geraete.values()}   # neu geladen

    nochmal = await _senden(ws, 4, type="baustelle/inventar_aendern", aktion="ausruestung_zuordnen", container_id=c["id"],
                            device_id=device_id)
    assert nochmal["success"] and nochmal["result"]["neu"] is False   # steckt schon drin: nichts doppelt
    anderer = await _anlegen(ws, 5, entry, art="LAG")
    falsch = await _senden(ws, 6, type="baustelle/inventar_aendern", aktion="ausruestung_zuordnen", container_id=anderer["id"],
                           device_id=device_id)
    assert not falsch["success"] and "anderen Container" in falsch["error"]["message"]

    weg = await _senden(ws, 7, type="baustelle/inventar_aendern", aktion="ausruestung_entfernen", ausruestung_id=z["result"]["id"])
    assert weg["success"]
    frei = (await _senden(ws, 8, type="baustelle/inventar"))["result"]["ausruestung_frei"]
    assert z["result"]["id"] in {a["id"] for a in frei}


async def test_status_defekt_schaltet_aus(hass: HomeAssistant, baustelle_register, hass_ws_client) -> None:
    """BSM-031.08: defekt/verliehen = die Automatik lässt das Gerät aus (wie „inaktiv“), aktiv = wieder dabei."""
    entry = baustelle_register
    ws = await hass_ws_client(hass)
    c = await _anlegen(ws, 1, entry, art="POL", bereich_id=C1)
    plug = next(a for a in c["ausruestung"] if a["typ"] == "PLUG")
    st = entry.runtime_data
    g = st.geraete[HK1]
    assert st.geraet_aktiv(g)
    defekt = await _senden(ws, 2, type="baustelle/inventar_aendern", aktion="ausruestung_status", ausruestung_id=plug["id"],
                           status="defekt")
    assert defekt["success"] and not st.geraet_aktiv(g)
    wieder = await _senden(ws, 3, type="baustelle/inventar_aendern", aktion="ausruestung_status", ausruestung_id=plug["id"],
                           status="aktiv")
    assert wieder["success"] and st.geraet_aktiv(g)


async def test_status_ein_feld_in_beide_richtungen(hass: HomeAssistant, baustelle_register, hass_ws_client) -> None:
    """BSM-034.02: ein Status je Gerät – Seite (baustelle/geraet) und Inventar ändern dasselbe Feld."""
    entry = baustelle_register
    ws = await hass_ws_client(hass)
    c = await _anlegen(ws, 1, entry, art="POL", bereich_id=C1)
    plug = next(a for a in c["ausruestung"] if a["typ"] == "PLUG")
    st = entry.runtime_data
    g = st.geraete[HK1]

    nummer = iter(range(2, 100))

    async def inventar_status() -> str:
        alles = (await _senden(ws, next(nummer), type="baustelle/inventar"))["result"]
        return next(a["status"] for x in alles["container"] for a in x["ausruestung"] if a["id"] == plug["id"])

    r = await _senden(ws, next(nummer), type="baustelle/geraet", entry_id=entry.entry_id, geraet=HK1, aktion="status", status="verliehen")
    await hass.async_block_till_done(wait_background_tasks=True)
    assert r["success"] and r["result"]["status"] == "verliehen" and not st.geraet_aktiv(g)
    assert await inventar_status() == "verliehen"
    assert st.e["protokoll"][0][3].endswith("verliehen – die Automatik lässt es aus")
    r = await _senden(ws, next(nummer), type="baustelle/inventar_aendern", aktion="ausruestung_status", ausruestung_id=plug["id"], status="inaktiv")
    assert r["success"] and st.geraet_status(g) == "inaktiv" and "aktiv" not in st.e["geraete"][HK1]
    r = await _senden(ws, next(nummer), type="baustelle/aktion", entry_id=entry.entry_id, aktion="aktiv", geraet=HK1, an=True)   # Container-Chip
    await hass.async_block_till_done(wait_background_tasks=True)
    assert r["success"] and st.geraet_aktiv(g) and await inventar_status() == "aktiv"
    falsch = await _senden(ws, next(nummer), type="baustelle/geraet", entry_id=entry.entry_id, geraet=HK1, aktion="status", status="weg")
    keins = await _senden(ws, next(nummer), type="baustelle/geraet", entry_id=entry.entry_id, geraet="gibts_nicht", aktion="status", status="aktiv")
    assert not falsch["success"] and not keins["success"]


async def test_vorschau_nennt_verweise(hass: HomeAssistant, baustelle_register, hass_ws_client) -> None:
    """§6.2: eigene Automationen mit einer alten Entity-ID stehen in der Vorschau."""
    entry = baustelle_register
    assert await async_setup_component(hass, "automation", {"automation": [{
        "alias": "Polier morgens", "triggers": [{"trigger": "state", "entity_id": "switch.hk1"}], "actions": []}]})
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    c = await _anlegen(ws, 1, entry, art="POL", bereich_id=C1)
    v = (await _senden(ws, 2, type="baustelle/inventar_vorschau", container_id=c["id"]))["result"]
    assert {"art": "Automation", "name": "Polier morgens", "alt": "switch.hk1", "neu": "switch.001_01_c_plug_pol"} in v["verweise"]
