"""Mitschreiben einer Baustelle in die eigene Datenbank (docs/bauplan-datenbank.md Phase 2, BSM-007).

Je Minute eine Zeile je Gerät (`geraet_minute`), Container (`bereich_minute`) und Baustelle (`wetter_minute`), jede
Schaltung, Tür und Erreichbarkeit sekundengenau als Ereignis (ohne Person, §6), die Laufzeit (`zustand`, nur bei
Änderung) und das Gelernte je Container und Tag (`lernen`, stündlich). Die Minutenbildung rechnet `logik/minute`.
Gelesen wird in dieser Phase weiter aus Store und HA-Statistik – der Pilot merkt nichts.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
import json
from typing import TYPE_CHECKING, Any

from sqlalchemy import Connection, delete, insert, update

from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_change
from homeassistant.util import dt as dt_util

from ..const import ART_CONTAINER
from ..logik.minute import BereichSammler, GeraetSammler
from . import schema as s

if TYPE_CHECKING:
    from ..steuerung import Steuerung
    from .verbindung import Datenbank

LERNEN_JEDE_MINUTE = 0   # stündlich (Minute 0) das Gelernte je Container und Tag
TAGE_JEDE_MINUTEN = 15   # Tagessummen von heute alle 15 Minuten neu (BSM-009)


def _zahl(zustand: State | None) -> float | None:
    if zustand is None or zustand.state in (STATE_UNAVAILABLE, STATE_UNKNOWN, ""):
        return None
    try:
        return float(zustand.state)
    except ValueError:
        return None


def _an(zustand: State | None) -> bool | None:
    if zustand is None or zustand.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return None
    return zustand.state == STATE_ON


class Mitschreiber:
    """Sammelt die Zustände einer Baustelle und schreibt sie je Minute."""

    def __init__(self, hass: HomeAssistant, db: Datenbank, st: Steuerung) -> None:
        self.hass, self.db, self.st = hass, db, st
        self.bid = st.entry.entry_id
        self._geraete: dict[str, GeraetSammler] = {}
        self._bereiche: dict[str, BereichSammler] = {}
        self._wer: dict[str, list[tuple[str, str]]] = {}   # entity_id → [(art, id)]
        self._zustand_alt: dict[str, str] = {}
        self._lernen_alt: dict[str, str] = {}
        self._abmelden: list[Callable[[], None]] = []
        self.start_zeit = dt_util.utcnow()

    # ------------------------------------------------------------------ Start/Stopp
    def start(self) -> None:
        jetzt = self.start_zeit = dt_util.utcnow()
        get = self.hass.states.get
        for gid, g in self.st.geraete.items():
            self._geraete[gid] = GeraetSammler(
                jetzt, _an(get(g.schalter)), _zahl(get(g.leistung)) if g.leistung else None,
                _zahl(get(g.energie)) if g.energie else None, mit_zaehler=bool(g.energie))
            self._merken(g.schalter, "schalter", gid)
            if g.leistung:
                self._merken(g.leistung, "leistung", gid)
            if g.energie:
                self._merken(g.energie, "energie", gid)
        for bid, info in self.st.bereiche.items():
            tuer = self.st.einstellungen.bereich(bid).get("tuer") if info.art == ART_CONTAINER else None
            self._bereiche[bid] = BereichSammler(
                jetzt, _zahl(get(info.fuehler)) if info.fuehler else None, _an(get(tuer)) if tuer else None, mit_tuer=bool(tuer))
            if info.fuehler:
                self._merken(info.fuehler, "fuehler", bid)
            if tuer:
                self._merken(tuer, "tuer", bid)
        if self._wer:
            self._abmelden.append(async_track_state_change_event(self.hass, list(self._wer), self._geaendert))
        self._abmelden.append(async_track_time_change(self.hass, self._minute, second=0))

    def _merken(self, entity_id: str, art: str, wessen: str) -> None:
        self._wer.setdefault(entity_id, []).append((art, wessen))

    async def async_stop(self) -> None:
        """Beim Entladen: Rest der laufenden Minute schreiben."""
        for weg in self._abmelden:
            weg()
        self._abmelden.clear()
        self._abschliessen(dt_util.utcnow(), stunde=True)
        await self.db.schreiber.async_schreiben()

    # ------------------------------------------------------------------ Änderungen
    @callback
    def _geaendert(self, event: Event[EventStateChangedData]) -> None:
        neu, alt = event.data["new_state"], event.data["old_state"]
        t = neu.last_updated if neu is not None else dt_util.utcnow()
        for art, wessen in self._wer.get(event.data["entity_id"], []):
            if art == "schalter" and (g := self._geraete.get(wessen)):
                g.schalter(t, _an(neu))
                self._schaltung(wessen, alt, neu, t)
            elif art == "leistung" and (g := self._geraete.get(wessen)):
                g.leistung(t, _zahl(neu))
            elif art == "energie" and (g := self._geraete.get(wessen)):
                g.zaehler(t, _zahl(neu))
            elif art == "fuehler" and (b := self._bereiche.get(wessen)):
                b.temperatur(t, _zahl(neu))
            elif art == "tuer" and (b := self._bereiche.get(wessen)):
                b.tuer(t, _an(neu))
                if _an(neu) != _an(alt):
                    self.ereignis(t, "tuer", {"offen": _an(neu)}, "automatik", bereich_id=wessen)

    def _schaltung(self, gid: str, alt: State | None, neu: State | None, t: datetime) -> None:
        vorher, jetzt = _an(alt), _an(neu)
        if vorher == jetzt:
            return
        g = self.st.geraete[gid]
        if jetzt is None or vorher is None:
            self.ereignis(t, "erreichbar", {"erreichbar": jetzt is not None}, "automatik", bereich_id=g.bereich, geraet_id=gid)
            if jetzt is None:
                return
        if neu is not None and neu.context.id in self.st.eigene_kontexte:
            quelle = "automatik"
        elif neu is not None and neu.context.user_id:
            quelle = "ha"       # in HA geschaltet (Oberfläche, Seite) – ohne Person (§6)
        else:
            quelle = "hand"     # am Gerät
        self.ereignis(t, "schalten", {"an": jetzt}, quelle, bereich_id=g.bereich, geraet_id=gid)

    def ereignis(self, t: datetime, art: str, wert: Any, quelle: str, *, bereich_id: str | None = None,
                 geraet_id: str | None = None, grund: str | None = None) -> None:
        zeile = {"zeit": t, "baustelle_id": self.bid, "bereich_id": bereich_id, "geraet_id": geraet_id, "art": art,
                 "wert": wert, "quelle": quelle, "grund": grund}
        self.db.schreiber.dazu(lambda v: v.execute(insert(s.ereignis).values(**zeile)))

    # ------------------------------------------------------------------ je Minute
    @callback
    def _minute(self, _jetzt: datetime) -> None:
        jetzt = dt_util.utcnow().replace(second=0, microsecond=0)
        self._abschliessen(jetzt, stunde=jetzt.minute == LERNEN_JEDE_MINUTE)
        self.hass.async_create_task(self._async_schreiben_und_tage(dt_util.as_local(jetzt)), "baustelle_datenbank_minute")

    async def _async_schreiben_und_tage(self, lokal: datetime) -> None:
        """Minute schreiben; Tagessummen (BSM-009) für heute alle 15 Minuten, um 00:05 auch für gestern."""
        await self.db.schreiber.async_schreiben()
        if lokal.minute % TAGE_JEDE_MINUTEN:
            return
        from .tage import async_tage_rechnen   # noqa: PLC0415
        tage = [lokal.date()]
        if lokal.hour == 0 and lokal.minute <= TAGE_JEDE_MINUTEN:
            tage.insert(0, lokal.date() - timedelta(days=1))
        await async_tage_rechnen(self.db, self.st, tage)

    def _abschliessen(self, ende: datetime, *, stunde: bool) -> None:
        geraete: list[dict[str, Any]] = []
        bereiche: list[dict[str, Any]] = []
        dauern: list[int] = []
        for gid, sammler in self._geraete.items():
            m = sammler.abschliessen(ende)
            if m.dauer_s <= 0:
                continue
            dauern.append(m.dauer_s)
            geraete.append({"geraet_id": gid, "zeit": ende - _sek(m.dauer_s), "baustelle_id": self.bid,
                            "dauer_s": m.dauer_s, "sekunden_ein": m.sekunden_ein, "leistung_w": m.leistung_w,
                            "leistung_w_max": m.leistung_w_max, "energie_wh": m.energie_wh,
                            "zaehlerstand_kwh": m.zaehlerstand_kwh, "erreichbar": m.erreichbar, "quelle": "ha"})
        d = self.st.daten
        for bid, b_sammler in self._bereiche.items():
            bm = b_sammler.abschliessen(ende)
            if bm.dauer_s <= 0:
                continue
            dauern.append(bm.dauer_s)
            bereiche.append({"bereich_id": bid, "zeit": ende - _sek(bm.dauer_s), "baustelle_id": self.bid,
                             "dauer_s": bm.dauer_s, "temperatur": bm.temperatur, "feuchte": None, "soll": self._soll(bid),
                             "tuer_offen_s": bm.tuer_offen_s, "zustand": d.zustand.get(bid), "grund": d.grund.get(bid),
                             "quelle": "ha"})
        dauer = max(dauern, default=60)
        w = d.wetter
        wetter = {"baustelle_id": self.bid, "zeit": ende - _sek(dauer), "dauer_s": dauer, "aussen_temp": w.aussen,
                  "regen_mm": w.regen_heute, "hoechst_heute": w.aussen_max, "quelle": "ha"}
        zustand = self._zustand_aenderungen(ende)
        lernen = self._lernen(ende) if stunde else []
        bid = self.bid

        def schreiben(v: Connection) -> None:
            if geraete:
                v.execute(insert(s.geraet_minute), geraete)
            if bereiche:
                v.execute(insert(s.bereich_minute), bereiche)
            if geraete or bereiche:
                v.execute(insert(s.wetter_minute).values(**wetter))
            for schluessel, wert in zustand:
                v.execute(delete(s.zustand).where(s.zustand.c.baustelle_id == bid, s.zustand.c.schluessel == schluessel))
                if wert is not None:
                    v.execute(insert(s.zustand).values(baustelle_id=bid, schluessel=schluessel, wert=wert, geaendert=ende))
            for zeile in lernen:
                gefunden = v.execute(update(s.lernen).where(s.lernen.c.bereich_id == zeile["bereich_id"],
                                                            s.lernen.c.datum == zeile["datum"]).values(werte=zeile["werte"]))
                if gefunden.rowcount == 0:
                    v.execute(insert(s.lernen).values(**zeile))

        self.db.schreiber.dazu(schreiben)

    def _soll(self, bid: str) -> float | None:
        if self.st.bereiche[bid].art != ART_CONTAINER:
            return None
        from ..funktionen.heizung import Heizung   # noqa: PLC0415 – vermeidet einen Kreis beim Import
        heizung = Heizung.von(self.st)
        return heizung.soll_temperatur(bid) if heizung.aktiv() else None

    def _zustand_aenderungen(self, _ende: datetime) -> list[tuple[str, Any]]:
        """Laufzeit (je Schlüssel der obersten Ebene) – nur was sich seit dem letzten Schreiben geändert hat."""
        neu = {k: json.dumps(v, sort_keys=True, default=str) for k, v in self.st.lz.items() if k != "lernen"}
        aenderungen: list[tuple[str, Any]] = [(k, json.loads(t)) for k, t in neu.items() if self._zustand_alt.get(k) != t]
        aenderungen += [(k, None) for k in self._zustand_alt if k not in neu]
        self._zustand_alt = neu
        return aenderungen

    def _lernen(self, ende: datetime) -> list[dict[str, Any]]:
        tag = dt_util.as_local(ende).date()
        zeilen = []
        for bid, stand in (self.st.lz.get("lernen") or {}).items():
            text = json.dumps(stand, sort_keys=True, default=str)
            if self._lernen_alt.get(bid) != text:
                self._lernen_alt[bid] = text
                zeilen.append({"baustelle_id": self.bid, "bereich_id": bid, "datum": tag, "werte": json.loads(text)})
        return zeilen


def _sek(n: int) -> timedelta:
    return timedelta(seconds=n)
