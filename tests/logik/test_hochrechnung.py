"""Hochrechnung mit Energiesignatur und Heizgradtagen (BSM-033.02)."""

from datetime import date, timedelta

import pytest

from logik.hochrechnung import (
    KLIMA_GRAZ, VOLL_ANTEIL, WINTER_K, ContainerRest, Ohne, TagRoh, baustelle, baustelle_tage, bisher, container_rest, hgt, hgt_summe, klima_tag,
    klimamittel, klimamittel_pruefen, ohne_baustelle, ohne_container, reihe, tag_zaehlt, tage, temperaturen,
)
from logik.signatur import Signatur

HEUTE = date(2026, 11, 20)
KLIMA = (0.0, 2.0, 6.0, 11.0, 15.0, 19.0, 21.0, 20.0, 16.0, 10.0, 5.0, 1.0)


def modell(t: float) -> float:
    return 1.0 + 2.0 * max(0.0, 15.0 - t)


def roh(n: int = 30, start: date = date(2026, 10, 20), **kw) -> list[TagRoh]:
    temps = [-3 + (i % 15) for i in range(n)]   # −3 … 11 °C
    return [TagRoh(start + timedelta(days=i), modell(t), t, 86400, **kw) for i, t in enumerate(temps)]


def test_klimamittel_vorgabe_und_einstellung():
    assert klimamittel(None) == KLIMA_GRAZ
    assert klimamittel([1] * 11) == KLIMA_GRAZ
    assert klimamittel(list(range(12))) == tuple(float(i) for i in range(12))


def test_klima_tag_zwischen_monatsmitten():
    assert klima_tag(date(2026, 1, 15), KLIMA) == pytest.approx(0.0)
    assert klima_tag(date(2026, 2, 15), KLIMA) == pytest.approx(2.0)
    assert 0.0 < klima_tag(date(2026, 1, 31), KLIMA) < 2.0
    assert klima_tag(date(2026, 12, 31), KLIMA) == pytest.approx(1.0 - 1.0 * 16 / 31)   # Dezember → Jänner
    assert klima_tag(date(2027, 1, 1), KLIMA) == pytest.approx(1.0 - 1.0 * 17 / 31)


def test_hgt_20_12():
    assert hgt(0.0) == 20.0
    assert hgt(11.9) == pytest.approx(8.1)
    assert hgt(12.0) == 0.0
    assert hgt_summe([0.0, 5.0, 15.0]) == 35.0


def test_welche_tage_zaehlen():
    voll = TagRoh(date(2026, 11, 1), 10.0, 3.0, 86400)
    assert tag_zaehlt(voll, HEUTE)
    assert not tag_zaehlt(TagRoh(HEUTE, 10.0, 3.0, 86400), HEUTE)                                 # heute noch nicht ganz
    assert not tag_zaehlt(TagRoh(date(2026, 11, 1), None, 3.0, 86400), HEUTE)
    assert not tag_zaehlt(TagRoh(date(2026, 11, 1), 10.0, None, 86400), HEUTE)
    assert not tag_zaehlt(TagRoh(date(2026, 11, 1), 10.0, 3.0, 86400 * (VOLL_ANTEIL - 0.01)), HEUTE)  # Ausfall/Notbetrieb
    assert tag_zaehlt(TagRoh(date(2026, 10, 25), 10.0, 3.0, 25 * 3600 * VOLL_ANTEIL, 25 * 3600), HEUTE)  # Sommerzeit-Ende


def test_temperaturen_vorhersage_vor_klima():
    d = [HEUTE + timedelta(days=1), HEUTE + timedelta(days=2)]
    t = temperaturen(d, {d[0]: -5.0}, KLIMA)
    assert t[0] == (-5.0, True)
    assert t[1][1] is False and t[1][0] == pytest.approx(klima_tag(d[1], KLIMA))


