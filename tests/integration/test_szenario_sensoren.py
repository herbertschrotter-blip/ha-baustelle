"""Szenarien Sensoraufbau × Modus (Themenfeld 1): Container mit/ohne Fühler, mit/ohne Türkontakt, ein oder zwei
Heizkörper; Modus Zeitplan/Thermostat/Bei Bedarf/Hand/Aus; Innentemperatur unter Soll, in der Toleranz, über Soll;
Arbeitszeit, Vorheizen, Nachheizen, nach Arbeitsende, nachts; Fühler und Shelly fallen aus.

Erwartetes Verhalten nach logik/regelung.py (Docstring und Reihenfolge), Bauplan 0.7 §2.2, api-0.7 §7 und den
Mockup-Texten (glas.html `TEXT_MOCKUP`, „Zeitplan – der Heizkörperthermostat regelt“, „Aus – nur Frostschutz“,
„Hand – die Automatik schaltet nicht“). Arbeitszeit der Testbaustelle: Mo–Do 07:00–16:30, Vorheizen 45 min,
Nachheizen 15 min, Soll 20 °C, Toleranz 0,3 °C, Frostschutz unter 5 °C. Staffelung ist aus (außer wo sie geprüft wird),
damit nur die Regelung des Containers zählt.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from homeassistant.core import Context, HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.baustelle.const import DOMAIN
from custom_components.baustelle.daten import struktur

from .conftest import C1, C2, HK1, HK2, P1, SCHACHT, STANDARD_ZUSTAND, sub

START = "2026-09-29 16:50:00+02:00"   # wie die Fixture `baustelle`: Arbeitszeit gilt ab Di 29.09.
ZEIT = {
    "arbeitszeit": "2026-09-29 10:00:00+02:00",      # Di, 07:00–16:30
    "vorheizen": "2026-09-30 06:30:00+02:00",        # Mi, Vorheizen ab 06:15
    "nachheizen": "2026-09-29 16:40:00+02:00",       # 16:30–16:45
    "nach_arbeitsende": "2026-09-29 17:30:00+02:00",
    "nachts": "2026-09-30 02:00:00+02:00",
}
TUER = "binary_sensor.tuer_c1"


# ---------------------------------------------------------------------- Aufbau
async def _aufbau(
    hass: HomeAssistant, freezer, shellys, hass_ws_client, *, fuehler: bool = True, zwei: bool = False,
    tuer: bool = False, staffel: bool = False,
) -> SimpleNamespace:
    """Baustelle B1 wie conftest, aber Container 1 wahlweise ohne Fühler, mit zweitem Heizkörper und Türkontakt."""
    client = await hass_ws_client(hass)   # vor dem Zurückstellen der Uhr anmelden (sonst gilt das Token noch nicht)
    await hass.config.async_set_time_zone("Europe/Vienna")
    freezer.move_to(START)
    for entity_id, wert in STANDARD_ZUSTAND.items():
        hass.states.async_set(entity_id, wert)
    c1: dict[str, Any] = {"name": "Container 1", "art": "container"}
    if fuehler:
        c1["fuehler"] = "sensor.temp_c1"
    entry = MockConfigEntry(
        domain=DOMAIN, title="B1", data={"name": "B1"},
        options={"heizung": True, "pumpen": True, "status": "aktiv", "beginn": "2026-09-01",
                 "heizperiode_von": "10", "heizperiode_bis": "4", "empfaenger": ["mobile_app_test"],
                 "temp_sensor": "sensor.aussen", "regen_sensor": "sensor.regen"},
        subentries_data=[
            sub(C1, "bereich", "Container 1", c1),
            sub(C2, "bereich", "Container 2", {"name": "Container 2", "art": "container"}),
            sub(SCHACHT, "bereich", "Schacht", {"name": "Schacht", "art": "pumpenschacht"}),
            sub(HK1, "geraet", "Heizkörper 1", {"bereich": C1, "schalter": "switch.hk1", "name": "Heizkörper 1",
                                                "rolle": "heizkoerper", "typ": "oelradiator", "leistung": "sensor.hk1_power"}),
            sub(HK2, "geraet", "Heizkörper 2", {"bereich": C1 if zwei else C2, "schalter": "switch.hk2",
                                                "name": "Heizkörper 2", "rolle": "heizkoerper", "typ": "konvektor",
                                                "leistung": "sensor.hk2_power"}),
            sub(P1, "geraet", "Pumpe 1", {"bereich": SCHACHT, "schalter": "switch.p1", "name": "Pumpe 1",
                                          "rolle": "pumpe", "typ": "konvektor", "leistung": "sensor.p1_power"}),
        ],
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    shellys.anmelden()
    st = entry.runtime_data
    st.e["staffel"]["an"] = staffel
    zaehler = {"id": 0}

    async def rufe(typ: str, **felder: Any) -> dict[str, Any]:
        zaehler["id"] += 1
        await client.send_json({"id": zaehler["id"], "type": typ, "entry_id": entry.entry_id, **felder})
        antwort = await client.receive_json()
        await hass.async_block_till_done()
        return antwort

    b = SimpleNamespace(hass=hass, entry=entry, st=st, rufe=rufe, freezer=freezer)
    if tuer:
        hass.states.async_set(TUER, "off")
        assert (await rufe("baustelle/setzen", pfad=["bereiche", C1, "tuer"], wert=TUER))["success"]
    return b


async def _modus(b: SimpleNamespace, modus: str) -> dict[str, Any]:
    return await b.rufe("baustelle/setzen", pfad=["bereiche", C1, "modus"], wert=modus)


async def _zu(b: SimpleNamespace, wann: str) -> None:
    b.freezer.move_to(ZEIT.get(wann, wann))
    b.st.auswerten()
    await b.hass.async_block_till_done()


async def _automatik(b: SimpleNamespace) -> None:
    b.st.einstellung_setzen(("automatik",), True)
    await b.hass.async_block_till_done()


async def _temp(b: SimpleNamespace, wert: str) -> None:
    b.hass.states.async_set("sensor.temp_c1", wert)
    await b.hass.async_block_till_done()


def _c(b: SimpleNamespace, bid: str = C1) -> dict[str, Any]:
    return struktur(b.hass, b.entry)["laufzeit"]["container"][bid]


def _an(b: SimpleNamespace, schalter: str = "switch.hk1") -> bool:
    return b.hass.states.get(schalter).state == "on"


def _warn(b: SimpleNamespace) -> list[tuple[str, str | None, str | None]]:
    return [(w["art"], w["bereich"], w["geraet"]) for w in struktur(b.hass, b.entry)["laufzeit"]["warnungen"]]


def _texte(b: SimpleNamespace, art: str | None = None) -> list[str]:
    return [p[3] for p in b.st.e["protokoll"] if art is None or p[1] == art]


# ---------------------------------------------------------------------- Matrix: ein Heizkörper, ohne Tür
# (fühler, modus, innen, zeit) → (Heizkörper an, zustand, grund, text)
MATRIX = [
    # Thermostat mit Fühler: auf Soll in der Heizzeit, sonst aus; Frostschutz geht vor
    pytest.param(True, "thermo", "17.0", "arbeitszeit", True, "heizt", "arbeitszeit", "heizt · Arbeitszeit", id="thermo-kalt-arbeitszeit"),
    pytest.param(True, "thermo", "20.0", "arbeitszeit", False, "aus", "arbeitszeit", "aus", id="thermo-toleranz-arbeitszeit"),
    pytest.param(True, "thermo", "21.0", "arbeitszeit", False, "aus", "arbeitszeit", "aus", id="thermo-warm-arbeitszeit"),
    pytest.param(True, "thermo", "17.0", "vorheizen", True, "heizt", "vorheizen", "heizt · Arbeitszeit", id="thermo-kalt-vorheizen"),
    pytest.param(True, "thermo", "21.0", "vorheizen", False, "aus", "vorheizen", "aus", id="thermo-warm-vorheizen"),
    pytest.param(True, "thermo", "17.0", "nachheizen", True, "heizt", "nachheizen", "heizt · Arbeitszeit", id="thermo-kalt-nachheizen"),
    pytest.param(True, "thermo", "17.0", "nach_arbeitsende", False, "aus", "ausserhalb", "aus bis 06:15", id="thermo-kalt-nach-arbeitsende"),
    pytest.param(True, "thermo", "17.0", "nachts", False, "aus", "ausserhalb", "aus bis 06:15", id="thermo-kalt-nachts"),
    pytest.param(True, "thermo", "4.0", "nachts", True, "frost", "frost", "Frostschutz", id="thermo-frost-nachts"),
    # Zeitplan mit Fühler: in der Heizzeit an (der Heizkörperthermostat regelt), auch über Soll
    pytest.param(True, "plan", "21.0", "arbeitszeit", True, "heizt", "arbeitszeit", "heizt · Arbeitszeit", id="plan-fuehler-warm-arbeitszeit"),
    pytest.param(True, "plan", "17.0", "nachts", False, "aus", "ausserhalb", "aus bis 06:15", id="plan-fuehler-nachts"),
    pytest.param(True, "plan", "4.0", "nachts", True, "frost", "frost", "Frostschutz", id="plan-fuehler-frost-nachts"),
    # Aus: nur Frostschutz
    pytest.param(True, "aus", "17.0", "arbeitszeit", False, "aus", "aus", "aus · nur Frostschutz", id="aus-fuehler-arbeitszeit"),
    pytest.param(True, "aus", "4.0", "arbeitszeit", True, "frost", "frost", "Frostschutz", id="aus-fuehler-frost"),
    # Bei Bedarf ohne Anforderung: bereit, nur Frostschutz
    pytest.param(True, "bedarf", "17.0", "arbeitszeit", False, "bereit", "bereit", "bei Bedarf · nur Frostschutz", id="bedarf-fuehler-bereit"),
    # Hand: die Automatik schaltet nicht (Heizkörper bleibt, wie er ist: hier aus)
    pytest.param(True, "hand", "17.0", "arbeitszeit", False, "aus", "hand", "aus", id="hand-fuehler-arbeitszeit"),
    # ohne Fühler
    pytest.param(False, "plan", None, "arbeitszeit", True, "heizt", "arbeitszeit", "an · Thermostat regelt", id="plan-ohne-arbeitszeit"),
    pytest.param(False, "plan", None, "vorheizen", True, "heizt", "vorheizen", "an · Thermostat regelt", id="plan-ohne-vorheizen"),
    pytest.param(False, "plan", None, "nachts", False, "aus", "ausserhalb", "aus bis 06:15", id="plan-ohne-nachts"),
    pytest.param(False, "bedarf", None, "arbeitszeit", False, "bereit", "bereit", "bei Bedarf · nur Frostschutz", id="bedarf-ohne-bereit"),
    pytest.param(False, "hand", None, "arbeitszeit", False, "aus", "hand", "aus", id="hand-ohne-arbeitszeit"),
]


@pytest.mark.parametrize(("fuehler", "modus", "innen", "zeit", "an", "zustand", "grund", "text"), MATRIX)
async def test_matrix_ein_heizkoerper(
    hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client,
    fuehler, modus, innen, zeit, an, zustand, grund, text,
) -> None:
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, fuehler=fuehler)
    if innen is not None:
        await _temp(b, innen)
    assert (await _modus(b, modus))["success"]
    await _zu(b, zeit)
    await _automatik(b)
    c = _c(b)
    assert _an(b) is an
    assert (c["zustand"], c["grund"], c["text"], c["modus"]) == (zustand, grund, text, modus)
    assert c["tuer"] is None                                   # ohne Türkontakt keine Tür
    assert c["temperatur"] == (float(innen) if innen is not None else None)
    if an:
        assert "switch.hk1" in shellys.ein()
        assert any(t.endswith(("Heizkörper 1 ein", "alle Container ein")) for t in _texte(b, "schalten"))
    else:
        assert "switch.hk1" not in shellys.ein()
    modus_text = {"plan": "Zeitplan", "thermo": "Thermostat", "bedarf": "Bei Bedarf", "hand": "Hand", "aus": "Aus"}[modus]
    assert f"Modus: {modus_text}" in _texte(b, "einstellung")


# ---------------------------------------------------------------------- Modus-Regeln
async def test_thermo_ohne_fuehler_abgelehnt(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """api-0.7 §7: Thermostat nur mit Fühler, sonst `invalid_format`; der abgeleitete Modus bleibt Zeitplan."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, fuehler=False)
    antwort = await _modus(b, "thermo")
    assert antwort["error"]["code"] == "invalid_format" and "fühler" in antwort["error"]["message"]
    assert b.st.e["bereiche"][C1]["modus"] is None and _c(b)["modus"] == "plan"
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    assert _an(b) and _c(b)["text"] == "an · Thermostat regelt"


