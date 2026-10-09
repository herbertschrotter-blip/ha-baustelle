"""Inventar lesen und ändern (BSM-031.05, docs/bauplan-inventar.md §2) – reine Datenbankzugriffe; Nummern nach den
Regeln aus `logik/inventar.py`."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, and_, insert, select, update

from ..logik.inventar import STATUS_AUSRUESTUNG, firmenkuerzel_pruefen, naechste
from . import schema as s


def _zeile(r: Any) -> dict[str, Any]:
    return {k: (w.isoformat() if isinstance(w, datetime) else w) for k, w in r._mapping.items()}


def lesen(v: Connection) -> dict[str, Any]:
    """Alles fürs Inventar: Container und Ausrüstung mit ihren Einsätzen, Bereiche ohne Container, Firmen."""
    return {
        "container": [_zeile(r) for r in v.execute(select(s.container))],
        "einsaetze": [_zeile(r) for r in v.execute(select(s.container_einsatz).order_by(s.container_einsatz.c.von))],
        "ausruestung": [_zeile(r) for r in v.execute(select(s.ausruestung))],
        "ausruestung_einsaetze": [_zeile(r) for r in v.execute(
            select(s.ausruestung_einsatz).order_by(s.ausruestung_einsatz.c.von))],
        "bereiche_ohne": [_zeile(r) for r in v.execute(
            select(s.bereich.c.id, s.bereich.c.baustelle_id, s.bereich.c.name)
            .where(s.bereich.c.container_id.is_(None), s.bereich.c.entfernt.is_(None), s.bereich.c.art == "container"))],
        "geraete": [_zeile(r) for r in v.execute(   # Typ des Heizkörpers (Konvektor/Radiator) für den Namen
            select(s.geraet.c.id, s.geraet.c.typ, s.geraet.c.rolle).where(s.geraet.c.entfernt.is_(None)))],
        "firmen": [_zeile(r) for r in v.execute(
            select(s.firma.c.baustelle_id, s.firma.c.id, s.firma.c.name, s.firma.c.kuerzel, s.firma.c.eigen)
            .where(s.firma.c.entfernt.is_(None)))],
    }


def container_anlegen(v: Connection, *, art: str, baustelle_id: str, instanz_id: str | None, jetzt: datetime,
                      firma_kuerzel: str | None = None, bereich_id: str | None = None) -> dict[str, Any]:
    """Neuer Container mit erstem Einsatz auf `baustelle_id`. Eigen: nächste Nummer der ganzen Datenbank; fremd
    (`firma_kuerzel`): nächste Nummer dieser Firma auf dieser Baustelle. Mit `bereich_id` wird der Bereich verknüpft."""
    cid = uuid.uuid4().hex
    werte: dict[str, Any]
    if firma_kuerzel:
        kuerzel = firmenkuerzel_pruefen(firma_kuerzel)
        auf_baustelle = select(s.container_einsatz.c.container_id).where(s.container_einsatz.c.baustelle_id == baustelle_id)
        vorhanden = v.execute(select(s.container.c.fremd_nr).where(
            s.container.c.firma_kuerzel == kuerzel, s.container.c.id.in_(auf_baustelle))).scalars()
        werte = {"nr": None, "firma_kuerzel": kuerzel, "fremd_nr": naechste(vorhanden)}
    else:
        werte = {"nr": naechste(v.execute(select(s.container.c.nr)).scalars()), "firma_kuerzel": None, "fremd_nr": None}
    v.execute(insert(s.container).values(id=cid, art=art, status="aktiv", angelegt=jetzt, **werte))
    v.execute(insert(s.container_einsatz).values(container_id=cid, von=jetzt, baustelle_id=baustelle_id,
                                                 bereich_id=bereich_id, instanz_id=instanz_id))
    if bereich_id:
        v.execute(update(s.bereich).where(s.bereich.c.id == bereich_id).values(container_id=cid))
    return {"id": cid, "art": art, **werte}


def container_status(v: Connection, cid: str, status: str, jetzt: datetime) -> bool:
    """aktiv | ausgeschieden; beim Ausscheiden endet der laufende Einsatz (die Daten bleiben bei der Baustelle)."""
    if status not in ("aktiv", "ausgeschieden"):
        raise ValueError(status)
    if not v.execute(update(s.container).where(s.container.c.id == cid).values(status=status)).rowcount:
        return False
    if status == "ausgeschieden":
        v.execute(update(s.container_einsatz).where(and_(s.container_einsatz.c.container_id == cid,
                                                         s.container_einsatz.c.bis.is_(None))).values(bis=jetzt))
        v.execute(update(s.bereich).where(s.bereich.c.container_id == cid).values(container_id=None))
    return True


def ausruestung_status(v: Connection, aid: str, status: str) -> bool:
    """aktiv | verliehen | defekt."""
    if status not in STATUS_AUSRUESTUNG:
        raise ValueError(status)
    return bool(v.execute(update(s.ausruestung).where(s.ausruestung.c.id == aid).values(status=status)).rowcount)


def firma_kuerzel(v: Connection, baustelle_id: str, firma_id: str, kuerzel: str) -> bool:
    """Kürzel einer Firma der Baustelle setzen (2–5 Buchstaben)."""
    k = firmenkuerzel_pruefen(kuerzel)
    return bool(v.execute(update(s.firma).where(s.firma.c.baustelle_id == baustelle_id, s.firma.c.id == firma_id)
                          .values(kuerzel=k)).rowcount)


def umbenennung_merken(v: Connection, *, container_id: str, benutzer: str | None, jetzt: datetime,
                       schritte: list[dict[str, Any]], status: str) -> int:
    """Eine Umbenennung mit allen Schritten (alt → neu, Ergebnis) für Nachholen und Rückgängig (§6); liefert die Nummer."""
    r = v.execute(insert(s.umbenennung).values(zeit=jetzt, benutzer=benutzer, container_id=container_id,
                                               schritte=schritte, status=status))
    schluessel = r.inserted_primary_key
    assert schluessel is not None
    return int(schluessel[0])
