# ha-baustelle

Home-Assistant-Projekt für die Baustelle: ein Paket und ein YAML-Dashboard. Zweck, Aufbau und Auslieferung stehen in
`README.md`.

## Regeln

- **Quelle der Wahrheit ist dieses Repo.** In `/config` nur über `tools/deploy.sh` ausliefern, dort nie direkt ändern.
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
- none

### Commit
- Format: [vX.Y.Z] Modul, Typ: Kurztitel
- Module: Paket=ha/packages; Dashboard=ha/dashboards; Werkzeuge=tools; Doku=*.md
- Versionsquelle: changelog:CHANGELOG.md
- Versionsregel: MINOR nur für eine wirklich neue Funktion; Verbesserungen, Korrekturen und Umbauten sind PATCH; Commits nur an Doku oder Werkzeugen behalten die Nummer
- Push-Policy: user-only
- Pre-Commit-Checks: none
- Doku-Check: none

### Code
- Stacks: home-assistant
- Pflichtkontext: CLAUDE.md; README.md
- Aufgabenquelle: none
- Architekturregeln: ref:https://github.com/herbertschrotter-blip/claude-skills-bpm/blob/main/docs/ha-grundsatz/README.md#HA-Grundsatzregeln
- Tests: none
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
- Config: none

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
