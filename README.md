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

Vier Schichten, der Weg geht nur in eine Richtung: **Fachlogik → Funktionen → Kern → Ausgabe**. Die Seite zeigt an, was
die Integration liefert, und rechnet nichts Fachliches nach (Bauplan `docs/bauplan-module.md`).

| Schicht | Wo | Was |
|---|---|---|
| Fachlogik | `logik/` | jede Fachregel genau einmal, ohne HA-Code, mit Test in `tests/logik/`: Arbeitszeit/Tagesplan, Regelung (Soll je Container), Staffelung, Pumpen, Warnungen, Zählen, Firma, Auswertung/Abrechnung, Bericht |
| Funktionen | `funktionen/` | je Funktion ein Modul mit der Schnittstelle aus `basis.py` (heute `heizung.py`, `pumpen.py`; Liste `FUNKTIONEN` in `__init__.py`): Soll, Anzeige, Warnungen, Zähler, Status, Handbetrieb der Funktion – ruft `logik/` |
| Kern | `steuerung.py` | Einrichtung, Ereignisse, Wetter, Kalender, **Staffelung** (für alle Funktionen gemeinsam, ein Anschluss), Schalten, Protokoll, Status; ruft nur die Methoden der Funktionen und kennt keine Heizungs- oder Pumpen-Einzelheiten |
| Ausgabe | `sensor.py`, `binary_sensor.py`, `switch.py`, `daten.py`, `panel.py`, `auswertung.py`, `nachrichten.py` | Entitäten, `baustelle/struktur`, Befehle der Seite (`docs/api-0.7.md`), Auswertung aus der Langzeitstatistik, Nachrichten und Bericht |
| Seite | `frontend/baustelle-panel.js` | zeigt nur an (Plan, Status, Auswertung, Abrechnung, CSV kommen von der Integration); Reiter nach den eingeschalteten Funktionen |

Eine neue Funktion (z. B. Kühlung) ist ein neues Modul in `funktionen/`, ohne Eingriff in den Kern:
`docs/funktion-anlegen.md`.

```
custom_components/baustelle/   Integration (→ /config/custom_components/baustelle/)
  logik/                       Fachlogik ohne HA-Code (je Thema ein Modul)
  funktionen/                  basis.py (Schnittstelle), heizung.py, pumpen.py; FUNKTIONEN in __init__.py
  steuerung.py                 Kern: Ereignisse, Wetter, Kalender, Staffelung, Schalten, Protokoll, Status
  auswertung.py                Langzeitstatistik holen und logik/auswertung rechnen lassen (Seite, Bericht, CSV)
  nachrichten.py               Handy-Nachrichten mit Knöpfen, Frühstart-Hinweis, Wochen-/Monatsbericht
  config_flow.py               Einrichtung, Optionen, Subentries Bereich/Gerät
  einstellungen.py             Einstellungen, Protokoll, Meldungen (Store v2 unter .storage/, in der Sicherung)
  frontend/baustelle-panel.js  eigene Seite (Web-Component, ohne externe Abhängigkeiten)
  frontend/changelog.json      Verlauf für „Über“ (tools/changelog.py aus CHANGELOG.md, setzt auch SEITE_VERSION der Seite)
  panel.py, daten.py           Seite anmelden, WebSocket-Befehle (docs/api-0.7.md)
  logbook.py                   Protokoll im HA-Logbuch
  translations/, icons.json    Texte de/en, Symbole
  brand/icon.png, icon@2x.png  Symbol der Integration (256/512 px, tools/symbol.py)
tests/logik/                   pytest ohne HA (Python 3.12+)
tests/integration/             pytest-homeassistant-custom-component (Python 3.14+)
tests/panel/                   Seite in Node rendern (ohne Browser)
tools/deploy.sh                Auslieferung nach /config
mockups/                       abgenommener Entwurf
```

Quelle der Wahrheit ist dieses Repo (`/config/projekte/ha-baustelle`). `/config` ist nur das Ziel.

## Installation über HACS

1. HACS → Integrationen → ⋮ → **Benutzerdefinierte Repositories** → `https://github.com/herbertschrotter-blip/ha-baustelle`,
   Kategorie **Integration**.
2. **Baustelle** herunterladen, Home Assistant neu starten (ab 2026.9).
3. Einstellungen → Geräte & Dienste → **Integration hinzufügen** → Baustelle.

Ohne HACS: Ordner `custom_components/baustelle` nach `/config/custom_components/` kopieren (hier: `tools/deploy.sh`,
siehe Auslieferung), dann neu starten.

## Einrichtung

- **Anlegen:** Name (jeder nur einmal), Beginn (ab dann zeigt der Verlauf Verbrauch und Heiztage), Funktionen Heizung
  und/oder Pumpenüberwachung. Danach gleich den ersten Container anlegen.
- **Container / Pumpenschacht** (Unter-Eintrag): Name, Art, optional Thermostat oder Temperaturfühler.
- **Shelly** (Unter-Eintrag): Bereich, Schalter, Name, Rolle (Heizkörper, Bautrockner, Pumpe, Steckdose), Typ
  (Ölradiator, Konvektor), optional Leistungs- und Energiesensor (sonst am selben Gerät gesucht). Ein Schalter gehört nur
  einer aktiven Baustelle; eine Pumpe nur in einen Pumpenschacht.
- **Konfigurieren** (Optionen): Status aktiv/abgeschlossen, Beginn/Ende, Funktionen, Wetter, Außentemperatur, Regen,
  Kalender für Feiertage und Urlaub, Empfänger der Meldungen, Heizperiode (Monate).
