# Changelog

## [0.7.8] – 2026-09-30

- Aus der Seite 0.6.3 zurück (Mockup `glas.html` abgenommen), Regelung: **Modus je Container** Zeitplan (Heizung in der
  Heizzeit an, der Thermostat am Heizkörper regelt) / Thermostat (auf das Soll nach dem Fühler) / Bei Bedarf / Hand /
  Aus (nur Frostschutz); **Frostschutz** mit eigenem Aus-Wert; **Urlaub und freie Feiertage** nur Frostschutz,
  absenken (mit Fühler) oder alles aus; Hochrechnung der Heizperiode nur bis zum geplanten Ende der Baustelle;
  Test-Nachricht an alle Empfänger.

## [0.7.7] – 2026-09-30

- Seite: **Hinweis auf neue Version**. Ist in HA eine neuere Version geladen (nach einem Neustart) oder eine neuere
  eingespielt (ohne Neustart), steht oben „Neue Version … – bitte neu laden“ mit Knopf „Neu laden“; der Knopf holt die
  Seite am Browser-Speicher vorbei (Strg+F5 ist nicht mehr nötig). `tools/changelog.py` setzt die Version der Seite.

## [0.7.6] – 2026-09-30

- Anregung AN-0001 („Wie kann ich Baustellen bearbeiten oder löschen?“): Im Fenster „Baustelle wählen“ hat jede
  Baustelle jetzt **✎ Bearbeiten** (laufende → Einstellungen › Baustelle, abgeschlossene → Detailseite mit „wieder aktiv
  setzen“) und **✕ Löschen** mit Sicherheitsabfrage; Löschen entfernt die Baustelle wie in HA unter Geräte & Dienste.

## [0.7.5] – 2026-09-30

- Tickets: Knopf „An Claude übergeben“ entfernt (öffnete eine nicht vorhandene Terminal-Adresse). Die Integration sammelt
  die Tickets nur; Herbert lässt sie in Claude Code mit „Tickets prüfen“ abarbeiten, Claude setzt sie bei Erfolg auf
  erledigt. `tools/ticket.py` verlangt dafür Version, Commit und Notiz.

## [0.7.4] – 2026-09-30

- Meldungen werden **Tickets**: Nummer je Art (FE Fehler, WU Wunsch, AN Anregung, ab 0001), Status neu → angenommen →
  in Arbeit → gelöst → geschlossen oder verworfen, mit Verlauf und Notizen; ältere Meldungen werden beim Start nummeriert.
- Neuer Dienst `baustelle.ticket` (Status, Notiz, Version, Commit) und `tools/ticket.py` für die Bearbeitung in Claude Code.
- Seite › Entwicklung: Ticketnummer und Status, „An Claude übergeben“ (kopiert `ticket FE-0001`, öffnet das Claude Terminal),
  „Schließen“/„wieder öffnen“; nach dem Melden steht die Ticketnummer im Hinweis.
- `tools/tickets-fenster.sh`: eigenes Fenster „baustelle“ im Claude Terminal mit Claude Code im Projekt.

## [0.7.3] – 2026-09-30

- Fehler (Meldung m_9a9e95cb): Container zeigte „heizt“ mit Glühen und Flammen, obwohl der Heizkörper keinen Strom zog.
  „heizt“, „Kleidung trocknen“, „Frostschutz“ und „schnell aufheizen“ gelten jetzt nur bei echtem Verbrauch (über 50 W,
  ohne Leistungssensor zählt der Schalter); sonst „aus“ mit „an · zieht keinen Strom“.

## [0.7.2] – 2026-09-30

- Meldungen aus dem Melden-Knopf zusätzlich lesbar unter `<config>/baustelle/meldungen.md` und `meldungen.json`
  (beim Start und nach jeder Änderung neu geschrieben) und neue Meldungen im HA-Logbuch – so lassen sie sich ohne
  Zugriff auf den Speicher der Integration lesen und beheben.

## [0.7.1] – 2026-09-30

- Seite, Container › Bearbeiten: Gerätezeile war nicht geschlossen – „+ Gerät hinzufügen“, Hinweis und Knöpfe standen
  nebeneinander über der Liste. Test prüft jetzt in jeder Ansicht und Einblendung, dass alle Blöcke geschlossen sind.
- Seite: Melden-Knopf sitzt in einer Einblendung oben rechts in der Einblendung, statt schwebend über deren Kopf.

## [0.7.0] – 2026-09-30

- Neue Seite im Glas-Stil nach dem abgenommenen Mockup (`mockups/glas.html`): Himmel nach Tageszeit und Wetter (WebGL,
  Tropfen auf Glas, Wolken, Nebel, Schnee, Sonne, Nacht, Gewitter), Container-Kacheln glühen beim Heizen, Handy und Desktop.
- Heizung nach **Arbeitszeiten mit Startdatum** (frühere bleiben gespeichert), Vor- und Nachheizen, Kleidung trocknen extra,
  Kälte-Frühstart, Einmal-Ausnahmen (Samstag arbeiten, heute länger, frei), „alle jetzt heizen“; mit Fühler auf Soll,
  ohne Fühler bleibt die Heizung an und der Heizkörperthermostat regelt. Heizplan der Woche und Übersicht „Wann welche
  Heizung heizt“ nach gemessener Leistung.
