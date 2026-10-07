# Bauplan: Seite „Baustelle“ zerlegen und schrittweise auf Lit umstellen (BSM-022, BSM-024)

Stand 06.10.2026 · Entscheidungen Herbert: Bündler **esbuild**; Ziel **Lit**, aber **bis einschließlich Lit-Pilot bauen,
dann mit fünf Ja/Nein-Feldern entscheiden**; Browser-Tests **lokal (Chromium auf dem Pi) und auf GitHub**; Abnahme auf
**Samsung S23 Ultra (HA-App) und Microsoft Edge** · Geprüft mit ChatGPT: `docs/chatgpt-reviews/CGR-2026-10-06-seite-lit/`
(2 Runden).

## 1. Ausgangslage

`custom_components/baustelle/frontend/baustelle-panel.js`: eine Datei mit ≈ 4.900 Zeilen. `BaustellePanel`
(HTMLElement) baut Ansichten (`v_uebersicht`, `v_container`, `v_heizung`, `v_auswertung`, `v_pumpen`, `v_verlauf`,
`v_einst`, `v_ueber`, `v_dev`, `v_bsdetail`) und Einblendungen (`sheet()`) als Text und setzt `.ui` per `innerHTML` neu;
Klicks über `data-act` in `klick()`. Rahmen und Himmel bleiben schon heute stehen (`_aufbauen`), dazu Sonderfälle:
`_auffrischen` (kein Neuzeichnen bei fokussiertem Feld), Scroll-Wiederherstellung in `render()`, `_liveNeu`
(Container-Diagramm/Kennzahlen), `leistungTeil` (Leistungsdialog). **Ziel ist Wartbarkeit** – dieselbe Bedienqualität mit
weniger Sonderbehandlungen und klaren Zuständigkeiten; schneller muss es nicht werden. Lit garantiert Fokus/Scroll nicht
von selbst (stabile Struktur, `repeat` mit IDs, Entwurf getrennt von Serverdaten).

Bekannte Fehler: `window`-Listener `paste`/`location-changed` werden in `disconnectedCallback()` nicht entfernt (→ 0b.2).

## 2. Feste Regeln

- Fachlogik nur in Python unter `logik/` (mit Test); die Seite zeigt nur an. `daten.js` ordnet zu und formatiert, rechnet
  nichts nach. Die Alt-Ausnahme Anschlussleistungs-Vorschau (bauplan-module §5) wird nicht erweitert.
- Ausgeliefert wird **eine JS-Datei** (ESM-Bundle, Lit eingebündelt) plus `changelog.json`; Master-Mockup aus genau diesem
  Bundle; Backend-Schnittstelle und Daten bleiben unverändert.
- Jede Produktlieferung ist eine PATCH-Version, einzeln einspielbar; HA-Neustart nur nach Freigabe.
- **Pro Teilbaum genau ein Renderer und ein Ereignisweg** (kein `@click` zusätzlich über `data-act`).
- Neue Gestaltung weiter zuerst als Mockup-Variante.

## 3. Stufenplan (abhaken)

**Grundprüfung** = Fachlogik, Integration, Panel (Node), Notprogramm grün + Versions-/Bundle-/Mockup-Aktualität, ab 0b
zusätzlich Browser-Test lokal und auf GitHub. Jede Lieferung: kurzer Vorher-/Nachher-Nachweis, Liste der umgestellten Teile.
**Rückweg R** = vorheriges geprüftes Release (Bundle, Manifest, Changelog) über `tools/deploy.sh`, Browser neu laden,
Version/Bedienung prüfen; fertige Artefakte auf dem Pi, ohne npm/Internet; zuerst in einem temporären Ziel geprobt.

| ☐ | Stufe | Inhalt (je eigene Lieferung) | Herbert sieht | Prüfung / Abnahme | Rückweg |
|---|---|---|---|---|---|
| ☑ | **0a** | esbuild, Versionskette, Modul-Mockup, Auslieferungsfilter (§4) | nichts | Grundprüfung ohne Browser-Test; zwei Builds bytegleich; veraltetes Bundle wird erkannt; Mockup startet; Auslieferungsprobe ohne Quellen/npm-Dateien | R auf 0.8.73 |
| ☑ | **0b.1** | Panel-Test auf happy-dom (gebaute Datei laden, echte DOM-Ereignisse); Browser-Bestandsaufnahme B1–B7 (§6) | nichts | alle bisherigen Testfälle übertragen; Ausgangsprotokoll; bekannte Fehler einzeln benannt | Teständerung zurück |
| ☑ | **0b.2** | Listener-Lecks beheben; Wetter-Abos nach dem Wiedereinhängen (Befund 0b.1) | nichts | B7 nach 20 Ein-/Aushängezyklen grün | R |
| ☑ | **1a** | Hilfen und Symbole auslagern | nichts | Grundprüfung; gleiche Ausgabe/Befehle | R |
| ☑ | **1b** | Himmel und Diagramm-Funktionen auslagern | nichts | Canvas bleibt bei Updates; SVG/WebGL/CSS-Rückfall | R |
| ☑ | **1c** | Datenadapter und Aufrufe auslagern | nichts | gleiche API-Nutzdaten, Rechte, Fachwerte/CSV | R |
| ☑ | **2a.1** | dauerhafte DOM-Bereiche; „Über“ mit Lit (`render(template, container)`), Klasse bleibt HTMLElement | nichts | 20 Navigationen; Lit-Bereich wird vom Alt-Renderer nicht zerstört | R auf 1c |
| ☑ | **2a.2** | Melde-Dialog samt Entwurf auf Lit | nichts | Tippen während Updates; Bild/Einfügen/Abbrechen/Senden | R auf 2a.1/1c |
| ☑ | **Entscheidung** | Pilot bewerten (§5) | Ja/Nein-Bogen | 5 × Ja und Restaufwand akzeptiert | bei Nein: 1c behalten |
| ☑ | **2b** | Klasse auf LitElement; Zustand (`s` reaktiv, `neuZeichnen()` → `requestUpdate()`, neue Objektreferenzen), Laden aus Vorlagen heraus, Timer/Abos | nichts | `hass` vor/nach Einhängen; 20 Wiederanschlüsse ohne Mehrfachaufrufe; Menü, Theme, schmal/breit | R auf Pilot |
| ☑ | **3a** | Leer-/Lade-/Fehleransichten, dann `dev` | gleiche Hinweise | verzögerte/fehlgeschlagene Antwort, leere Baustelle, Erholung | R je Lieferung |
| ☑ | **3b** | Verlauf, dann `bsdetail` | gleich | Filter, Suche, Navigation, CSV, abgeschlossene Baustelle | R je Lieferung |
| ☑ | **3c** | Pumpen mit Details | nichts | Diagramme, Zustände, Aktionen; verspätete Antwort nach Baustellenwechsel | R |
| ☑ | **3d** | Container, dann Heizung | nichts | Live-Daten während Dialog/Tooltip; Modi, Soll, Schreibbefehle | R je Lieferung |
| ☑ | **3e** | Einstellungen nach Dialogfamilien, Notprogramm zuletzt | nichts | Admin/Nicht-Admin; genau ein Auftrag je Aktion | R je Familie |
| ☐ | **3f** | Übersicht, dann Auswertung in Teilansichten | nichts | Fachwerte/CSV gleich; Auswahl, Sortieren, Layout, Zeiträume | R je Teilansicht |
| ☐ | **4** | übrige Einblendungen/Diagramme, dann Alt-Weiche und Übergangs-HTML entfernen | nichts | Inventar vollständig; keine Alt-Renderer, keine doppelten Ereigniswege | R je Einheit |
| ☐ | **5** | Doku, Abnahmeprotokoll, Rückweg-Probe, Abschluss | nichts | volle Prüfung; S23-/Edge-Abnahme; Offline-Auslieferung und Rückweg erprobt | R |

