"""Lernende Regelung (0.8): TPI, Nachlauf lernen, K-Werte lernen."""

from datetime import datetime, timedelta, timezone

import pytest

from logik.lernen import (
    KEXT_START,
    KINT_START,
    STOPP_AB_MIN,
    Tpi,
    anzeige,
    band,
    ein_minuten,
    klasse,
    mittel_neu,
    nachlauf_erwartet,
    neuer_stand,
    takt,
    tpi_anteil,
    tpi_ein,
)

T0 = datetime(2026, 10, 1, 7, 0, tzinfo=timezone(timedelta(hours=2)))


def test_tpi_anteil_mit_nachlauf_und_aussen():
    t = Tpi(kint=0.6, kext=0.01, nachlauf=0.0, aussen=0.0, minute_im_zyklus=0)
    assert tpi_anteil(19.0, 20.0, t) == pytest.approx(0.6 + 0.2)
    # erwarteter Nachlauf 0,8 °C: der Raum gilt schon als 19,8 °C warm – weniger heizen
    assert tpi_anteil(19.0, 20.0, Tpi(0.6, 0.01, 0.8, 0.0, 0)) == pytest.approx(0.6 * 0.2 + 0.2)
    assert tpi_anteil(25.0, 20.0, t) == 0.0 and tpi_anteil(10.0, 20.0, t) == 1.0
    assert tpi_anteil(19.0, 20.0, Tpi(0.6, 0.01, 0.0, None, 0)) == pytest.approx(0.6)


def test_tpi_ein_je_zyklus():
    assert [tpi_ein(0.4, m) for m in range(10)] == [True] * 4 + [False] * 6
    assert not any(tpi_ein(0.15, m) for m in range(10))     # unter 2 min: gar nicht
    assert all(tpi_ein(0.85, m) for m in range(10))         # über 8 min: durchgehend


def test_klassen_und_baender():
    assert [klasse(m) for m in (5, 15, 44, 45, 60)] == ["kurz", "mittel", "mittel", "lang", "lang"]
    assert band(4.9) == "kalt" and band(5.0) == "mild" and band(None) == "mild"
    log = [(T0, T0 + timedelta(minutes=20)), (T0 + timedelta(minutes=30), None)]
    assert ein_minuten(log, T0 + timedelta(minutes=50)) == pytest.approx(40)


def _lauf(stand, minuten_ein, temperaturen, art="oel", aussen=0.0, soll=20.0, ab=T0):
    """minuten_ein Minuten heizen (zuletzt bei der ersten Temperatur), dann aus mit den Temperaturen je Minute."""
    t = ab
    for _ in range(minuten_ein):
        stand = takt(stand, jetzt=t, heizt=True, innen=temperaturen[0], soll=soll, aussen=aussen, art=art, regelt=True)
        t += timedelta(minutes=1)
    for temp in temperaturen:
        stand = takt(stand, jetzt=t, heizt=False, innen=temp, soll=soll, aussen=aussen, art=art, regelt=True)
        t += timedelta(minutes=1)
    return stand, t


def test_nachlauf_oelradiator_lernen():
    # 60 min geheizt, bei 19,0 aus, steigt 12 min auf 20,2, fällt dann
    temps = [19.0 + 0.1 * i for i in range(13)] + [20.1, 20.0, 19.9]
    s, _ = _lauf(neuer_stand(), 60, temps)
    assert s["beob"] is None and s["zyklen"] == 1
    grad, minuten, n = s["nachlauf"]["oel|lang|kalt"]
    assert grad == pytest.approx(1.2) and minuten == pytest.approx(12) and n == 1
    assert nachlauf_erwartet(s["nachlauf"], "oel", "lang", "kalt") == pytest.approx(1.2)
    assert nachlauf_erwartet(s["nachlauf"], "oel", "lang", "mild") == pytest.approx(1.2)   # anderes Band als Ersatz
    assert nachlauf_erwartet(s["nachlauf"], "konvektor", "lang", "kalt") == 0.0
    assert s["treffer"] == [pytest.approx(0.2)]


def test_konvektor_kaum_nachlauf_und_mittelwert():
    s, t = _lauf(neuer_stand(), 20, [19.9, 20.0, 19.9, 19.7], art="konvektor")
    assert s["nachlauf"]["konvektor|mittel|kalt"][0] == pytest.approx(0.1)
    assert mittel_neu([1.0, 10, 1], 2.0, 20)[:2] == [pytest.approx(1.2), pytest.approx(12)]


def test_kurze_tpi_pause_zaehlt_nicht():
    s, t = _lauf(neuer_stand(), 10, [19.0, 19.1, 19.2])          # 3 min aus, Temperatur steigt noch
    s = takt(s, jetzt=t, heizt=True, innen=19.2, soll=20.0, aussen=0.0, art="oel", regelt=True)
    assert s["beob"] is None and s["nachlauf"] == {} and s["zyklen"] == 0
    assert STOPP_AB_MIN == 20


def test_kint_lernt_aus_ueberschwingern():
    s = neuer_stand()
    t = T0
    for _ in range(3):   # jedes Mal bei 19,6 aus, Spitze 20,8 (deutlich über 20)
        s, t = _lauf(s, 30, [19.6 + 0.2 * i for i in range(7)] + [20.5], ab=t)
    assert s["n_kint"] == 3 and s["kint"] < KINT_START
    a = anzeige(s)
    assert a["kint"]["fort"] == pytest.approx(3 / 50) and a["zyklen"] == 3 and len(a["treffer"]) == 3


def test_kext_lernt_in_ruhigen_zyklen():
    s = neuer_stand()
    t = T0
    for _ in range(25):  # 25 min knapp 0,5 °C unter dem Soll, regelt selbst
        s = takt(s, jetzt=t, heizt=False, innen=19.5, soll=20.0, aussen=0.0, art="oel", regelt=True)
        t += timedelta(minutes=1)
    assert s["n_kext"] == 2 and s["kext"] == pytest.approx(KEXT_START + 0.002)
    # regelt nicht (z. B. Hand): nichts lernen
    s2 = takt(neuer_stand(), jetzt=T0, heizt=False, innen=19.5, soll=20.0, aussen=0.0, art="oel", regelt=False)
    assert s2["zyklus"] is None
