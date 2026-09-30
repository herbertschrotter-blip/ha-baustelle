"""Wochen- und Monatsbericht – wie Mockup Einstellungen „Bericht“ und „Bericht · Beispiel“ (glas-app.js)."""

from datetime import date, datetime, timedelta, timezone

import pytest

from logik.bericht import (
    anhang_name,
    de,
    heiztage,
    naechster_bericht,
    summe_text,
    text_kurz,
    text_mail,
    vergleich_text,
    zeitraum,
    zeitraum_text,
)

WIEN = timezone(timedelta(hours=2))


def zp(j: int, mo: int, t: int, h: int = 12, mi: int = 0) -> datetime:
    return datetime(j, mo, t, h, mi, tzinfo=WIEN)


# --- naechster_bericht ------------------------------------------------------------------------------------------


def test_aus_liefert_nichts():
    assert naechster_bericht(zp(2026, 9, 30), "aus") is None


def test_woche_naechster_montag_sieben_uhr():
    # Mi 30.09.2026 → Mo 05.10.2026 07:00 (über den Monatswechsel)
    assert naechster_bericht(zp(2026, 9, 30), "woche") == (zp(2026, 10, 5, 7), "woche")
    # Montag vor 07:00 → noch heute
    assert naechster_bericht(zp(2026, 9, 28, 6, 59), "woche") == (zp(2026, 9, 28, 7), "woche")
    # Montag genau 07:00 oder später → nächste Woche
    assert naechster_bericht(zp(2026, 9, 28, 7), "woche") == (zp(2026, 10, 5, 7), "woche")
    # Jahreswechsel: So 27.12.2026 → Mo 28.12.2026, Do 31.12.2026 → Mo 04.01.2027
    assert naechster_bericht(zp(2026, 12, 27), "woche") == (zp(2026, 12, 28, 7), "woche")
    assert naechster_bericht(zp(2026, 12, 31), "woche") == (zp(2027, 1, 4, 7), "woche")


def test_monat_am_ersten_sieben_uhr():
    assert naechster_bericht(zp(2026, 9, 30), "monat") == (zp(2026, 10, 1, 7), "monat")
    assert naechster_bericht(zp(2026, 10, 1, 6), "monat") == (zp(2026, 10, 1, 7), "monat")
    assert naechster_bericht(zp(2026, 10, 1, 7), "monat") == (zp(2026, 11, 1, 7), "monat")
    assert naechster_bericht(zp(2026, 12, 15), "monat") == (zp(2027, 1, 1, 7), "monat")
    assert naechster_bericht(zp(2026, 1, 31), "monat") == (zp(2026, 2, 1, 7), "monat")


def test_beides_nimmt_den_frueheren():
    assert naechster_bericht(zp(2026, 9, 30), "beides") == (zp(2026, 10, 1, 7), "monat")
    assert naechster_bericht(zp(2026, 10, 1, 8), "beides") == (zp(2026, 10, 5, 7), "woche")
    assert naechster_bericht(zp(2026, 12, 29), "beides") == (zp(2027, 1, 1, 7), "monat")


def test_beides_am_selben_montag_den_ersten():
    # Mo 01.02.2027: Wochen- und Monatsbericht zugleich
    assert naechster_bericht(zp(2027, 1, 29), "beides") == (zp(2027, 2, 1, 7), "beides")


def test_unbekannte_haeufigkeit():
    with pytest.raises(ValueError):
        naechster_bericht(zp(2026, 9, 30), "taeglich")


# --- zeitraum ---------------------------------------------------------------------------------------------------


def test_zeitraum_vorwoche_mo_bis_so():
    assert zeitraum("woche", zp(2026, 9, 28, 7)) == (date(2026, 9, 21), date(2026, 9, 27))
    assert zeitraum("woche", zp(2026, 10, 5, 7)) == (date(2026, 9, 28), date(2026, 10, 4))
    assert zeitraum("woche", zp(2027, 1, 4, 7)) == (date(2026, 12, 28), date(2027, 1, 3))


def test_zeitraum_vormonat():
    assert zeitraum("monat", zp(2026, 10, 1, 7)) == (date(2026, 9, 1), date(2026, 9, 30))
    assert zeitraum("monat", zp(2027, 1, 1, 7)) == (date(2026, 12, 1), date(2026, 12, 31))
    assert zeitraum("monat", zp(2028, 3, 1, 7)) == (date(2028, 2, 1), date(2028, 2, 29))