**Gleiche Ausgabe** (1a–1c): `node tests/panel/schnappschuss.js <bundle> vorher.json` vor dem Umbau, danach erneut und
`--vergleich vorher.json nachher.json` – HTML jeder Ansicht/Einblendung und die WS-Befehle müssen gleich sein.

Vor 3a eine **Inventarliste** aus `v_*`, `sheet()` und Ereignisfällen mit Zielstufe je Zeile; ansichtsbezogene Dialoge und
Diagramme ziehen mit ihrer Ansicht um. Gemeinsame Vorlagen bleiben im vorhandenen Shadow Root (Modul ≠ Custom Element).

## 4. Stufe 0a im Einzelnen

- **Versionskette:** `CHANGELOG.md` bleibt die einzige Quelle. `tools/changelog.py` erzeugt `frontend/changelog.json`,
  neu `frontend/version.json` (`{"version": "…"}`) und setzt nur das Versionsfeld in `manifest.json`; `--pruefen` prüft
  alle drei, ohne zu schreiben. In der Quelle `const SEITE_VERSION = __BAUSTELLE_VERSION__;`, `bauen.mjs` setzt sie über
  esbuild `define` (`JSON.stringify(version)`). Kein Werkzeug schreibt mehr ins Bundle; der Regex entfällt.
- **Bundle:** `bundle: true`, `format: 'esm'`, `platform: 'browser'`, `splitting: false`, keine externen Laufzeit-Imports,
  unminifiziert, Lizenztexte inline, keine Source-Map-Datei; Ziel nach Edge und der Android-WebView des S23. Quelle zuerst
  `src/alt.js` = heutige Datei. Rohgröße und Transfergröße messen.
- **Mockup:** `glas.js` liest `version.json`, Bundle, Beispieldaten; erzeugt (1) klassisches Skript mit Fehleranzeige,
  fester Uhr, Fetch-Ersatz und Beispiel-hass unter `window.baustelleBeispiel`, (2) `<script type="module">` mit dem Bundle,
  (3) zweites Modul: `await customElements.whenDefined('baustelle-panel')`, dann Elemente anlegen und einhängen.
- **Aktualität:** `bauen.mjs --pruefen` und `glas.js --pruefen` erzeugen im Speicher (`write: false`) und vergleichen mit
  der eingecheckten Datei; keine Zeitstempel/absoluten Pfade. Reihenfolge: `changelog.py --pruefen` → `bauen.mjs --pruefen`
  → `glas.js --pruefen` → vier Pflichtprüfungen → Browser-Test (Erzeugen ohne `--pruefen` in derselben Reihenfolge).
- **Auslieferung:** `tools/deploy.sh` mit einer Filterfunktion für Kopieren und Bereinigen; in `frontend/` Positivliste
  (`baustelle-panel.js`, `changelog.json`); entfernt wird im Ziel, was nicht zugelassen ist oder in der Quelle fehlt. Bundle
  über temporäre Nachbardatei und Umbenennen ersetzen, `changelog.json` zuletzt.
- **npm offline:** einmal online auf dem Pi `npm --prefix custom_components/baustelle/frontend ci --cache "$BSM_NPM_CACHE"
  --include=dev --include=optional --no-audit --no-fund`; Offline-Probe in einem temporären Ordner (`npm ci --offline`,
  kleiner Build), einmal bei gesperrtem Internet. `@esbuild/linux-arm64` muss enthalten sein. Erfolgsvermerk mit
  Lockfile-Hash; neu vorbereiten nur bei geändertem Lockfile, Node/npm, Plattform oder Cache-Verlust. GitHub: `npm ci`.
  `node_modules/` nicht im Repo, `package-lock.json` im Repo.
- **Prüfläufe** (Skill-Profil, GitHub): neu „seite-gebaut“ (die drei `--pruefen`) und ab 0b „browser“.

## 5. Entscheidung nach dem Lit-Piloten (fünfmal Ja → 2b)

