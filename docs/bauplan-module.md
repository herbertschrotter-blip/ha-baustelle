# Bauplan: Module je Funktion, Fachlogik nur in der Integration

Stand 30.09.2026 · Anlass: Herberts Frage „gibt es Module für Heiztage, Arbeitszeiten … oder machen das die Kacheln – und
vielleicht mehrfach?“ · Ausführung: nach Herberts Freigabe mit mehreren Agenten (Workflow), Phase für Phase.

## 1. Ziel

1. **Jede Fachregel gibt es genau einmal** – in Python unter `custom_components/baustelle/logik/`, mit Test. Die Seite
   rechnet nichts Fachliches mehr, sie zeigt an, was die Integration liefert. Bericht, Seite und CSV zeigen damit
   garantiert dieselben Zahlen (Beispiel für den Fehler, den das verhindert: Heiztage im Bericht vs. Seite, 0.7.9).
2. **Je Funktion ein Modul** (Heizung, Pumpen; später z. B. Kühlung) mit derselben Form. `steuerung.py` wird zum
   schlanken Kern, der die aktiven Funktionen einer Baustelle aufruft. Eine neue Funktion entsteht durch ein neues
   Modul, ohne in den Kern einzugreifen.

**Sichtbar ändert sich nichts** (außer dass abweichende Zahlen gleich werden). Kühlung selbst wird **nicht** gebaut – nur
der Platz dafür und eine Anleitung.

## 2. Ist-Stand (geprüft 30.09.2026)

**Integration** – drei Schichten:

| Schicht | Dateien | Inhalt |
|---|---|---|
| Fachlogik (rein, getestet) | `logik/arbeitszeit.py`, `regelung.py`, `staffel.py`, `pumpen.py`, `warnungen.py`, `zaehlen.py`, `abrechnung.py`, `bericht.py` | Tagesplan, Soll je Container, Staffelung, Pumpenüberwachung, Warnungen, Zähler/Hochrechnung, Aufteilung nach Firma, Bericht |
| Kern | `steuerung.py` (~1700 Zeilen) | Einrichtung, Ereignisse, Wetter, Kalender, Plan, Soll je Container, Staffelung, Schalten, Anzeige/Status, Warnungen, Bericht planen, Zählen – **Heizung und Pumpen gemischt** |
| Ausgabe | `sensor.py`, `binary_sensor.py`, `switch.py`, `daten.py`, `panel.py`, `nachrichten.py` | Entitäten, `baustelle/struktur`, Befehle, Nachrichten und Bericht |

**Seite (`frontend/baustelle-panel.js`)** – zeigt Plan, Status, Gründe, Staffelung, Warnungen der Integration an (rechnet
sie nicht nach). **Rechnet aber selbst** (aus der Langzeitstatistik von HA):

| Was | Stelle in der Seite | Gegenstück in der Integration | Befund |
|---|---|---|---|
| Abrechnung nach Firma (Tabelle, CSV) | `abrechnungDaten`, `firmaAm`, `bucketMs`, `csv` | `logik/abrechnung.aufteilen` (Bericht, CSV-Anhang) | **doppelt**, JS und Python |
| Ende der Heizperiode | `heizperiodeEnde` | `Steuerung.hochrechnung_heizperiode` | **doppelt** |
| Heiztage | Zähler, sonst aus Statistik (`verlaufWerte`) | Zähler `heiztage`; Bericht seit 0.7.9 aus Heizzeit | Ersatzweg doppelt |
| Kennzahlen Verlauf (kWh je Heiztag, € je Monat, Monate) | `kennzahlen`, `verlaufWerte`, `monateJeContainer` | – | nur Seite |
| Ölradiator/Konvektor (kWh je Heizstunde, Kosten je Tag) | `typVergleich` | Zähler/Sensoren je Typ | Rechnung nur Seite |
| Wetter-Einfluss (Trend kWh je °C) | `tageswerte` + Regression in `v_auswertung` | – | nur Seite |
| Je Gerät (Ø kW, Stunden ≈ kWh ÷ Ø kW) | `jeGeraet` | Zähler `mittel:<gid>` | Schätzung nur Seite |
| Gemessene Heizzeiten („Wann heizt was“) | `messung` (Verlauf der Leistungssensoren) | – | Anzeige aus Rohdaten (bleibt) |