def test_zeitraum_texte_und_anhang():
    assert zeitraum_text("woche", date(2026, 9, 21), date(2026, 9, 27)) == "Woche 21.–27.09.2026"
    assert zeitraum_text("woche", date(2026, 9, 28), date(2026, 10, 4)) == "Woche 28.09.–04.10.2026"
    assert zeitraum_text("woche", date(2025, 12, 29), date(2026, 1, 4)) == "Woche 29.12.2025–04.01.2026"
    assert zeitraum_text("monat", date(2026, 9, 1), date(2026, 9, 30)) == "September 2026"
    assert zeitraum_text("monat", date(2027, 1, 1), date(2027, 1, 31)) == "Jänner 2027"
    assert anhang_name("woche", date(2026, 9, 21)) == "abrechnung-kw39.csv"
    assert anhang_name("monat", date(2026, 9, 1)) == "abrechnung-2026-09.csv"


def test_heiztage_zaehlt_tage_mit_verbrauch():
    verbrauch = {
        "polier": {date(2026, 9, 21): 3.0, date(2026, 9, 22): 0.0, date(2026, 9, 28): 1.0},
        "lager": {date(2026, 9, 21): 1.0, date(2026, 9, 23): 2.0},
    }
    assert heiztage(verbrauch, date(2026, 9, 21), date(2026, 9, 27)) == 2


def test_de_wie_mockup():
    assert de(3693.13, 2) == "3 693,13"
    assert de(412, 0) == "412"
    assert de(0.28, 2) == "0,28"
    assert de(1234.5, 1) == "1\u00a0234,5"
    assert de(2.5, 0) == "3"  # wie toLocaleString, nicht auf gerade
    assert de(412.5, 0) == "413"
    assert de(-0.4, 0) == "0"


def test_heiztage_leer_none_und_negativ():
    assert heiztage({}, date(2026, 9, 21), date(2026, 9, 27)) == 0
    verbrauch = {"polier": {date(2026, 9, 21): None, date(2026, 9, 22): -0.1, date(2026, 9, 23): 0.2}}
    assert heiztage(verbrauch, date(2026, 9, 21), date(2026, 9, 27)) == 1


def test_zeitraum_beides_ist_fehler_und_date_geht():
    with pytest.raises(ValueError):
        zeitraum("beides", zp(2026, 10, 5, 7))
    # „Jetzt senden“ mitten in der Woche: die Vorwoche
    assert zeitraum("woche", date(2026, 9, 30)) == (date(2026, 9, 21), date(2026, 9, 27))


def test_naechster_bericht_jahreswechsel_und_ohne_zeitzone():
    assert naechster_bericht(datetime(2026, 12, 31, 23, 59), "monat") == (datetime(2027, 1, 1, 7), "monat")
    assert naechster_bericht(datetime(2026, 12, 31, 23, 59), "beides") == (datetime(2027, 1, 1, 7), "monat")
    assert naechster_bericht(datetime(2027, 1, 1, 7), "beides") == (datetime(2027, 1, 4, 7), "woche")


# --- Texte ------------------------------------------------------------------------------------------------------

DATEN_WOCHE = {
    "baustelle": "ÖWG Dobl Zwaring",
    "art": "woche",
    "von": date(2026, 9, 21),
    "bis": date(2026, 9, 27),
    "kwh": 312.4,
    "eur": 87.47,
    "vergleich_prozent": -4.2,
    "firmen": [
        {"name": "Eigene Firma", "kwh": 250.0, "eur": 70.0},
        {"name": "Elektro Huber GmbH", "kwh": 62.4, "eur": 17.47},
    ],
    "container": [{"name": "Poliercontainer", "kwh": 120.0}, {"name": "Magazin", "kwh": 62.4}],
    "heiztage": 5,
    "gespart_eur": 38.2,
    "warnungen": [{"bereich": "Lager Süd", "titel": "nicht erreichbar"}, {"bereich": "Sanitär", "titel": "Frostgefahr: 4,2 °C"}],
}


