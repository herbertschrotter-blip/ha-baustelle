"""Abrechnung nach Firma – wie Mockup `abrechnung()` / `csv('firma')` (mockups/quelle/glas-app.js).

Firma je Container (`logik/abrechnung`); Firma je Tag, Tabelle und CSV rechnet `logik/auswertung` (einmal für Seite,
Bericht und CSV-Anhang). Die Fälle der früheren eigenen Aufteilung (`aufteilen`) laufen hier gegen `auswertung.abrechnung`.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from logik import auswertung as a
from logik.abrechnung import firma_am, firma_von, zahl

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


def tage(von: int, bis: int, kwh: float | None) -> list[tuple[datetime, float | None]]:
    """kWh je Tag (Beginn 00:00 Wien) vom `von`. bis `bis`. September."""
    return [(um(t), kwh) for t in range(von, bis + 1)]


def abrechnen(werte: dict[str, list], zuordnung: list[dict], firmen: list[dict] = FIRMEN) -> dict[str, dict]:
    """`auswertung.abrechnung` für eine Baustelle: Firmenname → {kwh, container: {bereich: kwh}} (in Ausgabe-Reihenfolge)."""
    b = {"entry": "x", "titel": "X", "firmen": firmen, "zuordnung": zuordnung,
         "bereiche": [{"id": bid, "name": bid} for bid in werte]}
    daten = a.abrechnung([b], {"x": werte}, WIEN)
    return {z["firma"]: {"kwh": z["kwh"], "container": {c["bereich"]: c["kwh"] for c in z["container"]}} for z in daten}


def test_firma_von_geloeschte_firma_zaehlt_zur_eigenen():
    zuordnung = [{"bereich": "lager", "firma": "weg", "ab": "2026-09-01T00:00:00+02:00"}]
    assert firma_am(zuordnung, "lager", um(5)) == "weg"
    assert firma_von(zuordnung, FIRMEN, "lager", um(5)) == "eigen"
    assert firma_von(ZUORDNUNG, FIRMEN, "lager", um(16)) == "huber"
    assert firma_von(ZUORDNUNG, [], "lager", um(16)) == "eigen"


def test_abrechnung_wechsel_im_zeitraum_teilt_die_tage():
    verbrauch = {"lager": tage(10, 24, 2.0), "polier": tage(10, 24, 1.0), "magazin": tage(10, 24, 0.5)}
    erg = abrechnen(verbrauch, ZUORDNUNG)
    # Lager: 10.–14. leitner (5 Tage), 15.–19. huber (5 Tage), 20.–24. eigen (5 Tage)
    assert erg["Installateur Leitner"]["container"] == {"lager": pytest.approx(10.0)}
    assert erg["Elektro Huber GmbH"]["container"] == {"magazin": pytest.approx(7.5), "lager": pytest.approx(10.0)}
    assert erg["Eigene Firma"]["container"] == {"polier": pytest.approx(15.0), "lager": pytest.approx(10.0)}
    assert erg["Elektro Huber GmbH"]["kwh"] == pytest.approx(17.5)
    # Summen stimmen mit dem Gesamtverbrauch überein
    assert sum(f["kwh"] for f in erg.values()) == pytest.approx(15 * 3.5)
    # eigene Firma zuerst, dann in der Reihenfolge des ersten Verbrauchs
    assert list(erg) == ["Eigene Firma", "Installateur Leitner", "Elektro Huber GmbH"]


def test_abrechnung_wechsel_mitten_am_tag_gilt_ab_folgetag():
    zuordnung = [{"bereich": "lager", "firma": "huber", "ab": "2026-09-15T10:30:00+02:00"}]
    erg = abrechnen({"lager": tage(14, 16, 1.0)}, zuordnung)
    assert erg["Eigene Firma"]["container"]["lager"] == pytest.approx(2.0)  # 14. und 15.
    assert erg["Elektro Huber GmbH"]["container"]["lager"] == pytest.approx(1.0)  # 16.


def test_abrechnung_ohne_zuordnung_alles_eigen_und_ohne_verbrauch_keine_firma():
    erg = abrechnen({"polier": tage(1, 3, 1.5)}, [])
    assert list(erg) == ["Eigene Firma"]
    assert erg["Eigene Firma"] == {"kwh": pytest.approx(4.5), "container": {"polier": pytest.approx(4.5)}}


def test_abrechnung_geloeschte_firma_zaehlt_zur_eigenen():
    zuordnung = [{"bereich": "lager", "firma": "weg", "ab": "2026-09-01T00:00:00+02:00"}]
    erg = abrechnen({"lager": tage(5, 6, 1.0)}, zuordnung)
    assert list(erg) == ["Eigene Firma"]
    assert erg["Eigene Firma"]["kwh"] == pytest.approx(2.0)


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


def test_csv_firma_semikolon_dezimalkomma_bom_crlf():
    verbrauch = {"polier": tage(1, 30, 1.0), "lager": tage(1, 30, 2.0)}
    zuordnung = [{"bereich": "lager", "firma": "leitner", "ab": "2026-09-01T00:00:00+02:00"}]
    b = {"entry": "x", "titel": "ÖWG Dobl Zwaring", "firmen": FIRMEN, "zuordnung": zuordnung,
         "bereiche": [{"id": "polier", "name": "Poliercontainer"}, {"id": "lager", "name": "Lager Süd"}]}
    daten = a.abrechnung([b], {"x": verbrauch}, WIEN)
    text = a.csv_text(a.csv_firma(daten, [b], "Monat", 0.28))
    assert text.startswith("\ufeff")
    assert text[1:].split("\r\n") == [
        "Zeitraum;Firma;Baustelle;Container;kWh;Preis €/kWh;Betrag €",
        "Monat;Eigene Firma;ÖWG Dobl Zwaring;Poliercontainer;30,00;0,28;8,40",
        "Monat;Installateur Leitner;ÖWG Dobl Zwaring;Lager Süd;60,00;0,28;16,80",
    ]
    assert not text.endswith("\r\n")


def test_csv_firma_quotet_semikolon_und_anfuehrungszeichen():
    b = {"entry": "x", "titel": 'Tür "Nord"', "firmen": [{"id": "eigen", "name": "Bau; Süd", "eigen": True}], "zuordnung": [],
         "bereiche": [{"id": "c", "name": "zwei\nZeilen"}]}
    zeilen = a.csv_firma(a.abrechnung([b], {"x": {"c": tage(1, 1, 1.0)}}, WIEN), [b], "Tag", 0.5)
    assert zeilen[1] == 'Tag;"Bau; Süd";"Tür ""Nord""";"zwei\nZeilen";1,00;0,50;0,50'


