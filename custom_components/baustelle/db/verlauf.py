"""Verlauf aus der eigenen Datenbank (BSM-014, Schritt 2) – wie `history/history_during_period` (minimal_response).

Leistung: jeder gemeldete Wert (`messwert`, Aufbau 5). Schalter ohne Leistungsmessung: aus den Minuten (an, wenn in
der Minute eingeschaltet; nicht erreichbar). Was die Datenbank nicht kennt, kommt aus dem HA-Verlauf.
Antwort `{entity_id: [{"s": Zustand, "lu": Sekunden}]}`, der erste Eintrag ist der Zustand zu Beginn.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Connection, select

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from ..const import DOMAIN
from . import DATA_DB, schema as s

if TYPE_CHECKING:
    from ..steuerung import Steuerung


def _ts(t: datetime) -> float:
    return (t if t.tzinfo else t.replace(tzinfo=dt_util.UTC)).timestamp()


def _zahl_text(w: float | None) -> str:
    return "unavailable" if w is None else (str(int(w)) if float(w).is_integer() else str(round(w, 2)))


def _aus_db(v: Connection, ziele: dict[str, tuple[str, str]], start: datetime, ende: datetime) -> dict[str, list[dict[str, Any]]]:
    mw, gm = s.messwert, s.geraet_minute
    ergebnis: dict[str, list[dict[str, Any]]] = {}
    for eid, (art, gid) in ziele.items():
        punkte: list[dict[str, Any]] = []
        if art == "leistung":
            vorher = v.execute(select(mw.c.zeit, mw.c.leistung_w).where(mw.c.geraet_id == gid, mw.c.zeit < start)
                               .order_by(mw.c.zeit.desc()).limit(1)).first()
            if vorher is not None:
                punkte.append({"s": _zahl_text(vorher.leistung_w), "lu": _ts(start)})
            for r in v.execute(select(mw.c.zeit, mw.c.leistung_w).where(mw.c.geraet_id == gid, mw.c.zeit >= start, mw.c.zeit < ende)
                               .order_by(mw.c.zeit)):
                punkte.append({"s": _zahl_text(r.leistung_w), "lu": _ts(r.zeit)})
        else:   # Schalter: aus den Minuten, gleiche Zustände zusammengefasst
            letzt = None
            for r in v.execute(select(gm.c.zeit, gm.c.sekunden_ein, gm.c.erreichbar).where(
                    gm.c.geraet_id == gid, gm.c.zeit >= start, gm.c.zeit < ende).order_by(gm.c.zeit)):
                zustand = "unavailable" if r.erreichbar is False else "on" if r.sekunden_ein else "off"
                if zustand != letzt:
                    punkte.append({"s": zustand, "lu": max(_ts(r.zeit), _ts(start))})
                    letzt = zustand
        ergebnis[eid] = punkte
    return ergebnis


async def async_verlauf(hass: HomeAssistant, ids: list[str], start: datetime, ende: datetime) -> dict[str, list[dict[str, Any]]]:
    db = hass.data.get(DATA_DB)
    ziele: dict[str, tuple[str, str]] = {}
    if db is not None and db.bereit:
        for entry in hass.config_entries.async_loaded_entries(DOMAIN):
            st: Steuerung | None = getattr(entry, "runtime_data", None)
            if st is None:
                continue
            for gid, g in st.geraete.items():
                if g.leistung in ids:
                    ziele[g.leistung] = ("leistung", gid)
                if g.schalter in ids and g.schalter not in ziele:
                    ziele[g.schalter] = ("schalter", gid)
    antwort: dict[str, list[dict[str, Any]]] = {}
    if ziele and db is not None:
        s_utc, e_utc = dt_util.as_utc(start), dt_util.as_utc(ende)
        antwort = await db.async_ausfuehren(lambda v: _aus_db(v, ziele, s_utc, e_utc)) or {}
    rest = [i for i in ids if i not in antwort]
    if rest and "recorder" in hass.config.components:
        from homeassistant.components.recorder import history  # noqa: PLC0415
        from homeassistant.helpers.recorder import get_instance  # noqa: PLC0415
        roh = await get_instance(hass).async_add_executor_job(
            history.get_significant_states, hass, start, ende, rest, None, True, False, True, True)
        for eid, zustaende in roh.items():
            punkte: list[dict[str, Any]] = []
            for z in zustaende:
                zeit = dt_util.parse_datetime(z["last_changed"]) if isinstance(z, dict) else z.last_updated
                if zeit is not None:
                    punkte.append({"s": z["state"] if isinstance(z, dict) else z.state, "lu": zeit.timestamp()})
            antwort[eid] = punkte
    return antwort
