# Entscheidung nach dem Lit-Piloten (BSM-022.09)

Bauplan `docs/bauplan-lit.md` §5: **fünfmal Ja → Stufe 2b** (Seite auf LitElement umstellen, dann Ansicht für Ansicht).
Bei einem Nein bleibt die zerlegte Seite aus Stufe 1c (0.8.78) ohne Lit; Build, Tests und Module bleiben in jedem Fall.

Stand: 06.10.2026, Seite 0.8.80 (Pilot „Über“ 2a.1 und Melde-Dialog 2a.2), eingespielt.

## Die fünf Fragen

| Frage | Nachweis | Stand |
|---|---|---|
| **1. Funktioniert alles wie vorher?** | Grundprüfung lokal und auf GitHub grün (Fachlogik 668, Integration 363, Panel beide Strukturen, Notprogramm 20/20, mypy, Seite gebaut, Mockup); Browser-Test B1–B7 ohne neue Fehler (nur der bekannte Befund B4); keine unerklärten Browserfehler | ✅ (S23 und Edge: Herbert, „passt so“) |
| **2. Bleibt die Bedienung stabil?** | Browser-Fall „Lit-Pilot Melden“: 20 Neuzeichnungen während des Tippens – derselbe Eingabeknoten, Text, Fokus, Cursor; Senden = genau ein Auftrag. „Lit-Pilot Über“: 20 Navigationen und 20 Updates behalten den Lit-Knoten | ✅ |
| **3. Ist der Pilot tatsächlich einfacher?** | je ein Renderer und ein Ereignisweg (Lit-Vorlage, `@click`); alte Zweige entfernt: `case 'cl'`, `ml-art`, `ml-stand`, `ml-zurueck`, `ml-senden`, `mb-weg`, `mb-fenster`, `mbBox`, `data-ml`/`data-mb` in `eingabe`/`aenderung`; Entwurf (`s.sheet.form`) getrennt von den Daten der Integration; keine neue Fokus-/Scrollrettung, kein `innerHTML`-Flicken im Lit-Teil. **Entfallener Sonderfall:** der Aufschub „nicht neu zeichnen, solange jemand tippt“ gilt für Lit-Felder nicht mehr – neue Daten erscheinen sofort. **Neu dazu:** `_uiSetzen()` lässt eine offene Lit-Einblendung stehen (sonst nimmt das `innerHTML` des alten Renderers ihr den Fokus) – ein struktureller Übergang, der mit Stufe 2b wieder entfällt | ✅ mit der genannten Übergangsregel |
| **4. Bleiben Aufwand und Reaktion im Rahmen?** | `tests/panel/browser/leistung.mjs`, Median aus 5 Läufen, alt 0.8.78 gegen neu 0.8.80: `render()` mit offenem Dialog 69,5 → 66,5 ms, Update 118,8 → 112,6 ms, Klick bis zum Bild 154,7 → 151,3 ms (Grenze je +max(20 %, 50 ms)). Bundle 564 → 600 KB roh. Browser-Test ≈ 70 s (≤ 120 s) | ✅ (drei Läufe unten) |
| **5. Ist der Rest überschaubar und rückgängig zu machen?** | Rückweg auf 1c in einem temporären Ziel geprobt (0.8.78 ohne npm/Internet ausgeliefert, Seite und Manifest 0.8.78, Quellen und Werkzeuge nicht im Ziel). Pilotaufwand und Schätzung unten | ✅ (Herbert akzeptiert) |

## Drei Läufe ohne Wiederholung

- 06.10.2026, Pi: 75,2 s · 87,1 s · 77,0 s – alle grün (11 Fälle; einziger Befund B4, bekannt), keine Chromium-Reste.
- **Befund dabei:** In 2 von 13 früheren Läufen hing Chromium auf dem Pi nach vielen Seiten im selben Browserprozess
  (`Runtime.callFunctionOn timed out`, danach alle Fälle). Kein Fehler der Seite. Abhilfe im Test: jeder Fall startet
  einen frischen Browser (≈ 1 s je Fall), ein Hänger träfe höchstens einen Fall.
- GitHub (Chrome 136, mit WebGL): grün für 0.8.80.

## Aufwand

**Pilot (2a.1 + 2a.2):** etwa 3 Stunden, davon gut die Hälfte für Testwerkzeuge (Lit im Test-DOM, Browser-Fälle) und
den Befund mit dem Fokus. Die Werkzeuge sind jetzt da; weitere Teile gehen schneller.

**Restaufwand je Familie** (eine Sitzung ≈ 2–3 Stunden mit Tests, Schnappschuss und Einspielen):

| Stufe | Inhalt | Umfang heute | Schätzung |
|---|---|---|---|
| 2b | Klasse auf LitElement, Zustand reaktiv, Timer/Abos, `_uiSetzen`/Platzhalter entfallen | Lebenszyklus, `render`, `klick` (336 Zeilen, ~150 Aktionen) | 1–2 Sitzungen |
| 3a | Leer-/Lade-/Fehleransichten, Entwicklung | klein | ½–1 |
| 3b | Verlauf, abgeschlossene Baustelle | mittel | 1 |
| 3c | Pumpen mit Details | mittel | 1 |
| 3d | Container, dann Heizung (Live-Daten, Modi, Soll) | groß | 2–3 |
| 3e | Einstellungen nach Dialogfamilien, Notprogramm zuletzt | größter Teil (viele Dialoge in `sheet`, 375 Zeilen + Helfer) | 3–5 |
| 3f | Übersicht, Auswertung in Teilansichten | groß (Kacheln, Bausteine, Ziehen) | 2–3 |
| 4 | übrige Einblendungen/Diagramme, Alt-Weiche entfernen | mittel | 1–2 |
| 5 | Doku, Abnahme S23/Edge, Rückweg-Probe | klein | 1 |
| | **gesamt** | | **etwa 12–19 Sitzungen** |

Jede Stufe ist eine eigene PATCH-Version, einzeln einspielbar und mit Rückweg auf die vorherige.

## Entscheidung

- [x] Herbert: Pilot auf S23 Ultra (HA-App) geprüft
- [x] Herbert: Pilot in Microsoft Edge geprüft
- [x] Herbert: Restaufwand akzeptiert
- **Ergebnis (06.10.2026, Herbert: „passt so. weiter mit ganzer seite“):** fünfmal Ja → weiter mit Stufe 2b und der
  ganzen Seite.