| ☐ | Frage | Nachweis |
|---|---|---|
| ☐ | Funktioniert alles wie vorher? | Grundprüfung lokal/GitHub; B1–B7 ohne neue Fehler; Pilotdialog je einmal auf S23 und Edge; keine unerklärten Browserfehler |
| ☐ | Bleibt die Bedienung stabil? | bei 20 Datenupdates: derselbe Eingabeknoten, Text, Fokus, Auswahl; Scroll ±1 px; ein Senden = genau ein Auftrag |
| ☐ | Ist der Pilot tatsächlich einfacher? | je ein Renderer/Ereignisweg; alte Zweige entfernt; keine neue Fokus-/Scrollrettung oder `innerHTML`-Reparatur im Lit-Teil; Entwurf und Serverdaten getrennt; Liste der entfallenen Sonderfälle |
| ☐ | Bleiben Aufwand und Reaktion im Rahmen? | Median aus 5 Läufen höchstens `max(20 %, 50 ms)` schlechter; drei Browserläufe ohne Wiederholung, je ≤ 120 s |
| ☐ | Ist der Rest überschaubar und rückgängig zu machen? | Rückweg auf 1c getestet; Pilotstunden dokumentiert; Schätzung je Familie als Spanne; Herbert akzeptiert den Restaufwand |

Sonst kein automatisches Weiterbauen: Mangel beheben und neu entscheiden oder auf 1c zurück. Ein nicht abgenommener
Hybrid bleibt kein Dauerzustand.

## 6. Tests

- **Panel-Test (Node):** ab 0b.1 mit **happy-dom**: gebaute Datei nach Einrichtung der DOM-Umgebung laden, Element
  einhängen, echte Ereignisse, gesendete Befehle prüfen (`docs/api-0.7.md`); auf `updateComplete` und Antworten warten
  statt pauschaler `ruhe()`-Schleifen. Fachwerte-/CSV-Abgleiche und `BAUSTELLE_AUFRUFE` bleiben. WebGL auf CSS-Rückfall.
- **Browser-Test:** `puppeteer-core` gegen Chromium 136 auf dem Pi (headless, ohne Sandbox) und auf GitHub (gleiche
  Major-Version); Puppeteer-Version passend zu Chromium 136 und Node 22 festlegen. `tests/panel/browser/pruefen.mjs`, Start
  über npm-Skript im Frontend; lokaler HTTP-Server mit Mockup und Bundle, **keine Verbindung zur produktiven HA**;
  Testzugang im Beispiel-hass für Antworten, Verzögerungen, Befehlsprotokoll. Bedienung nur über den Browser.

| Test | Ablauf und Ergebnis (Bestand vor Lit) |
|---|---|
| B1 Start | Mockup und Bundle starten; Ladezustand endet, Ansicht/Version sichtbar, keine Fehler |
| B2 Eingabeschutz | Melde-Text tippen, Auswahl; geänderte Strukturantwort; Text/Auswahl/Knoten bleiben; nach Fokuswechsel neue Daten sichtbar |
| B3 Scrollschutz | Hauptansicht, lange Einblendung, Chipleiste scrollen; Update ohne Layoutänderung; Position ±1 px (Knotenidentität im Altzustand nicht gefordert) |
| B4 Container live | Sensor und Statistik ändern; Diagramm/Kennzahlen aktualisieren, Rest bleibt; mit offener Einblendung/Tooltip heutige Unterdrückung prüfen |
| B5 Leistung | Leistungsdialog, Regler bedienen, Daten nachliefern; `.lh-daten` aktualisiert, Regler/Einstellung/Scroll bleiben |
| B6 Befehle/Rechte | schreibender Befehl genau einmal; Nicht-Admin keine Änderung, erlaubte Vor-Ort-Aktion möglich |
| B7 Lebenszyklus | 20 × entfernen/einhängen; Timer, Abos, `paste`/`location-changed` zählen: keine Zunahme |

B2–B5 müssen beweisen, dass die präparierte Antwort verarbeitet wurde (kein falsches Grün). Feste Uhr, gezielte Zeitsteuerung,
kein `networkidle` bei laufendem Himmel. Versagt ein Schutz heute, wird das als Fehler festgehalten und separat repariert.
Normale Fälle mit CSS-Himmel, je ein Starttest mit WebGL und mit erzwungenem Ausfall. Ausgangsprotokoll mit Revision,
Versionen, Ergebnissen, Laufzeiten, ausgewählten Screenshots. **Budget:** Ziel 60–90 s, höchstens 120 s zusätzlich auf dem Pi.
Echte GPU-Darstellung und Android-Tastatur prüft die kurze Abnahme auf S23 und Edge.

## 7. Barrierefreiheit und Betrieb

Dialoge mit Tastaturbedienung, Beschriftungen, Fokusführung und Rückkehr zum Auslöser; Diagramme mit Textalternative;
reduzierte Bewegung für Animationen – sichtbare Änderungen bleiben abnahmepflichtig. Neue Versionen werden durch volles
Neuladen aktiv (`?v=`-URL, Changelog-Hinweis, `neuLaden()`); „ohne HA-Neustart“, „mit Neustart“ und Rückweg getrennt prüfen.

## 8. Entscheidungen

- 06.10.2026 Herbert: esbuild; Lit als Ziel, aber zuerst bis zum Piloten (2a), dann Entscheidung nach §5.
- 06.10.2026 Herbert: Browser-Tests lokal (Chromium 136 auf dem Pi, headless geprüft) und auf GitHub; Abnahme S23 Ultra
  (HA-App) und Microsoft Edge; Pilot-Grenzen und Budget 120 s angenommen.
- 06.10.2026 Herbert nach dem Piloten (0.8.80, S23 und Edge geprüft): „passt so. weiter mit ganzer seite“ – fünfmal Ja
  (`docs/lit-entscheidung.md`), weiter mit 2b–5.
- BSM-024 („Umstieg auf Lit planen“) ist mit diesem Plan erledigt und geht in BSM-022 auf.
- Review: `docs/chatgpt-reviews/CGR-2026-10-06-seite-lit/` (r1: Weg korrigiert, r2: konkreter Stufenplan).

## 9. Nachweise

- **0a, 06.10.2026 (0.8.74):** zwei Builds bytegleich (563 KB roh); `bauen.mjs --pruefen` erkennt ein veraltetes Bundle,
  `changelog.py --pruefen` veraltete version.json/manifest.json; Mockup lädt die Seite als Modul und startet in Chromium
  136 headless ohne Fehler (Handy und Desktop gezeichnet); Auslieferungsprobe in einem temporären Ziel: nur
  `baustelle-panel.js` und `changelog.json` aus `frontend/`, früher ausgelieferte Quellen und leere Ordner entfernt.
