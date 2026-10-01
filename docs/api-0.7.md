# Schnittstelle Seite ↔ Integration (0.7.0)

Vertrag zwischen `frontend/baustelle-panel.js` und der Integration. Gehört zu `docs/bauplan-0.7.md`. Beide Seiten
testen dagegen: `tests/panel/struktur-0.7.json` ist ein vollständiges Beispiel dieser Struktur (Werte wie im Mockup);
`tests/integration/test_api.py` prüft, dass die echte Antwort dieselben Schlüssel und Typen hat.

Zeiten: ISO 8601 mit Zeitzone; Uhrzeiten `"HH:MM"`; Minuten seit Mitternacht als Zahl nur in `abschnitte`.

## 1. `baustelle/struktur` → Liste aller Baustellen (auch abgeschlossene)

```json
{
  "baustelle": {"entry_id": "", "titel": "", "status": "aktiv|abgeschlossen", "optionen": {}, "geladen": true,
                "version": "0.7.0", "zeitzone": "Europe/Vienna", "heute": "2026-09-29", "jetzt": "ISO",
                "beginn": "2026-09-08", "beginn_auto": false},   // geltender Beginn; auto = ohne `beginn` → Tag der Anlage (AN-0002)
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
                                 "heiz_kw": 7.99, "pumpe_kw": 0, "sonst_kw": 1.79, "frei_kw": 1.01}],
                "rang": ["<gid>", "…"]},   // oben zuerst an, unten gibt zuerst ab (Bedarf in °C, logik/bedarf)
    // je Container zusätzlich laufzeit.container.<id>.bedarf (Staffelung): {"summe", "jetzt", "abkuehlen", "abkuehl_h",
    //   "gemessen", "trend_h", "nachlauf", "aufheiz_h", "ziel", "gerecht", "heiz_min", "horizont_min"} – °C bzw. °C/h, min
    // Soll gleitend (logik/soll): laufzeit.soll_gleitend = {"aussen_mittel", "tage", "start", "gefuehl", "soll", "n", "schritt",
    //   "kurve": [[t_außen, start, soll], …], "rueck": [[t_außen, -1|0|1], …]} oder null; je Container laufzeit.container.<id>.soll =
    //   {"wert", "versch", "versch_bis", "eigen"}. Einstellungen heizung.soll_art (fest|gleitend), gleit_min, gleit_max,
    //   gleit_je, gleit_bezug, gleit_tage; Aktionen baustelle/aktion gefuehl {bereich, wert}, soll_versch {bereich, d},
    //   soll_versch_weg {bereich}, gefuehl_vergessen.
    // baustelle/aktion zuruecksetzen: alle Zähler und alles Gelernte auf null (Einstellungen, Protokoll, HA-Statistik bleiben), lädt neu.
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
  Abschließen/wieder aktiv: Options-Dialog mit `status`. Neue Baustelle: Config-Dialog (`name`, `beginn` freiwillig,
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
- `zaehler.heiztage` (Tage, an denen ein Heizkörper tatsächlich Strom gezogen hat, ab 0.8.29; davor: eingeschaltet war) ist die Zahl, die die Seite als „Heiztage“ zeigt.
- Werte für `baustelle/setzen` aus den Steppern der Seite bleiben in den Bereichen von `panel.py` `SETZEN`.

## 7. Aus 0.6.3 zurück (0.7.8, Mockup glas.html abgenommen 30.09.2026)

- `baustelle/setzen`:
  - `bereiche.<bid>.modus` = `plan|thermo|bedarf|hand|aus` (Thermostat nur mit Fühler, sonst `invalid_format`). Setzt
    `auto` (= nicht `hand`) und `bedarf` (= `bedarf`) mit; `auto` oder `bedarf` allein setzen den Modus auf `null`
    (abgeleitet).
  - `heizung.frost_aus` (Frostschutz aus über … °C, `null` = Grenze + 2 °C; muss über `frost_grenze` liegen, sonst
    `invalid_format`), `heizung.frei_modus` = `frost|absenk|aus` (Urlaub und freie Feiertage), `heizung.absenk` (°C).
- `laufzeit.container[bid].modus`: wirksamer Modus (gesetzt oder abgeleitet: `bedarf` wenn Bedarf, `hand` wenn nicht
  auto, sonst `thermo` mit Fühler bzw. `plan`); `null` bei Pumpenschächten. Neue Gründe: `aus` (Modus Aus),
  `absenken` (Urlaub/Feiertag abgesenkt).
- `laufzeit.container[bid].firma` (Bauplan Module): Firmen-ID, der der Container jetzt gehört (letzter
  `zuordnung`-Eintrag mit `ab <= jetzt`, gelöschte Firma → `eigen`; `logik/abrechnung.firma_von`). Die Seite rechnet
  die Zuordnung nicht selbst nach.
- `baustelle/aktion`: `test_meldung` → Test-Nachricht an alle Empfänger, Antwort `{ok, an: [Namen]}`.
- Lernende Regelung (0.8, `logik/lernen.py`): Einstellung `bereiche.<id>.lernen` (bool, startet aus; wirkt mit Fühler im
  Modus Thermostat, Bei Bedarf und beim Absenken). `laufzeit.container.<id>.lernen` (nur mit Fühler, sonst `null`):
  `{an, zyklen, kint: {wert, start, fort}, kext: {…}, nachlauf: {"oel|lang|kalt": {grad, min, n}, …}, treffer: [Spitze −
  Soll …], anteil (% je Zyklus oder null), erwartet (°C), aus_bei (°C), zyklus_min}`. `baustelle/aktion` `lern_reset`
  mit `bereich` setzt den Lernstand zurück.
- „Warm ab“ (AN-0004, Optimum Start): Einstellungen `heizung.warm_vor_min` (Soll erreicht … min vor Arbeitsbeginn, 0–240),
  `heizung.warm_nach_min` (warm halten … min nach Arbeitsende, 0–240), `heizung.warm_max_min` (frühestens … min vor
  Arbeitsbeginn, 15–480); je Container `bereiche.<id>.warm_vor` / `warm_nach` (Zahl oder `null` = wie die Baustelle).
  `laufzeit.container.<id>.lernen` zusätzlich `aufheizen: {kalt|mild: {rate (°C/h), n}}`, `auf_n` (nötige Messungen) und
  `warm` (nur lernend im Modus Thermostat, sonst `null`): `{gelernt, band, rate, n, n_noetig, vor, nach, max, vor_eigen,
  nach_eigen, aufheiz_min, innen, soll, fest, plan: {start, ziel, a, b, ende, begrenzt} | null}` (Minuten seit Mitternacht).
  Plangrund `gelernt` in `plan_woche` und `abschnitte` der lernenden Container.
- Zusatz-Heizkörper nur bei Bedarf (AN-0006, `logik/stufen.py`): je Container `bereiche.<id>.stufen` (bool), je Gerät
  `geraete.<id>.zusatz` (bool, Pfad `["geraete", id, "zusatz"]`), Schwellen `heizung.stufen_abstand` (°C unter Soll),
  `stufen_min` (min Laufzeit des ersten), `stufen_anstieg` (°C), `stufen_kalt` (°C außen). `laufzeit.container.<id>.stufen`
  (ab zwei Heizkörpern, sonst `null`): `{an, haupt: [ids], zusatz: [ids], zusatz_an, grund, text}`; `laufzeit.geraete.<id>.zusatz`.
  Aufheizen lernt je Anzahl laufender Heizkörper: `lernen.aufheizen` mit Schlüsseln `kalt|1`, `mild|2` …; `lernen.warm.anzahl`.
- Ölradiator oder Konvektor (AN-0008): `baustelle/auswertung` → `typ = {oelradiator|konvektor: {kwh_gradh, auf, ab,
  container: [Namen], ids}, weniger, vergleichbar, ausgeschlossen: [{name, grund}], ersparnis: {faktor, oel, konvektor,
  oel_kwh, konvektor_kwh, erspart_kwh, erspart_eur} | null}`; Zähler `vgl_kwh`, `vgl_gradh`, `vgl_aufheiz`, `vgl_abkuehl` je Container.
- Ohne Automatik je Container (WU-0013): `baustelle/ohne` mit `entry_id`, `bereich`, `zeitraum`, `versatz`, `basis`
  (`geraet` | `typ`) → `{zeitraum, basis, preis, kw, reihe: [kWh je Periode], ohne_kwh, kwh, ergebnis: {ohne_eur,
  gespart_eur, prozent} | null, geraete: [{id, typ, kw}]}`; 24/7 ab Beginn der Baustelle bis jetzt.
- Geräteübersicht (WU-0010): `geraete_links` = `{entity_id: {web (configuration_url, nur http/https), ha (Geräteseite),
  geraet, hersteller, modell, batterie (Batterie-Sensor am Gerät), signal (Signalstärke-Sensor am Gerät, AN-0009)}}` für alle benutzten Entitäten (Schalter, Leistung,
  Energie, Fühler, Türkontakte, Außen, Regen, Wetter); ohne Geräteeintrag alle Felder `null`.
- Szenarien (Runde 2): je Gerät `geraete.<id>.nenn_kw` (kW ohne Messung, `null` = Standard: Heizkörper 2,0, Pumpe 0,8);
  `geraete[].nenn_kw_eigen` in der Struktur. `lz.tuer_trotzdem` (intern). Warnungen `keine_leistung`/`zu_kalt` nur bei
  Modus thermo/bedarf, `hand_zu_lange` nicht im Modus Hand. `bereiche.<id>.lernen = true` ohne Fühler wird abgelehnt.
- Szenarien (Herbert 01.10.2026): `heizung.frost_aussen` (°C, `null` = aus; Standard −3): Frostschutz für Container
  ohne Fühler nach der Außentemperatur (aus ab +2 °C). Fühler kurz weg: 15 min der letzte Wert (`laufzeit.fuehler_zuletzt`
  intern), Außenwert weg: Wetter-Entität, sonst der letzte bis 6 h. Tür offen pausiert nur, wenn geheizt würde oder ein
  Heizkörper läuft; sonst Warnung `tuer_offen` mit `werte.pausiert = false` (Hinweis ohne „Trotzdem heizen“).
- Tür offen schützt das Lernen (WU-0009): `lernen.offen` = `{art: "vermutet"|"kontakt", seit}` oder `null`, `lernen.ruhe_bis`
  (bis dahin keine neue Messung). Vermutet: beim durchgehenden Heizen in 10 min ≥ 0,3 °C kälter, außen ≤ 0,2 °C kälter.
- Gerät aktiv/inaktiv (WU-0004): `baustelle/aktion` `aktiv` mit `geraet` und `an` (bool). Inaktiv: einmal ausschalten,
  danach schaltet die Automatik es nicht, es zählt nicht in der Staffelung, keine Warnungen; gespeichert unter
  `einstellungen.geraete.<id>.aktiv`, sichtbar in `laufzeit.geraete.<id>.aktiv`. `geraete[]` hat zusätzlich
  `leistung_eigen`/`energie_eigen` (selbst gewählter Sensor, sonst `null` = am Shelly automatisch erkannt).
  Gerät bearbeiten: Subentry-Dialog `geraet` mit `subentry_id` (Bereich, Schalter, Name, Rolle, Typ, Sensoren).
- `baustelle/setzen`: `erklaer` (Erklärtexte der Seite), `heizung.frost_immer` (0.7.9: Frostschutz auch bei
  ausgeschalteter Automatik – dann schaltet nur der Frostschutz; Standard aus).
- Bericht (0.7.9): `heiztage` = Tage mit Heizzeit > 0 in einem Container (Statistik `<bid>_heizzeit`), wie `zaehler.heiztage`.
- Beginn/Ende und Heizperiode: Options-Dialog (`beginn`, `ende`, `heizperiode_von`, `heizperiode_bis` als `"1"`…`"12"`).
  Beginn leer = Tag der Anlage. Ende (`logik/zeitraum.ende_beim_speichern`): beim Abschließen immer heute, bleibt
  abgeschlossen → eingetragenes Ende, wieder aktiv → kein Ende, aktiv → geplantes Ende bleibt (AN-0002).
  Die Hochrechnung (`<entry>_prognose_heizperiode…`) zählt nur bis zum geplanten Ende, wenn es in der Heizperiode liegt.

## 8. Auswertung und Abrechnung von der Integration (0.7.14, Bauplan Module Phase 2)

Die Seite rechnet nichts Fachliches mehr: Kennzahlen, Abrechnung nach Firma, CSV, Heizperiode, Heiztage, Verlauf,
Ölradiator/Konvektor, Wetter-Einfluss und Je Gerät kommen von der Integration (`auswertung.py` holt die
Langzeitstatistik, `logik/auswertung.py` rechnet) – mit € und % dort, wo die Seite sie zeigt. Einzige Ausnahme
(Bauplan Module §5): Werte, die die Seite selbst aus der Statistik als Diagramm zeigt (Verbrauch-Block mit frei
gewählten Reihen, „Kosten heute“ eines Containers, Hinweise beim Zeigen auf ein Diagramm, Hochrechnung aus den
Sensoren), rechnet sie zur Anzeige mit dem Preis der Baustelle (`einstellungen.preis`) in € um. Bericht und CSV-Anhang nehmen dieselben Funktionen – für denselben
Zeitraum (Vorwoche = `Woche`/`versatz: 1`, Vormonat = `Monat`/`versatz: 1`) dieselben Zahlen. Nur reine
Diagramm-Reihen (Verbrauch je Container, Temperaturen, Leistung) holt die Seite weiter selbst über
`recorder/statistics_during_period`.

Gemeinsame Felder: `entry_id` (auch abgeschlossene oder nicht geladene Baustelle; unbekannt → `not_found`),
`zeitraum: Tag|Woche|Monat|Jahr` (Standard `Monat`), `versatz` (0 = laufender, 1 = der davor …, höchstens 4000 – Tage bis zum Beginn der Baustelle, FE-0008), `scope: diese|alle`
(`alle` = alle laufenden Baustellen; Preis der Baustelle `entry_id`). Zeitraum in der Antwort:
`{"art", "von", "bis" (erster Tag danach), "periode": "hour|day|month", "n", "labels", "monat" (1–12|null), "jahr"}`.

| type | Felder | Antwort |
|---|---|---|
| `baustelle/auswertung` | gemeinsame, `teil: zeitraum\|verlauf` (Standard `zeitraum`) | siehe unten |
| `baustelle/abrechnung` | gemeinsame | siehe unten |

`baustelle/auswertung`, `teil: zeitraum` (Reiter Auswertung):

```json
{"zeitraum": {}, "preis": 0.28,
 "summen": {"kwh": 0, "eur": 0, "heizzeit": 0, "pumpzeit": 0, "ohne": 0,
            "vorher": {"kwh": 0, "heizzeit": 0, "pumpzeit": 0}, "veraenderung": {"kwh": 5, "heizzeit": null, "pumpzeit": null},
            "ohne_automatik": {"ohne_eur": 0, "gespart_eur": 0, "prozent": 0} },
 "je_geraet": [{"bereich": "<bid>", "geraet": "<gid>", "mittel": 1.98, "kwh": 12.1, "std": 6.1, "eur": 3.39}],
 "wetter": {"punkte": [[4.2, 18.5]], "gerade": {"k": -1.2, "d0": 20, "null0": 16.7, "eur_je_grad": 0.34}},
 "typ": {"oelradiator": {"kwh_h": 1.6, "auf": 2.7, "ab": 2.7, "tag": 3.05}, "konvektor": {}, "weniger": 17},
 "heizperiode": {"ende": "2027-04-30", "bis": "2027-04-30"}, "heiztage": 16,
 "hochrechnung": {"bisher_kwh": 412, "bisher_eur": 115.36, "mit_kwh": 2310, "mit_eur": 646.8, "ohne_kwh": 10626,
                  "ohne_eur": 2975.28, "gespart_eur": 2328.48},
 "rangliste": [{"bereich": "<bid>", "name": "Polier", "baustelle": "…", "kwh": 60, "heizzeit": 25, "eur": 16.8, "kwh_h": 2.4, "anteil": 60}],
 "erkenntnisse": [{"art": "gespart|groesster|sparsamster|wetter|mehr|weniger|typ", "…": "Werte je Art"}]}
