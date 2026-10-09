"""BSM-031.05: WebSocket-Befehle fürs Inventar – lesen für alle, ändern nur Admins (docs/api-0.7.md §12)."""

from homeassistant.core import HomeAssistant

from custom_components.baustelle.db import DATA_DB
from custom_components.baustelle.db import schema as s

from sqlalchemy import insert, text


async def _senden(ws, nr: int, **daten):
    await ws.send_json({"id": nr, **daten})
    return await ws.receive_json()


async def test_inventar_lesen_und_anlegen(hass: HomeAssistant, baustelle, hass_ws_client) -> None:
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    leer = await _senden(ws, 1, type="baustelle/inventar")
    assert leer["success"] and leer["result"]["container"] == [] and leer["result"]["naechste_nr"] == 1
    assert leer["result"]["aendern"] is True and leer["result"]["arten"]["POL"] == "Polier"
    ohne = leer["result"]["bereiche_ohne"]
    assert ohne and all(b["baustelle_id"] == baustelle.entry_id for b in ohne)

    eins = await _senden(ws, 2, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=baustelle.entry_id,
                         art="POL", bereich_id=ohne[0]["id"])
    zwei = await _senden(ws, 3, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=baustelle.entry_id,
                         art="MAN")
    fremd = await _senden(ws, 4, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=baustelle.entry_id,
                          art="MAN", firma_kuerzel="stra")
    fremd2 = await _senden(ws, 5, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=baustelle.entry_id,
                           art="LAG", firma_kuerzel="STRA")
    assert (eins["result"]["nr"], zwei["result"]["nr"]) == (1, 2)
    assert (fremd["result"]["firma_kuerzel"], fremd["result"]["fremd_nr"], fremd2["result"]["fremd_nr"]) == ("STRA", 1, 2)

    alles = (await _senden(ws, 6, type="baustelle/inventar"))["result"]
    namen = [c["name"] for c in alles["container"]]
    assert namen == ["001_C_POL", "002_C_MAN", "STRA-01_C_MAN", "STRA-02_C_LAG"]
    pol = alles["container"][0]
    assert pol["einsatz"]["baustelle_id"] == baustelle.entry_id and pol["einsatz"]["bereich_id"] == ohne[0]["id"]
    assert pol["labels"] == ["Container", "Polier"] and alles["naechste_nr"] == 3
    assert ohne[0]["id"] not in {b["id"] for b in alles["bereiche_ohne"]}   # Bereich ist jetzt verknüpft


async def test_ausruestung_status_und_ausscheiden(hass: HomeAssistant, baustelle, hass_ws_client) -> None:
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    c = (await _senden(ws, 1, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=baustelle.entry_id,
                       art="MAN", firma_kuerzel="HUBE"))["result"]
    db = hass.data[DATA_DB]
    from datetime import UTC, datetime   # noqa: PLC0415
    zeit = datetime(2026, 10, 8, tzinfo=UTC)
    with db.engine.begin() as v:
        v.execute(insert(s.ausruestung).values(id="a1", typ="PLUG", kennung="k1", status="aktiv", angelegt=zeit))
        v.execute(insert(s.ausruestung_einsatz).values(ausruestung_id="a1", von=zeit, container_id=c["id"], gg=1))
        v.execute(insert(s.ausruestung).values(id="a2", typ="TEMP", kennung="k2", status="aktiv", angelegt=zeit))
        v.execute(insert(s.ausruestung).values(id="a3", typ="TEMP", kennung="k3", status="aktiv", angelegt=zeit))
        v.execute(insert(s.ausruestung_einsatz).values(ausruestung_id="a3", von=zeit, container_id=c["id"]))
    alles = (await _senden(ws, 2, type="baustelle/inventar"))["result"]
    assert alles["container"][0]["ausruestung"][0]["name"] == "HUBE-01-01_C_PLUG_MAN"
    assert [a["id"] for a in alles["ausruestung_frei"]] == ["a2"]

    ok = await _senden(ws, 3, type="baustelle/inventar_aendern", aktion="ausruestung_status", ausruestung_id="a1", status="defekt")
    falsch = await _senden(ws, 4, type="baustelle/inventar_aendern", aktion="ausruestung_status", ausruestung_id="a1",
                           status="ausgeschieden")
    raus = await _senden(ws, 5, type="baustelle/inventar_aendern", aktion="container_status", container_id=c["id"],
                         status="ausgeschieden")
    assert ok["success"] and not falsch["success"] and raus["success"]
    alles = (await _senden(ws, 6, type="baustelle/inventar"))["result"]
    assert alles["container"][0]["status"] == "ausgeschieden" and alles["container"][0]["einsatz"] is None
    assert alles["container"][0]["geschichte"][0]["bis"]   # Einsatz beendet, Geschichte bleibt
    # BSM-034.01: die Ausrüstung des ausgeschiedenen Containers ist wieder frei
    assert alles["container"][0]["ausruestung"] == [] and {a["id"] for a in alles["ausruestung_frei"]} == {"a1", "a2", "a3"}
    assert db.fehler is None   # falsche Eingabe hat die Datenbank nicht auf „fehler“ gesetzt