def test_rest_mit_signatur_und_spanne():
    ende = date(2027, 4, 30)
    r = container_rest(roh(), HEUTE, ende, {}, KLIMA, date(2026, 10, 1))
    assert r.methode == "signatur" and r.signatur.stand == "gut"
    erwartet = sum(modell(klima_tag(d, KLIMA)) for d in tage(HEUTE + timedelta(days=1), ende))
    assert r.rest_kwh == pytest.approx(erwartet, rel=1e-6)
    # ohne Streuung (Modelldaten): Spanne = wärmerer/kälterer Winter um WINTER_K
    assert r.unten_kwh < r.rest_kwh < r.oben_kwh
    tage_kalt = sum(1 for d in tage(HEUTE + timedelta(days=1), ende) if klima_tag(d, KLIMA) < 15.0)
    assert r.oben_kwh - r.rest_kwh == pytest.approx(2.0 * WINTER_K * tage_kalt, rel=0.05)
    assert r.normjahr_kwh == pytest.approx(sum(modell(klima_tag(d, KLIMA)) for d in tage(date(2026, 10, 1), ende)), rel=1e-6)


def test_vorhersage_ohne_spanne_fuer_diese_tage():
    morgen = HEUTE + timedelta(days=1)
    r = container_rest(roh(), HEUTE, morgen, {morgen: -10.0}, KLIMA, date(2026, 10, 1))
    assert r.rest_kwh == pytest.approx(modell(-10.0))
    assert r.unten_kwh == pytest.approx(r.rest_kwh) and r.oben_kwh == pytest.approx(r.rest_kwh)


def test_lernt_noch_tagesschnitt():
    wenige = roh(5)
    r = container_rest(wenige, HEUTE, HEUTE + timedelta(days=10), {}, KLIMA, date(2026, 10, 1))
    assert r.methode == "tagesschnitt" and r.signatur.stand == "lernt"
    assert r.rest_kwh == pytest.approx(sum(t.kwh for t in wenige) / 5 * 10)
    assert r.unten_kwh is None and r.normjahr_kwh is None


def test_ohne_gezaehlte_tage():
    r = container_rest([], HEUTE, HEUTE + timedelta(days=10), {}, KLIMA, date(2026, 10, 1))
    assert r.methode == "keine" and r.rest_kwh == 0.0


def test_baustelle_summe_und_spanne():
    sig = Signatur("gut", 20)
    a = ContainerRest(100.0, 80.0, 130.0, "signatur", sig, 300.0)
    b = ContainerRest(50.0, 40.0, 70.0, "signatur", sig, 150.0)
    h = baustelle(200.0, {"a": a, "b": b})
    assert h == {"mit_kwh": 350.0, "unten_kwh": 320.0, "oben_kwh": 400.0, "methode": "signatur", "normjahr_kwh": 450.0}
    c = ContainerRest(30.0, None, None, "tagesschnitt", Signatur("lernt", 3), None)
    h = baustelle(200.0, {"a": a, "c": c})
    assert h["mit_kwh"] == 330.0 and h["unten_kwh"] is None and h["methode"] == "tagesschnitt"
    assert baustelle(None, {"a": a})["mit_kwh"] is None
    assert baustelle(10.0, {})["methode"] == "keine"


def test_klimamittel_pruefen():
    assert klimamittel_pruefen(None) is None
    assert klimamittel_pruefen([1.23] * 12) == [1.2] * 12
    for falsch in ([1] * 11, [1] * 13, [40] + [1] * 11, ["a"] * 12, [True] * 12, "x"):
        with pytest.raises(ValueError):
            klimamittel_pruefen(falsch)


def test_bisher_nur_heizperiode_bis_heute():
    r = {"a": [TagRoh(date(2026, 9, 30), 99.0, 5.0, 86400), TagRoh(date(2026, 10, 1), 10.0, 5.0, 86400),
               TagRoh(HEUTE, 4.0, 5.0, 3600), TagRoh(HEUTE + timedelta(days=1), 50.0, 5.0, 0)],
         "b": [TagRoh(date(2026, 10, 2), None, 5.0, 86400), TagRoh(date(2026, 10, 3), 6.0, 5.0, 86400)]}
    assert bisher(r, HEUTE, date(2026, 10, 1)) == pytest.approx(20.0)   # vor Beginn, nach heute und None zählen nicht


