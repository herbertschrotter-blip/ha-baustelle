// Seite „Baustelle“ in Node rendern (ohne Browser): alle Ansichten, keine undefined/NaN, Bedienung ruft HA-Dienste.
// Aufruf: node tests/panel/test_panel.js custom_components/baustelle/frontend/baustelle-panel.js tests/panel/diagnose-beispiel.json
const fs = require('fs');
const [,, datei, diagnose] = process.argv;
// --- minimales DOM
class HTMLElement { constructor() { this.dataset = {}; this._attr = {}; } attachShadow() { this.shadowRoot = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, activeElement: null }; return this.shadowRoot; }
  toggleAttribute(n, v) { this._attr[n] = v; } dispatchEvent() {} get clientWidth() { return 1200; } }
global.HTMLElement = HTMLElement;
const registry = {};
global.customElements = { define: (n, c) => registry[n] = c, get: n => registry[n] };
global.requestAnimationFrame = f => f();
global.localStorage = { getItem: () => null, setItem() {} };
global.document = { createElement: () => ({ style: {}, appendChild() {} }) };
global.setInterval = () => 1; global.clearInterval = () => {};
eval(fs.readFileSync(datei, 'utf8'));
// --- Daten: echte Diagnose + zweite Baustelle mit Pumpen
const echt = JSON.parse(fs.readFileSync(diagnose, 'utf8')).data;
echt.baustelle.geladen = true;
echt.baustelle.optionen.wetter = 'weather.baustelle';
echt.baustelle.optionen.urlaub_kalender = 'calendar.urlaub';
echt.baustelle.optionen.feiertag_kalender = 'calendar.oesterreich';
const zwei = JSON.parse(JSON.stringify(echt));
zwei.baustelle.entry_id = 'E2'; zwei.baustelle.titel = 'Tiefgarage Süd'; zwei.baustelle.optionen.pumpen = true;
zwei.bereiche.push({ id: 'S1', name: 'Pumpenschacht', art: 'pumpenschacht', fuehler: null });
zwei.geraete.push({ id: 'P1', name: 'Pumpe 1', bereich: 'S1', schalter: 'switch.p1', rolle: 'pumpe', typ: 'konvektor', leistung: 'sensor.p1_power', energie: null });
zwei.entitaeten = Object.fromEntries(Object.entries(zwei.entitaeten).map(([k, v]) => [k.replace(echt.baustelle.entry_id, 'E2'), v]));
Object.assign(zwei.entitaeten, { P1_problem: 'binary_sensor.p1_problem', P1_pumpe_laeuft: 'binary_sensor.p1_laeuft', P1_pumpzeit: 'sensor.p1_pumpzeit', P1_pumpzyklen: 'sensor.p1_zyklen',
  E2_offline_min: 'number.x_offline', E2_trocken_unter_w: 'number.x_trocken', E2_dauerlauf_h: 'number.x_dauer', S1_leistung: 'sensor.s1_leistung', S1_energie: 'sensor.s1_energie', S1_kosten: 'sensor.s1_kosten' });
