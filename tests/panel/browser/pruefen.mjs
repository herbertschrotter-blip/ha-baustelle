// Browser-Test der Seite „Baustelle“ (BSM-022 Stufe 0b.1, docs/bauplan-lit.md §6): das Master-Mockup (echtes Bundle mit
// Beispieldaten) in Chromium 136 über puppeteer-core, Bedienung nur über den Browser (Klick, Tastatur, Mausrad).
// Keine Verbindung zu Home Assistant: ein lokaler HTTP-Server liefert nur mockups/glas.html.
//   node tests/panel/browser/pruefen.mjs [--bericht datei.json] [--bilder ordner]
//   Chromium: CHROME_PFAD oder /usr/bin/chromium; puppeteer-core aus custom_components/baustelle/frontend/node_modules.
// B1–B7 halten den Stand vor Lit fest. Was heute bekanntermaßen versagt, steht in BEKANNT (wird gemeldet, nicht rot);
// jeder andere Fehler macht den Lauf rot.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FRONTEND = join(REPO, 'custom_components', 'baustelle', 'frontend');
const puppeteer = createRequire(join(FRONTEND, 'package.json'))('puppeteer-core');
const VERSION = JSON.parse(readFileSync(join(FRONTEND, 'version.json'), 'utf8')).version;
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const BILDER = arg('--bilder'), BERICHT = arg('--bericht');
const CHROME = process.env.CHROME_PFAD || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync);
if (!CHROME) { console.error('Chromium nicht gefunden (CHROME_PFAD setzen)'); process.exit(2); }
if (BILDER) mkdirSync(BILDER, { recursive: true });

/* Heute bekannte Fehler (bauplan-lit §1) – werden in eigenen Stufen behoben und dann hier gestrichen */
const BEKANNT = {
  'B4 Rest bleibt': 'neue Statistik kommt über _holen → _auffrischen und zeichnet die ganze Seite neu; nur ohne Nachladen tauscht _liveNeu Diagramm/Kennzahlen (Lit-Stufe 3d)',
};

