"""Aufbau anlegen und auf den Stand `SCHEMA_VERSION` bringen (nummerierte Schritte, docs/bauplan-datenbank.md §3.1).

Vor jeder Migration einer bestehenden SQLite-Datei bleibt eine Kopie `baustelle.db.vor-<n>` liegen. Eine Datenbank, die
neuer ist als dieser Code (z. B. nach dem Einspielen einer älteren Version), wird nicht angefasst.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
import shutil

from sqlalchemy import Connection, Engine, func, inspect, insert, select

from homeassistant.util import dt as dt_util

from .schema import SCHEMA_VERSION, metadata, schema_version


class DatenbankNeuer(Exception):
    """Die Datenbank hat einen neueren Aufbau als dieser Code."""


def _schritt_1(verbindung: Connection) -> None:
    metadata.create_all(verbindung, checkfirst=True)


SCHRITTE: dict[int, Callable[[Connection], None]] = {1: _schritt_1}


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
