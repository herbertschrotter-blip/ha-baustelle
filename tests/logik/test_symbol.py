"""Container-Symbol (logik/symbol, BSM-032)."""

import pytest

from logik.symbol import bereinigen, fenster_zustand, licht_an, standard


def test_standard_eine_tuer_ein_fenster() -> None:
    s = standard()
    assert len(s["tueren"]) == 1 and len(s["fenster"]) == 1 and s["doppel"] is False and s["farbe"] is None


def test_bereinigen() -> None:
    assert bereinigen(None) is None
    s = bereinigen({"doppel": 1, "farbe": "#3987E5", "tueren": [{"wand": "seite", "pos": 0.52, "sensor": "binary_sensor.tuer"}],
                    "fenster": [{"wand": "front", "pos": 0.1}, {"wand": "front", "pos": 0.9, "sensor": ""}], "licht": "switch.licht"})
    assert s == {"doppel": True, "farbe": "#3987E5", "rahmen": None, "tueren": [{"wand": "seite", "pos": 0.5, "sensor": "binary_sensor.tuer"}],
                 "fenster": [{"wand": "front", "pos": 0.15, "sensor": None}, {"wand": "front", "pos": 0.85, "sensor": None}], "licht": "switch.licht"}
    for falsch in [{"tueren": [], "fenster": [{"wand": "front"}]},                                          # keine Tür
                   {"tueren": [{"wand": "front"}] * 3, "fenster": [{"wand": "front"}]},                     # 3 Türen
                   {"tueren": [{"wand": "front"}], "fenster": [{"wand": "front"}] * 5},                     # 5 Fenster
                   {"tueren": [{"wand": "hinten"}], "fenster": [{"wand": "front"}]},                        # Wand unsichtbar
                   {"tueren": [{"wand": "front"}], "fenster": [{"wand": "front"}], "farbe": "blau"},
                   {"tueren": [{"wand": "front"}], "fenster": [{"wand": "front"}], "rahmen": "rot"},
                   {"tueren": [{"wand": "front", "sensor": "kein_entity"}], "fenster": [{"wand": "front"}]}, "x"]:
        with pytest.raises(ValueError):
            bereinigen(falsch)


def test_rahmen() -> None:
    s = bereinigen({"tueren": [{"wand": "front"}], "fenster": [{"wand": "front"}], "rahmen": "#c62828"})
    assert s["rahmen"] == "#c62828" and standard()["rahmen"] is None


def test_fenster_zustand() -> None:
    assert fenster_zustand(False, 12.0) == "zu" and fenster_zustand(None, None) == "zu"
    assert fenster_zustand(True, 8.0) == "gekippt" and fenster_zustand(True, -6.0) == "gekippt"
    assert fenster_zustand(True, 2.0) == "offen" and fenster_zustand(True, None) == "offen"


def test_licht_an() -> None:
    assert licht_an("on", None) and not licht_an("off", None) and not licht_an(None, None)
    assert licht_an("120", 120.0) and not licht_an("10", 10.0)
