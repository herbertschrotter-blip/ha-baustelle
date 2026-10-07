"""Einstellungen, Zähler, Laufzeit, Protokoll und Meldungen aus der eigenen Datenbank (Phase 6, BSM-015).

Die Datenbank ist ab 0.8.61 die Quelle; die Store-Datei wird diese Version noch als Kopie mitgeschrieben (Rückweg).

- Einstellungen: je oberstem Schlüssel die jüngste Zeile in `einstellung` ohne Punkt im Schlüssel (Ausgangsstand der
  Übernahme bzw. Umstellung, danach jede gespeicherte Änderung). Zeilen mit Pfad (`heizung.soll`, `liste.…`,
  `aktion.…`) sind der Verlauf mit Benutzer und zählen hier nicht.
- Zähler: `zustand` „zaehler“; Laufzeit: die übrigen Schlüssel in `zustand`.
- Protokoll: die jüngsten `PROTOKOLL_SPEICHER` Einträge (für die Seite), älteres beim Blättern direkt aus der Datenbank.
- Merker `zustand` „speicher_db“: erst ab dann gilt die Datenbank (vorher war die Store-Datei der jüngere Stand).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Connection, delete, func, insert, select

from homeassistant.util import dt as dt_util

from . import schema as s
from .schreiber import schreibarbeit

MERKER = "speicher_db"
NICHT_LAUFZEIT = {"zaehler", "zaehler_uebernahme", "uebernahme", MERKER}
OHNE = {"zaehler", "laufzeit", "protokoll", "meldungen"}   # nicht als Einstellung
PROTOKOLL_SPEICHER = 1000


def _iso(t: datetime) -> str:
    return dt_util.as_local(t if t.tzinfo else t.replace(tzinfo=dt_util.UTC)).isoformat(timespec="seconds")


def baustelle_laden(v: Connection, bid: str) -> dict[str, Any] | None:
    """Gespeicherter Stand einer Baustelle; None, solange die Datenbank nicht Quelle ist (Merker fehlt)."""
    z = s.zustand
    zustaende = {r.schluessel: r.wert for r in v.execute(select(z.c.schluessel, z.c.wert).where(z.c.baustelle_id == bid))}
    if MERKER not in zustaende:
        return None
    e = s.einstellung
    juengste = (select(e.c.schluessel, func.max(e.c.id).label("id"))
                .where(e.c.baustelle_id == bid, e.c.bereich_id.is_(None), e.c.geraet_id.is_(None), ~e.c.schluessel.contains("."))
                .group_by(e.c.schluessel).subquery())
    daten: dict[str, Any] = {r.schluessel: r.wert for r in v.execute(
        select(e.c.schluessel, e.c.wert).join(juengste, e.c.id == juengste.c.id))}
    daten["zaehler"] = dict(zustaende.get("zaehler") or {})
    daten["laufzeit"] = {k: w for k, w in zustaende.items() if k not in NICHT_LAUFZEIT}
    p = s.protokoll
    daten["protokoll"] = [[_iso(r.zeit), r.art, r.bereich_id, r.text] for r in v.execute(
        select(p.c.zeit, p.c.art, p.c.bereich_id, p.c.text).where(p.c.baustelle_id == bid)
        .order_by(p.c.zeit.desc(), p.c.id.desc()).limit(PROTOKOLL_SPEICHER))]
    return daten


@schreibarbeit("baustelle_speichern")
def baustelle_speichern(v: Connection, bid: str, einstellungen: dict[str, Any], zaehler: dict[str, Any] | None,
                        laufzeit: dict[str, Any], quelle: str, merker: bool) -> None:
    """Geänderte Einstellungen (je oberstem Schlüssel), Zähler und Laufzeit schreiben; `merker` setzt „speicher_db“."""
    jetzt = dt_util.utcnow()
    for schluessel, wert in einstellungen.items():
        v.execute(insert(s.einstellung).values(baustelle_id=bid, bereich_id=None, geraet_id=None, schluessel=schluessel,
                                               wert=wert, ab=jetzt, benutzer=None, quelle=quelle))
    zustand = dict(laufzeit)
    if zaehler is not None:
        zustand["zaehler"] = zaehler
    if merker:
        zustand[MERKER] = {"seit": jetzt.isoformat()}
    for schluessel, wert in zustand.items():
        v.execute(delete(s.zustand).where(s.zustand.c.baustelle_id == bid, s.zustand.c.schluessel == schluessel))
        v.execute(insert(s.zustand).values(baustelle_id=bid, schluessel=schluessel, wert=wert, geaendert=jetzt))


def protokoll_lesen(v: Connection, bid: str, arten: set[str] | None, vor: datetime | None, limit: int) -> list[list[Any]]:
    """Protokoll neueste zuerst, ohne Grenze (Blättern mit `vor`)."""
    p = s.protokoll
    bedingung = [p.c.baustelle_id == bid]
    if arten is not None:
        bedingung.append(p.c.art.in_(arten))
    if vor is not None:
        bedingung.append(p.c.zeit < dt_util.as_utc(vor))
    return [[_iso(r.zeit), r.art, r.bereich_id, r.text] for r in v.execute(
        select(p.c.zeit, p.c.art, p.c.bereich_id, p.c.text).where(*bedingung).order_by(p.c.zeit.desc(), p.c.id.desc()).limit(limit))]


def meldungen_laden(v: Connection, integration: str) -> tuple[list[dict[str, Any]], dict[str, int]] | None:
    """Meldungen (vollständig, neueste zuerst) und Ticket-Zähler; None, solange die Datenbank nicht Quelle ist."""
    m = s.meldung
    nummern = v.execute(select(s.zustand.c.wert).where(s.zustand.c.baustelle_id == integration,
                                                       s.zustand.c.schluessel == "meldungen_nummern")).scalar()
    if nummern is None:
        return None
    liste = [dict(r.daten) for r in v.execute(select(m.c.daten).where(m.c.daten.is_not(None)).order_by(m.c.zeit.desc()))]
    return liste, {k: int(w) for k, w in dict(nummern).items()}
