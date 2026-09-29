"""Heizungsregeln – Szenarien aus dem abgenommenen Entwurf (mockups/baustelle.html, v4)."""

from logik.heizung import (
    Basis,
    Bereich,
    Grund,
    Lage,
    Modus,
    Regeln,
    Tagesplan,
    UrlaubModus,
    Wetter,
    entscheide,
    fenster,
    naechste_schaltzeit,
)

PLAN = Tagesplan(ein=6 * 60, aus=16 * 60 + 30)
REGEN_KALT = Wetter(aussen=4.5, aussen_max=8.5, frueh_prognose=-2.0, regen_24h=6.4)
REGELN = Regeln()  # Kälte −30 min, Kleidung trocknen 30 min früher / 60 min länger ab 2 mm

BUERO = Bereich(modus=Modus.THERMOSTAT, soll=20.0, temperatur=19.4)
MANNSCHAFT = Bereich(modus=Modus.ZEITPLAN, trocknen=True, temperatur=17.8)
MAGAZIN = Bereich(modus=Modus.ZEITPLAN)


def t(hh: int, mm: int = 0) -> int:
    return hh * 60 + mm


def lage(minute: int, wetter: Wetter = REGEN_KALT, **kw) -> Lage:
    return Lage(minute=minute, plan=kw.pop("plan", PLAN), wetter=wetter, **kw)


def an(bereich: Bereich, minute: int, **kw) -> bool | None:
    return entscheide(bereich, lage(minute, **kw), REGELN).ein


def test_mockup_tagesablauf_regen_und_kaelte():
    # 05:05 – nur der Container mit „Kleidung trocknen“ (05:00 statt 05:30)
    assert (an(BUERO, t(5, 5)), an(MANNSCHAFT, t(5, 5)), an(MAGAZIN, t(5, 5))) == (False, True, False)
    # 05:40 – alle (Kälte-Frühstart 05:30)
    assert (an(BUERO, t(5, 40)), an(MANNSCHAFT, t(5, 40)), an(MAGAZIN, t(5, 40))) == (True, True, True)
    # 17:00 – nur Kleidung trocknen (bis 17:30)
    assert (an(BUERO, t(17)), an(MANNSCHAFT, t(17)), an(MAGAZIN, t(17))) == (False, True, False)
    # 17:40 – alles aus
    assert (an(BUERO, t(17, 40)), an(MANNSCHAFT, t(17, 40)), an(MAGAZIN, t(17, 40))) == (False, False, False)


def test_ohne_regen_keine_verlaengerung():
    trocken = Wetter(aussen=4.5, frueh_prognose=-2.0, regen_24h=0.0)
    assert an(MANNSCHAFT, t(17), wetter=trocken) is False
    assert an(MANNSCHAFT, t(5, 5), wetter=trocken) is False


def test_gruende_fuer_die_anzeige():
    assert entscheide(MANNSCHAFT, lage(t(17)), REGELN).grund is Grund.KLEIDUNG_TROCKNEN
    assert entscheide(MANNSCHAFT, lage(t(5, 5)), REGELN).grund is Grund.KLEIDUNG_TROCKNEN
    assert entscheide(MAGAZIN, lage(t(5, 40)), REGELN).grund is Grund.KAELTE_FRUEHER
    assert entscheide(MAGAZIN, lage(t(10)), REGELN).grund is Grund.ZEITPLAN
    assert entscheide(MAGAZIN, lage(t(20)), REGELN).grund is Grund.AUSSERHALB


def test_fenster_einstellbar():
    regeln = Regeln(trocknen_laenger_min=120, trocknen_frueher_min=45)
    f = fenster(lage(t(10)), regeln, trocknen=True)
    assert (f.ein, f.aus) == (t(6) - 30 - 45, t(16, 30) + 120)
    assert fenster(lage(t(10)), regeln, trocknen=False).aus == t(16, 30)


def test_heizgrenze_jetzt_und_tageshoechst():
    warm = Wetter(aussen=17.0, aussen_max=21.0, frueh_prognose=10.0, regen_24h=0.0)
    assert entscheide(MAGAZIN, lage(t(10), wetter=warm), REGELN) .grund is Grund.HEIZGRENZE
    maessig = Wetter(aussen=12.0, aussen_max=16.0, frueh_prognose=8.0, regen_24h=0.0)
    assert an(MAGAZIN, t(10), wetter=maessig) is True
    tageshoechst = Regeln(heizgrenze_basis=Basis.TAGESHOECHST)
    assert entscheide(MAGAZIN, lage(t(10), wetter=maessig), tageshoechst).ein is False
    aus = Regeln(heizgrenze_aktiv=False)
    assert entscheide(MAGAZIN, lage(t(10), wetter=warm), aus).ein is True