Reine Anzeige von Statistik-Reihen (Diagramme Verbrauch, Temperaturen, Leistung) ist **keine** Fachlogik und bleibt in
der Seite.

## 3. Soll-Architektur

```
custom_components/baustelle/
  logik/                      reine Fachlogik, je Thema ein Modul (+ Tests in tests/logik/)
    arbeitszeit.py regelung.py staffel.py pumpen.py warnungen.py zaehlen.py abrechnung.py bericht.py
    auswertung.py             NEU: Zeiträume/Buckets, Abrechnung je Stunde/Tag/Monat, Heizperiode, Heiztage,
                              Kennzahlen Verlauf, Typvergleich, Wetter-Einfluss, Je Gerät
  funktionen/                 NEU: je Funktion ein Modul mit gleicher Schnittstelle
    basis.py                  Funktion (Protokoll): name, aktiv(), bereiche(), soll(), warnungen(), zaehlen(),
                              anzeige(), status(), hand_setzen()/hand_seit(), energie_buchen(),
                              einstellung_text() – der Kern ruft nur diese Methoden
    heizung.py                Soll je Container, Hand, Boost/Bedarf, Anzeige Heizung, Zähler Heizung
    pumpen.py                 Pumpenüberwachung, Zyklen, Pumpzeit, Anzeige Schacht
  steuerung.py                Kern: Einrichtung, Ereignisse, Wetter, Kalender, Staffelung (gemeinsam für alle
                              Funktionen – ein Anschluss), Schalten, Protokoll, Status; ruft die aktiven Funktionen
  auswertung.py               NEU: holt Langzeitstatistik (Recorder) und ruft logik/auswertung – für Seite, Bericht, CSV
  panel.py                    + Befehl baustelle/auswertung, baustelle/abrechnung (api §8)
```

Regeln (kommen in `CLAUDE.md` und `README.md`):
- Fachregeln nur in `logik/`, mit Test; die Seite zeigt an und rechnet nichts Fachliches.
- Eine Funktion = ein Modul in `funktionen/` mit der Schnittstelle aus `basis.py`; der Kern kennt keine Heizungs- oder
  Pumpen-Einzelheiten.
- Die Staffelung bleibt im Kern (alle Funktionen teilen sich die Stromanschlüsse).

## 4. Phasen

Jede Phase endet mit **allen drei Prüfungen grün** (logik, integration, panel) und einem Commit. Versionen nach der
Versionsregel: Umbau = PATCH. Phase 7 läuft nach Phase 5 und vor der Doku-Phase 6.

