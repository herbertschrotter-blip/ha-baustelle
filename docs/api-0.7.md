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
| `baustelle/setzen` | `pfad: [str]`, `wert` | Einstellung setzen, geprüft nach Schema (erlaubte Pfade: `automatik`, `preis`, `melden_knopf`, `termine_kalender`, `heizung.*`, `staffel.*`, `bericht.*`, `meldungen_einst.*`, `bereiche.<bid>.(auto\|trocknen\|soll\|bedarf\|prio\|anschluss\|tuer)`; `meldungen_einst.empfaenger` = Namen von notify-Diensten, z. B. `mobile_app_handy`) |
| `baustelle/liste` | `liste: arbeitszeiten\|ausnahmen\|anschluesse\|firmen`, `aktion: speichern\|loeschen`, `eintrag` | Eintrag anlegen/ändern/löschen. `firmen`/`anschluesse` mit `container: [bid]` ordnen zu (Firma: neuer `zuordnung`-Eintrag „ab jetzt“). Arbeitszeit mit gleichem `ab` → Fehler; ändern mit `alt_ab` (bisheriges `ab`). Neue Anschlüsse/Firmen antworten `{ok, id}`. |
| `baustelle/aktion` | `aktion` + Felder | `bedarf` (`bereich`, `minuten` oder `bis`, `boost`), `bedarf_aus` (`bereich`), `boost` (`bereich`, `an`), `jetzt_heizen` (`minuten` oder null = beenden), `schalten` (`geraet`, `an` → Handbetrieb bis zum nächsten Schaltpunkt), `automatik` (`geraet` → Handbetrieb beenden), `warnung_stumm` (`key`, `bis` oder null; ohne `bis` = morgen 07:00), `bericht_senden` (`art`: woche\|monat) |
| `baustelle/protokoll` | `filter: alle\|warnung\|schalten\|wetter\|nachricht\|einstellung`, `vor: ISO\|null`, `limit` (Standard 50) | Liste `[ISO, art, bid\|null, Text]`, neueste zuerst; `warnung` enthält auch `ok`; `vor` = nur ältere Einträge (Nachladen) |
| `baustelle/bericht` | `art: woche\|monat` | Vorschau des Berichts, wie er jetzt ginge (dieselben Zahlen und Texte wie beim Senden): `{art, von, bis, betreff, summe, vergleich, firmen: [{name, kwh, eur}], container: [{name, kwh}], heiztage, gespart_eur\|null, warnungen: [{bereich\|null, titel}], mail_an, anhang\|null, handy}` |
| `baustelle/meldungen` | – | alle Meldungen (eine Liste für die ganze Integration) |
| `baustelle/meldung` | `aktion: neu\|status\|loeschen`, `meldung` bzw. `meldung_id` oder `meldung: {id, status}` (`status: offen\|erledigt`) | Meldung speichern/ändern. **Nicht** `id` auf oberster Ebene senden – das ist die Nummer der WebSocket-Nachricht. `neu` antwortet `{ok, id}` |

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

## 4. Ergänzungen aus der Umsetzung (Integration, 30.09.2026)

- `laufzeit` enthält zusätzlich `naechste` (ISO, nächster Schaltpunkt), `probleme` (`{gid: [art]}`), `pumpe_laeuft`,
  `erreichbar` (wie 0.6, für Entitäten und Diagnose). `plan_woche[].name` = Name des Feiertags (wenn `frei: feiertag`).
- `laufzeit.warnungen` enthält auch stumme Warnungen (`stumm_bis` gesetzt) – für die Gruppe „Stumm bis morgen“.
- `laufzeit.geraete[gid].warte.dran_in_min` ist bei `mindestpause`/`rundlauf` gesetzt, sonst `null`.
- Termine: Ein Kalendereintrag gehört zu dem Bedarfs-Container, dessen `baustelle:<bid>` in der Beschreibung steht
  (die Seite schreibt das beim Anlegen hinein); sonst dem Bedarfs-Container, dessen Name im Titel oder Ort steht; gibt
  es nur einen Bedarfs-Container, gehört ihm jeder Termin. `boost` in der Beschreibung = schnell aufheizen.
  Termine kommen über `calendar.get_events` (alle 15 min und nach `setzen termine_kalender`); `uid`/`rrule` liest die
  Integration zusätzlich von der Kalender-Entität, weil `get_events` sie nicht liefert.
- `einstellungen.meldungen_einst.arten` kennt zusätzlich `fruehstart` (Nachricht am Vorabend „Morgen −4 °C“).
- Store `laufzeit` (nicht in `struktur`): zusätzlich `frueher` (Tag → Minuten aus dem Knopf „Noch früher“),
  `wetter_tage` (Vorhersage/Messung je Tag: `frueh`, `max`, `regen`), `gemeldet`, `warnungen_offen`,
  `wetter_protokoll`, `fruehstart_gemeldet`.
