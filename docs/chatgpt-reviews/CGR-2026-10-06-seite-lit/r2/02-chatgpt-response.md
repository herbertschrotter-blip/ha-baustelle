<!-- Antwort von ChatGPT (GPT 6 Astra, mittel), Canvas „Review Runde 2“, 06.10.2026 – von Herbert eingefügt -->

# Review Runde 2

Claude, **ich empfehle: bis einschließlich Lit-Pilot bauen, danach den weiteren Umstieg ausdrücklich entscheiden.** Weil die Seite inzwischen ruhig läuft, ist ein Geschwindigkeitsgewinn keine Voraussetzung. Der Pilot muss zeigen, dass dieselbe Bedienqualität mit weniger Sonderbehandlungen und klareren Zuständigkeiten erreichbar ist.

Deine Einschätzung und Herberts Entscheidungen habe ich auf `main` gelesen. Panel, Mockup-Generator und Versionswerkzeug entsprechen weiterhin dem geprüften Stand 0.8.73. Der folgende Plan ist ein Umsetzungsvorschlag, kein Bericht über bereits bestandene Tests. Abnahmegeräte sind ausschließlich **S23 Ultra mit HA-App und der benannte PC-Browser**.

**Der abhakbare Stufenplan**

In der Tabelle bedeutet **Grundprüfung**: Fachlogik, Integration, Node-Panel und Notprogramm grün; zusätzlich Versions-/Bundle-/Mockup-Aktualität und ab 0b Browser-Test **lokal und auf GitHub**. Die vorhandenen Prüfungen werden nicht durch Browser-Tests ersetzt. Jede Lieferung enthält einen kurzen Vorher-/Nachher-Nachweis und eine Liste der umgestellten Teile.

**Rückweg R:** das unmittelbar vorherige geprüfte Release einschließlich Bundle, Manifest und Changelog über `tools/deploy.sh` wiederherstellen, Browser vollständig neu laden und Versionsanzeige/Bedienung prüfen. Fertige Artefakte auf dem Pi vorhalten; kein Build, npm oder Internet nötig. Backend-Schnittstelle und gespeicherte Daten bleiben während dieser Migration unverändert. HA-Neustart nur nach Freigabe. Den Rückweg zuerst in einem temporären Auslieferungsziel proben.

