"""Steuerung gegen Home Assistant: schalten, Handbetrieb, Heizgrenze, Pumpenmeldung."""

from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
import pytest

from homeassistant.config_entries import ConfigSubentryDataWithId
from homeassistant.core import Context, HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.baustelle.const import DOMAIN

C1, C2, SCHACHT, HK1, HK2, P1 = "sub_c1", "sub_c2", "sub_schacht", "sub_hk1", "sub_hk2", "sub_p1"


def _sub(sid, typ, title, data) -> ConfigSubentryDataWithId:
    return ConfigSubentryDataWithId(subentry_id=sid, subentry_type=typ, title=title, unique_id=None, data=data)


@pytest.fixture
async def baustelle(hass: HomeAssistant, freezer: FrozenDateTimeFactory):
    await hass.config.async_set_time_zone("Europe/Vienna")
    for eid, wert in {
        "switch.hk1": "off", "switch.hk2": "off", "switch.p1": "on",
        "sensor.hk1_power": "0", "sensor.hk2_power": "0", "sensor.p1_power": "760",
        "sensor.temp_c1": "19.0", "sensor.aussen": "4.5", "sensor.regen": "6.4",
    }.items():
        hass.states.async_set(eid, wert)
    entry = MockConfigEntry(
        domain=DOMAIN, title="B1", data={"name": "B1"},
        options={"heizung": True, "pumpen": True, "status": "aktiv", "beginn": "2026-09-01",
                 "heizperiode_von": "10", "heizperiode_bis": "4", "empfaenger": ["mobile_app_test"],
                 "temp_sensor": "sensor.aussen", "regen_sensor": "sensor.regen"},
        subentries_data=[
            _sub(C1, "bereich", "Container 1", {"name": "Container 1", "art": "container", "fuehler": "sensor.temp_c1"}),
            _sub(C2, "bereich", "Container 2", {"name": "Container 2", "art": "container"}),
            _sub(SCHACHT, "bereich", "Schacht", {"name": "Schacht", "art": "pumpenschacht"}),
            _sub(HK1, "geraet", "Heizkörper 1", {"bereich": C1, "schalter": "switch.hk1", "name": "Heizkörper 1",
                                                 "rolle": "heizkoerper", "typ": "oelradiator", "leistung": "sensor.hk1_power"}),
            _sub(HK2, "geraet", "Heizkörper 2", {"bereich": C2, "schalter": "switch.hk2", "name": "Heizkörper 2",
                                                 "rolle": "heizkoerper", "typ": "konvektor", "leistung": "sensor.hk2_power"}),
            _sub(P1, "geraet", "Pumpe 1", {"bereich": SCHACHT, "schalter": "switch.p1", "name": "Pumpe 1",
                                           "rolle": "pumpe", "typ": "konvektor", "leistung": "sensor.p1_power"}),
        ],
    )
    entry.add_to_hass(hass)
    hass.services.async_register("notify", "mobile_app_test", lambda call: None)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    # Uhr erst nach dem Einrichten stellen (eingefrorene Zeit stört sonst das Anlegen der Entitäten)
    freezer.move_to("2026-09-29 16:50:00+02:00")  # Dienstag, Plan 06:00–16:30
    entry.runtime_data.auswerten()
    await hass.async_block_till_done()
    return entry


def _eid(hass, platform, unique_id) -> str:
    reg = er.async_get(hass)
    eid = reg.async_get_entity_id(platform, DOMAIN, unique_id)
    assert eid, (unique_id, sorted((e.domain, e.unique_id) for e in reg.entities.values() if e.unique_id.startswith("sub_")))
    return eid


