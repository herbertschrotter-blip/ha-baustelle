"""Abrechnung nach Firma – wie Mockup `abrechnung()` / `csv('firma')` (mockups/quelle/glas-app.js)."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from logik.abrechnung import (
    CSV_KOPF_FIRMA,
    abrechnung_zeilen,
    aufteilen,
    csv_zeilen,
    firma_am,
    zahl,
)

WIEN = timezone(timedelta(hours=2))
FIRMEN = [
    {"id": "eigen", "name": "Eigene Firma", "eigen": True},
    {"id": "huber", "name": "Elektro Huber GmbH"},
    {"id": "leitner", "name": "Installateur Leitner"},
]
ZUORDNUNG = [
    {"bereich": "magazin", "firma": "huber", "ab": "2026-09-01T00:00:00+02:00"},
    {"bereich": "lager", "firma": "leitner", "ab": "2026-09-01T00:00:00+02:00"},
    # Lager wechselt am 15.09. zu Huber, am 20.09. zurück zur eigenen Firma
    {"bereich": "lager", "firma": "huber", "ab": "2026-09-15T00:00:00+02:00"},
    {"bereich": "lager", "firma": "eigen", "ab": "2026-09-20T00:00:00+02:00"},
]


def um(tag: int, h: int = 0, m: int = 0) -> datetime:
    return datetime(2026, 9, tag, h, m, tzinfo=WIEN)


def test_firma_am_folgt_dem_verlauf():
    assert firma_am(ZUORDNUNG, "lager", um(1)) == "leitner"
    assert firma_am(ZUORDNUNG, "lager", um(14, 23, 59)) == "leitner"
    assert firma_am(ZUORDNUNG, "lager", um(15)) == "huber"
    assert firma_am(ZUORDNUNG, "lager", um(25)) == "eigen"


def test_firma_am_ohne_eintrag_oder_vor_dem_ersten_ist_eigen():
    assert firma_am(ZUORDNUNG, "polier", um(10)) == "eigen"
    assert firma_am(ZUORDNUNG, "magazin", datetime(2026, 8, 31, 23, 59, tzinfo=WIEN)) == "eigen"
    assert firma_am([], "magazin", um(10)) == "eigen"


def test_firma_am_unsortiert_und_andere_zeitzone():
    zuordnung = list(reversed(ZUORDNUNG))
    assert firma_am(zuordnung, "lager", um(16)) == "huber"
    # 14.09. 22:00 UTC = 15.09. 00:00 in Wien
    assert firma_am(ZUORDNUNG, "lager", datetime(2026, 9, 14, 22, 0, tzinfo=timezone.utc)) == "huber"
    assert firma_am(ZUORDNUNG, "lager", datetime(2026, 9, 14, 21, 59, tzinfo=timezone.utc)) == "leitner"


def test_firma_am_mit_datetime_eintraegen():
    zuordnung = [{"bereich": "x", "firma": "huber", "ab": um(10, 12)}]
    assert firma_am(zuordnung, "x", um(10, 11, 59)) == "eigen"
    assert firma_am(zuordnung, "x", um(10, 12)) == "huber"


def tage(von: int, bis: int, kwh: float) -> dict[date, float]:
    return {date(2026, 9, t): kwh for t in range(von, bis + 1)}


def test_aufteilen_wechsel_im_zeitraum_teilt_die_tage():
    verbrauch = {"lager": tage(10, 24, 2.0), "polier": tage(10, 24, 1.0), "magazin": tage(10, 24, 0.5)}
    erg = aufteilen(verbrauch, ZUORDNUNG, 0.28, firmen=FIRMEN)
    # Lager: 10.–14. leitner (5 Tage), 15.–19. huber (5 Tage), 20.–24. eigen (5 Tage)
    assert erg["leitner"]["container"] == {"lager": pytest.approx(10.0)}
    assert erg["huber"]["container"] == {"magazin": pytest.approx(7.5), "lager": pytest.approx(10.0)}
    assert erg["eigen"]["container"] == {"polier": pytest.approx(15.0), "lager": pytest.approx(10.0)}
    assert erg["huber"]["kwh"] == pytest.approx(17.5)
    assert erg["huber"]["eur"] == pytest.approx(17.5 * 0.28)
    # Summen stimmen mit dem Gesamtverbrauch überein
    assert sum(f["kwh"] for f in erg.values()) == pytest.approx(15 * 3.5)
    assert sum(f["eur"] for f in erg.values()) == pytest.approx(15 * 3.5 * 0.28)
    # Reihenfolge wie die Firmenliste
    assert list(erg) == ["eigen", "huber", "leitner"]


def test_aufteilen_wechsel_mitten_am_tag_gilt_ab_folgetag():
    zuordnung = [{"bereich": "lager", "firma": "huber", "ab": "2026-09-15T10:30:00+02:00"}]
    erg = aufteilen({"lager": tage(14, 16, 1.0)}, zuordnung, 0.3)
    assert erg["eigen"]["container"]["lager"] == pytest.approx(2.0)  # 14. und 15.
    assert erg["huber"]["container"]["lager"] == pytest.approx(1.0)  # 16.


def test_aufteilen_ohne_zuordnung_alles_eigen_und_ohne_verbrauch_keine_firma():
    erg = aufteilen({"polier": tage(1, 3, 1.5)}, [], 0.28)
    assert list(erg) == ["eigen"]
    assert erg["eigen"] == {"kwh": pytest.approx(4.5), "eur": pytest.approx(1.26), "container": {"polier": pytest.approx(4.5)}}


def test_aufteilen_geloeschte_firma_zaehlt_zur_eigenen():
    zuordnung = [{"bereich": "lager", "firma": "weg", "ab": "2026-09-01T00:00:00+02:00"}]
    erg = aufteilen({"lager": tage(5, 6, 1.0)}, zuordnung, 0.28, firmen=FIRMEN)
    assert list(erg) == ["eigen"]
    assert erg["eigen"]["kwh"] == pytest.approx(2.0)
    # ohne Firmenliste bleibt die ID sichtbar
    assert list(aufteilen({"lager": tage(5, 6, 1.0)}, zuordnung, 0.28)) == ["weg"]


def test_zahl_dezimalkomma_ohne_tausendertrennung():
    assert zahl(3693.125) == "3693,13"  # Rundung wie toFixed: genau halb → weg von null
    assert zahl(2.5, 0) == "3"
    assert zahl(0.125) == "0,13"
    assert zahl(1.005) == "1,00"  # 1,005 ist binär knapp darunter – auch toFixed liefert 1,00
    assert zahl(Decimal("3693.125")) == "3693,13"
    assert zahl(3693.13) == "3693,13"
    assert zahl(0.28) == "0,28"
    assert zahl(1.23456, 3) == "1,235"
    assert zahl(-0.001) == "0,00"
    assert zahl(1234567.8) == "1234567,80"


def test_csv_semikolon_dezimalkomma_bom_crlf():
    text = csv_zeilen(["Firma", "kWh", "Betrag €"], [["Elektro Huber GmbH", 13189.75, 3693.13], ["Eigene Firma", 12, None]])
    assert text.startswith("﻿")
    assert text[1:].split("\r\n") == [
        "Firma;kWh;Betrag €",
        "Elektro Huber GmbH;13189,75;3693,13",
        "Eigene Firma;12;",
    ]
    assert "\n" not in text.replace("\r\n", "")
    assert not text.endswith("\r\n")


def test_csv_quotet_semikolon_anfuehrungszeichen_und_umbrueche():
    text = csv_zeilen(["Container", "Notiz"], [['Lager; Süd', 'Tür "Nord"'], ["Polier", "zwei\nZeilen"]])
    zeilen = text[1:].split("\r\n")
    assert zeilen[1] == '"Lager; Süd";"Tür ""Nord"""'
    assert zeilen[2] == 'Polier;"zwei\nZeilen"'


