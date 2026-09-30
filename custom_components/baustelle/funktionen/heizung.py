"""Funktion Heizung: Container nach Plan, Wetter und Bedarf heizen (Bauplan 0.7 §2, Bauplan Module §3).

Soll je Container (`logik/regelung.soll_container`), Modus, Handbetrieb, Bedarf/Boost/„alle jetzt heizen“, Tür offen,
Anzeige der Container, Warnungs-Zustände der Container und die Zähler der Heizung (Heizzeit, Heiztage, mittlere
Leistung, „ohne Automatik“, Aufheiz-/Abkühlrate). Geschaltet wird im Kern über die Staffelung.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from homeassistant.const import STATE_ON
from homeassistant.util import dt as dt_util

from ..const import ART_CONTAINER, CONF_HEIZUNG, HEIZROLLEN, ROLLE_HEIZKOERPER, ZIEHT_STROM_W
from ..logik import warnungen as warn_logik
from ..logik.arbeitszeit import Plan, StatusArt, bedarf_fenster, im_fenster, status as plan_status, uhrzeit
from ..logik.regelung import LageContainer, Soll, SollGrund, soll_container
from ..logik.zaehlen import ABKUEHL_MIN_H, AUFHEIZ_MIN_H, gradstunden, mittel, mittel_im_betrieb, rate
from ..texte import GRUND_TEXT, wochentag
from .basis import ZAEHLER_SPEICHERN_S, Funktion, minuten_seit, zahl, zeit

if TYPE_CHECKING:
    from ..steuerung import BereichInfo, GeraetInfo, Steuerung, WetterWerte
    from .basis import SollJeBereich

HEIZ_GRUENDE = {
    SollGrund.FRUEHSTART, SollGrund.VORHEIZEN, SollGrund.ARBEITSZEIT, SollGrund.NACHHEIZEN, SollGrund.TROCKNEN,
    SollGrund.BEDARF, SollGrund.BOOST, SollGrund.FROST, SollGrund.ABSENKEN,
}
MODI = ("plan", "thermo", "bedarf", "hand", "aus")


class Heizung(Funktion):
    """Heizkörper und Bautrockner in Containern."""

    name = "heizung"
    option = CONF_HEIZUNG
    standard = True
    arten = (ART_CONTAINER,)
    rollen = HEIZROLLEN

    def __init__(self, st: Steuerung) -> None:
        super().__init__(st)
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
        return geaendert

    def _termin_fenster(self, bid: str) -> list[tuple[datetime, datetime, bool]]:
        """Termine eines Bedarfs-Containers als (von, bis, boost)."""
        return [
            (von, bis, bool(t.get("boost")))
            for t in self.st.termine
            if t["bereich"] == bid and (von := zeit(t["von"])) is not None and (bis := zeit(t["bis"])) is not None
        ]

    # ------------------------------------------------------------------ Soll
    def soll(self, jetzt: datetime, wetter: WetterWerte, zu_warm: bool) -> SollJeBereich:
        st = self.st
        hass = st.hass
        heute, minute = jetzt.date(), jetzt.hour * 60 + jetzt.minute
        h = st.e["heizung"]
        jetzt_bis = self.jetzt_bis(jetzt)
        frei_heute = st.ist_frei(heute)
        ergebnis: dict[str, tuple[Soll, LageContainer]] = {}
        for info in st.container():
            bid = info.id
            e = st.einstellungen.bereich(bid)
            plan = st.plan(heute, bool(e["trocknen"]))
            st.daten.plaene[bid] = plan
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

    def hand_setzen(self, g: GeraetInfo, an: bool) -> None:
        """Gerät auf Hand: Heizkörper bis zum nächsten Schaltpunkt, andere, solange sie eingeschaltet sind."""
        hand = self.st.lz["hand"]
        if g.rolle != ROLLE_HEIZKOERPER and not an:
            if hand.pop(g.id, None) is not None:
                self.st.einstellungen.speichern()
            return
        if g.id not in hand:
            hand[g.id] = dt_util.now().isoformat(timespec="seconds")
            self._hand_phase.pop(g.id, None)
            self.st.einstellungen.speichern()
        self.st.protokoll("schalten", g.bereich, f"{g.name} von Hand {'eingeschaltet' if an else 'ausgeschaltet'}")

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

    def warnungen(self, jetzt: datetime, soll: SollJeBereich) -> list[warn_logik.ContainerZustand]:
        st = self.st
        liste = []
        for info in st.container():
            s_c = soll.get(info.id)
            temp = st.temperatur(info.fuehler)
            soll_t = self.soll_temperatur(info.id)
            in_az = bool(s_c) and s_c[0].grund == SollGrund.ARBEITSZEIT and st.automatik
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
        s = plan_status(jetzt.date(), jetzt.hour * 60 + jetzt.minute, lambda t: self.st.plan(t, bool(e["trocknen"])))
        if s.minute is None or s.art == StatusArt.HEIZT:
            return None
        if s.tag in (jetzt.date(), jetzt.date() + timedelta(days=1)):
            return uhrzeit(s.minute)  # Mockup „aus bis 06:15“
        return f"{wochentag(s.tag)} {uhrzeit(s.minute)}"

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
        return max(0.0, z.get("ohne", 0.0) - z.get("energie_heizen", 0.0))

    def mittel_typ(self, typ: str) -> float | None:
        """Mittlere Leistung im Betrieb aller Heizkörper eines Typs (Vergleich Ölradiator/Konvektor)."""
        z = self.st.zaehler
        werte = [
            z[f"mittel:{g.id}"]
            for g in self.st.geraete.values()
            if g.rolle == ROLLE_HEIZKOERPER and g.typ == typ and f"mittel:{g.id}" in z
        ]
        return sum(werte) / len(werte) if werte else None
