# Changelog

## [0.7.29] – 2026-09-30

- Verbrauch (FE-0003): Container zählten keine Leistung und keinen Verbrauch, wenn am Shelly mehrere passende
  Sensoren hängen – z. B. der eigene „Ø Leistung im Betrieb“ der Baustelle (seit 0.7.9 mit gleichem Namensanfang) oder
  „Energie“, „Energieverbrauch“ und „Energieeinspeisung“. Jetzt zählen eigene Sensoren und die Einspeisung nicht, bei
  mehreren gilt der Hauptsensor. Die Heizzeit war nicht betroffen.
- Neuer Reparatur-Hinweis, wenn ein Gerät weder Leistungs- noch Energiesensor hat.

## [0.7.28] – 2026-09-30

- Arbeitszeit (FE-0002): Die beim ersten Start **automatisch angelegte** Arbeitszeit wird durch die erste eigene
  ersetzt – auch wenn diese ein früheres Datum hat; eine schon gespeicherte eigene gilt nach dem Update sofort.
  Vorher gewann die automatische (ab dem Tag des ersten Starts) gegen eine eigene ab z. B. 09.02.2026.
- Jede Arbeitszeit lässt sich **bearbeiten** (ab, Name, Zeiten) und **löschen** – die letzte bleibt; „Bearbeiten oder
  löschen“ steht direkt unter der geltenden.

## [0.7.27] – 2026-09-30

- Baustelle wählen (AN-0002): ✎ öffnet **„Baustelle bearbeiten“** nur mit den Daten dieser Baustelle – Name, Beginn
  und Ende, Heizperiode, Ort (Wetter, Außentemperatur), Container und Geräte, Strompreis und Firmen, abschließen; der
  Rest bleibt unter Einstellungen. Unterdialoge kehren beim Schließen dorthin zurück.
- **Beginn und Ende automatisch:** Beginn leer = Tag, an dem die Baustelle angelegt wurde (auch in HA freiwillig);
  beim Abschließen wird immer der Tag des Abschließens als Ende eingetragen.
- Fehler behoben: Speichern einer aktiven Baustelle löschte das geplante Ende – die Hochrechnung bis zum Ende der
  Baustelle griff dadurch nie.

## [0.7.26] – 2026-09-30

- Das Repo ist öffentlich (MIT-Lizenz) und über HACS als benutzerdefiniertes Repository installierbar; Einstellungen ›
  Über nennt es so.

## [0.7.25] – 2026-09-30

- Umbau abgeschlossen (Schlussprüfung Bauplan Module): Die Hochrechnung der Heizperiode (bisher, mit, ohne, gespart)
  rechnet jetzt die Integration fertig in kWh und €; € und Anteil der Abrechnung stehen nur noch in der Fachlogik.
  Die Seite zeigt nur an – die Zahlen bleiben gleich.

## [0.7.24] – 2026-09-30

- Intern (Nachbesserung nach der Prüfung, Bauplan Module): Kosten „ohne (24/7)“, „€ je Grad kälter“ beim
  Wetter-Einfluss sowie kWh, € und Anteil je Container unter „Verbrauch je Monat“ auf der Detailseite einer Baustelle
  rechnet jetzt die Integration statt der Seite. Die Zahlen bleiben gleich.

## [0.7.23] – 2026-09-30

- Intern (Nachbesserung nach der Prüfung, Bauplan Module): Die Regel „alle Geräte offline“ steht jetzt bei den
  Warnungen statt bei den Pumpen, damit der Kern kein Pumpenmodul braucht. Die Seite rechnet die Grenze der
  Staffelung nicht mehr selbst nach, sondern zeigt nur die Werte der Integration; vor der ersten Rechnung nach dem
  Start fehlt der Strombalken kurz. Sonst ändert sich nichts.

## [0.7.22] – 2026-09-30

- Qualität nach der Skala von Home Assistant (Bauplan Module Phase 7), die Seite „Baustelle“ bleibt gleich:
  - Baustelle **umbenennen** über Einstellungen → Geräte & Dienste → Baustelle → „Neu konfigurieren“ (Entitäten
    behalten ihre IDs).
  - Geräte von Bereichen oder Shellys, die es nicht mehr gibt, räumt die Integration beim Start weg; nur solche
    verwaisten Geräte lassen sich in HA von Hand löschen.
  - Fällt ein Shelly aus, steht das einmal im Protokoll von HA, ebenso wenn er wieder antwortet.
  - „Erreichbar“ ist jetzt ein Diagnose-Sensor; Tageshöchstwert, Früh-Prognose und Regen sind bei neuen Baustellen
    zunächst ausgeschaltet (bestehende bleiben, wie sie sind).
  - Fehlermeldung der Aktion `baustelle.ticket` übersetzt; Hilfetexte beim Anlegen einer Baustelle.
  - Eigenes Symbol (`brand/`), Liste der erfüllten Regeln in `quality_scale.yaml`.