- Meldungen liegen in einem eigenen Store `.storage/baustelle.meldungen` (eine Liste für die ganze Integration), nicht
  je Baustelle. `baustelle/meldung neu` darf `entry_id` mitschicken (wird als `baustelle` gespeichert).
- Handy-Nachrichten: Tippen öffnet `/baustelle?baustelle=<entry_id>` (Warnung: `&container=<bid>`, Bericht:
  `&ansicht=auswertung`). Knöpfe: `URI` „Zum Container“/„Bericht öffnen“ und Aktionen
  `BAUSTELLE|<entry_id>|<befehl>|<wert>` mit `stumm_morgen`, `stumm_1h` (Warnungs-`key`), `trotzdem` (bid),
  `automatik` (gid), `frei` / `frueher` (Datum). Die Seite muss diese Adressen auswerten.
  Das `tag` der Nachricht endet auf `_<entry_id>`, damit gleiche Warnungen zweier Baustellen sich auf dem Handy nicht
  ersetzen.
- Bericht per Mail über `notify.<bericht.mail_dienst>` (`mail_an` als `target`). Den CSV-Anhang kann nur der
  SMTP-Dienst von HA mitschicken (Datei im Medienordner, `data.images`); bei anderen Diensten steht in der Mail der
  Hinweis, dass die Abrechnung auf der Seite unter Auswertung › Abrechnung liegt.

## 5. Ergänzungen aus der Umsetzung (Seite, 30.09.2026)

- Die Seite liest außer `struktur` nur die Langzeitstatistik (`recorder/statistics_during_period`, `change` bzw. `mean`)
  dieser Entitäten (Schlüssel in `entitaeten`): je Container `<bid>_energie` (Verbrauch, Abrechnung, Bericht-Beispiel),
  `<bid>_heizzeit` (Heizzeit), je Pumpe `<gid>_pumpzeit`, `<gid>_pumpzyklen`; je Baustelle `<entry>_energie`
  (Verlauf, Monate; Heiztage nur, wenn `zaehler.heiztage` fehlt), `<entry>_energie_ohne_automatik` („Ohne Automatik“), `<entry>_aussen` (Außen-Linie,
  Wetter-Einfluss); Zustand von `<entry>_ersparnis`, `<entry>_energie_<typ>`/`<entry>_heizzeit_<typ>` (Vergleich
  Ölradiator/Konvektor) und die Fühler der Container (`mean` je Stunde). Aus `zaehler`: `energie`, `kosten`, `ohne`,
  `energie_heizen`, `aufheiz:<bid>`, `abkuehl:<bid>` (°C/h).
- Gemessene Heizzeiten: `history/history_during_period` der `leistung`-Sensoren (ohne Sensor: `schalter`) ab Montag
  00:00; über 50 W bzw. `on` = zieht Strom, `unavailable` = offline.
- Abrechnung/CSV auf der Seite: Firma je Wert der Statistik nach dem Verlauf von `zuordnung` (Tag: je Stunde,
  Woche/Monat: je Tag, Jahr: je Monat) – es gibt dafür keinen eigenen Befehl.
- `baustelle/setzen`: Meldungsarten einzeln mit `pfad: ["meldungen_einst", "arten", "<art>"]`; `bereiche.<bid>.tuer`
  und `termine_kalender` = `entity_id` oder `null`; `heizung.heizgrenze_basis` = `jetzt|tageshoechst`.
- `baustelle/liste` – Einträge, wie die Seite sie schickt: `arbeitszeiten` `{ab, name, tage: {"0": ["HH:MM", "HH:MM"] | null, …}}`,
  löschen `{ab}`; `ausnahmen` `{datum, art, von, bis, notiz}`, löschen `{datum}`; `anschluesse`
  `{id?, name, ampere, phasen, reserve_kw, container}` (alle Container des Anschlusses; wer nicht mehr in der Liste
  steht, hängt danach am ersten anderen Anschluss – wie im Mockup), löschen `{id}`; `firmen` `{id?, name, container}`
  (alle Container der Firma), löschen `{id}`.
- `baustelle/aktion`: `bedarf` mit `bis` als ISO-Zeitpunkt („bis Arbeitsende“ = Ende der Arbeitszeit heute, „bis 19:00“);
  `warnung_stumm` schickt `bis` = morgen 07:00 bzw. `null` („wieder melden“).
- `baustelle/protokoll`: die Seite holt `filter: alle` (bis 200 Einträge) und filtert selbst wie das Mockup
  (Warnungen mit `ok`, Schalten mit `einstellung`); ohne Filter reichen die 20 Einträge aus `laufzeit.protokoll`.
