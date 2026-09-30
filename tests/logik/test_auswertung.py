"""Auswertung – gegen die Referenzwerte der Seite (tests/vektoren/auswertung-*.json, erzeugt mit tests/vektoren/erzeugen.js).

Wo die Seite anders rechnete als die Integration, steht im Vektor `abweichung`; dann gilt `erwartet` (fachlich richtig,
docs/bauplan-module.md §5) und der Test prüft zusätzlich, dass die Seite dort wirklich anders war.
"""

from datetime import date, datetime, timedelta
import json
import math
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from logik import auswertung as a
from logik.bericht import heiztage as bericht_heiztage
from logik.zaehlen import tage_heizperiode

VEKTOREN = Path(__file__).resolve().parents[1] / "vektoren"


def faelle(name: str) -> list[dict]:
    daten = json.loads((VEKTOREN / f"auswertung-{name}.json").read_text(encoding="utf-8"))
    return [pytest.param(f, id=f["name"]) for f in daten["faelle"]]


def nahe(ist, soll, wo="") -> None:
    """Gleich bis auf Rundung der Kommazahlen (JS und Python addieren gleich, aber sicher ist sicher)."""
    if isinstance(soll, dict):
        assert isinstance(ist, dict) and set(ist) == set(soll), f"{wo}: Schlüssel {sorted(ist)} ≠ {sorted(soll)}"
        for k in soll:
            nahe(ist[k], soll[k], f"{wo}.{k}")
    elif isinstance(soll, list):
        assert isinstance(ist, (list, tuple)) and len(ist) == len(soll), f"{wo}: Länge {len(ist)} ≠ {len(soll)}"
        for i, (x, y) in enumerate(zip(ist, soll)):
            nahe(x, y, f"{wo}[{i}]")
    elif isinstance(soll, (int, float)) and not isinstance(soll, bool):
        assert isinstance(ist, (int, float)) and math.isclose(ist, soll, rel_tol=1e-9, abs_tol=1e-9), f"{wo}: {ist} ≠ {soll}"
    else:
        assert ist == soll, f"{wo}: {ist!r} ≠ {soll!r}"


def tag(text: str | None) -> date | None:
    return date.fromisoformat(text) if text else None


def utc(text: str) -> datetime:
    return datetime.fromisoformat(text)


def paare(werte: dict) -> dict:
    """werte[entry][bereich] = [[ISO, kWh], …] → [(datetime, kWh), …]"""
    return {e: {b: [(utc(t), v) for t, v in liste] for b, liste in bs.items()} for e, bs in werte.items()}


# ------------------------------------------------------------------ Zeiträume, Statistik


@pytest.mark.parametrize("fall", faelle("zeitraum"))
def test_zeitraum(fall):
    e, soll, zone = fall["eingabe"], fall["erwartet"], ZoneInfo(fall["eingabe"]["zone"])
    zr = a.zeitraum(e["art"], date.fromisoformat(e["heute"]), e["versatz"])
    assert (zr.von.isoformat(), zr.bis.isoformat(), zr.periode, zr.n) == (soll["von"], soll["bis"], soll["periode"], soll["n"])
    assert list(zr.labels) == soll["labels"]
    assert zr.monat == (None if soll["monat"] is None else soll["monat"] + 1)   # Seite zählt Monate ab 0
    assert zr.jahr == soll["jahr"]
    assert [zr.beginn(i, zone) for i in range(zr.n)] == [utc(t) for t in soll["beginne"]]
    assert [zr.index(zr.beginn(i, zone).astimezone(zone)) for i in range(zr.n)] == soll["index"]


