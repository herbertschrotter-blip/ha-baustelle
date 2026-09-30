"""Auswertung für Seite, Bericht und CSV: holt die Langzeitstatistik (Recorder) und rechnet mit `logik/auswertung.py`.

Die Seite rechnet nichts Fachliches mehr, sie holt die Werte über `baustelle/auswertung` und `baustelle/abrechnung`
(panel.py, api-0.7 §8). Der Bericht (nachrichten.py) nimmt dieselben Funktionen – so zeigen Seite, Bericht und CSV
dieselben Zahlen (docs/bauplan-module.md).

Statistik-IDs sind die eigenen Sensoren (unique_id → entity_id aus der Registry): `<bid>_energie`, `<bid>_heizzeit`,
`<gid>_pumpzeit`, `<entry>_energie`, `<entry>_energie_ohne_automatik`, `<entry>_aussen`. Abgeschlossene oder nicht
geladene Baustellen (Verlauf) kommen aus der Einrichtung (Subentries), ohne Einstellungen und Zähler – wie in
`baustelle/struktur`.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, tzinfo
from typing import TYPE_CHECKING, Any, cast

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .const import (
    ART_CONTAINER,
    CONF_ART,
    CONF_BEGINN,
    CONF_BEREICH,
    CONF_ENDE,
    CONF_ENERGIE,
    CONF_HEIZPERIODE_BIS,
    CONF_HEIZPERIODE_VON,
    CONF_ROLLE,
    CONF_STATUS,
    CONF_TYP,
    DOMAIN,
    ROLLE_PUMPE,
    STATUS_AKTIV,
    SUB_BEREICH,
    SUB_GERAET,
    TYPEN,
)
from .logik import auswertung as a
from .logik.abrechnung import EIGEN

if TYPE_CHECKING:
    from .steuerung import Steuerung

Statistik = dict[str, list[dict[str, Any]]]


# ------------------------------------------------------------------ Quelle: eine Baustelle


@dataclass
class Quelle:
    """Eine Baustelle, wie die Auswertung sie braucht (geladen: aus der Steuerung, sonst aus der Einrichtung)."""

    entry: ConfigEntry
    st: Steuerung | None
    ids: dict[str, str]   # unique_id → entity_id der eigenen Sensoren
    bereiche: list[dict[str, Any]]   # {"id", "name", "art"}
    geraete: list[dict[str, Any]]   # {"id", "bereich", "rolle", "typ", "energie"}, nach Bereichen geordnet

    def eid(self, besitzer: str, key: str) -> str | None:
        return self.ids.get(f"{besitzer}_{key}")

    @property
    def zaehler(self) -> dict[str, Any]:
        return self.st.zaehler if self.st is not None else {}

    @property
    def preis(self) -> float:
        return float(self.st.e["preis"]) if self.st is not None else 0.0

    def option_datum(self, key: str) -> date | None:
        wert = self.entry.options.get(key)
        return date.fromisoformat(wert) if wert else None

    def baustelle(self) -> dict[str, Any]:
        """Baustelle in der Form von `logik/auswertung` (Firmen und Zuordnung für die Abrechnung)."""
        e = self.st.e if self.st is not None else {}
        return {
            "entry": self.entry.entry_id, "titel": self.entry.title,
            "firmen": e.get("firmen") or [a.EIGENE_FIRMA], "zuordnung": e.get("zuordnung") or [],
            "bereiche": [{"id": b["id"], "name": b["name"]} for b in self.bereiche],
        }

    def energie_ids(self, bid: str) -> list[str]:
        """Energie eines Containers: sein Sensor, sonst die Energiezähler seiner Geräte (wie die Seite)."""
        eigen = self.eid(bid, "energie")
        return [eigen] if eigen else [g["energie"] for g in self.geraete if g["bereich"] == bid and g["energie"]]

    def pumpen(self) -> list[dict[str, Any]]:
        return [g for g in self.geraete if g["rolle"] == ROLLE_PUMPE]


def quelle(hass: HomeAssistant, entry: ConfigEntry) -> Quelle:
    registry = er.async_get(hass)
    ids = {e.unique_id: e.entity_id for e in er.async_entries_for_config_entry(registry, entry.entry_id)}
    st: Steuerung | None = getattr(entry, "runtime_data", None)
    bereiche: list[dict[str, Any]]
    geraete: list[dict[str, Any]]
    if st is not None:
        bereiche = [{"id": b.id, "name": b.name, "art": b.art} for b in st.bereiche.values()]
        geraete = [{"id": g.id, "bereich": g.bereich, "rolle": g.rolle, "typ": g.typ, "energie": g.energie}
                   for g in st.geraete.values()]
    else:
        subs = list(entry.subentries.values())
        bereiche = [{"id": s.subentry_id, "name": s.title, "art": s.data.get(CONF_ART)}
                    for s in subs if s.subentry_type == SUB_BEREICH]
        geraete = [{"id": s.subentry_id, "bereich": s.data.get(CONF_BEREICH), "rolle": s.data.get(CONF_ROLLE),
                    "typ": s.data.get(CONF_TYP), "energie": s.data.get(CONF_ENERGIE)}
                   for s in subs if s.subentry_type == SUB_GERAET]
    geraete = [g for b in bereiche for g in geraete if g["bereich"] == b["id"]]
    return Quelle(entry, st, ids, bereiche, geraete)


def laufende(hass: HomeAssistant) -> list[ConfigEntry]:
    """Alle laufenden Baustellen (Auswertung „Alle laufenden“)."""
    return [e for e in hass.config_entries.async_entries(DOMAIN) if e.options.get(CONF_STATUS, STATUS_AKTIV) == STATUS_AKTIV]


# ------------------------------------------------------------------ Langzeitstatistik


async def async_statistik(
    hass: HomeAssistant, ids: Iterable[str | None], start: datetime, ende: datetime, periode: str, arten: set[str]
) -> Statistik:
    """Langzeitstatistik wie `recorder/statistics_during_period` (Periode hour/day/month); ohne Recorder leer."""
    ids = {i for i in ids if i}
    if not ids or "recorder" not in hass.config.components:
        return {}
    from homeassistant.components.recorder.statistics import statistics_during_period  # noqa: PLC0415
    from homeassistant.helpers.recorder import get_instance  # noqa: PLC0415

    daten = await get_instance(hass).async_add_executor_job(
        statistics_during_period, hass, start, ende, ids, periode, None, arten
    )
    return cast(Statistik, daten)


def _zone() -> tzinfo:
    return dt_util.get_default_time_zone()


async def async_je_tag(hass: HomeAssistant, ids: dict[str, str], von: date, bis: date) -> dict[str, dict[date, float]]:
    """Änderung je Tag (von–bis einschließlich) je Schlüssel (`{schlüssel: entity_id}`) – für den Bericht."""
    zone = _zone()
    roh = await async_statistik(hass, ids.values(), a.mitternacht(von, zone),
                                a.mitternacht(date.fromordinal(bis.toordinal() + 1), zone), "day", {"change"})
    ergebnis: dict[str, dict[date, float]] = {}
    for key, entity_id in ids.items():
        for p in roh.get(entity_id, []):
            ergebnis.setdefault(key, {})[a.lokal(p["start"], zone).date()] = float(p.get("change") or 0.0)
    return ergebnis


def _zeitraum_dict(zr: a.Zeitraum) -> dict[str, Any]:
    return {"art": zr.art, "von": zr.von.isoformat(), "bis": zr.bis.isoformat(), "periode": zr.periode, "n": zr.n,
            "labels": list(zr.labels), "monat": zr.monat, "jahr": zr.jahr}


# ------------------------------------------------------------------ Abrechnung nach Firma


def werte_je_tag(q: Quelle, je_tag: dict[str, dict[date, float]]) -> dict[str, list[tuple[datetime, float]]]:
    """kWh je Container und Tag (Bericht) in der Form von `logik/auswertung.abrechnung`."""
    zone = _zone()
    return {b["id"]: [(a.mitternacht(t, zone), k) for t, k in sorted(je_tag.get(b["id"], {}).items())] for b in q.bereiche}


def abrechnung_daten(
    quellen: list[Quelle], werte: Mapping[str, Mapping[str, Sequence[tuple[Any, float | None]]]], preis: float
) -> list[dict[str, Any]]:
    """Abrechnung je Firma und Container mit € und Anteil, Namen der Container und Baustellen (Seite und Bericht)."""
    zone = _zone()
    daten = a.abrechnung_geld(a.abrechnung([q.baustelle() for q in quellen], werte, zone), preis)
    titel = {q.entry.entry_id: q.entry.title for q in quellen}
    namen = {(q.entry.entry_id, b["id"]): b["name"] for q in quellen for b in q.bereiche}
    return [
        {**z, "id": EIGEN if z["eigen"] else z["firma"],
         "container": [{**c, "titel": titel[c["entry"]], "name": namen[(c["entry"], c["bereich"])]} for c in z["container"]]}
        for z in daten
    ]


def csv_abrechnung(quellen: list[Quelle], daten: list[dict[str, Any]], zeitraum: str, preis: float) -> str:
    """Abrechnung je Firma und Container als CSV-Datei (Seite „Abrechnung als CSV“ und Anhang des Berichts)."""
    return a.csv_text(a.csv_firma(daten, [q.baustelle() for q in quellen], zeitraum, preis))


async def async_abrechnung(
    hass: HomeAssistant, entry: ConfigEntry, art: str, versatz: int = 0, scope: str = "diese"
) -> dict[str, Any]:
    """Befehl `baustelle/abrechnung`: Tabelle je Firma und Container, Verbrauch je Firma und Periode, beide CSV."""
    zone, heute = _zone(), dt_util.now().date()
    zr = a.zeitraum(art, heute, versatz)
    haupt = quelle(hass, entry)
    quellen = [haupt] if scope == "diese" else [quelle(hass, e) for e in laufende(hass)]
    preis = haupt.preis
    # Tag je Stunde, sonst je Tag (auch beim Jahr: die Firma gilt je Tag)
    periode = "hour" if zr.periode == "hour" else "day"
    ids = [i for q in quellen for b in q.bereiche for i in q.energie_ids(b["id"])]
    roh = await async_statistik(hass, ids, a.mitternacht(zr.von, zone), a.mitternacht(zr.bis, zone), periode, {"change"})
    je_periode = a.reihen(zr, {i: roh.get(i, []) for i in ids}, zone)
    werte: dict[str, dict[str, list[tuple[Any, float | None]]]] = {}
    werte_zeitraum: dict[str, dict[str, list[tuple[Any, float | None]]]] = {}
    for q in quellen:
        eid = q.entry.entry_id
        werte[eid], werte_zeitraum[eid] = {}, {}
        for b in q.bereiche:
            teile = q.energie_ids(b["id"])
            je: dict[datetime, float] = {}
            for sid in teile:
                for p in roh.get(sid, []):
                    t = a.zeitpunkt(p["start"])
                    je[t] = je.get(t, 0.0) + (float(p["change"]) if a.ist_zahl(p.get("change")) else 0.0)
            werte[eid][b["id"]] = sorted(je.items())
            v = a.verbrauch(je_periode, teile, zr.n)
            werte_zeitraum[eid][b["id"]] = [(zr.beginn(i, zone), v[i]) for i in range(zr.n)]
    daten = abrechnung_daten(quellen, werte, preis)
    baustellen = [q.baustelle() for q in quellen]
    return {
        "zeitraum": _zeitraum_dict(zr), "preis": preis, "kwh": sum(z["kwh"] for z in daten), "firmen": daten,
        "reihen": a.firmen_reihen(baustellen, werte, zr, zone),
        "csv": {"firma": csv_abrechnung(quellen, daten, art, preis),
                "verbrauch": a.csv_text(a.csv_verbrauch(baustellen, werte_zeitraum, zr, preis, zone))},
    }


# ------------------------------------------------------------------ Auswertung


def _zustand(hass: HomeAssistant, entity_id: str | None) -> float | None:
    s = hass.states.get(entity_id) if entity_id else None
    return float(s.state) if s is not None and a.ist_zahl(s.state) else None


async def _summen(hass: HomeAssistant, q: Quelle, zr: a.Zeitraum) -> dict[str, Any]:
    """kWh, Heizzeit (Container), Pumpzeit und „ohne Automatik“ einer Baustelle im Zeitraum; dazu die Pumpzeit je Pumpe."""
    zone, eid = _zone(), q.entry.entry_id
    container = [b for b in q.bereiche if b["art"] == ART_CONTAINER]
    alle = [*(i for b in q.bereiche for i in q.energie_ids(b["id"])), *(q.eid(b["id"], "heizzeit") for b in container),
            *(q.eid(g["id"], "pumpzeit") for g in q.pumpen()), q.eid(eid, "energie_ohne_automatik")]
    ids = [i for i in alle if i]
    roh = await async_statistik(hass, ids, a.mitternacht(zr.von, zone), a.mitternacht(zr.bis, zone), zr.periode,
                                {"change", "mean"})
    w = a.reihen(zr, {i: roh.get(i, []) for i in ids}, zone)
    leer: list[float | None] = [None] * zr.n
    pumpzeit = {g["id"]: w.get(q.eid(g["id"], "pumpzeit") or "", leer) for g in q.pumpen()}
    return {
        "kwh": sum(a.summe(a.verbrauch(w, q.energie_ids(b["id"]), zr.n)) for b in q.bereiche),
        "heizzeit": sum(a.summe(w.get(q.eid(b["id"], "heizzeit") or "", leer)) for b in container),
        "pumpzeit": sum(a.summe(v) for v in pumpzeit.values()),
        "ohne": a.summe(w.get(q.eid(eid, "energie_ohne_automatik") or "", leer)),
        "pumpzeit_je": pumpzeit,
    }


async def async_verlauf(hass: HomeAssistant, q: Quelle) -> dict[str, Any]:
    """Verlauf einer Baustelle: Kennzahlen (kWh, €, gespart, Heiztage, Monate, Vergleich), kWh je Monat, Verbrauch je
    Monat und Container mit CSV (Seite „Verlauf“ und Detailseite)."""
    zone, heute, eid = _zone(), dt_util.now().date(), q.entry.entry_id
    beginn, ende = q.option_datum(CONF_BEGINN), q.option_datum(CONF_ENDE)
    von, bis = a.verlauf_zeitraum(heute, beginn, ende)
    energie = q.eid(eid, "energie")
    heizzeit = {b["id"]: i for b in q.bereiche if b["art"] == ART_CONTAINER and (i := q.eid(b["id"], "heizzeit"))}
    roh = await async_statistik(hass, [energie, *heizzeit.values()], a.mitternacht(von, zone), a.mitternacht(bis, zone),
                                "day", {"change"})
    vw = a.verlauf_werte(roh.get(energie) if energie else None, {b: roh.get(i, []) for b, i in heizzeit.items()}, zone,
                         beginn, q.zaehler.get("heiztage"))
    zustaende = {k: _zustand(hass, q.eid(eid, k)) for k in ("energie", "kosten", "ersparnis")}
    kennzahlen = a.kennzahlen(q.zaehler, zustaende, q.preis, len(q.bereiche), vw["heiztage"], vw["monate"])
    # Verbrauch je Monat und Container
    m_von, m_bis, monate = a.monate_zeitraum(heute, beginn, ende)
    bereiche = [{"id": b["id"], "name": b["name"], "energie": q.eid(b["id"], "energie")} for b in q.bereiche]
    roh_m = await async_statistik(hass, [b["energie"] for b in bereiche], a.mitternacht(m_von, zone),
                                  a.mitternacht(m_bis, zone), "month", {"change"})
    je_monat = a.monate_je_container(monate, bereiche, roh_m, zone)
    return {
        **kennzahlen, "je_monat": vw["je_monat"],
        "monate_je_container": {"labels": je_monat["labels"],
                                "reihen": [{"bereich": b["id"], **r, **x} for b, r, x in
                                           zip(bereiche, je_monat["reihen"], a.monate_summen(je_monat["reihen"], q.preis),
                                               strict=True)]},
        "csv": a.csv_text(a.csv_monate(q.entry.title, q.preis, je_monat)),
    }


async def async_auswertung(
    hass: HomeAssistant, entry: ConfigEntry, art: str, versatz: int = 0, scope: str = "diese"
) -> dict[str, Any]:
    """Befehl `baustelle/auswertung`: Kennzahlen des Zeitraums (mit Vergleich zum Zeitraum davor), Ohne Automatik, Je
    Gerät, Wetter-Einfluss, Ölradiator/Konvektor und Heizperiode."""
    zone, heute, eid = _zone(), dt_util.now().date(), entry.entry_id
    zr, zr_vorher = a.zeitraum(art, heute, versatz), a.zeitraum(art, heute, versatz + 1)
    q = quelle(hass, entry)
    quellen = [q] if scope == "diese" else [q if e.entry_id == eid else quelle(hass, e) for e in laufende(hass)]
    jetzt = [await _summen(hass, x, zr) for x in quellen]
    vorher = [await _summen(hass, x, zr_vorher) for x in quellen]
    summen = {k: sum(s[k] for s in jetzt) for k in ("kwh", "heizzeit", "pumpzeit", "ohne")}
    davor = {k: sum(s[k] for s in vorher) for k in ("kwh", "heizzeit", "pumpzeit")}
    preis = q.preis
    # Je Gerät (diese Baustelle): kWh aus den Energiezählern der Geräte, Pumpzeit aus der Statistik
    eigene = next((s for x, s in zip(quellen, jetzt, strict=True) if x is q), None) or await _summen(hass, q, zr)
    g_ids = sorted({g["energie"] for g in q.geraete if g["energie"]})
    roh_g = await async_statistik(hass, g_ids, a.mitternacht(zr.von, zone), a.mitternacht(zr.bis, zone), zr.periode,
                                  {"change"})
    # Wetter-Einfluss: letzte 30 Heiztage dieser Baustelle
    w_von, w_bis = a.tageswerte_zeitraum(heute)
    en = [i for b in q.bereiche if (i := q.eid(b["id"], "energie"))]
    aussen = q.eid(eid, "aussen")
    roh_w = await async_statistik(hass, [*en, aussen] if aussen else [], a.mitternacht(w_von, zone),
                                  a.mitternacht(w_bis, zone), "day", {"change", "mean"})
    punkte = a.tageswerte(roh_w, en, aussen, heute, zone)
    # Ölradiator oder Konvektor: Heiztage wie im Verlauf (Zähler, sonst aus der Heizzeit)
    verlauf = await async_verlauf(hass, q)
    typ = a.typ_vergleich(
        [{"id": b["id"], "geraete": [g for g in q.geraete if g["bereich"] == b["id"]]} for b in q.bereiche], q.zaehler,
        {t: _zustand(hass, q.eid(eid, f"energie_{t}")) for t in TYPEN},
        {t: _zustand(hass, q.eid(eid, f"heizzeit_{t}")) for t in TYPEN}, verlauf["heiztage"], preis,
    )
    hp_von = min(12, max(1, int(entry.options.get(CONF_HEIZPERIODE_VON) or 10)))
    hp_bis = min(12, max(1, int(entry.options.get(CONF_HEIZPERIODE_BIS) or 4)))
    return {
        "zeitraum": _zeitraum_dict(zr), "preis": preis,
        "summen": {**summen, "eur": a.geld(summen["kwh"], preis), "vorher": davor,
                   "veraenderung": {k: a.veraenderung(summen[k], davor[k]) for k in davor},
                   "ohne_automatik": a.ohne_automatik(summen["kwh"], summen["ohne"], preis)},
        "je_geraet": [{**z, "eur": a.geld(z["kwh"], preis)}
                      for z in a.je_geraet(q.geraete, q.zaehler, roh_g, eigene["pumpzeit_je"])],
        "wetter": {"punkte": punkte, "gerade": a.wetter_kosten(a.wetter_einfluss(punkte), preis)},
        "typ": typ,
        "heizperiode": {"ende": a.heizperiode_ende(heute, hp_von, hp_bis).isoformat(),
                        "bis": a.heizperiode_bis(heute, hp_von, hp_bis, q.option_datum(CONF_ENDE)).isoformat()},
        "heiztage": verlauf["heiztage"],
        # Hochrechnung (Sensoren prognose_heizperiode*, Zähler energie_heizen) in kWh und € – die Seite zeigt sie nur an
        "hochrechnung": a.hochrechnung_werte(
            q.zaehler.get("energie_heizen"), _zustand(hass, q.eid(eid, "prognose_heizperiode")),
            _zustand(hass, q.eid(eid, "prognose_heizperiode_ohne")), preis),
    }