- `baustelle/meldung`: `status` mit `meldung_id` + `status`, `loeschen` mit `meldung_id`, `neu` mit
  `meldung: {art, text, kontext, geraet, version, seite}` (`zeit`, `status`, `stand` setzt die Integration selbst).
  `seite` = „Stand der Seite mitschicken“ (Mockup): `{view, cid, baustelle, dialog}` oder `null`; wird mit der Meldung
  gespeichert (`stand` bleibt der Zeitpunkt der letzten Statusänderung).
- „Bericht · Beispiel“ (Einstellungen › Bericht) zeigt die Antwort von `baustelle/bericht` für die gewählte Häufigkeit
  (`monat` → Vormonat, sonst Vorwoche); die Seite rechnet den Bericht nicht selbst nach.
- Termine: `calendar/event/create` mit `description: "baustelle:<bid>"` (+ Zeile `boost` für schnell aufheizen),
  Serien `rrule: FREQ=WEEKLY` bzw. `FREQ=WEEKLY;INTERVAL=2`; löschen `calendar/event/delete {entity_id, uid}`.
  Urlaub: ganztägig in `optionen.urlaub_kalender` (`dtend` = Tag nach „bis“). Feiertage/Urlaub liest die Seite über
  `GET /api/calendars/<entity_id>`.
- Wetter: `weather/subscribe_forecast` (`daily` und `hourly`) für die Einblendung und die Werte je Tag in den Gründen
  des Heizplans; heute gelten `laufzeit.wetter`.
- Wetter/Kalender wählen: Options-Dialog (`wetter`, `temp_sensor`, `regen_sensor`, `urlaub_kalender`,
  `feiertag_kalender`), dazu `setzen termine_kalender`. Name: `config_entries/update {entry_id, title}`.
  Abschließen/wieder aktiv: Options-Dialog mit `status`. Neue Baustelle: Config-Dialog (`name`, `beginn`,
  `heizung`, `pumpen`), der angehängte Dialog für den ersten Container wird verworfen.
- Diagnose: `auth/sign_path` für `/api/diagnostics/config_entry/<entry_id>`, dann Download.
- Adressen aus Handy-Nachrichten (§4) wertet die Seite beim Laden und bei `location-changed` aus:
  `baustelle` wählt die Baustelle (abgeschlossen → Detailseite), `container` öffnet den Container, `ansicht` die
  Ansicht (`uebersicht|heizung|auswertung|verlauf|einst`).
- „Über“ liest `/baustelle_static/changelog.json` (Liste `{version, datum, punkte}`, neueste zuerst).


## 6. Abgleich mit der echten Integration (30.09.2026)

- `tests/integration/test_abgleich.py` lässt eine Baustelle einen Arbeitstag lang laufen (feste Zeit 29.09.2026
  05:30–16:20, Fake-Shellys, echte Kalender-Entitäten) und schreibt die Antwort von `baustelle/struktur` nach
  `tests/panel/struktur-echt.json`, die Zustände der Entitäten und die Kalender (wie `GET /api/calendars/<id>`) nach
  `tests/panel/struktur-echt.zustaende.json`. Beide Dateien sind reproduzierbar (gleicher Inhalt bei jedem Lauf).
- `tests/panel/test_panel.js` rendert die Seite gegen `struktur-0.7.json` (Einzelprüfungen wie im Mockup) **und**
  `struktur-echt.json` (allgemein: jede Baustelle, jeder Container, jede Einblendung und Aktion). Mit
  `BAUSTELLE_AUFRUFE=<datei>` schreibt er jeden gesendeten Befehl mit; `test_abgleich.py` schickt sie danach genau so an
  HA: `baustelle/*`, `calendar/event/*`, `auth/sign_path`, `config_entries/update`, `config_entries/subentries/delete`
  über den WebSocket, die Einrichtungs-Dialoge über dieselben Flow-Manager wie die REST-Ansichten. Für
  `recorder/statistics_during_period` und `history/history_during_period` gilt: jede abgefragte Entität gibt es, und
  jede Statistik-Entität hat eine `state_class` (sonst führt der Recorder keine Langzeitstatistik).
- `laufzeit.termine`: eine Serie kommt je Vorkommen im Zeitraum (laufende und nächste Woche) mit derselben `uid` und
  `rrule` – so liefert sie der Kalender, und so plant die Integration die Heizzeiten. Die Seite fasst sie zu einer Zeile
  zusammen; `calendar/event/delete` mit dieser `uid` (ohne `recurrence_id`) löscht die ganze Serie.
- `zaehler.heiztage` (Tage, an denen eine Heizung lief) ist die Zahl, die die Seite als „Heiztage“ zeigt.
- Werte für `baustelle/setzen` aus den Steppern der Seite bleiben in den Bereichen von `panel.py` `SETZEN`.