const html = readFileSync(join(REPO, 'mockups', 'glas.html'));
const server = createServer((q, r) => { if (q.url === '/favicon.ico') { r.writeHead(204); r.end(); } else if (['/', '/glas.html'].includes(q.url.split('?')[0])) { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(html); } else { r.writeHead(404); r.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/`;

const D = '#desktop baustelle-panel', T = '#telefon baustelle-panel';
const ergebnisse = [], t0 = Date.now();
const warte = ms => new Promise(r => setTimeout(r, ms));

/* Vor dem Laden: Zähler für window-Listener und Intervalle; Himmel als CSS (Standard), mit WebGL oder mit Ausfall */
const vorbereitung = himmel => {
  window.__z = { listener: { paste: 0, 'location-changed': 0 }, intervalle: new Set() };
  const add = window.addEventListener, rem = window.removeEventListener;
  window.addEventListener = function (t, ...a) { if (t in window.__z.listener) window.__z.listener[t]++; return add.call(this, t, ...a); };
  window.removeEventListener = function (t, ...a) { if (t in window.__z.listener) window.__z.listener[t]--; return rem.call(this, t, ...a); };
  const si = window.setInterval, ci = window.clearInterval;
  window.setInterval = (...a) => { const id = si(...a); window.__z.intervalle.add(id); return id; };
  window.clearInterval = id => { window.__z.intervalle.delete(id); return ci(id); };
  if (himmel !== 'webgl') {
    const gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (art, ...a) {
      if (/webgl/.test(art)) { if (himmel === 'ausfall') throw new Error('WebGL-Ausfall (Test)'); return null; }
      return gc.call(this, art, ...a);
    };
  }
};

async function seite(browser, himmel = 'css') {
  const page = await browser.newPage(), fehler = [];
  await page.setViewport({ width: 1400, height: 1000 });
  page.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  await page.evaluateOnNewDocument(vorbereitung, himmel);
  await page.goto(URL_, { waitUntil: 'load' });   // kein networkidle: der Himmel läuft
  await page.waitForFunction(sel => { const p = document.querySelector(sel); return p && p.d && p.shadowRoot.querySelector('[data-act="tab"]') && !p.shadowRoot.textContent.includes('Lädt …'); },
    { timeout: 30000 }, D);
  return { page, fehler };
}
// fn ist eine Pfeilfunktion ohne Parameter; sie sieht p (Element), sr (Shadow Root), BB (Testzugang des Mockups), a0, a1 …
const panel = (page, sel, fn, ...a) => page.evaluate((sel, quelle, ...a) => { const p = document.querySelector(sel);
  return new Function('p', 'sr', 'BB', ...a.map((_, i) => 'a' + i), `return (${quelle})();`)(p, p.shadowRoot, window.baustelleBeispiel, ...a); }, sel, String(fn), ...a);
const klick = async (page, sel) => { await page.waitForSelector(sel, { visible: true, timeout: 5000 }); await page.click(sel); await warte(120); };
const schreibAnzahl = (page, ab) => page.evaluate(ab => window.baustelleBeispiel.TEST.aufrufe.slice(ab).filter(m => ['baustelle/setzen', 'baustelle/aktion'].includes(m.type)).map(m => m.type + (m.aktion ? ':' + m.aktion : '')), ab);
const aufrufZahl = page => page.evaluate(() => window.baustelleBeispiel.TEST.aufrufe.length);
const bild = async (page, name) => { if (BILDER) await page.screenshot({ path: join(BILDER, name + '.jpg'), type: 'jpeg', quality: 70, clip: { x: 0, y: 0, width: 1400, height: 1000 } }); };

async function fall(name, browser, ablauf, himmel) {
  const start = Date.now(), pruef = [];
  const erwarte = (text, ok, info = '') => pruef.push({ text, ok: !!ok, info });
  let s;
  try { s = await seite(browser, himmel); await ablauf(s.page, erwarte); }
  catch (e) { pruef.push({ text: 'Ablauf', ok: false, info: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }); }
  if (s) { erwarte('keine Fehler im Browser', !s.fehler.length, s.fehler.slice(0, 3).join(' | ')); await s.page.close(); }
  const rot = pruef.filter(p => !p.ok);
  ergebnisse.push({ name, ok: !rot.length, ms: Date.now() - start, pruef });
  console.log(`${rot.length ? '✗' : '✓'} ${name} (${((Date.now() - start) / 1000).toFixed(1)} s)` + rot.map(p => `\n    ✗ ${p.text}${p.info ? ' – ' + p.info : ''}`).join(''));
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 30000, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--lang=de-AT'] });
const chromeVersion = await browser.version();

/* B1 Start: Ladezustand endet, Ansicht und Version sichtbar */
await fall('B1 Start', browser, async (page, erwarte) => {
  const r = await panel(page, D, () => ({ version: p.version, tabs: sr.querySelectorAll('nav [data-act="tab"]').length, himmel: !!p.himmel, phase: p.bg.dataset.phase,
    name: p.d && p.d.name, sichtbar: !!sr.querySelector('.seite') && sr.querySelector('.seite').getBoundingClientRect().height > 100 }));
  const leiste = await page.$eval('.bar b', e => e.textContent);
  erwarte('Ansicht sichtbar, Reiter da', r.sichtbar && r.tabs >= 5, JSON.stringify(r));
  erwarte(`Version ${VERSION} in Leiste und Seite`, leiste.includes(VERSION) && r.version === VERSION, `${leiste} / ${r.version}`);
  erwarte('CSS-Himmel (WebGL aus)', !r.himmel && !!r.phase);
  await bild(page, 'b1-start');
});

/* Start mit WebGL und mit erzwungenem Ausfall */
await fall('Start mit Ausfall des WebGL', browser, async (page, erwarte) => {
  const r = await panel(page, D, () => ({ himmel: !!p.himmel, phase: p.bg.dataset.phase, tabs: sr.querySelectorAll('nav [data-act="tab"]').length }));
  erwarte('Seite läuft mit CSS-Himmel weiter', !r.himmel && r.phase && r.tabs >= 5, JSON.stringify(r));
}, 'ausfall');
if (process.env.BAUSTELLE_WEBGL !== '1') {
  console.log('– Start mit WebGL übersprungen: im Container auf dem Pi gibt es kein WebGL (läuft auf GitHub mit BAUSTELLE_WEBGL=1)');
  ergebnisse.push({ name: 'Start mit WebGL', ok: true, uebersprungen: true, ms: 0, pruef: [] });
} else {
  const gpu = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 30000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  await fall('Start mit WebGL', gpu, async (page, erwarte) => {
    await warte(500);
    const r = await panel(page, D, () => ({ himmel: !!p.himmel, canvas: !!sr.querySelector('canvas.himmel') }));
    erwarte('WebGL-Himmel läuft', r.himmel && r.canvas, JSON.stringify(r));
    const bleibt = await panel(page, D, async () => { const cv = sr.querySelector('canvas.himmel'), h = p.himmel;
      BB.welt[0].baustelle.titel = 'Himmel bleibt'; await p._laden(); p.render(); await new Promise(r => setTimeout(r, 200));
      return { canvas: sr.querySelector('canvas.himmel') === cv && cv.isConnected, himmel: p.himmel === h, neu: sr.querySelector('.ui').textContent.includes('Himmel bleibt') }; });
    erwarte('Canvas und Himmel bleiben beim Neuzeichnen (Stufe 1b)', bleibt.canvas && bleibt.himmel && bleibt.neu, JSON.stringify(bleibt));
  }, 'webgl');
  await gpu.close();
}

/* B2 Eingabeschutz: Melde-Text bleibt bei neuer Strukturantwort; nach dem Fokuswechsel sind die neuen Daten sichtbar */
await fall('B2 Eingabeschutz', browser, async (page, erwarte) => {
  await klick(page, `${D} >>> button.melden-knopf[data-act="melden"]`);
  const ta = `${D} >>> textarea[data-ml="text"]`;
  await klick(page, ta); await page.keyboard.type('Heizung schaltet nicht');
  await bild(page, 'b2-eingabe');
  await page.keyboard.press('Home'); await page.keyboard.down('Shift'); for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
  const r = await panel(page, D, async () => {
    const ta = sr.querySelector('textarea[data-ml="text"]');
    BB.welt[0].baustelle.titel = 'Geänderte Baustelle B2'; await p._laden(); await new Promise(r => setTimeout(r, 100));
    const jetzt = sr.querySelector('textarea[data-ml="text"]');
    return { verarbeitet: p.roh[0].baustelle.titel, gleich: jetzt === ta && ta.isConnected, text: ta.value, von: ta.selectionStart, bis: ta.selectionEnd, fokus: sr.activeElement === ta, wartet: !!p._wartet };
  });
  erwarte('neue Strukturantwort verarbeitet', r.verarbeitet === 'Geänderte Baustelle B2' && r.wartet, JSON.stringify(r));
  erwarte('Text, Auswahl, Fokus und Knoten bleiben', r.gleich && r.text === 'Heizung schaltet nicht' && r.von === 0 && r.bis === 7 && r.fokus, JSON.stringify(r));
  await klick(page, `${D} >>> .sheet h3`);
  await warte(200);
  const n = await panel(page, D, () => ({ sichtbar: sr.querySelector('.ui').textContent.includes('Geänderte Baustelle B2'), text: (sr.querySelector('textarea[data-ml="text"]') || {}).value }));
  erwarte('nach dem Fokuswechsel neue Daten sichtbar, Entwurf bleibt', n.sichtbar && n.text === 'Heizung schaltet nicht', JSON.stringify(n));
});

/* B3 Scrollschutz: Hauptansicht, lange Einblendung, Chipleiste */
await fall('B3 Scrollschutz', browser, async (page, erwarte) => {
  const update = (sel, wert) => panel(page, sel, async () => { BB.welt[0].bereiche[0].name = a0; await p._laden(); await new Promise(r => setTimeout(r, 150)); return sr.querySelector('.ui').textContent.includes(a0); }, wert);
  // Hauptansicht (Desktop)
  await page.mouse.move(900, 600); await page.mouse.wheel({ deltaY: 500 }); await warte(300);
  const vor = await panel(page, D, () => sr.querySelector('.scroll').scrollTop);
  const neu1 = await update(D, 'Polier-Container');
  const nach = await panel(page, D, () => sr.querySelector('.scroll').scrollTop);
  erwarte('Hauptansicht: Position bleibt (±1 px)', vor > 50 && Math.abs(nach - vor) <= 1 && neu1, `vor ${vor}, nach ${nach}, verarbeitet ${neu1}`);
  // lange Einblendung: Warnungen
  await klick(page, `${D} >>> [data-act="sheet"][data-s="warnungen"]`); await warte(900);   // Einblendung fährt ein
  const sbox = await (await page.$(`${D} >>> .sheet.an`)).boundingBox();
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + Math.min(sbox.height, 800) / 2); await warte(150);
  for (let i = 0; i < 3 && await panel(page, D, () => sr.querySelector('.sheet').scrollTop) < 20; i++) { await page.mouse.wheel({ deltaY: 300 }); await warte(400); }
  const unter = await panel(page, D, () => { const t = sr.elementFromPoint(a0, a1); return t ? t.tagName + '.' + t.className : String(t); }, sbox.x + sbox.width / 2, sbox.y + Math.min(sbox.height, 800) / 2);
  const svor = await panel(page, D, () => ({ top: sr.querySelector('.sheet').scrollTop, hoch: sr.querySelector('.sheet').scrollHeight - sr.querySelector('.sheet').clientHeight }));
  const neu2 = await update(D, 'Polier-Contain3r');
  const snach = await panel(page, D, () => sr.querySelector('.sheet').scrollTop);
  erwarte('Einblendung: Position bleibt (±1 px)', svor.top > 20 && Math.abs(snach - svor.top) <= 1 && neu2, `vor ${JSON.stringify(svor)}, nach ${snach}, verarbeitet ${neu2}, unter der Maus ${unter}, Kasten ${JSON.stringify(sbox)}`);
  await klick(page, `${D} >>> .schleier.an`);
  // Chipleiste der Einstellungen (Handy)
  await klick(page, `${T} >>> nav [data-act="tab"][data-v="einst"]`);
  await klick(page, `${T} >>> .ev-chips [data-v="firmen"]`); await warte(200);
  const box = await (await page.$(`${T} >>> .ev-chips`)).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel({ deltaX: 30 }); await warte(300);
  const cvor = await panel(page, T, () => sr.querySelector('.ev-chips').scrollLeft);
  const neu3 = await update(T, 'Polier-Contain4r');
  const cnach = await panel(page, T, () => sr.querySelector('.ev-chips').scrollLeft);
  erwarte('Chipleiste: Position bleibt (±1 px)', cvor > 0 && Math.abs(cnach - cvor) <= 1, `vor ${cvor}, nach ${cnach}, verarbeitet ${neu3}`);
});

/* B4 Container live: (1) neue 5-Minuten-Statistik → Kennzahlen neu, Position bleibt, Rest bleibt;
   (2) neuer Sensorwert bei offener Einblendung → angekommen, aber Diagramm unverändert (heutige Unterdrückung) */
await fall('B4 Container live', browser, async (page, erwarte) => {
  await klick(page, `${D} >>> [data-act="container"][data-id="polier"]`); await warte(400);
  await page.mouse.move(900, 600); await page.mouse.wheel({ deltaY: 200 }); await warte(300);
  const merken = () => panel(page, D, () => { window.__rest = sr.querySelector('.c-text'); window.__wrap = sr.querySelector('.c-live .chart-wrap');
    return { w: window.__wrap.innerHTML, k: sr.querySelector('.c-live-kennz').textContent, scroll: sr.querySelector('.scroll').scrollTop, lg: p._liveGezeichnet || 0 }; });
  const zustand = (statistik) => panel(page, D, () => {
    if (a0) BB.TEST.statistik = (m, r) => { if (m.period !== '5minute') return r; for (const id in r) r[id] = r[id].map(x => x.change != null ? { ...x, change: x.change + 2 } : x); return r; };
    const eids = Object.entries(BB.welt[0].entitaeten).filter(([k]) => k.startsWith('polier_')).map(([, v]) => v);   // eigene Entitäten lösen aus
    for (const eid of eids) { const alt = BB.B.states[eid]; if (alt && Number.isFinite(+alt.state)) BB.B.states[eid] = { ...alt, state: String(+alt.state + 1) }; }
    VERSATZ += a0 ? 61000 : 11000; BB.hassNeu(); return eids.length;   // Uhr weiter: Live-Sperre 10 s, 5-Minuten-Statistik 60 s
  }, statistik);
  await panel(page, D, () => { window.__render = 0; const r = p.render.bind(p); p.render = (...a) => { window.__render++; return r(...a); }; });
  const vor = await merken(); const n = await zustand(true); await warte(600);
  const r = await panel(page, D, () => ({ w: sr.querySelector('.c-live .chart-wrap').innerHTML, k: sr.querySelector('.c-live-kennz').textContent, scroll: sr.querySelector('.scroll').scrollTop,
    render: window.__render, stat: BB.TEST.aufrufe.filter(m => m.type === 'baustelle/statistik' && m.period === '5minute').length }));
  await panel(page, D, () => { BB.TEST.statistik = null; });
  erwarte('neue Statistik: Kennzahlen neu, Position bleibt', n > 0 && r.k !== vor.k && Math.abs(r.scroll - vor.scroll) <= 1, `${vor.k.slice(0, 40)} → ${r.k.slice(0, 40)}, Scroll ${vor.scroll}→${r.scroll}`);
  erwarte('B4 Rest bleibt', r.render === 0, `render ${r.render}× (ganze Seite neu), 5-Minuten-Abfragen ${r.stat}`);
  // (2) Einblendung offen, nur Sensorwert
  await klick(page, `${D} >>> [data-act="sheet"][data-s="leistung"]`); await warte(400);
  const vor2 = await merken(); await zustand(false); await warte(400);
  const r2 = await panel(page, D, () => ({ w: sr.querySelector('.c-live .chart-wrap').innerHTML, lg: p._liveGezeichnet || 0 }));
  erwarte('offene Einblendung: Wert angekommen, Diagramm unverändert', r2.lg > vor2.lg && r2.w === vor2.w, `liveGezeichnet ${vor2.lg}→${r2.lg}, gleich ${r2.w === vor2.w}`);
});

/* B5 Leistung: Regler mit der Tastatur, Daten kommen verzögert; Datenteil neu, Regler/Fokus/Scroll bleiben */
await fall('B5 Leistung', browser, async (page, erwarte) => {
  await klick(page, `${D} >>> [data-act="container"][data-id="polier"]`); await warte(200);
  await klick(page, `${D} >>> [data-act="sheet"][data-s="leistung"]`); await warte(400);
  const regler = `${D} >>> input[data-lh]`;
  await page.waitForSelector(regler, { visible: true });
  const vor = await panel(page, D, () => { window.__regler = sr.querySelector('input[data-lh]'); window.__daten = sr.querySelector('.lh-daten');
    return { wert: +window.__regler.value, kopf: sr.querySelector('.lh-wert').textContent, daten: window.__daten.innerHTML, scroll: sr.querySelector('.sheet').scrollTop }; });
  await page.evaluate(() => { window.baustelleBeispiel.TEST.verzoegerung = 400; });
  await page.focus(regler); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  await warte(1200);
  const r = await panel(page, D, () => ({ wert: +sr.querySelector('input[data-lh]').value, gleich: sr.querySelector('input[data-lh]') === window.__regler, fokus: sr.activeElement === window.__regler,
    kopf: sr.querySelector('.lh-wert').textContent, daten: sr.querySelector('.lh-daten').innerHTML, datenKnoten: sr.querySelector('.lh-daten') === window.__daten, scroll: sr.querySelector('.sheet').scrollTop, h: p.s.sheet && p.s.sheet.h }));
  await page.evaluate(() => { window.baustelleBeispiel.TEST.verzoegerung = 0; });
  erwarte('Stunde gewählt, Datenteil neu', r.wert === vor.wert - 2 && r.h === r.wert && r.kopf !== vor.kopf && r.daten !== vor.daten, `${vor.wert}→${r.wert}, h ${r.h}, ${vor.kopf}→${r.kopf}`);
  erwarte('Regler, Fokus, Datenbereich und Scroll bleiben', r.gleich && r.fokus && r.datenKnoten && Math.abs(r.scroll - vor.scroll) <= 1, JSON.stringify({ gleich: r.gleich, fokus: r.fokus, datenKnoten: r.datenKnoten, scroll: [vor.scroll, r.scroll] }));
});

/* B6 Befehle und Rechte: ein Klick = genau ein Auftrag; Nicht-Admin ändert nichts, Vor-Ort-Aktion geht */
await fall('B6 Befehle/Rechte', browser, async (page, erwarte) => {
  let ab = await aufrufZahl(page);
  await klick(page, `${D} >>> [data-act="auto"]`); await warte(200);
  const admin = await schreibAnzahl(page, ab);
  erwarte('Admin: Automatik-Schalter sendet genau einen Auftrag', admin.length === 1 && admin[0] === 'baustelle/setzen', admin.join(', '));
  await panel(page, D, async () => { for (const b of BB.welt) b.rechte = { aendern: false, aktionen: ['gefuehl', 'warnung_stumm', 'jetzt_heizen', 'boost', 'bedarf', 'bedarf_aus'] }; await p._laden(); await new Promise(r => setTimeout(r, 150)); });
  ab = await aufrufZahl(page);
  await klick(page, `${D} >>> [data-act="auto"]`); await warte(200);
  const gesperrt = await schreibAnzahl(page, ab), toast = await panel(page, D, () => sr.querySelector('.toast').textContent);
  erwarte('Nicht-Admin: kein Auftrag, Hinweis „Nur ansehen“', !gesperrt.length && /ansehen/i.test(toast), `${gesperrt.join(', ')} / ${toast}`);
  await klick(page, `${D} >>> [data-act="sheet"][data-s="warnungen"]`); await warte(200);
  ab = await aufrufZahl(page);
  await klick(page, `${D} >>> [data-act="w-stumm"]`); await warte(200);
  const vorOrt = await schreibAnzahl(page, ab);
  erwarte('Nicht-Admin: Warnung stumm (Vor-Ort-Aktion) genau ein Auftrag', vorOrt.length === 1 && vorOrt[0] === 'baustelle/aktion:warnung_stumm', vorOrt.join(', '));
});

/* B7 Lebenszyklus: 20 × entfernen/einhängen – Timer, Abos, window-Listener nehmen nicht zu */
await fall('B7 Lebenszyklus', browser, async (page, erwarte) => {
  const stand = () => page.evaluate(() => ({ paste: window.__z.listener.paste, ort: window.__z.listener['location-changed'], intervalle: window.__z.intervalle.size, abos: window.baustelleBeispiel.TEST.abos }));
  // Erwartung je eingehängter Seite: 1 Minutentakt, 2 Wetter-Abos (täglich/stündlich); dazu der Takt des Mockups
  const soll = { intervalle: 2 + 1, abos: 2 * 2 };
  const vor = await stand();
  erwarte('Ausgangsstand: Takt und Abos je Seite', vor.intervalle === soll.intervalle && vor.abos === soll.abos, JSON.stringify(vor));
  await page.evaluate(async () => { const el = document.querySelector('#desktop baustelle-panel'), da = el.parentNode;
    for (let i = 0; i < 20; i++) { el.remove(); await new Promise(r => setTimeout(r, 10)); da.appendChild(el); await new Promise(r => setTimeout(r, 10)); } });
  await warte(300);
  const nach = await stand();
  erwarte('dasselbe Element: window-Listener und Takt nehmen nicht zu', nach.paste === vor.paste && nach.ort === vor.ort && nach.intervalle === soll.intervalle, `${JSON.stringify(vor)} → ${JSON.stringify(nach)}`);
  erwarte('B7 Abos nach Wiedereinhängen', nach.abos === soll.abos, `${JSON.stringify(vor)} → ${JSON.stringify(nach)}`);
  const vor2 = await stand();
  await page.evaluate(async () => { const da = document.querySelector('#desktop');
    for (let i = 0; i < 20; i++) { const alt = da.querySelector('baustelle-panel'), neu = document.createElement('baustelle-panel');
      neu.panel = alt.panel; neu.narrow = false; neu.hass = alt.hass; alt.remove(); da.appendChild(neu); await new Promise(r => setTimeout(r, 20)); } });
  await warte(300);
  const nach2 = await stand();
  erwarte('neue Elemente: Takt und Abos wie bei einer Seite', nach2.intervalle === soll.intervalle && nach2.abos === soll.abos, `${JSON.stringify(vor2)} → ${JSON.stringify(nach2)}`);
  erwarte('B7 neue Elemente', nach2.paste === vor2.paste && nach2.ort === vor2.ort, `${JSON.stringify(vor2)} → ${JSON.stringify(nach2)}`);
});

await browser.close(); server.close();
const gesamt = Date.now() - t0;
let rot = 0; const bekannteTreffer = [];
for (const e of ergebnisse) for (const p of e.pruef) if (!p.ok) { if (BEKANNT[p.text]) bekannteTreffer.push(`${p.text}: ${BEKANNT[p.text]} (${p.info})`); else rot++; }
for (const [k, v] of Object.entries(BEKANNT)) if (!ergebnisse.some(e => e.pruef.some(p => p.text === k && !p.ok))) console.log(`ℹ bekannt, aber nicht mehr aufgetreten – aus BEKANNT streichen: ${k} (${v})`);
if (bekannteTreffer.length) console.log('⚠ bekannte Fehler (nicht rot):\n  ' + bekannteTreffer.join('\n  '));
console.log(`Browser-Test ${rot ? 'ROT' : 'grün'}: ${ergebnisse.length} Fälle, ${(gesamt / 1000).toFixed(1)} s, ${chromeVersion}, puppeteer-core ${createRequire(join(FRONTEND, 'package.json'))('puppeteer-core/package.json').version}`);
if (BERICHT) writeFileSync(BERICHT, JSON.stringify({ version: VERSION, chrome: chromeVersion, gesamt_ms: gesamt, ergebnisse, bekannt: bekannteTreffer }, null, 1));
process.exit(rot ? 1 : 0);
