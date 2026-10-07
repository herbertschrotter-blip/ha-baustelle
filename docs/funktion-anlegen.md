# Neue Funktion anlegen (Beispiel Kühlung)

Stand 30.09.2026 (0.7.22) · Grundlage: Bauplan `docs/bauplan-module.md` §3 und §5, Schnittstelle
`custom_components/baustelle/funktionen/basis.py`. Kühlung ist **nicht** gebaut – diese Anleitung zeigt am Beispiel, wo
eine neue Funktion hinkommt. Der Probe-Test `test_neue_funktion_ohne_eingriff_in_den_kern`
(`tests/integration/test_steuerung.py`) baut genau dieses Gerüst im Kleinen und ist die beste Vorlage.

Grundregeln:

- **Fachregeln nur in `logik/`**, ohne HA-Code, mit Test in `tests/logik/`.
- **Die Funktion ist ein Modul in `funktionen/`** mit der Schnittstelle aus `basis.py`. `steuerung.py` mit `kern/` (Kern) wird
  **nicht** geändert – der Test `test_kern_ohne_einzelheiten_der_funktionen` sucht dort nach Funktionsnamen.
- **Die Staffelung bleibt im Kern**; die Funktion sagt nur, welche Geräte geschaltet werden und mit welchem Vorrang.
- **Die Seite rechnet nichts Fachliches** (auch keine € oder % zu Werten der Integration), sie zeigt an, was
  `baustelle/struktur` liefert.
- Umbau-Commits nach der Versionsregel (neue Funktion = MINOR, sonst PATCH), alle drei Prüfungen grün.

## 1. Bereichsart und Rolle (`const.py`, Einrichtung, Texte)

Eine Funktion gehört zu **Bereichsarten** (wo) und **Geräterollen** (was hängt am Shelly). Für Kühlung z. B.:

```python
# const.py
CONF_KUEHLUNG: Final = "kuehlung"          # Option der Baustelle
ART_KUEHLRAUM: Final = "kuehlraum"         # Bereichsart
ROLLE_KUEHLGERAET: Final = "kuehlgeraet"   # Geräterolle
ROLLEN: Final = [ROLLE_HEIZKOERPER, ROLLE_BAUTROCKNER, ROLLE_PUMPE, ROLLE_STECKDOSE, ROLLE_KUEHLGERAET]
```

Dazu außerhalb des Kerns:

- `config_flow.py`: Option `kuehlung` beim Anlegen und unter „Konfigurieren“; die Prüfung „mindestens eine Funktion“
  (`keine_funktion`) um sie erweitern; `ART_KUEHLRAUM` in die Auswahl des Bereichs; die Prüfung `rolle_passt_nicht`
  (heute Pumpe ↔ Pumpenschacht) so erweitern, dass ein Kühlgerät nur in einen Kühlraum kommt.
- `translations/de.json` und `en.json`: Option (`data`, `data_description`), `selector.art.options.kuehlraum`,
  `selector.rolle.options.kuehlgeraet`, ggf. neue Fehlertexte; neue Status-Werte (siehe 3.) auch beim Status-Sensor.
- `entity.MODELL`: Gerätemodell der neuen Bereichsart (`"kuehlraum": "Kühlraum"`), sonst fehlt das Gerät in HA.
- `daten.ROLLE_API`: Name der Rolle für die Seite (z. B. `"kuehlgeraet": "kuehlung"`).
- Tests in `tests/integration/test_config_flow.py` (Option, Art, Rolle passt nicht).

## 2. Fachlogik (`logik/kuehlung.py` + `tests/logik/test_kuehlung.py`)

Alles, was eine Regel ist, kommt als reine Funktion nach `logik/` – ohne `hass`, ohne Zustände, nur Werte rein, Werte
raus. Für Kühlung etwa:

- Soll je Kühlraum: kühlen, wenn Innen > Soll + Hysterese in der Arbeitszeit (Tagesplan aus `logik/arbeitszeit.py`
  wiederverwenden, nicht nachbauen), Grund als Text wie bei `logik/regelung.Soll`.
- Warnregeln (z. B. „kühlt, aber Temperatur steigt“) als Erweiterung von `logik/warnungen.py`, falls nötig.
- Zählregeln (Kühlzeit, Kühltage) wie `logik/zaehlen.py`.

Jede Regel mit Tests in `tests/logik/` (Grenzfälle: Hysterese, Wochenende, Fühler fehlt). Gibt es die Regel schon
(Arbeitszeit, Staffelung, Firma, Auswertung), wird sie benutzt, nicht kopiert.

## 3. Modul (`funktionen/kuehlung.py`)

Eine Klasse, die von `Funktion` erbt. Die Klassenfelder sagen dem Kern, was die Funktion ist; die Methoden liefern, was
er in jeder Auswertung braucht (Reihenfolge und Bedeutung im Kopf von `basis.py`). Was nicht gebraucht wird, bleibt
weg – die Standardmethoden tun nichts.