def test_text_mail_woche_wie_mockup():
    betreff, inhalt = text_mail(DATEN_WOCHE)
    assert betreff == "Baustelle ÖWG Dobl Zwaring – Woche 21.–27.09.2026"
    zeilen = inhalt.split("\n")
    assert zeilen[0] == "Vorwoche: 312 kWh · 87,47 € (−4 % zur Woche davor)"
    abschnitte = ["Je Firma", "Je Container", "Heizung", "Offene Warnungen"]
    positionen = [zeilen.index(a) for a in abschnitte]
    assert positionen == sorted(positionen)
    assert "Elektro Huber GmbH: 62 kWh · 17,47 €" in zeilen
    assert "Poliercontainer: 120 kWh" in zeilen
    assert "Heiztage: 5" in zeilen
    assert "gespart durch Automatik: 38 €" in zeilen
    assert zeilen[-2:] == ["Lager Süd: nicht erreichbar", "Sanitär: Frostgefahr: 4,2 °C"]


def test_text_mail_monat_und_ohne_warnungen():
    daten = {
        **DATEN_WOCHE,
        "art": "monat",
        "von": date(2026, 9, 1),
        "bis": date(2026, 9, 30),
        "kwh": 1480.0,
        "eur": 414.4,
        "vergleich_prozent": 31.0,
        "warnungen": [],
    }
    betreff, inhalt = text_mail(daten)
    assert betreff == "Baustelle ÖWG Dobl Zwaring – September 2026"
    zeilen = inhalt.split("\n")
    assert zeilen[0] == "September: 1 480 kWh · 414,40 € (+31 % zum August)"
    assert zeilen[-2:] == ["Offene Warnungen", "keine"]


def test_text_mail_jaenner_vergleicht_mit_dezember():
    daten = {**DATEN_WOCHE, "art": "monat", "von": date(2027, 1, 1), "bis": date(2027, 1, 31), "vergleich_prozent": 0}
    betreff, inhalt = text_mail(daten)
    assert betreff.endswith("– Jänner 2027")
    assert inhalt.split("\n")[0].endswith("(±0 % zum Dezember)")


def test_text_mail_ohne_vergleich_und_ohne_ersparnis():
    daten = {**DATEN_WOCHE, "vergleich_prozent": None, "gespart_eur": None}
    _, inhalt = text_mail(daten)
    assert inhalt.split("\n")[0] == "Vorwoche: 312 kWh · 87,47 €"
    assert not any(z.startswith("gespart") for z in inhalt.split("\n"))


def test_text_kurz_summe_kosten_warnungen():
    text = text_kurz(DATEN_WOCHE)
    assert text.split("\n")[0].startswith("Vorwoche: 312 kWh · 87,47 €")
    assert "2 offene Warnungen" in text
    assert "Lager Süd: nicht erreichbar" in text
    assert text_kurz({**DATEN_WOCHE, "warnungen": []}).endswith("Keine offenen Warnungen")


def test_text_mail_je_firma_nur_mit_verbrauch_und_leere_listen():
    daten = {**DATEN_WOCHE, "firmen": [{"name": "Eigene Firma", "kwh": 10.0, "eur": 2.8}, {"name": "Leer GmbH", "kwh": 0.0, "eur": 0.0}]}
    _, inhalt = text_mail(daten)
    assert "Leer GmbH" not in inhalt
    _, inhalt = text_mail({**DATEN_WOCHE, "firmen": [], "container": [], "warnungen": []})
    zeilen = inhalt.split("\n")
    assert zeilen[zeilen.index("Je Firma") + 1] == ""
    assert zeilen[zeilen.index("Je Container") + 1] == ""


def test_text_mail_warnung_ohne_bereich_und_prozent_rundung():
    daten = {**DATEN_WOCHE, "vergleich_prozent": 2.5, "warnungen": [{"bereich": None, "titel": "Baustelle offline"}]}
    _, inhalt = text_mail(daten)
    assert inhalt.split("\n")[0].endswith("(+3 % zur Woche davor)")
    assert inhalt.split("\n")[-1] == "Baustelle offline"
    assert "1 offene Warnung: Baustelle offline" in text_kurz(daten)


def test_summe_und_vergleich_fuer_die_vorschau_wie_in_der_mail():
    """Die Seite zeigt im „Bericht · Beispiel“ dieselbe Kopfzeile wie die Mail."""
    assert summe_text(DATEN_WOCHE) == "Vorwoche: 312 kWh · 87,47 €"
    assert vergleich_text(DATEN_WOCHE) == " (−4 % zur Woche davor)"
    assert vergleich_text({**DATEN_WOCHE, "vergleich_prozent": None}) == ""
    _, inhalt = text_mail(DATEN_WOCHE)
    assert inhalt.split("\n")[0] == summe_text(DATEN_WOCHE) + vergleich_text(DATEN_WOCHE)
