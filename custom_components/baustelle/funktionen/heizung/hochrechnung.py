"""Heizung: Hochrechnung der Heizperiode mit Energiesignatur und Heizgradtagen (BSM-033.02, Bauplan Hochrechnung §4).

Beim Start und stündlich (:50, damit „bisher“ mit heute frisch bleibt; BSM-033.03): je Container die Tage der laufenden Heizperiode aus
der Datenbank (`db/tage.hochrechnung_tage`), dazu die Vorhersage der nächsten Tage (Tagesmittel aus `wetter_tage`) und
die Klimamittel (Einstellung `heizung.klimamittel`, sonst Vorgabe). Gerechnet wird nur in `logik/hochrechnung`; das
Ergebnis liegt bei der Heizung (`Heizung.hochrechnung`) – Sensor `prognose_heizperiode` und `baustelle/auswertung`
lesen es; dazu für die Karte „Heizperiode“ die Tagesreihe, die Punkte der Signatur je Container, Klimamittel und
Vorhersage. Ohne Datenbank bleibt es bei der bisherigen Hochrechnung (Tagesschnitt seit Zählbeginn).
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime
import logging
from typing import TYPE_CHECKING, Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util

from ...const import CONF_ENDE, CONF_HEIZPERIODE_BIS, CONF_HEIZPERIODE_VON
from ...db import DATA_DB
from ...db.tage import hochrechnung_tage
from ...logik import hochrechnung as h
from ...logik.signatur import Tag, berechnen
from ...logik.auswertung import heizperiode_bis, heizperiode_ende

if TYPE_CHECKING:
    from ...steuerung import Steuerung
    from . import Heizung

_LOGGER = logging.getLogger(__name__)
STUENDLICH = {"minute": 50, "second": 0}


def zeitraum(st: Steuerung, heute: date) -> tuple[date, date]:
    """Erster und letzter Tag der laufenden Heizperiode (Ende der Baustelle, wenn früher)."""
    o = st.entry.options
    von = min(12, max(1, int(o.get(CONF_HEIZPERIODE_VON) or 10)))
    bis = min(12, max(1, int(o.get(CONF_HEIZPERIODE_BIS) or 4)))
    ende_hp = heizperiode_ende(heute, von, bis)
    beginn = date(ende_hp.year - (bis < von), von, 1)
    ende = o.get(CONF_ENDE)
    return beginn, heizperiode_bis(heute, von, bis, date.fromisoformat(ende) if ende else None)


def vorhersage(st: Steuerung, heute: date) -> dict[date, float]:
    """Tagesmittel der Vorhersage ab morgen (`wetter_tage`, kern/wetter)."""
    aus: dict[date, float] = {}
    for iso, werte in (st.lz.get("wetter_tage") or {}).items():
        tag = date.fromisoformat(iso)
        if tag > heute and isinstance(werte.get("mittel"), (int, float)):
            aus[tag] = float(werte["mittel"])
    return aus


def _signatur(tage: list[Tag]) -> dict[str, Any]:
    """Signatur der ganzen Baustelle (Kachel „Wetter“, Erkenntnis „je Grad kälter“) mit ihren Punkten."""
    sig = berechnen(tage)
    return {"stand": sig.stand, "tage": sig.tage, "grenze": sig.grenze, "kwh_je_grad": sig.kwh_je_grad, "grundlast": sig.grundlast,
            "bezug": sig.bezug, "cv_rmse": sig.cv_rmse, "punkte": [[round(t.aussen, 2), round(t.kwh, 2)] for t in tage]}


def ergebnis(hz: Heizung, roh: dict[str, list[h.TagRoh]], heute: date) -> dict[str, Any]:
    """Hochrechnung aus den Tagen je Container (ohne Datenbank, damit testbar)."""
    st = hz.st
    beginn, ende = zeitraum(st, heute)
    eigen = (st.e.get("heizung") or {}).get("klimamittel")
    klima = h.klimamittel(eigen)
    vor = vorhersage(st, heute)
    ids = [b.id for b in hz.bereiche()]
    roh = {bid: roh.get(bid, []) for bid in ids}
    reste = {bid: h.container_rest(roh[bid], heute, ende, vor, klima, beginn) for bid in ids}
    container = [{
        "bereich": bid, "methode": r.methode, "rest_kwh": r.rest_kwh, "unten_kwh": r.unten_kwh, "oben_kwh": r.oben_kwh,
        "normjahr_kwh": r.normjahr_kwh, "stand": r.signatur.stand, "grund": r.signatur.grund, "tage": r.signatur.tage,
        "grenze": r.signatur.grenze, "kwh_je_grad": r.signatur.kwh_je_grad, "grundlast": r.signatur.grundlast,
        "cv_rmse": r.signatur.cv_rmse,
        "punkte": [[t.aussen, round(t.kwh or 0.0, 2)] for t in roh[bid] if h.tag_zaehlt(t, heute)],
    } for bid, r in reste.items()]
    rest_temps = [t for t, _ in h.temperaturen(h.tage(heute, ende), vor, klima)]
    return {"heute": heute.isoformat(), "beginn": beginn.isoformat(), "ende": ende.isoformat(), "reste": reste,
            "container": container, "hgt_rest": h.hgt_summe(rest_temps[1:]), "vorhersage_tage": len(vor),
            "bisher_kwh": h.bisher(roh, heute, beginn),
            "signatur": _signatur(h.baustelle_tage(roh, heute)),
            "reihe": h.reihe(roh, reste, heute, beginn, ende, hz.hochrechnung_heizperiode("ohne")),
            "klima": list(klima), "klima_vorgabe": eigen is None,
            "vorhersage": [[d.isoformat(), t] for d, t in sorted(vor.items()) if d <= ende]}


async def async_rechnen(hass: HomeAssistant, hz: Heizung) -> None:
    st = hz.st
    db = hass.data.get(DATA_DB)
    if db is None or not db.bereit or not hz.aktiv():
        return
    heute = dt_util.now().date()
    beginn, _ = zeitraum(st, heute)
    zone = dt_util.get_default_time_zone()
    roh = await db.async_ausfuehren(lambda v: hochrechnung_tage(v, st.entry.entry_id, beginn, heute, zone))
    if roh is None:
        _LOGGER.debug("Hochrechnung: Tage nicht lesbar (%s)", db.fehler)
        return
    hz.hochrechnung = ergebnis(hz, roh, heute)


def werte(hz: Heizung) -> dict[str, Any] | None:
    """Hochrechnung der Baustelle aus dem letzten Ergebnis (bisher = Tage der Heizperiode aus der Datenbank); None ohne
    Ergebnis (dann gilt der Tagesschnitt)."""
    if not hz.hochrechnung:
        return None
    return h.baustelle(hz.hochrechnung["bisher_kwh"], hz.hochrechnung["reste"])


@callback
def hochrechnung_planen(hass: HomeAssistant, st: Steuerung) -> Callable[[], None]:
    """Beim Start und stündlich."""
    from . import Heizung   # noqa: PLC0415

    hz = Heizung.von(st)
    st.entry.async_create_background_task(hass, async_rechnen(hass, hz), "baustelle_hochrechnung")

    async def _stuendlich(_jetzt: datetime) -> None:
        await async_rechnen(hass, hz)
    return async_track_time_change(hass, _stuendlich, **STUENDLICH)
