# Changelog

## [0.8.37] – 2026-10-01

- Neue Aktion „zuruecksetzen“ (Herbert 01.10.2026): alle Zähler (Verbrauch, Kosten, Heizzeit, Heiztage, Pumpzeit,
  ohne Automatik, Ø-Leistung, Auf-/Abkühlraten, fairer Vergleich) und alles Gelernte (lernende Regelung, Warm ab,
  Gefühl, Außenmittel, + / −) auf null; Einstellungen, Protokoll und die Langzeitstatistik von HA bleiben. Die
  Integration lädt danach neu.

## [0.8.36] – 2026-10-01

- Soll gleitend nach draußen und nach dem Gefühl (Herbert 01.10.2026): unter Heizung › Regeln wählbar „fest“ oder
  „gleitend“. Gleitend richtet sich das Soll nach dem Mittel der Außentemperatur der letzten Tage (wie EN 16798-1:
  nach kalten Tagen wärmer, weil Wände und Körper ausgekühlt sind) zwischen „mindestens“ und „höchstens“ – mit
  Rechnung „Soll heute“ und Kurve. Im Container gibt es unter dem Rad „zu kalt / passt / zu warm“; + / − verschiebt
  das Soll bis morgen früh und zählt als Gefühl, „↺ gleitend“ setzt zurück. Das Gefühl lernt für die ganze Baustelle
  (je Rückmeldung 0,15 °C bei ähnlichem Wetter, höchstens ±1,5 °C). Ein eigenes Soll im Container gilt dann als
  Verschiebung. Hinweis, wenn „mindestens“ unter 21 °C liegt (§ 36 BauV).

## [0.8.35] – 2026-10-01

- Staffelung nach Bedarf in °C (Herbert 01.10.2026): nach den festen Stufen (Frostschutz, Schnell aufheizen, erster im
  Container, Priorität) entscheidet, wie weit ein Container in 15 min unter dem Soll wäre – jetzt unter dem Soll, plus
  Abkühlen ohne Heizen (gemessen, wenn er aus ist, sonst die gelernte Abkühlrate – die Trägheit des Containers), minus
  Nachlauf des Ölradiators, plus was bis Arbeitsbeginn bzw. „Soll erreicht … vorher“ mit der gelernten Aufheizrate
  fehlt, plus ein Zuschlag für wenig Heizzeit in der letzten Stunde. Der Rundlauf tauscht jeden Takt den obersten
  Wartenden gegen den untersten Laufenden.
- Überlast: abgeworfen wird erst, wenn ein Anschluss länger als 30 s zu voll ist (kurze Spitzen, z. B. ein Thermostat,
  der kurz anspringt), dann der unterste der Rangliste – bei gleichem Rang der größere Verbraucher.
- Stromverteilung mit Rangliste: je Heizkörper die Stufen, der Bedarf in °C und zum Antippen, woraus er entsteht.

## [0.8.34] – 2026-10-01

- Staffelung: einer je Container zuerst (AN-0013). Einschalten darf zuerst ein Container, in dem noch kein Heizkörper
  läuft (nach Frostschutz und Schnell aufheizen); ein zweiter Heizkörper im selben Container verdrängt im Rundlauf nie
  den einzigen eines anderen Containers, und bei Überlast oder Tausch geht zuerst ein Zweitgerät aus. So bleibt in
  jedem Container nach Möglichkeit immer einer an.

## [0.8.33] – 2026-10-01

- Staffelung nach gemessenem Verbrauch (FE-0011): ein eingeschalteter Heizkörper, dessen Thermostat gerade
  abgeschaltet hat, zählt mit dem, was er zieht – nicht mehr vorsichtig mit seiner vollen Leistung. So dürfen mehr
  Heizkörper gleichzeitig laufen; springt einer wieder an und der Anschluss wird zu voll, geht sofort der zuletzt
  eingeschaltete aus, danach wechseln sie im Rundlauf. Wer dazukommen will, zählt mit voller Leistung, ein eben
  eingeschalteter die ersten 2 min ebenso. Die Stromverteilung zeigt je Heizkörper die gemessenen kW bzw. „zieht gerade
  nichts (Thermostat)“.

