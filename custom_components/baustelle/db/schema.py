"""Aufbau der eigenen Datenbank (Schema 1, docs/bauplan-datenbank.md §2) – SQLAlchemy Core, für SQLite und PostgreSQL.

Zeiten in UTC (`DateTime(timezone=True)`), Tage als `Date` in der Zeitzone der Baustelle. IDs = IDs von HA (`entry_id`,
`subentry_id`). Entfernte Stammdaten werden nie gelöscht, sondern bekommen `entfernt`.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    TypeDecorator,
)
from sqlalchemy.engine import Dialect

SCHEMA_VERSION = 6   # 2: JSON als Text; 3: strom_min; 4: sekunden_strom; 5: messwert (BSM-014); 6: Meldung vollständig (BSM-015)

metadata = MetaData()

ID = 64   # Länge der IDs (entry_id, subentry_id, eigene IDs)


class TextJSON(TypeDecorator[Any]):
    """JSON als Text: SQLite gibt einer Spalte vom Typ „JSON“ Zahl-Affinität – `21.5` käme als Zahl zurück."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> str | None:
        return None if value is None else json.dumps(value, ensure_ascii=False)

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        return None if value is None else json.loads(value)


JSONWERT = JSON().with_variant(TextJSON(), "sqlite")   # PostgreSQL: echtes JSON
JSON_TABELLEN = ("einstellung", "zustand", "lernen", "ereignis", "meldung")


def _zeit(name: str, **kw: Any) -> Column[Any]:
    return Column(name, DateTime(timezone=True), **kw)


# ---------------------------------------------------------------------- Verwaltung
schema_version = Table(
    "schema_version", metadata,
    Column("version", Integer, primary_key=True),
    _zeit("angewendet", nullable=False),
)

# ---------------------------------------------------------------------- 2.1 Stammdaten
instanz = Table(
    "instanz", metadata,
    Column("id", String(ID), primary_key=True),          # HA-UUID der Instanz
    Column("name", String(200)),
    _zeit("angelegt", nullable=False),
)

baustelle = Table(
    "baustelle", metadata,
    Column("id", String(ID), primary_key=True),          # entry_id
    Column("instanz_id", String(ID), nullable=False),
    Column("titel", String(200), nullable=False),
    Column("status", String(20), nullable=False),
    Column("zeitzone", String(64)),
    Column("beginn", Date),
    Column("ende", Date),
    _zeit("angelegt", nullable=False),
    _zeit("abgeschlossen"),
    _zeit("entfernt"),
)

bereich = Table(
    "bereich", metadata,
    Column("id", String(ID), primary_key=True),          # subentry_id
    Column("baustelle_id", String(ID), nullable=False, index=True),
    Column("name", String(200), nullable=False),
    Column("art", String(40), nullable=False),           # container | pumpenschacht
    Column("nr", Integer),
    Column("m2", Float),
    Column("fuehler", String(255)),
    Column("tuer", String(255)),
    Column("anschluss_id", String(ID)),
    _zeit("angelegt", nullable=False),
    _zeit("entfernt"),
)

geraet = Table(
    "geraet", metadata,
    Column("id", String(ID), primary_key=True),          # subentry_id
    Column("baustelle_id", String(ID), nullable=False, index=True),
    Column("bereich_id", String(ID), nullable=False, index=True),
    Column("name", String(200), nullable=False),
    Column("rolle", String(40), nullable=False),
    Column("typ", String(40)),
    Column("schalter", String(255)),
    Column("leistung", String(255)),
    Column("energie", String(255)),
    Column("nenn_kw", Float),
    _zeit("angelegt", nullable=False),
    _zeit("entfernt"),
)

anschluss = Table(
    "anschluss", metadata,
    Column("baustelle_id", String(ID), primary_key=True),
    Column("id", String(ID), primary_key=True),
    Column("name", String(200)),
    Column("ampere", Float),
    Column("phasen", Integer),
    Column("reserve_kw", Float),
    _zeit("entfernt"),
)

firma = Table(
    "firma", metadata,
    Column("baustelle_id", String(ID), primary_key=True),
    Column("id", String(ID), primary_key=True),
    Column("name", String(200), nullable=False),
    Column("eigen", Boolean, nullable=False, default=False),
    _zeit("entfernt"),
)

