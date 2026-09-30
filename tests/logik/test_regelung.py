"""Soll je Container – jede Stufe der Reihenfolge einzeln, Beispielzahlen aus dem Mockup."""

from dataclasses import replace

from logik.arbeitszeit import Plan
from logik.regelung import LageContainer, Soll, SollGrund, soll_container


def t(hh: int, mm: int = 0) -> int:
    return hh * 60 + mm


# Mockup: Arbeitszeit 07:00–16:30, Vorheizen 45, Nachheizen 15, Trocknen 45, Frühstart 30 → 05:45–17:30
PLAN = Plan(start=t(5, 45), vor=t(6, 15), a=t(7), b=t(16, 30), nach=t(16, 45), ende=t(17, 30))
TUER_PAUSE = 3

GRUND = LageContainer(
    minute=t(10),
    plan=PLAN,
    automatik=True,
    auto=True,
    temperatur=None,
    soll=20.0,
    frost=True,
    frost_grenze=5.0,
    zu_warm=False,
    frei=False,
    tuer_offen_min=None,
    bedarf=False,
    bedarf_aktiv=False,
    boost=False,
    heizt_gerade=False,
)


def soll(**kw) -> Soll:
    return soll_container(replace(GRUND, **kw), TUER_PAUSE)


def test_automatik_aus_schaltet_nichts():
    assert soll(automatik=False, temperatur=2.0) == Soll(None, SollGrund.AUTOMATIK_AUS)


def test_frost_gilt_immer():
    kalt = dict(temperatur=4.2)
    assert soll(**kalt) == Soll(True, SollGrund.FROST)
    assert soll(**kalt, minute=t(22)) == Soll(True, SollGrund.FROST)
    assert soll(**kalt, auto=False) == Soll(True, SollGrund.FROST)
    assert soll(**kalt, tuer_offen_min=6) == Soll(True, SollGrund.FROST)
    assert soll(**kalt, frei=True, zu_warm=True) == Soll(True, SollGrund.FROST)
    assert soll(**kalt, bedarf=True) == Soll(True, SollGrund.FROST)
    assert soll(**kalt, frost=False, minute=t(22)) == Soll(False, SollGrund.AUSSERHALB)
    # hält bis Grenze + 2 °C
    assert soll(temperatur=6.5, minute=t(22), frost_vorher=True) == Soll(True, SollGrund.FROST)
    assert soll(temperatur=7.0, minute=t(22), frost_vorher=True).grund is SollGrund.AUSSERHALB
    assert soll(temperatur=6.5, minute=t(22)).grund is SollGrund.AUSSERHALB
    # ohne Fühler kein Frostschutz
    assert soll(minute=t(22)).grund is SollGrund.AUSSERHALB


def test_tuer_offen_nach_pause():
    assert soll(tuer_offen_min=6) == Soll(False, SollGrund.TUER_OFFEN)  # Mockup Magazin: 6 min offen
    assert soll(tuer_offen_min=3) == Soll(False, SollGrund.TUER_OFFEN)
    assert soll(tuer_offen_min=2.5) == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(tuer_offen_min=6, boost=True) == Soll(False, SollGrund.TUER_OFFEN)
    assert soll(tuer_offen_min=6, auto=False) == Soll(False, SollGrund.TUER_OFFEN)


def test_container_automatik_aus_ist_hand():
    assert soll(auto=False) == Soll(None, SollGrund.HAND)
    assert soll(auto=False, boost=True) == Soll(None, SollGrund.HAND)


def test_boost():
    # ohne Fühler: solange boost läuft, auch außerhalb, an freien Tagen und über der Heizgrenze
    assert soll(boost=True, minute=t(20)) == Soll(True, SollGrund.BOOST)
    assert soll(boost=True, frei=True, zu_warm=True) == Soll(True, SollGrund.BOOST)
    assert soll(boost=True, bedarf=True) == Soll(True, SollGrund.BOOST)
    # mit Fühler bis zum Soll, danach die normale Regel
    assert soll(boost=True, minute=t(20), temperatur=19.9) == Soll(True, SollGrund.BOOST)
    assert soll(boost=True, minute=t(20), temperatur=20.0) == Soll(False, SollGrund.AUSSERHALB)


