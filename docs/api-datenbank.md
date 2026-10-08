# Schnittstelle Datenbank (Phase 9, BSM-027)

Was außerhalb der Seite mit den Daten der Baustelle arbeitet – Excel, Power BI, Buchhaltung, eigene Abfragen – und
welche Befehle und Aktionen die Integration dafür anbietet. Seit 0.8.61 ist die eigene Datenbank die Quelle aller
Daten (Einstellungen, Laufzeit, Protokoll, Meldungen, Messwerte); der Store ist nur noch Kopie. Vertrag Seite ↔
Integration: `docs/api-0.7.md` (gilt weiter, §9 für Statistik und Verlauf aus der Datenbank). Aufbau der Tabellen:
`docs/bauplan-datenbank.md` §2, Betrieb: `docs/betrieb.md`.

## 1. Zugang

| Art | Wo | Wer liest |
|---|---|---|
| SQLite (Standard) | Datei `/config/baustelle/baustelle.db` auf dem Pi | nur HA selbst; zum Auswerten eine Kopie nehmen (`sqlite3`, DB Browser), nie die laufende Datei sperren |
| PostgreSQL mit TimescaleDB | `baustelle: db_url: !secret baustelle_db_url` in YAML (z. B. `/config/packages/baustelle.yaml`); Server z. B. Add-on „TimescaleDB“ (`77b2833f-timescaledb:5432`, Datenbank `baustelle`) | Benutzer `baustelle_leser` – darf genau die Ansichten (§2) lesen, sonst nichts. Für Zugriffe aus dem Firmennetz Port 5432 im Add-on freigeben |

Einrichten des Servers und der Benutzer: `tools/db-einrichten.sh`. Mehrere HA-Instanzen dürfen in dieselbe
PostgreSQL-Datenbank schreiben; jede Zeile mit Messwerten trägt `baustelle_id`, die Baustelle trägt `instanz_id`.

**Zeiten** in UTC (`zeit`), **Tage** (`datum`, `monat`) in der Zeitzone der Baustelle. **IDs** sind die von HA:
Baustelle = `entry_id`, Container/Schacht = `bereich_id` (Unter-Eintrag), Gerät = `geraet_id` (Unter-Eintrag).

## 2. Ansichten (Aufbau 7) – für Excel und Power BI

Sie summieren nur, was die Integration fertig rechnet (kWh, € und Firma je Tag in `tag_bereich`); keine eigene Regel.

| Ansicht | Eine Zeile je | Spalten |
|---|---|---|
| `v_tag_firma` | Tag, Baustelle, Firma | `datum`, `baustelle_id`, `baustelle`, `firma_id`, `firma`, `container` (Anzahl), `kwh`, `eur`, `heizzeit_min`, `ohne_kwh` |
| `v_tag_container` | Tag, Container | `datum`, `baustelle_id`, `baustelle`, `bereich_id`, `container`, `firma_id`, `firma`, `kwh`, `eur`, `heizzeit_min`, `strom_min`, `ohne_kwh`, `temp_mittel`, `aussen_mittel` |
| `v_monat_baustelle` | Monat, Baustelle | `monat` (erster Tag), `baustelle_id`, `baustelle`, `kwh`, `eur`, `heizzeit_min`, `ohne_kwh` |
| `v_inventar` | Container (Aufbau 9) | `id`, `nr` (eigen), `art` (Kürzel), `firma_kuerzel`, `fremd_nr` (fremd), `status`, aktueller Einsatz `baustelle_id`, `baustelle`, `bereich_id`, `bereich`, `seit`; `ausruestung` (Anzahl Geräte gerade drin) – den Namen nach dem Schema bildet die Integration |
| `v_schaltungen` | Schaltvorgang | `zeit`, `baustelle_id`, `baustelle`, `bereich_id`, `container`, `geraet_id`, `geraet`, `wert` (`{"an": true/false}`), `quelle` (automatik, ha, hand, notprogramm, …), `grund` |

`heizzeit_min` = Minuten mit eingeschaltetem Heizkörper, `strom_min` = davon mit Stromfluss. `ohne_kwh` („ohne
Automatik“) ist derzeit leer – dieser Wert kommt noch aus der HA-Statistik (Bauplan Datenbank Phase 6, offen).

