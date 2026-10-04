"""Strompreis mit „gilt ab“ (Herbert 04.10.2026)."""

from datetime import date, datetime

import pytest

from logik.preise import liste, preis_am, preis_mittel, speichern

P = liste([{"ab": "2026-10-04", "preis": 0.20}, {"ab": "2026-09-01", "preis": 0.28}], 0.3)


def test_liste_und_preis_am():
    assert P == [(date(2026, 9, 1), 0.28), (date(2026, 10, 4), 0.20)]
    assert preis_am(P, date(2026, 10, 3)) == 0.28
    assert preis_am(P, date(2026, 10, 4)) == 0.20
    assert preis_am(P, date(2026, 8, 1)) == 0.28            # vor dem ersten Eintrag: der erste
    assert liste(None, 0.25) == [(date.min, 0.25)] and preis_am(liste([], 0.25), date(2026, 1, 1)) == 0.25
    assert liste([{"ab": "kaputt", "preis": 1}], 0.25) == [(date.min, 0.25)]


def test_preis_mittel_gewichtet():
    # 02.–04.10.: 39,53 / 31,46 kWh zu 0,28 € und 28,27 kWh zu 0,20 €
    v = [(date(2026, 10, 2), 39.53), (date(2026, 10, 3), 31.46), (datetime(2026, 10, 4, 7), 28.27), (date(2026, 10, 5), None)]
    p = preis_mittel(P, v, date(2026, 10, 4))
    assert p * (39.53 + 31.46 + 28.27) == pytest.approx((39.53 + 31.46) * 0.28 + 28.27 * 0.20)
    assert preis_mittel(P, [], date(2026, 10, 4)) == 0.20   # ohne Verbrauch: Preis am letzten Tag


def test_speichern():
    roh = [{"ab": "2026-09-01", "preis": 0.28}]
    neu = speichern(roh, date(2026, 10, 4), 0.2)
    assert neu == [{"ab": "2026-09-01", "preis": 0.28}, {"ab": "2026-10-04", "preis": 0.2}]
    assert speichern(neu, date(2026, 10, 4), 0.22)[-1]["preis"] == 0.22 and len(speichern(neu, date(2026, 10, 4), 0.22)) == 2
