# Mockups

HTML-Entwürfe für das Dashboard „Baustelle“. Design: HA-Standard-Theme und eingebaute Karten, im Mockup nachgebildet
(Profil in `CLAUDE.md`, Abschnitt Mockup). Pflichtansichten: Desktop und 390 px.

| Datei | Umfang | Stand |
|---|---|---|
| `baustelle.html` | Entwurf v4, interaktiv mit Simulation. Tabs Übersicht, Heizung, Pumpen, Auswertung, Einstellungen, Verlauf; Baustellen aktiv/abgeschlossen; Container/Bereiche mit Shellys, Fühler/Thermostat, Heizkörper-Typ je Shelly (nur Vergleich); Modi je Container (Zeitplan/Thermostat/Hand/Aus); Kleidung trocknen nach Regen (Schwelle, länger, früher); Kälte-Frühstart; Heizgrenze; Frostschutz; Urlaub und Feiertage (jährlich berechnet); Wetterquelle (Integration oder Wetterstation); Pumpenüberwachung mit Meldungen; Prognose ohne Automatik; Vergleich Ölradiator/Konvektor; Diagramme (Zeitleiste, Leistung, Verbrauch, Heiz-/Pumpzeit, Zyklen, Temperaturen) | **Abgenommen von Herbert am 29.09.2026** |

Bewusst offen bzw. für den Bau festgelegt:
- Animationen und Zeitleiste im Zeitplan brauchen eine eigene Karte; erste Stufe mit eingebauten Karten
  (`history-graph`, `statistics-graph`, Kacheln), eigene Karte später.
- Die Verwaltung liegt in HA unter Einstellungen → Geräte & Dienste → Baustelle („Konfigurieren“), nicht im Dashboard.
- Werte über mehrere Tage/Heizperiode sind im Mockup Platzhalter.
