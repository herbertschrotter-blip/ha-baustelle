"""Einstellungen und Laufzeitdaten einer Baustelle (Store Version 2, Bauplan 0.7 §1).

Sie liegen je Baustelle in einem `Store` (JSON unter `.storage/baustelle.<entry_id>`, in der Sicherung enthalten)
und werden nur noch auf der eigenen Seite bedient (WebSocket `baustelle/setzen`, `baustelle/liste`).

Version 1 (0.6) wird beim Laden umgestellt: Entscheidung „neu anfangen“ (30.09.2026) – nur die Zähler bleiben,
alles andere startet mit den Standardwerten (wie im abgenommenen Mockup).

Die Meldungen aus dem Melden-Knopf gelten für die ganze Integration und liegen in einem eigenen Store
(`.storage/baustelle.meldungen`, `Meldungen`).
"""

from __future__ import annotations

import copy
import json
import os
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util
from homeassistant.util.file import write_utf8_file

from .const import DOMAIN
from .logik.arbeitszeit import arbeitszeiten_bereinigen, erste_arbeitszeit
from .logik.warnungen import Art

STORE_VERSION = 2
SPEICHER_VERZOEGERUNG_S = 2
PROTOKOLL_MAX = 1000
MELDUNGEN_KEY = f"{DOMAIN}.meldungen"

EIGEN = "eigen"
ANSCHLUSS_STANDARD = "a1"

STANDARD: dict[str, Any] = {
    "automatik": False,
    "preis": 0.28,
    "arbeitszeiten": [],  # beim ersten Laden: eine Arbeitszeit ab heute (siehe `logik.arbeitszeit.erste_arbeitszeit`)
    "ausnahmen": [],
    "heizung": {
        "vorheizen_min": 45,
        "nachheizen_min": 15,
        "soll": 20.0,
        "toleranz": 0.3,
        "heizgrenze": 15.0,
        "heizgrenze_basis": "tageshoechst",
        "fruehstart": True,
        "fruehstart_unter": 0.0,
        "fruehstart_min": 30,
        "frost": True,
        "frost_grenze": 5.0,
        "frost_aus": None,        # Frostschutz aus über … °C; None = Grenze + 2 °C (neu 0.7.8)
        "frei_modus": "frost",    # Urlaub und freie Feiertage: frost | absenk | aus (neu 0.7.8)
        "absenk": 10.0,
        "frost_immer": False,     # Frostschutz auch bei ausgeschalteter Automatik (startet aus)
        "trocknen_ab_mm": 2.0,
        "trocknen_laenger_min": 45,
        "trocknen_frueher_min": 15,
        "tuer_pause_min": 3,
        "tuer_melden_min": 10,
        "boost_min": 30,
        "feiertag_frei": True,
    },
    "staffel": {"an": True, "nutzbar_prozent": 67, "max_gleichzeitig": 5, "min_lauf_min": 10, "min_pause_min": 5,
                "takt_min": 15},
    "anschluesse": [{"id": ANSCHLUSS_STANDARD, "name": "Anschluss 1", "ampere": 32, "phasen": 3, "reserve_kw": 3.0}],
    "firmen": [{"id": EIGEN, "name": "Eigene Firma", "eigen": True}],
    "zuordnung": [],
    "bereiche": {},
    # „frueher“: Nachricht „Noch früher“ – Tag (ISO) → zusätzliche Minuten Frühstart; „regen“: Regen je Tag (mm) für
    # „nach Regen früher“ am Folgetag
    "laufzeit": {"bedarf_bis": {}, "boost_bis": {}, "jetzt_bis": None, "hand": {}, "frueher": {}, "regen": {}},
    "meldungen_einst": {
        "empfaenger": [],
        "knoepfe": True,
        "arten": {str(a): True for a in Art},
        "kalt_min": 60,
        "hand_h": 8,
        "zyklen_h": 10,
        "dauerlauf_min": 20,
        "trocken_unter_w": 30,
        "offline_min": 5,
    },
    "bericht": {"haeufigkeit": "woche", "handy": True, "mail": False, "mail_an": "", "mail_dienst": "", "csv": True},
    "termine_kalender": None,
    "stumm": {},
    "melden_knopf": True,
    "erklaer": True,          # Erklärtexte „ⓘ“ auf der Seite (0.7.8)
    "protokoll": [],
    # Zähler wie 0.6: Energie, Kosten, Zeiten, Zyklen, Mittel; „stand:<gerät>“ = letzter Zählerstand des Shelly
    "zaehler": {},
}