- **0b.1, 06.10.2026:** Panel-Test auf happy-dom (alle Testfälle übertragen, beide Strukturen grün, gleiche WS-Aufrufe),
  Browser-Test B1–B7 in Chromium 136 (≈ 40 s auf dem Pi), Ausgangsprotokoll `docs/lit-ausgangsprotokoll.md` mit drei
  einzeln benannten Fehlern (B7 Listener, B7 Abos nach Wiedereinhängen, B4 ganze Seite neu). WebGL-Starttest nur auf
  GitHub (im Container auf dem Pi kein WebGL).
- **0b.2, 06.10.2026 (0.8.75):** window-Listener nur solange eingehängt (`_fensterAn`/`_fensterAus`), Wetter-Abos beim
  Wiedereinhängen neu; B7 grün (dasselbe und 20 neue Elemente), aus `BEKANNT` gestrichen.
- **1a, 06.10.2026 (0.8.76):** `src/hilfen.js` (Formatieren, Datum/Zeit, `esc`, `schalter`/`knopf2`/`erkl`,
  `verNeuer`) und `src/symbole.js` (Wettersymbole, Container-/Schacht-Grafik, Icons, WLAN-Striche) aus `alt.js`
  (4.912 → 4.696 Zeilen). Gleiche Ausgabe/Befehle belegt mit `tests/panel/schnappschuss.js` (57 Schritte mit fester Uhr,
  HTML und WS-Befehle vor/nach bytegleich).
- **1b, 06.10.2026 (0.8.77):** `src/himmel.js` (Shader, Farben, Sonnen-/Mondlauf, Partikel, Klasse `Himmel`) und
  `src/diagramme.js` (Linie, Balken, Stufen, Streuung, Fläche, Kachel-Diagramme) aus `alt.js` (→ 4.414 Zeilen).
  Schnappschuss vor/nach bytegleich; CSS-Rückfall und WebGL-Ausfall im Browser-Test grün, Canvas bleibt beim
  Neuzeichnen (WebGL-Fall auf GitHub).
- **1c, 06.10.2026 (0.8.78):** `src/daten.js` (Adapter `bauen`, Zeit in der Zone: `lokal`, `zoneMs`, `minSeitAb`,
  `protokollZeile`), `src/tabellen.js` (Zuordnungen), `src/rechte.js` (Nur-Lesen-Sperre, Vor-Ort-Aktionen, `gesperrt`,
  `darfSenden`), `src/api.js` (Nachrichten `setzen`/`aktion`/`liste`, Fehler-/Dialog-Antworten); Klassenmethoden leiten
  weiter (`alt.js` → 4.298 Zeilen). Schnappschuss um Nicht-Admin erweitert, 67 Schritte vor/nach bytegleich; Panel-Test
  (API-Nutzdaten, Rechte, Fachwerte/CSV) und B6 grün. Lesende Abfragen mit `_holen` bleiben in der Klasse, bis ihre
  Ansichten in Stufe 3 umziehen.
- **2a.1, 06.10.2026 (0.8.79):** Lit 3.3.3 (eingebündelt, Lizenz BSD-3 inline, Bundle 564 → 597 KB roh). Dauerhafte
  Lit-Bereiche: der alte Renderer setzt Platzhalter `[data-lit]`, `_litEinhaengen()` setzt je Platzhalter denselben
  Behälter ein (`display: contents`) und zeichnet mit `render(template, container)`; `litNeu()` zeichnet nur die Lit-Bereiche.
  `src/ueber.js` mit `@click` (Zurück, Verlauf, Melden), `data-act="cl"` entfernt, `meldenAuf()` als Methode. Nachweis:
  Schnappschuss bis auf „Über“ bytegleich, „Über“ inhaltlich gleich; Browser-Fall „Lit-Pilot Über“: 20 Navigationen und
  20 Updates mit Neuzeichnen behalten den Lit-Knoten, Aufklappen ohne `render()`. Test-DOM um `Document`, `CSSStyleSheet` u. a.
  ergänzt; Mockup-Prüfung (`pruefen.cjs`) läuft jetzt in happy-dom.
- **2a.2, 06.10.2026 (0.8.80):** `src/melden.js` (Entwurf in `s.sheet.form`, Textfeld mit `live()`, `@click`/`@input`/
  `@change`; `ml-*`/`mb-*`-Fälle, `data-ml`/`data-mb` und `mbBox` entfernt, `meldungSenden()`/`meldenZu()` als Methoden).
  **Befund im Piloten:** der Lit-Knoten blieb erhalten, aber das `innerHTML` des alten Renderers hängte ihn kurz aus –
  der Browser nahm dem Feld den Fokus. Lösung ohne Fokusrettung: `_uiSetzen()` lässt bei offener Lit-Einblendung das
  Element `.sheet` stehen und ersetzt nur die Geschwister; der Aufschub in `_auffrischen` entfällt für Felder in
  Lit-Bereichen (neue Daten sofort sichtbar). Nur-Lesen-Sperre erkennt den freien Schalter an `.ml-stand`.
  Nachweis: Browser-Fall „Lit-Pilot Melden“ (17 Neuzeichnungen während des Tippens: Text, Fokus, Cursor bleiben;
  Strg+V-Bild, ✕, Abbrechen, Senden = ein Auftrag), B2 auf das neue Verhalten angepasst; Schnappschuss inhaltlich gleich.
- **2b, 06.10.2026 (0.8.81):** `BaustellePanel extends LitElement` (Stile über `static styles`). Der Rahmen ist eine
  Lit-Vorlage und bleibt stehen (`.wurzel`, `.app`, `.glas-bg`, `.ui`, `.scroll`, `.seite` je Ansicht mit `keyed`, `.sheet`,
  `.tip`, `.toast`); noch nicht umgestellte Ansichten und Einblendungen als `unsafeHTML` (ersetzt nur bei geändertem Text);
  „Über“ und „Melden“ direkt als Vorlagen. `render(neu)` → `neuZeichnen(neu)` = `requestUpdate()` (asynchron, Aufrufe
  zusammengefasst); `willUpdate()` (Chipleiste, Ansicht/Einblendung, Weichen), `updated()` (oben beginnen bei Ansichtswechsel,
  Einblendung bei neuem Inhalt, Chipleiste, Nur-Lesen). **Entfallen:** Scroll-Wiederherstellung der Seite und der
  Einblendung (die Elemente bleiben stehen), `_uiSetzen`, Platzhalter für „Über“-Ansicht und „Melden“, Neuaufbau von
  Tooltip/Hinweis samt erneutem Einblenden. `_litEinhaengen` bleibt nur für „Über“ in den Einstellungen (bis 3e).
  Nachweis: Schnappschuss gleich bis auf den entfallenen Behälter um „Melden“; Panel-Test grün; Browser-Fall „2b
  LitElement“ (hass vor/nach Einhängen, 20 Wiederanschlüsse ≤ 1 Abfrage je Anschluss, Menü, Theme, schmal/breit);
  Leistung gegen 0.8.80: `render` 65 → 27 ms, Update 115 → 40 ms, Klick gleich.
