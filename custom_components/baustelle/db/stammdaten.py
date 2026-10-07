"""Stammdaten in die Datenbank spiegeln (docs/bauplan-datenbank.md §2.1, Phase 1).

Container, Geräte und Baustellen legt weiter HA an (Config-/Subentry-Flows); die Datenbank spiegelt sie bei jedem Start
und jeder Änderung aus derselben Quelle wie die Seite (`daten.struktur`). Entfernte Container, Geräte, Anschlüsse und
Firmen werden nicht gelöscht, sondern bekommen `entfernt`. Preise, Arbeitszeiten, Ausnahmen und Firmenzuordnung sind
vollständige Listen der Einstellungen und werden je Baustelle ersetzt.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date, datetime
from typing import Any

from sqlalchemy import Connection, Table, and_, delete, insert, update

from . import schema as s
from .schreiber import schreibarbeit


def _minuten(text: Any) -> int | None:
    if not text:
        return None
    h, m = str(text).split(":")[:2]
    return int(h) * 60 + int(m)


def _datum(text: Any) -> date | None:
    return date.fromisoformat(str(text)[:10]) if text else None


def _zeitpunkt(text: Any) -> datetime | None:
    return datetime.fromisoformat(str(text)) if text else None


def _upsert(v: Connection, tabelle: Table, schluessel: Mapping[str, Any], werte: Mapping[str, Any], jetzt: datetime) -> None:
    bedingung = and_(*(tabelle.c[k] == w for k, w in schluessel.items()))
    if v.execute(update(tabelle).where(bedingung).values(**werte)).rowcount == 0:
        neu = {**schluessel, **werte}
        if "angelegt" in tabelle.c:
            neu["angelegt"] = jetzt
        v.execute(insert(tabelle).values(**neu))


def _entfernt(v: Connection, tabelle: Table, baustelle_id: str, ids: set[str], jetzt: datetime) -> None:
    """Was es nicht mehr gibt, bekommt `entfernt`; was (wieder) da ist, verliert es."""
    alle = and_(tabelle.c.baustelle_id == baustelle_id)
    v.execute(update(tabelle).where(alle, tabelle.c.id.not_in(ids), tabelle.c.entfernt.is_(None)).values(entfernt=jetzt))
    if ids:
        v.execute(update(tabelle).where(alle, tabelle.c.id.in_(ids)).values(entfernt=None))


def _ersetzen(v: Connection, tabelle: Table, baustelle_id: str, zeilen: list[dict[str, Any]]) -> None:
    v.execute(delete(tabelle).where(tabelle.c.baustelle_id == baustelle_id))
    if zeilen:
        v.execute(insert(tabelle), zeilen)


@schreibarbeit("spiegeln")
def spiegeln(v: Connection, struktur: Mapping[str, Any], instanz: Mapping[str, str], jetzt: datetime) -> None:
    """Eine Baustelle (Antwort von `daten.struktur`) in die Stammdaten schreiben."""
    b = struktur["baustelle"]
    bid = b["entry_id"]
    e: Mapping[str, Any] = struktur.get("einstellungen") or {}
    eb: Mapping[str, Any] = e.get("bereiche") or {}
    optionen: Mapping[str, Any] = b.get("optionen") or {}

    _upsert(v, s.instanz, {"id": instanz["id"]}, {"name": instanz.get("name")}, jetzt)
    status = b.get("status") or "aktiv"
    _upsert(v, s.baustelle, {"id": bid}, {
        "instanz_id": instanz["id"], "titel": b.get("titel") or bid, "status": status, "zeitzone": b.get("zeitzone"),
        "beginn": _datum(b.get("beginn")), "ende": _datum(optionen.get("ende")), "entfernt": None,
    }, jetzt)
    if status == "abgeschlossen":
        v.execute(update(s.baustelle).where(s.baustelle.c.id == bid, s.baustelle.c.abgeschlossen.is_(None))
                  .values(abgeschlossen=jetzt))
    else:
        v.execute(update(s.baustelle).where(s.baustelle.c.id == bid).values(abgeschlossen=None))

    for x in struktur.get("bereiche") or []:
        extra = eb.get(x["id"]) or {}
        _upsert(v, s.bereich, {"id": x["id"]}, {
            "baustelle_id": bid, "name": x["name"], "art": x.get("art") or "container", "nr": x.get("nr"),
            "m2": extra.get("groesse_m2"), "fuehler": x.get("fuehler"), "tuer": extra.get("tuer"),
            "anschluss_id": extra.get("anschluss"),
        }, jetzt)
    _entfernt(v, s.bereich, bid, {x["id"] for x in struktur.get("bereiche") or []}, jetzt)

    for g in struktur.get("geraete") or []:
        _upsert(v, s.geraet, {"id": g["id"]}, {
            "baustelle_id": bid, "bereich_id": g["bereich"], "name": g["name"], "rolle": g["rolle"], "typ": g.get("typ"),
            "schalter": g.get("schalter"), "leistung": g.get("leistung"), "energie": g.get("energie"),
            "nenn_kw": g.get("nenn_kw"),
        }, jetzt)
    _entfernt(v, s.geraet, bid, {g["id"] for g in struktur.get("geraete") or []}, jetzt)

    for a in e.get("anschluesse") or []:
        _upsert(v, s.anschluss, {"baustelle_id": bid, "id": a["id"]}, {
            "name": a.get("name"), "ampere": a.get("ampere"), "phasen": a.get("phasen"), "reserve_kw": a.get("reserve_kw"),
        }, jetzt)
    _entfernt(v, s.anschluss, bid, {a["id"] for a in e.get("anschluesse") or []}, jetzt)

    for f in e.get("firmen") or []:
        _upsert(v, s.firma, {"baustelle_id": bid, "id": f["id"]}, {"name": f.get("name") or f["id"], "eigen": bool(f.get("eigen"))}, jetzt)
    _entfernt(v, s.firma, bid, {f["id"] for f in e.get("firmen") or []}, jetzt)

    _ersetzen(v, s.zuordnung, bid, [
        {"baustelle_id": bid, "bereich_id": z["bereich"], "ab": _zeitpunkt(z["ab"]), "firma_id": z["firma"]}
        for z in e.get("zuordnung") or [] if z.get("bereich") and z.get("ab")
    ])
    preise = [{"baustelle_id": bid, "ab": _datum(p["ab"]), "eur_kwh": float(p["preis"])} for p in e.get("preise") or []]
    if not preise and e.get("preis") is not None:   # ohne Preisliste: ein Preis ab Beginn
        preise = [{"baustelle_id": bid, "ab": _datum(b.get("beginn")) or jetzt.date(), "eur_kwh": float(e["preis"])}]
    _ersetzen(v, s.preis, bid, preise)
    _ersetzen(v, s.arbeitszeit, bid, [
        {"baustelle_id": bid, "ab": _datum(az["ab"]), "wochentag": int(tag), "name": az.get("name"),
         "von": _minuten(zeit[0]) if zeit else None, "bis": _minuten(zeit[1]) if zeit else None}
        for az in e.get("arbeitszeiten") or [] for tag, zeit in (az.get("tage") or {}).items()
    ])
    ausnahmen: list[dict[str, Any]] = []
    je_tag: dict[str, int] = {}
    for a in e.get("ausnahmen") or []:
        nr = je_tag[a["datum"]] = je_tag.get(a["datum"], -1) + 1
        ausnahmen.append({"baustelle_id": bid, "datum": _datum(a["datum"]), "nr": nr, "art": a.get("art") or "frei",
                          "von": _minuten(a.get("von")), "bis": _minuten(a.get("bis")), "notiz": a.get("notiz") or None})
    _ersetzen(v, s.ausnahme, bid, ausnahmen)


@schreibarbeit("entfernen")
def entfernen(v: Connection, baustelle_id: str, jetzt: datetime) -> None:
    """Baustelle in HA gelöscht: in der Datenbank nur als entfernt kennzeichnen (Messwerte bleiben)."""
    v.execute(update(s.baustelle).where(s.baustelle.c.id == baustelle_id, s.baustelle.c.entfernt.is_(None)).values(entfernt=jetzt))
