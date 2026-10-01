"""Funktion Heizung: Container nach Plan, Wetter und Bedarf heizen (Bauplan 0.7 §2, Bauplan Module §3).

Heizplan je Tag (`logik/arbeitszeit.tagesplan` mit Vor-/Nachheizen, Frühstart, Kleidung trocknen, „Noch früher“),
Heizgrenze, freie Tage, Soll je Container (`logik/regelung.soll_container`), Modus, Handbetrieb, Bedarf/Boost/„alle
jetzt heizen“, Termine der Bedarfs-Container aus `termine_kalender`, Tür offen, Frostschutz bei Automatik aus, Vorrang
in der Staffelung, Wetter-Entscheidung im Protokoll, Anzeige der Container, Warnungs-Zustände der Container und die
Zähler der Heizung (Heizzeit, Heiztage, mittlere Leistung, „ohne Automatik“, Aufheiz-/Abkühlrate, Hochrechnung auf die
Heizperiode). Geschaltet wird im Kern über die Staffelung: nur Heizkörper; Bautrockner zählen nur mit.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.const import STATE_ON
from homeassistant.util import dt as dt_util

from ..const import (
    ART_CONTAINER,
    TYP_OELRADIATOR,
    CONF_ENDE,
    CONF_HEIZPERIODE_BIS,
    CONF_HEIZPERIODE_VON,
    CONF_HEIZUNG,
    HEIZROLLEN,
    ROLLE_HEIZKOERPER,
    ZIEHT_STROM_W,
)
from .. import texte
from ..logik import bedarf as bedarf_logik, lernen, stufen
from ..logik import warnungen as warn_logik
from ..logik.arbeitszeit import (
    AusnahmeArt,
    HeizRegeln,
    Plan,
    StatusArt,
    WarmAb,
    ausnahme_am,
    frei_gilt,
    bedarf_fenster,
    im_fenster,
    status as plan_status,
    tagesplan,
    uhrzeit,
)
from ..logik.regelung import FUEHLER_HALTEN_MIN, HAND_NACHFRIST_MIN, HandEnde, LageContainer, Soll, SollGrund, hand_ende, letzter_wert, soll_container
from ..logik.zaehlen import (
    ABKUEHL_MIN_H,
    AUFHEIZ_MIN_H,
    gradstunden,
    hochrechnung,
    mittel,
    mittel_im_betrieb,
    rate,
    tage_heizperiode,
)
from ..texte import GRUND_TEXT, wochentag
from .basis import ZAEHLER_SPEICHERN_S, Funktion, ev_zeit, minuten_seit, mitternacht, zahl, zeit

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from ..logik.warnungen import Warnung
    from ..steuerung import BereichInfo, GeraetInfo, Steuerung, WetterWerte
    from .basis import SollJeBereich

HEIZ_GRUENDE = {
    SollGrund.FRUEHSTART, SollGrund.VORHEIZEN, SollGrund.ARBEITSZEIT, SollGrund.NACHHEIZEN, SollGrund.TROCKNEN,
    SollGrund.BEDARF, SollGrund.BOOST, SollGrund.FROST, SollGrund.ABSENKEN,
}
# lernende Regelung: nur in diesen Gründen regelt der Container selbst (K außen lernen)
LERN_GRUENDE = {
    SollGrund.FRUEHSTART, SollGrund.VORHEIZEN, SollGrund.ARBEITSZEIT, SollGrund.NACHHEIZEN, SollGrund.TROCKNEN,
    SollGrund.BEDARF, SollGrund.ABSENKEN,
}
HAND_ENDE_TEXT = {   # Protokoll, wenn die Automatik einen Heizkörper aus dem Handbetrieb übernimmt (FE-0004)
    HandEnde.VORRANG: "Automatik übernimmt ({grund})",
    HandEnde.SOLL: "Soll {soll} °C erreicht – Automatik übernimmt",
    HandEnde.DAUER: "{h} h von Hand, keine Antwort – Automatik übernimmt",
    HandEnde.SCHALTPUNKT: "Automatik übernimmt ({grund})",
}
MODUS_TEXT = {"plan": "Zeitplan", "thermo": "Thermostat", "bedarf": "Bei Bedarf", "hand": "Hand", "aus": "Aus"}
MODI = tuple(MODUS_TEXT)
STANDARD_HEIZ_KW = 2.0  # Heizkörper ohne Messung (Mockup: 2,0 kW)
FRUEHSTART_NACHRICHT = time(18, 0)  # Abend vorher: „Morgen −4 °C – Vorheizen startet schon um …“
FRUEHER_MIN = 30  # Knopf „Noch früher“
WETTER_PROTOKOLL_AB = time(5, 0)  # Mockup: „05:00 wetter …“


class Heizung(Funktion):
    """Heizkörper und Bautrockner in Containern."""

    name = "heizung"
    option = CONF_HEIZUNG
    standard = True
    arten = (ART_CONTAINER,)
    rollen = HEIZROLLEN
    schaltet = True
    braucht_wetter = True
    standard_kw = STANDARD_HEIZ_KW
    staffel_feld = "heiz_kw"

    def __init__(self, st: Steuerung) -> None:
        super().__init__(st)
        self.termine: list[dict[str, Any]] = []  # Termine der Bedarfs-Container (api-0.7 §1 `termine`)
        self.plaene: dict[str, Plan | None] = {}  # Heizplan je Container von heute (letzte Auswertung)
        # lernende Regelung (0.8): Anteil und erwarteter Nachlauf je Container (letzte Auswertung), Grund, Lern-Minute
        self.tpi_jetzt: dict[str, tuple[float, float]] = {}
        self._lern_grund: dict[str, str] = {}
        self._lern_minute: dict[str, int] = {}
        self._plan_cache: dict[tuple[date, bool, WarmAb | None], Plan | None] = {}
        self._zu_warm_vorher: bool | None = None
        # Knopf „Trotzdem heizen“: heizt trotz offener Tür, bis sie zu ist – im Store, übersteht Neustarts (Szenarien)
        self.tuer_trotzdem: set[str] = set()   # wird bei der ersten Auswertung aus dem Store geladen
        self._trotzdem_geladen = False
        self._frost: dict[str, bool] = {}
        self._tuer_pause: dict[str, bool] = {}   # war zuletzt wegen offener Tür pausiert
        self._grund_beim_heizen: dict[str, str | None] = {}   # Grund der letzten Minute, in der geheizt wurde (K innen)
        self._grund_letzte_minute: dict[str, str | None] = {}
        self._strom_jetzt: set[str] = set()   # AN-0011: Container, deren Heizkörper in diesem Zählschritt Strom ziehen
        self._unter_soll_seit: dict[str, datetime] = {}
        self._hand_phase: dict[str, bool] = {}
        self._phase: dict[str, tuple[bool, datetime, float]] = {}  # Bereich → (heizt, seit, Temperatur beim Beginn)
        self._ohne_w = 0.0  # je Zählschritt: Summe der mittleren Leistung („ohne Automatik“)
        self._heiztag = False
        # Zusatz-Heizkörper (AN-0006): darf er laufen (mit Grund), seit wann läuft der Hauptheizkörper (mit Temperatur)
        self._stufen: dict[str, tuple[bool, str | None]] = {}
        self._haupt_lauf: dict[str, tuple[datetime, float | None]] = {}
        self._zusatz_gelernt: dict[str, bool] = {}
        # Bedarf in °C für die Staffelung (Herbert 01.10.2026): Temperaturen der letzten Minuten, Heizzeit der letzten
        # Stunde, Zielzeit (Arbeitsbeginn bzw. „Soll erreicht … vorher“) und der zuletzt gerechnete Bedarf
        self._temp_punkte: dict[str, list[tuple[datetime, float]]] = {}
        self._heiz_punkte: dict[str, list[tuple[datetime, float]]] = {}
        self._warm_vor: dict[str, int] = {}
        self.bedarf_jetzt: dict[str, bedarf_logik.Bedarf] = {}
        self._abkuehl_zuletzt: dict[str, float] = {}   # zuletzt gemessene Abkühlung ohne Heizen (°C/h)

    # ------------------------------------------------------------------ Einstellungen je Container
    def modus(self, bid: str) -> str:
        """Modus eines Containers (neu 0.7.8): gesetzt oder wie bisher aus `auto`, `bedarf` und dem Fühler abgeleitet."""
        e = self.st.einstellungen.bereich(bid)
        if e.get("modus") in MODI:
            return str(e["modus"])
        if e["bedarf"]:
            return "bedarf"
        if not e["auto"]:
            return "hand"
        info = self.st.bereiche.get(bid)
        return "thermo" if info is not None and info.fuehler else "plan"

    def soll_temperatur(self, bid: str) -> float:
        b = self.st.einstellungen.bereich(bid)
        return float(b["soll"] if b.get("soll") is not None else self.st.e["heizung"]["soll"])

    def jetzt_bis(self, jetzt: datetime) -> datetime | None:
        bis = zeit(self.st.lz.get("jetzt_bis"))
        return bis if bis is not None and bis > jetzt else None

    def bis(self, art: str, bid: str, jetzt: datetime) -> datetime | None:
        bis = zeit(self.st.lz[art].get(bid))
        return bis if bis is not None and bis > jetzt else None

    def aufraeumen(self, jetzt: datetime) -> bool:
        st, lz = self.st, self.st.lz
        self._plan_cache.clear()
        geaendert = False
        for art in ("bedarf_bis", "boost_bis"):
            for bid, bis in list(lz[art].items()):
                ende = zeit(bis)
                if ende is None or ende <= jetzt or bid not in st.bereiche:
                    del lz[art][bid]
                    geaendert = True
                    if art == "bedarf_bis" and bid in st.bereiche and ende is not None:
                        st.protokoll("schalten", bid, "Bedarf vorbei – heizt wieder nur bei Bedarf")
        if lz.get("jetzt_bis") and self.jetzt_bis(jetzt) is None:
            lz["jetzt_bis"] = None
            geaendert = True
            st.protokoll("schalten", None, "„Alle jetzt heizen“ beendet")
        for gid in [g for g in lz["hand"] if g not in st.geraete]:
            del lz["hand"][gid]
            geaendert = True
        grenze = (jetzt.date() - timedelta(days=1)).isoformat()
        for iso in [k for k in lz.get("frueher", {}) if k < grenze]:
            del lz["frueher"][iso]
        return geaendert

    def _termin_fenster(self, bid: str) -> list[tuple[datetime, datetime, bool]]:
        """Termine eines Bedarfs-Containers als (von, bis, boost)."""
        return [
            (von, bis, bool(t.get("boost")))
            for t in self.termine
            if t["bereich"] == bid and (von := zeit(t["von"])) is not None and (bis := zeit(t["bis"])) is not None
        ]

    # ------------------------------------------------------------------ Einrichtung und Kalender
    def entitaeten(self) -> set[str]:
        """Türkontakte der Container."""
        return {t for b in self.bereiche() if (t := self.st.einstellungen.bereich(b.id).get("tuer"))}

    def kalender_neu(self, pfad: tuple[str, ...]) -> bool:
        # Termine gehören nur zu Bedarfs-Containern: nach dem Umstellen gleich neu zuordnen, nicht erst in 15 min
        return pfad[0] == "termine_kalender" or pfad[-1] == "bedarf"

    async def async_kalender(self, start: datetime, ende: datetime) -> None:
        """Termine der Bedarfs-Container aus `termine_kalender` (Serien löst der Kalender auf)."""
        st = self.st
        kalender = st.e.get("termine_kalender")
        events = await st.async_events(kalender, start, ende)
        details = await st.async_event_details(kalender, start, ende) if events else {}
        bedarf = [b for b in self.bereiche() if st.einstellungen.bereich(b.id).get("bedarf")]
        termine: list[dict[str, Any]] = []
        for ev in events:
            von, bis = ev_zeit(ev.get("start")), ev_zeit(ev.get("end"))
            if von is None or bis is None:
                continue
            bid = _termin_bereich(ev, bedarf)
            if bid is None:
                continue
            uid, rrule = details.get((von.isoformat(), str(ev.get("summary") or "")), ("", None))
            termine.append({
                "bereich": bid, "von": von.isoformat(), "bis": bis.isoformat(),
                "titel": str(ev.get("summary") or ""), "uid": uid, "rrule": rrule,
                "wiederholung": _wiederholung(rrule), "boost": "boost" in str(ev.get("description") or "").lower(),
            })
        self.termine = sorted(termine, key=lambda t: t["von"])

    # ------------------------------------------------------------------ Plan
    def heiz_regeln(self) -> HeizRegeln:
        h = self.st.e["heizung"]
        return HeizRegeln(
            vorheizen_min=int(h["vorheizen_min"]), nachheizen_min=int(h["nachheizen_min"]),
            fruehstart=bool(h["fruehstart"]), fruehstart_unter=float(h["fruehstart_unter"]),
            fruehstart_min=int(h["fruehstart_min"]), trocknen_ab_mm=float(h["trocknen_ab_mm"]),
            trocknen_laenger_min=int(h["trocknen_laenger_min"]), trocknen_frueher_min=int(h["trocknen_frueher_min"]),
        )

    def ist_frei(self, tag: date) -> bool:
        """Urlaub immer, Feiertag nur mit „Feiertage frei“."""
        art = self.st.frei_art(tag)
        return art == "urlaub" or (art == "feiertag" and bool(self.st.e["heizung"]["feiertag_frei"]))

    def plan(self, tag: date, trocknen: bool, warm: WarmAb | None = None) -> Plan | None:
        """Heizplan eines Tages (logik/arbeitszeit.tagesplan), dazu „Noch früher“ aus der Nachricht.

        Je Auswertung zwischengespeichert (sie läuft bei jeder Zustandsänderung, z. B. jedem Leistungswert).
        `warm`: lernender Container mit „Warm ab“ (AN-0004, `warm_ab`).
        """
        if (tag, trocknen, warm) in self._plan_cache:
            return self._plan_cache[(tag, trocknen, warm)]
        st = self.st
        p = tagesplan(
            tag, st.arbeitszeiten(), st.ausnahmen(), self.heiz_regeln(), st.wetter_tag_plan(tag), trocknen,
            frei=self.ist_frei(tag), warm=warm,
        )
        extra = int(st.lz.get("frueher", {}).get(tag.isoformat()) or 0)
        if p is not None and extra:
            p = replace(p, start=max(0, p.start - extra))
        self._plan_cache[(tag, trocknen, warm)] = p
        return p

    def plan_bereich(self, tag: date, bid: str, jetzt: datetime | None = None) -> Plan | None:
        """Heizplan eines Containers: mit „Warm ab“, wenn er lernt (AN-0004), sonst der Plan der Baustelle."""
        e = self.st.einstellungen.bereich(bid)
        return self.plan(tag, bool(e["trocknen"]), self.warm_ab(bid, tag, jetzt or dt_util.now()))

    # ------------------------------------------------------------------ Warm ab (AN-0004, Optimum Start)
    def warm_ab(self, bid: str, tag: date, jetzt: datetime) -> WarmAb | None:
        """„Warm ab“ eines lernenden Containers im Modus Thermostat; None für alle anderen.

        Die Aufheizzeit kommt aus dem Lernstand und der Temperatur von jetzt. Hat der Container heute schon nach dem
        gelernten Beginn zu heizen begonnen, bleibt sie für den Tag fest – sonst rutschte der Beginn mit dem Aufheizen
        wieder nach hinten.
        """
        st = self.st
        e = st.einstellungen.bereich(bid)
        info = st.bereiche.get(bid)
        if info is None or not info.fuehler or not e.get("lernen") or self.modus(bid) != "thermo":
            return None
        h = st.e["heizung"]
        fest = st.lz.setdefault("warm_start", {}).get(bid)
        vor = int(e["warm_vor"] if e.get("warm_vor") is not None else h.get("warm_vor_min", 0))
        grenze = max(int(h.get("warm_max_min", 120)), vor)
        if fest and fest[0] == tag.isoformat():
            auf: int | None = int(fest[1])
            self._zusatz_gelernt[bid] = bool(fest[2]) if len(fest) > 2 else False
        else:
            stand = self.lern_staende.get(bid) or {}
            ein = dict(innen=st.temperatur(info.fuehler), soll=self.soll_temperatur(bid), aussen=st.daten.wetter.aussen)
            alle = len(self.heizer_von(bid)) or 1
            if self.stufen_an(bid):   # AN-0006: reicht der Hauptheizkörper allein bis „Soll erreicht“? Sonst beide
                auf1, aufa = lernen.aufheiz_min(stand, **ein, anzahl=1), lernen.aufheiz_min(stand, **ein, anzahl=alle)
                if auf1 is not None and vor + auf1 <= grenze:
                    auf, self._zusatz_gelernt[bid] = auf1, False
                else:
                    auf, self._zusatz_gelernt[bid] = (aufa if aufa is not None else auf1), auf1 is not None or aufa is not None
            else:
                auf, self._zusatz_gelernt[bid] = lernen.aufheiz_min(stand, **ein, anzahl=alle), False
        return WarmAb(
            vor_min=int(e["warm_vor"] if e.get("warm_vor") is not None else h.get("warm_vor_min", 0)),
            nach_min=int(e["warm_nach"] if e.get("warm_nach") is not None else h.get("warm_nach_min", 0)),
            max_min=int(h.get("warm_max_min", 120)), aufheiz_min=auf,
        )

    def _warm_festhalten(self, bid: str, warm: WarmAb | None, plan: Plan | None, heute: date, minute: int) -> None:
        """Ab dem gelernten Beginn bis Arbeitsbeginn die Aufheizzeit des Tages festhalten (im Store, übersteht Neustarts)."""
        fest = self.st.lz.setdefault("warm_start", {})
        if fest.get(bid) and fest[bid][0] != heute.isoformat():
            del fest[bid]
        if warm is None or warm.aufheiz_min is None or plan is None or bid in fest:
            return
        if plan.vor <= minute < plan.a:
            fest[bid] = [heute.isoformat(), warm.aufheiz_min, bool(self._zusatz_gelernt.get(bid))]
            self.st.einstellungen.speichern()

    def plan_neu(self) -> None:
        """Nach einer Änderung an Arbeitszeit, Ausnahmen oder „Noch früher“ neu rechnen."""
        self._plan_cache.clear()

    def zu_warm(self, wetter: WetterWerte) -> bool:
        """Heizgrenze überschritten (Tageshöchstwert oder Wert von jetzt, Einstellung `heizgrenze_basis`)."""
        h = self.st.e["heizung"]
        wert = wetter.aussen_max if h["heizgrenze_basis"] == "tageshoechst" else wetter.aussen
        return wert is not None and wert > float(h["heizgrenze"])

    # ------------------------------------------------------------------ Soll
    def soll(self, jetzt: datetime, wetter: WetterWerte) -> SollJeBereich:
        st = self.st
        hass = st.hass
        heute, minute = jetzt.date(), jetzt.hour * 60 + jetzt.minute
        h = st.e["heizung"]
        jetzt_bis = self.jetzt_bis(jetzt)
        if not self._trotzdem_geladen:   # der Store ist erst nach dem Anlegen der Funktion geladen
            self.tuer_trotzdem |= set(st.lz.get("tuer_trotzdem") or [])
            self._trotzdem_geladen = True
        frei_heute = frei_gilt(self.ist_frei(heute), ausnahme_am(st.ausnahmen(), heute))   # Ausnahme „Arbeit“ geht vor
        zu_warm = self.zu_warm(wetter)
        ergebnis: dict[str, tuple[Soll, LageContainer]] = {}
        for info in self.bereiche():
            bid = info.id
            e = st.einstellungen.bereich(bid)
            warm_ab = self.warm_ab(bid, heute, jetzt)   # nicht `warm` – das ist unten „zu warm“ (Heizgrenze)
            plan = self.plan(heute, bool(e["trocknen"]), warm_ab)
            self._warm_festhalten(bid, warm_ab, plan, heute, minute)
            self.plaene[bid] = plan
            self._warm_vor[bid] = warm_ab.vor_min if warm_ab is not None else 0
            frei, warm = frei_heute, zu_warm
            if jetzt_bis is not None:
                # „alle jetzt heizen“: wie in der Arbeitszeit, auch an freien Tagen und über der Heizgrenze (§5)
                ende = 24 * 60 if jetzt_bis.date() > heute else jetzt_bis.hour * 60 + jetzt_bis.minute
                if plan is None or not (plan.start <= minute < plan.ende):
                    plan = Plan(start=minute, vor=minute, a=minute, b=max(minute + 1, ende), nach=max(minute + 1, ende),
                                ende=max(minute + 1, ende))
                frei, warm = False, False
            temp = self.temperatur_gehalten(bid, info.fuehler, jetzt)   # Fühler kurz weg: letzter Wert (Szenarien)
            soll_t = self.soll_temperatur(bid)
            tuer_min = None
            tuer = e.get("tuer")
            if tuer and (s := hass.states.get(tuer)) is not None and s.state == STATE_ON:
                if bid not in self.tuer_trotzdem:
                    tuer_min = minuten_seit(dt_util.as_local(s.last_changed), jetzt)
            else:
                if bid in self.tuer_trotzdem:
                    self.tuer_trotzdem.discard(bid)
                    self.trotzdem_merken()
            fenster = self._termin_fenster(bid)
            aktive = [f for f in fenster if im_fenster(bedarf_fenster([(f[0], f[1])], int(h["vorheizen_min"])), jetzt)]
            bedarf_aktiv = self.bis("bedarf_bis", bid, jetzt) is not None or bool(aktive) or jetzt_bis is not None
            boost = self.bis("boost_bis", bid, jetzt) is not None or any(f[2] for f in aktive)
            if boost and temp is not None and temp >= soll_t and bid in st.lz["boost_bis"]:
                del st.lz["boost_bis"][bid]  # Soll erreicht: Boost beendet (Aufrufer, Bauplan §2.2)
                st.einstellungen.speichern()
                boost = False
            heizer = [g for g in st.geraete_in(bid) if g.rolle == ROLLE_HEIZKOERPER and g.id not in st.lz["hand"] and st.geraet_aktiv(g)]
            heizt = any((s := hass.states.get(g.schalter)) is not None and s.state == STATE_ON for g in heizer)
            lage = LageContainer(
                minute=minute, plan=plan, automatik=st.automatik, auto=bool(e["auto"]), temperatur=temp, soll=soll_t,
                frost=bool(h["frost"]), frost_grenze=float(h["frost_grenze"]), zu_warm=warm, frei=frei,
                tuer_offen_min=tuer_min, bedarf=bool(e["bedarf"]), bedarf_aktiv=bedarf_aktiv, boost=boost,
                heizt_gerade=heizt, toleranz=float(h["toleranz"]), frost_vorher=self._frost.get(bid, False),
                modus=self.modus(bid), frost_aus=None if h.get("frost_aus") is None else float(h["frost_aus"]),
                frei_modus=str(h.get("frei_modus") or "frost"), absenk=float(h.get("absenk") or 10.0),
                frost_immer=bool(h.get("frost_immer")), tpi=self._tpi(info, e, temp, soll_t, wetter, jetzt),
                aussen=wetter.aussen, frost_aussen=None if h.get("frost_aussen") is None else float(h["frost_aussen"]),
                laeuft_gerade=any((z := hass.states.get(g.schalter)) is not None and z.state == STATE_ON
                                  for g in st.geraete_in(bid) if g.rolle == ROLLE_HEIZKOERPER),
                tuer_vorher=self._tuer_pause.get(bid, False),
            )
            soll = soll_container(lage, int(h["tuer_pause_min"]))
            self._lern_grund[bid] = soll.grund
            self._frost[bid] = soll.grund == SollGrund.FROST
            self._tuer_pause[bid] = soll.grund == SollGrund.TUER_OFFEN
            self._stufen_rechnen(bid, soll, temp, soll_t, wetter, jetzt, plan, minute, warm_ab)
            ergebnis[bid] = (soll, lage)
        return ergebnis

    def trotzdem_merken(self) -> None:
        """„Trotzdem heizen“ im Store festhalten (übersteht einen Neustart)."""
        self.st.lz["tuer_trotzdem"] = sorted(self.tuer_trotzdem)
        self.st.einstellungen.speichern()

    def temperatur_gehalten(self, bid: str, fuehler: str | None, jetzt: datetime) -> float | None:
        """Raumtemperatur; meldet der Fühler kurz nichts (Funk, HA-Start), gilt so lange der letzte Wert (Einstellung
        `fuehler_halten_min`, AN-0012; logik/regelung)."""
        if not fuehler:
            return None
        wert = self.st.temperatur(fuehler)
        zuletzt = self.st.lz.setdefault("fuehler_zuletzt", {})
        if wert is not None:
            punkte = self._temp_punkte.setdefault(bid, [])   # für den Trend (Bedarf in °C)
            if not punkte or (jetzt - punkte[-1][0]).total_seconds() >= 30:
                punkte.append((jetzt, wert))
                while punkte and (jetzt - punkte[0][0]).total_seconds() > bedarf_logik.TREND_FENSTER_MIN * 60 + 120:
                    punkte.pop(0)
            if not zuletzt.get(bid) or zuletzt[bid][1] != wert:
                zuletzt[bid] = [jetzt.isoformat(timespec="seconds"), wert]
            else:
                zuletzt[bid][0] = jetzt.isoformat(timespec="seconds")
            return wert
        z = zuletzt.get(bid)
        halten = float(self.st.e["heizung"].get("fuehler_halten_min", FUEHLER_HALTEN_MIN))
        return letzter_wert(None, (zeit(z[0]), float(z[1])) if z and zeit(z[0]) else None, jetzt, halten)

    # ------------------------------------------------------------------ Zusatz-Heizkörper (AN-0006, logik/stufen)
    def heizer_von(self, bid: str) -> list[GeraetInfo]:
        """Aktive Heizkörper eines Containers in fester Reihenfolge."""
        return [g for g in self.st.geraete_in(bid) if g.rolle == ROLLE_HEIZKOERPER and self.st.geraet_aktiv(g)]

    def haupt_und_zusatz(self, bid: str) -> tuple[list[str], list[str]]:
        heizer = self.heizer_von(bid)
        markiert = {g.id for g in heizer if (self.st.e.get("geraete") or {}).get(g.id, {}).get("zusatz")}
        return stufen.haupt_und_zusatz([g.id for g in heizer], markiert)

    def stufen_an(self, bid: str) -> bool:
        """„Zusatz nur bei Bedarf“ eingeschaltet und mindestens zwei aktive Heizkörper."""
        return bool(self.st.einstellungen.bereich(bid).get("stufen")) and len(self.heizer_von(bid)) >= 2

    def stufen_regeln(self) -> stufen.StufenRegeln:
        h = self.st.e["heizung"]
        return stufen.StufenRegeln(abstand=float(h.get("stufen_abstand", 1.5)), laufzeit_min=int(h.get("stufen_min", 30)),
                                   min_anstieg=float(h.get("stufen_anstieg", 0.3)), kalt_unter=float(h.get("stufen_kalt", -5.0)))

    def _stufen_rechnen(self, bid: str, soll: Soll, temp: float | None, soll_t: float, wetter: WetterWerte, jetzt: datetime,
                        plan: Plan | None, minute: int, warm: WarmAb | None = None) -> None:
        """Je Auswertung: darf der Zusatz laufen? Merkt, seit wann der Hauptheizkörper durchgehend zieht."""
        if not self.stufen_an(bid):
            self._stufen.pop(bid, None)
            self._haupt_lauf.pop(bid, None)
            return
        haupt, _ = self.haupt_und_zusatz(bid)
        zieht = any(self._zieht_strom(g) for g in self.heizer_von(bid) if g.id in haupt)
        if zieht and bid not in self._haupt_lauf:
            self._haupt_lauf[bid] = (jetzt, temp)
        elif not zieht:
            self._haupt_lauf.pop(bid, None)
        seit, temp0 = self._haupt_lauf.get(bid, (jetzt, temp))
        vorher, grund_vorher = self._stufen.get(bid, (False, None))
        im_vorheizen = plan is not None and plan.vor <= minute < plan.a and warm is not None and warm.aufheiz_min is not None
        gelernt = im_vorheizen and bool(self._zusatz_gelernt.get(bid))
        h = self.st.e["heizung"]
        # Ziel nach Grund: beim Absenken das Absenk-Ziel, beim Frostschutz „aus über“, sonst das Soll (Szenario-Befund)
        ziel = (float(h.get("absenk") or 10.0) if soll.grund == SollGrund.ABSENKEN
                else (float(h["frost_aus"]) if h.get("frost_aus") is not None and float(h["frost_aus"]) > float(h["frost_grenze"])
                      else float(h["frost_grenze"]) + 2.0) if soll.grund == SollGrund.FROST
                else soll_t)
        lage = stufen.StufenLage(
            innen=temp, soll=ziel, aussen=wetter.aussen, toleranz=float(h["toleranz"]), einer_reicht=im_vorheizen and not gelernt,
            haupt_min=(jetzt - seit).total_seconds() / 60, anstieg=(temp - temp0) if temp is not None and temp0 is not None else 0.0,
            boost=soll.grund == SollGrund.BOOST, gelernt=gelernt, zusatz_an=vorher, grund_vorher=grund_vorher,
        )
        an, grund = stufen.zusatz(self.stufen_regeln(), lage) if soll.ein else (False, None)
        if an != vorher and soll.ein:
            self.st.protokoll("schalten", bid, f"Zusatz-Heizkörper dazu – {stufen.TEXT.get(grund or '', '')}" if an else "Zusatz-Heizkörper wieder aus – einer reicht")
        self._stufen[bid] = (an, grund)

    def geraet_ein(self, g: GeraetInfo, soll: Soll) -> bool | None:
        """Zusatz-Heizkörper bleibt aus, solange einer reicht (AN-0006); sonst wie der Container."""
        if soll.ein and g.rolle == ROLLE_HEIZKOERPER and self.stufen_an(g.bereich) and g.id in self.haupt_und_zusatz(g.bereich)[1]:
            return self._stufen.get(g.bereich, (False, None))[0]
        return soll.ein

    def stufen_anzeige(self, bid: str) -> dict[str, Any] | None:
        """Zusatz-Heizkörper für die Seite (laufzeit.container.<id>.stufen); None ohne zwei Heizkörper."""
        if len(self.heizer_von(bid)) < 2:
            return None
        haupt, zusatz = self.haupt_und_zusatz(bid)
        an, grund = self._stufen.get(bid, (False, None))
        return {"an": self.stufen_an(bid), "haupt": haupt, "zusatz": zusatz, "zusatz_an": an, "grund": grund,
                "text": stufen.TEXT.get(grund or "", "") if an else ""}

    # ------------------------------------------------------------------ Lernende Regelung (0.8, logik/lernen)
    @property
    def lern_staende(self) -> dict[str, Any]:
        return self.st.lz.setdefault("lernen", {})

    def _lern_art(self, bid: str) -> str:
        """„oel“, wenn ein Ölradiator heizt (sonst: wenn einer da ist), sonst „konvektor“."""
        heizer = [g for g in self.st.geraete_in(bid) if g.rolle == ROLLE_HEIZKOERPER]
        basis = [g for g in heizer if self._zieht_strom(g)] or heizer
        return "oel" if any(g.typ == TYP_OELRADIATOR for g in basis) else "konvektor"

    def _tpi(self, info: BereichInfo, e: Mapping[str, Any], temp: float | None, soll_t: float, wetter: WetterWerte,
             jetzt: datetime) -> lernen.Tpi | None:
        """TPI mit gelerntem Nachlauf – nur mit Fühler und eingeschalteter lernender Regelung."""
        if not e.get("lernen") or temp is None or self.modus(info.id) not in ("thermo", "bedarf"):   # Zeitplan regelt nicht selbst
            self.tpi_jetzt.pop(info.id, None)
            return None
        stand = {**lernen.neuer_stand(), **self.lern_staende.get(info.id, {})}
        log = [(zeit(a), zeit(b)) for a, b in stand["ein"] if zeit(a) is not None]
        kl = lernen.klasse(lernen.ein_minuten(log, jetzt))
        nachlauf = lernen.nachlauf_erwartet(stand["nachlauf"], self._lern_art(info.id), kl, lernen.band(wetter.aussen))
        # je Container um 3 min versetzt, damit nicht alle zur selben Minute einschalten
        t = lernen.Tpi(kint=float(stand["kint"]), kext=float(stand["kext"]), nachlauf=nachlauf, aussen=wetter.aussen,
                       minute_im_zyklus=(jetzt.hour * 60 + jetzt.minute + 3 * info.nr) % lernen.ZYKLUS_MIN)
        self.tpi_jetzt[info.id] = (lernen.tpi_anteil(temp, soll_t, t), nachlauf)
        return t

    def _lernen(self, jetzt: datetime, wetter: WetterWerte) -> None:
        """Einmal je Minute: Ein-Zeiten, Nachlauf nach dem Ausschalten und K-Werte fortschreiben."""
        minute = int(jetzt.timestamp() // 60)
        for info in self.bereiche():
            e = self.st.einstellungen.bereich(info.id)
            if not e.get("lernen") or not info.fuehler or self._lern_minute.get(info.id) == minute or self.modus(info.id) not in ("thermo", "bedarf"):
                continue
            self._lern_minute[info.id] = minute
            heizer = [g for g in self.st.geraete_in(info.id) if g.rolle == ROLLE_HEIZKOERPER]
            regelt = (info.id in self.tpi_jetzt and self._lern_grund.get(info.id) in LERN_GRUENDE
                      and not any(g.id in self.st.lz["hand"] for g in heizer))
            grund_jetzt = self._lern_grund.get(info.id)
            if any(self._zieht_strom(g) for g in heizer):   # Grund, der das Heizen bis zuletzt hielt (Minute davor:
                # endet Schnell aufheizen, schaltet dieselbe Auswertung aus – dann steht schon der neue Grund da)
                self._grund_beim_heizen[info.id] = self._grund_letzte_minute.get(info.id, grund_jetzt)
            self._grund_letzte_minute[info.id] = grund_jetzt
            alt = self.lern_staende.get(info.id) or lernen.neuer_stand()
            neu = lernen.takt(
                alt, jetzt=jetzt, heizt=any(self._zieht_strom(g) for g in heizer), anzahl=sum(1 for g in heizer if self._zieht_strom(g)),
                tuer_offen=self._tuer_offen(e), innen=self.st.temperatur(info.fuehler),
                hand=any(g.id in self.st.lz["hand"] for g in heizer),
                kint_ok=self._grund_beim_heizen.get(info.id) != SollGrund.BOOST,   # Grund der letzten Heizminute
                soll=self.soll_temperatur(info.id), aussen=wetter.aussen, art=self._lern_art(info.id), regelt=regelt,
            )
            vorher, jetzt_offen = (alt.get("offen") or {}).get("art"), (neu.get("offen") or {}).get("art")
            if jetzt_offen == "vermutet" and vorher != "vermutet":   # WU-0009
                self.st.protokoll("warnung", info.id, "Tür vermutlich offen – der Raum kühlt beim Heizen ab, die lernende Regelung lernt so lange nicht")
            elif vorher == "vermutet" and jetzt_offen is None:
                self.st.protokoll("ok", info.id, "Raum wird wieder wärmer – die lernende Regelung lernt weiter")
            if neu != alt:
                self.lern_staende[info.id] = neu
                self.st.einstellungen.speichern()

    def _tuer_offen(self, e: Mapping[str, Any]) -> bool:
        """Türkontakt des Containers offen (WU-0009: schützt das Lernen)."""
        tuer = e.get("tuer")
        return bool(tuer) and (z := self.st.hass.states.get(tuer)) is not None and z.state == STATE_ON

    def lern_anzeige(self, bid: str) -> dict[str, Any] | None:
        """Lernstand für die Seite (api: laufzeit.container.<id>.lernen); None ohne Fühler."""
        info = self.st.bereiche.get(bid)
        if info is None or not info.fuehler:
            return None
        anteil, nachlauf = self.tpi_jetzt.get(bid, (None, 0.0))
        soll_t = self.soll_temperatur(bid)
        return {
            "an": bool(self.st.einstellungen.bereich(bid).get("lernen")),
            **lernen.anzeige(self.lern_staende.get(bid) or {}),
            "anteil": round(anteil * 100) if anteil is not None else None,
            "erwartet": round(nachlauf, 2), "aus_bei": round(soll_t - nachlauf, 2), "zyklus_min": lernen.ZYKLUS_MIN,
            "warm": self.warm_anzeige(bid),
        }

    def warm_anzeige(self, bid: str) -> dict[str, Any] | None:
        """„Warm ab“ von heute für die Seite (AN-0004); None, wenn der Container nicht lernend im Thermostat regelt."""
        jetzt = dt_util.now()
        warm = self.warm_ab(bid, jetzt.date(), jetzt)
        if warm is None:
            return None
        e = self.st.einstellungen.bereich(bid)
        plan = self.plan(jetzt.date(), bool(e["trocknen"]), warm)
        info = self.st.bereiche[bid]
        stand = self.lern_staende.get(bid) or {}
        bd = lernen.band(self.st.daten.wetter.aussen)
        anzahl = 1 if self.stufen_an(bid) and not self._zusatz_gelernt.get(bid) else (len(self.heizer_von(bid)) or 1)
        rate = (stand.get("aufheizen") or {}).get(lernen.auf_schluessel(bd, anzahl))
        return {
            "gelernt": warm.aufheiz_min is not None, "band": bd, "rate": rate[0] if rate else None, "n": int(rate[1]) if rate else 0,
            "n_noetig": lernen.AUF_N, "vor": warm.vor_min, "nach": warm.nach_min, "max": warm.max_min,
            "vor_eigen": e.get("warm_vor") is not None, "nach_eigen": e.get("warm_nach") is not None,
            "aufheiz_min": warm.aufheiz_min, "innen": self.st.temperatur(info.fuehler), "soll": self.soll_temperatur(bid),
            "fest": bool(self.st.lz.get("warm_start", {}).get(bid)), "anzahl": anzahl,
            "plan": None if plan is None else {"start": plan.vor, "ziel": plan.a - warm.vor_min, "a": plan.a, "b": plan.b,
                                               "ende": plan.nach, "begrenzt": warm.aufheiz_min is not None and warm.vor_min + warm.aufheiz_min > max(warm.max_min, warm.vor_min)},
        }

    # ------------------------------------------------------------------ Staffelung und Schalten
    def schaltbar(self, g: GeraetInfo) -> bool:
        """Geschaltet werden nur Heizkörper (Mockup „geschaltet werden nur Heizungen“)."""
        return g.rolle == ROLLE_HEIZKOERPER

    def staffel_vorrang(self, soll: tuple[Soll, LageContainer], schaltet: bool, bereich: str = "") -> dict[str, Any]:
        """Frostschutz und Boost zuerst, dann der Bedarf in °C in 15 min (logik/bedarf)."""
        s, lage = soll
        b = self.bedarf(bereich, lage)
        return {
            "frost": schaltet and s.grund == SollGrund.FROST,
            "boost": schaltet and s.grund == SollGrund.BOOST,
            "defizit": b.summe if b is not None else None,
        }

    def bedarf(self, bid: str, lage: LageContainer, jetzt: datetime | None = None) -> bedarf_logik.Bedarf | None:
        """Bedarf eines Containers in °C (Trend, Nachlauf, Zielzeit, Gerechtigkeit) – auch für die Seite gemerkt."""
        info = self.st.bereiche.get(bid)
        if info is None:
            return None
        jetzt = jetzt or dt_util.now()
        heizer = self.heizer_von(bid)
        laeuft = any(self._zieht_strom(g) for g in heizer)
        innen = lage.temperatur
        trend = bedarf_logik.trend_c_h(self._temp_punkte.get(bid, []), jetzt) if innen is not None else None
        nachlauf = self.tpi_jetzt.get(bid, (None, 0.0))[1]
        ziel = 0.0
        plan = self.plaene.get(bid)
        if innen is not None and plan is not None:
            bis = plan.a - self._warm_vor.get(bid, 0) - (jetzt.hour * 60 + jetzt.minute)
            ziel = bedarf_logik.ziel_fehlt(innen, lage.soll, self._aufheiz_rate(bid), bis)
        gelernt = self.st.zaehler.get(f"abkuehl:{bid}")   # gelernte Abkühlrate (Trägheit, wie im Vergleich Öl/Konvektor)
        if not laeuft and trend is not None:
            self._abkuehl_zuletzt[bid] = max(0.0, -trend)
        elif gelernt is None:
            gelernt = self._abkuehl_zuletzt.get(bid)   # noch nichts gelernt: die zuletzt gemessene Abkühlung
        b = bedarf_logik.bedarf(innen=innen, soll=lage.soll, trend_h=trend, abkuehl_gelernt_h=float(gelernt) if gelernt is not None else None,
                                nachlauf=nachlauf, laeuft=laeuft, ziel=ziel,
                                zuschlag_gerecht=self._gerecht(bid, jetzt))
        self.bedarf_jetzt[bid] = b
        return b

    def _aufheiz_rate(self, bid: str) -> float | None:
        """Gelernte Aufheizrate (°C/h) für das Wetter von jetzt und die Zahl der Heizkörper (wie „Warm ab“)."""
        stand = self.lern_staende.get(bid) or {}
        anzahl = 1 if self.stufen_an(bid) and not self._zusatz_gelernt.get(bid) else (len(self.heizer_von(bid)) or 1)
        rate = (stand.get("aufheizen") or {}).get(lernen.auf_schluessel(lernen.band(self.st.daten.wetter.aussen), anzahl))
        return float(rate[0]) if rate else None

    def _heiz_min(self, bid: str, jetzt: datetime) -> float:
        return sum(m for t, m in self._heiz_punkte.get(bid, []) if (jetzt - t).total_seconds() <= 3600)

    def _gerecht(self, bid: str, jetzt: datetime) -> float:
        """Zuschlag für wenig Heizzeit in der letzten Stunde gegenüber dem Schnitt der Container mit Heizkörpern."""
        alle = [b.id for b in self.bereiche() if self.heizer_von(b.id)]
        if len(alle) < 2:
            return 0.0
        return bedarf_logik.gerecht(self._heiz_min(bid, jetzt), sum(self._heiz_min(b, jetzt) for b in alle) / len(alle))

    def bedarf_anzeige(self, bid: str) -> dict[str, Any] | None:
        """Bedarf für die Seite (laufzeit.container.<id>.bedarf) – zuletzt in der Staffelung gerechnet."""
        b = self.bedarf_jetzt.get(bid)
        if b is None:
            return None
        return {"summe": b.summe, "jetzt": b.jetzt, "abkuehlen": b.abkuehlen, "abkuehl_h": b.abkuehl_h, "gemessen": b.gemessen,
                "trend_h": b.trend_h, "nachlauf": b.nachlauf, "aufheiz_h": self._aufheiz_rate(bid),
                "ziel": b.ziel, "gerecht": b.gerecht, "heiz_min": round(self._heiz_min(bid, dt_util.now())),
                "horizont_min": bedarf_logik.HORIZONT_MIN}

    def schaltet_ohne_automatik(self) -> bool:
        """„Frostschutz auch bei Automatik aus“: `soll` will dann nur Frost-Container schalten."""
        return bool(self.st.e["heizung"].get("frost_immer"))

    def nach_schalten(self, jetzt: datetime, wetter: WetterWerte) -> None:
        """Einmal am Morgen die Wetter-Entscheidung ins Protokoll (Mockup „05:00 wetter …“), dazu jeder Wechsel."""
        self._lernen(jetzt, wetter)
        st = self.st
        zu_warm = self.zu_warm(wetter)
        heute = jetzt.date().isoformat()
        h = st.e["heizung"]
        if jetzt.time() >= WETTER_PROTOKOLL_AB and st.lz.get("wetter_protokoll") != heute:
            st.lz["wetter_protokoll"] = heute
            wt = st.wetter_tag_plan(jetzt.date())
            teile = []
            if wt.regen_vortag_mm is not None and wt.regen_vortag_mm >= float(h["trocknen_ab_mm"]):
                teile.append(f"Regen {warn_logik._zahl(wt.regen_vortag_mm, 0)} mm seit gestern – heute Kleidung trocknen")
            if wt.frueh_min_temp is not None and h["fruehstart"] and wt.frueh_min_temp < float(h["fruehstart_unter"]):
                teile.append(f"Kalter Morgen {warn_logik._zahl(wt.frueh_min_temp)} °C – Frühstart {h['fruehstart_min']} min früher")
            bezug = wetter.aussen_max if h["heizgrenze_basis"] == "tageshoechst" else wetter.aussen
            if bezug is not None:
                was = "Höchstwert" if h["heizgrenze_basis"] == "tageshoechst" else "jetzt"
                teile.append(
                    f"Heizgrenze überschritten ({was} {warn_logik._zahl(bezug, 0)} °C) – heute wird nicht geheizt" if zu_warm
                    else f"Heizgrenze nicht erreicht ({was} {warn_logik._zahl(bezug, 0)} °C) – es wird geheizt"
                )
            for text in teile:
                st.protokoll("wetter", None, text)
            self._zu_warm_vorher = zu_warm
            st.einstellungen.speichern()
        elif self._zu_warm_vorher is not None and zu_warm != self._zu_warm_vorher:
            st.protokoll("wetter", None, "Heizgrenze überschritten – Heizung aus" if zu_warm else "Heizgrenze unterschritten – es wird wieder geheizt")
        self._zu_warm_vorher = zu_warm

    # ------------------------------------------------------------------ Hand
    def nach_soll(self, soll: SollJeBereich) -> None:
        """Handbetrieb beenden nach `logik/regelung.hand_ende` (FE-0004): Frostschutz/Tür, mit Fühler am Soll, nach der
        Höchstdauer (`hand_h`) oder am nächsten Schaltpunkt."""
        jetzt = dt_util.now()
        max_minuten = float(self.st.e["meldungen_einst"].get("hand_h") or 8) * 60
        for gid in list(self.st.lz["hand"]):
            g = self.st.geraete.get(gid)
            if g is None or g.rolle != ROLLE_HEIZKOERPER or g.bereich not in soll:
                continue
            s, lage = soll[g.bereich]
            if s.ein is None:
                continue
            phase = bool(s.ein) if lage.temperatur is None else s.grund in HEIZ_GRUENDE
            vorher = self._hand_phase.setdefault(gid, phase)
            z = self.st.hass.states.get(g.schalter)
            seit = self.hand_seit(g)
            ende = hand_ende(
                grund=s.grund, phase_vorher=vorher, phase=phase, an=z is not None and z.state == STATE_ON,
                temperatur=lage.temperatur, soll=lage.soll,
                minuten=(jetzt - seit).total_seconds() / 60 if seit is not None else None, max_minuten=max_minuten,
                lassen=warn_logik.warn_key(warn_logik.Art.HAND_ZU_LANGE, g.bereich, g.id) in self.st.e["stumm"],   # „So lassen“
                nachfrist_min=float(self.st.e["heizung"].get("hand_nachfrist_min", HAND_NACHFRIST_MIN)),   # AN-0012
            )
            if ende is not None:
                self.hand_beenden(gid, HAND_ENDE_TEXT[ende].format(
                    grund=GRUND_TEXT.get(s.grund, s.grund), soll=warn_logik._zahl(lage.soll), h=warn_logik._zahl(max_minuten / 60, 0)))

    def hand_setzen(self, g: GeraetInfo, an: bool) -> bool:
        """Gerät auf Hand: Heizkörper bis zum nächsten Schaltpunkt, andere, solange sie eingeschaltet sind."""
        hand = self.st.lz["hand"]
        if g.rolle != ROLLE_HEIZKOERPER and not an:
            if hand.pop(g.id, None) is not None:
                self.st.einstellungen.speichern()
            return True
        if g.id not in hand:
            hand[g.id] = dt_util.now().isoformat(timespec="seconds")
            self._hand_phase.pop(g.id, None)
            self.st.einstellungen.speichern()
        self.st.protokoll("schalten", g.bereich, f"{g.name} von Hand {'eingeschaltet' if an else 'ausgeschaltet'}")
        return True

    def hand_seit(self, g: GeraetInfo) -> datetime | None:
        return zeit(self.st.lz["hand"].get(g.id))

    def hand_nach_einstellung(self, pfad: Sequence[str]) -> None:
        """Wer Soll, Modus oder Automatik ändert, will, dass es sofort gilt – der Handbetrieb dort endet (FE-0004)."""
        pfad = list(pfad)
        if pfad[0] == "bereiche" and len(pfad) > 2 and pfad[2] in ("soll", "modus", "auto", "bedarf"):
            betroffen = {pfad[1]}
        elif pfad in (["automatik"], ["heizung", "soll"]):
            betroffen = set(self.st.bereiche)
        else:
            return
        for g in [g for g in self.st.geraete.values() if g.bereich in betroffen]:
            self.hand_beenden(g.id, "Einstellung geändert – Automatik übernimmt")

    def hand_beenden(self, gid: str, grund: str = "") -> None:
        if self.st.lz["hand"].pop(gid, None) is not None:
            self._hand_phase.pop(gid, None)
            self.st.einstellungen.speichern()
            g = self.st.geraete.get(gid)
            if g is not None and grund:
                self.st.protokoll("schalten", g.bereich, f"{g.name}: {grund}")

    # ------------------------------------------------------------------ Warnungen
    def geraet_warnung(
        self, g: GeraetInfo, erreichbar: bool, leistung: float | None, jetzt: datetime
    ) -> tuple[warn_logik.Typ, datetime | None, int]:
        return (warn_logik.Typ.HEIZUNG if g.rolle == ROLLE_HEIZKOERPER else warn_logik.Typ.SONST), None, 0

    def warn_einstellungen(self) -> Mapping[str, Any]:
        heizung: Mapping[str, Any] = self.st.e["heizung"]  # Frostschutz, Tür offen
        return heizung

    def warnung_protokoll(self, w: Warnung) -> tuple[str, str] | None:
        if w.art == warn_logik.Art.TUER_OFFEN:
            return ("schalten", "Tür offen – Heizung pausiert") if w.werte.get("pausiert", True) else ("warnung", "Tür offen")
        return None

    def warnungen(self, jetzt: datetime, soll: SollJeBereich) -> list[warn_logik.ContainerZustand]:
        st = self.st
        liste = []
        for info in self.bereiche():
            s_c = soll.get(info.id)
            temp = st.temperatur(info.fuehler)
            soll_t = self.soll_temperatur(info.id)
            in_az = s_c is not None and s_c[0].grund == SollGrund.ARBEITSZEIT and st.automatik
            if in_az and temp is not None and temp < soll_t - 1.0:
                self._unter_soll_seit.setdefault(info.id, jetzt)
            else:
                self._unter_soll_seit.pop(info.id, None)
            tuer_seit = None
            tuer = st.einstellungen.bereich(info.id).get("tuer")
            frost = s_c is not None and s_c[0].grund == SollGrund.FROST   # Frost geht vor: nicht „pausiert“ melden (Szenario-Befund)
            if tuer and not frost and info.id not in self.tuer_trotzdem and (s := st.hass.states.get(tuer)) is not None and s.state == STATE_ON:
                tuer_seit = dt_util.as_local(s.last_changed)
            pausiert = s_c is not None and s_c[0].grund == SollGrund.TUER_OFFEN   # sonst: Sicherheitshinweis (Szenarien)
            liste.append(
                warn_logik.ContainerZustand(
                    id=info.id, temperatur=temp, soll=soll_t, in_arbeitszeit=in_az, fuehler=bool(info.fuehler),
                    unter_soll_seit=self._unter_soll_seit.get(info.id), tuer_offen_seit=tuer_seit, tuer_pausiert=pausiert,
                    modus=self.modus(info.id),
                )
            )
        return liste

    # ------------------------------------------------------------------ Anzeige
    def anzeige(
        self, bid: str, info: BereichInfo, jetzt: datetime, soll: SollJeBereich, offline: bool, an: bool
    ) -> tuple[str, str, str]:
        """Zustand und Text eines Containers wie die Kacheln im Mockup (`TEXT(b)`)."""
        st = self.st
        geraete = st.geraete_in(bid)
        s_c = soll.get(bid)
        grund = s_c[0].grund if s_c else SollGrund.AUTOMATIK_AUS
        heizer_an = any(
            (z := st.hass.states.get(g.schalter)) is not None and z.state == STATE_ON
            for g in geraete if g.rolle in HEIZROLLEN
        )
        # „heizt“ (Glühen, Flammen im Symbol) nur bei echtem Verbrauch: ein eingeschalteter Heizkörper zieht über
        # ZIEHT_STROM_W; ohne Leistungssensor zählt der Schalter (Meldung Herbert, 30.09.2026)
        zieht = any(self._zieht_strom(g) for g in geraete if g.rolle in HEIZROLLEN)
        e = st.einstellungen.bereich(bid)
        if offline:
            zustand, text = "offline", "nicht erreichbar"
        elif heizer_an and not zieht and grund not in (SollGrund.TUER_OFFEN, SollGrund.BEREIT):
            regelt = self.modus(bid) in ("thermo", "bedarf") and st.daten.temperatur[bid] is not None
            zustand, text = "aus", ("an · zieht keinen Strom" if regelt else "an · Thermostat regelt")   # Szenarien
        elif grund == SollGrund.FROST and zieht:
            zustand, text = "frost", "Frostschutz"
        elif grund == SollGrund.TUER_OFFEN:
            zustand, text = "pause", "pausiert · Tür offen"
        elif grund == SollGrund.BOOST and zieht:
            zustand, text = "heizt", "⚡ schnell aufheizen"
        elif grund == SollGrund.BEREIT:
            zustand, text = "bereit", "bei Bedarf · nur Frostschutz"
        elif grund == SollGrund.AUS and not heizer_an:
            zustand, text = "aus", "aus · nur Frostschutz"
        elif heizer_an and grund == SollGrund.TROCKNEN:
            zustand, text = "trocknen", "Kleidung trocknen"
        elif heizer_an:
            zustand = "heizt"
            if grund == SollGrund.BEDARF:
                bis = self.bis("bedarf_bis", bid, jetzt) or self._termin_ende(bid, jetzt)
                text = f"heizt bis {bis.strftime('%H:%M')}" if bis else "heizt · bei Bedarf"
            elif grund == SollGrund.HAND or not e["auto"] or any(g.id in st.lz["hand"] for g in geraete if g.rolle in HEIZROLLEN):
                text = "heizt · Hand"   # auch ein Heizkörper im Handbetrieb (FE-0004), auch ohne Fühler (Szenarien)
            elif st.daten.temperatur[bid] is None:
                text = "an · Thermostat regelt"
            elif grund == SollGrund.ABSENKEN:
                text = "heizt · abgesenkt"
            else:
                text = "heizt · Arbeitszeit"
        else:
            zustand = "aus"
            naechster = self._naechster_start(jetzt, bid)
            text = f"aus bis {naechster}" if naechster else "aus"
        if an and not heizer_an and zustand == "aus":
            text = "aus · Steckdose an"
        if zustand in ("aus", "bereit") and grund != SollGrund.TUER_OFFEN and self._tuer_offen(e):
            text = f"{text} · 🚪 Tür offen"
        return zustand, text, str(grund)

    def zieht_w(self) -> float:
        """Ab so viel W „heizt“ ein Heizkörper tatsächlich (Einstellung, AN-0012; Standard ZIEHT_STROM_W)."""
        return float(self.st.e["heizung"].get("zieht_strom_w", ZIEHT_STROM_W))

    def _zieht_strom(self, g: GeraetInfo) -> bool:
        """Eingeschaltet und – falls gemessen – über `zieht_w`."""
        z = self.st.hass.states.get(g.schalter)
        if z is None or z.state != STATE_ON:
            return False
        if not g.leistung:
            return True
        w = zahl(self.st.hass.states.get(g.leistung))
        return w is None or w > self.zieht_w()  # Sensor ohne Wert: wie ohne Messung

    def _termin_ende(self, bid: str, jetzt: datetime) -> datetime | None:
        for von, bis, _ in self._termin_fenster(bid):
            if von - timedelta(minutes=int(self.st.e["heizung"]["vorheizen_min"])) <= jetzt < bis:
                return bis
        return None

    def _naechster_start(self, jetzt: datetime, bid: str) -> str | None:
        e = self.st.einstellungen.bereich(bid)
        if e["bedarf"] or not e["auto"] or not self.st.automatik:
            return None
        s = plan_status(jetzt.date(), jetzt.hour * 60 + jetzt.minute, lambda t: self.plan_bereich(t, bid, jetzt))
        if s.minute is None or s.tag is None or s.art == StatusArt.HEIZT:
            return None
        if s.tag in (jetzt.date(), jetzt.date() + timedelta(days=1)):
            return uhrzeit(s.minute)  # Mockup „aus bis 06:15“
        return f"{wochentag(s.tag)} {uhrzeit(s.minute)}"

    # ------------------------------------------------------------------ Status und Protokoll
    def status(self, jetzt: datetime) -> tuple[str, str, datetime | None] | None:
        """Status der Baustelle und Text neben dem Automatik-Chip (Mockup `statusText`)."""
        st = self.st
        if not st.automatik:
            return "automatik_aus", "Handbetrieb – nichts wird geschaltet", None
        heute, minute = jetzt.date(), jetzt.hour * 60 + jetzt.minute
        jetzt_bis = self.jetzt_bis(jetzt)
        if jetzt_bis is not None:
            return "heizt", f"♨ alle heizen bis {jetzt_bis.strftime('%H:%M')}", jetzt_bis
        trocknet = any(self.st.einstellungen.bereich(b.id).get("trocknen") for b in self.bereiche())   # nur, wenn einer trocknet
        s = plan_status(heute, minute, lambda t: self.plan(t, trocknet))
        naechste = mitternacht(s.tag) + timedelta(minutes=s.minute) if s.minute is not None and s.tag is not None else None
        heizt = any(z in ("heizt", "trocknen", "frost") for z in st.daten.zustand.values())
        ausnahme = next((a for a in st.ausnahmen() if a.datum == heute), None)
        if ausnahme is not None and ausnahme.art == AusnahmeArt.FREI:
            status = "frei"
        elif frei_gilt(self.ist_frei(heute), ausnahme):
            status = st.frei_art(heute) or "frei"
        elif self.zu_warm(st.daten.wetter):
            status = "heizgrenze"
        else:
            status = "heizt" if heizt else "bereit"
        if s.art == StatusArt.HEIZT:
            text = f"♨ heizt bis {uhrzeit(s.minute or 0)}"
        elif s.art == StatusArt.START:
            text = f"Start um {uhrzeit(s.minute or 0)}"
        elif s.tag is not None:
            wann = "morgen" if s.tag == heute + timedelta(days=1) else wochentag(s.tag)
            text = f"aus · {wann} ab {uhrzeit(s.minute or 0)}"
        else:
            text = "aus"
        return status, text, naechste

    def einstellung_text(self, pfad: tuple[str, ...], wert: Any) -> str | None:
        if pfad[0] == "bereiche" and pfad[-1] == "modus":
            return f"Modus: {MODUS_TEXT.get(wert, wert)}"
        return None

    # ------------------------------------------------------------------ Zählen
    def zaehlen_geraet(self, g: GeraetInfo, an: bool, leistung: float | None, stunden: float) -> bool:
        """Mittlere Leistung im Betrieb, Heizzeit je Typ; True, wenn das Gerät eingeschaltet ist."""
        z = self.st.zaehler
        mittel_w = mittel_im_betrieb(z.get(f"mittel:{g.id}"), leistung if an else None)
        if mittel_w is not None:
            z[f"mittel:{g.id}"] = mittel_w
            if self.aktiv():
                self._ohne_w += mittel_w
        if not an:
            return False
        if g.rolle == ROLLE_HEIZKOERPER:
            self.st.zaehler_plus(f"heizzeit_typ:{g.typ}", stunden)
            if leistung is None or leistung > self.zieht_w():   # AN-0011: tatsächlich geheizt (ohne Messung: wie geschaltet)
                self._strom_jetzt.add(g.bereich)
        return True

    def zaehlen_bereich(self, bid: str, heizt: bool, jetzt: datetime, stunden: float) -> None:
        punkte = self._heiz_punkte.setdefault(bid, [])   # Heizzeit der letzten Stunde (Bedarf: Gerechtigkeit)
        if heizt:
            punkte.append((jetzt, stunden * 60))
        while punkte and (jetzt - punkte[0][0]).total_seconds() > 3600:
            punkte.pop(0)
        if heizt:
            self.st.zaehler_plus(f"heizzeit:{bid}", stunden)   # eingeschaltet
        if bid in self._strom_jetzt:   # AN-0011: davon tatsächlich geheizt (Strom über 50 W) – nur das ist ein Heiztag
            self._strom_jetzt.discard(bid)
            self._heiztag = True
            self.st.zaehler_plus(f"heizzeit_strom:{bid}", stunden)
        self._temperaturverhalten(bid, heizt, jetzt, stunden)

    def energie_buchen(self, g: GeraetInfo, kwh: float) -> None:
        """Energie fürs Heizen (Ersparnis) und je Heizkörper-Typ (Vergleich Ölradiator/Konvektor)."""
        self.st.zaehler_plus("energie_heizen", kwh)
        if g.rolle == ROLLE_HEIZKOERPER:
            self.st.zaehler_plus(f"energie_typ:{g.typ}", kwh)
            if self.vergleichbar(g.bereich):
                self.st.zaehler_plus(f"vgl_kwh:{g.bereich}", kwh)

    def vergleichbar(self, bid: str) -> bool:
        """Zählt der Container gerade für den fairen Vergleich Ölradiator/Konvektor (AN-0008)? Mit Fühler, im Modus
        Thermostat und nur ein Heizkörper-Typ."""
        info = self.st.bereiche.get(bid)
        if info is None or info.art != ART_CONTAINER or not info.fuehler or self.modus(bid) != "thermo":
            return False
        return len({g.typ for g in self.heizer_von(bid)}) == 1

    def zaehlen_ende(self, jetzt: datetime, stunden: float) -> None:
        """„Ohne Automatik“ (24-h-Dauerbetrieb) und Heiztage."""
        st = self.st
        st.zaehler_plus("ohne", self._ohne_w * stunden / 1000)
        if self._heiztag and st.zaehler.get("heiztag_letzter") != jetzt.date().isoformat():
            st.zaehler["heiztag_letzter"] = jetzt.date().isoformat()
            st.zaehler_plus("heiztage", 1)
        self._ohne_w, self._heiztag = 0.0, False

    def _temperaturverhalten(self, bid: str, heizt: bool, jetzt: datetime, stunden: float) -> None:
        """Aufheiz- und Abkühlrate (°C/h) und Gradstunden innen–außen eines Containers mit Fühler."""
        st = self.st
        info = st.bereiche[bid]
        innen = st.temperatur(info.fuehler)
        if info.art != ART_CONTAINER or innen is None:
            self._phase.pop(bid, None)
            return
        st.zaehler_plus(f"gradh:{bid}", gradstunden(innen, st.daten.wetter.aussen, stunden))
        fair = self.vergleichbar(bid)   # AN-0008: nur im Modus Thermostat mit Fühler und einem Typ
        if fair:
            st.zaehler_plus(f"vgl_gradh:{bid}", gradstunden(innen, st.daten.wetter.aussen, stunden))
        phase = self._phase.get(bid)
        if phase is None or phase[0] != heizt:
            self._phase[bid] = (heizt, jetzt, innen)
            return
        dauer = (jetzt - phase[1]).total_seconds() / 3600
        if dauer < (AUFHEIZ_MIN_H if heizt else ABKUEHL_MIN_H):
            return
        aenderung = rate(phase[2], innen, dauer)
        key = f"aufheiz:{bid}" if heizt else f"abkuehl:{bid}"
        if aenderung is not None and (aenderung > 0 if heizt else aenderung < 0):
            st.zaehler[key] = mittel(st.zaehler.get(key), abs(aenderung))
            if fair:
                st.zaehler[f"vgl_{key}"] = mittel(st.zaehler.get(f"vgl_{key}"), abs(aenderung))
            st.einstellungen.speichern(ZAEHLER_SPEICHERN_S)
        self._phase[bid] = (heizt, jetzt, innen)

    def ersparnis_kwh(self) -> float:
        """Was 24-h-Dauerbetrieb mehr verbraucht hätte als tatsächlich geheizt wurde."""
        z = self.st.zaehler
        return max(0.0, float(z.get("ohne", 0.0)) - float(z.get("energie_heizen", 0.0)))

    def mittel_typ(self, typ: str) -> float | None:
        """Mittlere Leistung im Betrieb aller Heizkörper eines Typs (Vergleich Ölradiator/Konvektor)."""
        z = self.st.zaehler
        werte = [
            z[f"mittel:{g.id}"]
            for g in self.st.geraete.values()
            if g.rolle == ROLLE_HEIZKOERPER and g.typ == typ and f"mittel:{g.id}" in z
        ]
        return sum(werte) / len(werte) if werte else None

    def hochrechnung_heizperiode(self, key: str) -> float | None:
        """Tagesschnitt seit Zählbeginn auf die ganze Heizperiode hochgerechnet (kWh)."""
        st = self.st
        seit = dt_util.parse_datetime(st.zaehler["seit"]) if st.zaehler.get("seit") else None
        if seit is None:
            return None
        jetzt = dt_util.now()
        von = int(st.entry.options.get(CONF_HEIZPERIODE_VON, 10))
        bis = int(st.entry.options.get(CONF_HEIZPERIODE_BIS, 4))
        jahr = jetzt.year if jetzt.month >= von else jetzt.year - 1
        tage = (jetzt - seit).total_seconds() / 86400
        ende = st.entry.options.get(CONF_ENDE)
        bis_tag = date.fromisoformat(ende) if ende else None   # geplantes Ende der Baustelle (neu 0.7.8)
        return hochrechnung(st.zaehler.get(key, 0.0), tage, tage_heizperiode(von, bis, jahr, bis_tag))


def _termin_bereich(ev: dict[str, Any], bedarf: list[BereichInfo]) -> str | None:
    """Container eines Termins: `baustelle:<bid>` in der Beschreibung, sonst der Name im Titel/Ort, sonst der einzige
    Bedarfs-Container (api-0.7 §1 `termine`)."""
    beschreibung = str(ev.get("description") or "")
    for b in bedarf:
        if f"baustelle:{b.id}" in beschreibung:
            return b.id
    for feld in ("location", "summary"):
        text = str(ev.get(feld) or "").lower()
        for b in bedarf:
            if b.name.lower() and b.name.lower() in text:
                return b.id
    return bedarf[0].id if len(bedarf) == 1 else None


def _wiederholung(rrule: str | None) -> str:
    if not rrule:
        return "einmal"
    teile = dict(t.split("=", 1) for t in rrule.split(";") if "=" in t)
    if teile.get("FREQ") == "WEEKLY":
        return "2wochen" if teile.get("INTERVAL") == "2" else "woche"
    return "einmal"