```python
"""Funktion Kühlung: Kühlräume nach Arbeitszeit und Temperatur kühlen (Bauplan Module §3)."""

class Kuehlung(Funktion):
    name = "kuehlung"                 # Name in `baustelle/struktur` (`funktionen`) und für `st.funktion(name)`
    option = CONF_KUEHLUNG            # Option der Baustelle, die sie einschaltet
    standard = False                  # neue Funktionen standardmäßig aus
    arten = (ART_KUEHLRAUM,)
    rollen = (ROLLE_KUEHLGERAET,)
    schaltet = True                   # schaltet Geräte → es gibt die Automatik (startet aus)
    braucht_wetter = False
    standard_kw = 1.5                 # Leistung ohne Messung (Staffelung)
    staffel_feld = "kuehl_kw"         # Feld in der Anzeige der Anschlüsse (api `staffel`)

    def soll(self, jetzt, wetter):            # nur aktive Funktion; ruft logik/kuehlung
        ...
    def schaltbar(self, g):                   # welche Geräte die Staffelung schaltet
        return g.rolle == ROLLE_KUEHLGERAET
    def staffel_vorrang(self, soll, schaltet):  # Felder von logik/staffel.Last, sonst {}
        ...
    def anzeige(self, bid, info, jetzt, soll, offline, an):   # (zustand, text, grund) für die Kachel
        ...
    def zaehlen_geraet(self, g, an, leistung, stunden):       # z. B. Zähler kuehlzeit:<gid>
        ...
    def status(self, jetzt):                  # (status, text, nächster Schaltpunkt) oder None
        ...
```

Eintragen in `funktionen/__init__.py`:

```python
FUNKTIONEN: tuple[type[Funktion], ...] = (Heizung, Pumpen, Kuehlung)
```

Damit legt der Kern die Funktion an, ordnet ihr über `arten` die Bereiche zu (`st.funktion_von`), nimmt ihre Geräte in
die Staffelung, schaltet sie nur bei eingeschalteter Automatik und nimmt ihren Status, wenn keine Funktion davor einen
liefert. Hinweise:

- Die Reihenfolge in `FUNKTIONEN` zählt beim Status: die erste aktive Funktion mit einem Status bestimmt ihn. Ein neuer
  Status-Wert muss in `sensor.STATUS` und in den Übersetzungen des Status-Sensors stehen.
- Handbetrieb nur mit `hand_setzen`/`hand_seit`; Kalender über `async_kalender`/`kalender_neu`; eigene Einstellungen
  auf der Seite im Store der Integration, Protokolltext über `einstellung_text`.
- Gemessen, angezeigt und gezählt wird für alle Bereiche, die es gibt; geschaltet nur über `soll` der aktiven Funktion
  (Bauplan §5).

Test in `tests/integration/test_steuerung.py` nach dem Vorbild des Probe-Tests: Baustelle mit Kühlraum und Kühlgerät,
Automatik ein → Gerät schaltet, `staffel.anschluesse[..]["kuehl_kw"]`, Anzeige und Status stimmen; Automatik aus →
nichts wird geschaltet.

## 4. Entitäten, Nachrichten (nur wenn nötig)

Energie und Kosten je Bereich bucht der Kern für alle Geräte. Eigene Entitäten brauchen eigene Stellen außerhalb des
Kerns, wie heute bei Heizung und Pumpen (`sensor.py`: Zähler je Rolle in `_geraet_zaehler`, `binary_sensor.py`:
„Pumpe läuft“ je Rolle; `nachrichten.py`/`panel.py`: Knöpfe und Befehle, die auf `Heizung.von(st)` zugreifen). Für
Kühlung z. B. Zähler `kuehlzeit` je Kühlgerät in `_geraet_zaehler`, Übersetzung unter `entity.sensor`. Neue Entitäten
mit `entity_category`, wenn sie Diagnose sind, und immer mit Übersetzung (Qualitätsskala).

## 5. Struktur-Feld (`daten.py`, `docs/api-0.7.md`)

`baustelle/struktur` nennt die eingeschalteten Funktionen schon von selbst (`funktionen.aktive` → `"funktionen":
["heizung", "kuehlung"]`). Braucht die Seite Laufzeitwerte der Kühlung (z. B. „kühlt seit“, nächster Schaltpunkt), kommt
ein eigenes Feld in `daten.py` dazu – aus `Kuehlung.von(st)`, fertig gerechnet – und wird in `docs/api-0.7.md` §8
beschrieben. Test in `tests/integration/test_api.py`; `tests/panel/struktur-*.json` um Beispielwerte ergänzen.
Bestehende Felder und Befehle aus api-0.7 §1–§7 bleiben unverändert.

## 6. Reiter auf der Seite (`frontend/baustelle-panel.js`)

Die Reiter kommen aus `funktionen` der Struktur (heute `mitHeizung`, `mitPumpen` in der Navigation). Für Kühlung:

- in der Navigation einen Reiter `['kuehlung', 'Kühlung']` nur mit `d.funktionen.includes('kuehlung')` (und mindestens
  einem Kühlraum),
- eine Ansicht, die **nur anzeigt**, was die Struktur liefert (Zustand, Text, Grund, Zähler) – keine Regel nachbauen,
- Illustration/Kachel des Kühlraums in der Übersicht nach dem abgenommenen Mockup (`mockups/glas.html`; neue Gestaltung
  vorher als Mockup abnehmen lassen).

Test in `tests/panel/test_panel.js` nach dem Vorbild „Reiter nach den Funktionen der Baustelle“ (Phase 5): Baustelle
mit `funktionen: ["kuehlung"]` zeigt den Reiter Kühlung, aber nicht Heizung und Pumpen, und umgekehrt.

## 7. Abschluss

- README (Stand, Einrichtung, Entitäten, Bekannte Grenzen), `quality_scale.yaml` prüfen (neue Entitäten, Übersetzungen),
  CHANGELOG-Eintrag, `tools/changelog.py`.
- Alle drei Prüfungen grün (logik, integration, panel), dazu `mypy --strict custom_components/baustelle`.
- Einspielen und Neustart macht Herbert (README „Auslieferung“); die Automatik startet ausgeschaltet.
