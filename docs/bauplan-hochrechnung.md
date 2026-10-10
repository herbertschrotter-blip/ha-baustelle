# Bauplan Hochrechnung und Ersparnis

Die Hochrechnung der Heizperiode ist heute der Tagesschnitt seit Zählbeginn × Tage der Heizperiode. Gemessen im milden
Oktober unterschätzt sie den Winter. „Ohne Automatik“ ist 24 h Volllast aller Heizkörper, also viel zu hoch, und die
Ersparnis wirkt dadurch zu groß. Ziel (Herbert 07.10.2026): nach professionellem Vorgehen rechnen. Dazu gehören eine
Energiesignatur je Container (ASHRAE Guideline 14), eine Hochrechnung mit Heizgradtagen als Spanne (ÖNORM B 8135,
Klimamittel GeoSphere Austria) und die Ersparnis aus einer gemessenen Baseline (IPMVP Option B).

Stand: .01 fertig (0.8.123), .02 fertig (0.8.124), .03 fertig (0.8.125, 10.10.2026). Aufgabe BSM-033, Unteraufgaben .01–.04 = Stufen in §2.

## 1. Grundsätze

- Jede Fachregel nur in `logik/` mit Test; die Seite zeigt nur an (CLAUDE.md).
- Die einfache Gerade `logik/auswertung.wetter_einfluss` (kWh = k · außen + d0, „Wetter-Einfluss“ auf der Seite) ist
  eine Vorstufe der Signatur. Mit der Anzeige (.02/.03) ersetzt die Signatur sie, damit die Regel nicht zweimal da ist.
- Nichts schaltet von selbst: Baseline-Läufe (.04) starten aus, wie die Automatik.

## 2. Stufen (je eigene Lieferung)

| Stufe | Inhalt | Stand |
|---|---|---|
| .01 | Energiesignatur je Container: `logik/signatur.py` | ☑ 0.8.123 |
| .02 | Hochrechnung mit Heizgradtagen und Spanne, Witterungsbereinigung; Daten aus `tag_bereich` an die Signatur | ☑ 0.8.124 |
| .03 | Anzeige: Karte „Heizperiode“ (Mockup `hochrechnung.html`, abgenommen 10.10.2026) | ☑ 0.8.125 |
| .04 | Automatische Baseline-Läufe (startet aus, Kostenrahmen, Ankündigung, Abbruch) | ☐ |

## 3. Energiesignatur (.01)

Modell mit Heizgrenze („3P-Heizen“): **kWh am Tag = Grundlast + kWh je Grad · max(0, Heizgrenze − außen)**.

- **Heizgrenze** im Raster 5–22 °C in 0,5-K-Schritten gesucht. Je Grenze wird mit kleinsten Quadraten gerechnet, die
  kleinste Fehlerquadratsumme gewinnt. Mindestens 3 Tage müssen unter der Grenze liegen, die Steigung muss positiv sein.
- Liegt die beste Grenze über allen gemessenen Tagen, ist sie nicht bestimmbar. Dann gilt eine **Gerade** („2P“), mit
  dem wärmsten Tag als Bezug. Das ist der Normalfall, solange nur kalte Tage gemessen sind.
- **Gütemaß** CV(RMSE) = √(SSE ÷ (n − p)) ÷ mittlerer Tagesverbrauch: bis 20 % „gut“, bis 30 % „brauchbar“, darüber
  „unsicher“ (dann kein erwarteter Verbrauch). Dazu R² und die mittlere Abweichung (`rmse`, Grundlage der Spanne in .02).
- **Lernt noch** unter 10 Tagen oder unter 4 K Spanne der Außentemperatur.
- **Mit und ohne Automatik** getrennt (`je_betrieb`); Baseline-Tage kommen erst mit .04.
- Grenzwerte sind Konstanten in `logik/signatur.py`. Einstellbar werden sie erst, wenn sich das im Betrieb zeigt.

## 4. Hochrechnung (.02)

Entscheidungen Herbert 10.10.2026: Außentemperatur als **24-h-Mittel** (`tag_bereich.aussen_mittel`, wie die Heizgradtage
nach ÖNORM); es zählen nur **ganze Tage ohne Ausfall und ohne Notbetrieb** (mindestens 95 % des Tages in
`bereich_minute` mitgeschrieben, Quelle HA oder übernommen, nicht `notprogramm`).

- Rechnen nur in `logik/hochrechnung.py`; `funktionen/heizung/hochrechnung.py` liest die Tage der laufenden Heizperiode
  (`db/tage.hochrechnung_tage`) beim Start und täglich um 03:50 und legt das Ergebnis bei der Heizung ab.
- **Rest** = morgen bis Ende der Heizperiode (oder geplantes Ende der Baustelle). Je Tag die Außentemperatur aus der
  Vorhersage (Tagesmittel, neu in `wetter_tage`: stündlich gemittelt, sonst (Höchst + Tiefst) ÷ 2), sonst aus den
  **Klimamitteln** (12 Monatsmittel, zwischen den Monatsmitten linear). Vorgabe: Näherung Graz 1991–2020; je Baustelle
  als Einstellung `heizung.klimamittel` (Eingabe auf der Seite mit .03). **Herbert: Werte mit GeoSphere Austria
  (Klimamittel der nächsten Station) prüfen.**