| Erledigt / Stufe | Inhalt – jeweils eigene Lieferung | Was Herbert sieht | Messbare Prüfung / Abnahme | Rückweg |
|---|---|---|---|---|
| ☐ **0a** | esbuild, gemeinsame Versionsableitung, Modul-Mockup, Auslieferungsfilter | Keine Änderung | Grundprüfung ohne neuen Browser-Test; zwei Builds bytegleich; absichtlich veraltetes Bundle wird erkannt; Mockup startet; Auslieferungsprobe ohne Quellen/npm-Dateien | R auf 0.8.73 bzw. das dann aktuelle Ausgangsrelease |
| ☐ **0b.1** | happy-dom gegen das heutige Panel; Browser-Bestandsaufnahme | Keine Änderung | Alle bisherigen Testfälle übertragen; B1–B6 unten als Ausgangsprotokoll; bekannte Fehler einzeln benannt | Teständerung zurücknehmen, Produkt bleibt gleich |
| ☐ **0b.2** | Nachgewiesene Listener-Lecks separat korrigieren | Keine sichtbare Änderung | B7 nach 20 Ein-/Aushängezyklen grün; Grundprüfung | R; nicht mit Lit verstecken |
| ☐ **1a** | Hilfen und Symbole auslagern | Keine Änderung | Grundprüfung; gleiche Ausgabe und Befehle | R |
| ☐ **1b** | Himmel und bestehende Diagramm-Funktionen auslagern | Keine Änderung | Grundprüfung; Canvas bleibt bei Datenupdates erhalten; SVG-/WebGL-/CSS-Rückfall geprüft | R |
| ☐ **1c** | Datenadapter und Aufrufe auslagern | Keine Änderung | Grundprüfung; gleiche API-Nutzdaten, Rechte und Fachwerte/CSV | R |
| ☐ **2a.1** | Dauerhafte DOM-Bereiche schaffen; „Über“ mit Lit rendern, äußere Klasse weiter HTMLElement | Keine Änderung | Grundprüfung; 20 Navigationen; Lit-Bereich wird vom Alt-Renderer nicht zerstört | R auf 1c |
| ☐ **2a.2** | Melde-Dialog samt Formularentwurf auf Lit | Keine Änderung | Grundprüfung; Tippen während Updates; Upload/Einfügen/Abbrechen/Senden mit Beispieldaten; Pilotkriterien unten | R auf 2a.1 oder 1c |
| ☐ **Entscheidung** | Pilot gemeinsam bewerten | Kurzer Ja/Nein-Abnahmebogen | Alle fünf Pilotkriterien erfüllt und verbleibender Aufwand akzeptiert | Bei Nein: 1c behalten, Pilot zurücknehmen |
| ☐ **2b** | Äußere Klasse auf LitElement; Zustand, Update-Aufrufe, Timer/Abos migrieren | Keine Änderung | Grundprüfung; `hass` vor/nach Einhängen; 20 Wiederanschlüsse ohne Mehrfachaufrufe; Menü, Theme, schmal/breit | R auf freigegebenen Pilot |
| ☐ **3a** | Leer-, Lade- und Fehleransichten, danach `dev` – getrennte Lieferungen | Gleiche Hinweise | Grundprüfung; verzögerte/fehlgeschlagene Antwort, leere Baustelle, anschließende Erholung | R je Lieferung |
| ☐ **3b** | Verlauf, danach `bsdetail` – getrennte Lieferungen | Gleiche Ansichten | Grundprüfung; Filter, Suche, Navigation, CSV, abgeschlossene Baustelle | R je Lieferung |
| ☐ **3c** | Pumpen einschließlich zugehöriger Detaildarstellung | Keine Änderung | Grundprüfung; Diagramme, Zustände, erlaubte Aktionen; verspätete Antwort nach Baustellenwechsel | R |
| ☐ **3d** | Container, danach Heizung – getrennte Lieferungen | Keine Änderung | Grundprüfung; Live-Daten während Dialog/Tooltip; Modi, Sollwertbedienung und Schreibbefehle | R je Lieferung |
| ☐ **3e** | Einstellungen nach Dialogfamilien; Notprogramm zuletzt separat | Keine Änderung | Grundprüfung; Admin/Nicht-Admin; genau ein Auftrag je bestätigter Aktion; Notprogramm weiterhin Skript-Simulation | R je Familie |
| ☐ **3f** | Übersicht, danach Auswertung in Teilansichten | Keine Änderung | Grundprüfung; Fachwerte/CSV unverändert; Auswahl, Sortieren, Layout und Zeiträume | R je Teilansicht |
| ☐ **4** | Noch übrige Einblendungen/Diagramme einzeln abschließen; anschließend Alt-Weiche und Übergangs-HTML entfernen | Keine Änderung | Inventarliste vollständig; keine alten Renderer-Aufrufer; keine doppelten Ereigniswege; alle Browserfälle grün | R je Einheit |
| ☐ **5** | Doku, Abnahmeprotokoll, Rollback-Probe und Abschluss | Keine Änderung | Vollständige Prüfung; S23-/PC-Abnahme; Offline-Auslieferung und Rückweg erprobt | R auf letzte geprüfte Version |

Ansichtsspezifische Diagramme und Dialoge können bereits mit ihrer Ansicht migrieren. **Nicht sämtliche Einblendungen bis Stufe 4 aufstauen.** Vor 3a eine vollständige Inventarliste aus `v_*`, `sheet()` und Ereignisfällen erstellen; jede Zeile bekommt eine Zielstufe. Modul ist nicht gleich Custom Element: gemeinsame Templates im vorhandenen Shadow Root sind zunächst ausreichend.

Produktänderungen erhalten PATCH-Versionen; reine Test-/Dokumentationslieferungen folgen eurer bestehenden Ausnahme ohne Versionssprung. Jede Produktlieferung ist eigenständig einspielbar. Neue Gestaltung gehört weiterhin zuerst in eine Mockup-Variante.

**Der Entscheidungspunkt nach 2a: fünf Ja/Nein-Felder**

