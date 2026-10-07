"""Phase 8 (BSM-026, docs/bauplan-datenbank.md §4a): PostgreSQL mit TimescaleDB über `db_url` – Adresse, YAML,
Hypertables, Umzug von der SQLite-Datei. Die PostgreSQL-Tests brauchen BAUSTELLE_TEST_PG (tools/pg-test.sh)."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine, insert, select, text

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.baustelle.const import DOMAIN
from custom_components.baustelle.db import DATA_DB, DATEI
from custom_components.baustelle.db import schema as s
from custom_components.baustelle.db.migration import ZEITREIHEN, migrieren
from custom_components.baustelle.db.verbindung import Datenbank, url_pruefen

from .conftest import baustelle_anlegen, nur_postgres, pg_frisch, zeilen_db


def test_url_auf_psycopg() -> None:
    assert url_pruefen("postgresql://bau:geheim@db:5432/baustelle") == "postgresql+psycopg://bau:geheim@db:5432/baustelle"
    assert url_pruefen("postgres://bau@db/baustelle") == "postgresql+psycopg://bau@db/baustelle"
    assert url_pruefen("postgresql+psycopg://bau@db/baustelle") == "postgresql+psycopg://bau@db/baustelle"
    assert url_pruefen("sqlite:////tmp/x.db") == "sqlite:////tmp/x.db"


def test_ort_ohne_passwort(hass: HomeAssistant) -> None:
    db = Datenbank(hass, Path("/tmp/x.db"), "postgresql://bau:geheim@db:5432/baustelle")
    assert db.postgres and "geheim" not in db.ort and "***" in db.ort
    assert "geheim" not in str(db.info())


@nur_postgres
async def test_db_url_aus_yaml_und_zeitreihen(hass: HomeAssistant, freezer) -> None:
    """`baustelle: db_url:` in YAML → PostgreSQL; TimescaleDB-Hypertables, messwert/ereignis mit Schlüssel (id, zeit)."""
    url = pg_frisch("baustelle_yaml")
    assert await async_setup_component(hass, DOMAIN, {DOMAIN: {"db_url": url.replace("postgresql+psycopg", "postgresql")}})
    entry = await baustelle_anlegen(hass, freezer)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    db = hass.data[DATA_DB]
    assert db.bereit and db.postgres and db.fehler is None and "baustelle_yaml" in db.ort
    assert db.info()["art"] == "postgresql" and db.info()["groesse_mb"] > 0
    assert not Path(hass.config.path(DATEI)).exists()   # keine SQLite-Datei nebenher
    with db.engine.connect() as v:
        hyper = {z[0] for z in v.execute(text("SELECT hypertable_name FROM timescaledb_information.hypertables"))}
        schluessel = v.execute(text(
            "SELECT array_agg(a.attname::text ORDER BY a.attname) FROM pg_index i JOIN pg_attribute a "
            "ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = 'messwert'::regclass AND i.indisprimary")).scalar()
    assert hyper == set(ZEITREIHEN) and list(schluessel) == ["id", "zeit"]
    assert zeilen_db(hass, "baustelle") and zeilen_db(hass, "instanz")


@nur_postgres
async def test_umzug_von_sqlite(hass: HomeAssistant, freezer) -> None:
    """Neue PostgreSQL-Datenbank + vorhandene SQLite-Datei → alles einmal kopiert, Nummern laufen weiter, Datei bleibt."""
    pfad = Path(hass.config.path(DATEI))
    pfad.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{pfad}")
    zeit = datetime(2026, 9, 1, 6, 0, tzinfo=UTC)
    migrieren(engine, pfad)
    with engine.begin() as v:
        v.execute(insert(s.instanz).values(id="alt", name="Pi", angelegt=zeit))
        v.execute(insert(s.protokoll), [{"id": 40 + i, "zeit": zeit + timedelta(minutes=i), "baustelle_id": "b-alt",
                                          "bereich_id": None, "art": "einstellung", "text": f"alt {i}"} for i in range(3)])
        v.execute(insert(s.zustand).values(baustelle_id="b-alt", schluessel="lernen", wert={"k": 21.5}, geaendert=zeit))
        v.execute(insert(s.geraet_minute).values(geraet_id="g1", zeit=zeit, baustelle_id="b-alt", dauer_s=60, sekunden_ein=60, quelle="ha"))
    engine.dispose()
    groesse = pfad.stat().st_size

    entry = await baustelle_anlegen(hass, freezer)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    db = hass.data[DATA_DB]
    assert db.bereit and db.postgres, db.fehler
    texte = {r["id"]: r["text"] for r in zeilen_db(hass, "protokoll") if r["baustelle_id"] == "b-alt"}
    assert texte == {40: "alt 0", 41: "alt 1", 42: "alt 2"}
    with db.engine.begin() as v:
        neu = v.execute(insert(s.protokoll).values(zeit=zeit, baustelle_id="b-alt", art="einstellung", text="neu")
                        .returning(s.protokoll.c.id)).scalar()
        (minute,) = v.execute(select(s.geraet_minute).where(s.geraet_minute.c.geraet_id == "g1")).all()
        lernen = v.execute(select(s.zustand.c.wert).where(s.zustand.c.schluessel == "lernen")).scalar()
        umzug = v.execute(select(s.zustand.c.wert).where(s.zustand.c.schluessel == "umzug")).scalar()
    assert neu > 42   # Nummern laufen nach dem Umzug weiter
    assert minute.zeit == zeit and minute.sekunden_ein == 60 and lernen == {"k": 21.5}
    assert umzug["von"] == str(pfad) and umzug["zeilen"]["protokoll"] == 3
    assert any(r["id"] == "alt" for r in zeilen_db(hass, "instanz"))
    assert pfad.stat().st_size == groesse   # SQLite-Datei bleibt unverändert (Rückweg)
