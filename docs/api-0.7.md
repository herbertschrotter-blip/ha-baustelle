# Schnittstelle Seite ↔ Integration (0.7.0)

Vertrag zwischen `frontend/baustelle-panel.js` und der Integration. Gehört zu `docs/bauplan-0.7.md`. Beide Seiten
testen dagegen: `tests/panel/struktur-0.7.json` ist ein vollständiges Beispiel dieser Struktur (Werte wie im Mockup);
`tests/integration/test_api.py` prüft, dass die echte Antwort dieselben Schlüssel und Typen hat.

Zeiten: ISO 8601 mit Zeitzone; Uhrzeiten `"HH:MM"`; Minuten seit Mitternacht als Zahl nur in `abschnitte`.

## 1. `baustelle/struktur` → Liste aller Baustellen (auch abgeschlossene)

```json
{
  "baustelle": {"entry_id": "", "titel": "", "status": "aktiv|abgeschlossen", "optionen": {}, "geladen": true,
                "version": "0.7.0", "zeitzone": "Europe/Vienna", "heute": "2026-09-29", "jetzt": "ISO"},
  "entitaeten": {"<unique_id>": "<entity_id>"},
  "bereiche": [{"id": "", "name": "", "art": "container|pumpenschacht", "fuehler": "sensor.x|null", "nr": 0}],
  "geraete": [{"id": "", "name": "", "bereich": "", "schalter": "switch.x", "rolle": "heizung|trockner|pumpe|steckdose",
               "typ": "oelradiator|konvektor|…", "leistung": "sensor.x|null", "energie": "sensor.x|null", "nenn_kw": 2.0}],
  "einstellungen": {"…": "Store v2 ohne zaehler, protokoll, meldungen, laufzeit (siehe bauplan §1)"},
  "zaehler": {"…": "wie 0.6"},
  "laufzeit": {
    "status": "automatik_aus|bereit|heizt|heizgrenze|urlaub|feiertag|frei|abgeschlossen",
    "status_text": "♨ heizt bis 17:30",
    "jetzt_bis": "ISO|null",
    "container": {"<bid>": {"zustand": "heizt|trocknen|aus|frost|offline|laeuft|pause|bereit", "grund": "<SollGrund>",
                   "text": "heizt · Arbeitszeit", "temperatur": 19.4, "kw": 3.99,
                   "bedarf_bis": "ISO|null", "boost_bis": "ISO|null", "tuer": {"offen": true, "seit": "ISO"} }},
    "geraete": {"<gid>": {"an": true, "kw": 2.0, "erreichbar": true, "hand_seit": "ISO|null",
                "warte": {"grund": "anschluss_voll|max_gleichzeitig|mindestpause|rundlauf|anlauf", "dran_in_min": 6} }},
    "plan_woche": [{"datum": "2026-09-28", "plan": {"start": 375, "vor": 375, "a": 420, "b": 990, "nach": 1005,
                    "ende": 1050, "gruende": ["trocknen"], "ausnahme": null}, "frei": "feiertag|urlaub|ausnahme|null"}],
    "abschnitte": {"<bid>": {"2026-09-28": [[375, 420, "vorheizen"], [420, 990, "arbeitszeit"]]}},
    "staffel": {"an": true, "laufen": 4, "warten": 1, "max": 5,
                "anschluesse": [{"id": "", "name": "", "voll_kw": 22.1, "grenze_kw": 14.8, "reserve_kw": 4,
                                 "heiz_kw": 7.99, "pumpe_kw": 0, "sonst_kw": 1.79, "frei_kw": 1.01}]},
    "warnungen": [{"key": "", "art": "", "stufe": "stoerung|hinweis", "bereich": "<bid>|null", "geraet": "<gid>|null",
                   "titel": "nicht erreichbar", "hilfe": "", "seit": "ISO", "stumm_bis": "ISO|null"}],
    "wetter": {"aussen": 4.2, "aussen_max": 9, "frueh_min": -1.2, "regen_vortag": 6, "regen_heute": 6, "zustand": "rainy"},
    "heizgrenze": {"bezug": 9, "zu_warm": false},
    "termine": [{"bereich": "<bid>", "von": "ISO", "bis": "ISO", "titel": "", "uid": "", "rrule": "FREQ=WEEKLY|null",
                 "wiederholung": "einmal|woche|2wochen", "boost": false}],
    "protokoll": [["ISO", "art", "<bid>|null", "Text"]]
  }
}
```