async def test_entitaeten_und_automatik_aus_schaltet_nichts(hass: HomeAssistant, baustelle) -> None:
    an = async_mock_service(hass, "switch", "turn_on")
    st = baustelle.runtime_data
    st.auswerten()
    await hass.async_block_till_done()
    assert an == []
    assert hass.states.get(_eid(hass, "sensor", f"{baustelle.entry_id}_status")).state == "automatik_aus"
    assert hass.states.get(_eid(hass, "switch", f"{baustelle.entry_id}_automatik")).state == "off"
    assert hass.states.get(_eid(hass, "time", f"{baustelle.entry_id}_di_ein")).state == "06:00:00"
    assert hass.states.get(_eid(hass, "sensor", f"{baustelle.entry_id}_leistung")).state == "760.0"
    # Thermostat-Modus nur mit Fühler
    assert "thermostat" in hass.states.get(_eid(hass, "select", f"{C1}_modus")).attributes["options"]
    assert "thermostat" not in hass.states.get(_eid(hass, "select", f"{C2}_modus")).attributes["options"]


async def test_kleidung_trocknen_nach_regen(hass: HomeAssistant, baustelle) -> None:
    an = async_mock_service(hass, "switch", "turn_on")
    st = baustelle.runtime_data
    st.einstellung_setzen(("bereiche", C2, "trocknen"), True)
    st.einstellung_setzen(("automatik",), True)
    await hass.async_block_till_done()
    assert [c.data["entity_id"] for c in an] == ["switch.hk2"]  # nur Container 2, bis 17:30
    assert hass.states.get(_eid(hass, "sensor", f"{C2}_grund")).state == "kleidung_trocknen"
    assert hass.states.get(_eid(hass, "sensor", f"{C1}_grund")).state == "ausserhalb"
    assert hass.states.get(_eid(hass, "sensor", f"{baustelle.entry_id}_status")).state == "heizt"


async def test_heizgrenze_schaltet_aus(hass: HomeAssistant, baustelle, freezer) -> None:
    aus = async_mock_service(hass, "switch", "turn_off")
    st = baustelle.runtime_data
    freezer.move_to("2026-09-29 10:00:00+02:00")
    hass.states.async_set("switch.hk1", "on")
    st.einstellung_setzen(("automatik",), True)
    hass.states.async_set("sensor.aussen", "17")
    await hass.async_block_till_done()
    assert "switch.hk1" in [c.data["entity_id"] for c in aus]
    assert hass.states.get(_eid(hass, "sensor", f"{baustelle.entry_id}_status")).state == "heizgrenze"


async def test_hand_geschaltet_setzt_handbetrieb(hass: HomeAssistant, baustelle) -> None:
    st = baustelle.runtime_data
    st.einstellung_setzen(("automatik",), True)
    hass.states.async_set("switch.hk1", "on", context=Context(user_id="nutzer"))
    await hass.async_block_till_done()
    assert st.einstellungen.bereich(C1)["modus"] == "hand"
    assert hass.states.get(_eid(hass, "select", f"{C1}_modus")).state == "hand"


async def test_pumpe_trockenlauf_meldet(hass: HomeAssistant, baustelle, freezer) -> None:
    meldungen = async_mock_service(hass, "notify", "mobile_app_test")
    hass.states.async_set("sensor.p1_power", "120")
    await hass.async_block_till_done()
    assert meldungen == []  # erst nach einer Minute
    freezer.tick(timedelta(minutes=2))
    baustelle.runtime_data.auswerten()  # sonst der Minutentakt von HA
    await hass.async_block_till_done()
    assert len(meldungen) == 1 and "Trockenlauf" in meldungen[0].data["message"]
    problem = hass.states.get(_eid(hass, "binary_sensor", f"{P1}_problem"))
    assert problem.state == "on" and problem.attributes["probleme"] == ["trockenlauf"]
    # nicht nochmal melden
    freezer.tick(timedelta(minutes=1))
    baustelle.runtime_data.auswerten()
    await hass.async_block_till_done()
    assert len(meldungen) == 1


async def test_baustelle_nicht_erreichbar(hass: HomeAssistant, baustelle) -> None:
    meldungen = async_mock_service(hass, "notify", "mobile_app_test")
    for eid in ("switch.hk1", "switch.hk2", "switch.p1"):
        hass.states.async_set(eid, "unavailable")
    await hass.async_block_till_done()
    assert hass.states.get(_eid(hass, "binary_sensor", f"{baustelle.entry_id}_erreichbar")).state == "off"
    assert len(meldungen) == 1 and "Stromausfall" in meldungen[0].data["message"]


