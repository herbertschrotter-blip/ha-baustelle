"""Auswertung – gegen die Referenzwerte der Seite (tests/vektoren/auswertung-*.json, erzeugt mit tests/vektoren/erzeugen.js).

Wo die Seite anders rechnete als die Integration, steht im Vektor `abweichung`; dann gilt `erwartet` (fachlich richtig,
docs/bauplan-module.md §5) und der Test prüft zusätzlich, dass die Seite dort wirklich anders war.
"""

from datetime import date, datetime, timedelta, timezone
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


@pytest.mark.parametrize("fall", faelle("abrechnung"))
def test_firmen_reihen_wie_abrechnung(fall):
    """Verbrauch gestapelt nach Firma: je Firma dieselbe Summe wie die Abrechnung (Firma je Tag), je Periode verteilt."""
    e, zone = fall["eingabe"], ZoneInfo(fall["eingabe"]["zone"])
    zr = a.zeitraum(e["art"], date.fromisoformat(e["heute"]))
    werte = paare(e.get("werte_tag") or e["werte"])
    reihen = a.firmen_reihen(e["baustellen"], werte, zr, zone)
    daten = a.abrechnung(e["baustellen"], werte, zone)
    assert set(reihen) == {"eigen" if z["eigen"] else z["firma"] for z in daten}
    for z in daten:
        v = reihen["eigen" if z["eigen"] else z["firma"]]
        assert len(v) == zr.n and math.isclose(sum(v), z["kwh"], rel_tol=1e-9)
    # alle Firmen zusammen = Verbrauch je Periode
    summe = [sum(r[i] for r in reihen.values()) for i in range(zr.n)]
    je = a.addieren([[k or 0.0 for _, k in liste] for bs in paare(e["werte"]).values() for liste in bs.values()])
    nahe(summe, je, "summe") if e["art"] != "Jahr" else nahe(sum(summe), sum(je), "summe")


def test_firmen_reihen_wechsel_am_folgetag():
    zone = ZoneInfo("Europe/Vienna")
    b = {"entry": "x", "titel": "X", "firmen": [a.EIGENE_FIRMA, {"id": "huber", "name": "Huber"}],
         "zuordnung": [{"bereich": "c", "firma": "huber", "ab": "2026-09-29T10:30:00+02:00"}], "bereiche": [{"id": "c", "name": "C"}]}
    zr = a.zeitraum("Woche", date(2026, 9, 29))
    tage = [(a.mitternacht(date(2026, 9, 28) + timedelta(days=i), zone), 2.0) for i in range(3)]
    assert a.firmen_reihen([b], {"x": {"c": tage}}, zr, zone) == {"eigen": [2.0, 2.0, 0, 0, 0, 0, 0], "Huber": [0, 0, 2.0, 0, 0, 0, 0]}


def test_csv_text_wie_seite():
    assert a.csv_text(["a;b", "1,00;2"]) == "\ufeffa;b\r\n1,00;2"


def test_veraenderung_und_ohne_automatik():
    assert a.veraenderung(115, 100) == 15 and a.veraenderung(99.5, 100) == 0 and a.veraenderung(98.5, 100) == -1
    assert a.veraenderung(5, 0) is None and a.veraenderung(None, 5) is None
    assert a.ohne_automatik(40, 100, 0.25) == {"ohne_eur": 25.0, "gespart_eur": 15.0, "prozent": 60.0}
    assert a.ohne_automatik(120, 100, 0.25) == {"ohne_eur": 25.0, "gespart_eur": 0.0, "prozent": 0.0}
    assert a.ohne_automatik(5, 0, 0.25) is None


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
    nahe({k: ist[k] for k in ("heiztage", "monate", "je_monat")}, {k: soll[k] for k in ("heiztage", "monate", "je_monat")})
    assert sum(ist["je_tag"].values()) == pytest.approx(sum(ist["je_monat"].values()))   # WU-0006: Tage ergeben die Monate
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


def test_monate_summen():
    """Verbrauch je Monat auf der Detailseite: kWh, € und Anteil je Container rechnet die Integration."""
    reihen = [{"name": "Polier", "v": [30.0, 45.0]}, {"name": "Lager", "v": [25.0, 0.0]}, {"name": "Magazin", "v": [0.0, 0.0]}]
    assert a.monate_summen(reihen, 0.28) == [{"kwh": 75.0, "eur": pytest.approx(21.0), "anteil": 75.0},
                                             {"kwh": 25.0, "eur": pytest.approx(7.0), "anteil": 25.0}, {"kwh": 0.0, "eur": 0.0, "anteil": 0.0}]
    assert a.monate_summen([{"name": "Büro", "v": [0.0]}], 0.28) == [{"kwh": 0.0, "eur": 0.0, "anteil": 0.0}]
    assert a.monate_summen([], 0.28) == []


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


def test_wetter_kosten():
    """€ je Grad kälter beim Wetter-Einfluss: −k · Preis, nur wenn es mit Kälte mehr wird."""
    g = {"k": -1.2, "d0": 20.0, "null0": 16.7}
    assert a.wetter_kosten(g, 0.25) == {**g, "eur_je_grad": pytest.approx(0.3)}
    assert a.wetter_kosten({"k": 0.0, "d0": 5.0, "null0": None}, 0.25)["eur_je_grad"] is None
    assert a.wetter_kosten(None, 0.25) is None


