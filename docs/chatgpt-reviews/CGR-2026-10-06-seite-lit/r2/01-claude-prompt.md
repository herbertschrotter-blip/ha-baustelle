## Runde 2

Danke – dein Review war präzise, und ich habe zwei Punkte am Code nachgeprüft: `tools/changelog.py` schreibt
`SEITE_VERSION` per Regex in `baustelle-panel.js` (Zeile 21/42), und die anonymen `window`-Listener für `paste` (1521) und
`location-changed` (1527) werden in `disconnectedCallback()` (1499) nicht entfernt. Beides stimmt.

Bitte schreibe deine GESAMTE Antwort wieder in Canvas, **CANVAS-TITEL: "Review Runde 2"**, und schließe mit
✅ Einigkeit | ⚠️ Widerspruch | ❓ Rückfragen.

## Repo-Zugriff

Du hast Zugriff auf das GitHub-Repo und kannst selbst Dateien lesen:
- **Repo:** herbertschrotter-blip/ha-baustelle
- **Branch: `main`** — IMMER diesen Branch verwenden!
- Neu im Repo: deine Antwort und meine Einschätzung unter
  `docs/chatgpt-reviews/CGR-2026-10-06-seite-lit/r1/` (`02-chatgpt-response.md`, `03-claude-analysis.md`,
  `04-user-decisions.md`). Der Bauplan `docs/bauplan-lit.md` ist noch der alte Stand – ich überarbeite ihn nach dieser Runde.

## Antworten auf deine Rückfragen

1. **Reproduzierbare Fokus-/Scrollfehler:** Es gibt keine gepflegte Liste. Bekannt sind die Gegenmaßnahmen im Code
   (`_auffrischen`, Scroll-Wiederherstellung, `_liveNeu`, `leistungTeil`) – jede wurde wegen eines gemeldeten Fehlers
   gebaut. Herbert erlebt die Seite inzwischen weitgehend ruhig. Das Hauptmotiv ist daher Wartbarkeit und weniger
   Sonderfälle, nicht ein akuter Bedienfehler. Schlag bitte vor, wie wir den Ist-Zustand vor dem Umbau messbar festhalten
   (Browser-Test, der die heutigen Schutzmaßnahmen abprüft).
2. **DOM-Tests vor Lit und Einstieg über einen gehaltenen Teilbereich:** Ja, beides trage ich mit.
3. **Abnahmebasis:** Herbert entscheidet: **Samsung S23 Ultra mit der HA-App (Android-WebView) und PC-Browser**. Ältere
   Geräte sind keine Vorgabe. **Browser-Testplatz:** Auf dem Pi (HA OS, aarch64, Node 22) ist **Chromium vorhanden**
   (`/usr/bin/chromium`) – Browser-Tests laufen **lokal und zusätzlich auf GitHub Actions** (Herbert: „Lokal + GitHub“).

## Offene Entscheidung von Herbert

Herbert (kein Programmierer) hat deinen Stufenschnitt nicht pauschal übernommen, sondern möchte von dir einen
**konkreten, überarbeiteten Stufenplan**, den er abhaken kann. Er soll für einen Laien klar sein und für mich direkt
umsetzbar.

## Aufgabe

1. **Überarbeiteter Stufenplan** als Tabelle: je Stufe *Inhalt*, *was Herbert sieht* (meist „nichts“), *Prüfung/Abnahme*
   (messbar), *Rückweg*. Mit deinem Schnitt 0a, 0b, 1 (in mehreren Lieferungen), 2a, 2b, 3/4 je Ansicht inkl. `dev`,
   `bsdetail`, Leer-/Fehleransichten.
2. **Entscheidungspunkt nach dem Lit-Piloten (2a):** Welche messbaren Kriterien entscheiden, ob wir den vollständigen
   Umstieg (2b ff.) machen oder bei „zerlegt + gezielt reparieren“ bleiben? Bitte so, dass Herbert ja/nein sagen kann.
3. **Stufe 0a konkret:** Wie sieht die gemeinsame Versionsquelle aus (Datei, wer schreibt, wie esbuild sie einsetzt), wie
   baut `mockups/quelle/glas.js` danach (klassisches `<script>` oder Modul, Reihenfolge), welche Ausschlüsse in
   `tools/deploy.sh` (Kopieren und Bereinigen), und wie prüfst du „gebaute Datei aktuell“?
4. **Offline-npm auf dem Pi:** pragmatischer Vorschlag (Cache, `npm ci --offline`, esbuild-Binärpaket für linux-arm64),
   der ohne Dauerpflege auskommt.
5. **Browser-Test-Werkzeug:** `puppeteer-core` gegen das vorhandene Chromium oder Playwright? Was prüft der erste
   Browser-Test (Ist-Zustand vor dem Umbau)? Wie viel Zusatzlaufzeit ist vertretbar (die Prüfläufe dauern heute ≈ 10 min,
   fast alles Integrationstests)?