def test_reihe_endet_bei_der_hochrechnung():
    """Tagesreihe: tatsächlich bis heute, dann Prognose; der letzte Tag = bisher + Rest, Spanne um die Mitte."""
    beginn, ende = date(2026, 10, 1), date(2027, 4, 30)
    a = roh(start=date(2026, 10, 21)) + [TagRoh(HEUTE, 3.0, 5.0, 3600)]
    rest = container_rest(a, HEUTE, ende, {}, KLIMA, beginn)
    R = reihe({"a": a}, {"a": rest}, HEUTE, beginn, ende, 9000.0)
    assert len(R) == len(tage(beginn, ende)) and R[0][0] == "2026-10-01" and R[-1][0] == "2027-04-30"
    b = bisher({"a": a}, HEUTE, beginn)
    heute = next(z for z in R if z[0] == HEUTE.isoformat())
    assert heute[1] == pytest.approx(b) and heute[2] == pytest.approx(b)
    morgen = R[R.index(heute) + 1]
    assert morgen[1] is None and morgen[2] > b
    tag, ist, mit, unten, oben, ohne = R[-1]
    assert ist is None and mit == pytest.approx(b + rest.rest_kwh, rel=1e-6)
    assert unten == pytest.approx(b + rest.unten_kwh, rel=1e-6) and oben == pytest.approx(b + rest.oben_kwh, rel=1e-6)
    assert unten < mit < oben
    assert ohne == pytest.approx(9000.0) and R[0][5] == pytest.approx(9000.0 / len(R), abs=1e-3)   # Schätzung 24/7: gleichmäßig


def test_rest_von_heute_anteilig():
    """Heute zählt der gemessene Verbrauch zu „bisher“; der Rest des Tages kommt anteilig dazu (Vorhersage, sonst Klima)."""
    beginn, morgen = date(2026, 10, 1), HEUTE + timedelta(days=1)
    ohne = container_rest(roh(), HEUTE, morgen, {morgen: -10.0}, KLIMA, beginn)
    mit = container_rest(roh(), HEUTE, morgen, {morgen: -10.0}, KLIMA, beginn, rest_heute=0.25, aussen_heute=5.0)
    assert ohne.heute_kwh == 0.0 and mit.heute_kwh == pytest.approx(0.25 * modell(5.0))
    assert mit.rest_kwh == pytest.approx(modell(-10.0) + 0.25 * modell(5.0))
    assert mit.unten_kwh == pytest.approx(mit.rest_kwh) and mit.oben_kwh == pytest.approx(mit.rest_kwh)
    klima = container_rest(roh(), HEUTE, morgen, {}, KLIMA, beginn, rest_heute=0.5)
    assert klima.heute_kwh == pytest.approx(0.5 * modell(klima_tag(HEUTE, KLIMA)))
    schnitt = container_rest(roh(5), HEUTE, morgen, {}, KLIMA, beginn, rest_heute=0.5)
    assert schnitt.methode == "tagesschnitt" and schnitt.rest_kwh == pytest.approx(1.5 * sum(t.kwh for t in roh(5)) / 5)
    # außerhalb der Heizperiode zählt heute nicht
    assert container_rest(roh(), HEUTE, morgen, {}, KLIMA, morgen, rest_heute=0.5).heute_kwh == 0.0


def test_reihe_heute_mit_rest_des_tages():
    beginn, ende = date(2026, 10, 1), date(2026, 12, 31)
    a = roh(start=date(2026, 10, 21)) + [TagRoh(HEUTE, 3.0, 5.0, 3600)]
    rest = container_rest(a, HEUTE, ende, {}, KLIMA, beginn, rest_heute=0.75, aussen_heute=5.0)
    R = reihe({"a": a}, {"a": rest}, HEUTE, beginn, ende, None)
    b = bisher({"a": a}, HEUTE, beginn)
    heute = next(z for z in R if z[0] == HEUTE.isoformat())
    assert heute[1] == pytest.approx(b) and heute[2] == pytest.approx(b + 0.75 * modell(5.0))
    assert R[-1][2] == pytest.approx(b + rest.rest_kwh, rel=1e-6)


def test_reihe_lernt_ohne_spanne_und_ohne():
    beginn, ende = date(2026, 10, 1), date(2026, 12, 31)
    a = roh(5, start=date(2026, 11, 10))
    rest = container_rest(a, HEUTE, ende, {}, KLIMA, beginn)
    R = reihe({"a": a}, {"a": rest}, HEUTE, beginn, ende, None)
    assert all(z[3] is None and z[4] is None and z[5] is None for z in R)
    assert R[-1][2] == pytest.approx(bisher({"a": a}, HEUTE, beginn) + rest.rest_kwh)