- **Neu konfigurieren:** Baustelle umbenennen; Container und Shellys über ihren Unter-Eintrag.
- Alles Übrige (Arbeitszeiten, Regeln, Anschlüsse, Firmen, Bericht, Automatik) auf der Seite **Baustelle**.

## Was die Integration liefert

- **Seite „Baustelle“** in der Seitenleiste (Übersicht, Heizung, Pumpen, Auswertung, Protokoll, Einstellungen).
- **Entitäten** je Baustelle: Schalter Automatik, Status, nächste Schaltzeit, Leistung, Zähler für Energie, Kosten,
  Ersparnis und Hochrechnung, Wetterwerte (Diagnose; Tageshöchst, Früh-Prognose und Regen zunächst aus), Erreichbar
  (Diagnose). Je Container Grund, Leistung, Energie, Kosten, Heizzeit; je Shelly Problem, Ø Leistung, bei Pumpen Pumpzeit,
  Zyklen und „läuft“.
- **Aktion** `baustelle.ticket`: Ticket aus dem Melden-Knopf ändern (`ticket`, optional `status`, `notiz`, `version`,
  `commit`, `von`); unbekanntes Ticket → Fehler.
- **Geräte:** Shellys oder jeder andere Schalter in HA (`switch.*`); Messwerte aus Leistungs-/Energiesensoren (W, kWh).
  Fühler: Temperatursensor oder Thermostat (`climate`).
- **Aktualisierung:** ohne Abfrage im Takt – bei jeder Zustandsänderung der zugeordneten Entitäten, mindestens jede
  Minute; Wettervorhersage alle 30 min, Kalender alle 15 min.

## Beispiele

- **Container nach Arbeitszeit heizen:** Container mit Fühler, Heizkörper-Shelly zuordnen, auf der Seite Arbeitszeit
  Mo–Do 07:00–16:30 und Vorheizen 45 min einstellen, Automatik ein.
- **Nur Pumpen überwachen:** Baustelle mit Funktion Pumpenüberwachung, Pumpenschacht, Shelly mit Rolle Pumpe;
  Meldung bei Trockenlauf, Dauerlauf oder Ausfall aufs Handy.
- **Eigene Automation:** Auslöser „Binärsensor Erreichbar der Baustelle wird aus“ → z. B. Licht im Büro rot schalten.

## Bekannte Grenzen

- Geschaltet werden nur Schalter-Entitäten; Heizkörper ohne Fühler regeln über ihr eigenes Thermostat.
- Ohne Leistungs- oder Energiesensor zählt die Integration keinen Verbrauch und erkennt kein „zieht keinen Strom“.
- Den CSV-Anhang im Bericht kann nur der SMTP-Dienst von HA mitschicken.
- Handy-Knöpfe nur mit der Companion App (`notify.mobile_app_*`).
- Kühlung und andere Funktionen gibt es noch nicht (Platz dafür ist vorgesehen).

## Fehlerbehebung

- **Reparatur-Hinweis „Entität fehlt“:** ein zugeordneter Shelly, Fühler, Wetter oder Kalender ist weg bzw. umbenannt –
  im Unter-Eintrag oder unter Konfigurieren neu wählen.
- **Nichts wird geschaltet:** Automatik aus (startet aus), Baustelle abgeschlossen, Heizgrenze, Feiertag/Urlaub oder
  Handbetrieb – Status und Grund stehen auf der Seite und im Protokoll.
- **Shelly nicht erreichbar:** steht einmal im Protokoll von HA (`custom_components.baustelle`) und als Warnung auf der
  Seite; ist er zurück, ebenfalls.
- **Mehr sehen:** Diagnose herunterladen (Geräte & Dienste → Baustelle → ⋮ → Diagnose) oder Debug-Protokoll
  einschalten.

## Entfernen

1. Einstellungen → Geräte & Dienste → Baustelle → ⋮ → **Löschen** (je Baustelle). Einstellungen und Reparatur-Hinweise
   der Baustelle werden gelöscht; die Langzeitstatistik der Zähler bleibt in HA.
2. Bei HACS: Baustelle in HACS entfernen, sonst den Ordner `/config/custom_components/baustelle` löschen.
3. Home Assistant neu starten (die Seite verschwindet aus der Seitenleiste).

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

## Tests und Qualität

```
python3 -m pytest -q -p no:cacheprovider tests/logik
uv run --no-project --python 3.14 --index-strategy unsafe-best-match \
  --with pytest-homeassistant-custom-component python -m pytest -q -p no:cacheprovider tests/integration
uv run --no-project --python 3.14 --index-strategy unsafe-best-match \
  --with pytest-homeassistant-custom-component --with mypy mypy --strict custom_components/baustelle
```

Qualitätsskala von Home Assistant: `custom_components/baustelle/quality_scale.yaml` (jede Regel mit Stand und Grund).
Auf GitHub prüfen `.github/workflows/tests.yml` und `validate.yml` (hassfest, HACS, mypy; Versionen fest angeheftet).
Symbol: `custom_components/baustelle/brand/icon.png` (+ `icon@2x.png`), gezeichnet mit `tools/symbol.py`.

## Auslieferung

1. Änderungen im Repo, Tests grün, committen.
2. Herbert spielt ein: `! /config/projekte/ha-baustelle/tools/deploy.sh`
   (kopiert die Integration samt Seite nach `/config/custom_components/baustelle/`).
3. Konfiguration prüfen, dann **Neustart durch Herbert** (neue oder geänderte Integration braucht immer einen Neustart).
4. Einstellungen → Geräte & Dienste → Baustelle prüfen; Protokoll auf Meldungen von `custom_components.baustelle` ansehen.

## Nie ins Repo

Zugangsdaten, Koordinaten der Baustelle, Gerätekennungen (MAC, Seriennummern), Tokens, `.storage/`.