## [0.8.32] – 2026-10-01

- Heizung springt nach einem Neustart gleich an (WU-0015): nach dem Start von Home Assistant zeigt „zuletzt
  geändert“ der Shellys den Start, nicht das echte Ausschalten – die Staffelung ließ deshalb auch Heizkörper, die
  seit Stunden aus waren, erst die Mindestpause (5 min) abwarten. Jetzt gilt die Mindestpause nur nach eigenem
  Schalten.

## [0.8.31] – 2026-10-01

- Heizung › Regeln (AN-0012) nach Tagesablauf gruppiert: Vor der Arbeit · In der Arbeitszeit · Nach der Arbeit ·
  Nachts, frei, Urlaub · Immer. Nichts mehr versteckt: neu einstellbar sind der Schaltabstand um das Soll (bisher
  0,3 °C ohne Regler), „heizt tatsächlich ab“ (bisher fest 50 W – gilt für Heizzeit geheizt, Heiztage, Warm ab,
  Lernen und „Wann heizt was“), „Handbetrieb übernehmen nach“ (bisher fest 30 min) und „Fühler ohne Wert“ (bisher
  fest 15 min). Die Staffelung steht kurz mit Link zu Einstellungen › Strom, die übrigen festen Schwellen unter
  „Feste Regeln“ mit Erklärung.

## [0.8.30] – 2026-10-01

- Kachel-Katalog (WU-0014): „＋ Kachel“ öffnet einen Katalog mit jeder Auswertung der Seite – Suche mit Filter-Chips
  (Baustelle, Container, Pumpen, Heizung, Auswertung, „je Container“, „€“), Schnellknöpfe S/M/L und Vorschau. Kacheln
  gibt es in S (Zahl), M (Zahl, Vergleich, Mini-Verlauf) und L (Diagramm oder vier Kennzahlen). Neu „Meine Kacheln“ auf
  der Übersicht; in der Auswertung kommen die Kacheln ins Raster der Bausteine (ein Raster, Bausteine auch im Katalog,
  Vorlagen unter „Vorlage laden“). Antippen öffnet die passende Ansicht; Anpassen mit Ziehen, Größe, 📈 Diagramm ein/aus
  und ✕. Gemerkt je Browser. In der Auswertung folgen die Kacheln dem gewählten Zeitraum.

## [0.8.29] – 2026-10-01

- Heizzeit zweifach (AN-0011): neben der eingeschalteten Zeit zählt die Integration, wie lange ein Container
  tatsächlich geheizt hat (Heizkörper zieht über 50 W Strom; ohne Leistungsmessung wie eingeschaltet), neuer Sensor
  „Heizzeit geheizt“ je Container. Die Seite zeigt „h eingeschaltet“, „h tatsächlich geheizt“ und „% davon mit Strom“.
- Heiztage zählen nur noch Tage, an denen ein Heizkörper tatsächlich Strom gezogen hat (Zähler, Verlauf, Bericht);
  Tage vor 0.8.29 bleiben nach der eingeschalteten Zeit gezählt. Die Prognose der Heizperiode rechnet weiter mit den
  gemessenen kWh, die Rangliste „kWh je Heizstunde“ weiter mit der eingeschalteten Zeit.

## [0.8.28] – 2026-10-01

- Leistung im Container: kein Flackern mehr beim Ziehen des Stundenreglers – der ganze Tag wird einmal geladen und
  jede Stunde nur noch daraus ausgeschnitten; Abblenden nur noch beim ersten Laden eines Tages.

## [0.8.27] – 2026-10-01

- Leistung im Container (AN-0010): beim Ziehen des Stundenreglers laufen Diagramm und Zahlen gleich mit (kurz
  entprellt), nicht erst beim Loslassen; bis die Stunde geladen ist, bleibt das vorige Diagramm abgeblendet stehen.

## [0.8.26] – 2026-10-01

- Gerät schaltet sich selbst wieder ein (FE-0010): muss die Automatik ein Gerät in 10 min mindestens 3-mal
  ausschalten (z. B. „Auto ON“-Timer am Shelly), gibt es eine Störung „… schaltet sich selbst wieder ein“ – einmal
  aufs Handy mit Hinweis auf den Timer – statt jede Minute „… aus“ im Protokoll. Abschaltbar unter Meldungen.

