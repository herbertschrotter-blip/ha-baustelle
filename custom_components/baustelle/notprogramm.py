"""Notprogramm in den Plugs einrichten und aktuell halten (Bauplan 0.7 §9, BSM-017).

Alle 5 min je Heizungs-Plug (Shelly Gen2+, Adresse aus der Shelly-Integration):
1. Skript `baustelle` vorhanden, in der Version von `shelly/notprogramm.js` und gestartet? Sonst anlegen bzw. neu
   hochladen (`Script.Create`, `Script.PutCode` in Stücken, `Script.SetConfig enable`, `Script.Start`).
2. Programm rechnen (logik/notprogramm) und geänderte Schlüssel per `KVS.Set` schreiben, danach `hb?neu`.
3. Lebenszeichen `GET /script/<id>/hb` – solange es kommt, schaltet das Skript nicht.

Der Fühler bzw. die Tür kommt nur ins Programm, wenn genau dieser Sensor am Plug gekoppelt ist: gesucht wird über die
Bluetooth-Adresse des Geräts in HA (BTHome) unter den `bthomesensor`-Komponenten des Plugs (Temperatur 69, Fenster 45).
Die Kopplungen hält die Integration selbst in Ordnung (BSM-030): BLU-Fühler und -Tür des Containers koppeln (an jedem
Plug des Containers), fremde Kopplungen entfernen, Namen nach Herberts Schema (Gerätename in HA + `_Temperatur` …);
jede Änderung im Protokoll. Andere Komponenten (Skripte, Schalter) fasst sie nicht an.

Startet ausgeschaltet (`heizung.notprogramm`): Erst wenn Herbert es einschaltet, spielt die Integration etwas in die
Plugs. Ausschalten hält das Skript an und nimmt den Autostart weg – sonst übernähme es 15 min später.
Ohne Gerätepasswort (BSM-001 verworfen); ein Plug mit Passwort meldet „Passwort gesetzt“.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json
import logging
from pathlib import Path
import re
from typing import TYPE_CHECKING, Any, cast

import aiohttp

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import DOMAIN, ROLLE_HEIZKOERPER
from .logik import notprogramm as logik
from .logik.arbeitszeit import ausnahme_am, bedarf_fenster, frei_gilt

if TYPE_CHECKING:
    from .funktionen.heizung import Heizung
    from .steuerung import GeraetInfo, Steuerung

_LOGGER = logging.getLogger(__name__)

DATA_NOTPROGRAMM = f"{DOMAIN}_notprogramm"
SKRIPT = Path(__file__).parent / "shelly" / "notprogramm.js"
SKRIPT_NAME = "baustelle"
INTERVALL = timedelta(minutes=5)
ERSTE_RUNDE_S = 60
STUECK = 800          # Zeichen je Script.PutCode (BSM-013)
WARTEN_S = 2.0        # nach dem Start, bis der Endpunkt `hb` antwortet
TIMEOUT_S = 10
OHNE_ANTWORT_S = 3
OBJ_TEMPERATUR, OBJ_FENSTER = 69, 45


class PlugFehler(Exception):
    """Ein Plug antwortet nicht oder mit Fehler."""


def skript_lesen() -> tuple[int, str]:
    """Version und Code zum Hochladen (ganze Kommentarzeilen und Leerzeilen weg – spart Speicher im Plug)."""
    text = SKRIPT.read_text(encoding="utf-8")
    treffer = re.search(r"^let VERSION = (\d+);", text, re.M)
    if treffer is None:
        raise ValueError("notprogramm.js ohne VERSION")
    code = "\n".join(z for z in text.splitlines() if z.strip() and not z.lstrip().startswith("//"))
    return int(treffer.group(1)), code + "\n"


class Plug:
    """RPC über HTTP an einen Shelly Gen2+."""

    def __init__(self, session: aiohttp.ClientSession, host: str) -> None:
        self._session, self._host = session, host

    async def rpc(self, methode: str, params: dict[str, Any] | None = None, *, ohne_antwort: bool = False) -> Any:
        """Aufruf; `ohne_antwort`: das Gerät antwortet nicht verlässlich (BTHome.AddDevice) – kurz warten, dann weiter."""
        # UTF-8 statt \u-Maskierung: Script.PutCode lehnt maskierte Umlaute ab (BSM-013)
        daten = json.dumps({"id": 1, "method": methode, "params": params or {}}, ensure_ascii=False).encode()
        try:
            async with self._session.post(f"http://{self._host}/rpc", data=daten,
                                          timeout=aiohttp.ClientTimeout(total=OHNE_ANTWORT_S if ohne_antwort else TIMEOUT_S),
                                          headers={"Content-Type": "application/json"}) as antwort:
                if antwort.status == 401:
                    raise PlugFehler("Passwort gesetzt")
                inhalt = await antwort.json(content_type=None)
        except TimeoutError as err:
            if ohne_antwort:
                return None
            raise PlugFehler(f"{methode}: {err.__class__.__name__}") from err
        except (aiohttp.ClientError, ValueError) as err:
            raise PlugFehler(f"{methode}: {err.__class__.__name__}") from err
        if not isinstance(inhalt, dict) or "error" in inhalt:
            raise PlugFehler(f"{methode}: {(inhalt or {}).get('error', {}).get('message', 'Fehler')}")
        return inhalt.get("result")

    async def hb(self, skript_id: int, neu: bool = False) -> dict[str, Any]:
        url = f"http://{self._host}/script/{skript_id}/hb" + ("?neu" if neu else "")
        try:
            async with self._session.get(url, timeout=aiohttp.ClientTimeout(total=TIMEOUT_S)) as antwort:
                if antwort.status != 200:
                    raise PlugFehler(f"Lebenszeichen: HTTP {antwort.status}")
                inhalt = await antwort.json(content_type=None)
        except (aiohttp.ClientError, TimeoutError, ValueError) as err:
            raise PlugFehler(f"Lebenszeichen: {err.__class__.__name__}") from err
        return cast(dict[str, Any], inhalt)


@dataclass
class Stand:
    """Was die Integration über einen Plug weiß (Diagnose, später Anzeige BSM-019)."""

    skript_id: int | None = None
    version: int | None = None
    programm: int | None = None       # Stand, den das Skript geladen hat
    notbetrieb: int = 0               # Notbetrieb seit (Unix-Sekunden, 0 = nein) laut letzter Antwort
    fuehler: int | None = None
    tuer: int | None = None
    fehler: str | None = None
    zuletzt: datetime | None = None
    geschrieben: dict[str, str] | None = field(default=None, repr=False)
    geprueft_aus: bool = False

    def info(self) -> dict[str, Any]:
        return {"skript_id": self.skript_id, "version": self.version, "programm": self.programm,
                "notbetrieb": self.notbetrieb, "fuehler": self.fuehler, "tuer": self.tuer, "fehler": self.fehler,
                "zuletzt": self.zuletzt.isoformat() if self.zuletzt else None}


class Notprogramm:
    """Hält Skript, Programm und Lebenszeichen auf allen Heizungs-Plugs einer Baustelle aktuell."""

    def __init__(self, hass: HomeAssistant, st: Steuerung) -> None:
        self.hass, self.st = hass, st
        self.stand: dict[str, Stand] = {}
        self._sperre = asyncio.Lock()
        self._skript: tuple[int, str] | None = None

    @callback
    def async_start(self) -> CALLBACK_TYPE:
        abmelden = [async_track_time_interval(self.hass, self._async_takt, INTERVALL),
                    async_call_later(self.hass, ERSTE_RUNDE_S, self._async_takt)]

        @callback
        def stop() -> None:
            for f in abmelden:
                f()
        return stop

    @property
    def an(self) -> bool:
        return bool(self.st.e["heizung"].get("notprogramm"))

    async def _async_takt(self, _jetzt: datetime | None = None) -> None:
        await self.async_runde()

    async def async_runde(self) -> None:
        """Eine Runde über alle Plugs (nie zwei gleichzeitig)."""
        if self._sperre.locked():
            return
        async with self._sperre:
            if self._skript is None:
                self._skript = await self.hass.async_add_executor_job(skript_lesen)
            session = async_get_clientsession(self.hass)
            for g, host in self.plugs():
                stand = self.stand.setdefault(g.id, Stand())
                try:
                    if self.an:
                        await self._async_plug(g, Plug(session, host), stand)
                    elif not stand.geprueft_aus:
                        await self._async_abschalten(Plug(session, host), stand)
                    stand.fehler = None
                except PlugFehler as err:
                    if stand.fehler != str(err):
                        _LOGGER.info("Notprogramm %s: %s", g.name, err)
                    stand.fehler = str(err)

    # ------------------------------------------------------------------ Plugs
    def plugs(self) -> list[tuple[GeraetInfo, str]]:
        """Heizkörper-Plugs der Baustelle mit Adresse (Shelly-Integration, Gen2+)."""
        ents, devs = er.async_get(self.hass), dr.async_get(self.hass)
        raus = []
        for g in self.st.geraete.values():
            if g.rolle != ROLLE_HEIZKOERPER or (eintrag := ents.async_get(g.schalter)) is None or eintrag.device_id is None:
                continue
            if (geraet := devs.async_get(eintrag.device_id)) is None:
                continue
            for entry_id in geraet.config_entries:
                entry = self.hass.config_entries.async_get_entry(entry_id)
                if entry is not None and entry.domain == "shelly" and entry.data.get("host") and int(entry.data.get("gen") or 1) >= 2:
                    raus.append((g, str(entry.data["host"])))
                    break
        return raus

    def _bt_adresse(self, entity_id: str | None) -> str | None:
        """Bluetooth-Adresse des Geräts hinter einer Entität (BTHome), klein geschrieben."""
        if not entity_id or (eintrag := er.async_get(self.hass).async_get(entity_id)) is None or eintrag.device_id is None:
            return None
        geraet = dr.async_get(self.hass).async_get(eintrag.device_id)
        for art, wert in geraet.connections if isinstance(geraet, dr.DeviceEntry) else ():
            if art == dr.CONNECTION_BLUETOOTH:
                return wert.lower()
        return None

    async def _gekoppelt(self, plug: Plug) -> tuple[dict[str, tuple[int, str | None]], dict[tuple[str, int], tuple[int, str | None]]]:
        """Gekoppelte Geräte (Adresse → Nummer, Name) und Messwerte ((Adresse, Objekt) → Nummer, Name) am Plug."""
        geraete: dict[str, tuple[int, str | None]] = {}
        sensoren: dict[tuple[str, int], tuple[int, str | None]] = {}
        offset = 0
        while True:
            r = await plug.rpc("Shelly.GetComponents", {"dynamic_only": True, "include": ["config"], "offset": offset})
            teile = r.get("components") or []
            for k in teile:
                c, key = k.get("config") or {}, str(k.get("key", ""))
                if not c.get("addr"):
                    continue
                if key.startswith("bthomesensor:"):
                    sensoren.setdefault((str(c["addr"]).lower(), int(c.get("obj_id", -1))), (int(c["id"]), c.get("name")))
                elif key.startswith("bthomedevice:"):
                    geraete.setdefault(str(c["addr"]).lower(), (int(c["id"]), c.get("name")))
            offset += len(teile)
            if not teile or offset >= int(r.get("total") or 0):
                return geraete, sensoren

    def _gewollt(self, g: GeraetInfo) -> dict[str, tuple[str, str]]:
        """BLU-Sensoren des Containers: Bluetooth-Adresse → (Gerätename in HA, Rolle)."""
        raus: dict[str, tuple[str, str]] = {}
        for entity_id, rolle in ((self.st.bereiche[g.bereich].fuehler, "fuehler"), (self.st.einstellungen.bereich(g.bereich).get("tuer"), "tuer")):
            if (a := self._bt_adresse(entity_id)) is not None and (name := self._geraet_name(entity_id)):
                raus[a] = (name, rolle)
        return raus

    def _geraet_name(self, entity_id: str | None) -> str | None:
        eintrag = er.async_get(self.hass).async_get(entity_id or "")
        geraet = dr.async_get(self.hass).async_get(eintrag.device_id) if eintrag is not None and eintrag.device_id else None
        if not isinstance(geraet, dr.DeviceEntry):
            return None
        adresse = next((w for art, w in geraet.connections if art == dr.CONNECTION_BLUETOOTH), "")
        return geraet.name_by_user or geraet.name or f"BLU_{adresse.replace(':', '')[-4:].upper()}"

    async def _async_kopplungen(self, g: GeraetInfo, plug: Plug) -> bool:
        """Kopplungen am Plug in Ordnung bringen (logik/notprogramm.kopplungen); True, wenn sich etwas geändert hat.

        Ein Schritt, der scheitert, wird in der nächsten Runde wieder versucht (z. B. Messwert vor dem Gerät angelegt).
        """
        geraete, sensoren = await self._gekoppelt(plug)
        gewollt = self._gewollt(g)
        namen = {a: n for a, (_, n) in geraete.items()} | {a: n for a, (n, _) in gewollt.items()}
        texte: list[str] = []
        for k in logik.kopplungen(gewollt, geraete, sensoren):
            try:
                match k.art:
                    case "sensor_weg":
                        await plug.rpc("BTHome.DeleteSensor", {"id": k.nr})
                    case "geraet_weg":
                        await plug.rpc("BTHome.DeleteDevice", {"id": k.nr})
                        texte.append(f"{namen.get(k.adresse) or k.adresse} entfernt")
                    case "geraet_neu":
                        await plug.rpc("BTHome.AddDevice", {"config": {"addr": k.adresse, "name": k.name}}, ohne_antwort=True)
                        texte.append(f"{k.name} gekoppelt")
                    case "sensor_neu":
                        await plug.rpc("BTHome.AddSensor", {"config": {"addr": k.adresse, "obj_id": k.obj, "idx": 0, "name": k.name}})
                    case "geraet_name":
                        await plug.rpc("BTHomeDevice.SetConfig", {"id": k.nr, "config": {"name": k.name}})
                        texte.append(f"{k.name} umbenannt")
                    case "sensor_name":
                        await plug.rpc("BTHomeSensor.SetConfig", {"id": k.nr, "config": {"name": k.name}})
            except PlugFehler as err:
                _LOGGER.info("Notprogramm %s: Kopplung %s %s: %s", g.name, k.art, k.name or k.nr, err)
                continue
        if texte:
            self.st.protokoll("einstellung", g.bereich, f"Notprogramm {g.name}: " + ", ".join(dict.fromkeys(texte)))
        return bool(texte)

    # ------------------------------------------------------------------ Skript
    async def _async_skript(self, plug: Plug, stand: Stand) -> int:
        """Skript-ID; fehlt es, anlegen und hochladen; steht es, starten."""
        liste = (await plug.rpc("Script.List")).get("scripts") or []
        eigenes = next((s for s in liste if s.get("name") == SKRIPT_NAME), None)
        if eigenes is None:
            skript_id = int((await plug.rpc("Script.Create", {"name": SKRIPT_NAME}))["id"])
            await self._async_hochladen(plug, skript_id)
            stand.geschrieben = None
            return skript_id
        skript_id = int(eigenes["id"])
        if not eigenes.get("enable"):
            await plug.rpc("Script.SetConfig", {"id": skript_id, "config": {"enable": True}})
        if not eigenes.get("running"):
            await plug.rpc("Script.Start", {"id": skript_id})
            await asyncio.sleep(WARTEN_S)
        return skript_id

    async def _async_hochladen(self, plug: Plug, skript_id: int, laeuft: bool = False) -> None:
        assert self._skript is not None
        code = self._skript[1]
        if laeuft:
            await plug.rpc("Script.Stop", {"id": skript_id})
        for i in range(0, len(code), STUECK):
            await plug.rpc("Script.PutCode", {"id": skript_id, "code": code[i:i + STUECK], "append": i > 0})
        await plug.rpc("Script.SetConfig", {"id": skript_id, "config": {"enable": True}})
        await plug.rpc("Script.Start", {"id": skript_id})
        await asyncio.sleep(WARTEN_S)

    async def _async_abschalten(self, plug: Plug, stand: Stand) -> None:
        """Notprogramm aus: eigenes Skript anhalten und Autostart weg (einmal je Start bzw. Ausschalten)."""
        liste = (await plug.rpc("Script.List")).get("scripts") or []
        for s in liste:
            if s.get("name") == SKRIPT_NAME and (s.get("running") or s.get("enable")):
                await plug.rpc("Script.Stop", {"id": s["id"]})
                await plug.rpc("Script.SetConfig", {"id": s["id"], "config": {"enable": False}})
        stand.geprueft_aus, stand.geschrieben = True, None

    # ------------------------------------------------------------------ eine Runde je Plug
    async def _async_plug(self, g: GeraetInfo, plug: Plug, stand: Stand) -> None:
        assert self._skript is not None
        stand.geprueft_aus = False
        skript_id = await self._async_skript(plug, stand)
        stand.skript_id = skript_id
        antwort = await plug.hb(skript_id)
        if antwort.get("v") != self._skript[0]:
            await self._async_hochladen(plug, skript_id, laeuft=True)
            stand.geschrieben = None
            antwort = await plug.hb(skript_id)
        await self._async_kopplungen(g, plug)
        _, sensoren = await self._gekoppelt(plug)
        messwerte = {k: nr for k, (nr, _) in sensoren.items()}
        info = self.st.bereiche[g.bereich]
        e = self.st.einstellungen.bereich(g.bereich)
        stand.fuehler = messwerte.get((a, OBJ_TEMPERATUR)) if (a := self._bt_adresse(info.fuehler)) else None
        stand.tuer = messwerte.get((a, OBJ_FENSTER)) if (a := self._bt_adresse(e.get("tuer"))) else None
        werte = self.werte(g, stand.fuehler, stand.tuer)
        if stand.geschrieben is None:
            stand.geschrieben = {k["key"]: k["value"] for k in
                                 ((await plug.rpc("KVS.GetMany", {"match": "bs_*"})).get("items") or [])}
        neu = {k: w for k, w in werte.items() if stand.geschrieben.get(k) != w}
        for k, w in neu.items():   # einzeln nacheinander (höchstens wenige Aufrufe gleichzeitig, BSM-013)
            await plug.rpc("KVS.Set", {"key": k, "value": w})
            stand.geschrieben[k] = w
        if neu or antwort.get("programm") != logik.stand(werte):
            antwort = await plug.hb(skript_id, neu=True)
            antwort["programm"] = logik.stand(werte)   # die Antwort kommt vor dem Laden
        stand.version, stand.programm = antwort.get("v"), antwort.get("programm")
        stand.notbetrieb, stand.zuletzt = int(antwort.get("nb") or 0), dt_util.utcnow()

    # ------------------------------------------------------------------ Programm
    def werte(self, g: GeraetInfo, temp_nr: int | None, tuer_nr: int | None, jetzt: datetime | None = None) -> dict[str, str]:
        """KVS-Werte für den Plug eines Heizkörpers (logik/notprogramm)."""
        st = self.st
        h = cast("Heizung", st.funktion("heizung"))
        jetzt = jetzt or dt_util.now()
        bid, eh, e = g.bereich, st.e["heizung"], st.einstellungen.bereich(g.bereich)
        v = logik.Vorgaben(
            automatik=st.automatik, auto=bool(e["auto"]), hand=g.id in st.lz["hand"], aktiv=st.geraet_aktiv(g),
            modus=h.modus(bid), bedarf=bool(e["bedarf"]), toleranz=float(eh["toleranz"]), frost=bool(eh["frost"]),
            frost_grenze=float(eh["frost_grenze"]), frost_aus=None if eh.get("frost_aus") is None else float(eh["frost_aus"]),
            frost_immer=bool(eh.get("frost_immer")), tuer_pause_min=int(eh["tuer_pause_min"]), temp_nr=temp_nr, tuer_nr=tuer_nr,
        )
        soll, modus = h.soll_temperatur(bid), logik.modus(v)
        fenster: list[logik.Fenster] = []
        wochentag: dict[int, int] = {}
        for i in range(logik.TAGE):
            tag = jetzt.date() + timedelta(days=i)
            beginn = dt_util.start_of_local_day(tag)
            wochentag[int(beginn.timestamp())] = tag.weekday()
            if modus == "bedarf":
                continue
            plan = h.plan_bereich(tag, bid, jetzt) if i == 0 else h.plan(tag, bool(e["trocknen"]))
            for von, bis in logik.minuten_fenster(plan):
                fenster.append((int((beginn + timedelta(minutes=von)).timestamp()),
                                int((beginn + timedelta(minutes=bis)).timestamp()), soll))
            frei = frei_gilt(h.ist_frei(tag), ausnahme_am(st.ausnahmen(), tag))
            if plan is None and frei and eh.get("frei_modus") == "absenk" and modus == "thermo":
                fenster.append((int(beginn.timestamp()), int((beginn + timedelta(days=1)).timestamp()), float(eh.get("absenk") or 10.0)))
        if modus == "bedarf":
            termine = [(von, bis) for von, bis, _ in h.termin_fenster(bid)]
            fenster += [(int(a.timestamp()), int(b.timestamp()), soll) for a, b in bedarf_fenster(termine, int(eh["vorheizen_min"]))]
            if (ende := h.bis("bedarf_bis", bid, jetzt)) is not None:
                fenster.append((int(jetzt.timestamp()), int(ende.timestamp()), soll))
        for ende in (h.bis("boost_bis", bid, jetzt), h.jetzt_bis(jetzt)):   # Boost, „alle jetzt heizen“
            if ende is not None:
                fenster.append((int(jetzt.timestamp()), int(ende.timestamp()), soll))
        return logik.programm(v, fenster, wochentag, int(jetzt.timestamp()))

    def info(self) -> dict[str, Any]:
        """Für die Diagnose (ohne Adressen)."""
        return {"an": self.an, "skript": self._skript[0] if self._skript else None,
                "plugs": {self.st.geraete[gid].name if gid in self.st.geraete else gid: s.info() for gid, s in self.stand.items()}}
