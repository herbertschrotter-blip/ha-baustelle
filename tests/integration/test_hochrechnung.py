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
from custom_components.baustelle.logik import auswertung as auswertung_logik

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
    st.lz["wetter_tage"] = {(HEUTE + timedelta(days=1)).isoformat(): {"mittel": -8.0}, HEUTE.isoformat(): {"mittel": 5.0}}
    await async_rechnen(hass, hz)
    erg = hz.hochrechnung
    assert erg is not None and erg["vorhersage_tage"] == 1
    # Rest von heute (10:00, noch 14 h) anteilig bei der Vorhersage für heute
    assert erg["reste"][C1].heute_kwh == pytest.approx(14 / 24 * modell(5.0))
    je = {c["bereich"]: c for c in erg["container"]}
    assert je[C1]["methode"] == "signatur" and je[C1]["tage"] == 30
    assert je[C1]["grenze"] == pytest.approx(15.0) and je[C1]["kwh_je_grad"] == pytest.approx(2.0)
    assert je[C2]["tage"] == 29                                     # Tag im Notbetrieb zählt nicht
    # Sensor und Auswertung: bisher (Tage der Heizperiode aus der Datenbank) + Rest beider Container, Spanne um die Mitte
    b = erg["bisher_kwh"]
    assert b == pytest.approx(2 * sum(modell(-3 + i % 22) for i in range(30)), rel=0.01)
    w = werte(hz)
    assert w["methode"] == "signatur"
    assert w["mit_kwh"] == pytest.approx(b + je[C1]["rest_kwh"] + je[C2]["rest_kwh"])
    assert w["unten_kwh"] < w["mit_kwh"] < w["oben_kwh"]
    assert hz.hochrechnung_heizperiode("energie_heizen") == pytest.approx(w["mit_kwh"])
    # Karte „Heizperiode“ (BSM-033.03): Tagesreihe Oktober bis April, letzter Tag = Hochrechnung; Punkte, Klima, Vorhersage
    R = erg["reihe"]
    assert R[0][0] == "2026-10-01" and R[-1][0] == "2027-04-30"
    assert R[-1][2] == pytest.approx(w["mit_kwh"], rel=1e-4) and R[-1][3] == pytest.approx(w["unten_kwh"], rel=1e-4)
    assert len(je[C1]["punkte"]) == 30 and erg["klima_vorgabe"] is True and len(erg["klima"]) == 12
    assert erg["vorhersage"] == [[(HEUTE + timedelta(days=1)).isoformat(), -8.0]]
    # BSM-033.04: Tag/Woche/Monat – Summe der Monate = Hochrechnung, heute mit Rest des Tages
    P = erg["perioden"]
    assert set(P) == {"tag", "woche", "monat"} and len(P["tag"]) == len(R) and len(P["monat"]) == 7
    assert sum(z["mit"] for z in P["monat"]) == pytest.approx(w["mit_kwh"], rel=1e-4)
    heute = next(z for z in P["tag"] if z["heute"])
    assert heute["prog"] == pytest.approx(2 * 14 / 24 * modell(5.0), rel=1e-3) and heute["quellen"] == ["vorhersage"]
    # BSM-033.04: ohne Baseline-Läufe bleibt „ohne Automatik“ die Schätzung; die Baseline startet aus
    assert erg["ohne"]["methode"] == "schaetzung" and erg["ohne"]["kwh"] is None and erg["baseline"] == {"an": False, "laeufe": []}
    # BSM-033: Signatur der ganzen Baustelle – nur Tage, an denen beide Container zählen (ohne den Notbetrieb-Tag)
    sig = erg["signatur"]
    assert sig["tage"] == 29 and sig["stand"] == "gut" and sig["kwh_je_grad"] == pytest.approx(4.0) and sig["grenze"] == pytest.approx(15.0)
    g = auswertung_logik.wetter_aus_signatur(sig, 0.25)["gerade"]
    assert g["k"] == pytest.approx(-4.0) and g["null0"] == pytest.approx(15.0) and g["eur_je_grad"] == pytest.approx(1.0)


async def test_klimamittel_einstellen(hass: HomeAssistant, baustelle_november, hass_ws_client) -> None:
    """BSM-033.03: Klimamittel als Einstellung (12 Werte, sonst abgelehnt); die Hochrechnung rechnet gleich damit."""
    st = baustelle_november.runtime_data
    hz = Heizung.von(st)
    await hass.async_block_till_done()   # Rechnung beim Start fertig, damit sie die nach dem Speichern nicht überholt
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "baustelle/setzen", "entry_id": baustelle_november.entry_id,
                        "pfad": ["heizung", "klimamittel"], "wert": [1.0] * 11})
    assert (await ws.receive_json())["success"] is False
    werte12 = [-2.0, 0.0, 4.0, 9.0, 14.0, 17.0, 19.0, 18.5, 14.0, 9.0, 3.5, -1.0]
    await ws.send_json({"id": 2, "type": "baustelle/setzen", "entry_id": baustelle_november.entry_id,
                        "pfad": ["heizung", "klimamittel"], "wert": werte12})
    assert (await ws.receive_json())["success"] is True
    await hass.async_block_till_done()
    assert st.e["heizung"]["klimamittel"] == werte12
    assert hz.hochrechnung is not None and hz.hochrechnung["klima"] == werte12 and hz.hochrechnung["klima_vorgabe"] is False


async def test_ohne_tage_bleibt_der_tagesschnitt(hass: HomeAssistant, baustelle_november) -> None:
    st = baustelle_november.runtime_data
    hz = Heizung.von(st)
    await async_rechnen(hass, hz)
    assert hz.hochrechnung is not None
    assert {c["methode"] for c in hz.hochrechnung["container"]} == {"keine"}
    assert werte(hz)["mit_kwh"] is None
    st.zaehler["energie_heizen"] = 100.0
    st.zaehler["seit"] = (datetime(2026, 11, 10, tzinfo=WIEN)).isoformat()
    assert hz.hochrechnung_heizperiode("energie_heizen") == pytest.approx(100.0 / 10.4167 * 212, rel=0.02)
