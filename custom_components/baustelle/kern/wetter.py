"""Kern: Wetter – Prognose holen, Werte je Tag merken, Wetter jetzt und je Tag (BSM-023)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import logging
from typing import TYPE_CHECKING, Any

from homeassistant.const import ATTR_TEMPERATURE, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import ServiceResponse
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util

from ..const import CONF_REGEN_SENSOR, CONF_TEMP_SENSOR, CONF_WETTER
from ..funktionen.basis import ZAEHLER_SPEICHERN_S, zahl as _zahl
from ..logik import regelung as regel_logik
from ..logik.arbeitszeit import WetterTag
from .typen import WetterWerte

if TYPE_CHECKING:
    from ..steuerung import Steuerung

_LOGGER = logging.getLogger("custom_components.baustelle.steuerung")


async def _async_prognose(st: Steuerung, _now: datetime | None = None) -> None:
    """Vorhersage holen (bewährt: Dienst weather.get_forecasts)."""
    wetter = st.entry.options.get(CONF_WETTER)
    if not wetter or st.hass.states.get(wetter) is None or st._prognose_laeuft:
        return
    st._prognose_laeuft = True
    try:
        await st._async_prognose_holen(wetter)
    finally:
        st._prognose_laeuft = False
    st.auswerten()


async def _async_prognose_holen(st: Steuerung, wetter: str) -> None:
    jetzt = dt_util.now()
    tage: dict[date, dict[str, float | None]] = {}
    for art in ("daily", "hourly"):
        try:
            antwort = await st.hass.services.async_call(
                "weather", "get_forecasts", {"type": art}, target={"entity_id": wetter},
                blocking=True, return_response=True,
            )
        except HomeAssistantError as err:
            _LOGGER.debug("Vorhersage %s von %s nicht verfügbar: %s", art, wetter, err)
            continue
        liste = _antwort_liste(antwort, wetter, "forecast")
        for tag, werte in _prognose_je_tag(liste, art).items():
            ziel = tage.setdefault(tag, {})
            ziel.update({k: v for k, v in werte.items() if v is not None})
    if tage:
        st._prognose_da = True
        st._wetter_tage_merken(tage, jetzt)


def _wetter_tage_merken(st: Steuerung, tage: dict[date, dict[str, float | None]], jetzt: datetime) -> None:
    """Vorhersage je Tag im Store merken; vergangene Morgen/Regen von heute bleiben (die Vorhersage vergisst sie)."""
    gemerkt = st.lz.setdefault("wetter_tage", {})
    heute = jetzt.date()
    for tag, werte in tage.items():
        alt = gemerkt.setdefault(tag.isoformat(), {})
        for key, wert in werte.items():
            if tag == heute and alt.get(key) is not None:
                if key == "frueh" and jetzt.hour >= 8:
                    continue
                if key in ("regen", "max"):
                    wert = max(wert, alt[key])
            alt[key] = wert
    grenze = (heute - timedelta(days=10)).isoformat()
    for iso in [k for k in gemerkt if k < grenze]:
        del gemerkt[iso]
    st.einstellungen.speichern(ZAEHLER_SPEICHERN_S)


def _wetter_tag(st: Steuerung, tag: date) -> dict[str, Any]:
    tag_werte: dict[str, Any] = st.lz.get("wetter_tage", {}).get(tag.isoformat(), {})
    return tag_werte


def _wetter(st: Steuerung, jetzt: datetime) -> WetterWerte:
    o = st.entry.options
    heute = jetzt.date()
    zustand = None
    aussen = _zahl(st.hass.states.get(o[CONF_TEMP_SENSOR])) if o.get(CONF_TEMP_SENSOR) else None
    if o.get(CONF_WETTER) and (w := st.hass.states.get(o[CONF_WETTER])):
        zustand = w.state if w.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN) else None
        if aussen is None and isinstance(w.attributes.get(ATTR_TEMPERATURE), (int, float)):
            aussen = float(w.attributes[ATTR_TEMPERATURE])
    # Außenwert fehlt ganz: der letzte gemessene gilt bis 6 h (logik/regelung, Szenarien), sonst „unbekannt“
    if aussen is not None:
        st.lz["aussen_zuletzt"] = [jetzt.isoformat(timespec="seconds"), aussen]
    elif (z := st.lz.get("aussen_zuletzt")) and (t := dt_util.parse_datetime(str(z[0]))) is not None:
        aussen = regel_logik.letzter_wert(None, (t, float(z[1])), jetzt, regel_logik.AUSSEN_HALTEN_MIN)
    tag = st._wetter_tag(heute)
    regen = _zahl(st.hass.states.get(o[CONF_REGEN_SENSOR])) if o.get(CONF_REGEN_SENSOR) else None
    if regen is not None:
        # gemessen (Wetterstation): für „nach Regen früher“ am nächsten Tag merken
        gemerkt = st.lz.setdefault("wetter_tage", {}).setdefault(heute.isoformat(), {})
        if gemerkt.get("regen") is None or regen > gemerkt["regen"]:
            gemerkt["regen"] = regen
    else:
        regen = tag.get("regen")
    aussen_max = tag.get("max")
    if aussen is not None and o.get(CONF_TEMP_SENSOR) and _zahl(st.hass.states.get(o[CONF_TEMP_SENSOR])) is not None:
        # gemessener Tageshöchstwert (Szenarien): ein warmer Mittag bleibt bis Mitternacht „zu warm“
        gemerkt = st.lz.setdefault("wetter_tage", {}).setdefault(heute.isoformat(), {})
        if gemerkt.get("max_mess") is None or aussen > gemerkt["max_mess"]:
            gemerkt["max_mess"] = aussen
    werte = [x for x in (aussen_max, st._wetter_tag(heute).get("max_mess"), aussen) if x is not None]
    aussen_max = max(werte) if werte else None
    # Früh-Prognose: der nächste Morgen (vor 8 Uhr heute, danach morgen) – wie 0.6
    frueh = st._wetter_tag(heute if jetzt.hour < 8 else heute + timedelta(days=1)).get("frueh")
    return WetterWerte(
        aussen=aussen, aussen_max=aussen_max, frueh=frueh,
        regen_vortag=st._wetter_tag(heute - timedelta(days=1)).get("regen"),
        regen_heute=regen, zustand=zustand,
    )


def wetter_tag_plan(st: Steuerung, tag: date) -> WetterTag:
    """Wetter eines Tages (Morgen-Tiefstwert, Regen am Vortag und heute) für die Pläne der Funktionen."""
    heute = st._wetter_tag(tag)
    return WetterTag(
        frueh_min_temp=heute.get("frueh"),
        regen_vortag_mm=st._wetter_tag(tag - timedelta(days=1)).get("regen"),
        regen_heute_mm=heute.get("regen"),
    )


def _antwort_liste(antwort: ServiceResponse, entity_id: str, key: str) -> list[dict[str, Any]]:
    """Liste `key` einer Entität aus der Antwort eines Dienstes (`weather.get_forecasts`, `calendar.get_events`)."""
    je_entitaet = (antwort or {}).get(entity_id)
    liste = je_entitaet.get(key) if isinstance(je_entitaet, dict) else None
    return [x for x in liste if isinstance(x, dict)] if isinstance(liste, list) else []


def _prognose_je_tag(liste: list[dict[str, Any]], art: str) -> dict[date, dict[str, float | None]]:
    """Je Tag: tiefster Wert 4–8 Uhr („frueh“), Tageshöchstwert („max“), Niederschlag („regen“)."""
    tage: dict[date, dict[str, float | None]] = {}
    for eintrag in liste:
        zeit = dt_util.parse_datetime(str(eintrag.get("datetime", "")))
        if zeit is None:
            continue
        zeit = dt_util.as_local(zeit)
        tag = tage.setdefault(zeit.date(), {"frueh": None, "max": None, "regen": None})
        temp = eintrag.get("temperature")
        regen = eintrag.get("precipitation")
        if art == "hourly":
            if temp is not None:
                tag["max"] = temp if tag["max"] is None else max(tag["max"], temp)
                if 4 <= zeit.hour <= 8:
                    tag["frueh"] = temp if tag["frueh"] is None else min(tag["frueh"], temp)
            if regen is not None:
                tag["regen"] = (tag["regen"] or 0.0) + float(regen)
        else:
            tag["max"] = temp
            tag["frueh"] = eintrag.get("templow")
            tag["regen"] = float(regen) if regen is not None else None
    return tage


def _prognose_auswerten(liste: list[dict[str, Any]], art: str, jetzt: datetime) -> dict[str, float | None]:
    """Wie 0.6: Tageshöchstwert, Früh-Prognose (nächster Morgen) und Regen heute."""
    tage = _prognose_je_tag(liste, art)
    heute = jetzt.date()
    morgen = heute if (jetzt.hour < 8 and art == "hourly") else heute + timedelta(days=1)
    return {
        "max_heute": tage.get(heute, {}).get("max"),
        "frueh": tage.get(morgen, {}).get("frueh"),
        "regen_heute": tage.get(heute, {}).get("regen"),
    }