STANDARD_BEREICH: dict[str, Any] = {
    "auto": True,
    "trocknen": False,
    "soll": None,
    "bedarf": False,
    "prio": "normal",
    "anschluss": ANSCHLUSS_STANDARD,
    "tuer": None,
    # Modus (neu 0.7.8): plan | thermo | bedarf | hand | aus; None = aus `auto`/`bedarf` und Fühler abgeleitet
    "modus": None,
}


def _ergaenzen(ziel: dict[str, Any], vorlage: dict[str, Any]) -> dict[str, Any]:
    """Fehlende Schlüssel aus der Vorlage übernehmen (neue Einstellungen nach Updates)."""
    for schluessel, wert in vorlage.items():
        if schluessel not in ziel or (ziel[schluessel] is None and wert is not None and isinstance(wert, dict)):
            ziel[schluessel] = copy.deepcopy(wert)
        elif isinstance(wert, dict) and isinstance(ziel[schluessel], dict):
            _ergaenzen(ziel[schluessel], wert)
    return ziel


class _BaustelleStore(Store[dict[str, Any]]):
    """Store mit Umstellung von Version 1 (0.6): nur die Zähler bleiben."""

    async def _async_migrate_func(
        self, old_major_version: int, old_minor_version: int, old_data: dict[str, Any]
    ) -> dict[str, Any]:
        if old_major_version < 2:
            return {"zaehler": dict((old_data or {}).get("zaehler") or {}), "_von_v1": True}
        return old_data