def test_bedarf_aktiv_und_bereit():
    assert soll(bedarf=True, bedarf_aktiv=True, minute=t(20)) == Soll(True, SollGrund.BEDARF)
    assert soll(bedarf=True, bedarf_aktiv=True, frei=True, zu_warm=True) == Soll(True, SollGrund.BEDARF)
    # Bedarfs-Container heizt nicht nach der Arbeitszeit
    assert soll(bedarf=True) == Soll(False, SollGrund.BEREIT)
    # mit Fühler regelt der Thermostat
    assert soll(bedarf=True, bedarf_aktiv=True, temperatur=20.5) == Soll(False, SollGrund.BEDARF)
    assert soll(bedarf=True, bedarf_aktiv=True, temperatur=19.5) == Soll(True, SollGrund.BEDARF)


def test_frei():
    assert soll(frei=True) == Soll(False, SollGrund.FREI)
    assert soll(frei=True, zu_warm=True) == Soll(False, SollGrund.FREI)


def test_heizgrenze():
    assert soll(zu_warm=True) == Soll(False, SollGrund.HEIZGRENZE)
    assert soll(zu_warm=True, temperatur=12.0) == Soll(False, SollGrund.HEIZGRENZE)


def test_ohne_fuehler_ein_im_fenster_mit_abschnitt():
    assert soll(minute=t(5, 45)) == Soll(True, SollGrund.FRUEHSTART)
    assert soll(minute=t(6, 15)) == Soll(True, SollGrund.VORHEIZEN)
    assert soll(minute=t(7)) == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(minute=t(16, 30)) == Soll(True, SollGrund.NACHHEIZEN)
    assert soll(minute=t(17)) == Soll(True, SollGrund.TROCKNEN)


def test_ausserhalb_aus():
    assert soll(minute=t(5, 44)) == Soll(False, SollGrund.AUSSERHALB)
    assert soll(minute=t(17, 30)) == Soll(False, SollGrund.AUSSERHALB)  # Ende gehört nicht mehr dazu
    assert soll(plan=None) == Soll(False, SollGrund.AUSSERHALB)


def test_thermostat_mit_hysterese():
    # Soll 20 °C, Toleranz 0,3: ein ab 19,7, aus ab 20,3
    assert soll(temperatur=19.7) == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(temperatur=19.8) == Soll(False, SollGrund.ARBEITSZEIT)
    assert soll(temperatur=19.8, heizt_gerade=True) == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(temperatur=20.2, heizt_gerade=True) == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(temperatur=20.3, heizt_gerade=True) == Soll(False, SollGrund.ARBEITSZEIT)
    assert soll(temperatur=19.8, toleranz=0.1) == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(temperatur=19.4, soll=22.0, minute=t(17)) == Soll(True, SollGrund.TROCKNEN)


def test_thermostat_rundung_der_schwellen():
    # 19,9 − 0,3 ergibt als float 19,5999…; 19,6 °C muss trotzdem einschalten
    assert soll(temperatur=19.6, soll=19.9) == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(temperatur=19.4, soll=19.1, heizt_gerade=True) == Soll(False, SollGrund.ARBEITSZEIT)


def test_frost_grenze_genau():
    assert soll(temperatur=5.0, minute=t(22)).grund is SollGrund.AUSSERHALB  # „unter“ der Grenze
    assert soll(temperatur=4.9, minute=t(22)) == Soll(True, SollGrund.FROST)
    assert soll(temperatur=4.9, automatik=False) == Soll(None, SollGrund.AUTOMATIK_AUS)


def test_tuer_ohne_kontakt_und_bedarf():
    assert soll(tuer_offen_min=None) == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(tuer_offen_min=0) == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(tuer_offen_min=3, bedarf=True, bedarf_aktiv=True) == Soll(False, SollGrund.TUER_OFFEN)


def test_bedarf_ohne_plan_und_hysterese():
    assert soll(bedarf=True, bedarf_aktiv=True, plan=None) == Soll(True, SollGrund.BEDARF)
    assert soll(bedarf=True, plan=None, minute=t(10)) == Soll(False, SollGrund.BEREIT)
    assert soll(bedarf=True, bedarf_aktiv=True, temperatur=20.0, heizt_gerade=True) == Soll(True, SollGrund.BEDARF)