| Phase | Inhalt | Dateien | Akzeptanz |
|---|---|---|---|
| **0 Vorbereitung** | Git-Tag `vor-module` auf dem Stand vor dem Umbau. **Referenzwerte**: die Seite rechnet ihre heutigen Zahlen gegen `struktur-0.7.json`/`struktur-echt.json` + feste Statistik-Antworten und schreibt sie nach `tests/vektoren/auswertung-*.json` | `tests/panel/test_panel.js`, `tests/vektoren/` | Vektor-Dateien erzeugt, reproduzierbar |
| **1 Fachlogik** | `logik/auswertung.py` mit allen Rechnungen aus §2 (Tabelle), reine Funktionen | `logik/auswertung.py`, `tests/logik/test_auswertung.py` | Python liefert für die Vektoren dieselben Zahlen wie die Seite heute (Abweichungen nur, wo die Seite geschätzt hat – dokumentiert in §5) |
| **2 Schnittstelle** | `auswertung.py` (Recorder holen, logik aufrufen); Befehle `baustelle/auswertung` (`zeitraum`, `versatz`, `scope`) und `baustelle/abrechnung` (Tabelle + CSV-Text); Bericht und CSV-Anhang nutzen dieselben Funktionen; api-0.7 §8 | `auswertung.py`, `panel.py`, `nachrichten.py`, `docs/api-0.7.md`, `tests/integration/test_auswertung.py` | Integrationstests; Bericht-Zahlen = Seiten-Zahlen für denselben Zeitraum |
| **3 Seite umstellen** | Seite holt die Werte über die neuen Befehle; `abrechnungDaten`, `firmaAm`, `bucketMs`, `heizperiodeEnde`, `typVergleich`, `kennzahlen`/`verlaufWerte` (Rechnung), Regression, `jeGeraet` (Rechnung) entfallen; CSV kommt von der Integration | `baustelle-panel.js`, `tests/panel/test_panel.js` | Panel-Tests grün, Seite zeigt die Vektor-Zahlen; kein Fachcode mehr in der Seite (Test sucht die entfernten Namen) |
| **4 Funktionen-Module** | `funktionen/basis.py`, `heizung.py`, `pumpen.py`; Heizungs- und Pumpenteile aus `steuerung.py` dorthin; Kern ruft die aktiven Funktionen (Optionen `heizung`/`pumpen`) | `funktionen/*`, `steuerung.py`, `daten.py`, `sensor.py` (nur Importe) | **Verhalten gleich:** alle Integrationstests grün, `tests/panel/struktur-echt.json` aus dem Abgleich **byte-gleich** wie vorher; `steuerung.py` deutlich kürzer |
| **5 Seite nach Funktionen** | `struktur` liefert `funktionen: ["heizung", "pumpen"]`; Reiter Heizung/Pumpen nach Funktionen (heute: Pumpen nur mit Schächten) | `daten.py`, `baustelle-panel.js`, api §8 | Baustelle nur mit Pumpen zeigt keinen Heizungsreiter und umgekehrt (Test) |
| **7 Qualität (HACS, Platin)** | `quality_scale.yaml` mit jeder Regel (done/todo/exempt + Grund); fehlende Bronze–Gold-Regeln umsetzen, soweit sie zutreffen (z. B. Entitäts-Kategorien, Neu-Einrichten, übersetzte Fehlertexte, verwaiste Geräte entfernen, Protokoll einmal je Fehler); Platin: strenge Typisierung (`mypy --strict` für `custom_components/baustelle`), keine blockierenden Aufrufe; GitHub-Prüfläufe `hassfest` und `hacs/action` in `.github/workflows/`; Symbol `brand/icon.png` (+ `icon@2x.png`); README-Abschnitte, die die Skala verlangt. **Releases** und Repo-Beschreibung/Themen auf GitHub macht Herbert | `quality_scale.yaml`, `.github/workflows/validate.yml`, `pyproject.toml`, alle `.py` (Typen), `README.md` | `mypy --strict` ohne Fehler; hassfest lokal bzw. Prüfschritte grün, soweit ohne GitHub möglich; jede Regel in `quality_scale.yaml` begründet; alle Tests grün |
| **6 Doku und Prüfung** | README „Aufbau“, CLAUDE.md Regeln, Anleitung „Neue Funktion anlegen (Beispiel Kühlung)“ in `docs/funktion-anlegen.md`; unabhängige Prüfung (Review-Agent) gegen diesen Bauplan | `README.md`, `CLAUDE.md`, `docs/` | Review ohne offene Befunde; Bauplan-Häkchen gesetzt |

## 5. Entscheidungen und Grenzen

- **Keine sichtbaren Änderungen**, außer wo zwei Rechenwege heute verschiedene Zahlen liefern – dann gilt die Rechnung
  der Integration, und die Abweichung steht hier mit Beispiel.
- **„Je Gerät · Stunden“** bleibt eine Schätzung (kWh ÷ Ø kW), rechnet aber die Integration. Echte Stunden je Gerät
  zählen wäre ein neuer Zähler – nicht Teil dieses Umbaus.
- **Kein Umzug der Store-Daten**, keine neuen Entitäten, keine geänderten entity_ids; die Befehle aus api-0.7 §1–§7
  bleiben unverändert (nur neue kommen dazu).
