// WU-0017: Vorschlag „Vergleich kWh / Vergleich Kosten“ – zwei neue Kacheln im Katalog, 2–4 Container gegenüber.
// Baut mockups/vergleich-kacheln.html: node mockups/quelle/archiv/vergleich-kacheln.js (Vorschlag – eingebaut in 0.8.43)
// Ergänzt den Kachel-Katalog der echten Seite (KK) um zwei Einträge; beim Anlegen 2–4 Container und (Übersicht) der
// Zeitraum heute/Woche/Monat; in der Auswertung folgt die Kachel dem gewählten Zeitraum. Diagramm in L: Balken
// nebeneinander oder Linien (Leiste „Diagramm“). Vorbelegt: auf der Übersicht je eine Kachel in M und L.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const CSS = `
.vg-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 4px; vertical-align: middle; }
.vg-zeilen { display: flex; flex-direction: column; gap: 2px; margin-top: auto; font-size: 12px; }
.vg-zeilen div { display: flex; justify-content: space-between; gap: 6px; } .vg-zeilen span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink2); }
.vg-zeilen b { font-weight: 600; white-space: nowrap; } .vg-zeilen i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }
.vg-tab { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; } .vg-tab th { font-weight: 500; color: var(--ink2); text-align: right; padding: 2px 4px; }
.vg-tab th:first-child, .vg-tab td:first-child { text-align: left; } .vg-tab td { text-align: right; padding: 3px 4px; border-top: 1px solid var(--gridc); white-space: nowrap; }
.vg-tab i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }
.vg-chips button.on { outline: 2px solid var(--amber); }
.vg-svg .ax { font-size: 9px; fill: var(--ink2); } .vg-svg .gr { stroke: var(--gridc); }
`;

const SKRIPT = `
/* ================= WU-0017: Vergleich zweier (bis vier) Container (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { daten: p.kkDaten, kachel: p.kkKachel, wahl: p.kkWahl, hinzu: p.kkHinzu, klick: p.klick, name: p.kkName, aufbauen: p._aufbauen, liste: p.kkListe };
  const VG = window.VG = { dia: 'balken' };
  p._aufbauen = function () { const erst = !this.root; alt.aufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS)}; this.shadowRoot.appendChild(s); } };
  KK['v-kwh'] = { ber: 'container', je: 'v', ic: '⚖', name: 'Vergleich kWh', text: '2–4 Container gegenüber – Verbrauch', such: 'vergleich gegenüber kwh verbrauch container' };
  KK['v-eur'] = { ber: 'container', je: 'v', ic: '⚖', name: 'Vergleich Kosten', text: '2–4 Container gegenüber – Kosten in €', such: 'vergleich gegenüber euro kosten container' };
  const VGL = k => k === 'v-kwh' || k === 'v-eur';
  const C = d => d.bereiche.filter(b => !b.pumpe);
  const farbe = b => BEREICH_FARBEN[b.f % BEREICH_FARBEN.length];
  const ZR = { Tag: 'heute', Woche: 'diese Woche', Monat: 'dieser Monat' };
  p.kkName = function (x) { if (!VGL(x.k)) return alt.name.call(this, x); const n = (x.ids || []).map(id => (this.d.bereiche.find(b => b.id === id) || { name: id }).name); return KK[x.k].name + (n.length ? ' · ' + n.join(' / ') : ''); };
  p.kkListe = function (ort) { const L = alt.liste.call(this, ort);
    if (ort === 'ue' && !this._vgVorbelegt) { this._vgVorbelegt = true; const ids = C(this.d).slice(0, 2).map(b => b.id);
      L.unshift(this.kkGross({ k: 'v-kwh', an: true, ids, zr: 'Tag' }, 'M'), this.kkGross({ k: 'v-eur', an: true, ids: C(this.d).slice(0, 3).map(b => b.id), zr: 'Woche', dia: true }, 'L')); }
    return L; };
  /* Werte je Container aus der Statistik der Seite (im echten Bau: Werte der Integration) */
  p.vgWerte = function (x, c) {
    const d = this.d, z = c.ort === 'aw' ? c.zc : (x.zr || 'Tag'), v = c.ort === 'aw' ? c.vc : 0, eur = x.k === 'v-eur', f = eur ? d.e.preis : 1;
    const B = (x.ids || []).map(id => d.bereiche.find(b => b.id === id)).filter(Boolean);
    const R = B.map(b => { const r = this.verbrauch(d, b.id, z, v), h = this.heizStunden(d, b, z, v); return { b, r: r && r.map(q => (q || 0) * f), su: r ? summe(r) * f : null, kwh: r ? summe(r) : null, h: h ? summe(h) : null }; });
    return { z, v, eur, R, zr: this.zeitraum(z, v), wann: this.zrText(z, v) };
  };
  const zahlT = (v, eur) => zahl(v) ? (eur ? de(v, 2) + ' €' : de(v, v < 100 ? 1 : 0) + ' kWh') : '–';
  p.vgDia = function (W0, id) {
    const R = W0.R.filter(q => q.r); if (!R.length) return '';
    const n = W0.zr.labels.length, W = 320, H = 150, L = 34, Rr = 8, T = 8, U = 18, hi = Math.max(...R.flatMap(q => q.r), 0.01) * 1.1;
    const y = v => T + (1 - v / hi) * (H - T - U), bw = (W - L - Rr) / n, jedes = { Tag: 6, Woche: 1, Monat: 7 }[W0.z] || 3;
    const stufe = hi > 200 ? 100 : hi > 40 ? 20 : hi > 12 ? 5 : hi > 4 ? 2 : hi > 1.5 ? .5 : .2;
    const raster = [...Array(Math.floor(hi / stufe) + 1)].map((_, q) => q * stufe).map(v => '<line class="gr" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="ax" x="' + (L - 4) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + de(v, stufe < 1 ? 1 : 0) + '</text>').join('');
    const achse = W0.zr.labels.map((t, i) => i % jedes ? '' : '<text class="ax" x="' + (L + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + esc(String(t)) + '</text>').join('');
    const inhalt = VG.dia === 'linien'
      ? R.map(q => '<path d="' + q.r.map((v, i) => (i ? 'L' : 'M') + (L + i * bw + bw / 2).toFixed(1) + ' ' + y(v).toFixed(1)).join('') + '" fill="none" stroke="' + farbe(q.b) + '" stroke-width="2.2" stroke-linejoin="round"/>').join('')
      : W0.zr.labels.map((_, i) => R.map((q, k) => { const w = bw * .8 / R.length, xx = L + i * bw + bw * .1 + k * w, v = q.r[i] || 0; return v > 0 ? '<rect x="' + xx.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + Math.max(1, w - .5).toFixed(1) + '" height="' + (y(0) - y(v)).toFixed(1) + '" fill="' + farbe(q.b) + '" rx="1"/>' : ''; }).join('')).join('');
    return '<svg class="vg-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' + raster + achse + inhalt + '</svg>';
  };
  p.kkKachel = function (x, i, ort, c) {
    if (!VGL(x.k)) return alt.kachel.call(this, x, i, ort, c);
    const e = KK[x.k], W0 = this.vgWerte(x, c), R = W0.R, gr = x.st, eur = W0.eur, NEU = '<span class="vg-neu">neu</span>';
    const kopf = '<div class="kk-kopf"><span class="kk-ic">' + e.ic + '</span><small>' + esc(e.name) + '</small>' + (ort === 'kat' ? '' : NEU) + '</div>';
    const ok = R.filter(q => zahl(q.su)), max = Math.max(...ok.map(q => q.su), 0), min = Math.min(...ok.map(q => q.su));
    const vorne = ok.find(q => q.su === max), hinten = ok.find(q => q.su === min);
    const unter = vorne && hinten && vorne !== hinten && min > 0 ? esc(vorne.b.name) + ' +' + de((max / min - 1) * 100, 0) + ' % zu ' + esc(hinten.b.name) : 'gleich';
    const zeilen = '<div class="vg-zeilen">' + R.map(q => '<div><span><i style="background:' + farbe(q.b) + '"></i>' + esc(q.b.name) + '</span><b>' + zahlT(q.su, eur) + '</b></div>').join('') + '</div>';
    let inhalt;
    if (gr === 'S') inhalt = kopf + zeilen;
    else if (gr === 'M') inhalt = '<div class="kk-m-l">' + kopf + '<span class="kk-wo">' + esc(W0.wann) + '</span><span class="kk-vgl">' + unter + '</span></div><div class="kk-m-r">' + kkBalken(R.map(q => [q.b.name, q.su || 0, zahlT(q.su, eur), farbe(q.b)])) + '</div>';
    else inhalt = kopf + '<div class="kk-l-zeile"><span class="kk-wo">' + esc(W0.wann) + '</span></div><span class="kk-vgl">' + unter + '</span>'
      + (x.dia !== false ? '<div class="kk-dia">' + (this.vgDia(W0) || '<div class="leer">Noch keine Werte</div>') + '</div>' + zeilen
        : '<table class="vg-tab"><tr><th></th><th>kWh</th><th>€</th><th>Heizzeit</th><th>kWh/h</th></tr>' + R.map(q => '<tr><td><i style="background:' + farbe(q.b) + '"></i>' + esc(q.b.name) + '</td><td>' + (zahl(q.kwh) ? de(q.kwh, 1) : '–') + '</td><td>' + (zahl(q.kwh) ? de(q.kwh * this.d.e.preis, 2) : '–') + '</td><td>' + stdMin(q.h) + '</td><td>' + (q.h > 0 ? de(q.kwh / q.h, 2) : '–') + '</td></tr>').join('') + '</table>');
    return ort === 'kat' ? '<div class="glas-panel kk kk-' + gr + '">' + inhalt + '</div>' : '<div class="glas-panel kk kk-' + gr + '" role="button" tabindex="0" data-act="kk-auf" data-ort="' + ort + '" data-i="' + i + '">' + inhalt + '</div>';
  };
  p.kkDaten = function (x, b, c) { return VGL(x.k) ? null : alt.daten.call(this, x, b, c); };
  p.kkWahl = function (s, e) {
    if (!VGL(e.k)) return alt.wahl.call(this, s, e);
    const B = C(this.d); s.ids ||= B.slice(0, 2).map(b => b.id); s.zr ||= 'Tag'; if (!['S', 'M', 'L'].includes(s.st)) s.st = 'M';
    const c = this.kkCtx(s.ort), ort = s.ort === 'aw' ? 'Auswertung' : 'Übersicht';
    return '<div class="kk-wahl"><div class="gruppe-t">Container · 2 bis 4 wählen</div><div class="vb-wer vg-chips">' + B.map(b => '<button data-act="vg-id" data-id="' + b.id + '" class="' + (s.ids.includes(b.id) ? 'on' : '') + '"><i style="background:' + farbe(b) + '"></i>' + esc(b.name) + '</button>').join('') + '</div>'
      + (s.ort === 'aw' ? '<div class="leise">Zeitraum: der gewählte der Auswertung</div>' : '<div class="gruppe-t">Zeitraum</div><div class="seg">' + Object.entries(ZR).map(([k, t]) => '<button data-act="vg-zr" data-v="' + k + '" class="' + (s.zr === k ? 'on' : '') + '">' + t + '</button>').join('') + '</div>')
      + '<div class="gruppe-t">Größe</div><div class="seg">' + KK_GROESSE.map(([g, t, m]) => '<button data-act="kk-gr" data-v="' + g + '" class="' + (s.st === g ? 'on' : '') + '">' + t + ' · ' + m + '</button>').join('') + '</div>'
      + (s.st === 'L' ? '<div class="zeile kk-sw"><div><span>mit Diagramm</span><div class="leise">aus: Tabelle kWh, €, Heizzeit, kWh je Stunde</div></div>' + schalter(s.dia, 'kk-dia-w') + '</div>' : '')
      + '<div class="gruppe-t">Vorschau</div><div class="aw-raster kk-vorschau"><div class="aw-frei-s" style="--w:' + (s.st === 'S' ? 1 : 2) + ';--h:' + (s.st === 'L' ? 2 : 1) + '"><div class="aw-inhalt">' + this.kkKachel({ k: e.k, ids: s.ids, zr: s.zr, st: s.st, dia: s.dia }, 0, 'kat', c) + '</div></div></div>'
      + '<button class="knopf amber" data-act="kk-hinzu"' + (s.ids.length < 2 ? ' disabled' : '') + '>Zur ' + ort + ' hinzufügen</button></div>';
  };
  p.kkHinzu = function (s) {
    if (!VGL(s.k)) return alt.hinzu.call(this, s);
    this.kkListe(s.ort).push(this.kkGross({ k: s.k, an: true, ids: [...s.ids], zr: s.zr, ...(s.st === 'L' ? { dia: !!s.dia } : {}) }, s.st));
    this.s.sheet = null; this.render(); this.toast('Kachel „' + this.kkName({ k: s.k, ids: s.ids }) + '“ hinzugefügt');
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act, s = this.s.sheet;
    if (a === 'vg-id') { const i = s.ids.indexOf(el.dataset.id); if (i >= 0) { if (s.ids.length <= 2) return this.toast('Mindestens 2 Container'); s.ids.splice(i, 1); } else { if (s.ids.length >= 4) return this.toast('Höchstens 4 Container'); s.ids.push(el.dataset.id); } return this.render(); }
    if (a === 'vg-zr') { s.zr = el.dataset.v; return this.render(); }
    if (a === 'kk-auf') { const ort = el.dataset.ort, x = this.kkListe(ort).filter(y => y.an)[+el.dataset.i]; if (x && VGL(x.k)) { this.s.sheet = { art: 'verbrauch', t: x.k === 'v-eur' ? 'eur' : undefined, auswahl: [...x.ids], zeitraum: x.zr || 'Tag', v: 0 }; return this.render(); } }
    return alt.klick.call(this, ev);
  };
})();
`;

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Vergleich-Kacheln</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>WU-0017 Vergleich kWh / Kosten · Vorschlag auf Seite $1</b>');
ersetze('<button id="neu">Beispiel neu laden</button>', `<button id="neu">Beispiel neu laden</button>
<label>Diagramm <select id="vg-dia"><option value="balken">Balken nebeneinander</option><option value="linien">Linien</option></select></label>`);
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
document.getElementById('vg-dia').onchange = e => { VG.dia = e.target.value; for (const p of P) p.render(); };`);
fs.writeFileSync(path.join(repo, 'mockups', 'vergleich-kacheln.html'), html);
console.log(`mockups/vergleich-kacheln.html gebaut (${Math.round(html.length / 1024)} KB)`);