@pytest.mark.parametrize("fall", faelle("reihen"))
def test_reihen_und_verbrauch(fall):
    e, soll, zone = fall["eingabe"], fall["erwartet"], ZoneInfo(fall["eingabe"]["zone"])
    zr = a.zeitraum(e["art"], date.fromisoformat(e["heute"]), e["versatz"])
    if soll["anfrage"]:
        assert a.mitternacht(zr.von, zone) == utc(soll["anfrage"]["start_time"])
        assert a.mitternacht(zr.bis, zone) == utc(soll["anfrage"]["end_time"])
        assert zr.periode == soll["anfrage"]["period"]
    werte = a.reihen(zr, e["statistik"], zone)
    nahe(werte, soll["werte"], "werte")
    je = {b["id"]: a.verbrauch(werte, b["energie"], zr.n) for b in e["bereiche"]}
    nahe(je, soll["verbrauch"], "verbrauch")
    nahe(a.addieren(list(je.values())) or [0.0] * zr.n, soll["summe"], "summe")


# ------------------------------------------------------------------ Abrechnung


@pytest.mark.parametrize("fall", faelle("abrechnung"))
def test_abrechnung(fall):
    e, soll, zone = fall["eingabe"], fall["erwartet"], ZoneInfo(fall["eingabe"]["zone"])
    zr = a.zeitraum(e["art"], date.fromisoformat(e["heute"]))
    werte = paare(e["werte"])
    daten = a.abrechnung(e["baustellen"], paare(e.get("werte_tag") or e["werte"]), zone)   # Jahr: je Tag
    nahe(daten, soll["zeilen"], "zeilen")
    assert a.csv_firma(daten, e["baustellen"], e["art"], e["preis"]) == soll["csv_firma"]
    assert a.csv_verbrauch(e["baustellen"], werte, zr, e["preis"], zone) == soll["csv_verbrauch"]
    if fall.get("abweichung"):
        assert fall["seite"] != soll   # die Seite rechnete dort wirklich anders
    else:
        nahe(fall.get("seite", soll)["zeilen"], soll["zeilen"])


def test_abrechnung_wechsel_mitten_am_tag_gilt_ab_folgetag():
    zone = ZoneInfo("Europe/Vienna")
    b = {"entry": "x", "titel": "X", "firmen": [a.EIGENE_FIRMA, {"id": "huber", "name": "Huber"}],
         "zuordnung": [{"bereich": "c", "firma": "huber", "ab": "2026-09-29T10:30:00+02:00"}], "bereiche": [{"id": "c", "name": "C"}]}
    stunden = [(a.mitternacht(date(2026, 9, 29), zone) + timedelta(hours=h), 1.0) for h in range(24)]
    stunden += [(a.mitternacht(date(2026, 9, 30), zone) + timedelta(hours=h), 1.0) for h in range(2)]
    daten = a.abrechnung([b], {"x": {"c": stunden}}, zone)
    assert [(z["firma"], z["kwh"]) for z in daten] == [("Eigene Firma", 24.0), ("Huber", 2.0)]


# ------------------------------------------------------------------ Heizperiode


@pytest.mark.parametrize("fall", faelle("heizperiode"))
def test_heizperiode(fall):
    e, soll = fall["eingabe"], fall["erwartet"]
    heute = date.fromisoformat(e["heute"])
    ende = a.heizperiode_ende(heute, e["von"], e["bis"])
    assert ende.isoformat() == soll["ende"]
    assert a.heizperiode_bis(heute, e["von"], e["bis"], tag(e["ende"])).isoformat() == soll["bis"]
    # dieselbe Heizperiode wie die Hochrechnung der Integration (zaehlen.tage_heizperiode)
    jahr = heute.year if heute.month >= e["von"] else heute.year - 1
    assert date(jahr, e["von"], 1) + timedelta(days=tage_heizperiode(e["von"], e["bis"], jahr)) == ende + timedelta(days=1)


# ------------------------------------------------------------------ Verlauf, Kennzahlen, Monate


@pytest.mark.parametrize("fall", faelle("verlauf"))
def test_verlauf(fall):
    e, soll, zone = fall["eingabe"], fall["erwartet"], ZoneInfo(fall["eingabe"]["zone"])
    von, bis = a.verlauf_zeitraum(date.fromisoformat(e["heute"]), tag(e["beginn"]), tag(e["ende"]))
    assert (a.mitternacht(von, zone), a.mitternacht(bis, zone)) == (utc(soll["anfrage"]["start_time"]), utc(soll["anfrage"]["end_time"]))
    ist = a.verlauf_werte(e["energie"], e["heizzeit"], zone, tag(e["beginn"]), e["heiztage_zaehler"])
    nahe(ist, {k: soll[k] for k in ("heiztage", "monate", "je_monat")})
    if fall.get("abweichung"):
        assert (fall["seite"]["heiztage"], fall["seite"]["monate"]) != (soll["heiztage"], soll["monate"])
    else:
        assert fall["seite"] == soll