- **3a, 06.10.2026 (0.8.82):** Inventarliste `docs/lit-inventar.md` (Ansichten, Einblendungen, Klick-Aktionen je Stufe).
  `src/ansichten/allgemein.js` (Kopf, Laden/Fehler, Leer) und `src/ansichten/dev.js` (eigene Ansicht; in den
  Einstellungen als Lit-Bereiche `dev-meldungen`/`dev-werkzeuge`). Klick-Fälle `mfilter`, `m-status`, `m-weg`, `m-md`,
  `m-json`, `m-bild`, `diagnose` → Methoden; `case 'sheet'` → `einblenden(art, ds)`; `v_leer`/`v_dev` entfernt,
  `TICKET_STATUS` nach `tabellen.js`. Nachweis: Schnappschuss um Entwicklung erweitert (73 Schritte), inhaltlich gleich;
  Browser-Fall „3a Laden/Fehler/Leer“ (hängt, Fehler, Erholung, leere Baustelle, „+ Neue Baustelle“).
- **3b, 06.10.2026 (0.8.83):** `src/ansichten/verlauf.js` (Archiv, Vergleich, Chronik, Detailseite; Diagramme noch
  als SVG-Text). Methoden `protokollQuelle`, `bsProtokoll`, `baustelleOeffnen` (auch für `bs-wahl`), `baustelleAktiv`;
  Klick-Fälle `vl-reiter`, `vl-art`, `vl-sort`, `bs-oeffnen`, `bs-aktiv` entfernt. **Entfallener Sonderfall:** Fokus- und
  Cursor-Rettung der Chronik-Suche in `eingabe()`. Nachweis: Schnappschuss um Verlauf/Detailseite erweitert (86
  Schritte), inhaltlich gleich (Suchfeld: Wert als Eigenschaft statt Attribut); Browser-Fall „3b Verlauf“ (Tippen mit
  Fokus/Cursor, Filter, Sortieren, Detailseite, CSV, zurück).
- **3c, 07.10.2026 (0.8.86):** `src/ansichten/pumpen.js` (Reiter Pumpen, Pumpenschacht im Detail) und
  `src/ansichten/zeitraum.js` (‹ Zeitraum › mit Kalender als Vorlage; die alten Ansichten nutzen bis Stufe 4 weiter
  `zrWahl`), dazu `schalterVorlage`/`stepperVorlage` in `allgemein.js`. Anzeige-Zuordnungen (`TEXT`, `kwVon`, `wertHtml`,
  `illu`, `WARTE`) nach `tabellen.js`. Aktionen als Methoden, die auch `klick()` nutzt (ein Code, zwei Wege bis Stufe 4):
  `containerOeffnen`, `einstGruppe`, `bereichAuto`, `geraetSchalten`, `stufeSchritt`, `zrSchritt`, `zrSetzen`,
  `zrKalAuf`, `zrKalBlaettern`; Klick-Fall `p-chart` entfernt, `v_pumpen`/`v_schacht`/`kennzHtml` entfallen.
  **Entfallener Sonderfall:** `_liveNeu` tauscht im Schacht kein `innerHTML` mehr in Diagramm und Kennzahlen, sondern
  zeichnet über Lit nur das Geänderte. Nachweis: Schnappschuss um Pumpen/Schacht erweitert (120 Schritte), inhaltlich
  gleich (Vergleich normalisiert die Stelle von `disabled`, das Lit ans Tag-Ende setzt); einzige Abweichung: nach einem
  gesperrten Klick im Nur-Lesen-Modus fehlt die Klasse `rein` der Einstiegsanimation, weil `setzen()` neu zeichnet –
  gesendet wird in beiden Ständen nichts. Panel-Test (Schacht: Diagramm, Zeitraum, Kalender, Automatik, Pumpe, Wege;
  verspätete Statistik nach Baustellenwechsel), Browser-Fall „3c Pumpen“ (je ein Auftrag, Schalter bleibt bei neuen
  Daten derselbe Knoten, verspätete Statistik ändert die neue Baustelle nicht).
- **3d Container-Ansicht, 07.10.2026 (0.8.87):** `src/ansichten/container.js` (Kopf mit Modus/Aufheizen, Rad mit − +,
  Gefühl, Kacheln, Bei Bedarf mit Terminen, Geräte-Chips, Diagramm mit Zeitraum, Lernen/Trocknen). In der Seite bleiben
  Daten und SVG: `cRadSvg` (vorher `cRad` samt Knöpfen), `cTag`, `containerTeile` (nur noch Diagramm). Aktionen als
  Methoden (`modusSetzen`, `boostUmschalten`, `sollSchritt`, `gefuehl`, `sollZurueck`, `geraetAktiv`, `geraetAutomatik`,
  `geraetBearbeiten`, `lernenUmschalten`, `trocknenUmschalten`, `bedarfAn`, `bedarfAus`, `terminWeg`); die Klick-Fälle
  rufen sie für Übersicht und Einblendungen weiter auf. **Nur-Lesen ohne `data-act`:** Lit-Knöpfe, die nur Admins
  bedienen, tragen `.nur-admin` (in `NUR_LESEN_SPERRE` ausgegraut) und laufen über `nurAdmin(fn)` (Hinweis statt Aktion).
  **Entfallene Sonderfälle:** `cGeraete`, `cGefuehl`, `cOhneFuehler`, `bedarfBlock`, `v_container(_d)`; `_liveNeu` tauscht
  kein `innerHTML` mehr, sondern zeichnet über Lit neu (mit offener Einblendung oder Tooltip weiter erst später).
  **Befund B4 behoben:** neue Statistik zeichnet nur Geändertes, die Knoten bleiben (Browser-Fall B4 prüft jetzt
  Knotenidentität statt Aufrufzahl). Nachweis: Schnappschuss um die Container-Bedienung erweitert (161 Schritte,
  inhaltlich gleich, auch Nicht-Admin); Panel-Test (WU-0002, FE-0008, FE-0009, WU-0004, Lernen auf Lit-Merkmale);
  Browser-Fall „3d Container“ (je ein Auftrag für Modus, Soll, Aufheizen, Gerät, Trocknen; gewählter Modus sendet nichts;
  Nicht-Admin: ✎ ausgegraut ohne Einblendung, Aufheizen als Vor-Ort-Aktion geht, Modus nicht). Offen in 3d: die
  Einblendungen der Container-Ansicht, dann Heizung.
