// Leistungsvergleich für die Lit-Entscheidung (BSM-022, bauplan-lit §5 „Aufwand und Reaktion“): zwei Master-Mockups
// (vorher/nachher) in Chromium; je Lauf Median über Messungen, 5 Läufe, Median der Läufe.
//   node tests/panel/browser/leistung.mjs <vorher.html> <nachher.html>
// Messungen: render() der Seite mit offenem Melde-Dialog, Neuzeichnen nach Datenupdate (_laden + render), Klick auf Art im
// Melde-Dialog bis zum nächsten Frame.
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const puppeteer = createRequire(join(REPO, 'custom_components', 'baustelle', 'frontend', 'package.json'))('puppeteer-core');
const CHROME = process.env.CHROME_PFAD || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync);
const [vorher, nachher] = process.argv.slice(2).map(f => readFileSync(resolve(f)));
const server = createServer((q, r) => { const h = q.url.startsWith('/nachher') ? nachher : q.url.startsWith('/vorher') ? vorher : null; if (!h) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(h); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

async function lauf(welche) {
  const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 1000 });
  await page.evaluateOnNewDocument(() => { const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (a, ...x) { return /webgl/.test(a) ? null : gc.call(this, a, ...x); }; });
  await page.goto(`http://127.0.0.1:${server.address().port}/${welche}`, { waitUntil: 'load' });
  await page.waitForFunction(() => { const p = document.querySelector('#desktop baustelle-panel'); return p && p.d && !p.shadowRoot.textContent.includes('Lädt …'); }, { timeout: 30000 });
  const r = await page.evaluate(async () => {
    const p = document.querySelector('#desktop baustelle-panel'), sr = p.shadowRoot, BB = window.baustelleBeispiel, frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    sr.querySelector('button.melden-knopf').click(); await frame();
    const m = { render: [], update: [], klick: [] };
    for (let i = 0; i < 15; i++) { const t = performance.now(); p.render(); m.render.push(performance.now() - t); await frame(); }
    for (let i = 0; i < 10; i++) { BB.welt[0].baustelle.titel = 'L' + i; const t = performance.now(); await p._laden(); p.render(); m.update.push(performance.now() - t); await frame(); }
    for (let i = 0; i < 10; i++) { const b = [...sr.querySelectorAll('.sheet .seg button')][i % 3]; const t = performance.now(); b.click(); await frame(); m.klick.push(performance.now() - t); }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    return { render: med(m.render), update: med(m.update), klick: med(m.klick) };
  });
  await page.close(); return r;
}
const erg = { vorher: [], nachher: [] };
for (let i = 0; i < 5; i++) for (const w of ['vorher', 'nachher']) erg[w].push(await lauf(w));   // abwechselnd, gegen Drift
await browser.close(); server.close();
let ok = true;
for (const k of ['render', 'update', 'klick']) {
  const v = median(erg.vorher.map(x => x[k])), n = median(erg.nachher.map(x => x[k])), grenze = v + Math.max(0.2 * v, 50), gut = n <= grenze;
  ok &&= gut;
  console.log(`${gut ? '✓' : '✗'} ${k.padEnd(7)} vorher ${v.toFixed(1)} ms · nachher ${n.toFixed(1)} ms · Grenze ${grenze.toFixed(1)} ms`);
}
console.log(ok ? 'Leistung im Rahmen (Median aus 5 Läufen, höchstens max(20 %, 50 ms) schlechter)' : 'Leistung außerhalb des Rahmens');
process.exit(ok ? 0 : 1);
