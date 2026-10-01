// Baut das Master-Mockup mockups/glas.html: node mockups/quelle/glas.js
// Kein Nachbau mehr: glas.html enthält die echte Seite (custom_components/baustelle/frontend/baustelle-panel.js) und das
// Beispiel-hass des Panel-Tests (tests/panel/beispiel-hass.js, tests/panel/struktur-0.7.json, tests/vektoren). Damit ist
// das Mockup immer auf dem Stand der Seite; der Panel-Test prüft, dass glas.html neu gebaut wurde.
// Neue Vorschläge (Varianten) kommen als eigene Datei daneben (z. B. heizung-varianten.html) und nach der Abnahme in die Seite.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..');
const lies = p => fs.readFileSync(path.join(repo, p), 'utf8');
const panel = lies('custom_components/baustelle/frontend/baustelle-panel.js');
const changelog = lies('custom_components/baustelle/frontend/changelog.json');
const beispiel = lies('tests/panel/beispiel-hass.js');
const struktur = lies('tests/panel/struktur-0.7.json');
const vektor = Object.fromEntries(['abrechnung', 'je-geraet', 'typvergleich', 'wetter', 'kennzahlen', 'verlauf', 'monate'].map(n => {
  const f = path.join(repo, 'tests', 'vektoren', `auswertung-${n}.json`);
  return [n, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).faelle : []];
}));
const version = (panel.match(/const SEITE_VERSION = '([^']+)'/) || [])[1] || '?';
const sicher = t => t.replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Baustelle – Master-Mockup</title>
<style>
:root { --primary-text-color: #e8eaed; --secondary-text-color: #9aa0a6; --divider-color: rgba(255,255,255,.12); --primary-color: #03a9f4;
  --card-background-color: #1c1c1e; --primary-background-color: #111; --error-color: #db4437; --warning-color: #ffa600; --success-color: #43a047; color-scheme: dark; }
body.hell { --primary-text-color: #212121; --secondary-text-color: #616161; --divider-color: rgba(0,0,0,.12); --card-background-color: #fff;
  --primary-background-color: #f2f2f7; color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.4 Roboto, system-ui, -apple-system, "Segoe UI", sans-serif; background: #0b0d12; color: var(--primary-text-color); }
body.hell { background: #dfe3ea; }
.bar { position: sticky; top: 0; z-index: 50; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 10px 16px;
  background: rgba(20,22,28,.92); color: #e8eaed; border-bottom: 1px solid rgba(255,255,255,.1); backdrop-filter: blur(8px); }
.bar b { font-size: 14px; } .bar label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.bar button, .bar select, .bar input { font: inherit; font-size: 13px; color: inherit; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); border-radius: 8px; padding: 4px 10px; }
.bar input[type=range] { padding: 0; width: 180px; } .bar .leise { color: #9aa0a6; font-size: 12px; flex-basis: 100%; }
.buehne { display: flex; flex-wrap: wrap; gap: 28px; padding: 20px 16px 40px; align-items: flex-start; }
.buehne h2 { margin: 0 0 8px; font-size: 13px; font-weight: 500; color: #9aa0a6; }
.telefon { width: 390px; max-width: calc(100vw - 32px); height: 844px; border-radius: 44px; overflow: hidden; border: 10px solid #000; box-shadow: 0 20px 60px rgba(0,0,0,.5); background: var(--primary-background-color); }
.desktop-spalte { flex: 1 1 760px; min-width: 0; }
.desktop { width: 100%; height: 860px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,.12); box-shadow: 0 20px 60px rgba(0,0,0,.4); background: var(--primary-background-color); }
.telefon baustelle-panel, .desktop baustelle-panel { display: block; width: 100%; height: 100%; overflow: auto; }
@media (max-width: 500px) { .telefon { height: 780px; border-width: 6px; border-radius: 30px; } .buehne { padding: 12px 8px; } }
</style></head>
<body>
<div class="bar"><b>Baustelle · Master-Mockup · Seite ${version}</b>
<button id="modus">Hell / Dunkel</button>
<label>Uhrzeit <input type="range" id="uhr" min="0" max="1435" step="5"> <span id="uhr-text"></span></label>
<label>Wetter <select id="wetter">${[['rainy', 'Regen'], ['sunny', 'sonnig / klar'], ['partlycloudy', 'teils bewölkt'], ['cloudy', 'bewölkt'], ['pouring', 'Starkregen'],
  ['lightning-rainy', 'Gewitter'], ['fog', 'Nebel'], ['snowy', 'Schnee']].map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
<button id="neu">Beispiel neu laden</button>
<span class="leise">Die echte Seite mit Beispieldaten (Tag 29.09.2026). Alles ist klickbar; Änderungen bleiben bis zum Neuladen. Nichts wird an Home Assistant geschickt.</span></div>
<div class="buehne">
  <div><h2>Handy · 390 px</h2><div class="telefon" id="telefon"></div></div>
  <div class="desktop-spalte"><h2>Desktop</h2><div class="desktop" id="desktop"></div></div>
</div>
<script>
/* Uhr: Beispieltag 29.09.2026, die Uhrzeit wählt die Leiste – die Zeit läuft von dort weiter */
const BEISPIEL_TAG = '2026-09-29', _Date = Date, _jetzt = _Date.now.bind(_Date);
let VERSATZ = _Date.parse(BEISPIEL_TAG + 'T16:20:00+02:00') - _jetzt();
class MockDate extends _Date { constructor(...a) { if (a.length) super(...a); else super(_jetzt() + VERSATZ); } static now() { return _jetzt() + VERSATZ; } }
window.Date = MockDate;
/* Dateien der Integration: Changelog aus dem Repo, sonst nichts */
const CHANGELOG = ${changelog.trim()};
const _fetch = window.fetch ? window.fetch.bind(window) : null;
window.fetch = async (url, o) => String(url).includes('/baustelle_static/changelog.json') ? new Response(JSON.stringify(CHANGELOG), { headers: { 'Content-Type': 'application/json' } })
  : String(url).startsWith('/baustelle_static/') ? new Response('', { status: 404 }) : _fetch(url, o);
</script>
<script>
${sicher(panel)}
</script>
<script>
${sicher(beispiel)}
</script>
<script>
const STRUKTUR = ${struktur.trim()};
for (const b of STRUKTUR) if (b.baustelle && 'version' in b.baustelle) b.baustelle.version = ${JSON.stringify(version)};   // Über: Stand der Seite
const VEKTOR = ${JSON.stringify(vektor)};
let welt, B;
function beispiel() {
  welt = JSON.parse(JSON.stringify(STRUKTUR));
  B = beispielHass({ STRUKTUR, REFERENZ: true, VEKTOR, WELT: 'struktur-0.7', welt: () => welt });
}
beispiel();
const P = [];
for (const [id, schmal] of [['telefon', true], ['desktop', false]]) {
  const el = document.createElement('baustelle-panel'); el.panel = { config: { version: ${JSON.stringify(version)} } }; el.narrow = schmal;
  document.getElementById(id).appendChild(el); P.push(el);
}
/* Sonne wie sun.sun am Beispieltag (etwa 47° N): Aufgang 07:05, Untergang 18:45 */
const AUF = 7 * 60 + 5, AB = 18 * 60 + 45, iso = min => new _Date(_Date.parse(BEISPIEL_TAG + 'T00:00:00+02:00') + min * 6e4).toISOString();
function sonne(min) {
  const tag = min >= AUF && min < AB, mitte = (AUF + AB) / 2;
  const hoehe = tag ? 38 * Math.sin(Math.PI * (min - AUF) / (AB - AUF)) : -Math.min(30, Math.min(Math.abs(min - AB), Math.abs(min + 1440 - AB), Math.abs(AUF - min), Math.abs(AUF + 1440 - min)) / 6);
  return { entity_id: 'sun.sun', state: tag ? 'above_horizon' : 'below_horizon', attributes: { elevation: Math.round(hoehe * 10) / 10, rising: min < mitte,
    next_rising: iso(min < AUF ? AUF : AUF + 1440), next_setting: iso(min < AB ? AB : AB + 1440), friendly_name: 'Sonne' } };
}
const uhrEl = document.getElementById('uhr'), uhrText = document.getElementById('uhr-text'), wetterEl = document.getElementById('wetter');
const minuteJetzt = () => { const d = new _Date(Date.now()); const t = d.toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' }).split(':'); return +t[0] * 60 + +t[1]; };
const wetterEid = (STRUKTUR[0].baustelle.optionen || {}).wetter || 'weather.dobl';
function hassNeu() {
  const min = minuteJetzt(), w = B.states[wetterEid] || { entity_id: wetterEid, attributes: {} };
  const zustand = wetterEl.value === 'sunny' && !(min >= AUF && min < AB) ? 'clear-night' : wetterEl.value;
  const states = { ...B.states, 'sun.sun': sonne(min), [wetterEid]: { ...w, state: zustand } };
  const hass = { ...B.hass, states, themes: { darkMode: !document.body.classList.contains('hell') } };
  for (const p of P) p.hass = hass;
  uhrEl.value = min; uhrText.textContent = String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}
uhrEl.oninput = () => { const ziel = _Date.parse(BEISPIEL_TAG + 'T00:00:00+02:00') + uhrEl.value * 6e4; VERSATZ = ziel - _jetzt(); hassNeu(); };
wetterEl.onchange = hassNeu;
document.getElementById('modus').onclick = () => { document.body.classList.toggle('hell'); hassNeu(); };
document.getElementById('neu').onclick = () => { beispiel(); for (const p of P) p.cache = {}; hassNeu(); for (const p of P) p._laden(); };
hassNeu();
setInterval(hassNeu, 60000);
</script>
</body></html>
`;
fs.writeFileSync(path.join(repo, 'mockups', 'glas.html'), html);
console.log(`mockups/glas.html gebaut (Seite ${version}, ${Math.round(html.length / 1024)} KB)`);
