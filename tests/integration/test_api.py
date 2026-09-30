"""Vertrag Seite ↔ Integration (docs/api-0.7.md): die echte Antwort von `baustelle/struktur` hat dieselben Schlüssel
und Typen wie das Beispiel `tests/panel/struktur-0.7.json`, gegen das die Seite getestet wird."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse


from .conftest import C1, C2, HK2

BEISPIEL = Path(__file__).resolve().parents[1] / "panel" / "struktur-0.7.json"

# Maps mit IDs als Schlüssel: jeder Wert wird mit dem ersten Beispielwert verglichen
ID_MAPS = {
    "entitaeten", "einstellungen.bereiche", "einstellungen.stumm", "laufzeit.container", "laufzeit.geraete",
    "laufzeit.abschnitte", "laufzeit.abschnitte.*",
}
# frei belegte Schlüssel (hängen von der Einrichtung ab)
FREI = {"baustelle.optionen", "zaehler"}


def _typ(wert: Any) -> str:
    if isinstance(wert, bool):
        return "bool"
    if isinstance(wert, (int, float)):
        return "zahl"
    return type(wert).__name__


def _vergleiche(beispiel: Any, echt: Any, pfad: str, muster: str, fehler: list[str]) -> None:
    if beispiel is None or echt is None or muster in FREI:
        return  # null ist überall erlaubt, wo es das Beispiel auch kennt bzw. der Wert optional ist
    if _typ(beispiel) != _typ(echt):
        fehler.append(f"{pfad}: Typ {_typ(echt)} statt {_typ(beispiel)}")
        return
    if isinstance(beispiel, dict):
        if muster in ID_MAPS:
            if beispiel:
                vorlage = next(iter(beispiel.values()))
                for k, v in echt.items():
                    _vergleiche(vorlage, v, f"{pfad}.{k}", f"{muster}.*", fehler)
            return
        for k, v in beispiel.items():
            if k not in echt:
                fehler.append(f"{pfad}.{k}: fehlt")
                continue
            _vergleiche(v, echt[k], f"{pfad}.{k}", f"{muster}.{k}" if muster else k, fehler)
    elif isinstance(beispiel, list) and beispiel and echt:
        gemischt = len({_typ(x) for x in beispiel if x is not None}) > 1
        if gemischt:  # Tupel wie [ISO, art, bid, Text] oder [von, bis, art]
            for i, (b, e) in enumerate(zip(beispiel, echt, strict=False)):
                _vergleiche(b, e, f"{pfad}[{i}]", f"{muster}[]", fehler)
            if len(beispiel) != len(echt):
                fehler.append(f"{pfad}: {len(echt)} statt {len(beispiel)} Felder")
        else:
            vorlage = next((x for x in beispiel if x is not None), None)
            for i, e in enumerate(echt):
                _vergleiche(vorlage, e, f"{pfad}[{i}]", f"{muster}[]", fehler)


def vertrag_pruefen(beispiel: dict, echt: dict) -> list[str]:
    fehler: list[str] = []
    _vergleiche(beispiel, echt, "", "", fehler)
    return fehler


def test_pruefer_findet_abweichungen() -> None:
    beispiel = {"a": 1, "b": {"x": "s"}, "entitaeten": {"k": "v"}, "l": [["t", 1]]}
    assert vertrag_pruefen(beispiel, {"a": 2.5, "b": {"x": "t", "y": 1}, "entitaeten": {"z": "w"}, "l": [["u", 2]]}) == []
    assert vertrag_pruefen(beispiel, {"a": "1", "b": {}, "entitaeten": {"z": 1}, "l": [["u"]]}) == [
        ".a: Typ str statt zahl", ".b.x: fehlt", ".entitaeten.z: Typ zahl statt str", ".l[0]: 1 statt 2 Felder",
    ]


async def test_struktur_wie_beispiel(hass: HomeAssistant, baustelle, freezer, shellys, hass_ws_client) -> None:
    """Eine Baustelle mit möglichst allem, was die Struktur zeigen kann – Antwort über den echten WebSocket."""
    beispiel = json.loads(BEISPIEL.read_text(encoding="utf-8"))
    ws = await hass_ws_client(hass)  # vor dem Zurückstellen der Uhr anmelden (sonst gilt das Token noch nicht)

    async def get_events(call: ServiceCall):
        return {"calendar.besprechungen": {"events": [
            {"start": "2026-10-01T09:00:00+02:00", "end": "2026-10-01T10:30:00+02:00", "summary": "Baubesprechung",
             "description": f"baustelle:{C2} boost"}]}}

    hass.services.async_register("calendar", "get_events", get_events, supports_response=SupportsResponse.ONLY)
    hass.states.async_set("calendar.besprechungen", "off")
    hass.states.async_set("binary_sensor.tuer_c1", "on")
    st = baustelle.runtime_data
    st.e["anschluesse"][0].update(ampere=20, phasen=1, reserve_kw=0.0)
    st.e["ausnahmen"].append({"datum": "2026-10-02", "art": "zeiten", "von": "07:00", "bis": "12:00", "notiz": "x"})
    st.e["firmen"].append({"id": "huber", "name": "Huber", "eigen": False})
    st.e["zuordnung"].append({"bereich": C2, "firma": "huber", "ab": "2026-09-29T08:00:00+02:00"})
    st.e["stumm"]["kein_wetter"] = "2026-09-30T07:00:00+02:00"
    freezer.move_to("2026-09-29 10:00:00+02:00")
    st.einstellung_setzen(("bereiche", C1, "tuer"), "binary_sensor.tuer_c1")
    st.einstellung_setzen(("bereiche", C2, "bedarf"), True)
    st.einstellung_setzen(("termine_kalender",), "calendar.besprechungen")
    st.lz["bedarf_bis"][C2] = "2026-09-29T11:00:00+02:00"
    st.lz["hand"][HK2] = "2026-09-28T09:30:00+02:00"
    st.einstellung_setzen(("automatik",), True)
    await hass.async_block_till_done()

    await ws.send_json({"id": 1, "type": "baustelle/struktur"})
    antwort = await ws.receive_json()
    echt = antwort["result"][0]
    lz = echt["laufzeit"]
    # die Beispielwerte, die ein Vergleich braucht, sind wirklich da
    assert lz["termine"] and lz["warnungen"] and lz["protokoll"] and lz["plan_woche"] and lz["staffel"]["anschluesse"]
    assert lz["container"][C1]["tuer"]["offen"] is True and lz["geraete"][HK2]["hand_seit"]
    assert vertrag_pruefen(beispiel[0], echt) == []
