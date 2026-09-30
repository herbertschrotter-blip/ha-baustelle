# ha-baustelle

Eigene Home-Assistant-Integration `baustelle`: Heizung in Baustellencontainern und Pumpenüberwachung mit Shellys, mit
eigener Seite „Baustelle“ in der Seitenleiste. Zweck, Aufbau und Auslieferung stehen in `README.md`; die abgenommene Planung ist
`mockups/baustelle.html` (Abnahme in `mockups/README.md`).

## Regeln

- **Quelle der Wahrheit ist dieses Repo.** In `/config` nur über `tools/deploy.sh` ausliefern, dort nie direkt ändern.
  `custom_components/**` in `/config` ist für Claude gesperrt: Das Einspielen führt Herbert aus
  (`! /config/projekte/ha-baustelle/tools/deploy.sh`), danach Neustart durch Herbert.
- **Bewährte Lösungen statt Eigenbau** (Herbert, 29.09.2026): Aufbau nach `integration_blueprint` und den Kern-Helfern
  (Vorbild `bayesian`: Subentries, Update-Listener mit Reload); eingebaute Integrationen nutzen, wo es sie gibt
  (Feiertage/`holiday`, lokaler Kalender, `weather.get_forecasts`, `notify.mobile_app_*`, später `history_stats`).
- **Fachlogik frei von HA-Code** in `custom_components/baustelle/logik/`; Änderungen dort immer mit Test in `tests/logik/`.
- **Jede Fachregel genau einmal, nur in `logik/`** (mit Test). **Die Seite rechnet nichts Fachliches**: Zahlen, Firmen,
  Heiztage, Auswertung und CSV kommen von der Integration (`baustelle/struktur`, `baustelle/auswertung`,
  `baustelle/abrechnung`); die Seite zeigt nur an (Bauplan `docs/bauplan-module.md`).
- **Neue Funktion = neues Modul in `funktionen/`** nach der Schnittstelle in `funktionen/basis.py`, eingetragen in
  `funktionen.FUNKTIONEN`; `steuerung.py` (Kern) kennt keine Heizungs- oder Pumpen-Einzelheiten und bleibt dabei
  unverändert. Anleitung: `docs/funktion-anlegen.md`.
- **Die Staffelung bleibt im Kern** (alle Funktionen teilen sich die Stromanschlüsse); eine Funktion liefert nur
  `schaltbar`, `standard_kw`, `staffel_vorrang`, `staffel_feld`.
- **Die Automatik startet ausgeschaltet.** Die Integration schaltet Shellys nur, wenn Herbert sie einschaltet.
- **Neustart nur durch Herbert** oder nach seiner ausdrücklichen Bestätigung, vorher die Konfiguration prüfen.
- **Geräte steuern** (Shellys, Verbraucher auf der Baustelle) nur auf Auftrag.
- **Keine Geheimnisse:** Zugangsdaten nur als `!secret <schlüssel>`; keine Koordinaten, Gerätekennungen oder Tokens im
  Repo.
- Vor Änderungen an Automationen, Skripten, Helfern oder Dashboards die Best-Practices des Home-Assistant-MCP-Servers
  lesen (`skill://home-assistant-best-practices/SKILL.md`).
- Entitäten über `entity_id` ansprechen, nicht über `device_id`.

## Skill-Profil

- Profil-Version: 1
- Projekt-ID: ha-baustelle
- Repo: herbertschrotter-blip/ha-baustelle
- Branch-Policy: current

