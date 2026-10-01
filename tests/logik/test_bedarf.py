"""Bedarf in °C für die Rangfolge der Staffelung (Herbert 01.10.2026, Mockup staffel-rang.html)."""

from datetime import datetime, timedelta

import pytest

from logik.bedarf import GERECHT_MAX, ZIEL_VORAUS_MIN, bedarf, gerecht, trend_c_h, ziel_fehlt

T0 = datetime(2026, 10, 1, 6, 0)


def punkte(werte, schritt_min=1):
    return [(T0 + timedelta(minutes=i * schritt_min), v) for i, v in enumerate(werte)]


def test_trend():
    steigt = punkte([18 + i * 0.05 for i in range(16)])          # 0,05 °C/min = 3 °C/h
    assert trend_c_h(steigt, T0 + timedelta(minutes=15)) == pytest.approx(3.0)
    assert trend_c_h(punkte([19.0] * 5), T0 + timedelta(minutes=4)) is None   # zu kurz gemessen
    assert trend_c_h(punkte([19.0, 21.0, 19.0] * 4, 2), T0 + timedelta(minutes=22)) is not None
    assert trend_c_h(punkte([10.0, 40.0], 10), T0 + timedelta(minutes=10)) == 10.0   # Messfehler gekappt


def test_bedarf_mit_traegheit():
    # Poliercontainer heizt (Ölradiator): 19,0 °C bei Soll 20, kühlt ohne Heizen 1,2 °C/h ab (gelernt), Nachlauf 0,3 –
    # der Trend beim Heizen (+2 °C/h) zählt nicht
    b = bedarf(innen=19.0, soll=20.0, trend_h=2.0, abkuehl_gelernt_h=1.2, nachlauf=0.3, laeuft=True)
    assert (b.jetzt, b.abkuehlen, b.nachlauf, b.gemessen, b.summe) == (1.0, 0.3, -0.3, False, 1.0)
    # Mannschaft ist aus und kühlt gemessen 2 °C/h ab (Konvektor) – das gilt, nicht die gelernte Rate
    b = bedarf(innen=19.0, soll=20.0, trend_h=-2.0, abkuehl_gelernt_h=1.0)
    assert (b.abkuehl_h, b.gemessen, b.summe) == (2.0, True, 1.5)
    assert bedarf(innen=19.0, soll=20.0, trend_h=0.5).abkuehlen == 0.0              # aus, wird trotzdem wärmer (Sonne)
    assert bedarf(innen=19.0, soll=20.0, laeuft=True).abkuehlen is None            # nichts gelernt, heizt: kein Beitrag
    assert bedarf(innen=19.0, soll=20.0, nachlauf=0.3, laeuft=False).nachlauf == 0.0
    assert bedarf(innen=None, soll=20.0, zuschlag_gerecht=0.2).summe == 0.2        # ohne Fühler: nur gerecht


def test_ziel_bis_arbeitsbeginn():
    # 16 °C, Soll 20, Rate 3 °C/h, noch 60 min bis zum Ziel → 1 °C fehlt
    assert ziel_fehlt(16.0, 20.0, 3.0, 60) == pytest.approx(1.0)
    assert ziel_fehlt(16.0, 20.0, 3.0, 120) == 0.0      # schafft es
    assert ziel_fehlt(16.0, 20.0, None, 60) == 0.0      # nichts gelernt
    assert ziel_fehlt(16.0, 20.0, 3.0, 0) == 0.0        # Zielzeit vorbei
    assert ziel_fehlt(16.0, 20.0, 3.0, ZIEL_VORAUS_MIN + 1) == 0.0
    assert bedarf(innen=16.0, soll=20.0, ziel=1.0).summe == 5.0


def test_gerecht():
    assert gerecht(20, 40) == pytest.approx(0.2)
    assert gerecht(50, 40) == 0.0
    assert gerecht(0, 600) == GERECHT_MAX