```

- `rangliste` (Container über `scope`, absteigend nach kWh; `kwh_h` ohne Heizzeit `null`) und `erkenntnisse` (höchstens 5,
  Regeln in `logik/auswertung.erkenntnisse`; nur Daten, den Text macht die Seite) – WU-0005.
- `summen` über `scope`; `heizzeit` nur Container, `pumpzeit` nur Pumpen; `veraenderung` in ganzen % zum Zeitraum davor
  (`null` ohne Wert davor); `ohne_automatik` `null`, solange „ohne Automatik“ 0 ist, sonst mit `ohne_eur` (Kosten im
  Dauerbetrieb, 0.7.24).
- `je_geraet`, `wetter`, `typ`, `heizperiode`, `heiztage` immer für die Baustelle `entry_id`. `je_geraet` nach
  Containern geordnet; `mittel` Ø kW im Betrieb (ab 50 W), `std` bei Pumpen gemessen, sonst kWh ÷ Ø kW (Schätzung).
  `wetter.gerade` `null` unter 5 Heiztagen; `eur_je_grad` = −k · Preis (Mehrkosten am Tag je Grad kälter, `null` bei
  k ≥ 0; 0.7.24). `heizperiode.bis` = geplantes Ende, wenn es vor dem Ende der Heizperiode liegt.

`baustelle/auswertung`, `teil: verlauf` (Reiter Verlauf, Detailseite; `zeitraum`/`scope` ohne Bedeutung):

```json
{"kwh": 412, "eur": 115.36, "gespart": 515.2, "container": 7, "heiztage": 16, "monate": 1, "je_tag": {"2026-09-30": 25.4},
 "vergleich": {"tag": 25.75, "monat": 115.36, "ges": 412},
 "je_monat": {"2026-09": 340.9},
 "monate_je_container": {"labels": ["Sep"], "reihen": [{"bereich": "<bid>", "name": "Polier", "v": [330.9],
                                                     "kwh": 330.9, "eur": 92.65, "anteil": 97.1}]},
 "csv": "﻿Monat;Baustelle;Container;kWh;Kosten €\r\n…"}
