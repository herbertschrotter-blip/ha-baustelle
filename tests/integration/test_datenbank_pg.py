"""Phase 8 (BSM-026, docs/bauplan-datenbank.md §4a): PostgreSQL mit TimescaleDB über `db_url` – Adresse, YAML,
Hypertables, Umzug von der SQLite-Datei. Die PostgreSQL-Tests brauchen BAUSTELLE_TEST_PG (tools/pg-test.sh)."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from sqlalchemy import create_engine, insert, select, text

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.baustelle.const import DOMAIN
from custom_components.baustelle.db import DATA_DB, DATEI
from custom_components.baustelle.db import schema as s
from custom_components.baustelle.db.migration import ZEITREIHEN, ansichten_anlegen, migrieren
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


async def test_ansichten_fuer_excel(hass: HomeAssistant, baustelle) -> None:
    """Aufbau 7: v_tag_firma, v_tag_container, v_monat_baustelle, v_schaltungen – summieren nur tag_* bzw. lesen ereignis
    (SQLite und PostgreSQL gleich)."""
    from datetime import date   # noqa: PLC0415

    await hass.async_block_till_done()
    db = hass.data[DATA_DB]
    bid = baustelle.entry_id
    with db.engine.begin() as v:
        v.execute(insert(s.firma).values(baustelle_id=bid, id="f-x", name="Trockenbau X", eigen=False))
        v.execute(insert(s.tag_bereich), [
            {"bereich_id": "c-a", "datum": date(2026, 9, 30), "baustelle_id": bid, "firma_id": "f-x", "kwh": 10.0, "eur": 3.0},
            {"bereich_id": "c-b", "datum": date(2026, 9, 30), "baustelle_id": bid, "firma_id": "f-x", "kwh": 5.5, "eur": 1.65},
            {"bereich_id": "c-a", "datum": date(2026, 10, 1), "baustelle_id": bid, "firma_id": "f-x", "kwh": 2.0, "eur": 0.6}])
        firma = v.execute(text("SELECT datum, firma, container, kwh, eur FROM v_tag_firma WHERE firma_id = 'f-x' ORDER BY datum")).all()
        monate = v.execute(text("SELECT monat, kwh FROM v_monat_baustelle WHERE baustelle_id = :b ORDER BY monat"), {"b": bid}).all()
        container = v.execute(text("SELECT COUNT(*) FROM v_tag_container WHERE firma = 'Trockenbau X'")).scalar()
        v.execute(text("SELECT zeit, container, geraet, quelle FROM v_schaltungen")).all()
    assert [(str(z.datum), z.firma, z.container, z.kwh) for z in firma] == [("2026-09-30", "Trockenbau X", 2, 15.5),
                                                                           ("2026-10-01", "Trockenbau X", 1, 2.0)]
    assert firma[0].eur == pytest.approx(4.65)
    assert [(str(z.monat), z.kwh) for z in monate] == [("2026-09-01", 15.5), ("2026-10-01", 2.0)]
    assert container == 3


@nur_postgres
async def test_leser_nur_ansichten(hass: HomeAssistant, freezer) -> None:
    """Lese-Benutzer (von tools/db-einrichten.sh angelegt) darf die Ansichten lesen, nicht die Tabellen."""
    from .conftest import TEST_PG   # noqa: PLC0415
    admin = create_engine(TEST_PG, isolation_level="AUTOCOMMIT")
    with admin.connect() as v:
        if not v.execute(text("SELECT 1 FROM pg_roles WHERE rolname = 'baustelle_leser'")).scalar():
            v.execute(text("CREATE ROLE baustelle_leser LOGIN"))
    admin.dispose()
    entry = await baustelle_anlegen(hass, freezer)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    with hass.data[DATA_DB].engine.connect() as v:
        recht = {t: v.execute(text("SELECT has_table_privilege('baustelle_leser', :t, 'SELECT')"), {"t": t}).scalar()
                 for t in ("v_tag_firma", "v_tag_container", "v_monat_baustelle", "v_schaltungen", "tag_bereich", "einstellung")}
    assert recht == {"v_tag_firma": True, "v_tag_container": True, "v_monat_baustelle": True, "v_schaltungen": True,
                     "tag_bereich": False, "einstellung": False}


@nur_postgres
async def test_zwei_instanzen_und_rueckweg(hass: HomeAssistant, baustelle, tmp_path) -> None:
    """8d: eine zweite Instanz zieht in dieselbe Datenbank um – Meldungen und Ticket-Zähler je Instanz, Protokoll mit
    neuen Nummern, nichts von der ersten geht verloren; Rückweg kopiert nur die Daten der zweiten Instanz."""
    from custom_components.baustelle.db.schreiber import arbeit   # noqa: PLC0415
    from custom_components.baustelle.db.speicher import meldungen_laden   # noqa: PLC0415
    from custom_components.baustelle.db.umzug import zurueck   # noqa: PLC0415

    await hass.async_block_till_done()
    a = hass.data[DATA_DB]
    zeit = datetime(2026, 10, 1, 6, 0, tzinfo=UTC)
    meldung = {"id": "m-a", "ticket": "FE-0001", "art": "fehler", "status": "neu", "text": "von A", "zeit": zeit,
               "baustelle_id": baustelle.entry_id, "daten": {"id": "m-a", "ticket": "FE-0001", "text": "von A"}}
    a.schreiber.dazu(arbeit("meldungen", a.instanz_id, [meldung], [], [], {"fehler": 1}, zeit))
    a.schreiber.dazu(arbeit("einfuegen", "protokoll", [{"zeit": zeit, "baustelle_id": baustelle.entry_id, "art": "einstellung", "text": "A1"}]))
    assert await a.schreiber.async_schreiben()

    pfad_b = tmp_path / "b" / "baustelle.db"
    pfad_b.parent.mkdir()
    engine = create_engine(f"sqlite:///{pfad_b}")
    migrieren(engine, pfad_b)
    with engine.begin() as v:
        v.execute(insert(s.instanz).values(id="inst-b", name="Pi 2", angelegt=zeit))
        v.execute(insert(s.baustelle).values(id="b-zwei", instanz_id="inst-b", titel="Zweite", status="aktiv", angelegt=zeit))
        v.execute(insert(s.protokoll), [{"id": i, "zeit": zeit, "baustelle_id": "b-zwei", "art": "einstellung", "text": f"B{i}"}
                                        for i in (1, 2, 3)])
        v.execute(insert(s.meldung).values(id="m-b", ticket="FE-0001", art="fehler", status="neu", text="von B", zeit=zeit,
                                           baustelle_id="b-zwei", daten={"id": "m-b", "ticket": "FE-0001", "text": "von B"}))
        v.execute(insert(s.zustand).values(baustelle_id="_integration", schluessel="meldungen_nummern", wert={"fehler": 1}, geaendert=zeit))
    engine.dispose()
    b = Datenbank(hass, pfad_b, a.url)
    b.instanz_id = "inst-b"
    assert await b.async_start(), b.fehler
    try:
        with a.engine.connect() as v:
            liste_a, nummern_a = meldungen_laden(v, a.instanz_id)
            liste_b, nummern_b = meldungen_laden(v, "inst-b")
            texte = sorted(r.text for r in v.execute(select(s.protokoll.c.text)))
        assert [m["text"] for m in liste_a] == ["von A"] and [m["text"] for m in liste_b] == ["von B"]
        assert nummern_a == {"fehler": 1} and nummern_b == {"fehler": 1}
        assert {"A1", "B1", "B2", "B3"} <= set(texte)
        # A ersetzt seine Meldungen – die von B bleiben
        a.schreiber.dazu(arbeit("meldungen", a.instanz_id, [{**meldung, "status": "angenommen"}], [], [], {"fehler": 1}, zeit))
        assert await a.schreiber.async_schreiben()
        with a.engine.connect() as v:
            assert [m["text"] for m in meldungen_laden(v, "inst-b")[0]] == ["von B"]
            ziel = tmp_path / "rueckweg.db"
            zahlen = zurueck(v, ziel, "inst-b")
        assert zahlen["baustelle"] == 1 and zahlen["meldung"] == 1 and zahlen["protokoll"] == 3
        rueck = create_engine(f"sqlite:///{ziel}")
        with rueck.connect() as v:
            assert [r.id for r in v.execute(select(s.baustelle))] == ["b-zwei"]
            assert sorted(r.text for r in v.execute(select(s.protokoll))) == ["B1", "B2", "B3"]
            assert {r.baustelle_id for r in v.execute(select(s.zustand))} <= {"inst-b", "b-zwei"}
        rueck.dispose()
    finally:
        await b.async_stop()


async def test_aufbau_8_mit_vorhandenen_meldungen(hass: HomeAssistant, freezer) -> None:
    """Aufbau 7 → 8 mit Daten (wie auf dem Pilot): Meldungen bleiben, bekommen die Instanz, Ticket-Zähler zieht unter die
    ID der Instanz; Ticketnummern sind danach nur je Instanz eindeutig (SQLite: Tabelle neu angelegt, PostgreSQL: ALTER)."""
    from sqlalchemy import MetaData, Table   # noqa: PLC0415
    from sqlalchemy import Column as Spalte   # noqa: PLC0415

    from custom_components.baustelle.db.speicher import meldungen_laden   # noqa: PLC0415

    from .conftest import TEST_PG, pg_url   # noqa: PLC0415
    pfad = Path(hass.config.path(DATEI))
    pfad.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(pg_url() if TEST_PG else f"sqlite:///{pfad}")
    alt = MetaData()
    for t in s.metadata.sorted_tables:   # Aufbau 7: meldung ohne instanz_id/reihe, Ticket über alle eindeutig
        if t.name != "meldung":
            t.to_metadata(alt)
            continue
        Table("meldung", alt, *[Spalte(c.name, c.type, primary_key=c.primary_key, nullable=c.nullable, unique=c.name == "ticket")
                                for c in t.columns if c.name not in ("instanz_id", "reihe")])
    alt.create_all(engine)
    zeit = datetime(2026, 9, 30, 8, 0, tzinfo=UTC)
    with engine.begin() as v:
        ansichten_anlegen(v)   # gehört zu Aufbau 7
        v.execute(insert(s.schema_version), [{"version": n, "angewendet": zeit} for n in range(1, 8)])
        v.execute(text("INSERT INTO meldung (id, ticket, art, status, text, zeit, daten) VALUES "
                       "('m1', 'FE-0001', 'fehler', 'neu', 'alt', :z, :d)"), {"z": zeit, "d": '{"id": "m1", "ticket": "FE-0001", "text": "alt"}'})
        v.execute(insert(s.zustand).values(baustelle_id="_integration", schluessel="meldungen_nummern", wert={"fehler": 1}, geaendert=zeit))
    engine.dispose()

    entry = await baustelle_anlegen(hass, freezer)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    db = hass.data[DATA_DB]
    assert db.bereit and db.version == 8, db.fehler
    with db.engine.begin() as v:
        liste, nummern = meldungen_laden(v, db.instanz_id)
        assert [m["text"] for m in liste] == ["alt"] and nummern == {"fehler": 1}
        assert not v.execute(select(s.zustand).where(s.zustand.c.baustelle_id == "_integration")).first()
        v.execute(insert(s.meldung).values(id="m2", ticket="FE-0001", art="fehler", status="neu", zeit=zeit, instanz_id="andere"))
    if not TEST_PG:
        assert pfad.with_name("baustelle.db.vor-8").exists()


async def test_dienst_rueckweg(hass: HomeAssistant, baustelle) -> None:
    """Dienst baustelle.datenbank_rueckweg: ohne PostgreSQL verständlicher Fehler, mit PostgreSQL eine neue SQLite-Datei."""
    from homeassistant.exceptions import ServiceValidationError   # noqa: PLC0415

    from .conftest import TEST_PG   # noqa: PLC0415
    await hass.async_block_till_done()
    if not TEST_PG:
        with pytest.raises(ServiceValidationError):
            await hass.services.async_call(DOMAIN, "datenbank_rueckweg", {}, blocking=True, return_response=True)
        return
    antwort = await hass.services.async_call(DOMAIN, "datenbank_rueckweg", {}, blocking=True, return_response=True)
    datei = Path(antwort["datei"])
    try:
        assert datei.exists() and antwort["zeilen"]["baustelle"] == 1 and antwort["zeilen"]["bereich"] >= 3
    finally:
        datei.unlink(missing_ok=True)
