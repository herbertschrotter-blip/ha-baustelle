/* =========================================================================================
   Baustelle – eigene Seite in Home Assistant nach dem abgenommenen Entwurf (mockups/baustelle.html, v4).
   Daten: WebSocket „baustelle/struktur“ (Aufbau), hass.states (Zustände), history/recorder (Verlauf).
   Schalten und Einstellen nur über die normalen HA-Dienste der Entitäten der Integration.
   ========================================================================================= */

/* Aus dem Entwurf übernommen: Symbole (Animationen), Diagramme (Säulen, Linien, Zeitleiste). */
/* ---------- Animierte Symbole ---------- */
function icon(d, st) {
  const run = st.on && !st.off && st.p > 0 ? 'run' : '', al = st.alarm ? 'alarm' : '';
  const hot = run ? '#ff7043' : '#9e9e9e';
  const waves = `<g stroke="#ff8a50" stroke-width="2" fill="none" stroke-linecap="round">
      <path class="wave" d="M16 14 q3 -4 0 -8"/><path class="wave d2" d="M26 14 q3 -4 0 -8"/><path class="wave d3" d="M36 14 q3 -4 0 -8"/></g>`;
  if (d.role === 'heat' && d.typ === 'oel') return `<svg class="a ${run} ${al}" viewBox="0 0 52 52">${waves}
      <g class="glow">${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${8 + i * 6.3}" y="17" width="5" height="26" rx="2.5" fill="${hot}"/>`).join('')}</g>
      <rect x="9" y="42" width="34" height="3" rx="1.5" fill="#757575"/><circle cx="12" cy="48" r="2" fill="#757575"/><circle cx="40" cy="48" r="2" fill="#757575"/></svg>`;
  if (d.role === 'heat') return `<svg class="a ${run} ${al}" viewBox="0 0 52 52">${waves}
      <rect x="7" y="17" width="38" height="26" rx="4" fill="none" stroke="#9e9e9e" stroke-width="2"/>
      <g class="glow" stroke="${hot}" stroke-width="2">${[0, 1, 2, 3, 4, 5, 6].map(i => `<line x1="${12 + i * 4.6}" y1="20" x2="${12 + i * 4.6}" y2="25"/>`).join('')}</g>
      <circle cx="39" cy="37" r="2.3" fill="${run ? '#ff7043' : '#bdbdbd'}"/><line x1="11" y1="45" x2="11" y2="49" stroke="#757575" stroke-width="2"/><line x1="41" y1="45" x2="41" y2="49" stroke="#757575" stroke-width="2"/></svg>`;
  if (d.role === 'dry') return `<svg class="a ${run} ${al}" viewBox="0 0 52 52">
      <rect x="6" y="8" width="40" height="38" rx="6" fill="none" stroke="#9e9e9e" stroke-width="2"/>
      <circle cx="26" cy="27" r="13" fill="none" stroke="#bdbdbd" stroke-width="1.5"/>
      <g class="spin"><path d="M26 27 L26 15 A6 6 0 0 1 32 21 Z M26 27 L38 27 A6 6 0 0 1 32 33 Z M26 27 L26 39 A6 6 0 0 1 20 33 Z M26 27 L14 27 A6 6 0 0 1 20 21 Z" fill="${run ? '#03a9f4' : '#9e9e9e'}"/></g></svg>`;
  if (d.role === 'pump') return `<svg class="a ${run} ${al}" viewBox="0 0 52 52">
      <path d="M4 44 H14" stroke="#03a9f4" stroke-width="4" class="flow" stroke-linecap="round"/>
      <circle cx="22" cy="30" r="12" fill="none" stroke="${st.alarm ? '#db4437' : '#78909c'}" stroke-width="2.5" class="blink"/>
      <g class="spin"><path d="M22 30 l0 -9 M22 30 l8 4 M22 30 l-8 4" stroke="${run ? '#03a9f4' : '#9e9e9e'}" stroke-width="3" stroke-linecap="round"/></g>
      <path d="M34 30 H40 V8 H48" fill="none" stroke="#78909c" stroke-width="4"/>
      <path d="M34 30 H40 V8 H48" fill="none" stroke="#4fc3f7" stroke-width="2" class="flow"/>
      <path d="M2 48 q6 -3 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#4fc3f7" stroke-width="2" opacity=".6"/></svg>`;
  return `<svg class="a ${run} ${al}" viewBox="0 0 52 52"><rect x="12" y="10" width="28" height="34" rx="6" fill="none" stroke="#9e9e9e" stroke-width="2"/>
      <circle cx="21" cy="25" r="2" fill="#9e9e9e"/><circle cx="31" cy="25" r="2" fill="#9e9e9e"/><circle class="glow" cx="26" cy="37" r="2.5" fill="${run ? '#43a047' : '#bdbdbd'}"/></svg>`;
}

const CX = {};                                   // Fadenkreuz-Daten je Diagramm
const hash = str => { let h = 7; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 100003; return h; };
const rnd = (str) => (hash(str) % 1000) / 1000;
const niceMax = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; };
const sc = i => `var(--s${(i % 6) + 1})`;
const legend = (items, kind = 'rect') => `<div class="lg">${items.map(([n, c, extra]) => `<span><i class="${kind}${extra ? ' ' + extra : ''}" style="--c:${c}"></i>${esc(n)}</span>`).join('')}</div>`;
const rtop = (x, y, w, h, r) => { r = Math.min(r, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

/* Säulen, gestapelt oder gruppiert */
function colChart({ id, W, H = 190, labels, series, stack, unit, dec = 1 }) {
  const L = 40, R = 6, T = 10, Bm = 24, pw = W - L - R, ph = H - T - Bm, n = labels.length;
  const max = niceMax(Math.max(...labels.map((_, i) => stack ? series.reduce((s, q) => s + (q.values[i] || 0), 0) : Math.max(...series.map(q => q.values[i] || 0))), 0.1));
  const y = v => T + ph - v / max * ph, band = pw / n;
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = max * k / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="${k ? 'grid' : 'base'}"/><text x="${L - 6}" y="${y(v) + 3}" class="yt">${de(v, v < 10 && max < 10 ? 1 : 0)}</text>`; }
  const step = Math.ceil(n / (W < 400 ? 6 : 12));
  labels.forEach((l, i) => { if (i % step === 0) g += `<text x="${L + band * i + band / 2}" y="${H - 8}" class="xt">${esc(l)}</text>`; });
  let bars = '';
  labels.forEach((l, i) => {
    const cx = L + band * i + band / 2;
    if (stack) {
      const bw = Math.min(24, band * .62); let acc = 0; const vals = series.map(q => q.values[i] || 0); const top = vals.map((v, k) => v > 0 ? k : -1).filter(k => k >= 0).pop();
      series.forEach((q, k) => { const v = vals[k]; if (v <= 0) return; const y0 = y(acc + v), hh = Math.max(0, y(acc) - y0 - (k ? 2 : 0)); acc += v;
        bars += `<path d="${k === top ? rtop(cx - bw / 2, y0, bw, hh, 4) : `M${cx - bw / 2},${y0}h${bw}v${hh}h${-bw}Z`}" fill="${q.color}" class="mk" data-tip="${de(v, dec)} ${unit}|${esc(q.name)} · ${esc(l)}"/>`; });
    } else {
      const k = series.length, bw = Math.min(24, (band * .8 - (k - 1) * 2) / k), x0 = cx - (k * bw + (k - 1) * 2) / 2;
      series.forEach((q, j) => { const v = q.values[i] || 0; if (v <= 0) return; bars += `<path d="${rtop(x0 + j * (bw + 2), y(v), bw, y(0) - y(v), 4)}" fill="${q.color}" class="mk" data-tip="${de(v, dec)} ${unit}|${esc(q.name)} · ${esc(l)}"/>`; });
    }
  });
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unit)}">${g}${bars}<text x="${L}" y="${T - 1}" class="un">${esc(unit)}</text></svg>`;
}

/* Linien, eine Achse, Fadenkreuz */
function lineChart({ id, W, H = 190, labels, series, unit, ref, dec = 1, area }) {
  const L = 40, R = 10, T = 12, Bm = 24, pw = W - L - R, ph = H - T - Bm, n = labels.length;
  const all = series.flatMap(q => q.values).concat(ref ? [ref.v] : []);
  let lo = Math.min(...all), hi = Math.max(...all); if (area) lo = 0;
  const span = niceMax((hi - lo) || 1) , stp = span / 4; lo = Math.floor(lo / stp) * stp; hi = lo + stp * 4; while (hi < Math.max(...all)) hi += stp;
  const x = i => L + (n === 1 ? pw / 2 : pw * i / (n - 1)), y = v => T + ph - (v - lo) / (hi - lo) * ph;
  let g = '';
  const tk = Math.round((hi - lo) / stp);
  for (let k = 0; k <= tk; k++) { const v = lo + stp * k; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="${k ? 'grid' : 'base'}"/><text x="${L - 6}" y="${y(v) + 3}" class="yt">${de(v, stp < 1 ? 1 : 0)}</text>`; }
  const step = Math.ceil(n / (W < 400 ? 5 : 10));
  labels.forEach((l, i) => { if (i % step === 0) g += `<text x="${x(i)}" y="${H - 8}" class="xt">${esc(l)}</text>`; });
  if (ref) g += `<line x1="${L}" x2="${W - R}" y1="${y(ref.v)}" y2="${y(ref.v)}" class="refl"/><text x="${W - R}" y="${y(ref.v) - 4}" class="reft">${esc(ref.label)}</text>`;
  let ls = '';
  series.forEach(q => {
    const pts = q.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    if (area) ls += `<polygon points="${x(0)},${y(lo)} ${pts} ${x(n - 1)},${y(lo)}" fill="${q.color}" opacity=".1"/>`;
    ls += `<polyline points="${pts}" fill="none" stroke="${q.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${q.dash ? 'stroke-dasharray="4 4"' : ''}/>`;
    const li = q.last != null ? q.last : n - 1;
    ls += `<circle cx="${x(li)}" cy="${y(q.values[li])}" r="4" fill="${q.color}" class="ring"/>`;
  });
  CX[id] = { L, pw, n, W, labels, series: series.map(q => ({ name: q.name, color: q.color, values: q.values })), unit, dec };
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" data-cxid="${id}">${g}${ls}<line id="${id}-x" x1="0" x2="0" y1="${T}" y2="${T + ph}" class="cross" style="display:none"/>
    <rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent" data-cx="${id}"/><text x="${L}" y="${T - 2}" class="un">${esc(unit)}</text></svg>`;
}

/* Zeitleiste (ein/aus je Gerät) über 24 h */
function timeline({ id, W, rows, now }) {
  const LW = W < 400 ? 96 : 170, R = 6, T = 6, RH = 22, H = T + rows.length * RH + 22, pw = W - LW - R;
  const x = m => LW + pw * m / 1440;
  let g = `<defs><pattern id="${id}-h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="currentColor"/></pattern></defs>`;
  [0, 360, 720, 1080, 1440].forEach(m => g += `<line x1="${x(m)}" x2="${x(m)}" y1="${T}" y2="${H - 20}" class="grid"/><text x="${x(m)}" y="${H - 6}" class="xt">${m2t(m).slice(0, 2)}</text>`);
  rows.forEach((r, i) => {
    const yy = T + i * RH;
    g += `<text x="${LW - 8}" y="${yy + 15}" class="rl">${esc(r.name.length > (W < 400 ? 13 : 24) ? r.name.slice(0, W < 400 ? 12 : 23) + '…' : r.name)}</text><rect x="${LW}" y="${yy + 5}" width="${pw}" height="12" rx="3" class="lane"/>`;
    r.segs.forEach(([a, b2, k]) => {
      const w = Math.max(1.5, x(b2) - x(a)), tip = `${m2t(a)}–${m2t(b2)} · ${de((b2 - a) / 60)} h|${esc(r.name)} · ${k === 'on' ? r.onLabel : k === 'extra' ? 'Kleidung trocknen' : 'offline'}`;
      if (k === 'off') g += `<rect x="${x(a)}" y="${yy + 5}" width="${w}" height="12" rx="3" fill="url(#${id}-h)" style="color:var(--crit)" class="mk" data-tip="${tip}"/>`;
      else if (k === 'extra') g += `<g class="mk" data-tip="${tip}" style="color:${r.color}"><rect x="${x(a)}" y="${yy + 5}" width="${w}" height="12" rx="3" fill="url(#${id}-h)"/><rect x="${x(a)}" y="${yy + 5}" width="${w}" height="12" rx="3" fill="none" stroke="${r.color}" stroke-width="1"/></g>`;
      else g += `<rect x="${x(a)}" y="${yy + 5}" width="${w}" height="12" rx="3" fill="${r.color}" class="mk" data-tip="${tip}"/>`;
    });
  });
  if (now != null) g += `<line x1="${x(now)}" x2="${x(now)}" y1="${T}" y2="${H - 20}" class="now"/><text x="${x(now)}" y="${H - 6}" class="xt now-t">jetzt</text>`;
  return `<svg class="ch" viewBox="0 0 ${W} ${H}">${g}</svg>`;
}


