"""Sensoren: Status, nächste Schaltzeit, Grund je Container, Leistung, Wetter der Baustelle."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import (
    EntityCategory,
    UnitOfEnergy,
    UnitOfPower,
    UnitOfPrecipitationDepth,
    UnitOfTemperature,
    UnitOfTime,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import BaustelleConfigEntry
from .const import ART_CONTAINER, HEIZROLLEN, ROLLE_PUMPE, TYPEN
from .entity import BaustelleEntity
from .logik.regelung import SollGrund
from .steuerung import Steuerung

PARALLEL_UPDATES = 0

STATUS = ["abgeschlossen", "nur_pumpen", "automatik_aus", "heizgrenze", "urlaub", "feiertag", "frei", "heizt", "bereit"]


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
    liste += [ZaehlerSensor(st, z) for z in ZAEHLER_BAUSTELLE if st.heizung or not z.nur_heizung]
    if st.heizung:
        for typ in TYPEN:
            liste += [ZaehlerSensor(st, z) for z in _typ_zaehler(typ)]
    async_add_entities(liste)
    for bid, info in st.bereiche.items():
        bereich: list[SensorEntity] = [LeistungSensor(st, bid)]
        bereich += [ZaehlerSensor(st, z, bereich_id=bid) for z in _bereich_zaehler(bid)]
        if st.heizung and info.art == ART_CONTAINER:
            bereich += [GrundSensor(st, bid), ZaehlerSensor(st, _heizzeit(bid), bereich_id=bid)]
        async_add_entities(bereich, config_subentry_id=bid)
    for gid, g in st.geraete.items():
        geraet = [ZaehlerSensor(st, z, geraet_id=gid) for z in _geraet_zaehler(gid, g.rolle)]
        if geraet:
            async_add_entities(geraet, config_subentry_id=gid)

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
    """Nächster Schaltpunkt der Baustelle (Ende der Heizzeit bzw. nächster Start)."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, steuerung: Steuerung) -> None:
        super().__init__(steuerung, "naechste_schaltzeit")

    @property
    def native_value(self) -> datetime | None:
        return self.steuerung.daten.naechste


class GrundSensor(BaustelleEntity, SensorEntity):
    """Warum die Heizung eines Containers gerade ein oder aus ist."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = [g.value for g in SollGrund]

    def __init__(self, steuerung: Steuerung, bereich_id: str) -> None:
        super().__init__(steuerung, "grund", bereich_id)

    @property
    def native_value(self) -> str | None:
        grund = self.steuerung.daten.grund.get(self.bereich_id or "")
        return grund if grund in self._attr_options else None


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


# --------------------------------------------------------------------- Zähler (Stufe 4)
@dataclass(frozen=True)
class Zaehler:
    key: str
    lesen: Callable[[Steuerung], float | None]
    einheit: str | None = UnitOfEnergy.KILO_WATT_HOUR
    klasse: SensorDeviceClass | None = SensorDeviceClass.ENERGY
    art: SensorStateClass | None = SensorStateClass.TOTAL_INCREASING
    stellen: int = 2
    geld: bool = False
    nur_heizung: bool = False
    diagnose: bool = False


GELD = {"einheit": None, "klasse": SensorDeviceClass.MONETARY, "art": SensorStateClass.TOTAL, "geld": True}
STUNDEN = {"einheit": UnitOfTime.HOURS, "klasse": SensorDeviceClass.DURATION, "stellen": 1}
MITTEL = {"einheit": UnitOfPower.WATT, "klasse": SensorDeviceClass.POWER, "art": SensorStateClass.MEASUREMENT, "stellen": 0, "diagnose": True}
PROGNOSE = {"art": None, "stellen": 0, "nur_heizung": True}


def _preis(st: Steuerung) -> float:
    return float(st.einstellungen.daten["preis"])


def _mal_preis(wert: float | None, st: Steuerung) -> float | None:
    return None if wert is None else wert * _preis(st)


ZAEHLER_BAUSTELLE = [
    Zaehler("energie", lambda st: st.zaehler.get("energie", 0.0)),
    Zaehler("kosten", lambda st: st.zaehler.get("kosten", 0.0), **GELD),
    Zaehler("energie_ohne_automatik", lambda st: st.zaehler.get("ohne", 0.0), nur_heizung=True),
    Zaehler("ersparnis", lambda st: st.ersparnis_kwh() * _preis(st), **{**GELD, "nur_heizung": True}),
    Zaehler("prognose_heizperiode", lambda st: st.hochrechnung_heizperiode("energie_heizen"), **PROGNOSE),
    Zaehler(
        "prognose_heizperiode_kosten",
        lambda st: _mal_preis(st.hochrechnung_heizperiode("energie_heizen"), st),
        **{**GELD, "art": None, "nur_heizung": True},
    ),
    Zaehler("prognose_heizperiode_ohne", lambda st: st.hochrechnung_heizperiode("ohne"), **PROGNOSE),
]


def _typ_zaehler(typ: str) -> list[Zaehler]:
    return [
        Zaehler(f"energie_{typ}", lambda st: st.zaehler.get(f"energie_typ:{typ}", 0.0)),
        Zaehler(f"heizzeit_{typ}", lambda st: st.zaehler.get(f"heizzeit_typ:{typ}", 0.0), **STUNDEN),
        Zaehler(f"mittel_{typ}", lambda st: st.mittel_typ(typ), **{**MITTEL, "diagnose": False}),
    ]


def _heizzeit(bid: str) -> Zaehler:
    return Zaehler("heizzeit", lambda st: st.zaehler.get(f"heizzeit:{bid}", 0.0), **STUNDEN)


def _geraet_zaehler(gid: str, rolle: str) -> list[Zaehler]:
    if rolle in HEIZROLLEN:
        return [Zaehler("mittel_im_betrieb", lambda st: st.zaehler.get(f"mittel:{gid}"), **MITTEL)]
    if rolle == ROLLE_PUMPE:
        return [
            Zaehler("pumpzeit", lambda st: st.zaehler.get(f"pumpzeit:{gid}", 0.0), **STUNDEN),
            Zaehler("pumpzyklen", lambda st: st.zaehler.get(f"zyklen:{gid}", 0), einheit=None, klasse=None, stellen=0),
        ]
    return []


def _bereich_zaehler(bid: str) -> list[Zaehler]:
    return [
        Zaehler("energie", lambda st: st.zaehler.get(f"energie:{bid}", 0.0)),
        Zaehler("kosten", lambda st: st.zaehler.get(f"kosten:{bid}", 0.0), **GELD),
    ]


class ZaehlerSensor(BaustelleEntity, SensorEntity):
    """Zähler und Auswertungen: bleiben dauerhaft, HA führt dazu die Langzeitstatistik."""

    def __init__(
        self, steuerung: Steuerung, zaehler: Zaehler, *, bereich_id: str | None = None, geraet_id: str | None = None
    ) -> None:
        super().__init__(steuerung, zaehler.key, bereich_id, geraet_id)
        self._lesen = zaehler.lesen
        self._attr_device_class = zaehler.klasse
        self._attr_state_class = zaehler.art
        self._attr_suggested_display_precision = zaehler.stellen
        self._attr_native_unit_of_measurement = steuerung.hass.config.currency if zaehler.geld else zaehler.einheit
        if zaehler.diagnose:
            self._attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> float | None:
        wert = self._lesen(self.steuerung)
        return None if wert is None else round(float(wert), 4)
