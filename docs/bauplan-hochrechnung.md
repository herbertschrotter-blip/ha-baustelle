# Bauplan Hochrechnung und Ersparnis

Die Hochrechnung der Heizperiode ist heute der Tagesschnitt seit Zählbeginn × Tage der Heizperiode. Gemessen im milden
Oktober unterschätzt sie den Winter. „Ohne Automatik“ ist 24 h Volllast aller Heizkörper, also viel zu hoch, und die
Ersparnis wirkt dadurch zu groß. Ziel (Herbert 07.10.2026): nach professionellem Vorgehen rechnen. Dazu gehören eine
Energiesignatur je Container (ASHRAE Guideline 14), eine Hochrechnung mit Heizgradtagen als Spanne (ÖNORM B 8135,
Klimamittel GeoSphere Austria) und die Ersparnis aus einer gemessenen Baseline (IPMVP Option B).

Stand: .01 fertig (0.8.123, 10.10.2026). Aufgabe BSM-033, Unteraufgaben .01–.04 = Stufen in §2.

## 1. Grundsätze

- Jede Fachregel nur in `logik/` mit Test; die Seite zeigt nur an (CLAUDE.md).
- Die einfache Gerade `logik/auswertung.wetter_einfluss` (kWh = k · außen + d0, „Wetter-Einfluss“ auf der Seite) ist
  eine Vorstufe der Signatur. Mit der Anzeige (.02/.03) ersetzt die Signatur sie, damit die Regel nicht zweimal da ist.
- Nichts schaltet von selbst: Baseline-Läufe (.04) starten aus, wie die Automatik.

## 2. Stufen (je eigene Lieferung)

| Stufe | Inhalt | Stand |
|---|---|---|
| .01 | Energiesignatur je Container: `logik/signatur.py` | ☑ 0.8.123 |
| .02 | Hochrechnung mit Heizgradtagen und Spanne, Witterungsbereinigung; Daten aus `tag_bereich` an die Signatur | ☐ |
| .03 | Anzeige: Spanne, Signatur, Baseline (Mockup zuerst) | ☐ |
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

Offen für .02: Welche Tage zählen (ganze Tage, Container in Betrieb, ohne Ausfall) und ob die Außentemperatur über
24 h (`tag_bereich.aussen_mittel`) oder nur über die Heizstunden gemittelt wird.

## 4. Tests

`tests/logik/test_signatur.py`: Grenze und Steigung aus Modelldaten, Streuung, lernt (Tage, Spanne), Gerade, ohne
Zusammenhang, starke Streuung, Gütestufen, erwarteter Verbrauch, getrennter Betrieb.
