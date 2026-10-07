// Schnappschuss der Seite für Umbauten ohne Verhaltensänderung (BSM-022 Stufe 1a–1c, bauplan-lit §3 „gleiche Ausgabe/Befehle“):
// rendert die gebaute Seite mit fester Uhr im DOM von happy-dom durch alle Ansichten, Container und Einblendungen und schreibt
// je Schritt das HTML von `.ui` und die gesendeten WebSocket-Befehle als JSON. Vorher/Nachher vergleichen:
//   node tests/panel/schnappschuss.js <baustelle-panel.js> <ausgabe.json>
//   node tests/panel/schnappschuss.js --vergleich <vorher.json> <nachher.json>
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);

if (argv[0] === '--vergleich') {
  // Lit-Markierungen (<!--?lit$…$-->, <!---->) sind keine Ausgabe – beim Vergleich weglassen (BSM-022 2b)
  const ohneLit = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'html' && typeof v === 'string' ? v.replace(/<!--\??(?:lit\$\d+\$)?-->/g, '') : v));
  const [a, b] = argv.slice(1).map(f => ohneLit(JSON.parse(fs.readFileSync(f, 'utf8'))));
  const unterschiede = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
    const x = JSON.stringify(a[k] ?? null), y = JSON.stringify(b[k] ?? null);
    let i = 0; while (i < x.length && x[i] === y[i]) i++;
    unterschiede.push(`${k}: …${x.slice(Math.max(0, i - 60), i + 60)}… ≠ …${y.slice(Math.max(0, i - 60), i + 60)}…`);
  }
  console.log(unterschiede.length ? `${unterschiede.length} Schritte verschieden:\n` + unterschiede.slice(0, 15).join('\n') : `gleich: ${Object.keys(a).length} Schritte (HTML und Befehle)`);
  process.exit(unterschiede.length ? 1 : 0);
}

const [datei, ziel] = argv;
if (!datei || !ziel) { console.error('Aufruf: node tests/panel/schnappschuss.js <baustelle-panel.js> <ausgabe.json>'); process.exit(2); }

/* feste Uhr: 29.09.2026 16:20 (wie Beispiel und Mockup), läuft nicht weiter */
const JETZT = Date.parse('2026-09-29T16:20:00+02:00'), _Date = Date;
global.Date = class extends _Date { constructor(...a) { if (a.length) super(...a); else super(JETZT); } static now() { return JETZT; } };
global.Date.parse = _Date.parse; global.Date.UTC = _Date.UTC;

const umgebung = require('./umgebung.js');
umgebung.einrichten();
global.fetch = async () => ({ ok: true, json: async () => [{ version: '0.0.0', datum: '2026-10-01', punkte: ['Beispiel'] }] });
console.warn = () => {};
umgebung.seiteLaden(datei);

const STRUKTUR = JSON.parse(fs.readFileSync(path.join(__dirname, 'struktur-0.7.json'), 'utf8'));
const VEKTOR = Object.fromEntries(['abrechnung', 'je-geraet', 'typvergleich', 'wetter', 'kennzahlen', 'verlauf', 'monate'].map(n => {
  const f = path.join(__dirname, '..', 'vektoren', `auswertung-${n}.json`);
  return [n, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).faelle : []];
}));
const befehle = [];
const { hass } = require('./beispiel-hass.js').beispielHass({ STRUKTUR, REFERENZ: true, VEKTOR, WELT: 'struktur-0.7', JETZT,
  welt: () => STRUKTUR, mit: m => befehle.push(JSON.parse(JSON.stringify(m))) });
const ruhe = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

