// Prüft das Master-Mockup ohne Browser: node mockups/quelle/vorschau/pruefen.cjs [anderes-mockup.html]
// Führt die Skripte aus mockups/glas.html im DOM von happy-dom aus (tests/panel/umgebung.js, wie der Panel-Test) und rendert
// beide Seiten (Handy, Desktop) durch alle Ansichten: kein Fehler, kein undefined/NaN, die Seite ist die aktuelle.
// Klassische Skripte und Module laufen der Reihe nach (Module je in eigenem Bereich); das Warten auf whenDefined entfällt,
// weil hier alles nacheinander läuft.
'use strict';
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
const html = fs.readFileSync(process.argv[2] ? path.resolve(process.argv[2]) : path.join(repo, 'mockups', 'glas.html'), 'utf8');
const teile = [...html.matchAll(/<script( type="module")?>([\s\S]*?)<\/script>/g)]
  .map(m => ({ modul: !!m[1], code: m[2].replace(/<\\\/script/gi, '</script').replace(/^await customElements\.whenDefined\([^)]*\);$/m, '') }));
const skripte = teile.map(t => t.code);
const f = [];
const umgebung = require(path.join(repo, 'tests', 'panel', 'umgebung.js'));
umgebung.einrichten();
// Mockup-Rahmen: Leiste, Bühnen und Regler des Mockups als echte Elemente
const koerper = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
document.body.innerHTML = koerper;
global.Response = class { constructor(b, o = {}) { this.ok = (o.status || 200) < 400; this._b = b; } async json() { return JSON.parse(this._b); } };
global.fetch = async () => new global.Response('null');
console.warn = () => {};
try { (0, eval)(teile.map(t => t.modul ? `(function () {\n${t.code}\n})();` : t.code).join('\n;\n')); globalThis.P = window.baustelleBeispiel.P; } catch (e) { console.error('Skript bricht ab:', e); process.exit(1); }

const ruhe = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
(async () => {
  await ruhe(60);
  const P = global.P;
  if (!Array.isArray(P) || P.length !== 2) { console.error('Seiten nicht angelegt'); process.exit(1); }
  const panelQuelle = fs.readFileSync(path.join(repo, 'custom_components/baustelle/frontend/baustelle-panel.js'), 'utf8');
  if (!skripte.some(s => s.trim() === panelQuelle.trim())) f.push('glas.html enthält nicht die aktuelle Seite – node mockups/quelle/glas.js');
  for (const [i, p] of P.entries()) {
    const ui = () => p.shadowRoot.querySelector('.ui').innerHTML || '', name = i ? 'Desktop' : 'Handy', e = umgebung.helfer(p);
    const klick = async ds => { e.klick(ds); await ruhe(); };
    const pruefe = wo => { const h = ui(); const m = h.match(/.{40}(undefined|NaN|\[object|Infinity|>null<).{20}/s); if (m) f.push(`${name} ${wo}: ${m[0].replace(/\s+/g, ' ')}`);
      if (!h || /Lädt …/.test(h) && !/Lädt …/.test(wo)) f.push(`${name} ${wo}: leer oder lädt`); };
    if (!p.d) { f.push(`${name}: Beispielbaustelle nicht geladen`); continue; }
    for (const v of ['uebersicht', 'heizung', 'auswertung', 'verlauf', 'einst', 'ueber']) { await klick({ act: 'tab', v }); pruefe(v); }
    for (const b of p.d.bereiche) { await klick({ act: 'container', id: b.id }); pruefe(`Container ${b.name}`); }
    await klick({ act: 'tab', v: 'uebersicht' });
  }
  if (f.length) { console.log(f.slice(0, 30).join('\n')); console.log(`${f.length} Fehler`); process.exit(1); }
  console.log(`Master-Mockup sauber: echte Seite ${JSON.parse(fs.readFileSync(path.join(repo, 'custom_components/baustelle/frontend/version.json'), 'utf8')).version}, Handy und Desktop, alle Ansichten und Container.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