## [0.8.25] – 2026-10-01

- Geräteübersicht (AN-0009): Statuspunkt je Gerät – grün erreichbar, rot „nicht erreichbar seit …“ (angemeldet, aber
  nicht gefunden, z. B. Stecker gezogen) – und Signalbalken mit vier Strichen aus dem Signalstärke-Sensor am Gerät
  (WLAN-Stufen ab −55/−67/−75/−85 dBm, Wert im Tooltip).

## [0.8.24] – 2026-10-01

- Ölradiator oder Konvektor – fair verglichen (AN-0008): gezählt werden nur Zeiten, in denen ein Container mit Fühler
  im Modus Thermostat geregelt wird, und nur Container mit einem Typ (gemischte zählen nicht); Kennzahl ist kWh je
  Gradstunde (Strom je Stunde und °C innen über außen) statt kWh je Heizstunde; die Auswertung zeigt, welche Container
  zählen und warum andere nicht. Neue Zähler ab dieser Version.
- Dazu, was die Ölradiatoren gegenüber Konvektoren gespart haben: tatsächlicher Verbrauch der Ölradiatoren gegen
  „mit Konvektoren“ (gleicher Verbrauch mal Faktor aus dem Vergleich) als Diagramm und Kennzahlen.

## [0.8.23] – 2026-10-01

- Ohne Automatik je Container (WU-0013): in der Verbrauchs-Einblendung des Containers Kennzahlen „kWh ohne
  Automatik“, „gespart“ und „% weniger“ für den gewählten Zeitraum und eine gestrichelte Linie im Diagramm; Basis
  wählbar: Ø-Leistung je Gerät (gemessen) oder je Typ (Ø aller Ölradiatoren bzw. Konvektoren). Gerechnet von der
  Integration (neuer Befehl `baustelle/ohne`, 24/7 ab Beginn der Baustelle bis jetzt).
- Erklärung, woher „ohne Automatik“ und das Gesparte kommen (AN-0007), in der Auswertung und im Container.
- Einblendungen drücken nichts mehr zusammen (die Chip-Reihe unter „stapeln nach“ war bei viel Inhalt verdeckt).

## [0.8.22] – 2026-10-01

- Leistung im Container (WU-0012, Nachtrag): der Streifen des Stundenreglers ist nur in Stunden mit Verbrauch farbig
  (HA-Statistik je Stunde), Stunden ohne Verbrauch und künftige Stunden sind grau.

## [0.8.21] – 2026-10-01

- Leistung im Container (WU-0012): Regler und Nachladen tauschen nur noch die Daten darunter (Kennzahlen, Diagramm),
  die Seite wird nicht mehr ganz neu gezeichnet; beim Laden einer anderen Stunde bleibt das bisherige Diagramm
  abgeblendet stehen, nichts springt.

## [0.8.20] – 2026-10-01

- Leistung im Container (WU-0011): Umschalter „Stunde | Tag“; für die Stunde ein Schieberegler über die volle Breite
  (0–23 Uhr, rastet je Stunde ein, lädt beim Loslassen, heute nur bis zur aktuellen Stunde) statt der Stunden-Knöpfe;
  „Tag“ zeigt jeden Messwert von 0 bis 24 Uhr.

## [0.8.19] – 2026-10-01

- Geräteübersicht (WU-0010): Einstellungen › Geräte zeigt alle eingebundenen Geräte nach Funktion – Schaltgeräte,
  Temperaturfühler, Türkontakte, Wetter und Regen – mit Ort, Zustand, Modell und Batterie; ein Klick öffnet die
  Website des Geräts (z. B. Shelly-Oberfläche), ohne Website die Geräteseite in Home Assistant.

## [0.8.18] – 2026-10-01

Letzte Entscheidungen aus den Szenarien:

