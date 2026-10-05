"""Eigene Datenbank der Integration (docs/bauplan-datenbank.md) – eine für alle Baustellen dieser HA-Instanz."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any

from sqlalchemy import Connection, delete, insert

from homeassistant.core import CALLBACK_TYPE, HomeAssistant
from homeassistant.helpers import instance_id
from homeassistant.helpers.start import async_at_started
from homeassistant.util import dt as dt_util
from homeassistant.util.hass_dict import HassKey

from ..const import DOMAIN
from . import schema as s, stammdaten
from .mitschreiben import Mitschreiber
from .verbindung import Datenbank

if TYPE_CHECKING:
    from ..steuerung import Steuerung

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


# ---------------------------------------------------------------------- Phase 2: mitschreiben (BSM-007)
def mitschreiber_starten(hass: HomeAssistant, st: Steuerung) -> Mitschreiber | None:
    """Mitschreiben einer Baustelle beginnen (je Minute, Ereignisse); None ohne Datenbank."""
    db = hass.data.get(DATA_DB)
    if db is None or not db.bereit:
        return None
    m = Mitschreiber(hass, db, st)
    m.start()
    return m


def protokoll_merken(hass: HomeAssistant, baustelle_id: str, zeit: datetime, art: str, bereich_id: str | None, text: str) -> None:
    """Protokolleintrag (ohne die Grenze von 1.000 im Store); geschrieben mit der nächsten Minute."""
    if (db := hass.data.get(DATA_DB)) is None:
        return
    # sekundengenau wie im Store – sonst erkennt die Übernahme (BSM-008) den Eintrag nicht als schon vorhanden
    zeile = {"zeit": dt_util.as_utc(zeit).replace(microsecond=0), "baustelle_id": baustelle_id, "bereich_id": bereich_id,
             "art": art, "text": text}
    db.schreiber.dazu(lambda v: v.execute(insert(s.protokoll).values(**zeile)))


def einstellung_merken(hass: HomeAssistant, baustelle_id: str, schluessel: str, wert: Any, benutzer: str | None, *,
                       bereich_id: str | None = None, geraet_id: str | None = None, quelle: str = "seite") -> None:
    """Geänderte Einstellung mit Benutzer (§6: Einstellungen mit Benutzer)."""
    if (db := hass.data.get(DATA_DB)) is None:
        return
    zeile = {"baustelle_id": baustelle_id, "bereich_id": bereich_id, "geraet_id": geraet_id, "schluessel": schluessel,
             "wert": wert, "ab": dt_util.utcnow(), "benutzer": benutzer, "quelle": quelle}
    db.schreiber.dazu(lambda v: v.execute(insert(s.einstellung).values(**zeile)))


def ereignis_merken(hass: HomeAssistant, baustelle_id: str, art: str, wert: Any, quelle: str, *,
                    bereich_id: str | None = None, geraet_id: str | None = None) -> None:
    """Bedienung vor Ort (jetzt heizen, Boost, Gefühl, Warnung stumm) – ohne Person (§6)."""
    if (db := hass.data.get(DATA_DB)) is None:
        return
    zeile = {"zeit": dt_util.utcnow(), "baustelle_id": baustelle_id, "bereich_id": bereich_id, "geraet_id": geraet_id,
             "art": art, "wert": wert, "quelle": quelle, "grund": None}
    db.schreiber.dazu(lambda v: v.execute(insert(s.ereignis).values(**zeile)))


def meldungen_merken(hass: HomeAssistant, liste: list[dict[str, Any]]) -> None:
    """Alle Meldungen mit Verlauf und Bildern (die Liste ist klein – je Speichern ganz ersetzt)."""
    if (db := hass.data.get(DATA_DB)) is None:
        return

    def zeit(text: Any) -> datetime:
        return dt_util.as_utc(datetime.fromisoformat(str(text))) if text else dt_util.utcnow()

    meldungen = [{"id": m["id"], "ticket": m.get("ticket"), "art": m.get("art") or "fehler", "status": m.get("status") or "neu",
                  "text": m.get("text"), "kontext": m.get("kontext"), "geraet": m.get("geraet"), "seite": m.get("seite"),
                  "version": m.get("version"), "baustelle_id": m.get("baustelle"), "zeit": zeit(m.get("zeit"))}
                 for m in liste if m.get("id")]
    verlauf = [{"meldung_id": m["id"], "zeit": zeit(e.get("zeit")), "status": e.get("status"), "notiz": e.get("notiz"),
                "version": e.get("version"), "commit": e.get("commit"), "von": e.get("von")}
               for m in liste if m.get("id") for e in (m.get("verlauf") or [])]
    verlauf = list({(z["meldung_id"], z["zeit"]): z for z in verlauf}.values())   # gleiche Sekunde: der letzte gilt
    bilder = [{"meldung_id": m["id"], "nr": i, "datei": name} for m in liste if m.get("id") for i, name in enumerate(m.get("bilder") or [])]

    def schreiben(v: Connection) -> None:
        for tabelle, zeilen in ((s.meldung_bild, bilder), (s.meldung_verlauf, verlauf), (s.meldung, meldungen)):
            v.execute(delete(tabelle))
            if zeilen:
                v.execute(insert(tabelle), zeilen)

    db.schreiber.dazu(schreiben)


# ---------------------------------------------------------------------- Phase 3: Altdaten (BSM-008)
def uebernahme_planen(hass: HomeAssistant, st: Steuerung, bis: datetime) -> CALLBACK_TYPE | None:
    """Altdaten der Baustelle nach dem HA-Start im Hintergrund übernehmen (einmal, Merker in der Datenbank)."""
    db = hass.data.get(DATA_DB)
    if db is None or not db.bereit:
        return None
    from .uebernahme import async_uebernehmen   # noqa: PLC0415 – erst bei Bedarf (zieht den Recorder nach)

    async def los(_hass: HomeAssistant) -> None:
        await async_uebernehmen(hass, db, st, bis)
        from .tage import async_fehlende_tage   # noqa: PLC0415
        await async_fehlende_tage(db, st)   # Tagessummen für alle Tage, die noch fehlen (BSM-009)

    return async_at_started(hass, los)