(async () => {
  const panel = document.createElement('baustelle-panel');
  panel.panel = { config: { version: '0.0.0' } }; panel.narrow = false; panel.hass = hass;
  document.body.appendChild(panel); await ruhe(40);
  const ui = panel.shadowRoot.querySelector('.ui'), e = umgebung.helfer(panel), aus = {};
  // ds: data-Attribute (alte Ansichten, data-act) oder CSS-Selektor (Lit-Vorlagen, @click; Text muss in beiden Ständen passen)
  const klickSel = sel => { const x = panel.shadowRoot.querySelector(sel); if (x) x.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true })); else aus[`fehlt ${sel}`] = { html: '', befehle: [] }; };
  const schritt = async (name, ds) => { const ab = befehle.length; if (typeof ds === 'string') klickSel(ds); else if (ds) e.klick(ds); await ruhe(); aus[name] = { html: ui.innerHTML, befehle: befehle.slice(ab) }; };
  await schritt('start');
  for (const v of ['uebersicht', 'heizung', 'pumpen', 'auswertung', 'verlauf', 'einst']) await schritt(`tab ${v}`, { act: 'tab', v });
  await schritt('tab uebersicht 2', { act: 'tab', v: 'uebersicht' });
  for (const b of STRUKTUR[0].bereiche) { await schritt(`container ${b.id}`, { act: 'container', id: b.id }); await schritt(`zurück ${b.id}`, { act: 'tab', v: 'uebersicht' }); }
  for (const s of ['verbrauch', 'wetter', 'warnungen', 'baustellen', 'heizplan', 'strom', 'nachrichten', 'bericht', 'urlaub', 'melden']) {
    await schritt(`sheet ${s}`, s === 'melden' ? { act: 'melden' } : { act: 'sheet', s }); await schritt(`zu ${s}`, { act: 'zu' }); }
  await schritt('tab einst 2', { act: 'tab', v: 'einst' });
  for (const g of ['baustelle', 'heizung', 'notprogramm', 'container', 'geraete', 'pumpen', 'strom', 'firmen', 'meldungen', 'bericht', 'app', 'ueber'])
    await schritt(`einst ${g}`, { act: 'ev-gruppe', v: g });
  // Verlauf und Detailseite (Stufe 3b) – Selektoren über die Struktur, damit alter und neuer Stand gleich getroffen werden
  const tippen = async (name, sel, text) => { const x = panel.shadowRoot.querySelector(sel); const ab = befehle.length; if (x) { x.value = text; x.dispatchEvent(new Event('input', { bubbles: true, composed: true })); } await ruhe(); aus[name] = { html: ui.innerHTML, befehle: befehle.slice(ab) }; };
  await schritt('verlauf', { act: 'tab', v: 'verlauf' });
  await schritt('verlauf vergleich', '.vl-reiter .seg.klein button:nth-child(2)');
  await schritt('verlauf sortieren', '.vl-tab-kopf button:nth-child(4)');
  await schritt('verlauf sortieren 2', '.vl-tab-kopf button:nth-child(4)');
  await schritt('verlauf karten', '.vl-reiter .seg.klein button:nth-child(1)');
  await schritt('verlauf protokoll', '.vl-reiter .seg:not(.klein) button:nth-child(2)');
  await schritt('protokoll warnungen', '.vl-filter .vb-wer button:nth-child(2)');
  await schritt('protokoll alle', '.vl-filter .vb-wer button:nth-child(1)');
  await tippen('protokoll suche', '.vl-suche', 'zzzz-nichts');
  await tippen('protokoll suche leer', '.vl-suche', '');
  await schritt('verlauf baustellen', '.vl-reiter .seg:not(.klein) button:nth-child(1)');
  await schritt('bsdetail', '.vl-karte:not(.aktiv)');
  await schritt('bsdetail zurück', '.zurueck-zeile button:nth-child(1)');
  await schritt('einst dev', { act: 'ev-gruppe', v: 'dev' });
  await schritt('einst dev werkzeuge', { act: 'ev-dev', v: 'werkzeuge' });
  await schritt('tab dev', { act: 'tab', v: 'dev' });
  for (const [i, f] of ['offen', 'erledigt', 'alle'].entries()) await schritt(`dev ${f}`, `.seite .seg.klein button:nth-child(${i + 1})`);
  // Pumpen und Pumpenschacht (Stufe 3c)
  await schritt('pumpen', { act: 'tab', v: 'pumpen' });
  for (const [i, c] of ['zyklen', 'verbrauch', 'pumpzeit'].entries()) await schritt(`pumpen ${c}`, `.seite .block .seg button:nth-child(${[2, 3, 1][i]})`);
  await schritt('pumpen stepper +', '.seite .stepper button:nth-child(3)');
  await schritt('pumpen stepper −', '.seite .stepper button:nth-child(1)');
  if (panel.shadowRoot.querySelector('.seite .warn-zeile')) await schritt('pumpen warnung', '.seite .warn-zeile');
  await schritt('pumpen zurück', { act: 'tab', v: 'pumpen' });
  await schritt('pumpen meldungen', '.seite .block:last-child button.zeile');
  await schritt('pumpen 2', { act: 'tab', v: 'pumpen' });
  await schritt('schacht', '.seite .block-kopf .chip');
  for (const [i, c] of ['zyklen', 'verbrauch', 'pumpzeit'].entries()) await schritt(`schacht ${c}`, `.c-live .seg button:nth-child(${[2, 3, 1][i]})`);
  await schritt('schacht früher', '.zr-nav .zr-pf:first-child');
  await schritt('schacht aktuell', '.zr-akt');
  await schritt('schacht kalender', '.zr-auf');
  await schritt('schacht kalender zurück', '.zr-kal-kopf .zr-pf:first-child');
  await schritt('schacht kalender heute', '.zr-kal-fuss .chip');
  await schritt('schacht kennzahlen', '.c-live-kennz');
  await schritt('schacht kennzahlen zu', { act: 'zu' });
  await schritt('schacht bearbeiten', '.zurueck-zeile button:nth-child(2)');
  await schritt('schacht bearbeiten zu', { act: 'zu' });
  await schritt('schacht automatik', '.seite .liste .zeile .sw');
  if (panel.shadowRoot.querySelector('.seite .zeile.geraet .sw')) await schritt('schacht gerät', '.seite .zeile.geraet .sw');
  await schritt('schacht geräte bearbeiten', '.seite .block:not(.c-live) > button.zeile');
  await schritt('schacht geräte bearbeiten zu', { act: 'zu' });
  await schritt('schacht schwellen', '.seite > .liste:last-child button.zeile');
  await schritt('schacht 2', '.seite .block-kopf .chip');
  await schritt('schacht übersicht', '.zurueck-zeile button:nth-child(1)');
  // Container (Stufe 3d): mit Fühler und Lernen, dann bei Bedarf
  const B = panel.d.bereiche, mitF = B.find(b => !b.pumpe && b.fuehler && b.lern) || B.find(b => !b.pumpe && b.fuehler), bed = B.find(b => b.bedarf);
  if (mitF) {
    const c = mitF.id;
    await schritt(`c ${c}`, { act: 'container', id: c });
    for (const [i, v] of ['woche', 'stunden', 'heute'].entries()) await schritt(`c ${c} ${v}`, `.c-live .block-kopf .seg button:nth-child(${i === 2 ? 1 : i + 2})`);
    await schritt(`c ${c} tag früher`, '.c-live .zr-nav .zr-pf:first-child');
    await schritt(`c ${c} tag kalender`, '.c-live .zr-auf');
    await schritt(`c ${c} tag kalender heute`, '.c-live .zr-kal-fuss .chip');
    await schritt(`c ${c} soll +`, '.c-rad-pm .c-pm:nth-child(2)');
    await schritt(`c ${c} gefühl`, '.sg-gefuehl button:nth-child(1)');
    if (panel.shadowRoot.querySelector('.sg-versch .chip')) await schritt(`c ${c} gleitend`, '.sg-versch .chip');
    await schritt(`c ${c} modus hand`, '.c-d-knoepfe .seg button:nth-child(4)');
    await schritt(`c ${c} boost`, '.c-d-knoepfe > .chip');
    for (const n of [1, 2, 3, 4]) { await schritt(`c ${c} kachel ${n}`, `.c-kacheln .c-kachel:nth-child(${n})`); await schritt(`c ${c} kachel ${n} zu`, { act: 'zu' }); }
    await schritt(`c ${c} gerät aktiv`, '.c-chip .c-aktiv .sw');
    await schritt(`c ${c} gerät power`, '.c-chip .c-power:not([disabled])');
    await schritt(`c ${c} gerät bearbeiten`, '.c-chip .bs-ic'); await schritt(`c ${c} gerät bearbeiten zu`, { act: 'zu' });
    if (panel.shadowRoot.querySelector('.c-chip .link')) await schritt(`c ${c} gerät automatik`, '.c-chip .link');
    await schritt(`c ${c} trocknen`, '.seite > .liste .zeile:last-child .sw');
    if (mitF.lern) { await schritt(`c ${c} lernen`, '.seite > .liste .zeile:not(:last-child) .sw');
      if (panel.shadowRoot.querySelector('.seite > .liste .link')) { await schritt(`c ${c} lernstand`, '.seite > .liste .link'); await schritt(`c ${c} lernstand zu`, { act: 'zu' }); } }
    await schritt(`c ${c} bearbeiten`, '.zurueck-zeile button:nth-child(2)'); await schritt(`c ${c} bearbeiten zu`, { act: 'zu' });
    await schritt(`c ${c} zurück`, '.zurueck-zeile button:nth-child(1)');
  }
  if (bed) {
    const c = bed.id;
    await schritt(`c ${c}`, { act: 'container', id: c });
    await schritt(`c ${c} 1 h`, '.bedarf-dauer .chip:nth-child(1)');
    if (panel.shadowRoot.querySelector('.bedarf-an .chip')) await schritt(`c ${c} beenden`, '.bedarf-an .chip');
    if (panel.shadowRoot.querySelector('.ereignis .x')) await schritt(`c ${c} termin weg`, '.ereignis .x');
    await schritt(`c ${c} termin neu`, '.seite .block .zeile .blau'); await schritt(`c ${c} termin neu zu`, { act: 'zu' });
  }
  // Einblendungen der Container-Ansicht (Stufe 3d): Leistung, Heizzeit, Bei Bedarf, Termin, Lernstand
  const feld = async (name, sel, wert, art = 'input') => { const x = panel.shadowRoot.querySelector(sel); const ab = befehle.length;
    if (x) { x.value = wert; x.dispatchEvent(new Event('input', { bubbles: true, composed: true })); if (art === 'change') x.dispatchEvent(new Event('change', { bubbles: true, composed: true })); }
    else aus[`fehlt ${sel}`] = { html: '', befehle: [] };
    await ruhe(); aus[name] = { html: ui.innerHTML, befehle: befehle.slice(ab) }; };
  if (mitF) {
    await schritt('e c', { act: 'container', id: mitF.id });
    await schritt('e leistung', '.c-kacheln .c-kachel:nth-child(1)');
    await schritt('e leistung tag', '.sheet .seg button:nth-child(2)');
    await schritt('e leistung stunde', '.sheet .seg button:nth-child(1)');
    await feld('e leistung regler', '.sheet .lh-regler input', '5', 'change');
    await feld('e leistung regler zu weit', '.sheet .lh-regler input', '23', 'change');
    await schritt('e leistung früher', '.sheet .zr-nav .zr-pf:first-child');
    await feld('e leistung regler gestern', '.sheet .lh-regler input', '20', 'change');
    await schritt('e leistung zu', '.sheet > .knopf');
    await schritt('e heizzeit', '.c-kacheln .c-kachel:nth-child(4)');
    await schritt('e heizzeit woche', '.sheet .seg button:nth-child(2)');
    await schritt('e heizzeit früher', '.sheet .zr-nav .zr-pf:first-child');
    await schritt('e heizzeit monat', '.sheet .seg button:nth-child(3)');
    await schritt('e heizzeit zu', '.sheet > .knopf');
    const pol = panel.d.bereiche.find(x => x.id === mitF.id); pol.modus = 'thermo';
    pol.lern = { an: true, zyklen: 3, anteil: 38, erwartet: .8, aus_bei: 19.2, zyklus_min: 10, kint: { wert: .57, start: .6, fort: .06 }, kext: { wert: .01, start: .01, fort: 0 },
      nachlauf: { 'oel|lang|kalt': { grad: 1.2, min: 12, n: 3 } }, treffer: [.3, -.1, .2] };
    await panel.neuZeichnen(); await schritt('e mit lernen');
    await schritt('e lernstand', '.seite > .liste .link');
    await schritt('e lernstand mild', '.sheet .block-kopf .seg button:nth-child(2)');
    await schritt('e lernstand reset', '.sheet .knopf.rot');
    await schritt('e lernstand 2', '.seite > .liste .link');
    await schritt('e lernstand zu', '.sheet .knopf.leise-k');
    await schritt('e zurück', { act: 'tab', v: 'uebersicht' });
  }
  if (bed) {
    await schritt('e bedarf', { act: 'bedarf-auf', id: bed.id });
    await schritt('e bedarf schnell', '.sheet .zeile .sw');
    await schritt('e bedarf 1 h', '.sheet .bedarf-dauer .knopf:nth-child(1)');
    await schritt('e bedarf 2', { act: 'bedarf-auf', id: bed.id });
    await schritt('e bedarf abbrechen', '.sheet > .knopf.leise-k');
    await schritt('e bedarf 3', { act: 'bedarf-auf', id: bed.id });
    await schritt('e termin', '.sheet button.zeile');
    await feld('e termin titel', '.sheet .feld input', 'Besprechung Test');
    await schritt('e termin woche', '.sheet .seg button:nth-child(2)');
    await schritt('e termin schnell', '.sheet .zeile .sw');
    await feld('e termin von', '.sheet .raster-2 .feld:nth-child(1) input', '07:30');
    await schritt('e termin eintragen', '.sheet .knopf.amber');
    await schritt('e termin 2', { act: 'sheet', s: 'termin', id: bed.id });
    await feld('e termin titel leer', '.sheet .feld input', '  ');
    await schritt('e termin eintragen leer', '.sheet .knopf.amber');
    await schritt('e termin abbrechen', '.sheet .knopf.leise-k');
  }
  // Reiter Heizung (Stufe 3d): Kacheln als Einblendung, darin die Bedienung je Block
  const wenn = async (name, sel) => { if (panel.shadowRoot.querySelector(sel)) await schritt(name, sel); };
  await schritt('h', { act: 'tab', v: 'heizung' });
  await schritt('h automatik', '.seite .glas-kopf .sw'); await schritt('h automatik 2', '.seite .glas-kopf .sw');
  await schritt('h heute', '.seite .hz-held'); await wenn('h heute container', '.sheet .hz-ohne .chip'); await schritt('h heute zu', { act: 'tab', v: 'heizung' });
  for (let n = 1; n <= 8; n++) {
    await schritt(`h ${n}`, `.hz-raster .hz-kachel:nth-child(${n})`);
    if (n === 2) { await schritt('h wann woche', '.sheet .block-kopf .seg button:nth-child(2)'); await wenn('h wann zelle', '.sheet .hz-zelle'); await wenn('h wann tag', '.sheet .vb-wer button:nth-child(1)'); }
    if (n === 3) { await wenn('h jc soll', '.sheet .jc .stepper button:nth-child(3)'); await wenn('h jc trocknen', '.sheet .jc .sw');
      await feld('h jc modus', '.sheet .jc-modus', 'hand', 'change'); }
    if (n === 4) { await wenn('h az weg', '.sheet .am-fenster .x'); await wenn('h az früher', '.sheet .az-name ~ button.zeile:nth-last-child(2)'); await wenn('h ausn heute', '.sheet .bedarf-dauer .chip:nth-child(1)'); }
    if (n === 5) { await wenn('h ausn dazu', '.sheet .am-tag > button.zeile'); }
    if (n === 6) { await schritt('h regeln +', '.sheet .rv-karte .stepper button:nth-child(3)'); await schritt('h regeln frühstart', '.sheet .rv-karte .sw');
      await schritt('h regeln gleitend', '.sheet .rv-karte .zeile:not(.unter) .seg button:nth-child(2)'); await wenn('h regeln vergessen', '.sheet .rv-karte .rv-link');
      await wenn('h regeln basis', '.sheet .rv-karte .zeile.unter .seg button:nth-child(1)'); await schritt('h regeln fest', '.sheet .rv-karte .zeile:not(.unter) .seg button:nth-child(1)'); }
    if (n === 7) await schritt('h trocknen +', '.sheet .stepper button:nth-child(3)');
    if (n === 8) { await schritt('h urlaub feiertag', '.sheet .zeile .sw'); await schritt('h urlaub absenken', '.sheet .seg button:nth-child(2)'); await wenn('h urlaub weg', '.sheet .zeile.unter .x');
      await schritt('h urlaub neu', '.sheet .hz-innen > button.zeile:last-of-type'); }
    await schritt(`h ${n} zu`, { act: 'zu' });
  }
  await schritt('tab uebersicht 3', { act: 'tab', v: 'uebersicht' });
  await schritt('automatik', { act: 'auto' });
  // Nicht-Admin (Bauplan 0.7 §8): gesperrte Schalter senden nichts, Vor-Ort-Aktionen schon
  for (const b of STRUKTUR) b.rechte = { aendern: false, aktionen: ['gefuehl', 'warnung_stumm', 'jetzt_heizen', 'boost', 'bedarf', 'bedarf_aus'] };
  panel.cache = {}; await panel._laden(); await schritt('nur-lesen start');
  await schritt('nur-lesen automatik', { act: 'auto' });
  await schritt('nur-lesen warnungen', { act: 'sheet', s: 'warnungen' });
  const w = panel.d.warnungen[0]; if (w) await schritt('nur-lesen warnung stumm', { act: 'w-stumm', id: w.id });
  await schritt('nur-lesen zu', { act: 'zu' });
  await schritt('nur-lesen einst', { act: 'tab', v: 'einst' });
  for (const g of ['heizung', 'container', 'geraete']) await schritt(`nur-lesen einst ${g}`, { act: 'ev-gruppe', v: g });
  await schritt('nur-lesen pumpen', { act: 'tab', v: 'pumpen' });
  await schritt('nur-lesen pumpen stepper', '.seite .stepper button:nth-child(3)');
  await schritt('nur-lesen schacht', '.seite .block-kopf .chip');
  await schritt('nur-lesen schacht automatik', '.seite .liste .zeile .sw');
  if (mitF) { await schritt('nur-lesen c', { act: 'container', id: mitF.id });
    await schritt('nur-lesen c gerät bearbeiten', '.c-chip .bs-ic'); await schritt('nur-lesen c boost', '.c-d-knoepfe > .chip');
    await schritt('nur-lesen c modus', '.c-d-knoepfe .seg button:nth-child(4)'); await schritt('nur-lesen c gefühl', '.sg-gefuehl button:nth-child(1)'); }
  if (bed) { await schritt('nur-lesen c bedarf', { act: 'container', id: bed.id });
    await schritt('nur-lesen c bedarf termin neu', '.seite .block .zeile .blau'); await schritt('nur-lesen c bedarf 1 h', '.bedarf-dauer .chip:nth-child(1)');
    if (panel.shadowRoot.querySelector('.ereignis .x')) await schritt('nur-lesen c termin weg', '.ereignis .x'); }
  aus.toast = { html: panel.letzterToast || '', befehle: [] };
  fs.writeFileSync(ziel, JSON.stringify(aus));
  console.log(`Schnappschuss: ${Object.keys(aus).length} Schritte, ${befehle.length} Befehle → ${ziel}`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
