"""Eigene Datenbank, Phase 1 (docs/bauplan-datenbank.md, BSM-006): anlegen, Stammdaten spiegeln, Sicherung, Fehler."""

from pathlib import Path
import sqlite3

from sqlalchemy import create_engine, insert, select

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.baustelle import backup
from custom_components.baustelle.db import DATA_DB, DATEI
from custom_components.baustelle.db import schema as s
from custom_components.baustelle.db.migration import migrieren
from custom_components.baustelle.db.schema import SCHEMA_VERSION

from .conftest import C1, C2, HK1, HK2, P1, SCHACHT, baustelle_anlegen, eid


def _zeilen(hass: HomeAssistant, tabelle: str) -> list[sqlite3.Row]:
    verbindung = sqlite3.connect(hass.config.path(DATEI))
    verbindung.row_factory = sqlite3.Row
    try:
        return list(verbindung.execute(f"SELECT * FROM {tabelle}"))   # noqa: S608 – feste Tabellennamen im Test
    finally:
        verbindung.close()


async def test_angelegt_und_stammdaten(hass: HomeAssistant, baustelle) -> None:
    await hass.async_block_till_done()
    db = hass.data[DATA_DB]
    assert db.bereit and db.version == SCHEMA_VERSION and db.fehler is None
    assert Path(hass.config.path(DATEI)).exists()
    assert [r["version"] for r in _zeilen(hass, "schema_version")] == [SCHEMA_VERSION]
    assert len(_zeilen(hass, "instanz")) == 1
    (b,) = _zeilen(hass, "baustelle")
    assert b["id"] == baustelle.entry_id and b["titel"] == "B1" and b["status"] == "aktiv" and b["entfernt"] is None
    bereiche = {r["id"]: r for r in _zeilen(hass, "bereich")}
    assert set(bereiche) == {C1, C2, SCHACHT} and bereiche[SCHACHT]["art"] == "pumpenschacht"
    geraete = {r["id"]: r for r in _zeilen(hass, "geraet")}
    assert set(geraete) == {HK1, HK2, P1} and geraete[P1]["rolle"] == "pumpe" and geraete[HK1]["bereich_id"] == C1
    assert all(r["entfernt"] is None for r in [*bereiche.values(), *geraete.values()])
    assert _zeilen(hass, "preis") and _zeilen(hass, "anschluss") and _zeilen(hass, "arbeitszeit")
    # Diagnose-Sensor und Diagnose-Download
    zustand = hass.states.get(eid(hass, "sensor", f"{baustelle.entry_id}_datenbank"))
    assert zustand is not None and float(zustand.state) >= 0 and zustand.attributes["zustand"] == "ok"
    assert zustand.attributes["schema_version"] == SCHEMA_VERSION


async def test_geraet_entfernt_bleibt_als_entfernt(hass: HomeAssistant, baustelle) -> None:
    await hass.async_block_till_done()
    assert hass.config_entries.async_remove_subentry(baustelle, HK2)
    await hass.async_block_till_done()
    geraete = {r["id"]: r for r in _zeilen(hass, "geraet")}
    assert geraete[HK2]["entfernt"] is not None and geraete[HK1]["entfernt"] is None   # Zeile bleibt (Messwerte)


async def test_liste_spiegelt_sofort(hass: HomeAssistant, baustelle, hass_ws_client) -> None:
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "baustelle/liste", "entry_id": baustelle.entry_id, "liste": "ausnahmen",
                        "aktion": "speichern", "eintrag": {"datum": "2026-10-02", "art": "zeiten", "von": "07:00", "bis": "12:00"}})
    assert (await ws.receive_json())["success"]
    await hass.async_block_till_done()
    (a,) = [r for r in _zeilen(hass, "ausnahme") if r["datum"] == "2026-10-02"]
    assert (a["art"], a["von"], a["bis"]) == ("zeiten", 7 * 60, 12 * 60)


async def test_sicherung_haelt_an(hass: HomeAssistant, baustelle) -> None:
    await hass.async_block_till_done()
    db = hass.data[DATA_DB]
    await backup.async_pre_backup(hass)
    assert db.angehalten and db.info()["zustand"] == "angehalten" and db.fehler is None
    assert not Path(hass.config.path(DATEI) + "-wal").exists() or Path(hass.config.path(DATEI) + "-wal").stat().st_size == 0
    db.schreiber.dazu(lambda v: v.execute(insert(s.protokoll).values(
        zeit=dt_util.utcnow(), baustelle_id=baustelle.entry_id, art="einstellung", text="während der Sicherung")))
    assert not await db.schreiber.async_schreiben() and len(db.schreiber) == 1
    assert not _zeilen(hass, "protokoll")
    await backup.async_post_backup(hass)
    assert db.fehler is None, db.fehler
    assert not db.angehalten and len(db.schreiber) == 0
    assert [r["text"] for r in _zeilen(hass, "protokoll")] == ["während der Sicherung"]


async def test_zweiter_start_aendert_nichts(hass: HomeAssistant, baustelle) -> None:
    await hass.async_block_till_done()
    engine = create_engine(f"sqlite:///{hass.config.path(DATEI)}")
    try:
        assert migrieren(engine, Path(hass.config.path(DATEI))) == SCHEMA_VERSION
        with engine.connect() as v:
            assert len(v.execute(select(s.schema_version)).all()) == 1
    finally:
        engine.dispose()
    assert not list(Path(hass.config.path("baustelle")).glob("baustelle.db.vor-*"))   # keine Kopie ohne Migration


async def test_neuere_datenbank_haelt_integration_nicht_an(hass: HomeAssistant, freezer, shellys, nachrichten) -> None:
    """Datenbank mit neuerem Aufbau (z. B. ältere Version eingespielt): nicht anfassen, Integration läuft, Fehler sichtbar."""
    pfad = Path(hass.config.path(DATEI))
    pfad.parent.mkdir(parents=True, exist_ok=True)
    verbindung = sqlite3.connect(pfad)
    verbindung.execute("CREATE TABLE schema_version (version INTEGER PRIMARY KEY, angewendet TIMESTAMP)")
    verbindung.execute("INSERT INTO schema_version VALUES (99, '2030-01-01')")
    verbindung.commit()
    verbindung.close()
    entry = await baustelle_anlegen(hass, freezer)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    db = hass.data[DATA_DB]
    assert not db.bereit and "99" in (db.fehler or "")
    assert entry.state.name == "LOADED"
    zustand = hass.states.get(eid(hass, "sensor", f"{entry.entry_id}_datenbank"))
    assert zustand.attributes["zustand"] == "fehler"
    assert [r["version"] for r in _zeilen(hass, "schema_version")] == [99]   # unverändert
