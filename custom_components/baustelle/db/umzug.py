"""Umzug von der SQLite-Datei auf PostgreSQL (Phase 8, BSM-026, docs/bauplan-datenbank.md §4a).

Einmal je Instanz, wenn PostgreSQL auf eine vorhandene SQLite-Datei trifft: alle Tabellen in der Reihenfolge der
Abhängigkeiten in Stapeln kopieren. In eine neue, leere Datenbank mit den laufenden Nummern (Zähler danach nachgezogen);
kommt eine weitere Instanz in eine schon belegte Datenbank (8d), vergibt der Server die Nummern neu – alle anderen
Schlüssel sind IDs von HA und damit über Instanzen eindeutig. Die SQLite-Datei bleibt unverändert liegen. Merker in
`zustand` („umzug“ unter der ID der Instanz). Rückweg: `zurueck` kopiert die Daten einer Instanz in eine neue
SQLite-Datei.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import Connection, DateTime, Table, create_engine, delete, insert, select, text

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


def _nummer(tabelle: Table) -> bool:
    return "id" in tabelle.c and tabelle.c.id.autoincrement is True


def kopieren(quelle: Connection, ziel: Connection, *, nummern_behalten: bool = True,
             auswahl: Callable[[Table], Any] | None = None) -> dict[str, int]:
    """Tabellen der Quelle ins Ziel; liefert die Zeilen je Tabelle. `schema_version` bleibt die des Ziels. Ohne
    `nummern_behalten` vergibt das Ziel die laufenden Nummern neu; `auswahl(tabelle)` liefert eine WHERE-Bedingung
    (None: alles, False: Tabelle auslassen)."""
    zahlen: dict[str, int] = {}
    for tabelle in s.metadata.sorted_tables:
        if tabelle.name == "schema_version":
            continue
        bedingung = auswahl(tabelle) if auswahl is not None else None
        if bedingung is False:
            continue
        zeitspalten = [c.name for c in tabelle.columns if isinstance(c.type, DateTime)]
        ordnung = list(tabelle.primary_key.columns) or list(tabelle.columns)
        abfrage = select(tabelle).order_by(*ordnung)
        if bedingung is not None:
            abfrage = abfrage.where(bedingung)
        weg = {"id"} if _nummer(tabelle) and not nummern_behalten else set()
        anzahl = 0
        ergebnis = quelle.execution_options(stream_results=True).execute(abfrage)
        while stapel := ergebnis.fetchmany(STAPEL):
            ziel.execute(insert(tabelle), [_utc({k: w for k, w in z._mapping.items() if k not in weg}, zeitspalten)
                                           for z in stapel])
            anzahl += len(stapel)
        zahlen[tabelle.name] = anzahl
        if ziel.dialect.name == "postgresql" and _nummer(tabelle) and nummern_behalten:
            ziel.execute(text(
                f"SELECT setval(pg_get_serial_sequence('\"{tabelle.name}\"', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM \"{tabelle.name}\"), 0) + 1, false)"))
    return zahlen


def umgezogen(v: Connection, instanz_id: str) -> bool:
    return v.execute(select(s.zustand.c.schluessel).where(s.zustand.c.baustelle_id == instanz_id,
                                                          s.zustand.c.schluessel == UMZUG)).first() is not None


def umziehen(pfad: Path, ziel: Connection, instanz_id: str, *, nummern_behalten: bool = True) -> dict[str, int]:
    """SQLite-Datei `pfad` dieser Instanz nach PostgreSQL kopieren (einmal je Instanz, mit Merker). Daten ohne Instanz
    aus der Datei (Meldungen, Merker unter `_integration`) bekommen gleich die ID der Instanz."""
    from .migration import ALT_INTEGRATION, instanz_uebernehmen   # noqa: PLC0415
    from .migration import migrieren   # noqa: PLC0415
    engine = create_engine(f"sqlite:///{pfad}")
    try:
        migrieren(engine, pfad)   # Datei mit älterem Aufbau (Instanz war bisher nur auf SQLite) erst nachziehen
        with engine.connect() as quelle:
            zahlen = kopieren(quelle, ziel, nummern_behalten=nummern_behalten)
    finally:
        engine.dispose()
    if ziel.execute(select(s.zustand.c.schluessel).where(s.zustand.c.baustelle_id == ALT_INTEGRATION)).first():
        instanz_uebernehmen(ziel, instanz_id)
    ziel.execute(delete(s.zustand).where(s.zustand.c.baustelle_id == instanz_id, s.zustand.c.schluessel == UMZUG))
    ziel.execute(insert(s.zustand).values(baustelle_id=instanz_id, schluessel=UMZUG, geaendert=dt_util.utcnow(),
                                          wert={"von": str(pfad), "zeilen": zahlen}))
    _LOGGER.warning("Datenbank von %s auf PostgreSQL umgezogen: %s Zeilen", pfad, sum(zahlen.values()))
    return zahlen


def _nur_instanz(instanz_id: str) -> Callable[[Table], Any]:
    """WHERE je Tabelle: nur die Daten der Instanz (Baustellen der Instanz, ihre Meldungen und Merker)."""
    baustellen = select(s.baustelle.c.id).where(s.baustelle.c.instanz_id == instanz_id).scalar_subquery()
    meldungen = select(s.meldung.c.id).where(s.meldung.c.instanz_id == instanz_id).scalar_subquery()

    def auswahl(t: Table) -> Any:
        if t.name == "instanz":
            return t.c.id == instanz_id
        if t.name == "baustelle":
            return t.c.instanz_id == instanz_id
        if t.name == "meldung":
            return t.c.instanz_id == instanz_id
        if t.name in ("meldung_verlauf", "meldung_bild"):
            return t.c.meldung_id.in_(meldungen)
        if "baustelle_id" in t.c:
            return t.c.baustelle_id.in_(baustellen) | (t.c.baustelle_id == instanz_id)
        return False   # unbekannte Tabelle ohne Zuordnung: lieber auslassen als fremde Daten kopieren

    return auswahl


def zurueck(quelle: Connection, ziel: Path, instanz_id: str) -> dict[str, int]:
    """Rückweg (8d): die Daten dieser Instanz aus PostgreSQL in eine neue SQLite-Datei `ziel` (darf es noch nicht geben).
    Danach: `db_url` entfernen, die Datei als `baustelle.db` einsetzen, Neustart (README, Auslieferung)."""
    from .migration import migrieren   # noqa: PLC0415
    if ziel.exists():
        raise FileExistsError(str(ziel))
    ziel.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{ziel}")
    try:
        migrieren(engine, None)
        with engine.begin() as v:
            zahlen = kopieren(quelle, v, auswahl=_nur_instanz(instanz_id))
    finally:
        engine.dispose()
    _LOGGER.warning("Rückweg: Daten der Instanz nach %s kopiert: %s Zeilen", ziel, sum(zahlen.values()))
    return zahlen

