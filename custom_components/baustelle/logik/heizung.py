"""Heizungsregeln einer Baustelle – reine Fachlogik ohne Home-Assistant-Code.

Zeiten sind Minuten seit Mitternacht (0–1440). Temperaturen in °C, Regen in mm.
Die Reihenfolge der Regeln in `entscheide` ist fachlich festgelegt (Abnahme Mockup v4, 29.09.2026):
Automatik aus → Frostschutz → Hand → Modus aus → Heizgrenze → Urlaub/Feiertag → Zeitfenster → Thermostat/Zeitplan.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Modus(StrEnum):
    """Betriebsart eines Containers."""

    ZEITPLAN = "zeitplan"
    THERMOSTAT = "thermostat"
    HAND = "hand"
    AUS = "aus"


class UrlaubModus(StrEnum):
    """Verhalten der Heizung im Urlaub und an Feiertagen."""

    FROST = "frost"
    ABSENKEN = "absenken"
    AUS = "aus"


class Basis(StrEnum):
    """Grundlage der Heizgrenze."""

    JETZT = "jetzt"
    TAGESHOECHST = "tageshoechst"


class Grund(StrEnum):
    """Warum ein Heizgerät ein- oder ausgeschaltet sein soll."""

    AUTOMATIK_AUS = "automatik_aus"
    FROSTSCHUTZ = "frostschutz"
    HAND = "hand"
    MODUS_AUS = "modus_aus"
    HEIZGRENZE = "heizgrenze"
    URLAUB = "urlaub"
    FEIERTAG = "feiertag"
    ABSENKUNG = "absenkung"
    AUSSERHALB = "ausserhalb"
    ZEITPLAN = "zeitplan"
    KAELTE_FRUEHER = "kaelte_frueher"
    KLEIDUNG_TROCKNEN = "kleidung_trocknen"
    THERMOSTAT_HEIZT = "thermostat_heizt"
    THERMOSTAT_ERREICHT = "thermostat_erreicht"


@dataclass(frozen=True)
class Tagesplan:
    """Ein- und Ausschaltzeit eines Wochentags."""

    ein: int
    aus: int
    aktiv: bool = True


@dataclass(frozen=True)
class Regeln:
    """Einstellungen einer Baustelle für die Heizung."""

    kaelte_schwelle: float = 3.0
    kaelte_frueher_min: int = 30
    trocknen_ab_mm: float = 2.0
    trocknen_laenger_min: int = 60
    trocknen_frueher_min: int = 30
    heizgrenze_aktiv: bool = True
    heizgrenze: float = 15.0
    heizgrenze_basis: Basis = Basis.JETZT
    frost_aktiv: bool = True
    frost_ein: float = 5.0
    frost_aus: float = 8.0
    urlaub_modus: UrlaubModus = UrlaubModus.FROST
    absenk_temp: float = 10.0
    toleranz: float = 0.3


@dataclass(frozen=True)
class Wetter:
    """Wetter am Ort der Baustelle; fehlende Werte sind None."""

    aussen: float | None = None
    aussen_max: float | None = None
    frueh_prognose: float | None = None
    regen_24h: float | None = None


@dataclass(frozen=True)
class Lage:
    """Alles, was für eine Entscheidung zum Zeitpunkt `minute` gilt."""

    minute: int
    plan: Tagesplan
    wetter: Wetter
    automatik: bool = True
    feiertag: bool = False
    urlaub: bool = False


@dataclass(frozen=True)
class Bereich:
    """Ein Container aus Sicht der Heizung."""

    modus: Modus = Modus.ZEITPLAN
    soll: float = 18.0
    trocknen: bool = False
    temperatur: float | None = None


@dataclass(frozen=True)
class Fenster:
    """Heizzeit eines Tages nach allen Anpassungen."""

    ein: int
    aus: int
    frueher_min: int
    laenger_min: int


@dataclass(frozen=True)
class Entscheidung:
    """Soll-Zustand eines Heizgeräts. `ein` ist None, wenn nicht geschaltet werden soll."""

    ein: bool | None
    grund: Grund
    frost: bool = False


def kaelte_aktiv(regeln: Regeln, wetter: Wetter) -> bool:
    """Früh-Prognose unter der Schwelle: alle Container starten früher."""
    return wetter.frueh_prognose is not None and wetter.frueh_prognose < regeln.kaelte_schwelle


def regen_aktiv(regeln: Regeln, wetter: Wetter) -> bool:
    """Genug Regen in 24 h: Container mit „Kleidung trocknen“ heizen länger und früher."""
    return wetter.regen_24h is not None and wetter.regen_24h >= regeln.trocknen_ab_mm


def zu_warm(regeln: Regeln, wetter: Wetter) -> bool:
    """Heizgrenze: laut Wetter so warm, dass gar nicht geheizt wird."""
    if not regeln.heizgrenze_aktiv:
        return False
    wert = wetter.aussen_max if regeln.heizgrenze_basis is Basis.TAGESHOECHST else wetter.aussen
    return wert is not None and wert > regeln.heizgrenze


def pause(lage: Lage) -> Grund | None:
    """Urlaub geht vor Feiertag."""
    if lage.urlaub:
        return Grund.URLAUB
    if lage.feiertag:
        return Grund.FEIERTAG
    return None


def fenster(lage: Lage, regeln: Regeln, trocknen: bool) -> Fenster | None:
    """Heizzeit des Tages für einen Container; None, wenn heute nicht geheizt wird."""
    if not lage.plan.aktiv or pause(lage) is not None:
        return None
    trocknet = trocknen and regen_aktiv(regeln, lage.wetter)
    frueher = (regeln.kaelte_frueher_min if kaelte_aktiv(regeln, lage.wetter) else 0) + (
        regeln.trocknen_frueher_min if trocknet else 0
    )
    laenger = regeln.trocknen_laenger_min if trocknet else 0
    return Fenster(
        ein=max(0, lage.plan.ein - frueher),
        aus=min(1440, lage.plan.aus + laenger),
        frueher_min=frueher,
        laenger_min=laenger,
    )


def _frost(bereich: Bereich, regeln: Regeln, frost_vorher: bool) -> bool:
    """Frostschutz mit Schaltabstand: ein unter `frost_ein`, aus erst über `frost_aus`."""
    if not regeln.frost_aktiv or bereich.temperatur is None:
        return False
    if frost_vorher:
        return bereich.temperatur < regeln.frost_aus
    return bereich.temperatur < regeln.frost_ein


def _thermostat(temperatur: float, soll: float, toleranz: float, war_ein: bool) -> bool:
    """Wie der Helfer „Generischer Thermostat“: ein ab soll−toleranz, aus ab soll+toleranz."""
    if war_ein:
        return temperatur < soll + toleranz
    return temperatur <= soll - toleranz


def entscheide(
    bereich: Bereich,
    lage: Lage,
    regeln: Regeln,
    *,
    war_ein: bool = False,
    frost_vorher: bool = False,
    frostschutz_gilt: bool = True,
) -> Entscheidung:
    """Soll-Zustand eines Heizgeräts in einem Container.

    `frostschutz_gilt` ist False für Geräte, die nicht heizen (Bautrockner).
    """
    if not lage.automatik:
        return Entscheidung(None, Grund.AUTOMATIK_AUS)

    frost = frostschutz_gilt and _frost(bereich, regeln, frost_vorher)
    if frost:
        return Entscheidung(True, Grund.FROSTSCHUTZ, frost=True)
    if bereich.modus is Modus.HAND:
        return Entscheidung(None, Grund.HAND)
    if bereich.modus is Modus.AUS:
        return Entscheidung(False, Grund.MODUS_AUS)
    if zu_warm(regeln, lage.wetter):
        return Entscheidung(False, Grund.HEIZGRENZE)

    grund_pause = pause(lage)
    if grund_pause is not None:
        if regeln.urlaub_modus is UrlaubModus.ABSENKEN and bereich.temperatur is not None:
            ein = _thermostat(bereich.temperatur, regeln.absenk_temp, regeln.toleranz, war_ein)
            return Entscheidung(ein, Grund.ABSENKUNG)
        return Entscheidung(False, grund_pause)

    f = fenster(lage, regeln, bereich.trocknen)
    if f is None or not f.ein <= lage.minute < f.aus:
        return Entscheidung(False, Grund.AUSSERHALB)

    if lage.minute >= lage.plan.aus:
        grund = Grund.KLEIDUNG_TROCKNEN
    elif lage.minute < lage.plan.ein:
        trocknet = bereich.trocknen and regen_aktiv(regeln, lage.wetter)
        vor_kaelte = lage.plan.ein - (regeln.kaelte_frueher_min if kaelte_aktiv(regeln, lage.wetter) else 0)
        grund = Grund.KLEIDUNG_TROCKNEN if trocknet and lage.minute < vor_kaelte else Grund.KAELTE_FRUEHER
    else:
        grund = Grund.ZEITPLAN

    if bereich.modus is Modus.THERMOSTAT and bereich.temperatur is not None:
        ein = _thermostat(bereich.temperatur, bereich.soll, regeln.toleranz, war_ein)
        return Entscheidung(ein, Grund.THERMOSTAT_HEIZT if ein else Grund.THERMOSTAT_ERREICHT)
    return Entscheidung(True, grund)


def naechste_schaltzeit(lage: Lage, regeln: Regeln, bereiche: list[Bereich]) -> tuple[int, bool] | None:
    """Nächste Schaltzeit heute über alle Container (Minute, einschalten?); None, wenn keine mehr."""
    if not lage.automatik or zu_warm(regeln, lage.wetter):
        return None
    fenster_liste = [
        f for b in bereiche if b.modus in (Modus.ZEITPLAN, Modus.THERMOSTAT) and (f := fenster(lage, regeln, b.trocknen))
    ]
    if not fenster_liste:
        return None
    ein = min(f.ein for f in fenster_liste)
    aus = max(f.aus for f in fenster_liste)
    if lage.minute < ein:
        return ein, True
    if lage.minute < aus:
        return aus, False
    return None
