// Vorschlag „Soll gleitend nach draußen und nach deinem Gefühl“ (Herbert 01.10.2026, Variante C) auf Basis des Master-Mockups.
// Baut mockups/soll-gleitend.html: node mockups/quelle/archiv/soll-gleitend.js (Vorschlag – eingebaut in 0.8.36)
// Ändert nur die Anzeige: Heizung › Regeln (Solltemperatur fest/gleitend mit Kurve) und die Container-Ansicht (Knöpfe
// „zu kalt / passt / zu warm“ unter dem Thermostat-Rad). Außenmittel, Rückmeldungen und Gelerntes: Beispielwerte.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const CSS = `
.sg-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 6px; vertical-align: middle; }
.sg-heute { display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; font-size: 13px; padding: 8px 12px; border-radius: 12px; background: rgba(120,120,128,.12); margin: 6px 0; }
.sg-heute b { text-align: right; font-weight: 500; white-space: nowrap; } .sg-heute .summe { border-top: 1px solid var(--gridc); padding-top: 4px; font-weight: 600; font-size: 15px; }
.sg-kurve { width: 100%; height: 150px; display: block; margin: 4px 0; }
.sg-kurve .ax { font-size: 9px; fill: var(--ink2); } .sg-kurve .gr { stroke: var(--gridc); stroke-width: 1; }
.sg-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--ink2); } .sg-leg i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
.sg-box { margin: 14px 0 4px; } .sg-gefuehl { display: flex; gap: 8px; justify-content: center; margin: 0 0 4px; }
.sg-gefuehl button { flex: 1; max-width: 120px; white-space: nowrap; padding: 9px 6px; border-radius: 14px; border: 0; background: rgba(120,120,128,.18); color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.sg-gefuehl button.on { background: var(--amber); color: #1a1000; font-weight: 600; }
.sg-versch { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 2px 0 6px; font-size: 13px; } .sg-versch b { color: var(--amber); }
.sg-gefuehl-t { text-align: center; font-size: 11.5px; color: var(--ink2); }
`;

const SKRIPT = `
/* ================= Soll gleitend nach draußen und nach deinem Gefühl (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { regeln: p.regelnInhalt, rad: p.cRad, klick: p.klick, aufbauen: p._aufbauen };
  const NEU = '<span class="sg-neu">neu</span>', BSP = ' <span class="leise">· Beispiel</span>';
  p._aufbauen = function () { const erst = !this.root; alt.aufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS)}; this.shadowRoot.appendChild(s); } };
  /* Beispiel: Außenmittel der letzten 3 Tage, Rückmeldungen [Außenmittel, -1 zu kalt | 0 passt | +1 zu warm] */
  const SG = window.SG = { gleitend: true, min: 21.0, max: 24.0, je: 0.1, bezug: 12, tage: 3, aussen: 6.4,
    rueck: [[2.0, -1], [4.5, -1], [6.0, 0], [9.5, 0], [13.0, 1], [15.5, 1], [7.0, -1]], letzte: null, versch: {} };   // versch: + / − am Rad je Container, bis morgen früh
  const start = t => Math.max(SG.min, Math.min(SG.max, SG.min + SG.je * Math.max(0, SG.bezug - t)));
  // gelernt: je Rückmeldung 0,15 °C bei gleichem Wetter, weniger je weiter das Außenmittel weg ist (bis 5 °C), höchstens ±1,5 °C
  const gelernt = t => Math.max(-1.5, Math.min(1.5, SG.rueck.reduce((s, [x, r]) => s - r * 0.15 * Math.max(0, 1 - Math.abs(x - t) / 5), 0)));
  const sollAm = t => Math.max(SG.min, Math.min(SG.max, start(t) + gelernt(t)));
  const r1 = v => Math.round(v * 10) / 10;
  p.sgKurve = function () {
    const W = 320, H = 150, L = 30, R = 8, T = 8, U = 18, x = t => L + (t + 10) / 30 * (W - L - R), y = s => T + (1 - (s - 20) / 5) * (H - T - U);
    const pfad = f => [...Array(31)].map((_, i) => { const t = i - 10; return (i ? 'L' : 'M') + x(t).toFixed(1) + ' ' + y(f(t)).toFixed(1); }).join('');
    const raster = [20, 21, 22, 23, 24, 25].map(s => '<line class="gr" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(s) + '" y2="' + y(s) + '"/><text class="ax" x="' + (L - 4) + '" y="' + (y(s) + 3) + '" text-anchor="end">' + s + '°</text>').join('')
      + [-10, 0, 10, 20].map(t => '<text class="ax" x="' + x(t) + '" y="' + (H - 4) + '" text-anchor="middle">' + t + '° außen</text>').join('');
    const punkte = SG.rueck.map(([t, r]) => '<circle cx="' + x(t).toFixed(1) + '" cy="' + y(sollAm(t) + (r ? -r * 0.35 : 0)).toFixed(1) + '" r="4" fill="' + (r < 0 ? '#64a8ff' : r > 0 ? '#ff9f0a' : '#30d158') + '"/>').join('');
    return '<svg class="sg-kurve" viewBox="0 0 ' + W + ' ' + H + '">' + raster
      + '<rect x="' + L + '" y="' + y(21) + '" width="' + (W - L - R) + '" height="' + (H - U - y(21)) + '" fill="rgba(255,69,58,.08)"/>'
      + '<path d="' + pfad(start) + '" fill="none" stroke="var(--ink2)" stroke-width="1.5" stroke-dasharray="5 4"/>'
      + '<path d="' + pfad(sollAm) + '" fill="none" stroke="var(--amber)" stroke-width="2.5"/>' + punkte
      + '<line x1="' + x(SG.aussen) + '" x2="' + x(SG.aussen) + '" y1="' + T + '" y2="' + (H - U) + '" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 3"/>'
      + '<circle cx="' + x(SG.aussen) + '" cy="' + y(sollAm(SG.aussen)) + '" r="6" fill="#fff" stroke="var(--amber)" stroke-width="3"/></svg>'
      + '<div class="sg-leg"><span><i style="background:var(--amber)"></i>Soll (mit deinem Gefühl)</span><span><i style="background:var(--ink2)"></i>Startwert nach draußen</span>'
      + '<span><i style="background:#64a8ff"></i>zu kalt</span><span><i style="background:#30d158"></i>passt</span><span><i style="background:#ff9f0a"></i>zu warm</span><span><i style="background:rgba(255,69,58,.35)"></i>unter 21 °C nicht erlaubt (§ 36 BauV)</span></div>';
  };
  p.sgBlock = function () {
    const st = (k, d, fmt) => '<span class="stepper"><button data-act="sg-st" data-k="' + k + '" data-d="' + (-d) + '">−</button><b>' + fmt(SG[k]) + '</b><button data-act="sg-st" data-k="' + k + '" data-d="' + d + '">+</button></span>';
    const kopf = '<div class="zeile"><div><b>🌡 Solltemperatur</b>' + NEU + '<div class="leise">für Container mit Fühler; ohne Fühler regelt der Heizkörperthermostat</div></div>'
      + '<div class="seg klein"><button data-act="sg-art" data-v="fest" class="' + (SG.gleitend ? '' : 'on') + '">fest</button><button data-act="sg-art" data-v="gleitend" class="' + (SG.gleitend ? 'on' : '') + '">gleitend</button></div></div>';
    if (!SG.gleitend) return kopf + '<div class="zeile unter"><span>Soll</span>' + this.stepper('soll', .5, v => de(v, 1) + ' °C') + '</div>';
    const s0 = start(SG.aussen), g = gelernt(SG.aussen), heute = sollAm(SG.aussen), n = SG.rueck.filter(([x]) => Math.abs(x - SG.aussen) <= 5).length;
    return kopf
      + '<div class="sg-heute"><span>Grundwert – Mindestwert für Aufenthaltsräume (§ 36 BauV)</span><b>' + de(SG.min, 1) + ' °C</b>'
      + '<span>kalte Tage: Außenmittel der letzten ' + SG.tage + ' Tage ' + de(SG.aussen, 1) + ' °C' + BSP + '</span><b>+' + de(s0 - SG.min, 1) + ' °C</b>'
      + '<span>dein Gefühl: ' + n + ' Rückmeldungen bei ähnlichem Wetter (je 0,15 °C)</span><b>' + (g >= 0 ? '+' : '−') + de(Math.abs(g), 1) + ' °C</b>'
      + '<span class="summe">Soll heute</span><b class="summe">' + de(r1(heute), 1) + ' °C</b></div>'
      + this.sgKurve()
      + '<div class="zeile unter"><div><span>mindestens</span><div class="leise">nie unter 21 °C (Aufenthaltsraum)</div></div>' + st('min', .5, v => de(v, 1) + ' °C') + '</div>'
      + '<div class="zeile unter"><span>höchstens</span>' + st('max', .5, v => de(v, 1) + ' °C') + '</div>'
      + '<div class="zeile unter"><div><span>wärmer je Grad kälter draußen</span><div class="leise">unter ' + SG.bezug + ' °C Außenmittel</div></div>' + st('je', .05, v => '+' + de(v, 2) + ' °C') + '</div>'
      + '<div class="zeile unter"><div><span>Außenmittel über</span><div class="leise">wie EN 16798-1: jüngere Tage zählen mehr</div></div>' + st('tage', 1, v => v + ' Tage') + '</div>'
      + '<div class="zeile unter"><div><span>dein Gefühl</span><div class="leise">aus „zu kalt / passt / zu warm“ im Container – verschiebt das Soll bei ähnlichem Wetter, höchstens ±1,5 °C</div></div><button class="rv-link" data-act="sg-weg">vergessen</button></div>'
      + '<div class="leise">Ein eigenes Soll im Container gilt als Verschiebung (z. B. „+0,5 °C“) gegenüber dem gleitenden Soll.</div>';
  };
  p.regelnInhalt = function (lernend, C) {
    const h = alt.regeln.call(this, lernend, C), re = /<div class="zeile"><div><b>🌡 Solltemperatur<\\/b>[\\s\\S]*?<\\/span><\\/div>/;
    return re.test(h) ? h.replace(re, this.sgBlock()) : h;
  };
  p.cRad = function (b) {
    if (!this.sollAktiv(b)) return alt.rad.call(this, b);
    const v = SG.versch[b.id] || 0, gl = r1(sollAm(SG.aussen));
    const h = alt.rad.call(this, SG.gleitend && b.soll === undefined ? { ...b, soll: r1(gl + v) } : b);   // Rad zeigt das gleitende Soll (+ Verschiebung)
    const knopf = (v, t) => '<button data-act="sg-gefuehl" data-v="' + v + '" class="' + (SG.letzte === v ? 'on' : '') + '">' + t + '</button>';
    return h + '<div class="sg-box"><div class="sg-gefuehl">' + knopf(-1, '🥶 zu kalt') + knopf(0, '👍 passt') + knopf(1, '🥵 zu warm') + '</div>'
      + (SG.gleitend && v ? '<div class="sg-versch"><span>gleitend ' + de(gl, 1) + ' °C <b>' + (v > 0 ? '+' : '−') + de(Math.abs(v), 1) + '</b> · bis morgen früh</span><button class="glas-panel chip" data-act="sg-zurueck" data-id="' + b.id + '">↺ gleitend</button></div>' : '')
      + '<div class="sg-gefuehl-t">' + (SG.gleitend ? (v ? '+ / − lernt mit wie „zu kalt“ / „zu warm“' : 'Soll gleitend ' + de(gl, 1) + ' °C – dein Gefühl hilft beim Lernen') + NEU : 'hilft beim gleitenden Soll') + '</div></div>';
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    if (a === 'c-soll' && SG.gleitend && this.b && this.b.soll === undefined) {   // + / − verschiebt das gleitende Soll bis morgen früh und lernt mit
      const d = +el.dataset.d, id = this.b.id; SG.versch[id] = r1((SG.versch[id] || 0) + d); if (!SG.versch[id]) delete SG.versch[id];
      SG.rueck.push([SG.aussen, d > 0 ? -1 : 1]);
      this.toast('Soll heute ' + de(r1(sollAm(SG.aussen) + (SG.versch[id] || 0)), 1) + ' °C – ab morgen früh wieder gleitend · als „' + (d > 0 ? 'zu kalt' : 'zu warm') + '“ gemerkt');
      return this.render(); }
    if (a === 'sg-zurueck') { delete SG.versch[el.dataset.id]; this.toast('Zurück auf gleitend: ' + de(r1(sollAm(SG.aussen)), 1) + ' °C'); return this.render(); }
    if (a === 'sg-art') { SG.gleitend = el.dataset.v === 'gleitend'; return this.render(); }
    if (a === 'sg-st') { const k = el.dataset.k, d = +el.dataset.d, G = { min: [21, 23], max: [21, 26], je: [0, 0.3], tage: [1, 7] }[k];
      SG[k] = Math.round(Math.max(G[0], Math.min(G[1], SG[k] + d)) * 100) / 100; if (SG.max < SG.min) SG.max = SG.min; return this.render(); }
    if (a === 'sg-weg') { SG.rueck = []; this.toast('Gelerntes Gefühl vergessen – es gilt der Startwert nach draußen'); return this.render(); }
    if (a === 'sg-gefuehl') { const v = +el.dataset.v, vorher = sollAm(SG.aussen); SG.letzte = v; SG.rueck.push([SG.aussen, v]); const neu = sollAm(SG.aussen);
      this.toast(v === 0 ? 'Gemerkt: passt bei ' + de(SG.aussen, 0) + ' °C draußen' : 'Gemerkt: bei ' + de(SG.aussen, 0) + ' °C draußen ' + (v < 0 ? 'zu kalt' : 'zu warm') + ' – Soll ' + de(r1(vorher), 1) + ' → ' + de(r1(neu), 1) + ' °C');
      return this.render(); }
    return alt.klick.call(this, ev);
  };
})();
`;

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Soll gleitend</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>Soll gleitend nach draußen und nach deinem Gefühl · Vorschlag auf Seite $1</b>');
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
for (const p of P) { p.s.view = 'heizung'; p.s.sheet = { art: 'hz', k: 'regeln' }; p.render(true); }`);
fs.writeFileSync(path.join(repo, 'mockups', 'soll-gleitend.html'), html);
console.log(`mockups/soll-gleitend.html gebaut (${Math.round(html.length / 1024)} KB)`);