- „1 h stumm“ (und andere stumme Warnungen): ist das Problem nach Ablauf noch da, kommt die Nachricht noch einmal.
- Ausnahme „frei“ (z. B. Brückentag) wird wie Urlaub/Feiertag behandelt: es gilt „Im Urlaub und an freien Feiertagen“
  (nur Frostschutz, absenken oder alles aus).
- Heizgrenze mit Basis Tageshöchstwert: der gemessene Höchstwert des Tages gilt bis Mitternacht, auch ohne Vorhersage.

## [0.8.17] – 2026-10-01

Weitere Entscheidungen aus den Szenarien:

- Lernen: von Hand geschaltete Heizkörper lernen nichts; das Ende von „Schnell aufheizen“ lernt kein K innen.
- Handbetrieb: im Modus Hand keine Erinnerung „seit 8 h auf Hand“; die Kachel zeigt „heizt · Hand“ auch ohne Fühler.
- 0 W: „an · zieht keinen Strom“ und die Warnungen „zieht keinen Strom“/„zu kalt“ nur, wenn der Container selbst auf
  das Soll regelt (Thermostat, Bei Bedarf); im Zeitplan und ohne Fühler „an · Thermostat regelt“.
- Staffelung: Pumpen ohne Leistungssensor zählen mit 0,8 kW; jedes Gerät ohne Messung kann in „Gerät bearbeiten“
  eine eigene Leistung bekommen; ein Heizkörper, der beim Heizen offline geht, zählt weiter mit, bis er zurück ist.
- „Trotzdem heizen“ übersteht einen Neustart; lernende Regelung ohne Fühler wird abgelehnt; die Frühstart-Nachricht
  nennt den frühesten Beginn aller Container mit Heizkörpern (auch gelernte).

## [0.8.16] – 2026-10-01

Entscheidungen zu den Fragen aus den Szenarien:

- Fühler kurz weg (Funkaussetzer, HA-Neustart): 15 min gilt der letzte Wert, danach wie ohne Fühler (in der Heizzeit
  an, der Heizkörperthermostat regelt) – ein warmer Container geht nicht mehr gleich an.
- Frostschutz auch für Container ohne Fühler: nach der Außentemperatur (ein unter −3 °C, aus ab −1 °C; einstellbar
  unter Heizung › Regeln › Frostschutz).
- Tür offen, wenn ohnehin nicht geheizt wird (nachts, Modus aus, bei Bedarf bereit, Automatik aus): Sicherheitshinweis
  „Tür offen“ statt „Heizung pausiert“, ohne Knopf „Trotzdem heizen“; die Kachel zeigt „… · 🚪 Tür offen“. Läuft ein
  Heizkörper (auch von Hand), pausiert die Tür wie bisher, bis sie zu ist.
- Außenfühler weg: Temperatur der Wetter-Entität, sonst der letzte Wert bis 6 h – die Heizgrenze gilt weiter.

## [0.8.15] – 2026-10-01

Korrekturen aus dem Durchspielen aller Szenarien (191 neue Szenario-Tests, `tests/integration/test_szenario_*.py`):

- Staffelung: beim Tausch erst aus-, dann einschalten (kein kurzes Überlasten mehr, kein „beide aus“); Befehle, die
  noch unterwegs sind, zählen schon (ein Tausch schaltet nicht mehr zwei aus); nie Tausch gegen einen Heizkörper
  desselben Containers (Zusatz verdrängt nicht den eigenen Hauptheizkörper).
- Lernende Regelung: im Modus Zeitplan wird nichts gelernt und kein Anteil angezeigt; „Lernstand zurücksetzen“
  vergisst auch den festgehaltenen Beginn von heute; „einer reicht“ (gelernt) bleibt im Vorheizen bei einem Heizkörper.
- Zusatz-Heizkörper misst beim Absenken und beim Frostschutz gegen das richtige Ziel (Absenk- bzw. Frost-Grenze).
- Ausnahme „Arbeit“ an einem freien Feiertag wird auch geheizt (Regel einmal in `logik/arbeitszeit.frei_gilt`).
- Status „heizt bis …“ rechnet Kleidung trocknen nur, wenn ein Container trocknet.
- Frostschutz im Modus Hand schaltet nach dem Frost wieder aus.
- Tür: heizt der Frostschutz trotz offener Tür, heißt es nicht mehr „Heizung pausiert“; nach „Trotzdem heizen“ steht
  nicht mehr „Tür zu“ im Protokoll.