async def test_firmenkuerzel_und_pruefung(hass: HomeAssistant, baustelle, hass_ws_client) -> None:
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    db = hass.data[DATA_DB]
    with db.engine.begin() as v:
        v.execute(text("INSERT INTO firma (baustelle_id, id, name, eigen) VALUES (:b, 'f-s', 'Strabag', false)"),
                  {"b": baustelle.entry_id})
    ok = await _senden(ws, 1, type="baustelle/inventar_aendern", aktion="firma_kuerzel", entry_id=baustelle.entry_id,
                       firma_id="f-s", kuerzel="stra")
    falsch = await _senden(ws, 2, type="baustelle/inventar_aendern", aktion="firma_kuerzel", entry_id=baustelle.entry_id,
                           firma_id="f-s", kuerzel="S1")
    fehlt = await _senden(ws, 3, type="baustelle/inventar_aendern", aktion="container_anlegen", art="POL")
    assert ok["success"] and not falsch["success"] and not fehlt["success"]
    firmen = (await _senden(ws, 4, type="baustelle/inventar"))["result"]["firmen"]
    assert {f["id"]: f["kuerzel"] for f in firmen}["f-s"] == "STRA"


async def test_nur_admins_aendern(hass: HomeAssistant, baustelle, hass_ws_client, hass_admin_user) -> None:
    await hass.async_block_till_done()
    hass_admin_user.groups = []   # kein Admin mehr
    ws = await hass_ws_client(hass)
    lesen = await _senden(ws, 1, type="baustelle/inventar")
    aendern = await _senden(ws, 2, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=baustelle.entry_id,
                            art="POL")
    assert lesen["success"] and lesen["result"]["aendern"] is False
    assert not aendern["success"] and aendern["error"]["code"] == "unauthorized"


async def test_vorschau_aendert_nichts(hass: HomeAssistant, baustelle, hass_ws_client) -> None:
    """BSM-031.06a: Vorschau für einen Container mit Bereich – Schritte alt → neu, in HA ändert sich nichts."""
    from homeassistant.helpers import entity_registry as er   # noqa: PLC0415

    from .conftest import C1   # noqa: PLC0415
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    vorher = dict(er.async_get(hass).entities)
    c = (await _senden(ws, 1, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=baustelle.entry_id,
                       art="MAN", bereich_id=C1))["result"]
    v = await _senden(ws, 2, type="baustelle/inventar_vorschau", container_id=c["id"])
    assert v["success"], v
    schritte = v["result"]["schritte"]
    ids = {s["alt"]: s["neu"] for s in schritte if s["ziel"] == "entitaet_id"}
    assert ids["switch.hk1"] == "switch.001_01_c_plug_man"
    assert {s["gruppe"] for s in schritte} >= {"001-01_C_PLUG_MAN"}
    assert any(s["ziel"] == "unter_eintrag" and s["neu"].startswith("001-01_C_HZ_MAN_") for s in schritte)
    assert dict(er.async_get(hass).entities) == vorher
    ohne = await _senden(ws, 3, type="baustelle/inventar_aendern", aktion="container_anlegen", entry_id=baustelle.entry_id,
                         art="LAG")
    keine = await _senden(ws, 4, type="baustelle/inventar_vorschau", container_id=ohne["result"]["id"])
    assert not keine["success"] and keine["error"]["code"] == "not_found"