def test_firma_am_gleicher_zeitpunkt_spaeterer_eintrag_gilt():
    zuordnung = [
        {"bereich": "lager", "firma": "huber", "ab": "2026-09-10T00:00:00+02:00"},
        {"bereich": "lager", "firma": "leitner", "ab": "2026-09-10T00:00:00+02:00"},
    ]
    assert firma_am(zuordnung, "lager", um(10)) == "leitner"
    erg = abrechnen({"lager": tage(9, 10, 1.0)}, zuordnung)
    assert erg["Eigene Firma"]["container"] == {"lager": pytest.approx(1.0)}
    assert erg["Installateur Leitner"]["container"] == {"lager": pytest.approx(1.0)}
    assert "Elektro Huber GmbH" not in erg


def test_abrechnung_mitternacht_gehoert_dem_neuen_tag():
    # Wechsel genau um 00:00 am 15.09.: der 15. gehört schon Huber, der 14. noch Leitner
    zuordnung = [
        {"bereich": "lager", "firma": "leitner", "ab": "2026-09-01T00:00:00+02:00"},
        {"bereich": "lager", "firma": "huber", "ab": "2026-09-15T00:00:00+02:00"},
    ]
    erg = abrechnen({"lager": [(um(14), 1.0), (um(15), 4.0)]}, zuordnung)
    assert erg["Installateur Leitner"]["kwh"] == pytest.approx(1.0)
    assert erg["Elektro Huber GmbH"]["kwh"] == pytest.approx(4.0)


def test_abrechnung_leer_und_none_werte():
    assert abrechnen({}, ZUORDNUNG) == {}
    erg = abrechnen({"polier": [(um(1), None), (um(2), 2.0)]}, [])
    assert erg["Eigene Firma"]["kwh"] == pytest.approx(2.0)


def test_abrechnung_naive_zeiten_und_nur_datum():
    zuordnung = [{"bereich": "lager", "firma": "huber", "ab": "2026-09-15"}]
    erg = abrechnen({"lager": tage(14, 15, 1.0)}, zuordnung)
    assert erg["Eigene Firma"]["kwh"] == pytest.approx(1.0)
    assert erg["Elektro Huber GmbH"]["kwh"] == pytest.approx(1.0)
    assert firma_am(zuordnung, "lager", datetime(2026, 9, 15, 0, 0)) == "huber"