def test_vor_der_heizperiode_beginnt_der_rest_am_ersten_tag():
    beginn, ende = date(2026, 12, 1), date(2026, 12, 31)
    r = container_rest(roh(), HEUTE, ende, {}, KLIMA, beginn)
    assert len(r.je_tag) == 31


def test_baustelle_tage_nur_wenn_alle_container_zaehlen():
    d1, d2 = date(2026, 11, 1), date(2026, 11, 2)
    r = {"a": [TagRoh(d1, 10.0, 2.0, 86400), TagRoh(d2, 8.0, 4.0, 86400)],
         "b": [TagRoh(d1, 5.0, 2.0, 86400), TagRoh(d2, 4.0, 4.0, 1000)]}   # b am 2.11. nicht ganz
    T = baustelle_tage(r, HEUTE)
    assert len(T) == 1 and T[0].kwh == 15.0 and T[0].aussen == 2.0
    assert baustelle_tage({}, HEUTE) == []


# ------------------------------------------------------------------ IPMVP (BSM-033.04)

def ohne_modell(t: float) -> float:   # ohne Automatik: mehr Grundlast, mehr je Grad (Heizkörper hängt immer am Strom)
    return 3.0 + 3.0 * max(0.0, 16.0 - t)


def test_baseline_tage_fehlen_in_der_signatur_mit_automatik():
    a = roh()
    lauf = {a[3].datum, a[4].datum}
    mit = container_rest(a, HEUTE, date(2027, 4, 30), {}, KLIMA, date(2026, 10, 1), ohne_tage=lauf)
    assert mit.signatur.tage == len(a) - 2


def test_ohne_container_und_heizperiode():
    beginn, ende = date(2026, 10, 1), date(2027, 4, 30)
    start = date(2026, 10, 20)
    temps = [-3 + (i % 22) for i in range(30)]
    ohne_tage = {start + timedelta(days=i) for i in range(0, 30, 2)}      # jeder zweite Tag ein Baseline-Tag
    r = [TagRoh(start + timedelta(days=i), (ohne_modell if start + timedelta(days=i) in ohne_tage else modell)(t), t, 86400)
         for i, t in enumerate(temps)]
    o = ohne_container(r, ohne_tage, HEUTE, beginn, ende, {}, KLIMA)
    assert o.tage == 15 and o.signatur.stand == "gut"
    assert o.signatur.grenze == pytest.approx(16.0) and o.signatur.kwh_je_grad == pytest.approx(3.0)
    erwartet = 0.0
    je = {t.datum: t for t in r}
    for d in tage(beginn, ende):
        t = je.get(d)
        erwartet += t.kwh if d in ohne_tage else ohne_modell(t.aussen if t and d <= HEUTE else klima_tag(d, KLIMA))
    assert o.heizperiode_kwh == pytest.approx(erwartet, rel=1e-6)
    wenig = ohne_container(r, set(list(ohne_tage)[:3]), HEUTE, beginn, ende, {}, KLIMA)
    assert wenig.signatur.stand == "lernt" and wenig.heizperiode_kwh is None


def test_ohne_baustelle_mit_verhaeltnis_je_typ():
    g = Ohne(Signatur("gut", 12), 12, 3000.0)
    lernt = Ohne(Signatur("lernt", 2), 2, None)
    mit = {"a": 1500.0, "b": 1000.0, "c": 800.0}
    typen = {"a": "oelradiator", "b": "oelradiator", "c": "konvektor"}
    assert ohne_baustelle({"a": g, "b": lernt}, mit, typen) is None                         # Konvektor ohne Messung
    k = Ohne(Signatur("gut", 10), 10, 1200.0)
    v = ohne_baustelle({"a": g, "b": lernt, "c": k}, mit, typen)
    assert v == pytest.approx(3000.0 + 1000.0 * 2.0 + 1200.0)                              # b: Verhältnis von a
    assert ohne_baustelle({}, {}, {}) is None
