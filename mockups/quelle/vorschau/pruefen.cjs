// Prüft den Prototyp ohne Browser: node mockups/quelle/vorschau/pruefen.cjs
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '../../glas.html'), 'utf8');
let script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const el = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} }, dataset: {}, scrollTop: 0, offsetWidth: 100, offsetHeight: 30, innerHTML: '', value: 'Neu', querySelector() { return this.kind ||= el(); } });
class Root { constructor() { this.teile = {}; } set innerHTML(v) {} addEventListener() {} querySelector(s) { return this.teile[s] ||= el(); } querySelectorAll() { return []; } contains() { return true; } getBoundingClientRect() { return { left: 0, top: 0, width: 390 }; } }
let root; global.document = { querySelectorAll: s => s === '.app' ? [root = new Root()] : [], getElementById: () => ({}), body: { classList: { contains: () => false } } };
console.warn = () => {};
const { A, CH } = new Function('document', script.replace("document.querySelectorAll('.app').forEach(el => new App(el));", 'document.querySelectorAll(".app").forEach(el => new App(el));') + '; return { A: APPS[0], CH: CHARTS };')(global.document);
const f = [], ui = () => root.teile['.ui'].innerHTML, klick = ds => A.klick({ target: { closest: () => ({ dataset: ds }) } });
const pr = w => { if (/undefined|NaN|Infinity|\[object|>null</.test(ui().replace(/data-[a-z]+="[^"]*"/g, ''))) f.push(w + ': ' + (ui().match(/.{40}(undefined|NaN|Infinity|\[object|>null<).{15}/) || [''])[0]); };
const eing = (ds, value) => A.eingabe({ target: { dataset: ds, value } });
const hov = (x, y = 60) => { let t = ''; A.tip = (e, h) => t = h || ''; const key = [...ui().matchAll(/data-chart="([^"]+)"/g)].map(m => m[1]);
  for (const k of key) { const svg = { dataset: { chart: k }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320 }), querySelector: () => ({}), querySelectorAll: () => [] };
    const bar = { dataset: { i: '2' } }; A.hover({ target: { closest: sel => sel === 'svg.chart' ? svg : sel === '.bar' ? bar : null }, clientX: x, clientY: y }); if (/NaN|undefined/.test(t)) f.push('hover ' + k); } };
module.exports = { A, ui, klick, pr, eing, hov, f, CH };
if (require.main === module) {
  for (const v of ['uebersicht', 'heizung', 'auswertung', 'verlauf', 'einst']) { klick({ act: 'tab', v }); pr(v); hov(150); }
  for (const b of A.d.bereiche.map(b => b.id)) { klick({ act: 'container', id: b }); pr(b); for (const c of ['temp', 'verbrauch', 'heizzeit', 'pumpzeit', 'zyklen']) { klick({ act: 'chart', c }); pr(b + c); hov(150); } }
  for (const s of ['wetter', 'warnungen', 'baustellen', 'container-neu', 'bereich', 'abschliessen', 'urlaub', 'name', 'baustelle-neu', 'wetterquelle', 'verbrauch', 'heizplan']) { klick({ act: 'sheet', s, i: '1' }); pr('sheet ' + s); }
  /* AN-0002: ✎ im Dialog Baustellen öffnet „Baustelle bearbeiten“; Unterdialoge kehren dorthin zurück */
  klick({ act: 'sheet', s: 'baustellen' }); klick({ act: 'sheet', s: 'bs-bearbeiten', i: '0' }); pr('sheet bs-bearbeiten');
  if (A.s.sheet.art !== 'bs-bearbeiten') f.push('AN-0002: Baustelle bearbeiten öffnet nicht');
  for (const [act, ds] of [['sheet', { s: 'name' }], ['sheet', { s: 'zeitraum-bs' }], ['sheet', { s: 'wetterquelle' }], ['bereich-einst', { id: A.d.bereiche[0].id }], ['firma-auf', { id: A.d.firmen[0].id }]]) {
    klick({ act, ...ds }); pr('AN-0002 ' + act); klick({ act: 'zu' }); if (!A.s.sheet || A.s.sheet.art !== 'bs-bearbeiten') f.push('AN-0002: nach ' + act + ' nicht zurück'); }
  klick({ act: 'zu' }); if (A.s.sheet) f.push('AN-0002: Fertig schließt nicht');
  /* FE-0002: automatische Arbeitszeit wird durch die erste eigene ersetzt (auch mit früherem Datum); bearbeiten, löschen */
  A.d.arbeitszeiten = [{ ab: '2026-09-28', name: 'Arbeitszeit', auto: true, tage: { Mo: ['07:00', '16:30'], Di: null, Mi: null, Do: null, Fr: null, Sa: null, So: null } }];
  klick({ act: 'tab', v: 'heizung' }); pr('FE-0002 auto'); if (!/Automatisch angelegt/.test(ui())) f.push('FE-0002: Hinweis automatisch fehlt');
  klick({ act: 'az-neu' }); eing({ azn: 'ab' }, '2026-02-09'); eing({ azn: 'name' }, 'Meine'); klick({ act: 'azn-speichern' });
  if (A.azJetzt.name !== 'Meine' || A.d.arbeitszeiten.length !== 1) f.push('FE-0002: eigene gilt nicht: ' + A.azJetzt.name);
  klick({ act: 'sheet', s: 'az', i: '0' }); klick({ act: 'az-bearbeiten' }); pr('FE-0002 bearbeiten'); eing({ azn: 'name' }, 'Geändert'); klick({ act: 'azn-speichern' });
  if (A.d.arbeitszeiten.length !== 1 || A.azJetzt.name !== 'Geändert') f.push('FE-0002: bearbeiten ersetzt nicht');
  klick({ act: 'sheet', s: 'az', i: '0' }); klick({ act: 'az-weg' }); if (A.d.arbeitszeiten.length !== 1) f.push('FE-0002: letzte gelöscht');
  klick({ act: 'zu' });
  console.log(f.length ? f.join('\n') : 'Grundprüfung sauber');
}