## [0.8.14] – 2026-10-01

- Tür offen schützt die lernende Regelung (WU-0009): wird der Raum beim Heizen kälter, obwohl es draußen kaum kälter
  wird (0,3 °C in 10 min), ist die Tür vermutlich offen – laufende Messungen (Aufheizen, Nachlauf, K außen) werden
  verworfen und 10 min danach nichts gelernt; ein offener Türkontakt wirkt ebenso. Hinweis im Container, im
  Lernstand und im Protokoll; die Heizung läuft weiter.

## [0.8.13] – 2026-10-01

- Zusatz-Heizkörper nur bei Bedarf (AN-0006): in Containern mit zwei oder mehr Heizkörpern heizt zuerst einer; der
  Zusatz kommt dazu bei Schnell aufheizen, außergewöhnlicher Kälte, weit unter dem Soll, wenn einer es nicht schafft
  (läuft lange und es wird kaum wärmer) oder wenn die gelernte Aufheizzeit mit einem nicht bis „Soll erreicht“ reicht.
  Einschalten je Container unter Bearbeiten, welcher Zusatz ist im Gerät, Schwellen unter Heizung › Regeln; die
  Geräte zeigen „Haupt“ bzw. „Zusatz – wartet/an“, das Protokoll nennt den Grund.
- Lernende Regelung: Aufheizen wird je Anzahl laufender Heizkörper gelernt.

## [0.8.12] – 2026-10-01

- Container-Ansicht (FE-0009): jede Kachel öffnet ihr eigenes Diagramm – ⚡ kW jetzt die Leistung, 🔋 kWh den
  Verbrauch, € die Kosten, ⏱ die Heizzeit (Pumpenschacht: Pumpzeit) je Stunde, Tag oder Monat mit Zeitraumwahl.
- Leistung einer Stunde (AN-0005): jeder Messwert des Shellys aus dem HA-Verlauf, je Gerät und als Summe, mit kW im
  Mittel und Spitze; Stunde wählbar (Standard: die aktuelle), Tag mit ‹ › und Kalender, Zeiger zeigt Uhrzeit und Watt.

## [0.8.11] – 2026-10-01

- „Warm ab“ für lernende Container (AN-0004, Mockup warm-ab.html abgenommen): jeder Container mit lernender Regelung
  lernt, wie schnell er aufheizt (°C je Stunde, getrennt für kalt und mild draußen), und beginnt selbst so früh, dass
  das Soll rechtzeitig erreicht ist – statt Vorheizen, Kälte-Frühstart und Nachheizen. Einstellbar unter Heizung ›
  Regeln: „Soll erreicht“ (min vor Arbeitsbeginn), „Warm halten“ (min nach Arbeitsende), „Frühestens“ (Grenze); je
  Container ein eigener Wert unter Bearbeiten. Früher nach Regen und Kleidung trocknen kommen weiter dazu. Bis 3
  Aufheizungen gemessen sind, gelten die bisherigen Regeln.
- Anzeige: Heizung › Heute nennt je lernendem Container den Beginn („heizt ab 05:30, damit um 06:45 20 °C“), der
  Container-Kopf ebenso, der Lernstand zeigt „Aufheizen“.

## [0.8.10] – 2026-10-01

- Heizung › Heute (AN-0003): unter der Arbeitszeit steht, wie sich die Heizzeit zusammensetzt, z. B. „Heizt
  05:30–17:30 = 60 min früher (Kälte + Regen gestern) + 30 min Vorheizen + Arbeit 07:00–16:30 + 15 min Nachheizen +
  45 min Kleidung trocknen“ – die Verlängerungen zählen zusammen (so bleibt es); die Erklärung unter „So wird
  geheizt“ sagt das auch.

## [0.8.9] – 2026-10-01

- Neuer Container (WU-0008): die Heizungsart wird erst abgefragt, wenn gleich ein Shelly gewählt ist („Welche Heizung
  hängt an diesem Shelly?“); ohne Shelly nur der Hinweis, dass Heizungen später unter „Bearbeiten“ dazukommen.

