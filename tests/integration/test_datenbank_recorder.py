"""Altdaten aus dem Recorder übernehmen (BSM-008) – eigene Datei: der Recorder muss vor HA eingerichtet werden."""

from datetime import timedelta

import pytest

from homeassistant.core import HomeAssistant

from .conftest import HK1, baustelle_anlegen
from .test_datenbank import _zeilen


@pytest.fixture(autouse=True)
def eigene_integration(async_test_recorder, enable_custom_integrations):
    """Wie in conftest, aber den Recorder vorher vorbereiten (sonst ist HA schon eingerichtet)."""
    return


async def test_uebernahme_verlauf_aus_dem_recorder(recorder_mock, hass: HomeAssistant, freezer, shellys, nachrichten) -> None:
    """Mit Recorder: Verlauf vor dem Mitschreiben wird zu Minutenzeilen (quelle import_verlauf)."""
    from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done  # noqa: PLC0415
    entry = await baustelle_anlegen(hass, freezer)
    hass.states.async_set("switch.hk1", "on")
    hass.states.async_set("sensor.hk1_power", "1500")
    freezer.tick(timedelta(minutes=5))
    hass.states.async_set("switch.hk1", "off")
    hass.states.async_set("sensor.hk1_power", "0")
    freezer.tick(timedelta(minutes=2))
    await async_wait_recording_done(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await async_wait_recording_done(hass)
    await hass.async_block_till_done()
    hk1 = [r for r in _zeilen(hass, "geraet_minute") if r["geraet_id"] == HK1 and r["quelle"] == "import_verlauf"]
    assert hk1, _zeilen(hass, "zustand")
    assert sum(r["sekunden_ein"] for r in hk1) == pytest.approx(300, abs=2)
    assert max(r["leistung_w_max"] or 0 for r in hk1) == pytest.approx(1500)
    assert sum(r["energie_wh"] or 0 for r in hk1) == pytest.approx(1500 * 5 / 60, abs=1)
    mw = [r for r in _zeilen(hass, "messwert") if r["geraet_id"] == HK1 and r["quelle"] == "import_verlauf"]
    assert [r["leistung_w"] for r in mw][-2:] == [1500.0, 0.0]          # jeder Messwert aus dem HA-Verlauf (Aufbau 5)
    wetter = [r for r in _zeilen(hass, "wetter_minute") if r["quelle"] == "import_verlauf"]
    assert wetter and all(r["aussen_temp"] == pytest.approx(4.5) for r in wetter if r["aussen_temp"] is not None)


async def test_uebernahme_nur_bis_zum_mitschreiben(recorder_mock, hass: HomeAssistant, freezer, shellys, nachrichten) -> None:
    """Wie auf dem Pi: mitgeschrieben wird schon (0.8.54), die Übernahme kommt erst mit dem nächsten Laden – keine Doppelten."""
    from pytest_homeassistant_custom_component.common import async_fire_time_changed  # noqa: PLC0415
    from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done  # noqa: PLC0415
    from custom_components.baustelle.db import DATA_DB  # noqa: PLC0415
    from custom_components.baustelle.db.uebernahme import async_uebernehmen  # noqa: PLC0415
    from homeassistant.util import dt as dt_util  # noqa: PLC0415
    entry = await baustelle_anlegen(hass, freezer)
    hass.states.async_set("switch.hk1", "on")
    freezer.tick(timedelta(minutes=3))
    await async_wait_recording_done(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    for _ in range(3):   # drei Minuten mitschreiben
        freezer.tick(timedelta(minutes=1))
        async_fire_time_changed(hass)
        await hass.async_block_till_done()
    await async_wait_recording_done(hass)
    ha = [r for r in _zeilen(hass, "geraet_minute") if r["geraet_id"] == HK1 and r["quelle"] == "ha"]
    assert len(ha) >= 3
    # zweiter Lauf „nach dem nächsten Neustart“: bis jetzt erzwungen – endet trotzdem bei der ersten mitgeschriebenen Minute
    assert await async_uebernehmen(hass, hass.data[DATA_DB], entry.runtime_data, dt_util.utcnow(), erzwingen=True) is not None
    zeilen = [r for r in _zeilen(hass, "geraet_minute") if r["geraet_id"] == HK1]
    zeiten = [r["zeit"] for r in zeilen]
    assert len(zeiten) == len(set(zeiten))   # keine Minute doppelt
    importiert = [r for r in zeilen if r["quelle"] == "import_verlauf"]
    assert importiert and max(r["zeit"] for r in importiert) < min(r["zeit"] for r in ha)


async def test_fehlende_tage_nach_der_uebernahme(recorder_mock, hass: HomeAssistant, freezer, shellys, nachrichten) -> None:
    """Nach der Übernahme stehen die Tagessummen auch für die übernommenen Tage da (BSM-009)."""
    from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done  # noqa: PLC0415
    entry = await baustelle_anlegen(hass, freezer, zeit="2026-09-28 22:30:00+02:00")
    hass.states.async_set("switch.hk1", "on")
    hass.states.async_set("sensor.hk1_power", "1000")
    freezer.tick(timedelta(hours=2))                  # über Mitternacht: zwei Tage
    await async_wait_recording_done(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await async_wait_recording_done(hass)
    await hass.async_block_till_done()
    tage = {(r["geraet_id"], r["datum"]): r for r in _zeilen(hass, "tag_geraet")}
    assert tage[(HK1, "2026-09-28")]["heizzeit_min"] == pytest.approx(90, abs=1)
    assert tage[(HK1, "2026-09-29")]["heizzeit_min"] == pytest.approx(30, abs=1)
