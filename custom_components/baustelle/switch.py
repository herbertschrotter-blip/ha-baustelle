"""Schalter: Automatik der Baustelle, Wochentage, Regeln, Kleidung trocknen je Container."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import BaustelleConfigEntry
from .const import ART_CONTAINER, WOCHENTAGE
from .entity import BaustelleEntity
from .steuerung import Steuerung

PARALLEL_UPDATES = 0


async def async_setup_entry(
    hass: HomeAssistant, entry: BaustelleConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    st = entry.runtime_data
    if not st.heizung:
        return
    async_add_entities(
        [
            EinstellungSwitch(st, "automatik", ("automatik",), kategorie=None),
            *(EinstellungSwitch(st, f"{tag}_aktiv", ("plan", tag, "aktiv")) for tag in WOCHENTAGE),
            EinstellungSwitch(st, "heizgrenze_aktiv", ("regeln", "heizgrenze_aktiv")),
            EinstellungSwitch(st, "frost_aktiv", ("regeln", "frost_aktiv")),
        ]
    )
    for bid, info in st.bereiche.items():
        if info.art == ART_CONTAINER:
            async_add_entities(
                [EinstellungSwitch(st, "kleidung_trocknen", ("bereiche", bid, "trocknen"), bereich_id=bid)],
                config_subentry_id=bid,
            )


class EinstellungSwitch(BaustelleEntity, SwitchEntity):
    """Schaltet eine gespeicherte Einstellung."""

    def __init__(
        self,
        steuerung: Steuerung,
        key: str,
        pfad: tuple[str, ...],
        *,
        bereich_id: str | None = None,
        kategorie: EntityCategory | None = EntityCategory.CONFIG,
    ) -> None:
        super().__init__(steuerung, key, bereich_id)
        self._pfad = pfad
        self._attr_entity_category = kategorie

    @property
    def is_on(self) -> bool:
        wert: Any = self.steuerung.einstellungen.daten
        for teil in self._pfad:
            wert = wert[teil]
        return bool(wert)

    async def async_turn_on(self, **kwargs: Any) -> None:
        self.steuerung.einstellung_setzen(self._pfad, True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        self.steuerung.einstellung_setzen(self._pfad, False)
