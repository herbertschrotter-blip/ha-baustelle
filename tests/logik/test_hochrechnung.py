"""Hochrechnung mit Energiesignatur und Heizgradtagen (BSM-033.02)."""

from datetime import date, timedelta

import pytest

from logik.hochrechnung import (
    KLIMA_GRAZ, VOLL_ANTEIL, WINTER_K, ContainerRest, TagRoh, baustelle, container_rest, hgt, hgt_summe, klima_tag,
    klimamittel, tag_zaehlt, tage, temperaturen,
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