## [0.8.8] – 2026-10-01

- Einstellungen neu (WU-0007, Mockup einstellungen-varianten.html Variante 1 abgenommen): alle Einstellungen an einer
  Stelle in Gruppen – Baustelle (mit Wetter und Kalendern), Heizung, Container & Geräte, Pumpen, Strom & Staffelung,
  Firmen, Meldungen, Bericht, Ansicht, Entwicklung (Untermenü Meldungen/Werkzeuge) und Über; links eine Seitenleiste
  mit Kurzinfo je Gruppe, auf dem Handy Chips oben.
- Neu einstellbar: Schwellen „zu kalt trotz Heizung nach“ und „Handbetrieb länger als“, Regenmenge, Feiertags- und
  Termine-Kalender direkt aus den Einstellungen, Automatik je Pumpenschacht, Auswertung auf Vorschlag zurücksetzen.

## [0.8.7] – 2026-10-01

- Früheren Zeitraum wählen (FE-0008, Mockup glas.html Variante 4 abgenommen): in der Auswertung, in der
  Verbrauch-Einblendung und in den Diagrammen der Container- und Pumpenansicht blättern ‹ › einen Tag, eine Woche, einen
  Monat oder ein Jahr zurück; Tippen auf die Bezeichnung öffnet einen Kalender, der mit dem Zeitraum skaliert (Tag →
  Monatsblatt, Woche → Monatsblatt mit KW, Monat → Jahresblatt, Jahr → Jahre seit Beginn). Zurück bis zum Beginn der
  Baustelle, „Aktuell“ springt zurück. Kennzahlen, Vergleich, Rangliste und Abrechnung kommen für den gewählten
  Zeitraum von der Integration.
- Integration: `versatz` bis 4000 (Tage weit zurück).

## [0.8.6] – 2026-10-01

- Heizung › „Wann welche Heizung heizt“ (FE-0007): Container ohne Heizkörper erscheinen jetzt auch, mit dem Hinweis
  „noch kein Heizkörper“ und einem Knopf, der den Container zum Zuordnen öffnet (Tag- und Wochenansicht).

## [0.8.5] – 2026-10-01

- Verlauf neu (WU-0006, Mockup glas.html abgenommen): Reiter **Baustellen** – Summe über alle und je Baustelle eine
  Karte mit Mini-Verlauf der letzten 12 Monate, kWh, Kosten, kWh je Heiztag und gespart; Umschalter **Vergleich** als
  sortierbare Tabelle mit 12-Monats-Diagramm. Reiter **Protokoll** – Chronik nach Tagen mit Tagessumme (kWh, €),
  Filter und Suche.
- Integration: Verlauf liefert zusätzlich kWh je Tag (`je_tag`).

## [0.8.4] – 2026-10-01

- Auswertung (FE-0006): **Größenstufen je Baustein** (S/M/L/XL) – nur Größen, die zum Inhalt passen; Ziehen rastet auf
  die nächste Stufe ein, „Anpassen“ wählt die Stufe. Der Inhalt passt sich an (z. B. Rangliste klein = Top 3, Wetter
  klein = nur die Zahl).
- **Neues Verbrauchsdiagramm für Kacheln**: füllt die Kachel, gestapelt je Container/Baustelle oder Firma, kompakte
  Achsen, Legende in einer Zeile, ohne eigene Zeitraum-Leiste.
- Wetter nachts: die Erkennung „Nacht“ kommt jetzt auch mit Auf-/Untergang über Mitternacht zurecht.

## [0.8.3] – 2026-09-30

- Auswertung neu (WU-0005, Mockup glas.html abgenommen): **aus Bausteinen selbst zusammenstellen** – Vorlagen
  „Kacheln“, „Kosten im Fokus“, „Wer verbraucht was“, „Verlauf mit Erkenntnissen“ und „Mischform“ (Vorschlag);
  unter „✎ Anpassen“ Bausteine ein/aus, Reihenfolge und Größe; unter „✥ Layout“ Kacheln per Drag and Drop verschieben
  und die Größe im Raster ziehen. Gemerkt je Browser.