class Einstellungen:
    """Gespeicherte Einstellungen und Laufzeitdaten einer Baustelle."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self._hass = hass
        self._store: Store[dict[str, Any]] = _BaustelleStore(hass, STORE_VERSION, f"{DOMAIN}.{entry_id}")
        self.daten: dict[str, Any] = copy.deepcopy(STANDARD)
        self.von_v1 = False
        self._faellig: float | None = None  # Loop-Zeit, zu der der eingeplante Schreibvorgang läuft

    async def async_laden(self, bereich_ids: list[str], empfaenger: list[str] | None = None) -> None:
        """Laden, fehlende Werte ergänzen, Einstellungen gelöschter Bereiche entfernen.

        `empfaenger` (aus den Optionen von 0.6) wird übernommen, solange im Store noch keiner eingetragen ist.
        """
        gespeichert = await self._store.async_load() or {}
        self.von_v1 = bool(gespeichert.pop("_von_v1", False))
        neu = not gespeichert or self.von_v1
        self.daten = _ergaenzen(gespeichert, STANDARD)
        if neu and not self.daten["arbeitszeiten"]:
            self.daten["arbeitszeiten"] = [erste_arbeitszeit(dt_util.now().date())]
        # automatische kennzeichnen und wegnehmen, sobald es eine eigene gibt (FE-0002)
        bereinigt = arbeitszeiten_bereinigen(self.daten["arbeitszeiten"])
        geaendert = bereinigt != self.daten["arbeitszeiten"]
        self.daten["arbeitszeiten"] = bereinigt
        if empfaenger and not self.daten["meldungen_einst"]["empfaenger"]:
            self.daten["meldungen_einst"]["empfaenger"] = list(empfaenger)
        bereiche = self.daten["bereiche"]
        for bid in list(bereiche):
            if bid not in bereich_ids:
                del bereiche[bid]
        erster = (self.daten["anschluesse"] or [{"id": ANSCHLUSS_STANDARD}])[0]["id"]
        for bid in bereich_ids:
            b = bereiche.setdefault(bid, {})
            _ergaenzen(b, {**STANDARD_BEREICH, "anschluss": erster})
        del self.daten["protokoll"][PROTOKOLL_MAX:]
        if neu or geaendert:
            self.speichern()

    def speichern(self, verzoegerung: float = SPEICHER_VERZOEGERUNG_S) -> None:
        """Verzögert speichern (mehrere Änderungen hintereinander → ein Schreibvorgang).

        `Store.async_delay_save` verschiebt einen eingeplanten Schreibvorgang bei jedem Aufruf nach hinten. Die
        Zähler ändern sich bei jedem Messwert (alle paar Sekunden) – dann würde nie geschrieben und bei Stromausfall
        gingen die Zähler seit dem letzten Neustart verloren. Deshalb: steht schon ein Schreibvorgang an, der
        spätestens zur gewünschten Zeit läuft, bleibt er (er schreibt den dann aktuellen Stand, `data_func`).
        """
        jetzt = self._hass.loop.time()
        ziel = jetzt + verzoegerung
        if self._faellig is not None and jetzt < self._faellig <= ziel:
            return
        self._faellig = ziel
        self._store.async_delay_save(lambda: self.daten, verzoegerung)

    async def async_jetzt_speichern(self) -> None:
        """Sofort speichern (beim Entladen)."""
        self._faellig = None
        await self._store.async_save(self.daten)

    async def async_entfernen(self) -> None:
        """Datei beim Löschen der Baustelle entfernen."""
        await self._store.async_remove()

    def bereich(self, bereich_id: str) -> dict[str, Any]:
        """Einstellungen eines Bereichs."""
        bereich: dict[str, Any] = self.daten["bereiche"].setdefault(bereich_id, copy.deepcopy(STANDARD_BEREICH))
        return bereich

    def protokoll(self, eintrag: list[Any]) -> None:
        """Eintrag vorne anfügen, höchstens `PROTOKOLL_MAX` behalten."""
        liste = self.daten["protokoll"]
        liste.insert(0, eintrag)
        del liste[PROTOKOLL_MAX:]
        self.speichern()


ART_TEXT = {"fehler": "Fehler", "wunsch": "Wunsch", "anregung": "Anregung"}
# Tickets: Präfix je Art, Nummer je Art aufsteigend ab 0001 (Herbert, 30.09.2026)
PRAEFIX = {"fehler": "FE", "wunsch": "WU", "anregung": "AN"}
# Status wie im Skill „ticket“: neu → angenommen → in_arbeit → geloest → geschlossen, daneben verworfen
TICKET_STATUS = ["neu", "angenommen", "in_arbeit", "geloest", "geschlossen", "verworfen"]
STATUS_TEXT = {"neu": "neu", "angenommen": "angenommen", "in_arbeit": "in Arbeit", "geloest": "gelöst",
               "geschlossen": "geschlossen", "verworfen": "verworfen"}
TICKET_OFFEN = {"neu", "angenommen", "in_arbeit", "geloest"}
STATUS_ALT = {"offen": "neu", "erledigt": "geschlossen"}  # Meldungen aus 0.7.0–0.7.3


def meldungen_markdown(liste: list[dict[str, Any]], stand: str) -> str:
    """Tickets lesbar: offene zuerst, je Ticket Nummer, Art, Status, Zeit, Version, Gerät, Fenster, Seite, Text, Verlauf."""
    offen = [m for m in liste if m.get("status") in TICKET_OFFEN]
    erledigt = [m for m in liste if m.get("status") not in TICKET_OFFEN]
    zeilen = ["# Meldungen aus dem Melden-Knopf (Tickets)", "",
              f"Stand: {stand} · offen: {len(offen)} · erledigt: {len(erledigt)}", "",
              "Diese Datei schreibt die Integration Baustelle bei jeder Änderung neu. Quelle ist ihr Speicher; "
              "Status und Notizen ändert `tools/ticket.py` (Dienst baustelle.ticket), angesehen und geschlossen wird "
              "auf der Seite unter Einstellungen › Entwicklung.", ""]
    for titel, teil in (("Offen", offen), ("Erledigt", erledigt)):
        zeilen += [f"## {titel}", ""]
        if not teil:
            zeilen += ["(keine)", ""]
        for m in teil:
            kopf = " · ".join(str(x) for x in (
                m.get("ticket"), ART_TEXT.get(str(m.get("art")), m.get("art")), STATUS_TEXT.get(str(m.get("status")), m.get("status")),
                str(m.get("zeit") or "")[:16].replace("T", " "), f"v{m.get('version')}" if m.get("version") else "", m.get("geraet")) if x)
            zeilen += [f"### {kopf}", "", str(m.get("text") or "").strip(), ""]
            if m.get("kontext"):
                zeilen.append(f"- Fenster: {m['kontext']}")
            if m.get("seite"):
                zeilen.append(f"- Seite: `{json.dumps(m['seite'], ensure_ascii=False)}`")
            if m.get("baustelle"):
                zeilen.append(f"- Baustelle: {m['baustelle']}")
            zeilen.append(f"- id: {m.get('id')}")
            for v in m.get("verlauf") or []:
                teile = [STATUS_TEXT.get(v.get("status"), v.get("status")) if v.get("status") else "",
                         f"v{v['version']}" if v.get("version") else "", f"Commit {v['commit']}" if v.get("commit") else "",
                         v.get("notiz") or ""]
                zeilen.append(f"- {str(v.get('zeit') or '')[:16].replace('T', ' ')} ({v.get('von') or '–'}): " + " · ".join(t for t in teile if t))
            zeilen.append("")
    return "\n".join(zeilen)


def _meldungen_schreiben(ordner: str, liste: list[dict[str, Any]], stand: str) -> None:
    os.makedirs(ordner, exist_ok=True)
    write_utf8_file(os.path.join(ordner, "meldungen.json"), json.dumps(liste, ensure_ascii=False, indent=2) + "\n")
    write_utf8_file(os.path.join(ordner, "meldungen.md"), meldungen_markdown(liste, stand) + "\n")


class Meldungen:
    """Meldungen aus dem Melden-Knopf (Fehler, Wünsche, Anregungen) – eine Liste für die ganze Integration.

    Quelle ist der Store; zusätzlich schreibt die Integration die Liste lesbar nach `<config>/baustelle/meldungen.json`
    und `meldungen.md` (beim Laden und nach jeder Änderung), damit sie ohne Zugriff auf `.storage/` gelesen und
    abgearbeitet werden kann. Die Meldungen enthalten nur, was im Melden-Dialog steht – keine Zugangsdaten.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, 1, MELDUNGEN_KEY)
        self.liste: list[dict[str, Any]] = []
        self.nummern: dict[str, int] = {}
        self._geladen = False
        self.ordner = hass.config.path(DOMAIN)

    async def async_laden(self) -> list[dict[str, Any]]:
        if not self._geladen:
            daten = (await self._store.async_load()) or {}
            self.liste = list(daten.get("meldungen") or [])
            self.nummern = {k: int(v) for k, v in (daten.get("nummern") or {}).items()}
            self._geladen = True
            if self._nummerieren():
                self.speichern()
            else:
                await self.async_exportieren()
        return self.liste

    def _nummerieren(self) -> bool:
        """Ältere Meldungen ohne Ticketnummer nummerieren (älteste zuerst), alte Status auf die Ticket-Status umstellen."""
        geaendert = False
        for m in reversed(self.liste):
            if m.get("status") in STATUS_ALT:
                m["status"] = STATUS_ALT[m["status"]]
                geaendert = True
            if not m.get("ticket"):
                m["ticket"] = self.neue_nummer(str(m.get("art") or "fehler"))
                geaendert = True
        return geaendert

    def neue_nummer(self, art: str) -> str:
        """Nächste Ticketnummer der Art, z. B. FE-0001."""
        praefix = PRAEFIX.get(art, "FE")
        n = self.nummern.get(praefix, 0) + 1
        self.nummern[praefix] = n
        return f"{praefix}-{n:04d}"

    def finden(self, schluessel: str) -> dict[str, Any] | None:
        """Ticket nach Nummer (FE-0001, groß/klein egal) oder id."""
        s = schluessel.strip().upper()
        return next((m for m in self.liste if str(m.get("ticket", "")).upper() == s or m.get("id") == schluessel.strip()), None)

    def aendern(self, m: dict[str, Any], *, status: str | None = None, notiz: str | None = None,
                version: str | None = None, commit: str | None = None, von: str = "") -> None:
        """Status/Notiz eines Tickets ändern und im Verlauf festhalten."""
        jetzt = dt_util.now().isoformat(timespec="seconds")
        eintrag = {"zeit": jetzt, "von": von}
        if status:
            m["status"] = STATUS_ALT.get(status, status)
            m["stand"] = jetzt
            eintrag["status"] = m["status"]
        for k, v in (("notiz", notiz), ("version", version), ("commit", commit)):
            if v:
                eintrag[k] = v
        m.setdefault("verlauf", []).append(eintrag)
        self.speichern()

    async def async_exportieren(self) -> None:
        """Lesbare Kopie nach <config>/baustelle/ schreiben (im Hintergrund-Thread)."""
        await self._hass.async_add_executor_job(
            _meldungen_schreiben, self.ordner, copy.deepcopy(self.liste), dt_util.now().isoformat(timespec="seconds"))

    def speichern(self) -> None:
        self._store.async_delay_save(lambda: {"meldungen": self.liste, "nummern": self.nummern}, SPEICHER_VERZOEGERUNG_S)
        self._hass.async_create_task(self.async_exportieren(), "baustelle_meldungen_exportieren")
