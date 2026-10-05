"""Programm für das Notprogramm in den Plugs (logik/notprogramm, BSM-017)."""

from dataclasses import replace
import json

from logik.arbeitszeit import Plan
from logik.notprogramm import (
    LEER, MAX_WERT, Vorgaben, frost, minuten_fenster, modus, programm, stand, tag_wert, zusammenfassen,
)

T0 = 1791158400   # Mo 05.10.2026 00:00 UTC
H = 3600
TAG = 24 * H
WOCHE = {T0 + i * TAG: i for i in range(7)}   # Mo = 0

V = Vorgaben(automatik=True, auto=True, hand=False, aktiv=True, modus="thermo", bedarf=False, toleranz=0.3,
             frost=True, frost_grenze=5.0, frost_aus=None, frost_immer=False, tuer_pause_min=3, temp_nr=202, tuer_nr=None)


def test_modus_wie_die_regelung() -> None:
    assert modus(V) == "thermo"
    assert modus(replace(V, temp_nr=None)) == "plan"          # Fühler nicht am Plug: in der Heizzeit an
    assert modus(replace(V, modus="plan")) == "plan"
    assert modus(replace(V, bedarf=True)) == "bedarf"
    assert modus(replace(V, modus="aus")) == "aus"
    assert modus(replace(V, automatik=False)) == "hand"
    assert modus(replace(V, auto=False)) == "hand"
    assert modus(replace(V, hand=True)) == "hand"
    assert modus(replace(V, aktiv=False, hand=True)) == "aus"  # inaktiv: die Automatik lässt es aus


def test_frost() -> None:
    assert frost(V) == (5.0, 7.0)
    assert frost(replace(V, frost_aus=8.5)) == (5.0, 8.5)
    assert frost(replace(V, frost=False)) == (None, None)
    assert frost(replace(V, automatik=False)) == (None, None)
    assert frost(replace(V, automatik=False, frost_immer=True)) == (5.0, 7.0)
    assert frost(replace(V, aktiv=False)) == (None, None)


def test_minuten_fenster_legt_abschnitte_zusammen() -> None:
    plan = Plan(start=345, vor=375, a=420, b=990, nach=1005, ende=1050, eigene=((1200, 1260),))
    assert minuten_fenster(plan) == [(345, 1050), (1200, 1260)]
    assert minuten_fenster(None) == []


def test_zusammenfassen_rundet_nach_aussen() -> None:
    f = zusammenfassen([(T0 + 6 * H + 7 * 60, T0 + 9 * H + 1, 20.04), (T0 + 9 * H, T0 + 10 * H, 20.0),
                        (T0 + 12 * H, T0 + 12 * H, 20.0)])
    assert f == [(T0 + 6 * H, T0 + 10 * H, 20.0)]   # 06:07 → 06:00, 09:00:01 → 09:15, verbunden; leeres weg


def test_tag_wert_bleibt_unter_der_grenze() -> None:
    viele = [(T0 + i * 1800, T0 + i * 1800 + 600 + i, 20.0) for i in range(30)]
    wert = tag_wert(viele)
    assert len(wert) <= MAX_WERT
    teile = [tuple(map(float, x.split(","))) for x in wert.split(";")]
    assert teile[0][0] == T0 and teile[-1][1] == viele[-1][1]   # nichts verloren, nur verbunden
    assert tag_wert([]) == LEER


def test_programm_je_wochentag() -> None:
    jetzt = T0 + 8 * H
    fenster = [
        (T0 + 6 * H, T0 + 17 * H, 20.0),               # heute, läuft gerade
        (T0 - TAG + 6 * H, T0 - TAG + 17 * H, 20.0),   # gestern, vorbei
        (T0 + TAG + 6 * H, T0 + TAG + 17 * H, 20.0),   # Di
        (T0 + 2 * TAG - H, T0 + 2 * TAG + 2 * H, 21.0),   # Di 23:00 bis Mi 02:00 → Di
        (T0 + 6 * TAG + 6 * H, T0 + 6 * TAG + 12 * H, 10.0),   # So, absenken
    ]
    w = programm(V, fenster, WOCHE, jetzt)
    assert set(w) == {"bs_cfg"} | {f"bs_p{i}" for i in range(7)}
    assert w["bs_p0"] == f"{T0 + 6 * H},{T0 + 17 * H},20"
    assert w["bs_p1"] == f"{T0 + TAG + 6 * H},{T0 + TAG + 17 * H},20;{T0 + 2 * TAG - H},{T0 + 2 * TAG + 2 * H},21"
    assert w["bs_p2"] == LEER and w["bs_p6"].endswith(",10")
    cfg = json.loads(w["bs_cfg"])
    assert {k: cfg[k] for k in ("m", "tol", "fe", "fa", "t", "d", "tp")} == {
        "m": "thermo", "tol": 0.3, "fe": 5.0, "fa": 7.0, "t": 202, "d": None, "tp": 3}
    assert all(len(x) <= MAX_WERT for x in w.values())


def test_stand_aendert_sich_mit_dem_inhalt() -> None:
    a = programm(V, [(T0 + 6 * H, T0 + 17 * H, 20.0)], WOCHE, T0)
    b = programm(V, [(T0 + 6 * H, T0 + 17 * H, 20.0)], WOCHE, T0 + H)
    c = programm(V, [(T0 + 6 * H, T0 + 17 * H, 21.0)], WOCHE, T0)
    assert stand(a) == stand(b) != stand(c)
    assert stand({}) is None
