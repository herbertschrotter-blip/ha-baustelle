// BSM-032: Vorschlag „Container-Symbol anpassbar“ auf Basis des Master-Mockups.
// Baut mockups/container-symbol.html: node mockups/quelle/archiv/container-symbol.js
// 1. Symbol je Container: Einzel oder Doppel, Türen 1–2 und Fenster 1–4 an Front oder Seite (Lage links … rechts), Farbe.
// 2. Echter Zustand im Symbol (Versionen gewählt 06.10.2026): Tür offen A, Fenster gekippt A, Fenster offen B, Licht an A;
//    Heizen wie bisher (orange, Wellen).
// 3. Container bearbeiten › „Aussehen“: Vorschau, Doppel, Farbe, Türen/Fenster mit Wand, Lage und Sensor, Licht-Quelle.
// Vorführ-Leiste: Zustand (alles zu / Tür offen / Fenster gekippt / Licht an) und was gezeigt wird.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ZEICHNER = require('./container-zeichner.js');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

// die Seite reicht den Container an den Zeichner weiter (im Bau: Symbol kommt von der Integration)
if (!html.includes("b.z === 'pause' || b.z === 'bereit' ? 'aus' : b.z, b);"))   // seit 0.8.68 reicht die Seite den Container selbst weiter
ersetze("const illu = b => b.pumpe ? bcSchacht(b.z === 'laeuft') : bcContainer(BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], b.z === 'pause' || b.z === 'bereit' ? 'aus' : b.z);",
  "const illu = b => b.pumpe ? bcSchacht(b.z === 'laeuft') : bcContainer(BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], b.z === 'pause' || b.z === 'bereit' ? 'aus' : b.z, b);");

