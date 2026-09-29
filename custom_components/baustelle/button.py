"""Knopf: Test-Meldung an die gewählten Empfänger."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import BaustelleConfigEntry
from .const import CONF_EMPFAENGER, DOMAIN
from .entity import BaustelleEntity
from .steuerung import Steuerung

PARALLEL_UPDATES = 0


async def async_setup_entry(
    hass: HomeAssistant, entry: BaustelleConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities([TestMeldungButton(entry.runtime_data)])


class TestMeldungButton(BaustelleEntity, ButtonEntity):
    """Schickt eine Test-Meldung, damit man sieht, ob sie am Handy ankommt."""

    def __init__(self, steuerung: Steuerung) -> None:
        super().__init__(steuerung, "test_meldung")

    async def async_press(self) -> None:
        if not self.steuerung.entry.options.get(CONF_EMPFAENGER):
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="keine_empfaenger")
        self.steuerung.melden("Test-Meldung: So kommen Warnungen der Baustelle bei dir an.")