- `laufzeit.protokoll`: die neuesten 20 Einträge; mehr über `baustelle/protokoll`.
- `plan_woche`/`abschnitte`: Montag bis Sonntag der laufenden Woche, von der Integration mit `logik/arbeitszeit.py`
  berechnet (die Seite rechnet den Plan **nicht** selbst nach). `abschnitte` je Container: Bedarf/Termine als
  `"termin"`, ohne Automatik leer.
- Gemessene Heizzeiten (Übersicht „Wann welche Heizung heizt“) holt die Seite über `history/history_during_period`
  der Leistungssensoren (über 50 W = zieht Strom); Verbrauch über `recorder/statistics_during_period` der
  Energie-Sensoren je Container (Stunde/Tag/Monat).

## 2. Befehle (alle mit `entry_id`, Antwort `{ok: true}` oder Fehler `invalid_format`/`not_found`)

| type | Felder | Wirkung |
|---|---|---|
| `baustelle/setzen` | `pfad: [str]`, `wert` | Einstellung setzen, geprüft nach Schema (erlaubte Pfade: `automatik`, `preis`, `melden_knopf`, `termine_kalender`, `heizung.*`, `staffel.*`, `bericht.*`, `meldungen_einst.*`, `bereiche.<bid>.(auto\|trocknen\|soll\|bedarf\|prio\|anschluss\|tuer)`) |
| `baustelle/liste` | `liste: arbeitszeiten\|ausnahmen\|anschluesse\|firmen`, `aktion: speichern\|loeschen`, `eintrag` | Eintrag anlegen/ändern/löschen. `firmen`/`anschluesse` mit `container: [bid]` ordnen zu (Firma: neuer `zuordnung`-Eintrag „ab jetzt“). Arbeitszeit mit gleichem `ab` → Fehler. |
| `baustelle/aktion` | `aktion` + Felder | `bedarf` (`bereich`, `minuten` oder `bis`, `boost`), `bedarf_aus` (`bereich`), `boost` (`bereich`, `an`), `jetzt_heizen` (`minuten` oder null = beenden), `schalten` (`geraet`, `an` → Handbetrieb bis zum nächsten Schaltpunkt), `warnung_stumm` (`key`, `bis` oder null), `bericht_senden` (`art`: woche\|monat) |
| `baustelle/protokoll` | `filter: alle\|warnung\|schalten\|wetter\|nachricht`, `vor: ISO\|null`, `limit` | Einträge |
| `baustelle/meldungen` | – | alle Meldungen (eine Liste für die ganze Integration) |
| `baustelle/meldung` | `aktion: neu\|status\|loeschen`, `meldung` / `id` | Meldung speichern/ändern |

Unverändert über HA-Standard:
- Container/Geräte anlegen, ändern, entfernen: Subentry-Dialoge (REST `config/config_entries/subentries/flow`,
  WS `config_entries/subentries/delete`).
- Baustelle anlegen/abschließen: Config-/Options-Flow.
- Termine: WS `calendar/event/create|update|delete` am Kalender `termine_kalender` (Serien per `rrule`).
- Wetter-Vorhersage: `weather/subscribe_forecast`; Tageszeit: `sun.sun`.
- Diagnose: `/api/diagnostics/config_entry/<entry_id>`.
- Verlauf „Über“: statische Datei `frontend/changelog.json` (erzeugt aus `CHANGELOG.md` durch `tools/changelog.py`).

## 3. Entitäten ab 0.7.0

Bleiben: `switch.<baustelle>_automatik`, alle Sensoren (Status, nächste Schaltzeit, Wetter, Zähler, Grund und Leistung je
Container, Zeiten/Zyklen je Gerät), Binärsensoren (erreichbar, Problem, Pumpe läuft).
Entfallen (samt Plattformen, wo leer): Zeitplan- und Regel-Entitäten (`time`, `number`, `select`, Schalter außer Automatik,
`button` Test-Meldung). Beim Start räumt die Integration die verwaisten Einträge aus der Entity-Registry.