- **Abweichungen der Seite** (Phase 0/1, Referenzwerte `tests/vektoren/auswertung-*.json` mit `abweichung`; es gilt
  `logik/auswertung.py`):
  - **Firma je Tag statt je Stunde (Zeitraum „Tag“, Tabelle und CSV):** Die Seite ordnete jede Stunde der Firma zu dieser
    Stunde zu, Woche/Monat und Bericht aber den ganzen Tag der Firma zu Tagesbeginn. Beispiel `struktur-echt`,
    Wohnbau, Magazin ab 29.09. 05:30 bei Huber: Seite „Tag“ Eigene Firma 42,20 kWh + Huber 11,24 kWh, „Woche“ am selben
    Tag alles Eigene Firma; jetzt überall Eigene Firma 53,44 kWh, Huber ab 30.09. (`auswertung.firma_am_tag`, wie
    bisher der Bericht).
  - **Firma je Tag statt je Monat (Zeitraum „Jahr“):** Die Seite gab den ganzen Monat der Firma am Monatsersten.
    Beispiel `struktur-0.7`, Dobl, Jahr 2026 (Magazin ab 08.09. Huber, Lager ab 15.09. Leitner): Seite alles Eigene
    Firma 29 756,99 kWh; richtig Eigene Firma 29 330,50 + Huber 257,56 + Leitner 168,93 kWh – dieselben Firmenwerte wie
    im Monat September. `abrechnung()` bekommt beim Jahr deshalb Werte je Tag (Phase 2: Recorder mit `period: day`).
    Das CSV „Verbrauch“ bleibt je Monat eine Zeile mit der Firma am Monatsersten.
  - **Heiztage ohne Zähler (Verlauf, Detailseite, Kosten je Tag im Typvergleich):** Die Seite zählte Tage mit mehr als
    0,5 kWh der ganzen Baustelle (auch Pumpen, Bereitschaft am Wochenende); richtig sind Tage ab Beginn mit Heizzeit
    eines Containers wie Zähler `heiztage` und Bericht (0.7.9); Monate = Monate mit einem Heiztag. Beispiel
    `struktur-0.7`, Dobl (kein Zähler `heiztage`): Seite 22 Heiztage, richtig 16; Kalsdorf 9 → 7. Mit Zähler (z. B.
    `struktur-echt`, Halle 96) gleich. Die Regel steht einmal in `auswertung.heiztag_daten`; `bericht.heiztage` nutzt sie.
- **Reihenfolge der Firmen im Bericht (Phase 2):** Bericht, Mail und CSV-Anhang nehmen dieselbe Abrechnung wie die Seite
  (`auswertung.abrechnung_daten`) – eigene Firma zuerst, dann die Firmen in der Reihenfolge ihres ersten Verbrauchs
  (bisher im Bericht in der Reihenfolge der Firmenliste). Beispiel: Firmenliste Eigene Firma, Maier, Huber, Huber
  verbraucht im Zeitraum vor Maier → Bericht jetzt Eigene Firma, Huber, Maier (Zahlen gleich).
- **Firmenregel einmal (Nachbesserung Phase 2/3):** Die Regel „Firma je Tag“ und der Firmen-CSV-Bau stehen nur noch in
  `logik/auswertung.py` (`firma_am_tag`, `abrechnung`, `csv_firma`). Die frühere zweite Kopie in `logik/abrechnung.py`
  (`aufteilen`, `csv_zeilen`, `abrechnung_zeilen`) ist entfernt, ihre Testfälle laufen jetzt gegen `auswertung.abrechnung`;
  `logik/abrechnung.py` behält nur `firma_am`/`firma_von` (Firma zu einem Zeitpunkt, gelöschte Firma → eigene) und
  `zahl`. Ein `ab` ohne Zeitzone (z. B. „2026-09-15“) gilt in der Zone der Baustelle, wie früher in `aufteilen`.
- **Firma je Container „jetzt“ (Nachbesserung Phase 3):** Die Seite rechnete sie noch selbst aus der Zuordnung
  (`firmaVon`, derselbe Nachbau wie `firmaAm`). Jetzt liefert `baustelle/struktur` sie als
  `laufzeit.container[bid].firma` (`abrechnung.firma_von`, api-0.7); die Seite zeigt sie nur an. Sichtbar gleich.