async def test_bereich_loeschen_laedt_neu(hass: HomeAssistant, baustelle) -> None:
    hass.config_entries.async_remove_subentry(baustelle, HK2)
    await hass.async_block_till_done()
    assert HK2 not in baustelle.runtime_data.geraete
    assert er.async_get(hass).async_get_entity_id("binary_sensor", DOMAIN, f"{HK2}_problem") is None


async def test_entladen(hass: HomeAssistant, baustelle) -> None:
    assert await hass.config_entries.async_unload(baustelle.entry_id)
    await hass.async_block_till_done()


async def test_problem_sensor_haengt_am_shelly_geraet(hass: HomeAssistant) -> None:
    from homeassistant.helpers import device_registry as dr

    shelly_entry = MockConfigEntry(domain="shelly", title="Shelly")
    shelly_entry.add_to_hass(hass)
    geraet = dr.async_get(hass).async_get_or_create(
        config_entry_id=shelly_entry.entry_id, identifiers={("shelly", "a1f3")}, name="Shelly Plug S a1f3"
    )
    er.async_get(hass).async_get_or_create(
        "switch", "shelly", "a1f3-relay", suggested_object_id="plug_a1f3", device_id=geraet.id, config_entry=shelly_entry
    )
    er.async_get(hass).async_get_or_create(
        "sensor", "shelly", "a1f3-power", suggested_object_id="plug_a1f3_power", device_id=geraet.id,
        config_entry=shelly_entry, original_device_class="power",
    )
    hass.states.async_set("switch.plug_a1f3", "off")
    entry = MockConfigEntry(
        domain=DOMAIN, title="B2", data={"name": "B2"},
        options={"heizung": True, "pumpen": False, "status": "aktiv", "beginn": "2026-09-01",
                 "heizperiode_von": "10", "heizperiode_bis": "4", "empfaenger": []},
        subentries_data=[
            _sub("c", "bereich", "C", {"name": "C", "art": "container"}),
            _sub("g", "geraet", "HK", {"bereich": "c", "schalter": "switch.plug_a1f3", "name": "HK",
                                       "rolle": "heizkoerper", "typ": "konvektor"}),
        ],
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    problem = er.async_get(hass).async_get(_eid(hass, "binary_sensor", "g_problem"))
    assert problem.device_id == geraet.id
    # Leistungssensor am Shelly automatisch gefunden
    assert entry.runtime_data.geraete["g"].leistung == "sensor.plug_a1f3_power"


def test_prognose_auswerten() -> None:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from custom_components.baustelle.steuerung import _prognose_auswerten

    tz = ZoneInfo("UTC")
    jetzt = datetime(2026, 9, 29, 16, 0, tzinfo=tz)
    stunden = [
        {"datetime": "2026-09-29T15:00:00+00:00", "temperature": 9.0, "precipitation": 1.2},
        {"datetime": "2026-09-29T17:00:00+00:00", "temperature": 7.0, "precipitation": 0.8},
        {"datetime": "2026-09-30T04:00:00+00:00", "temperature": 1.0},
        {"datetime": "2026-09-30T06:00:00+00:00", "temperature": -1.5},
        {"datetime": "2026-09-30T12:00:00+00:00", "temperature": 12.0},
    ]
    from homeassistant.util import dt as dt_util

    dt_util.set_default_time_zone(tz)
    p = _prognose_auswerten(stunden, "hourly", jetzt)
    assert p == {"max_heute": 9.0, "frueh": -1.5, "regen_heute": 2.0}
    tage = [{"datetime": "2026-09-29T00:00:00+00:00", "temperature": 10.0, "templow": 3.0, "precipitation": 4.0},
            {"datetime": "2026-09-30T00:00:00+00:00", "temperature": 11.0, "templow": -2.0}]
    assert _prognose_auswerten(tage, "daily", jetzt) == {"max_heute": 10.0, "frueh": -2.0, "regen_heute": 4.0}
