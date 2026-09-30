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
    CONF_ENDE,
    CONF_HEIZPERIODE_BIS,
    CONF_HEIZPERIODE_VON,
    CONF_HEIZUNG,
    HEIZROLLEN,
    ROLLE_HEIZKOERPER,
    ZIEHT_STROM_W,
)
from .. import texte
from ..logik import warnungen as warn_logik
from ..logik.arbeitszeit import (
    AusnahmeArt,
    HeizRegeln,
    Plan,
    StatusArt,
    bedarf_fenster,
    im_fenster,
    status as plan_status,
    tagesplan,
    uhrzeit,
)
from ..logik.regelung import LageContainer, Soll, SollGrund, soll_container
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
    from collections.abc import Mapping

    from ..logik.warnungen import Warnung
    from ..steuerung import BereichInfo, GeraetInfo, Steuerung, WetterWerte
    from .basis import SollJeBereich

HEIZ_GRUENDE = {
    SollGrund.FRUEHSTART, SollGrund.VORHEIZEN, SollGrund.ARBEITSZEIT, SollGrund.NACHHEIZEN, SollGrund.TROCKNEN,
    SollGrund.BEDARF, SollGrund.BOOST, SollGrund.FROST, SollGrund.ABSENKEN,
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
        self._plan_cache: dict[tuple[date, bool], Plan | None] = {}
        self._zu_warm_vorher: bool | None = None
        self.tuer_trotzdem: set[str] = set()  # Knopf „Trotzdem heizen“: heizt trotz offener Tür, bis sie zu ist
        self._frost: dict[str, bool] = {}
        self._unter_soll_seit: dict[str, datetime] = {}
        self._hand_phase: dict[str, bool] = {}
        self._phase: dict[str, tuple[bool, datetime, float]] = {}  # Bereich → (heizt, seit, Temperatur beim Beginn)
        self._ohne_w = 0.0  # je Zählschritt: Summe der mittleren Leistung („ohne Automatik“)
        self._heiztag = False

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

    def plan(self, tag: date, trocknen: bool) -> Plan | None:
        """Heizplan eines Tages (logik/arbeitszeit.tagesplan), dazu „Noch früher“ aus der Nachricht.

        Je Auswertung zwischengespeichert (sie läuft bei jeder Zustandsänderung, z. B. jedem Leistungswert).
        """
        if (tag, trocknen) in self._plan_cache:
            return self._plan_cache[(tag, trocknen)]
        st = self.st
        p = tagesplan(
            tag, st.arbeitszeiten(), st.ausnahmen(), self.heiz_regeln(), st.wetter_tag_plan(tag), trocknen,
            frei=self.ist_frei(tag),
        )
        extra = int(st.lz.get("frueher", {}).get(tag.isoformat()) or 0)
        if p is not None and extra:
            p = replace(p, start=max(0, p.start - extra))
        self._plan_cache[(tag, trocknen)] = p
        return p

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
        frei_heute = self.ist_frei(heute)
        zu_warm = self.zu_warm(wetter)
        ergebnis: dict[str, tuple[Soll, LageContainer]] = {}
        for info in self.bereiche():
            bid = info.id
            e = st.einstellungen.bereich(bid)
            plan = self.plan(heute, bool(e["trocknen"]))
            self.plaene[bid] = plan
            frei, warm = frei_heute, zu_warm
            if jetzt_bis is not None:
                # „alle jetzt heizen“: wie in der Arbeitszeit, auch an freien Tagen und über der Heizgrenze (§5)
                ende = 24 * 60 if jetzt_bis.date() > heute else jetzt_bis.hour * 60 + jetzt_bis.minute
                if plan is None or not (plan.start <= minute < plan.ende):
                    plan = Plan(start=minute, vor=minute, a=minute, b=max(minute + 1, ende), nach=max(minute + 1, ende),
                                ende=max(minute + 1, ende))
                frei, warm = False, False
            temp = st.temperatur(info.fuehler)
            soll_t = self.soll_temperatur(bid)
            tuer_min = None
            tuer = e.get("tuer")
            if tuer and (s := hass.states.get(tuer)) is not None and s.state == STATE_ON:
                if bid not in self.tuer_trotzdem:
                    tuer_min = minuten_seit(dt_util.as_local(s.last_changed), jetzt)
            else:
                self.tuer_trotzdem.discard(bid)
            fenster = self._termin_fenster(bid)
            aktive = [f for f in fenster if im_fenster(bedarf_fenster([(f[0], f[1])], int(h["vorheizen_min"])), jetzt)]
            bedarf_aktiv = self.bis("bedarf_bis", bid, jetzt) is not None or bool(aktive) or jetzt_bis is not None
            boost = self.bis("boost_bis", bid, jetzt) is not None or any(f[2] for f in aktive)
            if boost and temp is not None and temp >= soll_t and bid in st.lz["boost_bis"]:
                del st.lz["boost_bis"][bid]  # Soll erreicht: Boost beendet (Aufrufer, Bauplan §2.2)
                st.einstellungen.speichern()
                boost = False
            heizer = [g for g in st.geraete_in(bid) if g.rolle == ROLLE_HEIZKOERPER and g.id not in st.lz["hand"]]
            heizt = any((s := hass.states.get(g.schalter)) is not None and s.state == STATE_ON for g in heizer)
            lage = LageContainer(
                minute=minute, plan=plan, automatik=st.automatik, auto=bool(e["auto"]), temperatur=temp, soll=soll_t,
                frost=bool(h["frost"]), frost_grenze=float(h["frost_grenze"]), zu_warm=warm, frei=frei,
                tuer_offen_min=tuer_min, bedarf=bool(e["bedarf"]), bedarf_aktiv=bedarf_aktiv, boost=boost,
                heizt_gerade=heizt, toleranz=float(h["toleranz"]), frost_vorher=self._frost.get(bid, False),
                modus=self.modus(bid), frost_aus=None if h.get("frost_aus") is None else float(h["frost_aus"]),
                frei_modus=str(h.get("frei_modus") or "frost"), absenk=float(h.get("absenk") or 10.0),
                frost_immer=bool(h.get("frost_immer")),
            )
            soll = soll_container(lage, int(h["tuer_pause_min"]))
            self._frost[bid] = soll.grund == SollGrund.FROST
            ergebnis[bid] = (soll, lage)
        return ergebnis

    # ------------------------------------------------------------------ Staffelung und Schalten
    def schaltbar(self, g: GeraetInfo) -> bool:
        """Geschaltet werden nur Heizkörper (Mockup „geschaltet werden nur Heizungen“)."""
        return g.rolle == ROLLE_HEIZKOERPER

    def staffel_vorrang(self, soll: tuple[Soll, LageContainer], schaltet: bool) -> dict[str, Any]:
        """Frostschutz und Boost zuerst, dann wer am weitesten unter dem Soll ist."""
        s, lage = soll
        return {
            "frost": schaltet and s.grund == SollGrund.FROST,
            "boost": schaltet and s.grund == SollGrund.BOOST,
            "defizit": (lage.soll - lage.temperatur) if lage.temperatur is not None else None,
        }

    def schaltet_ohne_automatik(self) -> bool:
        """„Frostschutz auch bei Automatik aus“: `soll` will dann nur Frost-Container schalten."""
        return bool(self.st.e["heizung"].get("frost_immer"))

    def nach_schalten(self, jetzt: datetime, wetter: WetterWerte) -> None:
        """Einmal am Morgen die Wetter-Entscheidung ins Protokoll (Mockup „05:00 wetter …“), dazu jeder Wechsel."""
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
        """Hand endet am nächsten Schaltpunkt: wenn die Automatik den Heizkörper anders schalten würde als bisher."""
        for gid in list(self.st.lz["hand"]):
            g = self.st.geraete.get(gid)
            if g is None or g.rolle != ROLLE_HEIZKOERPER or g.bereich not in soll:
                continue
            s, lage = soll[g.bereich]
            if s.ein is None:
                continue
            phase = bool(s.ein) if lage.temperatur is None else s.grund in HEIZ_GRUENDE
            vorher = self._hand_phase.setdefault(gid, phase)
            if phase != vorher:
                self.hand_beenden(gid, f"Automatik übernimmt ({GRUND_TEXT.get(s.grund, s.grund)})")

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
            return "schalten", "Tür offen – Heizung pausiert"
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
            if tuer and info.id not in self.tuer_trotzdem and (s := st.hass.states.get(tuer)) is not None and s.state == STATE_ON:
                tuer_seit = dt_util.as_local(s.last_changed)
            liste.append(
                warn_logik.ContainerZustand(
                    id=info.id, temperatur=temp, soll=soll_t, in_arbeitszeit=in_az, fuehler=bool(info.fuehler),
                    unter_soll_seit=self._unter_soll_seit.get(info.id), tuer_offen_seit=tuer_seit,
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
            zustand, text = "aus", "an · zieht keinen Strom"
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
            elif st.daten.temperatur[bid] is None:
                text = "an · Thermostat regelt"
            elif grund == SollGrund.HAND or not e["auto"]:
                text = "heizt · Hand"
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
        return zustand, text, str(grund)

    def _zieht_strom(self, g: GeraetInfo) -> bool:
        """Eingeschaltet und – falls gemessen – über ZIEHT_STROM_W."""
        z = self.st.hass.states.get(g.schalter)
        if z is None or z.state != STATE_ON:
            return False
        if not g.leistung:
            return True
        w = zahl(self.st.hass.states.get(g.leistung))
        return w is None or w > ZIEHT_STROM_W  # Sensor ohne Wert: wie ohne Messung

    def _termin_ende(self, bid: str, jetzt: datetime) -> datetime | None:
        for von, bis, _ in self._termin_fenster(bid):
            if von - timedelta(minutes=int(self.st.e["heizung"]["vorheizen_min"])) <= jetzt < bis:
                return bis
        return None

    def _naechster_start(self, jetzt: datetime, bid: str) -> str | None:
        e = self.st.einstellungen.bereich(bid)
        if e["bedarf"] or not e["auto"] or not self.st.automatik:
            return None
        s = plan_status(jetzt.date(), jetzt.hour * 60 + jetzt.minute, lambda t: self.plan(t, bool(e["trocknen"])))
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
        s = plan_status(heute, minute, lambda t: self.plan(t, True))
        naechste = mitternacht(s.tag) + timedelta(minutes=s.minute) if s.minute is not None and s.tag is not None else None
        heizt = any(z in ("heizt", "trocknen", "frost") for z in st.daten.zustand.values())
        ausnahme = next((a for a in st.ausnahmen() if a.datum == heute), None)
        if ausnahme is not None and ausnahme.art == AusnahmeArt.FREI:
            status = "frei"
        elif self.ist_frei(heute) and (ausnahme is None or ausnahme.art == AusnahmeArt.FREI):
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
        return True

    def zaehlen_bereich(self, bid: str, heizt: bool, jetzt: datetime, stunden: float) -> None:
        if heizt:
            self._heiztag = True
            self.st.zaehler_plus(f"heizzeit:{bid}", stunden)
        self._temperaturverhalten(bid, heizt, jetzt, stunden)

    def energie_buchen(self, g: GeraetInfo, kwh: float) -> None:
        """Energie fürs Heizen (Ersparnis) und je Heizkörper-Typ (Vergleich Ölradiator/Konvektor)."""
        self.st.zaehler_plus("energie_heizen", kwh)
        if g.rolle == ROLLE_HEIZKOERPER:
            self.st.zaehler_plus(f"energie_typ:{g.typ}", kwh)

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
