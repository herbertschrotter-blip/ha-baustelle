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
const aufrufe = [], dialoge = [];
echt.zaehler = { 'aufheiz:BEREICH1': 2.4, 'abkuehl:BEREICH1': 1.1, 'gradh:BEREICH1': 480, 'energie:BEREICH1': 36 };
const start = Date.now() / 1000 - 3600 * 5;
const hass = {
  states, themes: { darkMode: false },
  services: { notify: { mobile_app_herbert: {}, send_message: {} } },
  connection: { subscribeMessage: (cb, msg) => { cb({ forecast: [0, 1, 2].map(i => ({ datetime: new Date(Date.now() + i * 86400000).toISOString(), condition: 'rainy', temperature: 8 + i, templow: 1 - i, precipitation: 2.5 })) }); return Promise.resolve(() => {}); } },
  callWS: async m => {
    if (m.type === 'baustelle/struktur') return struktur;
    if (m.type === 'history/history_during_period') return Object.fromEntries(m.entity_ids.map(e => [e, [{ s: 'off', lu: start }, { s: 'on', lu: start + 3600 }, { s: '1500', lu: start + 7200 }]]));
    if (m.type === 'recorder/statistics_during_period') return Object.fromEntries(m.statistic_ids.map(e => [e, [0, 1, 2].map(i => ({ start: Date.now() - i * 86400000, change: 3 + i, mean: 12 - i }))]));
    if (m.type === 'logbook/get_events') return m.entity_ids.map((e, i) => ({ entity_id: e, state: i % 2 ? 'on' : 'off', when: Date.now() / 1000 - i * 3600 }));
    if (m.type === 'config_entries/subentries/delete') { dialoge.push(['loeschen', m.subentry_id]); return {}; }
    return {};
  },
  callApi: async (methode, pfad, daten) => {
    if (methode === 'GET') return [{ summary: 'Weihnachten', start: { date: '2026-12-23' }, end: { date: '2027-01-07' }, uid: 'u1' }];
    if (/flow$/.test(pfad)) { dialoge.push(['start', pfad, daten]); return { type: 'form', flow_id: 'F1' }; }
    dialoge.push(['daten', pfad, daten]);
    return pfad.includes('subentries') ? { type: 'abort', reason: 'reconfigure_successful' } : { type: 'create_entry', result: { entry_id: 'NEU' } };
  },
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
    for (const tab of tabs) for (const per of ['d', '7', 'hp']) for (const sub of ['baustellen', 'diese', 'wetter', 'urlaub', 'meldungen']) {
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
  p.ui.tab = 'uebersicht'; const ue = p._seite();
  const wetterOk = (ue.match(/<svg class="wi"/g) || []).length === 4 && /Heute/.test(ue) && /trocken|mm</.test(ue);
  console.log('Wetterkarte mit animierten Symbolen:', wetterOk); if (!wetterOk) fehler++;
  const zustaende = ['sunny', 'clear-night', 'partlycloudy', 'cloudy', 'fog', 'rainy', 'pouring', 'snowy', 'snowy-rainy', 'hail', 'lightning', 'lightning-rainy', 'windy', 'windy-variant', 'exceptional'];
  if (process.env.SYMBOLE) require('fs').writeFileSync(process.env.SYMBOLE, zustaende.map(z => wetterIcon(z, 64)).join('\n'));
  console.log('Übersicht Zeitleiste:', /<svg class="ch"/.test(ue), '· Warnung:', /Heizkörper selbst an/.test(ue), '· Vorhersage:', /°C<\/div>[\s\S]*mm<\/span><\/div>/.test(ue));
  p.ui.bid = 'ENTRY1'; p.ui.tab = 'auswertung'; p.ui.per = '7'; p._seite(); await new Promise(r => setTimeout(r, 5));
  const au = p._seite(); const vglOk = /2,4 °C\/h/.test(au) && /Temperatur je Tag/.test(au); console.log('Vergleich Aufheizen + Temperatur-Mittel:', vglOk); if (!vglOk) fehler++;
  p.ui.tab = 'verlauf'; p.ui.hsel = 'ENTRY1'; p._seite(); await new Promise(r => setTimeout(r, 5));
  console.log('Ereignisse:', /Automatik (ein|aus)geschaltet|Status:/.test(p._seite()));
  // Formulare der Einstellungen rendern
  p.ui.bid = 'ENTRY1'; p.ui.tab = 'einstellungen';
  for (const form of [['baustellen', { art: 'optionen', id: 'ENTRY1' }], ['baustellen', { art: 'neu' }], ['diese', { art: 'bereich' }], ['diese', { art: 'bereich', id: 'BEREICH1' }],
    ['diese', { art: 'geraet', bereich: 'BEREICH1' }], ['diese', { art: 'geraet', id: 'GERAET1' }], ['diese', { art: 'geraet-loeschen', id: 'GERAET1' }], ['wetter', { art: 'wetter' }],
    ['urlaub', { art: 'kalender' }], ['urlaub', { art: 'urlaub' }]]) {
    p.ui.sub = form[0]; p.ui.form = form[1];
    const h = p._seite();
    if (!/class="form"/.test(h) || /undefined|NaN/.test(h)) { fehler++; console.log('FORMULAR', JSON.stringify(form), (h.match(/.{60}(undefined|NaN).{30}/) || [''])[0]); }
  }
  // Speichern → Einrichtungs-Dialoge von HA
  const werte = { name: 'Container 2', art: 'container', fuehler: '', bereich: 'BEREICH1', schalter: 'switch.neu', rolle: 'heizkoerper', typ: 'oelradiator',
    wetter: 'weather.baustelle', temp_sensor: '', regen_sensor: '' };
  p.shadowRoot.querySelector = sel => { const k = (sel.match(/data-f="([^"]+)"/) || [])[1]; return k in werte ? { value: werte[k], type: 'text' } : null; };
  p.shadowRoot.querySelectorAll = () => [{ checked: true, value: 'mobile_app_herbert' }];
  p.ui.form = { art: 'bereich' }; await p._einstellungAktion('bereich-speichern', {}, p.B());
  p.ui.form = { art: 'geraet', bereich: 'BEREICH1' }; await p._einstellungAktion('geraet-speichern', {}, p.B());
  p.ui.form = { art: 'wetter' }; await p._einstellungAktion('wetter-speichern', {}, p.B());
  await p._einstellungAktion('meldungen-speichern', {}, p.B());
  p.ui.form = { art: 'geraet-loeschen', id: 'GERAET1' }; await p._einstellungAktion('geraet-entfernen', {}, p.B());
  const pfade = dialoge.map(d => d[0] + ':' + (d[1] || ''));
  console.log('Dialoge:', pfade.join(' | '));
  const optionen = dialoge.filter(d => d[0] === 'daten' && d[1].includes('options')).map(d => d[2]);
  const dialogOk = dialoge.some(d => d[0] === 'start' && JSON.stringify(d[2]).includes('"bereich"')) && dialoge.some(d => d[0] === 'start' && JSON.stringify(d[2]).includes('"geraet"'))
    && optionen.length === 2 && optionen[0].wetter === 'weather.baustelle' && !('temp_sensor' in optionen[0]) && optionen[0].heizung === true
    && JSON.stringify(optionen[1].empfaenger) === '["mobile_app_herbert"]' && dialoge.some(d => d[0] === 'loeschen' && d[1] === 'GERAET1');
  console.log('Einrichtungs-Dialoge richtig aufgerufen:', dialogOk);
  if (!dialogOk) fehler++;
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
