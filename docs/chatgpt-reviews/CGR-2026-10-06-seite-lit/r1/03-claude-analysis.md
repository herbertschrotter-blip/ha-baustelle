# Runde 1 – Einschätzung Claude (06.10.2026)

## Gesamturteil

ChatGPT hat den echten Code gelesen und trifft die Schwachstellen des Plans. Ich stimme in fast allen Punkten zu.
Kernaussage: **Lit lohnt sich als Ziel, aber nur über einen korrigierten Weg** – größere Stufe 0, Tests vor dem Umbau,
Lit zuerst in einem kleinen, dauerhaft gehaltenen Teilbereich, der Lebenszyklus als eigener Schritt.

## Nachgeprüft

- `tools/changelog.py` schreibt `SEITE_VERSION` per Regex in `baustelle-panel.js` (Zeile 21/42) – mit Bündler ist das
  die erzeugte Datei → **Pflichtfix in Stufe 0** (Version als eigene Quelle, beim Bauen eingesetzt). Stimmt.
- `window`-Listener für `paste` (Zeile 1521) und `location-changed` (1527) sind anonym und werden in
  `disconnectedCallback()` (1499) nicht entfernt. Stimmt – kleiner Fehler auch ohne Lit.
- Auf dem Pi ist **Chromium vorhanden** (`/usr/bin/chromium`). Der geforderte Browser-Test geht also lokal (z. B.
  `puppeteer-core` gegen das vorhandene Chromium, Mockup-Seite laden) und zusätzlich auf GitHub.

## Zustimmung

1. Neuer Schnitt: **0a** Build + Versionsquelle + Mockup + deploy-Ausschlüsse, **0b** DOM-Test (happy-dom) gegen die
   heutige Seite, **1** mechanisch zerlegen in mehreren Lieferungen, **2a** Lit-Pilot über `render(template, container)`
   in einem gehaltenen Bereich (Über, dann Melde-Dialog), **2b** äußere Klasse auf LitElement, **3/4** je Ansicht.
2. Pro Teilbaum ein Renderer und ein Ereignisweg (kein Doppelklick über `@click` und `data-act`).
3. Übergangsregel `neuZeichnen()` → `requestUpdate()`, neue Objektreferenzen statt verschachtelter Mutation.
4. Messbare Abnahme je Einheit (Fokus/Entwurf/Scroll erhalten, keine wachsenden Listener/Timer), erprobter Rückweg.
5. `dev`, `bsdetail`, Leer-/Fehleransichten in die Reihenfolge; Notprogramm/Einstellungen nicht als frühen Pilot.

## Abweichend / Ergänzung

- **Offline-npm:** berechtigt; ich schlage vor, den npm-Cache einmal zu füllen und `npm ci --offline` zu prüfen; die
  gebaute Datei bleibt im Repo, damit Einspielen und Rückweg ohne npm gehen (wie ChatGPT fordert).
- **Altes Handy / Leistung:** bisher bekannt ist Herberts Samsung S23 Ultra (HA-App). Ob Poliere/Mitarbeiter ältere
  Geräte nutzen, muss Herbert sagen.
- **Anschlussleistungs-Vorschau** (Alt-Ausnahme in bauplan-module §5): im neuen Plan ausdrücklich nennen, nicht erweitern.

## Offene Entscheidungen für Herbert

1. Neuen Stufenschnitt übernehmen?
2. Browser-Test: lokal mit Chromium + auf GitHub, oder nur happy-dom?
3. Abnahme-Geräte: nur S23 Ultra oder auch ältere Handys auf der Baustelle?