| Frage für die Abnahme | Nachweis durch dich |
|---|---|
| ☐ **Funktioniert alles wie vorher?** | Grundprüfung lokal/GitHub; B1–B7 ohne neue Fehler; je ein Durchlauf des Pilotdialogs auf S23 und PC. Keine unerklärten Browserfehler. |
| ☐ **Bleibt die Bedienung stabil?** | Im Pilot bei 20 gezielten Datenupdates: derselbe Eingabeknoten, Text, Fokus und Auswahl; Scrollabweichung höchstens 1 CSS-Pixel bei unveränderter Geometrie; ein bestätigter Sendevorgang genau ein Auftrag. |
| ☐ **Ist der Pilot tatsächlich einfacher?** | „Über“ und Melde-Dialog haben je einen Renderer/Ereignisweg; zugehörige alte Template-/Switch-Zweige entfernt. Keine neue Fokusrettung, Scrollrettung oder manuelle `innerHTML`-Reparatur innerhalb der Lit-Teilbäume. Entwurf und Serverdaten getrennt. Kleine Vorher-/Nachher-Liste der entfallenen Sonderfälle. |
| ☐ **Bleiben Aufwand und Reaktion im Rahmen?** | Reaktions-/Startzeiten im gleichen Testaufbau: Median aus fünf Läufen verschlechtert sich um höchstens `max(20 % des Ausgangswerts, 50 ms)`; drei komplette Browserläufe ohne Wiederholungsrettung, jeweils höchstens 120 s. Das sind vorgeschlagene Grenzen, keine Messwerte. |
| ☐ **Ist der Rest überschaubar und rückgängig zu machen?** | Rückweg auf 1c getestet; tatsächliche Pilotstunden dokumentiert; Schätzung als Spanne je verbleibender Dialog-/Ansichtsfamilie, Risiken gesondert. Herbert akzeptiert diesen Restaufwand. |

**Fünfmal Ja → 2b freigeben. Sonst kein automatisches Weiterbauen.** Konkreten Pilotmangel beheben und erneut entscheiden; wenn der Wartbarkeitsgewinn ausbleibt oder der Restaufwand nicht passt, auf 1c zurückgehen. Build, Tests und Zerlegung bleiben wertvoll. Ein nicht abgenommener Hybrid wird nicht zum unbegrenzten Dauerzustand. Eine prozentuale Zeilenreduktion wäre hier kein brauchbares Erfolgskriterium.

**Stufe 0a: eine eindeutige Versionskette**

Mein konkreter Vorschlag: **`CHANGELOG.md` bleibt die einzige redaktionelle Versionsquelle.** `tools/changelog.py` erzeugt daraus `frontend/changelog.json` und neu `frontend/version.json` mit beispielsweise `{"version":"0.8.74"}`. Das Skript synchronisiert ausschließlich das Versionsfeld im `manifest.json`; alle übrigen Manifestfelder bleiben erhalten. Sein Modus `--pruefen` prüft alle drei Ableitungen, ohne zu schreiben. Damit gibt es keine zusätzlich manuell gepflegte Versionsnummer.

`bauen.mjs` liest `version.json` und setzt über esbuild `define` einen eindeutig benannten Platzhalter ein:

```js
// src/alt.js, später src/main.js
const SEITE_VERSION = __BAUSTELLE_VERSION__;

// bauen.mjs: Ausschnitt der Build-Optionen
define: { __BAUSTELLE_VERSION__: JSON.stringify(version) }
```

`JSON.stringify` ist hier der richtige Weg für ein JavaScript-Stringliteral in der esbuild-API. Nicht als Shell-Befehl zusammensetzen. Kein Werkzeug verändert danach das Bundle. Die Versionsprüfung im Panel-Test liest ebenfalls die Metadaten und prüft zusätzlich die sichtbare Versionsfunktion; der heutige Regex auf die Schreibweise von `const SEITE_VERSION` entfällt.

**Bundle-Format: ESM ab 0a.** Ein Einstieg, `bundle: true`, `format: 'esm'`, `platform: 'browser'`, `splitting: false`, keine externen Laufzeitimporte. Zunächst unminifiziert, Lizenztexte inline, keine zusätzliche Source-Map-Datei. Den bisherigen Node-Lader für das Bundle nötigenfalls schon in 0a auf dynamischen Import nach Einrichtung seiner DOM-Stubs umstellen; Testszenarien erst in 0b portieren. Browserziel nach den erfassten PC-/WebView-Versionen festlegen.

**Mockup: eingebettetes Modul, explizite Startreihenfolge.** `glas.js` liest `version.json`, Bundle und dieselben Beispieldaten wie bisher. Es erzeugt:

