# CGR-2026-10-06-seite-lit — Seite „Baustelle“ zerlegen und auf Lit umstellen

**Thema:** Bauplan `docs/bauplan-lit.md` (BSM-022, BSM-024): `frontend/baustelle-panel.js` (≈ 4.900 Zeilen, HTML als
Text + `innerHTML`) mit esbuild in Module zerlegen und auf Lit umstellen. Kernfrage: Lohnt Lit gegenüber reinem
Zerlegen, stimmen Stufen und Reihenfolge, was fehlt?
**Zeitraum:** 2026-10-06
**Branch:** main
**Modell:** GPT 6 Astra (mittel)
**Status:** Abgeschlossen (06.10.2026)

---

## Runden-Übersicht

### Runde 1 — Bauplan prüfen
- **Artefakte:** [r1/](./r1/)
- **Fokus:** Lit ja/nein, Stufen 0–5, Tests (happy-dom), Auslieferung als eine Datei, Risiko im laufenden Betrieb
- **Kernergebnis:** Lit als Ziel ja, aber korrigierter Weg (größere Stufe 0, DOM-Tests vor Lit, kleiner Lit-Pilot in gehaltenem Bereich, Lebenszyklus eigener Schritt, Browser-Tests, messbare Abnahme, Rückweg). Herbert: Browser-Tests lokal + GitHub, Abnahme S23 Ultra + PC; Stufenschnitt → Runde 2

### Runde 2 — Konkreter Stufenplan
- **Artefakte:** [r2/](./r2/)
- **Fokus:** abhakbarer Stufenplan, Entscheidungspunkt nach Lit-Pilot, Stufe 0a konkret, Offline-npm, Browser-Test-Werkzeug
- **Kernergebnis:** Stufenplan 0a–5 mit Grundprüfung und Rückweg je Lieferung; bis Lit-Pilot (2a) bauen, dann fünf
  Ja/Nein-Felder; Versionskette CHANGELOG → version.json → esbuild define; puppeteer-core gegen Chromium 136, B1–B7,
  Budget ≤ 120 s. Herbert: übernommen, Grenzen angenommen, PC-Browser Edge.

## Ergebnis

- Bauplan überarbeitet: [docs/bauplan-lit.md](../../bauplan-lit.md) (§8 Entscheidungen)
- BSM-024 geht in BSM-022 auf
