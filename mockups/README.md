# Mockups

HTML-Entwürfe für das Dashboard „Baustelle“. Design: HA-Standard-Theme und eingebaute Karten, im Mockup nachgebildet
(Profil in `CLAUDE.md`, Abschnitt Mockup). Pflichtansichten: Desktop und 390 px.

| Datei | Umfang | Stand |
|---|---|---|
| `baustelle.html` | Entwurf v4, interaktiv mit Simulation. Tabs Übersicht, Heizung, Pumpen, Auswertung, Einstellungen, Verlauf; Baustellen aktiv/abgeschlossen; Container/Bereiche mit Shellys, Fühler/Thermostat, Heizkörper-Typ je Shelly (nur Vergleich); Modi je Container (Zeitplan/Thermostat/Hand/Aus); Kleidung trocknen nach Regen (Schwelle, länger, früher); Kälte-Frühstart; Heizgrenze; Frostschutz; Urlaub und Feiertage (jährlich berechnet); Wetterquelle (Integration oder Wetterstation); Pumpenüberwachung mit Meldungen; Prognose ohne Automatik; Vergleich Ölradiator/Konvektor; Diagramme (Zeitleiste, Leistung, Verbrauch, Heiz-/Pumpzeit, Zyklen, Temperaturen) | **Abgenommen von Herbert am 29.09.2026** |

| `wettersymbole.html` | Wettersymbole in drei Varianten (Realistisch, 3D, Weich) plus bisher, je mit Beispiel-Wetterkarte, hell und dunkel | **Gewählt von Herbert am 29.09.2026: Realistisch** (eingebaut in 0.6.2) |
| `uebersicht-varianten.html` | Übersicht: Mischung aus „Geordnet“ und „Kacheln“, dazu beide zum Vergleich | Zwischenstand – abgelöst durch `baustellenuebersicht.html` |
| `baustellenuebersicht.html` | Übersicht mit Container im Mittelpunkt: Baustellen-Kachel, animierte 3D-Container-/Schacht-Kacheln mit Zustand, Gerätezahl, Leistung; Handy und Desktop, Beispieldaten | **Richtung bestätigt von Herbert am 29.09.2026**, Fenster korrigiert; festgelegt: Wetter nur als Chip, Klick auf eine Kachel öffnet Container/Funktion/Diagramme. Eingebaut in 0.6.3, Abnahme im Echtbetrieb offen |
| `uebersicht-ios.html` | Baustellenübersicht in drei Handy-Stilen (vier Varianten): A iOS (Widgets, großer Titel, Tableiste), B One UI/Samsung (Kopfbereich oben, Bedienung unten), C Glas wie visionOS (Milchglas über Farbverlauf), D Architektonisch (Off-White, Graphit, Bernstein, Haarlinien-Raster); hell/dunkel, Beispieldaten | **Herbert wählt C Glas (29.09.2026)**; weiter in `glas.html` |
| `glas.html` | Klickbarer Prototyp im Glas-Stil: Übersicht, Container-Ansicht (Geräte schalten → Handbetrieb, Zeitleiste, Diagramme mit Hover), Heizung (Zeitplan je Tag, Regeln, Kleidung trocknen, Urlaub), Auswertung (Zeitraum, je Container, ohne Automatik, Ölradiator/Konvektor), Verlauf, Einstellungen; Einblendungen von unten, Handy und Desktop, hell/dunkel. Hintergrund nach Tageszeit und Wetter als WebGL-Himmel (`quelle/himmel.frag`, `quelle/himmel.js`: Tropfen auf Glas mit Brechung, Wolken, Nebel, Schnee, Sonne, Mond und Sterne, Gewitter), ohne WebGL CSS-Rückfall. Quelle: `quelle/glas.js` (übernimmt Wettersymbole und Container-Grafiken aus dem Panel) | Vorschau 29.09.2026 – Abnahme offen |
| `himmel-stimmungen.png` | Standbilder des WebGL-Himmels in `glas.html` (Morgen klar, Tag klar, Abend bewölkt, Nacht klar, Nebel, Schnee, Gewitter mit Blitz, Regen), ohne Browser gerechnet mit `quelle/vorschau/` | **Himmel bestätigt von Herbert am 29.09.2026** („mach das so“): WebGL-Himmel nach Tageszeit (`sun.sun`) und Wetter kommt so ins Panel |

Bewusst offen bzw. für den Bau festgelegt:
- Animationen und Zeitleiste im Zeitplan brauchen eine eigene Karte; erste Stufe mit eingebauten Karten
  (`history-graph`, `statistics-graph`, Kacheln), eigene Karte später.
- Die Verwaltung liegt in HA unter Einstellungen → Geräte & Dienste → Baustelle („Konfigurieren“), nicht im Dashboard.
- Werte über mehrere Tage/Heizperiode sind im Mockup Platzhalter.