@pytest.mark.parametrize("fall", faelle("je-geraet"))
def test_je_geraet(fall):
    e = fall["eingabe"]
    nahe(a.je_geraet(e["geraete"], e["zaehler"], e["statistik"], e["pumpzeit"]), fall["erwartet"]["zeilen"])


def test_statistik_start_in_sekunden_ms_und_text():
    zone = ZoneInfo("Europe/Vienna")
    ms = a.mitternacht(date(2026, 9, 29), zone).timestamp() * 1000
    for start in (ms, ms / 1000, "2026-09-29T00:00:00+02:00"):
        assert a.lokal(start, zone) == datetime(2026, 9, 29, tzinfo=zone)


def test_geld_und_abrechnung_geld():
    """€ und Anteil der Abrechnung nur hier (Schlussprüfung Bauplan Module): Seite und Bericht zeigen diese Werte."""
    assert a.geld(None, 0.28) is None and a.geld(10.0, 0.28) == pytest.approx(2.8)
    daten = [{"kwh": 30.0, "container": [{"kwh": 30.0}]}, {"kwh": 10.0, "container": [{"kwh": 4.0}, {"kwh": 6.0}]}]
    g = a.abrechnung_geld(daten, 0.25)
    assert [z["anteil"] for z in g] == [75.0, 25.0] and g[0]["eur"] == 7.5 and [c["eur"] for c in g[1]["container"]] == [1.0, 1.5]
    assert a.abrechnung_geld([{"kwh": 0.0, "container": []}], 0.25)[0]["anteil"] == 0.0


def test_hochrechnung_werte():
    h = a.hochrechnung_werte(412.0, 2310.0, 10626.0, 0.28)
    assert h["mit_eur"] == pytest.approx(646.8) and h["ohne_eur"] == pytest.approx(2975.28) and h["bisher_eur"] == pytest.approx(115.36)
    assert h["gespart_eur"] == pytest.approx((10626 - 2310) * 0.28)
    assert a.hochrechnung_werte(None, 100.0, 80.0, 0.28)["gespart_eur"] == 0.0   # nie unter 0
    assert a.hochrechnung_werte(None, None, None, 0.28) == {"bisher_kwh": None, "bisher_eur": None, "mit_kwh": None, "mit_eur": None,
                                                            "ohne_kwh": None, "ohne_eur": None, "gespart_eur": None}


# ---------------------------------------------------------------- WU-0005: Rangliste und Erkenntnisse
from logik.auswertung import erkenntnisse, rangliste  # noqa: E402


def test_rangliste_sortiert_mit_eur_anteil_und_kwh_je_stunde():
    r = rangliste([{"bereich": "a", "name": "Polier", "kwh": 30, "heizzeit": 20}, {"bereich": "b", "name": "Magazin", "kwh": 60, "heizzeit": 25},
                   {"bereich": "c", "name": "Lager", "kwh": 10, "heizzeit": 0}], 0.3)
    assert [c["name"] for c in r] == ["Magazin", "Polier", "Lager"]
    assert r[0]["eur"] == pytest.approx(18) and r[0]["anteil"] == pytest.approx(60) and r[0]["kwh_h"] == pytest.approx(2.4)
    assert r[2]["kwh_h"] is None
    assert rangliste([], 0.3) == []


def test_erkenntnisse_reihenfolge_und_schwellen():
    r = rangliste([{"bereich": "a", "name": "Polier", "kwh": 30, "heizzeit": 20}, {"bereich": "b", "name": "Magazin", "kwh": 60, "heizzeit": 25}], 0.3)
    e = erkenntnisse(r, ohne={"gespart_eur": 120.0, "prozent": 78.0}, gerade={"k": -7.2, "eur_je_grad": 2.0, "null0": 15.5},
                     veraenderung_kwh=31, typ_weniger=16)
    assert [x["art"] for x in e] == ["gespart", "groesster", "sparsamster", "wetter", "mehr"]      # höchstens 5
    assert e[1]["name"] == "Magazin" and e[2]["name"] == "Polier" and e[2]["kwh_h"] == pytest.approx(1.5)
    # unter den Schwellen: nichts Auffälliges
    ruhig = erkenntnisse(r[:1], ohne=None, gerade={"k": 0.4}, veraenderung_kwh=-10, typ_weniger=3)
    assert ruhig == []
    assert [x["art"] for x in erkenntnisse(r, ohne=None, gerade=None, veraenderung_kwh=-20, typ_weniger=-8)] == ["groesster", "sparsamster", "weniger", "typ"]


def test_verlauf_je_tag():
    """WU-0006: kWh je Tag (lokaler Tag) für die Chronik."""
    zone = ZoneInfo("Europe/Vienna")
    energie = [{"start": datetime(2026, 9, 29, 22, 0, tzinfo=timezone.utc).timestamp() * 1000, "change": 5.0},   # 30.09. 00:00 Wien
               {"start": datetime(2026, 9, 28, 22, 0, tzinfo=timezone.utc).timestamp() * 1000, "change": 3.5}]
    w = a.verlauf_werte(energie, {}, zone)
    assert w["je_tag"] == {"2026-09-30": 5.0, "2026-09-29": 3.5} and w["je_monat"] == {"2026-09": 8.5}
