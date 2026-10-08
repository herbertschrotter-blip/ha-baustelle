"""Container-Inventar: Kürzel, Namen, Entity-IDs, Labels, Nummern (BSM-031.03, Bauplan Inventar §3–§5)."""

import pytest

from logik.inventar import (
    CONTAINER_ARTEN, GERAETE, InventarFehler, container_name, eigene_labels, entity_id, firmenkuerzel_pruefen,
    geraet_name, konflikte, labels, messwert_name, naechste, praefix,
)


def test_kuerzeltabelle_deutsch():
    assert list(CONTAINER_ARTEN) == ["POL", "MAN", "BES", "BUE", "LAG", "MAT", "SAN", "TRO"]
    assert list(GERAETE) == ["PLUG", "HZ", "TEMP", "DOOR", "FEN", "PUMP", "BTR"]
    assert CONTAINER_ARTEN["POL"] == "Polier" and GERAETE["BTR"] == "Bautrockner"


def test_container_eigen_und_fremd():
    assert container_name("POL", nr=1) == "001_C_POL"
    assert container_name("MAN", nr=2) == "002_C_MAN"
    assert container_name("MAN", firma="stra", fremd_nr=1) == "STRA-01_C_MAN"
    assert praefix(nr=12) == "012" and praefix(firma="HUBE", fremd_nr=3) == "HUBE-03"
    with pytest.raises(InventarFehler):
        container_name("FOR", nr=1)          # englisch gibt es nicht (08.10.2026)
    with pytest.raises(InventarFehler):
        container_name("MAN")                 # eigen ohne Nummer
    with pytest.raises(InventarFehler):
        container_name("MAN", firma="STRA")   # fremd ohne Nummer


def test_geraete_nach_container():
    p = praefix(nr=2)
    assert geraet_name(p, "MAN", "PLUG", 1) == "002-01_C_PLUG_MAN"
    assert geraet_name(p, "MAN", "HZ", 1, heiztyp="konvektor") == "002-01_C_HZ_MAN_Konvektor01"
    assert geraet_name(p, "MAN", "HZ", 2, heiztyp="oelradiator", heiz_nr=1) == "002-02_C_HZ_MAN_Radiator01"
    assert geraet_name(p, "MAN", "BTR", 3) == "002-03_C_BTR_MAN"
    assert geraet_name(p, "MAN", "TEMP") == "002_C_TEMP_MAN"
    assert geraet_name(p, "MAN", "DOOR", nr=2) == "002_C_DOOR_MAN_2"
    assert geraet_name(praefix(firma="STRA", fremd_nr=1), "MAN", "PLUG", 1) == "STRA-01-01_C_PLUG_MAN"
    with pytest.raises(InventarFehler):
        geraet_name(p, "MAN", "PLUG")        # Plug ohne GG
    with pytest.raises(InventarFehler):
        geraet_name(p, "MAN", "WIN", 1)      # unbekannter Typ


def test_messwerte_und_entity_ids():
    assert messwert_name("002_C_TEMP_MAN", "Temperatur") == "002_C_TEMP_MAN_Temperatur"
    assert entity_id("switch", "002-01_C_PLUG_MAN") == "switch.002_01_c_plug_man"
    assert entity_id("sensor", "002_C_TEMP_MAN_Temperatur") == "sensor.002_c_temp_man_temperatur"
    assert entity_id("switch", "STRA-01-01_C_PLUG_MAN") == "switch.stra_01_01_c_plug_man"
    assert entity_id("sensor", "002_C_DOOR_MAN_Tür") == "sensor.002_c_door_man_t_r"   # Umlaute kommen im Schema nicht vor


def test_labels():
    assert labels("MAN") == ["Container", "Mannschaft"]
    assert labels("MAN", "PLUG") == ["Container", "Mannschaft", "Shelly Plug"]
    assert labels("MAN", "DOOR", firma="Strabag") == ["Container", "Mannschaft", "Shelly Door Sensor", "Strabag"]
    assert {"Container", "Polier", "Shelly Plug"} <= eigene_labels() and "Strabag" not in eigene_labels()


def test_firmenkuerzel():
    assert firmenkuerzel_pruefen(" stra ") == "STRA"
    for falsch in ("S", "STRABA", "ST1", "", None):
        with pytest.raises(InventarFehler):
            firmenkuerzel_pruefen(falsch)


def test_naechste_nummer_ohne_luecken_fuellen():
    assert naechste([]) == 1
    assert naechste([1, 2, 4]) == 5           # 3 bleibt frei (Nummer gilt für immer)
    assert naechste([None, 7]) == 8


def test_konflikte():
    neu = {"switch.mannschaft_k": "switch.002_01_c_plug_man", "sensor.a": "sensor.b", "sensor.b": "sensor.c",
           "sensor.x": "sensor.x"}
    belegt = {"switch.mannschaft_k", "sensor.a", "sensor.b", "sensor.x", "switch.002_01_c_plug_man_alt"}
    assert konflikte(neu, belegt) == {}                     # b wird frei, x bleibt gleich
    assert konflikte({"sensor.a": "sensor.fremd"}, {"sensor.a", "sensor.fremd"}) == {"sensor.a": "sensor.fremd"}
    assert konflikte({"sensor.a": "sensor.z", "sensor.b": "sensor.z"}, set()) == {"sensor.b": "sensor.z"}