- **Sichtbare Unterschiede der Seite durch Phase 3** (alle ohne andere Zahlen):
  - **Lade-Zustand:** Solange die Antwort von `baustelle/auswertung` fehlt, zeigen Verlauf (Karten der Baustellen) und
    Detailseite kWh, € und Heiztage als „–“ bzw. „Lädt …“, die Tabelle „Ölradiator oder Konvektor“ „–“. Bisher standen
    dort sofort Werte aus Zählern und Sensorzuständen, die danach von der Statistik-Rechnung überschrieben werden
    konnten. Beispiel `struktur-0.7`: Verlauf öffnen, Dobl zeigt kurz „–“ kWh, dann 412 kWh; vorher stand der
    Zählerstand 412 kWh sofort da. Die
    Seite nimmt keinen Ersatzwert mehr, damit nur eine Zahl erscheint – die der Integration.
  - **Nicht geladene Baustellen im Verlauf und auf der Detailseite:** Die Anzahl Container und die Liste „Verbrauch je
    Monat“ kommen jetzt aus der Einrichtung der Baustelle (Subentries, wie in `baustelle/auswertung`); bisher war sie
    bei einer nicht geladenen Baustelle leer (0 Container), weil `baustelle/struktur` dort keine Bereiche liefert.
  - **„Ohne Automatik“ – „Noch keine Werte“:** Bedingung unverändert (Dauerbetrieb-Wert ≤ 0); die Regel steht jetzt in
    `auswertung.ohne_automatik` (liefert dann `null`), die Seite prüft nur noch auf `null`.
- **Funktionen-Module (Phase 4/5):** `aktiv()` einer Funktion = ihre Option (`heizung`, Standard ein; `pumpen`,
  Standard aus). Wie vor dem Umbau schaltet und regelt nur eine aktive Funktion (`soll`, Warnungen der Container,
  Status); **gemessen, angezeigt und gezählt wird für alle Bereiche**, die es gibt – eine Pumpe in einem Schacht wird
  also auch ohne Option `pumpen` überwacht (bisher genauso, die Steuerung kannte die Option nicht). Beispiel: Baustelle
  mit `pumpen: false` und einem Schacht – Warnung „Trockenlauf“ und Zähler `pumpzeit` wie bisher; neu (Phase 5) fehlt
  dort nur der Reiter Pumpen auf der Seite. Statt einer Methode `struktur()` je Funktion nennt `baustelle/struktur` die
  Namen der aktiven Funktionen (`funktionen.aktive`) – eine Funktion braucht bisher keine eigenen Felder in der Struktur.
  Nachbesserung (0.7.19): Handbetrieb, Heiz-Energiezähler (`energie_heizen`, `energie_typ:*`), Status der Baustelle
  (Heizung: Automatik/Plan/„alle jetzt heizen“; Pumpen: `nur_pumpen`) und der Protokolltext „Modus: …“ laufen über
  die Schnittstelle. Den Handbetrieb bestimmt die Funktion des **Bereichs** (nicht der Rolle), damit Steckdosen und
  Trockner im Container wie bisher auf Hand gehen; Pumpenschacht und Rolle Pumpe gehören laut Einrichtung immer
  zusammen, die Pumpen kennen keinen Handbetrieb. Keine sichtbare Abweichung (`struktur-echt*.json` byte-gleich).
  Zweite Nachbesserung (0.7.20, nach Prüfung): Der Kern legt die Funktionen aus `funktionen.FUNKTIONEN` an
  (`st.funktion(name)`, außerhalb `Heizung.von(st)`), statt sie von Hand zu verdrahten. Zur Heizung gezogen:
  Heizgrenze (`zu_warm`), Heizplan (`plan`, `heiz_regeln`, `ist_frei`, „Noch früher“), Termine der Bedarfs-Container
  (`async_kalender`, `kalender_neu`), Frostschutz bei Automatik aus (`schaltet_ohne_automatik`), Wetter-Einträge im
  Protokoll (`nach_schalten`), Protokolltext „Tür offen“ (`warnung_protokoll`), Einstellungen für die Warnungen
  (`warn_einstellungen`), Türkontakte (`entitaeten`), Hochrechnung auf die Heizperiode; `pumpe_laeuft` zu den Pumpen.
  Die Automatik gibt es, sobald eine aktive Funktion `schaltet` (heute nur Heizung, wie bisher); die Warnung „keine
  Wettervorhersage“ nur mit einer aktiven Funktion, die `braucht_wetter`. Die Staffelung fragt die Funktion der Rolle
  (`schaltbar`, `standard_kw`, `staffel_feld`) und des Bereichs (`staffel_vorrang`: Frost, Boost, Defizit); die
  Anlauf-Reihenfolge steht in `logik/staffel.anlauf_folge`. Test: Probe-Funktion „Kühlung“ nur über `FUNKTIONEN`
  (Automatik, Staffelung, Schalten, Anzeige, Status) und ein Test, der Heizungs-/Pumpen-Namen in `steuerung.py` sucht.
  Im Kern bleiben nur die Feldnamen von `logik/staffel.Last` (`heizer`) und `logik/warnungen` (`container`) sowie der
  Protokolltext „… – alle Container ein/aus“. Kleine unsichtbare Änderungen: ein Türkontakt wird nur noch einmal
  beobachtet (bisher bei jedem Setzen erneut), und nur Türkontakte von Containern. Keine sichtbare Abweichung
  (`struktur-echt*.json` byte-gleich bis auf die Versionsnummer).
  **Für die Anleitung (Phase 6) festhalten:** Außerhalb des Kerns greifen Seite, Nachrichten und Entitäten weiter
  direkt auf die Heizung bzw. die Pumpen zu (`daten.py`: Plan, Termine, Bedarf/Boost, Modus, Heizgrenze,
  `pumpe_laeuft`; `panel.py`/`nachrichten.py`: Hand beenden, „Trotzdem heizen“, „Noch früher“, Frühstart;
  `sensor.py`/`binary_sensor.py`: Ersparnis, Hochrechnung, Mittel je Typ, Pumpe läuft; `entity.MODELL` braucht das
  Gerätemodell einer neuen Bereichsart). Eine neue Funktion mit eigener Anzeige braucht dort eigene Stellen.
