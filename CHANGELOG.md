# Changelog

## [0.5.1] – 2026-09-29

- Seite: Diagramm-Farben fehlten (Balken schwarz, Legende ohne Farben) – Palette wieder drin, im Test geprüft.
- Seite am Handy: Tabellen scrollen in ihrer Karte statt über den Rand, Tabs kompakt (⚙ = Einstellungen),
  Zeitleiste zeigt den Gerätenamen.
- Nächste Schaltzeit auch über Mitternacht hinaus (nächster aktiver Tag laut Plan).

## [0.5.0] – 2026-09-29

- Stufe 6 vorgezogen – eigene Seite „Baustelle“ in der Seitenleiste (wie Alarmo/HACS), gebaut nach dem abgenommenen
  Entwurf: Übersicht, Heizung, Pumpen, Auswertung, Verlauf, Einstellungen; Baustellen-Umschalter; Animationen
  (Ölradiator/Konvektor, Trockner, Pumpe); Zeitleiste, Säulen- und Liniendiagramme mit Tooltips; Wochenplan mit
  Balken; Urlaub direkt im Urlaubskalender eintragen/löschen. Echte Daten über den WebSocket-Befehl
  `baustelle/struktur`, Verlauf über `history`/`recorder`, Bedienung über die normalen HA-Dienste.
- Anlegen/Zuordnen (Baustellen, Container, Shellys, Wetter, Kalender, Empfänger) weiter über die Dialoge der
  Integration – die Seite verlinkt direkt dorthin.
- Tests: Seite wird in Node mit nachgebildetem HA gerendert (alle Ansichten, gültige SVGs, Dienstaufrufe).

## [0.4.0] – 2026-09-29

- Stufe 5 – Dashboard: Generator `tools/dashboard.py` erzeugt das YAML-Dashboard aus den Diagnose-Downloads
  (Übersicht, Heizung, Pumpen, Auswertung je aktive Baustelle, Verlauf über alle Baustellen) – nur eingebaute
  Karten (tile mit Features, heading, entities, statistic, statistics-graph, history-graph, weather-forecast).
- Diagnose-Download je Baustelle (Einrichtung, Einstellungen, Zähler, Laufzeit, Entitäten; Empfänger geschwärzt).
- Reparatur-Hinweis, wenn eine eingestellte Entität länger als 10 Minuten fehlt.

## [0.3.0] – 2026-09-29

- Stufe 4 – Verbrauch und Kosten: Zähler je Baustelle und Container (Energie kWh, Kosten zum jeweiligen Preis),
  Heizzeit je Container, Pumpzeit und Pumpzyklen je Pumpe; Energie aus dem Zählerstand des Shelly (übersteht
  Neustarts) oder aus Leistung × Zeit. Gezählt wird nur, solange die Baustelle aktiv ist.
- „Ohne Automatik“: mittlere Leistung im Betrieb je Heizgerät, Zähler für 24-h-Dauerbetrieb, Ersparnis,
  Hochrechnung auf die Heizperiode (mit und ohne Automatik, Kosten).
- Vergleich Ölradiator/Konvektor: Energie, Heizzeit und mittlere Leistung je Typ.

## [0.2.1] – 2026-09-29

- Geräte über `via_device_id` verknüpft (statt veraltetem `via_device`, Warnung von HA 2026.9).
- „Zieht keinen Strom“ nur noch, wenn ein Heizkörper seit dem Einschalten 10 min nie geheizt hat;
  0 W durch den eigenen Thermostat des Heizkörpers ist kein Fehler mehr.

## [0.2.0] – 2026-09-29

- Umstellung auf eine eigene Integration `baustelle` (vorher Paket + YAML-Dashboard).
- Einrichtung: Baustelle mit Status aktiv/abgeschlossen, Optionen (Wetter, Wetterstation, Feiertags-/Urlaubskalender,
  Empfänger, Heizperiode); Container/Pumpenschächte und Shellys als Subentries, ein Shelly nur in einer aktiven Baustelle.
- Heizung: Automatik, Modus je Container, Zeitplan je Wochentag, Kälte-Frühstart, Kleidung trocknen nach Regen,
  Heizgrenze, Frostschutz mit Schaltabstand, Urlaub/Feiertag, Thermostat mit Toleranz; Handbedienung → Handbetrieb.
- Pumpen: läuft, offline, Trockenlauf, Dauerlauf, Baustelle nicht erreichbar; Meldungen und Test-Meldung.
- Fachlogik ohne HA-Code mit Tests; Integrationstests gegen HA 2026.9.4.

## [0.1.0] – 2026-09-29

- Gerüst angelegt: Paket `baustelle`, YAML-Dashboard „Baustelle“, Auslieferung `tools/deploy.sh`.
- Dashboard-Entwurf v4 abgenommen (`mockups/baustelle.html`).
