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
  await schritt('einst dev', { act: 'ev-gruppe', v: 'dev' });
  await schritt('einst dev werkzeuge', { act: 'ev-dev', v: 'werkzeuge' });
  await schritt('tab dev', { act: 'tab', v: 'dev' });
  for (const [i, f] of ['offen', 'erledigt', 'alle'].entries()) await schritt(`dev ${f}`, `.seite .seg.klein button:nth-child(${i + 1})`);
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
  aus.toast = { html: panel.letzterToast || '', befehle: [] };
  fs.writeFileSync(ziel, JSON.stringify(aus));
  console.log(`Schnappschuss: ${Object.keys(aus).length} Schritte, ${befehle.length} Befehle → ${ziel}`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