- Neu: **Rangliste der Container** (kWh, €, Heizzeit, kWh je Heizstunde) und **„Was fällt auf“** – beides rechnet
  die Integration (`logik/auswertung`), die Seite zeigt nur an.

## [0.8.2] – 2026-09-30

- Neue Container-Ansicht (WU-0004, Mockup glas.html abgenommen): Kopf mit Modus, Schnell aufheizen und
  **Thermostat-Rad** (Ist groß, Soll mit − +; Soll nur im Modus Thermostat oder Bei Bedarf mit Fühler), Kacheln kW,
  kWh, Kosten und Heizzeit, **Tagesdiagramm** mit Heizzeit, Innen-/Außentemperatur, Soll-Linie und geheizten
  Stunden (Reiter Woche und Heizzeit), Geräte als Chips mit **Ein/Aus**, Schalter **aktiv** und ✎.
- **Gerät bearbeiten**: Name, Shelly, Typ, Container, Leistungs- und Energiesensor (leer = automatisch), aktiv –
  vorher nur Name und Typ.
- **Gerät inaktiv**: die Automatik schaltet es einmal aus und dann nicht mehr, es zählt nicht in der Staffelung und
  meldet nichts (z. B. Heizkörper ausgeliehen oder defekt).

## [0.8.1] – 2026-09-30

- Wetter nachts (FE-0005): Open-Meteo meldet nachts „sonnig“ bzw. „heiter“ – die Seite zeigt jetzt wie die
  Wetterkarten von HA nachts „Klar“ mit Mond bzw. Mond mit Wolke; auch in der stündlichen Vorhersage und im
  Tagesverlauf für Stunden nach Sonnenuntergang und vor Sonnenaufgang.

## [0.8.0] – 2026-09-30

- Neu: **Lernende Regelung** je Container mit Fühler (Schalter startet aus; Modus Thermostat, Bei Bedarf, Absenken).
  Statt „an bis Soll, dann aus“ regelt die Integration nach dem bewährten TPI-Verfahren (wie Versatile Thermostat):
  je 10-min-Zyklus ein Einschaltanteil aus Innen-, Soll- und Außentemperatur. Sie lernt selbst, wie weit der Raum
  nach dem Ausschalten nachheizt – je Heizkörperart (mit Ölradiator / nur Konvektor), Heizdauer davor und
  Außentemperatur – und schaltet entsprechend früher ab; dazu lernt sie K innen (Trägheit) und K außen (Wärmeverlust).
  Einblendung „Lernstand“ am Container mit Nachlauf-Tabelle, Lernfortschritt, Treffgenauigkeit und Zurücksetzen.

## [0.7.31] – 2026-09-30

- Handbetrieb (FE-0004): Ein per Hand geschalteter Heizkörper blieb bis zum nächsten Schaltpunkt auf Hand – nach
  einem Start außerhalb der Heizzeit bis zum nächsten Morgen, auch weit über dem Soll. Jetzt übernimmt die Automatik
  auch, wenn der Fühler das Soll erreicht, bei Frostschutz oder offener Tür, sofort bei einer geänderten Einstellung
  (Soll, Modus, Automatik – auch über den HA-Schalter) und nach „Handbetrieb länger als … h“ plus 30 min ohne Antwort
  („So lassen“ hält die Hand).
- Container zeigt „heizt · Hand“, wenn ein Heizkörper per Hand heizt (vorher „heizt · Arbeitszeit“).

## [0.7.30] – 2026-09-30

- Diagramme und „kWh heute“ sind aktuell (WU-0002): HA schreibt eine Stunde erst nach ihrem Ende in die
  Stundenstatistik – die laufende Stunde kommt jetzt aus der 5-Minuten-Statistik plus dem Zählerstand bis jetzt; vorher
  fehlte alles seit der letzten vollen Stunde (bis zu gut einer Stunde).
- Container-Ansicht: neue Sensorwerte tauschen nur Diagramm und Kennzahlen (höchstens alle 10 s), ein offener
  Tooltip oder eine Einblendung bleibt.

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
