"""Kern: Geräte schalten (Automatik, Hand, aktiv) (BSM-023)."""

from __future__ import annotations

from datetime import datetime, timedelta
import logging
from typing import TYPE_CHECKING

from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import Context, State

from ..funktionen.basis import SollJeBereich
from ..logik import warnungen as warn_logik
from ..texte import GRUND_TEXT
from .typen import GeraetInfo, WARTE_TEXT

if TYPE_CHECKING:
    from ..steuerung import Steuerung

_LOGGER = logging.getLogger("custom_components.baustelle.steuerung")


def _schalten_alle(st: Steuerung, jetzt: datetime, soll: SollJeBereich, an_set: set[str], ziel: dict[str, bool | None]
) -> None:
    geschaltet: dict[str, list[tuple[GeraetInfo, bool]]] = {}
    for gid in sorted(ziel, key=lambda x: x in an_set):   # erst alle aus, dann ein – nie kurz Überlast
        g = st.geraete[gid]
        zustand = st.hass.states.get(g.schalter)
        ein = gid in an_set
        if st._schalten(g, zustand, ein, jetzt) and not (
            not ein and warn_logik.selbst_ein_seit(st._aus_befehle.get(g.id, []), jetzt) is not None
        ):   # FE-0010: schaltet es sich selbst wieder ein, steht das einmal als Störung im Protokoll, nicht jede Minute
            geschaltet.setdefault(g.bereich, []).append((g, ein))
    if geschaltet:
        st._frei_verlauf.clear()   # eigene Schaltung: der freie Strom von vorhin gilt nicht mehr
    # Staffelung: neu wartende Geräte ins Protokoll (Mockup „Staffelung: Konvektor wartet …“)
    s = st.e["staffel"]
    for gid, w in st.daten.warte.items():
        # „anlauf“ (einer nach dem anderen, dauert Sekunden) ist kein Warten, das ins Protokoll gehört
        if st._letztes_warten.get(gid) != w["grund"] and gid in st.geraete and w["grund"] != "anlauf":
            g = st.geraete[gid]
            text = WARTE_TEXT.get(w["grund"], w["grund"]).format(max=s["max_gleichzeitig"], takt=s["takt_min"])
            st.protokoll("schalten", g.bereich, f"Staffelung: {g.name} wartet ({text})")
    st._letztes_warten = {gid: w["grund"] for gid, w in st.daten.warte.items()}
    if not geschaltet:
        return
    eintraege: dict[tuple[str, bool], list[str]] = {}
    for bid, liste in geschaltet.items():
        s_c = soll[bid][0]
        for ein in {e for _, e in liste}:
            eintraege.setdefault((s_c.grund, ein), []).append(bid)
    alle = {bid for bid, (s_c, _) in soll.items() if s_c.ein is not None}
    for (grund, ein), bids in eintraege.items():
        titel = GRUND_TEXT.get(grund, str(grund))
        if len(bids) > 1 and set(bids) == alle:
            st.protokoll("schalten", None, f"{titel} – alle Container {'ein' if ein else 'aus'}")
            continue
        for bid in bids:
            namen = ", ".join(g.name for g, e in geschaltet[bid] if e == ein)
            st.protokoll("schalten", bid, f"{titel} – {namen} {'ein' if ein else 'aus'}")


def _schalten(st: Steuerung, g: GeraetInfo, zustand: State | None, ein: bool, jetzt: datetime) -> bool:
    if zustand is None or zustand.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return False
    if (zustand.state == STATE_ON) == ein:
        return False
    letzter = st._letzter_befehl.get(g.id)
    if letzter and letzter[0] == ein and jetzt - letzter[1] < timedelta(seconds=55):
        return False
    kontext = Context()
    st._eigene_kontexte.append(kontext.id)
    st._letzter_befehl[g.id] = (ein, jetzt)
    if not ein:   # FE-0010: wie oft musste ausgeschaltet werden (schaltet es sich selbst wieder ein?)
        grenze = jetzt - timedelta(minutes=warn_logik.SELBST_EIN_FENSTER_MIN)
        st._aus_befehle[g.id] = [t for t in st._aus_befehle.get(g.id, []) if t >= grenze] + [jetzt]
    _LOGGER.debug("%s → %s", g.schalter, "ein" if ein else "aus")
    st.hass.async_create_task(
        st.hass.services.async_call(
            "switch", "turn_on" if ein else "turn_off", {"entity_id": g.schalter}, context=kontext
        ),
        f"baustelle_schalten_{g.schalter}",
        eager_start=False,
    )
    return True


def geraet_aktiv_setzen(st: Steuerung, g: GeraetInfo, aktiv: bool) -> None:
    """Aktiv/inaktiv setzen; beim Deaktivieren einmal ausschalten und den Handbetrieb beenden."""
    st.e.setdefault("geraete", {}).setdefault(g.id, {})["aktiv"] = aktiv
    st.lz["hand"].pop(g.id, None)
    st.protokoll("einstellung", g.bereich, f"{g.name}: {'aktiv' if aktiv else 'inaktiv – die Automatik lässt es aus'}")
    zustand = st.hass.states.get(g.schalter)
    if not aktiv and zustand is not None and zustand.state == STATE_ON:
        kontext = Context()
        st._eigene_kontexte.append(kontext.id)
        st.hass.async_create_task(
            st.hass.services.async_call("switch", "turn_off", {"entity_id": g.schalter}, context=kontext),
            f"baustelle_inaktiv_{g.schalter}", eager_start=False,
        )
    st.einstellungen.speichern()
    st.auswerten()


def geraet_schalten(st: Steuerung, g: GeraetInfo, an: bool) -> None:
    """Gerät von der Seite aus schalten: Handbetrieb bis zum nächsten Schaltpunkt (api §2 `schalten`)."""
    zustand = st.hass.states.get(g.schalter)
    if not (st.automatik and st.funktion_von(g).hand_setzen(g, an)):
        st.protokoll("schalten", g.bereich, f"{g.name} von Hand {'eingeschaltet' if an else 'ausgeschaltet'}")
    st._letzter_befehl.pop(g.id, None)
    if zustand is not None and zustand.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        kontext = Context()
        st._eigene_kontexte.append(kontext.id)
        st.hass.async_create_task(
            st.hass.services.async_call(
                "switch", "turn_on" if an else "turn_off", {"entity_id": g.schalter}, context=kontext
            ),
            f"baustelle_hand_{g.schalter}",
            eager_start=False,
        )
