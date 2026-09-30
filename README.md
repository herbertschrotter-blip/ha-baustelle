# ha-baustelle

Eigene Home-Assistant-Integration **Baustelle**: Heizkörper in Baustellencontainern über Shellys nach Zeitplan und Wetter
schalten und Grundwasserpumpen überwachen – je Baustelle, mit Containern und Shellys, die man in HA zuordnet.
Vorlage der Oberfläche ist das abgenommene Mockup `mockups/glas.html` (Abnahme 30.09.2026, `mockups/README.md`);
Bauplan und Schnittstelle stehen in `docs/bauplan-0.7.md` und `docs/api-0.7.md`.

## Stand 0.7.0

- **Einrichtung** unter Einstellungen → Geräte & Dienste → Baustelle: je Baustelle ein Eintrag; darin
  **Container / Pumpenschächte** und **Shellys** als Unter-Einträge (auch direkt von der Seite aus). Ein Shelly gehört nur
  einer aktiven Baustelle; Leistungs- und Energiesensor werden am Shelly automatisch gefunden.
- **Alle Einstellungen auf der Seite „Baustelle“**: Arbeitszeiten mit Startdatum und Einmal-Ausnahmen, Vor-/Nachheizen,
  Kleidung trocknen, Kälte-Frühstart, Heizgrenze, Frostschutz, Solltemperatur, je Container Automatik/Trocknen/Soll/
  nur bei Bedarf, Türkontakt, Stromanschlüsse und Staffelung, Firmen, Meldungen, Bericht. Gespeichert im Store der
  Integration (`.storage/`, in der Sicherung). Als Entitäten bleiben der Automatik-Schalter und die Sensoren.
- **Heizung**: in der Arbeitszeit (plus Vor-/Nachheizen, nach Regen länger) – mit Fühler auf Soll, ohne Fühler an und der
  Heizkörperthermostat regelt; Staffelung je Anschluss (nur Heizkörper werden geschaltet); Bedarfs-Container über
  Schalter oder Termine aus einem Kalender; schnell aufheizen; „alle jetzt heizen“; Tür offen pausiert.
- **Warnungen, Protokoll, Nachrichten**: Störungen und Hinweise, dauerhaftes Protokoll (auch im Logbuch), Handy-Nachrichten
  mit Knöpfen, Wochen-/Monatsbericht per Handy und E-Mail (CSV-Anhang nur mit dem SMTP-Dienst).
- **Verbrauch und Kosten**: Zähler je Baustelle und Container wie bisher (bleiben beim Umstieg erhalten), Auswertung je
  Container, Firma und über alle laufenden Baustellen, Abrechnung als CSV, Vergleich Ölradiator/Konvektor.

## Aufbau

```
custom_components/baustelle/   Integration (→ /config/custom_components/baustelle/)
  logik/                       Fachlogik ohne HA-Code (Heizungsregeln, Pumpen, Zählen)
  steuerung.py                 Laufzeit: Regelung, Staffelung, schalten, Warnungen, Zähler
  nachrichten.py               Handy-Nachrichten mit Knöpfen, Frühstart-Hinweis, Wochen-/Monatsbericht
  config_flow.py               Einrichtung, Optionen, Subentries Bereich/Gerät
  einstellungen.py             Einstellungen, Protokoll, Meldungen (Store v2 unter .storage/, in der Sicherung)
  frontend/baustelle-panel.js  eigene Seite (Web-Component, ohne externe Abhängigkeiten)
  frontend/changelog.json      Verlauf für „Über“ (tools/changelog.py aus CHANGELOG.md)
  panel.py, daten.py           Seite anmelden, WebSocket-Befehle (docs/api-0.7.md)
  logbook.py                   Protokoll im HA-Logbuch
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
   Empfänger wählen. Arbeitszeit, Anschlüsse und Regeln auf der Seite „Baustelle“ einstellen, dann **Automatik** einschalten.

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
