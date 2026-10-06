# Bauplan: Seite „Baustelle“ in Module zerlegen und auf Lit umstellen (BSM-022, BSM-024)

Stand 06.10.2026 · Entscheidung Herbert: Bündler **esbuild**, Umfang **gleich auf Lit umstellen** (BSM-024 vorgezogen) ·
Abnahme dieses Plans durch Herbert, dann Bau Stufe für Stufe.

## 1. Ausgangslage

`custom_components/baustelle/frontend/baustelle-panel.js`: eine Datei mit ≈ 4.900 Zeilen, ≈ 560 KB. Die Klasse
`BaustellePanel` (HTMLElement) baut jede Ansicht als Text (`v_uebersicht`, `v_container`, `v_heizung`, `v_auswertung`,
`v_pumpen`, `v_verlauf`, `v_einst`, `v_ueber`, `v_dev`, `v_bsdetail`, dazu `sheet()` für alle Einblendungen) und setzt
sie mit `innerHTML` neu. Klicks laufen über `data-act` in einer großen `klick()`-Weiche, Eingaben über `eingabe()` /
`aenderung()`. Folgen: schwer zu überblicken, jede Änderung riskant, beim Neuzeichnen springen Eingaben und Scroll-Stand
(„Flackern“), Diagramme werden jedes Mal neu erzeugt.

Geprüft wird die Seite heute mit `tests/panel/test_panel.js` (Minimal-DOM in Node, liest `innerHTML`-Text) und dem
Master-Mockup `mockups/glas.html` (echte Seite mit Beispieldaten, `node mockups/quelle/glas.js`).

## 2. Ziel

1. **Quellen in Teilen** unter `frontend/src/` (je Ansicht, Einblendungen, Diagramme, Himmel, Hilfsfunktionen, Aufrufe an
   die Integration), **keine Datei über ≈ 800 Zeilen**.
2. **Lit** (`LitElement`, `html```-Vorlagen): Lit ändert beim Neuzeichnen nur, was sich geändert hat – Eingaben, Fokus,
   Scroll-Stand und Diagramme bleiben stehen.
3. **Ausgeliefert wird weiter eine Datei** `frontend/baustelle-panel.js`, gebaut mit **esbuild** (Lit eingebündelt,
   ≈ 20 KB). Einspielen, Panel-Anmeldung und Master-Mockup bleiben wie sie sind.
4. **Verhalten und Aussehen gleich**; die Regel „die Seite rechnet nichts Fachliches“ gilt weiter.

## 3. Aufbau

```
frontend/
  package.json, package-lock.json   esbuild, lit, happy-dom (nur zum Bauen/Testen; nicht ausgeliefert)
  bauen.mjs                         esbuild: src/main.js → baustelle-panel.js (ein Modul, minify aus – lesbar für Fehlersuche)
  src/
    main.js                         <baustelle-panel>: hass, Zustand, Laden, Navigation, Rahmen (Reiter, Einblendung)
    daten.js                        Struktur der Integration → Anzeigedaten (heute `neuBauen`/`d`)
    aufrufe.js                      callWS, setzen, aktion, Rechte („nur ansehen“)
    hilfen.js                       de(), Datum/Zeit, esc → entfällt bei Lit weitgehend (Vorlagen maskieren selbst)
    symbole/                        Container-Symbol, Schacht, Wettersymbole, Icons
    himmel/                         WebGL-Himmel (unverändert übernommen)
    diagramme/                      Linie, Balken, Fläche, Streu – je eine kleine Lit-Komponente
    ansichten/                      uebersicht, container, heizung, auswertung, pumpen, verlauf, einstellungen, ueber, dev
    einblendungen/                  je Einblendung (Arbeitszeit, Ausnahmen, Termin, Aussehen, Notprogramm-Plug, Melden …)
    stil.js                         CSS (heute ein Block) – aufgeteilt je Teil als `css```
```

## 4. Stufen (je Stufe: Prüfläufe grün, eingespielt, Herbert sieht keinen Unterschied)

