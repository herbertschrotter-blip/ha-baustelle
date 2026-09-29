"""Sensoren: Status, nächste Schaltzeit, Grund je Container, Leistung, Wetter der Baustelle."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import EntityCategory, UnitOfPower, UnitOfPrecipitationDepth, UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import BaustelleConfigEntry
from .const import ART_CONTAINER
from .entity import BaustelleEntity
from .logik.heizung import Grund
from .steuerung import Steuerung

PARALLEL_UPDATES = 0

STATUS = ["abgeschlossen", "nur_pumpen", "automatik_aus", "heizgrenze", "urlaub", "feiertag", "heizt", "bereit"]


@dataclass(frozen=True)
class Wert:
    key: str
    lesen: Callable[[Steuerung], float | None]
    einheit: str
    klasse: SensorDeviceClass


WETTER = [
    Wert("aussen", lambda st: st.daten.wetter.aussen, UnitOfTemperature.CELSIUS, SensorDeviceClass.TEMPERATURE),
    Wert("tageshoechst", lambda st: st.daten.wetter.aussen_max, UnitOfTemperature.CELSIUS, SensorDeviceClass.TEMPERATURE),
    Wert("frueh_prognose", lambda st: st.daten.wetter.frueh_prognose, UnitOfTemperature.CELSIUS, SensorDeviceClass.TEMPERATURE),
    Wert("regen", lambda st: st.daten.wetter.regen_24h, UnitOfPrecipitationDepth.MILLIMETERS, SensorDeviceClass.PRECIPITATION),
]


async def async_setup_entry(
    hass: HomeAssistant, entry: BaustelleConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    st = entry.runtime_data
    liste: list[SensorEntity] = [StatusSensor(st), LeistungSensor(st)]
    if st.heizung:
        liste += [NaechsteSchaltzeitSensor(st), *(WetterSensor(st, w) for w in WETTER)]
    async_add_entities(liste)
    for bid, info in st.bereiche.items():
        bereich: list[SensorEntity] = [LeistungSensor(st, bid)]
        if st.heizung and info.art == ART_CONTAINER:
            bereich.append(GrundSensor(st, bid))
        async_add_entities(bereich, config_subentry_id=bid)


class StatusSensor(BaustelleEntity, SensorEntity):
    """Was die Baustelle gerade tut."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = STATUS

    def __init__(self, steuerung: Steuerung) -> None:
        super().__init__(steuerung, "status")

    @property
    def native_value(self) -> str:
        return self.steuerung.daten.status


class NaechsteSchaltzeitSensor(BaustelleEntity, SensorEntity):
    """Nächste Ein- oder Ausschaltzeit heute."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, steuerung: Steuerung) -> None:
        super().__init__(steuerung, "naechste_schaltzeit")

    @property
    def native_value(self) -> datetime | None:
        return self.steuerung.daten.naechste


class GrundSensor(BaustelleEntity, SensorEntity):
    """Warum die Heizung eines Containers gerade ein oder aus ist."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = [g.value for g in Grund]

    def __init__(self, steuerung: Steuerung, bereich_id: str) -> None:
        super().__init__(steuerung, "grund", bereich_id)

    @property
    def native_value(self) -> str | None:
        grund = self.steuerung.daten.grund.get(self.bereich_id or "")
        return grund.value if grund else None


class LeistungSensor(BaustelleEntity, SensorEntity):
    """Leistung aller Shellys der Baustelle bzw. eines Bereichs."""

    _attr_device_class = SensorDeviceClass.POWER
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfPower.WATT
    _attr_suggested_display_precision = 0

    def __init__(self, steuerung: Steuerung, bereich_id: str | None = None) -> None:
        super().__init__(steuerung, "leistung", bereich_id)

    @property
    def native_value(self) -> float | None:
        werte = self.steuerung.daten.leistung
        if self.bereich_id is not None:
            return werte.get(self.bereich_id)
        bekannt = [w for w in werte.values() if w is not None]
        return sum(bekannt) if bekannt else None


class WetterSensor(BaustelleEntity, SensorEntity):
    """Wetterwert, mit dem die Regeln gerade rechnen."""

    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, steuerung: Steuerung, wert: Wert) -> None:
        super().__init__(steuerung, wert.key)
        self._lesen = wert.lesen
        self._attr_native_unit_of_measurement = wert.einheit
        self._attr_device_class = wert.klasse

    @property
    def native_value(self) -> float | None:
        return self._lesen(self.steuerung)