const CSS = `:host { display: flex; flex-direction: column; height: 100%; min-height: 100vh; background: var(--primary-background-color);
  color: var(--primary-text-color); font-family: var(--ha-font-family-body, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif); font-size: 14px;
  --state-heat: var(--state-climate-heat-color, #ff8100); --ha-card-border: var(--ha-card-border-width, 1px) solid var(--divider-color, rgba(0,0,0,.12));
  --tag-bg: rgba(127,127,127,.15); }
* { box-sizing: border-box; }
.hdr { position: sticky; top: 0; z-index: 3; }
.bname { font-size: 15px; opacity: .9; }
.bsel { font: inherit; font-size: 15px; background: transparent; color: inherit; border: 1px solid rgba(255,255,255,.4); border-radius: 6px; padding: 3px 6px; }
.bsel option { color: #212121; }
.inhalt { flex: 1; overflow: auto; container-type: inline-size; }
.view { max-width: 1400px; margin: 0 auto; }
.klein { font-size: 12px; }
.filter { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rot { color: var(--error-color) !important; }
.warn { color: var(--error-color); font-weight: 500; }
.chip.gruen { background: rgba(67,160,71,.15); color: var(--success-color); }
.tgl.dis { opacity: .4; pointer-events: none; }
.tile[data-tab] { cursor: pointer; }
/* Diagramm-Palette: validiert (hell auf #fff, dunkel auf #1c1c1c) – Kategorie-Reihenfolge fest */
:host { --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #e87ba4; --s6: #008300;
  --crit: #d03b3b; --muted: #898781; --gridc: #e1e0d9; --axisc: #c3c2b7; --ink2: #52514e; }
:host([dunkel]) { --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300;
  --gridc: #2c2c2a; --axisc: #383835; --ink2: #c3c2b7; }
/* Handy: Abschnitte nicht breiter als der Bildschirm, Tabellen scrollen in der Karte, Tabs kompakt */
.sec, .card { min-width: 0; }
.card { overflow-x: auto; }
.tabs.eng .tab { text-transform: none; font-size: 13px; padding: 10px 9px; letter-spacing: 0; }
@container (max-width: 700px) { table.t { font-size: 12px; } table.t td, table.t th { padding: 5px 3px; } }
* { box-sizing: border-box; }
.hdr { background: var(--app-header-background-color); color: var(--app-header-text-color); }
.hdr-top { display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 12px; font-size: 20px; }
.hdr-top .ico { width: 24px; text-align: center; opacity: .9; }
.hdr-top .t { flex: 1; }
.tabs { display: flex; overflow-x: auto; padding: 0 4px; }
.tab { padding: 10px 14px; font-size: 14px; text-transform: uppercase; letter-spacing: .03em; cursor: pointer; border-bottom: 2px solid transparent; opacity: .75; white-space: nowrap; }
.tab.on { border-bottom-color: currentColor; opacity: 1; }
.view { padding: 16px; }
.sections { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: start; }
.sec { display: flex; flex-direction: column; gap: 8px; }
.sec.span2 { grid-column: span 2; }
.sec.span3 { grid-column: 1 / -1; }
@container (max-width: 700px) {
  .sections { grid-template-columns: 1fr; }
.sec.span2, .sec.span3 { grid-column: auto; }
.view { padding: 8px; }
.grid2 { grid-template-columns: 1fr 1fr; }
.week .row { grid-template-columns: 34px 1fr 1fr 44px; }
.hide-phone { display: none !important; }
}
.heading { display: flex; align-items: baseline; gap: 8px; padding: 8px 4px 0; font-size: 16px; font-weight: 500; }
.heading .sub { margin-left: auto; font-size: 13px; color: var(--secondary-text-color); font-weight: 400; }
.card { position: relative; background: var(--card-background-color); border: var(--ha-card-border); border-radius: var(--ha-card-border-radius); padding: 12px; }
.card h3 { margin: 0 0 8px; font-size: 15px; font-weight: 500; }
.ctype { display: none; position: absolute; top: 4px; right: 6px; font: 10px/1.4 ui-monospace, monospace; background: var(--tag-bg); color: var(--secondary-text-color); padding: 0 5px; border-radius: 4px; }
.show-types .ctype { display: block; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tile { position: relative; display: flex; align-items: center; gap: 10px; background: var(--card-background-color); border: var(--ha-card-border); border-radius: var(--ha-card-border-radius); padding: 10px; min-height: 56px; }
.tile .ic { flex: 0 0 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 18px; background: rgba(127,127,127,.15); }
.tile.heat .ic { background: rgba(255,129,0,.2); color: var(--state-heat); }
.tile.ok .ic { background: rgba(67,160,71,.18); color: var(--success-color); }
.tile.bad .ic { background: rgba(219,68,55,.18); color: var(--error-color); }
.tile.info .ic { background: rgba(3,155,229,.18); color: var(--info-color); }
.tile .tx { flex: 1; min-width: 0; }
.tile .n { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile .s { color: var(--secondary-text-color); font-size: 12px; }
.tile .ctype { top: auto; bottom: 3px; }
.tgl { flex: 0 0 auto; width: 36px; height: 20px; border-radius: 10px; background: #9e9e9e; position: relative; cursor: pointer; }
.tgl::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .15s; }
.tgl.on { background: var(--primary-color); }
.tgl.on::after { left: 18px; }
.rows { display: flex; flex-direction: column; }
.r { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--divider-color); }
.r:first-child { border-top: 0; }
.r .ic { width: 24px; text-align: center; color: var(--secondary-text-color); }
.r .l { flex: 1; min-width: 0; }
.r .l small { display: block; color: var(--secondary-text-color); font-size: 12px; }
.r .v { color: var(--secondary-text-color); white-space: nowrap; }
.inp { border: 1px solid var(--divider-color); border-radius: 6px; padding: 4px 8px; background: transparent; color: var(--primary-text-color); font: inherit; width: 76px; text-align: center; }
.slider { width: 110px; accent-color: var(--primary-color); }
.big { font-size: 28px; font-weight: 400; }
.muted { color: var(--secondary-text-color); }
.warnc { border-left: 4px solid var(--warning-color); }
.errc { border-left: 4px solid var(--error-color); }
.pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 12px; background: rgba(255,129,0,.18); color: var(--state-heat); }
.pill.blue { background: rgba(3,155,229,.15); color: var(--info-color); }
.pill.grey { background: rgba(127,127,127,.15); color: var(--secondary-text-color); }
.week .row { display: grid; grid-template-columns: 40px 1fr 1fr 1fr 44px; gap: 8px; align-items: center; padding: 5px 0; border-top: 1px solid var(--divider-color); }
.week .row.h { border-top: 0; font-size: 12px; color: var(--secondary-text-color); }
.week .inp { width: 100%; }
.tl { position: relative; height: 10px; border-radius: 5px; background: rgba(127,127,127,.18); }
.tl i { position: absolute; top: 0; bottom: 0; border-radius: 5px; background: var(--state-heat); }
.tl i.ext { background: repeating-linear-gradient(45deg, var(--state-heat) 0 4px, transparent 4px 8px); }
.tl i.pre { background: repeating-linear-gradient(45deg, var(--info-color) 0 4px, transparent 4px 8px); }
.xlab { display: flex; gap: 4px; font-size: 10px; color: var(--secondary-text-color); }
.xlab span { flex: 1; text-align: center; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--secondary-text-color); margin-top: 6px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
.c1 { background: #03a9f4; } .c2 { background: #ff9800; } .c3 { background: #8e24aa; }
.hbar { height: 10px; border-radius: 5px; background: rgba(127,127,127,.18); overflow: hidden; }
.hbar i { display: block; height: 100%; }
svg.line { width: 100%; height: 140px; }
.tgl, [data-v], [data-goto] { user-select: none; }
.inp:disabled { opacity: .4; }
.tile .s i { font-style: normal; opacity: .8; }
.tgl, [data-act] { user-select: none; cursor: pointer; }
.inp:disabled, .dis { opacity: .45; pointer-events: none; }
.tile .s i { font-style: normal; opacity: .8; }
select.inp { width: auto; text-align: left; }
.inp.wide { width: 100%; text-align: left; }
.btn { border: 0; border-radius: 18px; padding: 6px 14px; font: inherit; font-weight: 500; cursor: pointer; background: var(--primary-color); color: #fff; }
.btn.flat { background: transparent; color: var(--primary-color); }
.btn.warn { background: var(--error-color); }
.btn.small { padding: 3px 10px; font-size: 12px; }
.chip { display: inline-block; font-size: 11px; padding: 1px 7px; border-radius: 9px; background: rgba(3,169,244,.15); color: var(--info-color); margin-right: 4px; }
.chip.grey { background: rgba(127,127,127,.15); color: var(--secondary-text-color); }
.chip.red { background: rgba(219,68,55,.15); color: var(--error-color); }
.form { background: rgba(3,169,244,.06); border: 1px dashed var(--primary-color); border-radius: 10px; padding: 10px; margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.form label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--secondary-text-color); }
.form .act { display: flex; gap: 8px; justify-content: flex-end; }
.bsel { display: flex; align-items: center; gap: 10px; }
.bsel select { font: inherit; font-size: 15px; font-weight: 500; border: 0; background: transparent; color: var(--primary-text-color); flex: 1; }
.info-card { background: rgba(3,169,244,.08); border: 1px solid rgba(3,169,244,.3); }
table.t { width: 100%; border-collapse: collapse; font-size: 13px; }
table.t th, table.t td { padding: 6px 4px; text-align: right; border-top: 1px solid var(--divider-color); white-space: nowrap; }
table.t th { color: var(--secondary-text-color); font-weight: 500; border-top: 0; }
table.t td:first-child, table.t th:first-child { text-align: left; }
.save { color: var(--success-color); font-weight: 600; }
.dev { display: flex; gap: 10px; align-items: center; background: var(--card-background-color); border: var(--ha-card-border); border-radius: var(--ha-card-border-radius); padding: 8px 10px; position: relative; }
.dev.bad { border-color: var(--error-color); }
.dev svg.a { flex: 0 0 52px; width: 52px; height: 52px; }
.dev .tx { flex: 1; min-width: 0; }
.dev .n { font-weight: 500; }
.dev .s { color: var(--secondary-text-color); font-size: 12px; }
.dev .ctype { top: auto; bottom: 3px; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes rise { 0% { transform: translateY(5px); opacity: 0; } 40% { opacity: .9; } 100% { transform: translateY(-7px); opacity: 0; } }
@keyframes flow { to { stroke-dashoffset: -12; } }
@keyframes glow { 50% { opacity: .65; } }
@keyframes blink { 50% { opacity: .2; } }
.run .spin { transform-box: fill-box; transform-origin: center; animation: spin .9s linear infinite; }
.run .spin.slow { animation-duration: 1.6s; }
.wave { opacity: 0; }
.run .wave { animation: rise 1.8s ease-in infinite; }
.run .wave.d2 { animation-delay: .6s; } .run .wave.d3 { animation-delay: 1.2s; }
.run .flow { stroke-dasharray: 3 3; animation: flow .5s linear infinite; }
.run .glow { animation: glow 2.2s ease-in-out infinite; }
.alarm .blink { animation: blink 1s steps(2) infinite; }
@media (prefers-reduced-motion: reduce) { .run *, .alarm * { animation: none !important; } .wave { opacity: .7; } }
:host([dunkel]) { --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300;
  --gridc: #2c2c2a; --axisc: #383835; --ink2: #c3c2b7; }
svg.ch { width: 100%; height: auto; display: block; overflow: visible; font-family: inherit; }
svg.ch .grid { stroke: var(--gridc); stroke-width: 1; }
svg.ch .base { stroke: var(--axisc); stroke-width: 1; }
svg.ch .yt { font-size: 10px; fill: var(--muted); text-anchor: end; font-variant-numeric: tabular-nums; }
svg.ch .xt { font-size: 10px; fill: var(--muted); text-anchor: middle; }
svg.ch .un { font-size: 10px; fill: var(--muted); }
svg.ch .rl { font-size: 11px; fill: var(--ink2); text-anchor: end; }
svg.ch .lane { fill: var(--gridc); opacity: .5; }
svg.ch .refl { stroke: var(--crit); stroke-width: 1; }
svg.ch .reft { font-size: 10px; fill: var(--ink2); text-anchor: end; }
svg.ch .now { stroke: var(--primary-text-color); stroke-width: 1.5; }
svg.ch .now-t { fill: var(--primary-text-color); font-weight: 600; }
svg.ch .cross { stroke: var(--muted); stroke-width: 1; pointer-events: none; }
svg.ch .ring { stroke: var(--card-background-color); stroke-width: 2; }
svg.ch .mk { cursor: default; transition: opacity .1s; }
svg.ch .mk:hover { opacity: .75; }
.lg { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--ink2); margin-top: 8px; }
.lg i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; background: var(--c); }
.lg i.line { height: 2px; width: 14px; border-radius: 1px; vertical-align: 3px; }
.lg i.dash { background: repeating-linear-gradient(90deg, var(--c) 0 4px, transparent 4px 7px); }
.lg i.hatch { background: repeating-linear-gradient(45deg, var(--c) 0 2px, transparent 2px 5px); border: 1px solid var(--c); }
.tip { position: fixed; z-index: 20; display: none; pointer-events: none; background: var(--card-background-color, #fff); color: var(--primary-text-color, #212121);
  border: 1px solid rgba(127,127,127,.3); border-radius: 8px; padding: 7px 10px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.18); max-width: 260px; }
.tip .tr { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.tip .tr i { width: 12px; height: 2px; border-radius: 1px; flex: 0 0 auto; }
.tip .tr span { color: var(--secondary-text-color, #727272); }
.stat { position: relative; background: var(--card-background-color); border: var(--ha-card-border); border-radius: var(--ha-card-border-radius); padding: 12px 14px; }
.stat .sl { font-size: 13px; color: var(--secondary-text-color); }
.stat .sv { font-size: 24px; font-weight: 600; margin: 2px 0; }
.stat .ss { font-size: 12px; color: var(--secondary-text-color); }`;

const TAGE = [['mo', 'Mo', 'Montag'], ['di', 'Di', 'Dienstag'], ['mi', 'Mi', 'Mittwoch'], ['do', 'Do', 'Donnerstag'],
  ['fr', 'Fr', 'Freitag'], ['sa', 'Sa', 'Samstag'], ['so', 'So', 'Sonntag']];
const MON = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const STATUS = { abgeschlossen: 'Abgeschlossen', nur_pumpen: 'Nur Pumpenüberwachung', automatik_aus: 'Automatik aus',
  heizgrenze: 'Heizgrenze – zu warm', urlaub: 'Urlaub', feiertag: 'Feiertag', heizt: 'Heizt', bereit: 'Bereit' };
const GRUND = { automatik_aus: 'Automatik aus', frostschutz: 'Frostschutz', hand: 'Handbetrieb', modus_aus: 'Modus aus',
  heizgrenze: 'Heizgrenze – zu warm', urlaub: 'Urlaub', feiertag: 'Feiertag', absenkung: 'Abgesenkt (Urlaub)',
  ausserhalb: 'außerhalb der Heizzeit', zeitplan: 'Zeitplan', kaelte_frueher: 'früher wegen Kälte',
  kleidung_trocknen: 'Kleidung trocknen', thermostat_heizt: 'Thermostat heizt', thermostat_erreicht: 'Solltemperatur erreicht' };
const PROBLEM = { offline: 'nicht erreichbar – Stromausfall oder Verbindung weg?', trockenlauf: 'läuft, zieht aber zu wenig – Trockenlauf?',
  dauerlauf: 'läuft ohne Pause – Schwimmer oder starker Zufluss?',
  keine_leistung: 'eingeschaltet, zieht aber keinen Strom – Heizkörper selbst an? Stecker, Sicherung?' };