| Stufe | Inhalt | Prüfung |
|---|---|---|
| **0** | esbuild einrichten: `package.json`, `bauen.mjs`; die heutige Datei wird 1:1 zur Quelle `src/alt.js`, gebaut ergibt sie dieselbe Seite. Prüflauf „Seite ist gebaut“ (gebaute Datei = Ergebnis von `bauen.mjs`) in Skill-Profil und GitHub | Panel-Test, Master-Mockup unverändert grün |
| **1** | Zerlegen ohne Lit: Hilfsfunktionen, Symbole, Himmel, Diagramm-Funktionen, `daten.js`, `aufrufe.js` als eigene Module; die Klasse bleibt noch HTMLElement mit Text-Vorlagen | wie oben; keine Datei > 800 Zeilen außer der Klasse |
| **2** | Rahmen auf Lit: `BaustellePanel extends LitElement`; die Ansichten liefern vorerst weiter Text, der über `unsafeHTML` eingesetzt wird (Übergang); Klick-Weiche bleibt | Panel-Test auf **happy-dom** umgestellt (echtes DOM statt Text), prüft dieselben Dinge |
| **3** | Ansichten einzeln auf `html```-Vorlagen mit eigenen Ereignissen (`@click`) – Reihenfolge: Über, Notprogramm/Einstellungen, Pumpen, Verlauf, Heizung, Container, Übersicht, Auswertung (größte zuletzt) | je Ansicht: Panel-Test, Master-Mockup, Sichtprobe durch Herbert |
| **4** | Einblendungen und Diagramme als Lit-Komponenten; `klick()`-Weiche und `unsafeHTML` entfallen | wie oben; Flackern weg (Eingaben behalten Fokus, Scroll bleibt) |
| **5** | Aufräumen: doppelte Teile zusammenführen, Doku (`README.md`, `mockups/README.md`), Abschluss BSM-022/024 | alle Prüfläufe |

Jede Stufe ist eine eigene Version (PATCH). Zwischen den Stufen läuft die Seite normal weiter.

## 5. Tests und Werkzeuge

- **Panel-Test**: ab Stufe 2 mit `happy-dom` (npm, nur Test). Er rendert die gebaute Datei in einem echten DOM, klickt
  Elemente an und prüft die Aufrufe an die Integration wie heute (`docs/api-0.7.md`). Die vorhandenen Prüfungen werden
  übernommen (Text-Suchen → DOM-Abfragen, wo nötig).
- **Master-Mockup**: `mockups/quelle/glas.js` liest weiter die gebaute Datei – unverändert.
- **Prüfläufe** (Skill-Profil, GitHub): `panel` bekommt vorne `npm ci && node frontend/bauen.mjs --pruefen` (Abbruch, wenn
  die gebaute Datei nicht zur Quelle passt). `node_modules/` nicht im Repo; `package-lock.json` im Repo (feste Versionen).
- **Einspielen** (`tools/deploy.sh`) kopiert wie bisher nur `custom_components/baustelle/` ohne `frontend/src`,
  `node_modules` und Bauwerkzeuge (Liste im Skript ergänzen).

## 6. Risiken und Gegenmittel

| Risiko | Gegenmittel |
|---|---|
| Umbau bricht etwas, das der Test nicht sieht | kleine Stufen, je Stufe Sichtprobe; Master-Mockup als Vergleich vorher/nachher |
| npm auf dem Pi langsam/offline | `package-lock.json`, `npm ci` einmal; esbuild ist ein einzelnes Programm |
| HA lädt eigene Lit-Version | eigene, eingebündelte Lit-Version im Panel (übliche Praxis bei Custom-Panels) |
| Lange Bauzeit | Stufen 0–2 zuerst (Grundlage), Stufe 3 Ansicht für Ansicht über mehrere Sitzungen |

## 7. Offen für Herbert

- Abnahme dieses Plans (Stufen und Reihenfolge der Ansichten).
- BSM-024 („Umstieg auf Lit planen“) wird mit diesem Plan erledigt und geht in BSM-022 auf.

## 8. Entscheidungen

Review mit ChatGPT: `docs/chatgpt-reviews/CGR-2026-10-06-seite-lit/` (läuft). Ergebnisse werden hier eingetragen.
