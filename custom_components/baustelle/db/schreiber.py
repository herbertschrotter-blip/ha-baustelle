"""Warteschlange der Schreibvorgänge (docs/bauplan-datenbank.md §3.1).

Schreibarbeiten werden gesammelt und in **einem** Schreibvorgang ausgeführt. Während einer HA-Sicherung oder ohne
erreichbare Datenbank bleiben sie in der Warteschlange und werden später nachgeschrieben (höchstens `MAX_OFFEN`,
dann fallen die ältesten weg – mit Warnung). Das regelmäßige Schreiben je Minute kommt mit Phase 2.
"""

from __future__ import annotations

from collections.abc import Callable
import logging
from typing import TYPE_CHECKING

from sqlalchemy import Connection

if TYPE_CHECKING:
    from .verbindung import Datenbank

_LOGGER = logging.getLogger(__name__)
MAX_OFFEN = 10_000

Arbeit = Callable[[Connection], object]


class Schreiber:
    """Gesammelte Schreibarbeiten einer Datenbank."""

    def __init__(self, db: Datenbank) -> None:
        self._db = db
        self._offen: list[Arbeit] = []

    def __len__(self) -> int:
        return len(self._offen)

    def dazu(self, arbeit: Arbeit) -> None:
        self._offen.append(arbeit)
        if len(self._offen) > MAX_OFFEN:
            weg = len(self._offen) - MAX_OFFEN
            del self._offen[:weg]
            _LOGGER.warning("Datenbank: Warteschlange voll, %s alte Schreibvorgänge verworfen", weg)

    async def async_schreiben(self) -> bool:
        """Alles Offene in einem Schreibvorgang; False, wenn es (noch) nicht ging."""
        if not self._offen:
            return True
        if self._db.angehalten or not self._db.bereit:
            return False
        stapel, self._offen = self._offen, []

        def alles(verbindung: Connection) -> bool:
            for arbeit in stapel:
                arbeit(verbindung)
            return True

        if await self._db.async_ausfuehren(alles) is None:
            self._offen[:0] = stapel   # später nachschreiben, Reihenfolge bleibt
            return False
        self._db.geschrieben()
        return True
