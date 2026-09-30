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
from datetime import date
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN
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
    "arbeitszeiten": [],  # beim ersten Laden: eine Arbeitszeit ab heute (siehe `_erste_arbeitszeit`)
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
}


def _erste_arbeitszeit(heute: date) -> dict[str, Any]:
    """Arbeitszeit für eine neue Baustelle (Mockup „Herbst 2026“: Mo–Do 07:00–16:30, Fr 07:00–12:30)."""
    lang, kurz = ["07:00", "16:30"], ["07:00", "12:30"]
    return {
        "ab": heute.isoformat(),
        "name": "Arbeitszeit",
        "tage": {"0": lang, "1": list(lang), "2": list(lang), "3": list(lang), "4": kurz, "5": None, "6": None},
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
            self.daten["arbeitszeiten"] = [_erste_arbeitszeit(dt_util.now().date())]
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
        if neu:
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
        return self.daten["bereiche"].setdefault(bereich_id, copy.deepcopy(STANDARD_BEREICH))

    def protokoll(self, eintrag: list[Any]) -> None:
        """Eintrag vorne anfügen, höchstens `PROTOKOLL_MAX` behalten."""
        liste = self.daten["protokoll"]
        liste.insert(0, eintrag)
        del liste[PROTOKOLL_MAX:]
        self.speichern()


class Meldungen:
    """Meldungen aus dem Melden-Knopf (Fehler, Wünsche, Anregungen) – eine Liste für die ganze Integration."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, 1, MELDUNGEN_KEY)
        self.liste: list[dict[str, Any]] = []
        self._geladen = False

    async def async_laden(self) -> list[dict[str, Any]]:
        if not self._geladen:
            self.liste = list(((await self._store.async_load()) or {}).get("meldungen") or [])
            self._geladen = True
        return self.liste

    def speichern(self) -> None:
        self._store.async_delay_save(lambda: {"meldungen": self.liste}, SPEICHER_VERZOEGERUNG_S)
