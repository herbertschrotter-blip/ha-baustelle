"""Zahlen: Regeln der Heizung und Pumpen, Strompreis, Solltemperatur je Container."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.components.number import NumberDeviceClass, NumberEntity, NumberMode
from homeassistant.const import EntityCategory, UnitOfPower, UnitOfTemperature, UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import BaustelleConfigEntry
from .const import ART_CONTAINER
from .entity import BaustelleEntity
from .steuerung import Steuerung

PARALLEL_UPDATES = 0

MM = "mm"
EUR_KWH = "€/kWh"


@dataclass(frozen=True)
class Zahl:
    key: str
    pfad: tuple[str, ...]
    minimum: float
    maximum: float
    schritt: float
    einheit: str | None
    klasse: NumberDeviceClass | None = None


HEIZUNG = [
    Zahl("kaelte_schwelle", ("regeln", "kaelte_schwelle"), -15, 15, 0.5, UnitOfTemperature.CELSIUS, NumberDeviceClass.TEMPERATURE),
    Zahl("kaelte_frueher_min", ("regeln", "kaelte_frueher_min"), 0, 180, 5, UnitOfTime.MINUTES),
    Zahl("trocknen_ab_mm", ("regeln", "trocknen_ab_mm"), 0, 30, 0.5, MM),
    Zahl("trocknen_laenger_min", ("regeln", "trocknen_laenger_min"), 0, 240, 15, UnitOfTime.MINUTES),
    Zahl("trocknen_frueher_min", ("regeln", "trocknen_frueher_min"), 0, 120, 5, UnitOfTime.MINUTES),
    Zahl("heizgrenze", ("regeln", "heizgrenze"), 5, 25, 0.5, UnitOfTemperature.CELSIUS, NumberDeviceClass.TEMPERATURE),
    Zahl("frost_ein", ("regeln", "frost_ein"), 0, 12, 0.5, UnitOfTemperature.CELSIUS, NumberDeviceClass.TEMPERATURE),
    Zahl("frost_aus", ("regeln", "frost_aus"), 2, 15, 0.5, UnitOfTemperature.CELSIUS, NumberDeviceClass.TEMPERATURE),
    Zahl("absenk_temp", ("regeln", "absenk_temp"), 5, 16, 0.5, UnitOfTemperature.CELSIUS, NumberDeviceClass.TEMPERATURE),
]
PUMPEN = [
    Zahl("offline_min", ("pumpen", "offline_min"), 1, 60, 1, UnitOfTime.MINUTES),
    Zahl("trocken_unter_w", ("pumpen", "trocken_unter_w"), 30, 3000, 10, UnitOfPower.WATT, NumberDeviceClass.POWER),
    Zahl("dauerlauf_h", ("pumpen", "dauerlauf_h"), 0.5, 48, 0.5, UnitOfTime.HOURS),
]
PREIS = Zahl("preis", ("preis",), 0, 2, 0.01, EUR_KWH)


async def async_setup_entry(
    hass: HomeAssistant, entry: BaustelleConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    st = entry.runtime_data
    zahlen = [PREIS] + (HEIZUNG if st.heizung else []) + (PUMPEN if st.pumpen else [])
    async_add_entities(EinstellungNumber(st, z) for z in zahlen)
    if not st.heizung:
        return
    for bid, info in st.bereiche.items():
        if info.art == ART_CONTAINER and info.fuehler:
            soll = Zahl("soll", ("bereiche", bid, "soll"), 5, 25, 0.5, UnitOfTemperature.CELSIUS, NumberDeviceClass.TEMPERATURE)
            async_add_entities([EinstellungNumber(st, soll, bereich_id=bid, kategorie=None)], config_subentry_id=bid)


class EinstellungNumber(BaustelleEntity, NumberEntity):
    """Stellt eine gespeicherte Zahl ein."""

    _attr_mode = NumberMode.BOX

    def __init__(
        self,
        steuerung: Steuerung,
        zahl: Zahl,
        *,
        bereich_id: str | None = None,
        kategorie: EntityCategory | None = EntityCategory.CONFIG,
    ) -> None:
        super().__init__(steuerung, zahl.key, bereich_id)
        self._pfad = zahl.pfad
        self._attr_native_min_value = zahl.minimum
        self._attr_native_max_value = zahl.maximum
        self._attr_native_step = zahl.schritt
        self._attr_native_unit_of_measurement = zahl.einheit
        self._attr_device_class = zahl.klasse
        self._attr_entity_category = kategorie

    @property
    def native_value(self) -> float:
        wert = self.steuerung.einstellungen.daten
        for teil in self._pfad:
            wert = wert[teil]
        return float(wert)

    async def async_set_native_value(self, value: float) -> None:
        self.steuerung.einstellung_setzen(self._pfad, value)