const FEHLER = { keine_funktion: 'Mindestens eine Funktion einschalten.', geraete_vergeben: 'Einige Shellys gehören inzwischen einer anderen aktiven Baustelle.',
  name_vergeben: 'Diesen Namen gibt es schon.', schalter_vergeben: 'Dieser Shelly ist in dieser Baustelle schon zugeordnet.',
  schalter_andere_baustelle: 'Dieser Shelly gehört einer anderen aktiven Baustelle – die zuerst abschließen.', kein_bereich: 'Zuerst einen Container oder Bereich anlegen.',
  rolle_passt_nicht: 'Pumpen gehören in einen Pumpenschacht, alles andere in einen Container.', already_configured: 'Diese Baustelle gibt es schon.' };
const OPTION = { zeitplan: 'Zeitplan', thermostat: 'Thermostat', hand: 'Hand', aus: 'Aus', frost: 'Nur Frostschutz',
  absenken: 'Absenken', jetzt: 'aktueller Temperatur', tageshoechst: 'Tageshöchstwert (Vorhersage)' };
const ROLLE = { heizkoerper: 'Heizkörper', bautrockner: 'Bautrockner', pumpe: 'Pumpe', steckdose: 'Steckdose' };
const TYP = { oelradiator: 'Ölradiator', konvektor: 'Konvektor' };
const HEIZ = ['heizkoerper', 'bautrockner'];
const INTEGRATION = '/config/integrations/integration/baustelle';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const de = (x, d = 1) => (x === null || x === undefined || Number.isNaN(Number(x))) ? '–'
  : Number(x).toLocaleString('de-AT', { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = x => (x === null || x === undefined) ? '–' : de(x, 2) + ' €';
const m2t = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const t2m = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const tagIndex = d => (d.getDay() + 6) % 7;
const isoTag = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mitternacht = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

class BaustellePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.ui = { bid: null, tab: 'uebersicht', sub: 'baustellen', per: '7', scope: 'all', hsel: 'all', form: null, drawer: false };
    this.cache = {};
    this.baustellen = null;
    try { const u = JSON.parse(localStorage.getItem('baustelle-panel-ui') || '{}'); Object.assign(this.ui, { bid: u.bid || null, tab: u.tab || 'uebersicht' }); } catch (e) { /* ohne Speicher */ }
  }

  set hass(h) {
    const erst = !this._hass;
    this._hass = h;
    if (erst) { this._laden(); this._timer = setInterval(() => this._laden(), 60000); }
    this.toggleAttribute('dunkel', !!(h.themes && h.themes.darkMode));
    this._vorhersageAbo();
    this._planen();
  }

  _vorhersageAbo() {
    const b = this.baustellen && this.B();
    const eid = b && b.baustelle.optionen.wetter;
    if (!eid || this._aboFuer === eid || !this._hass.connection) return;
    this._aboEnde();
    this._aboFuer = eid;
    this.vorhersage = null;
    this._abo = this._hass.connection.subscribeMessage(m => { this.vorhersage = m.forecast; this._planen(); },
      { type: 'weather/subscribe_forecast', entity_id: eid, forecast_type: 'daily' });
    this._abo.catch(() => { this._aboFuer = null; });
  }

  _aboEnde() {
    if (this._abo) this._abo.then(ende => ende()).catch(() => {});
    this._abo = null;
    this._aboFuer = null;
  }
  get hass() { return this._hass; }
  set narrow(n) { this._narrow = n; this._planen(); }
  set panel(p) { this._panel = p; }

  connectedCallback() {
    if (this._verbunden) return;
    this._verbunden = true;
    const sr = this.shadowRoot;
    sr.addEventListener('click', e => this._klick(e));
    sr.addEventListener('change', e => this._aenderung(e));
    sr.addEventListener('focusout', () => { if (this._wartet) { this._wartet = false; this._planen(); } });
    sr.addEventListener('pointermove', e => this._tooltip(e));
    sr.addEventListener('pointerleave', () => { const t = sr.querySelector('.tip'); if (t) t.style.display = 'none'; });
  }
  disconnectedCallback() { clearInterval(this._timer); this._timer = null; this._aboEnde(); }

  /* ---------------------------------------------------------------- Daten */
  async _laden() {
    try {
      this.baustellen = await this._hass.callWS({ type: 'baustelle/struktur' });
      this.fehler = null;
      this._vorhersageAbo();
    } catch (e) { this.fehler = e.message || String(e); }
    this._planen();
  }

  _holen(schluessel, holer, maxAlterMs = 300000) {
    const c = this.cache[schluessel];
    const jetzt = Date.now();
    if (!c || (!c.laeuft && jetzt - c.zeit > maxAlterMs)) {
      this.cache[schluessel] = { ...(c || {}), laeuft: true, zeit: jetzt };
      holer().then(daten => { this.cache[schluessel] = { daten, zeit: Date.now(), laeuft: false }; this._planen(); })
        .catch(err => { this.cache[schluessel] = { daten: null, fehler: String(err.message || err), zeit: Date.now(), laeuft: false }; this._planen(); });
    }
    return c ? c.daten : undefined;
  }

  _historie(ids, start) {
    ids = ids.filter(Boolean);
    if (!ids.length) return {};
    return this._holen(`h:${ids.join(',')}:${start.toISOString().slice(0, 13)}`, () => this._hass.callWS({
      type: 'history/history_during_period', start_time: start.toISOString(), entity_ids: ids,
      minimal_response: true, no_attributes: true, significant_changes_only: false,
    }));
  }

  _statistik(ids, periode, start, arten = ['change']) {
    ids = ids.filter(Boolean);
    if (!ids.length) return {};
    return this._holen(`s:${ids.join(',')}:${periode}:${start.toISOString().slice(0, 13)}:${arten}`, () => this._hass.callWS({
      type: 'recorder/statistics_during_period', start_time: start.toISOString(), statistic_ids: ids, period: periode,
      types: arten, units: {},
    }));
  }

  _kalender(eid, tage = 400) {
    if (!eid) return [];
    const start = mitternacht(), ende = new Date(start.getTime() + tage * 86400000);
    return this._holen(`k:${eid}`, () => this._hass.callApi('GET',
      `calendars/${eid}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(ende.toISOString())}`), 120000);
  }

  /* ---------------------------------------------------------------- Zugriff */
  B() {
    const alle = (this.baustellen || []).filter(b => b.baustelle.geladen);
    const aktiv = alle.filter(b => b.baustelle.optionen.status !== 'abgeschlossen');
    return aktiv.find(b => b.baustelle.entry_id === this.ui.bid) || aktiv[0] || alle[0] || null;
  }
  E(b, key, besitzer) { return b.entitaeten[`${besitzer || b.baustelle.entry_id}_${key}`]; }
  S(eid) { return eid ? this._hass.states[eid] : undefined; }
  V(eid) { const s = this.S(eid); return s ? s.state : undefined; }
  N(eid) { const v = parseFloat(this.V(eid)); return Number.isNaN(v) ? null : v; }
  an(eid) { return this.V(eid) === 'on'; }
  weg(eid) { const v = this.V(eid); return v === undefined || v === 'unavailable' || v === 'unknown'; }

  /* ---------------------------------------------------------------- Rendern */
  _planen() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this._rendern(); });
  }

  _rendern() {
    if (!this._hass) return;
    const aktiv = this.shadowRoot.activeElement;
    if (aktiv && ['INPUT', 'SELECT', 'TEXTAREA'].includes(aktiv.tagName)) { this._wartet = true; return; }
    const scroll = this.shadowRoot.querySelector('.inhalt');
    const y = scroll ? scroll.scrollTop : 0;
    this.shadowRoot.innerHTML = `<style>${CSS}</style>${this._seite()}<div class="tip"></div>`;
    const neu = this.shadowRoot.querySelector('.inhalt');
    if (neu) neu.scrollTop = y;
    try { localStorage.setItem('baustelle-panel-ui', JSON.stringify({ bid: this.ui.bid, tab: this.ui.tab })); } catch (e) { /* egal */ }
  }

  _seite() {
    const b = this.B();
    const TABS = [['uebersicht', 'Übersicht'], ['heizung', 'Heizung'], ['pumpen', 'Pumpen'], ['auswertung', 'Auswertung'],
      ['verlauf', 'Verlauf'], ['einstellungen', 'Einstellungen']]
      .filter(([k]) => !b || (k !== 'heizung' || b.baustelle.optionen.heizung) && (k !== 'pumpen' || b.baustelle.optionen.pumpen));
    if (b && !TABS.some(([k]) => k === this.ui.tab)) this.ui.tab = 'uebersicht';
    const kopf = `<div class="hdr"><div class="hdr-top">
        ${this._narrow ? '<span class="ico" data-act="menu">☰</span>' : ''}<span class="t">Baustelle</span>${b ? this._auswahl(b) : ''}</div>
      <div class="tabs ${this._narrow ? 'eng' : ''}">${TABS.map(([k, l]) => `<div class="tab ${this.ui.tab === k ? 'on' : ''}" data-tab="${k}">${this._narrow && k === 'einstellungen' ? '⚙' : l}</div>`).join('')}</div></div>`;
    let inhalt;
    if (this.fehler) inhalt = `<div class="card errc">Die Daten der Integration sind nicht erreichbar: ${esc(this.fehler)}</div>`;
    else if (!this.baustellen) inhalt = '<div class="card">Lädt …</div>';
    else if (!b) inhalt = this._leer();
    else inhalt = ({ uebersicht: () => this.vUebersicht(b), heizung: () => this.vHeizung(b), pumpen: () => this.vPumpen(b),
      auswertung: () => this.vAuswertung(b), verlauf: () => this.vVerlauf(), einstellungen: () => this.vEinstellungen(b) })[this.ui.tab]();
    return `${kopf}<div class="inhalt"><div class="view">${inhalt}</div></div>`;
  }

  _auswahl(b) {
    const aktive = this.baustellen.filter(x => x.baustelle.geladen && x.baustelle.optionen.status !== 'abgeschlossen');
    if (aktive.length < 2) return `<span class="bname">${esc(b.baustelle.titel)}</span>`;
    return `<select class="bsel" data-ui="bid">${aktive.map(x => `<option value="${x.baustelle.entry_id}" ${x === b ? 'selected' : ''}>${esc(x.baustelle.titel)}</option>`).join('')}</select>`;
  }

  _leer() {
    return `<div class="sections"><div class="sec span3"><div class="card info-card"><h3>Noch keine Baustelle</h3>
      Lege eine Baustelle an: <span class="btn" data-href="/config/integrations/dashboard/add?domain=baustelle">+ Baustelle anlegen</span></div></div></div>`;
  }

  /* ---------------------------------------------------------------- Bausteine */
  tgl(eid) { return eid ? `<span class="tgl ${this.an(eid) ? 'on' : ''} ${this.weg(eid) ? 'dis' : ''}" data-toggle="${eid}"></span>` : ''; }
  zahl(eid, einheit) {
    const s = this.S(eid); if (!s) return '<span class="v">–</span>';
    const a = s.attributes;
    return `<input class="inp" type="number" data-num="${eid}" value="${esc(s.state)}" min="${a.min ?? ''}" max="${a.max ?? ''}" step="${a.step ?? 'any'}"><span class="v">${esc(einheit ?? a.unit_of_measurement ?? '')}</span>`;
  }
  auswahl(eid) {
    const s = this.S(eid); if (!s) return '';
    return `<select class="inp" data-select="${eid}">${(s.attributes.options || []).map(o => `<option value="${esc(o)}" ${o === s.state ? 'selected' : ''}>${esc(OPTION[o] || o)}</option>`).join('')}</select>`;
  }
  zeile(ic, label, sub, ctl) { return `<div class="r"><span class="ic">${ic}</span><div class="l">${label}${sub ? `<small>${sub}</small>` : ''}</div>${ctl || ''}</div>`; }
  link(text, pfad, klasse = 'btn flat small') { return `<span class="${klasse}" data-href="${pfad}">${text}</span>`; }

  geraetKarte(b, g, extra = '') {
    const zustand = this.S(g.schalter);
    const weg = this.weg(g.schalter);
    const p = this.N(g.leistung);
    const an = this.an(g.schalter);
    const laeuft = g.rolle === 'pumpe' ? this.an(this.E(b, 'pumpe_laeuft', g.id)) : an && (p === null || p > 5);
    const probleme = (this.S(this.E(b, 'problem', g.id))?.attributes.probleme) || [];
    const st = { on: laeuft, off: weg, p: laeuft ? (p ?? 1) : 0, alarm: probleme.length > 0 };
    const d = { role: { heizkoerper: 'heat', bautrockner: 'dry', pumpe: 'pump', steckdose: 'plug' }[g.rolle], typ: g.typ === 'oelradiator' ? 'oel' : 'konv' };
    const text = weg ? 'nicht erreichbar'
      : `${g.rolle === 'pumpe' ? (laeuft ? 'läuft' : 'steht') : (an ? 'Ein' : 'Aus')}${p !== null ? ` · ${de(p, 0)} W` : ''}`
        + (probleme.length ? ` · <b class="warn">${esc(PROBLEM[probleme[0]] || probleme[0])}</b>` : '');
    const schalter = g.rolle === 'pumpe' || weg || !zustand ? '' : this.tgl(g.schalter);
    return `<div class="dev ${st.alarm ? 'bad' : ''}">${icon(d, st)}<div class="tx"><div class="n">${esc(g.name)}</div><div class="s">${text}</div>${extra}</div>${schalter}</div>`;
  }

  heizgeraete(b) { return b.geraete.filter(g => HEIZ.includes(g.rolle)); }

  /* ---------------------------------------------------------------- Übersicht */
  vUebersicht(b) {
    const o = b.baustelle.optionen;
    const status = this.V(this.E(b, 'status'));
    const heiz = this.heizgeraete(b), heizAn = heiz.filter(g => this.an(g.schalter)).length;
    const pumpen = b.geraete.filter(g => g.rolle === 'pumpe'), pumpenLaufen = pumpen.filter(g => this.an(this.E(b, 'pumpe_laeuft', g.id))).length;
    const naechste = this.V(this.E(b, 'naechste_schaltzeit'));
    const wetter = this.S(o.wetter);
    const warnungen = [];
    if (this.V(this.E(b, 'erreichbar')) === 'off') warnungen.push(['errc', 'Baustelle nicht erreichbar', 'Kein Gerät antwortet – Stromausfall oder Internet weg?']);
    for (const g of b.geraete) {
      for (const p of (this.S(this.E(b, 'problem', g.id))?.attributes.probleme || [])) {
        warnungen.push([p === 'offline' || p === 'trockenlauf' ? 'errc' : 'warnc', `${this._bereichName(b, g.bereich)} · ${g.name}`, PROBLEM[p] || p]);
      }
    }
    const heute = this._statistik([this.E(b, 'energie'), this.E(b, 'kosten')], '5minute', mitternacht());
    const summe = eid => heute && heute[eid] ? heute[eid].reduce((s, x) => s + (x.change || 0), 0) : null;
    const schalter = b.geraete.filter(g => g.rolle !== 'steckdose').map(g => g.schalter);
    return `<div class="sections">
      <div class="sec">
        <div class="heading">Jetzt <span class="sub">${new Date().toLocaleString('de-AT', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
        ${wetter ? `<div class="card"><div style="display:flex;align-items:center;gap:12px"><div style="font-size:38px">${this._wetterSymbol(wetter.state)}</div>
          <div><div class="big">${de(wetter.attributes.temperature)} °C</div><div class="muted">${esc(this._hass.formatEntityState ? this._hass.formatEntityState(wetter) : wetter.state)}</div></div></div>
          ${this.vorhersage && this.vorhersage.length ? `<div class="grid3" style="margin-top:10px;text-align:center;font-size:12px">${this.vorhersage.slice(0, 3).map(v =>
            `<div>${new Date(v.datetime).toLocaleDateString('de-AT', { weekday: 'short' })}<br>${this._wetterSymbol(v.condition)} ${de(v.temperature, 0)}° / ${de(v.templow, 0)}°<br><span class="muted">${de(v.precipitation ?? 0)} mm</span></div>`).join('')}</div>` : ''}</div>`
          : `<div class="card info-card">Kein Wetter eingestellt. ${this.link('Wetter wählen', INTEGRATION)}</div>`}
        <div class="grid3">
          ${this._kachel('🌡', 'Außen', `${de(this.N(this.E(b, 'aussen')))} °C`)}
          ${this._kachel('💧', 'Regen', `${de(this.N(this.E(b, 'regen')))} mm`)}
          ${this._kachel('🌙', 'Früh', `${de(this.N(this.E(b, 'frueh_prognose')))} °C`)}
        </div>
        ${o.heizung ? `<div class="tile ${status === 'heizt' ? 'heat' : ''}" data-tab="heizung"><span class="ic">♨</span><div class="tx"><div class="n">Heizung · ${esc(STATUS[status] || status || '–')}</div>
          <div class="s">${heizAn} von ${heiz.length} ein${naechste && naechste !== 'unknown' ? ` · nächste Schaltzeit ${new Date(naechste).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}` : ''}</div></div>${this.tgl(this.E(b, 'automatik'))}</div>` : ''}
        ${o.pumpen ? `<div class="tile info" data-tab="pumpen"><span class="ic">💧</span><div class="tx"><div class="n">Pumpen</div><div class="s">${pumpenLaufen} von ${pumpen.length} laufen</div></div></div>` : ''}
      </div>
      <div class="sec">
        <div class="heading">Warnungen <span class="sub">${warnungen.length || 'keine'}</span></div>
        ${warnungen.length ? warnungen.map(([k, t, s]) => `<div class="card ${k}"><b>${esc(t)}</b><br><span class="muted">${esc(s)}</span></div>`).join('')
          : '<div class="tile ok"><span class="ic">✓</span><div class="tx"><div class="n">Alles in Ordnung</div></div></div>'}
      </div>
      <div class="sec">
        <div class="heading">Verbrauch heute</div>
        <div class="grid2">
          ${this._kachel('⚡', `${de(summe(this.E(b, 'energie')), 2)} kWh`, `jetzt ${de((this.N(this.E(b, 'leistung')) || 0) / 1000, 2)} kW`, 'auswertung')}
          ${this._kachel('€', eur(summe(this.E(b, 'kosten'))), `${de(this.N(this.E(b, 'preis')), 2)} €/kWh`, 'auswertung')}
        </div>
        <div class="grid2">
          ${this._kachel('📊', 'gesamt', `${de(this.N(this.E(b, 'energie')), 1)} kWh · ${eur(this.N(this.E(b, 'kosten')))}`, 'auswertung')}
          ${o.heizung ? this._kachel('🐷', 'gespart', eur(this.N(this.E(b, 'ersparnis'))), 'auswertung') : ''}
        </div>
      </div>
      <div class="sec span3"><div class="heading">Bereiche</div>
        <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${b.bereiche.map(x => {
          const g = b.geraete.filter(y => y.bereich === x.id), an = g.filter(y => this.an(y.schalter)).length;
          const t = x.fuehler ? this.N(x.fuehler) ?? this.S(x.fuehler)?.attributes.current_temperature : null;
          return `<div class="tile ${an ? (x.art === 'pumpenschacht' ? 'info' : 'heat') : ''}" data-tab="${x.art === 'pumpenschacht' ? 'pumpen' : 'heizung'}"><span class="ic">${x.art === 'pumpenschacht' ? '💧' : '🏠'}</span>
            <div class="tx"><div class="n">${esc(x.name)}</div><div class="s">${t !== null && t !== undefined ? de(t) + ' °C · ' : ''}${an}/${g.length} ein · ${de((this.N(this.E(b, 'leistung', x.id)) || 0) / 1000, 2)} kW${x.art === 'container' ? ' · ' + esc(GRUND[this.V(this.E(b, 'grund', x.id))] || '') : ''}</div></div></div>`;
        }).join('')}</div></div>
      <div class="sec span3"><div class="heading">Heute <span class="sub">wann geheizt und gepumpt wird</span></div>
        <div class="card">${this._zeitleiste(b, schalter, 'ue')}</div></div>
    </div>`;
  }

  _kachel(ic, n, s, tab) { return `<div class="tile" ${tab ? `data-tab="${tab}"` : ''}><span class="ic">${ic}</span><div class="tx"><div class="n">${n}</div><div class="s">${s}</div></div></div>`; }
  _bereichName(b, id) { return (b.bereiche.find(x => x.id === id) || {}).name || '?'; }
  _wetterSymbol(z) { return ({ sunny: '☀', 'clear-night': '🌙', partlycloudy: '⛅', cloudy: '☁', rainy: '🌧', pouring: '🌧', snowy: '❄', 'snowy-rainy': '🌨', fog: '🌫', windy: '💨', lightning: '⚡', 'lightning-rainy': '⛈', hail: '🌨' })[z] || '🌡'; }

  _zeitleiste(b, ids, id) {
    const W = this._breite(), start = mitternacht();
    const gruende = b.bereiche.map(x => this.E(b, 'grund', x.id)).filter(Boolean);
    const h = this._historie([...ids, ...gruende], start);
    if (h === undefined) return '<div class="muted">Lädt …</div>';
    const jetzt = new Date(), jetztMin = (jetzt - start) / 60000;
    const zeitpunkt = e => Math.max(0, ((e.lu || e.lc || 0) * 1000 - start) / 60000);
    const trocknen = {};
    for (const x of b.bereiche) {
      const liste = (h && h[this.E(b, 'grund', x.id)]) || [];
      trocknen[x.id] = liste.map((e, i) => [zeitpunkt(e), i + 1 < liste.length ? zeitpunkt(liste[i + 1]) : jetztMin, e.s ?? e.state])
        .filter(z => z[2] === 'kleidung_trocknen');
    }
    const schneiden = (segs, zeiten) => segs.flatMap(([von, bis, k]) => {
      if (k !== 'on') return [[von, bis, k]];
      const teile = []; let pos = von;
      for (const [tv, tb] of zeiten.filter(z => z[1] > von && z[0] < bis).sort((p, q) => p[0] - q[0])) {
        if (tv > pos) teile.push([pos, tv, 'on']);
        teile.push([Math.max(pos, tv), Math.min(bis, tb), 'extra']); pos = Math.min(bis, tb);
      }
      if (pos < bis) teile.push([pos, bis, 'on']);
      return teile;
    });
    const rows = ids.map(eid => {
      const g = b.geraete.find(x => x.schalter === eid) || { name: eid, bereich: '' };
      const liste = (h && h[eid]) || [];
      const segs = [];
      liste.forEach((e, i) => {
        const von = Math.max(0, ((e.lu || e.lc || 0) * 1000 - start) / 60000);
        const bis = i + 1 < liste.length ? ((liste[i + 1].lu || liste[i + 1].lc) * 1000 - start) / 60000 : jetztMin;
        const s = e.s ?? e.state;
        if (s === 'on') segs.push([von, Math.max(von + 1, bis), 'on']);
        else if (s === 'unavailable') segs.push([von, Math.max(von + 1, bis), 'off']);
      });
      const idx = b.bereiche.findIndex(x => x.id === g.bereich);
      return { name: this._narrow ? g.name : `${this._bereichName(b, g.bereich)} · ${g.name}`, color: sc(idx < 0 ? 0 : idx), onLabel: g.rolle === 'pumpe' ? 'läuft' : 'ein',
        segs: g.rolle === 'pumpe' ? segs : schneiden(segs, trocknen[g.bereich] || []) };
    });
    if (!rows.length) return '<div class="muted">Noch keine Geräte zugeordnet.</div>';
    return timeline({ id: `tl${id}`, W, now: jetztMin, rows }) + legend([...b.bereiche.map((x, i) => [x.name, sc(i)]), ['Kleidung trocknen', 'var(--muted)', 'hatch'], ['nicht erreichbar', 'var(--crit)', 'hatch']]);
  }

  _breite() { return this._narrow ? 340 : Math.min(1100, Math.max(600, (this.clientWidth || 1000) - 60)); }

  /* ---------------------------------------------------------------- Heizung */
  vHeizung(b) {
    const regeln = (key, titel, sub) => this.zeile('', titel, sub, this.zahl(this.E(b, key)));
    const container = b.bereiche.filter(x => x.art === 'container');
    const status = this.V(this.E(b, 'status'));
    const naechste = this.V(this.E(b, 'naechste_schaltzeit'));
    const plan = TAGE.map(([k]) => ({ k, ein: t2m(this.V(this.E(b, `${k}_ein`))), aus: t2m(this.V(this.E(b, `${k}_aus`))), aktiv: this.an(this.E(b, `${k}_aktiv`)) }));
    const heute = tagIndex(new Date());
    const regen = this.N(this.E(b, 'regen')), frueh = this.N(this.E(b, 'frueh_prognose'));
    const trocknet = regen !== null && regen >= (this.N(this.E(b, 'trocknen_ab_mm')) ?? 99) && container.some(x => this.an(this.E(b, 'kleidung_trocknen', x.id)));
    const kalt = frueh !== null && frueh < (this.N(this.E(b, 'kaelte_schwelle')) ?? -99);
    const vor = (kalt ? this.N(this.E(b, 'kaelte_frueher_min')) || 0 : 0) + (trocknet ? this.N(this.E(b, 'trocknen_frueher_min')) || 0 : 0);
    const nach = trocknet ? this.N(this.E(b, 'trocknen_laenger_min')) || 0 : 0;
    const jetzt = (new Date() - mitternacht()) / 60000;
    const balken = (p, i) => {
      if (!p.aktiv) return '<div class="tl hide-phone"></div>';
      const x = m => (Math.max(0, Math.min(1440, m)) / 14.4).toFixed(2);
      let h = `<i style="left:${x(p.ein)}%;width:${x(p.aus - p.ein)}%"></i>`;
      if (i === heute) {
        if (vor) h += `<i class="pre" style="left:${x(p.ein - vor)}%;width:${x(vor)}%"></i>`;
        if (nach) h += `<i class="ext" style="left:${x(p.aus)}%;width:${x(nach)}%"></i>`;
        h += `<b style="position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--primary-text-color);left:${x(jetzt)}%"></b>`;
      }
      return `<div class="tl hide-phone">${h}</div>`;
    };
    return `<div class="sections">
      <div class="sec span3"><div class="tile ${status === 'heizt' ? 'heat' : ''}"><span class="ic">♨</span><div class="tx"><div class="n">Automatik (alle Container)</div>
        <div class="s">${esc(STATUS[status] || status || '–')}${naechste && naechste !== 'unknown' ? ` · nächste Schaltzeit ${new Date(naechste).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}` : ''}${nach ? ` · Kleidung trocknen +${nach} min` : ''}${vor ? ` · ${vor} min früher` : ''}</div></div>${this.tgl(this.E(b, 'automatik'))}</div></div>
      ${container.map(x => {
        const t = x.fuehler ? this.N(x.fuehler) ?? this.S(x.fuehler)?.attributes.current_temperature : null;
        return `<div class="sec">
          <div class="heading">${esc(x.name)} <span class="sub">${t !== null && t !== undefined ? de(t) + ' °C' : 'kein Fühler'}</span></div>
          <div class="card"><div class="rows">
            ${this.zeile('⚙', 'Modus', esc(GRUND[this.V(this.E(b, 'grund', x.id))] || ''), this.auswahl(this.E(b, 'modus', x.id)))}
            ${this.E(b, 'soll', x.id) ? this.zeile('🌡', 'Solltemperatur', '', this.zahl(this.E(b, 'soll', x.id))) : ''}
            ${this.zeile('👕', 'Kleidung trocknen', 'nach Regen länger und früher heizen', this.tgl(this.E(b, 'kleidung_trocknen', x.id)))}
          </div></div>
          ${b.geraete.filter(g => g.bereich === x.id).map(g => this.geraetKarte(b, g)).join('') || '<div class="muted">Noch kein Shelly zugeordnet.</div>'}
          <div class="muted klein">Schalter antippen stellt den Container auf Handbetrieb.</div>
        </div>`;
      }).join('')}
      <div class="sec span2"><div class="heading">Zeitplan je Tag <span class="sub hide-phone">schraffiert = heute länger/früher · Strich = jetzt</span></div>
        <div class="card week">
          <div class="row h"><span>Tag</span><span>Ein</span><span>Aus</span><span class="hide-phone">Verlauf</span><span>Aktiv</span></div>
          ${plan.map((p, i) => `<div class="row" ${i === heute ? 'style="font-weight:600"' : ''}><b>${TAGE[i][1]}</b>
            <input class="inp" type="time" value="${m2t(p.ein)}" data-time="${this.E(b, `${p.k}_ein`)}" ${p.aktiv ? '' : 'disabled'}>
            <input class="inp" type="time" value="${m2t(p.aus)}" data-time="${this.E(b, `${p.k}_aus`)}" ${p.aktiv ? '' : 'disabled'}>
            ${balken(p, i)}${this.tgl(this.E(b, `${p.k}_aktiv`))}</div>`).join('')}
          <div class="muted klein">Tag aus = nur Frostschutz.</div></div></div>
      <div class="sec"><div class="heading">Heizgrenze – zu warm</div><div class="card"><div class="rows">
        ${this.zeile('☀', 'Heizgrenze', 'über dem Wert läuft keine Heizung', this.tgl(this.E(b, 'heizgrenze_aktiv')))}
        ${regeln('heizgrenze', 'Aus über', 'laut Wetterbericht')}
        ${this.zeile('🔮', 'Grundlage', '', this.auswahl(this.E(b, 'heizgrenze_basis')))}</div></div>
        <div class="heading">Frostschutz</div><div class="card"><div class="rows">
        ${this.zeile('❄', 'Frostschutz', 'nur Container mit Fühler', this.tgl(this.E(b, 'frost_aktiv')))}
        ${regeln('frost_ein', 'Ein unter')}${regeln('frost_aus', 'Aus über')}</div></div></div>
      <div class="sec"><div class="heading">Kleidung trocknen <span class="sub">${trocknet ? 'greift heute' : 'kein Regen'}</span></div><div class="card"><div class="rows">
        <div class="muted klein">Nach Regen: nasse Arbeitskleidung soll in der Früh trocken sein. Gilt nur für Container mit „Kleidung trocknen“.</div>
        ${regeln('trocknen_ab_mm', 'Ab Regen', 'letzte 24 h')}${regeln('trocknen_laenger_min', 'Abends länger heizen')}${regeln('trocknen_frueher_min', 'In der Früh früher starten')}</div></div></div>
      <div class="sec"><div class="heading">Bei Kälte früher ein</div><div class="card"><div class="rows">
        ${regeln('kaelte_schwelle', 'Früh-Prognose unter', 'gilt für alle Container')}${regeln('kaelte_frueher_min', 'Früher um')}</div></div>
        <div class="heading">Urlaub und Feiertage</div><div class="card"><div class="rows">
        ${this.zeile('🏖', 'Verhalten', '', this.auswahl(this.E(b, 'urlaub_modus')))}${regeln('absenk_temp', 'Absenken auf')}</div></div></div>
    </div>`;
  }

  /* ---------------------------------------------------------------- Pumpen */
  vPumpen(b) {
    const pumpen = b.geraete.filter(g => g.rolle === 'pumpe');
    const schaechte = b.bereiche.filter(x => pumpen.some(g => g.bereich === x.id));
    return `<div class="sections">
      ${schaechte.map(x => `<div class="sec"><div class="heading">${esc(x.name)}</div>
        ${pumpen.filter(g => g.bereich === x.id).map(g => this.geraetKarte(b, g,
          `<div class="s">Pumpzeit ${de(this.N(this.E(b, 'pumpzeit', g.id)))} h · ${de(this.N(this.E(b, 'pumpzyklen', g.id)), 0)} Zyklen gesamt</div>`)).join('')}</div>`).join('')
        || '<div class="sec"><div class="card info-card">Noch keine Pumpe zugeordnet – in den Einstellungen einen Pumpenschacht und Shellys anlegen.</div></div>'}
      <div class="sec"><div class="heading">Meldungen</div><div class="card"><div class="rows">
        ${this.zeile('⚡', 'Offline länger als', 'Stromausfall / Verbindung', this.zahl(this.E(b, 'offline_min')))}
        ${this.zeile('🏜', 'Trockenlauf unter', 'Pumpe läuft, zieht zu wenig', this.zahl(this.E(b, 'trocken_unter_w')))}
        ${this.zeile('⏱', 'Dauerlauf länger als', 'Schwimmer hängt / starker Zufluss', this.zahl(this.E(b, 'dauerlauf_h')))}</div></div></div>
      <div class="sec"><div class="heading">Empfänger</div><div class="card"><div class="rows">
        ${(Array.isArray(b.baustelle.optionen.empfaenger) ? b.baustelle.optionen.empfaenger : []).map(n => this.zeile('📱', esc(n.replace('mobile_app_', '')), 'notify.' + esc(n), '')).join('') || '<div class="muted">Noch keine Empfänger.</div>'}
        <div class="r"><div class="l">${this.link('Empfänger wählen', INTEGRATION)}</div><span class="btn small" data-press="${this.E(b, 'test_meldung')}">Test-Meldung senden</span></div></div></div>
        <div class="card info-card klein">Stromausfall erkennt HA daran, dass die Shellys nicht mehr antworten. Fällt das Internet der Baustelle aus, sieht das gleich aus.</div></div>
      <div class="sec span3"><div class="heading">Pumpzeit je Tag <span class="sub">Stunden, letzte 14 Tage</span></div><div class="card">
        ${this._tagesSaeulen(pumpen.map((g, i) => [this.E(b, 'pumpzeit', g.id), g.name, sc(b.bereiche.length + i)]), 14, 'h', false)}</div></div>
      <div class="sec span3"><div class="heading">Pumpzyklen je Tag <span class="sub">letzte 14 Tage</span></div><div class="card">
        ${this._tagesSaeulen(pumpen.map((g, i) => [this.E(b, 'pumpzyklen', g.id), g.name, sc(b.bereiche.length + i)]), 14, 'Zyklen', false)}</div></div>
    </div>`;
  }

  /* ---------------------------------------------------------------- Auswertung */
  _tagesSaeulen(reihen, tage, einheit, stapeln, periode = 'day', start = null) {
    reihen = reihen.filter(r => r[0]);
    if (!reihen.length) return '<div class="muted">Keine Daten.</div>';
    const von = start || new Date(mitternacht().getTime() - (tage - 1) * 86400000);
    const st = this._statistik(reihen.map(r => r[0]), periode, von);
    if (st === undefined) return '<div class="muted">Lädt …</div>';
    const schluessel = [];
    for (let d = new Date(von); d <= new Date(); periode === 'month' ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + 1)) schluessel.push(periode === 'month' ? `${d.getFullYear()}-${d.getMonth()}` : isoTag(d));
    const key = ms => { const d = new Date(ms); return periode === 'month' ? `${d.getFullYear()}-${d.getMonth()}` : isoTag(d); };
    const series = reihen.map(([eid, name, color]) => {
      const werte = Object.fromEntries(((st && st[eid]) || []).map(x => [key(x.start), Math.max(0, x.change || 0)]));
      return { name, color, values: schluessel.map(k => werte[k] || 0) };
    });
    const labels = schluessel.map(k => periode === 'month' ? `${MON[Number(k.split('-')[1])]} ${k.slice(2, 4)}` : `${k.slice(8, 10)}.${k.slice(5, 7)}.`);
    if (series.every(s => s.values.every(v => !v))) return '<div class="muted">Noch keine Werte in der Langzeitstatistik – die füllt sich stündlich.</div>';
    return colChart({ id: 'c' + Math.random().toString(36).slice(2, 7), W: this._breite(), labels, series, stack: stapeln, unit: einheit, dec: einheit === 'h' ? 1 : 2 })
      + legend(series.map(s => [s.name, s.color]));
  }

  vAuswertung(b) {
    const PER = [['d', 'Heute'], ['7', '7 Tage'], ['30', '30 Tage'], ['hp', 'Heizperiode']];
    const o = b.baustelle.optionen;
    const bereiche = this.ui.scope === 'all' ? b.bereiche : b.bereiche.filter(x => x.id === this.ui.scope);
    const heizBereiche = bereiche.filter(x => x.art === 'container');
    const von = Number(o.heizperiode_von || 10), jetzt = new Date();
    const hpStart = new Date(jetzt.getMonth() + 1 >= von ? jetzt.getFullYear() : jetzt.getFullYear() - 1, von - 1, 1);
    let diagramme = '';
    if (this.ui.per === 'd') {
      const hs = this._historie([this.E(b, 'leistung'), ...heizBereiche.map(x => x.fuehler), this.E(b, 'aussen')], mitternacht());
      diagramme += `<div class="sec span3"><div class="heading">Leistung heute <span class="sub">kW</span></div><div class="card">${this._linie(hs, [[this.E(b, 'leistung'), 'Baustelle', sc(0), 1000]], 'kW', true)}</div></div>
        <div class="sec span3"><div class="heading">Heiz- und Pumpzeiten heute</div><div class="card">${this._zeitleiste(b, b.geraete.filter(g => g.rolle !== 'steckdose' && bereiche.some(x => x.id === g.bereich)).map(g => g.schalter), 'au')}</div></div>
        <div class="sec span3"><div class="heading">Temperaturen heute <span class="sub">°C</span></div><div class="card">${this._linie(hs,
          [...heizBereiche.filter(x => x.fuehler).map(x => [x.fuehler, x.name, sc(b.bereiche.indexOf(x))]), [this.E(b, 'aussen'), 'Außen', 'var(--muted)', 1, true]], '°C', false,
          this.an(this.E(b, 'frost_aktiv')) ? { v: this.N(this.E(b, 'frost_ein')), label: `Frostschutz ${de(this.N(this.E(b, 'frost_ein')))} °C` } : null)}</div></div>`;
    } else {
      const tage = this.ui.per === 'hp' ? null : Number(this.ui.per);
      const periode = this.ui.per === 'hp' ? 'month' : 'day';
      const start = this.ui.per === 'hp' ? hpStart : null;
      const was = this.ui.per === 'hp' ? 'Monat' : 'Tag';
      diagramme += `<div class="sec span3"><div class="heading">Verbrauch je ${was} <span class="sub">kWh, gestapelt nach Bereich</span></div><div class="card">
          ${this._tagesSaeulen(bereiche.map(x => [this.E(b, 'energie', x.id), x.name, sc(b.bereiche.indexOf(x))]), tage, 'kWh', true, periode, start)}</div></div>
        <div class="sec span3"><div class="heading">Heizzeit je ${was} <span class="sub">Stunden je Container</span></div><div class="card">
          ${this._tagesSaeulen(heizBereiche.map(x => [this.E(b, 'heizzeit', x.id), x.name, sc(b.bereiche.indexOf(x))]), tage, 'h', false, periode, start)}</div></div>
        <div class="sec span3"><div class="heading">Kosten je ${was}</div><div class="card">
          ${this._tagesSaeulen(bereiche.map(x => [this.E(b, 'kosten', x.id), x.name, sc(b.bereiche.indexOf(x))]), tage, '€', true, periode, start)}</div></div>
        <div class="sec span3"><div class="heading">Temperatur je ${was} <span class="sub">Mittel °C</span></div><div class="card">
          ${this._mittelTemperatur([...heizBereiche.filter(x => x.fuehler).map(x => [x.fuehler, x.name, sc(b.bereiche.indexOf(x))]), [this.E(b, 'aussen'), 'Außen', 'var(--muted)', true]], tage, periode, start)}</div></div>`;
    }
    const ist = this.N(this.E(b, 'energie')), ohne = this.N(this.E(b, 'energie_ohne_automatik')), preis = this.N(this.E(b, 'preis')) || 0;
    const typen = ['oelradiator', 'konvektor'].map(t => {
      const g = b.geraete.filter(x => x.rolle === 'heizkoerper' && x.typ === t);
      const suffix = t;
      const z = b.zaehler || {};
      const reine = b.bereiche.filter(x => { const hk = b.geraete.filter(y => y.bereich === x.id && y.rolle === 'heizkoerper'); return hk.length && hk.every(y => y.typ === t); });
      const schnitt = werte => { werte = werte.filter(v => v !== null && v !== undefined && Number.isFinite(v)); return werte.length ? werte.reduce((p, q) => p + q, 0) / werte.length : null; };
      return { t, n: g.length, mittel: this.N(this.E(b, `mittel_${suffix}`)), energie: this.N(this.E(b, `energie_${suffix}`)), zeit: this.N(this.E(b, `heizzeit_${suffix}`)),
        aufheiz: schnitt(reine.map(x => z[`aufheiz:${x.id}`])), abkuehl: schnitt(reine.map(x => z[`abkuehl:${x.id}`])),
        jeGrad: schnitt(reine.map(x => (z[`gradh:${x.id}`] || 0) > 24 ? (z[`energie:${x.id}`] || 0) / (z[`gradh:${x.id}`] / 24) : null)) };
    });
    const vgl = (label, f, fmt, besser) => `<tr><td>${label}</td>${typen.map(r => `<td>${r.n ? fmt(f(r)) : '–'}</td>`).join('')}<td class="muted klein" style="text-align:left;white-space:normal">${besser}</td></tr>`;
    return `<div class="sections">
      <div class="sec span3"><div class="card filter">
        ${PER.map(([k, l]) => `<span class="btn small ${this.ui.per === k ? '' : 'flat'}" data-ui="per" data-wert="${k}">${l}</span>`).join('')}
        <span style="flex:1"></span><select class="inp" data-ui="scope"><option value="all">Ganze Baustelle</option>${b.bereiche.map(x => `<option value="${x.id}" ${this.ui.scope === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div></div>
      <div class="sec span3"><div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        <div class="stat"><div class="sl">⚡ Verbrauch gesamt</div><div class="sv">${de(ist, 1)} kWh</div><div class="ss">${eur(this.N(this.E(b, 'kosten')))}</div></div>
        <div class="stat"><div class="sl">♨ Heizzeit</div><div class="sv">${de(heizBereiche.reduce((s, x) => s + (this.N(this.E(b, 'heizzeit', x.id)) || 0), 0), 1)} h</div><div class="ss">Summe der Container</div></div>
        <div class="stat"><div class="sl">🐷 Gespart</div><div class="sv">${eur(this.N(this.E(b, 'ersparnis')))}</div><div class="ss">gegenüber 24 h Dauerbetrieb</div></div>
        <div class="stat"><div class="sl">📈 Heizperiode</div><div class="sv">${de(this.N(this.E(b, 'prognose_heizperiode')), 0)} kWh</div><div class="ss">hochgerechnet · ${eur(this.N(this.E(b, 'prognose_heizperiode_kosten')))}</div></div>
      </div></div>
      ${diagramme}
      <div class="sec span2"><div class="heading">Mit Automatik vs. ohne</div><div class="card">
        <table class="t"><tr><th></th><th>mit Automatik</th><th>ohne (24/7)</th><th>Ersparnis</th></tr>
          <tr><td>bisher</td><td>${de(ist, 1)} kWh</td><td>${de(ohne, 1)} kWh</td><td class="save">${eur(this.N(this.E(b, 'ersparnis')))}</td></tr>
          <tr><td>Heizperiode (${MON[von - 1]}–${MON[Number(o.heizperiode_bis || 4) - 1]}, hochger.)</td><td>${de(this.N(this.E(b, 'prognose_heizperiode')), 0)} kWh</td>
            <td>${de(this.N(this.E(b, 'prognose_heizperiode_ohne')), 0)} kWh</td>
            <td class="save">${this.N(this.E(b, 'prognose_heizperiode_ohne')) !== null && this.N(this.E(b, 'prognose_heizperiode')) !== null ? eur(Math.max(0, this.N(this.E(b, 'prognose_heizperiode_ohne')) - this.N(this.E(b, 'prognose_heizperiode'))) * preis) : '–'}</td></tr></table>
        <div class="muted klein">„Ohne“ = Ø Leistung jedes Heizgeräts im Betrieb (gemessen) × 24 h. Hochrechnungen ab einem Tag Daten.</div></div></div>
      <div class="sec"><div class="heading">Kosten</div><div class="card"><div class="rows">
        ${this.zeile('€', 'Strompreis', 'brutto je kWh', this.zahl(this.E(b, 'preis'), '€/kWh'))}
        ${this.zeile('🗓', 'Heizperiode', `${MON[von - 1]} – ${MON[Number(o.heizperiode_bis || 4) - 1]}`, this.link('ändern', INTEGRATION))}</div></div>
        <div class="heading">Je Gerät</div><div class="card"><table class="t"><tr><th>Gerät</th><th>Ø Betrieb</th><th>jetzt</th></tr>
        ${b.geraete.filter(g => bereiche.some(x => x.id === g.bereich)).map(g => `<tr><td>${esc(g.name)}<br><span class="muted klein">${esc(this._bereichName(b, g.bereich))}${g.rolle === 'heizkoerper' ? ' · ' + TYP[g.typ] : ''}</span></td>
          <td>${de(this.N(this.E(b, 'mittel_im_betrieb', g.id)), 0)} W</td><td>${de(this.N(g.leistung), 0)} W</td></tr>`).join('')}</table></div></div>
      ${o.heizung ? `<div class="sec span3"><div class="heading">Vergleich Ölradiator ↔ Konvektor</div><div class="card">
        <table class="t"><tr><th></th><th>Ölradiator</th><th>Konvektor</th><th style="text-align:left">besser ist</th></tr>
          ${vgl('Anzahl', r => r.n, x => x, '')}
          ${vgl('Ø Leistung im Betrieb', r => r.mittel, x => de(x, 0) + ' W', '–')}
          ${vgl('Energie gesamt', r => r.energie, x => de(x, 1) + ' kWh', '')}
          ${vgl('Energie je Gerät', r => r.energie === null ? null : r.energie / r.n, x => de(x, 1) + ' kWh · ' + eur(x * preis), 'weniger')}
          ${vgl('Heizzeit je Gerät', r => r.zeit === null ? null : r.zeit / r.n, x => de(x, 1) + ' h', 'weniger')}
          ${vgl('Aufheizen', r => r.aufheiz, x => x === null ? '–' : de(x, 1) + ' °C/h', 'mehr = schneller warm')}
          ${vgl('Abkühlen nach Aus', r => r.abkuehl, x => x === null ? '–' : de(x, 1) + ' °C/h', 'weniger = hält Wärme länger')}
          ${vgl('kWh je Tag und Grad innen/außen', r => r.jeGrad, x => x === null ? '–' : de(x, 2), 'weniger = fairer Vergleich')}</table>
        <div class="muted klein">Beide wandeln Strom zu 100 % in Wärme – pro kWh gibt es keinen Unterschied. Unterschiede entstehen durch Leistung, Laufzeit, Takten am Thermostat und Wärmespeicherung.
          Aufheizen, Abkühlen und „je Grad“ brauchen einen Fühler im Container und zählen nur Container mit einem einzigen Heizkörper-Typ.</div></div></div>` : ''}
    </div>`;
  }

  _mittelTemperatur(reihen, tage, periode, start) {
    reihen = reihen.filter(r => r[0]);
    if (!reihen.length) return '<div class="muted">Kein Fühler und keine Außentemperatur.</div>';
    const von = start || new Date(mitternacht().getTime() - (tage - 1) * 86400000);
    const st = this._statistik(reihen.map(r => r[0]), periode, von, ['mean']);
    if (st === undefined) return '<div class="muted">Lädt …</div>';
    const schluessel = [];
    for (let d = new Date(von); d <= new Date(); periode === 'month' ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + 1)) schluessel.push(periode === 'month' ? `${d.getFullYear()}-${d.getMonth()}` : isoTag(d));
    const key = ms => { const d = new Date(ms); return periode === 'month' ? `${d.getFullYear()}-${d.getMonth()}` : isoTag(d); };
    const series = reihen.map(([eid, name, color, dash]) => {
      const werte = Object.fromEntries(((st && st[eid]) || []).filter(x => x.mean !== null && x.mean !== undefined).map(x => [key(x.start), x.mean]));
      if (!Object.keys(werte).length) return null;
      let letzter = Object.values(werte)[0];
      return { name, color, dash, values: schluessel.map(k => (letzter = werte[k] ?? letzter)) };
    }).filter(Boolean);
    if (!series.length) return '<div class="muted">Noch keine Werte in der Langzeitstatistik – die füllt sich stündlich.</div>';
    const labels = schluessel.map(k => periode === 'month' ? `${MON[Number(k.split('-')[1])]} ${k.slice(2, 4)}` : `${k.slice(8, 10)}.${k.slice(5, 7)}.`);
    return lineChart({ id: 'm' + Math.random().toString(36).slice(2, 7), W: this._breite(), H: 190, labels, series, unit: '°C' })
      + legend(series.map(x => [x.name, x.color, x.dash ? 'dash' : '']), 'line');
  }

  _linie(hs, reihen, einheit, flaeche, ref = null) {
    if (hs === undefined) return '<div class="muted">Lädt …</div>';
    reihen = reihen.filter(r => r[0] && hs && hs[r[0]] && hs[r[0]].length);
    if (!reihen.length) return '<div class="muted">Noch keine Messwerte.</div>';
    const start = mitternacht().getTime(), jetzt = Date.now(), schritte = Math.max(2, Math.ceil((jetzt - start) / 600000));
    const labels = [...Array(schritte)].map((_, i) => m2t(i * 10));
    const series = reihen.map(([eid, name, color, teiler = 1, dash = false]) => {
      const liste = hs[eid].map(e => [((e.lu || e.lc) * 1000), parseFloat(e.s ?? e.state)]).filter(x => !Number.isNaN(x[1]));
      let j = 0, letzter = liste.length ? liste[0][1] : 0;
      const values = labels.map((_, i) => { const t = start + i * 600000; while (j < liste.length && liste[j][0] <= t) { letzter = liste[j][1]; j++; } return +(letzter / teiler).toFixed(2); });
      return { name, color, values, dash, last: schritte - 1 };
    });
    return lineChart({ id: 'l' + Math.random().toString(36).slice(2, 7), W: this._breite(), H: 200, labels, series, unit: einheit, area: flaeche, ref })
      + (series.length > 1 ? legend(series.map(s => [s.name, s.color, s.dash ? 'dash' : '']), 'line') : '');
  }

  /* ---------------------------------------------------------------- Verlauf */
  vVerlauf() {
    const alle = this.baustellen.filter(x => x.baustelle.geladen);
    const zeile = x => {
      const o = x.baustelle.optionen, ab = o.status === 'abgeschlossen';
      return `<tr data-ui="hsel" data-wert="${x.baustelle.entry_id}" style="cursor:pointer"><td>${esc(x.baustelle.titel)} <span class="chip ${ab ? 'grey' : 'gruen'}">${ab ? 'abgeschlossen' : 'aktiv'}</span></td>
        <td class="hide-phone">${esc(o.beginn || '–')} – ${ab ? esc(o.ende || '–') : 'laufend'}</td>
        <td>${de(this.N(this.E(x, 'energie')), 0)} kWh</td><td>${eur(this.N(this.E(x, 'kosten')))}</td><td class="save">${eur(this.N(this.E(x, 'ersparnis')))}</td></tr>`;
    };
    const start = new Date(new Date().getFullYear() - 1, 0, 1);
    const detail = alle.find(x => x.baustelle.entry_id === this.ui.hsel);
    const summe = k => alle.reduce((s, x) => s + (this.N(this.E(x, k)) || 0), 0);
    return `<div class="sections">
      <div class="sec span3"><div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        <div class="stat"><div class="sl">🏗 Baustellen</div><div class="sv">${alle.length}</div><div class="ss">${alle.filter(x => x.baustelle.optionen.status !== 'abgeschlossen').length} aktiv · ${alle.filter(x => x.baustelle.optionen.status === 'abgeschlossen').length} abgeschlossen</div></div>
        <div class="stat"><div class="sl">⚡ Energie</div><div class="sv">${de(summe('energie'), 0)} kWh</div><div class="ss">alle Baustellen</div></div>
        <div class="stat"><div class="sl">€ Kosten</div><div class="sv">${eur(summe('kosten'))}</div><div class="ss">alle Baustellen</div></div>
        <div class="stat"><div class="sl">🐷 Gespart</div><div class="sv">${eur(summe('ersparnis'))}</div><div class="ss">durch Automatik</div></div></div></div>
      <div class="sec span3"><div class="heading">Alle Baustellen <span class="sub">Zeile antippen = Detail</span></div><div class="card" style="overflow-x:auto">
        <table class="t"><tr><th>Baustelle</th><th class="hide-phone">Zeitraum</th><th>Energie</th><th>Kosten</th><th>gespart</th></tr>${alle.map(zeile).join('')}</table></div></div>
      <div class="sec span3"><div class="heading">Verbrauch je Monat <span class="sub">alle Baustellen</span></div><div class="card">
        ${this._tagesSaeulen(alle.map((x, i) => [this.E(x, 'energie'), x.baustelle.titel, sc(i)]), null, 'kWh', true, 'month', start)}</div></div>
      ${detail ? `<div class="sec span3"><div class="heading">${esc(detail.baustelle.titel)} <span class="sub"><span class="btn flat small" data-ui="hsel" data-wert="all">schließen</span></span></div><div class="card">
        ${this._tagesSaeulen([[this.E(detail, 'energie'), 'mit Automatik', sc(0)], [this.E(detail, 'energie_ohne_automatik'), 'ohne (24/7)', 'rgba(127,127,127,.45)']], null, 'kWh', false, 'month', start)}</div></div>
        <div class="sec span3"><div class="heading">Ereignisse <span class="sub">letzte 30 Tage</span></div><div class="card">${this._ereignisse(detail)}</div></div>` : ''}
    </div>`;
  }

  _ereignisse(b) {
    const probleme = b.geraete.map(g => [this.E(b, 'problem', g.id), g]).filter(p => p[0]);
    const ids = [this.E(b, 'status'), this.E(b, 'erreichbar'), this.E(b, 'automatik'), ...probleme.map(p => p[0])].filter(Boolean);
    const start = new Date(Date.now() - 30 * 86400000);
    const liste = this._holen(`lb:${b.baustelle.entry_id}`, () => this._hass.callWS({ type: 'logbook/get_events', start_time: start.toISOString(), entity_ids: ids }), 120000);
    if (liste === undefined) return '<div class="muted">Lädt …</div>';
    const text = e => {
      const p = probleme.find(q => q[0] === e.entity_id);
      if (p) return e.state === 'on' ? `⚠ ${p[1].name}: Problem` : `✓ ${p[1].name}: wieder in Ordnung`;
      if (e.entity_id === this.E(b, 'erreichbar')) return e.state === 'off' ? '⚠ Baustelle nicht erreichbar' : '✓ Baustelle wieder erreichbar';
      if (e.entity_id === this.E(b, 'automatik')) return e.state === 'on' ? 'Automatik eingeschaltet' : 'Automatik ausgeschaltet';
      if (e.entity_id === this.E(b, 'status')) return `Status: ${STATUS[e.state] || e.state}`;
      return null;
    };
    const zeilen = (liste || []).map(e => [e.when, text(e)]).filter(z => z[1]).reverse().slice(0, 40);
    if (!zeilen.length) return '<div class="muted">Keine Ereignisse.</div>';
    return `<div class="rows">${zeilen.map(([w, t]) => this.zeile('', esc(t), new Date(w * 1000).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), '')).join('')}</div>`;
  }

  /* ---------------------------------------------------------------- Einstellungen */
  vEinstellungen(b) {
    const SUBS = [['baustellen', 'Baustellen'], ['diese', 'Container & Shellys'], ['wetter', 'Wetter'], ['urlaub', 'Urlaub & Feiertage'], ['meldungen', 'Meldungen']];
    const o = b.baustelle.optionen;
    const f = this.ui.form || {};
    const knopf = (text, act, extra = '', klasse = 'btn flat small') => `<span class="${klasse}" data-act="${act}" ${extra}>${text}</span>`;
    const formular = (felder, speichern, text = 'Speichern') => `<div class="form">${felder}<div class="act">${knopf('Abbrechen', 'abbrechen', '', 'btn flat')}${knopf(text, speichern, '', 'btn')}</div></div>`;
    let inhalt = '';
    if (this.ui.sub === 'baustellen') {
      inhalt = `<div class="sec span2"><div class="heading">Baustellen</div><div class="card"><div class="rows">
        ${this.baustellen.map(x => { const id = x.baustelle.entry_id, xo = x.baustelle.optionen, ab = xo.status === 'abgeschlossen';
          return `<div class="r"><span class="ic">🏗</span><div class="l">${esc(x.baustelle.titel)}
            <span class="chip ${ab ? 'grey' : 'gruen'}">${ab ? 'abgeschlossen' : 'aktiv'}</span>${x === b ? '<span class="chip">angezeigt</span>' : ''}
            <small>${esc(xo.beginn || '')}${ab ? ' – ' + esc(xo.ende || '') : ''} · ${x.bereiche.length} Bereiche · ${x.geraete.length} Shellys</small></div>
            ${!ab && x !== b ? `<span class="btn flat small" data-ui="bid" data-wert="${id}">anzeigen</span>` : ''}${knopf('Status & Optionen', 'optionen', `data-id="${id}"`)}</div>
            ${f.art === 'optionen' && f.id === id ? formular(`
              <label>Status<select class="inp wide" data-f="status"><option value="aktiv" ${!ab ? 'selected' : ''}>aktiv</option><option value="abgeschlossen" ${ab ? 'selected' : ''}>abgeschlossen – Shellys frei, Zahlen bleiben</option></select></label>
              <label>Beginn<input class="inp wide" type="date" data-f="beginn" value="${esc(xo.beginn || '')}"></label>
              <label>Ende (nur abgeschlossen)<input class="inp wide" type="date" data-f="ende" value="${esc(xo.ende || '')}"></label>
              <label><span><input type="checkbox" data-f="heizung" ${xo.heizung ? 'checked' : ''}> Funktion Heizung</span></label>
              <label><span><input type="checkbox" data-f="pumpen" ${xo.pumpen ? 'checked' : ''}> Funktion Pumpenüberwachung</span></label>
              <label>Heizperiode von<select class="inp wide" data-f="heizperiode_von">${MON.map((m, i) => `<option value="${i + 1}" ${String(xo.heizperiode_von) === String(i + 1) ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
              <label>Heizperiode bis<select class="inp wide" data-f="heizperiode_bis">${MON.map((m, i) => `<option value="${i + 1}" ${String(xo.heizperiode_bis) === String(i + 1) ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`, 'optionen-speichern') : ''}`; }).join('')}
        </div>${f.art === 'neu' ? formular(`
          <label>Name<input class="inp wide" data-f="name" placeholder="z. B. Wohnanlage Ost"></label>
          <label>Beginn<input class="inp wide" type="date" data-f="beginn" value="${isoTag(new Date())}"></label>
          <label><span><input type="checkbox" data-f="heizung" checked> Funktion Heizung</span></label>
          <label><span><input type="checkbox" data-f="pumpen"> Funktion Pumpenüberwachung</span></label>`, 'baustelle-anlegen', 'Anlegen')
          : `<div style="margin-top:8px">${knopf('+ Baustelle anlegen', 'neu', '', 'btn')}</div>`}</div></div>
        <div class="sec"><div class="heading">Status</div><div class="card klein"><b>Aktiv:</b> Automatik, Meldungen und Zähler laufen.<br><br>
          <b>Abgeschlossen:</b> nichts wird mehr geschaltet, Shellys werden frei für die nächste Baustelle, alle Zahlen bleiben im Verlauf.<br><br>
          Löschen einer Baustelle nur in den ${this.link('Einstellungen der Integration', INTEGRATION)} – die Langzeitstatistik bleibt dabei erhalten.</div></div>`;
    }
    if (this.ui.sub === 'diese') {
      const fuehler = this._entitaeten(s => (s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'temperature') || s.entity_id.startsWith('climate.'));
      const eigene = new Set(this.baustellen.flatMap(x => Object.values(x.entitaeten)));
      const schalter = this._entitaeten(s => s.entity_id.startsWith('switch.') && !eigene.has(s.entity_id));
      const bereichFelder = x => `<label>Name<input class="inp wide" data-f="name" value="${esc(x ? x.name : '')}" placeholder="z. B. Container 2 · Mannschaft"></label>
        ${x ? '' : `<label>Art<select class="inp wide" data-f="art"><option value="container">Container</option><option value="pumpenschacht">Pumpenschacht</option></select></label>`}
        <label>Thermostat / Temperaturfühler (ohne: kein Thermostat-Modus, kein Frostschutz)<select class="inp wide" data-f="fuehler">${this._optionen(fuehler, x && x.fuehler, true)}</select></label>`;
      const geraetFelder = g => `<label>Container / Bereich<select class="inp wide" data-f="bereich">${b.bereiche.map(x => `<option value="${x.id}" ${g ? (g.bereich === x.id ? 'selected' : '') : (f.bereich === x.id ? 'selected' : '')}>${esc(x.name)}</option>`).join('')}</select></label>
        <label>Shelly – das, was geschaltet wird<select class="inp wide" data-f="schalter">${this._optionen(g ? [[g.schalter, this.S(g.schalter)?.attributes.friendly_name || g.schalter], ...schalter.filter(([e]) => e !== g.schalter)] : schalter, g && g.schalter)}</select></label>
        <label>Bezeichnung<input class="inp wide" data-f="name" value="${esc(g ? g.name : '')}" placeholder="z. B. Heizkörper 3"></label>
        <label>Was hängt dran<select class="inp wide" data-f="rolle">${Object.entries(ROLLE).map(([k, l]) => `<option value="${k}" ${(g ? g.rolle : 'heizkoerper') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Heizkörper-Typ – nur für den Vergleich<select class="inp wide" data-f="typ">${Object.entries(TYP).map(([k, l]) => `<option value="${k}" ${(g ? g.typ : 'konvektor') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
      inhalt = `<div class="sec span2"><div class="heading">„${esc(b.baustelle.titel)}“ – Container und Shellys</div>
        ${b.bereiche.map(x => `<div class="card"><div style="display:flex;align-items:center;gap:8px"><b style="flex:1">${x.art === 'pumpenschacht' ? '💧' : '🏠'} ${esc(x.name)}
            <span class="muted klein">${x.fuehler ? 'Fühler: ' + esc(this.S(x.fuehler)?.attributes.friendly_name || x.fuehler) : 'kein Fühler'}</span></b>
            ${knopf('ändern', 'bereich-aendern', `data-id="${x.id}"`)}${knopf('entfernen', 'bereich-loeschen', `data-id="${x.id}"`, 'btn flat small rot')}</div>
          ${f.art === 'bereich' && f.id === x.id ? formular(bereichFelder(x), 'bereich-speichern') : ''}
          ${f.art === 'bereich-loeschen' && f.id === x.id ? formular(`<b>„${esc(x.name)}“ entfernen?</b> Die zugeordneten Shellys bleiben als Einträge ohne Bereich – entferne sie vorher. Die Zahlen bleiben im Verlauf.`, 'bereich-entfernen', 'Entfernen') : ''}
          <div class="rows">${b.geraete.filter(g => g.bereich === x.id).map(g => `${this.zeile('🔌', `${esc(this.S(g.schalter)?.attributes.friendly_name || g.schalter)} → ${esc(g.name)}`,
            `${esc(g.schalter)} · schaltet: ${ROLLE[g.rolle]}${g.rolle === 'heizkoerper' ? ' · Typ (Vergleich): ' + TYP[g.typ] : ''}`,
            knopf('ändern', 'geraet-aendern', `data-id="${g.id}"`) + knopf('✕', 'geraet-loeschen', `data-id="${g.id}"`, 'btn flat small rot'))}
            ${f.art === 'geraet' && f.id === g.id ? formular(geraetFelder(g), 'geraet-speichern') : ''}
            ${f.art === 'geraet-loeschen' && f.id === g.id ? formular(`<b>„${esc(g.name)}“ entfernen?</b> Der Shelly wird frei; die Zahlen bleiben.`, 'geraet-entfernen', 'Entfernen') : ''}`).join('') || '<div class="muted">kein Shelly</div>'}</div>
          <div style="margin-top:6px">${knopf('+ Shelly', 'geraet-neu', `data-bereich="${x.id}"`)}</div>
          ${f.art === 'geraet' && !f.id && f.bereich === x.id ? formular(geraetFelder(null), 'geraet-speichern', 'Hinzufügen') : ''}</div>`).join('')}
        ${f.art === 'bereich' && !f.id ? formular(bereichFelder(null), 'bereich-speichern', 'Anlegen') : `<div>${knopf('+ Container / Pumpenschacht', 'bereich-neu', '', 'btn')}</div>`}</div>
        <div class="sec"><div class="heading">So funktioniert es</div><div class="card klein">Jede Zeile ist ein Shelly: das, was geschaltet wird.
          Ein Shelly gehört immer nur einer aktiven Baustelle. Leistung und Energie findet die Integration am Shelly selbst.<br><br>
          Heizkörper in Containern, Pumpen in Pumpenschächten. Ohne Fühler heizt der Container nach Zeitplan, der Heizkörper regelt selbst.</div></div>`;
    }
    if (this.ui.sub === 'wetter') {
      const z = (label, eid, einheit) => this.zeile('📡', label, eid ? esc(this.S(eid)?.attributes.friendly_name || eid) : 'nicht gewählt', eid ? `<span class="v">${esc(this.V(eid) ?? '–')} ${einheit}</span>` : '');
      const wetter = this._entitaeten(s => s.entity_id.startsWith('weather.'));
      const temp = this._entitaeten(s => s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'temperature');
      const regen = this._entitaeten(s => s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'precipitation');
      inhalt = `<div class="sec span2"><div class="heading">Wetter für „${esc(b.baustelle.titel)}“</div><div class="card"><div class="rows">
        ${z('Wetter (Vorhersage)', o.wetter, '')}${z('Außentemperatur (Wetterstation)', o.temp_sensor, '°C')}${z('Regen letzte 24 h (Wetterstation)', o.regen_sensor, 'mm')}
        ${this.zeile('🧮', 'Damit rechnet die Heizung', '', `<span class="v">außen ${de(this.N(this.E(b, 'aussen')))} °C · Regen ${de(this.N(this.E(b, 'regen')))} mm · Früh ${de(this.N(this.E(b, 'frueh_prognose')))} °C</span>`)}</div>
        ${f.art === 'wetter' ? formular(`<label>Wetter (Vorhersage)<select class="inp wide" data-f="wetter">${this._optionen(wetter, o.wetter, true)}</select></label>
            <label>Außentemperatur (Wetterstation, optional)<select class="inp wide" data-f="temp_sensor">${this._optionen(temp, o.temp_sensor, true)}</select></label>
            <label>Regen letzte 24 h (Wetterstation, optional)<select class="inp wide" data-f="regen_sensor">${this._optionen(regen, o.regen_sensor, true)}</select></label>`, 'wetter-speichern')
          : `<div style="margin-top:8px">${knopf('Wetter wählen', 'wetter', '', 'btn small')}</div>`}</div></div>
        <div class="sec"><div class="heading">Bewährte Quellen</div><div class="card klein"><b>Open-Meteo</b> über eine Zone der Baustelle (eingebaut) – Vorhersage.
          Zuerst unter Einstellungen → Bereiche & Zonen eine Zone anlegen, dann Open-Meteo hinzufügen.<br><br>
          <b>Wetterstation</b> (z. B. Ecowitt) – gemessene Temperatur und Regen, genauer für „Kleidung trocknen“.<br><br>
          ${this.link('Open-Meteo hinzufügen', '/config/integrations/dashboard/add?domain=open_meteo')}</div></div>`;
    }
    if (this.ui.sub === 'urlaub') {
      const feiertage = (this._kalender(o.feiertag_kalender) || []).slice(0, 6);
      const urlaub = this._kalender(o.urlaub_kalender) || [];
      const kalender = this._entitaeten(s => s.entity_id.startsWith('calendar.'));
      const datum = e => (e.start.date || e.start.dateTime || '').slice(0, 10);
      const bis = e => { const d = new Date((e.end.date || e.end.dateTime || '').slice(0, 10)); if (e.end.date) d.setDate(d.getDate() - 1); return isoTag(d); };
      inhalt = `<div class="sec"><div class="heading">Feiertage</div><div class="card"><div class="rows">
        ${o.feiertag_kalender ? (feiertage.map(e => this.zeile('🎌', esc(e.summary), datum(e), '')).join('') || '<div class="muted">Lädt …</div>') : '<div class="muted">Kein Feiertags-Kalender gewählt (Integration „Feiertage“).</div>'}</div>
        ${f.art === 'kalender' ? formular(`<label>Feiertage (Kalender der Integration „Feiertage“)<select class="inp wide" data-f="feiertag_kalender">${this._optionen(kalender, o.feiertag_kalender, true)}</select></label>
            <label>Urlaub / Betriebsruhe (Lokaler Kalender)<select class="inp wide" data-f="urlaub_kalender">${this._optionen(kalender, o.urlaub_kalender, true)}</select></label>`, 'kalender-speichern')
          : `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${knopf('Kalender wählen', 'kalender', '', 'btn small')}${this.link('Feiertage hinzufügen', '/config/integrations/dashboard/add?domain=holiday')}${this.link('Lokalen Kalender hinzufügen', '/config/integrations/dashboard/add?domain=local_calendar')}</div>`}</div>
        <div class="heading">Verhalten im Urlaub / an Feiertagen</div><div class="card"><div class="rows">
        ${this.zeile('♨', 'Heizung', 'Pumpen werden weiter überwacht', this.auswahl(this.E(b, 'urlaub_modus')))}${this.zeile('🌡', 'Absenken auf', '', this.zahl(this.E(b, 'absenk_temp')))}</div></div></div>
        <div class="sec span2"><div class="heading">Urlaub / Betriebsruhe</div><div class="card">
        ${o.urlaub_kalender ? `<div class="rows">${urlaub.map(e => this.zeile('🏖', esc(e.summary), `${datum(e)} – ${bis(e)}`,
          e.uid ? `<span class="btn flat small rot" data-act="urlaub-loeschen" data-uid="${esc(e.uid)}">✕</span>` : '')).join('') || '<div class="muted">Kein Zeitraum eingetragen.</div>'}</div>
          ${f.art === 'urlaub' ? formular(`<label>Bezeichnung<input class="inp wide" data-f="name" value="Urlaub"></label>
            <label>Von<input class="inp wide" type="date" data-f="von" value="${isoTag(new Date())}"></label><label>Bis<input class="inp wide" type="date" data-f="bis" value="${isoTag(new Date(Date.now() + 6 * 86400000))}"></label>`, 'urlaub-speichern', 'Eintragen')
          : `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${knopf('+ Zeitraum', 'urlaub-neu', '', 'btn small')}${knopf('Weihnachten (23.12.–06.01.)', 'urlaub-weihnachten')}</div>`}`
          : '<div class="muted">Kein Urlaubs-Kalender gewählt. Lege einen „Lokalen Kalender“ an (z. B. „Baustelle Urlaub“) und wähle ihn links unter „Kalender wählen“ aus.</div>'}
        </div></div>`;
    }
    if (this.ui.sub === 'meldungen') {
      const dienste = Object.keys((this._hass.services || {}).notify || {}).filter(d => d !== 'send_message').sort();
      const gewaehlt = Array.isArray(o.empfaenger) ? o.empfaenger : [];
      inhalt = `<div class="sec span2"><div class="heading">Meldungen an</div><div class="card">
        ${dienste.length ? `<div class="rows">${dienste.map(d => this.zeile('📱', esc(d.replace('mobile_app_', '')), 'notify.' + esc(d),
          `<input type="checkbox" data-f="empf" value="${esc(d)}" ${gewaehlt.includes(d) ? 'checked' : ''}>`)).join('')}</div>
          <div style="display:flex;gap:8px;margin-top:8px">${knopf('Speichern', 'meldungen-speichern', '', 'btn small')}<span class="btn flat small" data-press="${this.E(b, 'test_meldung')}">Test-Meldung senden</span></div>`
          : '<div class="muted">Keine Benachrichtigungsdienste gefunden. Installiere die Companion App am Handy und melde dich an – dann erscheint dein Handy hier.</div>'}</div></div>
        <div class="sec"><div class="heading">Wann gemeldet wird</div><div class="card klein">Bei aktiver Pumpenüberwachung: Pumpe offline, Trockenlauf, Dauerlauf und
          „Baustelle nicht erreichbar“ (Stromausfall oder Internet weg). Die Grenzwerte stellst du im Tab „Pumpen“ ein.</div></div>`;
    }
    return `<div class="sections"><div class="sec span3">
      <div style="display:flex;flex-wrap:wrap;gap:6px">${SUBS.map(([k, l]) => `<span class="btn small ${this.ui.sub === k ? '' : 'flat'}" data-ui="sub" data-wert="${k}">${l}</span>`).join('')}</div></div>${inhalt}</div>`;
  }

  _entitaeten(filter) {
    return Object.values(this._hass.states).filter(filter)
      .map(s => [s.entity_id, s.attributes.friendly_name || s.entity_id]).sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }

  _optionen(liste, aktuell, leer = false) {
    return (leer ? `<option value="">– keiner –</option>` : '')
      + liste.map(([e, n]) => `<option value="${esc(e)}" ${e === aktuell ? 'selected' : ''}>${esc(n)} (${esc(e)})</option>`).join('');
  }

  /* Einrichtungs-Dialoge von HA (dieselben wie unter Einstellungen → Geräte & Dienste) */
  async _dialog(pfad, start, daten) {
    const form = await this._hass.callApi('POST', pfad, start);
    if (form.type !== 'form') return form;
    return this._hass.callApi('POST', `${pfad}/${form.flow_id}`, daten);
  }

  async _ausfuehren(text, lauf) {
    try {
      const r = await lauf();
      const fehler = r && ((r.type === 'form' && r.errors && (r.errors.base || Object.values(r.errors)[0]))
        || (r.type === 'abort' && r.reason !== 'reconfigure_successful' && r.reason));
      if (fehler) { this._meldung(FEHLER[fehler] || fehler); return null; }
      this._meldung(text);
      this.ui.form = null;
      this._rendern();
      setTimeout(() => this._laden(), 1500);
      setTimeout(() => this._laden(), 5000);
      return r;
    } catch (err) {
      this._meldung((err && err.body && err.body.message) || (err && err.message) || String(err));
      return null;
    }
  }

  _optionenSpeichern(b, aenderung) {
    const o = { ...b.baustelle.optionen, ...aenderung };
    for (const k of Object.keys(o)) if (o[k] === '' || o[k] === null || o[k] === undefined) delete o[k];
    return this._ausfuehren('Gespeichert', () => this._dialog('config/config_entries/options/flow', { handler: b.baustelle.entry_id }, o));
  }

  _formWert(k) {
    const el = this.shadowRoot.querySelector(`[data-f="${k}"]`);
    if (!el) return undefined;
    return el.type === 'checkbox' ? el.checked : el.value;
  }

  _einstellungAktion(act, d, b) {
    const f = k => this._formWert(k);
    const id = b.baustelle.entry_id;
    const bereich = x => x ? { name: f('name').trim(), art: x.art, ...(f('fuehler') ? { fuehler: f('fuehler') } : {}) }
      : { name: f('name').trim(), art: f('art'), ...(f('fuehler') ? { fuehler: f('fuehler') } : {}) };
    switch (act) {
      case 'optionen': this.ui.form = { art: 'optionen', id: d.id }; return this._rendern();
      case 'neu': this.ui.form = { art: 'neu' }; return this._rendern();
      case 'wetter': case 'kalender': this.ui.form = { art: act }; return this._rendern();
      case 'bereich-neu': this.ui.form = { art: 'bereich' }; return this._rendern();
      case 'bereich-aendern': this.ui.form = { art: 'bereich', id: d.id }; return this._rendern();
      case 'bereich-loeschen': this.ui.form = { art: 'bereich-loeschen', id: d.id }; return this._rendern();
      case 'geraet-neu': this.ui.form = { art: 'geraet', bereich: d.bereich }; return this._rendern();
      case 'geraet-aendern': this.ui.form = { art: 'geraet', id: d.id }; return this._rendern();
      case 'geraet-loeschen': this.ui.form = { art: 'geraet-loeschen', id: d.id }; return this._rendern();
      case 'optionen-speichern': {
        const x = this.baustellen.find(y => y.baustelle.entry_id === this.ui.form.id);
        return this._optionenSpeichern(x, { status: f('status'), beginn: f('beginn'), ende: f('status') === 'abgeschlossen' ? f('ende') : '',
          heizung: f('heizung'), pumpen: f('pumpen'), heizperiode_von: f('heizperiode_von'), heizperiode_bis: f('heizperiode_bis') });
      }
      case 'wetter-speichern': return this._optionenSpeichern(b, { wetter: f('wetter'), temp_sensor: f('temp_sensor'), regen_sensor: f('regen_sensor') });
      case 'kalender-speichern': return this._optionenSpeichern(b, { feiertag_kalender: f('feiertag_kalender'), urlaub_kalender: f('urlaub_kalender') });
      case 'meldungen-speichern':
        return this._optionenSpeichern(b, { empfaenger: [...this.shadowRoot.querySelectorAll('[data-f="empf"]')].filter(x => x.checked).map(x => x.value) });
      case 'baustelle-anlegen': {
        if (!f('name').trim()) return this._meldung('Bitte einen Namen eingeben');
        return this._ausfuehren('Baustelle angelegt – jetzt Container anlegen', () => this._dialog('config/config_entries/flow',
          { handler: 'baustelle', show_advanced_options: false }, { name: f('name').trim(), beginn: f('beginn'), heizung: f('heizung'), pumpen: f('pumpen') }))
          .then(r => {
            if (!r) return;
            if (r.next_flow) this._hass.callApi('DELETE', `config/config_entries/subentries/flow/${r.next_flow[1]}`).catch(() => {});
            if (r.result && r.result.entry_id) { this.ui.bid = r.result.entry_id; this.ui.sub = 'diese'; }
          });
      }
      case 'bereich-speichern': {
        if (!f('name').trim()) return this._meldung('Bitte einen Namen eingeben');
        const x = b.bereiche.find(y => y.id === this.ui.form.id);
        return this._ausfuehren(x ? 'Gespeichert' : 'Angelegt', () => this._dialog('config/config_entries/subentries/flow',
          { handler: [id, 'bereich'], ...(x ? { subentry_id: x.id } : {}) }, bereich(x)));
      }
      case 'bereich-entfernen':
        return this._ausfuehren('Entfernt', () => this._hass.callWS({ type: 'config_entries/subentries/delete', entry_id: id, subentry_id: this.ui.form.id }));
      case 'geraet-speichern': {
        if (!f('schalter')) return this._meldung('Bitte einen Shelly wählen');
        const g = b.geraete.find(y => y.id === this.ui.form.id);
        const daten = { bereich: f('bereich'), schalter: f('schalter'), name: f('name').trim() || ROLLE[f('rolle')], rolle: f('rolle'), typ: f('typ') };
        return this._ausfuehren(g ? 'Gespeichert' : 'Shelly hinzugefügt', () => this._dialog('config/config_entries/subentries/flow',
          { handler: [id, 'geraet'], ...(g ? { subentry_id: g.id } : {}) }, daten));
      }
      case 'geraet-entfernen':
        return this._ausfuehren('Entfernt', () => this._hass.callWS({ type: 'config_entries/subentries/delete', entry_id: id, subentry_id: this.ui.form.id }));
      default: return undefined;
    }
  }

  /* ---------------------------------------------------------------- Bedienung */
  _klick(e) {
    const t = e.composedPath().find(x => x.dataset && (x.dataset.tab || x.dataset.toggle || x.dataset.press || x.dataset.act || x.dataset.href || (x.dataset.ui && x.dataset.wert !== undefined)));
    if (!t) return;
    const d = t.dataset;
    if (d.tab) { this.ui.tab = d.tab; this.ui.form = null; return this._rendern(); }
    if (d.toggle) { if (!t.classList.contains('dis')) this._dienst('homeassistant', this.an(d.toggle) ? 'turn_off' : 'turn_on', { entity_id: d.toggle }); return; }
    if (d.press) { this._dienst('button', 'press', { entity_id: d.press }); this._meldung('Test-Meldung gesendet'); return; }
    if (d.href) { history.pushState(null, '', d.href); window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } })); return; }
    if (d.ui) { this.ui[d.ui] = d.wert; this.ui.form = null; if (d.ui === 'bid') this.ui.scope = 'all'; return this._rendern(); }
    const b = this.B();
    switch (d.act) {
      case 'menu': this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true })); break;
      case 'urlaub-neu': this.ui.form = { art: 'urlaub' }; this._rendern(); break;
      case 'abbrechen': this.ui.form = null; this._rendern(); break;
      case 'urlaub-speichern': {
        const f = k => this.shadowRoot.querySelector(`[data-f="${k}"]`).value;
        this._urlaubEintragen(b, f('name') || 'Urlaub', f('von'), f('bis'));
        this.ui.form = null; break;
      }
      case 'urlaub-weihnachten': { const j = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear(); this._urlaubEintragen(b, 'Weihnachten', `${j}-12-23`, `${j + 1}-01-06`); break; }
      case 'urlaub-loeschen':
        this._hass.callWS({ type: 'calendar/event/delete', entity_id: b.baustelle.optionen.urlaub_kalender, uid: d.uid })
          .then(() => { delete this.cache[`k:${b.baustelle.optionen.urlaub_kalender}`]; this._planen(); }).catch(err => this._meldung('Löschen ging nicht: ' + err.message));
        break;
      default: this._einstellungAktion(d.act, d, b);
    }
  }

  _urlaubEintragen(b, name, von, bis) {
    if (!von || !bis || bis < von) return this._meldung('Bitte gültigen Zeitraum wählen');
    const ende = new Date(bis); ende.setDate(ende.getDate() + 1);
    this._dienst('calendar', 'create_event', { entity_id: b.baustelle.optionen.urlaub_kalender, summary: name, start_date: von, end_date: isoTag(ende) })
      .then(() => { delete this.cache[`k:${b.baustelle.optionen.urlaub_kalender}`]; this._planen(); });
  }

  _aenderung(e) {
    const t = e.composedPath()[0];
    const d = t.dataset || {};
    if (d.select) this._dienst('select', 'select_option', { entity_id: d.select, option: t.value });
    else if (d.num) { if (t.value !== '') this._dienst('number', 'set_value', { entity_id: d.num, value: Number(t.value) }); }
    else if (d.time) { if (t.value) this._dienst('time', 'set_value', { entity_id: d.time, time: t.value.length === 5 ? t.value + ':00' : t.value }); }
    else if (d.ui) { this.ui[d.ui] = t.value; this._rendern(); }
  }

  _dienst(domain, service, daten) {
    return this._hass.callService(domain, service, daten).catch(err => this._meldung(err.message || String(err)));
  }

  _meldung(text) { this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message: text }, bubbles: true, composed: true })); }

  _tooltip(e) {
    const tip = this.shadowRoot.querySelector('.tip');
    if (!tip) return;
    const pfad = e.composedPath();
    const cx = pfad.find(x => x.dataset && x.dataset.cx);
    this.shadowRoot.querySelectorAll('.cross').forEach(l => { if (!cx || l.id !== cx.dataset.cx + '-x') l.style.display = 'none'; });
    const zeigen = zeilen => {
      tip.replaceChildren(...zeilen.map(([v, n, c]) => { const r = document.createElement('div'); r.className = 'tr';
        if (c) { const k = document.createElement('i'); k.style.background = c; r.appendChild(k); }
        const b1 = document.createElement('b'); b1.textContent = v; r.appendChild(b1);
        if (n) { const s1 = document.createElement('span'); s1.textContent = ' ' + n; r.appendChild(s1); } return r; }));
      tip.style.display = 'block';
      tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px';
      tip.style.top = (e.clientY + 16 + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 16) + 'px';
    };
    if (cx) {
      const d = CX[cx.dataset.cx], svg = cx.ownerSVGElement, r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * d.W;
      const i = Math.max(0, Math.min(d.n - 1, Math.round((vx - d.L) / d.pw * (d.n - 1)))), X = d.L + (d.n === 1 ? d.pw / 2 : d.pw * i / (d.n - 1));
      const ln = svg.querySelector('.cross'); if (ln) { ln.setAttribute('x1', X); ln.setAttribute('x2', X); ln.style.display = ''; }
      return zeigen([[d.labels[i], '', ''], ...d.series.map(q => [`${de(q.values[i], d.dec)} ${d.unit}`, q.name, q.color.startsWith('var') ? getComputedStyle(this).getPropertyValue(q.color.slice(4, -1)) : q.color])]);
    }
    const t = pfad.find(x => x.dataset && x.dataset.tip);
    if (!t) { tip.style.display = 'none'; return; }
    const [v, n] = t.dataset.tip.split('|'); zeigen([[v, n, '']]);
  }
}

if (!customElements.get('baustelle-panel')) customElements.define('baustelle-panel', BaustellePanel);
