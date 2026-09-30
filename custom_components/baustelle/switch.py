"""Schalter: nur noch die Automatik der Baustelle (alle anderen Einstellungen gibt es ab 0.7 nur auf der Seite)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import BaustelleConfigEntry
from .entity import BaustelleEntity
from .steuerung import Steuerung

PARALLEL_UPDATES = 0


async def async_setup_entry(
    hass: HomeAssistant, entry: BaustelleConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    st = entry.runtime_data
    if st.automatik_moeglich:
        async_add_entities([AutomatikSwitch(st)])


class AutomatikSwitch(BaustelleEntity, SwitchEntity):
    """Automatik der Baustelle: nur eingeschaltet schaltet die Integration Shellys."""

    def __init__(self, steuerung: Steuerung) -> None:
        super().__init__(steuerung, "automatik")

    @property
    def is_on(self) -> bool:
        return bool(self.steuerung.e["automatik"])

    async def async_turn_on(self, **kwargs: Any) -> None:
        self.steuerung.einstellung_setzen(("automatik",), True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        self.steuerung.einstellung_setzen(("automatik",), False)
