# Inventar für den Lit-Umbau (BSM-022, vor Stufe 3a)

Stand 06.10.2026 (0.8.81): was noch als HTML-Text (`v_*`, `sheet()`) gezeichnet und über `data-act` in `klick()` bedient
wird, mit Zielstufe (`docs/bauplan-lit.md` §3). Ansichtsbezogene Einblendungen und Diagramme ziehen mit ihrer Ansicht um;
gemeinsame Vorlagen bleiben im Shadow Root. Erledigtes wird abgehakt; am Ende (Stufe 4) gibt es keinen `data-act`-Fall
und kein `unsafeHTML` mehr.

Bereits Lit: Rahmen (2b), „Über“ (2a.1), Melde-Dialog (2a.2), Laden/Fehler/Leer und Entwicklung (3a), Verlauf und
Detailseite (3b), Pumpen und Pumpenschacht samt Zeitraum-Wahl (3c), Container-Ansicht samt Einblendungen außer „Aussehen“, Reiter Heizung mit Blöcken und Dialogen (3d), Einstellungen mit allen Dialogen und Notprogramm (3e).

| Stufe | Ansichten | Einblendungen (`sheet().art`) | Klick-Aktionen (`data-act`) |
|---|---|---|---|
| ☑ 3a | Laden, Fehler, `v_leer`, `v_dev` | `m-bild` (Eintrag über `meldungBild`) | `mfilter`, `m-status`, `m-weg`, `m-md`, `m-json`, `m-bild`, `diagnose` → Methoden; `sheet` → `einblenden()` |
| ☑ 3b | `v_verlauf`, `v_bsdetail` | `zeitraum-bs` | `pfilter`, `pmehr`, `vl-reiter`, `vl-art`, `vl-sort`, `verlauf`, `vgl`, `bs-oeffnen`, `csv` (Verlauf) |
| ☑ 3c | `v_pumpen`, `v_schacht` | – | `p-chart` entfernt; `container`, `st`, `b-auto`, `geraet`, `tab-einst`, `zr-*` → Methoden (Fälle bleiben für die alten Ansichten bis 3d–4) |
| ☑ 3d (Container 0.8.87, Einblendungen 0.8.88, Heizung 0.8.89, Dialoge 0.8.90) | ☑ `v_container`, ☑ `v_container_d`, ☑ `v_heizung` | ☑ `leistung`, ☑ `heizzeit-c`, ☑ `bedarf`, ☑ `termin`, ☑ `lernen`, ☑ `hz`, ☑ `heizplan`, ☑ `ausnahme`, ☑ `az`, ☑ `az-neu` (`aussehen` → 3e mit `bereich`) | `container`, `chart`, `cvd`, `c-soll`, `temp-vb`, `lh-h`, `lh-art`, `oh-basis`, `bedarf-*`, `termin-*`, `tm-*`, `boost`, `hz-*`, `ausn-*`, `au-*`, `jetzt-*`, `b-auto`, `modus`, `sym-*`, `sg-*`, `g-aktiv`, `g-automatik`, `b-lernen`, `lern-*`, `b-trocknen`, `tr-b`, `jc-*`, `warm-*`, `az-*`, `azn-*`, `st`, `tv` |
| ☑ 3e (Rahmen und Gruppen 0.8.91, Baustelle-Dialoge 0.8.92, Container/Geräte 0.8.94, Notprogramm 0.8.95) | ☑ `v_einst` (Gruppen; Notprogramm zuletzt) | ☑ `anschluss`, ☑ `bereich`, ☑ `aussehen`, ☑ `firma`, ☑ `geraet-edit`, ☑ `preis-neu`, ☑ `np-plug`, ☑ `wetterquelle`, ☑ `name`, ☑ `container-neu`, ☑ `abschliessen`, ☑ `bericht`, ☑ `urlaub`, ☑ `bs-bearbeiten`, ☑ `bs-loeschen` (dazu ☑ `nachrichten`, ☑ `zeitraum-bs`, ☑ `baustelle-neu` aus 3b/3f) | `ev-gruppe`, `ev-dev`, `tab-einst`, `e-bool`, `e-wert`, `prio`, `n-knopf`, `bericht-senden`, `test-meldung`, `anschluss-auf`, `an-*`, `firma-*`, `fc-*`, `sp-*`, `g-kw`, `g-zusatz`, `g-bearbeiten`, `gf-*`, `geraet`, `b-stufen`, `neu-art`, `neu-anlegen`, `b-speichern`, `ge-*`, `groesse-art`, `b-weg`, `abschliessen`, `name-speichern`, `baustelle-anlegen`, `wetterquelle-*`, `np-*`, `bereich-einst`, `urlaub-*`, `bs-aktiv`, `bs-bearbeiten`, ☑ `bs-loeschen`, `bsz-speichern` |
| 3f | `v_uebersicht`, `v_auswertung` | `verbrauch`, `wetter`, `warnungen`, `baustellen`, `strom`, `nachrichten`, `kk-katalog`, `aw-detail` | `w-hin`, `w-stumm`, `w-protokoll`, `wa`, `vb-*`, `aw-*`, `zr-*`, `kk-*`, `vg-*`, `auto`, `bs-wahl`, `sr-auf`, `basis`, `csv` (Auswertung) |
| 4 | Rahmen-Reste | übrige gemeinsame Einblendungen | `menue`, `tab`, `zu`, `melden`, `toast`, `sheet`, `neu-laden`; Alt-Weiche (`klick`, `eingabe`, `aenderung`, `unsafeHTML`, `_litEinhaengen`) entfernen |

Zahlen vor 3a: 12 Ansichten, 35 Einblendungen, 190 Klick-Aktionen (`klick()` 336 Zeilen).
