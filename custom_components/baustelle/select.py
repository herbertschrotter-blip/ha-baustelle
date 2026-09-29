"""Auswahl: Modus je Container, Grundlage der Heizgrenze, Verhalten im Urlaub."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import BaustelleConfigEntry
from .const import ART_CONTAINER
from .entity import BaustelleEntity
from .logik.heizung import Basis, Modus, UrlaubModus
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
            EinstellungSelect(st, "heizgrenze_basis", ("regeln", "heizgrenze_basis"), [b.value for b in Basis]),
            EinstellungSelect(st, "urlaub_modus", ("regeln", "urlaub_modus"), [u.value for u in UrlaubModus]),
        ]
    )
    for bid, info in st.bereiche.items():
        if info.art != ART_CONTAINER:
            continue
        modi = [m.value for m in Modus if info.fuehler or m is not Modus.THERMOSTAT]
        async_add_entities(
            [EinstellungSelect(st, "modus", ("bereiche", bid, "modus"), modi, bereich_id=bid, kategorie=None)],
            config_subentry_id=bid,
        )


class EinstellungSelect(BaustelleEntity, SelectEntity):
    """Wählt eine gespeicherte Einstellung."""

    def __init__(
        self,
        steuerung: Steuerung,
        key: str,
        pfad: tuple[str, ...],
        optionen: list[str],
        *,
        bereich_id: str | None = None,
        kategorie: EntityCategory | None = EntityCategory.CONFIG,
    ) -> None:
        super().__init__(steuerung, key, bereich_id)
        self._pfad = pfad
        self._attr_options = optionen
        self._attr_entity_category = kategorie

    @property
    def current_option(self) -> str | None:
        wert = self.steuerung.einstellungen.daten
        for teil in self._pfad:
            wert = wert[teil]
        return wert if wert in self.options else None

    async def async_select_option(self, option: str) -> None:
        self.steuerung.einstellung_setzen(self._pfad, option)