zuordnung = Table(
    "zuordnung", metadata,
    Column("baustelle_id", String(ID), nullable=False),
    Column("bereich_id", String(ID), primary_key=True),
    _zeit("ab", primary_key=True),
    Column("firma_id", String(ID), nullable=False),
)

preis = Table(
    "preis", metadata,
    Column("baustelle_id", String(ID), primary_key=True),
    Column("ab", Date, primary_key=True),
    Column("eur_kwh", Float, nullable=False),
)

arbeitszeit = Table(
    "arbeitszeit", metadata,
    Column("baustelle_id", String(ID), primary_key=True),
    Column("ab", Date, primary_key=True),
    Column("wochentag", Integer, primary_key=True),      # 0 = Montag
    Column("name", String(200)),
    Column("von", Integer),                              # Minuten seit Mitternacht; leer = frei
    Column("bis", Integer),
)

ausnahme = Table(
    "ausnahme", metadata,
    Column("baustelle_id", String(ID), primary_key=True),
    Column("datum", Date, primary_key=True),
    Column("nr", Integer, primary_key=True),             # mehrere Ausnahmen je Tag (FE-0012)
    Column("art", String(20), nullable=False),           # arbeit | zeiten | frei
    Column("von", Integer),
    Column("bis", Integer),
    Column("notiz", Text),
)

# ---------------------------------------------------------------------- 2.2 Einstellungen und Laufzeit
einstellung = Table(
    "einstellung", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("baustelle_id", String(ID), nullable=False),
    Column("bereich_id", String(ID)),
    Column("geraet_id", String(ID)),
    Column("schluessel", String(200), nullable=False),
    Column("wert", JSONWERT),
    _zeit("ab", nullable=False),
    Column("benutzer", String(200)),                     # §6: bis Baustellenende + 1 Jahr, dann anonymisiert
    Column("quelle", String(20), nullable=False),        # seite | import | migration
    Index("ix_einstellung_schluessel", "baustelle_id", "schluessel", "ab"),
)

zustand = Table(
    "zustand", metadata,
    Column("baustelle_id", String(ID), primary_key=True),
    Column("schluessel", String(200), primary_key=True),
    Column("wert", JSONWERT),
    _zeit("geaendert", nullable=False),
)

lernen = Table(
    "lernen", metadata,
    Column("baustelle_id", String(ID), nullable=False),
    Column("bereich_id", String(ID), primary_key=True),
    Column("datum", Date, primary_key=True),
    Column("werte", JSONWERT),
)

# ---------------------------------------------------------------------- 2.3 Messwerte (je Minute, für immer)
geraet_minute = Table(
    "geraet_minute", metadata,
    Column("geraet_id", String(ID), primary_key=True),
    _zeit("zeit", primary_key=True),                     # Minutenbeginn
    Column("baustelle_id", String(ID), nullable=False),
    Column("dauer_s", Integer, nullable=False, default=60),
    Column("sekunden_ein", Integer),
    Column("sekunden_strom", Integer),   # Aufbau 4: davon Leistung über „zieht Strom“ (AN-0011)
    Column("leistung_w", Float),
    Column("leistung_w_max", Float),
    Column("energie_wh", Float),
    Column("zaehlerstand_kwh", Float),
    Column("erreichbar", Boolean),
    Column("quelle", String(20), nullable=False),        # ha | notprogramm | import_verlauf | import_statistik
)

bereich_minute = Table(
    "bereich_minute", metadata,
    Column("bereich_id", String(ID), primary_key=True),
    _zeit("zeit", primary_key=True),
    Column("baustelle_id", String(ID), nullable=False),
    Column("dauer_s", Integer, nullable=False, default=60),
    Column("temperatur", Float),
    Column("feuchte", Float),
    Column("soll", Float),
    Column("tuer_offen_s", Integer),
    Column("zustand", String(20)),
    Column("grund", String(40)),
    Column("quelle", String(20), nullable=False),
)

wetter_minute = Table(
    "wetter_minute", metadata,
    Column("baustelle_id", String(ID), primary_key=True),
    _zeit("zeit", primary_key=True),
    Column("dauer_s", Integer, nullable=False, default=60),
    Column("aussen_temp", Float),
    Column("regen_mm", Float),
    Column("hoechst_heute", Float),
    Column("quelle", String(20), nullable=False),
)

