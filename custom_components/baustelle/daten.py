"""Aufbau einer Baustelle für die eigene Seite (WebSocket `baustelle/struktur`, api-0.7 §1) und die Diagnose."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .auswertung import beginn_der_baustelle
from .const import ART_CONTAINER, CONF_STATUS, STATUS_AKTIV
from .funktionen import aktive
from .funktionen.heizung import Heizung
from .funktionen.pumpen import Pumpen
from .logik.abrechnung import EIGEN, firma_von
from .logik.arbeitszeit import Plan, uhrzeit
from .logik.warnungen import titel as warn_titel
from . import texte

if TYPE_CHECKING:
    from .steuerung import Steuerung

PROTOKOLL_IN_STRUKTUR = 20
NICHT_IN_EINSTELLUNGEN = ("zaehler", "protokoll", "meldungen", "laufzeit")
ROLLE_API = {"heizkoerper": "heizung", "bautrockner": "trockner", "pumpe": "pumpe", "steckdose": "steckdose"}


def _iso(zeit: datetime | None) -> str | None:
    return zeit.isoformat(timespec="seconds") if zeit is not None else None


def plan_dict(plan: Plan | None) -> dict[str, Any] | None:
    if plan is None:
        return None
    a = plan.ausnahme
    return {
        "start": plan.start, "vor": plan.vor, "a": plan.a, "b": plan.b, "nach": plan.nach, "ende": plan.ende,
        "gruende": [str(g) for g in plan.gruende],
        "ausnahme": None if a is None else {
            "datum": a.datum.isoformat(), "art": str(a.art), "von": uhrzeit(a.von) if a.von else None,
            "bis": uhrzeit(a.bis) if a.bis else None, "notiz": a.notiz,
        },
    }


def _woche(heute: date) -> list[date]:
    montag = heute - timedelta(days=heute.weekday())
    return [montag + timedelta(days=k) for k in range(7)]


def _plan_woche(st: Steuerung, heute: date) -> list[dict[str, Any]]:
    tage = []
    for tag in _woche(heute):
        ausnahme = next((a for a in st.ausnahmen() if a.datum == tag), None)
        frei = "ausnahme" if ausnahme is not None and str(ausnahme.art) == "frei" else st.frei_art(tag)
        eintrag: dict[str, Any] = {"datum": tag.isoformat(), "plan": plan_dict(Heizung.von(st).plan(tag, True)), "frei": frei}
        if frei == "feiertag" and tag in st.kalender_namen:
            eintrag["name"] = st.kalender_namen[tag]
        tage.append(eintrag)
    return tage


def _minute_im_tag(zeit: datetime, tag: date) -> int:
    if zeit.date() < tag:
        return 0
    if zeit.date() > tag:
        return 24 * 60
    return zeit.hour * 60 + zeit.minute


def _abschnitte(st: Steuerung, heute: date, jetzt: datetime) -> dict[str, dict[str, list[list[Any]]]]:
    """Heizzeiten je Container und Tag der Woche (Mockup `heizzeiten`); Termine als „vorheizen“ + „termin“."""
    heizung = Heizung.von(st)
    vorheizen = timedelta(minutes=int(st.e["heizung"]["vorheizen_min"]))
    ergebnis: dict[str, dict[str, list[list[Any]]]] = {}
    for info in heizung.bereiche():
        e = st.einstellungen.bereich(info.id)
        je_tag: dict[str, list[list[Any]]] = {}
        for tag in _woche(heute):
            teile: list[list[Any]] = []
            if e["bedarf"]:
                for t in heizung.termine:
                    von, bis = dt_util.parse_datetime(t["von"]), dt_util.parse_datetime(t["bis"])
                    if t["bereich"] != info.id or von is None or bis is None:
                        continue
                    von, bis = dt_util.as_local(von), dt_util.as_local(bis)
                    if von.date() != tag:
                        continue
                    teile.append([_minute_im_tag(von - vorheizen, tag), _minute_im_tag(von, tag), "vorheizen"])
                    teile.append([_minute_im_tag(von, tag), _minute_im_tag(bis, tag), "termin"])
                if tag == heute and (bis := heizung.bis("bedarf_bis", info.id, jetzt)) is not None:
                    teile.append([_minute_im_tag(jetzt, tag), _minute_im_tag(bis, tag), "termin"])
            elif e["auto"]:
                plan = heizung.plan(tag, bool(e["trocknen"]))
                teile = [[von, bis, str(art)] for von, bis, art in plan.abschnitte()] if plan else []
            je_tag[tag.isoformat()] = [x for x in teile if x[1] > x[0]]
        ergebnis[info.id] = je_tag
    return ergebnis


def _zahl(hass: HomeAssistant, entity_id: str | None) -> float | None:
    if not entity_id or (s := hass.states.get(entity_id)) is None or s.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return None
    try:
        return float(s.state)
    except ValueError:
        return None


def laufzeit(st: Steuerung) -> dict[str, Any]:
    """Laufzeit-Teil der Struktur (api-0.7 §1 `laufzeit`)."""
    hass = st.hass
    jetzt = dt_util.now()
    heute = jetzt.date()
    d = st.daten
    lz = st.lz
    heizung, pumpen = Heizung.von(st), Pumpen.von(st)
    container: dict[str, Any] = {}
    for bid, info in st.bereiche.items():
        kw = sum(
            (_zahl(hass, g.leistung) or 0.0) / 1000 for g in st.geraete_in(bid)
            if g.leistung and (s := hass.states.get(g.schalter)) is not None and s.state == STATE_ON
        )
        tuer = None
        if info.art == ART_CONTAINER and (tuer_id := st.einstellungen.bereich(bid).get("tuer")):
            s = hass.states.get(tuer_id)
            offen = s is not None and s.state == STATE_ON
            tuer = {"offen": offen, "seit": _iso(dt_util.as_local(s.last_changed)) if offen and s else None}
        container[bid] = {
            "zustand": d.zustand.get(bid, "aus"), "grund": d.grund.get(bid), "text": d.text.get(bid, ""),
            "temperatur": d.temperatur.get(bid), "kw": round(kw, 3),
            "bedarf_bis": _iso(heizung.bis("bedarf_bis", bid, jetzt)),
            "boost_bis": _iso(heizung.bis("boost_bis", bid, jetzt)),
            "tuer": tuer,
            "modus": heizung.modus(bid) if info.art == ART_CONTAINER else None,
            "firma": firma_von(st.e.get("zuordnung") or [], st.e.get("firmen") or [{"id": EIGEN}], bid, jetzt),
        }
    geraete: dict[str, Any] = {}
    for gid, g in st.geraete.items():
        s = hass.states.get(g.schalter)
        an = s is not None and s.state == STATE_ON
        leistung = _zahl(hass, g.leistung)
        geraete[gid] = {
            "an": an,
            "kw": round(leistung / 1000, 3) if leistung is not None else (st.nenn_kw(g) if an else 0.0),
            "erreichbar": s is not None and s.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN),
            "hand_seit": lz["hand"].get(gid),
            "warte": d.warte.get(gid),
        }
    stumm = st.e["stumm"]
    tuer_melden = st.e["heizung"]["tuer_melden_min"]
    warnungen = [
        {"key": w.key, "art": w.art, "stufe": w.stufe, "bereich": w.bereich, "geraet": w.geraet, "titel": warn_titel(w),
         "hilfe": texte.hilfe(w, tuer_melden), "seit": _iso(w.seit),
         "stumm_bis": stumm.get(w.key) if (z := dt_util.parse_datetime(str(stumm.get(w.key) or ""))) and z > jetzt else None}
        for w in d.warnungen
    ]
    w = d.wetter
    h = st.e["heizung"]
    return {
        "status": d.status,
        "status_text": d.status_text,
        "naechste": _iso(d.naechste),
        "jetzt_bis": _iso(heizung.jetzt_bis(jetzt)),
        "container": container,
        "geraete": geraete,
        "plan_woche": _plan_woche(st, heute) if heizung.aktiv() else [],
        "abschnitte": _abschnitte(st, heute, jetzt) if heizung.aktiv() else {},
        "staffel": d.staffel,
        "warnungen": warnungen,
        "wetter": {"aussen": w.aussen, "aussen_max": w.aussen_max, "frueh_min": w.frueh, "regen_vortag": w.regen_vortag,
                   "regen_heute": w.regen_heute, "zustand": w.zustand},
        "heizgrenze": {"bezug": w.aussen_max if h["heizgrenze_basis"] == "tageshoechst" else w.aussen,
                       "zu_warm": heizung.zu_warm(w)},
        "termine": list(heizung.termine),
        "protokoll": st.e["protokoll"][:PROTOKOLL_IN_STRUKTUR],
        # wie 0.6 (Entitäten, Diagnose)
        "probleme": d.probleme,
        "pumpe_laeuft": pumpen.pumpe_laeuft,
        "erreichbar": d.erreichbar,
    }


def struktur(hass: HomeAssistant, entry: ConfigEntry, version: str = "") -> dict[str, Any]:
    """Einrichtung, Entitäten (Schlüssel → entity_id), Einstellungen, Zähler und Laufzeit einer Baustelle."""
    registry = er.async_get(hass)
    jetzt = dt_util.now()
    beginn, beginn_auto = beginn_der_baustelle(entry)
    daten: dict[str, Any] = {
        "baustelle": {
            "entry_id": entry.entry_id, "titel": entry.title,
            "status": entry.options.get(CONF_STATUS, STATUS_AKTIV), "optionen": dict(entry.options),
            # geltender Beginn (leer = Tag der Anlage, AN-0002) und ob er automatisch gilt
            "beginn": beginn.isoformat(), "beginn_auto": beginn_auto,
            "geladen": getattr(entry, "runtime_data", None) is not None, "version": version,
            "zeitzone": str(hass.config.time_zone), "heute": jetzt.date().isoformat(), "jetzt": _iso(jetzt),
        },
        "funktionen": aktive(entry.options),  # eingeschaltete Funktionen (api-0.7 §8), auch nicht geladen
        "entitaeten": {e.unique_id: e.entity_id for e in er.async_entries_for_config_entry(registry, entry.entry_id)},
    }
    st: Steuerung | None = getattr(entry, "runtime_data", None)
    if st is None:
        daten.update(bereiche=[], geraete=[], einstellungen={}, zaehler={}, laufzeit={})
        return daten
    daten.update(
        bereiche=[{"id": b.id, "name": b.name, "art": b.art, "fuehler": b.fuehler, "nr": b.nr} for b in st.bereiche.values()],
        geraete=[
            {"id": g.id, "name": g.name, "bereich": g.bereich, "schalter": g.schalter,
             "rolle": ROLLE_API.get(g.rolle, g.rolle), "typ": g.typ, "leistung": g.leistung, "energie": g.energie,
             "nenn_kw": st.nenn_kw(g)}
            for g in st.geraete.values()
        ],
        einstellungen={k: v for k, v in st.e.items() if k not in NICHT_IN_EINSTELLUNGEN},
        zaehler={k: v for k, v in st.zaehler.items() if not k.startswith("stand:")},
        laufzeit=laufzeit(st),
    )
    return daten