def test_csv_datum_als_tt_mm_jjjj():
    text = csv_zeilen(["Tag", "kWh"], [[date(2026, 9, 1), zahl(1.2346, 3)]])
    assert text[1:].split("\r\n")[1] == "01.09.2026;1,235"


def test_abrechnung_zeilen_wie_mockup_csv_firma():
    verbrauch = {"polier": tage(1, 30, 1.0), "lager": tage(1, 30, 2.0)}
    zuordnung = [{"bereich": "lager", "firma": "leitner", "ab": "2026-09-01T00:00:00+02:00"}]
    erg = aufteilen(verbrauch, zuordnung, 0.28, firmen=FIRMEN)
    zeilen = abrechnung_zeilen(
        erg,
        zeitraum="September 2026",
        baustelle="ÖWG Dobl Zwaring",
        firmen=FIRMEN,
        container_namen={"polier": "Poliercontainer", "lager": "Lager Süd"},
        preis=0.28,
    )
    text = csv_zeilen(CSV_KOPF_FIRMA, zeilen)
    assert text[1:].split("\r\n") == [
        "Zeitraum;Firma;Baustelle;Container;kWh;Preis €/kWh;Betrag €",
        "September 2026;Eigene Firma;ÖWG Dobl Zwaring;Poliercontainer;30,00;0,28;8,40",
        "September 2026;Installateur Leitner;ÖWG Dobl Zwaring;Lager Süd;60,00;0,28;16,80",
    ]


