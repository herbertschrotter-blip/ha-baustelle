"""BSM-031.06b: Umbenennen zieht die Langzeitstatistik mit – eigene Datei: der Recorder muss vor HA eingerichtet werden."""

from datetime import timedelta

import pytest

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .conftest import baustelle_anlegen
from .test_umbenennen import _container, _senden, _shellys_im_register


@pytest.fixture(autouse=True)
def eigene_integration(async_test_recorder, enable_custom_integrations):
    """Wie in conftest, aber den Recorder vorher vorbereiten (sonst ist HA schon eingerichtet)."""
    return


async def test_statistik_zieht_mit(recorder_mock, hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """HA zieht die Langzeitstatistik bei geänderter Entity-ID selbst mit (Bauplan Inventar §6.3)."""
    from homeassistant.components.recorder.models import StatisticMeanType   # noqa: PLC0415
    from homeassistant.components.recorder.statistics import async_import_statistics, list_statistic_ids   # noqa: PLC0415
    from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done  # noqa: PLC0415

    _shellys_im_register(hass)   # ohne Fixture: der Recorder muss vor HA stehen
    entry = await baustelle_anlegen(hass, freezer, zeit=dt_util.now().isoformat())
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    start = dt_util.now().replace(minute=0, second=0, microsecond=0) - timedelta(hours=3)
    async_import_statistics(hass, {"source": "recorder", "statistic_id": "sensor.hk1_energie", "name": None,
                                   "unit_of_measurement": "kWh", "has_sum": True, "mean_type": StatisticMeanType.NONE,
                                   "unit_class": "energy"},
                            [{"start": start, "sum": 1.5, "state": 1.5}])
    await async_wait_recording_done(hass)
    ws = await hass_ws_client(hass)
    cid = await _container(ws, entry)
    antwort = await _senden(ws, 2, type="baustelle/inventar_umbenennen", container_id=cid)
    assert antwort["success"], antwort
    await hass.async_block_till_done()
    await async_wait_recording_done(hass)
    from homeassistant.components.recorder import get_instance   # noqa: PLC0415
    ids = {s["statistic_id"] for s in await get_instance(hass).async_add_executor_job(list_statistic_ids, hass)}
    assert "sensor.001_01_c_plug_man_energie" in ids and "sensor.hk1_energie" not in ids