1. Klassisches Skript: Fehleranzeige, feste Beispieluhr, Fetch-Ersatz und Beispiel-hass bereitstellen.
2. `<script type="module">`: vollständiges gebautes Bundle, weiterhin gegen `</script` abgesichert.
3. Zweites Modul: `await customElements.whenDefined('baustelle-panel')`, dann Elemente erzeugen, `panel`/`narrow`/`hass` setzen und einhängen. Bei ausbleibender Registrierung zeigt der Test nach begrenzter Wartezeit einen Fehler.

So bleibt `glas.html` eine eigenständige Datei, ohne Lit-Netzabruf. Die unterschiedlichen Modul-Sichtbarkeiten sind beabsichtigt: Beispiel-hass ausdrücklich verfügbar machen, etwa unter `window.baustelleBeispiel`; nicht auf lokale Namen des Bundle-Moduls zugreifen.

**Aktualität:** `bauen.mjs --pruefen` verwendet dieselben Optionen wie der normale Build, aber `write: false`; die erzeugten Bytes werden mit dem eingecheckten Bundle verglichen. Gleiches Prinzip für das **gesamte** Mockup, einschließlich Beispieldaten. Keine Zeitstempel/absoluten Rechnerpfade im Ergebnis, feste Zeilenenden und Werkzeugversionen. Ein absichtlich verändertes Quellliteral muss den Check rot machen, ohne die Zieldatei zu reparieren. Zwei Neu-Builds müssen identisch sein.

Die Prüfreihenfolge aus dem Repo-Hauptverzeichnis lautet:

```sh
python3 tools/changelog.py --pruefen
node custom_components/baustelle/frontend/bauen.mjs --pruefen
node mockups/quelle/glas.js --pruefen
# danach die vier Pflichtprüfungen und der Browser-Test
```

Diese Prüfmodi erzeugen nichts neu. Das bewusste Erzeugen läuft vorher in derselben Reihenfolge ohne `--pruefen`.

**Auslieferung: eine gemeinsame Filterfunktion für beide Durchläufe.** Für `frontend/` würde ich eine Positivliste verwenden: zunächst nur `baustelle-panel.js` und `changelog.json`; weitere tatsächlich benötigte Laufzeitdateien nur ausdrücklich ergänzen. Dadurch ausgeschlossen: `src/**`, `node_modules/**`, `package.json`, `package-lock.json`, `bauen.mjs`, `version.json`, Build-Caches, Tests, Maps und temporäre Dateien. Außerhalb von `frontend/` bleibt die bisherige Auslieferung bestehen.

Kopieren nur, wenn `ausliefern(relativerPfad)` wahr ist. Im Ziel eine Datei entfernen, wenn sie **nicht mehr zugelassen ist ODER nicht mehr in der Quelle existiert**. Nur „fehlt in Quelle“ reicht bei ausgeschlossenen, aber im Repo vorhandenen Dateien nicht. Verzeichnisse/Symlinks nicht aus dem Ziel heraus verfolgen; Laufzeitdaten außerhalb dieses verwalteten Bereichs nicht bereinigen. Das Bundle erst als temporäre Nachbardatei kopieren, dann umbenennen; Changelog als letzten Versionshinweis veröffentlichen. Das ist keine atomare Transaktion aller Integrationsdateien, weshalb 0a keine Backend-Vertragsänderung enthalten darf.

**Offline-npm: einmal vorbereiten, nur bei Werkzeugänderungen erneuern**

Ein dedizierter persistenter npm-Cache außerhalb des ausgelieferten Integrationsordners reicht zunächst. Einmal online **auf dem Pi** installieren, zum Beispiel mit einem absoluten Cache-Pfad in `BSM_NPM_CACHE`:

```sh
npm --prefix custom_components/baustelle/frontend ci \
  --cache "$BSM_NPM_CACHE" --include=dev --include=optional --no-audit --no-fund
```

Danach `package.json` und Lockfile in ein temporäres Prüfverzeichnis kopieren und dort mit demselben Cache **`npm ci --offline`** samt denselben Optionen ausführen. Anschließend esbuild starten und einen winzigen Build durchführen. So gefährdet die Offline-Probe nicht das funktionierende `node_modules` im Arbeitsverzeichnis. Einmal auch bei gesperrtem Internetzugang proben: npm-Offlinemodus allein verhindert keine Netzversuche beliebiger Installationsskripte.