def test_heiztage_wie_bericht():
    heizzeit = {"polier": [(date(2026, 9, 1), 0.0), (date(2026, 9, 2), 1.5)], "lager": [(date(2026, 9, 2), 0.2), (date(2026, 9, 5), 3.0)]}
    tage = a.heiztag_daten(heizzeit, date(2026, 9, 1), date(2026, 9, 4))
    assert tage == {date(2026, 9, 2)}
    assert bericht_heiztage({b: dict(w) for b, w in heizzeit.items()}, date(2026, 9, 1), date(2026, 9, 4)) == len(tage)


@pytest.mark.parametrize("fall", faelle("kennzahlen"))
def test_kennzahlen(fall):
    e = fall["eingabe"]
    nahe(a.kennzahlen(e["zaehler"], e["zustaende"], e["preis"], e["container"], e["heiztage"], e["monate"]), fall["erwartet"])


@pytest.mark.parametrize("fall", faelle("monate"))
def test_monate_je_container(fall):
    e, soll, zone = fall["eingabe"], fall["erwartet"], ZoneInfo(fall["eingabe"]["zone"])
    von, bis, monate = a.monate_zeitraum(date.fromisoformat(e["heute"]), tag(e["beginn"]), tag(e["ende"]))
    if soll["anfrage"]:
        assert (a.mitternacht(von, zone), a.mitternacht(bis, zone)) == (utc(soll["anfrage"]["start_time"]), utc(soll["anfrage"]["end_time"]))
    daten = a.monate_je_container(monate, e["bereiche"], e["statistik"], zone)
    nahe(daten, {"labels": soll["labels"], "reihen": soll["reihen"]})
    assert a.csv_monate(e["titel"], e["preis"], daten) == soll["csv"]


# ------------------------------------------------------------------ Ölradiator/Konvektor, Wetter, Je Gerät


@pytest.mark.parametrize("fall", faelle("typvergleich"))
def test_typvergleich(fall):
    e = fall["eingabe"]
    nahe(a.typ_vergleich(e["bereiche"], e["zaehler"], e["energie"], e["heizzeit"], e["heiztage"], e["preis"]), fall["erwartet"])


@pytest.mark.parametrize("fall", faelle("wetter"))
def test_wetter(fall):
    e, soll = fall["eingabe"], fall["erwartet"]
    if "punkte" in e:
        punkte = e["punkte"]
    else:
        zone, heute = ZoneInfo(e["zone"]), date.fromisoformat(e["heute"])
        von, bis = a.tageswerte_zeitraum(heute)
        assert (a.mitternacht(von, zone), a.mitternacht(bis, zone)) == (utc(soll["anfrage"]["start_time"]), utc(soll["anfrage"]["end_time"]))
        punkte = a.tageswerte(e["statistik"], e["energie"], e["aussen"], heute, zone)
        nahe(punkte, soll["punkte"], "punkte")
    nahe(a.wetter_einfluss(punkte), soll["regression"], "regression")


@pytest.mark.parametrize("fall", faelle("je-geraet"))
def test_je_geraet(fall):
    e = fall["eingabe"]
    nahe(a.je_geraet(e["geraete"], e["zaehler"], e["statistik"], e["pumpzeit"]), fall["erwartet"]["zeilen"])


def test_statistik_start_in_sekunden_ms_und_text():
    zone = ZoneInfo("Europe/Vienna")
    ms = a.mitternacht(date(2026, 9, 29), zone).timestamp() * 1000
    for start in (ms, ms / 1000, "2026-09-29T00:00:00+02:00"):
        assert a.lokal(start, zone) == datetime(2026, 9, 29, tzinfo=zone)
