"""Eigene Datenbank der Integration (docs/bauplan-datenbank.md) – eine für alle Baustellen dieser HA-Instanz."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import instance_id
from homeassistant.util import dt as dt_util
from homeassistant.util.hass_dict import HassKey

from ..const import DOMAIN
from . import stammdaten
from .verbindung import Datenbank

DATA_DB: HassKey[Datenbank] = HassKey(f"{DOMAIN}_datenbank")
DATEI = "baustelle/baustelle.db"


async def async_datenbank_starten(hass: HomeAssistant) -> Datenbank:
    """Datenbank öffnen und Aufbau nachziehen (einmal je HA-Start); ein Fehler hält die Integration nicht an."""
    db = Datenbank(hass, Path(hass.config.path(DATEI)))
    await db.async_start()
    hass.data[DATA_DB] = db
    return db


async def async_spiegeln(hass: HomeAssistant, struktur: dict[str, Any]) -> None:
    """Stammdaten einer Baustelle in die Datenbank (über die Warteschlange, gleich geschrieben)."""
    db = hass.data.get(DATA_DB)
    if db is None:
        return
    instanz = {"id": await instance_id.async_get(hass), "name": hass.config.location_name}
    jetzt = dt_util.utcnow()
    db.schreiber.dazu(lambda v: stammdaten.spiegeln(v, struktur, instanz, jetzt))
    await db.schreiber.async_schreiben()


async def async_entfernen(hass: HomeAssistant, baustelle_id: str) -> None:
    """Baustelle in HA gelöscht → in der Datenbank als entfernt kennzeichnen."""
    db = hass.data.get(DATA_DB)
    if db is None:
        return
    jetzt = dt_util.utcnow()
    db.schreiber.dazu(lambda v: stammdaten.entfernen(v, baustelle_id, jetzt))
    await db.schreiber.async_schreiben()
