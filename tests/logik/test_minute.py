"""Minutenwerte aus Zustandsfolgen (BSM-007)."""

from datetime import datetime, timedelta, timezone

import pytest

from logik.minute import BereichSammler, GeraetSammler, Zeitanteil, Zeitmittel

T0 = datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc)


def s(sek: float) -> datetime:
    return T0 + timedelta(seconds=sek)


def test_zeitmittel_gewichtet_und_max():
    m = Zeitmittel(T0, 1000.0)
    m.setzen(s(30), 2000.0)
    assert m.abschliessen(s(60)) == (1500.0, 2000.0, 90000.0)
    # nächster Abschnitt beginnt mit dem aktuellen Wert
    assert m.abschliessen(s(120)) == (2000.0, 2000.0, 120000.0)


def test_zeitmittel_unbekannt_zaehlt_nicht():
    m = Zeitmittel(T0, None)
    m.setzen(s(45), 100.0)
    mittel, hoechst, _ = m.abschliessen(s(60))
    assert mittel == 100.0 and hoechst == 100.0
    assert Zeitmittel(T0, None).abschliessen(s(60))[:2] == (None, None)


def test_zeitanteil():
    a = Zeitanteil(T0, False)
    a.setzen(s(10), True)
    a.setzen(s(40), False)
    assert a.abschliessen(s(60)) == (30.0, False)
    a.setzen(s(70), None)   # nicht erreichbar
    a.setzen(s(80), True)
    assert a.abschliessen(s(120)) == (40.0, True)
    assert a.abschliessen(s(180)) == (60.0, False)


def test_geraet_mit_zaehler():
    g = GeraetSammler(T0, False, 0.0, 10.0, mit_zaehler=True)
    g.schalter(s(15), True)
    g.leistung(s(15), 2000.0)
    g.zaehler(s(59), 10.025)
    m = g.abschliessen(s(60))
    assert (m.dauer_s, m.sekunden_ein, m.leistung_w_max, m.zaehlerstand_kwh, m.erreichbar) == (60, 45, 2000.0, 10.025, True)
    assert m.leistung_w == pytest.approx(1500.0) and m.energie_wh == pytest.approx(25.0)
    m2 = g.abschliessen(s(120))   # weiter ein, Zähler meldet nichts Neues
    assert m2.sekunden_ein == 60 and m2.energie_wh == 0.0


def test_geraet_luecke_wird_spaeter_gezaehlt():
    """Zähler 3 Tage weg, dann 60 kWh mehr: zählt in der Minute der Rückkehr (Grenze je Stunde der Lücke)."""
    g = GeraetSammler(T0, True, 2000.0, 100.0, mit_zaehler=True)
    g.abschliessen(s(60))
    g.schalter(s(60), None)
    m = g.abschliessen(s(120))
    assert not m.erreichbar and m.energie_wh == 0.0
    ende = s(120) + timedelta(hours=72)
    g.schalter(ende - timedelta(seconds=30), True)
    g.zaehler(ende - timedelta(seconds=30), 160.0)
    m = g.abschliessen(ende)
    assert m.energie_wh == pytest.approx(60000.0)


def test_geraet_ohne_zaehler_aus_leistung():
    g = GeraetSammler(T0, True, 1200.0, None, mit_zaehler=False)
    m = g.abschliessen(s(60))
    assert m.energie_wh == pytest.approx(20.0) and m.zaehlerstand_kwh is None


def test_bereich_temperatur_und_tuer():
    b = BereichSammler(T0, 18.0, False, mit_tuer=True)
    b.temperatur(s(30), 20.0)
    b.tuer(s(50), True)
    m = b.abschliessen(s(60))
    assert (m.dauer_s, m.temperatur, m.tuer_offen_s) == (60, 19.0, 10)
    ohne = BereichSammler(T0, None, None, mit_tuer=False).abschliessen(s(60))
    assert ohne.temperatur is None and ohne.tuer_offen_s is None


def test_nachspielen_geraet_wie_mitschreiben():
    """BSM-008: Verlauf aus HA ergibt dieselben Minuten wie das Mitschreiben."""
    from logik.minute import GeraetVerlauf, nachspielen_geraet
    v = GeraetVerlauf(schalter=[(s(-600), False), (s(15), True)], leistung=[(s(-600), 0.0), (s(15), 2000.0)],
                      zaehler=[(s(-600), 10.0), (s(59), 10.025)], mit_zaehler=True)
    minuten = nachspielen_geraet(v, T0, s(120))
    assert [b for b, _ in minuten] == [T0, s(60)]
    erste, zweite = minuten[0][1], minuten[1][1]
    assert (erste.sekunden_ein, erste.energie_wh, erste.zaehlerstand_kwh) == (45, pytest.approx(25.0), 10.025)
    assert zweite.sekunden_ein == 60 and zweite.leistung_w == 2000.0
    assert nachspielen_geraet(GeraetVerlauf([], [], [], False), T0, s(60)) == []


def test_nachspielen_bereich_mit_grund_und_teilminuten():
    from logik.minute import BereichVerlauf, nachspielen_bereich
    v = BereichVerlauf(temperatur=[(s(-5), 18.0), (s(40), 20.0)], tuer=None, grund=[(s(-5), "heizgrenze"), (s(100), "arbeitszeit")])
    minuten = nachspielen_bereich(v, s(30), s(150))   # Beginn und Ende mitten in der Minute
    assert [(b, m.dauer_s) for b, m, _ in minuten] == [(s(30), 30), (s(60), 60), (s(120), 30)]
    assert minuten[0][1].temperatur == pytest.approx((18 * 10 + 20 * 20) / 30, abs=0.01)
    assert [g for _, _, g in minuten] == ["heizgrenze", "arbeitszeit", "arbeitszeit"]
    assert minuten[0][1].tuer_offen_s is None
