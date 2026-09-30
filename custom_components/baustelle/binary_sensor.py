"""Binärsensoren: Baustelle erreichbar, Problem je Gerät, Pumpe läuft."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import BaustelleConfigEntry
from .const import ROLLE_PUMPE
from .entity import BaustelleEntity
from .funktionen.pumpen import Pumpen
from .steuerung import Steuerung

PARALLEL_UPDATES = 0


async def async_setup_entry(
    hass: HomeAssistant, entry: BaustelleConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    st = entry.runtime_data
    async_add_entities([ErreichbarSensor(st)])
    for gid, g in st.geraete.items():
        liste: list[BinarySensorEntity] = [ProblemSensor(st, gid)]
        if g.rolle == ROLLE_PUMPE:
            liste.append(PumpeLaeuftSensor(st, gid))
        async_add_entities(liste, config_subentry_id=gid)


class ErreichbarSensor(BaustelleEntity, BinarySensorEntity):
    """Aus: kein Gerät der Baustelle antwortet (Stromausfall oder Internet weg)."""

    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, steuerung: Steuerung) -> None:
        super().__init__(steuerung, "erreichbar")

    @property
    def is_on(self) -> bool | None:
        return self.steuerung.daten.erreichbar


class ProblemSensor(BaustelleEntity, BinarySensorEntity):
    """Problem eines Geräts: offline, Trockenlauf, Dauerlauf, zieht keinen Strom."""

    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, steuerung: Steuerung, geraet_id: str) -> None:
        super().__init__(steuerung, "problem", geraet_id=geraet_id)

    @property
    def is_on(self) -> bool:
        return bool(self.steuerung.daten.probleme.get(self.geraet_id or ""))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"probleme": self.steuerung.daten.probleme.get(self.geraet_id or "", [])}


class PumpeLaeuftSensor(BaustelleEntity, BinarySensorEntity):
    """Die Pumpe läuft (Leistung über der Laufschwelle)."""

    _attr_device_class = BinarySensorDeviceClass.RUNNING

    def __init__(self, steuerung: Steuerung, geraet_id: str) -> None:
        super().__init__(steuerung, "pumpe_laeuft", geraet_id=geraet_id)

    @property
    def is_on(self) -> bool | None:
        return Pumpen.von(self.steuerung).pumpe_laeuft.get(self.geraet_id or "")
