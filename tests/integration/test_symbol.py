"""Container-Symbol (BSM-032): Aussehen setzen und Zustand aus den Sensoren in der Struktur."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.baustelle.daten import laufzeit

from .conftest import C1, C2


async def test_symbol_setzen_und_zustand(hass: HomeAssistant, baustelle, hass_ws_client) -> None:
    st = baustelle.runtime_data
    client = await hass_ws_client(hass)
    n = {"id": 0}

    async def setzen(wert):
        n["id"] += 1
        await client.send_json({"id": n["id"], "type": "baustelle/setzen", "entry_id": baustelle.entry_id, "pfad": ["bereiche", C1, "symbol"], "wert": wert})
        return await client.receive_json()

    # ohne Einstellung: Standard, eine Tür und ein Fenster, alles zu
    s = laufzeit(st)["container"][C1]["symbol"]
    assert s["eigen"] is False and len(s["tueren"]) == 1 and len(s["fenster"]) == 1 and s["fenster"][0]["zustand"] == "zu"
    assert laufzeit(st)["container"]["sub_schacht"]["symbol"] is None

    # Fensterkontakt (BLU Door/Window) mit Drehung am selben Gerät, Türkontakt des Containers, Licht als Schalter
    eintrag = MockConfigEntry(domain="bthome"); eintrag.add_to_hass(hass)
    geraet = dr.async_get(hass).async_get_or_create(config_entry_id=eintrag.entry_id, connections={(dr.CONNECTION_BLUETOOTH, "08:B9:5F:00:00:09")})
    reg = er.async_get(hass)
    reg.async_get_or_create("binary_sensor", "bthome", "f-window", suggested_object_id="fenster_c1", device_id=geraet.id, config_entry=eintrag)
    reg.async_get_or_create("sensor", "bthome", "f-rotation", suggested_object_id="fenster_c1_drehung", device_id=geraet.id, config_entry=eintrag)
    hass.states.async_set("binary_sensor.fenster_c1", "on", {"device_class": "window"})
    hass.states.async_set("sensor.fenster_c1_drehung", "12", {"unit_of_measurement": "°"})
    hass.states.async_set("binary_sensor.tuer_c1", "on", {"device_class": "door"})
    hass.states.async_set("switch.licht_c1", "on")
    st.einstellungen.bereich(C1)["tuer"] = "binary_sensor.tuer_c1"

    r = await setzen({"doppel": True, "farbe": "#1baf7a", "tueren": [{"wand": "front", "pos": 0.15}],
                      "fenster": [{"wand": "front", "pos": 0.5, "sensor": "binary_sensor.fenster_c1"}, {"wand": "seite", "pos": 0.67}],
                      "licht": "switch.licht_c1"})
    assert r["success"], r
    s = laufzeit(st)["container"][C1]["symbol"]
    assert s["eigen"] and s["doppel"] and s["farbe"] == "#1baf7a" and s["licht_an"] is True
    assert s["tueren"][0]["offen"] is True and s["tueren"][0]["sensor"] is None and s["tueren"][0]["sensor_aktiv"] == "binary_sensor.tuer_c1"
    assert [f["zustand"] for f in s["fenster"]] == ["gekippt", "zu"]
    hass.states.async_set("sensor.fenster_c1_drehung", "1", {"unit_of_measurement": "°"})
    assert laufzeit(st)["container"][C1]["symbol"]["fenster"][0]["zustand"] == "offen"
    hass.states.async_set("binary_sensor.fenster_c1", "off", {"device_class": "window"})
    hass.states.async_set("switch.licht_c1", "off")
    s = laufzeit(st)["container"][C1]["symbol"]
    assert s["fenster"][0]["zustand"] == "zu" and s["licht_an"] is False

    # ungültig: 5 Fenster, unsichtbare Wand – abgelehnt, nichts geändert
    for falsch in [{"tueren": [{"wand": "front"}], "fenster": [{"wand": "front"}] * 5}, {"tueren": [{"wand": "hinten"}], "fenster": [{"wand": "front"}]}]:
        r = await setzen(falsch)
        assert not r["success"]
    assert laufzeit(st)["container"][C1]["symbol"]["doppel"] is True
    assert (await setzen(None))["success"] and laufzeit(st)["container"][C1]["symbol"]["eigen"] is False   # zurück auf Standard
    assert laufzeit(st)["container"][C2]["symbol"]["eigen"] is False