## [0.7.21] – 2026-09-30

- Intern (Qualität, Bauplan Module Phase 7): Die Integration ist jetzt vollständig und streng typisiert
  (`mypy --strict` ohne Fehler, Einstellungen in `pyproject.toml`). Antworten von Wetter- und Kalenderdiensten werden
  dabei vorsichtiger gelesen (eine unerwartete Antwort gilt als leer statt als Fehler). Sichtbar ändert sich nichts.

## [0.7.20] – 2026-09-30

- Intern (Umbau „Module je Funktion“, zweite Nachbesserung Phase 4): Heizplan, Heizgrenze, freie Tage, Termine der
  Bedarfs-Container, Frostschutz bei Automatik aus, Wetter-Einträge im Protokoll, „Tür offen“ und die Hochrechnung auf
  die Heizperiode gehören jetzt zur Funktion Heizung. Die Steuerung legt die Funktionen aus einer Liste an und fragt
  sie auch in der Staffelung (welche Geräte geschaltet werden, Leistung ohne Messung, Vorrang, Anzeige je Anschluss);
  eine neue Funktion braucht keine Änderung an der Steuerung mehr. Sichtbar ändert sich nichts.

## [0.7.19] – 2026-09-30

- Intern (Umbau „Module je Funktion“, Nachbesserung Phase 4): Handbetrieb, Energiezähler fürs Heizen, der Status der
  Baustelle und der Protokolltext „Modus: …“ kommen jetzt von der Funktion (Heizung bzw. Pumpen). Sichtbar ändert
  sich nichts. (Weitere Heizungsregeln lagen noch in der Steuerung – ausgelagert in 0.7.20.)

## [0.7.18] – 2026-09-30

- Umbau „Module je Funktion“, Phase 5: Die Integration nennt der Seite die eingeschalteten Funktionen der Baustelle
  (Heizung, Pumpen). Der Reiter Heizung erscheint nur, wenn die Baustelle die Funktion Heizung hat, der Reiter Pumpen
  nur mit der Funktion Pumpen und mindestens einem Pumpenschacht.

## [0.7.17] – 2026-09-30

- Intern (Umbau „Module je Funktion“, Phase 4): Heizung und Pumpen sind jetzt je ein eigenes Modul der Integration
  (`funktionen/heizung.py`, `funktionen/pumpen.py`) mit derselben Schnittstelle; die Steuerung ist nur noch der Kern
  (Wetter, Kalender, Staffelung, Schalten, Protokoll, Status) und ruft die Funktionen auf. Sichtbar ändert sich nichts.

## [0.7.16] – 2026-09-30

- Intern (Umbau „Module je Funktion“, Nachbesserung Phase 2/3): Die Regel „Firma je Tag“ und die Firmen-CSV gibt es
  nur noch einmal (Auswertung der Integration); die alte zweite Fassung ist entfernt. Welche Firma ein Container gerade
  hat, liefert jetzt die Integration mit der Struktur (`laufzeit.container[…].firma`), die Seite rechnet es nicht mehr
  selbst. Sichtbar seit 0.7.15: Verlauf und Detailseite zeigen beim Laden kurz „–“ bzw. „Lädt …“ statt sofort der
  Zählerwerte; nicht geladene Baustellen zeigen im Verlauf ihre Container aus der Einrichtung.

## [0.7.15] – 2026-09-30

- Intern (Umbau „Module je Funktion“, Phase 3): Die Seite rechnet nichts mehr selbst – Auswertung, Abrechnung nach
  Firma, CSV, Verlauf, Heiztage, Ölradiator/Konvektor, Wetter-Einfluss und Je Gerät kommen von der Integration. Seite,
  Bericht und CSV zeigen damit dieselben Zahlen. Wo die Seite bisher anders rechnete, gilt jetzt die Integration: der
  Verbrauch eines Tages gehört der Firma zu Tagesbeginn (auch bei „Tag“ und „Jahr“), Heiztage ohne Zähler zählen nur
  Tage, an denen ein Container geheizt hat.

## [0.7.14] – 2026-09-30

- Intern (Umbau „Module je Funktion“, Phase 2): Die Integration liefert die Auswertung und die Abrechnung nach Firma
  jetzt selbst an die Seite (neue Befehle, samt CSV). Bericht und CSV-Anhang nehmen dieselben Rechnungen – für denselben
  Zeitraum dieselben Zahlen wie auf der Seite. Im Bericht steht die eigene Firma zuerst, danach die Firmen in der
  Reihenfolge ihres ersten Verbrauchs (wie auf der Seite). Die Seite rechnet vorerst noch selbst.

