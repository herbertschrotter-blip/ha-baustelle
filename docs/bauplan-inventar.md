# Bauplan Container-Inventar

Eigene Container und Ausrüstung bekommen eine **Inventarnummer mit Geschichte**: Ein Container behält Nummer, Standorte
und Verbrauch, wenn er von Baustelle zu Baustelle wandert; ein Gerät behält seine Geschichte, wenn es den Container
wechselt. Namen und Labels in HA, am Plug und in den BTHome-Kopplungen bildet die Integration selbst nach dem Schema –
mit Vorschau, ein Klick übernimmt, rückgängig möglich. Fremdcontainer bekommen Firmenkürzel und Nummer je Baustelle.

Stand: Plan vom 08.10.2026, Kürzel deutsch nach Herbert am selben Tag (BSM-031.01, Sitzung „ha-baustelle Teil 5“), noch nichts gebaut. Entscheidungen Herberts vom
05.10.2026 (Aufgabe BSM-031) und 08.10.2026 (§1; geht vor, wo es abweicht). Etappe I im Fahrplan, Unteraufgaben BSM-031.01–.10.

## 1. Entscheidungen

| Punkt | Entscheidung |
|---|---|
| Eigene Container | Inventar in der Datenbank; Nummer NNN **für die ganze Firma** (08.10.): eine Folge in der gemeinsamen Datenbank, mit SQLite nur je HA-Instanz. Die Nummer gilt für immer und wird nie neu vergeben |
| Ausrüstung | Inventar mit eigener ID und Status `aktiv` / `verliehen` / `defekt` (löst „inaktiv“ aus WU-0004 ab); GG zählt je Container fortlaufend |
| Fremdcontainer | `<FIRMA>-NN`, NN je Baustelle und Firma; keine Inventarnummer; verlässt er die Baustelle, scheidet er aus, seine Daten bleiben bei der Baustelle |
| Kürzel | **deutsch** (08.10., ändert die englischen vom 05.10.): Containerarten POL, MAN, BES, BUE, LAG, MAT, SAN, TRO; Geräte wie im heutigen Schema PLUG, HZ, TEMP, DOOR, neu FEN, PUMP, BTR. Eine Tabelle an einer Stelle (§3), erweiterbar |
| Endungen, Labels | deutsch wie bisher (§4, §5) |
| Umbenennen | **alles samt Entity-IDs** (08.10.): HA-Gerät, Entitätsnamen, Entity-IDs, Plug-Name, BTHome-Kopplungen, Labels – mit Vorschau, ein Klick, Protokoll, rückgängig |
| Bestand | Kürzel und Nummern bleiben (`001_C_POL`, `002–004_C_MAN`); über dieselbe Vorschau werden nur alte Namen und Entity-IDs (`switch.heizung_03`, `hz03_…`, `tursensor_01_…`) aufs Schema gebracht |
| Pumpenschächte | vorerst nicht im Inventar, behalten ihre Namen (08.10.) |
| Aufkleber | Name und QR-Code (öffnet die Seite des Containers) – später (BSM-031.10) |

## 2. Datenmodell (Datenbank, Aufbau 9)

Heute spiegelt die Datenbank die HA-Unter-Einträge: `bereich` (Container/Pumpenschacht, je Baustelle) und `geraet`
(Shelly-Schalter, je Baustelle). Das bleibt – HA verlangt die Unter-Einträge. Neu kommt das Inventar **über den
Baustellen** dazu und wird mit den Unter-Einträgen verknüpft:

| Tabelle | Spalten | Schlüssel |
|---|---|---|
| `container` | `id` (UUID), `nr` (NNN, nur eigene), `art` (Kürzel §3), `firma_kuerzel` (nur fremde), `fremd_nr` (NN, nur fremde), `status` (aktiv/ausgeschieden), `angelegt`, `notiz` | `id`; eindeutig `nr` (eigene) |
| `container_einsatz` | `container_id`, `baustelle_id`, `bereich_id`, `instanz_id`, `von`, `bis` | (`container_id`, `von`) |
| `ausruestung` | `id` (UUID), `typ` (Kürzel §3), `modell` (z. B. „Shelly Plug S Gen3“), `kennung` (MAC bzw. HA-Gerät-ID, nie im Repo), `status` (aktiv/verliehen/defekt), `angelegt`, `notiz` | `id`; eindeutig `kennung` |
| `ausruestung_einsatz` | `ausruestung_id`, `container_id`, `gg`, `geraet_id` (Unter-Eintrag, falls geschaltet), `von`, `bis` | (`ausruestung_id`, `von`) |
| `umbenennung` | `id`, `zeit`, `benutzer`, `container_id`, `schritte` (JSON: je Ziel alt → neu), `status` (ausgefuehrt/teilweise/zurueck) | `id` |

- `firma` bekommt `kuerzel` (2–5 Großbuchstaben, eindeutig je Baustelle) – Pflicht, sobald ein Fremdcontainer der Firma
  angelegt wird.
