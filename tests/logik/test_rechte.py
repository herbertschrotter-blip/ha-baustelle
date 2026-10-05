"""Wer auf der Seite was darf (Herbert 04.10.2026, Bauplan 0.7 §8)."""

import pytest

from logik.rechte import AKTIONEN_ALLE, LESEN, darf, rechte

AKTIONEN = ["bedarf", "bedarf_aus", "boost", "jetzt_heizen", "schalten", "automatik", "warnung_stumm", "bericht_senden",
            "test_meldung", "lern_reset", "aktiv", "gefuehl", "soll_versch", "soll_versch_weg", "gefuehl_vergessen",
            "zuruecksetzen", "energie_korrektur"]


@pytest.mark.parametrize("befehl", [*LESEN, "setzen", "liste"])
def test_admin_darf_alles(befehl):
    assert darf(True, befehl)
    assert all(darf(True, "aktion", a) for a in AKTIONEN)
    assert all(darf(True, "meldung", a) for a in ("neu", "status", "loeschen", "bild"))


@pytest.mark.parametrize("befehl", LESEN)
def test_lesen_alle(befehl):
    assert darf(False, befehl)


def test_aendern_nur_admin():
    assert not darf(False, "setzen")
    assert not darf(False, "liste")
    assert not darf(False, "unbekannt")
    assert not darf(False, "notprogramm_pruefen")   # BSM-019: Runde anstoßen nur Admins


def test_aktionen_vor_ort():
    erlaubt = {a for a in AKTIONEN if darf(False, "aktion", a)}
    assert erlaubt == {"gefuehl", "warnung_stumm", "jetzt_heizen", "boost", "bedarf", "bedarf_aus"}
    assert not darf(False, "aktion", None)


def test_meldungen():
    assert darf(False, "meldung", "neu") and darf(False, "meldung", "bild")
    assert not darf(False, "meldung", "status")
    assert not darf(False, "meldung", "loeschen")


def test_rechte_fuer_die_seite():
    assert rechte(True) == {"aendern": True, "aktionen": list(AKTIONEN_ALLE)}
    assert rechte(False)["aendern"] is False