# ---- aus 0.6.3 zurück (Herbert 30.09.2026): Modus je Container, Frostschutz ein/aus, Urlaub/Feiertag
def test_modus_zeitplan_heizt_mit_fuehler_ueber_soll():
    """Zeitplan: in der Heizzeit an, auch wenn der Fühler das Soll schon erreicht hat (Heizkörper regelt selbst)."""
    assert soll(temperatur=22.0, modus="plan") == Soll(True, SollGrund.ARBEITSZEIT)
    assert soll(temperatur=22.0, modus="thermo") == Soll(False, SollGrund.ARBEITSZEIT)


def test_modus_zeitplan_ausserhalb_aus():
    assert soll(minute=t(20), temperatur=12.0, modus="plan") == Soll(False, SollGrund.AUSSERHALB)


def test_modus_aus_nur_frostschutz():
    assert soll(temperatur=12.0, modus="aus") == Soll(False, SollGrund.AUS)
    assert soll(temperatur=3.0, modus="aus") == Soll(True, SollGrund.FROST)


def test_modus_aus_laesst_schnell_aufheizen_zu():
    assert soll(temperatur=12.0, modus="aus", boost=True) == Soll(True, SollGrund.BOOST)


def test_frostschutz_aus_ueber_eigenem_wert():
    assert soll(minute=t(22), temperatur=6.5, frost_vorher=True, frost_aus=8.0) == Soll(True, SollGrund.FROST)
    assert soll(minute=t(22), temperatur=8.0, frost_vorher=True, frost_aus=8.0) == Soll(False, SollGrund.AUSSERHALB)
    assert soll(minute=t(22), temperatur=6.0, frost_aus=8.0) == Soll(False, SollGrund.AUSSERHALB)


def test_frostschutz_aus_unter_grenze_gilt_grenze_plus_2():
    assert soll(minute=t(22), temperatur=6.9, frost_vorher=True, frost_aus=4.0) == Soll(True, SollGrund.FROST)
    assert soll(minute=t(22), temperatur=7.0, frost_vorher=True, frost_aus=4.0) == Soll(False, SollGrund.AUSSERHALB)


def test_urlaub_nur_frostschutz():
    assert soll(frei=True, temperatur=8.0) == Soll(False, SollGrund.FREI)
    assert soll(frei=True, temperatur=4.0) == Soll(True, SollGrund.FROST)


def test_urlaub_absenken_mit_fuehler():
    assert soll(frei=True, frei_modus="absenk", absenk=10.0, temperatur=9.0) == Soll(True, SollGrund.ABSENKEN)
    assert soll(frei=True, frei_modus="absenk", absenk=10.0, temperatur=10.5) == Soll(False, SollGrund.ABSENKEN)
    assert soll(frei=True, frei_modus="absenk", absenk=10.0, temperatur=10.1, heizt_gerade=True) == Soll(True, SollGrund.ABSENKEN)


def test_urlaub_absenken_ohne_fuehler_nur_frostschutz():
    assert soll(frei=True, frei_modus="absenk", temperatur=None) == Soll(False, SollGrund.FREI)


def test_urlaub_alles_aus_auch_kein_frostschutz():
    assert soll(frei=True, frei_modus="aus", temperatur=2.0) == Soll(False, SollGrund.FREI)
    assert soll(frei=False, frei_modus="aus", temperatur=2.0) == Soll(True, SollGrund.FROST)


def test_frostschutz_bei_automatik_aus_nur_mit_schalter():
    assert soll(automatik=False, temperatur=3.0) == Soll(None, SollGrund.AUTOMATIK_AUS)
    assert soll(automatik=False, temperatur=3.0, frost_immer=True) == Soll(True, SollGrund.FROST)
    assert soll(automatik=False, temperatur=6.0, frost_immer=True, frost_vorher=True) == Soll(True, SollGrund.FROST)
    assert soll(automatik=False, temperatur=7.5, frost_immer=True, frost_vorher=True) == Soll(False, SollGrund.AUTOMATIK_AUS)
    assert soll(automatik=False, temperatur=7.5, frost_immer=True) == Soll(None, SollGrund.AUTOMATIK_AUS)
