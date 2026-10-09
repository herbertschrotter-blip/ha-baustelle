"""Kern: Geräte der Baustelle – die eine Stelle für Änderungen an Geräten (BSM-034.02, Bauplan Geräte §4).

Lieferung 1: Status (aktiv / inaktiv / verliehen / defekt, logik/geraete) – Container-Chip, ✎ Gerät und Inventar ändern
ihn nur hier; das Inventar zieht mit (Ausrüstung im Einsatz als dieses Gerät), Änderungen aus dem Inventar kommen über
`status_setzen(…, ins_inventar=False)` zurück.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from homeassistant.const import STATE_ON
from homeassistant.core import Context

from ..db import DATA_DB
from ..db import inventar as db_inventar
from ..logik import geraete as logik
from .typen import GeraetInfo

if TYPE_CHECKING:
    from ..steuerung import Steuerung

_LOGGER = logging.getLogger("custom_components.baustelle.steuerung")


def status(st: Steuerung, g: GeraetInfo) -> str:
    return logik.status_von((st.e.get("geraete") or {}).get(g.id))


def status_setzen(st: Steuerung, g: GeraetInfo, neu: str, *, ins_inventar: bool = True) -> bool:
    """Status setzen; False, wenn er schon so war. Geht das Gerät aus der Automatik, wird es einmal ausgeschaltet und
    der Handbetrieb endet (wie WU-0004). Protokoll, Einstellungen (Datenbank) und Inventar ziehen mit."""
    if neu not in logik.STATUS:
        raise ValueError(f"Status {neu!r}: erlaubt sind {', '.join(logik.STATUS)}")
    if status(st, g) == neu:
        return False
    eintrag = st.e.setdefault("geraete", {}).setdefault(g.id, {})
    eintrag.pop("aktiv", None)   # alter Schalter (bis 0.8.115) – jetzt nur noch der Status
    eintrag["status"] = neu
    st.lz["hand"].pop(g.id, None)
    st.protokoll("einstellung", g.bereich, logik.status_protokoll(g.name, neu))
    zustand = st.hass.states.get(g.schalter)
    if not logik.schaltet(neu) and zustand is not None and zustand.state == STATE_ON:
        kontext = Context()
        st._eigene_kontexte.append(kontext.id)
        st.hass.async_create_task(
            st.hass.services.async_call("switch", "turn_off", {"entity_id": g.schalter}, context=kontext),
            f"baustelle_inaktiv_{g.schalter}", eager_start=False,
        )
    st.einstellungen.speichern()
    st.auswerten()
    if ins_inventar and (db := st.hass.data.get(DATA_DB)) is not None:
        st.entry.async_create_background_task(st.hass, db.async_ausfuehren(
            lambda v: db_inventar.status_fuer_geraet(v, g.id, neu)), f"baustelle_status_{g.id}")
    return True