```

- `monate_je_container.reihen[]`: `kwh`, `eur` und `anteil` (% an allen Containern) über alle Monate (0.7.24,
  `auswertung.monate_summen`).

`baustelle/abrechnung` (Reiter Auswertung: Abrechnung nach Firma, Verbrauch gestapelt nach Firma, beide CSV):

```json
{"zeitraum": {}, "preis": 0.28, "kwh": 81.0,
 "firmen": [{"id": "eigen|<Firmenname>", "firma": "Eigene Firma", "eigen": true, "kwh": 68.0, "eur": 19.04, "anteil": 84.0,
             "container": [{"entry": "", "titel": "", "bereich": "<bid>", "name": "", "kwh": 14.4, "eur": 4.04}]}],
 "reihen": {"eigen": [0.2, 1.4], "Elektro Huber GmbH": [0, 0.5]},
 "csv": {"firma": "﻿Zeitraum;Firma;Baustelle;Container;kWh;Preis €/kWh;Betrag €\r\n…",
         "verbrauch": "﻿Zeit;Baustelle;Firma;Container;kWh;Kosten €\r\n…"}}
```

- Firma je Tag: der Verbrauch eines Tages gehört der Firma, der der Container zu Tagesbeginn gehört (auch beim Tag je
  Stunde und beim Jahr); Firmen mit gleichem Namen auf verschiedenen Baustellen sind eine Zeile, eigene Firma zuerst.
- `reihen`: kWh je Firma und Periode des Zeitraums (Firmen ohne Verbrauch fehlen).
- CSV wie bisher auf der Seite: BOM, Semikolon, Dezimalkomma ohne Tausendertrennung, CRLF, Felder mit `;`, `"` oder
  Zeilenumbruch in Anführungszeichen (RFC 4180). „Verbrauch“ je Periode eine Zeile (Firma zu Beginn der Periode).

**Funktionen (0.7.18, Bauplan Module Phase 5):** Jede Baustelle in `baustelle/struktur` hat neben `baustelle` das Feld
`"funktionen": ["heizung", "pumpen"]` – die eingeschalteten Funktionen nach den Optionen `heizung`/`pumpen`
(`funktionen.aktive`, je Funktion ein Modul in `funktionen/`), auch bei einer nicht geladenen Baustelle. Die Seite zeigt
den Reiter Heizung nur mit `heizung`, den Reiter Pumpen nur mit `pumpen` und mindestens einem Pumpenschacht.
