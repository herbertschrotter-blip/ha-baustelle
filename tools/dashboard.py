#!/usr/bin/env python3
"""YAML-Dashboard „Baustelle“ aus den Diagnose-Downloads der Integration erzeugen.

Aufruf:  python3 tools/dashboard.py diagnose1.json [diagnose2.json …] > ha/dashboards/baustelle.yaml

Je aktive Baustelle: Übersicht, Heizung, Pumpen (falls Funktion an), Auswertung; dazu ein Verlauf über alle
Baustellen und ein Link zur Verwaltung. Nur eingebaute Karten (tile, heading, entities, statistic,
statistics-graph, history-graph, weather-forecast), nach dem abgenommenen Entwurf mockups/baustelle.html.
Die Diagnose lädt man unter Einstellungen → Geräte & Dienste → Baustelle → ⋮ → Diagnose herunterladen.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any

import yaml

TAGE = [("mo", "Montag"), ("di", "Dienstag"), ("mi", "Mittwoch"), ("do", "Donnerstag"), ("fr", "Freitag"),
        ("sa", "Samstag"), ("so", "Sonntag")]
HEIZROLLEN = ("heizkoerper", "bautrockner")
FARBEN = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"]  # geprüfte Palette aus dem Entwurf


def lesen(pfad: str) -> dict[str, Any]:
    daten = json.load(open(pfad, encoding="utf-8"))
    return daten.get("data", daten)


def slug(text: str) -> str:
    text = text.lower().translate(str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}))
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "baustelle"


class Baustelle:
    """Eine Baustelle aus der Diagnose mit Zugriff auf ihre Entitäten über den Schlüssel."""

    def __init__(self, d: dict[str, Any]) -> None:
        self.d = d
        self.id = d["baustelle"]["entry_id"]
        self.titel = d["baustelle"]["titel"]
        self.optionen = d["baustelle"]["optionen"]
        self.aktiv = self.optionen.get("status", "aktiv") == "aktiv"
        self.heizung = bool(self.optionen.get("heizung", True))
        self.pumpen = bool(self.optionen.get("pumpen", False))
        self.bereiche = d["bereiche"]
        self.geraete = d["geraete"]
        self.e = d["entitaeten"]

    def ent(self, key: str, besitzer: str | None = None) -> str | None:
        return self.e.get(f"{besitzer or self.id}_{key}")

    def geraete_in(self, bereich: str, rollen: tuple[str, ...] | None = None) -> list[dict[str, Any]]:
        return [g for g in self.geraete if g["bereich"] == bereich and (rollen is None or g["rolle"] in rollen)]

    @property
    def container(self) -> list[dict[str, Any]]:
        return [b for b in self.bereiche if b["art"] == "container"]

    @property
    def pumpen_liste(self) -> list[dict[str, Any]]:
        return [g for g in self.geraete if g["rolle"] == "pumpe"]


# ---------------------------------------------------------------- Karten
def heading(text: str, icon: str | None = None, subtitel: bool = False, badges: list | None = None) -> dict:
    karte: dict[str, Any] = {"type": "heading", "heading": text}
    if icon:
        karte["icon"] = icon
    if subtitel:
        karte["heading_style"] = "subtitle"
    if badges:
        karte["badges"] = [{"type": "entity", "entity": b, "show_state": True} for b in badges if b]
    return karte


def tile(entity: str | None, name: str | None = None, spalten: int = 6, features: list | None = None, **extra) -> dict | None:
    if not entity:
        return None
    karte: dict[str, Any] = {"type": "tile", "entity": entity, "grid_options": {"columns": spalten}}
    if name:
        karte["name"] = name
    if features:
        karte["features"] = features
        karte["features_position"] = "inline" if spalten >= 12 else "bottom"
    karte.update(extra)
    return karte


def entities(titel: str | None, zeilen: list, **extra) -> dict | None:
    zeilen = [z for z in zeilen if z]
    if not zeilen:
        return None
    karte: dict[str, Any] = {"type": "entities", "entities": zeilen, "grid_options": {"columns": "full"}}
    if titel:
        karte["title"] = titel
    karte.update(extra)
    return karte


def statistik(entity: str | None, name: str, periode: str) -> dict | None:
    if not entity:
        return None
    return {"type": "statistic", "entity": entity, "name": name, "stat_type": "change",
            "period": {"calendar": {"period": periode}}, "grid_options": {"columns": 6}}


def stat_graph(titel: str, reihen: list[tuple[str | None, str]], periode: str = "day", tage: int = 14,
               art: str = "bar", stat: str = "change") -> dict | None:
    reihen = [(e, n) for e, n in reihen if e]
    if not reihen:
        return None
    return {
        "type": "statistics-graph", "title": titel, "period": periode, "days_to_show": tage,
        "stat_types": [stat], "chart_type": art,
        "entities": [{"entity": e, "name": n, "color": FARBEN[i % len(FARBEN)]} for i, (e, n) in enumerate(reihen)],
        "grid_options": {"columns": "full", "rows": 5},
    }


def verlauf(titel: str, reihen: list[tuple[str | None, str]], stunden: int = 24) -> dict | None:
    reihen = [(e, n) for e, n in reihen if e]
    if not reihen:
        return None
    return {"type": "history-graph", "title": titel, "hours_to_show": stunden,
            "entities": [{"entity": e, "name": n} for e, n in reihen],
            "grid_options": {"columns": "full", "rows": max(4, 1 + len(reihen))}}


def section(*karten: dict | None, breit: int = 1) -> dict | None:
    karten_liste = [k for k in karten if k]
    if len(karten_liste) <= 1 and karten_liste and karten_liste[0]["type"] == "heading":
        return None
    abschnitt: dict[str, Any] = {"type": "grid", "cards": karten_liste}
    if breit > 1:
        abschnitt["column_span"] = breit
    return abschnitt


def view(titel: str, pfad: str, icon: str, *abschnitte: dict | None, badges: list | None = None) -> dict:
    v: dict[str, Any] = {"title": titel, "path": pfad, "icon": icon, "type": "sections", "max_columns": 3,
                         "sections": [a for a in abschnitte if a]}
    if badges:
        v["badges"] = [{"type": "entity", "entity": b, "show_name": True, "show_state": True} for b in badges if b]
    return v


# ---------------------------------------------------------------- Ansichten je Baustelle
def uebersicht(b: Baustelle, titel: str, pfad: str) -> dict:
    wetter = b.optionen.get("wetter")
    probleme = [b.ent("problem", g["id"]) for g in b.geraete]
    erreichbar = b.ent("erreichbar")
    warn_karten = [
        tile(p, spalten=12, visibility=[{"condition": "state", "entity": p, "state": "on"}]) for p in probleme if p
    ]
    if erreichbar:
        warn_karten.insert(0, tile(erreichbar, "Baustelle erreichbar", 12,
                                   visibility=[{"condition": "state", "entity": erreichbar, "state": "off"}]))
    alles_gut = {"type": "markdown", "content": "✓ Keine Warnungen.", "grid_options": {"columns": "full"},
                 "visibility": [{"condition": "state", "entity": p, "state_not": "on"} for p in probleme if p]}
    heizgeraete = [(g["schalter"], f'{g["name"]} ({bereich_name(b, g["bereich"])})')
                   for g in b.geraete if g["rolle"] in HEIZROLLEN + ("pumpe",)]
    return view(
        titel, pfad, "mdi:crane",
        section(
            heading("Jetzt", "mdi:crane"),
            tile(b.ent("status"), spalten=12),
            tile(b.ent("automatik"), spalten=6),
            tile(b.ent("naechste_schaltzeit"), spalten=6),
            {"type": "weather-forecast", "entity": wetter, "forecast_type": "daily", "grid_options": {"columns": "full"}}
            if wetter else None,
            tile(b.ent("aussen"), "Außen", 4), tile(b.ent("regen"), "Regen", 4), tile(b.ent("frueh_prognose"), "Früh", 4),
        ),
        section(heading("Warnungen", "mdi:alert"), *warn_karten, alles_gut),
        section(
            heading("Verbrauch heute", "mdi:lightning-bolt"),
            statistik(b.ent("energie"), "Energie heute", "day"),
            statistik(b.ent("kosten"), "Kosten heute", "day"),
            tile(b.ent("leistung"), "Leistung jetzt", 12),
        ),
        section(
            heading("Container", "mdi:home-group"),
            *[tile(b.ent("grund", c["id"]), c["name"], 6) for c in b.container],
            *[tile(c.get("fuehler"), f'{c["name"]} Temperatur', 6) for c in b.container if c.get("fuehler")],
        ),
        section(heading("Heute", "mdi:chart-timeline"), verlauf("Wann geheizt und gepumpt wird", heizgeraete), breit=3),
    )


def bereich_name(b: Baustelle, bid: str) -> str:
    return next((x["name"] for x in b.bereiche if x["id"] == bid), "?")


def heizung(b: Baustelle, titel: str, pfad: str) -> dict:
    container = []
    for c in b.container:
        container.append(section(
            heading(c["name"], "mdi:home-thermometer", badges=[c.get("fuehler")]),
            tile(b.ent("modus", c["id"]), "Modus", 12, [{"type": "select-options"}]),
            tile(b.ent("soll", c["id"]), "Solltemperatur", 12, [{"type": "numeric-input", "style": "buttons"}]),
            tile(b.ent("kleidung_trocknen", c["id"]), "Kleidung trocknen nach Regen", 12),
            tile(b.ent("grund", c["id"]), "Heizung", 12),
            *[tile(g["schalter"], g["name"], 6) for g in b.geraete_in(c["id"], HEIZROLLEN + ("steckdose",))],
            heading("Von Hand schalten stellt den Container auf „Hand“.", subtitel=True),
        ))
    zeitplan = []
    for key, name in TAGE:
        zeitplan += [{"type": "section", "label": name}, b.ent(f"{key}_aktiv"), b.ent(f"{key}_ein"), b.ent(f"{key}_aus")]
    return view(
        titel, pfad, "mdi:radiator",
        section(heading("Automatik", "mdi:radiator"), tile(b.ent("automatik"), spalten=12), tile(b.ent("status"), spalten=6),
                tile(b.ent("naechste_schaltzeit"), spalten=6)),
        *container,
        section(heading("Zeitplan je Tag", "mdi:calendar-clock"), entities(None, zeitplan)),
        section(
            heading("Regeln", "mdi:tune"),
            entities("Kleidung trocknen nach Regen", [b.ent("trocknen_ab_mm"), b.ent("trocknen_laenger_min"), b.ent("trocknen_frueher_min")]),
            entities("Bei Kälte früher ein", [b.ent("kaelte_schwelle"), b.ent("kaelte_frueher_min")]),
            entities("Heizgrenze – zu warm", [b.ent("heizgrenze_aktiv"), b.ent("heizgrenze"), b.ent("heizgrenze_basis")]),
            entities("Frostschutz", [b.ent("frost_aktiv"), b.ent("frost_ein"), b.ent("frost_aus")]),
            entities("Urlaub und Feiertage", [b.ent("urlaub_modus"), b.ent("absenk_temp")]),
        ),
    )


def pumpen(b: Baustelle, titel: str, pfad: str) -> dict:
    abschnitte = []
    for g in b.pumpen_liste:
        abschnitte.append(section(
            heading(f'{g["name"]} ({bereich_name(b, g["bereich"])})', "mdi:pump"),
            tile(b.ent("pumpe_laeuft", g["id"]), "Läuft", 6), tile(b.ent("problem", g["id"]), "Problem", 6),
            tile(b.ent("pumpzeit", g["id"]), "Pumpzeit", 6), tile(b.ent("pumpzyklen", g["id"]), "Zyklen", 6),
            verlauf("Leistung", [(g.get("leistung"), g["name"])]),
        ))
    return view(
        titel, pfad, "mdi:pump",
        section(heading("Überwachung", "mdi:bell-alert"), tile(b.ent("erreichbar"), "Baustelle erreichbar", 12),
                entities("Meldungen", [b.ent("offline_min"), b.ent("trocken_unter_w"), b.ent("dauerlauf_h")]),
                tile(b.ent("test_meldung"), "Test-Meldung senden", 12)),
        *abschnitte,
        section(heading("Pumpzeit je Tag", "mdi:chart-bar"),
                stat_graph("Pumpzeit (h)", [(b.ent("pumpzeit", g["id"]), g["name"]) for g in b.pumpen_liste]), breit=2),
    )


def auswertung(b: Baustelle, titel: str, pfad: str) -> dict:
    c = b.container
    temperaturen = [(x.get("fuehler"), x["name"]) for x in c if x.get("fuehler")] + [(b.ent("aussen"), "Außen")]
    return view(
        titel, pfad, "mdi:chart-box",
        section(
            heading("Verbrauch und Kosten", "mdi:lightning-bolt"),
            statistik(b.ent("energie"), "Energie diese Woche", "week"), statistik(b.ent("kosten"), "Kosten diese Woche", "week"),
            statistik(b.ent("energie"), "Energie dieser Monat", "month"), statistik(b.ent("kosten"), "Kosten dieser Monat", "month"),
            tile(b.ent("energie"), "Energie gesamt", 6), tile(b.ent("kosten"), "Kosten gesamt", 6),
        ),
        section(
            heading("Mit Automatik und ohne", "mdi:piggy-bank"),
            tile(b.ent("ersparnis"), "Ersparnis", 12),
            tile(b.ent("energie_ohne_automatik"), "Ohne Automatik (24/7)", 12),
            tile(b.ent("prognose_heizperiode"), "Heizperiode hochgerechnet", 6),
            tile(b.ent("prognose_heizperiode_kosten"), "… in Euro", 6),
            tile(b.ent("prognose_heizperiode_ohne"), "Heizperiode ohne Automatik", 12),
            entities(None, [b.ent("preis")]),
        ),
        section(heading("Verbrauch je Tag", "mdi:chart-bar"),
                stat_graph("Energie je Container (kWh)", [(b.ent("energie", x["id"]), x["name"]) for x in b.bereiche]),
                stat_graph("Heizzeit je Container (h)", [(b.ent("heizzeit", x["id"]), x["name"]) for x in c]), breit=2),
        section(heading("Verlauf", "mdi:chart-line"),
                verlauf("Leistung", [(b.ent("leistung"), "Baustelle")] + [(b.ent("leistung", x["id"]), x["name"]) for x in b.bereiche], 48),
                verlauf("Temperaturen", temperaturen, 48), breit=2),
        section(
            heading("Ölradiator ↔ Konvektor", "mdi:scale-balance"),
            heading("Pro kWh liefern beide gleich viel Wärme – Unterschiede kommen von Leistung, Laufzeit und Wärmespeicherung.", subtitel=True),
            tile(b.ent("mittel_oelradiator"), "Ø Leistung Ölradiator", 6), tile(b.ent("mittel_konvektor"), "Ø Leistung Konvektor", 6),
            stat_graph("Energie je Typ (kWh)", [(b.ent("energie_oelradiator"), "Ölradiator"), (b.ent("energie_konvektor"), "Konvektor")]),
            stat_graph("Heizzeit je Typ (h)", [(b.ent("heizzeit_oelradiator"), "Ölradiator"), (b.ent("heizzeit_konvektor"), "Konvektor")]),
        ),
    )


# ---------------------------------------------------------------- Gesamt
def gesamt_verlauf(alle: list[Baustelle]) -> dict:
    zeilen = []
    for b in alle:
        zeilen += [{"type": "section", "label": f'{b.titel} ({"aktiv" if b.aktiv else "abgeschlossen"})'},
                   b.ent("energie"), b.ent("kosten"), b.ent("ersparnis")]
    return view(
        "Verlauf", "verlauf", "mdi:history",
        section(heading("Alle Baustellen je Monat", "mdi:chart-bar"),
                stat_graph("Energie je Baustelle (kWh)", [(b.ent("energie"), b.titel) for b in alle], "month", 730),
                stat_graph("Kosten je Baustelle", [(b.ent("kosten"), b.titel) for b in alle], "month", 730), breit=2),
        section(heading("Summen", "mdi:sigma"), entities(None, zeilen)),
        section(heading("Verwaltung", "mdi:cog"),
                {"type": "markdown", "grid_options": {"columns": "full"}, "content":
                 "Baustellen, Container und Shellys verwaltest du unter "
                 "[Einstellungen → Geräte & Dienste → Baustelle](/config/integrations/integration/baustelle).\n\n"
                 "„Konfigurieren“ je Baustelle: Status aktiv/abgeschlossen, Wetter, Kalender, Meldungen, Heizperiode."}),
    )


def dashboard(alle: list[Baustelle]) -> dict:
    aktive = [b for b in alle if b.aktiv]
    mehrere = len(aktive) > 1
    views = []
    for b in aktive:
        s = slug(b.titel)
        vor = f"{b.titel} · " if mehrere else ""
        views.append(uebersicht(b, b.titel if mehrere else "Übersicht", s))
        if b.heizung:
            views.append(heizung(b, f"{vor}Heizung", f"{s}-heizung"))
        if b.pumpen:
            views.append(pumpen(b, f"{vor}Pumpen", f"{s}-pumpen"))
        views.append(auswertung(b, f"{vor}Auswertung", f"{s}-auswertung"))
    views.append(gesamt_verlauf(alle))
    return {"title": "Baustelle", "views": views}


def main(pfade: list[str]) -> str:
    alle = [Baustelle(lesen(p)) for p in pfade]
    kopf = ("# Dashboard „Baustelle“ – erzeugt mit tools/dashboard.py aus den Diagnose-Downloads der Integration.\n"
            "# Nicht von Hand ändern: Generator anpassen und neu erzeugen.\n")
    return kopf + yaml.safe_dump(dashboard(alle), allow_unicode=True, sort_keys=False, width=120)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sys.stdout.write(main(sys.argv[1:]))
