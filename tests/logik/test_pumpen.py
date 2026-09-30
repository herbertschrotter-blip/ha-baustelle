"""Pumpenüberwachung – Fälle aus dem abgenommenen Entwurf."""

from logik.pumpen import Problem, PumpenRegeln, PumpenZustand, laeuft, pruefe

R = PumpenRegeln()


def test_normalbetrieb_ohne_probleme():
    assert pruefe(PumpenZustand(erreichbar=True, leistung=760, laeuft_seit_min=10), R) == []
    assert pruefe(PumpenZustand(erreichbar=True, leistung=0.5), R) == []
    assert laeuft(PumpenZustand(erreichbar=True, leistung=760), R)
    assert not laeuft(PumpenZustand(erreichbar=True, leistung=3), R)


def test_offline_erst_nach_wartezeit():
    assert pruefe(PumpenZustand(erreichbar=False, offline_seit_min=2), R) == []
    assert pruefe(PumpenZustand(erreichbar=False, offline_seit_min=5), R) == [Problem.OFFLINE]


def test_trockenlauf():
    assert pruefe(PumpenZustand(erreichbar=True, leistung=120, laeuft_seit_min=0.5), R) == []
    assert pruefe(PumpenZustand(erreichbar=True, leistung=120, laeuft_seit_min=2), R) == [Problem.TROCKENLAUF]


def test_dauerlauf():
    assert pruefe(PumpenZustand(erreichbar=True, leistung=760, laeuft_seit_min=4 * 60), R) == [Problem.DAUERLAUF]