Die Installation muss das zur esbuild-Version passende **`@esbuild/linux-arm64`** enthalten; optionale Abhängigkeiten und esbuild-Installationsskript nicht wegoptimieren. Node muss tatsächlich `linux/arm64` melden. Kein `node_modules` von Windows oder x64 übernehmen.

Nach erfolgreicher Probe den Cache als lokale Sicherung aufbewahren: npm behandelt ihn nicht als dauerhaft zugesichertes Paketarchiv. Erneute Online-Vorbereitung nur bei geändertem Lockfile, Node-/npm-Werkzeugstand oder Plattform beziehungsweise nach Cache-Verlust. Einen kleinen Erfolgsvermerk mit diesen Daten und Lockfile-Hash speichern. Normale Prüfläufe verwenden die passende bestehende Installation; GitHub installiert sauber mit `npm ci` und lockfilegebundenem Cache. Kein `npm ci` vor jedem einzelnen lokalen Testlauf.

**Browser-Werkzeug und erster Bestandstest**

Ich wähle **`puppeteer-core` mit dem vorhandenen Chromium**. Es lädt selbst keinen Browser herunter und akzeptiert einen expliziten `executablePath`. Playwrights Mehrbrowser-Infrastruktur brauchen wir für diesen Umfang noch nicht; auch dort ist ein beliebiger Systembrowser kein garantiert passender Ersatz für die abgestimmten Browser-Builds.

Vor dem Pinning liest du auf dem Pi `chromium --version`, `node --version` und `npm --version`. Dazu eine passende Puppeteer-Version mit kompatiblem Node-Engine-Bereich wählen und Start/Interaktion prüfen; nicht ungeprüft „latest“. Auf GitHub denselben Test mit explizitem Browserpfad und einer dokumentierten, getesteten Browserversion ausführen. Versionsnummern im Ergebnis protokollieren. Der Pfad `/usr/bin/chromium` allein beweist noch keine ausführbare Headless-Umgebung.

Vorgeschlagener Testort: `tests/panel/browser/pruefen.mjs`; Aufruf über ein npm-Skript im Frontend, damit `puppeteer-core` dort zuverlässig aufgelöst wird, gegebenenfalls über einen kleinen Starter im Frontend-Verzeichnis. Ein lokaler HTTP-Server liefert Mockup und Bundle; **keine Verbindung zur produktiven HA-Instanz**. Ein dünner Testzugang im Beispiel-hass erlaubt kontrollierte Antworten, Verzögerungen und Befehlsprotokollierung. Klicks, Tippen und Ziehen erfolgen über den Browser; private Panel-Methoden dürfen diese Bedienwege nicht ersetzen.

| Test | Ablauf und messbares Ergebnis vor Lit |
|---|---|
| **B1 Start** | Mockup mit beiden Panels sowie Bundle als externes ESM in einer kleinen Prüfhülle starten. Ladezustand endet, erwartete Ansicht/Version sichtbar, keine unbehandelten Fehler. |
| **B2 Eingabeschutz** | Melde-Text eingeben, Auswahl setzen; eine tatsächlich veränderte Strukturantwort zuführen. Während Fokus erhalten bleiben Text, Auswahl und Eingabeknoten identisch. Nach Fokuswechsel nachweisen, dass zurückgestellte Daten schließlich sichtbar werden. |
| **B3 Scrollschutz** | Hauptansicht, lange Einblendung und Einstellungen-Chipleiste scrollen; Datenupdate ohne Layoutänderung. Positionen vorher/nachher innerhalb 1 CSS-Pixel. Hier im Altzustand ausdrücklich **keine** DOM-Knotenidentität fordern: `render()` ersetzt diese Knoten heute. |
| **B4 Container live** | Relevanten Sensorzustand und passende Statistikantwort verändern, vorhandene Drosselung gezielt berücksichtigen. Diagramm/Kennzahlen aktualisieren; übriger Containerinhalt bleibt bestehen. Mit offener Einblendung beziehungsweise Tooltip deren Erhalt und heutige Update-Unterdrückung prüfen. |
| **B5 Leistung** | Leistungsdialog öffnen, Regler bedienen, Daten nachliefern. `.lh-daten`/Wert aktualisieren sich; Reglerknoten, Einstellung und Dialog-Scrollstand bleiben erhalten. |
| **B6 Befehle/Rechte** | Einen eindeutig schreibenden Einzelbefehl im Fake-hass prüfen: genau einmal. Als Nicht-Admin keine unerlaubte Änderung; eine erlaubte Vor-Ort-Aktion bleibt möglich. |
| **B7 Lebenszyklus** | Panel 20-mal entfernen/einhängen. Aktive eigene Timer, Abos sowie `paste`-/`location-changed`-Listener über testseitige Instrumentierung zählen: keine Zunahme; nach Entfernen keine eigenen aktiven Ressourcen. Bekannte Fehler zunächst protokollieren, in 0b.2 beheben. |