## [0.7.13] – 2026-09-30

- Intern (Umbau „Module je Funktion“, Phase 1): Die Auswertung – Abrechnung nach Firma mit CSV, Heizperiode, Heiztage,
  Kennzahlen im Verlauf, Verbrauch je Monat, Ölradiator/Konvektor, Wetter-Einfluss, Je Gerät – gibt es jetzt als
  geprüfte Fachlogik in der Integration, damit Seite, Bericht und CSV bald dieselben Zahlen zeigen. Sichtbar ändert sich
  noch nichts; die Seite rechnet vorerst weiter selbst.

## [0.7.12] – 2026-09-30

- Fehler: Reiter Heizung – die Kacheln flackerten bei jedem Tipp und jeder Einstellung (die Einblend-Animation lief
  beim Neuzeichnen jedes Mal neu). Jetzt laufen sie nur beim Öffnen des Reiters ein; ein Test findet künftig jede
  Einblend-Animation ohne diese Sperre.

## [0.7.11] – 2026-09-30

- Reiter **Heizung übersichtlicher** (Herbert: „sehr unübersichtlich“; Mockup `heizung-varianten.html`, Variante A
  abgenommen): oben eine große Karte **Heute** (Status, Zeitstrahl, greifende Regeln als Chips), darunter **Kacheln**
  mit Kurzwert – Diese Woche, Wann heizt was, Container, Arbeitszeit, Ausnahmen, Regeln, Kleidung trocknen, Urlaub &
  Feiertage. Ein Tipp öffnet die Details von unten; die Inhalte sind die bisherigen.

## [0.7.10] – 2026-09-30

- Himmel (WU-0001): **Sonne wandert** tagesaktuell von Aufgang (links) bis Untergang (rechts) nach `sun.sun`, nachts der
  **Mond mit echter Mondphase** (aus dem Datum gerechnet); die Farben gleiten **stufenlos nach dem Sonnenstand** statt
  vier harter Stimmungen; die **Sonne ist deutlich gedämpft**, damit die Schrift auf den Kacheln lesbar bleibt.
  Mockup `glas.html` mit Datum, Uhrzeit und Zeitraffer in der Vorführ-Leiste.

## [0.7.9] – 2026-09-30

- Bericht: **Heiztage** zählen wie Seite und Integration – Tage, an denen ein Container geheizt hat (Heizzeit), nicht
  mehr jeder Tag mit Verbrauch; Pumpenschächte zählen nicht mehr mit.
- Geräte-Entitäten heißen mit dem Container vorne („Mannschaft · Radiator Ø Leistung …“) – gleich benannte Geräte in
  verschiedenen Containern sind in HA unterscheidbar (entity_ids bleiben).
- Heizung › Frostschutz: neuer Schalter **„auch bei Automatik aus“** (startet aus) – dann schaltet die Integration nur
  den Frostschutz, sonst nichts.
- Heizung › Kälte-Frühstart: Grenze „wenn morgens kälter als“ auf der Seite einstellbar, bis −15 °C.

## [0.7.8] – 2026-09-30

- Aus der Seite 0.6.3 zurück (Mockup `glas.html` abgenommen), Regelung: **Modus je Container** Zeitplan (Heizung in der
  Heizzeit an, der Thermostat am Heizkörper regelt) / Thermostat (auf das Soll nach dem Fühler) / Bei Bedarf / Hand /
  Aus (nur Frostschutz); **Frostschutz** mit eigenem Aus-Wert; **Urlaub und freie Feiertage** nur Frostschutz,
  absenken (mit Fühler) oder alles aus; Hochrechnung der Heizperiode nur bis zum geplanten Ende der Baustelle;
  Test-Nachricht an alle Empfänger.
- Seite: Reiter **Pumpen** (nur mit Pumpenschächten) mit Überwachung – offline nach … min, Trockenlauf unter … W,
  Dauerlauf, schaltet oft; **Modus** am Container und unter Heizung › Je Container; Frostschutz „ein unter“/„aus über“;
  Urlaub und freie Feiertage; Einstellungen › Baustelle **Beginn und Ende** und **Heizperiode**; Auswertung
  **Leistung heute** (kW), **Temperaturen** (alle Container und außen, heute/7/30 Tage), **Je Gerät** (Ø kW, Stunden,
  kWh, €), **Hochrechnung Heizperiode**; Container-Diagramm „Leistung“; **Test-Nachricht**; **Erklärungen** „ⓘ“,
  abschaltbar unter Einstellungen › App.

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
