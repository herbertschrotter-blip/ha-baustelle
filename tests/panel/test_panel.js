// Seite „Baustelle“ (0.7.0) in Node rendern – ohne Browser, ohne WebGL (CSS-Rückfall).
// Rendert alle Ansichten und Einblendungen, löst die Aktionen aus und prüft die Aufrufe an die Integration
// (docs/api-0.7.md) sowie: kein undefined/NaN/[object im HTML, gültige SVGs.
// Aufruf: node tests/panel/test_panel.js custom_components/baustelle/frontend/baustelle-panel.js tests/panel/struktur-0.7.json
//   Mit dem Beispiel struktur-0.7.json (Werte wie im Mockup) prüft der Test Seite und Aufrufe im Einzelnen. Liegt
//   tests/panel/struktur-echt.json daneben (echte Antwort der Integration, erzeugt von tests/integration/test_abgleich.py),
//   läuft er zusätzlich dagegen – dort allgemein: jede Baustelle, jeder Container, jede Einblendung und Aktion.
//   BAUSTELLE_AUFRUFE=<datei>: alle gesendeten WebSocket-Befehle als JSON dorthin schreiben (test_abgleich.py schickt sie
//   danach an die echte Integration).
'use strict';
const fs = require('fs');
const path = require('path');
const argumente = process.argv.slice(2), einzeln = argumente.includes('--einzeln');
const [datei, ...strukturDateien] = argumente.filter(a => a !== '--einzeln');
if (!datei || !strukturDateien.length) { console.error('Aufruf: node tests/panel/test_panel.js <baustelle-panel.js> <struktur-0.7.json> [weitere Struktur …]'); process.exit(2); }
if (!einzeln) {
  const liste = [...strukturDateien], echt = path.join(__dirname, 'struktur-echt.json');
  if (fs.existsSync(echt) && !liste.some(f => path.resolve(f) === echt)) liste.push(echt);
  if (liste.length > 1) {
    let rot = 0;
    for (const f of liste) { console.log(`— ${path.relative(process.cwd(), path.resolve(f))}`); const r = require('child_process').spawnSync(process.execPath, [__filename, datei, f, '--einzeln'], { stdio: 'inherit' }); if (r.status !== 0) rot++; }
    process.exit(rot ? 1 : 0);
  }
}
const strukturDatei = strukturDateien[0];
const strukturEingabe = JSON.parse(fs.readFileSync(strukturDatei, 'utf8'));
// Alter Aufruf mit dem 0.6-Diagnose-Beispiel (kein Array von Baustellen): auf das 0.7-Beispiel ausweichen
const STRUKTUR = Array.isArray(strukturEingabe) ? strukturEingabe
  : (console.warn(`${strukturDatei} ist keine 0.7-Struktur – nehme tests/panel/struktur-0.7.json`),
     JSON.parse(fs.readFileSync(path.join(__dirname, 'struktur-0.7.json'), 'utf8')));
// Beispiel wie im Mockup (Einzelprüfungen) oder echte Antwort der Integration (allgemeine Prüfungen)
const REFERENZ = STRUKTUR.some(b => b.baustelle && b.baustelle.entry_id === 'dobl');
// Zustände der Entitäten und Kalender zur echten Antwort (test_abgleich.py), sonst erfunden
const zustaendeDatei = Array.isArray(strukturEingabe) ? strukturDatei.replace(/\.json$/, '.zustaende.json') : '';
const ZUSTAENDE = !REFERENZ && zustaendeDatei && fs.existsSync(zustaendeDatei) ? JSON.parse(fs.readFileSync(zustaendeDatei, 'utf8')) : null;

/* ---------- minimales DOM (wie mockups/quelle/vorschau/pruefen.cjs) ---------- */
const klassen = () => { const s = new Set(); return { add: k => s.add(k), remove: k => s.delete(k), toggle: (k, an) => ((an ?? !s.has(k)) ? s.add(k) : s.delete(k)), contains: k => s.has(k), liste: s }; };
const element = (name = 'div') => ({ tagName: name.toUpperCase(), dataset: {}, style: {}, classList: klassen(), innerHTML: '', textContent: '', scrollTop: 0, offsetWidth: 100, offsetHeight: 30, clientWidth: 390, clientHeight: 844,
  kinder: {}, querySelector(s) { return this.kinder[s] ||= element(); }, querySelectorAll() { return []; }, insertBefore() {}, appendChild() {}, addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }) });
const downloads = [], events = [];
class HTMLElement {
  constructor() { this.dataset = {}; }
  attachShadow() {
    const teile = {}, handler = {};
    this.shadowRoot = { set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; }, activeElement: null, teile, handler,
      querySelector: s => teile[s] ||= element(), querySelectorAll: () => [], addEventListener: (t, f) => { handler[t] = f; } };
    return this.shadowRoot;
  }
  dispatchEvent(e) { events.push(e.type); return true; }
}
global.HTMLElement = HTMLElement;
const registry = {};
global.customElements = { define: (n, c) => { registry[n] = c; }, get: n => registry[n] };
global.localStorage = { getItem: () => null, setItem() {} };
global.document = { createElement: n => { const e = element(n); e.click = () => downloads.push(e.download); return e; } };
global.setInterval = () => 1; global.clearInterval = () => {};
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: t => { downloads.push('clipboard:' + t.length); return Promise.resolve(); } } }, configurable: true });
global.fetch = async url => ({ ok: true, json: async () => (String(url).includes('changelog.json')
  ? [{ version: '0.7.0', datum: '2026-10-01', punkte: ['Glas-Oberfläche mit Himmel nach Tageszeit und Wetter', 'Staffelung der Heizungen je Stromanschluss'] },
     { version: '0.6.3', datum: '2026-09-29', punkte: ['Wettersymbole'] }] : null) });
console.warn = () => {};
eval(fs.readFileSync(datei, 'utf8'));
const P = registry['baustelle-panel'];
const schluesselFehlt = [];
if (P) { const eid = P.prototype.eid; P.prototype.eid = function (d, besitzer, key) { const r = eid.call(this, d, besitzer, key); if (!r && d && d.ent) schluesselFehlt.push(`${besitzer}_${key}`); return r; }; }
if (!P) { console.error('baustelle-panel wurde nicht registriert'); process.exit(1); }

/* ---------- Fake-hass ---------- */
const JETZT = Date.parse('2026-09-29T16:20:00+02:00');
let struktur = JSON.parse(JSON.stringify(STRUKTUR));
const aufrufe = [], api = [], alleAufrufe = [];
const zufall = s => () => (s = (s * 9301 + 49297) % 233280) / 233280;
const hash = t => { let h = 7; for (const c of t) h = (h * 31 + c.charCodeAt(0)) % 100003; return h; };
function statistik(m) {
  const von = Date.parse(m.start_time), bis = Math.min(Date.parse(m.end_time || new Date(JETZT).toISOString()), JETZT), erg = {};
  for (const id of m.statistic_ids) {
    const r = zufall(hash(id + m.period)), punkte = [];
    for (let t = von; t < bis;) {
      const h = new Date(t).getUTCHours() + 2, tag = new Date(t).getUTCDay();
      let p = {};
      if (/aussen|temperatur/.test(id)) p = { mean: id.includes('aussen') ? 4 + 3 * Math.sin((h - 9) / 24 * 2 * Math.PI) + r() : 17 + r() * 3 };
      else if (/pumpzyklen/.test(id)) p = { change: Math.round((m.period === 'hour' ? 1 : 30) * r()) };
      else if (/heizzeit|pumpzeit/.test(id)) p = { change: (m.period === 'hour' ? .7 : m.period === 'day' ? 6 : 150) * r() };
      else p = { change: (m.period === 'hour' ? (h >= 6 && h < 18 ? 2.5 : .2) : m.period === 'day' ? (tag === 0 || tag === 6 ? 2 : 14) : 300) * (.6 + r() * .6) * (id.includes('ohne') ? 4 : 1) };
      punkte.push({ start: t, end: t + 36e5, ...p });
      if (m.period === 'hour') t += 36e5; else if (m.period === 'day') t += 864e5; else { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + 1); t = d.getTime(); }
    }
    erg[id] = punkte;
  }
  return erg;
}
function verlauf(m) {
  const von = Date.parse(m.start_time), erg = {};
  for (const id of m.entity_ids) {
    const liste = [];
    for (let t = von, k = 0; t < JETZT; t += 20 * 6e4, k++) {
      const h = (new Date(t).getUTCHours() + 2) % 24, an = h >= 6 && h < 17 && k % 3 !== 2;
      liste.push({ s: id.includes('lager_r') && t > Date.parse('2026-09-29T10:42:00+02:00') ? 'unavailable' : an ? '1980' : '0.4', lu: t / 1000 });
    }
    erg[id] = liste;
  }
  return erg;
}
const meldungen = [
  { id: 'm1', art: 'wunsch', text: 'Eigene Kachel für Bautrockner mit Laufzeit, damit man sie der Firma verrechnen kann.', kontext: 'Übersicht', zeit: '2026-09-28T17:02:00+02:00', version: '0.7.0', geraet: 'Handy', status: 'offen', stand: null },
  { id: 'm2', art: 'fehler', text: 'Nebel-Symbol war im Dunkelmodus kaum zu sehen.', kontext: 'Übersicht · Wetter', zeit: '2026-09-28T20:15:00+02:00', version: '0.6.2', geraet: 'Desktop', status: 'erledigt', stand: null }];