- `bereich` bekommt `container_id`, `geraet` bekommt `ausruestung_id` (leer = noch nicht im Inventar).
- **Geschichte** = die Einsätze: Verbrauch, Heiztage und Protokoll eines Containers über alle Baustellen ergeben sich über
  `container_einsatz` → `bereich_id` aus den vorhandenen Tabellen; nichts wird kopiert.
- **Nummer vergeben:** in einer Transaktion `max(nr) + 1` mit eindeutigem Index; scheitert sie (zweite Instanz gleichzeitig),
  neu versuchen. Anlegen braucht die Datenbank – ist sie nicht erreichbar, lehnt die Seite das Anlegen mit Hinweis ab
  (der Puffer nimmt nur Messwerte und Ereignisse).
- Einsatz beenden statt löschen (`bis` setzen); ausgeschiedene Container bleiben mit Geschichte lesbar.
- Ansicht für Excel: `v_inventar` (Container mit aktuellem Einsatz und Ausrüstung) für `baustelle_leser`.

## 3. Kürzeltabelle (eine Stelle: `logik/inventar.py`)

| Containerart | Kürzel | Label |
|---|---|---|
| Polier | POL | Polier |
| Mannschaft | MAN | Mannschaft |
| Besprechung | BES | Besprechung |
| Büro | BUE | Büro |
| Lager | LAG | Lager |
| Material | MAT | Material |
| Sanitär | SAN | Sanitär |
| Trocken | TRO | Trocken |

| Gerät | Kürzel | Label (Gerätetyp) |
|---|---|---|
| Shelly-Plug (Schalter) | PLUG | Shelly Plug |
| Heizkörper | HZ | Heizkörper |
| Temperaturfühler | TEMP | Shelly H&Temp Sensor |
| Türkontakt | DOOR | Shelly Door Sensor |
| Fensterkontakt | FEN | Shelly Door Sensor |
| Pumpe | PUMP | Pumpe |
| Bautrockner | BTR | Bautrockner |

Neue Kürzel kommen nur hier dazu (mit Test); Seite und Datenbank lesen die Tabelle von der Integration.

## 4. Namensregeln (`logik/inventar.py`, mit Test)

| Was | Eigen | Fremd |
|---|---|---|
| Container | `NNN_C_<Art>` – `002_C_MAN` | `<FIRMA>-NN_C_<Art>` – `STRA-01_C_MAN` |
| Plug | `NNN-GG_C_PLUG_<Art>` – `002-01_C_PLUG_MAN` | `STRA-01-01_C_PLUG_MAN` |
| Heizkörper (Gerät der Integration) | `NNN-GG_C_HZ_<Art>_<Typ><Nr>` – `002-01_C_HZ_MAN_Konvektor01` | `STRA-01-01_C_HZ_MAN_Konvektor01` |
| Fühler, Tür, Fenster | `NNN_C_TEMP_<Art>`, `NNN_C_DOOR_<Art>`, `NNN_C_FEN_<Art>` | `STRA-01_C_TEMP_MAN` |
| Messwerte | `<Gerätename>_Temperatur`, `_Feuchte`, `_Batterie`, `_Tuer`, `_Drehung`, `_Lichtstufe`, `_Licht` | ebenso |
| Entity-ID | Name klein, `-` → `_`: `switch.002_01_c_plug_crw`, `sensor.002_c_temp_crw_temperatur` | `switch.stra_01_01_c_plug_crw` |

- `<Typ>` = `Konvektor` bzw. `Radiator` (Typ des Geräts), `<Nr>` zweistellig je Typ im Container.
- Mehrere Fühler/Türen im selben Container: ab dem zweiten mit Nummer (`NNN_C_DOOR_MAN_2`) – selten, Regel im Test.
- Ist eine Entity-ID schon vergeben (fremde Entität), hängt HA nichts an: Die Vorschau zeigt den Konflikt, der Schritt
  bleibt aus, bis er gelöst ist.
- Pumpenschächte bleiben ohne Inventar (§1); die Regeln lassen Platz für eine weitere Art.

## 5. Labelregeln

Je Container: Label „Container“ und die Art („Mannschaft“ …); bei Fremdcontainern zusätzlich die Firma (Name aus der
Abrechnung). Je Gerät zusätzlich der Gerätetyp (§3). Labels legt die Integration an, wenn sie fehlen, und entfernt nur
Labels aus dieser Liste (eigene Labels von Herbert bleiben). Bereich (Area) in HA bleibt unberührt.

## 6. Vorschau, Ausführen, Rückgängig

1. **Auslöser:** Container anlegen, Gerät zuordnen oder wechseln, Art ändern, Bestand umstellen – oder „Namen prüfen“ am
   Container.
2. **Vorschau** (Dialog auf der Seite): je Ziel eine Zeile alt → neu, gruppiert nach HA-Gerät, Entitäten (Name und
   Entity-ID), Plug-Name, BTHome-Kopplungen, Labels. Markiert: unverändert, neu, Konflikt (§4), nicht erreichbar (Plug
   offline). Hinweis, wenn eigene Automationen, Skripte oder Dashboards eine alte Entity-ID nennen (Suche in HA), mit Liste.
