"""Aufbau anlegen und auf den Stand `SCHEMA_VERSION` bringen (nummerierte Schritte, docs/bauplan-datenbank.md §3.1).

Vor jeder Migration einer bestehenden SQLite-Datei bleibt eine Kopie `baustelle.db.vor-<n>` liegen. Eine Datenbank, die
neuer ist als dieser Code (z. B. nach dem Einspielen einer älteren Version), wird nicht angefasst.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
import shutil

from sqlalchemy import Connection, Engine, func, inspect, insert, select, text

from homeassistant.util import dt as dt_util

from .schema import JSON_TABELLEN, LESER, SCHEMA_VERSION, ansichten, metadata, schema_version


class DatenbankNeuer(Exception):
    """Die Datenbank hat einen neueren Aufbau als dieser Code."""


def _schritt_1(verbindung: Connection) -> None:
    metadata.create_all(verbindung, checkfirst=True)


def _schritt_2(verbindung: Connection) -> None:
    """JSON-Spalten in SQLite als Text neu anlegen. Die Tabellen sind bis dahin leer (gefüllt erst ab Phase 2, die mit
    diesem Schritt kommt); stehen doch Zeilen drin, wird abgebrochen statt Daten zu verlieren."""
    if verbindung.dialect.name != "sqlite":
        return
    for name in JSON_TABELLEN:
        if verbindung.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar():   # noqa: S608 – feste Namen
            raise RuntimeError(f"Tabelle {name} ist nicht leer – Aufbau 2 bitte von Hand nachziehen")
        verbindung.execute(text(f'DROP TABLE "{name}"'))
    metadata.create_all(verbindung, tables=[metadata.tables[n] for n in JSON_TABELLEN])


def _schritt_3(verbindung: Connection) -> None:
    """Tagessummen bekommen „tatsächlich geheizt“ (strom_min); die Tage rechnet die Integration danach neu (tage.py)."""
    for tabelle in ("tag_geraet", "tag_bereich"):
        spalten = {c["name"] for c in inspect(verbindung).get_columns(tabelle)}
        if "strom_min" not in spalten:
            verbindung.execute(text(f'ALTER TABLE "{tabelle}" ADD COLUMN strom_min FLOAT'))


def _schritt_4(verbindung: Connection) -> None:
    """Minuten bekommen die Sekunden mit Leistung über „zieht Strom“ (sekunden_strom) – die Übernahme füllt sie nach."""
    if "sekunden_strom" not in {c["name"] for c in inspect(verbindung).get_columns("geraet_minute")}:
        verbindung.execute(text('ALTER TABLE "geraet_minute" ADD COLUMN sekunden_strom INTEGER'))


def _schritt_5(verbindung: Connection) -> None:
    """Jeder Messwert der Leistung (Tabelle messwert) – die Übernahme füllt die letzten 62 Tage aus dem HA-Verlauf."""
    metadata.create_all(verbindung, tables=[metadata.tables["messwert"]], checkfirst=True)


def _schritt_6(verbindung: Connection) -> None:
    """Meldungen vollständig als JSON (Spalte daten) – die Datenbank wird ihre Quelle (BSM-015)."""
    if "daten" not in {c["name"] for c in inspect(verbindung).get_columns("meldung")}:
        verbindung.execute(text('ALTER TABLE "meldung" ADD COLUMN daten TEXT'))


def ansichten_anlegen(verbindung: Connection) -> None:
    """Ansichten für Excel/Power BI neu anlegen (bei jeder Änderung ihrer Abfrage wieder aufrufen, neuer Aufbau)."""
    for name, abfrage in ansichten(verbindung.dialect.name).items():
        verbindung.execute(text(f'DROP VIEW IF EXISTS "{name}"'))
        verbindung.execute(text(f'CREATE VIEW "{name}" AS {abfrage}'))   # noqa: S608 – feste Abfragen aus schema.py


def _schritt_7(verbindung: Connection) -> None:
    """Ansichten für außerhalb (BSM-026, Bauplan §2.5)."""
    ansichten_anlegen(verbindung)


SCHRITTE: dict[int, Callable[[Connection], None]] = {1: _schritt_1, 2: _schritt_2, 3: _schritt_3, 4: _schritt_4, 5: _schritt_5,
                                                     6: _schritt_6, 7: _schritt_7}


def leser_rechte(verbindung: Connection) -> None:
    """PostgreSQL: der Lese-Benutzer (falls angelegt) darf genau die Ansichten lesen – bei jedem Start nachgezogen."""
    if verbindung.dialect.name != "postgresql":
        return
    if not verbindung.execute(text("SELECT 1 FROM pg_roles WHERE rolname = :r"), {"r": LESER}).scalar():
        return
    for name in ansichten("postgresql"):
        verbindung.execute(text(f'GRANT SELECT ON "{name}" TO "{LESER}"'))


def stand(verbindung: Connection) -> int:
    """Stand des Aufbaus (0 = leer)."""
    if not inspect(verbindung).has_table("schema_version"):
        return 0
    return int(verbindung.execute(select(func.max(schema_version.c.version))).scalar() or 0)


def migrieren(engine: Engine, pfad: Path | None) -> int:
    """Aufbau anlegen bzw. nachziehen; liefert den Stand danach."""
    with engine.connect() as verbindung:
        vorher = stand(verbindung)
    if vorher > SCHEMA_VERSION:
        raise DatenbankNeuer(f"Datenbank hat Aufbau {vorher}, diese Version kennt {SCHEMA_VERSION}")
    if vorher == SCHEMA_VERSION:
        return vorher
    if vorher > 0 and pfad is not None and pfad.exists():
        shutil.copy2(pfad, pfad.with_name(f"{pfad.name}.vor-{SCHEMA_VERSION}"))
    with engine.begin() as verbindung:
        for nr in range(vorher + 1, SCHEMA_VERSION + 1):
            SCHRITTE[nr](verbindung)
            verbindung.execute(insert(schema_version).values(version=nr, angewendet=dt_util.utcnow()))
    return SCHEMA_VERSION


# Zeitreihen auf PostgreSQL mit TimescaleDB (Phase 8, BSM-026): Tabelle → Zeitspalte. Eine Hypertable braucht die
# Zeitspalte in jedem eindeutigen Schlüssel – messwert und ereignis haben eine laufende Nummer und bekommen auf
# PostgreSQL den Schlüssel (id, zeit); SQLite bleibt unverändert.
ZEITREIHEN = {"geraet_minute": "zeit", "bereich_minute": "zeit", "wetter_minute": "zeit", "messwert": "zeit", "ereignis": "zeit"}
MIT_NUMMER = ("messwert", "ereignis")


def zeitreihen_einrichten(verbindung: Connection) -> None:
    """Auf PostgreSQL: TimescaleDB-Erweiterung und Hypertables, bei jedem Start nachgezogen (wiederholbar). Ohne die
    Erweiterung (reines PostgreSQL) bleiben es normale Tabellen."""
    if verbindung.dialect.name != "postgresql":
        return
    vorhanden = verbindung.execute(text("SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb'")).scalar()
    if not vorhanden:
        return
    verbindung.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb"))
    for tabelle, zeit in ZEITREIHEN.items():
        if tabelle in MIT_NUMMER:
            schluessel = verbindung.execute(text(
                "SELECT array_agg(a.attname::text ORDER BY a.attname) FROM pg_index i "
                "JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) "
                "WHERE i.indrelid = CAST(:t AS regclass) AND i.indisprimary"), {"t": tabelle}).scalar() or []
            if list(schluessel) == ["id"]:
                verbindung.execute(text(f'ALTER TABLE "{tabelle}" DROP CONSTRAINT "{tabelle}_pkey"'))
                verbindung.execute(text(f'ALTER TABLE "{tabelle}" ADD PRIMARY KEY (id, "{zeit}")'))
        verbindung.execute(text(
            "SELECT create_hypertable(CAST(:t AS regclass), by_range(:z), if_not_exists => TRUE, migrate_data => TRUE)"),
            {"t": tabelle, "z": zeit})