- **3d Einblendungen der Container-Ansicht, 07.10.2026 (0.8.88):** `src/ansichten/einblendungen-container.js` (Leistung,
  Heizzeit, Bei Bedarf, Termin, Lernstand; Zuordnung `CONTAINER_EINBLENDUNGEN`, in `_ui()` neben „Melden“, `LIT_SHEETS`
  erweitert). In der Seite bleiben die Daten: `leistungDaten` (vorher `leistungInhalt` als HTML), `heizzeitDaten`.
  Methoden `schliessen`, `zeitraumWahl`, `terminSpeichern`, `lernZuruecksetzen`. **Entfallene Sonderfälle:**
  `leistungTeil` (Datenteil per `innerHTML` tauschen, Streifen nachfärben), der entprellte Ziehen-Pfad in `eingabe()` und
  der `change`-Pfad in `aenderung()` für den Regler, `_lhLetzt` als HTML (jetzt Daten), Klick-Fälle `lh-h`, `lh-art`,
  `tm-wieder`, `tm-boost`, `bedarf-boost`, `lern-k`. Nur-Lesen: `schalterVorlage(…, 'vor-ort')` bleibt frei
  (`NUR_LESEN_SPERRE` `:not(.vor-ort)`), Termin/Lernstand zurücksetzen über `.nur-admin`. Nachweis: Schnappschuss um die
  Einblendungen erweitert (198 Schritte), inhaltlich gleich (Vergleich sortiert jetzt die Attribute je Tag); Abweichung:
  der Regler-Wert als Attribut folgt dem Regler (vorher stand der Startwert), und ein heute zu weit gezogener Regler
  merkt die sichtbare Stunde. Panel-Test (Regler über echte Ereignisse, WU-0012 über Knotenidentität), Browser-Fall
  „3d Einblendungen“ (Tippen im Termin während 5 Datenupdates, ein Auftrag, Nicht-Admin), B5 grün. „Aussehen“ zieht mit
  „Container bearbeiten“ nach 3e.
- **3d Heizung, 07.10.2026 (0.8.89):** `src/ansichten/heizung.js` – Reiter (Kopf, „Heute“-Karte, Kacheln) und je Block
  eine Vorlage (`HZ_BLOECKE`: heute, wann, plan, az, ausn, regeln, trocknen, container, urlaub); Einblendung „hz“ über
  `hzEinblendung`, die Einstellungen binden Regeln, Trocknen, Urlaub und Je Container als dauerhafte Lit-Bereiche ein
  (`data-lit="hz-…"`, bis 3e). In der Seite bleiben `hzKurz`, `heizplanInhalt`, `zeitstrahl`, `sollKurve` (Text/SVG).
  Methoden `automatikUmschalten`, `hzAuf`, `einstellungUmschalten`, `einstellungWert`, `heizgrenzeBasis`,
  `gefuehlVergessen`, `containerSoll`, `urlaubWeg`, `ausnahmeNeu`, `ausnahmeDazu`, `ausnahmeWeg`, `azNeu`.
  **Entfallene Sonderfälle:** `hzTeile` (zerschnitt den HTML-Text von `heizungBloecke` per Textsuche nach dem Titel),
  `heizungBloecke`, `hzHeld`, `v_heizung`, `regelnInhalt`, `sollBlock`, `uebersichtHeizzeiten`, `azBlock`,
  `ausnahmenBlock`, `HZ_TEILE`, der `data-jm`-Pfad in `aenderung()`, Klick-Fälle `hz-art`, `hz-tag`, `az-alt`.
  **Befund behoben:** die Textsuche fand für „👕 Kleidung trocknen“ zuerst die gleichnamige Zeile in den Regeln – Kachel
  und Einstellungen zeigten die Regeln statt der Trocknen-Regler. Nachweis: Schnappschuss um den Reiter Heizung erweitert
  (240 Schritte); inhaltlich gleich bis auf den Trocknen-Block (Gegenlauf ohne den Trocknen-Klick: sonst nur die Klasse
  `rein` nach dem Gruppenwechsel), die Einstellungen laden den Verlauf nicht mehr unnötig (vorher baute `hzTeile` alle
  Blöcke samt Messung). Vergleich sortiert jetzt auch Klassen. Panel-Test (Heizung auf Lit-Merkmale, Auswahlliste über
  echtes `change`, Prüfung Trocknen-Block), Browser-Fall „3d Container“ um Heizung erweitert (Modus je Container, Soll,
  Trocknen je ein Auftrag). Browser-Test 112 s – nah am Budget (≤ 120 s), bei 3e Fälle zusammenlegen. Offen in 3d: die
  Dialoge Heizplan, Arbeitszeit, Neue Arbeitszeit, Ausnahme.
