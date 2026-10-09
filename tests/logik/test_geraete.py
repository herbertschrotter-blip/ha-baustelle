"""Reste gelöschter Geräte und Container (logik/geraete, BSM-034.01)."""

from logik.geraete import hinweise_reste, reste_entfernen


def test_reste_entfernen() -> None:
    daten = {
        "geraete": {"g1": {"aktiv": False}, "weg": {"zusatz": True}},
        "zaehler": {"energie": 5.0, "energie_typ:konvektor": 2.0, "heiztage": 3,
                    "stand:g1": 1.0, "stand:g1:zeit": "x", "stand:weg": 2.0, "stand:weg:zeit": "y", "mittel:weg": 900.0,
                    "zyklen:weg": 4, "energie:c1": 1.0, "energie:cweg": 1.0, "vgl_kwh:cweg": 0.5, "kosten:c1": 0.3},
        "stumm": {"kein_wetter": "t", "zu_kalt:c1": "t", "zu_kalt:cweg": "t", "offline:c1:g1": "t", "offline:c1:weg": "t"},
    }
    weg = reste_entfernen(daten, ["c1"], ["g1"])
    assert daten["geraete"] == {"g1": {"aktiv": False}}
    assert daten["zaehler"] == {"energie": 5.0, "energie_typ:konvektor": 2.0, "heiztage": 3, "stand:g1": 1.0,
                                "stand:g1:zeit": "x", "energie:c1": 1.0, "kosten:c1": 0.3}
    assert daten["stumm"] == {"kein_wetter": "t", "zu_kalt:c1": "t", "offline:c1:g1": "t"}
    assert "geraete:weg" in weg and "zaehler:stand:weg:zeit" in weg and "stumm:offline:c1:weg" in weg
    assert reste_entfernen(daten, ["c1"], ["g1"]) == []   # nichts mehr übrig
    assert reste_entfernen({}, [], []) == []


def test_hinweise_reste() -> None:
    ids = ["ohne_leistung_E_g1", "ohne_leistung_E_weg", "fehlt_E_switch.a", "fehlt_E_switch.alt",
           "ohne_leistung_F_weg", "fehlt_F_switch.alt", "entitaet_fehlt_x"]
    assert hinweise_reste(ids, "E", ["g1"], ["switch.a"]) == ["ohne_leistung_E_weg", "fehlt_E_switch.alt"]