- **Kühlung** wird nicht gebaut; `docs/funktion-anlegen.md` beschreibt, wie sie später als Modul dazukommt.

## 6. Ausführung mit Agenten

- Ein Workflow, **Phasen nacheinander** (sie bauen aufeinander auf und berühren teils dieselben Dateien), je Phase ein
  Bau-Agent, danach ein **Prüf-Agent**, der die Akzeptanz der Phase unabhängig nachprüft; rote Prüfung → zurück an den
  Bau-Agenten (höchstens zweimal), sonst Abbruch mit Bericht. Rund 8–10 Agenten.
- Jede Phase committet selbst (`[vX.Y.Z] Modul, Typ: …`), **kein Push, kein Einspielen** – beides nach Abschluss mit
  Herbert.
- **Während des Umbaus arbeitet keine andere Claude-Sitzung am Repo** (Ticket-Fenster pausieren).
- Nach dem Umbau: HA-Sicherung durch Herbert → Einspielen → Neustart → Sichtprüfung der Auswertung und Abrechnung.

## 7. Status

- Freigegeben von Herbert am 30.09.2026 (mit Phase 7).
- [x] Phase 0 · [x] Phase 1 · [x] Phase 2 · [x] Phase 3 (Nachbesserung nach Prüfung: Firmenregel einmal, Firma je
  Container aus der Struktur, sichtbare Unterschiede in §5) · [x] Phase 4 (0.7.17; `struktur-echt.json` byte-gleich bis auf
  die Versionsnummer; Nachbesserung 0.7.19: Hand, Heiz-Energie, Status und Modus-Text über die Schnittstelle;
  Nachbesserung 0.7.20: Kern ohne Heizungs-/Pumpen-Regeln, Funktionen aus `FUNKTIONEN`, Staffelung über die Funktionen) ·
  [x] Phase 5 (0.7.18) · [ ] Phase 7 · [ ] Phase 6