messwert = Table(   # Aufbau 5 (Herbert 05.10.2026): jeder gemeldete Wert der Leistung, für immer
    "messwert", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("geraet_id", String(ID), nullable=False),
    _zeit("zeit", nullable=False),                       # sekundengenau (last_updated in HA)
    Column("baustelle_id", String(ID), nullable=False),
    Column("leistung_w", Float),                         # leer = nicht erreichbar/unbekannt
    Column("quelle", String(20), nullable=False),        # ha | import_verlauf
    Index("ix_messwert_geraet_zeit", "geraet_id", "zeit"),
)

ereignis = Table(   # §6: ohne Benutzer
    "ereignis", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    _zeit("zeit", nullable=False),
    Column("baustelle_id", String(ID), nullable=False),
    Column("bereich_id", String(ID)),
    Column("geraet_id", String(ID)),
    Column("art", String(30), nullable=False),           # schalten | tuer | hand | bedarf | boost | notbetrieb | erreichbar
    Column("wert", JSONWERT),
    Column("quelle", String(20), nullable=False),        # automatik | hand | seite | taste | notprogramm
    Column("grund", String(60)),
    Index("ix_ereignis_zeit", "baustelle_id", "zeit"),
)

# ---------------------------------------------------------------------- 2.4 Auswertung, Protokoll, Meldungen
tag_geraet = Table(
    "tag_geraet", metadata,
    Column("geraet_id", String(ID), primary_key=True),
    Column("datum", Date, primary_key=True),
    Column("baustelle_id", String(ID), nullable=False),
    Column("bereich_id", String(ID)),
    Column("firma_id", String(ID)),
    Column("kwh", Float),
    Column("eur", Float),
    Column("preis", Float),
    Column("heizzeit_min", Float),
    Column("zyklen", Integer),
    Column("laufzeit_min", Float),
    Column("ohne_kwh", Float),
    Column("strom_min", Float),   # Aufbau 3: davon tatsächlich geheizt (AN-0011)
)

tag_bereich = Table(
    "tag_bereich", metadata,
    Column("bereich_id", String(ID), primary_key=True),
    Column("datum", Date, primary_key=True),
    Column("baustelle_id", String(ID), nullable=False),
    Column("firma_id", String(ID)),
    Column("kwh", Float),
    Column("eur", Float),
    Column("heizzeit_min", Float),
    Column("gradh", Float),
    Column("temp_min", Float),
    Column("temp_mittel", Float),
    Column("temp_max", Float),
    Column("aussen_mittel", Float),
    Column("ohne_kwh", Float),
    Column("heiztag", Boolean),
    Column("strom_min", Float),   # Aufbau 3: davon tatsächlich geheizt (AN-0011)
)

protokoll = Table(
    "protokoll", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    _zeit("zeit", nullable=False),
    Column("baustelle_id", String(ID), nullable=False),
    Column("bereich_id", String(ID)),
    Column("art", String(20), nullable=False),
    Column("text", Text, nullable=False),
    Index("ix_protokoll_zeit", "baustelle_id", "zeit"),
)

meldung = Table(
    "meldung", metadata,
    Column("id", String(ID), primary_key=True),
    Column("ticket", String(20), unique=True),
    Column("art", String(20), nullable=False),
    Column("status", String(20), nullable=False),
    Column("text", Text),
    Column("kontext", Text),
    Column("geraet", String(40)),
    Column("seite", JSONWERT),
    Column("version", String(20)),
    Column("baustelle_id", String(ID)),
    _zeit("zeit", nullable=False),
    Column("daten", JSONWERT),   # Aufbau 6: die ganze Meldung (kein Feld geht verloren, BSM-015)
)

meldung_verlauf = Table(
    "meldung_verlauf", metadata,
    Column("meldung_id", String(ID), primary_key=True),
    _zeit("zeit", primary_key=True),
    Column("status", String(20)),
    Column("notiz", Text),
    Column("version", String(20)),
    Column("commit", String(80)),
    Column("von", String(50)),
)

meldung_bild = Table(
    "meldung_bild", metadata,
    Column("meldung_id", String(ID), primary_key=True),
    Column("nr", Integer, primary_key=True),
    Column("datei", String(255), nullable=False),
)