- **3d Dialoge der Heizung, 07.10.2026 (0.8.90) – 3d abgeschlossen:** `src/ansichten/einblendungen-heizung.js`
  (Heizplan, Arbeitszeit, Neue/Arbeitszeit bearbeiten, Ausnahme; `HEIZUNG_EINBLENDUNGEN`). Formularfelder als Entwurf in
  `s.form` mit `live()`, Test-Merkmal `data-f` (nicht `data-k`, das die Nur-Lesen-Sperre für Felder trifft); Speichern,
  Bearbeiten, Löschen über `.nur-admin`. Methoden `jetztHeizen`, `azBearbeiten`, `azWeg`, `ausnahmeSpeichern`,
  `azSpeichern`. **Entfallen:** die vier Zweige in `sheet()`, Felder `data-au`/`data-azn`/`data-azt` in `eingabe()`,
  Klick-Fälle `au-art`, `azn-tag`, `azn-wie-mo`, `az-heizung`. Nachweis: Schnappschuss um die Dialoge erweitert (277
  Schritte, inhaltlich gleich, auch Nicht-Admin); Panel-Test über die neuen Feld-Merkmale; Browser-Fall „3d
  Einblendungen“ um die neue Arbeitszeit erweitert (Tippen während 3 Datenupdates, Samstag, ein Auftrag). Prüfung §3 für
  3d: Live-Daten während Dialog/Tooltip (B4, B5, Tippen in Termin und Arbeitszeit), Modi, Soll, Schreibbefehle (je ein
  Auftrag, Nicht-Admin) – erfüllt.
- **3e Einstellungen (Rahmen und Gruppen), 07.10.2026 (0.8.91):** `src/ansichten/einstellungen.js` – Seitenleiste/Chips,
  je Gruppe eine Vorlage, „Geräte“ (`geraeteListe`) mit Lit; Heizung-Blöcke, „Entwicklung“ und „Über“ direkt als
  Vorlagen. Das Notprogramm bleibt bis zu seiner Lieferung HTML-Text (`npGruppe`, `unsafeHTML`). `WETTER_TEXT` nach
  `tabellen.js`. Methoden `einstGruppeWahl`, `bereichEinst`, `firmaAuf`, `anschlussAuf`, `preisNeu`, `preisWeg`,
  `vorrang`, `testMeldung`, `berichtSenden`, `mailSetzen`, `awVorlageWahl`. **Entfallene Sonderfälle:** `einstBloecke` +
  `einstBlock` (Gruppen per Titelsuche aus einem HTML-Text geschnitten), `einstGruppen`, `v_einst`, die dauerhaften
  Lit-Bereiche (`_litEinhaengen`, `data-lit`, `.lit-bereich`-Ausnahme in `_auffrischen`), Klick-Fälle `ev-dev`, `prio`,
  `mail` in `aenderung()`. `preisListe` bleibt für „Baustelle bearbeiten“. Nur-Lesen: Name, Beginn/Ende, Heizperiode,
  Neue Baustelle, Wetter/Kalender, Container neu, Preis löschen, E-Mail über `.nur-admin`. Nachweis: Schnappschuss um die
  Bedienung aller Gruppen erweitert (336 Schritte), inhaltlich gleich bis auf den entfallenen Lit-Behälter und zweimal
  die Klasse `rein`; Panel-Test (Gruppen, Vorrang, E-Mail über echte Ereignisse), Browser-Fall „Lit-Pilot Über“ auf
  die Lit-Einstellungen umgestellt (Navigation, 20 Updates ohne neuen Knoten, Aufklappen, Melden).
- **3e Dialoge rund um die Baustelle, 07.10.2026 (0.8.92):** `src/ansichten/einblendungen-baustelle.js` (Name, Neue
  Baustelle, Beginn/Ende/Heizperiode, Wetter und Kalender, Abschließen, Löschen, Urlaub, Bericht, Nachrichten,
  Strompreis, Baustelle bearbeiten; `BAUSTELLE_EINBLENDUNGEN`) samt `preisListeVorlage` (auch in Einstellungen › Strom)
  und `optionenVorlage` (Auswahllisten). Auswahllisten reagieren auf `input` und `change`. Methoden `berichtDaten`,
  `nameSpeichern`, `baustelleAnlegen`, `zeitraumBsSpeichern`, `abschliessen`, `urlaubSpeichern`,
  `wetterquelleSpeichern`, `preisSpeichern`, `bsLoeschen`, `bsBearbeiten`. **Entfallen:** neun Zweige in `sheet()`,
  `preisListe`, Felder `data-sp`/`data-ur`/`data-wq`/`data-nm`/`data-bsz`/`data-hp` in `eingabe()`, Klick-Fälle
  `n-knopf`, `wetterquelle-auf`. Nachweis: Schnappschuss um die Dialoge erweitert (402 Schritte), inhaltlich gleich, auch
  Nicht-Admin; Panel-Test über die Feld-Merkmale `data-f`.
- **3e Dialoge für Container und Geräte, 07.10.2026 (0.8.94):** `src/ansichten/einblendungen-einrichtung.js` (Firma,
  Anschluss, Neuer Container, Container bearbeiten mit Größe/„Warm ab“/Geräteliste, Aussehen, Gerät bearbeiten;
  `EINRICHTUNG_EINBLENDUNGEN`). Die langen Speichern-Rümpfe stehen unverändert als Methoden (`firmaSpeichern`,
  `firmaWeg`, `anschlussSpeichern`, `anschlussWeg`, `containerAnlegen`, `bereichSpeichern`, `bereichWeg`,
  `geraetSpeichern`), dazu `bereichEntwurf`, `warmEigen`, `warmZurueck`, `geraetNennKw`, `aussehenAuf`, `symAendern`
  (Konfiguration kopieren, ändern, senden), `symStandard`. **Entfallen:** fünf Zweige in `sheet()` und `symDialog`,
  `groesseBlock`, `symKlick`, `symAenderung`, zwölf Feldarten in `eingabe()`, der `data-sym`-Pfad in `aenderung()` und
  rund 20 Klick-Fälle (Zuordnen, Werte, Geräteliste, Größe, Aussehen). Die Speichern-/Löschen-Fälle bleiben bis Stufe 4
  als Weiterleitung. Test-Merkmale ohne Ereignisweg: `data-f`/`data-i` an Feldern, `data-id` an Zuordnungszeilen,
  `data-zeile`, `data-w`, `data-z`/`data-art`. Nachweis: Schnappschuss um die Dialoge erweitert (476 Schritte), inhaltlich
  gleich (Vergleich blendet jetzt auch `data-*` mit Ziffern aus); Panel-Test über die neuen Merkmale.