const abgeschlossen = JSON.parse(JSON.stringify(echt)); abgeschlossen.baustelle.entry_id = 'E3'; abgeschlossen.baustelle.titel = 'Schule Ost'; abgeschlossen.baustelle.optionen.status = 'abgeschlossen';
const struktur = [echt, zwei, abgeschlossen];
// --- Zustände: alle Entitäten mit sinnvollen Werten
const states = {};
const setze = (eid, state, attributes = {}) => states[eid] = { entity_id: eid, state: String(state), attributes };
for (const b of struktur) for (const [k, eid] of Object.entries(b.entitaeten)) {
  const d = eid.split('.')[0];
  if (d === 'switch') setze(eid, 'on'); else if (d === 'time') setze(eid, '06:00:00');
  else if (d === 'select') setze(eid, k.endsWith('modus') ? 'zeitplan' : 'frost', { options: ['zeitplan', 'thermostat', 'hand', 'aus', 'frost'] });
  else if (d === 'number') setze(eid, '5', { min: 0, max: 100, step: 0.5, unit_of_measurement: '°C' });
  else if (d === 'binary_sensor') setze(eid, k.endsWith('problem') ? 'on' : 'on', k.endsWith('problem') ? { probleme: ['keine_leistung'] } : {});
  else if (k.endsWith('status')) setze(eid, 'heizt'); else if (k.endsWith('grund')) setze(eid, 'kleidung_trocknen');
  else if (k.endsWith('naechste_schaltzeit')) setze(eid, new Date().toISOString());
  else setze(eid, '12.5');
}
for (const g of zwei.geraete) { setze(g.schalter, 'on'); if (g.leistung) setze(g.leistung, '1980'); }
setze('weather.baustelle', 'rainy', { temperature: 4.2 });
const aufrufe = [];
const start = Date.now() / 1000 - 3600 * 5;
const hass = {
  states, themes: { darkMode: false },
  callWS: async m => {
    if (m.type === 'baustelle/struktur') return struktur;
    if (m.type === 'history/history_during_period') return Object.fromEntries(m.entity_ids.map(e => [e, [{ s: 'off', lu: start }, { s: 'on', lu: start + 3600 }, { s: '1500', lu: start + 7200 }]]));
    if (m.type === 'recorder/statistics_during_period') return Object.fromEntries(m.statistic_ids.map(e => [e, [0, 1, 2].map(i => ({ start: Date.now() - i * 86400000, change: 3 + i }))]));
    return {};
  },
  callApi: async () => [{ summary: 'Weihnachten', start: { date: '2026-12-23' }, end: { date: '2027-01-07' }, uid: 'u1' }],
  callService: async (d, s, data) => aufrufe.push([d, s, data]),
};
(async () => {
  const P = registry['baustelle-panel'];
  const p = new P();
  p.connectedCallback();
  p.hass = hass;
  await new Promise(r => setTimeout(r, 20));
  let fehler = 0;
  const tabs = ['uebersicht', 'heizung', 'pumpen', 'auswertung', 'verlauf', 'einstellungen'];
  for (const bid of ['ENTRY1', 'E2']) {
    p.ui.bid = bid;
    for (const tab of tabs) for (const per of ['d', '7', 'hp']) for (const sub of ['baustellen', 'diese', 'wetter', 'urlaub']) {
      Object.assign(p.ui, { tab, per, sub, hsel: 'E3' });
      p._seite();                                     // Abfragen anstoßen
      await new Promise(r => setTimeout(r, 5));       // Antworten einsammeln
      const html = p._seite();
      if (process.env.DUMP) require('fs').appendFileSync(process.env.DUMP, html + '\n');
      const m = html.match(/.{60}(undefined|NaN|\[object Object\]).{30}/);
      if (m) { fehler++; if (fehler < 6) console.log('FEHLER', bid, tab, per, sub, m[0]); }
    }
  }
  p.ui.tab = 'heizung'; const html = p._seite();
  console.log('Heizung enthält Animation:', /class="a run/.test(html), '· Zeitplan-Zeilen:', (html.match(/data-time=/g) || []).length);
  p.ui.tab = 'uebersicht'; console.log('Übersicht Zeitleiste:', /<svg class="ch"/.test(p._seite()), '· Warnung:', /Heizkörper selbst an/.test(p._seite()));
  // Bedienung
  p._aenderung({ composedPath: () => [{ dataset: { num: 'number.x' }, value: '7' }] });
  p._aenderung({ composedPath: () => [{ dataset: { time: 'time.x' }, value: '05:30' }] });
  p._aenderung({ composedPath: () => [{ dataset: { select: 'select.x' }, value: 'hand' }] });
  p._klick({ composedPath: () => [{ dataset: { toggle: 'switch.wohnanlage_nord_automatik' }, classList: { contains: () => false } }] });
  console.log('Dienste:', JSON.stringify(aufrufe));
  console.log(fehler ? `${fehler} Fehler` : 'keine undefined/NaN in allen Ansichten');
  const quelle = fs.readFileSync(datei, 'utf8');
  const palette = ['--s1:', '--crit:', '--muted:', '--gridc:'].every(v => quelle.includes(v));
  console.log('Diagramm-Farben definiert:', palette);
  const ok = !fehler && palette && aufrufe.length === 4 && /class="a run/.test(html);
  if (!ok) { console.error('Panel-Test fehlgeschlagen'); process.exit(1); }
})();