- **Staffelung** je Stromanschluss (Absicherung, Reserve, nutzbarer Anteil): geschaltet werden nur Heizkörper, Mindestlauf
  und -pause, Rundlauf, Vorrang je Container, Heizkörper gehen nacheinander an.
- Container **nur bei Bedarf** (z. B. Besprechung) mit Schalter auf der Kachel und Terminen aus einem Kalender, auch als
  Serie; **schnell aufheizen**; **Türkontakt** pausiert die Heizung.
- **Firmen** je Container und **Abrechnung** nach Firma (CSV); Auswertung auch über alle laufenden Baustellen; Vergleich
  der Baustellen, letzte 12 Monate, Ansicht abgeschlossener Baustellen.
- **Warnungen** mit Störungen und Hinweisen (u. a. zu kalt, Frostgefahr, Fühler, kein Wetter, Handbetrieb, Tür, Pumpe
  schaltet oft), stummschaltbar; dauerhaftes **Protokoll** (auch im HA-Logbuch); **Handy-Nachrichten mit Knöpfen**;
  **Wochen-/Monatsbericht** per Handy und E-Mail.
- Einstellungen nur noch auf der Seite: die Einstellungs-Entitäten (Zeitplan je Wochentag, Regeln, Modus) entfallen,
  Automatik-Schalter und Sensoren bleiben. Einstellungen starten neu, **Zähler bleiben erhalten**.
- Einstellungen › Über (Version, Verlauf) und Melden-Knopf in jedem Fenster mit Entwicklermenü.

## [0.6.3] – 2026-09-29

- Seite, Übersicht neu (Herberts Wahl): Baustellen-Kachel (Container, Pumpenschächte, Geräte, Leistung, heute) mit
  Chips für Heizung, nächste Schaltzeit, Wetter (klappt die Wetterkarte auf) und Warnungen; darunter je Container
  bzw. Pumpenschacht eine Kachel mit gezeichnetem 3D-Baucontainer bzw. Schacht, der den Zustand zeigt (heizt,
  Kleidung trocknen, aus, Frostschutz, nicht erreichbar; Pumpe läuft), Temperatur, Leistung, Gerätezahl.
- Klick auf eine Kachel öffnet die Container-Ansicht: Geräte mit Schaltern, Einstellungen, Zeitleiste, Leistung und
  Temperatur heute, Energie/Heizzeit (bzw. Pumpzeit/Zyklen) je Tag.
- Nebel-Symbol im Dunkelmodus heller.

## [0.6.2] – 2026-09-29

- Seite: realistische animierte Wettersymbole (Herberts Wahl aus drei Varianten): Sonne mit Glut und Strahlen,
  flauschige Wolken, Regenschlieren, drehende Schneekristalle, leuchtender Blitz, wabernder Nebel, Mond mit Kratern.

## [0.6.1] – 2026-09-29

- Fehler: Eigene Sensoren der Integration ließen sich als Wetterstation wählen (Kreis – „Außen“ blieb stehen,
  „Regen“ leer). Sie werden jetzt aus den Optionen entfernt und nicht mehr angeboten (Seite und HA-Dialog).
- Fehler: Nach dem HA-Start kam die Vorhersage erst nach 30 min (Wetter lädt nach uns) – jetzt sofort, sobald die
  Wetter-Entität da ist.
- Seite: neue Wetterkarte mit eigenen animierten Wettersymbolen (Sonne, Wolken, Regen, Schnee, Gewitter, Nebel,
  Nacht, Wind), 4 Tage mit „Heute/Morgen“, Frost-Tiefstwerte blau, Regen nur wenn welcher fällt.

## [0.6.0] – 2026-09-29

- Seite, Einstellungen: Baustellen anlegen, Status/Optionen ändern, Container/Pumpenschächte und Shellys anlegen,
  ändern und entfernen, Wetter, Kalender und Empfänger wählen – direkt auf der Seite, über dieselben
  Einrichtungs-Dialoge wie in HA (REST `config_entries/…/flow`, Prüfungen der Integration gelten weiter).
- Seite: Wettervorhersage 3 Tage (`weather/subscribe_forecast`), „Kleidung trocknen“ schraffiert in der Zeitleiste,
  Temperatur-Tagesmittel (7/30 Tage, Heizperiode), Pumpzyklen je Tag, Ereignisse je Baustelle aus dem Logbuch.
- Vergleich Ölradiator/Konvektor: Aufheiz- und Abkühlrate (°C/h) und kWh je Tag und Grad innen/außen –
  gemessen je Container mit Fühler.

## [0.5.1] – 2026-09-29

- Seite: Diagramm-Farben fehlten (Balken schwarz, Legende ohne Farben) – Palette wieder drin, im Test geprüft.
- Seite am Handy: Tabellen scrollen in ihrer Karte statt über den Rand, Tabs kompakt (⚙ = Einstellungen),
  Zeitleiste zeigt den Gerätenamen.
- Nächste Schaltzeit auch über Mitternacht hinaus (nächster aktiver Tag laut Plan).
- Aufgeräumt: altes YAML-Dashboard samt Generator und leeres Paket aus 0.1.0 entfernt; die Seite ersetzt sie.

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
