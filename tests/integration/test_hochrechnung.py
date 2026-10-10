"""Hochrechnung mit Energiesignatur (BSM-033.02): Tage aus der Datenbank → Signatur je Container → Sensor und Auswertung."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import delete, insert

from homeassistant.core import HomeAssistant

from custom_components.baustelle.db import DATA_DB, schema as s
from custom_components.baustelle.funktionen.heizung import Heizung
from custom_components.baustelle.funktionen.heizung.hochrechnung import async_rechnen, werte, zeitraum

from .conftest import C1, C2, baustelle_anlegen

WIEN = ZoneInfo("Europe/Vienna")
HEUTE = date(2026, 11, 20)


def modell(t: float) -> float:
    return 1.0 + 2.0 * max(0.0, 15.0 - t)


async def _tage_eintragen(hass: HomeAssistant, bid: str, *, notbetrieb: date | None = None) -> None:
    """30 Tage vor heute in `tag_bereich`, dazu je Tag eine ganze Minuten-Zeile (Notbetrieb: Quelle notprogramm)."""
    db = hass.data[DATA_DB]
    tage = [HEUTE - timedelta(days=i) for i in range(1, 31)]
    tb = [{"bereich_id": bid, "datum": d, "baustelle_id": hass.config_entries.async_entries("baustelle")[0].entry_id,
           "kwh": modell(-3 + i % 22), "aussen_mittel": -3 + i % 22, "strom_min": 1.0} for i, d in enumerate(tage)]
    bm = [{"bereich_id": bid, "zeit": datetime.combine(d, datetime.min.time(), WIEN), "baustelle_id": z["baustelle_id"],
           "dauer_s": int((datetime.combine(d + timedelta(days=1), datetime.min.time(), WIEN)
                           - datetime.combine(d, datetime.min.time(), WIEN)).total_seconds()),
           "quelle": "notprogramm" if d == notbetrieb else "ha"} for d, z in zip(tage, tb)]

    def schreiben(v):
        v.execute(delete(s.tag_bereich).where(s.tag_bereich.c.bereich_id == bid))
        v.execute(delete(s.bereich_minute).where(s.bereich_minute.c.bereich_id == bid))
        v.execute(insert(s.tag_bereich), tb)
        v.execute(insert(s.bereich_minute), bm)
        return True
    assert await db.async_ausfuehren(schreiben) is not None


@pytest.fixture
async def baustelle_november(hass: HomeAssistant, freezer, shellys, nachrichten):
    entry = await baustelle_anlegen(hass, freezer, zeit="2026-11-20 10:00:00+01:00")
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_hochrechnung_aus_der_datenbank(hass: HomeAssistant, baustelle_november) -> None:
    st = baustelle_november.runtime_data
    hz = Heizung.von(st)
    assert zeitraum(st, HEUTE) == (date(2026, 10, 1), date(2027, 4, 30))
    await _tage_eintragen(hass, C1)
    await _tage_eintragen(hass, C2, notbetrieb=HEUTE - timedelta(days=3))
    st.lz["wetter_tage"] = {(HEUTE + timedelta(days=1)).isoformat(): {"mittel": -8.0}}
    await async_rechnen(hass, hz)
    erg = hz.hochrechnung
    assert erg is not None and erg["vorhersage_tage"] == 1
    je = {c["bereich"]: c for c in erg["container"]}
    assert je[C1]["methode"] == "signatur" and je[C1]["tage"] == 30
    assert je[C1]["grenze"] == pytest.approx(15.0) and je[C1]["kwh_je_grad"] == pytest.approx(2.0)
    assert je[C2]["tage"] == 29                                     # Tag im Notbetrieb zählt nicht
    # Sensor und Auswertung: bisher (Zähler) + Rest beider Container, Spanne um die Mitte
    st.zaehler["energie_heizen"] = 500.0
    w = werte(hz, 500.0)
    assert w["methode"] == "signatur"
    assert w["mit_kwh"] == pytest.approx(500.0 + je[C1]["rest_kwh"] + je[C2]["rest_kwh"])
    assert w["unten_kwh"] < w["mit_kwh"] < w["oben_kwh"]
    assert hz.hochrechnung_heizperiode("energie_heizen") == pytest.approx(w["mit_kwh"])


async def test_ohne_tage_bleibt_der_tagesschnitt(hass: HomeAssistant, baustelle_november) -> None:
    st = baustelle_november.runtime_data
    hz = Heizung.von(st)
    await async_rechnen(hass, hz)
    assert hz.hochrechnung is not None
    assert {c["methode"] for c in hz.hochrechnung["container"]} == {"keine"}
    assert werte(hz, 100.0)["mit_kwh"] is None
    st.zaehler["energie_heizen"] = 100.0
    st.zaehler["seit"] = (datetime(2026, 11, 10, tzinfo=WIEN)).isoformat()
    assert hz.hochrechnung_heizperiode("energie_heizen") == pytest.approx(100.0 / 10.4167 * 212, rel=0.02)
