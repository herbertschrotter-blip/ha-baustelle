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


def test_sensor_eintragen() -> None:
    """BSM-034.03: Tür/Fenster aus dem Inventar ins Aussehen – erst in freie Plätze, dann neu, solange Platz ist."""
    from logik.symbol import sensor_eintragen

    s = sensor_eintragen(None, "fenster", "binary_sensor.f1")
    assert s["fenster"][0]["sensor"] == "binary_sensor.f1"
    assert sensor_eintragen(s, "fenster", "binary_sensor.f1") is None                      # schon eingetragen
    s = sensor_eintragen(s, "tuer", "binary_sensor.t2", tuerkontakt="binary_sensor.t1")     # Tür 1 hat den Türkontakt
    assert [t["sensor"] for t in s["tueren"]] == [None, "binary_sensor.t2"] and s["tueren"][1]["pos"] not in (0.15, 0.67)
    assert sensor_eintragen(s, "tuer", "binary_sensor.t3", tuerkontakt="binary_sensor.t1") is None   # nur 2 Türen
    assert sensor_eintragen(s, "tuer", "binary_sensor.t1", tuerkontakt="binary_sensor.t1") is None   # Türkontakt selbst
    for i in range(2, 5):
        s = sensor_eintragen(s, "fenster", f"binary_sensor.f{i}")
    assert len(s["fenster"]) == 4 and sensor_eintragen(s, "fenster", "binary_sensor.f5") is None
    assert sensor_eintragen(None, "tuer", "binary_sensor.t9")["tueren"][0]["sensor"] == "binary_sensor.t9"   # ohne Türkontakt
