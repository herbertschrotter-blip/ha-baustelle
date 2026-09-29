"""Zeiten: Ein- und Ausschaltzeit je Wochentag."""

from __future__ import annotations

from datetime import time

from homeassistant.components.time import TimeEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import BaustelleConfigEntry
from .const import WOCHENTAGE
from .entity import BaustelleEntity
from .steuerung import Steuerung

PARALLEL_UPDATES = 0


async def async_setup_entry(
    hass: HomeAssistant, entry: BaustelleConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    st = entry.runtime_data
    if not st.heizung:
        return
    async_add_entities(PlanZeit(st, tag, feld) for tag in WOCHENTAGE for feld in ("ein", "aus"))


class PlanZeit(BaustelleEntity, TimeEntity):
    """Ein- oder Ausschaltzeit eines Wochentags."""

    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, steuerung: Steuerung, tag: str, feld: str) -> None:
        super().__init__(steuerung, f"{tag}_{feld}")
        self._tag = tag
        self._feld = feld

    @property
    def native_value(self) -> time:
        return time.fromisoformat(self.steuerung.einstellungen.daten["plan"][self._tag][self._feld])

    async def async_set_value(self, value: time) -> None:
        self.steuerung.einstellung_setzen(("plan", self._tag, self._feld), value.strftime("%H:%M"))
