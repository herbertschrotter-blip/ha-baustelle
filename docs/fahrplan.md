# Fahrplan BSM (Baustrommanager)

Alle offenen Punkte in einer Reihenfolge zum Abhaken: eigene Datenbank (`bauplan-datenbank.md`), Notprogramm in den
Shellys (`bauplan-0.7.md` §9) und die Schwachstellen aus der Bewertung vom 04.10.2026 (`bauplan-0.7.md` §7).
Stand 05.10.2026 (0.8.51). Jeder Schritt ist eine Aufgabe in ClickUp (Liste „BSM Baustrommanager“, Nummer in Klammern, Tag `etappe-a` … `etappe-h`); abgehakt wird hier und dort.

**Erledigt vorher:** Berechtigungen (0.8.49), GitHub-Prüfläufe grün (0.8.50), WU-0018/FE-0021/FE-0022 (Ticket-Fenster).

## Warum diese Reihenfolge

1. **Erst Schutz und kleine Fehler**, die heute schon schaden können (Passwort, Beta-Firmware, 50-kWh-Grenze).
2. **Dann die Datenbank bis Phase 4** – der Pilot merkt nichts, weil sie nur mitschreibt und abgleicht.
3. **Parallel die Hardware fürs Notprogramm** beschaffen und am Gerät erproben (wartet auf Lieferung).
4. **Datenbank umstellen** (Phasen 5–6), dann **Notprogramm bauen** – es braucht die Datenbank fürs Nachtragen.
5. **Code aufteilen**, solange alles frisch ist – danach nichts Großes mehr.
6. **Stabilisieren** mit dem fertigen Aufbau (ein kalter Monat nur Tickets), damit genau das geprüft wird, was die Firma
   bekommt.
7. **Firma:** zentrale Datenbank, Betriebsanleitung, zweite Person.

Abweichung von der Bewertung: Dort stand „erst stabilisieren, dann aufteilen“. Weil die Datenbank (Herberts
Entscheidung: jetzt, auf main) ohnehin viel ändert, wird erst alles Große gebaut und dann am Stück stabilisiert.

## Etappe A – Schutz und kleine Fehler

- [x] ~~**A1** (BSM-001) Shellys: Gerätepasswort~~ – **verworfen** 05.10.2026 (Herbert): Netz der Baustelle bleibt geschlossen; neu bewerten, wenn Fremde ins WLAN/VPN kommen
- [x] **A2** (BSM-002) Heizung 01: nächtliches Auto-Update auf Beta-Firmware abschalten; Firmware aller Plugs auf „stable“ (Herbert, Claude prüft) – erledigt 05.10.2026: Update-Zeitpläne auf Heizung 01 (beta), 03, 04 (stable) gelöscht; Pumpe 3 offen (ausgesteckt)
- [x] **A3** (BSM-003) Datenbank Phase 0: 50-kWh-Grenze bei Lücken richtig stellen (`logik/zaehlen.py`, Test) – erledigt 0.8.52 (89ce622)
- [x] **A4** (BSM-004) Beispieldaten Pumpen im Master-Mockup richtigstellen („203 h Laufzeit heute“, überladene Achse – `tests/panel/beispiel-hass.js`) – erledigt (35a8e80): Beispiel kannte die 5-Minuten-Statistik nicht
- [x] **A5** (BSM-005) Datenschutz klären: welche Benutzer- und Anwesenheitsdaten gespeichert werden (Betriebsrat § 96 ArbVG, DSGVO); Vorgabe für Datenbank Phase 2 (Herbert) – entschieden 05.10.2026: Benutzer nur bei Einstellungen (bis Baustellenende + 1 Jahr), vor Ort ohne Person (`bauplan-datenbank.md` §6)

## Etappe B – Datenbank Grundlage (Pilot merkt nichts)

