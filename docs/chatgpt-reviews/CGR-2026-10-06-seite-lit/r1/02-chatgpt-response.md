<!-- Antwort von ChatGPT (GPT 6 Astra, mittel), Canvas „Review Runde 1“, 06.10.2026 – von Herbert eingefügt -->

# Review Runde 1

Claude, **ich empfehle Lit als langfristiges Ziel – den vorliegenden Umstellungsweg würde ich vor dem Start korrigieren.** Nur zum Beheben des Flackerns wäre eine vollständige Migration unverhältnismäßig. Bei dieser großen, interaktiven Seite lohnt sie sich vor allem, um die vielen manuellen DOM-Sonderbehandlungen dauerhaft abzulösen. Ein kleiner Pilot muss diesen Nutzen zuerst belegen.

Geprüft habe ich die Originaldateien auf **`main`**, Stand 06.10.2026; die Seite trägt **0.8.73**. Grundlage: [Bauplan](https://github.com/herbertschrotter-blip/ha-baustelle/blob/main/docs/bauplan-lit.md), Panel, Tests, Mockup-Generator, Panel-Anmeldung, Auslieferung, API und zusätzlich Versionswerkzeug. Dies ist ein Quellcode-Review; ich habe keine Prüfläufe ausgeführt und nichts im GitHub-Repo oder in der Pilotanlage verändert.

**1. Lit lohnt sich, aber die Begründung im Plan ist zu pauschal.**

Heute wird keineswegs immer alles ersetzt: `_aufbauen()` hält Rahmen und Himmel bereits dauerhaft; `_auffrischen()` verschiebt Aktualisierungen bei fokussierten Formularfeldern; `render()` stellt mehrere Scrollpositionen wieder her. `_liveNeu()` tauscht gezielt Container-Diagramm und Kennzahlen, `leistungTeil()` behandelt einen weiteren Sonderfall. Gleichzeitig ersetzt `render()` weiterhin die gesamte `.ui`. Genau dieses Nebeneinander macht die Wartung teuer. Siehe [Panel, insbesondere Zeilen 1511, 1769, 2338 und 2473](https://github.com/herbertschrotter-blip/ha-baustelle/blob/main/custom_components/baustelle/frontend/baustelle-panel.js#L2338).

| Weg | Aufwand und Nutzen | Meine Empfehlung |
|---|---|---|
| Zerlegen + konkrete DOM-Fehler reparieren | Kurzfristig weniger Risiko; bestehende Sonderbehandlungen bleiben und wachsen möglicherweise weiter | Sinnvoll, wenn nur wenige akute Bedienfehler zu beheben sind |
| Schrittweise Lit-Migration | Mehr Anfangsaufwand für Tests, Zustand und Lebenszyklus; langfristig weniger manuelle DOM-Pflege | Für die weitere Entwicklung dieser Seite bevorzugt |

**Lit garantiert weder Fokus noch Scrollposition.** Werden Elemente durch wechselnde Vorlagen entfernt, verlieren sie ihren Zustand weiterhin. Formularentwürfe dürfen bei einer neuen Serverantwort nicht überschrieben werden; sortierbare Listen brauchen stabile IDs, beispielsweise `repeat(items, item => item.id, ...)`. Stabile DOM-Struktur ist Teil der Implementierung, kein automatischer Framework-Effekt. [Lit: Direktiven](https://lit.dev/docs/templates/directives/)

**2. Ich würde die ersten Stufen anders schneiden.**

1. **0a – Build und Auslieferung absichern.** Bestehende Datei unverändert als Quelle übernehmen, Build einführen, Versionswerkzeuge und Mockup anpassen. „1:1“ gilt für die übernommene Quelle und das Verhalten, nicht zwingend für den esbuild-Ausgabetext. `--pruefen` baut in Speicher oder eine temporäre Datei und vergleicht, ohne das eingecheckte Ergebnis zu überschreiben.
2. **0b – DOM-Test vor Lit.** Bestehende Szenarien gegen happy-dom portieren, solange das heutige Panel noch die Referenz ist. Kleinen Browser-Test ergänzen. Sonst ändern sich Testmaßstab und Implementierung gleichzeitig.
3. **1 – Mechanisch zerlegen, mehrere kleine Lieferungen.** Zunächst Hilfen/Symbole, dann Himmel/Diagramm-Funktionen, danach Aufrufe/Datenadapter. Bestehende Ausnahmen und Rechteprüfungen mitnehmen. Die 800-Zeilen-Grenze ist eine Orientierung, kein Grund für künstliche Module.
4. **2a – Lit in einem dauerhaft gehaltenen Bereich erproben.** Zunächst „Über“, anschließend ein unkritisches Formular, etwa den Melde-Dialog. Bestehende `HTMLElement`-Hülle und Himmel bleiben zunächst bestehen. Lit kann mit `render(template, container)` auch ohne `LitElement` eingesetzt werden. Voraussetzung: Der Alt-Renderer darf diesen Container nicht wieder über `.ui.innerHTML` entfernen. [Lit: eigenständige Templates](https://lit.dev/docs/libraries/standalone-templates/)
5. **2b – Erst danach die äußere Klasse auf LitElement umstellen.** Dieser Schritt behandelt ausdrücklich `hass`, `panel`, `narrow`, Anschluss/Wiederanschluss, Abos und Timer. Ansichten zunächst als Template-Funktionen im vorhandenen Shadow Root halten; nicht zugleich für jede Ansicht neue Shadow Roots einführen.
6. **3/4 – Je Ansicht oder Dialogfamilie eine Lieferung.** „Über → Verlauf/bsdetail → Pumpen → Container/Heizung → Übersicht → Auswertung“ wäre mein Ausgangspunkt. Einstellungen aufteilen; Notprogramm und andere schreibende Steuerungsdialoge erst nach erfolgreichem Formular-Piloten. `dev`, `bsdetail`, Leer-/Fehleransichten und Unteransichten ausdrücklich in die Abnahmeliste aufnehmen. Im Plan fehlen `dev` und `bsdetail` in der Migrationsreihenfolge.

**`unsafeHTML` ist als eng begrenzte Brücke vertretbar**, löst aber innerhalb eines veränderten HTML-Strings das Ersetzungsproblem nicht. Bestehendes `esc()` dort behalten; erst bei echten Lit-Bindungen entfernen. Neue `@click`-Handler dürfen nicht zusätzlich durch dieselbe `data-act`-Weiche laufen: Sonst kann ein Klick zwei Befehle senden. Pro Teilbaum genau einen zuständigen Renderer und einen zuständigen Ereignisweg festlegen. [Lit: unsafeHTML](https://lit.dev/docs/templates/directives/#unsafeHTML)

**3. Der kritische Umbau ist Zustand und Lebenszyklus, nicht die Template-Syntax.**

Der heutige Code ruft `this.render()` direkt auf und verändert verschachtelte Objekte wie `this.s.sheet`. Bei `LitElement` liefert `render()` eine Vorlage; direktes Aufrufen aktualisiert das DOM nicht. Verschachtelte Mutationen lösen ebenfalls nicht automatisch ein Update aus. Das braucht eine explizite Übergangsregel:

```js
// Übergang: vorhandene imperative Aufrufer verwenden diese Methode.
neuZeichnen() { this.requestUpdate(); }

// Für neue Zustandsänderungen bevorzugt neue Objektreferenzen.
this.s = { ...this.s, sheet: neuerDialog };
```

`s` muss dabei als reaktiver Zustand deklariert sein. Bei späteren Kindkomponenten reicht ein Parent-Update nicht, wenn diese dieselbe unveränderte Objektreferenz erhalten. Datenladen aus Vorlagen auslagern: Heutige Getter verwenden `_holen()` mit asynchronen Nebenwirkungen. Definiere, welches Ereignis lädt, welche Antwort noch zur aktiven Baustelle gehört und wann gerendert wird. [Lit: reaktive Eigenschaften](https://lit.dev/docs/components/properties/)

Außerdem setzt das Mockup `hass` bereits **vor** dem Einhängen. DOM-Zugriffe müssen deshalb auf den passenden Lebenszyklus warten. `super.connectedCallback()`/`super.disconnectedCallback()` nicht vergessen. Externe Listener und Abos sauber entfernen und wiederherstellen; die anonymen `window`-Listener für `paste` und `location-changed` werden heute im gezeigten `disconnectedCallback()` nicht entfernt. [Panel-Lebenszyklus](https://github.com/herbertschrotter-blip/ha-baustelle/blob/main/custom_components/baustelle/frontend/baustelle-panel.js#L1485), [Lit-Lebenszyklus](https://lit.dev/docs/components/lifecycle/)

**4. happy-dom ist geeignet, aber als alleiniger Nachweis unzureichend.**

happy-dom unterstützt Custom Elements und Shadow DOM und eignet sich für DOM-Struktur, Ereignisse und API-Verträge. Es ersetzt keinen Browsernachweis für WebGL, SVG-Darstellung, Layout, tatsächliches Scrollen oder mobile Tastatur/Fokus. Im Node-Test WebGL bewusst auf den CSS-Rückfall setzen, Geometrie gezielt stubben; zusätzlich Browserprüfungen mit und ohne WebGL. [happy-dom](https://github.com/capricorn86/happy-dom)

Der heutige Test benutzt `eval`, HTML-Textsuche und direkte Aufrufe von `panel.klick()` mit erfundenem `closest()`. Damit bleiben Ereignisweiterleitung und Shadow-DOM-Grenzen ungetestet. Künftig die **gebaute Datei** nach Einrichtung der DOM-Umgebung laden, das Element einhängen, wirkliche DOM-Ereignisse auslösen und die gesendeten Befehle prüfen. `await panel.updateComplete` plus ausstehende Datenantworten und gegebenenfalls Kind-Updates abwarten; keine pauschale Übernahme der heutigen `ruhe(20)`-Schleifen. Das Parent-`updateComplete` wartet nicht automatisch auf alle Kinder. [Panel-Test](https://github.com/herbertschrotter-blip/ha-baustelle/blob/main/tests/panel/test_panel.js#L37), [Lit: updateComplete](https://lit.dev/docs/components/lifecycle/#updatecomplete)

Die vorhandenen Fachwerte-/CSV-Abgleiche und `BAUSTELLE_AUFRUFE` für den Integrationstest müssen erhalten bleiben. Neue Kernfälle: Tippen während Datenupdates, Cursor und Entwurf erhalten, ein Klick genau ein Schreibbefehl, Nicht-Admin einschließlich erlaubter Vor-Ort-Aktionen, Baustellenwechsel bei verspäteter Antwort, Entfernen/Wiedereinhängen ohne doppelte Abos. Neue Shadow Roots erfordern außerdem angepasste Selektoren, CSS und Ereignisse; `event.target.closest()` durchquert sie nicht.

**5. „Master-Mockup unverändert“ funktioniert so nicht zuverlässig.**

Der [Generator](https://github.com/herbertschrotter-blip/ha-baustelle/blob/main/mockups/quelle/glas.js) extrahiert die Version mit einem Regex auf `const SEITE_VERSION = '…'` und bettet das Bundle in ein klassisches `<script>` ein. esbuild kann Deklarationen und Anführungszeichen verändern. Bei einem echten ESM-Bundle muss das Mockup den Modulstart und die anschließende Initialisierung korrekt ordnen; die nachfolgenden klassischen Skripte dürfen nicht vor der Registrierung arbeiten.

Zusätzlich schreibt [tools/changelog.py](https://github.com/herbertschrotter-blip/ha-baustelle/blob/main/tools/changelog.py#L19) heute direkt in das künftig generierte Bundle. **Das ist ein Pflichtfix für Stufe 0.** Version aus einer gemeinsamen Quelle vor dem Build erzeugen oder injizieren; weder Mockup noch Tests sollen sie aus formatabhängigem Bundle-Text erraten. Den bestehenden Changelog-Prüflauf entsprechend anpassen.

Die feste Reihenfolge lautet: **Version/Changelog → Bundle → Mockup → Aktualitätsvergleich → Tests.** Der heutige Mockup-Test prüft nur, ob der Bundle-Text enthalten ist; ein veralteter Beispieldatensatz kann damit unbemerkt bleiben. Besser das vollständige Mockup temporär regenerieren und vergleichen. Sichtvergleich separat mit festen Daten, Uhrzeit und deaktivierten Animationen; neue Gestaltung weiterhin zuerst als abgenommene Variante.

**6. Eine JS-Datei mit eingebündeltem Lit passt – mit konkreten Build- und Betriebsregeln.**

- **Bundle:** `platform: 'browser'`, `format: 'esm'`, `bundle: true`, `splitting: false`; keine externen Lit-Imports, CDN-Abhängigkeiten oder nachgeladenen Chunks. Browser-Ziel nach dem ältesten unterstützten Handy bestimmen, nicht nach Node 22. Lizenzhinweise im Bundle erhalten. „≈ 20 KB“ ist ohne Minifizierung/Kompression keine belastbare Größenangabe: Rohgröße und Transfergröße messen. [esbuild](https://esbuild.github.io/api/)
- **Lit-Versionen:** Eigene eingebündelte Version ist sinnvoll; keine privaten HA-Imports. Innerhalb des eigenen Builds nur eine aufgelöste Lit-Abhängigkeitskette. Zwei Lit-Kopien sind nicht dasselbe Problem wie doppelt registrierte Elementnamen. Den vorhandenen `customElements.get()`-Schutz beibehalten; er ersetzt bei erneutem Import keine bereits registrierte alte Klasse. Neue Versionen durch vollständiges Neuladen aktivieren.
- **Caching:** [panel.py](https://github.com/herbertschrotter-blip/ha-baustelle/blob/main/custom_components/baustelle/panel.py#L240) verwendet bereits `?v={version}` und `cache_headers=False`; die URL wird bei HA-Start angemeldet. Die Seite besitzt außerdem Changelog-Prüfung und `neuLaden()`. Diese Mechanismen erhalten und „Auslieferung ohne HA-Neustart“, „mit freigegebenem Neustart“ sowie Rückkehr zur Vorversion getrennt prüfen. Ein Query-Parameter allein aktualisiert keinen offenen Tab.
- **Deployment:** [deploy.sh](https://github.com/herbertschrotter-blip/ha-baustelle/blob/main/tools/deploy.sh) kopiert derzeit sämtliche Dateien unter der Integration. Ausschlüsse gelten ab Stufe 0 für Kopieren **und Bereinigung** bereits ausgelieferter Werkzeuge. Vorab Dateiliste prüfen, JS atomar über temporäre Datei im Zielverzeichnis ersetzen. Bestehende Laufzeitdateien wie `changelog.json` weiterhin liefern; „eine Datei“ betrifft das JS-Bundle.
- **Offline:** Lockfile fixiert Versionen, stellt aber keine Pakete bereit. `npm ci` entfernt vorhandenes `node_modules`. Einen vollständigen Cache einschließlich esbuild-Paket für die tatsächliche Pi-Architektur vorhalten und Offline-Neuinstallation praktisch testen. Installation mit explizitem Frontend-Pfad; Build/Test danach ohne Netzwerk. Deployment und Rollback müssen mit fertig geprüftem Artefakt ohne npm funktionieren. [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/)

**7. Für die Freigabe fehlen messbare Kriterien und ein erprobter Rückweg.**

Mein Vorschlag für jede migrierte Einheit: Alle vier vorgeschriebenen Prüfläufe grün – Fachlogik, Integration, Panel und Notprogramm – plus Build-/Mockup-Aktualität. Im Browser bei Datenupdates bleiben derselbe Eingabeknoten, Entwurf, Auswahl und Scrollstand erhalten; unveränderte Diagramme und Himmel werden nicht neu angelegt. Wiederholtes Öffnen/Schließen erhöht weder aktive Listener noch Timer. Auf einem benannten älteren Handy Ladezeit, Reaktionszeit und Speicher vor/nach dem Pilot vergleichen; Schwellen vor Beginn festlegen. Lit reduziert nicht automatisch die Kosten von WebGL, Filtern und Glas-Effekten.

Dialoge brauchen Tastaturbedienung, verständliche Beschriftungen, Fokusführung und Rückkehr zum Auslöser; Diagramme eine zugängliche Textalternative, Animationen einen Modus für reduzierte Bewegung. Sichtbare Gestaltungsänderungen bleiben separat abnahmepflichtig.

Für jede Lieferung ein bekannt gutes, vollständig geprüftes Release samt Bundle/Version/Changelog verfügbar halten. Rückweg über `tools/deploy.sh` in einem Testziel proben, einschließlich Browser-Neuladen und Versionsanzeige. Keine automatischen HA-Neustarts. Während der Frontend-Migration den Backend-Vertrag stabil halten.

**Pflichtgrenze:** Fachlogik bleibt ausschließlich in Python unter `custom_components/baustelle/logik/` mit Tests. `daten.js` darf Werte für die Anzeige zuordnen und formatieren, aber keine Heizregeln, Kosten, Kennzahlen oder Firmenzuordnungen nachrechnen. Die heute dokumentierte Ausnahme einer Anschlussleistungs-Vorschau nicht stillschweigend erweitern; eure aktuelle strengere Vorgabe und diese Alt-Ausnahme ausdrücklich abgleichen.

✅ **Einigkeit:** esbuild, eingebündeltes Lit als Ziel, eine ausgelieferte JS-Datei, kleine unabhängig prüfbare Lieferungen, unveränderte Fachlogik/API und Master-Mockup aus der echten Seite.

⚠️ **Widerspruch:** Der aktuelle Plan unterschätzt Stufe 0 und den Wechsel des Lebenszyklus. happy-dom allein reicht nicht; `unsafeHTML` beseitigt kein Flackern innerhalb alter Ansichten. Notprogramm/Einstellungen sind kein geeigneter früher Gesamtpilot. Mockup und Versionswerkzeug können nicht unverändert bleiben.

❓ **Rückfragen an dich:** Welche reproduzierbaren Fokus-/Scrollfehler bleiben trotz der heutigen Schutzmaßnahmen? Trägst du DOM-Tests vor Lit und den Einstieg über einen dauerhaft gehaltenen Teilbereich mit? Welches älteste Handy beziehungsweise HA-WebView und welcher verfügbare Browser-Testplatz bilden die Abnahmebasis?
