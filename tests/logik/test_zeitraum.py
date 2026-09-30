"""Zeitraum einer Baustelle: Beginn und Ende automatisch (AN-0002)."""

from datetime import date

from logik.zeitraum import beginn, ende_beim_speichern

HEUTE = date(2026, 9, 30)
GEPLANT = date(2027, 5, 28)


def test_beginn_leer_ist_tag_der_anlage():
    assert beginn(None, date(2026, 9, 8)) == date(2026, 9, 8)
    assert beginn(date(2026, 9, 1), date(2026, 9, 8)) == date(2026, 9, 1)


def test_abschliessen_setzt_immer_heute():
    assert ende_beim_speichern("aktiv", "abgeschlossen", None, HEUTE) == HEUTE
    assert ende_beim_speichern("aktiv", "abgeschlossen", GEPLANT, HEUTE) == HEUTE  # geplantes Ende gilt nicht


def test_abgeschlossen_ende_korrigierbar():
    assert ende_beim_speichern("abgeschlossen", "abgeschlossen", date(2026, 9, 15), HEUTE) == date(2026, 9, 15)
    assert ende_beim_speichern("abgeschlossen", "abgeschlossen", None, HEUTE) == HEUTE


def test_aktiv_behaelt_geplantes_ende():
    # Fehler bis 0.7.26: Speichern einer aktiven Baustelle löschte das geplante Ende
    assert ende_beim_speichern("aktiv", "aktiv", GEPLANT, HEUTE) == GEPLANT
    assert ende_beim_speichern("aktiv", "aktiv", None, HEUTE) is None


def test_wieder_aktiv_ohne_ende():
    assert ende_beim_speichern("abgeschlossen", "aktiv", date(2026, 9, 15), HEUTE) is None
