"""Eigene Seite „Baustelle“ in der Seitenleiste (wie Alarmo/HACS) und die WebSocket-Befehle dafür (api-0.7 §1–§2)."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
import uuid

import voluptuous as vol

from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .daten import struktur
from .einstellungen import EIGEN, Meldungen
from .logik.warnungen import Art

URL_PANEL = "baustelle"
URL_STATISCH = "/baustelle_static"
WEBCOMPONENT = "baustelle-panel"
DATA_MELDUNGEN = f"{DOMAIN}_meldungen"
DATA_VERSION = f"{DOMAIN}_version"

UHRZEIT = vol.All(cv.string, vol.Match(r"^([01]\d|2[0-3]):[0-5]\d$"))
DATUM = vol.All(cv.string, cv.date, lambda d: d.isoformat())
ZEIT_ISO = vol.All(cv.string, cv.datetime, lambda z: dt_util.as_local(z).isoformat(timespec="seconds"))
ZAHL = vol.Coerce(float)
GANZ = vol.Coerce(int)


# Erlaubte Pfade für `baustelle/setzen` mit Prüfschema (api-0.7 §2)
SETZEN: dict[tuple[str, ...], Any] = {
    ("automatik",): cv.boolean,
    ("preis",): vol.All(ZAHL, vol.Range(min=0, max=10)),
    ("melden_knopf",): cv.boolean,
    ("termine_kalender",): vol.Any(None, cv.entity_domain("calendar")),
    ("heizung", "vorheizen_min"): vol.All(GANZ, vol.Range(0, 240)),
    ("heizung", "nachheizen_min"): vol.All(GANZ, vol.Range(0, 240)),
    ("heizung", "soll"): vol.All(ZAHL, vol.Range(5, 30)),
    ("heizung", "toleranz"): vol.All(ZAHL, vol.Range(0.1, 3)),
    ("heizung", "heizgrenze"): vol.All(ZAHL, vol.Range(0, 30)),
    ("heizung", "heizgrenze_basis"): vol.In(["jetzt", "tageshoechst"]),
    ("heizung", "fruehstart"): cv.boolean,
    ("heizung", "fruehstart_unter"): vol.All(ZAHL, vol.Range(-30, 20)),
    ("heizung", "fruehstart_min"): vol.All(GANZ, vol.Range(0, 240)),
    ("heizung", "frost"): cv.boolean,
    ("heizung", "frost_grenze"): vol.All(ZAHL, vol.Range(-5, 15)),
    ("heizung", "trocknen_ab_mm"): vol.All(ZAHL, vol.Range(0, 100)),
    ("heizung", "trocknen_laenger_min"): vol.All(GANZ, vol.Range(0, 480)),
    ("heizung", "trocknen_frueher_min"): vol.All(GANZ, vol.Range(0, 240)),
    ("heizung", "tuer_pause_min"): vol.All(GANZ, vol.Range(0, 120)),
    ("heizung", "tuer_melden_min"): vol.All(GANZ, vol.Range(0, 240)),
    ("heizung", "boost_min"): vol.All(GANZ, vol.Range(5, 480)),
    ("heizung", "feiertag_frei"): cv.boolean,
    ("staffel", "an"): cv.boolean,
    ("staffel", "nutzbar_prozent"): vol.All(GANZ, vol.Range(10, 100)),
    ("staffel", "max_gleichzeitig"): vol.All(GANZ, vol.Range(1, 50)),
    ("staffel", "min_lauf_min"): vol.All(GANZ, vol.Range(0, 120)),
    ("staffel", "min_pause_min"): vol.All(GANZ, vol.Range(0, 120)),
    ("staffel", "takt_min"): vol.All(GANZ, vol.Range(1, 240)),
    ("bericht", "haeufigkeit"): vol.In(["aus", "woche", "monat", "beides"]),
    ("bericht", "handy"): cv.boolean,
    ("bericht", "mail"): cv.boolean,
    ("bericht", "mail_an"): vol.All(cv.string, vol.Length(max=500)),
    ("bericht", "mail_dienst"): vol.All(cv.string, vol.Length(max=200)),
    ("bericht", "csv"): cv.boolean,
    ("meldungen_einst", "empfaenger"): vol.All(cv.ensure_list, [cv.slug]),  # Namen von notify-Diensten
    ("meldungen_einst", "knoepfe"): cv.boolean,
    ("meldungen_einst", "arten"): vol.Schema({vol.In([str(a) for a in Art] + ["fruehstart"]): cv.boolean}),
    **{("meldungen_einst", "arten", str(a)): cv.boolean for a in [*Art, "fruehstart"]},
    ("meldungen_einst", "kalt_min"): vol.All(GANZ, vol.Range(1, 1440)),
    ("meldungen_einst", "hand_h"): vol.All(ZAHL, vol.Range(0.5, 240)),
    ("meldungen_einst", "zyklen_h"): vol.All(GANZ, vol.Range(1, 200)),
    ("meldungen_einst", "dauerlauf_min"): vol.All(GANZ, vol.Range(1, 1440)),
    ("meldungen_einst", "trocken_unter_w"): vol.All(ZAHL, vol.Range(0, 5000)),
    ("meldungen_einst", "offline_min"): vol.All(ZAHL, vol.Range(0, 1440)),
}
SETZEN_BEREICH: dict[str, Any] = {
    "auto": cv.boolean,
    "trocknen": cv.boolean,
    "soll": vol.Any(None, vol.All(ZAHL, vol.Range(5, 30))),
    "bedarf": cv.boolean,
    "prio": vol.In(["niedrig", "normal", "hoch"]),
    "anschluss": cv.string,
    "tuer": vol.Any(None, cv.entity_domain("binary_sensor")),
}

ARBEITSZEIT = vol.Schema({
    vol.Required("ab"): DATUM,
    vol.Optional("name", default=""): vol.All(cv.string, vol.Length(max=100)),
    vol.Required("tage"): {vol.In([str(i) for i in range(7)]): vol.Any(None, vol.All([UHRZEIT], vol.Length(2, 2)))},
    vol.Optional("alt_ab"): DATUM,
})
AUSNAHME = vol.Schema({
    vol.Required("datum"): DATUM,
    vol.Required("art"): vol.In(["arbeit", "zeiten", "frei"]),
    vol.Optional("von"): vol.Any(None, vol.All("", lambda _: None), UHRZEIT),
    vol.Optional("bis"): vol.Any(None, vol.All("", lambda _: None), UHRZEIT),
    vol.Optional("notiz", default=""): vol.All(cv.string, vol.Length(max=200)),
})
ANSCHLUSS = vol.Schema({
    vol.Optional("id"): cv.string,
    vol.Required("name"): vol.All(cv.string, vol.Length(min=1, max=100)),
    vol.Required("ampere"): vol.All(ZAHL, vol.Range(1, 1000)),
    vol.Required("phasen"): vol.All(GANZ, vol.In([1, 3])),
    vol.Optional("reserve_kw", default=0.0): vol.All(ZAHL, vol.Range(0, 500)),
    vol.Optional("container"): [cv.string],
})
FIRMA = vol.Schema({
    vol.Optional("id"): cv.string,
    vol.Required("name"): vol.All(cv.string, vol.Length(min=1, max=100)),
    vol.Optional("eigen"): cv.boolean,
    vol.Optional("container"): [cv.string],
})
MELDUNG = vol.Schema({
    vol.Required("art"): vol.In(["fehler", "wunsch", "anregung"]),
    vol.Required("text"): vol.All(cv.string, vol.Length(min=1, max=5000)),
    vol.Optional("kontext", default=""): vol.All(cv.string, vol.Length(max=5000)),
    vol.Optional("geraet", default=""): vol.All(cv.string, vol.Length(max=100)),
    vol.Optional("version"): vol.All(cv.string, vol.Length(max=50)),
    # „Stand der Seite mitschicken“ (Mockup): Ansicht, Container, Dialog – ohne Zugangsdaten
    vol.Optional("seite"): vol.Any(None, vol.All(
        vol.Schema({vol.All(cv.string, vol.Length(max=50)): vol.Any(None, bool, int, float, vol.All(cv.string, vol.Length(max=200)))}),
        vol.Length(max=20))),
}, extra=vol.REMOVE_EXTRA)


async def async_panel_anmelden(hass: HomeAssistant, version: str) -> None:
    """JavaScript ausliefern, Seite in der Seitenleiste und WebSocket-Befehle anmelden (einmal je HA-Start)."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(URL_STATISCH, str(Path(__file__).parent / "frontend"), cache_headers=False)]
    )
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=URL_PANEL,
        webcomponent_name=WEBCOMPONENT,
        sidebar_title="Baustelle",
        sidebar_icon="mdi:crane",
        module_url=f"{URL_STATISCH}/baustelle-panel.js?v={version}",
        require_admin=False,
        config={"version": version},
    )
    hass.data[DATA_VERSION] = version
    hass.data[DATA_MELDUNGEN] = Meldungen(hass)
    for befehl in (ws_struktur, ws_setzen, ws_liste, ws_aktion, ws_bericht, ws_protokoll, ws_meldungen, ws_meldung):
        websocket_api.async_register_command(hass, befehl)