const SKRIPT = ZEICHNER + `
/* ================= BSM-032: Container-Symbol anpassbar (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { sheet: p.sheet, klick: p.klick };
  const NEU = '<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:6px;background:var(--amber);color:#000;margin-left:6px">neu</span>';
  const FARBEN = ['#3987e5', '#eb6834', '#1baf7a', '#c98500', '#d55181', '#199e70', '#7e57c2', '#78909c'];
  const LAGEN = [[.15, 'links'], [.33, 'halb links'], [.5, 'Mitte'], [.67, 'halb rechts'], [.85, 'rechts']];
  const STANDARD = () => ({ doppel: false, farbe: null, tueren: [{ wand: 'front', pos: .15, sensor: '' }], fenster: [{ wand: 'front', pos: .67, sensor: '' }], licht: '' });
  // Beispiel: Polier Doppel mit 3 Fenstern, Mannschaft mit Tür an der Seite und 4 Fenstern, die anderen Standard
  const CS = window.CS = {
    polier: { doppel: true, farbe: '#3987e5', tueren: [{ wand: 'front', pos: .15, sensor: '001_C_DOOR_POL' }], licht: '001_C_TEMP_POL_Lichtstufe',
      fenster: [{ wand: 'front', pos: .5, sensor: '' }, { wand: 'front', pos: .85, sensor: '001_C_WIN_POL_1' }, { wand: 'seite', pos: .67, sensor: '' }] },
    mannschaft: { doppel: false, farbe: '#eb6834', tueren: [{ wand: 'seite', pos: .5, sensor: '' }], licht: '',
      fenster: [{ wand: 'front', pos: .15, sensor: '' }, { wand: 'front', pos: .38, sensor: '' }, { wand: 'front', pos: .62, sensor: '' }, { wand: 'front', pos: .85, sensor: '' }] },
  };
  const Z = window.CSZ = { tuer: false, kipp: false, offen: false, licht: false };   // Vorführ-Zustand (im Bau: aus den Sensoren)
  const sym = b => CS[b.id] || (CS[b.id] = STANDARD());

  const STIL = { tuer: 'A', kipp: 'A', offen: 'B', licht: 'A' };   // gewählt von Herbert 06.10.2026 (container-zustaende.html)
  window.bcContainer = function (f, zustand, b) {
    const s = b ? sym(b) : STANDARD(), zeigeZ = b && b.id === 'polier', zw = s.fenster.length > 1 ? 1 : 0;
    const z = { heizt: ['heizt', 'trocknen', 'frost'].includes(zustand), frost: zustand === 'frost', trocknen: zustand === 'trocknen', off: zustand === 'offline',
      tuer: zeigeZ && Z.tuer ? [0] : [], kipp: zeigeZ && Z.kipp ? [zw] : [], offen: zeigeZ && Z.offen ? [s.fenster.length - 1] : [], licht: zeigeZ && Z.licht && !!s.licht };
    return csZeichnen({ ...s, farbe: s.farbe || f }, z, STIL);
  };

  const seg = (act, i, art, wert, opts) => '<div class="seg klein">' + opts.map(([v, t]) => '<button data-act="' + act + '" data-i="' + i + '" data-art="' + art + '" data-v="' + v + '" class="' + (String(wert) === String(v) ? 'on' : '') + '">' + t + '</button>').join('') + '</div>';
  const SENS = { tueren: ['', '001_C_DOOR_POL', '002_C_DOOR_MAN'], fenster: ['', '001_C_WIN_POL_1', '001_C_WIN_POL_2'] };
  const element = (art, x, i) => '<div class="zeile"><div><b>' + (art === 'tueren' ? '🚪 Tür ' : '🪟 Fenster ') + (i + 1) + '</b></div>'
      + '<button class="knopf klein" data-act="cs-weg" data-art="' + art + '" data-i="' + i + '"' + ((art === 'tueren' ? x.length : 2) <= 1 ? ' disabled' : '') + '>✕</button></div>'
    + '<div class="zeile unter"><span>Wand</span>' + seg('cs-wand', i, art, x.wand, [['front', 'Front'], ['seite', 'Seite']]) + '</div>'
    + '<div class="zeile unter"><span>Lage</span>' + seg('cs-lage', i, art, x.pos, LAGEN.map(([v, t]) => [v, t === 'halb links' ? '◧' : t === 'halb rechts' ? '◨' : t])) + '</div>'
    + '<label class="zeile unter"><span>' + (art === 'tueren' ? 'Türsensor' : 'Fenstersensor') + '</span><select>' + SENS[art].map(n => '<option ' + (n === x.sensor ? 'selected' : '') + '>' + (n || 'keiner') + '</option>').join('') + '</select></label>';

  p.sheet = function () {
    const s = this.s.sheet;
    if (s && s.art === 'bereich' && this.b && !this.b.pumpe) {
      const h = alt.sheet.call(this);
      return h.replace('<label class="feld">Temperaturfühler', '<button class="zeile" data-act="cs-auf"><span>🏠 Aussehen' + NEU + '</span><span class="leise">' + (sym(this.b).doppel ? 'Doppel' : 'Einzel') + ' · ' + sym(this.b).tueren.length + ' Tür · ' + sym(this.b).fenster.length + ' Fenster ›</span></button><label class="feld">Temperaturfühler');
    }
    if (!s || s.art !== 'cs-aussehen') return alt.sheet.call(this);
    const b = this.d.bereiche.find(x => x.id === s.id), c = sym(b);
    return '<div class="griff"></div><div class="block-kopf"><h3>🏠 Aussehen · ' + esc(b.name) + '</h3></div>'
      + '<div class="cs-vorschau">' + bcContainer(BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], b.z === 'pause' || b.z === 'bereit' ? 'aus' : b.z, b) + '</div>'
      + '<div class="glas-panel liste"><div class="zeile"><div><b>Doppelcontainer</b><div class="leise">zwei Container nebeneinander – das Symbol wird doppelt so tief</div></div>' + schalter(c.doppel, 'cs-doppel') + '</div>'
      + '<div class="zeile"><span>Farbe</span><span class="cs-farben">' + FARBEN.map(fb => '<button data-act="cs-farbe" data-v="' + fb + '" class="cs-farbe ' + ((c.farbe || BEREICH_FARBEN[b.f % 6]) === fb ? 'on' : '') + '" style="background:' + fb + '" aria-label="Farbe ' + fb + '"></button>').join('') + '<input type="color" value="' + (c.farbe || BEREICH_FARBEN[b.f % 6]) + '" aria-label="eigene Farbe"></span></div></div>'
      + '<div class="glas-panel liste"><div class="gruppe">Türen · ' + c.tueren.length + ' von 2</div>' + c.tueren.map((x, i) => element('tueren', c.tueren, i)).join('')
      + (c.tueren.length < 2 ? '<button class="zeile" data-act="cs-neu" data-art="tueren"><span class="blau">+ Tür</span></button>' : '') + '</div>'
      + '<div class="glas-panel liste"><div class="gruppe">Fenster · ' + c.fenster.length + ' von 4</div>' + c.fenster.map((x, i) => element('fenster', c.fenster, i)).join('')
      + (c.fenster.length < 4 ? '<button class="zeile" data-act="cs-neu" data-art="fenster"><span class="blau">+ Fenster</span></button>' : '') + '</div>'
      + '<div class="glas-panel liste"><div class="gruppe">Licht im Symbol</div><label class="zeile"><div><span>Licht kommt von</span><div class="leise">Fenster leuchten, wenn im Container Licht brennt</div></div><select>'
      + ['', '001_C_TEMP_POL_Lichtstufe (BLU-Sensor)', 'switch.licht_polier (Schalter)'].map(n => '<option ' + (n.startsWith(c.licht || '–') ? 'selected' : '') + '>' + (n || 'keins') + '</option>').join('') + '</select></label></div>'
      + '<div class="leise p-fuss">Tür offen/zu, Fenster offen/gekippt/zu und Licht kommen von den zugeordneten Sensoren; ohne Sensor bleibt das Element zu bzw. dunkel.</div>'
      + '<button class="knopf" data-act="zu">Fertig</button>';
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    const s = this.s.sheet, c = s && s.art === 'cs-aussehen' ? sym(this.d.bereiche.find(x => x.id === s.id)) : null;
    if (a === 'cs-auf') { this.s.sheet = { art: 'cs-aussehen', id: this.b.id }; return this.render(true); }
    if (c && a === 'cs-doppel') { c.doppel = !c.doppel; return this.render(true); }
    if (c && a === 'cs-farbe') { c.farbe = el.dataset.v; return this.render(true); }
    if (c && (a === 'cs-wand' || a === 'cs-lage')) { c[el.dataset.art][+el.dataset.i][a === 'cs-wand' ? 'wand' : 'pos'] = a === 'cs-wand' ? el.dataset.v : +el.dataset.v; return this.render(true); }
    if (c && a === 'cs-weg') { c[el.dataset.art].splice(+el.dataset.i, 1); return this.render(true); }
    if (c && a === 'cs-neu') { const l = c[el.dataset.art], frei = LAGEN.map(x => x[0]).find(v => !l.some(y => y.wand === 'front' && y.pos === v)) ?? .5; l.push({ wand: 'front', pos: frei, sensor: '' }); return this.render(true); }
    return alt.klick.call(this, ev);
  };
  const st = document.createElement('style');
  st.textContent = '.cs-vorschau{max-width:320px;margin:0 auto 10px}.cs-vorschau svg{width:100%;height:auto}.cs-farben{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}'
    + '.cs-farbe{width:22px;height:22px;border-radius:50%;border:2px solid transparent;padding:0}.cs-farbe.on{border-color:var(--ink,#fff);box-shadow:0 0 0 2px rgba(0,0,0,.4)}'
    + '.cs-licht{filter:drop-shadow(0 0 4px #ffd54f)}';
  document.head && document.head.appendChild(st);
  for (const q of (window.P || [])) q.render(true);
})();
`;
ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Container-Symbol</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>BSM-032 Container-Symbol · Vorschlag auf Seite $1</b>');
ersetze('<button id="neu">Beispiel neu laden</button>', `<button id="neu">Beispiel neu laden</button>
<label>Polier <select id="cs-zst"><option value="">alles zu</option><option value="tuer">Tür offen</option><option value="kipp">Fenster gekippt</option><option value="offen">Fenster offen</option><option value="licht">Licht an</option><option value="alle">alles zusammen</option></select></label>
<label>zeigen <select id="cs-ziel"><option value="uebersicht">Übersicht</option><option value="container">Container Polier</option><option value="aussehen">Aussehen bearbeiten</option></select></label>`);
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
const csZst = document.getElementById('cs-zst'), csZiel = document.getElementById('cs-ziel');
const csZeigen = () => { const v = csZst.value; Object.assign(CSZ, { tuer: v === 'tuer' || v === 'alle', kipp: v === 'kipp' || v === 'alle', offen: v === 'offen' || v === 'alle', licht: v === 'licht' || v === 'alle' });
  for (const p of P) { if (!p.d) { setTimeout(csZeigen, 300); return; } p.s.sheet = null; const b = p.d.bereiche.find(x => x.id === 'polier') || p.d.bereiche[0];
    if (csZiel.value === 'uebersicht') p.gehe('uebersicht'); else { p.gehe('container', b.id); if (csZiel.value === 'aussehen') { p.s.sheet = { art: 'cs-aussehen', id: b.id }; } }
    p.render(true); } };
csZst.onchange = csZeigen; csZiel.onchange = csZeigen; csZeigen();`);
fs.writeFileSync(path.join(repo, 'mockups', 'container-symbol.html'), html);
console.log(`mockups/container-symbol.html gebaut (${Math.round(html.length / 1024)} KB)`);