let strukturHaengt = false, strukturFehler = false;
const states = {};
const setze = (eid, state, attributes = {}) => { states[eid] = { entity_id: eid, state: String(state), attributes: { friendly_name: eid.split('.')[1].replace(/_/g, ' '), ...attributes } }; };
for (const b of STRUKTUR) for (const eid of Object.values(b.entitaeten)) setze(eid, eid.startsWith('switch') || eid.startsWith('binary') ? 'on' : '12.5');
for (const b of STRUKTUR) for (const g of b.geraete) { setze(g.schalter, 'on', { friendly_name: `${g.name} ${g.bereich}` }); setze(g.leistung, '1980', { device_class: 'power' }); }
setze('sun.sun', 'above_horizon', { elevation: 18, rising: false });
if (ZUSTAENDE) for (const [eid, z] of Object.entries(ZUSTAENDE.zustaende)) states[eid] = { entity_id: eid, state: z.state, attributes: z.attributes };   // echte Zustände
if (REFERENZ) {
  setze('sensor.dobl_energie', '412', {}); setze('sensor.dobl_energie_oelradiator', '240'); setze('sensor.dobl_heizzeit_oelradiator', '148'); setze('sensor.dobl_energie_konvektor', '160'); setze('sensor.dobl_heizzeit_konvektor', '82');
  setze('sensor.dobl_ersparnis', '515.2');
  setze('sun.sun', 'above_horizon', { elevation: 18, rising: false });
  setze('weather.dobl', 'rainy', { friendly_name: 'Open-Meteo Dobl', temperature: 4.2, apparent_temperature: 1 });
  setze('weather.kalsdorf', 'cloudy', { friendly_name: 'Open-Meteo Kalsdorf', temperature: 4.6 });
  for (const t of ['polier', 'mannschaft', 'sanitaer', 'besprechung']) setze(`sensor.${t}_temperatur`, '19', { device_class: 'temperature', friendly_name: `${t} Temperatur` });
  setze('binary_sensor.tuer_polier', 'off', { device_class: 'door', friendly_name: 'Tür Polier' });
  setze('binary_sensor.tuer_magazin', 'on', { device_class: 'door', friendly_name: 'Tür Magazin' });
  setze('binary_sensor.tuer_mannschaft', 'off', { device_class: 'door', friendly_name: 'Tür Mannschaft (neu)' });
  setze('switch.heizung_03', 'off', { friendly_name: 'Heizung 03' }); setze('switch.heizung_04', 'off', { friendly_name: 'Heizung 04' });
  setze('calendar.besprechungen', 'off', { friendly_name: 'Besprechungen' }); setze('calendar.baustelle_urlaub', 'off', { friendly_name: 'Baustelle Urlaub' });
  setze('calendar.feiertage_oesterreich', 'off', { friendly_name: 'Feiertage' }); setze('notify.mobile_app_handy_herbert', 'unknown', { friendly_name: 'Handy Herbert' });
  setze('sensor.regen_dobl', '6', { device_class: 'precipitation' });
}
const vorhersage = art => art === 'daily'
  ? ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((t, i) => ({ datetime: `${t}T12:00:00+02:00`, condition: ['rainy', 'fog', 'partlycloudy', 'rainy', 'sunny'][i], temperature: [9, 7.1, 9.4, 8.2, 11][i], templow: [2, -1.2, 1.8, 4.1, 3][i], precipitation: [6, 0, 0, 5.5, 0][i], precipitation_probability: [90, 10, 15, 80, 5][i] }))
  : [...Array(30)].map((_, i) => ({ datetime: new Date(JETZT + (i + 1) * 36e5 - 20 * 6e4).toISOString(), condition: i < 2 ? 'rainy' : i < 5 ? 'cloudy' : 'clear-night', temperature: 3.8 - i * .3, precipitation: i < 2 ? .8 - i * .4 : 0, precipitation_probability: Math.max(0, 70 - i * 15) }));
const hass = {
  states, themes: { darkMode: true }, config: { version: '2026.9.4' }, language: 'de',
  connection: { subscribeMessage: (cb, msg) => { cb({ type: msg.forecast_type, forecast: vorhersage(msg.forecast_type) }); return Promise.resolve(() => {}); } },
  callWS: async m => {
    aufrufe.push(m); alleAufrufe.push(JSON.parse(JSON.stringify(m)));
    switch (m.type) {
      case 'baustelle/struktur': if (strukturFehler) throw { code: 'unknown_command', message: 'Unknown command.' }; if (strukturHaengt) return new Promise(() => {}); return JSON.parse(JSON.stringify(struktur));
      case 'recorder/statistics_during_period': return statistik(m);
      case 'history/history_during_period': return verlauf(m);
      case 'baustelle/protokoll': { const b = struktur.find(x => x.baustelle.entry_id === m.entry_id); const p = b.laufzeit.protokoll.length ? b.laufzeit.protokoll : [['2026-04-17T12:00:00+02:00', 'einstellung', null, 'Baustelle abgeschlossen – Heizung aus, Werte gespeichert'], ['2026-03-03T06:00:00+02:00', 'warnung', `${m.entry_id}-3`, 'Frostgefahr 3,8 °C trotz Frostschutz'], ['2026-03-02T11:00:00+02:00', 'ok', `${m.entry_id}-3`, 'wieder über 5 °C']];
        return [...p, ...p.map(e => [e[0].replace('2026-09-2', '2026-09-1'), ...e.slice(1)])].slice(0, m.limit); }
      case 'baustelle/meldungen': return JSON.parse(JSON.stringify(meldungen));
      case 'baustelle/bericht': { const b = struktur.find(x => x.baustelle.entry_id === m.entry_id), mon = m.art === 'monat', titel = b ? b.baustelle.titel : '';   // wie nachrichten.async_bericht_vorschau
        return { art: m.art, von: mon ? '2026-08-01' : '2026-09-21', bis: mon ? '2026-08-31' : '2026-09-27', betreff: `Baustelle ${titel} – ${mon ? 'August 2026' : 'Woche 21.–27.09.2026'}`,
          summe: mon ? 'August: 1 480 kWh · 414,40 €' : 'Vorwoche: 312 kWh · 87,47 €', vergleich: mon ? '(+31 % zum Juli)' : '(−4 % zur Woche davor)',
          firmen: [{ name: 'Eigene Firma', kwh: 250, eur: 70 }, { name: 'Elektro Huber GmbH', kwh: 62.4, eur: 17.47 }], container: (b ? b.bereiche : []).map((c, i) => ({ name: c.name, kwh: 10 * i })),
          heiztage: 5, gespart_eur: null, warnungen: [{ bereich: 'Lager Süd', titel: 'nicht erreichbar' }, { bereich: null, titel: 'Keine Wettervorhersage' }], mail_an: 'herbert@example.at', anhang: mon ? 'abrechnung-2026-08.csv' : 'abrechnung-kw39.csv', handy: true }; }
      case 'auth/sign_path': return { path: `${m.path}?authSig=abc` };
      case 'baustelle/setzen': { const b = struktur.find(x => x.baustelle.entry_id === m.entry_id); let o = b.einstellungen;   // wie die Integration: Wert bleibt gespeichert
        for (const k of m.pfad.slice(0, -1)) o = o[k] ||= {}; o[m.pfad.at(-1)] = m.wert; return { ok: true }; }
      default: return { ok: true };
    }
  },
  callApi: async (methode, pfad, daten) => {   // REST wie die Seite ihn ruft; mitgeschrieben für test_abgleich.py
    const antwort = await callApiFake(methode, pfad, daten);
    alleAufrufe.push({ type: 'rest', methode, pfad, daten: daten ?? null, antwort: methode === 'GET' ? null : JSON.parse(JSON.stringify(antwort ?? null)) });
    return antwort;
  },
  callService: async () => { throw new Error('Die Seite soll Dienste nicht direkt aufrufen'); },
};
async function callApiFake(methode, pfad, daten) {
  {
    api.push([methode, pfad, daten]);
    if (methode === 'GET' && ZUSTAENDE) return JSON.parse(JSON.stringify((ZUSTAENDE.kalender || {})[pfad.split('?')[0].slice(10)] || []));   // echte Kalender
    if (methode === 'GET' && pfad.startsWith('calendars/calendar.feiertage')) return [['2026-10-26', 'Nationalfeiertag'], ['2026-11-01', 'Allerheiligen'], ['2026-12-08', 'Mariä Empfängnis'], ['2026-12-25', 'Christtag'], ['2026-12-26', 'Stefanitag']]
      .map(([t, n], i) => ({ summary: n, start: { date: t }, end: { date: t }, uid: 'f' + i }));
    if (methode === 'GET') return [{ summary: 'Weihnachten', start: { date: '2026-12-23' }, end: { date: '2027-01-07' }, uid: 'urlaub-1' }];
    if (methode === 'DELETE') return {};
    if (/flow$/.test(pfad)) return { type: 'form', flow_id: 'F' + api.length };
    if (pfad.includes('subentries') && daten && daten.art) {   // neuer Bereich → erscheint in der Struktur
      const b = struktur[0]; if (!b.bereiche.some(x => x.name === daten.name)) b.bereiche.push({ id: 'neu-' + b.bereiche.length, name: daten.name, art: daten.art, fuehler: daten.fuehler || null, nr: b.bereiche.length });
      return { type: 'create_entry' };
    }
    if (pfad.includes('subentries')) return api.some(a => a[2] && a[2].subentry_id) ? { type: 'abort', reason: 'reconfigure_successful' } : { type: 'create_entry' };
    if (pfad.includes('options')) return { type: 'create_entry' };
    return { type: 'create_entry', result: { entry_id: 'neu' }, next_flow: ['config_subentries_flow', 'S1'] };
  }
}

