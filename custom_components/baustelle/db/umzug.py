"""Umzug von der SQLite-Datei auf PostgreSQL (Phase 8, BSM-026, docs/bauplan-datenbank.md §4a).

Einmal, wenn eine neue, leere PostgreSQL-Datenbank (gerade angelegt) auf eine vorhandene SQLite-Datei trifft: alle
Tabellen in der Reihenfolge der Abhängigkeiten in Stapeln kopieren, laufende Nummern übernehmen und die Zähler der
Nummern danach nachziehen. Die SQLite-Datei bleibt unverändert liegen (Rückweg: `db_url` entfernen). Merker in
`zustand` („umzug“, Baustelle `_integration`). Dieselbe Abfolge gilt in Gegenrichtung (`kopieren`).
"""

from __future__ import annotations

from datetime import UTC, datetime
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import Connection, DateTime, create_engine, delete, insert, select, text

from homeassistant.util import dt as dt_util

from . import schema as s

_LOGGER = logging.getLogger(__name__)
STAPEL = 5_000
UMZUG = "umzug"


def _utc(zeile: dict[str, Any], zeitspalten: list[str]) -> dict[str, Any]:
    """SQLite liefert Zeiten ohne Zeitzone (gespeichert in UTC) – für PostgreSQL ausdrücklich UTC."""
    for name in zeitspalten:
        w = zeile.get(name)
        if isinstance(w, datetime) and w.tzinfo is None:
            zeile[name] = w.replace(tzinfo=UTC)
    return zeile


def kopieren(quelle: Connection, ziel: Connection) -> dict[str, int]:
    """Alle Tabellen der Quelle ins (leere) Ziel; liefert die Zeilen je Tabelle. `schema_version` bleibt die des Ziels."""
    zahlen: dict[str, int] = {}
    for tabelle in s.metadata.sorted_tables:
        if tabelle.name == "schema_version":
            continue
        zeitspalten = [c.name for c in tabelle.columns if isinstance(c.type, DateTime)]
        ordnung = list(tabelle.primary_key.columns) or list(tabelle.columns)
        anzahl = 0
        ergebnis = quelle.execution_options(stream_results=True).execute(select(tabelle).order_by(*ordnung))
        while stapel := ergebnis.fetchmany(STAPEL):
            ziel.execute(insert(tabelle), [_utc(dict(z._mapping), zeitspalten) for z in stapel])
            anzahl += len(stapel)
        zahlen[tabelle.name] = anzahl
        if ziel.dialect.name == "postgresql" and "id" in tabelle.c and tabelle.c.id.autoincrement is True:
            ziel.execute(text(
                f"SELECT setval(pg_get_serial_sequence('\"{tabelle.name}\"', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM \"{tabelle.name}\"), 0) + 1, false)"))
    return zahlen


def umziehen(pfad: Path, ziel: Connection) -> dict[str, int]:
    """SQLite-Datei `pfad` in die gerade angelegte PostgreSQL-Datenbank kopieren (einmal, mit Merker)."""
    engine = create_engine(f"sqlite:///{pfad}")
    try:
        with engine.connect() as quelle:
            zahlen = kopieren(quelle, ziel)
    finally:
        engine.dispose()
    ziel.execute(delete(s.zustand).where(s.zustand.c.baustelle_id == "_integration", s.zustand.c.schluessel == UMZUG))
    ziel.execute(insert(s.zustand).values(baustelle_id="_integration", schluessel=UMZUG, geaendert=dt_util.utcnow(),
                                          wert={"von": str(pfad), "zeilen": zahlen}))
    _LOGGER.warning("Datenbank von %s auf PostgreSQL umgezogen: %s Zeilen", pfad, sum(zahlen.values()))
    return zahlen
