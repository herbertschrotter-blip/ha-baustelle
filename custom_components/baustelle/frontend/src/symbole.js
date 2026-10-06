// Symbole der Seite „Baustelle“: Wettersymbole, Container-/Schacht-Grafik, SVG-Icons (BSM-022 Stufe 1a).
import { de, esc } from './hilfen.js';

/* Realistische, animierte Wettersymbole (eigene SVGs mit Filtern, ohne externe Dateien; von Herbert gewählt 29.09.2026).
   Bedingungen wie in HA (weather.*). */
const R_DEFS = `<defs>
  <filter id="wrFluff" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="3" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".45"/></filter>
  <filter id="wrWeich" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
  <filter id="wrGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="wrNebel" x="-20%" y="-50%" width="140%" height="200%"><feTurbulence type="fractalNoise" baseFrequency=".05 .18" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="6"/><feGaussianBlur stdDeviation="1.2"/></filter>
  <radialGradient id="wrKern" cx="45%" cy="42%" r="60%"><stop offset="0" stop-color="#fffef2"/><stop offset=".45" stop-color="#ffe680"/><stop offset="1" stop-color="#ff9f0a"/></radialGradient>
  <radialGradient id="wrKorona"><stop offset="0" stop-color="#fff3b0" stop-opacity=".85"/><stop offset=".5" stop-color="#ffd54f" stop-opacity=".35"/><stop offset="1" stop-color="#ffb300" stop-opacity="0"/></radialGradient>
  <linearGradient id="wrStrahl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6c8" stop-opacity=".75"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></linearGradient>
  <radialGradient id="wrWeiss" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef2f5"/><stop offset="1" stop-color="#b6c2cb"/></radialGradient>
  <radialGradient id="wrGrau" cx="38%" cy="25%" r="85%"><stop offset="0" stop-color="#cfd8dc"/><stop offset=".5" stop-color="#8d9ca6"/><stop offset="1" stop-color="#4b5a64"/></radialGradient>
  <linearGradient id="wrRegen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec5ff" stop-opacity="0"/><stop offset="1" stop-color="#3d8be0"/></linearGradient>
  <radialGradient id="wrEis" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9cc9ee"/></radialGradient>
  <radialGradient id="wrMond" cx="38%" cy="35%" r="75%"><stop offset="0" stop-color="#fffbe6"/><stop offset=".7" stop-color="#f3e3a8"/><stop offset="1" stop-color="#d6c07a"/></radialGradient></defs>`;

const R_WOLKE_TEILE = [[22, 34, 10], [32, 27, 13], [43, 32, 10.5], [14, 40, 7], [51, 40, 7.5]];

