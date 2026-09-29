"""Zählen: Zählerstände, Mittel im Betrieb, Heizperiode, Hochrechnung."""

import pytest

from logik.zaehlen import (
    energie_zuwachs,
    hochrechnung,
    leistung_integriert,
    mittel_im_betrieb,
    tage_heizperiode,
)


def test_energie_zuwachs():
    assert energie_zuwachs(10.0, 10.5) == pytest.approx(0.5)
    assert energie_zuwachs(10.0, 0.2) == pytest.approx(0.2)  # Shelly zählt neu
    assert energie_zuwachs(None, 3.0) == 0.0
    assert energie_zuwachs(1.0, None) == 0.0
    assert energie_zuwachs(1.0, 500.0) == 0.0  # unglaubwürdig


def test_leistung_integriert():
    assert leistung_integriert(2000, 0.5) == pytest.approx(1.0)
    assert leistung_integriert(None, 1) == 0.0
    assert leistung_integriert(2000, 0) == 0.0


def test_mittel_im_betrieb_nur_waehrend_heizen():
    assert mittel_im_betrieb(None, 0.0) is None
    assert mittel_im_betrieb(None, 2000) == 2000
    assert mittel_im_betrieb(2000, 0.0) == 2000  # Thermostat aus: Mittel bleibt
    assert mittel_im_betrieb(2000, 1800) == pytest.approx(1990)


def test_tage_heizperiode():
    assert tage_heizperiode(10, 4, 2026) == 212  # 1.10.2026–30.4.2027
    assert tage_heizperiode(10, 3, 2026) == 182
    assert tage_heizperiode(1, 12, 2027) == 365


def test_hochrechnung():
    assert hochrechnung(100, 0.5, 30) is None
    assert hochrechnung(100, 10, 30) == pytest.approx(300)