Excel (am 08.10.2026 erprobt): ODBC-Treiber **psqlODBC** in der Bit-Version von Office installieren, unter
„ODBC-Datenquellen“ eine Benutzer-DSN „PostgreSQL Unicode“ anlegen (Server = Adresse des Pi, Port 5432 im Add-on
freigegeben, Datenbank `baustelle`, Benutzer `baustelle_leser`; Knopf **Test** prüft Verbindung und Passwort), dann
Daten → Daten abrufen → Aus anderen Quellen → Aus ODBC. Der Weg „Aus PostgreSQL-Datenbank“ braucht den Treiber Npgsql
4.0.x im GAC und lief auf Herberts PC trotz Installation nicht.

## 3. Tabellen (Überblick)

Stammdaten `instanz`, `baustelle`, `bereich`, `geraet`, `anschluss`, `firma`, `zuordnung`, `preis`, `arbeitszeit`,
`ausnahme`; Einstellungen `einstellung` (jede Änderung mit Benutzer, nur Admin-Änderungen – Datenschutz §6),
`zustand` (Laufzeit, Zähler, Merker); Messwerte `geraet_minute`, `bereich_minute`, `wetter_minute`, `messwert` (jede
gemeldete Leistung), `ereignis` (Schaltungen, Tür, Bedienung vor Ort – ohne Person); Auswertung `tag_geraet`,
`tag_bereich`, `lernen`; `protokoll`; Meldungen `meldung` (mit `instanz_id`, Ticket je Instanz eindeutig),
`meldung_verlauf`, `meldung_bild`; Inventar (Aufbau 9, BSM-031) `container`, `container_einsatz`, `ausruestung`,
`ausruestung_einsatz`, `umbenennung` (über den Baustellen; `bereich.container_id`, `geraet.ausruestung_id`,
`firma.kuerzel` verknüpfen). Auf PostgreSQL sind `*_minute`, `messwert` und `ereignis` TimescaleDB-Hypertables.
Schreiben darf nur die Integration; der Aufbau kann sich mit einer neuen Version ändern (Nummer in `schema_version`) –
für dauerhafte Abfragen die Ansichten nehmen.

## 4. Befehle (WebSocket) und Aktionen

| Name | Zweck |
|---|---|
| `baustelle/statistik`, `baustelle/verlauf` | Diagramme der Seite aus der Datenbank (api-0.7 §9) |
| `baustelle/auswertung`, `baustelle/abrechnung`, `baustelle/ohne`, `baustelle/bericht` | Kennzahlen, Abrechnung nach Firma, CSV (api-0.7 §8) |
| `baustelle/protokoll` | Protokoll ohne Grenze, zum Blättern (`filter`, `vor`, `limit` bis 1.000) |
| `baustelle/meldungen`, `baustelle/meldung` | Meldungen der eigenen Instanz lesen bzw. anlegen/ändern |
| Aktion `baustelle.ticket` | Ticket ändern (Status, Notiz, Version, Commit) |
| Aktion `baustelle.notprogramm_pruefen` | Notprogramm aller Plugs jetzt prüfen (nur Admins) |
| Aktion `baustelle.datenbank_rueckweg` | Daten dieser Instanz aus PostgreSQL in eine neue SQLite-Datei (nur Admins; Antwort: Datei und Zeilen je Tabelle) |

## 5. Diagnose

Diagnose-Download der Baustelle, Abschnitt `datenbank`: `zustand` (ok, angehalten, fehler, aus), `art`
(sqlite/postgresql), `pfad` (Datei bzw. Adresse ohne Passwort), `schema_version`, `groesse_mb`, `warteschlange`,
`puffer` (abgelegte Schreibvorgänge), `letzte_schreibzeit`, `fehler`, `abgleich` (kWh je Container und Tag gegen die
HA-Statistik, 14 Tage) und `stand` (Zeilen je Tabelle für diese Baustelle, erste/letzte Minute, Instanz, Ticket-Zähler,
Umzug).
