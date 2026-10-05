"""Verbindung zur eigenen Datenbank (docs/bauplan-datenbank.md §3.1, §5).

Standard ist die SQLite-Datei `/config/baustelle/baustelle.db` (WAL, `synchronous=NORMAL`). Alle Zugriffe laufen im
Executor von HA, nacheinander hinter einer Sperre – nie in der Ereignisschleife. Fehler der Datenbank halten die
Steuerung nie an: sie stehen in `fehler` (Diagnose-Sensor) und im Log, geschrieben wird später nach.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
import logging
from pathlib import Path
import sqlite3
import threading
from typing import Any, TypeVar

from sqlalchemy import Connection, Engine, create_engine, event

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .migration import migrieren
from .schreiber import Schreiber

_LOGGER = logging.getLogger(__name__)
T = TypeVar("T")


def _sqlite_einstellen(verbindung: Any, _eintrag: Any) -> None:
    cursor = verbindung.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


class Datenbank:
    """Eine Datenbank für alle Baustellen dieser HA-Instanz."""

    def __init__(self, hass: HomeAssistant, pfad: Path) -> None:
        self.hass = hass
        self.pfad = pfad
        self.engine: Engine | None = None
        self.version: int | None = None
        self.fehler: str | None = None
        self.angehalten = False          # während einer HA-Sicherung (backup.py)
        self.letzte_schreibzeit: datetime | None = None
        self.schreiber = Schreiber(self)
        self._sperre = threading.Lock()

    # ------------------------------------------------------------------ Start/Stopp
    async def async_start(self) -> bool:
        try:
            await self.hass.async_add_executor_job(self._start)
        except Exception as err:   # noqa: BLE001 – Datenbank darf die Integration nie anhalten
            self.fehler = f"Start: {err}"
            _LOGGER.warning("Datenbank %s nicht verfügbar: %s", self.pfad, err)
            return False
        self.fehler = None
        return True

    def _start(self) -> None:
        self.pfad.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(f"sqlite:///{self.pfad}", connect_args={"check_same_thread": False})
        event.listen(engine, "connect", _sqlite_einstellen)
        with self._sperre:
            self.version = migrieren(engine, self.pfad)
        self.engine = engine

    async def async_stop(self) -> None:
        await self.schreiber.async_schreiben()
        if self.engine is not None:
            engine, self.engine = self.engine, None
            await self.hass.async_add_executor_job(engine.dispose)

    @property
    def bereit(self) -> bool:
        return self.engine is not None

    # ------------------------------------------------------------------ Zugriffe
    async def async_ausfuehren(self, arbeit: Callable[[Connection], T]) -> T | None:
        """`arbeit` in einer Transaktion ausführen; bei Fehler None (und `fehler` gesetzt)."""
        if self.engine is None:
            return None
        try:
            ergebnis = await self.hass.async_add_executor_job(self._ausfuehren, arbeit)
        except Exception as err:   # noqa: BLE001
            self.fehler = str(err)
            _LOGGER.warning("Datenbank: %s", err)
            return None
        self.fehler = None
        return ergebnis

    def _ausfuehren(self, arbeit: Callable[[Connection], T]) -> T:
        assert self.engine is not None
        with self._sperre, self.engine.begin() as verbindung:
            return arbeit(verbindung)

    async def async_kopie(self, endung: str) -> Path | None:
        """Stimmige Kopie der SQLite-Datei neben ihr (`baustelle.db.<endung>`), z. B. vor der Übernahme der Altdaten."""
        if self.engine is None:
            return None
        ziel = self.pfad.with_name(f"{self.pfad.name}.{endung}")
        engine = self.engine

        def kopieren() -> None:
            with self._sperre:
                roh = engine.raw_connection()
                try:
                    kopie = sqlite3.connect(ziel)
                    try:
                        roh.driver_connection.backup(kopie)   # type: ignore[union-attr]
                    finally:
                        kopie.close()
                finally:
                    roh.close()

        await self.hass.async_add_executor_job(kopieren)
        return ziel

    # ------------------------------------------------------------------ Sicherung (backup.py, §3.7)
    async def async_anhalten(self) -> None:
        """Vor einer HA-Sicherung: Warteschlange schreiben, Prüfpunkt (WAL in die Datei), dann nichts mehr schreiben."""
        await self.schreiber.async_schreiben()
        self.angehalten = True
        if self.engine is not None:
            # Ergebnis abholen – sonst scheitert das Abschließen („SQL statements in progress“)
            await self.async_ausfuehren(lambda v: v.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)").all())

    async def async_fortsetzen(self) -> None:
        self.angehalten = False
        await self.schreiber.async_schreiben()

    # ------------------------------------------------------------------ Diagnose
    def info(self) -> dict[str, Any]:
        groesse = 0
        for name in (self.pfad.name, f"{self.pfad.name}-wal"):
            datei = self.pfad.with_name(name)
            if datei.exists():
                groesse += datei.stat().st_size
        return {
            "zustand": "fehler" if self.fehler else "angehalten" if self.angehalten else "ok" if self.bereit else "aus",
            "pfad": str(self.pfad), "groesse_mb": round(groesse / 1_000_000, 2), "schema_version": self.version,
            "fehler": self.fehler, "warteschlange": len(self.schreiber),
            "letzte_schreibzeit": self.letzte_schreibzeit.isoformat() if self.letzte_schreibzeit else None,
        }

    def geschrieben(self) -> None:
        self.letzte_schreibzeit = dt_util.utcnow()