async def test_modus_abgeleitet_je_aufbau(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Ohne gesetzten Modus: mit Fühler Thermostat, ohne Zeitplan (bauplan-0.7 §6)."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, fuehler=True)
    assert _c(b)["modus"] == "thermo" and _c(b, C2)["modus"] == "plan" and _c(b, SCHACHT)["modus"] is None


async def test_thermostat_hysterese(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """In der Toleranz behält der Thermostat den Zustand: ein ab ≤ 19,7 °C, aus ab ≥ 20,3 °C."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "17.0")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    assert _an(b)
    schritte = [("10:01", "20.0", True), ("10:02", "20.29", True), ("10:03", "20.3", False),
                ("10:04", "19.8", False), ("10:05", "19.71", False), ("10:06", "19.7", True)]
    for uhr, innen, an in schritte:
        await _temp(b, innen)
        await _zu(b, f"2026-09-29 {uhr}:00+02:00")
        assert _an(b) is an, (uhr, innen)
        assert _c(b)["grund"] == "arbeitszeit"                # Grund bleibt der Abschnitt, auch wenn aus


async def test_modus_wechsel_im_betrieb(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Über Soll: Thermostat aus → Zeitplan an → Aus wieder aus → Thermostat bleibt aus; jedes Mal im Protokoll."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "21.0")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    assert not _an(b)
    assert (await _modus(b, "plan"))["success"] and _an(b)
    await _zu(b, "2026-09-29 10:02:00+02:00")
    assert (await _modus(b, "aus"))["success"] and not _an(b)
    assert _c(b)["text"] == "aus · nur Frostschutz"
    assert "Aus – nur Frostschutz – Heizkörper 1 aus" in _texte(b, "schalten")
    await _zu(b, "2026-09-29 10:04:00+02:00")
    assert (await _modus(b, "thermo"))["success"] and not _an(b)
    assert [t for t in _texte(b, "einstellung") if t.startswith("Modus")] == ["Modus: Thermostat", "Modus: Aus", "Modus: Zeitplan"]


@pytest.mark.parametrize("fuehler", [True, False], ids=["mit-fuehler", "ohne-fuehler"])
async def test_bedarf_aktiv_nachts(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client, fuehler) -> None:
    """Bei Bedarf heizt auch außerhalb der Arbeitszeit, solange angefordert: mit Fühler auf das Soll, ohne Fühler an."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, fuehler=fuehler)
    await _temp(b, "17.0")
    assert (await _modus(b, "bedarf"))["success"]
    await _zu(b, "nachts")
    await _automatik(b)
    assert not _an(b) and _c(b)["zustand"] == "bereit"
    assert (await b.rufe("baustelle/aktion", aktion="bedarf", bereich=C1, minuten=60))["success"]
    c = _c(b)
    assert _an(b) and (c["zustand"], c["grund"], c["text"]) == ("heizt", "bedarf", "heizt bis 03:00")
    await _temp(b, "20.5")
    await _zu(b, "2026-09-30 02:05:00+02:00")
    assert _an(b) is (not fuehler)                             # mit Fühler: Soll + Toleranz überschritten → aus
    assert _c(b)["grund"] == "bedarf"
    await _zu(b, "2026-09-30 03:01:00+02:00")
    assert not _an(b) and _c(b)["zustand"] == "bereit"
    assert "Bedarf vorbei – heizt wieder nur bei Bedarf" in _texte(b, "schalten")


async def test_hand_modus_schaltet_nicht_aber_frostschutz(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Hand: ein von Hand eingeschalteter Heizkörper bleibt auch nach der Arbeitszeit an; Frostschutz geht vor."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "17.0")
    assert (await _modus(b, "hand"))["success"]
    hass.states.async_set("switch.hk1", "on")
    hass.states.async_set("sensor.hk1_power", "2000")
    await _zu(b, "nachts")
    await _automatik(b)
    assert _an(b) and shellys.aus() == []
    c = _c(b)
    assert (c["zustand"], c["grund"], c["text"]) == ("heizt", "hand", "heizt · Hand")
    hass.states.async_set("switch.hk1", "off")
    await _temp(b, "4.0")
    await _zu(b, "2026-09-30 02:05:00+02:00")
    assert _an(b) and _c(b)["grund"] == "frost"


async def test_hand_modus_ohne_fuehler_text(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """FRAGE: Hand ohne Fühler zeigt „an · Thermostat regelt“ statt „heizt · Hand“ (heizung.py: Fühler-Zweig vor
    Hand-Zweig). Geprüft wird das tatsächliche Verhalten."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, fuehler=False)
    assert (await _modus(b, "hand"))["success"]
    hass.states.async_set("switch.hk1", "on")
    hass.states.async_set("sensor.hk1_power", "2000")
    await _zu(b, "nachts")
    await _automatik(b)
    assert _an(b)
    assert (_c(b)["grund"], _c(b)["text"]) == ("hand", "an · Thermostat regelt")


async def test_aus_ohne_fuehler_kein_frostschutz(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """FRAGE: Modus Aus ohne Fühler zeigt „aus · nur Frostschutz“, obwohl ohne Fühler kein Frostschutz möglich ist
    (regelung.frostschutz braucht eine Temperatur). Geprüft wird das tatsächliche Verhalten."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, fuehler=False)
    assert (await _modus(b, "aus"))["success"]
    hass.states.async_set("sensor.aussen", "-10.0")
    await _zu(b, "nachts")
    await _automatik(b)
    c = _c(b)
    assert not _an(b) and (c["zustand"], c["grund"], c["text"]) == ("aus", "aus", "aus · nur Frostschutz")


# ---------------------------------------------------------------------- Tür
async def test_tuer_pausiert_und_heizt_wieder(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Tür offen ab 3 min: Heizung pausiert (Hinweis, Protokoll); Tür zu: heizt wieder."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, tuer=True)
    await _temp(b, "17.0")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    assert _an(b) and _c(b)["tuer"] == {"offen": False, "seit": None}
    hass.states.async_set(TUER, "on")
    await _zu(b, "2026-09-29 10:02:00+02:00")
    assert _an(b) and _c(b)["tuer"]["offen"] is True           # erst ab 3 min
    await _zu(b, "2026-09-29 10:03:00+02:00")
    c = _c(b)
    assert not _an(b) and (c["zustand"], c["grund"], c["text"]) == ("pause", "tuer_offen", "pausiert · Tür offen")
    assert ("tuer_offen", C1, None) in _warn(b)
    assert "Tür offen – Heizung pausiert" in _texte(b, "schalten")
    hass.states.async_set(TUER, "off")
    await _zu(b, "2026-09-29 10:05:00+02:00")
    assert _an(b) and _c(b)["grund"] == "arbeitszeit"
    assert ("tuer_offen", C1, None) not in _warn(b)


@pytest.mark.parametrize("modus", ["thermo", "plan"])
async def test_tuer_offen_frostschutz_geht_vor(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client, modus) -> None:
    """Bauplan §2.2: Frostschutz vor Tür offen."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, tuer=True)
    assert (await _modus(b, modus))["success"]
    await _temp(b, "4.0")
    hass.states.async_set(TUER, "on")
    await _zu(b, "2026-09-30 02:30:00+02:00")
    await _automatik(b)
    assert _an(b) and _c(b)["grund"] == "frost"


@pytest.mark.parametrize(("modus", "zeit"), [("thermo", "nachts"), ("aus", "arbeitszeit"), ("bedarf", "arbeitszeit")])
async def test_tuer_offen_wenn_ohnehin_nicht_geheizt(
    hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client, modus, zeit,
) -> None:
    """FRAGE: Tür offen, obwohl der Container gerade gar nicht heizen würde (nachts, Modus Aus, Bedarf bereit):
    Kachel „pausiert · Tür offen“, Hinweis „Heizt wieder, sobald die Tür zu ist“ und nach 10 min Handy-Nachricht
    „Die Heizung ist pausiert …“ mit Knopf „Trotzdem heizen“. Geprüft wird das tatsächliche Verhalten."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, tuer=True)
    await _temp(b, "17.0")
    assert (await _modus(b, modus))["success"]
    start = ZEIT[zeit]
    await _zu(b, start)
    await _automatik(b)
    hass.states.async_set(TUER, "on")
    await _zu(b, start.replace(":00:00+", ":11:00+").replace(":30:00+", ":41:00+"))
    c = _c(b)
    assert not _an(b) and (c["zustand"], c["grund"], c["text"]) == ("pause", "tuer_offen", "pausiert · Tür offen")
    assert ("tuer_offen", C1, None) in _warn(b)
    assert [n.data["title"] for n in nachrichten if "Tür" in n.data["title"]] == ["🚪 Container 1: Tür seit 11 min offen"]


# ---------------------------------------------------------------------- zwei Heizkörper
@pytest.mark.parametrize(("fuehler", "modus", "innen", "an"), [
    (True, "thermo", "17.0", True), (True, "thermo", "21.0", False), (True, "plan", "21.0", True), (False, "plan", None, True),
], ids=["thermo-kalt", "thermo-warm", "plan-fuehler-warm", "plan-ohne"])
async def test_zwei_heizkoerper_schalten_gemeinsam(
    hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client, fuehler, modus, innen, an,
) -> None:
    """Zwei Heizkörper im Container (ohne „Zusatz nur bei Bedarf“): beide folgen dem Container."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, fuehler=fuehler, zwei=True)
    if innen:
        await _temp(b, innen)
    assert (await _modus(b, modus))["success"]
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    assert (_an(b, "switch.hk1"), _an(b, "switch.hk2")) == (an, an)
    assert _c(b)["zustand"] == ("heizt" if an else "aus")
    assert _c(b)["stufen"]["haupt"] == [HK1] and _c(b)["stufen"]["zusatz"] == [HK2]
    if an:
        assert "Arbeitszeit – Heizkörper 1, Heizkörper 2 ein" in _texte(b, "schalten")
    await _zu(b, "nach_arbeitsende")
    assert not _an(b, "switch.hk1") and not _an(b, "switch.hk2")


async def test_zwei_heizkoerper_mit_staffelung_nacheinander(
    hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client,
) -> None:
    """Mit Staffelung gehen beide nacheinander an (Anlauf 20 s), der zweite wartet so lange auf „anlauf“."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, zwei=True, staffel=True)
    await _temp(b, "17.0")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    assert [_an(b, "switch.hk1"), _an(b, "switch.hk2")].count(True) == 1
    wartet = HK2 if _an(b, "switch.hk1") else HK1
    assert struktur(hass, b.entry)["laufzeit"]["geraete"][wartet]["warte"] == {"grund": "anlauf", "dran_in_min": 0}
    freezer.tick(21)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert _an(b, "switch.hk1") and _an(b, "switch.hk2")


# ---------------------------------------------------------------------- Ausfälle: Fühler
@pytest.mark.parametrize("ausfall", ["unavailable", "unknown"])
async def test_fuehler_faellt_aus_waehrend_thermo(
    hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client, ausfall,
) -> None:
    """FRAGE: Fühler fällt im Modus Thermostat aus, während der Raum über Soll ist (Heizkörper aus): der Container
    verhält sich wie ohne Fühler – Heizkörper an, „an · Thermostat regelt“ –, dazu die Warnung `fuehler_fehlt`.
    Regelt der Fühler wieder, schaltet der Thermostat ab. Geprüft wird das tatsächliche Verhalten."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "21.0")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    assert not _an(b)
    await _temp(b, ausfall)
    await _zu(b, "2026-09-29 10:01:00+02:00")
    c = _c(b)
    assert _an(b) and (c["zustand"], c["grund"], c["text"], c["modus"], c["temperatur"]) == (
        "heizt", "arbeitszeit", "an · Thermostat regelt", "thermo", None)
    assert ("fuehler_fehlt", C1, None) in _warn(b)
    assert struktur(hass, b.entry)["laufzeit"]["container"][C1]["lernen"]["anteil"] is None
    await _temp(b, "21.0")
    await _zu(b, "2026-09-29 10:02:00+02:00")
    assert not _an(b) and ("fuehler_fehlt", C1, None) not in _warn(b)


async def test_fuehler_faellt_aus_beim_heizen(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Fühler fällt beim Heizen aus: Heizkörper bleibt an (kein Ausschalten ohne Messwert), Warnung `fuehler_fehlt`."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "17.0")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    assert _an(b)
    await _temp(b, "unavailable")
    await _zu(b, "2026-09-29 10:01:00+02:00")
    assert _an(b) and shellys.aus() == []
    assert ("fuehler_fehlt", C1, None) in _warn(b)


async def test_fuehler_faellt_aus_nachts_kein_frostschutz(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Nachts ohne Messwert: kein Frostschutz möglich, Heizkörper bleibt aus, Warnung `fuehler_fehlt` (Störung)."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "4.0")
    await _zu(b, "nachts")
    await _automatik(b)
    assert _an(b) and _c(b)["grund"] == "frost"
    await _temp(b, "unavailable")
    await _zu(b, "2026-09-30 02:20:00+02:00")                 # nach dem Mindestlauf
    assert not _an(b) and _c(b)["grund"] == "ausserhalb"
    w = next(x for x in struktur(hass, b.entry)["laufzeit"]["warnungen"] if x["art"] == "fuehler_fehlt")
    assert w["bereich"] == C1


# ---------------------------------------------------------------------- Ausfälle: Shelly
async def test_shelly_offline_ein_heizkoerper(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Einziger Heizkörper offline: Kachel „nicht erreichbar“, nach 5 min Warnung `offline` mit Handy-Nachricht;
    kommt er (aus) zurück, schaltet die Automatik ihn wieder ein – ohne Handbetrieb."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "17.0")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    assert _an(b)
    hass.states.async_set("switch.hk1", "unavailable")
    await _zu(b, "2026-09-29 10:01:00+02:00")
    c = _c(b)
    assert (c["zustand"], c["text"], c["grund"]) == ("offline", "nicht erreichbar", "arbeitszeit")
    assert struktur(hass, b.entry)["laufzeit"]["geraete"][HK1]["erreichbar"] is False
    assert ("offline", C1, HK1) not in _warn(b)                # erst nach 5 min
    await _zu(b, "2026-09-29 10:07:00+02:00")
    assert ("offline", C1, HK1) in _warn(b)
    assert any("nicht erreichbar" in n.data["title"] for n in nachrichten)
    hass.states.async_set("switch.hk1", "off")
    await _zu(b, "2026-09-29 10:08:00+02:00")
    assert _an(b) and HK1 not in b.st.lz["hand"]
    assert _c(b)["zustand"] == "heizt" and ("offline", C1, HK1) not in _warn(b)
    assert "wieder erreichbar" in _texte(b)                  # einziges Gerät im Container: ohne Gerätename


async def test_shelly_kommt_nachts_eingeschaltet_zurueck(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Shelly startet nach einem Ausfall eingeschaltet: die Automatik schaltet ihn nachts aus (kein Handbetrieb)."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "17.0")
    await _zu(b, "nachts")
    await _automatik(b)
    hass.states.async_set("switch.hk1", "unavailable")
    await _zu(b, "2026-09-30 02:01:00+02:00")
    hass.states.async_set("switch.hk1", "on")
    hass.states.async_set("sensor.hk1_power", "2000")
    await _zu(b, "2026-09-30 02:02:00+02:00")
    assert not _an(b) and HK1 not in b.st.lz["hand"]


async def test_shelly_offline_zwei_heizkoerper(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Einer von zwei Heizkörpern offline: der andere heizt weiter, Kachel „heizt“, Warnung nennt das Gerät."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, zwei=True)
    await _temp(b, "17.0")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    hass.states.async_set("switch.hk2", "unavailable")
    await _zu(b, "2026-09-29 10:07:00+02:00")
    assert _an(b, "switch.hk1")
    assert _c(b)["zustand"] == "heizt"
    w = next(x for x in struktur(hass, b.entry)["laufzeit"]["warnungen"] if x["art"] == "offline")
    assert (w["bereich"], w["geraet"]) == (C1, HK2) and "Heizkörper 2" in w["titel"]


async def test_shelly_offline_fuehler_ueber_soll(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Offline geht in der Anzeige vor: auch wenn der Thermostat gerade nicht heizen will, steht „nicht erreichbar“."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "21.0")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    hass.states.async_set("switch.hk1", "unavailable")
    await _zu(b, "2026-09-29 10:01:00+02:00")
    assert _c(b)["zustand"] == "offline" and [a for a in shellys.aufrufe if a[0] == "switch.hk1"] == []


# ---------------------------------------------------------------------- Vorrang im Modus Hand, Leistung 0 W
@pytest.mark.xfail(strict=True, reason=(
    "BEFUND: Frostschutz im Modus Hand schaltet ein, aber nach dem Frost nie wieder aus – regelung.soll_container "
    "liefert nach dem Frost Soll(None, 'hand') (logik/regelung.py:194), ohne den Fall frost_vorher wie bei "
    "Automatik aus (regelung.py:187); der Heizkörper bleibt an und die Kachel zeigt „heizt · Hand“."))
async def test_frost_im_modus_hand_endet(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """Modus Hand: Frostschutz geht vor (ein unter 5 °C) und gibt nach dem Frost (über 7 °C) einmal wieder aus –
    wie „Frostschutz auch bei Automatik aus“ (regelung.py Docstring: „nach dem Frost einmal aus“)."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    assert (await _modus(b, "hand"))["success"]
    await _temp(b, "4.0")
    await _zu(b, "nachts")
    await _automatik(b)
    assert _an(b) and _c(b)["grund"] == "frost"
    await _temp(b, "8.0")
    await _zu(b, "2026-09-30 02:30:00+02:00")
    assert not _an(b)


async def test_tuer_im_modus_hand(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """FRAGE: Modus Hand, Heizkörper von Hand an: Tür offen schaltet ihn aus (Vorrang Tür, Bauplan §2.2) – nach dem
    Schließen bleibt er aus (Soll None), obwohl der Hinweis „Heizt wieder, sobald die Tür zu ist“ sagt.
    Geprüft wird das tatsächliche Verhalten."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, tuer=True)
    await _temp(b, "17.0")
    assert (await _modus(b, "hand"))["success"]
    hass.states.async_set("switch.hk1", "on")
    hass.states.async_set("sensor.hk1_power", "2000")
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    hass.states.async_set(TUER, "on")
    await _zu(b, "2026-09-29 10:04:00+02:00")
    assert not _an(b) and _c(b)["grund"] == "tuer_offen"
    hass.states.async_set(TUER, "off")
    await _zu(b, "2026-09-29 10:06:00+02:00")
    assert not _an(b) and (_c(b)["grund"], _c(b)["text"]) == ("hand", "aus")


async def test_geraete_hand_im_modus_hand(hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client) -> None:
    """FRAGE: Im Modus Hand wird ein in HA geschalteter Heizkörper zusätzlich Gerät-Hand; nach 8 h kommt
    „✋ … seit 8 h auf Hand“ aufs Handy, die Automatik übernimmt aber nie (Soll None, heizung.py:587).
    Geprüft wird das tatsächliche Verhalten."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client)
    await _temp(b, "17.0")
    assert (await _modus(b, "hand"))["success"]
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    hass.states.async_set("switch.hk1", "on", context=Context(user_id="nutzer"))
    hass.states.async_set("sensor.hk1_power", "2000")
    await hass.async_block_till_done()
    assert HK1 in b.st.lz["hand"]
    await _zu(b, "2026-09-29 18:30:00+02:00")
    await _zu(b, "2026-09-29 19:10:00+02:00")                  # Höchstdauer + Nachfrist vorbei
    assert _an(b) and HK1 in b.st.lz["hand"]
    assert ("hand_zu_lange", C1, HK1) in _warn(b)
    assert "✋ Heizkörper 1 Container 1 seit 8 h auf Hand" in [n.data["title"] for n in nachrichten]


@pytest.mark.parametrize(("fuehler", "modus", "warnung"), [
    (False, "plan", False), (True, "plan", True), (True, "thermo", True),
], ids=["plan-ohne", "plan-fuehler", "thermo-fuehler"])
async def test_heizkoerper_an_zieht_keinen_strom(
    hass: HomeAssistant, freezer, shellys, nachrichten, hass_ws_client, fuehler, modus, warnung,
) -> None:
    """FRAGE: Heizkörper eingeschaltet, 0 W (sein eigener Thermostat hat abgeschaltet), innen 19 °C < Soll.
    Kachel immer „aus“/„an · zieht keinen Strom“ (heizung.py:698, 0.7.3) – auch ohne Fühler, wo laut
    warnungen.py 0 W normal ist und das Mockup „an · Thermostat regelt“ zeigt. Warnung `keine_leistung` kommt mit
    Fühler auch im Modus Zeitplan (warnungen.py:299 prüft nur den Fühler, nicht den Modus), obwohl dort der
    Heizkörperthermostat regelt. Geprüft wird das tatsächliche Verhalten."""
    b = await _aufbau(hass, freezer, shellys, hass_ws_client, fuehler=fuehler)
    await _temp(b, "19.0")
    assert (await _modus(b, modus))["success"]
    await _zu(b, "arbeitszeit")
    await _automatik(b)
    hass.states.async_set("sensor.hk1_power", "0")
    await _zu(b, "2026-09-29 10:05:00+02:00")
    assert _an(b) and (_c(b)["zustand"], _c(b)["text"]) == ("aus", "an · zieht keinen Strom")
    assert (("keine_leistung", C1, HK1) in _warn(b)) is warnung
