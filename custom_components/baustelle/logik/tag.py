"""Tagessummen aus Minutenwerten (docs/bauplan-datenbank.md §2.4, BSM-009) – ohne HA-Code.

Nach denselben Regeln, nach denen die Integration ihre Zähler führt (`funktionen/heizung.zaehlen_*`):

- **Energie** = Summe der Minuten; **Kosten** mit dem Preis, der an dem Tag galt.
- **Heizzeit** eines Geräts = Zeit eingeschaltet; eines Containers = Zeit, in der irgendein Gerät an war.
- **Tatsächlich geheizt** (AN-0011): ein Heizkörper zieht mehr als `zieht_w` (ohne Messung: wie geschaltet).
- **Heiztag**: an dem Tag wurde in einem Container tatsächlich geheizt.
- **Gradstunden**: (innen − außen) × Zeit, nur wenn innen wärmer (`logik/zaehlen.gradstunden`).
- **Zyklen**: Einschaltungen – aus den Minuten: jeder Lauf von Minuten mit „an“ ist eine; eine nur teilweise
  eingeschaltete Minute mitten in einem Lauf heißt „kurz aus und wieder an“ und zählt eine dazu.

„Ohne Automatik“ bleibt hier leer: die Integration rechnet sie mit einem gleitenden Mittel der Leistung im Betrieb;
eine zweite Regel daneben gäbe es sonst zweimal (kommt mit Phase 5, wenn die Auswertung umzieht).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime

from .zaehlen import gradstunden


@dataclass(frozen=True)
class GeraetZeile:
    zeit: datetime
    dauer_s: int
    sekunden_ein: int | None
    leistung_w_max: float | None
    energie_wh: float | None


@dataclass(frozen=True)
class BereichZeile:
    zeit: datetime
    dauer_s: int
    temperatur: float | None


@dataclass(frozen=True)
class GeraetTag:
    kwh: float
    heizzeit_min: float
    strom_min: float
    zyklen: int


@dataclass(frozen=True)
class BereichTag:
    kwh: float
    heizzeit_min: float
    strom_min: float
    gradh: float
    temp_min: float | None
    temp_mittel: float | None
    temp_max: float | None
    aussen_mittel: float | None

    @property
    def heiztag(self) -> bool:
        return self.strom_min > 0


def _zieht(z: GeraetZeile, zieht_w: float) -> bool:
    return z.leistung_w_max is None or z.leistung_w_max > zieht_w


def geraet_tag(zeilen: Sequence[GeraetZeile], zieht_w: float) -> GeraetTag:
    """Ein Gerät, ein Tag (Zeilen zeitlich sortiert)."""
    kwh = sum(z.energie_wh or 0.0 for z in zeilen) / 1000
    ein = sum(z.sekunden_ein or 0 for z in zeilen) / 60
    strom = sum(z.sekunden_ein or 0 for z in zeilen if _zieht(z, zieht_w)) / 60
    zyklen = 0
    for i, z in enumerate(zeilen):
        if not z.sekunden_ein:
            continue
        vorher = i > 0 and bool(zeilen[i - 1].sekunden_ein)
        danach = i + 1 < len(zeilen) and bool(zeilen[i + 1].sekunden_ein)
        if not vorher:
            zyklen += 1                                   # Beginn eines Laufs
        elif danach and z.sekunden_ein < z.dauer_s:
            zyklen += 1                                   # mitten im Lauf kurz aus und wieder an
    return GeraetTag(round(kwh, 4), round(ein, 2), round(strom, 2), zyklen)


def _gewichtet(werte: Sequence[tuple[float | None, int]]) -> float | None:
    bekannt = [(w, d) for w, d in werte if w is not None and d > 0]
    gesamt = sum(d for _, d in bekannt)
    return sum(w * d for w, d in bekannt) / gesamt if gesamt else None


def bereich_tag(geraete: Mapping[str, Sequence[GeraetZeile]], heizer: set[str], temperaturen: Sequence[BereichZeile],
                aussen: Mapping[datetime, float | None], zieht_w: float) -> BereichTag:
    """Ein Container, ein Tag: Geräte (id → Zeilen), welche davon Heizkörper sind, Innen- und Außentemperatur je Minute."""
    kwh = sum(z.energie_wh or 0.0 for zeilen in geraete.values() for z in zeilen) / 1000
    heizt: dict[datetime, int] = {}
    strom: dict[datetime, int] = {}
    for gid, zeilen in geraete.items():
        for z in zeilen:
            s = z.sekunden_ein or 0
            heizt[z.zeit] = max(heizt.get(z.zeit, 0), s)   # irgendein Gerät an (Vereinigung je Minute, angenähert)
            if gid in heizer and _zieht(z, zieht_w):
                strom[z.zeit] = max(strom.get(z.zeit, 0), s)
    aussen_mittel = _gewichtet([(aussen.get(t.zeit), t.dauer_s) for t in temperaturen]) if temperaturen else None
    if aussen_mittel is None and aussen:
        bekannt = [w for w in aussen.values() if w is not None]
        aussen_mittel = sum(bekannt) / len(bekannt) if bekannt else None
    grad = sum(gradstunden(t.temperatur, aussen.get(t.zeit, aussen_mittel), t.dauer_s / 3600) for t in temperaturen)
    bekannt = [t.temperatur for t in temperaturen if t.temperatur is not None]
    return BereichTag(
        round(kwh, 4), round(sum(heizt.values()) / 60, 2), round(sum(strom.values()) / 60, 2), round(grad, 3),
        min(bekannt) if bekannt else None,
        None if (m := _gewichtet([(t.temperatur, t.dauer_s) for t in temperaturen])) is None else round(m, 2),
        max(bekannt) if bekannt else None,
        None if aussen_mittel is None else round(aussen_mittel, 2),
    )
