"""Kern: Bereiche und Geräte aus den Unter-Einträgen lesen, Sensoren am Shelly finden (BSM-023)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.helpers import entity_registry as er

from ..const import (
    CONF_ART,
    CONF_BEREICH,
    CONF_ENERGIE,
    CONF_FUEHLER,
    CONF_LEISTUNG,
    CONF_ROLLE,
    CONF_SCHALTER,
    CONF_TYP,
    DOMAIN,
    SUB_BEREICH,
    SUB_GERAET,
)
from .typen import BereichInfo, GeraetInfo, KEIN_VERBRAUCH

if TYPE_CHECKING:
    from ..steuerung import Steuerung


def _einrichtung_lesen(st: Steuerung) -> None:
    registry = er.async_get(st.hass)
    for sub in st.entry.subentries.values():
        if sub.subentry_type == SUB_BEREICH:
            st.bereiche[sub.subentry_id] = BereichInfo(
                sub.subentry_id, sub.title, sub.data[CONF_ART], sub.data.get(CONF_FUEHLER), len(st.bereiche)
            )
    for sub in st.entry.subentries.values():
        if sub.subentry_type != SUB_GERAET or sub.data[CONF_BEREICH] not in st.bereiche:
            continue
        schalter = sub.data[CONF_SCHALTER]
        st.geraete[sub.subentry_id] = GeraetInfo(
            id=sub.subentry_id,
            name=sub.title,
            bereich=sub.data[CONF_BEREICH],
            schalter=schalter,
            rolle=sub.data[CONF_ROLLE],
            typ=sub.data[CONF_TYP],
            leistung=sub.data.get(CONF_LEISTUNG) or _sensor_am_geraet(registry, schalter, "power"),
            energie=sub.data.get(CONF_ENERGIE) or _sensor_am_geraet(registry, schalter, "energy"),
        )


def _sensor_am_geraet(registry: er.EntityRegistry, schalter: str, device_class: str) -> str | None:
    """Leistungs- bzw. Energiesensor desselben Shelly finden.

    Eigene Sensoren der Baustelle (hängen am Shelly-Gerät) und die Einspeisung zählen nicht; bei Mehrkanal gleicher
    Namensanfang; bleiben mehrere (z. B. „Energie“ und „Energieverbrauch“), der mit dem kürzesten Namen – der
    Hauptsensor. Vorher gab es bei mehreren gar keinen, der Container zählte dann nichts (FE-0003).
    """
    eintrag = registry.async_get(schalter)
    if eintrag is None or eintrag.device_id is None:
        return None
    kandidaten = [
        x.entity_id
        for x in er.async_entries_for_device(registry, eintrag.device_id)
        if x.domain == "sensor" and x.platform != DOMAIN and not x.disabled
        and (x.device_class or x.original_device_class) == device_class and x.translation_key not in KEIN_VERBRAUCH
    ]
    if len(kandidaten) > 1:
        stamm = schalter.split(".", 1)[1]
        kandidaten = [k for k in kandidaten if k.split(".", 1)[1].startswith(stamm)]
    return min(kandidaten, key=lambda k: (len(k), k)) if kandidaten else None
