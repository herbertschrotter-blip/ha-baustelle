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
| ☐ | **Entscheidung** | Pilot bewerten (§5) | Ja/Nein-Bogen | 5 × Ja und Restaufwand akzeptiert | bei Nein: 1c behalten |
| ☐ | **2b** | Klasse auf LitElement; Zustand (`s` reaktiv, `neuZeichnen()` → `requestUpdate()`, neue Objektreferenzen), Laden aus Vorlagen heraus, Timer/Abos | nichts | `hass` vor/nach Einhängen; 20 Wiederanschlüsse ohne Mehrfachaufrufe; Menü, Theme, schmal/breit | R auf Pilot |
| ☐ | **3a** | Leer-/Lade-/Fehleransichten, dann `dev` | gleiche Hinweise | verzögerte/fehlgeschlagene Antwort, leere Baustelle, Erholung | R je Lieferung |
| ☐ | **3b** | Verlauf, dann `bsdetail` | gleich | Filter, Suche, Navigation, CSV, abgeschlossene Baustelle | R je Lieferung |
| ☐ | **3c** | Pumpen mit Details | nichts | Diagramme, Zustände, Aktionen; verspätete Antwort nach Baustellenwechsel | R |
| ☐ | **3d** | Container, dann Heizung | nichts | Live-Daten während Dialog/Tooltip; Modi, Soll, Schreibbefehle | R je Lieferung |
| ☐ | **3e** | Einstellungen nach Dialogfamilien, Notprogramm zuletzt | nichts | Admin/Nicht-Admin; genau ein Auftrag je Aktion | R je Familie |
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
- **npm offline, 06.10.2026:** `npm ci --offline --cache /config/projekte/.npm-cache-baustelle` in einem temporären Ordner
  ohne Netzzugriff durch npm, `@esbuild/linux-arm64` enthalten, kleiner Build grün; package-lock.json sha256
  `1696ce4356818f04…` (mit Lit, happy-dom, puppeteer-core erneut geprobt: `6025c468e9cf6de0…`), Node v22.23.2, npm 10.9.1, linux/arm64. Neu vorbereiten bei anderem Lockfile, Node/npm,
  Plattform oder Cache-Verlust.
