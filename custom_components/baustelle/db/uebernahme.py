"""Altdaten übernehmen (docs/bauplan-datenbank.md Phase 3, BSM-008) – einmal je Baustelle, wiederholbar.

- Store: Einstellungen als erste Zeilen (`quelle=migration`, je oberstem Schlüssel), Zählerstände als Momentaufnahme
  (`zustand` „zaehler_uebernahme“), Protokoll (bis zu 1.000 Einträge, ohne Doppelte), Meldungen.
- HA-Verlauf ab Baustellenbeginn (höchstens `VERLAUF_TAGE`) bis zum Start des Mitschreibens: nachgespielt mit
  `logik/minute` zu Minutenzeilen (`quelle=import_verlauf`).
- HA-Langzeitstatistik davor: Stundenzeilen (`dauer_s=3600`, `quelle=import_statistik`).

Ein zweiter Lauf ersetzt die importierten Zeilen (gleiches Ergebnis). Vorher sichert sich die Datenbank selbst
(`baustelle.db.vor-uebernahme`); HA und der Store werden nur gelesen. Merker: `zustand` „uebernahme“.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta
import logging
from typing import TYPE_CHECKING, Any

from sqlalchemy import Connection, and_, delete, func, insert, select

from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from ..const import ART_CONTAINER, CONF_REGEN_SENSOR, CONF_TEMP_SENSOR, DOMAIN
from ..logik.minute import BereichVerlauf, GeraetVerlauf, nachspielen_bereich, nachspielen_geraet
from . import schema as s

if TYPE_CHECKING:
    from ..steuerung import Steuerung
    from .verbindung import Datenbank

_LOGGER = logging.getLogger(__name__)
UEBERNAHME_VERSION = 2   # 2: Meldungen, Wetter aus den eigenen Sensoren (läuft auf dem Pi einmal neu)
VERLAUF_TAGE = 62
NICHT_IN_EINSTELLUNGEN = {"protokoll", "meldungen", "laufzeit", "zaehler"}


def _wert(z: State) -> str | None:
    return None if z.state in (STATE_UNAVAILABLE, STATE_UNKNOWN, "") else z.state


def _zahlen(liste: Iterable[State]) -> list[tuple[datetime, float | None]]:
    ergebnis: list[tuple[datetime, float | None]] = []
    for z in liste:
        w = _wert(z)
        try:
            ergebnis.append((z.last_updated, float(w) if w is not None else None))
        except ValueError:
            ergebnis.append((z.last_updated, None))
    return ergebnis


def _an(liste: Iterable[State]) -> list[tuple[datetime, bool | None]]:
    return [(z.last_updated, None if _wert(z) is None else z.state == STATE_ON) for z in liste]


def _texte(liste: Iterable[State]) -> list[tuple[datetime, str | None]]:
    return [(z.last_updated, _wert(z)) for z in liste]


async def _verlauf(hass: HomeAssistant, ids: list[str], start: datetime, ende: datetime) -> dict[str, list[State]]:
    if not ids or "recorder" not in hass.config.components:
        return {}
    from homeassistant.components.recorder import history  # noqa: PLC0415
    from homeassistant.helpers.recorder import get_instance  # noqa: PLC0415

    roh = await get_instance(hass).async_add_executor_job(
        history.get_significant_states, hass, start, ende, ids, None, True, False, False, True)
    return {k: [z for z in v if isinstance(z, State)] for k, v in roh.items()}


async def _statistik(hass: HomeAssistant, ids: list[str], start: datetime, ende: datetime) -> dict[str, list[dict[str, Any]]]:
    if not ids or start >= ende or "recorder" not in hass.config.components:
        return {}
    from homeassistant.components.recorder.statistics import statistics_during_period  # noqa: PLC0415
    from homeassistant.helpers.recorder import get_instance  # noqa: PLC0415

    roh = await get_instance(hass).async_add_executor_job(
        statistics_during_period, hass, start, ende, set(ids), "hour", None, {"change", "mean", "state"})
    return {k: [dict(p) for p in v] for k, v in roh.items()}


def _zeit(wert: Any) -> datetime:
    if isinstance(wert, (int, float)):
        return dt_util.utc_from_timestamp(wert)
    return wert if isinstance(wert, datetime) else dt_util.parse_datetime(str(wert), raise_on_error=True)


async def async_uebernehmen(hass: HomeAssistant, db: Datenbank, st: Steuerung, bis: datetime, *, erzwingen: bool = False) -> dict[str, int] | None:
    """Altdaten einer Baustelle übernehmen; None, wenn schon geschehen (Merker) oder die Datenbank fehlt."""
    bid = st.entry.entry_id
    if not db.bereit:
        return None
    merker = await db.async_ausfuehren(lambda v: v.execute(
        select(s.zustand.c.wert).where(s.zustand.c.baustelle_id == bid, s.zustand.c.schluessel == "uebernahme")).scalar())
    if merker and not erzwingen and int(merker.get("version", 0)) >= UEBERNAHME_VERSION:
        return None
    await db.async_kopie("vor-uebernahme")
    # nur bis zur ersten mitgeschriebenen Minute (0.8.54 schrieb schon vor dem Neustart mit, der die Übernahme bringt)
    erste = await db.async_ausfuehren(lambda v: v.execute(select(func.min(s.geraet_minute.c.zeit)).where(
        s.geraet_minute.c.baustelle_id == bid, s.geraet_minute.c.quelle == "ha")).scalar())
    if isinstance(erste, datetime):
        bis = min(bis, erste if erste.tzinfo else erste.replace(tzinfo=dt_util.UTC))

    from ..auswertung import beginn_der_baustelle   # noqa: PLC0415 – auswertung → steuerung → db (Kreis beim Import)
    beginn, _auto = beginn_der_baustelle(st.entry)
    start_baustelle = dt_util.as_utc(datetime.combine(beginn, datetime.min.time(), dt_util.get_default_time_zone()))
    start_verlauf = max(start_baustelle, bis - timedelta(days=VERLAUF_TAGE))
    start_verlauf = start_verlauf.replace(second=0, microsecond=0)

    # ---------------------------------------------------------------- HA-Verlauf → Minuten
    ids: list[str] = []
    for g in st.geraete.values():
        ids += [x for x in (g.schalter, g.leistung, g.energie) if x]
    tueren: dict[str, str] = {}
    gruende: dict[str, str] = {}
    reg = er.async_get(hass)
    for b_id, info in st.bereiche.items():
        if info.fuehler:
            ids.append(info.fuehler)
        if info.art == ART_CONTAINER and (tuer := st.einstellungen.bereich(b_id).get("tuer")):
            tueren[b_id] = tuer
            ids.append(tuer)
        if gid := reg.async_get_entity_id("sensor", DOMAIN, f"{b_id}_grund"):
            gruende[b_id] = gid
            ids.append(gid)
    # Wetter: die eigenen Sensoren (damit rechnete die Regelung), sonst die eingestellten Sensoren
    o = st.entry.options
    eigen = {k: reg.async_get_entity_id("sensor", DOMAIN, f"{bid}_{k}") for k in ("aussen", "regen", "tageshoechst")}
    wetter_quelle = {"aussen": [x for x in (eigen["aussen"], o.get(CONF_TEMP_SENSOR)) if x],
                     "regen": [x for x in (eigen["regen"], o.get(CONF_REGEN_SENSOR)) if x],
                     "tageshoechst": [x for x in (eigen["tageshoechst"],) if x]}
    wetter_ids = sorted({x for liste in wetter_quelle.values() for x in liste})
    verlauf = await _verlauf(hass, sorted(set(ids + wetter_ids)), start_verlauf, bis) if start_verlauf < bis else {}

    geraet_zeilen: list[dict[str, Any]] = []
    for gid, g in st.geraete.items():
        v = GeraetVerlauf(_an(verlauf.get(g.schalter, [])), _zahlen(verlauf.get(g.leistung or "", [])),
                          _zahlen(verlauf.get(g.energie or "", [])), mit_zaehler=bool(g.energie))
        for beginn_m, m in nachspielen_geraet(v, start_verlauf, bis):
            geraet_zeilen.append({"geraet_id": gid, "zeit": beginn_m, "baustelle_id": bid, "dauer_s": m.dauer_s,
                                  "sekunden_ein": m.sekunden_ein, "leistung_w": m.leistung_w, "leistung_w_max": m.leistung_w_max,
                                  "energie_wh": m.energie_wh, "zaehlerstand_kwh": m.zaehlerstand_kwh, "erreichbar": m.erreichbar,
                                  "quelle": "import_verlauf"})
    bereich_zeilen: list[dict[str, Any]] = []
    for b_id, info in st.bereiche.items():
        bv = BereichVerlauf(_zahlen(verlauf.get(info.fuehler or "", [])),
                            _an(verlauf.get(tueren[b_id], [])) if b_id in tueren else None,
                            _texte(verlauf.get(gruende.get(b_id, ""), [])))
        for beginn_m, bm, grund in nachspielen_bereich(bv, start_verlauf, bis):
            bereich_zeilen.append({"bereich_id": b_id, "zeit": beginn_m, "baustelle_id": bid, "dauer_s": bm.dauer_s,
                                   "temperatur": bm.temperatur, "feuchte": None, "soll": None, "tuer_offen_s": bm.tuer_offen_s,
                                   "zustand": None, "grund": grund, "quelle": "import_verlauf"})
    def wetter_minuten(art: str) -> dict[datetime, tuple[int, float | None]]:
        for entity_id in wetter_quelle[art]:   # erste Quelle mit Werten
            punkte = _zahlen(verlauf.get(entity_id, []))
            if any(w is not None for _, w in punkte):
                return {b: (m.dauer_s, m.temperatur) for b, m, _ in nachspielen_bereich(BereichVerlauf(punkte, None, []), start_verlauf, bis)}
        return {}

    aussen, regen, hoechst = wetter_minuten("aussen"), wetter_minuten("regen"), wetter_minuten("tageshoechst")
    wetter_zeilen: list[dict[str, Any]] = [
        {"baustelle_id": bid, "zeit": b, "dauer_s": (aussen.get(b) or regen.get(b) or hoechst.get(b) or (60, None))[0],
         "aussen_temp": (aussen.get(b) or (0, None))[1], "regen_mm": (regen.get(b) or (0, None))[1],
         "hoechst_heute": (hoechst.get(b) or (0, None))[1], "quelle": "import_verlauf"}
        for b in sorted({*aussen, *regen, *hoechst})]

    # ---------------------------------------------------------------- Langzeitstatistik davor → Stunden
    stat_ids = {g.energie: ("g", gid) for gid, g in st.geraete.items() if g.energie}
    stat_ids.update({info.fuehler: ("b", b_id) for b_id, info in st.bereiche.items() if info.fuehler})
    statistik = await _statistik(hass, list(stat_ids), start_baustelle, start_verlauf)
    for entity_id, punkte in statistik.items():
        art, wessen = stat_ids[entity_id]
        for p in punkte:
            t = _zeit(p["start"])
            if art == "g":
                geraet_zeilen.append({"geraet_id": wessen, "zeit": t, "baustelle_id": bid, "dauer_s": 3600, "sekunden_ein": None,
                                      "leistung_w": None, "leistung_w_max": None,
                                      "energie_wh": None if p.get("change") is None else round(float(p["change"]) * 1000, 3),
                                      "zaehlerstand_kwh": p.get("state"), "erreichbar": None, "quelle": "import_statistik"})
            else:
                bereich_zeilen.append({"bereich_id": wessen, "zeit": t, "baustelle_id": bid, "dauer_s": 3600,
                                       "temperatur": p.get("mean"), "feuchte": None, "soll": None, "tuer_offen_s": None,
                                       "zustand": None, "grund": None, "quelle": "import_statistik"})

    # ---------------------------------------------------------------- Store
    jetzt = dt_util.utcnow()
    e = {k: v for k, v in st.e.items() if k not in NICHT_IN_EINSTELLUNGEN}
    einstellungen = [{"baustelle_id": bid, "bereich_id": None, "geraet_id": None, "schluessel": k, "wert": v,
                      "ab": start_baustelle, "benutzer": None, "quelle": "migration"} for k, v in e.items()]
    protokoll = [{"zeit": dt_util.as_utc(_zeit(p[0])), "baustelle_id": bid, "bereich_id": p[2], "art": p[1], "text": p[3]}
                 for p in (st.e.get("protokoll") or []) if len(p) >= 4]
    zaehler = dict(st.zaehler)
    import_quellen = ("import_verlauf", "import_statistik")
    zahlen = {"geraet_minute": len(geraet_zeilen), "bereich_minute": len(bereich_zeilen), "wetter_minute": len(wetter_zeilen),
              "einstellung": len(einstellungen), "protokoll": len(protokoll)}

    def schreiben(v: Connection) -> bool:
        for tabelle, schl in ((s.geraet_minute, "baustelle_id"), (s.bereich_minute, "baustelle_id"), (s.wetter_minute, "baustelle_id")):
            v.execute(delete(tabelle).where(tabelle.c[schl] == bid, tabelle.c.quelle.in_(import_quellen)))
        for tabelle, zeilen in ((s.geraet_minute, geraet_zeilen), (s.bereich_minute, bereich_zeilen), (s.wetter_minute, wetter_zeilen)):
            for i in range(0, len(zeilen), 5000):
                v.execute(insert(tabelle), zeilen[i:i + 5000])
        v.execute(delete(s.einstellung).where(s.einstellung.c.baustelle_id == bid, s.einstellung.c.quelle == "migration"))
        if einstellungen:
            v.execute(insert(s.einstellung), einstellungen)
        vorhanden = {(r.zeit.replace(tzinfo=None), r.art, r.text) for r in v.execute(
            select(s.protokoll.c.zeit, s.protokoll.c.art, s.protokoll.c.text).where(s.protokoll.c.baustelle_id == bid))}
        neu = [p for p in protokoll if (p["zeit"].replace(tzinfo=None), p["art"], p["text"]) not in vorhanden]
        if neu:
            v.execute(insert(s.protokoll), neu)
        for schluessel, wert in (("zaehler_uebernahme", {"zeit": jetzt.isoformat(), "zaehler": zaehler}),
                                 ("uebernahme", {"version": UEBERNAHME_VERSION, "zeit": jetzt.isoformat(), "zeilen": zahlen,
                                                 "verlauf_ab": start_verlauf.isoformat(), "bis": bis.isoformat()})):
            v.execute(delete(s.zustand).where(and_(s.zustand.c.baustelle_id == bid, s.zustand.c.schluessel == schluessel)))
            v.execute(insert(s.zustand).values(baustelle_id=bid, schluessel=schluessel, wert=wert, geaendert=jetzt))
        return True   # None hieße für async_ausfuehren „fehlgeschlagen“

    # Meldungen (eine Liste für die ganze Integration; die Tabelle wird je Speichern ganz ersetzt)
    from ..panel import DATA_MELDUNGEN   # noqa: PLC0415 – panel importiert db (Kreis)
    from . import meldungen_merken   # noqa: PLC0415
    if (meldungen := hass.data.get(DATA_MELDUNGEN)) is not None:
        meldungen_merken(hass, [dict(m) for m in await meldungen.async_laden()])
        await db.schreiber.async_schreiben()
        zahlen["meldung"] = len(meldungen.liste)

    if await db.async_ausfuehren(schreiben) is None:
        _LOGGER.warning("Übernahme der Altdaten für %s fehlgeschlagen: %s", st.entry.title, db.fehler)
        return None
    db.geschrieben()
    _LOGGER.info("Altdaten für %s übernommen: %s", st.entry.title, zahlen)
    return zahlen
