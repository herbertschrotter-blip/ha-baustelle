"""Stundenbuch der Plugs nach einem Ausfall nachtragen (docs/bauplan-datenbank.md Phase 7, BSM-020).

Je Stunde des Notbetriebs eine Zeile in `geraet_minute` und `bereich_minute` mit `quelle = "notprogramm"` und
`dauer_s` bis zum Ende der Stunde. Regeln:
- Hat HA in der Stunde Minuten geschrieben, in denen der Plug nicht erreichbar war, ersetzt die Stunde sie. Hat HA
  vor dem Ausfall erreichbare Minuten, beginnt die Zeile erst nach der letzten echten Minute (Temperatur: dann gar nicht – HA hatte sie).
- Schon nachgetragene Stunden bleiben, wie sie sind (zweimal nachtragen ändert nichts).
- War HA an und nur der Plug weg, steht der ganze Zuwachs des Zählers in der ersten erreichbaren Minute danach – sie
  wird um das Nachgetragene gekürzt (nicht doppelt zählen). War HA aus, gibt es diese Minute nicht: nach dem Neustart
  beginnt das Mitschreiben beim aktuellen Zählerstand, das Stundenbuch füllt genau die Lücke.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, tzinfo
from typing import Any

from sqlalchemy import Connection, delete, func, insert, select, update

from homeassistant.util import dt as dt_util

from ..logik.notprogramm import BuchStunde
from . import schema as s

QUELLE = "notprogramm"
SPRUNG_NACH = timedelta(minutes=15)   # so lange nach dem Ende des Notbetriebs wird die Minute mit dem Zählersprung gesucht


@dataclass(frozen=True)
class Nachtrag:
    wh: float
    sekunden_ein: int
    stunden: int
    gekuerzt_wh: float
    tage: tuple[date, ...]


def _utc(t: datetime) -> datetime:
    return t if t.tzinfo else t.replace(tzinfo=dt_util.UTC)


def _beginn(v: Connection, tabelle: Any, spalte: Any, wer: str, von: datetime, bis: datetime, echt: Any,
            ausfall: datetime) -> datetime | None:
    """Beginn der Nachtrags-Zeile in der Stunde [von, bis): nach der letzten echten Minute vor dem Ausfall; None = schon
    nachgetragen."""
    t = tabelle
    zeilen = list(v.execute(select(t.c.zeit, t.c.dauer_s, t.c.quelle, echt.label("echt")).where(spalte == wer, t.c.zeit >= von, t.c.zeit < bis)))
    if any(z.quelle == QUELLE for z in zeilen):
        return None
    v.execute(delete(t).where(spalte == wer, t.c.zeit >= von, t.c.zeit < bis, t.c.quelle == "ha", ~echt))   # Minuten ohne Messung
    enden = [_utc(z.zeit) + timedelta(seconds=z.dauer_s) for z in zeilen if z.echt and _utc(z.zeit) < ausfall]
    beginn = max([von, *enden])
    beginn = beginn.replace(second=0, microsecond=0) + (timedelta(minutes=1) if beginn.second or beginn.microsecond else timedelta())
    belegt = {_utc(z.zeit) for z in zeilen if z.echt}
    while beginn in belegt:   # nie auf eine bestehende Minute (Schlüssel)
        beginn += timedelta(minutes=1)
    return beginn


def nachtragen(v: Connection, baustelle_id: str, geraet_id: str, bereich_id: str, stunden: list[BuchStunde],
               von: datetime, bis: datetime, zone: tzinfo) -> Nachtrag:
    """Die Stunden eines Plugs eintragen; `von`/`bis` = Notbetrieb (für die Minute mit dem Zählersprung)."""
    gm, bm = s.geraet_minute, s.bereich_minute
    sprung = _sprung_finden(v, geraet_id, von, bis)   # vor dem Ersetzen: dafür braucht es die Minuten ohne Verbindung
    wh = 0.0
    ein = n = 0
    tage: set[date] = set()
    for st in stunden:
        h0 = dt_util.utc_from_timestamp(st.stunde * 3600)
        h1 = h0 + timedelta(hours=1)
        beginn = _beginn(v, gm, gm.c.geraet_id, geraet_id, h0, h1, gm.c.erreichbar.is_(True), von)
        if beginn is not None and beginn < h1:
            dauer = int((h1 - beginn).total_seconds())
            sek = min(st.min_ein * 60, dauer)
            v.execute(insert(gm).values(geraet_id=geraet_id, zeit=beginn, baustelle_id=baustelle_id, dauer_s=dauer, sekunden_ein=sek,
                                        sekunden_strom=sek if st.wh > 0 else 0, leistung_w=round(st.wh * 3600 / dauer, 1),
                                        leistung_w_max=None, energie_wh=st.wh, zaehlerstand_kwh=None, erreichbar=True, quelle=QUELLE))
            wh, ein, n = wh + st.wh, ein + sek, n + 1
            tage.add(beginn.astimezone(zone).date())
        if st.temperatur is not None or st.tuer_s:
            b = _beginn(v, bm, bm.c.bereich_id, bereich_id, h0, h1, bm.c.temperatur.is_not(None), h1)
            if b == h0:   # HA hatte in dieser Stunde keine Temperatur
                v.execute(insert(bm).values(bereich_id=bereich_id, zeit=b, baustelle_id=baustelle_id, dauer_s=3600,
                                            temperatur=st.temperatur, tuer_offen_s=st.tuer_s, quelle=QUELLE))
    gekuerzt = 0.0
    if sprung is not None and wh:
        zeit, alt = sprung
        neu = max(0.0, alt - wh)
        v.execute(update(gm).where(gm.c.geraet_id == geraet_id, gm.c.zeit == zeit).values(energie_wh=round(neu, 3)))
        gekuerzt = round(alt - neu, 1)
    return Nachtrag(round(wh, 1), ein, n, gekuerzt, tuple(sorted(tage)))


def _sprung_finden(v: Connection, geraet_id: str, von: datetime, bis: datetime) -> tuple[datetime, float] | None:
    """Erste erreichbare HA-Minute nach Minuten ohne Verbindung (dort steht der Zählersprung): (Zeit, Wh)."""
    gm = s.geraet_minute
    zeilen = list(v.execute(select(gm.c.zeit, gm.c.erreichbar, gm.c.energie_wh).where(
        gm.c.geraet_id == geraet_id, gm.c.zeit >= von - timedelta(minutes=1), gm.c.zeit <= bis + SPRUNG_NACH, gm.c.quelle == "ha")
        .order_by(gm.c.zeit)))
    for vorher, z in zip(zeilen, zeilen[1:]):
        if not vorher.erreichbar and z.erreichbar and z.energie_wh:
            return z.zeit, float(z.energie_wh)
    return None


def messung(v: Connection, geraet_id: str, von: datetime, bis: datetime) -> tuple[float, int]:
    """Was HA selbst gemessen hat (Minuten mit Quelle „ha“): (Wh, Sekunden eingeschaltet) – für die Ausfall-Probe."""
    gm = s.geraet_minute
    z = v.execute(select(func.coalesce(func.sum(gm.c.energie_wh), 0.0), func.coalesce(func.sum(gm.c.sekunden_ein), 0)).where(
        gm.c.geraet_id == geraet_id, gm.c.zeit >= von, gm.c.zeit < bis, gm.c.quelle == "ha")).one()
    return float(z[0]), int(z[1])