### Checks
- logik: python3 -m pytest -q -p no:cacheprovider tests/logik [custom_components/baustelle/logik/**; tests/logik/**]
- integration: uv run --no-project --python 3.14 --index-strategy unsafe-best-match --with pytest-homeassistant-custom-component --with home-assistant-frontend==20260826.7 python -m pytest -q -p no:cacheprovider tests/integration [custom_components/**; tests/integration/**]
- panel: node --check custom_components/baustelle/frontend/baustelle-panel.js; node tests/panel/test_panel.js custom_components/baustelle/frontend/baustelle-panel.js tests/panel/struktur-0.7.json [custom_components/baustelle/frontend/**; tests/panel/**]

### Commit
- Format: [vX.Y.Z] Modul, Typ: Kurztitel
- Module: Integration=custom_components/**; Tests=tests/**; Werkzeuge=tools/**, .github/**; Doku=*.md, mockups/**
- Versionsquelle: changelog:CHANGELOG.md
- Versionsregel: MINOR nur für eine wirklich neue Funktion, die es vorher nicht gab; Verbesserungen, Korrekturen und Umbauten (auch neue Gestaltung bestehender Seiten, z. B. neue Übersicht) sind PATCH – im Zweifel PATCH; Commits nur an Doku, Tests oder Werkzeugen behalten die Nummer; `custom_components/baustelle/manifest.json#version` zieht mit (Herbert, 29.09.2026)
- Push-Policy: user-only
- Pre-Commit-Checks: logik; integration; panel
- Doku-Check: none

### Code
- Stacks: python; home-assistant-yaml
- Pflichtkontext: CLAUDE.md; README.md; mockups/README.md
- Aufgabenquelle: none
- Architekturregeln: ref:https://github.com/herbertschrotter-blip/claude-skills-bpm/blob/main/docs/ha-grundsatz/README.md#HA-Grundsatzregeln
- Tests: logik; integration; panel
- Auslieferung: ref:README.md#Auslieferung
- Mockup-Policy: none
- Befund-Ort: none

### Doku
- Router: none
- Standard: none
- Pflichtdokumente: none
- Validierungsregeln: none
- Sitzungsabschluss: none
- Entscheidungs-Ort: none

### Tracker
- Provider: none
- Config: none

### Ticket
- Config: ref:CLAUDE.md#Ticket-Profil

### Mockup
- Ablage: mockups
- Designquelle: HA-Standard-Theme und eingebaute Karten (kein eigenes Theme; im Mockup als CSS-Variablen nachgebildet)
- Ansichten: Desktop; 390 px
- Abnahme-Ort: mockups/README.md

### Review
- Config: none

### Modul
- Manifest: none
- Grundsatzregeln: ref:https://github.com/herbertschrotter-blip/claude-skills-bpm/blob/main/docs/ha-grundsatz/README.md#HA-Grundsatzregeln

## Ticket-Profil

Tickets = Meldungen aus dem Melden-Knopf der Seite (Herbert, 30.09.2026). Die Integration sammelt sie nur und legt sie
lesbar ab (`/config/baustelle/meldungen.json`, `meldungen.md`). Abgearbeitet wird in Claude Code im Projekt (eigenes
Fenster: tmux-Sitzung „Baustelle-Dashboard“, Fenster „Tickets“: `tools/tickets-fenster.sh`): Herbert startet mit „Tickets prüfen“, Claude holt die offenen
Tickets und bearbeitet sie einzeln nach dem Skill `ticket`. **Bei Erfolg** (behoben, Tests grün, eingespielt) setzt
Claude das Ticket auf `geschlossen` – mit Version, Commit und kurzer Notiz; Herbert kann es auf der Seite wieder öffnen.

- Präfix: `FE-NNNN` Fehler, `WU-NNNN` Wunsch, `AN-NNNN` Anregung (je Art ab 0001 aufsteigend)
- Befehle: `python3 tools/ticket.py liste [alle]` · `zeige <nr>` · `status <nr> <status> [--version X --commit Y --notiz T]` ·
  `notiz <nr> "<text>"` · `verwerfen <nr> "<grund>"` (liest `/config/baustelle/meldungen.json`, ändert nur über den
  Dienst `baustelle.ticket`)
- Status: `neu → angenommen → in_arbeit → geloest → geschlossen`, daneben `verworfen`
- Pflichtangaben: geschlossen → Version + Commit + Notiz (was behoben wurde) · verworfen → Grund
- Aufgaben: kein Tracker – Befund und Plan als Notiz am Ticket
- Beweise nachlesen: `zeige <nr>` (Fenster, Stand der Seite), HA-Logbuch und Protokoll der Baustelle, Diagnose
- Regeln: `docs/bauplan-0.7.md`, Mockup `mockups/glas.html`
- Doku: CHANGELOG.md-Eintrag nennt die Ticketnummer
