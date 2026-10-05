"""Programm für das Notprogramm in den Plugs – reine Fachlogik ohne Home-Assistant-Code (Bauplan 0.7 §9, BSM-017).

Das Skript im Plug (`shelly/notprogramm.js`) rechnet keine Fachregeln, es führt nur die Tabelle aus, die HA hier baut:
`bs_cfg` (Modus, Toleranz, Frostgrenzen, Nummern der Messwerte, Tür-Pause, Stand) und `bs_p0…bs_p6` (Fenster
„start,ende,soll;…“ in Unix-Sekunden, ein Schlüssel je Wochentag des Beginns).

Abbildung der Regelung (logik/regelung) auf das Skript:
- Automatik aus, Container auf Hand oder Gerät auf Hand → `hand` (nicht anfassen); Frostschutz nur mit „Frostschutz
  auch ohne Automatik“. Gerät inaktiv → `aus` ohne Frostschutz (die Automatik lässt es aus).
- Modus aus → `aus` (nur Frostschutz); Bei Bedarf → `bedarf` (Fenster = Termine mit Vorheizen und laufende
  Anforderung); Thermostat mit Fühler am Plug → `thermo`, sonst `plan` (in der Heizzeit an).
- Frei (Urlaub, freier Feiertag): kein Fenster; mit „absenken“ und Thermostat den ganzen Tag auf `absenk`.
- Vereinfachungen im Notbetrieb: keine Heizgrenze, kein Lernen (Hysterese statt TPI), keine Zusatzstufe, Frostschutz
  auch bei „frei: alles aus“ (Rückfallebene – lieber warm als eingefroren).
- Fenster werden auf `RASTER_MIN` nach außen gerundet (Beginn früher, Ende später), damit „Warm ab“, das sich mit der
  Temperatur verschiebt, nicht alle paar Minuten neu in den Plug geschrieben werden muss (Flash).
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
import json
import zlib

from .arbeitszeit import Plan
from .regelung import frost_aus_wert

MAX_WERT = 253        # längster KVS-Wert am Plug S Gen3 (BSM-013)
RASTER_MIN = 15
TAGE = 7
LEER = "-"            # leerer Tag (das Skript überspringt Teile ohne drei Zahlen)

Fenster = tuple[int, int, float]   # Unix-Sekunden von, bis, Soll


@dataclass(frozen=True)
class Vorgaben:
    """Was für einen Plug gilt (Einstellungen der Baustelle und des Containers, Lage des Geräts)."""

    automatik: bool
    auto: bool
    hand: bool
    aktiv: bool
    modus: str
    bedarf: bool
    toleranz: float
    frost: bool
    frost_grenze: float
    frost_aus: float | None
    frost_immer: bool
    tuer_pause_min: int
    temp_nr: int | None
    tuer_nr: int | None


def modus(v: Vorgaben) -> str:
    """Modus im Skript: plan | thermo | bedarf | hand | aus."""
    if not v.aktiv:
        return "aus"
    if not v.automatik or not v.auto or v.hand:
        return "hand"
    if v.modus == "aus":
        return "aus"
    if v.bedarf or v.modus == "bedarf":
        return "bedarf"
    return "thermo" if v.modus == "thermo" and v.temp_nr is not None else "plan"


def frost(v: Vorgaben) -> tuple[float | None, float | None]:
    """Frostschutz ein unter / aus über (°C); (None, None) = kein Frostschutz im Plug."""
    if not v.aktiv or not v.frost or (not v.automatik and not v.frost_immer):
        return None, None
    return v.frost_grenze, frost_aus_wert(v.frost_grenze, v.frost_aus)


def minuten_fenster(plan: Plan | None) -> list[tuple[int, int]]:
    """Heizzeiten eines Tagesplans als zusammenhängende Fenster in Minuten (Abschnitte zusammengelegt)."""
    if plan is None:
        return []
    raus: list[tuple[int, int]] = []
    for von, bis, _ in plan.abschnitte():
        if raus and von <= raus[-1][1]:
            raus[-1] = (raus[-1][0], max(raus[-1][1], bis))
        else:
            raus.append((von, bis))
    return raus


def runden(f: Fenster) -> Fenster:
    """Beginn auf das Raster abrunden, Ende aufrunden."""
    r = RASTER_MIN * 60
    return (f[0] // r * r, -(-f[1] // r) * r, round(f[2], 1))


def zusammenfassen(fenster: Iterable[Fenster]) -> list[Fenster]:
    """Gerundet, nach Beginn sortiert; überlappende oder anstoßende Fenster mit gleichem Soll zu einem."""
    raus: list[Fenster] = []
    for f in sorted(runden(f) for f in fenster if f[1] > f[0]):
        if raus and f[0] <= raus[-1][1] and f[2] == raus[-1][2]:
            raus[-1] = (raus[-1][0], max(raus[-1][1], f[1]), f[2])
        else:
            raus.append(f)
    return raus


def _text(fenster: list[Fenster]) -> str:
    return ";".join(f"{s},{e},{soll:g}" for s, e, soll in fenster) or LEER


def tag_wert(fenster: list[Fenster]) -> str:
    """Wert eines Tages; zu lang → die Fenster mit der kleinsten Lücke verbinden (heizt eher mehr), bis er passt."""
    f = list(fenster)
    while len(_text(f)) > MAX_WERT and len(f) > 1:
        i = min(range(len(f) - 1), key=lambda k: f[k + 1][0] - f[k][1])
        f[i:i + 2] = [(f[i][0], max(f[i][1], f[i + 1][1]), max(f[i][2], f[i + 1][2]))]
    return _text(f)


def programm(v: Vorgaben, fenster: Iterable[Fenster], wochentag: Mapping[int, int], jetzt: int) -> dict[str, str]:
    """KVS-Werte für einen Plug: `bs_cfg` und `bs_p0…bs_p6`.

    `fenster`: alle Heizfenster der nächsten Tage (Unix-Sekunden, Soll); `wochentag`: Beginn eines Tages (Unix-Sekunden,
    lokale Mitternacht) → Wochentag 0–6, für die Tage, die das Programm abdeckt. Vergangene Fenster fallen weg; ein Fenster
    zählt zu dem Tag, an dem es beginnt (begann es vor heute, zu heute).
    """
    tage = sorted(wochentag)
    je_tag: dict[int, list[Fenster]] = {wochentag[t]: [] for t in tage}
    for f in zusammenfassen(fenster):
        if f[1] <= jetzt:
            continue
        beginn = max((t for t in tage if t <= f[0]), default=tage[0])
        je_tag[wochentag[beginn]].append(f)
    fe, fa = frost(v)
    werte = {f"bs_p{w}": tag_wert(je_tag.get(w, [])) for w in range(TAGE)}
    cfg: dict[str, object] = {"m": modus(v), "tol": v.toleranz, "fe": fe, "fa": fa, "t": v.temp_nr, "d": v.tuer_nr,
                              "tp": v.tuer_pause_min}
    stand = zlib.crc32(json.dumps([cfg, werte], sort_keys=True).encode()) % 100000
    werte["bs_cfg"] = json.dumps({"v": stand, **cfg}, separators=(",", ":"))
    return werte


def stand(werte: Mapping[str, str]) -> int | None:
    """Stand (`v`) eines Programms – das Skript nennt ihn in der Antwort auf das Lebenszeichen."""
    try:
        return int(json.loads(werte["bs_cfg"])["v"])
    except (KeyError, ValueError, TypeError):
        return None
