"""Verlauf 24 h eines Tages (BSM-033.04)."""

import pytest

from logik.tagesverlauf import (
    FROST_ANTEIL, TAGESGANG_K, heizzeit, ohne_profil, plan_anteile, tagesgang, verlauf, verteilen,
)


def test_tagesgang_und_plan():
    assert tagesgang(5.0, 14) == pytest.approx(5.0 + TAGESGANG_K * 0.9914, abs=0.01)   # nachmittags am wärmsten
    assert tagesgang(5.0, 2) < 5.0 < tagesgang(5.0, 13)
    A = plan_anteile([(5 * 60 + 30, 16 * 60)])
    assert A[4] == 0.0 and A[5] == 0.5 and A[6] == 1.0 and A[15] == 1.0 and A[16] == 0.0
    assert heizzeit([(330, 420), (420, 960), (1000, 1020)]) == [[5.5, 16.0], [16.67, 17.0]]


def test_verteilen_summe_bleibt():
    w = [1.0] * 12 + [3.0] * 12
    v = verteilen(30.0, list(range(24)), w)
    assert sum(v.values()) == pytest.approx(30.0) and v[20] == pytest.approx(3 * v[2])
    assert verteilen(10.0, [], w) == {} and verteilen(6.0, [0, 1, 2], [0.0] * 24) == {0: 2.0, 1: 2.0, 2: 2.0}


def test_verlauf_ganzer_tag_prognose():
    """Morgen: alles Prognose, in der Heizzeit mehr, außerhalb nur Frostschutz; ohne rund um die Uhr nach Temperatur."""
    S = verlauf(ist={}, aussen_gemessen={}, aussen_vorhersage={8: 0.0}, mittel=2.0, ab=0, prog_kwh=48.0, ohne_kwh=120.0,
                fenster=[(6 * 60, 16 * 60)], grenze=15.0, profil=None)
    assert len(S) == 24 and all(x.ist is None for x in S)
    assert sum(x.prog for x in S) == pytest.approx(48.0, abs=0.01) and sum(x.ohne for x in S) == pytest.approx(120.0, abs=0.01)
    assert S[10].prog > S[2].prog / FROST_ANTEIL * 0.5 and S[2].prog < S[10].prog * 0.1
    assert S[8].aussen == 0.0 and S[8].quelle == "vorhersage" and S[3].quelle == "tagesgang"
    assert S[3].ohne == S[14].ohne == pytest.approx(5.0)   # Schätzung „rund um die Uhr“: gleichmäßig


def test_verlauf_heute_und_baseline_profil():
    """Heute 10 Uhr: bis 9 gemessen, ab 10 Prognose (laufende Stunde: gemessener Teil + Prognose); ohne nach Profil."""
    ist = {h: 1.0 for h in range(11)}
    profil = ohne_profil([[1.0] * 12 + [3.0] * 12, [0.0] * 24])
    assert profil is not None and sum(profil) == pytest.approx(1.0) and profil[20] == pytest.approx(3 * profil[2])
    S = verlauf(ist=ist, aussen_gemessen={h: 1.0 for h in range(10)}, aussen_vorhersage={}, mittel=3.0, ab=10,
                prog_kwh=20.0, ohne_kwh=96.0, fenster=[(360, 960)], grenze=None, profil=profil)
    assert [x.prog for x in S[:10]] == [None] * 10 and S[10].ist == 1.0 and S[10].prog is not None and S[11].ist is None
    assert sum(x.prog for x in S[10:]) == pytest.approx(20.0, abs=0.01) and S[5].quelle == "gemessen"
    assert S[20].ohne == pytest.approx(96.0 * profil[20], abs=0.01)
    vorbei = verlauf(ist={3: 2.0}, aussen_gemessen={}, aussen_vorhersage={}, mittel=None, ab=24, prog_kwh=0.0, ohne_kwh=None,
                     fenster=[], grenze=None, profil=None)
    assert vorbei[3].ist == 2.0 and vorbei[4].ist == 0.0 and all(x.prog is None and x.ohne is None for x in vorbei)
    assert ohne_profil([]) is None


def test_obergrenze_je_stunde():
    """Keine Stunde über der Leistung aller Heizkörper; der Rest geht auf die anderen Stunden (Summe bleibt)."""
    v = verteilen(30.0, list(range(6)), [10.0, 1.0, 1.0, 1.0, 1.0, 1.0], {h: 8.0 for h in range(6)})
    assert v[0] == pytest.approx(8.0) and sum(v.values()) == pytest.approx(30.0) and v[1] == pytest.approx(22.0 / 5)
    assert sum(verteilen(100.0, [0, 1], [1.0] * 24, {0: 8.0, 1: 8.0}).values()) == pytest.approx(16.0)   # passt nicht ganz hinein
    S = verlauf(ist={10: 3.0}, aussen_gemessen={}, aussen_vorhersage={}, mittel=0.0, ab=10, prog_kwh=60.0, ohne_kwh=400.0,
                fenster=[(600, 720)], grenze=15.0, profil=None, max_kwh_h=9.7)
    assert all(x.ohne <= 9.7 + 1e-6 for x in S) and S[10].prog <= 9.7 - 3.0 + 1e-6 and max(x.prog for x in S[11:]) <= 9.7 + 1e-6
    assert sum(x.prog for x in S[10:]) == pytest.approx(60.0, abs=0.01)
