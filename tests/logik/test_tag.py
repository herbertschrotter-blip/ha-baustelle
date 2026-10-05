"""Tagessummen aus Minutenwerten (BSM-009)."""

from datetime import datetime, timedelta, timezone

import pytest

from logik.tag import BereichZeile, GeraetZeile, bereich_tag, geraet_tag

T0 = datetime(2026, 10, 5, 6, 0, tzinfo=timezone.utc)


def m(n: int) -> datetime:
    return T0 + timedelta(minutes=n)


def g(n: int, ein: int, w: float | None, wh: float | None, dauer: int = 60) -> GeraetZeile:
    return GeraetZeile(m(n), dauer, ein, w, wh)


def test_geraet_tag():
    zeilen = [g(0, 0, 0, 0), g(1, 30, 2000, 16.7), g(2, 60, 2000, 33.3), g(3, 60, 20, 0.3), g(4, 0, 0, 0), g(5, 60, None, 30)]
    t = geraet_tag(zeilen, zieht_w=50)
    assert t.kwh == pytest.approx(0.0803)
    assert t.heizzeit_min == pytest.approx(3.5)        # 30 + 60 + 60 + 60 Sekunden
    assert t.strom_min == pytest.approx(2.5)           # Minute 3 zieht nur 20 W; Minute 5 ohne Messung zählt
    assert t.zyklen == 2                               # ab Minute 1 und ab Minute 5


def test_zyklen_aus_minuten():
    assert geraet_tag([g(0, 20, 1000, 1), g(1, 20, 1000, 1)], 50).zyklen == 1                     # an über die Grenze
    assert geraet_tag([g(0, 60, 1000, 1), g(1, 60, 1000, 1)], 50).zyklen == 1
    assert geraet_tag([g(0, 60, 1000, 1), g(1, 20, 1000, 1), g(2, 60, 1000, 1)], 50).zyklen == 2  # mittendrin kurz aus
    assert geraet_tag([g(0, 0, 0, 0), g(1, 0, 0, 0)], 50).zyklen == 0


def test_bereich_tag():
    hk = [g(0, 60, 2000, 33.3), g(1, 60, 2000, 33.3), g(2, 0, 0, 0)]
    trockner = [g(0, 0, 0, 0), g(1, 0, 0, 0), g(2, 60, 500, 8.3)]
    temps = [BereichZeile(m(0), 60, 18.0), BereichZeile(m(1), 60, 19.0), BereichZeile(m(2), 60, None)]
    aussen = {m(0): 4.0, m(1): 6.0, m(2): 5.0}
    t = bereich_tag({"hk": hk, "tr": trockner}, {"hk"}, temps, aussen, 50)
    assert t.kwh == pytest.approx(0.0749)
    assert t.heizzeit_min == 3.0 and t.strom_min == 2.0   # Trockner ist kein Heizkörper → nicht „tatsächlich geheizt“
    assert t.gradh == pytest.approx((14 + 13) / 60, abs=0.001)
    assert (t.temp_min, t.temp_mittel, t.temp_max, t.aussen_mittel) == (18.0, 18.5, 19.0, 5.0)
    assert t.heiztag


def test_bereich_ohne_heizen_und_ohne_fuehler():
    t = bereich_tag({"hk": [g(0, 0, 0, 0)]}, {"hk"}, [], {m(0): 3.0}, 50)
    assert not t.heiztag and t.gradh == 0 and t.temp_mittel is None and t.aussen_mittel == 3.0