def _steuerung(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]):
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    st = getattr(entry, "runtime_data", None) if entry is not None and entry.domain == DOMAIN else None
    if st is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Baustelle nicht gefunden oder nicht geladen")
    return st


def _fehler(connection: websocket_api.ActiveConnection, msg: dict[str, Any], text: str) -> None:
    connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, text)


# ---------------------------------------------------------------------- struktur
@websocket_api.websocket_command({vol.Required("type"): "baustelle/struktur"})
@callback
def ws_struktur(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Alle Baustellen (auch abgeschlossene) mit Einrichtung, Einstellungen, Zählern und Laufzeit."""
    version = hass.data.get(DATA_VERSION, "")
    connection.send_result(
        msg["id"], [struktur(hass, entry, version) for entry in hass.config_entries.async_entries(DOMAIN)]
    )


# ---------------------------------------------------------------------- setzen
def pruefe_setzen(st: Any, pfad: list[str], wert: Any) -> Any:
    """Pfad und Wert prüfen; liefert den bereinigten Wert oder wirft vol.Invalid."""
    schluessel = tuple(pfad)
    if len(pfad) == 3 and pfad[0] == "bereiche":
        if pfad[1] not in st.bereiche:
            raise vol.Invalid(f"Unbekannter Container {pfad[1]}")
        if pfad[2] not in SETZEN_BEREICH:
            raise vol.Invalid(f"Pfad {'.'.join(pfad)} ist nicht erlaubt")
        wert = SETZEN_BEREICH[pfad[2]](wert)
        if pfad[2] == "anschluss" and wert not in {a["id"] for a in st.e["anschluesse"]}:
            raise vol.Invalid(f"Unbekannter Anschluss {wert}")
        return wert
    if schluessel not in SETZEN:
        raise vol.Invalid(f"Pfad {'.'.join(pfad)} ist nicht erlaubt")
    return SETZEN[schluessel](wert)


@websocket_api.websocket_command({
    vol.Required("type"): "baustelle/setzen",
    vol.Required("entry_id"): str,
    vol.Required("pfad"): vol.All([str], vol.Length(min=1, max=4)),
    vol.Required("wert"): object,
})
@callback
def ws_setzen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Eine Einstellung setzen (Pfad + Wert, geprüft)."""
    if (st := _steuerung(hass, connection, msg)) is None:
        return
    try:
        wert = pruefe_setzen(st, msg["pfad"], msg["wert"])
    except vol.Invalid as err:
        _fehler(connection, msg, str(err))
        return
    pfad = list(msg["pfad"])
    if pfad[:2] == ["meldungen_einst", "arten"] and len(pfad) == 3:
        st.e["meldungen_einst"]["arten"][pfad[2]] = wert
        st.einstellungen.speichern()
        st.auswerten()
    else:
        st.einstellung_setzen(pfad, wert)
    connection.send_result(msg["id"], {"ok": True})


# ---------------------------------------------------------------------- liste
def _neue_id(praefix: str) -> str:
    return f"{praefix}_{uuid.uuid4().hex[:8]}"


def _liste_aendern(st: Any, liste: str, aktion: str, eintrag: dict[str, Any]) -> dict[str, Any]:
    e = st.e
    jetzt = dt_util.now()
    if liste == "arbeitszeiten":
        if aktion == "loeschen":
            ab = DATUM(eintrag.get("ab"))
            vorher = len(e["arbeitszeiten"])
            e["arbeitszeiten"] = [a for a in e["arbeitszeiten"] if a["ab"] != ab]
            if len(e["arbeitszeiten"]) == vorher:
                raise KeyError(ab)
            st.protokoll("einstellung", None, f"Arbeitszeit ab {_datum(ab)} gelöscht")
            return {"ok": True}
        x = ARBEITSZEIT(eintrag)
        alt = x.pop("alt_ab", None)
        for tag, zeit in x["tage"].items():
            if zeit is not None and zeit[1] <= zeit[0]:
                raise vol.Invalid(f"Arbeitszeit am Tag {tag}: Ende vor Beginn")
        x["tage"] = {str(i): x["tage"].get(str(i)) for i in range(7)}
        andere = [a for a in e["arbeitszeiten"] if a["ab"] != alt]
        if any(a["ab"] == x["ab"] for a in andere):
            raise vol.Invalid(f"Es gibt schon eine Arbeitszeit ab {_datum(x['ab'])}")
        e["arbeitszeiten"] = sorted([*andere, x], key=lambda a: a["ab"])
        text = "geändert" if alt else "gilt ab"
        st.protokoll("einstellung", None, f"{'Arbeitszeit' if alt else 'Neue Arbeitszeit'} „{x['name']}“ {text} {_datum(x['ab'])}")
        return {"ok": True}
    if liste == "ausnahmen":
        datum = DATUM(eintrag.get("datum"))
        if aktion == "loeschen":
            e["ausnahmen"] = [a for a in e["ausnahmen"] if a["datum"] != datum]
            st.protokoll("einstellung", None, f"Ausnahme am {_datum(datum)} gelöscht")
            return {"ok": True}
        # erst prüfen, dann ersetzen: ein abgelehnter Eintrag löscht die bisherige Ausnahme des Tages nicht
        x = AUSNAHME(eintrag)
        if x["art"] != "frei":
            if not x.get("von") or not x.get("bis") or x["bis"] <= x["von"]:
                raise vol.Invalid("Ausnahme braucht von und bis (bis nach von)")
        else:
            x["von"] = x["bis"] = None
        andere = [a for a in e["ausnahmen"] if a["datum"] != datum]
        e["ausnahmen"] = sorted([*andere, x], key=lambda a: a["datum"])
        was = {"arbeit": "zusätzlich arbeiten", "zeiten": "andere Zeiten", "frei": "frei"}[x["art"]]
        zeiten = f" {x['von']}–{x['bis']}" if x["art"] != "frei" else ""
        st.protokoll("einstellung", None, f"Ausnahme {_datum(datum)}: {was}{zeiten}" + (f" ({x['notiz']})" if x["notiz"] else ""))
        return {"ok": True}
    if liste == "anschluesse":
        if aktion == "loeschen":
            aid = str(eintrag.get("id"))
            if aid not in {a["id"] for a in e["anschluesse"]}:
                raise KeyError(aid)
            if len(e["anschluesse"]) <= 1:
                raise vol.Invalid("Der letzte Anschluss kann nicht gelöscht werden")
            e["anschluesse"] = [a for a in e["anschluesse"] if a["id"] != aid]
            erster = e["anschluesse"][0]["id"]
            for b in e["bereiche"].values():
                if b.get("anschluss") == aid:
                    b["anschluss"] = erster
            st.protokoll("einstellung", None, "Anschluss gelöscht")
            return {"ok": True}
        x = ANSCHLUSS(eintrag)
        container = x.pop("container", None)
        _container_pruefen(st, container)
        aid = x.get("id") or _neue_id("a")
        x["id"] = aid
        e["anschluesse"] = [x if a["id"] == aid else a for a in e["anschluesse"]]
        if aid not in {a["id"] for a in e["anschluesse"]}:
            e["anschluesse"].append(x)
        for bid in container or []:
            st.einstellungen.bereich(bid)["anschluss"] = aid
        if container is not None:
            # wie Mockup: nimmt man einen Container aus der Liste, hängt er am ersten anderen Anschluss
            erster = e["anschluesse"][0]["id"]
            rest = next((a["id"] for a in e["anschluesse"] if a["id"] != aid), None)
            for bid in st.bereiche:
                eb = st.einstellungen.bereich(bid)
                if bid not in container and rest and (eb.get("anschluss") or erster) == aid:
                    eb["anschluss"] = rest
        st.protokoll("einstellung", None, f"Anschluss „{x['name']}“ gespeichert")
        return {"ok": True, "id": aid}
    if liste == "firmen":
        if aktion == "loeschen":
            fid = str(eintrag.get("id"))
            firma = next((f for f in e["firmen"] if f["id"] == fid), None)
            if firma is None:
                raise KeyError(fid)
            if firma.get("eigen") or fid == EIGEN:
                raise vol.Invalid("Die eigene Firma kann nicht gelöscht werden")
            e["firmen"] = [f for f in e["firmen"] if f["id"] != fid]
            for bid in st.bereiche:
                if _firma_jetzt(e, bid, jetzt) == fid:
                    e["zuordnung"].append({"bereich": bid, "firma": EIGEN, "ab": jetzt.isoformat(timespec="seconds")})
            st.protokoll("einstellung", None, f"Firma „{firma['name']}“ gelöscht")
            return {"ok": True}
        x = FIRMA(eintrag)
        container = x.pop("container", None)
        _container_pruefen(st, container)
        fid = x.get("id") or _neue_id("f")
        x["id"] = fid
        vorhanden = next((f for f in e["firmen"] if f["id"] == fid), None)
        if vorhanden is not None:
            vorhanden["name"] = x["name"]
        else:
            x["eigen"] = False
            e["firmen"].append(x)
        if container is not None:
            # „Der Verbrauch wird ab jetzt zugeordnet“ – frühere Werte bleiben bei der bisherigen Firma
            for bid in st.bereiche:
                bisher = _firma_jetzt(e, bid, jetzt)
                if bid in container and bisher != fid:
                    e["zuordnung"].append({"bereich": bid, "firma": fid, "ab": jetzt.isoformat(timespec="seconds")})
                elif bid not in container and bisher == fid and fid != EIGEN:
                    e["zuordnung"].append({"bereich": bid, "firma": EIGEN, "ab": jetzt.isoformat(timespec="seconds")})
        st.protokoll("einstellung", None, f"Firma „{x['name']}“ gespeichert")
        return {"ok": True, "id": fid}
    raise vol.Invalid(f"Unbekannte Liste {liste}")


def _container_pruefen(st: Any, container: list[str] | None) -> None:
    """Alle Container einer Zuordnung müssen existieren – geprüft, bevor etwas geändert wird."""
    for bid in container or []:
        if bid not in st.bereiche:
            raise vol.Invalid(f"Unbekannter Container {bid}")


def _firma_jetzt(e: dict[str, Any], bid: str, jetzt: datetime) -> str:
    from .logik.abrechnung import firma_am  # noqa: PLC0415

    return firma_am(e["zuordnung"], bid, jetzt)


def _datum(iso: str) -> str:
    return "{2}.{1}.{0}".format(*iso.split("-"))


@websocket_api.websocket_command({
    vol.Required("type"): "baustelle/liste",
    vol.Required("entry_id"): str,
    vol.Required("liste"): vol.In(["arbeitszeiten", "ausnahmen", "anschluesse", "firmen"]),
    vol.Required("aktion"): vol.In(["speichern", "loeschen"]),
    vol.Required("eintrag"): dict,
})
@callback
def ws_liste(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Eintrag einer Liste anlegen, ändern oder löschen."""
    if (st := _steuerung(hass, connection, msg)) is None:
        return
    st.plan_neu()
    try:
        ergebnis = _liste_aendern(st, msg["liste"], msg["aktion"], msg["eintrag"])
    except vol.Invalid as err:
        _fehler(connection, msg, str(err))
        return
    except KeyError as err:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, f"Nicht gefunden: {err}")
        return
    st.einstellungen.speichern()
    st.auswerten()
    connection.send_result(msg["id"], ergebnis)


# ---------------------------------------------------------------------- aktion
@websocket_api.websocket_command({
    vol.Required("type"): "baustelle/aktion",
    vol.Required("entry_id"): str,
    vol.Required("aktion"): vol.In(
        ["bedarf", "bedarf_aus", "boost", "jetzt_heizen", "schalten", "automatik", "warnung_stumm", "bericht_senden"]
    ),
    vol.Optional("bereich"): str,
    vol.Optional("geraet"): str,
    vol.Optional("minuten"): vol.Any(None, vol.All(vol.Coerce(int), vol.Range(1, 24 * 60))),
    vol.Optional("bis"): vol.Any(None, str),
    vol.Optional("boost"): bool,
    vol.Optional("an"): bool,
    vol.Optional("key"): str,
    vol.Optional("art"): vol.In(["woche", "monat"]),
})
@websocket_api.async_response
async def ws_aktion(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Bedarf, Boost, alle jetzt heizen, Gerät schalten, Warnung stumm, Bericht jetzt senden."""
    if (st := _steuerung(hass, connection, msg)) is None:
        return
    aktion = msg["aktion"]
    jetzt = dt_util.now()
    lz = st.lz
    try:
        bis = ZEIT_ISO(msg["bis"]) if msg.get("bis") else None
    except vol.Invalid as err:
        _fehler(connection, msg, f"bis: {err}")
        return
    if aktion in ("bedarf", "bedarf_aus", "boost"):
        bid = msg.get("bereich")
        if bid not in st.bereiche:
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Container nicht gefunden")
            return
        name = st.bereiche[bid].name
        boost_bis = (jetzt + timedelta(minutes=int(st.e["heizung"]["boost_min"]))).isoformat(timespec="seconds")
        if aktion == "bedarf":
            if bis is None and not msg.get("minuten"):
                _fehler(connection, msg, "bedarf braucht minuten oder bis")
                return
            ende = bis or (jetzt + timedelta(minutes=msg["minuten"])).isoformat(timespec="seconds")
            lz["bedarf_bis"][bid] = ende
            if msg.get("boost"):
                lz["boost_bis"][bid] = min(boost_bis, ende)
            st.protokoll("schalten", bid, f"{name} heizt bis {dt_util.parse_datetime(ende).strftime('%H:%M')}"
                         + (" · ⚡ schnell" if msg.get("boost") else ""))
        elif aktion == "bedarf_aus":
            lz["bedarf_bis"].pop(bid, None)
            lz["boost_bis"].pop(bid, None)
            st.protokoll("schalten", bid, f"{name}: Bedarf beendet")
        elif msg.get("an", True):
            lz["boost_bis"][bid] = boost_bis
            st.protokoll("schalten", bid, f"{name}: schnell aufheizen ({st.e['heizung']['boost_min']} min)")
        else:
            lz["boost_bis"].pop(bid, None)
            st.protokoll("schalten", bid, f"{name}: schnell aufheizen beendet")
    elif aktion == "jetzt_heizen":
        if msg.get("minuten"):
            lz["jetzt_bis"] = (jetzt + timedelta(minutes=msg["minuten"])).isoformat(timespec="seconds")
            st.protokoll("schalten", None, f"Alle jetzt heizen bis {(jetzt + timedelta(minutes=msg['minuten'])).strftime('%H:%M')}")
        elif bis:
            lz["jetzt_bis"] = bis
            st.protokoll("schalten", None, f"Alle jetzt heizen bis {dt_util.parse_datetime(bis).strftime('%H:%M')}")
        else:
            lz["jetzt_bis"] = None
            st.protokoll("schalten", None, "„Alle jetzt heizen“ beendet")
    elif aktion in ("schalten", "automatik"):
        g = st.geraete.get(msg.get("geraet") or "")
        if g is None:
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Gerät nicht gefunden")
            return
        if aktion == "automatik":
            st.hand_beenden(g.id, "wieder auf Automatik")
        elif "an" not in msg:
            _fehler(connection, msg, "schalten braucht an")
            return
        else:
            st.geraet_schalten(g, msg["an"])
    elif aktion == "warnung_stumm":
        key = msg.get("key")
        if not key:
            _fehler(connection, msg, "warnung_stumm braucht key")
            return
        w = next((x for x in st.daten.warnungen if x.key == key), None)
        from .logik.warnungen import titel  # noqa: PLC0415
        from .steuerung import morgen_frueh  # noqa: PLC0415

        if msg.get("bis", "morgen") is None:
            st.e["stumm"].pop(key, None)
            st.protokoll("einstellung", w.bereich if w else None, f"Wird wieder gemeldet: {titel(w) if w else key}")
        else:
            st.e["stumm"][key] = bis or morgen_frueh(jetzt).isoformat(timespec="seconds")
            st.protokoll("einstellung", w.bereich if w else None, f"Stumm bis {_datum(st.e['stumm'][key][:10])}: {titel(w) if w else key}")
    elif aktion == "bericht_senden":
        await st.nachrichten.async_bericht_senden(msg.get("art") or "woche")
        connection.send_result(msg["id"], {"ok": True})
        return
    st.einstellungen.speichern()
    st.auswerten()
    connection.send_result(msg["id"], {"ok": True})


# ---------------------------------------------------------------------- bericht (Vorschau)
@websocket_api.websocket_command({
    vol.Required("type"): "baustelle/bericht",
    vol.Required("entry_id"): str,
    vol.Optional("art", default="woche"): vol.In(["woche", "monat"]),
})
@websocket_api.async_response
async def ws_bericht(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Bericht, wie er jetzt ginge – dieselben Zahlen und Texte wie beim Senden (Seite „Bericht · Beispiel“)."""
    if (st := _steuerung(hass, connection, msg)) is None:
        return
    connection.send_result(msg["id"], await st.nachrichten.async_bericht_vorschau(msg["art"]))


# ---------------------------------------------------------------------- protokoll
FILTER = {
    "alle": None,
    "warnung": {"warnung", "ok"},
    "schalten": {"schalten"},
    "wetter": {"wetter"},
    "nachricht": {"nachricht"},
    "einstellung": {"einstellung"},
}


@websocket_api.websocket_command({
    vol.Required("type"): "baustelle/protokoll",
    vol.Required("entry_id"): str,
    vol.Optional("filter", default="alle"): vol.In(list(FILTER)),
    vol.Optional("vor"): vol.Any(None, str),
    vol.Optional("limit", default=50): vol.All(vol.Coerce(int), vol.Range(1, 1000)),
})
@callback
def ws_protokoll(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Protokolleinträge, neueste zuerst; `vor` = nur ältere als dieser Zeitpunkt (zum Nachladen)."""
    if (st := _steuerung(hass, connection, msg)) is None:
        return
    arten = FILTER[msg["filter"]]
    vor = dt_util.parse_datetime(msg["vor"]) if msg.get("vor") else None
    ergebnis = []
    for eintrag in st.e["protokoll"]:
        if arten is not None and eintrag[1] not in arten:
            continue
        if vor is not None and (z := dt_util.parse_datetime(eintrag[0])) is not None and z >= vor:
            continue
        ergebnis.append(eintrag)
        if len(ergebnis) >= msg["limit"]:
            break
    connection.send_result(msg["id"], ergebnis)


# ---------------------------------------------------------------------- meldungen
@websocket_api.websocket_command({vol.Required("type"): "baustelle/meldungen", vol.Optional("entry_id"): vol.Any(None, str)})
@websocket_api.async_response
async def ws_meldungen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Alle Meldungen aus dem Melden-Knopf (eine Liste für die ganze Integration), neueste zuerst."""
    connection.send_result(msg["id"], list(await hass.data[DATA_MELDUNGEN].async_laden()))


@websocket_api.websocket_command({
    vol.Required("type"): "baustelle/meldung",
    vol.Required("aktion"): vol.In(["neu", "status", "loeschen"]),
    vol.Optional("meldung"): dict,
    vol.Optional("meldung_id"): str,  # „id“ ist die Nummer der WebSocket-Nachricht
    vol.Optional("status"): vol.In(["offen", "erledigt"]),
    vol.Optional("entry_id"): vol.Any(None, str),
})
@websocket_api.async_response
async def ws_meldung(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Meldung speichern, erledigen/wieder öffnen oder löschen."""
    meldungen: Meldungen = hass.data[DATA_MELDUNGEN]
    liste = await meldungen.async_laden()
    jetzt = dt_util.now().isoformat(timespec="seconds")
    if msg["aktion"] == "neu":
        try:
            m = MELDUNG(msg.get("meldung") or {})
        except vol.Invalid as err:
            _fehler(connection, msg, str(err))
            return
        m.update(id=_neue_id("m"), zeit=jetzt, status="offen", stand=None)
        m.setdefault("version", hass.data.get(DATA_VERSION, ""))
        if msg.get("entry_id"):
            m["baustelle"] = msg["entry_id"]
        liste.insert(0, m)
        meldungen.speichern()
        connection.send_result(msg["id"], {"ok": True, "id": m["id"]})
        return
    angaben = msg.get("meldung") or {}
    mid = msg.get("meldung_id") or angaben.get("id")
    m = next((x for x in liste if x["id"] == mid), None)
    if m is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Meldung nicht gefunden")
        return
    if msg["aktion"] == "loeschen":
        liste.remove(m)
    else:
        status = msg.get("status") or angaben.get("status")
        if status not in (None, "offen", "erledigt"):
            _fehler(connection, msg, "status: offen oder erledigt")
            return
        m["status"] = status or ("erledigt" if m.get("status") == "offen" else "offen")
        m["stand"] = jetzt
    meldungen.speichern()
    connection.send_result(msg["id"], {"ok": True})
