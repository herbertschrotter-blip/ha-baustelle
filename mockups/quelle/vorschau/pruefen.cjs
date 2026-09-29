// Prüft den Prototyp ohne Browser: node mockups/quelle/vorschau/pruefen.cjs
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '../../glas.html'), 'utf8');
let script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const el = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, scrollTop: 0, offsetWidth: 100, offsetHeight: 30, innerHTML: '', value: 'Neu', querySelector() { return this.kind ||= el(); } });
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
  console.log(f.length ? f.join('\n') : 'Grundprüfung sauber');
}
