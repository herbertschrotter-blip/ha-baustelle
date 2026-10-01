// Prüft das Master-Mockup ohne Browser: node mockups/quelle/vorschau/pruefen.cjs
// Führt die Skripte aus mockups/glas.html mit einem minimalen DOM aus (wie tests/panel/test_panel.js) und rendert beide
// Seiten (Handy, Desktop) durch alle Ansichten: kein Fehler, kein undefined/NaN, die Seite ist die aktuelle.
'use strict';
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
const html = fs.readFileSync(process.argv[2] ? path.resolve(process.argv[2]) : path.join(repo, 'mockups', 'glas.html'), 'utf8');   // anderes Mockup: Pfad als Argument
const skripte = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1].replace(/<\\\/script/gi, '</script'));
const f = [];

const klassen = () => { const s = new Set(); return { add: k => s.add(k), remove: k => s.delete(k), toggle: (k, an) => ((an ?? !s.has(k)) ? s.add(k) : s.delete(k)), contains: k => s.has(k) }; };
const element = (name = 'div') => ({ tagName: name.toUpperCase(), dataset: {}, style: { setProperty() {} }, classList: klassen(), innerHTML: '', textContent: '', value: '', kinder: {},
  querySelector(s) { return this.kinder[s] ||= element(); }, querySelectorAll() { return []; }, appendChild(k) { (this.angehaengt ||= []).push(k); if (k.connectedCallback) k.connectedCallback(); },
  insertBefore() {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }), offsetWidth: 390, offsetHeight: 844 });
class HTMLElement {
  constructor() { this.dataset = {}; this.style = { setProperty() {} }; }
  attachShadow() { const teile = {}; this.shadowRoot = { teile, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, activeElement: null,
    querySelector: s => teile[s] ||= element(), querySelectorAll: () => [], addEventListener() {}, appendChild() {} }; return this.shadowRoot; }
  dispatchEvent() { return true; }
}
const registry = {}, felder = {};
global.window = global; global.Date = Date; global.addEventListener = () => {}; global.HTMLElement = HTMLElement;
global.customElements = { define: (n, c) => { registry[n] = c; }, get: n => registry[n] };
global.document = { body: element('body'), createElement: n => registry[n] ? new registry[n]() : element(n), getElementById: id => felder[id] ||= element() };
global.localStorage = { getItem: () => null, setItem() {} };
global.setInterval = () => 1; global.clearInterval = () => {}; global.Response = class { constructor(b, o = {}) { this.ok = (o.status || 200) < 400; this._b = b; } async json() { return JSON.parse(this._b); } };
global.fetch = async () => new global.Response('null');
console.warn = () => {};
try { (0, eval)(skripte.join('\n;\n') + '\n;globalThis.P = P; globalThis.evVar = v => { EV_VAR = v; };'); } catch (e) { console.error('Skript bricht ab:', e); process.exit(1); }

const ruhe = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
(async () => {
  await ruhe(60);
  const P = global.P;
  if (!Array.isArray(P) || P.length !== 2) { console.error('Seiten nicht angelegt'); process.exit(1); }
  const panelQuelle = fs.readFileSync(path.join(repo, 'custom_components/baustelle/frontend/baustelle-panel.js'), 'utf8');
  if (!skripte.some(s => s.trim() === panelQuelle.trim())) f.push('glas.html enthält nicht die aktuelle Seite – node mockups/quelle/glas.js');
  for (const [i, p] of P.entries()) {
    const ui = () => p.shadowRoot.teile['.ui'].innerHTML || '', name = i ? 'Desktop' : 'Handy';
    const klick = async ds => { p.klick({ target: { closest: () => ({ dataset: ds }) } }); await ruhe(); };
    const pruefe = wo => { const h = ui(); const m = h.match(/.{40}(undefined|NaN|\[object|Infinity|>null<).{20}/s); if (m) f.push(`${name} ${wo}: ${m[0].replace(/\s+/g, ' ')}`);
      if (!h || /Lädt …/.test(h) && !/Lädt …/.test(wo)) f.push(`${name} ${wo}: leer oder lädt`); };
    if (!p.d) { f.push(`${name}: Beispielbaustelle nicht geladen`); continue; }
    for (const v of ['uebersicht', 'heizung', 'auswertung', 'verlauf', 'einst', 'ueber']) { await klick({ act: 'tab', v }); pruefe(v); }
    for (const b of p.d.bereiche) { await klick({ act: 'container', id: b.id }); pruefe(`Container ${b.name}`); }
    await klick({ act: 'tab', v: 'uebersicht' });
  }
  if (f.length) { console.log(f.slice(0, 30).join('\n')); console.log(`${f.length} Fehler`); process.exit(1); }
  console.log(`Master-Mockup sauber: echte Seite ${(panelQuelle.match(/SEITE_VERSION = '([^']+)'/) || [])[1]}, Handy und Desktop, alle Ansichten und Container.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