3. **Übernehmen** (ein Klick, nur Admins): in fester Reihenfolge – Entity-IDs und Namen (Entitätsregister), HA-Gerät
   (`name_by_user`), Labels, eigene Verweise der Integration (Schalter, Leistung, Energie, Fühler, Tür im Unter-Eintrag),
   dann Plug (`Sys.SetConfig` Name) und BTHome (`BTHomeDevice/BTHomeSensor.SetConfig`, wie die Kopplungspflege BSM-030).
   HA zieht Verlauf und Langzeitstatistik bei geänderter Entity-ID selbst mit; die eigene Datenbank speichert IDs der
   Unter-Einträge, nicht Entity-IDs, und ist nicht betroffen.
4. **Protokoll:** eine Zeile je Umbenennung im Protokoll der Baustelle, alle Schritte in `umbenennung`.
5. **Teilweise:** scheitert ein Schritt (Plug offline), bleiben die übrigen; Status `teilweise`, die Seite bietet
   „fehlende Schritte nachholen“ an (bei der nächsten Erreichbarkeit auch selbst).
6. **Rückgängig:** spielt die Schritte einer Umbenennung in umgekehrter Reihenfolge mit den alten Werten zurück, wieder
   mit Vorschau; nur die jüngste Umbenennung je Container, solange danach nichts anderes umbenannt wurde.

Die Automatik bleibt dabei an; während der Umbenennung hält die Integration das Schalten des betroffenen Containers
kurz an (Verweise werden getauscht) und schaltet danach wie vorher.

## 7. Umsetzung in Schritten (je eigene Lieferung)

| ☐ | Schritt | Inhalt | Herbert sieht |
|---|---|---|---|
| ☑ | .02 Datenbank | Aufbau 9 in 0.8.106: Tabellen §2, `firma.kuerzel`, Verknüpfung, `v_inventar` (Leser darf sie lesen); Umzug kopiert alles, Rückweg die Container, die je auf einer Baustelle der Instanz standen, mit Ausrüstung und Umbenennungen (freie Ausrüstung ohne Container bleibt in PostgreSQL) | nichts |
| ☐ | .03 Regeln | `logik/inventar.py`: Kürzel, Namen, Entity-IDs, Labels, Nummernvergabe, Konflikte – mit Tests | nichts |
| ☑ | .04 Mockup | `mockups/inventar.html` – **Variante 1 abgenommen 08.10.2026**: Einstellungen › 📦 Inventar (Liste, Container, Anlegen eigen/fremd, Zuordnen), Vorschau als Tabelle Was/Alt/Neu/Zustand, Übernehmen, Nachholen, Rückgängig | Mockup |
| ☐ | .05 API | WebSocket-Befehle `baustelle/inventar*` (lesen für alle, ändern nur Admins), `docs/api-0.7.md` | nichts |
| ☐ | .06 Umbenennen | Ausführen, Protokoll, teilweise/nachholen, Rückgängig (§6); Integrationstests mit Plug-Attrappe | nichts |
| ☐ | .07 Seite | Inventar, Dialoge, Vorschau nach dem abgenommenen Mockup | neue Ansicht |
| ☐ | .08 Status | aktiv/verliehen/defekt statt „inaktiv“; verliehen/defekt = Automatik lässt aus wie bisher | Status am Gerät |
| ☐ | .09 Bestand | vorher Sicherung; Container 001–004 ins Inventar übernehmen (Nummern und Kürzel bleiben), alte Namen und Entity-IDs über die Vorschau angleichen; danach regelt die Integration unverändert | neue Entity-IDs |
| ☐ | .10 Aufkleber | Name und QR-Code (später) | – |

## 8. Offen

- **Ausrüstung ohne Schalter** (Fühler, Tür, Fenster): erkennt die Integration über das HA-Gerät; Bautrockner und Pumpe
  ohne Shelly kommen erst mit einem Schalter ins Inventar.
- **Kennung:** MAC aus dem HA-Gerät (Shelly, BTHome); steht nur in der Datenbank, nie im Repo oder in Beispieldaten.

- **Aus dem Mockup (08.10.2026), beim Bau klären:** Name des Bereichs (Anzeigename im Unter-Eintrag bleibt, Inventarname
  daneben – so im Mockup angenommen); Bautrockner als `NNN-GG_C_BTR_<Art>`; Endungen am Plug `_Leistung`, `_Energie`;
  BTHome-Batterie als eigener Messwert oder nicht; nimmt Shelly `-` und `_` im Gerätenamen an; zählt „N Änderungen offen“
  auch Labels und BTHome-Schritte.

## 9. Tests

- `tests/logik/test_inventar.py`: jede Zeile aus §3 und §4 (eigen, fremd, mehrere Fühler, Konflikt, Entity-ID-Form),
  Labels §5, Nummernvergabe mit Lücke und Gleichzeitigkeit.
- Integration (SQLite und PostgreSQL): Aufbau 9, Anlegen, Zuordnen mit Einsatz-Geschichte, Umbenennen mit Statistik-
  Erhalt (Entity-ID-Wechsel), teilweise und Rückgängig, Bestand umstellen; zwei Instanzen vergeben keine Nummer doppelt.
- Panel und Browser: Dialoge und Vorschau wie im Mockup.
