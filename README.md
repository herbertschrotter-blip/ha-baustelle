# ha-baustelle

Eigene Home-Assistant-Integration **Baustelle**: Heizkörper in Baustellencontainern über Shellys nach Zeitplan und Wetter
schalten und Grundwasserpumpen überwachen – je Baustelle, mit Containern und Shellys, die man in HA zuordnet.
Die abgenommene Planung ist `mockups/baustelle.html` (Abnahme 29.09.2026, `mockups/README.md`).

## Stand 0.5.0 (Stufen 1–6 des Bauplans)

- **Einrichtung** unter Einstellungen → Geräte & Dienste → Baustelle: je Baustelle ein Eintrag; darin
  **Container / Pumpenschächte** und **Shellys** als Unter-Einträge (was dranhängt: Heizkörper, Bautrockner, Pumpe,
  Steckdose; Heizkörper-Typ nur für den Vergleich). Ein Shelly gehört nur einer aktiven Baustelle; „abgeschlossen“ gibt
  ihn frei. Leistungs- und Energiesensor werden am Shelly automatisch gefunden.
- **„Konfigurieren“** je Baustelle: Status aktiv/abgeschlossen, Beginn/Ende, Funktionen, Wetter, Wetterstation,
  Feiertags- und Urlaubskalender, Empfänger der Meldungen, Heizperiode.
- **Heizung** (Entitäten der Baustelle und der Container): Automatik, Modus je Container (Zeitplan, Thermostat nur mit
  Fühler, Hand, Aus), Ein/Aus je Wochentag, Kälte-Frühstart, Kleidung trocknen nach Regen (je Container: Schwelle,
  länger, früher), Heizgrenze, Frostschutz, Urlaub/Feiertag (nur Frostschutz, absenken oder aus).
  Wer einen Heizkörper in HA von Hand schaltet, stellt seinen Container auf „Hand“.
- **Pumpen**: läuft (nach Leistung), Probleme offline, Trockenlauf, Dauerlauf, Baustelle nicht erreichbar;
  Meldung an die gewählten Handys, Knopf „Test-Meldung“. Problem- und Läuft-Sensoren stehen auf der Geräteseite des Shelly.
- **Verbrauch und Kosten** (Stufe 4): Zähler je Baustelle und Container (kWh, € zum jeweiligen Preis), Heizzeit,
  Pumpzeit, Pumpzyklen; „ohne Automatik“ (mittlere Leistung im Betrieb × 24 h), Ersparnis, Hochrechnung auf die
  Heizperiode; Vergleich Ölradiator/Konvektor. Die Zähler führen in HA eine Langzeitstatistik (Tag, Woche, Monat über
  `statistics-graph`) und lassen sich ins Energie-Dashboard übernehmen. Gezählt wird nur bei aktiver Baustelle.
- **Diagnose-Download** je Baustelle, **Reparatur-Hinweise** bei fehlenden Entitäten (Stufe 5).
- **Eigene Seite „Baustelle“** (Stufe 6) in der Seitenleiste, nach dem abgenommenen Entwurf: Übersicht, Heizung,
  Pumpen, Auswertung, Verlauf, Einstellungen, Baustellen-Umschalter, Animationen und Diagramme – mit echten Daten.

## Aufbau

```
custom_components/baustelle/   Integration (→ /config/custom_components/baustelle/)
  logik/                       Fachlogik ohne HA-Code (Heizungsregeln, Pumpen, Zählen)
  steuerung.py                 Laufzeit: Zustände lesen, schalten, melden
  config_flow.py               Einrichtung, Optionen, Subentries Bereich/Gerät
  einstellungen.py             Zeitplan, Regeln, Modi (Store unter .storage/, in der Sicherung)
  frontend/baustelle-panel.js  eigene Seite (Web-Component, ohne externe Abhängigkeiten)
  panel.py, daten.py           Seite anmelden, WebSocket „baustelle/struktur“
  translations/, icons.json    Texte de/en, Symbole
tests/logik/                   pytest ohne HA (Python 3.12+)
tests/integration/             pytest-homeassistant-custom-component (Python 3.14+)
tests/panel/                   Seite in Node rendern (ohne Browser)
tools/deploy.sh                Auslieferung nach /config
mockups/                       abgenommener Entwurf
```

Quelle der Wahrheit ist dieses Repo (`/config/projekte/ha-baustelle`). `/config` ist nur das Ziel.

## Einrichten in Home Assistant (bewährte Bausteine)

1. **Zone** für die Baustelle anlegen (Einstellungen → Bereiche & Zonen). Die Koordinaten bleiben in HA.
2. **Wetter:** Integration **Open-Meteo** mit dieser Zone (oder Met.no mit den Koordinaten). Optional eine
   Wetterstation (z. B. Ecowitt) für gemessene Außentemperatur und Regen.
3. **Feiertage:** Integration **Feiertage** (Österreich, Bundesland) → Kalender-Entität.
4. **Urlaub/Betriebsruhe:** Integration **Lokaler Kalender**, z. B. „Baustelle Urlaub“; Einträge = Zeiträume.
5. **Meldungen:** Companion App am Handy → Dienst `notify.mobile_app_<handy>`.
6. **Baustelle** hinzufügen, Container/Pumpenschächte und Shellys zuordnen, unter „Konfigurieren“ Wetter, Kalender und
   Empfänger wählen. Werte (Zeiten, Regeln) an den Entitäten der Baustelle einstellen, dann **Automatik** einschalten.

Ohne Wetterstation nimmt die Integration als „Regen“ den für heute vorhergesagten Niederschlag.

## Tests

```
python3 -m pytest -q -p no:cacheprovider tests/logik
uv run --no-project --python 3.14 --index-strategy unsafe-best-match \
  --with pytest-homeassistant-custom-component python -m pytest -q -p no:cacheprovider tests/integration
```

## Auslieferung

1. Änderungen im Repo, Tests grün, committen.
2. Herbert spielt ein: `! /config/projekte/ha-baustelle/tools/deploy.sh`
   (kopiert die Integration samt Seite nach `/config/custom_components/baustelle/`).
3. Konfiguration prüfen, dann **Neustart durch Herbert** (neue oder geänderte Integration braucht immer einen Neustart).
4. Einstellungen → Geräte & Dienste → Baustelle prüfen; Protokoll auf Meldungen von `custom_components.baustelle` ansehen.

## Nie ins Repo

Zugangsdaten, Koordinaten der Baustelle, Gerätekennungen (MAC, Seriennummern), Tokens, `.storage/`.