/* ---------- Prüfwerkzeuge ---------- */
const fehler = [];
const ruhe = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
function svgPruefen(html, wo) {
  for (const m of html.matchAll(/<svg[\s\S]*?<\/svg>/g)) {
    const svg = m[0], stapel = [];
    if (/NaN|undefined|Infinity/.test(svg)) { fehler.push(`${wo}: SVG mit NaN/undefined: ${svg.match(/.{40}(NaN|undefined|Infinity).{20}/)?.[0]}`); continue; }
    for (const t of svg.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
      const [, zu, name, , selbst] = t;
      if (selbst) continue;
      if (!zu) stapel.push(name); else if (stapel.pop() !== name) { fehler.push(`${wo}: SVG-Tags passen nicht (</${name}>)`); break; }
    }
    if (stapel.length) fehler.push(`${wo}: SVG nicht geschlossen (${stapel.join(',')})`);
  }
}
let panel, ui;
const html = () => ui.innerHTML + panel.shadowRoot.teile['.ui'].innerHTML.slice(0, 0);
function pruefe(wo, { laedtErlaubt = false } = {}) {
  const h = ui.innerHTML;
  const m = h.match(/.{50}(undefined|NaN|\[object|Infinity|>null<).{25}/s);
  if (m) fehler.push(`${wo}: ${m[0].replace(/\s+/g, ' ')}`);
  if (!laedtErlaubt && /Lädt …/.test(h)) fehler.push(`${wo}: bleibt bei „Lädt …“`);
  if (/Fehler: /.test(panel.letzterToast || '')) { fehler.push(`${wo}: Toast ${panel.letzterToast}`); panel.letzterToast = ''; }
  svgPruefen(h, wo);
  // Aufbau: jeder geöffnete Block wird wieder geschlossen (sonst rutschen Folgeelemente in die falsche Zeile)
  for (const tag of ['div', 'span', 'button', 'label', 'nav']) {
    const auf = (h.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length, zu = (h.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (auf !== zu) fehler.push(`${wo}: <${tag}> ${auf}× geöffnet, ${zu}× geschlossen`);
  }
  return h;
}
const klick = async (ds, n) => { panel.klick({ target: { closest: () => ({ dataset: ds }) } }); await ruhe(n); };
const eingabe = (ds, value) => panel.eingabe({ target: { dataset: ds, value } });
const erwarte = (text, bedingung) => { if (!bedingung) fehler.push('erwartet: ' + text); };
const letzte = typ => aufrufe.filter(a => a.type === typ);
const neu = () => { aufrufe.length = 0; api.length = 0; };
const hov = wo => { let t = ''; const alt = panel.tip; panel.tip = (e, h) => { t = h || ''; };
  for (const k of [...ui.innerHTML.matchAll(/data-chart="([^"]+)"/g)].map(m => m[1])) for (const x of [40, 150, 300]) {
    const svg = { dataset: { chart: k }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320 }), querySelector: () => ({}), querySelectorAll: () => [] };
    panel.hover({ target: { closest: s => s === 'svg.chart' ? svg : s === '.bar' ? { dataset: { i: '2' } } : null }, clientX: x, clientY: 60 });
    if (/NaN|undefined/.test(t)) fehler.push(`${wo}: Hover ${k} ${t}`); }
  panel.tip = alt; };

/* ---------- allgemeine Prüfung gegen die echte Antwort der Integration (struktur-echt.json) ---------- */
const ANSICHTEN = ['uebersicht', 'heizung', 'auswertung', 'verlauf', 'einst', 'ueber', 'dev'];
const EINBLENDUNGEN = ['verbrauch', 'wetter', 'warnungen', 'baustellen', 'heizplan', 'strom', 'nachrichten', 'bericht', 'container-neu', 'abschliessen', 'urlaub', 'wetterquelle', 'name', 'baustelle-neu', 'termin'];
async function allgemein() {
  const aktive = STRUKTUR.filter(b => (b.baustelle.status || 'aktiv') !== 'abgeschlossen'), fertige = STRUKTUR.filter(b => b.baustelle.status === 'abgeschlossen');
  erwarte('echte Antwort mit mindestens einer laufenden Baustelle', aktive.length > 0);
  for (const bs of aktive) {
    const bid = bs.baustelle.entry_id;
    await klick({ act: 'bs-wahl', id: bid }, 30);
    const d = panel.d;
    erwarte(`Baustelle ${bid} gewählt`, d && d.entry === bid && ui.innerHTML.includes(d.titel.replace(/&/g, '&amp;')));
    erwarte(`${bid}: alle Container der Integration auf der Seite`, d.bereiche.length === bs.bereiche.length && bs.bereiche.every(b => ui.innerHTML.includes(b.name)));
    for (const v of ANSICHTEN) { await klick({ act: 'tab', v }, 30); pruefe(`${bid} ${v}`); hov(`${bid} ${v}`); }
    await klick({ act: 'tab', v: 'uebersicht' }, 30);
    for (const w of d.warnungen.filter(x => !x.stumm)) erwarte(`${bid}: Warnung „${w.titel}“ sichtbar`, panel.d.warnungen.some(x => x.key === w.key));
    for (const b of d.bereiche) {
      await klick({ act: 'container', id: b.id }, 30); const h = pruefe(`${bid} ${b.id}`);
      erwarte(`${bid} ${b.id}: Name und Geräte`, h.includes(b.name) && b.geraete.every(g => h.includes(g.n.replace(/&/g, '&amp;'))));
      if (b.bedarf) { const T = d.termine.filter(t => t.b === b.id), H = d.z.HEUTE, offen = t => t.datum > H || (t.datum === H && t.bis > d.z.JETZT);
        const zeilen = new Set(T.filter(t => t.rrule || offen(t)).map(t => (t.rrule && t.uid) || JSON.stringify(t))).size;
        erwarte(`${bid} ${b.id}: eine Zeile je Termin-Serie (${zeilen})`, (h.match(/data-act="termin-weg"/g) || []).length === zeilen);
        for (const m of h.matchAll(/nächster \S+ (\d\d)\.(\d\d)\./g)) erwarte(`${bid} ${b.id}: „nächster“ liegt nicht in der Vergangenheit`, `${H.slice(0, 4)}-${m[2]}-${m[1]}` >= H); }
      for (const c of b.pumpe ? ['pumpzeit', 'zyklen', 'verbrauch'] : ['temp', 'verbrauch', 'heizzeit']) { await klick({ act: 'chart', c }, 30); pruefe(`${bid} ${b.id} ${c}`); hov(`${bid} ${b.id} ${c}`); }
      if (!b.pumpe && b.fuehler) { await klick({ act: 'chart', c: 'temp' }); await klick({ act: 'temp-vb' }); pruefe(`${bid} ${b.id} ohne Verbrauch`); await klick({ act: 'temp-vb' }); }
    }
    await klick({ act: 'tab', v: 'heizung' });
    for (const art of ['tag', 'woche']) { await klick({ act: 'hz-art', v: art }, 30); pruefe(`${bid} heizzeiten ${art}`); }
    for (const t of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) { await klick({ act: 'hz-tag', v: t, art: 'tag' }, 30); pruefe(`${bid} heizzeiten ${t}`); }
    await klick({ act: 'az-alt' }); pruefe(`${bid} frühere Arbeitszeiten`);
    await klick({ act: 'tab', v: 'auswertung' }, 30);
    for (const scope of ['diese', 'alle']) { await klick({ act: 'aw-scope', v: scope }, 30);
      for (const z of ['Tag', 'Woche', 'Monat', 'Jahr']) { await klick({ act: 'vb-zeitraum', ziel: 'aw', v: z }, 40);
        for (const gr of ['teil', 'firma']) { await klick({ act: 'vb-gruppe', ziel: 'aw', v: gr }, 40); pruefe(`${bid} auswertung ${scope} ${z} ${gr}`); hov(`${bid} auswertung ${scope} ${z}`); }
        await klick({ act: 'vb-wer', ziel: 'aw' }); pruefe(`${bid} auswertung Summe ${z}`);
        await klick({ act: 'vb-wer', ziel: 'aw', id: '*' }); pruefe(`${bid} auswertung alle ${z}`); } }
    await klick({ act: 'aw-scope', v: 'diese' });
    await klick({ act: 'tab', v: 'verlauf' }, 30);
    for (const v of ['tag', 'monat', 'ges']) { await klick({ act: 'vgl', v }); pruefe(`${bid} verlauf ${v}`); }
    for (const f of ['alle', 'warnung', 'schalten', 'wetter', 'nachricht']) { await klick({ act: 'pfilter', v: f }, 20); pruefe(`${bid} protokoll ${f}`); }
    await klick({ act: 'pfilter', v: 'alle' }); await klick({ act: 'pmehr' }, 20); pruefe(`${bid} protokoll mehr`);
    await klick({ act: 'verlauf', v: 'ab' }); pruefe(`${bid} verlauf abgeschlossen`); await klick({ act: 'verlauf', v: 'aktiv' });
    await klick({ act: 'tab', v: 'dev' }, 20); for (const f of ['offen', 'erledigt', 'alle']) { await klick({ act: 'mfilter', v: f }); pruefe(`${bid} dev ${f}`); }
    await klick({ act: 'tab', v: 'ueber' }); await klick({ act: 'cl', i: '1' }); pruefe(`${bid} über verlauf`);
  }
  for (const bs of fertige) { const id = bs.baustelle.entry_id; await klick({ act: 'bs-oeffnen', id }, 40); pruefe(`bsdetail ${id}`); hov(`bsdetail ${id}`);
    erwarte(`bsdetail ${id} zeigt Kennzahlen`, /ABGESCHLOSSEN/.test(ui.innerHTML) && /Verbrauch je Monat/.test(ui.innerHTML));
    if (bs.zaehler && bs.zaehler.heiztage != null) erwarte(`bsdetail ${id}: Heiztage wie die Integration (${bs.zaehler.heiztage})`, ui.innerHTML.includes(`<b>${bs.zaehler.heiztage}</b><span>Heiztage`)); }

  /* Einblendungen der ersten laufenden Baustelle */
  const entry = aktive[0].baustelle.entry_id;
  // Jeder Entitäts-Schlüssel, den die Seite nachschlägt (api §5), gibt es in `entitaeten` (außer Heizzeit eines Pumpenschachts)
  const schacht = new Set(STRUKTUR.flatMap(b => b.bereiche.filter(x => x.art === 'pumpenschacht').map(x => `${x.id}_heizzeit`)));
  const fehlend = [...new Set(schluesselFehlt)].filter(k => !schacht.has(k));
  erwarte(`Entitäts-Schlüssel der Seite fehlen in entitaeten: ${fehlend.join(', ')}`, !fehlend.length);
  await klick({ act: 'bs-wahl', id: entry }, 30);
  const d = () => panel.d, C = () => d().bereiche.filter(b => !b.pumpe), bedarf = () => C().find(b => b.bedarf) || C()[0];
  for (const s of EINBLENDUNGEN) { await klick({ act: 'sheet', s, id: s === 'termin' ? bedarf().id : undefined }, 30); const h = pruefe(`Einblendung ${s}`); erwarte(`Einblendung ${s} offen`, /class="sheet glas-panel an"/.test(h)); hov(`Einblendung ${s}`); }
  await klick({ act: 'sheet', s: 'wetter' }, 20); for (const wa of ['std', 'tag', '3']) { await klick({ act: 'wa', v: wa }, 20); pruefe(`Wetter ${wa}`); }
  await klick({ act: 'sheet', s: 'verbrauch' }, 20);
  for (const z of ['Tag', 'Woche', 'Monat', 'Jahr']) { await klick({ act: 'vb-zeitraum', ziel: 'sheet', v: z }, 30); for (const b of C().slice(0, 2)) await klick({ act: 'vb-wer', ziel: 'sheet', id: b.id }); pruefe(`Verbrauch ${z}`); hov(`Verbrauch ${z}`); }
  await klick({ act: 'vb-gruppe', ziel: 'sheet', v: 'firma' }, 30); pruefe('Verbrauch nach Firma');
  for (let i = 0; i < d().arbeitszeiten.length; i++) { await klick({ act: 'sheet', s: 'az', i: String(i) }); pruefe(`Arbeitszeit ${i}`); }
  for (const f of [...d().firmen.map(x => x.id), undefined]) { await klick({ act: 'firma-auf', id: f }); pruefe(`Firma ${f || 'neu'}`); }
  for (const a of [...d().anschluesse.map(x => x.id), undefined]) { await klick({ act: 'anschluss-auf', id: a }); pruefe(`Anschluss ${a || 'neu'}`); }
  for (const v of ['heute-laenger', 'morgen-spaeter', 'samstag', 'frei', '']) { await klick({ act: 'ausn-neu', v }); pruefe(`Ausnahme ${v}`); }
  await klick({ act: 'az-neu' }); pruefe('Neue Arbeitszeit');
  await klick({ act: 'bedarf-auf', id: bedarf().id }); pruefe('Bedarf');
  await klick({ act: 'melden' }); pruefe('Melden'); await klick({ act: 'ml-art', v: 'fehler' }); pruefe('Melden Fehler');
  for (const b of d().bereiche) { await klick({ act: 'bereich-einst', id: b.id }); pruefe(`Bearbeiten ${b.id}`); }
  await klick({ act: 'sheet', s: 'container-neu' }); await klick({ act: 'neu-art', v: 'Pumpenschacht' }); pruefe('Neuer Schacht');
  for (const art of ['monat', 'woche']) { await klick({ act: 'e-wert', k: 'bericht', v: art }, 30); await klick({ act: 'sheet', s: 'bericht' }, 40); pruefe(`Bericht ${art}`);
    erwarte(`Bericht ${art} von der Integration`, letzte('baustelle/bericht').some(a => a.art === art && a.entry_id === entry)); }
  await klick({ act: 'zu' });

  /* Aktionen: jeder Befehl geht mit entry_id an die Integration (Inhalt prüft test_abgleich.py gegen die echte) */
  const gesendet = async (typ, wo, ds, vorher) => { neu(); if (vorher) await vorher(); await klick(ds, 30); const a = letzte(typ).at(-1);
    erwarte(`${wo}: ${typ} gesendet (${JSON.stringify(ds)})`, a && (a.entry_id === entry || !typ.startsWith('baustelle/'))); return a; };
  await klick({ act: 'tab', v: 'uebersicht' });
  for (const ds of [{ act: 'auto' }, { act: 'auto' }, { act: 'st', k: 'vorheizen', d: '5' }, { act: 'st', k: 'nutzbar', d: '-5' }, { act: 'st', k: 'soll', d: '0.5' },
    ...['nachheizen', 'grenze', 'frueh_temp', 'frueh_min', 'frost_temp', 'tr_mm', 'tr_laenger', 'tr_frueher', 'boost_min', 'tuer_pause', 'tuer_melden', 'max_gleich', 'min_lauf', 'min_pause', 'takt']
      .map(k => ({ act: 'st', k, d: '1' })),
    { act: 'e-bool', k: 'fruehstart' }, { act: 'e-bool', k: 'staffel' }, { act: 'e-bool', k: 'melden' }, { act: 'e-bool', k: 'knoepfe' }, { act: 'e-bool', k: 'feiertag_frei' },
    ...Object.keys(ARTEN_TEST).map(k => ({ act: 'e-bool', k })), { act: 'basis', v: 'jetzt' }, { act: 'basis', v: 'tageshoechst' },
    { act: 'e-wert', k: 'bericht', v: 'beides' }, { act: 'e-wert', k: 'bericht', v: 'woche' }, { act: 'prio', id: C()[0].id, v: 'hoch' },
    { act: 'jc-auto', id: C()[0].id }, { act: 'tr-b', id: C()[0].id }, { act: 'jc-soll', id: C()[0].id, d: '0.5' }])
    await gesendet('baustelle/setzen', 'Einstellung', ds);
  // Stepper an der Grenze: kein Wert, den die Integration ablehnt (z. B. schnell aufheizen mindestens 5 min, Soll 5–30 °C)
  neu(); for (let i = 0; i < 120; i++) { await klick({ act: 'st', k: 'boost_min', d: '-5' }, 2); await klick({ act: 'st', k: 'soll', d: '0.5' }, 2); }
  erwarte('Stepper bleiben in den Grenzen der Integration', letzte('baustelle/setzen').every(a => a.wert >= 5 && a.wert <= 30 || a.pfad[1] === 'boost_min' && a.wert >= 5)
    && d().e.boost_min === 5 && d().e.soll === 30);
  neu(); panel.aenderung({ target: { dataset: { k: 'preis' }, value: '0,31' } }); await ruhe(); erwarte('Preis', letzte('baustelle/setzen').length === 1);
  neu(); panel.aenderung({ target: { dataset: { k: 'mail' }, value: ' bau@example.at ' } }); await ruhe(); erwarte('Mail', letzte('baustelle/setzen').length === 1);
  const c = C()[0];
  await klick({ act: 'container', id: c.id }, 20);
  await gesendet('baustelle/setzen', 'Container-Automatik', { act: 'b-auto' });
  await gesendet('baustelle/setzen', 'Container trocknen', { act: 'b-trocknen' });
  await gesendet('baustelle/aktion', 'Schnell aufheizen', { act: 'boost', id: c.id });
  if (c.geraete.length) await gesendet('baustelle/aktion', 'Gerät schalten', { act: 'geraet', i: '0' });
  const bb = bedarf();
  await gesendet('baustelle/aktion', 'Bedarf 1 h', { act: 'bedarf-an', id: bb.id, v: '60' });
  await gesendet('baustelle/aktion', 'Bedarf bis Arbeitsende', { act: 'bedarf-an', id: bb.id, v: 'ende' }, async () => { await klick({ act: 'bedarf-auf', id: bb.id }); await klick({ act: 'bedarf-boost' }); });
  await gesendet('baustelle/aktion', 'Bedarf bis 19:00', { act: 'bedarf-an', id: bb.id, v: 'abend' });
  await gesendet('baustelle/aktion', 'Bedarf beenden', { act: 'bedarf-aus', id: bb.id });
  await gesendet('baustelle/aktion', 'Alle jetzt heizen', { act: 'jetzt-an' });
  await gesendet('baustelle/aktion', 'Alle jetzt heizen beenden', { act: 'jetzt-aus' });
  for (const w of d().warnungen) { await gesendet('baustelle/aktion', `Warnung ${w.key}`, { act: 'w-stumm', id: w.id }); await gesendet('baustelle/aktion', `Warnung ${w.key} zurück`, { act: 'w-stumm', id: w.id }); }
  await gesendet('baustelle/aktion', 'Bericht jetzt senden', { act: 'bericht-senden' });
  for (const v of ['heute-laenger', 'morgen-spaeter', 'samstag']) await gesendet('baustelle/liste', `Ausnahme ${v}`, { act: 'au-speichern' }, () => klick({ act: 'ausn-neu', v }));
  await gesendet('baustelle/liste', 'Freier Tag', { act: 'au-speichern' }, async () => { await klick({ act: 'ausn-neu', v: 'frei' }); eingabe({ au: 'datum' }, plusTageT(d().z.HEUTE, 9)); eingabe({ au: 'notiz' }, 'Zwickeltag'); });
  for (const a of d().ausnahmen.slice(0, 1)) await gesendet('baustelle/liste', 'Ausnahme löschen', { act: 'ausn-weg', d: a.datum });
  await gesendet('baustelle/liste', 'Neue Arbeitszeit', { act: 'azn-speichern' }, async () => { await klick({ act: 'az-neu' }); eingabe({ azn: 'ab' }, plusTageT(d().z.HEUTE, 70)); eingabe({ azn: 'name' }, 'Spät');
    eingabe({ azt: 'Mo', p: '0' }, '08:00'); eingabe({ azt: 'Mo', p: '1' }, '17:00'); await klick({ act: 'azn-wie-mo' }); });
  const geplant = panel.azListe.findIndex(a => a.ab > d().z.HEUTE);
  if (geplant >= 0) await gesendet('baustelle/liste', 'Geplante Arbeitszeit löschen', { act: 'az-weg' }, () => klick({ act: 'sheet', s: 'az', i: String(geplant) }));
  const fremd = d().firmen.filter(f => !f.eigen && f.id !== 'eigen');
  await gesendet('baustelle/liste', 'Neue Firma', { act: 'firma-speichern' }, async () => { await klick({ act: 'firma-auf' }); eingabe({ fn: '' }, 'Trockenbau Maier'); await klick({ act: 'firma-c', id: c.id }); });
  if (fremd[0]) await gesendet('baustelle/liste', 'Firma ändern', { act: 'firma-speichern' }, async () => { await klick({ act: 'firma-auf', id: fremd[0].id }); await klick({ act: 'firma-c', id: C().at(-1).id }); });
  if (fremd.length > 1) await gesendet('baustelle/liste', 'Firma löschen', { act: 'firma-weg' }, () => klick({ act: 'firma-auf', id: fremd.at(-1).id }));
  await gesendet('baustelle/liste', 'Neuer Anschluss', { act: 'an-speichern' }, async () => { await klick({ act: 'anschluss-auf' }); eingabe({ an: 'name' }, 'Verteiler West');
    await klick({ act: 'an-wert', k: 'ampere', v: '63' }); await klick({ act: 'an-wert', k: 'phasen', v: '1' }); await klick({ act: 'an-res', d: '1' }); await klick({ act: 'an-c', id: C().at(-1).id }); });
  if (d().anschluesse.length > 1) await gesendet('baustelle/liste', 'Anschluss ändern', { act: 'an-speichern' }, () => klick({ act: 'anschluss-auf', id: d().anschluesse[0].id }));
  if (d().anschluesse.length > 1) await gesendet('baustelle/liste', 'Anschluss löschen', { act: 'an-weg' }, () => klick({ act: 'anschluss-auf', id: d().anschluesse.at(-1).id }));
  if (d().termineKal) {
    const t = await gesendet('calendar/event/create', 'Termin', { act: 'termin-speichern' }, async () => { await klick({ act: 'sheet', s: 'termin', id: bb.id }); eingabe({ tm: 'titel' }, 'Baubesprechung');
      eingabe({ tm: 'datum' }, plusTageT(d().z.HEUTE, 8)); await klick({ act: 'tm-wieder', v: '2wochen' }); await klick({ act: 'tm-boost' }); });
    erwarte('Termin mit Container in der Beschreibung', t && t.entity_id === d().termineKal && t.event.description.includes(`baustelle:${bb.id}`));
    if (d().termine.length) { const w = await gesendet('calendar/event/delete', 'Termin löschen', { act: 'termin-weg', i: '0' }); erwarte('Termin löschen mit uid', w && w.uid); }
  }
  if (d().optionen.urlaub_kalender) {
    await gesendet('calendar/event/create', 'Urlaub', { act: 'urlaub-speichern' }, async () => { await klick({ act: 'sheet', s: 'urlaub' }); eingabe({ ur: 'name' }, 'Semesterferien');
      eingabe({ ur: 'von' }, plusTageT(d().z.HEUTE, 140)); eingabe({ ur: 'bis' }, plusTageT(d().z.HEUTE, 144)); });
    await klick({ act: 'tab', v: 'heizung' }, 30);
    if ((panel.urlaube() || []).length) { const u = await gesendet('calendar/event/delete', 'Urlaub löschen', { act: 'urlaub-weg', i: '0' }); erwarte('Urlaub löschen mit uid', u && u.uid); }
  }
  await gesendet('baustelle/meldung', 'Meldung senden', { act: 'ml-senden' }, async () => { await klick({ act: 'melden' }); eingabe({ ml: 'text' }, 'Knopf zu klein'); });
  await klick({ act: 'tab', v: 'dev' }, 20);
  const m1 = await gesendet('baustelle/meldung', 'Meldung erledigt', { act: 'm-status', id: 'm1' }); erwarte('Meldung mit meldung_id, ohne id', m1 && m1.meldung_id === 'm1' && !('id' in m1));
  await gesendet('baustelle/meldung', 'Meldung löschen', { act: 'm-weg', id: 'm2' });
  await gesendet('auth/sign_path', 'Diagnose', { act: 'diagnose' });
  await klick({ act: 'tab', v: 'verlauf' }); panel.cache = {}; await gesendet('baustelle/protokoll', 'Protokoll', { act: 'pfilter', v: 'warnung' });
  await klick({ act: 'tab', v: 'auswertung' }, 30);
  const csvF = panel.csv('firma'), csvV = panel.csv();
  erwarte('CSV Abrechnung', csvF && csvF.length > 1 && !csvF.join().includes('NaN') && !csvF.join().includes('undefined'));
  erwarte('CSV Verbrauch', csvV && csvV.length > 1 && !csvV.join().includes('NaN') && !csvV.join().includes('undefined'));
  // Container bearbeiten: Tür, Anschluss, Bedarf, Firma (Anschluss/Firma, die es noch gibt)
  // Freie Schalter (Shellys, die noch keinem Gerät gehören) für neue Geräte
  const belegt = new Set(STRUKTUR.flatMap(b => [...b.geraete.map(g => g.schalter), ...Object.values(b.entitaeten)]));
  const frei = Object.keys(states).filter(e => e.startsWith('switch.') && !belegt.has(e)).sort();
  if (frei.length) {
    neu(); await klick({ act: 'sheet', s: 'container-neu' }); eingabe({ neu: 'name' }, 'Lager Ost'); eingabe({ neu: 'schalter' }, frei[0]); eingabe({ neu: 'typ' }, 'Konvektor');
    await klick({ act: 'neu-anlegen' }, 40);
    erwarte('Neuer Container über die Subentry-Dialoge', api.filter(a => a[1] === 'config/config_entries/subentries/flow').length === 2);
  }
  const x = C().find(b => b.tuer) || C()[0], an = d().anschluesse.find(a => a.id !== x.anschluss) || d().anschluesse[0], fi = d().firmen.find(f => f.id !== x.firma);
  await klick({ act: 'container', id: x.id }, 20); neu(); await klick({ act: 'sheet', s: 'bereich' });
  eingabe({ b: 'name' }, `${x.name} Nord`); eingabe({ btuer: '' }, x.tuer ? '' : 'binary_sensor.tuer_neu'); eingabe({ ban: '' }, an.id); if (fi) eingabe({ bf: 'firma' }, fi.id); await klick({ act: 'ge-bedarf' });
  const hk = x.geraete.findIndex(g => g.heizer && g.rolle === 'heizung');
  if (hk >= 0) eingabe({ ge: 'typ', i: String(hk) }, x.geraete[hk].gtyp === 'konvektor' ? 'Ölradiator' : 'Konvektor');
  if (x.geraete.length > 1) await klick({ act: 'ge-weg', i: String(x.geraete.length - 1) });
  if (frei[1]) { await klick({ act: 'ge-neu' }); eingabe({ ge: 'schalter', i: String(x.geraete.length) }, frei[1]); eingabe({ ge: 'n', i: String(x.geraete.length) }, 'Heizung neu'); }
  await klick({ act: 'b-speichern' }, 60);
  erwarte('Bearbeiten: Name, Gerät ändern/hinzufügen über Subentry-Dialoge', api.some(a => a[2] && a[2].subentry_id === x.id) && (!frei[1] || api.some(a => a[2] && a[2].schalter === frei[1])));
  erwarte('Bearbeiten: Tür, Anschluss, Bedarf über baustelle/setzen', ['tuer', 'bedarf'].every(k => letzte('baustelle/setzen').some(a => JSON.stringify(a.pfad) === JSON.stringify(['bereiche', x.id, k]))));
  if (an.id !== x.anschluss) erwarte('Bearbeiten: Anschluss', letzte('baustelle/setzen').some(a => JSON.stringify(a.pfad) === JSON.stringify(['bereiche', x.id, 'anschluss'])));
  neu(); await klick({ act: 'sheet', s: 'wetterquelle' }); eingabe({ wq: 'termine_kalender' }, d().termineKal || ''); await klick({ act: 'wetterquelle-speichern' }, 40);
  neu(); await klick({ act: 'sheet', s: 'name' }); eingabe({ nm: 'name' }, d().titel); await gesendet('config_entries/update', 'Name', { act: 'name-speichern' });
  await klick({ act: 'sheet', s: 'nachrichten' }); await klick({ act: 'n-knopf', t: 'Bis morgen stumm' }); pruefe('Nachrichten-Knopf');
  const wOff = d().warnungen.find(w => w.art === 'offline' && w.b), hand = d().bereiche.flatMap(b => b.geraete.map(g => ({ b, g }))).find(x => x.g.hand);
  if (wOff) erwarte('Nachricht „nicht erreichbar“ mit dem Container der Warnung', ui.innerHTML.includes(`⚠ ${d().bereiche.find(b => b.id === wOff.b).name} nicht erreichbar`));
  if (hand) erwarte('Nachricht „auf Hand“ mit dem Gerät, das auf Hand steht', ui.innerHTML.includes(`✋ ${hand.g.n} ${hand.b.name} seit`));
  /* Adressen aus Handy-Nachrichten (api §4) */
  global.location = { search: `?baustelle=${entry}&container=${c.id}` }; await panel._laden(); panel._adresse(); await ruhe(20);
  erwarte('?baustelle=…&container=… öffnet den Container', panel.s.view === 'container' && panel.s.cid === c.id);
  global.location = { search: `?baustelle=${entry}&ansicht=auswertung` }; panel._adresse(); await ruhe(30);
  erwarte('?ansicht=auswertung', panel.s.view === 'auswertung' && panel.d.entry === entry); pruefe('Adresse Auswertung');
  for (const bs of fertige) { global.location = { search: `?baustelle=${bs.baustelle.entry_id}` }; panel._adresse(); await ruhe(30);
    erwarte('abgeschlossene Baustelle aus der Adresse', panel.s.view === 'bsdetail' && panel.s.bs === bs.baustelle.entry_id); }
  global.location = { search: '' };
}
const ARTEN_TEST = { m_offline: 1, m_trocken: 1, m_dauer: 1, m_zyklen: 1, m_leistung: 1, m_frost: 1, m_kalt: 1, m_fuehler: 1, m_wetter: 1, m_hand: 1 };
const plusTageT = (iso, n) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

(async () => {
  /* Laden und Fehler der Integration */
  strukturHaengt = true;
  panel = new P(); panel.panel = { config: { version: '0.7.0' } }; panel.narrow = true; panel.hass = hass; panel.connectedCallback();
  ui = panel.shadowRoot.teile['.ui'];
  await ruhe();
  erwarte('„Lädt …“ solange die Struktur fehlt', /Lädt …/.test(ui.innerHTML));
  pruefe('lädt', { laedtErlaubt: true });
  strukturHaengt = false; strukturFehler = true; await panel._laden(); await ruhe();
  erwarte('Fehlertext, wenn die Integration nicht antwortet', /antwortet nicht/.test(ui.innerHTML));
  strukturFehler = false; const alt = struktur; struktur = []; await panel._laden(); await ruhe();
  erwarte('leere Liste → „Neue Baustelle“', /\+ Neue Baustelle/.test(ui.innerHTML)); pruefe('leer');
  struktur = alt; await panel._laden(); await ruhe(30);
  erwarte('WebGL fehlt → CSS-Hintergrund', panel.himmel === null && panel.bg.dataset.phase === 'tag' && panel.bg.dataset.wetter === 'regen');
  erwarte('Seitenleisten-Knopf auf dem Handy', /data-act="menue"/.test(ui.innerHTML));
  await klick({ act: 'menue' }); erwarte('hass-toggle-menu', events.includes('hass-toggle-menu'));
  erwarte('Dunkel nach Theme', !panel.wurzel.classList.contains('hell'));
  panel.hass = { ...hass, themes: { darkMode: false }, states: { ...states, 'sun.sun': { state: 'below_horizon', attributes: { elevation: -20 } } } }; await ruhe();
  erwarte('Hell nach Theme, Nacht nach sun.sun', panel.wurzel.classList.contains('hell') && panel.bg.dataset.phase === 'nacht');
  panel.hass = hass; await ruhe();
  erwarte('Changelog geladen', Array.isArray(panel.changelog) && panel.changelog.length === 2);

  if (!REFERENZ) await allgemein(); else {
  /* Ansichten */
  for (const bid of ['dobl', 'kalsdorf']) {
    await klick({ act: 'bs-wahl', id: bid }, 30);
    const d = panel.d;
    erwarte(`Baustelle ${bid} gewählt`, d.entry === bid && ui.innerHTML.includes(d.titel.replace(/&/g, '&amp;')));
    for (const v of ['uebersicht', 'heizung', 'auswertung', 'verlauf', 'einst', 'ueber', 'dev']) { await klick({ act: 'tab', v }, 30); pruefe(`${bid} ${v}`); hov(`${bid} ${v}`); }
    for (const b of d.bereiche) {
      await klick({ act: 'container', id: b.id }, 30); pruefe(`${bid} ${b.id}`);
      for (const c of b.pumpe ? ['pumpzeit', 'zyklen', 'verbrauch'] : ['temp', 'verbrauch', 'heizzeit']) { await klick({ act: 'chart', c }, 30); pruefe(`${bid} ${b.id} ${c}`); hov(`${bid} ${b.id} ${c}`); }
      if (!b.pumpe && b.fuehler) { await klick({ act: 'chart', c: 'temp' }); await klick({ act: 'temp-vb' }); pruefe(`${bid} ${b.id} ohne Verbrauch`); await klick({ act: 'temp-vb' }); }
    }
    await klick({ act: 'tab', v: 'heizung' });
    for (const art of ['tag', 'woche']) { await klick({ act: 'hz-art', v: art }, 30); pruefe(`${bid} heizzeiten ${art}`); }
    for (const t of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) { await klick({ act: 'hz-tag', v: t, art: 'tag' }, 30); pruefe(`${bid} heizzeiten ${t}`); }
    await klick({ act: 'az-alt' }); pruefe(`${bid} frühere Arbeitszeiten`);
    await klick({ act: 'tab', v: 'auswertung' }, 30);
    for (const scope of ['diese', 'alle']) { await klick({ act: 'aw-scope', v: scope }, 30);
      for (const z of ['Tag', 'Woche', 'Monat', 'Jahr']) { await klick({ act: 'vb-zeitraum', ziel: 'aw', v: z }, 40);
        for (const gr of ['teil', 'firma']) { await klick({ act: 'vb-gruppe', ziel: 'aw', v: gr }, 40); pruefe(`${bid} auswertung ${scope} ${z} ${gr}`); hov(`${bid} auswertung ${scope} ${z}`); }
        await klick({ act: 'vb-wer', ziel: 'aw' }); pruefe(`${bid} auswertung Summe ${z}`);
        await klick({ act: 'vb-wer', ziel: 'aw', id: '*' }); pruefe(`${bid} auswertung alle ${z}`); } }
    await klick({ act: 'aw-scope', v: 'diese' });
    await klick({ act: 'tab', v: 'verlauf' }, 30);
    for (const v of ['tag', 'monat', 'ges']) { await klick({ act: 'vgl', v }); pruefe(`${bid} verlauf ${v}`); }
    for (const f of ['alle', 'warnung', 'schalten', 'wetter', 'nachricht']) { await klick({ act: 'pfilter', v: f }, 20); pruefe(`${bid} protokoll ${f}`); }
    await klick({ act: 'pfilter', v: 'alle' }); await klick({ act: 'pmehr' }, 20); pruefe(`${bid} protokoll mehr`);
    await klick({ act: 'verlauf', v: 'ab' }); pruefe(`${bid} verlauf abgeschlossen`);
    await klick({ act: 'verlauf', v: 'aktiv' });
    await klick({ act: 'tab', v: 'dev' }, 20); for (const f of ['offen', 'erledigt', 'alle']) { await klick({ act: 'mfilter', v: f }); pruefe(`${bid} dev ${f}`); }
    await klick({ act: 'tab', v: 'ueber' }); await klick({ act: 'cl', i: '1' }); pruefe(`${bid} über verlauf`);
  }
  for (const bs of ['lieboch', 'wundschuh']) { await klick({ act: 'bs-oeffnen', id: bs }, 40); pruefe(`bsdetail ${bs}`); hov(`bsdetail ${bs}`);
    erwarte(`bsdetail ${bs} zeigt Kennzahlen`, /ABGESCHLOSSEN/.test(ui.innerHTML) && /Verbrauch je Monat/.test(ui.innerHTML)); }
  const csvBs = panel.csv(); erwarte('CSV der abgeschlossenen Baustelle', csvBs && csvBs.length > 3 && csvBs[0].startsWith('Monat;'));

  /* Einblendungen */
  await klick({ act: 'bs-wahl', id: 'dobl' }, 30);
  const sheets = ['verbrauch', 'wetter', 'warnungen', 'baustellen', 'heizplan', 'strom', 'nachrichten', 'bericht', 'container-neu', 'abschliessen', 'urlaub', 'wetterquelle', 'name', 'baustelle-neu', 'termin'];
  for (const s of sheets) { await klick({ act: 'sheet', s, id: s === 'termin' ? 'besprechung' : undefined }, 30); const h = pruefe(`Einblendung ${s}`); erwarte(`Einblendung ${s} offen`, /class="sheet glas-panel an"/.test(h)); hov(`Einblendung ${s}`); }
  await klick({ act: 'sheet', s: 'wetter' }, 20); for (const wa of ['std', 'tag', '3']) { await klick({ act: 'wa', v: wa }, 20); const h = pruefe(`Wetter ${wa}`); erwarte(`Wetter ${wa} mit Symbolen`, (h.match(/<svg class="wi wr"/g) || []).length >= 4); }
  await klick({ act: 'sheet', s: 'verbrauch' }, 20);
  for (const z of ['Tag', 'Woche', 'Monat', 'Jahr']) { await klick({ act: 'vb-zeitraum', ziel: 'sheet', v: z }, 30); await klick({ act: 'vb-wer', ziel: 'sheet', id: 'polier' }); await klick({ act: 'vb-wer', ziel: 'sheet', id: 'mannschaft' }); pruefe(`Verbrauch ${z}`); hov(`Verbrauch ${z}`); }
  await klick({ act: 'vb-gruppe', ziel: 'sheet', v: 'firma' }, 30); pruefe('Verbrauch nach Firma');
  for (let i = 0; i < 4; i++) { await klick({ act: 'sheet', s: 'az', i: String(i) }); pruefe(`Arbeitszeit ${i}`); }
  for (const f of ['eigen', 'huber', 'leitner', undefined]) { await klick({ act: 'firma-auf', id: f }); pruefe(`Firma ${f || 'neu'}`); }
  for (const a of ['nord', 'sued', undefined]) { await klick({ act: 'anschluss-auf', id: a }); pruefe(`Anschluss ${a || 'neu'}`); }
  for (const v of ['heute-laenger', 'morgen-spaeter', 'samstag', 'frei', '']) { await klick({ act: 'ausn-neu', v }); pruefe(`Ausnahme ${v}`); }
  await klick({ act: 'az-neu' }); pruefe('Neue Arbeitszeit');
  await klick({ act: 'bedarf-auf', id: 'besprechung' }); pruefe('Bedarf');
  await klick({ act: 'melden' }); pruefe('Melden'); await klick({ act: 'ml-art', v: 'fehler' }); pruefe('Melden Fehler');
  for (const b of panel.d.bereiche) { await klick({ act: 'bereich-einst', id: b.id }); pruefe(`Bearbeiten ${b.id}`); }
  await klick({ act: 'sheet', s: 'container-neu' }); await klick({ act: 'neu-art', v: 'Pumpenschacht' }); pruefe('Neuer Schacht');
  await klick({ act: 'e-wert', k: 'bericht', v: 'monat' }, 30); await klick({ act: 'sheet', s: 'bericht' }, 40); const bm = pruefe('Bericht Monat'); erwarte('Bericht für den Vormonat', /August 2026/.test(bm) && /zum Juli/.test(bm));
  erwarte('Bericht-Beispiel kommt von der Integration (baustelle/bericht)', (a => a && a.art === 'monat' && a.entry_id)(letzte('baustelle/bericht').at(-1)) && /abrechnung-2026-08\.csv/.test(bm) && /Keine Wettervorhersage/.test(bm));
  await klick({ act: 'e-wert', k: 'bericht', v: 'woche' }, 30);
  await klick({ act: 'zu' });

  /* Aktionen → Aufrufe an die Integration */
  const d0 = () => panel.d;
  const setzen = async (ds, pfad, wert, wo) => { neu(); await klick(ds); const a = letzte('baustelle/setzen').at(-1);
    erwarte(`${wo}: baustelle/setzen ${pfad.join('.')} = ${JSON.stringify(wert)}`, a && a.entry_id === 'dobl' && JSON.stringify(a.pfad) === JSON.stringify(pfad) && JSON.stringify(a.wert) === JSON.stringify(wert)); };
  const aktion = async (ds, erwartet, wo) => { neu(); await klick(ds); const a = letzte('baustelle/aktion').at(-1);
    erwarte(`${wo}: baustelle/aktion ${JSON.stringify(erwartet)} (war ${JSON.stringify(a)})`, a && a.entry_id === 'dobl' && Object.entries(erwartet).every(([k, v]) => typeof v === 'function' ? v(a[k]) : JSON.stringify(a[k]) === JSON.stringify(v))); };
  const liste = async (ds, erwartet, eintrag, wo, vorher) => { neu(); if (vorher) await vorher(); await klick(ds, 30); const a = letzte('baustelle/liste').at(-1);
    erwarte(`${wo}: baustelle/liste ${JSON.stringify(erwartet)} (war ${JSON.stringify(a)})`, a && a.entry_id === 'dobl' && a.liste === erwartet.liste && a.aktion === erwartet.aktion && Object.entries(eintrag).every(([k, v]) => typeof v === 'function' ? v(a.eintrag[k]) : JSON.stringify(a.eintrag[k]) === JSON.stringify(v))); };

  await klick({ act: 'tab', v: 'uebersicht' });
  await setzen({ act: 'auto' }, ['automatik'], false, 'Automatik-Chip');
  await setzen({ act: 'auto' }, ['automatik'], true, 'Automatik-Chip ein');
  await setzen({ act: 'st', k: 'vorheizen', d: '5' }, ['heizung', 'vorheizen_min'], 50, 'Stepper Vorheizen');
  await setzen({ act: 'st', k: 'nutzbar', d: '-5' }, ['staffel', 'nutzbar_prozent'], 62, 'Stepper Nutzbar');
  await setzen({ act: 'st', k: 'soll', d: '0.5' }, ['heizung', 'soll'], 20.5, 'Stepper Soll');
  await setzen({ act: 'e-bool', k: 'fruehstart' }, ['heizung', 'fruehstart'], false, 'Frühstart');
  await setzen({ act: 'e-bool', k: 'staffel' }, ['staffel', 'an'], false, 'Staffelung');
  await setzen({ act: 'e-bool', k: 'melden' }, ['melden_knopf'], false, 'Melden-Knopf');
  await setzen({ act: 'e-bool', k: 'knoepfe' }, ['meldungen_einst', 'knoepfe'], false, 'Knöpfe');
  await setzen({ act: 'e-bool', k: 'm_offline' }, ['meldungen_einst', 'arten', 'offline'], false, 'Meldungsart offline');
  await setzen({ act: 'e-bool', k: 'm_hand' }, ['meldungen_einst', 'arten', 'hand_zu_lange'], false, 'Meldungsart Handbetrieb');
  await setzen({ act: 'basis', v: 'jetzt' }, ['heizung', 'heizgrenze_basis'], 'jetzt', 'Heizgrenze-Grundlage');
  await setzen({ act: 'e-wert', k: 'bericht', v: 'beides' }, ['bericht', 'haeufigkeit'], 'beides', 'Bericht');
  await setzen({ act: 'prio', id: 'polier', v: 'hoch' }, ['bereiche', 'polier', 'prio'], 'hoch', 'Vorrang');
  await setzen({ act: 'jc-auto', id: 'lager' }, ['bereiche', 'lager', 'auto'], false, 'Je Container Auto');
  await setzen({ act: 'tr-b', id: 'magazin' }, ['bereiche', 'magazin', 'trocknen'], true, 'Je Container Trocknen');
  await setzen({ act: 'jc-soll', id: 'polier', d: '0.5' }, ['bereiche', 'polier', 'soll'], 21, 'Je Container Soll');
  neu(); panel.aenderung({ target: { dataset: { k: 'preis' }, value: '0,31' } }); await ruhe();
  erwarte('Preis speichern', (a => a && JSON.stringify(a.pfad) === '["preis"]' && a.wert === 0.31)(letzte('baustelle/setzen').at(-1)));
  neu(); panel.aenderung({ target: { dataset: { k: 'mail' }, value: ' bau@example.at ' } }); await ruhe();
  erwarte('Mail speichern', (a => a && JSON.stringify(a.pfad) === '["bericht","mail_an"]' && a.wert === 'bau@example.at')(letzte('baustelle/setzen').at(-1)));
  await klick({ act: 'container', id: 'polier' }, 20);
  await setzen({ act: 'b-auto' }, ['bereiche', 'polier', 'auto'], false, 'Container-Automatik');
  await setzen({ act: 'b-trocknen' }, ['bereiche', 'polier', 'trocknen'], false, 'Container trocknen');
  await aktion({ act: 'boost', id: 'polier' }, { aktion: 'boost', bereich: 'polier', an: true }, 'Schnell aufheizen');
  await aktion({ act: 'geraet', i: '0' }, { aktion: 'schalten', geraet: 'polier_r1', an: false }, 'Gerät schalten');
  await aktion({ act: 'bedarf-an', id: 'besprechung', v: '60' }, { aktion: 'bedarf', bereich: 'besprechung', minuten: 60, boost: false }, 'Bedarf 1 h');
  await klick({ act: 'bedarf-auf', id: 'besprechung' }); await klick({ act: 'bedarf-boost' });
  await aktion({ act: 'bedarf-an', id: 'besprechung', v: 'ende' }, { aktion: 'bedarf', bereich: 'besprechung', bis: v => Date.parse(v) === Date.parse('2026-09-29T16:30:00+02:00'), boost: true }, 'Bedarf bis Arbeitsende');
  await aktion({ act: 'bedarf-an', id: 'besprechung', v: 'abend' }, { aktion: 'bedarf', bereich: 'besprechung', bis: v => Date.parse(v) === Date.parse('2026-09-29T19:00:00+02:00') }, 'Bedarf bis 19:00');
  await aktion({ act: 'bedarf-aus', id: 'besprechung' }, { aktion: 'bedarf_aus', bereich: 'besprechung' }, 'Bedarf beenden');
  await aktion({ act: 'jetzt-an' }, { aktion: 'jetzt_heizen', minuten: 60 }, 'Alle jetzt heizen');
  await aktion({ act: 'jetzt-aus' }, { aktion: 'jetzt_heizen', minuten: null }, 'Alle jetzt heizen beenden');
  await aktion({ act: 'w-stumm', id: 'offline:lager_r' }, { aktion: 'warnung_stumm', key: 'offline:lager_r', bis: v => Date.parse(v) === Date.parse('2026-09-30T07:00:00+02:00') }, 'Warnung stumm bis morgen 07:00');
  await aktion({ act: 'w-stumm', id: 'kein_wetter' }, { aktion: 'warnung_stumm', key: 'kein_wetter', bis: null }, 'Warnung wieder melden');
  await aktion({ act: 'bericht-senden' }, { aktion: 'bericht_senden', art: 'woche' }, 'Bericht jetzt senden');
  await liste({ act: 'au-speichern' }, { liste: 'ausnahmen', aktion: 'speichern' }, { datum: '2026-09-29', art: 'zeiten', von: '07:00', bis: '18:00', notiz: 'heute länger' }, 'Ausnahme speichern', () => klick({ act: 'ausn-neu', v: 'heute-laenger' }));
  await liste({ act: 'au-speichern' }, { liste: 'ausnahmen', aktion: 'speichern' }, { datum: '2026-10-03', art: 'arbeit' }, 'Samstag arbeiten', () => klick({ act: 'ausn-neu', v: 'samstag' }));
  await liste({ act: 'au-speichern' }, { liste: 'ausnahmen', aktion: 'speichern' }, { datum: '2026-10-01', art: 'frei', notiz: 'Zwickeltag' }, 'Freier Tag',
    async () => { await klick({ act: 'ausn-neu', v: 'frei' }); eingabe({ au: 'datum' }, '2026-10-01'); eingabe({ au: 'notiz' }, 'Zwickeltag'); });
  await liste({ act: 'ausn-weg', d: '2026-09-30' }, { liste: 'ausnahmen', aktion: 'loeschen' }, { datum: '2026-09-30' }, 'Ausnahme löschen');
  await liste({ act: 'azn-speichern' }, { liste: 'arbeitszeiten', aktion: 'speichern' }, { ab: '2026-10-12', name: 'Spät', tage: t => t['0'][0] === '08:00' && t['3'][1] === '17:00' && t['5'] === null }, 'Neue Arbeitszeit',
    async () => { await klick({ act: 'az-neu' }); eingabe({ azn: 'ab' }, '2026-10-12'); eingabe({ azn: 'name' }, 'Spät'); eingabe({ azt: 'Mo', p: '0' }, '08:00'); eingabe({ azt: 'Mo', p: '1' }, '17:00'); await klick({ act: 'azn-wie-mo' }); });
  neu(); await klick({ act: 'az-neu' }); eingabe({ azn: 'ab' }, '2026-09-28'); await klick({ act: 'azn-speichern' });
  erwarte('gleiches Startdatum wird abgelehnt', !letzte('baustelle/liste').length && /schon eine Arbeitszeit/.test(panel.letzterToast));
  await liste({ act: 'az-weg' }, { liste: 'arbeitszeiten', aktion: 'loeschen' }, { ab: '2026-11-02' }, 'Geplante Arbeitszeit löschen', () => klick({ act: 'sheet', s: 'az', i: '3' }));
  await liste({ act: 'firma-speichern' }, { liste: 'firmen', aktion: 'speichern' }, { name: 'Trockenbau Maier', container: c => c.includes('polier') && c.includes('neu-7') }, 'Neue Firma mit neuem Container',
    async () => { await klick({ act: 'firma-auf' }); eingabe({ fn: '' }, 'Trockenbau Maier'); await klick({ act: 'firma-c', id: 'polier' }); await klick({ act: 'fc-neu' }); eingabe({ fnc: '0' }, 'Lager Nord'); });
  erwarte('neuer Container über den Subentry-Dialog', api.some(a => a[1] === 'config/config_entries/subentries/flow' && JSON.stringify(a[2].handler) === '["dobl","bereich"]'));
  await liste({ act: 'firma-speichern' }, { liste: 'firmen', aktion: 'speichern' }, { id: 'huber', name: 'Elektro Huber GmbH', container: [] }, 'Firma ändern',
    async () => { await klick({ act: 'firma-auf', id: 'huber' }); await klick({ act: 'firma-c', id: 'magazin' }); });
  await liste({ act: 'firma-weg' }, { liste: 'firmen', aktion: 'loeschen' }, { id: 'leitner' }, 'Firma löschen', () => klick({ act: 'firma-auf', id: 'leitner' }));
  await liste({ act: 'an-speichern' }, { liste: 'anschluesse', aktion: 'speichern' }, { name: 'Verteiler West', ampere: 63, phasen: 1, reserve_kw: 4, container: ['lager'] }, 'Neuer Anschluss',
    async () => { await klick({ act: 'anschluss-auf' }); eingabe({ an: 'name' }, 'Verteiler West'); await klick({ act: 'an-wert', k: 'ampere', v: '63' }); await klick({ act: 'an-wert', k: 'phasen', v: '1' }); await klick({ act: 'an-res', d: '1' }); await klick({ act: 'an-c', id: 'lager' }); });
  await liste({ act: 'an-weg' }, { liste: 'anschluesse', aktion: 'loeschen' }, { id: 'sued' }, 'Anschluss löschen', () => klick({ act: 'anschluss-auf', id: 'sued' }));
  // Termine und Urlaub: Kalender von HA
  neu(); await klick({ act: 'sheet', s: 'termin', id: 'besprechung' }); eingabe({ tm: 'titel' }, 'Baubesprechung'); eingabe({ tm: 'datum' }, '2026-10-08'); await klick({ act: 'tm-wieder', v: '2wochen' }); await klick({ act: 'tm-boost' }); await klick({ act: 'termin-speichern' });
  erwarte('Termin → calendar/event/create', (a => a && a.entity_id === 'calendar.besprechungen' && a.event.summary === 'Baubesprechung' && a.event.dtstart === '2026-10-08T09:00:00' && a.event.rrule === 'FREQ=WEEKLY;INTERVAL=2' && /baustelle:besprechung/.test(a.event.description) && /\bboost\b/.test(a.event.description))(letzte('calendar/event/create').at(-1)));
  neu(); await klick({ act: 'termin-weg', i: '0' });
  erwarte('Termin löschen → calendar/event/delete', (a => a && a.entity_id === 'calendar.besprechungen' && a.uid === 'termin-1')(letzte('calendar/event/delete').at(-1)));
  neu(); await klick({ act: 'sheet', s: 'urlaub' }); eingabe({ ur: 'name' }, 'Semesterferien'); eingabe({ ur: 'von' }, '2027-02-15'); eingabe({ ur: 'bis' }, '2027-02-19'); await klick({ act: 'urlaub-speichern' });
  erwarte('Urlaub → calendar/event/create (ganztägig, Ende exklusiv)', (a => a && a.entity_id === 'calendar.baustelle_urlaub' && a.event.dtstart === '2027-02-15' && a.event.dtend === '2027-02-20')(letzte('calendar/event/create').at(-1)));
  await klick({ act: 'tab', v: 'heizung' }, 30); neu(); await klick({ act: 'urlaub-weg', i: '0' });
  erwarte('Urlaub löschen', (a => a && a.uid === 'urlaub-1')(letzte('calendar/event/delete').at(-1)));
  // Meldungen
  neu(); await klick({ act: 'melden' }); eingabe({ ml: 'text' }, '  Knopf zu klein  '); await klick({ act: 'ml-senden' });
  erwarte('Meldung senden', (a => a && a.aktion === 'neu' && a.meldung.text === 'Knopf zu klein' && a.meldung.version === '0.7.0' && a.meldung.seite && a.meldung.seite.view && !('stand' in a.meldung))(letzte('baustelle/meldung').at(-1)));
  await klick({ act: 'tab', v: 'dev' }, 20); neu(); await klick({ act: 'm-status', id: 'm1' });
  erwarte('Meldung erledigt (meldung_id, kein id)', (a => a && a.aktion === 'status' && a.meldung_id === 'm1' && a.status === 'erledigt' && !('id' in a))(letzte('baustelle/meldung').at(-1)));
  neu(); await klick({ act: 'm-weg', id: 'm2' }); erwarte('Meldung löschen', (a => a && a.aktion === 'loeschen' && a.meldung_id === 'm2' && !('id' in a))(letzte('baustelle/meldung').at(-1)));
  await klick({ act: 'm-md' }, 20); await klick({ act: 'm-json' });
  neu(); await klick({ act: 'diagnose' }, 20); erwarte('Diagnose über auth/sign_path', (a => a && a.path === '/api/diagnostics/config_entry/dobl')(letzte('auth/sign_path').at(-1)) && downloads.some(x => /baustelle-dobl/.test(x)));
  // Protokoll über baustelle/protokoll
  await klick({ act: 'tab', v: 'verlauf' }); neu(); panel.cache = {}; await klick({ act: 'pfilter', v: 'warnung' }, 30);
  erwarte('Protokoll gefiltert über baustelle/protokoll', (a => a && a.entry_id === 'dobl' && a.filter === 'alle')(letzte('baustelle/protokoll').at(-1)) && /nicht erreichbar/.test(ui.innerHTML) && !/Vorheizen – alle Container ein/.test(ui.innerHTML));
  // CSV
  await klick({ act: 'tab', v: 'auswertung' }, 30);
  const csvF = panel.csv('firma'), csvV = panel.csv();
  erwarte('CSV Abrechnung', csvF && csvF[0] === 'Zeitraum;Firma;Baustelle;Container;kWh;Preis €/kWh;Betrag €' && csvF.length > 3 && !csvF.join().includes('NaN'));
  erwarte('CSV Verbrauch', csvV && csvV[0].startsWith('Zeit;Baustelle;Firma') && csvV.length > 20 && !csvV.join().includes('NaN'));
  // Einrichtungs-Dialoge von HA
  neu(); await klick({ act: 'sheet', s: 'container-neu' }); eingabe({ neu: 'name' }, 'Lager Ost'); eingabe({ neu: 'schalter' }, 'switch.heizung_03'); eingabe({ neu: 'typ' }, 'Konvektor'); eingabe({ neu: 'fuehler' }, 'sensor.polier_temperatur');
  await klick({ act: 'neu-anlegen' }, 40);
  const bFlow = api.find(a => a[1].endsWith('subentries/flow/F1')), gStart = api.find(a => a[1] === 'config/config_entries/subentries/flow' && JSON.stringify(a[2].handler) === '["dobl","geraet"]');
  const gDaten = gStart && api.find(a => a[1].endsWith('subentries/flow/F' + (api.indexOf(gStart) + 1)));
  erwarte('Neuer Container: Bereich-Dialog', bFlow && bFlow[2].name === 'Lager Ost' && bFlow[2].art === 'container' && bFlow[2].fuehler === 'sensor.polier_temperatur');
  erwarte('Neuer Container: Geräte-Dialog', gDaten && gDaten[2].schalter === 'switch.heizung_03' && gDaten[2].rolle === 'heizkoerper' && gDaten[2].typ === 'konvektor' && /^neu-/.test(gDaten[2].bereich));
  await klick({ act: 'container', id: 'mannschaft' }, 20); neu(); await klick({ act: 'sheet', s: 'bereich' });
  eingabe({ b: 'name' }, 'Mannschaft 1'); eingabe({ btuer: '' }, 'binary_sensor.tuer_mannschaft'); eingabe({ bf: 'firma' }, 'huber'); eingabe({ ban: '' }, 'sued');
  await klick({ act: 'ge-weg', i: '2' }); await klick({ act: 'ge-neu' }); eingabe({ ge: 'schalter', i: '3' }, 'switch.heizung_04'); eingabe({ ge: 'n', i: '3' }, 'Heizung 04');
  eingabe({ ge: 'typ', i: '1' }, 'Ölradiator'); await klick({ act: 'ge-bedarf' });
  await klick({ act: 'b-speichern' }, 60);
  const sp = letzte('baustelle/setzen');
  erwarte('Bearbeiten: Name über Subentry-Dialog (reconfigure)', api.some(a => a[2] && a[2].subentry_id === 'mannschaft' && JSON.stringify(a[2].handler) === '["dobl","bereich"]'));
  erwarte('Bearbeiten: Tür, Anschluss, Bedarf', ['tuer', 'anschluss', 'bedarf'].every(k => sp.some(a => JSON.stringify(a.pfad) === JSON.stringify(['bereiche', 'mannschaft', k]))));
  erwarte('Bearbeiten: Firma „ab jetzt“', letzte('baustelle/liste').some(a => a.liste === 'firmen' && a.eintrag.id === 'huber' && a.eintrag.container.includes('mannschaft')));
  erwarte('Bearbeiten: Gerät entfernen', letzte('config_entries/subentries/delete').some(a => a.subentry_id === 'mannschaft_t'));
  erwarte('Bearbeiten: Gerät ändern (reconfigure)', api.some(a => a[2] && a[2].subentry_id === 'mannschaft_k'));
  erwarte('Bearbeiten: Gerät hinzufügen', api.some(a => a[2] && a[2].schalter === 'switch.heizung_04' && a[2].bereich === 'mannschaft'));
  await klick({ act: 'container', id: 'lager' }, 20); neu(); await klick({ act: 'sheet', s: 'bereich' }); await klick({ act: 'b-weg' }, 40);
  erwarte('Container entfernen', ['lager_r', 'lager'].every(id => letzte('config_entries/subentries/delete').some(a => a.subentry_id === id)));
  neu(); await klick({ act: 'sheet', s: 'wetterquelle' }); eingabe({ wq: 'regen_sensor' }, 'sensor.regen_dobl'); eingabe({ wq: 'termine_kalender' }, 'calendar.baustelle_urlaub'); await klick({ act: 'wetterquelle-speichern' }, 40);
  const opt = api.find(a => /options\/flow\/F/.test(a[1]));
  erwarte('Wetter über den Options-Dialog', opt && opt[2].wetter === 'weather.dobl' && opt[2].regen_sensor === 'sensor.regen_dobl' && opt[2].status === 'aktiv');
  erwarte('Termine-Kalender über baustelle/setzen', letzte('baustelle/setzen').some(a => JSON.stringify(a.pfad) === '["termine_kalender"]' && a.wert === 'calendar.baustelle_urlaub'));
  neu(); await klick({ act: 'sheet', s: 'name' }); eingabe({ nm: 'name' }, 'ÖWG Dobl'); await klick({ act: 'name-speichern' });
  erwarte('Name über config_entries/update', (a => a && a.entry_id === 'dobl' && a.title === 'ÖWG Dobl')(letzte('config_entries/update').at(-1)));
  neu(); await klick({ act: 'sheet', s: 'baustelle-neu' }); eingabe({ nm: 'name' }, 'Wohnbau Kalsdorf'); await klick({ act: 'baustelle-anlegen' }, 30);
  erwarte('Neue Baustelle über den Config-Dialog', api.some(a => a[1] === 'config/config_entries/flow' && a[2].handler === 'baustelle') && api.some(a => /config_entries\/flow\/F/.test(a[1]) && a[2].name === 'Wohnbau Kalsdorf') && api.some(a => a[0] === 'DELETE'));
  neu(); await klick({ act: 'sheet', s: 'abschliessen' }); await klick({ act: 'abschliessen' }, 30);
  erwarte('Abschließen über den Options-Dialog', api.some(a => /options\/flow\/F/.test(a[1]) && a[2].status === 'abgeschlossen'));
  neu(); await klick({ act: 'bs-aktiv', t: 'lieboch' }, 30);
  erwarte('Wieder aktiv setzen', api.some(a => a[1] === 'config/config_entries/options/flow' && a[2].handler === 'lieboch') && api.some(a => /options\/flow\/F/.test(a[1]) && a[2].status === 'aktiv' && !('ende' in a[2])));
  await klick({ act: 'sheet', s: 'nachrichten' }); await klick({ act: 'n-knopf', t: 'Bis morgen stumm' }); pruefe('Nachrichten-Knopf');
  erwarte('keine direkten HA-Dienste', true);

  /* Treue zum Mockup (mockups/quelle/glas-app.js) an Stellen, die leicht abweichen */
  const vorher = struktur; struktur = JSON.parse(JSON.stringify(STRUKTUR)); panel.cache = {}; await panel._laden(); await ruhe(20);   // unveränderte Beispieldaten
  global.location = { search: '' }; await klick({ act: 'bs-wahl', id: 'dobl' }, 30); await klick({ act: 'tab', v: 'uebersicht' }, 30);
  erwarte('Strombalken sitzt wie im Mockup im Baustellen-Kopf (.klickbar)', /<div class="klickbar"[^]*?class="strom-knopf"[^]*?<\/button><\/div>\s*<button class="kopf-wetter"/.test(ui.innerHTML));
  await klick({ act: 'tab', v: 'auswertung' }, 40); const aw = ui.innerHTML;
  erwarte('Ölradiator/Konvektor: Fußsatz wie im Mockup, Kosten nicht fett', /Der Ölradiator [^<]*(braucht länger|heizt schneller auf|verbraucht rund)/.test(aw) && !/<td><b>[^<]*€<\/b><\/td>/.test(aw));
  await klick({ act: 'sheet', s: 'nachrichten' }, 20); erwarte('„Noch früher (hh:mm)“ wie im Mockup', /Noch früher \(\d\d:\d\d\)/.test(ui.innerHTML));
  erwarte('Nachricht „nicht erreichbar“ mit dem Container, der offline ist', /⚠ Lager Süd nicht erreichbar/.test(ui.innerHTML));
  await klick({ act: 'sheet', s: 'wetter' }, 20); await klick({ act: 'wa', v: 'tag' }, 20);
  erwarte('Tagesverlauf um 16:20: Morgen und Mittag vorbei, Nachmittag nicht', (ui.innerHTML.match(/class="vorbei"/g) || []).length === 2);
  for (const s of ['name', 'baustelle-neu', 'wetterquelle']) { await klick({ act: 'sheet', s }, 20); erwarte(`Einblendung ${s}: nur „Speichern“ wie im Mockup`, !/data-act="zu">Abbrechen/.test(ui.innerHTML)); }
  await klick({ act: 'sheet', s: 'container-neu' }, 20); erwarte('Neuer Container: Heizkörper Ölradiator/Konvektor wie im Mockup', !/<option value="Steckdose"/.test(ui.innerHTML) && /<option value="Konvektor"/.test(ui.innerHTML));
  await klick({ act: 'zu' }); struktur = vorher; await panel._laden(); await ruhe(20);

  /* Adresse aus einer Handy-Nachricht */
  global.location = { search: '?baustelle=dobl&container=sanitaer' }; await panel._laden(); panel._adresse(); await ruhe(20);
  erwarte('?baustelle=…&container=… öffnet den Container', panel.s.view === 'container' && panel.s.cid === 'sanitaer');
  global.location = { search: '?baustelle=kalsdorf&ansicht=auswertung' }; panel._adresse(); await ruhe(30);
  erwarte('?ansicht=auswertung öffnet die Auswertung der Baustelle', panel.s.view === 'auswertung' && panel.d.entry === 'kalsdorf'); pruefe('Adresse Auswertung');
  global.location = { search: '?baustelle=lieboch' }; panel._adresse(); await ruhe(30);
  erwarte('abgeschlossene Baustelle aus der Adresse', panel.s.view === 'bsdetail' && panel.s.bs === 'lieboch');

  }

  /* Fast leere Baustelle (frisch angelegt, noch nicht geladen): nirgends undefined/NaN */
  struktur = [{ baustelle: { entry_id: 'leer', titel: 'Neu', optionen: {}, geladen: false }, entitaeten: {}, bereiche: [{ id: 'c1', name: 'Container 1', art: 'container', fuehler: null }],
    geraete: [], einstellungen: {}, zaehler: {}, laufzeit: {} }];
  global.location = { search: '' }; panel.cache = {}; await panel._laden(); await ruhe(30);
  for (const v of ['uebersicht', 'heizung', 'auswertung', 'verlauf', 'einst', 'ueber', 'dev']) { await klick({ act: 'tab', v }, 30); pruefe(`leer ${v}`); }
  await klick({ act: 'container', id: 'c1' }, 30); for (const c of ['temp', 'verbrauch', 'heizzeit']) { await klick({ act: 'chart', c }, 30); pruefe(`leer Container ${c}`); }
  for (const s of ['verbrauch', 'wetter', 'warnungen', 'baustellen', 'heizplan', 'strom', 'nachrichten', 'bericht', 'container-neu', 'urlaub', 'wetterquelle', 'termin', 'bereich']) { await klick({ act: 'sheet', s }, 30); pruefe(`leer Einblendung ${s}`); }
  erwarte('nicht geladene Baustelle: keine Abfragen an die Integration (sie kennt sie nicht)', !alleAufrufe.some(a => a.entry_id === 'leer' && /^baustelle\/(protokoll|bericht)/.test(a.type)));
  await klick({ act: 'firma-auf', id: 'eigen' }); pruefe('leer Firma'); await klick({ act: 'anschluss-auf' }); pruefe('leer Anschluss'); await klick({ act: 'az-neu' }); pruefe('leer Arbeitszeit');
  struktur = alt;

  /* Ergebnis */
  const quelle = fs.readFileSync(datei, 'utf8');
  erwarte('Glas-CSS, Wettersymbole, Container-Grafiken und Himmel eingebaut', ['--s1:', '.glas-panel', 'function wetterIcon', 'function bcContainer', 'function bcSchacht', 'HIMMEL_FS', 'class Himmel'].every(x => quelle.includes(x)));
  erwarte('keine Vorführ-Leiste', !/id="modus"|id="phase"|id="wetter"/.test(quelle));
  if (process.env.BAUSTELLE_AUFRUFE) fs.writeFileSync(process.env.BAUSTELLE_AUFRUFE, JSON.stringify(alleAufrufe, null, 1));
  if (fehler.length) { console.log(fehler.slice(0, 40).join('\n')); console.log(`${fehler.length} Fehler`); process.exit(1); }
  console.log(`Panel-Test grün (${REFERENZ ? 'Beispiel wie im Mockup' : 'echte Antwort der Integration'}): alle Ansichten, Einblendungen und Aktionen geprüft (${alleAufrufe.length} WS-Aufrufe).`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
