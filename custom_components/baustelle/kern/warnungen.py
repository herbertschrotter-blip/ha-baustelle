"""Kern: Warnungen, Gerätezustand und Bericht planen (BSM-023)."""

from __future__ import annotations

from datetime import datetime
import logging
from typing import TYPE_CHECKING

from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import callback
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.util import dt as dt_util

from ..const import CONF_WETTER
from ..funktionen.basis import SollJeBereich, zahl as _zahl, zeit as _zeit
from ..logik import warnungen as warn_logik
from .. import texte
from .typen import FEHLT_NACH

if TYPE_CHECKING:
    from ..steuerung import Steuerung

_LOGGER = logging.getLogger("custom_components.baustelle.steuerung")


def _warnungen_laden(st: Steuerung) -> None:
    """Offene Warnungen vom letzten Lauf (für Beginn und „schon gemeldet“ über einen Neustart hinweg)."""
    for key, w in (st.lz.get("warnungen_offen") or {}).items():
        if isinstance(w, dict) and (zeit := _zeit(w.get("seit"))) is not None:
            art = key.split(":", 1)[0]
            st._warn_alt[key] = warn_logik.Warnung(
                key, art, str(warn_logik.stufe_von(art)), w.get("bereich"), w.get("geraet"), zeit,
                dict(w.get("werte") or {}),
            )


def _geraete_zustand(st: Steuerung, jetzt: datetime) -> list[warn_logik.GeraetZustand]:
    liste = []
    for g in st.geraete.values():
        if not st.geraet_aktiv(g):
            continue   # inaktiv: keine Warnungen (WU-0004)
        zustand = st.hass.states.get(g.schalter)
        erreichbar = zustand is not None and zustand.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
        # Protokoll von HA einmal beim Ausfall und einmal, wenn der Shelly wieder antwortet
        if erreichbar:
            if st._offline_seit.pop(g.id, None) is not None:
                _LOGGER.info("%s (%s) ist wieder erreichbar", g.name, g.schalter)
        elif g.id not in st._offline_seit:
            st._offline_seit[g.id] = jetzt
            _LOGGER.info("%s (%s) ist nicht erreichbar", g.name, g.schalter)
        l_zustand = st.hass.states.get(g.leistung) if g.leistung else None
        leistung = _zahl(l_zustand) if g.leistung else None
        an = erreichbar and zustand is not None and zustand.state == STATE_ON
        f = st._je_rolle.get(g.rolle)
        typ, laeuft_seit, zyklen = (
            f.geraet_warnung(g, erreichbar, leistung, jetzt) if f is not None else (warn_logik.Typ.SONST, None, 0)
        )
        liste.append(
            warn_logik.GeraetZustand(
                id=g.id, bereich=g.bereich, typ=typ, name=g.name, erreichbar=erreichbar,
                offline_seit=st._offline_seit.get(g.id), leistung=leistung, an=an,
                an_seit=dt_util.as_local(zustand.last_changed) if an and zustand is not None else None,
                leistung_seit=dt_util.as_local(l_zustand.last_changed) if l_zustand is not None else None,
                hand_seit=st.funktion_von(g).hand_seit(g), laeuft_seit=laeuft_seit, zyklen_h=zyklen,
                selbst_ein_seit=warn_logik.selbst_ein_seit(st._aus_befehle.get(g.id, []), jetzt),
                notprogramm_seit=st.notprogramm_fehler.get(g.id, (None, ""))[0],   # BSM-019
                notprogramm_fehler=st.notprogramm_fehler.get(g.id, (None, ""))[1],
            )
        )
    return liste


def _warnungen(st: Steuerung, jetzt: datetime, soll: SollJeBereich) -> None:
    geraete = st._geraete_zustand(jetzt)
    bereiche = [c for f in st.funktionen if f.aktiv() for c in f.warnungen(jetzt, soll)]
    erreichbar = [g.erreichbar for g in geraete]
    st.daten.erreichbar = None if not erreichbar else not warn_logik.baustelle_offline(erreichbar)
    wetter_da = (
        not any(f.braucht_wetter and f.aktiv() for f in st.funktionen)
        or not st.entry.options.get(CONF_WETTER) or st._prognose_da
        or jetzt - st._gestartet < FEHLT_NACH
    )
    zustand = warn_logik.BaustellenZustand(geraete=tuple(geraete), container=tuple(bereiche), wetter_vorhanden=wetter_da)
    neu = warn_logik.behalte_seit(warn_logik.pruefe(zustand, st.warn_einstellungen(), jetzt), st._warn_alt.values())
    st.daten.warnungen = neu
    st.daten.probleme = {g.id: [] for g in st.geraete.values()}
    for w in neu:
        if w.geraet in st.daten.probleme and w.stufe == warn_logik.Stufe.STOERUNG:
            st.daten.probleme[w.geraet].append(w.art)
    if not st.aktiv:
        st._warn_alt = {w.key: w for w in neu}
        return
    stumm = {k: z for k, v in st.e["stumm"].items() if (z := _zeit(v)) is not None}
    alt = st._warn_alt
    for w in neu:
        if w.key not in alt:
            art, text = next(
                (t for f in st.funktionen if (t := f.warnung_protokoll(w)) is not None),
                ("warnung", texte.protokoll_warnung(w)),
            )
            st.protokoll(art, w.bereich, text)
    neu_keys = {w.key for w in neu}
    for key, w in alt.items():
        if key not in neu_keys:
            st.protokoll("ok", w.bereich, texte.wieder_ok(w))
    bisher = warn_logik.erinnern(set(st.lz.get("gemeldet") or []), st.lz.pop("stumm_vorbei", []), neu)
    gemeldet = warn_logik.zu_melden(neu, bisher, stumm, jetzt)
    for w in gemeldet:
        st.nachrichten.warnung_melden(w)
    st.lz["gemeldet"] = sorted(warn_logik.gemeldet_merken(neu, bisher, gemeldet))
    offen = {
        w.key: {"seit": w.seit.isoformat(timespec="seconds"), "bereich": w.bereich, "geraet": w.geraet,
                "werte": {k: v for k, v in w.werte.items() if isinstance(v, (str, int, float, bool))}}
        for w in neu
    }
    if set(offen) != set(st.lz.get("warnungen_offen") or {}) or gemeldet:
        st.lz["warnungen_offen"] = offen
        st.einstellungen.speichern()
    else:
        st.lz["warnungen_offen"] = offen
    st._warn_alt = {w.key: w for w in neu}


def bericht_planen(st: Steuerung) -> None:
    """Nächsten Wochen-/Monatsbericht einplanen (logik/bericht.naechster_bericht)."""
    if st._bericht_abmelden:
        st._bericht_abmelden()
        st._bericht_abmelden = None
    if st.nachrichten is None:
        return
    naechster = st.nachrichten.naechster_bericht(dt_util.now())
    if naechster is None:
        return
    zeitpunkt, art = naechster

    @callback
    def faellig(_now: datetime) -> None:
        st._bericht_abmelden = None
        if st.aktiv:
            st.entry.async_create_background_task(
                st.hass, st.nachrichten.async_bericht_senden(art, zeitpunkt), "baustelle_bericht"
            )
        st.bericht_planen()

    st._bericht_abmelden = async_track_point_in_time(st.hass, faellig, zeitpunkt)