def test_frostschutz_mit_schaltabstand_und_vorrang():
    kalt = Bereich(modus=Modus.AUS, temperatur=4.0)
    d = entscheide(kalt, lage(t(23)), REGELN)
    assert (d.ein, d.grund, d.frost) == (True, Grund.FROSTSCHUTZ, True)
    # bei 6 °C bleibt er an, wenn er schon lief (aus erst über 8 °C)
    halb = Bereich(modus=Modus.AUS, temperatur=6.0)
    assert entscheide(halb, lage(t(23)), REGELN, frost_vorher=True).ein is True
    assert entscheide(halb, lage(t(23)), REGELN, frost_vorher=False).ein is False
    # gilt auch im Handbetrieb, nicht für Bautrockner, nicht ohne Fühler
    assert entscheide(Bereich(modus=Modus.HAND, temperatur=3.0), lage(t(23)), REGELN).ein is True
    assert entscheide(kalt, lage(t(23)), REGELN, frostschutz_gilt=False).ein is False
    assert entscheide(Bereich(modus=Modus.AUS), lage(t(23)), REGELN).grund is Grund.MODUS_AUS


def test_automatik_aus_schaltet_nichts():
    d = entscheide(Bereich(modus=Modus.AUS, temperatur=1.0), lage(t(10), automatik=False), REGELN)
    assert (d.ein, d.grund) == (None, Grund.AUTOMATIK_AUS)


def test_hand_schaltet_nicht():
    assert entscheide(Bereich(modus=Modus.HAND, temperatur=18), lage(t(10)), REGELN).ein is None


def test_thermostat_mit_toleranz():
    b = Bereich(modus=Modus.THERMOSTAT, soll=20.0, temperatur=19.8)
    assert entscheide(b, lage(t(10)), REGELN, war_ein=False).ein is False  # erst ab 19,7
    assert entscheide(b, lage(t(10)), REGELN, war_ein=True).ein is True  # aus erst ab 20,3
    heiss = Bereich(modus=Modus.THERMOSTAT, soll=20.0, temperatur=20.4)
    assert entscheide(heiss, lage(t(10)), REGELN, war_ein=True).grund is Grund.THERMOSTAT_ERREICHT
    # außerhalb des Zeitplans heizt auch der Thermostat nicht
    assert entscheide(BUERO, lage(t(20)), REGELN).ein is False


def test_urlaub_und_feiertag():
    assert entscheide(MAGAZIN, lage(t(10), urlaub=True), REGELN).grund is Grund.URLAUB
    assert entscheide(MAGAZIN, lage(t(10), feiertag=True), REGELN).grund is Grund.FEIERTAG
    absenken = Regeln(urlaub_modus=UrlaubModus.ABSENKEN)
    kalt = Bereich(modus=Modus.ZEITPLAN, temperatur=8.0)
    d = entscheide(kalt, lage(t(10), urlaub=True), absenken)
    assert (d.ein, d.grund) == (True, Grund.ABSENKUNG)
    # ohne Fühler kein Absenken, sondern aus
    assert entscheide(MAGAZIN, lage(t(10), urlaub=True), absenken).ein is False


def test_tag_nicht_aktiv():
    ruhetag = Tagesplan(ein=t(7), aus=t(12), aktiv=False)
    assert entscheide(MAGAZIN, lage(t(9), plan=ruhetag), REGELN).grund is Grund.AUSSERHALB


def test_naechste_schaltzeit():
    bereiche = [BUERO, MANNSCHAFT, MAGAZIN]
    assert naechste_schaltzeit(lage(t(4)), REGELN, bereiche) == (t(5), True)
    assert naechste_schaltzeit(lage(t(10)), REGELN, bereiche) == (t(17, 30), False)
    assert naechste_schaltzeit(lage(t(18)), REGELN, bereiche) is None
    assert naechste_schaltzeit(lage(t(4), automatik=False), REGELN, bereiche) is None