def test_firma_am_gleicher_zeitpunkt_spaeterer_eintrag_gilt():
    zuordnung = [
        {"bereich": "lager", "firma": "huber", "ab": "2026-09-10T00:00:00+02:00"},
        {"bereich": "lager", "firma": "leitner", "ab": "2026-09-10T00:00:00+02:00"},
    ]
    assert firma_am(zuordnung, "lager", um(10)) == "leitner"
    erg = aufteilen({"lager": tage(9, 10, 1.0)}, zuordnung, 0.28)
    assert erg["eigen"]["container"] == {"lager": pytest.approx(1.0)}
    assert erg["leitner"]["container"] == {"lager": pytest.approx(1.0)}
    assert "huber" not in erg


def test_aufteilen_mitternacht_gehoert_dem_neuen_tag():
    # Wechsel genau um 00:00 am 15.09.: der 15. gehört schon Huber, der 14. noch Leitner
    zuordnung = [
        {"bereich": "lager", "firma": "leitner", "ab": "2026-09-01T00:00:00+02:00"},
        {"bereich": "lager", "firma": "huber", "ab": "2026-09-15T00:00:00+02:00"},
    ]
    erg = aufteilen({"lager": {date(2026, 9, 14): 1.0, date(2026, 9, 15): 4.0}}, zuordnung, 0.25)
    assert erg["leitner"]["kwh"] == pytest.approx(1.0)
    assert erg["huber"]["kwh"] == pytest.approx(4.0)
    assert erg["huber"]["eur"] == pytest.approx(1.0)


def test_aufteilen_leer_und_none_werte():
    assert aufteilen({}, ZUORDNUNG, 0.28) == {}
    assert aufteilen({}, ZUORDNUNG, 0.28, firmen=FIRMEN) == {}
    erg = aufteilen({"polier": {date(2026, 9, 1): None, date(2026, 9, 2): 2.0}}, [], 0.5)
    assert erg["eigen"]["kwh"] == pytest.approx(2.0)
    assert erg["eigen"]["eur"] == pytest.approx(1.0)


def test_aufteilen_naive_zeiten_und_nur_datum():
    zuordnung = [{"bereich": "lager", "firma": "huber", "ab": "2026-09-15"}]
    erg = aufteilen({"lager": tage(14, 15, 1.0)}, zuordnung, 0.28)
    assert erg["eigen"]["kwh"] == pytest.approx(1.0)
    assert erg["huber"]["kwh"] == pytest.approx(1.0)
    assert firma_am(zuordnung, "lager", datetime(2026, 9, 15, 0, 0)) == "huber"


def test_csv_leere_zeilenliste_nur_kopf_und_quoted_kopf():
    assert csv_zeilen(["a;b", "c"], []) == '\ufeff"a;b";c'