- **Spanne** (rund 90 %): wärmerer bzw. kälterer Winter um 1,5 K an allen Tagen ohne Vorhersage, dazu 1,645 · rmse · √Tage.
  Nur wenn jeder Container eine Signatur hat.
- **Container ohne Signatur** (lernt, unsicher): Tagesschnitt der gezählten Tage × Resttage, wie vorher.
- **Normjahr** (Witterungsbereinigung): die ganze Heizperiode bei Klimamitteln; **Heizgradtage 20/12** des Rests.
- Bisher = Zähler `energie_heizen` (wie vorher); heute zählt dort mit, der Rest beginnt morgen.
- Sensor `prognose_heizperiode` (und Kosten) zeigt den neuen Wert, `baustelle/auswertung` › `hochrechnung` dazu
  `methode`, `unten_*`, `oben_*`, `normjahr_*`, `hgt_rest`, `vorhersage_tage` und je Container Signatur und Rest.
- **Ohne Automatik** bleibt bis zur gemessenen Baseline (.04) die bisherige Schätzung; dann aus der Signatur „ohne“.
- Arbeitszeitplan, Vorheizen und Frostschutz stecken in der Signatur, weil sie aus dem echten Betrieb gelernt ist.
  Getrennte Signaturen für Arbeits- und freie Tage erst, wenn das Gütemaß zeigt, dass es nötig ist.

## 5. Anzeige (.03) – abgenommen 10.10.2026

Mockup `mockups/hochrechnung.html`, Variante 2 (Herbert 10.10.2026): In der Auswertung ersetzt eine Karte **„Heizperiode“**
die Blöcke „Hochrechnung Heizperiode“ und „Wetter-Einfluss“. Sie hat drei Reiter:

- **Hochrechnung:** Prognose mit Spanne, dazu ein Diagramm über die ganze Heizperiode (aufsummiert): tatsächlich bis heute,
  Prognose mit Automatik (Band = Spanne), Prognose ohne Automatik (bis J4 die bisherige Schätzung). Darunter die Legende
  mit €, „gespart“ und woher die Zahl kommt.
- **Signatur:** Container wählen; Streudiagramm Tagesverbrauch gegen Außentemperatur mit Knickgerade und Heizgrenze; je
  Container Heizgrenze, kWh je Grad, Grundlast, Güte bzw. „lernt noch n/10“.
- **Klima:** Klimamittel (Heizperiode hervorgehoben), Vorhersage der nächsten Tage, Heizgradtage bis zum Ende, Normjahr;
  Link zur Einblendung **Klimamittel** (12 Monatswerte, „Vorgabe Graz“).

Die **Heizperiode** ist in der Karte einstellbar (✎ → von/bis). Es ist dieselbe Einstellung wie unter Einstellungen ›
Baustelle (`heizperiode_von/bis`). Die Kachel „Hochrechnung“ zeigt die Spanne bzw. „lernt noch“.

Die Integration liefert alles; die Seite zeichnet nur. Neu in `baustelle/auswertung` › `hochrechnung`: die **Tagesreihe**
(`reihe`: Tag, tatsächlich aufsummiert, Prognose mit/unten/oben/ohne aufsummiert), die **Punkte der Signatur** je
Container (Tag: außen, kWh), die **Klimamittel** und die **Vorhersage**. Die Klimamittel speichert `baustelle/setzen`
(`heizung.klimamittel`, logik prüft 12 Zahlen).

Gebaut 0.8.125: Seite `frontend/src/ansichten/heizperiode.js` (Bausteine „hochrechnung“ und „wetter“ der Auswertung zeigen
die Karte, „wetter“ öffnet mit dem Reiter Signatur; ✎ öffnet die Einblendung „zeitraum-bs“). „Bisher“ = Tage der
Heizperiode aus `tag_bereich` (vorher Zähler seit Zählbeginn), Rechnung stündlich (:50) und gleich nach dem Speichern der
Klimamittel. Noch offen: Kachel „Wetter“, Kachel-Katalog „Wetter-Einfluss“ und die Erkenntnis „je Grad kälter“ nutzen noch
die Gerade `wetter_einfluss` – sie ziehen auf die Signatur um, danach fällt die Gerade weg (Regel nur einmal).

## 6. Tests

`tests/logik/test_signatur.py`: Grenze und Steigung aus Modelldaten, Streuung, lernt (Tage, Spanne), Gerade, ohne
Zusammenhang, starke Streuung, Gütestufen, erwarteter Verbrauch, getrennter Betrieb.
`tests/logik/test_hochrechnung.py`: Klimamittel, Klima je Tag, HGT, welche Tage zählen (auch Sommerzeit), Vorhersage vor
Klima, Rest mit Spanne und Normjahr, lernt (Tagesschnitt), ohne Tage, Summe der Baustelle.
`tests/integration/test_hochrechnung.py`: Tage aus der Datenbank (ein Tag im Notbetrieb fällt weg) → Signatur, Sensorwert,
ohne Tage der Tagesschnitt.