function rWolke(dx = 0, dy = 0, s = 1, dunkel = false) {
  const kreise = f => R_WOLKE_TEILE.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`).join('') + `<ellipse cx="32" cy="42" rx="21" ry="7" fill="${f}"/>`;
  return `<g class="wi-wolke" transform="translate(${dx} ${dy}) scale(${s})"><g transform="translate(1.5 3)" opacity=".22" filter="url(#wrWeich)">${kreise('#233')}</g>
    <g filter="url(#wrFluff)">${kreise(`url(#${dunkel ? 'wrGrau' : 'wrWeiss'})`)}</g></g>`;
}

function rSonne(cx = 32, cy = 32, r = 11) {
  return `<circle class="wb-puls" cx="${cx}" cy="${cy}" r="${r * 2.2}" fill="url(#wrKorona)"/>
    <g class="wi-dreh" style="transform-origin:${cx}px ${cy}px" opacity=".9">${[...Array(12)].map((_, i) =>
      `<polygon points="${cx},${cy - 1.2} ${cx + r * 2.6},${cy} ${cx},${cy + 1.2}" fill="url(#wrStrahl)" transform="rotate(${i * 30} ${cx} ${cy})"/>`).join('')}</g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#wrKern)" filter="url(#wrGlow)"/>
    <circle cx="${cx + r * 1.6}" cy="${cy + r * 1.5}" r="2.2" fill="#fff" opacity=".3"/><circle cx="${cx + r * 2.2}" cy="${cy + r * 2.1}" r="1.3" fill="#fff" opacity=".25"/>`;
}

export function wetterIcon(zustand, groesse = 64) {
  const regen = (n, schnell) => [...Array(n)].map((_, i) => { const x = 20 + i * (26 / Math.max(1, n - 1));
    return `<line class="wi-tropfen" style="animation-delay:${(i * 0.23).toFixed(2)}s;animation-duration:${schnell ? .7 : 1}s" x1="${x + 2}" y1="44" x2="${x - 1}" y2="55" stroke="url(#wrRegen)" stroke-width="1.8" stroke-linecap="round"/>`; }).join('');
  const kristall = (x, y, i) => `<g class="wi-flocke" style="animation-delay:${(i * 0.8).toFixed(1)}s"><g class="wr-kristall" style="transform-origin:${x}px ${y}px">
    ${[0, 60, 120].map(w => `<g transform="rotate(${w} ${x} ${y})" stroke="#e8f4ff" stroke-width="1.1" stroke-linecap="round"><line x1="${x}" y1="${y - 4}" x2="${x}" y2="${y + 4}"/>
      <line x1="${x}" y1="${y - 2.4}" x2="${x - 1.4}" y2="${y - 3.6}"/><line x1="${x}" y1="${y - 2.4}" x2="${x + 1.4}" y2="${y - 3.6}"/>
      <line x1="${x}" y1="${y + 2.4}" x2="${x - 1.4}" y2="${y + 3.6}"/><line x1="${x}" y1="${y + 2.4}" x2="${x + 1.4}" y2="${y + 3.6}"/></g>`).join('')}
    <circle cx="${x}" cy="${y}" r="1" fill="#fff"/></g></g>`;
  const blitz = `<g class="wi-blitz" filter="url(#wrGlow)"><path d="M34 38l-7 9 5 .5-5 10 11-12-5-.5 5-7z" fill="#fffde7" stroke="#b39ddb" stroke-width=".8" stroke-linejoin="round"/></g>`;
  const nebel = `<g filter="url(#wrNebel)" opacity=".85">${[46, 52, 58].map((y, i) => `<rect class="wi-nebel" style="animation-delay:${i * 1.1}s" x="${8 + i * 2}" y="${y - 3}" width="${48 - i * 4}" height="6" rx="3" fill="var(--wr-nebel)"/>`).join('')}</g>`;
  const mond = `<circle cx="34" cy="30" r="21" fill="url(#wrKorona)" opacity=".45"/><circle cx="34" cy="30" r="15" fill="url(#wrMond)" filter="url(#wrGlow)"/>
    ${[[29, 25, 2.6], [39, 33, 2], [33, 37, 1.6], [37, 23, 1.3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#cbb46a" opacity=".45"/>`).join('')}
    ${[[10, 12], [18, 50], [54, 10], [56, 50], [8, 34]].map(([x, y], i) => `<circle class="wi-stern" style="animation-delay:${i * 0.6}s" cx="${x}" cy="${y}" r="1.1" fill="#fff8e1" filter="url(#wrGlow)"/>`).join('')}`;
  const wind = `<g fill="none" stroke="var(--wr-wind)" stroke-linecap="round" filter="url(#wrWeich)" opacity=".8">${[[24, 40, 3], [34, 48, 2.2], [44, 34, 1.6]].map(([y, l, w], i) =>
    `<path class="wi-wind" style="animation-delay:${i * .6}s" d="M${6 + i * 3} ${y}q${l / 2} -5 ${l} 0" stroke-width="${w}"/>`).join('')}</g>`;
  const hagel = [0, 1, 2, 3].map(i => `<circle class="wi-tropfen" style="animation-delay:${i * 0.3}s" cx="${20 + i * 8}" cy="52" r="2.3" fill="url(#wrEis)"/>`).join('');
  const t = {
    sunny: rSonne(32, 32, 11), exceptional: rSonne(32, 32, 11), 'clear-night': mond,
    partlycloudy: rSonne(23, 21, 8.5) + rWolke(5, 6, 0.9), 'partlycloudy-night': `<g transform="translate(2 1) scale(.7)">${mond}</g>` + rWolke(5, 6, 0.9), cloudy: rWolke(-9, -8, 0.8, true) + rWolke(4, 2, 0.95),
    fog: rWolke(0, -9, 0.85) + nebel, rainy: rWolke(0, -8) + regen(4), pouring: rWolke(0, -8, 1, true) + regen(7, true),
    snowy: rWolke(0, -8) + [0, 1, 2].map(i => kristall(22 + i * 10, 51, i)).join(''),
    'snowy-rainy': rWolke(0, -8) + regen(2) + kristall(36, 51, 1), hail: rWolke(0, -8, 1, true) + hagel,
    lightning: rWolke(0, -10, 1, true) + blitz, 'lightning-rainy': rWolke(0, -10, 1, true) + regen(3) + blitz,
    windy: wind, 'windy-variant': rWolke(0, -10, 0.8) + wind,
  };
  return `<svg class="wi wr" viewBox="0 0 64 64" width="${groesse}" height="${groesse}" overflow="visible" role="img" aria-label="${esc(zustand)}">${R_DEFS}${t[zustand] || rWolke(0, -4)}</svg>`;
}

/* Baustellen-Illustrationen: Baucontainer (3D, Zustand) und Pumpenschacht – aus dem Entwurf „Baustellenübersicht“. */
export const BEREICH_FARBEN = ['#3987e5', '#eb6834', '#1baf7a', '#c98500', '#d55181', '#199e70'];

/* Container-Symbol (BSM-032, Mockup container-symbol.html): Einzel/Doppel, Türen 1–2 und Fenster 1–4 an Front oder Seite,
   Farbe; Zustand fertig von der Integration (laufzeit.container.<id>.symbol): Tür offen (Version A), Fenster gekippt (A)
   bzw. offen (B), Licht an (A). Ohne Symbol: eine Tür links, ein Fenster. */
export const SYMBOL_STANDARD = { doppel: false, farbe: null, rahmen: null, tueren: [{ wand: 'front', pos: .15 }], fenster: [{ wand: 'front', pos: .67 }], licht_an: false };

export function bcContainer(f, zustand, b) {
  const s = (b && b.symbol) || SYMBOL_STANDARD, farbe = s.farbe || f, dop = !!s.doppel;
  const heizt = ['heizt', 'trocknen', 'frost'].includes(zustand), off = zustand === 'offline', licht = !!s.licht_an;
  const DUNKEL = '#141414', LICHT = '#ffe9a8';
  const dunkler = `color-mix(in srgb, ${farbe} 70%, #000)`, heller = `color-mix(in srgb, ${farbe} 75%, #fff)`;
  const SL = dop ? 80 : 50, sdy = SL * -18 / 50, dy = dop ? 11 : 0, W = dop ? 200 : 170, H = dop ? 131 : 120;   // Doppel: Front 6 m, Seite knapp 5 m
  const wand = w => w === 'seite' ? { x0: 106, y0: 50, L: SL, n: -18 / 50 } : { x0: 22, y0: 30, L: 84, n: 20 / 84 };
  const para = (x, y, bb, d, h, attr) => `<path d="M${x} ${y}l${bb} ${d}v${h}l${-bb} ${-d}z" ${attr}/>`;
  // Aufteilung je Wand (Herbert 06.10.2026): fester Rand; Türen sitzen fest links, mittig oder rechts; Fenster teilen
  // sich gleichmäßig den Platz daneben (in der Reihenfolge ihrer Lage, alle gleich breit), ein einzelnes an seiner Lage
  const RAND = 8, TB = 14, FB = 20, LUFT = 5, platz = new Map();
  for (const w of ['front', 'seite']) {
    const L = wand(w).L, an = el => (el.wand === 'seite' ? 'seite' : 'front') === w;
    const tl = (s.tueren || []).filter(an).sort((a, b) => a.pos - b.pos), fl = (s.fenster || []).filter(an).sort((a, b) => a.pos - b.pos);
    const belegt = [];
    for (const t of tl) {   // links | Mitte | rechts; zwei an derselben Stelle rücken nebeneinander
      let c = t.pos < .4 ? RAND + TB / 2 : t.pos > .6 ? L - RAND - TB / 2 : L / 2;
      while (belegt.some(([v, b]) => c > v - TB / 2 - LUFT && c < b + TB / 2 + LUFT)) c += (t.pos > .6 ? -1 : 1) * (TB + LUFT);
      platz.set(t, { c, bb: TB }); belegt.push([c - TB / 2, c + TB / 2]);
    }
    let frei = [[RAND, L - RAND]];   // freie Strecken neben den Türen
    for (const [v, b] of belegt) frei = frei.flatMap(([x, y]) => b + LUFT <= x || v - LUFT >= y ? [[x, y]] : [[x, v - LUFT], [b + LUFT, y]]).filter(([x, y]) => y - x >= 10);
    if (!fl.length || !frei.length) continue;
    if (fl.length === 1 && !tl.length) { const bb = FB; platz.set(fl[0], { c: RAND + bb / 2 + Math.max(0, Math.min(1, (fl[0].pos - .15) / .7)) * (L - 2 * RAND - bb), bb }); continue; }
    const ges = frei.reduce((a, [x, y]) => a + y - x, 0), anz = frei.map(([x, y]) => fl.length * (y - x) / ges);
    const n = anz.map(Math.floor); let rest = fl.length - n.reduce((a, b) => a + b, 0);
    anz.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { n[i]++; rest--; } });
    let k = 0;
    frei.forEach(([x, y], i) => { const slot = (y - x) / (n[i] || 1);
      for (let j = 0; j < n[i]; j++) platz.set(fl[k++], { c: x + slot * (j + .5), bb: Math.max(8, Math.min(FB, slot - LUFT)) }); });
  }
  const lage = el => { const p0 = platz.get(el), g = wand(el.wand), x = g.x0 + p0.c - p0.bb / 2; return { x, y: g.y0 + (x - g.x0) * g.n, n: g.n, bb: p0.bb }; };
  const fenster = fe => {
    const a = lage(fe), bb = a.bb, h = 21, x = a.x, y = a.y + 17, d = bb * a.n, zst = fe.zustand || 'zu';   // Fenster in halber Höhe
    let r = para(x - 1.6, y - 1.6, bb + 3.2, d, h + 3.2, 'fill="var(--rahmen)"');
    if (zst === 'offen') return r + para(x, y, bb, d, h, `fill="${licht ? `color-mix(in srgb, ${LICHT} 55%, #000)` : DUNKEL}"`)
      + para(x - 9, y + 2, 9, d * .2 - 2, h, 'fill="var(--fenster)" stroke="var(--rahmen)" stroke-width="1.4" opacity=".95"');   // Flügel nach außen
    r += para(x, y, bb, d, h, `class="${licht ? 'bc-licht' : heizt ? 'bc-glut' : ''}" fill="${licht ? LICHT : heizt ? '#ffb74d' : 'var(--fenster)'}"`);
    if (zst === 'gekippt') r += para(x, y, bb, d, 4, `fill="${DUNKEL}" opacity=".8"`) + `<path d="M${x - 1} ${y + 4}l${bb + 2} ${d}" stroke="var(--rahmen)" stroke-width="1.6"/>`;
    else r += `<path d="M${x + bb / 2} ${y + bb / 2 * a.n}v${h}" stroke="var(--rahmen)" stroke-width="1.4"/>`;
    if (!licht) r += `<path d="M${x + 2.5} ${y + 3}l${bb * .35} ${d * .35 + 7}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="${heizt ? .25 : .35}"/>`;
    return `<g>${r}</g>`;
  };
  const tuer = t => {
    const a = lage(t), bb = a.bb, h = 46, x = a.x, y = a.y + 9, d = bb * a.n;   // bis knapp über den Boden
    if (t.offen) return para(x, y, bb, d, h, `fill="${licht ? `color-mix(in srgb, ${LICHT} 60%, #000)` : DUNKEL}" stroke="var(--rahmen)" stroke-width="1.2"`)
      + `<path d="M${x} ${y}l-7 ${5 - d * .2}v${h}l7 -5z" fill="${dunkler}" stroke="var(--rahmen)" stroke-width="1.2"/>`;   // Türblatt nach außen
    return para(x, y, bb, d, h, `fill="${dunkler}" stroke="var(--rahmen)" stroke-width="1.2"`)
      + `<path d="M${x + 3} ${y + 4 + 3 * a.n}l8 ${8 * a.n}v7l-8 ${-8 * a.n}z" fill="${licht ? LICHT : heizt ? '#ffcc80' : 'var(--fenster)'}" opacity=".9"/>`
      + `<circle cx="${x + bb - 2.5}" cy="${y + d + 24}" r="1.2" fill="#e0e0e0"/>`;
  };
  const rippen = (w, k) => { const g = wand(w), n = Math.round(g.L / (w === 'front' ? 10.5 : 9)); let r = '';
    for (let j = 1; j < n; j++) { const x = g.x0 + j * g.L / n; r += `<path d="M${x} ${g.y0 + (x - g.x0) * g.n + 1}v58" stroke="rgba(0,0,0,${k})" stroke-width="1.4"/>`; } return r; };
  const naht = dop ? `<path d="M${106 + SL / 2} ${50 + sdy / 2}v58" stroke="rgba(0,0,0,.45)" stroke-width="2.2"/><path d="M${22 + SL / 2} ${30 + sdy / 2}l84 20" stroke="rgba(0,0,0,.3)" stroke-width="1.6"/>` : '';
  // Stahlrahmen in eigener Farbe (Herbert 06.10.2026), etwa maßstäblich: 20 cm ≈ 3 Einheiten Pfosten (Front 84 = 6,05 m),
  // gut 4 Einheiten Rahmen oben und unten (Höhe 58 ≈ 2,6 m); Seite dunkler wie die Wand, Dachkante heller
  const rahmen = (() => { const r = s.rahmen; if (!r) return '';
    const P = 3, R = 4.3, nf = 20 / 84, ns = -18 / 50, rs = `color-mix(in srgb, ${r} 72%, #000)`, rh = `color-mix(in srgb, ${r} 80%, #fff)`;
    const band = (x, y, l, d, h, f) => `<path d="M${x} ${y}l${l} ${d}v${h}l${-l} ${-d}z" fill="${f}"/>`;
    const pfosten = (x, y, n, f) => band(x, y, P, P * n, 58, f);
    return band(22, 30, 84, 20, R, r) + band(22, 88 - R, 84, 20, R, r)                                  // Front oben, unten
      + band(106, 50, SL, sdy, R, rs) + band(106, 108 - R, SL, sdy, R, rs)                              // Seite oben, unten
      + pfosten(22, 30, nf, r) + pfosten(106 - P, 50 - P * nf, nf, r) + pfosten(106, 50, ns, rs)         // Front links, Ecke
      + pfosten(106 + SL - P, 50 + (SL - P) * ns, ns, rs)                                               // Seite rechts
      + (dop ? pfosten(106 + SL / 2 - P / 2, 50 + (SL / 2 - P / 2) * ns, ns, rs) : '')                // Naht beim Doppel
      + `<path d="M22 30l${SL} ${sdy} 84 20" fill="none" stroke="${rh}" stroke-width="2.4" stroke-linejoin="round"/>`; })();
  const mx = dop ? 15 : 0, my = sdy / 2 + 9;   // Wellen und Eis über dem Dach
  return `<svg class="bc ${off ? 'offline' : ''}" viewBox="0 0 ${W} ${H}" style="--f:${farbe}"><g transform="translate(0 ${dy})">
    <ellipse cx="${86 + SL / 2 - 25}" cy="104" rx="${70 + SL / 2 - 25}" ry="9" fill="#000" opacity=".22"/>
    <path d="M22 88l84 20 ${SL} ${sdy}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="4" stroke-linecap="round"/>
    <path d="M106 50l${SL} ${sdy}v58l${-SL} ${-sdy}z" fill="${dunkler}"/>${rippen('seite', .18)}
    <path d="M22 30l84 20v58l-84-20z" fill="${farbe}"/>${rippen('front', .14)}
    <path d="M22 30l${SL} ${sdy} 84 20 ${-SL} ${-sdy}z" fill="${heller}"/><path d="M22 30l84 20 ${SL} ${sdy}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>
    ${naht}${rahmen}${(s.tueren || []).map(tuer).join('')}${(s.fenster || []).map(fenster).join('')}
    ${zustand === 'trocknen' ? '<g class="bc-jacke" style="transform-origin:88.5px 42px"><path d="M84 44l3-2h3l3 2-1.4 3-1.4-.6v6h-5.6v-6l-1.4.6z" fill="#1565c0"/></g>' : ''}
    ${heizt && zustand !== 'frost' ? [0, 1, 2].map(k => `<path class="bc-waerme" style="animation-delay:${k * .7}s" d="M${62 + k * 18 + mx} ${24 - k + my} q4 -5 0 -10 q-4 -5 0 -10" fill="none" stroke="#ff9800" stroke-width="2.2" stroke-linecap="round"/>`).join('') : ''}
    ${zustand === 'frost' ? [0, 1, 2].map(k => `<g class="bc-eis" style="animation-delay:${k * .6}s" transform="translate(${60 + k * 22 + mx} ${16 - k * 2 + my})" stroke="#bbdefb" stroke-width="1.6" stroke-linecap="round">
      <line x1="-4" y1="0" x2="4" y2="0"/><line x1="-2" y1="-3.5" x2="2" y2="3.5"/><line x1="-2" y1="3.5" x2="2" y2="-3.5"/></g>`).join('') : ''}
    ${off ? `<g class="bc-alarm"><circle cx="${W - 30}" cy="20" r="11" fill="#d03b3b"/><path d="M${W - 30} 13v9" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="${W - 30}" cy="27" r="1.8" fill="#fff"/></g>` : ''}
  </g></svg>`;
}

export function bcSchacht(laeuft) {
  return `<svg class="bc" viewBox="0 0 170 120">
    <ellipse cx="85" cy="104" rx="56" ry="10" fill="#000" opacity=".22"/>
    <defs><clipPath id="bcSch"><path d="M40 30v62a45 12 0 0 0 90 0V30z"/></clipPath>
      <linearGradient id="bcBeton" x1="0" x2="1"><stop offset="0" stop-color="#8d9ca6"/><stop offset=".5" stop-color="#cfd8dc"/><stop offset="1" stop-color="#78909c"/></linearGradient>
      <linearGradient id="bcWasser" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#64b5f6"/><stop offset="1" stop-color="#0d47a1"/></linearGradient></defs>
    <path d="M40 30v62a45 12 0 0 0 90 0V30z" fill="url(#bcBeton)"/>
    <g clip-path="url(#bcSch)"><g class="${laeuft ? 'bc-pegel' : ''}"><path class="bc-welle" d="M0 70q15-5 30 0t30 0 30 0 30 0 30 0 30 0 30 0v60H0z" fill="url(#bcWasser)" opacity=".92"/></g>
      <g transform="translate(85 86)"><circle r="10" fill="#37474f"/><g class="${laeuft ? 'bc-rad' : ''}"><path d="M0 0l0-8M0 0l7 4M0 0l-7 4" stroke="#b0bec5" stroke-width="3" stroke-linecap="round"/></g></g></g>
    <ellipse cx="85" cy="30" rx="45" ry="12" fill="#546e7a"/><ellipse cx="85" cy="30" rx="38" ry="9" fill="#263238"/>
    <path d="M85 76V10h32" fill="none" stroke="#90a4ae" stroke-width="5"/><path class="${laeuft ? 'bc-fluss' : ''}" d="M85 76V10h32" fill="none" stroke="#64b5f6" stroke-width="2.4"/>
  </svg>`;
}

export const ICON_MELDEN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 5h16v11H9l-5 4z"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 8v3.5M12 13.6v.2"/></svg>';

// mdi:cog – dasselbe Zahnrad wie in Home Assistant
export const ICON_COG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>';

/* Symbole für runde Knöpfe als SVG – Schriftzeichen (−, +, ⏻) sitzen je nach Schrift außermittig (WU-0004) */
export const IC_MINUS = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

export const IC_PLUS = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

export const IC_POWER = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M7.3 7.2a7 7 0 1 0 9.4 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

/* AN-0009: WLAN-Signal in 4 Strichen (übliche Stufen ab −55 / −67 / −75 / −85 dBm) – Geräteliste und Kachel */
export const sigStufe = db => db >= -55 ? 4 : db >= -67 ? 3 : db >= -75 ? 2 : db >= -85 ? 1 : 0;

export const sigHtml = db => { const n4 = sigStufe(db);
  return `<span class="ger-sig s${n4}" title="Signal ${de(db, 0)} dBm" aria-label="Signal ${n4} von 4">${[1, 2, 3, 4].map(k => `<i class="${k <= n4 ? 'an' : ''}"></i>`).join('')}</span>`; };