- **3e Notprogramm, 07.10.2026 (0.8.95) – 3e abgeschlossen:** `src/ansichten/notprogramm.js` (Gruppe `npGruppeVorlage`,
  Einzelheiten `npPlugEinblendung`, Zustands-Chip als Vorlage). Methoden `npPruefen`, `npPlugAuf`, `npProbe`; Schalter über
  `einstellungUmschalten('notprogramm' | 'taste')`. **Entfallen:** `npGruppe`, `npPlug`, `npChip` (HTML-Text). Die
  Klick-Fälle `np-*` bleiben bis Stufe 4 als Weiterleitung. Nachweis: Schnappschuss um Gruppe, Plug, Probe, Prüfen,
  Taste und Schalter erweitert (492 Schritte), inhaltlich gleich bis auf die Klasse `rein` nach einem gesperrten Klick
  (Nicht-Admin); Panel-Test. Prüfung §3 für 3e: Admin/Nicht-Admin und genau ein Auftrag je Aktion – im Schnappschuss
  je Schritt die gesendeten Befehle gleich (Admin und Nicht-Admin), dazu B6 und die 3d-Fälle im Browser.
- **3f Übersicht, 07.10.2026 (0.8.96):** `src/ansichten/uebersicht.js` (Kopf, Chips, Raster); „Meine Kacheln“ bleibt bis
  zur nächsten Lieferung ein eigener Teilbaum aus HTML-Text (`kkBereich`, `unsafeHTML`, eigener Ereignisweg `data-act`).
  Verschachtelte Knöpfe (Strom-Knopf im Baustellen-Kopf, „jetzt heizen“ in der Karte) halten den Klick an
  (`stopPropagation`) – vorher entschied `closest('[data-act]')`. Methode `bedarfAuf` (Vor-Ort-Recht „bedarf“ geprüft).
  **Entfallen:** `v_uebersicht`. Nachweis: Schnappschuss um die Bedienung der Übersicht erweitert (516 Schritte),
  inhaltlich gleich; Browser-Test auf Lit-Selektoren für Karte, Automatik, Warnungen, Bei Bedarf.
- **3f Meine Kacheln und Katalog, 07.10.2026 (0.8.97):** `src/ansichten/kacheln.js` (`kachelVorlage`, `rasterVorlage`,
  `bereichVorlage`, `katalogEinblendung`); Tabellen der Kacheln und Bausteine nach `src/kacheln-daten.js`. Methoden `kkAn`,
  `kkWeg`, `kkDiaUm`, `vgArtUm`, `kkAufI`, `kkPlus`, `kkLayoutUm`, `spSim`; die Klick-Fälle bleiben für die noch alte
  Auswertung als Weiterleitung. Ziehen/Größe (`zugStart`, Griffe `data-zug`) bleiben, räumen aber am Ende selbst auf
  (`transform`, `pointer-events`, `zieht`/`waechst`/`ziel`) – vorher erledigte das das Neuzeichnen per `innerHTML`.
  **Befund behoben:** im Katalog landete „Balken/Linien“ in `sheet.art` (= Art der Einblendung) – jetzt `vgArt`.
  `kkWeg` nimmt die Liste nur einmal (`awAuswahl()` liefert je Aufruf ein neues Array). **Entfallen:** `kkBereich`,
  `kkKatalog`, `kkTreffer`, `kkWahl`, `vgWahl`, Such-Pfad in `eingabe()`, Klick-Fälle des Katalogs. `kkRaster`, `kkKachel`,
  `vgKachel`, `spKachel` bleiben bis zur Auswertung. Nachweis: Schnappschuss um Kacheln/Katalog erweitert (568 Schritte),
  inhaltlich gleich bis auf die Korrektur (Gegenlauf ohne den „Linien“-Klick: nur „Balken“ vorgewählt); Panel-Test auf
  Lit-Merkmale; Browser-Fall „3d Einblendungen“ um Ziehen einer Kachel erweitert (Reihenfolge neu, keine Reste).
- **3f Einblendungen der Übersicht, 07.10.2026 (0.8.98):** `src/ansichten/einblendungen-uebersicht.js` (Verbrauch,
  Wetter, Warnungen, Baustellen, Strom mit Rangliste, Bild einer Meldung; `verbrauchVorlage` auch für die Auswertung).
  Erste Lieferung mit paralleler Vorbereitung: ein Agent hat die Vorlage samt Notiz (Methoden, Fälle, Tests) in einer
  eigenen Arbeitskopie gebaut; verdrahtet, geprüft und ausgeliefert im Hauptstrang. Methoden `verbrauchDaten` (Rechenteil
  aus `verbrauchInhalt`, das für die alte Auswertung darauf aufsetzt), `vbGruppe`, `vbWer`, `ohneBasisWahl`,
  `wetterAnsicht`, `warnungStumm`, `warnungenProtokoll`, `stromRangAuf`. **Entfallen:** sechs Zweige in `sheet()`,
  `stromRang`, Klick-Fälle `wa`, `oh-basis`, `w-hin`, `w-protokoll`, `sr-auf`; Weiterleitung bleibt für `w-stumm`,
  `vb-gruppe`, `vb-wer`, `bs-wahl`, `bs-bearbeiten`. Nachweis: Schnappschuss um die Bedienung dieser Einblendungen
  erweitert (614 Schritte), inhaltlich gleich; Panel- und Browser-Test auf Lit-Selektoren.
- **Entscheidungsbogen:** `docs/lit-entscheidung.md` (Nachweise zu §5, Leistung `tests/panel/browser/leistung.mjs`,
  Rückweg auf 1c geprobt, Aufwandsschätzung je Familie); offen: Abnahme S23/Edge und Herberts Entscheidung.
- **npm offline, 06.10.2026:** `npm ci --offline --cache /config/projekte/.npm-cache-baustelle` in einem temporären Ordner
  ohne Netzzugriff durch npm, `@esbuild/linux-arm64` enthalten, kleiner Build grün; package-lock.json sha256
  `1696ce4356818f04…` (mit Lit, happy-dom, puppeteer-core erneut geprobt: `6025c468e9cf6de0…`), Node v22.23.2, npm 10.9.1, linux/arm64. Neu vorbereiten bei anderem Lockfile, Node/npm,
  Plattform oder Cache-Verlust.