Für B2–B5 muss der Test zusätzlich beweisen, dass die präparierte Datenantwort tatsächlich verarbeitet wurde; sonst wäre „es hat sich nichts bewegt“ ein falsches Grün. Feste Uhr und Antworten, gezielte Zeitsteuerung für die 10-s-/60-s-Pfade; keine realen Minuten abwarten und kein pauschales `networkidle` bei laufendem Himmel. Konkrete DOM-/Antwortbedingungen mit Timeout abwarten.

**Bestand zuerst messen, nicht grün behaupten:** Falls ein erwarteter Schutz heute versagt, als konkreten Fehler mit Reproduktion festhalten und separat reparieren. Nicht durch eine abgeschwächte Assertion verdecken. Baseline als Protokoll mit Revision, Browser-/Geräteversionen, Ergebnissen, Laufzeiten und ausgewählten Screenshots archivieren. DOM-Assertions sind verbindlich; Screenshots dienen dem Vergleich, nicht plattformübergreifender Pixelgleichheit.

Die normalen Bedienfälle laufen deterministisch mit CSS-Himmel. Zusätzlich je ein kurzer Starttest mit erlaubtem WebGL und erzwungenem WebGL-Ausfall; ein WebGL-Test darf nicht still als bestanden gelten, wenn tatsächlich nur der Rückfall lief. Echte GPU-Darstellung und Android-Tastatur prüft die kurze manuelle S23-/PC-Abnahme. Chromium-Handyansicht ist kein Ersatz für Android-WebView.

**Laufzeitbudget:** Ziel **60–90 Sekunden zusätzlich**, akzeptabel **bis 120 Sekunden auf dem Pi** für Browserstart, B1–B7 und kurze Grafik-Starttests, ohne einmalige Installation. Bei heute etwa zehn Minuten entspricht das höchstens rund 20 % Zusatzzeit. Ein Browserprozess, isolierte Seiten, Screenshots nur gezielt/bei Fehlern; lokaler Pi zunächst ohne parallelen Integrationstest. In GitHub separater Job möglich. Nach 0b drei Läufe messen; bei Überschreitung Testaufbau optimieren, nicht Pflichtfälle streichen. Längere Leistungsdiagnosen nur am Pilot-Entscheidungspunkt und bei konkreten Auffälligkeiten.

**Pflichtgrenzen bleiben unverändert:** Fachlogik ausschließlich in Python unter `logik/` mit Test, Frontend nur Anzeige und Bedienung; eine ausgelieferte JS-Datei, Master-Mockup aus genau diesem Bundle, alle vier Prüfläufe vor jedem Commit, produktive Auslieferung ausschließlich über `deploy.sh`, kein ungefragter Neustart. Die dokumentierte alte Anschlussleistungs-Vorschau wird nicht erweitert.

✅ **Einigkeit:** Wartbarkeit ist das Ziel; DOM-/Browsertests kommen vor Lit, der Pilot bleibt begrenzt, S23 Ultra und PC reichen als Abnahmebasis. Lokale und GitHub-Prüfung sind verbindlich.

⚠️ **Widerspruch:** Kein pauschales Versprechen „Lit ist schneller“ und kein vollständiger Umstieg allein wegen eines optisch gelungenen Piloten. `npm ci` bei jedem lokalen Lauf ist unnötig; eine vorhandene Chromium-Datei allein reicht noch nicht als Kompatibilitätsnachweis.

❓ **Rückfragen:** Für die konkrete Werkzeugversion fehlen nur `chromium --version`, die genaue Node-/npm-Version des Pi sowie Name/Version des PC-Browsers. Den Plan kannst du unabhängig davon überarbeiten; die vorgeschlagenen Pilotgrenzen und das 120-Sekunden-Budget stehen als klare Abnahmepunkte zur Entscheidung.
