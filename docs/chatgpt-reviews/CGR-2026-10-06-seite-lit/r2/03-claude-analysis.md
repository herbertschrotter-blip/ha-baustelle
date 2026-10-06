# Runde 2 – Einschätzung Claude (06.10.2026)

## Gesamturteil

Der Plan ist umsetzbar und für Herbert abhakbar. Ich übernehme ihn so, mit kleinen Ergänzungen. Kern: **bis
einschließlich Lit-Pilot (2a) bauen, dann mit fünf Ja/Nein-Feldern entscheiden**; Build, Tests und Zerlegung lohnen sich
auch bei einem Nein.

## Fakten nachgereicht (Rückfragen)

- Pi: **Chromium 136.0.7103.113** (Alpine), **Node v22.23.2**, **npm 10.9.1**, `linux/arm64`.
- Headless-Start geprüft: `chromium --headless=new --no-sandbox --disable-gpu --dump-dom` liefert das DOM – der Browser
  läuft ohne Bildschirm (Sandbox muss im Container aus sein).
- PC-Browser: von Herbert zu nennen.

## Zustimmung

- Stufenplan 0a → 5 mit Grundprüfung je Lieferung, Rückweg R, Inventarliste vor 3a.
- Versionskette: CHANGELOG.md → `tools/changelog.py` erzeugt `changelog.json`, neu `version.json`, setzt manifest; esbuild
  `define: { __BAUSTELLE_VERSION__ }`; kein Werkzeug schreibt mehr ins Bundle.
- ESM-Bundle, Mockup mit Modul-Startreihenfolge (`whenDefined`), `--pruefen` mit `write: false`, Positivliste in
  `deploy.sh` für `frontend/` mit Bereinigung.
- Offline-npm: einmal mit eigenem Cache, Offline-Probe in temporärem Ordner, Erfolgsvermerk mit Lockfile-Hash.
- `puppeteer-core` gegen das vorhandene Chromium, B1–B7 als Bestandsaufnahme, Budget 60–90 s, höchstens 120 s.

## Ergänzungen

- Puppeteer-Version so wählen, dass sie zu Chromium 136 passt (Puppeteer listet die zugehörige Chrome-Version); auf
  GitHub dieselbe Major-Version von Chromium/Chrome.
- Die Prüfläufe im Skill-Profil wachsen um „seite-gebaut“ (changelog/bauen/mockup `--pruefen`) und „browser“.

## Offene Entscheidungen für Herbert

1. Stufenplan so übernehmen (bis Pilot bauen, dann entscheiden)?
2. Pilot-Grenzen (fünf Ja/Nein-Felder) und Browser-Budget 120 s annehmen?
3. Welcher PC-Browser (Chrome, Edge, Firefox)?