- [x] **B1** (BSM-006) Phase 1: Grundgerüst `db/` (Schema 1, Verbindung, Migration, Schreiber), `backup.py`, Diagnose-Sensor – erledigt 0.8.53 (86909bc), eingespielt 05.10.2026
- [x] **B2** (BSM-007) Phase 2: Mitschreiben – Einstellungen mit Benutzer, Laufzeit, Ereignisse, Protokoll, Meldungen, Minutenwerte (`logik/minute.py`) – erledigt 0.8.54
- [x] **B3** (BSM-008) Phase 3: Altdaten übernehmen – Store, Verlauf 62 Tage, Langzeitstatistik davor – erledigt 0.8.55/0.8.56, eingespielt 05.10.2026 (Verlauf seit 29.09., 54 Meldungen, 1.000 Protokolleinträge)
- [x] **B4** (BSM-009) Phase 4: Tagessummen (`logik/tag.py`) und Abgleich mit den alten Zählern – erledigt 0.8.57

## Etappe C – Notprogramm vorbereiten (parallel, wartet auf Hardware)

- [ ] **C1** (BSM-010) Shelly BLU H&T beschaffen (je Container einer, zuerst einer zum Testen) und an die Plugs koppeln (Herbert)
- [ ] **C2** (BSM-011) Fühler in HA von FRITZ!Smart Control 440 auf BLU H&T umstellen (Einstellungen der Container)
- [ ] **C3** (BSM-012) Uhrzeit ohne Internet: Router der Baustelle als Zeitserver prüfen und in den Plugs eintragen
- [ ] **C4** (BSM-013) Notprogramm am Gerät erproben: Skript-Speicher, Felder der BTHome-Sensoren, Ereignis der Taste, KVS-Grenzen

## Etappe D – Datenbank umstellen

- [ ] **D1** (BSM-014) Phase 5: Lesen aus der Datenbank – Auswertung, Abrechnung, Bericht, CSV, Zähler-Sensoren; `baustelle/verlauf`, Seite ohne direkte HA-Abfragen; Entscheidung Recorder (Sensoren behalten)
- [ ] **D2** (BSM-015) Phase 6: Store ablösen – Einstellungen und Protokoll nur noch aus der Datenbank, Meldungen in der Datenbank

## Etappe E – Notprogramm bauen

- [ ] **E1** (BSM-016) Skript `notprogramm.js` fertig, mit Simulationstest in Node
- [ ] **E2** (BSM-017) Übertragung durch die Integration: Skript einrichten/aktualisieren, Programm (KVS) täglich und bei Änderung, Lebenszeichen alle 5 min (ohne Gerätepasswort)
- [ ] **E3** (BSM-018) Taste am Plug = 1 h heizen (mit HA über „Bei Bedarf“, ohne HA im Skript)
- [ ] **E4** (BSM-019) Anzeige: Notprogramm je Plug (aktiv/fehlt/Fehler, Programm gültig bis), Protokoll „Notbetrieb“
- [ ] **E5** (BSM-020) Datenbank Phase 7: Stundenbuch der Plugs nach einem Ausfall nachtragen
- [ ] **E6** (BSM-021) Ausfall-Probe auf der Pilotbaustelle: HA bzw. VPN abschalten, Notbetrieb und Nachtragen prüfen

## Etappe F – Code aufteilen

- [ ] **F1** (BSM-022) Seite in Module zerlegen (Himmel, Diagramme, je Ansicht) mit Bündler; Master-Mockup und Panel-Test mitziehen
- [ ] **F2** (BSM-023) `steuerung.py` und `funktionen/heizung.py` weiter zerlegen
- [ ] **F3** (BSM-024) Umstieg der Seite auf Lit-Komponenten planen (Bauplan, noch kein Bau)

## Etappe G – Stabilisieren

- [ ] **G1** (BSM-025) Pilotbetrieb mindestens einen kalten Monat mit dem fertigen Aufbau – nur Tickets, keine neuen Funktionen

## Etappe H – Betrieb in der Firma

- [ ] **H1** (BSM-026) Datenbank Phase 8: zentral PostgreSQL + TimescaleDB, Puffer bei Verbindungsverlust, Ansichten und Lesebenutzer für Excel/Power BI, mehrere Instanzen
- [ ] **H2** (BSM-027) Datenbank Phase 9 und Betriebsanleitung: einspielen, sichern, wiederherstellen, Störung; api-Doku auf die Datenbank
- [ ] **H3** (BSM-028) Zweite Person einarbeiten (Code, Abläufe, Tickets)
- [ ] **H4** (BSM-029) Präsentation für den Chef: Platzhalter füllen (Anzahl Heizkörper der Firma, zweite Baustelle)
