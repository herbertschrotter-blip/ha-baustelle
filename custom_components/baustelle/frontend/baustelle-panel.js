/* =========================================================================================
   Baustelle – eigene Seite in Home Assistant (0.7.0), gebaut aus dem abgenommenen Mockup mockups/glas.html
   (Quellen mockups/quelle/: glas-app.js, glas.css, himmel.frag, himmel.js).
   Daten: WebSocket „baustelle/struktur“ (docs/api-0.7.md §1), Verlauf/Statistik aus dem Recorder.
   Bedienung: baustelle/setzen|aktion|liste|protokoll|meldung(en) (api §2) und die HA-Standardwege
   (Subentry-/Options-Dialoge, calendar/event/*, Diagnose). Gerechnet wird in der Integration, nicht hier.
   ========================================================================================= */

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
function wetterIcon(zustand, groesse = 64) {
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
    partlycloudy: rSonne(23, 21, 8.5) + rWolke(5, 6, 0.9), cloudy: rWolke(-9, -8, 0.8, true) + rWolke(4, 2, 0.95),
    fog: rWolke(0, -9, 0.85) + nebel, rainy: rWolke(0, -8) + regen(4), pouring: rWolke(0, -8, 1, true) + regen(7, true),
    snowy: rWolke(0, -8) + [0, 1, 2].map(i => kristall(22 + i * 10, 51, i)).join(''),
    'snowy-rainy': rWolke(0, -8) + regen(2) + kristall(36, 51, 1), hail: rWolke(0, -8, 1, true) + hagel,
    lightning: rWolke(0, -10, 1, true) + blitz, 'lightning-rainy': rWolke(0, -10, 1, true) + regen(3) + blitz,
    windy: wind, 'windy-variant': rWolke(0, -10, 0.8) + wind,
  };
  return `<svg class="wi wr" viewBox="0 0 64 64" width="${groesse}" height="${groesse}" overflow="visible" role="img" aria-label="${esc(zustand)}">${R_DEFS}${t[zustand] || rWolke(0, -4)}</svg>`;
}

/* Baustellen-Illustrationen: Baucontainer (3D, Zustand) und Pumpenschacht – aus dem Entwurf „Baustellenübersicht“. */
const BEREICH_FARBEN = ['#3987e5', '#eb6834', '#1baf7a', '#c98500', '#d55181', '#199e70'];
function bcContainer(f, zustand) {
  const heizt = ['heizt', 'trocknen', 'frost'].includes(zustand), off = zustand === 'offline';
  const dunkler = `color-mix(in srgb, ${f} 70%, #000)`, heller = `color-mix(in srgb, ${f} 75%, #fff)`;
  const neig = 20 / 84, obenY = x => 30 + (x - 22) * neig;          // Oberkante der Front bei x
  const fenster = (x, b = 17, h = 15) => { const y = obenY(x) + 11, d = b * neig;
    return `<g>
      <path d="M${x - 1.6} ${y - 1.6}l${b + 3.2} ${d + .8}v${h + 3.2}l${-(b + 3.2)} ${-(d + .8)}z" fill="var(--rahmen)"/>
      <path d="M${x} ${y}l${b} ${d}v${h}l${-b} ${-d}z" class="${heizt ? 'bc-glut' : ''}" fill="${heizt ? '#ffb74d' : 'var(--fenster)'}"/>
      <path d="M${x + b / 2} ${y + d / 2}v${h}" stroke="var(--rahmen)" stroke-width="1.4"/>
      <path d="M${x + 2.5} ${y + 3}l${b * .35} ${d * .35 + 7}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="${heizt ? .25 : .35}"/>
      <path d="M${x - 1.6} ${y + h + 1.6}l${b + 3.2} ${d + .8}" stroke="rgba(0,0,0,.35)" stroke-width="1.6"/></g>`; };
  return `<svg class="bc ${off ? 'offline' : ''}" viewBox="0 0 170 120" style="--f:${f}">
    <ellipse cx="86" cy="104" rx="70" ry="9" fill="#000" opacity=".22"/>
    
    <path d="M22 88l84 20 50-18" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="4" stroke-linecap="round"/>
    
    <path d="M106 50l50-18v58l-50 18z" fill="${dunkler}"/>
    ${[0, 1, 2, 3, 4].map(k => `<path d="M${112 + k * 9} ${47.8 - k * 3.2}v58" stroke="rgba(0,0,0,.18)" stroke-width="1.4"/>`).join('')}
    
    <path d="M22 30l84 20v58l-84-20z" fill="${f}"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M${28 + k * 10.5} ${31.4 + k * 2.5}v58" stroke="rgba(0,0,0,.14)" stroke-width="1.4"/>`).join('')}
    
    <path d="M22 30l50-18 84 20-50 18z" fill="${heller}"/><path d="M22 30l84 20 50-18" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>
    
    <path d="M${34} ${obenY(34) + 9}l14 ${14 * neig}v${44}l-14 ${-14 * neig}z" fill="${dunkler}" stroke="var(--rahmen)" stroke-width="1.2"/>
    <path d="M${37} ${obenY(37) + 13}l8 ${8 * neig}v7l-8 ${-8 * neig}z" fill="${heizt ? '#ffcc80' : 'var(--fenster)'}" opacity=".9"/>
    <circle cx="45.5" cy="${obenY(45.5) + 33}" r="1.2" fill="#e0e0e0"/>
    ${fenster(56)}${fenster(80)}
    ${zustand === 'trocknen' ? `<g class="bc-jacke" style="transform-origin:88.5px ${obenY(88) + 12}px"><path d="M84 ${obenY(88) + 14}l3-2h3l3 2-1.4 3-1.4-.6v6h-5.6v-6l-1.4.6z" fill="#1565c0"/></g>` : ''}
    ${heizt && zustand !== 'frost' ? [0, 1, 2].map(k => `<path class="bc-waerme" style="animation-delay:${k * .7}s" d="M${62 + k * 18} ${24 - k * 1} q4 -5 0 -10 q-4 -5 0 -10" fill="none" stroke="#ff9800" stroke-width="2.2" stroke-linecap="round"/>`).join('') : ''}
    ${zustand === 'frost' ? [0, 1, 2].map(k => `<g class="bc-eis" style="animation-delay:${k * .6}s" transform="translate(${60 + k * 22} ${16 - k * 2})" stroke="#bbdefb" stroke-width="1.6" stroke-linecap="round">
      <line x1="-4" y1="0" x2="4" y2="0"/><line x1="-2" y1="-3.5" x2="2" y2="3.5"/><line x1="-2" y1="3.5" x2="2" y2="-3.5"/></g>`).join('') : ''}
    ${off ? `<g class="bc-alarm"><circle cx="140" cy="20" r="11" fill="#d03b3b"/><path d="M140 13v9" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="140" cy="27" r="1.8" fill="#fff"/></g>` : ''}
  </svg>`;
}

function bcSchacht(laeuft) {
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

const CSS = `/* Wetter */
.wetter .wjetzt { display: flex; align-items: center; gap: 14px; }
.wetter .wjetzt .big { font-size: 34px; line-height: 1.1; }
.wetter .wtage { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; border-top: 1px solid var(--divider-color); padding-top: 10px; }
.wetter .wtag { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.wetter .wt { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
.wetter .max { font-weight: 600; }
.wetter .frost { color: #2a78d6; font-weight: 600; }
.wetter .regen { color: #2a78d6; }
@keyframes wi-dreh { to { transform: rotate(360deg); } }
@keyframes wi-wolke { 0%, 100% { transform: translateX(-1.5px); } 50% { transform: translateX(1.5px); } }
@keyframes wi-tropfen { 0% { transform: translateY(-5px); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateY(9px); opacity: 0; } }
@keyframes wi-flocke { 0% { transform: translate(-1px, -5px); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(2px, 9px); opacity: 0; } }
@keyframes wi-blitz { 0%, 86%, 100% { opacity: .15; } 88%, 93% { opacity: 1; } 90% { opacity: .3; } }
@keyframes wi-nebel { 0%, 100% { transform: translateX(-3px); } 50% { transform: translateX(3px); } }
@keyframes wi-stern { 50% { opacity: .2; } }
@keyframes wi-wind { 0% { stroke-dashoffset: 60; } 100% { stroke-dashoffset: 0; } }
.wi .wi-dreh { animation: wi-dreh 18s linear infinite; }
.wi .wi-wolke > g { animation: wi-wolke 6s ease-in-out infinite; }
.wr .wr-kristall { transform-box: fill-box; animation: wi-dreh 6s linear infinite; }
@keyframes wb-puls { 0%, 100% { opacity: .55; transform: scale(.94); } 50% { opacity: 1; transform: scale(1.06); } }
.wi .wb-puls { transform-box: fill-box; transform-origin: center; animation: wb-puls 3.5s ease-in-out infinite; }
.wi .wi-tropfen { animation: wi-tropfen 1.3s linear infinite; }
.wi .wi-flocke { animation: wi-flocke 2.6s linear infinite; }
.wi .wi-blitz { animation: wi-blitz 3.2s linear infinite; }
.wi .wi-nebel { animation: wi-nebel 5s ease-in-out infinite; }
.wi .wi-stern { animation: wi-stern 2.4s ease-in-out infinite; }
.wi .wi-wind { stroke-dasharray: 60; animation: wi-wind 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .wi * { animation: none !important; } }

/* Übersicht: Baustelle und Container als Kacheln */
.bc { width: 100%; height: auto; display: block; overflow: visible; } .bc.offline { filter: grayscale(.8) brightness(.8); }
@keyframes rein { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes atmen { 50% { opacity: .55; } }
@keyframes fuellen { from { width: 0; } }
@keyframes blitz { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12) rotate(-6deg); } }
.bc-glut { animation: bc-glut 2.6s ease-in-out infinite; } @keyframes bc-glut { 50% { fill: #ffd180; filter: drop-shadow(0 0 4px #ff9800); } }
.bc-waerme { animation: bc-waerme 2.1s ease-in infinite; opacity: 0; } @keyframes bc-waerme { 0% { transform: translateY(6px); opacity: 0; } 30% { opacity: .9; } 100% { transform: translateY(-12px); opacity: 0; } }
.bc-jacke { animation: bc-jacke 2.4s ease-in-out infinite; } @keyframes bc-jacke { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
.bc-eis { animation: bc-eis 2s ease-in-out infinite; } @keyframes bc-eis { 50% { opacity: .3; } }
.bc-alarm { animation: bc-alarm 1s steps(2) infinite; } @keyframes bc-alarm { 50% { opacity: .25; } }
.bc-pegel { animation: bc-pegel 5s ease-in-out infinite; } @keyframes bc-pegel { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
.bc-welle { animation: bc-welle 3s linear infinite; } @keyframes bc-welle { to { transform: translateX(-60px); } }
.bc-rad { animation: bc-rad .9s linear infinite; transform-box: fill-box; transform-origin: center; } @keyframes bc-rad { to { transform: rotate(360deg); } }
.bc-fluss { stroke-dasharray: 5 5; animation: bc-fluss .6s linear infinite; } @keyframes bc-fluss { to { stroke-dashoffset: -10; } }
@media (prefers-reduced-motion: reduce) { .bc *, .kc, .kc *, .bk * { animation: none !important; } }
`;

/* Glas-Stil aus dem Mockup (mockups/quelle/glas.css) */
const GLAS_CSS = `:host { display: block; height: 100%; }
.wurzel { position: relative; height: 100vh; height: 100dvh; background: #0b0b0b; color: #fff; font-family: -apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif; font-size: 14px; }
.wurzel.hell { background: #d9dee5; color: #111; }
/* Seitenleiste auf dem Handy (HA zeigt bei eigenen Seiten keinen Kopf) */
.still .glas-k { animation: schweben2 6s ease-in-out infinite; } .still .glas-k.neu, .still .bs-karte, .still .fl-flaeche, .still .fl-linie, .still .hb-spur i, .still .w-inhalt, .still .hz-kachel { animation: none; }
.menue-knopf { position: absolute; top: 10px; left: 14px; z-index: 6; width: 36px; height: 36px; border-radius: 50% !important; display: grid; place-items: center; font-size: 17px; color: var(--ink2); }
/* Glas-Stil (Variante C) – klickbarer Prototyp */

/* Farben der Diagramme (validierte Palette, eigene Stufen für dunkel) */
.ui { position: absolute; inset: 0; }
.app { --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300;
  --ink: #fff; --ink2: rgba(255,255,255,.66); --gridc: rgba(255,255,255,.14); --axisc: rgba(255,255,255,.55); --amber: #ff9f0a; --rot: #ff6961; --blau: #64a8ff;
  --panel: rgba(255,255,255,.05); --panel-rand: rgba(255,255,255,.2); --sheet: rgba(28,32,44,.82);
  --fenster: #2b3a44; --rahmen: #cfd8dc; --wr-nebel: #c5d0d7; --wr-wind: #cfe3f3;
  position: relative; height: 100%; overflow: hidden; color: var(--ink); container-type: inline-size; }
.hell .app { --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #e87ba4; --s6: #008300;
  --ink: #111; --ink2: rgba(0,0,0,.6); --gridc: rgba(0,0,0,.1); --axisc: rgba(0,0,0,.5); --amber: #d97800; --rot: #d7372b; --blau: #0a64d6;
  --panel: rgba(255,255,255,.2); --panel-rand: rgba(255,255,255,.65); --sheet: rgba(250,250,252,.86);
  --fenster: #cfe3f3; --rahmen: #eceff1; --wr-nebel: #8a99a3; --wr-wind: #7d98ad; }
/* Grundform für Knöpfe ohne Gewicht (:where), damit Klassen wie .glas-panel oder .glas-kw sie überschreiben */
:where(.app button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; }
.app input, .app select { font: inherit; color: var(--ink); background: rgba(127,127,127,.16); border: 1px solid var(--panel-rand); border-radius: 10px; padding: 7px 10px; }
.app select option { color: #111; }

/* Hintergrund: Stimmung nach Tageszeit und Wetter. Farben als registrierte Eigenschaften, damit sie weich überblenden */
@property --g1 { syntax: '<color>'; inherits: true; initial-value: #1c3552; }
@property --g2 { syntax: '<color>'; inherits: true; initial-value: #1f4a70; }
@property --g3 { syntax: '<color>'; inherits: true; initial-value: #2a5575; }
@property --f1 { syntax: '<color>'; inherits: true; initial-value: #ffd27a; }
@property --f2 { syntax: '<color>'; inherits: true; initial-value: #3aa0ff; }
@property --f3 { syntax: '<color>'; inherits: true; initial-value: #7fd0ff; }
.glas-bg { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(165deg, var(--g1) 0%, var(--g2) 50%, var(--g3) 100%);
  transition: --g1 2.5s, --g2 2.5s, --g3 2.5s, --f1 2.5s, --f2 2.5s, --f3 2.5s; --dunst-farbe: #3c4655; --tropfen: rgba(200,225,255,.6); }
.glas-bg[data-phase=morgen] { --g1: #2e2748; --g2: #4a3150; --g3: #6b4040; --f1: #ff8a5c; --f2: #6a7bd6; --f3: #d07ab8; }
.glas-bg[data-phase=tag]    { --g1: #1c3552; --g2: #1f4a70; --g3: #2a5575; --f1: #ffc766; --f2: #3aa0ff; --f3: #7fd0ff; }
.glas-bg[data-phase=abend]  { --g1: #2a1a36; --g2: #45203d; --g3: #5a2a2c; --f1: #ff7a2e; --f2: #d0457a; --f3: #7a4bd0; }
.glas-bg[data-phase=nacht]  { --g1: #070d1c; --g2: #0c1528; --g3: #131a33; --f1: #2c3e8a; --f2: #1b4a7a; --f3: #4b3a8a; }
.hell .glas-bg { --dunst-farbe: #c9ced6; --tropfen: rgba(50,80,120,.35); }
.hell .glas-bg[data-phase=morgen] { --g1: #ffd9c7; --g2: #f5e0f0; --g3: #cfdcff; --f1: #ff9a6a; --f2: #9fb4ff; --f3: #f0a0c8; }
.hell .glas-bg[data-phase=tag]    { --g1: #cfe6ff; --g2: #e3f1ff; --g3: #fff3d6; --f1: #ffd060; --f2: #6ab8ff; --f3: #a8e0ff; }
.hell .glas-bg[data-phase=abend]  { --g1: #ffd2b0; --g2: #f7c6d8; --g3: #d9ccff; --f1: #ff8a3a; --f2: #ff6f9a; --f3: #a58aff; }
.hell .glas-bg[data-phase=nacht]  { --g1: #b9c4e0; --g2: #c9cde6; --g3: #d8d0ec; --f1: #6d80c8; --f2: #7fa3dc; --f3: #9a88d2; }
.glas-bg > i { position: absolute; border-radius: 50%; filter: blur(40px) saturate(1); opacity: .7; animation: schweben 14s ease-in-out infinite; transition: filter 2.5s, opacity 2.5s; }
.glas-bg .k1 { width: 260px; height: 260px; background: var(--f1); top: -60px; left: -60px; }
.glas-bg .k2 { width: 240px; height: 240px; background: var(--f2); top: 300px; right: -80px; animation-delay: -5s; }
.glas-bg .k3 { width: 200px; height: 200px; background: var(--f3); bottom: -40px; left: 40px; animation-delay: -9s; }
.glas-bg[data-phase=nacht] > i { opacity: .45; }
/* Wetter dämpft die Farben und legt Dunst darüber */
.dunst { position: absolute; inset: 0; background: var(--dunst-farbe); opacity: 0; transition: opacity 2.5s; }
.glas-bg[data-wetter=wolkig] .dunst { opacity: .3; }  .glas-bg[data-wetter=wolkig] > i { filter: blur(50px) saturate(.6); }
.glas-bg[data-wetter=regen] .dunst { opacity: .42; }  .glas-bg[data-wetter=regen] > i { filter: blur(55px) saturate(.45); opacity: .5; }
.glas-bg[data-wetter=gewitter] .dunst { opacity: .55; background: #1c2230; } .glas-bg[data-wetter=gewitter] > i { filter: blur(55px) saturate(.35); opacity: .4; }
.hell .glas-bg[data-wetter=gewitter] .dunst { background: #9aa3b2; }
.glas-bg[data-wetter=nebel] .dunst { opacity: .62; }  .glas-bg[data-wetter=nebel] > i { filter: blur(70px) saturate(.3); opacity: .35; }
.glas-bg[data-wetter=schnee] .dunst { opacity: .35; background: #dfe8f2; } .glas-bg[data-wetter=schnee] > i { filter: blur(50px) saturate(.4); }
.glas-bg:not(.hell *)[data-wetter=schnee] .dunst { opacity: .16; }
/* Bewegung */
.partikel { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.partikel i { position: absolute; display: block; }
.tropfen { top: -40px; width: 1.5px; height: var(--l); border-radius: 1px; background: linear-gradient(transparent, var(--tropfen));
  transform: rotate(12deg); animation: fallen var(--d) linear infinite; animation-delay: var(--v); }
@keyframes fallen { to { transform: translate(-200px, 950px) rotate(12deg); } }
.blitzlicht { inset: 0; background: #fff; opacity: 0; animation: blitzen 7s linear infinite; }
@keyframes blitzen { 0%, 86%, 88.5%, 91%, 100% { opacity: 0; } 87% { opacity: .35; } 90% { opacity: .22; } }
.flocke { top: -12px; animation: schneien var(--d) linear infinite; animation-delay: var(--v); }
.flocke b { display: block; width: var(--s); height: var(--s); border-radius: 50%; background: rgba(255,255,255,.9); box-shadow: 0 0 4px rgba(255,255,255,.6);
  animation: pendeln var(--w) ease-in-out infinite alternate; }
.hell .flocke b { background: #fff; box-shadow: 0 0 3px rgba(80,100,130,.5); }
@keyframes schneien { to { transform: translateY(950px); } }
@keyframes pendeln { from { transform: translateX(-10px); } to { transform: translateX(10px); } }
.schwade { left: -40%; width: 180%; height: 140px; background: radial-gradient(ellipse at center, rgba(225,232,240,.4), transparent 70%); filter: blur(12px);
  animation: ziehen var(--d) ease-in-out infinite alternate; animation-delay: var(--v); }
@keyframes ziehen { from { transform: translateX(-12%); } to { transform: translateX(12%); } }
.wolke { left: -60%; width: 340px; height: 130px; border-radius: 50%; background: rgba(255,255,255,.12); filter: blur(28px);
  animation: wandern var(--d) linear infinite; animation-delay: var(--v); }
.hell .wolke { background: rgba(255,255,255,.55); }
@keyframes wandern { to { transform: translateX(260%); } }
.stern { width: var(--s); height: var(--s); border-radius: 50%; background: #fff; box-shadow: 0 0 4px #fff; animation: funkeln 3.5s ease-in-out infinite; animation-delay: var(--v); }
.hell .stern { background: #fffbe8; box-shadow: 0 0 4px #7d8fd0; }
@keyframes funkeln { 50% { opacity: .2; } }
.strahlen { top: calc(var(--sonne-y, 8%) - 360px); left: calc(var(--sonne-x, 8%) - 360px); width: 720px; height: 720px; border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(255,236,170,.14) 0 6deg, transparent 6deg 18deg);
  -webkit-mask: radial-gradient(circle, #000 12%, transparent 62%); mask: radial-gradient(circle, #000 12%, transparent 62%); animation: drehen 90s linear infinite; }
@keyframes drehen { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .partikel { display: none; } }
/* WebGL-Himmel: zeichnet Verlauf, Lichtflecken, Wolken, Wetter und Tropfen selbst */
.himmel { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.glas-bg.gl-an > i, .glas-bg.gl-an .dunst { visibility: hidden; }
.glas-bg.gl-an .partikel { display: none; }

.scroll { position: absolute; inset: 0; overflow-y: auto; }
.seite { padding: 56px 14px 120px; display: flex; flex-direction: column; gap: 12px; max-width: 1100px; margin: 0 auto; }
/* Einblenden nur am Anfang (backwards): eine festgehaltene Deckkraft machte die Seite zur eigenen Ebene – dann bleibt das Glas ohne Unschärfe */
.seite.rein { animation: seite .28s cubic-bezier(.2,.7,.2,1) backwards; }

.glas-panel { background: var(--panel); border: 1px solid var(--panel-rand); backdrop-filter: blur(12px) saturate(1.4); -webkit-backdrop-filter: blur(12px) saturate(1.4);
  border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.22); }
.glas-kopf { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 18px; }
.klickbar { cursor: pointer; }
.kopf-wetter { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; padding: 2px 10px 2px 2px !important; border-radius: 14px !important;
  font-size: 13px; color: var(--ink2) !important; transition: background .2s; }
.kopf-wetter:hover { background: rgba(255,255,255,.1) !important; } .kopf-wetter span:first-of-type { color: var(--ink); font-weight: 500; }
.kopf-wetter .wi { margin: -4px 0; } .pfeil { font-size: 14px; opacity: .6; }
.glas-klein { font-size: 11px; letter-spacing: 1.2px; color: var(--ink2); text-transform: uppercase; }
.glas-titel { font-size: 22px; font-weight: 600; }
.glas-kw { font-size: 38px; font-weight: 300; letter-spacing: -.5px; display: flex; align-items: baseline; gap: 4px; white-space: nowrap; line-height: 1; }
.glas-kw small { font-size: 16px !important; opacity: .75 !important; font-weight: 400; letter-spacing: 0; }
.glas-kw small, .glas-wert small, .c-wert small { font-size: .5em; opacity: .7; }
.blitz { font-size: 26px; opacity: .4; align-self: center; } .blitz.an { opacity: 1; filter: drop-shadow(0 0 8px rgba(255,214,10,.9)); animation: blitz 2.4s ease-in-out infinite; }

.glas-chips { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.chip { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; padding: 6px 12px; border-radius: 18px !important; transition: transform .15s; }
.chip:active { transform: scale(.96); } .chip.rot { color: var(--rot); } .chip.amber { color: var(--amber); }
.chip-leise { font-size: 12px; color: var(--ink2); margin-left: 4px; }
.auto-chip { gap: 8px !important; padding-left: 7px !important; font-weight: 600; }
.mini-sw { position: relative; width: 28px; height: 16px; border-radius: 8px; background: rgba(120,120,128,.45); transition: background .25s; flex: none; }
.mini-sw i { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3);
  transition: transform .25s cubic-bezier(.3,.7,.2,1.2); }
.auto-chip.on .mini-sw { background: var(--amber); } .auto-chip.on .mini-sw i { transform: translateX(12px); }
.chip-status { font-size: 13px; color: var(--ink2); } .chip-status.amber { color: var(--amber); font-weight: 500; }

.glas-raster { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.glas-k { padding: 12px; display: flex; flex-direction: column; gap: 3px; animation: rein .5s ease-out backwards, schweben2 6s ease-in-out infinite;
  transition: transform .2s cubic-bezier(.2,.7,.2,1), box-shadow .2s; }
.glas-k:nth-child(2n) { animation-delay: 0s, -3s; }
.glas-k:hover { box-shadow: 0 14px 40px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.3); } .glas-k:active { transform: scale(.97); }
.glas-illu { margin: -4px -6px -2px; filter: drop-shadow(0 12px 14px rgba(0,0,0,.35)); }
.glas-name { font-weight: 600; font-size: 15px; }
.glas-zeile { display: flex; justify-content: space-between; align-items: baseline; }
.glas-wert { font-size: 26px; font-weight: 300; } .glas-kwk { font-size: 12px; color: var(--ink2); }
.glas-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink2); }
.glas-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c); animation: atmen 2s infinite; flex: none; }
.glas-geraete { display: flex; align-items: center; gap: 4px; margin-top: 3px; font-size: 11px; color: var(--ink2); }
.glas-geraete i { width: 6px; height: 6px; border-radius: 50%; background: rgba(142,142,147,.55); } .glas-geraete i.an { background: var(--amber); box-shadow: 0 0 6px var(--amber); }
.glas-geraete span { margin-left: 4px; }
.glas-k.neu { align-items: center; justify-content: center; min-height: 180px; color: var(--ink2); background: transparent; border-style: dashed; box-shadow: none; animation: rein .5s ease-out backwards; }
.glas-k.neu span { font-size: 34px; font-weight: 200; color: var(--ink); }

.glas-nav { position: absolute; left: 14px; right: 14px; bottom: 22px; display: flex; justify-content: space-around; padding: 6px; z-index: 5; }
.glas-nav button { flex: 1; text-align: center; padding: 8px 2px; border-radius: 16px; font-size: 13px; color: var(--ink2); transition: background .2s, color .2s; }
.glas-nav button.nav-ic { flex: 0 0 48px; display: grid; place-items: center; padding: 5px 2px; }
.glas-nav button.nav-ic svg { display: block; transition: transform .4s cubic-bezier(.3,.7,.2,1); } .glas-nav button.nav-ic:hover svg { transform: rotate(60deg); }
.glas-nav button.on { color: var(--ink); font-weight: 700; background: rgba(255,255,255,.16); }
.hell .glas-nav button.on { background: rgba(255,255,255,.7); }

/* Verbrauch (Klick auf kW) */
.kw-knopf { cursor: pointer; border-radius: 14px !important; padding: 4px 8px !important; margin: -4px -8px -4px 0 !important; transition: background .2s; }
.kw-knopf:hover { background: rgba(255,255,255,.12) !important; } .kw-pfeil { font-size: 22px; opacity: .5; margin-left: 4px; align-self: center; }
.c-kw.kw-knopf { margin: 4px 0 0 -8px !important; }
.vb-wer { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
.vb-wer button { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 12px; padding: 5px 10px !important; border-radius: 14px !important;
  border: 1px solid var(--panel-rand) !important; color: var(--ink2) !important; transition: background .2s, color .2s; }
.vb-wer button.on { background: rgba(255,255,255,.2) !important; color: var(--ink) !important; font-weight: 600; } .hell .vb-wer button.on { background: #fff !important; }
.vb-wer i { width: 8px; height: 8px; border-radius: 50%; }
.app { --trenn: rgba(20,24,34,.85); } .hell .app { --trenn: rgba(255,255,255,.95); }
.tip-summe { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--gridc); }
.vb-je { display: flex; flex-direction: column; font-size: 13px; }
.vb-je div { display: grid; grid-template-columns: 10px 1fr auto 62px 78px; gap: 8px; align-items: center; padding: 6px 0; }
.vb-je div + div { border-top: 1px solid var(--gridc); } .vb-je i { width: 8px; height: 8px; border-radius: 50%; }
.vb-je .n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .vb-je span:not(.n) { text-align: right; } .vb-je b { font-weight: 600; text-align: right; }
.fl-flaeche, .fl-linie { animation: seite .4s ease-out backwards; }

/* Heizt: Kachel glüht am Rand warm */
.glas-k, .c-held { position: relative; }
.glas-k.heizt::after, .glas-k.trocknen::after, .glas-k.frost::after, .c-held.heizt::after, .c-held.trocknen::after, .c-held.frost::after {
  content: ""; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 26px 1px rgba(255, 84, 40, .42), 0 0 22px rgba(255, 84, 40, .22); animation: gluehen 3.4s ease-in-out infinite; }
.hell .glas-k.heizt::after, .hell .glas-k.trocknen::after, .hell .glas-k.frost::after, .hell .c-held.heizt::after, .hell .c-held.trocknen::after, .hell .c-held.frost::after {
  box-shadow: inset 0 0 24px 1px rgba(240, 80, 30, .32), 0 0 20px rgba(240, 80, 30, .18); }
@keyframes gluehen { 50% { opacity: .55; } }
.glas-k:nth-child(3n)::after { animation-delay: -1.2s; } .glas-k:nth-child(3n+1)::after { animation-delay: -2.3s; }

/* Verbrauch oben in der Container-Ansicht, Diagramm-Optionen, Bearbeiten */
.kennz-knopf { position: relative; width: 100%; cursor: pointer; transition: transform .15s; } .kennz-knopf:active { transform: scale(.98); }
.kennz-mehr { position: absolute; right: 12px; top: 6px; font-size: 11px; color: var(--ink2); }
.chart-optionen { display: flex; justify-content: flex-end; } .chart-optionen .chip { font-size: 12px; font-weight: 500 !important; background: rgba(120,120,128,.18) !important; }
.ge-zeile { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--gridc); }
.ge-zeile.weg { justify-content: space-between; color: var(--ink2); text-decoration: line-through; } .ge-zeile.weg .chip { text-decoration: none; font-size: 12px; }
.ge-felder { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; } .ge-shelly { font-size: 11px; }
.ge-zwei { display: grid; grid-template-columns: 1fr 120px; gap: 6px; } .ge-zwei input, .ge-zwei select, .ge-felder > select { min-width: 0; }

/* Container-Ansicht */
.zurueck-zeile { display: flex; justify-content: space-between; }
.c-held { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; padding: 14px; }
.c-illu { filter: drop-shadow(0 16px 18px rgba(0,0,0,.35)); animation: schweben2 6s ease-in-out infinite; }
.c-wert { font-size: 40px; font-weight: 300; margin: 4px 0; } .c-kw { font-size: 13px; color: var(--ink2); margin-top: 4px; }
.block { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.block-kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.leise { color: var(--ink2); font-size: 12px; } .rot-t { color: var(--rot); } .blau { color: var(--blau); } .ok { color: #30d158; font-size: 12px; }
.liste { padding: 4px 0; }
.zeile { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; width: 100%; box-sizing: border-box; min-height: 44px; }
.block .zeile { padding: 8px 0; }
.liste .zeile + .zeile, .block .zeile + .zeile { border-top: 1px solid var(--gridc); }
.zeile.unter { padding-left: 14px; font-size: 14px; }
.block .zeile.unter { padding-left: 14px; }
.gruppe { font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--ink2); padding: 10px 16px 2px; }
.geraet { justify-content: flex-start; } .g-t { flex: 1; display: flex; flex-direction: column; } .g-t .leise em.hand { color: var(--amber); font-style: normal; font-weight: 600; }
.g-ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: rgba(142,142,147,.22); flex: none; transition: background .25s, box-shadow .25s; }
.g-ic.an { background: color-mix(in srgb, var(--amber) 28%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--amber) 50%, transparent); }
.farbpunkt { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }

/* Schalter */
.sw { width: 50px; height: 30px; border-radius: 15px !important; background: rgba(120,120,128,.36) !important; position: relative; flex: none; transition: background .25s; }
.sw i { position: absolute; top: 2px; left: 2px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 3px 8px rgba(0,0,0,.2); transition: transform .25s cubic-bezier(.3,.7,.2,1.2); }
.sw.on { background: var(--amber) !important; } .sw.on i { transform: translateX(20px); }

/* Segmente und Stepper */
.seg { display: flex; padding: 3px; border-radius: 14px; background: rgba(120,120,128,.2); gap: 2px; }
.seg.glas-panel { border-radius: 16px; padding: 4px; }
.seg button { flex: 1; text-align: center; padding: 7px 6px; border-radius: 11px; font-size: 13px; color: var(--ink2); transition: background .2s, color .2s; white-space: nowrap; }
.seg button.on { background: rgba(255,255,255,.2); color: var(--ink); font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.hell .seg button.on { background: #fff; }
.seg.klein button { padding: 5px 10px; font-size: 12px; flex: none; }
.stepper { display: flex; align-items: center; gap: 4px; background: rgba(120,120,128,.2); border-radius: 12px; padding: 2px; }
.stepper button { width: 32px; height: 30px; text-align: center; border-radius: 10px; font-size: 18px; }
.stepper button:active { background: rgba(255,255,255,.2); } .stepper b { min-width: 66px; text-align: center; font-size: 14px; font-weight: 600; }

/* Zeitplan */
.tag { cursor: pointer; } .tag-n { width: 28px; } .fenster { flex: 1; display: flex; gap: 6px; flex-wrap: wrap; }
.fenster em { font-style: normal; font-size: 12px; padding: 3px 8px; border-radius: 8px; background: color-mix(in srgb, var(--amber) 22%, transparent); color: var(--ink); }
.chev { color: var(--ink2); font-size: 18px; }
.tl-spur { position: relative; height: 22px; border-radius: 8px; background: rgba(120,120,128,.2); overflow: hidden; }
.tl-spur i { position: absolute; top: 0; bottom: 0; }
.tl-heiz { background: var(--amber); opacity: .85; }
.tl-trock { background: repeating-linear-gradient(45deg, var(--amber) 0 3px, transparent 3px 7px); }
.tl-jetzt { width: 2px; background: var(--ink); box-shadow: 0 0 6px var(--ink); }
.tl-achse { display: flex; justify-content: space-between; font-size: 11px; color: var(--ink2); margin-top: 4px; }

/* Arbeitszeit und Heizplan */
.tl-vor { background: color-mix(in srgb, var(--amber) 45%, transparent); }
.tl-extra { background: repeating-linear-gradient(45deg, var(--blau) 0 3px, transparent 3px 7px); opacity: .8; }
.chip-status { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px !important; border-radius: 12px !important; transition: background .2s; }
.chip-status:hover { background: rgba(255,255,255,.12) !important; }
.regelung { display: flex; flex-direction: column; gap: 2px; font-size: 13px; padding-top: 8px; border-top: 1px solid var(--gridc); }
.regelung span { color: var(--ink2); font-size: 12px; }
.az-name { font-size: 18px; font-weight: 600; margin-top: -2px; }
.zeile.az.heute .tag-n { color: var(--amber); }
.badge.blau-b { background: color-mix(in srgb, var(--blau) 22%, transparent); color: var(--blau); }
.hp-legende { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 11px; color: var(--ink2); }
.hp-legende i { display: inline-block; width: 14px; height: 8px; border-radius: 3px; margin-right: 5px; vertical-align: middle; }
.hp { display: flex; flex-direction: column; }
.hp-zeile { display: grid; grid-template-columns: 48px 1fr 42px; gap: 10px; align-items: center; padding: 7px 0; }
.hp-zeile + .hp-zeile { border-top: 1px solid var(--gridc); } .hp-zeile.achse { border-top: 0; padding-top: 0; }
.hp-zeile.heute { background: rgba(255,255,255,.07); border-radius: 12px; margin: 0 -8px; padding: 7px 8px; }
.hp-zeile .tl-spur { height: 14px; border-radius: 5px; } .hp-mitte .leise { font-size: 11px; margin-top: 3px; min-height: 13px; }
.hp-tag { display: flex; flex-direction: column; font-size: 11px; color: var(--ink2); } .hp-tag b { font-size: 14px; color: var(--ink); }
.hp-zeile.heute .hp-tag b { color: var(--amber); }
.hp-zeit { font-size: 11px; text-align: right; color: var(--ink2); line-height: 1.35; font-variant-numeric: tabular-nums; }
.azn input[type=time] { flex: 1; min-width: 0; padding: 5px 6px; } .azn .frei { flex: 1; }
.raster-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

/* Warnungen und Protokoll */
.warn-chip { display: inline-block !important; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip.gelb { color: #ffd60a; } .hell .chip.gelb { color: #9a6b00; }
.gruppe-t { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink2); margin-top: 4px; }
.wk { border-left: 3px solid var(--rot); padding: 6px 0 8px 12px; display: flex; flex-direction: column; gap: 3px; }
.wk.hinweis { border-color: #ffd60a; } .hell .wk.hinweis { border-color: #d9a400; } .wk.stumm { opacity: .55; border-color: var(--ink2); }
.wk-kopf { display: flex; justify-content: space-between; gap: 8px; } .wk-titel { font-size: 15px; font-weight: 500; }
.wk.stoerung .wk-titel { color: var(--rot); }
.wk-knoepfe { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; } .wk-knoepfe .chip { font-size: 12px; padding: 4px 10px; }
.p-tag { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink2); margin-top: 8px; padding-bottom: 2px; }
.p-ic { width: 16px; text-align: center; flex: none; font-size: 13px; }
.ereignis > div { font-size: 13px; } .p-fuss { padding: 6px 16px 10px; }

/* Heizung: Regeln heute, je Container, Feiertage */
.hr-zeile { display: grid; grid-template-columns: 26px 1fr 14px; gap: 8px; align-items: center; padding: 7px 0; opacity: .6; }
.hr-zeile + .hr-zeile { border-top: 1px solid var(--gridc); } .hr-zeile.an { opacity: 1; }
.hr-ic { font-size: 18px; text-align: center; } .hr-an { color: var(--ink2); font-size: 11px; } .hr-zeile.an .hr-an { color: var(--amber); }
.jc { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--gridc); flex-wrap: wrap; }
.jc-name { display: flex; flex-direction: column; min-width: 110px; } .jc-ctrl { display: flex; align-items: center; gap: 6px; }
.jc-l { font-size: 11px; color: var(--ink2); } .jc-th { width: 92px; text-align: center; font-size: 11px; }
.sw.klein { width: 38px; height: 22px; } .sw.klein i { width: 18px; height: 18px; } .sw.klein.on i { transform: translateX(16px); }
.stepper.klein button { width: 24px; height: 24px; font-size: 15px; } .stepper.klein b { min-width: 40px; font-size: 13px; } .stepper b.eigen { color: var(--amber); }
.ft-d { font-weight: 600; min-width: 64px; display: inline-block; }
/* Auswertung */
.kennz.vier { grid-template-columns: repeat(4, 1fr); } .kennz em { display: block; font-style: normal; font-size: 10.5px; margin-top: 2px; }
.kennz em.mehr { color: var(--rot); } .kennz em.weniger { color: #30d158; }
@container (max-width: 420px) { .kennz.vier { grid-template-columns: repeat(2, 1fr); row-gap: 10px; } .kennz.vier div:nth-child(3) { border-left: 0; } }
.vgl { margin: -6px 6px 0; }
.hinweis-k { font-size: 13px; padding: 8px 10px; border-radius: 12px; background: rgba(120,120,128,.14); }
.punkt-s { stroke: var(--sheet); stroke-width: 1.5; opacity: .9; }

/* Firmen und Abrechnung */
.firma-tag { align-self: flex-start; font-size: 10.5px; padding: 1px 7px; border-radius: 8px; background: rgba(120,120,128,.25); color: var(--ink2); margin-top: -1px; }
.fc-neu input { flex: 1; min-width: 0; }
.vb-gruppe { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.ab-firma { padding: 8px 0; border-top: 1px solid var(--gridc); } .ab-firma:first-of-type { border-top: 0; }
.ab-kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.ab-c { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; padding: 3px 0 0 12px; }

/* Staffelung / Strom */
.strom-knopf { display: flex; flex-direction: column; gap: 5px; width: calc(100% + 0px); margin-top: 12px; padding-top: 10px !important; border-top: 1px solid var(--gridc) !important; cursor: pointer; }
.glas-kopf { flex-wrap: wrap; } .glas-kopf .strom-knopf { flex-basis: 100%; }
.strom-t { font-size: 12px; color: var(--ink2); } .strom-t b { color: var(--ink); font-weight: 600; }
.strom-spur { position: relative; display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: rgba(120,120,128,.2); gap: 2px; }
.strom.klein .strom-spur { height: 7px; } .strom-spur i { display: block; height: 100%; transition: width .5s cubic-bezier(.2,.7,.2,1); }
.strom-spur .s-res { margin-left: auto; }
.s-heiz { background: var(--amber); } .s-pumpe { background: var(--blau); } .s-sonst { background: rgba(142,142,147,.85); }
.s-res { background: repeating-linear-gradient(45deg, rgba(142,142,147,.6) 0 3px, transparent 3px 6px); }
.strom-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--ink2); }
.strom-leg i { display: inline-block; width: 12px; height: 8px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
.an-block { display: flex; flex-direction: column; gap: 5px; padding: 8px 0; border-top: 1px solid var(--gridc); }
.an-kopf { display: flex; justify-content: space-between; gap: 8px; }
.ph-zeile { display: grid; grid-template-columns: 24px 1fr 56px; gap: 8px; align-items: center; font-size: 12px; } .ph-zeile .leise { text-align: right; }
.amber-t { color: var(--amber); } .lila { color: #bf5af2; } .blau { color: var(--blau); }
.g-t em.warte { color: var(--blau); font-style: normal; }
.gt-einzug { padding: 8px 16px 0; }
/* Tür */
.tuer-tag { align-self: flex-start; font-size: 10.5px; padding: 1px 7px; border-radius: 8px; background: rgba(191,90,242,.22); color: #d9a6f7; }
.hell .tuer-tag { color: #8a2fb8; }
.tuer-z { font-size: 12px; padding: 2px 9px; border-radius: 10px; background: rgba(48,209,88,.2); color: #30d158; } .tuer-z.offen { background: rgba(191,90,242,.22); color: #bf5af2; }
.ge-phase { display: flex; align-items: center; gap: 8px; }
/* Nachrichten und Bericht */
.noti { background: rgba(250,250,252,.96); color: #111; border-radius: 18px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; font-size: 13px; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.noti-app { font-size: 11px; color: #666; } .noti b { font-size: 14px; }
.noti-knoepfe { display: flex; gap: 14px; margin-top: 6px; } .noti-knoepfe button { color: #0a64d6 !important; font-weight: 600; font-size: 13px; padding: 4px 0 !important; }
.mail { border-radius: 14px; overflow: hidden; border: 1px solid var(--panel-rand); font-size: 13px; }
.mail-kopf { padding: 8px 12px; background: rgba(120,120,128,.16); display: flex; flex-direction: column; gap: 2px; }
.mail-anhang { font-size: 12px; margin-top: 3px; } .mail-inhalt { padding: 10px 12px; }
.mail-t { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink2); margin-top: 10px; }
.mail-z { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
.mail-feld { flex: 1; min-width: 0; margin-left: 12px; }

/* Nur bei Bedarf */
.glas-k.bereit { opacity: .88; }
.bedarf-knopf { align-self: stretch; margin-top: 6px; padding: 7px 10px !important; border-radius: 12px !important; text-align: center !important; font-size: 13px; font-weight: 600;
  background: rgba(120,120,128,.22) !important; transition: background .2s, transform .12s; }
.bedarf-knopf:active { transform: scale(.96); } .bedarf-knopf.an { background: color-mix(in srgb, var(--amber) 30%, transparent) !important; color: var(--amber) !important; }
.bedarf-dauer { display: flex; gap: 8px; flex-wrap: wrap; } .bedarf-dauer.gross { flex-direction: column; }
.bedarf-an { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: var(--amber); }
.glas-k[role=button] { cursor: pointer; }

/* Heizzeiten-Übersicht */
.tl-termin { background: color-mix(in srgb, var(--amber) 70%, #bf5af2); }
.hz-tag { display: flex; flex-direction: column; gap: 6px; }
.hz-zeile { display: grid; grid-template-columns: 96px 1fr 40px; gap: 8px; align-items: center; } .hz-zeile.aus { opacity: .45; }
.hz-n { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .hz-h { font-size: 11px; color: var(--ink2); text-align: right; }
.tl-spur.hz { height: 14px; border-radius: 5px; }
.hz-woche { display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
.hz-wk, .hz-wz { display: grid; grid-template-columns: 92px repeat(7, 1fr) 40px; gap: 3px; align-items: center; }
.hz-wk span { text-align: center; font-size: 11px; color: var(--ink2); line-height: 1.1; } .hz-wk span.heute { color: var(--amber); font-weight: 700; }
.hz-zelle { height: 26px; border-radius: 6px !important; text-align: center !important; font-size: 11px; background: color-mix(in srgb, var(--amber) calc(var(--a) * 100%), rgba(120,120,128,.14)) !important; }
.hz-sum { text-align: right; font-size: 11px; }
.t-wann { width: 70px !important; }

/* Melden, Über, Entwicklung */
.melden-knopf { position: absolute; right: 16px; bottom: 90px; z-index: 6; width: 38px; height: 38px; border-radius: 50% !important; display: grid; place-items: center; color: var(--ink2);
  opacity: .8; transition: opacity .2s, transform .15s; } .melden-knopf:hover { opacity: 1; color: var(--ink); } .melden-knopf:active { transform: scale(.92); }
.melden-knopf.im-sheet { position: absolute; top: 10px; right: 12px; bottom: auto; width: 32px; height: 32px; z-index: 2; background: rgba(120,120,128,.18); }
.sheet > .block-kopf:first-of-type, .sheet > h3:first-of-type { padding-right: 40px; }
.app textarea { font: inherit; color: var(--ink); background: rgba(127,127,127,.16); border: 1px solid var(--panel-rand); border-radius: 10px; padding: 8px 10px; resize: vertical; font-size: 15px; }
.ml-kontext { font-size: 12px; padding: 8px 10px; border-radius: 10px; background: rgba(120,120,128,.14); display: flex; flex-direction: column; gap: 2px; }
.ml-nr { font-variant-numeric: tabular-nums; } .ml-notiz { font-style: italic; }
.badge.st-neu { background: rgba(10,132,255,.2); color: var(--blau); } .badge.st-angenommen, .badge.st-in_arbeit { background: color-mix(in srgb, var(--amber) 22%, transparent); color: var(--amber); } .badge.st-geloest { background: rgba(48,209,88,.22); color: #30d158; }
.ml { padding: 8px 0 8px 12px; border-left: 3px solid var(--blau); display: flex; flex-direction: column; gap: 3px; } .ml.erledigt { opacity: .55; border-color: var(--ink2); }
.ml + .ml { margin-top: 6px; } .ml-kopf { display: flex; justify-content: space-between; gap: 8px; } .ml-text { font-size: 14px; }
.badge.rot-b { background: rgba(255,69,58,.2); color: var(--rot); }
.ueber-kopf { display: grid; grid-template-columns: 110px 1fr; gap: 12px; align-items: center; padding: 16px; } .ueber-illu { filter: drop-shadow(0 10px 12px rgba(0,0,0,.3)); }
.ueber-v { font-size: 15px; margin: 4px 0; }
.cl-punkt { font-size: 13px; padding: 4px 0 4px 14px; position: relative; } .cl-punkt::before { content: ""; position: absolute; left: 2px; top: 11px; width: 5px; height: 5px; border-radius: 50%; background: var(--amber); }
.cl-liste { padding: 0 0 8px 4px; } .cl-v { border-top: 1px solid var(--gridc); }
@container (min-width: 700px) { .melden-knopf { bottom: 24px; right: 24px; } }

.hp-zeile.ausn .hp-tag b::after { content: ' •'; color: var(--blau); }

.hz-c { display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px; font-size: 12.5px; } .hz-cn { font-weight: 600; } .hz-cp { font-size: 11px; }
.hz-g { padding-left: 10px; color: var(--ink2); font-size: 11.5px; }
.tl-spur.hz { height: 12px; }
.hz-plan { background: color-mix(in srgb, var(--amber) 22%, transparent); } .hz-plan.vorbei { background: color-mix(in srgb, var(--amber) 12%, transparent); }
.hz-an { background: var(--amber); border-radius: 2px; } .hz-off { background: repeating-linear-gradient(45deg, rgba(255,69,58,.5) 0 3px, transparent 3px 6px); }
.hp-legende i.hz-plan, .hp-legende i.hz-an, .hp-legende i.hz-off { display: inline-block; width: 14px; height: 8px; }
.hz-zelle.geplant { opacity: .55; font-style: italic; }
.hz-wk, .hz-wz { grid-template-columns: 124px repeat(7, 1fr) 40px; } .hz-wz .hz-n { font-size: 11.5px; }

/* Kennzahlen */
.kennz { display: grid; grid-template-columns: repeat(3, 1fr); padding: 14px 6px; text-align: center; }
.kennz div + div { border-left: 1px solid var(--gridc); }
.kennz b { display: block; font-size: 20px; font-weight: 500; } .kennz span { font-size: 11px; color: var(--ink2); }

/* Diagramme */
.chart-wrap { position: relative; }
.chart { width: 100%; height: auto; display: block; overflow: visible; }
.chart .gr { stroke: var(--gridc); stroke-width: 1; } .chart .ax-e { font-weight: 600; font-size: 9px; } .chart .ax { fill: var(--axisc); font-size: 10px; }
.chart .kreuz { stroke: var(--ink2); stroke-width: 1; stroke-dasharray: 2 3; } .chart .punkt { stroke: var(--sheet); stroke-width: 2; }
.chart .bar { transition: opacity .15s; } .chart .bar.matt { opacity: .35; }
.legende { display: flex; gap: 14px; font-size: 12px; color: var(--ink2); margin-top: 4px; }
.legende i, .tip i { display: inline-block; width: 10px; height: 3px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
.leer { font-size: 13px; color: var(--ink2); padding: 24px 0; text-align: center; } .link { color: var(--blau) !important; }
.tip { position: absolute; z-index: 30; pointer-events: none; opacity: 0; transition: opacity .12s; background: var(--sheet); color: var(--ink); border: 1px solid var(--panel-rand);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-radius: 12px; padding: 7px 10px; font-size: 12px; box-shadow: 0 6px 20px rgba(0,0,0,.25); white-space: nowrap; }
.tip.an { opacity: 1; }
.hbar { display: grid; grid-template-columns: 110px 1fr 54px; align-items: center; gap: 10px; font-size: 13px; }
.hb-spur { height: 10px; border-radius: 5px; background: rgba(120,120,128,.18); overflow: hidden; }
.hb-spur i { display: block; height: 100%; border-radius: 5px; animation: wachsen .6s cubic-bezier(.2,.7,.2,1) both; transform-origin: left; }
.hb-w { text-align: right; font-weight: 600; } .hb-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gespart { font-size: 14px; } .gespart b { color: #30d158; }
.vergleich { width: 100%; border-collapse: collapse; font-size: 13px; }
.vergleich th { text-align: right; font-weight: 600; color: var(--ink2); font-size: 12px; padding: 4px 0; } .vergleich td { padding: 7px 0; border-top: 1px solid var(--gridc); }
.vergleich td + td { text-align: right; } .fuss { margin-top: 4px; }

/* Verlauf */
.bs-karte { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; animation: rein .45s ease-out backwards; }
.bs-kopf { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.bs-zahlen { display: flex; gap: 18px; margin-top: 6px; font-size: 13px; color: var(--ink2); } .bs-zahlen b { font-size: 18px; color: var(--ink); font-weight: 500; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: rgba(142,142,147,.25); color: var(--ink2); }
.badge.gruen { background: rgba(48,209,88,.22); color: #30d158; }
.ereignis { justify-content: flex-start; align-items: flex-start; } .ereignis .zeit { width: 42px; font-size: 12px; color: var(--ink2); padding-top: 2px; } .ereignis .glas-dot { margin-top: 5px; }
.eingabe input { width: 70px; text-align: right; }

/* Einblendung von unten */
.schleier { position: absolute; inset: 0; background: rgba(0,0,0,.35); opacity: 0; pointer-events: none; transition: opacity .25s; z-index: 20; }
.schleier.an { opacity: 1; pointer-events: auto; }
.sheet { position: absolute; left: 8px; right: 8px; bottom: 8px; max-height: 82%; overflow-y: auto; z-index: 21; padding: 8px 18px 18px; background: var(--sheet);
  transform: translateY(110%); transition: transform .32s cubic-bezier(.2,.8,.2,1); border-radius: 28px; display: flex; flex-direction: column; gap: 10px; }
.sheet.an { transform: none; }
.sheet h3 { margin: 4px 0 0; font-size: 20px; }
.griff { width: 40px; height: 5px; border-radius: 3px; background: var(--ink2); opacity: .5; margin: 0 auto 4px; }
.bs-zeile .bs-wahl { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; text-align: left; }
.bs-zeile .bs-ic { color: var(--ink2); padding: 4px 8px; font-size: 16px; }
.neu-version { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; margin-bottom: 12px; border-color: var(--amber); }
.neu-version .chip { color: var(--amber); background: color-mix(in srgb, var(--amber) 18%, transparent); font-weight: 600; white-space: nowrap; }
.sheet .zeile { padding: 8px 0; } .sheet .zeile + .zeile { border-top: 1px solid var(--gridc); }
.sheet input[type=time] { flex: 1; } .x { color: var(--rot) !important; padding: 4px 8px !important; }
.feld { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--ink2); } .feld input, .feld select { font-size: 15px; }
.knopf { width: 100%; text-align: center !important; padding: 13px !important; border-radius: 16px !important; background: rgba(120,120,128,.24) !important; font-weight: 600; transition: transform .12s; }
.knopf:active { transform: scale(.98); } .knopf.amber { background: var(--amber) !important; color: #1a1000 !important; } .knopf.rot { color: var(--rot) !important; }
.knopf.leise-k { background: transparent !important; color: var(--ink2) !important; }
.w-jetzt { display: flex; gap: 12px; align-items: center; } .w-jetzt b { font-size: 30px; font-weight: 400; }
.w-std { display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; gap: 2px; font-size: 12px; }
.w-inhalt { animation: seite .25s ease-out backwards; }
.w-regen { color: var(--blau); font-size: 12px; }
.w-std b, .w-teile b { font-size: 16px; font-weight: 500; }
.w-tag + .w-tag { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--gridc); }
.w-tag-n { font-size: 12px; font-weight: 600; letter-spacing: .5px; margin-bottom: 4px; }
.w-teile { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; font-size: 12px; }
.w-teile div { display: flex; flex-direction: column; align-items: center; gap: 2px; } .w-teile .vorbei { opacity: .38; }
.w-3z { display: grid; grid-template-columns: 58px 44px 54px 58px 1fr; align-items: center; gap: 6px; padding: 6px 0; font-size: 13px; }
.w-3z + .w-3z { border-top: 1px solid var(--gridc); }
.w-3t, .w-3w, .w-3r { display: flex; flex-direction: column; } .w-3w b { font-size: 17px; font-weight: 500; }
.w-3f { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.w-folge { font-size: 10.5px; padding: 2px 7px; border-radius: 9px; background: rgba(142,142,147,.22); white-space: nowrap; }
.w-folge.amber { color: var(--amber); background: color-mix(in srgb, var(--amber) 16%, transparent); }
.w-folge.blau { color: var(--blau); background: color-mix(in srgb, var(--blau) 16%, transparent); }
.w-std div { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.warn-k { border-left: 3px solid var(--rot); padding: 4px 0 4px 12px; }
.toast { position: absolute; left: 50%; bottom: 100px; transform: translate(-50%, 20px); opacity: 0; pointer-events: none; z-index: 25; padding: 10px 16px; font-size: 13px;
  white-space: nowrap; border-radius: 18px; background: var(--sheet); }
.toast.an { animation: toast 2.6s ease both; }

/* Desktop: breiteres Raster, Navigation oben */
@container (min-width: 700px) {
  .seite { padding: 84px 28px 40px; }
  .glas-nav { top: 16px; bottom: auto; left: 50%; right: auto; transform: translateX(-50%); width: 560px; }
  .glas-raster { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
  .c-held { grid-template-columns: 1fr 1.2fr; padding: 22px 28px; }
  .sheet { left: 50%; right: auto; width: 460px; bottom: auto; top: 50%; transform: translate(-50%, -40%) scale(.96); opacity: 0; pointer-events: none;
    transition: transform .25s cubic-bezier(.2,.8,.2,1), opacity .2s; }
  .sheet.an { transform: translate(-50%, -50%); opacity: 1; pointer-events: auto; }
  .griff { display: none; } .toast { bottom: 28px; }
  .raster2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
}

@keyframes schweben { 50% { transform: translate(30px, 40px) scale(1.15); } }
@keyframes schweben2 { 50% { transform: translateY(-3px); } }
@keyframes seite { from { opacity: 0; transform: translateY(10px); } }
@keyframes wachsen { from { transform: scaleX(0); } }
@keyframes toast { 0% { opacity: 0; transform: translate(-50%, 20px); } 10%, 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, 10px); } }
@media (prefers-reduced-motion: reduce) { .app *, .app *::before { animation: none !important; transition: none !important; } }
/* 0.7.8 – Punkte aus 0.6.3 zurück (Mockup glas.html) */
.erkl { font-size: 12px; color: var(--ink2); background: rgba(255,255,255,.06); border-radius: 10px; padding: 8px 10px; margin-top: 8px; line-height: 1.45; }
.hell .erkl { background: rgba(0,0,0,.04); }
.glas-nav.sechs button { font-size: 12px; padding-left: 1px; padding-right: 1px; } .glas-nav.sechs button.nav-ic { flex-basis: 40px; }
.modus-z { flex-wrap: wrap; } .modus-z > div:first-child { flex: 1 1 200px; } .modus-z .seg { flex: 1 1 100%; }
.seg button[disabled] { opacity: .35; cursor: not-allowed; }
.jc-modus { font: inherit; font-size: 12px; color: var(--ink); background: rgba(255,255,255,.1); border: 1px solid var(--gridc); border-radius: 9px; padding: 4px 6px; }
.hell .jc-modus { background: rgba(255,255,255,.7); }
.warn-zeile { display: block; width: 100%; text-align: left; padding: 10px 14px; margin-bottom: 10px; }
.warn-zeile.stoerung b { color: var(--rot); } .warn-zeile.hinweis b { color: var(--amber); } .warn-zeile .leise { display: block; font-size: 12px; margin-top: 2px; }
.p-schacht { display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: center; margin-bottom: 8px; } .p-illu .bc { max-width: 96px; }
.tab-scroll { overflow-x: auto; } .je-geraet td, .je-geraet th { white-space: nowrap; padding-left: 8px; } .je-geraet td:first-child { white-space: normal; padding-left: 0; }
/* 0.7.11 – Reiter Heizung als Kacheln (Mockup heizung-varianten.html, Variante A) */
.hz-held { padding: 14px 16px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; }
.hz-held-kopf { display: flex; justify-content: space-between; align-items: flex-start; }
.hz-status { font-size: 22px; font-weight: 600; margin-top: 2px; } .hz-status.an { color: var(--amber); }
.hz-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.hz-chip { font-size: 12px; padding: 4px 9px; border-radius: 12px; background: rgba(255,255,255,.12); white-space: nowrap; }
.hell .hz-chip { background: rgba(0,0,0,.06); }
.hz-raster { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media (min-width: 700px) { .hz-raster { grid-template-columns: repeat(4, 1fr); } }
.hz-kachel { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px; text-align: left; min-height: 118px; animation: rein .45s ease-out backwards; }
.hz-k-kopf { display: flex; justify-content: space-between; width: 100%; }
.hz-sym { font-size: 20px; line-height: 1; }
.hz-k-titel { font-size: 12px; color: var(--ink2); margin-top: 6px; }
.hz-k-wert { font-size: 17px; font-weight: 600; line-height: 1.2; }
.hz-k-unter { font-size: 11.5px; line-height: 1.35; }
.hz-mini { display: flex; align-items: flex-end; gap: 3px; height: 22px; margin: 3px 0 1px; width: 100%; }
.hz-mini i { flex: 1; background: var(--amber); opacity: .55; border-radius: 2px 2px 0 0; } .hz-mini i.heute { opacity: 1; }
.hz-innen { padding: 4px 0 8px; } .hz-innen + .hz-innen { border-top: 1px solid var(--gridc); padding-top: 12px; }
`;

/* Himmel hinter Glas (mockups/quelle/himmel.frag + himmel.js) */
const HIMMEL_FS = "// Hintergrund „Himmel hinter einer Glasscheibe“: Stimmung nach Tageszeit und Wetter.\n// Eigene Umsetzung (WebGL 1 / GLSL ES 1.0). Einheiten: CSS-Pixel, y nach unten.\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n\nuniform vec2 uRes;        // Gerätepixel\nuniform float uDpr;\nuniform float uTime;      // Sekunden\nuniform vec3 uG1, uG2, uG3, uF1, uF2, uF3;   // Verlauf und Lichtflecken der Stimmung\nuniform float uBlobA, uSat;\nuniform vec3 uDunstC; uniform float uDunst;\nuniform vec3 uWolkeD, uWolkeH, uNebelC;\nuniform float uWolken, uRegen, uSchnee, uNebel, uSonne, uNachtKlar, uBlitz, uBlitzX;\nuniform vec2 uSonnePos; uniform vec3 uSonneF;\nuniform vec2 uMondPos; uniform float uMondK, uMondSeite;   // Mond: Ort, cos(2π·Mondalter), +1 zunehmend / −1 abnehmend\n\nvec2 R;\n\nfloat h11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }\nvec3 h31(float p) { vec3 q = fract(vec3(p) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xxy + q.yzz) * q.zyx); }\nfloat h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }\nfloat rausch(vec2 p) {\n  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);\n  return mix(mix(h21(i), h21(i + vec2(1., 0.)), u.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), u.x), u.y);\n}\nfloat fbm(vec2 p) {\n  float s = 0., a = .5;\n  for (int i = 0; i < 5; i++) { s += a * rausch(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; }\n  return s;\n}\n\nvec3 fleck(vec3 col, vec3 f, vec2 c, float r, float ph, vec2 p) {\n  float k = .5 - .5 * cos(6.2832 * uTime / 14. + ph);\n  c += vec2(30., 40.) * k; r *= 1. + .15 * k;\n  float g = dot(f, vec3(.299, .587, .114));\n  f = mix(vec3(g), f, uSat);\n  float d = length(p - c) / (r + 60.);\n  return mix(col, f, uBlobA * exp(-d * d * 2.2));\n}\n\nvec3 grund(vec2 p) {\n  float a = radians(165.);\n  vec2 dir = vec2(sin(a), -cos(a));\n  float t = clamp(dot(p - R * .5, dir) / (abs(R.x * dir.x) + abs(R.y * dir.y)) + .5, 0., 1.);\n  vec3 col = t < .5 ? mix(uG1, uG2, t * 2.) : mix(uG2, uG3, t * 2. - 1.);\n  col = fleck(col, uF1, vec2(70., 70.), 130., 0., p);\n  col = fleck(col, uF2, vec2(R.x - 40., 420.), 120., -2.244, p);\n  col = fleck(col, uF3, vec2(140., R.y - 60.), 100., -4.039, p);\n  return col;\n}\n\n/* Alles hinter der Scheibe */\nvec3 szene(vec2 p) {\n  vec2 uv = p / R;\n  vec3 col = grund(p);\n\n  if (uSonne > .01) {\n    vec2 d = p - uSonnePos * R;\n    float r = length(d) / R.y;\n    float ang = atan(d.y, d.x);\n    float strahl = pow(rausch(vec2(ang * 11., uTime * .04)), 4.) * exp(-r * 4.) * smoothstep(.02, .08, r) * .05;\n    // gedämpft, damit die Schrift auf dem Glas davor lesbar bleibt\n    col += uSonneF * (exp(-r * 7.) * .08 + exp(-r * 30.) * .14 + strahl) * uSonne;\n    col = mix(col, vec3(1., .98, .93), smoothstep(.016, .011, r) * .55 * uSonne);\n  }\n\n  if (uNachtKlar > .01) {\n    vec2 id = floor(p / 26.), f = fract(p / 26.) - .5;\n    vec3 n = h31(id.x * 57.3 + id.y * 113.1);\n    float s = smoothstep(.05 + .05 * n.z, 0., length(f - (n.xy - .5) * .7)) * step(.6, n.z);\n    s *= .55 + .45 * sin(uTime * (1. + n.x * 3.) + n.y * 6.28);\n    col += vec3(.9, .95, 1.) * s * smoothstep(.9, .25, uv.y) * uNachtKlar;\n    vec2 mp = uMondPos * R, mq = (p - mp) / 20.;\n    float mr = length(p - mp), anteil = .5 - .5 * uMondK;   // beleuchteter Anteil der Scheibe\n    col += vec3(.55, .65, .9) * exp(-mr / 70.) * .35 * (.2 + .8 * anteil) * uNachtKlar;\n    float scheibe = smoothstep(21., 19.5, mr);\n    // Schattengrenze: beleuchtet, wo x (zur Lichtseite) über uMondK·√(1−y²) liegt\n    float grenze = uMondK * sqrt(max(1. - mq.y * mq.y, 0.));\n    float licht = smoothstep(grenze - .06, grenze + .06, mq.x * uMondSeite);\n    vec3 mf = vec3(.95, .94, .88) - fbm((p - mp) * .14) * .3;\n    col = mix(col, mix(col * .75 + mf * .06, mf, licht), scheibe * uNachtKlar);\n  }\n\n  if (uWolken > .01) {\n    vec2 q = uv * vec2(R.x / R.y, 1.) * 2.4 + vec2(uTime * .015, 0.);\n    float w = fbm(q + fbm(q * 1.6 + vec2(0., uTime * .02)) * 1.3);\n    float bed = mix(.62, .22, clamp(uWolken, 0., 1.));\n    float dichte = smoothstep(bed, bed + .38, w) * (1. - .35 * uv.y);\n    float licht = smoothstep(.3, .85, fbm(q * 2.1 + vec2(3.1, -uTime * .01)) * .6 + (w - bed) * .9);\n    vec3 wf = mix(uWolkeD, uWolkeH, licht);\n    wf += vec3(.8, .84, 1.) * uBlitz * (.25 + licht * .55) * .6;\n    col = mix(col, wf, clamp(dichte * uWolken * 1.15, 0., 1.));\n  }\n\n  if (uBlitz > .01) {\n    float y = uv.y;\n    float x = uBlitzX * R.x + (fbm(vec2(y * 7., uBlitzX * 40.)) - .5) * 160. + (rausch(vec2(y * 40., uBlitzX * 9.)) - .5) * 18.;\n    float strahl = smoothstep(2.5, 0., abs(p.x - x)) + smoothstep(14., 0., abs(p.x - x)) * .35;\n    col += vec3(.9, .92, 1.) * strahl * smoothstep(.62, .45, y) * uBlitz;\n    col += uBlitz * .05;\n  }\n\n  if (uRegen > .01) {\n    vec2 rp = vec2(p.x + p.y * .2, p.y);\n    float sp = floor(rp.x / 5.);\n    vec3 n = h31(sp * 13.7 + 2.);\n    float y = fract(rp.y / (R.y * .7) - uTime * (1.1 + n.x * .8) + n.y);\n    float strich = smoothstep(0., .015, y) * smoothstep(.16, .02, y) * smoothstep(.22, 0., abs(fract(rp.x / 5.) - .5));\n    col += vec3(.75, .82, .95) * strich * step(n.z, .28 * min(uRegen, 1.4)) * .16;\n  }\n\n  if (uNebel > .01) {\n    vec2 q = uv * vec2(R.x / R.y, 1.) * 2.2;\n    float n1 = fbm(q * vec2(.7, 1.5) + vec2(uTime * .03, 0.));\n    float n2 = fbm(q * vec2(1.4, 2.6) - vec2(uTime * .055, uTime * .01) + 5.2);\n    float dichte = smoothstep(.32, .8, n1 * .55 + n2 * .55);\n    vec3 nf = mix(uNebelC * .92, uNebelC * 1.18, dichte);\n    col = mix(col, nf, clamp(.3 + dichte * .6 * (.55 + .45 * uv.y), 0., 1.) * uNebel);\n  }\n\n  if (uSchnee > .01) {\n    for (int k = 0; k < 3; k++) {\n      float fk = float(k) / 2.;\n      float zelle = mix(95., 26., fk), rad = mix(4.2, 1.1, fk), v = mix(62., 22., fk), weich = mix(3.2, .6, fk);\n      vec2 q = p + vec2(sin(uTime * .4 + fk * 3.) * 24., -uTime * v);\n      vec2 id = floor(q / zelle), f = q - (id + .5) * zelle;\n      vec3 n = h31(id.x * 31.7 + id.y * 17.3 + fk * 71.);\n      vec2 o = (n.xy - .5) * zelle * .7 + vec2(sin(uTime * (.7 + n.z) + n.x * 6.28) * zelle * .12, 0.);\n      float fl = smoothstep(rad + weich, rad - weich * .3, length(f - o)) * step(n.z, .8);\n      col = mix(col, vec3(1.), fl * mix(.8, .55, fk) * uSchnee);\n    }\n  }\n\n  return mix(col, uDunstC, uDunst);\n}\n\n/* Tropfen auf der Scheibe: xy = Versatz für die Brechung, z = Wasser, w = klares Glas */\nvec4 laufend(vec2 p) {\n  float cw = 32.;\n  float spalte = floor(p.x / cw);\n  vec3 n = h31(spalte * 17.13 + 3.1);\n  if (n.x > .45 * uRegen) return vec4(0.);\n  float x0 = (spalte + .5) * cw + (n.y - .5) * cw * .18;\n  float dauer = mix(4.5, 9., n.z) / max(uRegen, .6);\n  float k = uTime / dauer + n.x * 7.;\n  vec3 m = h31(spalte * 3.7 + floor(k) * 11.9);\n  float stufen = 7.;\n  float g = fract(k) * stufen;\n  g = (floor(g) + smoothstep(.5, 1., fract(g))) / stufen;\n  float yK = mix(-.08, 1.12, g) * R.y;\n  float r = mix(4.5, 8.5, m.x);\n  float xl = x0 + sin(p.y * .02 + m.y * 6.) * 2.5;\n  vec2 q = vec2(p.x - xl, p.y - yK);\n  q.y *= q.y < 0. ? .6 : 1.05;\n  float wasser = smoothstep(1., .85, length(q) / r);\n  vec2 v = q / r;\n  float oben = yK - p.y;\n  float lang = mix(70., 200., m.z);\n  float xs = abs(p.x - xl);\n  float inSpur = step(0., oben) * smoothstep(lang, 0., oben);\n  float abst = 15.;\n  float yr = mod(oben, abst) - abst * .5;\n  float rr = r * .42 * inSpur * (.55 + .45 * h11(floor(oben / abst) + spalte * 7.));\n  vec2 qr = vec2(p.x - xl, yr);\n  float perle = rr > .2 ? smoothstep(rr, rr * .7, length(qr)) * step(abst * .7, oben) : 0.;\n  if (perle > wasser) { wasser = perle; v = qr / max(rr, .5); }\n  float klar = max(smoothstep(r * .55, r * .25, xs) * step(0., oben) * smoothstep(lang * 1.4, 0., oben), wasser);\n  return vec4(v, wasser, klar);\n}\n\nvec4 stehend(vec2 p, float zelle, float rMin, float rMax, float dichte, float seed) {\n  vec2 id = floor(p / zelle);\n  vec3 n = h31(id.x * 127.1 + id.y * 311.7 + seed);\n  float per = mix(7., 15., n.z);\n  float t = uTime / per + n.x * 5.;\n  float leben = fract(t);\n  vec3 m = h31(id.x * 7.3 + id.y * 13.1 + seed + floor(t) * 1.7);\n  float r = mix(rMin, rMax, m.x) * smoothstep(0., .12, leben) * smoothstep(1., .85, leben) * step(n.y, dichte);\n  if (r < .3) return vec4(0.);\n  vec2 c = (id + .5) * zelle + (m.yz - .5) * (zelle - 2. * rMax) * .9;\n  vec2 q = p - c;\n  float wasser = smoothstep(r, r * .8, length(q));\n  return vec4(q / r, wasser, wasser);\n}\n\nvoid main() {\n  R = uRes / uDpr;\n  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;\n  vec3 col = szene(p);\n  if (uRegen > .01) {\n    vec4 a = laufend(p);\n    vec4 b = stehend(p, 19., 1.2, 3.4, .5 + .3 * min(uRegen, 1.), 1.);\n    vec4 c = stehend(p, 40., 3.5, 8.5, .5 * min(uRegen, 1.), 7.);\n    float weg = a.w;\n    b.z *= 1. - weg; c.z *= 1. - weg;\n    vec4 w = a;\n    if (b.z > w.z) w = vec4(b.xy, b.z, max(a.w, b.z));\n    if (c.z > w.z) w = vec4(c.xy, c.z, max(a.w, c.z));\n    float wasser = w.z * min(uRegen, 1.);\n    if (wasser > .01) {\n      vec2 qn = w.xy;                                  // Lage im Tropfen, Mitte 0, Rand 1\n      float lq = length(qn);\n      // Linse: der Himmel erscheint verkleinert und auf dem Kopf\n      vec3 linse = szene(p - qn * 22. + vec2(0., -6.)) * 1.08;\n      linse *= 1. - .38 * smoothstep(.15, 1., -qn.y) * smoothstep(.4, 1., lq);   // oben dunkler Rand\n      linse += vec3(.9, .95, 1.) * .22 * smoothstep(.1, .9, qn.y) * smoothstep(1., .75, lq); // unten helle Sichel\n      linse *= 1. - .25 * smoothstep(.72, 1., lq);                              // Kante\n      linse += vec3(1.) * .75 * smoothstep(.2, .04, length(qn - vec2(-.3, -.42))); // Glanzpunkt\n      col = mix(col, linse, wasser);\n      col *= 1. - .18 * smoothstep(.0, .5, wasser) * smoothstep(1., .5, wasser);   // Schatten am Außenrand\n    }\n    col *= 1. - .035 * max(a.w - wasser, 0.);         // nasse Spur hinter laufenden Tropfen\n    float beschlag = (1. - max(w.w, wasser)) * .07 * min(uRegen, 1.);\n    col = mix(col, uNebelC, beschlag);\n  }\n  if (uSchnee > .01) {\n    vec2 uv = p / R;\n    float rand = min(min(uv.x, 1. - uv.x) * R.x / R.y * 1.4, (1. - uv.y) * .8);\n    float eis = smoothstep(.09, 0., rand + (fbm(p * .018) - .5) * .14) * (.4 + .6 * uv.y);\n    float kristall = smoothstep(.55, .75, fbm(p * .12 + 3.)) * .5 + .5;\n    col = mix(col, vec3(.93, .97, 1.), eis * kristall * .6 * uSchnee);\n  }\n  gl_FragColor = vec4(col, 1.);\n}\n";
/* Himmel hinter Glas: Werte je Stimmung (Tageszeit × Wetter × hell/dunkel) und WebGL-Zeichner.
   himmelZiel() ist rein (ohne DOM) und wird auch von der Standbild-Vorschau benutzt. */
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const HIMMEL_FARBEN = {
  dunkel: {
    morgen: ['#2e2748', '#4a3150', '#6b4040', '#ff8a5c', '#6a7bd6', '#d07ab8'],
    tag:    ['#1c3552', '#1f4a70', '#2a5575', '#ffc766', '#3aa0ff', '#7fd0ff'],
    abend:  ['#2a1a36', '#45203d', '#5a2a2c', '#ff7a2e', '#d0457a', '#7a4bd0'],
    nacht:  ['#070d1c', '#0c1528', '#131a33', '#2c3e8a', '#1b4a7a', '#4b3a8a'],
  },
  hell: {
    morgen: ['#ffd9c7', '#f5e0f0', '#cfdcff', '#ff9a6a', '#9fb4ff', '#f0a0c8'],
    tag:    ['#cfe6ff', '#e3f1ff', '#fff3d6', '#ffd060', '#6ab8ff', '#a8e0ff'],
    abend:  ['#ffd2b0', '#f7c6d8', '#d9ccff', '#ff8a3a', '#ff6f9a', '#a58aff'],
    nacht:  ['#b9c4e0', '#c9cde6', '#d8d0ec', '#6d80c8', '#7fa3dc', '#9a88d2'],
  },
};

function himmelZiel(phase, wetter, hell) {
  const f = HIMMEL_FARBEN[hell ? 'hell' : 'dunkel'][phase].map(hex), nacht = phase === 'nacht', warm = phase === 'morgen' || phase === 'abend';
  const gew = wetter === 'gewitter';
  const w = { klar: 0, wolkig: .8, regen: .95, gewitter: 1, nebel: .2, schnee: .55 }[wetter];
  let wolkeD, wolkeH, nebelC, dunstC;
  if (hell) {
    wolkeD = gew ? [.4, .43, .5] : nacht ? [.5, .55, .65] : [.54, .58, .65];
    wolkeH = gew ? [.7, .73, .8] : nacht ? [.78, .81, .88] : warm ? [.96, .88, .86] : [.88, .9, .94];
    nebelC = [.87, .89, .91]; dunstC = gew ? [.6, .64, .7] : [.79, .81, .84];
  } else {
    wolkeD = gew ? [.06, .07, .1] : nacht ? [.05, .06, .09] : [.13, .15, .2];
    wolkeH = gew ? [.3, .32, .38] : nacht ? [.18, .2, .27] : warm ? [.55, .42, .45] : [.47, .51, .58];
    nebelC = nacht ? [.2, .23, .28] : [.42, .46, .52]; dunstC = gew ? [.11, .13, .19] : [.24, .27, .33];
  }
  const sonne = { morgen: [[.16, .34], [1, .62, .36]], tag: [[.22, .1], [1, .86, .58]], abend: [[.84, .36], [1, .5, .3]], nacht: [[.5, .1], [0, 0, 0]] }[phase];
  return {
    uG1: f[0], uG2: f[1], uG3: f[2], uF1: f[3], uF2: f[4], uF3: f[5],
    uBlobA: { klar: .7, wolkig: .28, regen: .22, gewitter: .12, nebel: .2, schnee: .3 }[wetter] * (nacht ? .65 : 1),
    uSat: { klar: 1, wolkig: .75, regen: .7, gewitter: .6, nebel: .5, schnee: .6 }[wetter],
    uDunstC: dunstC, uDunst: { klar: 0, wolkig: .1, regen: .18, gewitter: .22, nebel: .12, schnee: .1 }[wetter],
    uWolkeD: wolkeD, uWolkeH: wolkeH, uNebelC: nebelC,
    uWolken: w, uRegen: wetter === 'regen' ? 1 : gew ? 1.5 : 0, uSchnee: wetter === 'schnee' ? 1 : 0, uNebel: wetter === 'nebel' ? 1 : 0,
    uSonne: wetter === 'klar' && !nacht ? 1 : 0, uNachtKlar: wetter === 'klar' && nacht ? 1 : 0,
    uSonnePos: sonne[0], uSonneF: sonne[1].map(v => v * (hell ? .8 : 1)),
    uMondPos: [.8, .13], uMondK: -1, uMondSeite: 1,
  };
}

/* Stufenlos nach Sonnenstand: Farben gleiten zwischen den Stimmungen. Unter −8° Nacht, bis 0° Dämmerung,
   0–4° Morgen-/Abendrot, bis 15° Übergang zum Tag. steigt = Vormittag (Morgen), sonst Nachmittag (Abend). */
function himmelZielBei(hoehe, steigt, wetter, hell) {
  const anteil = (a, b) => Math.min(1, Math.max(0, (hoehe - a) / (b - a))), warm = steigt ? 'morgen' : 'abend';
  const [a, b, w] = hoehe < 0 ? ['nacht', warm, anteil(-8, 0)] : [warm, 'tag', anteil(4, 15)];
  const za = himmelZiel(a, wetter, hell), zb = himmelZiel(b, wetter, hell);
  const m = (x, y) => Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * w) : x + (y - x) * w;
  return Object.fromEntries(Object.keys(za).map(n => [n, m(za[n], zb[n])]));
}

/* Lauf von Sonne und Mond auf einem Bogen von links (Aufgang) nach rechts (Untergang), tagesaktuell aus sun.sun
   (next_rising/next_setting). Nachts läuft der Mond denselben Bogen vom Untergang bis zum nächsten Aufgang. */
function himmelsBahn(sonne, jetzt = Date.now()) {
  const a = (sonne && sonne.attributes) || {}, auf = Date.parse(a.next_rising), ab = Date.parse(a.next_setting);
  const oben = !sonne || sonne.state !== 'below_horizon';
  let t = .5;
  if (Number.isFinite(auf) && Number.isFinite(ab)) {
    const start = (oben ? auf : ab) - 864e5, ende = oben ? ab : auf;   // letzter Aufgang/Untergang ≈ nächster − 1 Tag
    if (ende > start) t = Math.min(1, Math.max(0, (jetzt - start) / (ende - start)));
  }
  return { t, oben };
}
/* Mondalter 0…1 (0 Neumond, .5 Vollmond) aus dem Datum: Neumond 6.1.2000 18:14 UTC, synodischer Monat 29,530589 Tage */
function mondAlter(jetzt = Date.now()) { const p = ((jetzt - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1; return p < 0 ? p + 1 : p; }
const himmelsBogen = t => [.08 + .84 * t, .4 - .3 * Math.sin(Math.PI * t)];
/* Werte für Sonne und Mond; in der Dämmerung (Sonne knapp unter dem Horizont) steht die Sonne am Rand */
function himmelLauf(sonne, jetzt = Date.now()) {
  const b = himmelsBahn(sonne, jetzt), alter = mondAlter(jetzt), steigt = sonne && sonne.attributes && sonne.attributes.rising;
  return { uSonnePos: himmelsBogen(b.oben ? b.t : steigt === false ? 1 : 0), uMondPos: himmelsBogen(b.oben ? .5 : b.t),
    uMondK: Math.cos(2 * Math.PI * alter), uMondSeite: alter < .5 ? 1 : -1 };
}

const HIMMEL_VS = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0., 1.); }';

class Himmel {
  /* Gibt null zurück, wenn WebGL fehlt oder der Shader nicht übersetzt – dann bleibt der CSS-Hintergrund. */
  static an(bg) {
    try { const h = new Himmel(bg); return h.gl ? h : null; } catch (e) { console.warn('Himmel aus:', e); return null; }
  }
  constructor(bg) {
    this.bg = bg; this.cv = document.createElement('canvas'); this.cv.className = 'himmel';
    const gl = this.cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); if (!gl) return;
    const sh = (typ, src) => { const s = gl.createShader(typ); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, HIMMEL_VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, HIMMEL_FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    this.gl = gl; this.pr = pr; this.loc = {}; this.jetzt = null; this.ziel = null; this.blitz = 0; this.naechsterBlitz = 3; this.blitzX = .5;
    bg.insertBefore(this.cv, bg.querySelector('.partikel')); bg.classList.add('gl-an');
    this.ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ro = new ResizeObserver(() => this.groesse()); this.ro.observe(bg); this.groesse();
    this.t0 = performance.now(); this.letzt = 0; this.schleife = this.schleife.bind(this); requestAnimationFrame(this.schleife);
  }
  groesse() { const d = Math.min(devicePixelRatio || 1, 1.5); this.dpr = d; this.cv.width = Math.round(this.bg.clientWidth * d); this.cv.height = Math.round(this.bg.clientHeight * d); this.gl.viewport(0, 0, this.cv.width, this.cv.height); }
  /* Stimmung setzen: mit Sonnenhöhe stufenlos, sonst nach Tageszeit; lauf = Sonne und Mond (himmelLauf) */
  setze(phase, wetter, hell, sonne = null, lauf = null) {
    const a = sonne && sonne.attributes, hoehe = a ? Number(a.elevation) : NaN;
    this.ziel = { ...(Number.isFinite(hoehe) ? himmelZielBei(hoehe, a.rising !== false, wetter, hell) : himmelZiel(phase, wetter, hell)), ...lauf };
    this.gewitter = wetter === 'gewitter'; if (!this.jetzt) this.jetzt = JSON.parse(JSON.stringify(this.ziel));
  }
  u(n, v) { const l = this.loc[n] ??= this.gl.getUniformLocation(this.pr, n); if (l === null) return;
    Array.isArray(v) ? this.gl['uniform' + v.length + 'fv'](l, v) : this.gl.uniform1f(l, v); }
  /* Seite verlassen: Zeichnen beenden, Leinwand entfernen und WebGL-Kontext freigeben (sonst stapeln sich beim Wiederkommen Kontexte) */
  stop() {
    this.aus = true; if (this.ro) this.ro.disconnect();
    try { const x = this.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* egal */ }
    if (this.cv.parentNode) this.cv.parentNode.removeChild(this.cv); this.bg.classList.remove('gl-an');
  }
  schleife(ms) {
    if (this.aus) return;
    requestAnimationFrame(this.schleife);
    const t = (ms - this.t0) / 1000; if (t - this.letzt < 1 / 30 || !this.ziel) return;   // 30 Bilder je Sekunde reichen
    const dt = Math.min(t - this.letzt, .1); this.letzt = t;
    const k = 1 - Math.exp(-dt / .9);                                                      // weiche Überblendung ~2,5 s
    for (const n in this.ziel) { const z = this.ziel[n], j = this.jetzt[n]; this.jetzt[n] = Array.isArray(z) ? z.map((v, i) => j[i] + (v - j[i]) * k) : j + (z - j) * k; }
    if (this.gewitter && !this.ruhig) {                                                     // Doppelblitz alle 5–12 s
      this.naechsterBlitz -= dt;
      if (this.naechsterBlitz <= 0) { this.blitzT = 0; this.blitzX = .2 + Math.random() * .6; this.naechsterBlitz = 5 + Math.random() * 7; }
      if (this.blitzT !== undefined) { this.blitzT += dt; const b = this.blitzT; this.blitz = b < .08 ? 1 : b < .16 ? .15 : b < .24 ? .8 : Math.max(0, .8 - (b - .24) * 3); if (b > .6) this.blitzT = undefined; }
    } else this.blitz = 0;
    const gl = this.gl;
    this.u('uRes', [this.cv.width, this.cv.height]); this.u('uDpr', this.dpr); this.u('uTime', this.ruhig ? 20 : t % 3600);
    for (const n in this.jetzt) this.u(n, this.jetzt[n]);
    this.u('uBlitz', this.blitz); this.u('uBlitzX', this.blitzX);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}


/* ---------- Hilfen (wie im Mockup, aber sicher gegen fehlende Werte) ---------- */
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const zahl = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
const de = (x, d = 1) => { if (!zahl(x)) return '–'; const n = Number(x); return (Math.abs(n) < .5 * 10 ** -d ? 0 : n).toLocaleString('de-AT', { minimumFractionDigits: d, maximumFractionDigits: d }); };
const FARBE = { bereit: '#8e8e93', heizt: '#ff9f0a', trocknen: '#ff9f0a', aus: '#8e8e93', frost: '#64d2ff', offline: '#ff453a', laeuft: '#0a84ff', pause: '#bf5af2' };
const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const TICKET_STATUS = { neu: 'neu', angenommen: 'angenommen', in_arbeit: 'in Arbeit', geloest: 'gelöst', geschlossen: 'geschlossen', verworfen: 'verworfen', offen: 'neu', erledigt: 'geschlossen' };
const ICON_MELDEN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 5h16v11H9l-5 4z"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 8v3.5M12 13.6v.2"/></svg>';
const minu = t => { if (!t) return 0; const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const uhr = m => { m = Math.max(0, Math.round(zahl(m) ? m : 0)); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const datum = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('.') : '–';
const WIEDER = { einmal: 'einmalig', woche: 'jede Woche', '2wochen': 'alle 2 Wochen' };
const tageZwischen = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const plusTage = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/* Liegt ein (wiederkehrender) Termin auf diesem Tag? */
const terminAm = (t, iso) => { const d = tageZwischen(t.datum, iso); return t.wieder === 'einmal' ? d === 0 : d >= 0 && d % (t.wieder === '2wochen' ? 14 : 7) === 0; };
const naechsterTermin = (t, ab) => { for (let k = 0; k < 28; k++) { const iso = plusTage(ab, k); if (terminAm(t, iso)) return iso; } return null; };
const AUSNAHME = { arbeit: 'zusätzlich arbeiten', zeiten: 'andere Zeiten', frei: 'frei' };
const kurzDatum = iso => iso ? String(iso).slice(0, 10).split('-').reverse().slice(0, 2).join('.') + '.' : '–';
const wtag = iso => iso ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(String(iso).slice(0, 10) + 'T12:00:00Z').getUTCDay()] : '–';
const dauer = (a, b) => { const m = minu(b) - minu(a); return `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`; };
const stdMin = h => { if (!zahl(h)) return '–'; const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const MONATE = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONATE_LANG = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const summe = a => (a || []).reduce((x, v) => x + (zahl(v) ? Number(v) : 0), 0);
const addieren = arr => arr.length ? arr.reduce((a, w) => a.map((v, i) => v + (w[i] || 0))) : [];
const LAEDT = '<div class="leer">Lädt …</div>';

/* Zuordnung der Geräte: Rolle und Typ der Integration → Anzeige wie im Mockup */
const HEIZER = g => ['heizung', 'heizkoerper'].includes(g.rolle);
const TYP_TEXT = g => g.rolle === 'pumpe' ? 'Pumpe' : HEIZER(g) ? (g.typ === 'konvektor' ? 'Konvektor' : 'Ölradiator')
  : ['trockner', 'bautrockner'].includes(g.rolle) ? 'Bautrockner' : 'Steckdose';
const TYP_ROLLE = { Ölradiator: ['heizkoerper', 'oelradiator'], Konvektor: ['heizkoerper', 'konvektor'], Bautrockner: ['bautrockner', 'oelradiator'],
  Steckdose: ['steckdose', 'oelradiator'], Pumpe: ['pumpe', 'oelradiator'] };
/* Einstellungen: Schlüssel der Seite (wie im Mockup) → Pfad im Store (bauplan §1) */
const PFAD = { preis: ['preis'], melden: ['melden_knopf'], feiertag_frei: ['heizung', 'feiertag_frei'], boost_min: ['heizung', 'boost_min'],
  staffel: ['staffel', 'an'], nutzbar: ['staffel', 'nutzbar_prozent'], max_gleich: ['staffel', 'max_gleichzeitig'], min_lauf: ['staffel', 'min_lauf_min'],
  min_pause: ['staffel', 'min_pause_min'], takt: ['staffel', 'takt_min'], tuer_pause: ['heizung', 'tuer_pause_min'], tuer_melden: ['heizung', 'tuer_melden_min'],
  knoepfe: ['meldungen_einst', 'knoepfe'], bericht: ['bericht', 'haeufigkeit'], bericht_handy: ['bericht', 'handy'], bericht_mail: ['bericht', 'mail'],
  mail: ['bericht', 'mail_an'], bericht_csv: ['bericht', 'csv'], vorheizen: ['heizung', 'vorheizen_min'], nachheizen: ['heizung', 'nachheizen_min'],
  soll: ['heizung', 'soll'], grenze: ['heizung', 'heizgrenze'], basis: ['heizung', 'heizgrenze_basis'], fruehstart: ['heizung', 'fruehstart'],
  frueh_temp: ['heizung', 'fruehstart_unter'], frueh_min: ['heizung', 'fruehstart_min'], frost: ['heizung', 'frost'], frost_temp: ['heizung', 'frost_grenze'],
  tr_mm: ['heizung', 'trocknen_ab_mm'], tr_laenger: ['heizung', 'trocknen_laenger_min'], tr_frueher: ['heizung', 'trocknen_frueher_min'],
  dauer_min: ['meldungen_einst', 'dauerlauf_min'], kalt_min: ['meldungen_einst', 'kalt_min'], hand_h: ['meldungen_einst', 'hand_h'], zyklen_h: ['meldungen_einst', 'zyklen_h'],
  // aus 0.6.3 zurück (0.7.8, api §7)
  frost_aus: ['heizung', 'frost_aus'], urlaub: ['heizung', 'frei_modus'], absenk: ['heizung', 'absenk'], offline_min: ['meldungen_einst', 'offline_min'],
  trocken_w: ['meldungen_einst', 'trocken_unter_w'], erklaer: ['erklaer'], frost_immer: ['heizung', 'frost_immer'] };
/* Grenzen der Stepper: Untergrenze wie im Mockup, sonst die erlaubten Werte der Integration (panel.py SETZEN) –
   so schickt die Seite nie einen Wert, den die Integration ablehnt */
const GRENZEN = { nutzbar: [30, 100], max_gleich: [1, 50], min_lauf: [1, 120], min_pause: [0, 120], takt: [5, 240], tuer_pause: [1, 120], tuer_melden: [1, 240],
  vorheizen: [0, 240], nachheizen: [0, 240], soll: [5, 30], grenze: [0, 30], frueh_temp: [-15, 20], frueh_min: [0, 240], frost_temp: [0, 15],
  tr_mm: [0, 100], tr_laenger: [0, 480], tr_frueher: [0, 240], boost_min: [5, 480],
  frost_aus: [1, 20], absenk: [5, 20], offline_min: [1, 1440], trocken_w: [5, 5000], dauer_min: [5, 1440], zyklen_h: [2, 200] };
/* Modus je Container (0.7.8): wie im Mockup, Thermostat nur mit Fühler */
const MODI = [['plan', 'Zeitplan'], ['thermo', 'Thermostat'], ['bedarf', 'Bei Bedarf'], ['hand', 'Hand'], ['aus', 'Aus']];
const MODUS_TEXT = { plan: 'an in der Heizzeit – der Thermostat am Heizkörper regelt', thermo: 'in der Heizzeit auf das Soll nach dem Fühler',
  bedarf: 'nur per Schalter oder Termin, sonst Frostschutz', hand: 'die Automatik schaltet nicht – Schalter unten', aus: 'alles aus, Frostschutz bleibt' };
const FREI_TEXT = { frost: 'nur Frostschutz', absenk: 'abgesenkt', aus: 'alles aus' };
/* Erklärtexte „ⓘ“ (abschaltbar unter Einstellungen › App) */
const erkl = (an, text) => an ? `<div class="erkl">ⓘ ${text}</div>` : '';
const STUNDEN = [...Array(24)].map((_, h) => String(h).padStart(2, '0'));
/* Reiter Heizung als Kacheln: Schlüssel, Titel des bisherigen Blocks, Symbol, Name der Einblendung */
const HZ_TEILE = [['heute', 'Heute', '🕖', 'Heute'], ['wann', 'Wann welche Heizung heizt', '🔥', 'Wann heizt was'], ['plan', 'Heizplan · diese Woche', '📅', 'Diese Woche'],
  ['az', 'Arbeitszeit', '👷', 'Arbeitszeit'], ['ausn', 'Ausnahmen', '✳️', 'Ausnahmen'], ['regeln', 'So wird geheizt', '⚙️', 'Regeln'],
  ['trocknen', '👕 Kleidung trocknen', '👕', 'Kleidung trocknen'], ['container', 'Je Container', '🏠', 'Container'], ['urlaub', 'Urlaub &amp; Feiertage', '🏖', 'Urlaub & Feiertage']];
const ARTEN = { m_offline: 'offline', m_trocken: 'trockenlauf', m_dauer: 'dauerlauf', m_zyklen: 'zyklen_oft', m_leistung: 'keine_leistung', m_frost: 'frostgefahr',
  m_kalt: 'zu_kalt', m_fuehler: 'fuehler_fehlt', m_wetter: 'kein_wetter', m_hand: 'hand_zu_lange' };
/* Abschnitte der Integration → Klassen der Zeitleiste im Mockup */
const ABSCHNITT = { fruehstart: 'extra', vorheizen: 'vor', nachheizen: 'vor', arbeitszeit: 'heiz', trocknen: 'trock', termin: 'termin' };
const WARTE = { anschluss_voll: a => `${a} ausgelastet`, max_gleichzeitig: () => 'höchstens gleichzeitig erreicht', mindestpause: () => 'Mindestpause',
  rundlauf: () => 'Rundlauf', anlauf: () => 'Anlaufstaffel' };
/* Wetter der Baustelle (weather.*) → Stimmung des Hintergrunds und Text im Kopf */
const WETTER_STIMMUNG = { sunny: 'klar', 'clear-night': 'klar', exceptional: 'klar', partlycloudy: 'wolkig', cloudy: 'wolkig', windy: 'wolkig', 'windy-variant': 'wolkig',
  rainy: 'regen', pouring: 'regen', hail: 'regen', lightning: 'gewitter', 'lightning-rainy': 'gewitter', fog: 'nebel', snowy: 'schnee', 'snowy-rainy': 'schnee' };
const WETTER_TEXT = { sunny: 'Sonnig', 'clear-night': 'Klar', exceptional: 'Unwetter', partlycloudy: 'Heiter', cloudy: 'Bewölkt', windy: 'Windig', 'windy-variant': 'Windig',
  rainy: 'Regen', pouring: 'Starkregen', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter', fog: 'Nebel', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen' };
const AKTIV = z => ['heizt', 'trocknen', 'frost', 'laeuft'].includes(z);
const kwVon = b => zahl(b.kw) ? Number(b.kw) : b.geraete.reduce((s, g) => s + (g.an ? g.kw : 0), 0);
const wertHtml = b => b.pumpe ? `${zahl(b.zyklen) ? b.zyklen : '–'}<small> Zyklen</small>` : b.t !== null ? `${de(b.t)}<small>°C</small>` : '–';
const illu = b => b.pumpe ? bcSchacht(b.z === 'laeuft') : bcContainer(BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], b.z === 'pause' || b.z === 'bereit' ? 'aus' : b.z);
const TEXT_MOCKUP = b => b.boost ? '⚡ schnell aufheizen' : ({ heizt: b.bedarf && b.bedarfBis ? `heizt bis ${b.bedarfBis}` : b.t === null ? 'an · Thermostat regelt' : 'heizt · Arbeitszeit',
  trocknen: 'Kleidung trocknen', aus: 'aus', frost: 'Frostschutz', offline: 'nicht erreichbar', laeuft: 'Pumpe läuft', pause: 'pausiert · Tür offen', bereit: 'bei Bedarf · nur Frostschutz' })[b.z] || '';
const TEXT = b => b.text || TEXT_MOCKUP(b);
const knopf2 = (t, act, text) => `<button class="knopf leise-k" data-act="${act}" data-t="${esc(text)}">${t}</button>`;
// mdi:cog – dasselbe Zahnrad wie in Home Assistant
const ICON_COG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>';
const schalter = (on, act, extra = '') => `<button class="sw ${on ? 'on' : ''}" data-act="${act}" ${extra} role="switch" aria-checked="${!!on}"><i></i></button>`;

/* ---------- Diagramme: dünne Marken, Haarraster, Hover-Anzeige (aus dem Mockup) ---------- */
const CHARTS = {};
function linie(id, reihen, einheit, vb = null) {
  // mit vb: Verbrauch als Fläche im selben Diagramm – links °C, rechts kWh (Herbert, 29.09.2026)
  const W = 320, H = 160, L = 28, R = vb ? 30 : 8, T = 16, U = 22;
  const alle = reihen.flatMap(s => s.v.filter(v => zahl(v)));
  if (!alle.length) return '<div class="leer">Noch keine Werte</div>';
  let lo = Math.floor(Math.min(...alle) / 5) * 5, hi = Math.ceil(Math.max(...alle) / 5) * 5; if (hi === lo) hi = lo + 5;
  const n = (hi - lo) / 5;
  const x = i => L + i / 24 * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - U);
  const raster = [...Array(n + 1)].map((_, k) => lo + k * 5).map(v =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${v}°</text>`).join('');
  const achse = [0, 6, 12, 18, 24].map(h => `<text x="${x(h)}" y="${H - 6}" class="ax" text-anchor="middle">${String(h).padStart(2, '0')}</text>`).join('');
  const pfade = reihen.map((s, k) => `<path d="${s.v.map((v, i) => !zahl(v) ? '' : `${i && zahl(s.v[i - 1]) ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('') || `M${L} ${H - U}`}" fill="none" stroke="var(--s${k + 1})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  let flaeche = '', rechts = '', yv = null;
  if (vb && vb.length) {
    // rechte Achse auf dieselben Rasterlinien legen: n Schritte, Schrittweite glatt gerundet
    const roh = Math.max(...vb, 0.01) * 1.1 / n, schritt = [.1, .2, .25, .5, 1, 1.5, 2, 2.5, 5].find(st => st >= roh) || 10, vmax = schritt * n;
    yv = v => T + (1 - v / vmax) * (H - T - U);
    const wert = i => vb[Math.min(i, vb.length - 1)] || 0, k = reihen.length + 1;
    const d = [...Array(25)].map((_, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${yv(wert(i)).toFixed(1)}`).join('');
    flaeche = `<defs><linearGradient id="vbg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--s${k})" stop-opacity=".42"/><stop offset="1" stop-color="var(--s${k})" stop-opacity=".06"/></linearGradient></defs>
      <path class="fl-flaeche" d="${d}L${x(24)} ${yv(0)}L${x(0)} ${yv(0)}z" fill="url(#vbg-${id})"/><path class="fl-linie" d="${d}" fill="none" stroke="var(--s${k})" stroke-width="1.5" stroke-linejoin="round" opacity=".8"/>`;
    rechts = [...Array(n + 1)].map((_, q) => q * schritt).map(v => `<text x="${W - R + 5}" y="${yv(v) + 3}" class="ax">${de(v, schritt < 1 ? (schritt < .25 ? 1 : 2) : 0)}</text>`).join('')
      + `<text x="${W - R + 5}" y="${T - 7}" class="ax ax-e">kWh</text>`;
  } else vb = null;
  const links = `<text x="${L - 5}" y="${T - 7}" class="ax ax-e" text-anchor="end">°C</text>`;
  CHARTS[id] = { art: 'linie', x0: L, x1: W - R, W, n: 25, reihen, einheit, y, vb, yv, unten: H - U };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}">${raster}${achse}${flaeche}${pfade}${vb ? links + rechts : ''}<g class="hover"></g></svg>
    <div class="legende">${reihen.map((s, k) => `<span><i style="background:var(--s${k + 1})"></i>${s.name} (°C, links)</span>`).join('')}${vb ? `<span><i style="background:var(--s${reihen.length + 1})"></i>Verbrauch (kWh je Stunde, rechts)</span>` : ''}</div>`;
}
/* Mehrere Temperaturlinien über Stunden oder Tage: alle Container und außen in einem Diagramm (0.7.8) */
function linien(id, reihen, labels, jedes, titel) {
  const W = 320, H = 170, L = 28, R = 8, T = 16, U = 22, n = labels.length;
  const alle = reihen.flatMap(s => s.v.filter(zahl));
  if (!alle.length) return '<div class="leer">Noch keine Werte</div>';
  const lo = Math.floor(Math.min(...alle) / 5) * 5, hi = Math.max(lo + 5, Math.ceil(Math.max(...alle) / 5) * 5);
  const x = i => L + i / Math.max(1, n - 1) * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - U);
  const raster = [...Array((hi - lo) / 5 + 1)].map((_, k) => lo + k * 5).map(v =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${v}°</text>`).join('');
  const achse = labels.map((t, i) => i % jedes ? '' : `<text x="${x(i)}" y="${H - 6}" class="ax" text-anchor="middle">${t}</text>`).join('');
  const pfade = reihen.map(s => `<path d="${s.v.map((v, i) => !zahl(v) ? '' : `${i && zahl(s.v[i - 1]) ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')}" fill="none" stroke="${s.farbe}" stroke-width="${s.aussen ? 1.5 : 2}" ${s.aussen ? 'stroke-dasharray="4 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  CHARTS[id] = { art: 'linien', x0: L, x1: W - R, W, n, reihen, y, unten: H - U, titel };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}">${raster}${achse}${pfade}<text x="${L - 5}" y="${T - 7}" class="ax ax-e" text-anchor="end">°C</text><g class="hover"></g></svg>
    <div class="legende">${reihen.map(s => `<span><i style="background:${s.farbe}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}
function balken(id, werte, labels, einheit, d = 1) {
  werte = werte.map(v => zahl(v) ? Number(v) : 0);
  const W = 320, H = 150, L = 28, R = 8, T = 10, U = 22, n = werte.length, hi = Math.max(...werte, 0) * 1.15 || 1;
  const bw = (W - L - R) / n, y = v => T + (1 - v / hi) * (H - T - U), stufe = hi > 20 ? 10 : hi > 6 ? 2 : hi > 2 ? 1 : .5;
  const raster = [...Array(Math.floor(hi / stufe) + 1)].map((_, k) => k * stufe).map(v =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${de(v, stufe < 1 ? 1 : 0)}</text>`).join('');
  const b = werte.map((v, i) => { const h = H - U - y(v), bx = L + i * bw + 1, w = bw - 2;
    return `${v > 0 ? `<path d="M${bx} ${H - U}V${y(v) + Math.min(4, h)}q0 -4 4 -4h${w - 8}q4 0 4 4V${H - U}z" fill="var(--s1)" class="bar" data-i="${i}"/>` : ''}
      <text x="${bx + w / 2}" y="${H - 6}" class="ax" text-anchor="middle">${labels[i]}</text>`; }).join('');
  CHARTS[id] = { art: 'balken', werte, labels, einheit, d };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}">${raster}${b}<rect class="treffer" x="0" y="0" width="0" height="0"/></svg>`;
}
function streu(id, pkt, k, d0) {
  const W = 320, H = 170, L = 30, R = 8, T = 10, U = 24;
  const tx = [-10, -5, 0, 5, 10, 15], ymax = Math.max(50, Math.ceil(Math.max(...pkt.map(q => q[1])) / 50) * 50);
  const x = t => L + (Math.max(-10, Math.min(15, t)) + 10) / 25 * (W - L - R), y = v => T + (1 - v / ymax) * (H - T - U);
  const raster = [...Array(ymax / 50 + 1)].map((_, q) => q * 50).map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${v}</text>`).join('');
  const achse = tx.map(t => `<text x="${x(t)}" y="${H - 8}" class="ax" text-anchor="middle">${t}°</text>`).join('');
  const t1 = -8, t2 = k < 0 ? Math.min(15, -d0 / k) : 15;
  const trend = `<line x1="${x(t1)}" y1="${y(Math.max(0, Math.min(ymax, k * t1 + d0)))}" x2="${x(t2)}" y2="${y(Math.max(0, Math.min(ymax, k * t2 + d0)))}" stroke="var(--s2)" stroke-width="2" stroke-dasharray="5 4"/>`;
  const punkte = pkt.map((q, i) => `<circle class="punkt-s" data-i="${i}" cx="${x(q[0]).toFixed(1)}" cy="${y(q[1]).toFixed(1)}" r="4.5" fill="var(--s1)"/>`).join('');
  CHARTS[id] = { art: 'streu', pkt, x, y };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}">${raster}${achse}<text x="${W - R}" y="${H - 8}" class="ax" text-anchor="end" dx="0" opacity="0">.</text>${trend}${punkte}<g class="hover"></g></svg>
    <div class="legende"><span><i style="background:var(--s1)"></i>ein Heiztag</span><span><i style="background:var(--s2)"></i>Trend</span><span class="leise">x: Tagesmittel außen · y: kWh</span></div>`;
}
function flaeche(id, reihen, labels, einheit, jedes) {
  const W = 320, H = 160, L = 30, R = 8, T = 10, U = 22, n = labels.length, viele = reihen.length > 1;
  reihen = reihen.map(r => ({ ...r, v: labels.map((_, i) => zahl(r.v[i]) ? Number(r.v[i]) : 0) }));
  // gestapelt: jede Reihe liegt auf der Summe der darunterliegenden, die oberste Kante ist die Summe der Auswahl
  let unten = Array(n).fill(0);
  const lagen = reihen.map(r => { const u = unten, o = r.v.map((v, i) => u[i] + v); unten = o; return { ...r, u, o }; });
  const hi0 = Math.max(...unten, 0) * 1.1 || 1;
  const stufe = [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(st => hi0 / st <= 5) || 10000, hi = Math.ceil(hi0 / stufe) * stufe;
  const x = i => L + i / Math.max(1, n - 1) * (W - L - R), y = v => T + (1 - v / hi) * (H - T - U);
  const raster = [...Array(Math.round(hi / stufe) + 1)].map((_, k) => k * stufe).map(v =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${de(v, stufe < 1 ? 1 : 0)}</text>`).join('');
  const achse = labels.map((t, i) => i % jedes ? '' : `<text x="${x(i)}" y="${H - 6}" class="ax" text-anchor="middle">${t}</text>`).join('');
  const g = k => `fl-${id.replace(/[^a-z0-9]/gi, '')}-${k}`;
  const defs = lagen.map((r, k) => `<linearGradient id="${g(k)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r.farbe}" stop-opacity="${viele ? .75 : .45}"/><stop offset="1" stop-color="${r.farbe}" stop-opacity="${viele ? .45 : .03}"/></linearGradient>`).join('');
  const linieD = a => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const zurueck = a => a.map((v, i) => [i, v]).reverse().map(([i, v]) => `L${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const flaechen = lagen.map((r, k) => `<path class="fl-flaeche" style="animation-delay:${k * 40}ms" d="${linieD(r.o)}${zurueck(r.u)}z" fill="url(#${g(k)})"/>`).join('');
  const kanten = lagen.map(r => `<path class="fl-linie" d="${linieD(r.o)}" fill="none" stroke="${viele ? 'var(--trenn)' : r.farbe}" stroke-width="${viele ? 1.5 : 2}" stroke-linejoin="round"/>`).join('');
  const oben = viele ? `<path d="${linieD(unten)}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round" opacity=".8"/>` : '';
  CHARTS[id] = { art: 'flaeche', x0: L, x1: W - R, W, n, reihen: lagen, labels, einheit, y };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${raster}${achse}${flaechen}${kanten}${oben}<g class="hover"></g></svg>
    ${viele ? `<div class="legende">${[...lagen].reverse().map(r => `<span><i style="background:${r.farbe}"></i>${esc(r.name)}</span>`).join('')}</div>` : ''}`;
}

/* ---------- Stimmung: Hintergrund nach Tageszeit (sun.sun) und Wetter (weather.*) ---------- */
const zufall = seed => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
function partikel(phase, wetter) {
  const r = zufall(42), z = (a, b) => (a + r() * (b - a)).toFixed(2);
  const tropfen = n => [...Array(n)].map(() => `<i class="tropfen" style="left:${z(-10, 130)}%;--l:${z(12, 26)}px;--d:${z(.55, 1)}s;--v:-${z(0, 2)}s;opacity:${z(.35, .9)}"></i>`).join('');
  const teile = [];
  if (wetter === 'regen') teile.push(tropfen(70));
  if (wetter === 'gewitter') teile.push(tropfen(120), '<i class="blitzlicht"></i>');
  if (wetter === 'schnee') teile.push([...Array(60)].map(() => `<i class="flocke" style="left:${z(-5, 105)}%;--d:${z(7, 14)}s;--v:-${z(0, 14)}s"><b style="--s:${z(2, 5)}px;--w:${z(2, 4)}s"></b></i>`).join(''));
  if (wetter === 'nebel') teile.push([...Array(4)].map((_, k) => `<i class="schwade" style="top:${10 + k * 22}%;--d:${24 + k * 7}s;--v:-${k * 6}s"></i>`).join(''));
  if (wetter === 'wolkig' || wetter === 'regen' || wetter === 'gewitter') teile.push([...Array(3)].map((_, k) => `<i class="wolke" style="top:${z(-5, 45)}%;--d:${z(50, 80)}s;--v:-${z(0, 60)}s"></i>`).join(''));
  if (wetter === 'klar' && phase === 'nacht') teile.push([...Array(45)].map(() => `<i class="stern" style="left:${z(0, 100)}%;top:${z(0, 60)}%;--v:-${z(0, 4)}s;--s:${z(1, 2.4)}px"></i>`).join(''));
  if (wetter === 'klar' && phase !== 'nacht') teile.push('<i class="strahlen"></i>');
  return teile.join('');
}
/* Tageszeit aus sun.sun: Nacht unter −6°, Morgen/Abend bis 12° über dem Horizont */
function phaseAusSonne(sonne) {
  if (!sonne) return 'tag';
  const a = sonne.attributes || {}, hoehe = Number(a.elevation), steigt = a.rising;
  if (!zahl(hoehe)) return sonne.state === 'below_horizon' ? 'nacht' : 'tag';
  if (hoehe < -6) return 'nacht';
  if (hoehe < 12) return steigt === false ? 'abend' : 'morgen';
  return 'tag';
}

/* Einblendungen: Unterdialoge aus „Baustelle bearbeiten“ kehren beim Schließen dorthin zurück (AN-0002);
   s.leeren() schließt alles (Seitenwechsel, Abschließen) */
function einblendungen(s) {
  let jetzt = s.sheet || null, eltern = null;
  Object.defineProperty(s, 'sheet', { enumerable: true, get: () => jetzt, set: v => {
    if (v && v.art === 'bs-bearbeiten') eltern = null;
    else if (v && jetzt && jetzt.art === 'bs-bearbeiten' && v !== jetzt) eltern = jetzt;
    else if (!v && eltern && jetzt !== eltern) { v = eltern; eltern = null; }
    else if (!v) eltern = null;
    jetzt = v || null; } });
  s.leeren = () => { eltern = null; jetzt = null; };
  return s;
}

/* ---------- Seite ---------- */
const STATISCH = '/baustelle_static';
const SEITE_VERSION = '0.7.29';   // Version dieser Datei – setzt tools/changelog.py (neueste Version in CHANGELOG.md)
/* Versionen vergleichen: 0.7.10 > 0.7.9 */
const verNeuer = (a, b) => { const x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (Number.isNaN(d)) return false; if (d) return d > 0; } return false; };
const LOKAL_FMT = {};
class BaustellePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.s = einblendungen({ view: 'uebersicht', cid: null, sheet: null, chart: 'temp', verlauf: 'aktiv' });
    this.cache = {}; this.roh = null; this.alle = []; this.d = null; this.bid = null; this.fehler = null;
    this.vorhersage = { daily: null, hourly: null }; this.abos = []; this.changelog = null;
    this.st = { phase: 'tag', wetter: 'wolkig', hell: false };
    try { const u = JSON.parse(localStorage.getItem('baustelle-panel') || '{}'); this.bid = u.bid || null; } catch (e) { /* ohne Speicher */ }
  }

  /* ---- Lebenszyklus (panel_custom: hass, narrow, panel) ---- */
  set hass(h) {
    const erst = !this._hass;
    this._hass = h;
    this._aufbauen();
    if (erst) this._starten(); else this._beobachten(h);
    this._stimmung();
  }
  get hass() { return this._hass; }
  set narrow(n) { const alt = this._narrow; this._narrow = !!n; if (alt !== undefined && alt !== this._narrow) this.render(); }
  get narrow() { return this._narrow; }
  set panel(p) { this._panel = p; }
  get panel() { return this._panel; }
  connectedCallback() { this._aufbauen(); if (this._hass && !this._timer) this._starten(); if (!this.himmel && this.bg) this.himmel = Himmel.an(this.bg); this._stimmung(true); }
  disconnectedCallback() {
    clearInterval(this._timer); this._timer = null; clearTimeout(this._nachladen);
    this._aboEnde(); if (this.himmel) { this.himmel.stop(); this.himmel = null; }
  }
  _starten() {
    this._laden();
    clearInterval(this._timer); this._timer = setInterval(() => this._laden(), 60000);
    if (typeof fetch === 'function') fetch(`${STATISCH}/changelog.json?v=${encodeURIComponent(this.version)}`).then(r => r.ok ? r.json() : null)
      .then(c => { this.changelog = Array.isArray(c) ? c : []; if (this.s.view === 'ueber') this.render(); }).catch(() => { this.changelog = []; });
  }
  get version() { return (this.d && this.d.version) || (this._panel && this._panel.config && this._panel.config.version) || '–'; }

  _aufbauen() {
    if (this.root) return;
    const sr = this.shadowRoot;
    sr.innerHTML = `<style>${CSS}\n${GLAS_CSS}</style><div class="wurzel"><div class="app"><div class="glas-bg"><i class="k1"></i><i class="k2"></i><i class="k3"></i><div class="dunst"></div><div class="partikel"></div></div><div class="ui"></div></div></div>`;
    this.wurzel = sr.querySelector('.wurzel'); this.root = sr.querySelector('.app');
    this.bg = sr.querySelector('.glas-bg'); this.ui = sr.querySelector('.ui');
    sr.addEventListener('click', e => this.klick(e));
    sr.addEventListener('input', e => this.eingabe(e));
    sr.addEventListener('change', e => this.aenderung(e));
    sr.addEventListener('pointermove', e => this.hover(e));
    sr.addEventListener('pointerleave', () => this.tip(null));
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('location-changed', () => { this._adresseFertig = null; setTimeout(() => this._adresse(), 0); });
    sr.addEventListener('focusout', () => { if (this._wartet) { this._wartet = false; setTimeout(() => this._auffrischen(), 0); } });
    this.himmel = Himmel.an(this.bg);          // WebGL-Himmel; ohne WebGL bleibt der CSS-Hintergrund
    this.render();
  }

  /* Eigene Entitäten geändert → Struktur kurz danach neu holen (Zustände kommen aus der Integration) */
  _beobachten(h) {
    const ids = this._eigene || [];
    let neu = !this._alt;
    if (this._alt) for (const id of ids) if (h.states[id] !== this._alt[id]) { neu = true; break; }
    this._alt = Object.fromEntries(ids.map(id => [id, h.states[id]]));
    if (neu && this._alt && ids.length && !this._nachladen) this._nachladen = setTimeout(() => { this._nachladen = null; this._laden(); }, 3000);
  }

  async _laden() {
    if (!this._hass) return;
    try {
      const r = await this._hass.callWS({ type: 'baustelle/struktur' });
      // unverändert (bis auf die Uhrzeit) → nicht neu zeichnen; spätestens alle 5 min wegen der Jetzt-Marke
      const text = JSON.stringify(r, (k, v) => k === 'jetzt' ? undefined : v);
      if (text === this._rohText && !this.fehler && Date.now() - this._geholt < 300000) return;
      this._rohText = text; this._geholt = Date.now(); this.roh = Array.isArray(r) ? r : []; this.fehler = null;
      this._neuBauen();
      delete this.cache['p:' + (this.d && this.d.entry)];
    } catch (e) { this.fehler = (e && (e.message || e.code)) || String(e); if (!this.roh) this.roh = null; }
    this._vorhersageAbo(); this._stimmung(); this._adresse(); this._auffrischen(); this._versionPruefen();
  }
  /* Neuere Version als diese Seite? HA nach dem Neustart (struktur) oder eingespielt ohne Neustart (changelog.json auf der Platte) */
  _versionPruefen() {
    const vorher = this.neueVersion;
    for (const r of this.roh || []) if (verNeuer(r.version, this.neueVersion || SEITE_VERSION)) this.neueVersion = r.version;
    if (typeof fetch === 'function' && !(Date.now() - (this._platteGeprueft || 0) < 600000)) {
      this._platteGeprueft = Date.now();
      fetch(`${STATISCH}/changelog.json?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(c => {
        const v = Array.isArray(c) && c[0] && c[0].version;
        if (verNeuer(v, this.neueVersion || SEITE_VERSION)) { this.neueVersion = v; this.render(); }
      }).catch(() => {});
    }
    if (this.neueVersion !== vorher) this.render();
  }
  versionHinweis() {
    if (!this.neueVersion) return '';
    return `<div class="glas-panel neu-version"><span>Neue Version ${esc(this.neueVersion)} – bitte neu laden <span class="leise">(geladen ist ${SEITE_VERSION})</span></span><button class="chip" data-act="neu-laden">Neu laden</button></div>`;
  }
  async neuLaden() {
    this.toast('Lädt neu …');
    // Browser-Speicher auffrischen, sonst kommt nach dem Neuladen wieder die alte Datei
    const urls = [...new Set([this._panel && this._panel.config && this._panel.config.version, this.neueVersion, SEITE_VERSION].filter(Boolean))].map(v => `${STATISCH}/baustelle-panel.js?v=${encodeURIComponent(v)}`);
    await Promise.all([...urls, `${STATISCH}/baustelle-panel.js`].map(u => fetch(u, { cache: 'reload' }).catch(() => null)));
    location.reload();
  }
  _neuBauen() {
    this.alle = (this.roh || []).map(r => this.bauen(r));
    const aktiv = this.alle.filter(x => x.aktiv);
    this.d = aktiv.find(x => x.entry === this.bid) || aktiv[0] || null;
    if (this.d && this.d.entry !== this.bid) { this.bid = this.d.entry; this._merken(); }
    this._eigene = (this.roh || []).flatMap(r => Object.values(r.entitaeten || {}));
  }
  /* Adresse aus einer Handy-Nachricht (api §4): ?baustelle=<entry_id>&container=<bid>&ansicht=auswertung */
  _adresse() {
    const such = typeof location !== 'undefined' ? location.search : '';
    if (!such || such === this._adresseFertig || !this.roh) return;
    this._adresseFertig = such;
    const q = new URLSearchParams(such), bid = q.get('baustelle'), cid = q.get('container'), ansicht = q.get('ansicht');
    const x = bid && this.alle.find(y => y.entry === bid);
    if (x && x.aktiv) { this.bid = x.entry; this._merken(); this._neuBauen(); this._vorhersageAbo(); this._stimmung(true); }
    else if (x) { this.s.bs = x.entry; return this.gehe('bsdetail'); }
    if (cid && this.d && this.d.bereiche.some(b => b.id === cid)) return this.gehe('container', cid);
    if (ansicht && typeof this['v_' + ansicht] === 'function' && ansicht !== 'leer') return this.gehe(ansicht);
    if (x) this.gehe('uebersicht');
  }
  _merken() { try { localStorage.setItem('baustelle-panel', JSON.stringify({ bid: this.bid })); } catch (e) { /* egal */ } }
  get z() { return this.d.z; }

  /* Hintergrund aus der Baustelle: Tageszeit (sun.sun), Wetter (Wetter-Entität), hell/dunkel (Theme) */
  _stimmung(erzwingen = false) {
    if (!this.bg || !this._hass) return;
    const h = this._hass, eid = this.d && this.d.wetterEid, w = eid && h.states[eid];
    const sonne = h.states['sun.sun'], phase = phaseAusSonne(sonne), wetter = WETTER_STIMMUNG[w && w.state] || 'wolkig', hell = !(h.themes && h.themes.darkMode);
    /* Sonne/Mond wandern und Farben gleiten stufenlos (WU-0001): bei jedem Update nachführen, nicht nur beim Wechsel der Tageszeit */
    const lauf = this.lauf = himmelLauf(sonne);
    if (this.himmel) this.himmel.setze(phase, wetter, hell, sonne, lauf);
    this.bg.style.setProperty('--sonne-x', (lauf.uSonnePos[0] * 100).toFixed(1) + '%'); this.bg.style.setProperty('--sonne-y', (lauf.uSonnePos[1] * 100).toFixed(1) + '%');   // CSS-Rückfall
    const alt = this.st, neu = { phase, wetter, hell };
    if (!erzwingen && alt.phase === phase && alt.wetter === wetter && alt.hell === hell && this.bg.dataset.phase) return;
    if (this.bg.dataset.phase !== phase || this.bg.dataset.wetter !== wetter) { const p = this.bg.querySelector('.partikel'); if (p) p.innerHTML = partikel(phase, wetter); }
    this.bg.dataset.phase = phase; this.bg.dataset.wetter = wetter;
    if (this.wurzel) this.wurzel.classList.toggle('hell', hell);
    const kopfNeu = alt.wetter !== wetter || alt.phase !== phase;
    this.st = neu;
    if (kopfNeu && this.d) this._auffrischen();
  }

  _vorhersageAbo() {
    const eid = this.d && this.d.wetterEid, con = this._hass && this._hass.connection;
    if (!eid || !con || !con.subscribeMessage || this._aboFuer === eid) return;
    this._aboEnde(); this._aboFuer = eid; this.vorhersage = { daily: null, hourly: null };
    for (const art of ['daily', 'hourly']) {
      const abo = con.subscribeMessage(m => { this.vorhersage[art] = (m && m.forecast) || []; this._auffrischen(); },
        { type: 'weather/subscribe_forecast', entity_id: eid, forecast_type: art });
      if (abo && abo.catch) abo.catch(() => { this.vorhersage[art] = []; });
      this.abos.push(abo);
    }
  }
  _aboEnde() { for (const a of this.abos) if (a && a.then) a.then(ende => typeof ende === 'function' && ende()).catch(() => {}); this.abos = []; this._aboFuer = null; }

  /* Zeit in der Zone der Baustelle: 'YYYY-MM-DD HH:MM' */
  lokal(t, zone = this.d && this.d.z.zone) {
    const ms = typeof t === 'number' ? t : Date.parse(t);
    if (!Number.isFinite(ms)) return '';
    const k = zone || '';
    if (!(k in LOKAL_FMT)) {
      try { LOKAL_FMT[k] = new Intl.DateTimeFormat('sv-SE', { timeZone: zone || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
      catch (e) { LOKAL_FMT[k] = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
    }
    return LOKAL_FMT[k].format(ms).replace('T', ' ');
  }
  /* Mitternacht (oder Uhrzeit) eines Tages in der Zone der Baustelle als Zeitpunkt */
  zoneMs(tag, zeit = '00:00', zone) {
    const g = Date.parse(`${tag}T${zeit}:00Z`), l = Date.parse(this.lokal(g, zone).replace(' ', 'T') + ':00Z');
    return Number.isFinite(l) ? g - (l - g) : g;
  }
  isoUhr(iso) { return iso ? this.lokal(iso).slice(11, 16) : null; }
  seitText(iso) { if (!iso) return ''; const l = this.lokal(iso); return l.slice(0, 10) === this.z.HEUTE ? `seit ${l.slice(11, 16)}` : `seit ${wtag(l)} ${kurzDatum(l)}`; }
  tagText(l) { const t = l.slice(0, 10); return t === this.z.HEUTE ? 'Heute' : t === plusTage(this.z.HEUTE, -1) ? 'Gestern' : `${wtag(t)} ${kurzDatum(t)}`; }
  minSeit(iso) { const ms = Date.parse(iso); return Number.isFinite(ms) ? Math.max(0, Math.round((this.jetztMs() - ms) / 60000)) : null; }
  jetztMs() { return this.d ? this.d.z.jetztMs : Date.now(); }

  /* ---- Adapter: baustelle/struktur (docs/api-0.7.md §1) → Modell der Seite (Form wie im Mockup) ---- */
  bauen(r) {
    const bs = r.baustelle || {}, lz = r.laufzeit || {}, e0 = r.einstellungen || {}, opt = bs.optionen || {}, zone = bs.zeitzone;
    const jetztIso = bs.jetzt || new Date().toISOString(), jl = this.lokal(jetztIso, zone) || '';
    const heute = bs.heute || jl.slice(0, 10) || new Date().toISOString().slice(0, 10);
    const montag = plusTage(heute, -((new Date(heute + 'T12:00:00Z').getUTCDay() + 6) % 7));
    const WOCHE_ISO = TAGE.map((_, k) => plusTage(montag, k));
    const z = { HEUTE: heute, HEUTE_TAG: TAGE[WOCHE_ISO.indexOf(heute)] || 'Mo', JETZT: jl.slice(11, 16) || '00:00', WOCHE_ISO,
      WOCHE: WOCHE_ISO.map((iso, k) => [TAGE[k], kurzDatum(iso)]), zone, jetztMs: Number.isFinite(Date.parse(jetztIso)) ? Date.parse(jetztIso) : Date.now() };
    const h = e0.heizung || {}, st = e0.staffel || {}, me = e0.meldungen_einst || {}, ar = me.arten || {}, be = e0.bericht || {};
    const v = (x, std) => zahl(x) ? Number(x) : std;
    const namen = s => { const x = this._hass && this._hass.states[`notify.${s}`]; return (x && x.attributes.friendly_name) || String(s).replace(/^mobile_app_/, '').replace(/_/g, ' '); };
    const e = { preis: v(e0.preis, 0), feiertag_frei: h.feiertag_frei !== false, boost_min: v(h.boost_min, 30), melden: e0.melden_knopf !== false,
      staffel: st.an !== false, nutzbar: v(st.nutzbar_prozent, 67), max_gleich: v(st.max_gleichzeitig, 5), min_lauf: v(st.min_lauf_min, 10), min_pause: v(st.min_pause_min, 5), takt: v(st.takt_min, 15),
      tuer_pause: v(h.tuer_pause_min, 3), tuer_melden: v(h.tuer_melden_min, 10), knoepfe: me.knoepfe !== false,
      bericht: be.haeufigkeit || 'aus', bericht_handy: be.handy !== false, bericht_mail: !!be.mail, mail: be.mail_an || '', mail_dienst: be.mail_dienst || '', bericht_csv: be.csv !== false,
      vorheizen: v(h.vorheizen_min, 45), nachheizen: v(h.nachheizen_min, 15), soll: v(h.soll, 20), grenze: v(h.heizgrenze, 15), basis: h.heizgrenze_basis === 'jetzt' ? 'jetzt' : 'Tageshöchstwert',
      fruehstart: h.fruehstart !== false, frueh_temp: v(h.fruehstart_unter, 0), frueh_min: v(h.fruehstart_min, 30), frost: h.frost !== false, frost_temp: v(h.frost_grenze, 5),
      tr_mm: v(h.trocknen_ab_mm, 2), tr_laenger: v(h.trocknen_laenger_min, 45), tr_frueher: v(h.trocknen_frueher_min, 15),
      empfaenger: (me.empfaenger || opt.empfaenger || []).map(namen).join(', ') || 'keiner gewählt',
      dauer_min: v(me.dauerlauf_min, 20), kalt_min: v(me.kalt_min, 60), hand_h: v(me.hand_h, 8), zyklen_h: v(me.zyklen_h, 10), trocken_w: v(me.trocken_unter_w, 30),
      auto: !!e0.automatik,
      frost_aus: v(h.frost_aus, v(h.frost_grenze, 5) + 2), urlaub: FREI_TEXT[h.frei_modus] ? h.frei_modus : 'frost', absenk: v(h.absenk, 10),
      offline_min: v(me.offline_min, 5), erklaer: e0.erklaer !== false, frost_immer: !!h.frost_immer };
    for (const [k, art] of Object.entries(ARTEN)) e[k] = ar[art] !== false;
    const anschluesse = (e0.anschluesse || []).map(a => ({ id: a.id, name: a.name || a.id, ampere: v(a.ampere, 16), phasen: v(a.phasen, 3), reserve: v(a.reserve_kw, 0) }));
    const firmen = (e0.firmen && e0.firmen.length ? e0.firmen : [{ id: 'eigen', name: 'Eigene Firma', eigen: true }]).map(f => ({ ...f }));
    const zuordnung = e0.zuordnung || [], jetztMs = z.jetztMs;   // Firma je Container jetzt: Integration (laufzeit.container[bid].firma)
    const ebAlle = e0.bereiche || {}, cAlle = lz.container || {}, gAlle = lz.geraete || {};
    const bereiche = (r.bereiche || []).map((b, i) => {
      const eb = ebAlle[b.id] || {}, c = cAlle[b.id] || {}, pumpe = b.art === 'pumpenschacht';
      const geraete = (r.geraete || []).filter(g => g.bereich === b.id).map(g => { const x = gAlle[g.id] || {};
        return { id: g.id, n: g.name || g.id, typ: TYP_TEXT(g), rolle: g.rolle, gtyp: g.typ, heizer: HEIZER(g), kw: v(g.nenn_kw, 0), kwJetzt: x.kw, an: !!x.an,
          hand: !!x.hand_seit, hand_seit: x.hand_seit || null, warte: x.warte || null, erreichbar: x.erreichbar !== false, schalter: g.schalter, leistung: g.leistung, energie: g.energie }; });
      let zst = c.zustand in FARBE ? c.zustand : (pumpe ? 'aus' : 'aus');
      const offline = zst === 'offline' || (geraete.length > 0 && geraete.every(g => !g.erreichbar));
      if (offline) zst = 'offline';
      const tuerS = eb.tuer && this._hass && this._hass.states[eb.tuer];
      const tuer = eb.tuer ? { eid: eb.tuer, sensor: (tuerS && tuerS.attributes.friendly_name) || eb.tuer, offen: c.tuer && c.tuer.offen ? Math.max(1, this.minSeitAb(c.tuer.seit, jetztMs) ?? 1) : 0 } : undefined;
      return { id: b.id, name: b.name || b.id, f: zahl(b.nr) ? Number(b.nr) : i, art: b.art, pumpe, fuehler: b.fuehler || null, z: zst, grund: c.grund || null,
        t: zahl(c.temperatur) ? Number(c.temperatur) : null, kw: zahl(c.kw) ? Number(c.kw) : null, text: c.text || '', geraete,
        auto: eb.auto !== false, trocknen: !!eb.trocknen, soll: zahl(eb.soll) ? Number(eb.soll) : undefined, bedarf: !!eb.bedarf, prio: eb.prio || 'normal',
        anschluss: eb.anschluss || (anschluesse[0] && anschluesse[0].id) || null, firma: c.firma || 'eigen', tuer, offline,
        bedarfBisIso: c.bedarf_bis || null, bedarfBis: c.bedarf_bis ? this.lokal(c.bedarf_bis, zone).slice(11, 16) : null,
        boost: !!c.boost_bis, boostBis: c.boost_bis || null,
        modus: pumpe ? null : MODI.some(m => m[0] === c.modus) ? c.modus : eb.bedarf ? 'bedarf' : eb.auto === false ? 'hand' : b.fuehler ? 'thermo' : 'plan' };
    });
    const plan = {}, frei = {};
    const freiName = {};
    for (const p of lz.plan_woche || []) { plan[p.datum] = p.plan || null; frei[p.datum] = p.frei || null; if (p.name) freiName[p.datum] = p.name; }
    const warnungen = (lz.warnungen || []).map(w => ({ id: w.key, key: w.key, art: w.art, stufe: w.stufe === 'stoerung' ? 'stoerung' : 'hinweis', b: w.bereich || null, g: w.geraet || null,
      titel: w.titel || w.art || '', hilfe: w.hilfe || '', seitIso: w.seit, stumm: !!(w.stumm_bis && Date.parse(w.stumm_bis) > jetztMs) }));
    const termine = (lz.termine || []).map(t => { const l = this.lokal(t.von, zone), lb = this.lokal(t.bis, zone);
      return { b: t.bereich, datum: l.slice(0, 10), von: l.slice(11, 16), bis: lb.slice(11, 16), titel: t.titel || '', uid: t.uid, rrule: t.rrule || null,
        wieder: WIEDER[t.wiederholung] ? t.wiederholung : 'einmal', boost: !!t.boost }; });
    const tage = e0.arbeitszeiten || [];
    const arbeitszeiten = tage.map(a => ({ ab: a.ab, name: a.name || '', auto: a.auto === true, tage: Object.fromEntries(TAGE.map((t, k) => { const x = (a.tage || {})[k] ?? (a.tage || {})[String(k)]; return [t, x && x[0] && x[1] ? [x[0], x[1]] : null]; })) }));
    const aktiv = (bs.status || opt.status || 'aktiv') !== 'abgeschlossen';
    const zl = r.zaehler || {};
    const wetterEid = opt.wetter || null;
    return { r, entry: bs.entry_id, titel: bs.titel || 'Baustelle', aktiv, geladen: bs.geladen !== false, version: bs.version, optionen: opt, ent: r.entitaeten || {}, z, e,
      funktionen: r.funktionen || ['heizung', 'pumpen'],
      bereiche, anschluesse, firmen, zuordnung, arbeitszeiten, ausnahmen: (e0.ausnahmen || []).map(a => ({ datum: a.datum, art: a.art in AUSNAHME ? a.art : 'zeiten', von: a.von || '07:00', bis: a.bis || '16:30', notiz: a.notiz || '' })),
      warnungen, termine, plan, frei, freiName, abschnitte: lz.abschnitte || {}, staffel: lz.staffel || null, wetter: lz.wetter || {}, heizgrenze: lz.heizgrenze || {},
      status: lz.status || (aktiv ? 'bereit' : 'abgeschlossen'), statusText: lz.status_text || '', jetztBis: lz.jetzt_bis ? this.lokal(lz.jetzt_bis, zone).slice(11, 16) : null,
      protokoll: (lz.protokoll || []).map(p => this.protokollZeile(p, z)), zaehler: zl, termineKal: e0.termine_kalender || null, wetterEid,
      beginn: bs.beginn || opt.beginn || null, beginnAuto: bs.beginn_auto === true, ende: opt.ende || null,   // Beginn leer = Tag der Anlage (AN-0002)
      hp: [Math.min(12, Math.max(1, parseInt(opt.heizperiode_von, 10) || 10)), Math.min(12, Math.max(1, parseInt(opt.heizperiode_bis, 10) || 4))] };
  }
  /* Beginn und Ende einer Baustelle als Text; „(angelegt)“ = Beginn automatisch (AN-0002) */
  bsZeit(x) { return `${x.beginn ? datum(x.beginn) : '–'}${x.beginnAuto ? ' (angelegt)' : ''} – ${x.ende ? datum(x.ende) : 'offen'}`; }
  minSeitAb(iso, jetztMs) { const ms = Date.parse(iso); return Number.isFinite(ms) ? Math.max(0, Math.round((jetztMs - ms) / 60000)) : null; }
  protokollZeile(p, z) {
    const l = this.lokal(p[0], z.zone) || '', t = l.slice(0, 10);
    const tag = t === z.HEUTE ? 'Heute' : t === plusTage(z.HEUTE, -1) ? 'Gestern' : `${wtag(t)} ${kurzDatum(t)}`;
    return [tag, l.slice(11, 16), p[1] || 'einstellung', p[2] || null, p[3] || ''];
  }
  eid(d, besitzer, key) { return d.ent[`${besitzer}_${key}`] || null; }
  zustand(eid) { const s = eid && this._hass && this._hass.states[eid]; return s && !['unknown', 'unavailable'].includes(s.state) ? s : null; }
  name(eid) { const s = eid && this._hass && this._hass.states[eid]; return (s && s.attributes.friendly_name) || eid || ''; }

  /* ---- Nachladen mit Zwischenspeicher: gibt undefined zurück, solange es lädt ---- */
  _holen(key, holer, maxAlter = 300000) {
    const c = this.cache[key], jetzt = Date.now();
    if (!c || (!c.laeuft && jetzt - c.zeit > maxAlter)) {
      this.cache[key] = { ...(c || {}), laeuft: true, zeit: jetzt };
      Promise.resolve().then(holer).then(daten => { this.cache[key] = { daten, zeit: Date.now(), laeuft: false }; this._auffrischen(); })
        .catch(err => { this.cache[key] = { daten: null, fehler: String((err && err.message) || err), zeit: Date.now(), laeuft: false }; this._auffrischen(); });
    }
    return c && 'daten' in c ? c.daten : undefined;
  }
  /* Neu zeichnen ohne Eingaben zu stören */
  _auffrischen() {
    if (this._auffrischenGeplant) return;
    this._auffrischenGeplant = true;
    Promise.resolve().then(() => {
      this._auffrischenGeplant = false;
      const f = this.shadowRoot && this.shadowRoot.activeElement;
      if (f && ['INPUT', 'TEXTAREA', 'SELECT'].includes(f.tagName)) { this._wartet = true; return; }
      this.render();
    });
  }

  /* Zeiträume der Auswertung: Tag (je Stunde), Woche/Monat (je Tag), Jahr (je Monat); versatz 1 = davor */
  zeitraum(z, versatz = 0, d = this.d) {
    const h = d.z.HEUTE, J = +h.slice(0, 4), M = +h.slice(5, 7);
    if (z === 'Tag') { const tag = plusTage(h, -versatz);
      return { von: tag, bis: plusTage(tag, 1), periode: 'hour', n: 24, labels: [...Array(24)].map((_, i) => String(i).padStart(2, '0')), index: l => l.slice(0, 10) === tag ? +l.slice(11, 13) : -1 }; }
    if (z === 'Woche') { const mo = plusTage(d.z.WOCHE_ISO[0], -7 * versatz);
      return { von: mo, bis: plusTage(mo, 7), periode: 'day', n: 7, labels: TAGE, index: l => tageZwischen(mo, l.slice(0, 10)) }; }
    if (z === 'Monat') { let m = M - 1 - versatz, j = J; while (m < 0) { m += 12; j--; }
      const von = `${j}-${String(m + 1).padStart(2, '0')}-01`, n = new Date(Date.UTC(j, m + 1, 0)).getUTCDate();
      return { von, bis: plusTage(von, n), periode: 'day', n, labels: [...Array(n)].map((_, i) => `${i + 1}.`), index: l => l.slice(0, 7) === von.slice(0, 7) ? +l.slice(8, 10) - 1 : -1, monat: m, jahr: j }; }
    const j = J - versatz;
    return { von: `${j}-01-01`, bis: `${j + 1}-01-01`, periode: 'month', n: 12, labels: MONATE, index: l => +l.slice(0, 4) === j ? +l.slice(5, 7) - 1 : -1, jahr: j };
  }
  statIds(d, mitTemp) {
    const ids = [];
    for (const b of d.bereiche) {
      const en = this.eid(d, b.id, 'energie'); if (en) ids.push(en); else ids.push(...b.geraete.map(g => g.energie).filter(Boolean));
      ids.push(this.eid(d, b.id, 'heizzeit'));
      for (const g of b.geraete) if (g.rolle === 'pumpe') ids.push(this.eid(d, g.id, 'pumpzeit'), this.eid(d, g.id, 'pumpzyklen'));
      if (mitTemp && b.fuehler) ids.push(b.fuehler);
    }
    ids.push(this.eid(d, d.entry, 'energie_ohne_automatik'));
    if (mitTemp) ids.push(this.eid(d, d.entry, 'aussen'));
    return [...new Set(ids.filter(Boolean))].sort();
  }
  /* Langzeitstatistik (Recorder) eines Zeitraums: {statistic_id: [Wert je Stunde/Tag/Monat]} */
  statistik(z, versatz = 0, d = this.d) {
    if (!d) return null;
    const zr = this.zeitraum(z, versatz, d), ids = this.statIds(d, z === 'Tag');
    if (!ids.length) return { ...zr, werte: {} };
    const roh = this._holen(`s:${d.entry}:${z}:${zr.von}`, () => this._hass.callWS({ type: 'recorder/statistics_during_period',
      start_time: new Date(this.zoneMs(zr.von, '00:00', d.z.zone)).toISOString(), end_time: new Date(this.zoneMs(zr.bis, '00:00', d.z.zone)).toISOString(),
      statistic_ids: ids, period: zr.periode, types: ['change', 'mean'], units: {} }));
    if (roh === undefined) return null;
    const werte = {};
    for (const id of ids) {
      const arr = Array(zr.n).fill(null);
      for (const p of (roh || {})[id] || []) {
        const ms = typeof p.start === 'number' ? (p.start < 1e11 ? p.start * 1000 : p.start) : Date.parse(p.start), i = zr.index(this.lokal(ms, d.z.zone));
        if (i < 0 || i >= zr.n) continue;
        if (zahl(p.change)) arr[i] = (arr[i] || 0) + Number(p.change); else if (zahl(p.mean)) arr[i] = Number(p.mean);
      }
      werte[id] = arr;
    }
    return { ...zr, werte };
  }
  /* Verbrauch in kWh je Stunde (Tag), je Tag (Woche/Monat) oder je Monat (Jahr); bid null = Summe der Baustelle */
  verbrauch(d, bid, z, versatz = 0) {
    const st = this.statistik(z, versatz, d); if (!st) return null;
    const eins = b => { const en = this.eid(d, b.id, 'energie'), ids = en ? [en] : b.geraete.map(g => g.energie).filter(Boolean);
      const r = addieren(ids.map(id => (st.werte[id] || Array(st.n).fill(0)).map(v => v || 0))); return r.length ? r : Array(st.n).fill(0); };
    const liste = bid ? d.bereiche.filter(b => b.id === bid) : d.bereiche;
    return liste.length ? addieren(liste.map(eins)) : Array(st.n).fill(0);
  }
  reihe(d, id, z, versatz = 0) { const st = this.statistik(z, versatz, d); if (!st) return null; return (id && st.werte[id]) || Array(st.n).fill(null); }
  heizStunden(d, b, z, versatz = 0) {
    if (b.pumpe) { const r = b.geraete.filter(g => g.rolle === 'pumpe').map(g => this.reihe(d, this.eid(d, g.id, 'pumpzeit'), z, versatz)); if (r.some(x => !x)) return null; return addieren(r.map(x => x.map(v => v || 0))); }
    const r = this.reihe(d, this.eid(d, b.id, 'heizzeit'), z, versatz); return r && r.map(v => v || 0);
  }
  zyklen(d, b, z) { const r = b.geraete.filter(g => g.rolle === 'pumpe').map(g => this.reihe(d, this.eid(d, g.id, 'pumpzyklen'), z)); if (r.some(x => !x)) return null; return addieren(r.map(x => x.map(v => Math.round(v || 0)))); }
  /* Auswertung, Abrechnung und Verlauf rechnet die Integration (api §8), die Seite zeigt nur an: null = lädt noch, {} = Fehler */
  awDaten(z, versatz = 0, scope = this.s.awScope || 'diese', d = this.d) {
    if (!d) return null;
    const r = this._holen(`aw:${d.entry}:${z}:${versatz}:${scope}:${d.z.HEUTE}`, () => this._hass.callWS({ type: 'baustelle/auswertung', entry_id: d.entry, zeitraum: z, versatz, scope }));
    return r === undefined ? null : r || {};
  }
  abDaten(z, scope = this.s.awScope || 'diese', d = this.d) {
    if (!d) return null;
    const r = this._holen(`ab:${d.entry}:${z}:${scope}:${d.z.HEUTE}`, () => this._hass.callWS({ type: 'baustelle/abrechnung', entry_id: d.entry, zeitraum: z, versatz: 0, scope }));
    return r === undefined ? null : r || {};
  }
  verlaufDaten(x) {
    const r = this._holen(`v:${x.entry}:${x.z.HEUTE}`, () => this._hass.callWS({ type: 'baustelle/auswertung', entry_id: x.entry, teil: 'verlauf' }), 900000);
    return r === undefined ? null : r || {};
  }

  /* Gemessen: wann zieht ein Gerät Strom (Leistung über 50 W) – Verlauf der Leistungssensoren seit Montag */
  messung(d = this.d) {
    const geraete = d.bereiche.flatMap(b => b.geraete.map(g => ({ b, g, eid: g.leistung || g.schalter }))).filter(x => x.eid);
    if (!geraete.length) return {};
    const ids = [...new Set(geraete.map(x => x.eid))].sort(), start = this.zoneMs(d.z.WOCHE_ISO[0], '00:00', d.z.zone);
    const roh = this._holen(`h:${d.entry}:${d.z.HEUTE}:${d.z.JETZT.slice(0, 4)}`, () => this._hass.callWS({ type: 'history/history_during_period',
      start_time: new Date(start).toISOString(), end_time: new Date(d.z.jetztMs).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false }), 600000);
    if (roh === undefined) return null;
    const tagStart = d.z.WOCHE_ISO.map(t => this.zoneMs(t, '00:00', d.z.zone)), ende = d.z.jetztMs, erg = {};
    for (const { g, eid } of geraete) {
      const liste = ((roh || {})[eid] || []).map(x => ({ s: x.s ?? x.state, t: zahl(x.lu) ? x.lu * 1000 : zahl(x.lc) ? x.lc * 1000 : Date.parse(x.last_updated || x.last_changed) }))
        .filter(x => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
      const tage = TAGE.map(() => ({ an: [], off: [] }));
      liste.forEach((x, i) => {
        const von = Math.max(x.t, start), bis = i + 1 < liste.length ? liste[i + 1].t : ende; if (bis <= von) return;
        const art = x.s === 'unavailable' ? 'off' : (x.s === 'on' || (zahl(x.s) && Number(x.s) > 50)) ? 'an' : null; if (!art) return;
        tagStart.forEach((ds, k) => { const a = Math.max(von, ds), b = Math.min(bis, ds + 864e5); if (b > a) tage[k][art].push([(a - ds) / 60000, (b - ds) / 60000]); });
      });
      for (const t of tage) for (const art of ['an', 'off']) { const m = []; for (const q of t[art]) { const l = m[m.length - 1]; if (l && q[0] - l[1] < 1) l[1] = Math.max(l[1], q[1]); else m.push([...q]); } t[art] = m; }
      erg[g.id] = tage;
    }
    return erg;
  }

  _kalender(eid, tage = 400) {
    if (!eid) return [];
    const start = new Date(this.zoneMs(this.d ? this.z.HEUTE : new Date().toISOString().slice(0, 10), '00:00', this.d && this.z.zone)), ende = new Date(start.getTime() + tage * 864e5);
    const r = this._holen(`k:${eid}`, () => this._hass.callApi('GET', `calendars/${eid}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(ende.toISOString())}`), 120000);
    return r === undefined ? null : (r || []).map(x => { const s = x.start || {}, e = x.end || {}, von = s.date || this.lokal(s.dateTime).slice(0, 10), bisX = e.date ? plusTage(e.date, -1) : this.lokal(e.dateTime).slice(0, 10);
      return { name: x.summary || '', von, bis: bisX < von ? von : bisX, uid: x.uid || null, recurrence_id: x.recurrence_id || null }; });
  }
  wetterTag(iso) {
    const d = this.d, w = d.wetter || {};
    if (iso === d.z.HEUTE) return { kalt: w.frueh_min, regen: w.regen_heute, regenVortag: w.regen_vortag };
    const f = x => (this.vorhersage.daily || []).find(y => this.lokal(y.datetime).slice(0, 10) === x);
    const t = f(iso), v = plusTage(iso, -1) === d.z.HEUTE ? { precipitation: w.regen_heute } : f(plusTage(iso, -1));
    return { kalt: t && t.templow, regen: t && t.precipitation, regenVortag: v && v.precipitation };
  }

  get azListe() { return [...this.d.arbeitszeiten].sort((a, b) => a.ab.localeCompare(b.ab)); }
  get azJetzt() { const L = this.azListe; return L.filter(a => a.ab <= this.z.HEUTE).at(-1) || L[0] || null; }
  /* Heizplan eines Tages – berechnet von der Integration (plan_woche), hier nur in Text übersetzt */
  planTag(tag) {
    const iso = this.z.WOCHE_ISO[TAGE.indexOf(tag)], q = this.d.plan[iso];
    if (!q) return null;
    const w = this.wetterTag(iso);
    const gruende = (q.gruende || []).map(c => c === 'ausnahme' ? `Ausnahme: ${(q.ausnahme && (q.ausnahme.notiz || AUSNAHME[q.ausnahme.art])) || 'andere Zeiten'}`
      : c === 'fruehstart' ? (zahl(w.kalt) ? `Frühstart ${de(w.kalt).replace('-', '−')} °C` : 'Frühstart')
      : c === 'frueher_nach_regen' ? 'früher nach Regen'
      : c === 'trocknen' ? (zahl(w.regen) ? `Kleidung trocknen, ${de(w.regen, w.regen % 1 ? 1 : 0)} mm Regen` : 'Kleidung trocknen') : String(c));
    return { vor: q.vor, extra: zahl(q.start) ? q.start : q.vor, a: q.a, b: q.b, nach: q.nach, ende: q.ende, gruende, codes: q.gruende || [], ausnahme: q.ausnahme || null };
  }
  statusText() {
    const d = this.d;
    if (!d.geladen) return 'nicht geladen – Integration prüfen';   // Einrichtung fehlgeschlagen: keine Werte, nichts wird geschaltet
    if (!d.e.auto) return 'Handbetrieb – nichts wird geschaltet';
    if (d.jetztBis) return `♨ alle heizen bis ${d.jetztBis}`;
    if (d.statusText) return d.statusText;
    const p = this.planTag(this.z.HEUTE_TAG), j = minu(this.z.JETZT);
    if (p && j >= p.extra && j < p.ende) return `♨ heizt bis ${uhr(p.ende)}`;
    if (p && j < p.extra) return `Start um ${uhr(p.extra)}`;
    return 'aus';
  }
  zeitstrahl(p, jetzt = false) {
    const seg = p ? [[p.extra, p.vor, 'extra'], [p.vor, p.a, 'vor'], [p.a, p.b, 'heiz'], [p.b, p.nach, 'vor'], [p.nach, p.ende, 'trock']] : [];
    return this.zeitstrahlSeg(seg, jetzt);
  }
  zeitstrahlSeg(liste, jetzt = false) {
    const A = 4 * 60, B = 20 * 60, x = m => Math.max(0, Math.min(100, (m - A) / (B - A) * 100));
    const seg = (von, bis, k) => bis > von ? `<i class="tl-${k}" style="left:${x(von)}%;width:${x(bis) - x(von)}%"></i>` : '';
    return `<div class="tl-spur">${liste.map(q => seg(q[0], q[1], q[2])).join('')}${jetzt ? `<i class="tl-jetzt" style="left:${x(minu(this.z.JETZT))}%"></i>` : ''}</div>`;
  }
  bName(id) { return id ? (this.d.bereiche.find(b => b.id === id) || { name: id }).name : 'Baustelle'; }
  /* Staffelung: gemessene Last, Grenze und freier Platz – gerechnet von der Integration (laufzeit.staffel) */
  last() {
    const d = this.d, S = d.staffel || {}, e = d.e;
    const alleG = d.bereiche.flatMap(b => b.geraete.map(g => ({ b, g }))), hk = alleG.filter(x => x.g.heizer);
    // Nur Werte der Integration; solange sie fehlen (vor der ersten Rechnung), gibt es hier keine Anschlüsse
    const n = x => zahl(x) ? Number(x) : 0;
    const A = (S.anschluesse || []).map(a => {
      const s = d.anschluesse.find(x => x.id === a.id) || {};
      return { id: a.id, name: a.name || s.name || a.id, ampere: s.ampere, phasen: s.phasen, voll: n(a.voll_kw), grenze: n(a.grenze_kw), reserve: n(a.reserve_kw),
        heiz: n(a.heiz_kw), pumpe: n(a.pumpe_kw), sonst: n(a.sonst_kw), frei: n(a.frei_kw) };
    });
    const s3 = k => A.reduce((x, a) => x + a[k], 0);
    return { A, heiz: s3('heiz'), pumpe: s3('pumpe'), sonst: s3('sonst'), grenze: s3('grenze'), reserve: s3('reserve'), gesamt: s3('heiz') + s3('pumpe') + s3('sonst'), hk,
      laufen: zahl(S.laufen) ? S.laufen : hk.filter(x => x.g.an && !x.b.offline).length, warten: zahl(S.warten) ? S.warten : hk.filter(x => x.g.warte).length, max: zahl(S.max) ? S.max : e.max_gleich };
  }
  stromBalken(L, klein) {
    const w = v => `${L.grenze > 0 ? Math.max(0, v / L.grenze * 100) : 0}%`;
    return `<div class="strom ${klein ? 'klein' : ''}"><div class="strom-spur"><i class="s-heiz" style="width:${w(L.heiz)}"></i><i class="s-pumpe" style="width:${w(L.pumpe)}"></i><i class="s-sonst" style="width:${w(L.sonst)}"></i>
      <i class="s-res" style="width:${w(L.reserve)}"></i></div></div>`;
  }
  arbeitsende() { const p = this.planTag(this.z.HEUTE_TAG); return p ? uhr(p.b) : null; }
  bedarfBlock(b) {
    // Der Kalender liefert eine Serie je Vorkommen (gleiche uid) – hier eine Zeile je Serie wie im Mockup, vorbei ist vorbei
    const H = this.z.HEUTE, offen = t => t.datum > H || (t.datum === H && t.bis > this.z.JETZT), serien = new Map();
    for (const t of this.d.termine.filter(t => t.b === b.id)) {
      const k = t.rrule && t.uid ? t.uid : t, alt = serien.get(k);
      if (!alt || (!offen(alt) && offen(t))) serien.set(k, t);
    }
    const T = [...serien.values()].filter(t => t.wieder !== 'einmal' || offen(t))
      .map(t => ({ t, n: t.wieder === 'einmal' || offen(t) ? t.datum : naechsterTermin(t, plusTage(H, 1)) })).sort((x, y) => (x.n || '9').localeCompare(y.n || '9'));
    const vor = m => uhr(minu(m) - this.d.e.vorheizen), ende = this.arbeitsende();
    const kal = this.d.termineKal;
    return `<div class="glas-panel block"><div class="block-kopf"><b>Nur bei Bedarf</b><span class="leise">heizt nicht nach der Arbeitszeit · sonst nur Frostschutz</span></div>
      ${b.bedarfBis ? `<div class="bedarf-an"><b>♨ heizt bis ${b.bedarfBis}${b.boost ? ' · ⚡ schnell' : ''}</b><button class="chip glas-panel" data-act="bedarf-aus" data-id="${b.id}">Beenden</button></div>`
        : `<div class="bedarf-dauer">${[['60', '1 h'], ['120', '2 h'], ...(ende ? [['ende', 'bis Arbeitsende']] : [])].map(([v, t]) => `<button class="chip glas-panel" data-act="bedarf-an" data-id="${b.id}" data-v="${v}">▶ ${t}</button>`).join('')}</div>`}
      <div class="gruppe-t">Termine · ${kal ? `Kalender „${esc(this.name(kal))}“` : 'kein Kalender gewählt'}</div>
      ${T.length ? T.map(({ t, n }) => `<div class="zeile ereignis"><span class="zeit t-wann">${t.wieder === 'einmal' ? `${wtag(t.datum)} ${kurzDatum(t.datum)}` : t.wieder === 'woche' ? `jeden ${wtag(t.datum)}` : `jeden 2. ${wtag(t.datum)}`}</span>
          <div><b>${t.von}–${t.bis}</b> ${esc(t.titel)}${t.wieder !== 'einmal' ? ` <span class="badge">${WIEDER[t.wieder]}</span>` : ''}<div class="leise">${n && t.wieder !== 'einmal' ? `nächster ${wtag(n)} ${kurzDatum(n)} · ` : ''}heizt ab ${vor(t.von)}${t.boost ? ' · ⚡ schnell' : ''}</div></div>
          <button class="x" data-act="termin-weg" data-i="${this.d.termine.indexOf(t)}" title="Termin löschen">✕</button></div>`).join('') : '<div class="leise">Keine Termine</div>'}
      <button class="zeile" data-act="sheet" data-s="${kal ? 'termin' : 'wetterquelle'}" data-id="${b.id}"><span class="blau">${kal ? '+ Termin eintragen' : 'Kalender für Termine wählen'}</span></button></div>`;
  }
  /* Heizzeiten eines Containers an einem Tag der Woche: Abschnitte der Integration [von, bis, art] in Minuten */
  heizzeiten(b, t) {
    if (b.pumpe) return [];
    const iso = this.z.WOCHE_ISO[TAGE.indexOf(t)], seg = (this.d.abschnitte[b.id] || {})[iso] || [];
    return seg.filter(q => zahl(q[0]) && zahl(q[1])).map(q => [Number(q[0]), Number(q[1]), ABSCHNITT[q[2]] || 'heiz']).filter(x => x[1] > x[0]).sort((p, q) => p[0] - q[0]);
  }
  /* Wann ein Heizkörper wirklich Strom zieht (Leistung über 50 W) – aus dem Verlauf der Leistungssensoren */
  aktiv(b, g, t) {
    const leer = { an: [], off: [] };
    if (!g.heizer) return leer;
    const tagNr = TAGE.indexOf(t), heuteNr = TAGE.indexOf(this.z.HEUTE_TAG); if (tagNr > heuteNr) return leer;
    const m = this.mess && this.mess[g.id];
    return (m && m[tagNr]) || leer;
  }
  uebersichtHeizzeiten() {
    const art = this.s.hzArt || 'tag', tag = this.s.hzTag || this.z.HEUTE_TAG, C = this.d.bereiche.filter(b => !b.pumpe);
    const A = 4 * 60, B = 21 * 60, x = m => Math.max(0, Math.min(100, (m - A) / (B - A) * 100)), breite = (a, b) => Math.max(0, x(b) - x(a));
    const std = segs => segs.reduce((a, q) => a + (q[1] - q[0]), 0) / 60;
    const HZ = b => b.geraete.filter(g => g.heizer);
    const tagNr = TAGE.indexOf(tag), heuteNr = TAGE.indexOf(this.z.HEUTE_TAG), jetzt = minu(this.z.JETZT);
    this.mess = this.messung();
    const kopf = `<div class="block-kopf"><b>Wann welche Heizung heizt</b><div class="seg klein">${[['tag', 'Tag'], ['woche', 'Woche']].map(([k, t]) => `<button data-act="hz-art" data-v="${k}" class="${art === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;
    if (this.mess === null) return `<div class="glas-panel block">${kopf}${LAEDT}</div>`;
    let inhalt;
    if (!C.some(b => HZ(b).length)) inhalt = '<div class="leer">Keine Heizkörper</div>';
    else if (art === 'tag') {
      const zukunft = tagNr > heuteNr, heute = tagNr === heuteNr;
      inhalt = `<div class="vb-wer">${this.z.WOCHE.map(([t, d]) => `<button data-act="hz-tag" data-v="${t}" class="${t === tag ? 'on' : ''}">${t === this.z.HEUTE_TAG ? 'heute' : t} ${d.slice(0, 2)}.</button>`).join('')}</div>
        <div class="leise">${zukunft ? 'Noch nichts gemessen – blass der Plan.' : heute ? 'Bis jetzt gemessen, danach blass der Plan.' : 'Gemessen an der Leistung: kräftig = zieht Strom (über 50 W).'}</div>
        <div class="hz-tag">${C.filter(b => HZ(b).length).map(b => { const plan = this.heizzeiten(b, tag), ph = std(plan);
          return `<div class="hz-c"><span class="hz-cn">${esc(b.name)}${b.bedarf ? ' <span class="leise">bei Bedarf</span>' : ''}${b.offline ? ' <span class="rot-t">offline</span>' : ''}</span><span class="leise hz-cp">${ph ? `${de(ph)} h geplant` : b.bedarf ? 'kein Termin' : !b.auto ? 'Hand' : 'frei'}</span></div>
            ${HZ(b).map(g => { const a = this.aktiv(b, g, tag), ah = std(a.an);
              return `<div class="hz-zeile"><span class="hz-n hz-g">${esc(g.n)}</span>
                <div class="tl-spur hz">${plan.map(q => `<i class="hz-plan ${!zukunft && (!heute || q[1] <= jetzt) ? 'vorbei' : ''}" style="left:${x(q[0])}%;width:${breite(q[0], q[1])}%"></i>`).join('')}
                  ${zukunft ? '' : a.an.map(q => `<i class="hz-an" style="left:${x(q[0])}%;width:${breite(q[0], q[1])}%"></i>`).join('')}
                  ${a.off.map(q => `<i class="hz-off" style="left:${x(q[0])}%;width:${breite(q[0], q[1])}%"></i>`).join('')}
                  ${heute ? `<i class="tl-jetzt" style="left:${x(jetzt)}%"></i>` : ''}</div>
                <span class="hz-h">${zukunft ? '–' : `${de(ah)} h`}</span></div>`; }).join('')}`; }).join('')}
          <div class="hz-zeile achse"><span></span><div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div><span></span></div></div>
        <div class="hp-legende"><span><i class="hz-an"></i>zieht Strom</span><span><i class="hz-plan"></i>geplant</span><span><i class="hz-off"></i>offline</span><span class="leise">Lücken im Plan: Thermostat, Staffelung, Tür offen</span></div>`;
    } else {
      const zeilen = C.flatMap(b => HZ(b).map(g => ({ b, g, h: TAGE.map((t, k) => k > heuteNr ? std(this.heizzeiten(b, t)) : std(this.aktiv(b, g, t).an)) })));
      const max = Math.max(...zeilen.flatMap(z => z.h), 1);
      inhalt = `<div class="hz-woche"><div class="hz-wk"><span></span>${this.z.WOCHE.map(([t, d]) => `<span class="${t === this.z.HEUTE_TAG ? 'heute' : ''}">${t}<br><small>${d.slice(0, 2)}.</small></span>`).join('')}<span>Σ</span></div>
        ${zeilen.map(({ b, g, h }) => `<div class="hz-wz"><span class="hz-n">${esc(b.name)} <span class="leise">· ${esc(g.n)}</span></span>${h.map((v, k) => `<button class="hz-zelle ${k > heuteNr ? 'geplant' : ''}" data-act="hz-tag" data-v="${TAGE[k]}" data-art="tag" style="--a:${v ? .15 + .75 * v / max : 0}" title="${esc(b.name)} · ${esc(g.n)} ${TAGE[k]}: ${de(v)} h ${k > heuteNr ? 'geplant' : 'gemessen'}">${v ? de(v, v % 1 ? 1 : 0) : ''}</button>`).join('')}<b class="hz-sum">${de(h.slice(0, heuteNr + 1).reduce((a, v) => a + v, 0), 0)} h</b></div>`).join('')}</div>
        <div class="leise">Stunden, in denen der Heizkörper Strom gezogen hat (heute bis jetzt); kommende Tage blass und kursiv = geplant. Σ = bisher gemessen. Tippen zeigt den Tag.</div>`;
    }
    return `<div class="glas-panel block">${kopf}${inhalt}</div>`;
  }
  anschluss(id) { return this.d.anschluesse.find(a => a.id === id) || this.d.anschluesse[0] || { id: null, name: 'kein Anschluss', ampere: 0, phasen: 3, reserve: 0 }; }
  laufende() { return this.alle.filter(x => x.aktiv); }
  firma(id, d = this.d) { return d.firmen.find(f => f.id === id) || d.firmen[0]; }
  /* Was im Verbrauch gestapelt wird: Container dieser Baustelle, laufende Baustellen oder Firmen */
  quellen(st, ziel) {
    const alle = ziel === 'aw' && this.s.awScope === 'alle', lauf = alle ? this.laufende() : [this.d];
    if (st.gruppe === 'firma') {   // kWh je Firma und Periode rechnet die Integration (Firma je Tag)
      const namen = [...new Map(lauf.flatMap(l => l.firmen.map(f => [f.eigen ? 'eigen' : f.name, f]))).values()];
      return namen.map((f, k) => ({ id: f.eigen ? 'eigen' : f.name, name: f.name, farbe: `var(--s${(k % 6) + 1})`, v: z => { const a = this.abDaten(z, alle ? 'alle' : 'diese'); if (!a) return null;
        return (a.reihen || {})[f.eigen ? 'eigen' : f.name] || Array(this.zeitraum(z).n).fill(0); } }));
    }
    if (alle) return lauf.map((l, k) => ({ id: l.entry, name: l.titel, farbe: `var(--s${(k % 6) + 1})`, v: z => this.verbrauch(l, null, z) }));
    return this.d.bereiche.map(b => ({ id: b.id, name: b.name, farbe: BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], v: z => this.verbrauch(this.d, b.id, z) }));
  }
  verbrauchInhalt(st, ziel, kennzahlen) {
    const Q = this.quellen(st, ziel), z = st.zeitraum, aus = Q.filter(q => st.auswahl.includes(q.id)), alleGewaehlt = aus.length === Q.length && Q.length > 0;
    const alle = ziel === 'aw' && this.s.awScope === 'alle', summenName = alle ? 'Alle laufenden' : this.d.titel;
    const zr = this.zeitraum(z), labels = zr.labels, zd = `data-ziel="${ziel}"`;
    const was = st.gruppe === 'firma' ? 'Firmen' : alle ? 'Baustellen' : 'Container';
    const titel = !aus.length ? `${esc(summenName)} · Summe` : aus.length === 1 ? esc(aus[0].name) : `${aus.length} ${was} gestapelt`;
    const werte = Q.map(q => ({ q, v: q.v(z) })), laedt = werte.some(x => !x.v);
    const reihen = laedt ? [] : aus.length ? werte.filter(x => st.auswahl.includes(x.q.id)).map(({ q, v }) => ({ name: q.name, v, farbe: q.farbe }))
      : [{ name: 'Summe', v: addieren(werte.map(x => x.v)).length ? addieren(werte.map(x => x.v)) : Array(zr.n).fill(0), farbe: 'var(--s1)' }];
    const summeJe = labels.map((_, i) => reihen.reduce((a, r) => a + (r.v[i] || 0), 0)), sum = summe(summeJe);
    const spitze = Math.max(...summeJe, 0), wo = sum > 0 ? labels[summeJe.indexOf(spitze)] : '–';
    const einheit = z === 'Tag' ? 'kWh/h' : 'kWh', je = { Tag: 'je Stunde · heute', Woche: 'je Tag · diese Woche', Monat: `je Tag · ${MONATE_LANG[zr.monat ?? 0]}`, Jahr: `je Monat · ${zr.jahr ?? ''}` }[z];
    const p = this.d.e.preis;
    return `<div class="block-kopf">${ziel === 'sheet' ? '<h3>Verbrauch</h3>' : '<b>Verbrauch</b>'}<span class="leise">${titel}</span></div>
      <div class="seg">${['Tag', 'Woche', 'Monat', 'Jahr'].map(v => `<button data-act="vb-zeitraum" ${zd} data-v="${v}" class="${v === z ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="vb-gruppe"><span class="leise">stapeln nach</span><div class="seg klein">${[['teil', alle ? 'Baustelle' : 'Container'], ['firma', 'Firma']].map(([k, t]) => `<button data-act="vb-gruppe" ${zd} data-v="${k}" class="${(st.gruppe || 'teil') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="vb-wer"><button data-act="vb-wer" ${zd} class="${!aus.length ? 'on' : ''}"><i style="background:var(--s1)"></i>Summe</button>
        <button data-act="vb-wer" ${zd} data-id="*" class="${alleGewaehlt ? 'on' : ''}">Alle gestapelt</button>
        ${Q.map(q => `<button data-act="vb-wer" ${zd} data-id="${esc(q.id)}" class="${st.auswahl.includes(q.id) ? 'on' : ''}"><i style="background:${q.farbe}"></i>${esc(q.name)}${st.auswahl.includes(q.id) ? ' ✓' : ''}</button>`).join('')}</div>
      ${kennzahlen ? `<div class="kennz"><div><b>${laedt ? '–' : de(sum, sum < 100 ? 1 : 0)}</b><span>kWh ${{ Tag: 'heute', Woche: 'diese Woche', Monat: 'im Monat', Jahr: 'im Jahr' }[z]}${reihen.length > 1 ? ' zusammen' : ''}</span></div>
        <div><b>${laedt ? '–' : de(sum * p, 2)} €</b><span>Kosten</span></div><div><b>${laedt ? '–' : wo}</b><span>Spitze ${laedt ? '–' : de(spitze, 1)} kWh</span></div></div>` : ''}
      <div class="leise">${einheit} ${je}${aus.length > 1 ? ' · gestapelt, oberste Kante = Summe' : ''}</div>
      <div class="chart-wrap">${laedt ? LAEDT : flaeche(`vb-${ziel}-${this.s.awScope || ''}-${st.gruppe || ''}-${aus.map(q => q.id).join('_') || 'alle'}-${z}`, reihen, labels, einheit, z === 'Tag' ? 6 : z === 'Monat' ? 7 : z === 'Woche' ? 1 : 3)}</div>
      ${reihen.length > 1 ? `<div class="vb-je">${reihen.map(r => { const su = summe(r.v), sp = Math.max(...r.v, 0);
          return `<div><i style="background:${r.farbe}"></i><span class="n">${esc(r.name)}</span><b>${de(su, su < 100 ? 1 : 0)} kWh</b><span>${de(su * p, 2)} €</span><span class="leise">Spitze ${su > 0 ? labels[r.v.indexOf(sp)] : '–'}</span></div>`; }).join('')}</div>` : ''}`;
  }
  /* Abrechnung: je Firma die Container mit kWh und Kosten im gewählten Zeitraum (rechnet die Integration, Firma je Tag) */
  abrechnung(z) {
    const lauf = this.s.awScope === 'alle' ? this.laufende() : [this.d], p = this.d.e.preis, zr = this.zeitraum(z), a = this.abDaten(z), zeilen = a && (a.firmen || []);
    const wann = { Tag: 'heute', Woche: 'diese Woche', Monat: `${MONATE_LANG[zr.monat ?? 0]} ${zr.jahr ?? ''}`, Jahr: String(zr.jahr ?? '') }[z];
    return `<div class="glas-panel block"><div class="block-kopf"><b>Abrechnung nach Firma</b><span class="leise">${wann} · ${de(p, 2)} € je kWh</span></div>
      ${!zeilen ? LAEDT : !zeilen.length ? '<div class="leer">Noch kein Verbrauch in diesem Zeitraum</div>' : zeilen.map(f => `<div class="ab-firma ${f.eigen ? 'eigen' : ''}"><div class="ab-kopf"><b>${esc(f.firma)}</b><span><b>${de(f.eur, 2)} €</b> <span class="leise">${de(f.kwh, 0)} kWh · ${de(f.anteil, 0)} %</span></span></div>
        ${(f.container || []).map(x => `<div class="ab-c"><span>${esc(x.name)}${lauf.length > 1 ? ` <span class="leise">· ${esc(x.titel)}</span>` : ''}</span><span class="leise">${de(x.kwh, 0)} kWh · ${de(x.eur, 2)} €</span></div>`).join('')}</div>`).join('')}
      <button class="knopf" data-act="csv" data-art="firma">⇩ Abrechnung als CSV</button></div>`;
  }
  freiText(iso) {
    const a = this.d.ausnahmen.find(x => x.datum === iso), f = this.d.frei[iso];
    if (a && a.art === 'frei') return `Ausnahme: frei${a.notiz ? ' – ' + esc(a.notiz) : ''} · nur Frostschutz`;
    if (f === 'feiertag') return `${esc(this.d.freiName[iso] || 'Feiertag')} · nur Frostschutz`;
    if (f === 'urlaub') return 'Urlaub · nur Frostschutz';
    return 'frei · nur Frostschutz';
  }
  heizplanInhalt() {
    const e = this.d.e;
    return `<div class="hp-legende"><span><i class="tl-extra"></i>Frühstart</span><span><i class="tl-vor"></i>Vor- und Nachheizen ${e.vorheizen}/${e.nachheizen} min</span><span><i class="tl-heiz"></i>Arbeitszeit</span><span><i class="tl-trock"></i>Kleidung trocknen</span></div>
      <div class="hp">${this.z.WOCHE.map(([t, d], k) => { const p = this.planTag(t), h = t === this.z.HEUTE_TAG, iso = this.z.WOCHE_ISO[k];
        return `<div class="hp-zeile ${h ? 'heute' : ''} ${this.d.ausnahmen.some(x => x.datum === iso) ? 'ausn' : ''}"><div class="hp-tag"><b>${h ? 'heute' : t}</b><span>${d}</span></div>
          <div class="hp-mitte">${this.zeitstrahl(p, h)}<div class="leise">${p ? p.gruende.map(esc).join(' · ') : this.freiText(iso)}</div></div>
          <div class="hp-zeit">${p ? `${uhr(p.extra)}<br>${uhr(p.ende)}` : '–'}</div></div>`; }).join('')}
        <div class="hp-zeile achse"><div></div><div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div><div></div></div></div>`;
  }
  get b() { return this.d && this.d.bereiche.find(x => x.id === this.s.cid); }
  gehe(view, cid = null) { this.s.view = view; this.s.cid = cid; this.s.leeren(); this.render(true); }
  herunterladen(url, name) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    const a = document.createElement('a'); if (!a) return; a.href = url; a.download = name; if (a.click) a.click();
  }
  datei(inhalt, name, typ) {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
    this.herunterladen(URL.createObjectURL(new Blob([inhalt], { type: typ })), name);
  }
  csv(art) {
    // Export (Semikolon, deutsches Komma – öffnet direkt in Excel); die CSV baut die Integration (api §8). art 'firma': Abrechnung je Firma und Container
    let text, name;
    if (this.s.view === 'bsdetail') {
      const x = this.alle.find(y => y.entry === this.s.bs), v = x && this.verlaufDaten(x);
      if (!v || !v.csv) return this.toast('Werte laden noch …');
      text = v.csv; name = `baustelle-verbrauch-${x.titel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    } else {
      const z = (this.s.aw || { zeitraum: 'Monat' }).zeitraum, lauf = this.s.awScope === 'alle' ? this.laufende() : [this.d], a = this.abDaten(z);
      if (!a || !a.csv) return this.toast('Werte laden noch …');
      text = a.csv[art === 'firma' ? 'firma' : 'verbrauch'];
      name = `baustelle-${art === 'firma' ? 'abrechnung' : 'verbrauch'}-${lauf.length > 1 ? 'alle' : this.d.titel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${z.toLowerCase()}.csv`;
    }
    const zeilen = text.replace(/^\ufeff/, '').split('\r\n');
    this.datei(text, name, 'text/csv;charset=utf-8');
    this.toast(`${name} · ${zeilen.length - 1} Zeilen`);
    return zeilen;
  }
  meldungOffen(m) { return !['geschlossen', 'verworfen', 'erledigt'].includes(m.status); }
  meldungenMarkdown() {
    const ART = { fehler: 'Fehler', wunsch: 'Wunsch', anregung: 'Anregung' };
    return (this.meldungen() || []).map(m => `- [${this.meldungOffen(m) ? ' ' : 'x'}] **${m.ticket ? m.ticket + ' ' : ''}${ART[m.art] || m.art}** (${TICKET_STATUS[m.status] || m.status}, ${this.meldungZeit(m)}, v${m.version || '–'}, ${m.geraet || '–'}, ${m.kontext || '–'}): ${m.text}`).join('\n');
  }
  meldungen() { const r = this._holen('meldungen', () => this._hass.callWS({ type: 'baustelle/meldungen', entry_id: this.d ? this.d.entry : undefined }), 60000); return r === undefined ? null : Array.isArray(r) ? r : (r && r.meldungen) || []; }
  meldungZeit(m) { const l = this.lokal(m.zeit); return l ? `${wtag(l)} ${kurzDatum(l)} ${l.slice(11, 16)}` : '–'; }
  toast(t, wieder = false) {
    const el = this.root && this.root.querySelector('.toast'); if (!el || !t) return;
    el.textContent = t; el.classList.remove('an'); void el.offsetWidth; el.classList.add('an'); this.letzterToast = t;
    if (!wieder) this._toastBis = Date.now() + 2000;
  }

  render(neu = false) {
    if (!this.ui) return;
    const scroll = this.root.querySelector('.scroll'), pos = scroll && !neu ? scroll.scrollTop : 0, sh = this.root.querySelector('.sheet'), shPos = sh && this.s.sheet && this._sheetArt === this.s.sheet.art ? sh.scrollTop : 0;
    this.ui.classList.toggle('still', !neu && this._view === this.s.view);   // Neuzeichnen ohne Einblend-Animationen
    this._view = this.s.view; this._sheetArt = this.s.sheet && this.s.sheet.art;
    // Reiter nach den Funktionen der Baustelle (api §8): Heizung nur mit Funktion heizung, Pumpen nur mit Funktion
    // pumpen und Pumpenschächten (0.7.8, wie 0.6.3)
    const mitHeizung = !this.d || this.d.funktionen.includes('heizung');
    const mitPumpen = !!(this.d && this.d.funktionen.includes('pumpen') && this.d.bereiche.some(b => b.pumpe));
    const tabs = [['uebersicht', 'Übersicht'], ...(mitHeizung ? [['heizung', 'Heizung']] : []), ...(mitPumpen ? [['pumpen', 'Pumpen']] : []), ['auswertung', 'Auswertung'], ['verlauf', 'Verlauf'], ['einst', '⚙']];
    if (!this.d && !['verlauf', 'bsdetail', 'ueber'].includes(this.s.view)) this.s.view = 'uebersicht';
    if (this.s.view === 'pumpen' && !mitPumpen) this.s.view = 'uebersicht';
    if (this.s.view === 'heizung' && !mitHeizung) this.s.view = 'uebersicht';
    if (this.s.view === 'container' && !this.b) this.s.view = 'uebersicht';
    const aktivTab = this.s.view === 'container' ? 'uebersicht' : this.s.view === 'bsdetail' ? 'verlauf' : ['ueber', 'dev'].includes(this.s.view) ? 'einst' : this.s.view;
    let seite;
    if (!this.roh) seite = `<div class="glas-panel block">${this.fehler ? `<div class="leer">Die Integration antwortet nicht: ${esc(this.fehler)}</div>` : LAEDT}</div>`;
    else if (!this.d && !['verlauf', 'bsdetail', 'ueber'].includes(this.s.view)) seite = this.v_leer();
    else seite = this['v_' + this.s.view]();
    const melden = this.d ? this.d.e.melden : true;
    let sheet = '';
    if (this.s.sheet) { try { sheet = this.sheet(); } catch (e) { this.s.sheet = null; sheet = ''; } }
    this.ui.innerHTML = `<div class="scroll"><div class="seite ${neu ? 'rein' : ''}">${this.versionHinweis()}${seite}</div></div>
      ${this._narrow ? '<button class="menue-knopf glas-panel" data-act="menue" aria-label="Seitenleiste" title="Seitenleiste">☰</button>' : ''}
      <nav class="glas-nav glas-panel ${tabs.length > 5 ? 'sechs' : ''}">${tabs.map(([k, t]) => `<button data-act="tab" data-v="${k}" class="${k === aktivTab ? 'on' : ''} ${k === 'einst' ? 'nav-ic' : ''}" ${k === 'einst' ? 'aria-label="Einstellungen" title="Einstellungen"' : ''}>${k === 'einst' ? ICON_COG : t}</button>`).join('')}</nav>
      <div class="schleier ${this.s.sheet ? 'an' : ''}" data-act="zu"></div>
      <div class="sheet glas-panel ${this.s.sheet ? 'an' : ''}">${melden && this.roh && this.s.sheet && this.s.sheet.art !== 'melden' ? `<button class="melden-knopf im-sheet" data-act="melden" title="Fehler, Wunsch oder Anregung melden" aria-label="Melden">${ICON_MELDEN}</button>` : ''}${sheet}</div>
      <div class="tip"></div><div class="toast glas-panel"></div>
      ${melden && this.roh && !this.s.sheet ? `<button class="melden-knopf glas-panel" data-act="melden" title="Fehler, Wunsch oder Anregung melden" aria-label="Melden">${ICON_MELDEN}</button>` : ''}`;
    const sc = this.root.querySelector('.scroll'); if (sc) sc.scrollTop = pos;
    const sh2 = this.root.querySelector('.sheet'); if (sh2 && shPos) sh2.scrollTop = shPos;
    if (this._toastBis > Date.now()) this.toast(this.letzterToast, true);
  }
  v_leer() {
    return `${this.kopf('Baustelle', 'KEINE LAUFENDE BAUSTELLE')}
      <div class="glas-panel liste"><div class="zeile"><span class="leise">Lege eine Baustelle an – danach kommen Container und Shellys dazu.</span></div>
        <button class="zeile" data-act="sheet" data-s="baustelle-neu"><span class="blau">+ Neue Baustelle</span></button>
        ${this.alle.length ? '<button class="zeile" data-act="tab" data-v="verlauf"><span>Abgeschlossene Baustellen</span><span class="chev">›</span></button>' : ''}</div>`;
  }

  kopf(titel, klein, rechts = '') {
    return `<div class="glas-kopf glas-panel"><div><div class="glas-klein">${klein}</div><div class="glas-titel">${titel}</div></div>${rechts}</div>`;
  }
  wetterJetzt() {
    const d = this.d, s = this.zustand(d.wetterEid), w = d.wetter || {};
    if (!s) return [w.zustand || 'cloudy', d.wetterEid ? 'kein Wetter' : 'Wetter wählen', w.aussen];
    const regen = ['rainy', 'pouring', 'lightning-rainy', 'snowy-rainy'].includes(s.state) && zahl(w.regen_heute) && w.regen_heute > 0 ? ` · ${de(w.regen_heute, w.regen_heute % 1 ? 1 : 0)} mm` : '';
    return [s.state, (WETTER_TEXT[s.state] || s.state) + regen, zahl(w.aussen) ? w.aussen : s.attributes.temperature];
  }

  /* ---- Übersicht ---- */
  pumpenWerte(d = this.d) {
    const st = this.statistik('Woche', 0, d), i = TAGE.indexOf(d.z.HEUTE_TAG);
    for (const b of d.bereiche) if (b.pumpe) { const z = st && this.zyklen(d, b, 'Woche'); b.zyklen = z ? z[i] : null; }
  }
  v_uebersicht() {
    const d = this.d, B = d.bereiche, kw = B.reduce((s, b) => s + kwVon(b), 0), W = d.warnungen.filter(w => !w.stumm);
    const st = W.filter(w => w.stufe === 'stoerung').length, hi = W.length - st;
    const an = B.flatMap(b => b.geraete).filter(g => g.an).length, alle = B.flatMap(b => b.geraete).length;
    const [wz, wt, wtemp] = this.wetterJetzt();
    this.pumpenWerte();
    return `<div class="glas-kopf glas-panel">
        <div><div class="klickbar" data-act="sheet" data-s="baustellen"><div class="glas-klein">BAUSTELLE</div><div class="glas-titel">${esc(d.titel)} <span class="pfeil">▾</span></div>
        ${d.e.staffel && this.last().A.length ? (() => { const L = this.last(); return `<button class="strom-knopf" data-act="sheet" data-s="strom">${this.stromBalken(L, true)}<span class="strom-t"><b>${de(L.gesamt)} kW</b> · ${L.A.length} ${L.A.length === 1 ? 'Anschluss' : 'Anschlüsse'} · ${L.laufen} Heizkörper an${L.warten ? ` · ${L.warten} wartet` : ''} ›</span></button>`; })() : ''}</div>
          <button class="kopf-wetter" data-act="sheet" data-s="${d.wetterEid ? 'wetter' : 'wetterquelle'}">${wetterIcon(wz, 22)}<span>${zahl(wtemp) ? de(wtemp) + '°' : '–'}</span><span class="kw-t">${esc(wt)}</span></button></div>
        <button class="glas-kw kw-knopf" data-act="sheet" data-s="verbrauch" title="Verbrauch anzeigen"><span class="blitz ${kw ? 'an' : ''}">⚡</span>${de(kw)}<small> kW</small><span class="kw-pfeil">›</span></button></div>
      <div class="glas-chips">
        <button class="glas-panel chip auto-chip ${d.e.auto ? 'on' : ''}" data-act="auto" role="switch" aria-checked="${d.e.auto}" title="Automatik ${d.e.auto ? 'ausschalten' : 'einschalten'}"><span class="mini-sw"><i></i></span>Automatik</button>
        <button class="chip-status ${d.e.auto ? 'amber' : ''}" data-act="sheet" data-s="heizplan" title="Heizplan anzeigen">${esc(this.statusText())} <span class="pfeil">›</span></button>
        ${W.length ? `<button class="glas-panel chip warn-chip ${st ? 'rot' : 'gelb'}" data-act="sheet" data-s="warnungen">⚠ ${W.length === 1 ? `${esc(this.bName(W[0].b))}: ${esc(W[0].titel)}`
          : [st ? `${st} ${st === 1 ? 'Störung' : 'Störungen'}` : '', hi ? `${hi} ${hi === 1 ? 'Hinweis' : 'Hinweise'}` : ''].filter(Boolean).join(' · ')}</button>` : ''}
        <span class="chip-leise">${an} von ${alle} Geräten an</span>
      </div>
      <div class="glas-raster">${B.map((b, i) => `<div class="glas-panel glas-k ${b.z}" role="button" tabindex="0" data-act="container" data-id="${b.id}" style="animation-delay:${i * 60}ms;--c:${FARBE[b.z]}">
        <div class="glas-illu">${illu(b)}</div>
        <div class="glas-name">${esc(b.name)}</div>${this.firma(b.firma).eigen ? '' : `<div class="firma-tag">${esc(this.firma(b.firma).name)}</div>`}${b.tuer && b.tuer.offen ? `<div class="tuer-tag">🚪 offen ${b.tuer.offen} min</div>` : ''}
        <div class="glas-zeile"><span class="glas-wert">${wertHtml(b)}</span><span class="glas-kwk">${de(kwVon(b))} kW</span></div>
        <div class="glas-status"><span class="glas-dot"></span>${esc(TEXT(b))}</div>
        <div class="glas-geraete">${b.geraete.map(g => `<i class="${g.an ? 'an' : ''}"></i>`).join('')}<span>${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'}</span></div>
        ${b.bedarf ? `<button class="bedarf-knopf ${b.bedarfBis ? 'an' : ''}" data-act="${b.bedarfBis ? 'bedarf-aus' : 'bedarf-auf'}" data-id="${b.id}">${b.bedarfBis ? `■ bis ${b.bedarfBis}` : '▶ jetzt heizen'}</button>` : ''}</div>`).join('')}
        <button class="glas-panel glas-k neu" data-act="sheet" data-s="container-neu"><span>+</span>Container</button></div>`;
  }

  /* ---- Container ---- */
  v_container() {
    const d = this.d, b = this.b, tl = this.zeitleiste(b), heuteNr = TAGE.indexOf(this.z.HEUTE_TAG);
    const tabs = b.pumpe ? [['pumpzeit', 'Pumpzeit'], ['zyklen', 'Zyklen'], ['verbrauch', 'Verbrauch']] : [['temp', 'Temperatur'], ['leistung', 'Leistung'], ['verbrauch', 'Verbrauch'], ['heizzeit', 'Heizzeit']];
    if (!tabs.some(t => t[0] === this.s.chart)) this.s.chart = tabs[0][0];
    const c = this.s.chart, mitVb = this.s.tempVb !== false;
    const kwh7 = this.verbrauch(d, b.id, 'Woche'), h7 = this.heizStunden(d, b, 'Woche'), zyk7 = b.pumpe ? this.zyklen(d, b, 'Woche') : null;
    let chart;
    if (c === 'temp') {
      if (!b.fuehler) chart = '<div class="leer">Kein Temperaturfühler zugeordnet · <button class="link" data-act="sheet" data-s="bereich">zuordnen</button></div>';
      else { const st = this.statistik('Tag');
        if (!st) chart = LAEDT;
        else { const inn = [...(st.werte[b.fuehler] || []), null], aussen = [...(st.werte[this.eid(d, d.entry, 'aussen')] || []), null];
          chart = linie(`t-${b.id}-${mitVb ? 'vb' : ''}`, [{ name: 'Innen', v: inn }, { name: 'Außen', v: aussen }], '°C', mitVb ? this.verbrauch(d, b.id, 'Tag') : null); } }
    } else if (c === 'leistung') { const kw = this.verbrauch(d, b.id, 'Tag');   // kWh je Stunde = mittlere kW
      chart = kw ? flaeche('kw-' + b.id, [{ name: b.name, farbe: BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], v: kw }], STUNDEN, 'kW', 6) + '<div class="leise">Leistung heute in kW, Stundenmittel</div>' : LAEDT;
    } else if (c === 'verbrauch') chart = kwh7 ? balken('v-' + b.id, kwh7, TAGE, 'kWh') : LAEDT;
    else if (c === 'zyklen') chart = zyk7 ? balken('z-' + b.id, zyk7, TAGE, 'Zyklen', 0) : LAEDT;
    else chart = h7 ? balken('h-' + b.id, h7, TAGE, 'h') : LAEDT;
    let kennz;
    if (b.pumpe) { this.mess = this.messung(); const pz = h7 ? h7[heuteNr] : null;
      const laengster = this.mess ? Math.max(0, ...b.geraete.flatMap(g => { const t = this.mess[g.id]; return t ? t[heuteNr].an.map(q => q[1] - q[0]) : []; })) : null;
      kennz = [['Zyklen heute', zyk7 ? zyk7[heuteNr] : '–'], ['Laufzeit', stdMin(pz)], ['Längster Lauf', zahl(laengster) ? `${Math.round(laengster)} min` : '–']];
    } else kennz = [['kWh heute', kwh7 ? de(kwh7[heuteNr]) : '–'], ['Kosten', kwh7 ? `${de(kwh7[heuteNr] * d.e.preis, 2)} €` : '–'], ['Heizzeit', h7 ? `${de(h7[heuteNr])} h` : '–']];
    b.zyklen = zyk7 ? zyk7[heuteNr] : null;
    const soll = b.soll ?? d.e.soll;
    return `<div class="zurueck-zeile"><button class="glas-panel chip" data-act="tab" data-v="uebersicht">‹ Übersicht</button>
        <button class="glas-panel chip" data-act="sheet" data-s="bereich">Bearbeiten</button></div>
      <div class="glas-panel c-held ${b.z}" style="--c:${FARBE[b.z]}">
        <div class="c-illu">${illu(b)}</div>
        <div class="c-text"><div class="glas-klein">${b.pumpe ? 'PUMPENSCHACHT' : 'CONTAINER'}</div><div class="glas-titel">${esc(b.name)}</div>
          <div class="c-wert">${wertHtml(b)}</div><div class="glas-status"><span class="glas-dot"></span>${esc(TEXT(b))}</div>
          <div class="c-kw">⚡ ${de(kwVon(b))} kW jetzt</div></div>
      </div>
      <button class="glas-panel kennz kennz-knopf" data-act="sheet" data-s="verbrauch" data-id="${b.id}">${kennz.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}<span class="kennz-mehr">Verbrauch ›</span></button>
      <div class="glas-panel block"><div class="seg">${tabs.map(([k, t]) => `<button data-act="chart" data-c="${k}" class="${k === c ? 'on' : ''}">${t}</button>`).join('')}</div>
        ${c === 'temp' && b.fuehler ? `<div class="chart-optionen"><button class="chip auto-chip ${mitVb ? 'on' : ''}" data-act="temp-vb"><span class="mini-sw"><i></i></span>Verbrauch einblenden</button></div>` : ''}
        <div class="chart-wrap">${chart}</div></div>
      ${b.bedarf ? this.bedarfBlock(b) : ''}
      ${b.pumpe || b.bedarf ? '' : `<div class="glas-panel block"><div class="block-kopf"><b>Heute</b><span class="leise">Vorheizen · Arbeitszeit · Nachheizen · Kleidung trocknen</span></div>${tl}
        <div class="regelung">${b.modus === 'thermo' ? `<b>🌡 Thermostat</b><span>regelt in der Heizzeit auf ${de(soll)} °C (jetzt ${b.t !== null ? de(b.t) + ' °C' : '–'})</span>`
          : b.modus === 'plan' ? `<b>Zeitplan</b><span>Heizung bleibt in der Heizzeit an, der Thermostat am Heizkörper regelt</span>`
          : b.modus === 'hand' ? `<b>Hand</b><span>die Automatik schaltet diesen Container nicht</span>`
          : `<b>Aus</b><span>nur Frostschutz (ein unter ${de(d.e.frost_temp)} °C, aus über ${de(d.e.frost_aus)} °C)</span>`}</div></div>`}
      <div class="glas-panel liste">
        ${b.tuer ? `<div class="zeile"><div><b>🚪 ${esc(b.tuer.sensor)}</b><div class="leise">${b.tuer.offen ? `offen seit ${b.tuer.offen} min – Heizung pausiert nach ${d.e.tuer_pause} min, Meldung nach ${d.e.tuer_melden} min` : 'zu'}</div></div><span class="tuer-z ${b.tuer.offen ? 'offen' : ''}">${b.tuer.offen ? 'offen' : 'zu'}</span></div>` : ''}
        ${b.pumpe ? '' : `<div class="zeile"><div><b>⚡ Schnell aufheizen</b><div class="leise">${b.boost ? `läuft – alle Heizkörper an, ${b.fuehler ? `bis ${de(soll)} °C` : `noch ${this.minBis(b.boostBis) ?? d.e.boost_min} min`}` : `alle Heizkörper zugleich, Vorrang in der Staffelung`}</div></div>
          <button class="chip glas-panel ${b.boost ? 'amber' : ''}" data-act="boost" data-id="${b.id}">${b.boost ? 'Beenden' : 'Start'}</button></div>`}
        ${b.pumpe ? `<div class="zeile"><span>♨ Automatik für diesen Schacht</span>${schalter(b.auto, 'b-auto')}</div>`
          : `<div class="zeile modus-z"><div><b>Modus</b><div class="leise">${MODUS_TEXT[b.modus]}</div></div>
            <div class="seg klein">${MODI.map(([k, t]) => `<button data-act="modus" data-id="${b.id}" data-v="${k}" class="${b.modus === k ? 'on' : ''}" ${k === 'thermo' && !b.fuehler ? 'disabled title="kein Temperaturfühler"' : ''}>${t}</button>`).join('')}</div></div>`}
        ${b.pumpe ? '' : `<div class="zeile"><span>👕 Kleidung trocknen nach Regen</span>${schalter(b.trocknen, 'b-trocknen')}</div>`}
      </div>
      <div class="glas-panel block"><div class="block-kopf"><b>${b.pumpe ? 'Pumpen' : 'Geräte'}</b><span class="leise">Schalten = Handbetrieb bis zum nächsten Schaltpunkt</span></div>
        ${b.geraete.length ? '' : '<div class="leise">Noch kein Gerät</div>'}
        ${b.geraete.map((g, i) => `<div class="zeile geraet"><span class="g-ic ${g.an ? 'an' : ''}">${g.typ === 'Pumpe' ? '💧' : g.typ === 'Steckdose' || g.typ === 'Bautrockner' ? '⏻' : '♨'}</span>
          <div class="g-t"><b>${esc(g.n)}</b><span class="leise">${g.typ} · ${de(g.kw, 2)} kW${g.hand ? ' · <em class="hand">Hand</em>' : ''}${g.warte ? ` · <em class="warte">wartet – ${esc((WARTE[g.warte.grund] || WARTE.anschluss_voll)(this.anschluss(b.anschluss).name))}${zahl(g.warte.dran_in_min) ? `, dran in ${g.warte.dran_in_min} min` : ''}</em>` : ''}${b.z === 'pause' && g.heizer ? ' · <em class="warte">pausiert – Tür offen</em>' : ''}</span></div>
          ${b.offline || !g.erreichbar ? '<span class="leise rot-t">offline</span>' : schalter(g.an, 'geraet', `data-i="${i}"`)}</div>`).join('')}
        <button class="zeile" data-act="sheet" data-s="bereich"><span class="blau">Geräte bearbeiten</span><span class="chev">›</span></button></div>
      ${b.pumpe ? `<div class="glas-panel liste"><div class="zeile"><span>Trockenlauf (unter ${de(d.e.trocken_w, 0)} W beim Laufen)</span><span class="ok">${d.e.m_trocken ? '● überwacht' : '○ aus'}</span></div>
        <div class="zeile"><span>Dauerlauf über ${d.e.dauer_min} min</span><span class="ok">${d.e.m_dauer ? '● überwacht' : '○ aus'}</span></div>
        <div class="zeile"><span>Stromausfall / offline (nach ${de(d.e.offline_min, 0)} min)</span><span class="ok">${d.e.m_offline ? '● überwacht' : '○ aus'}</span></div>
        <button class="zeile" data-act="tab" data-v="pumpen"><span class="blau">Schwellen im Reiter Pumpen</span><span class="chev">›</span></button></div>` : ''}`;
  }
  minBis(iso) { const ms = Date.parse(iso); return Number.isFinite(ms) ? Math.max(0, Math.round((ms - this.jetztMs()) / 60000)) : null; }
  zeitleiste(b) {
    const seg = this.heizzeiten(b, this.z.HEUTE_TAG), p = this.planTag(this.z.HEUTE_TAG);
    const gruende = p ? p.gruende.filter((_, k) => b.trocknen || !['trocknen', 'frueher_nach_regen'].includes(p.codes[k])) : [];
    return `<div class="tl">${this.zeitstrahlSeg(seg, true)}<div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div></div>
      ${p ? `<div class="leise">Arbeitszeit ${uhr(p.a)}–${uhr(p.b)}${seg.length ? ` · heizt ${uhr(seg[0][0])}–${uhr(Math.max(...seg.map(q => q[1])))}` : b.auto ? '' : ' · Automatik aus'}${gruende.length ? ' · ' + gruende.map(esc).join(' · ') : ''}</div>`
        : `<div class="leise">${this.freiText(this.z.HEUTE)}</div>`}`;
  }

  /* ---- Heizung ---- */
  stepper(k, d, fmt) { const e = this.d.e; return `<span class="stepper"><button data-act="st" data-k="${k}" data-d="${-d}">−</button><b>${fmt(e[k])}</b><button data-act="st" data-k="${k}" data-d="${d}">+</button></span>`; }
  feiertage() { const k = this._kalender(this.d.optionen.feiertag_kalender); return k === null ? null : k.filter(f => f.von > this.z.HEUTE).sort((a, b) => a.von.localeCompare(b.von)); }
  urlaube() { const k = this._kalender(this.d.optionen.urlaub_kalender); return k === null ? null : k.filter(u => u.bis >= this.z.HEUTE).sort((a, b) => a.von.localeCompare(b.von)); }
  /* ---- Heizung als Kacheln (0.7.11, Mockup heizung-varianten.html Variante A, abgenommen 30.09.2026) ----
     Große Karte „Heute“, darunter die Hauptteile als Kacheln mit Kurzwert; ein Tipp öffnet den bisherigen Block als
     Einblendung (heizungBloecke – Inhalte unverändert). */
  hzTeile() {
    const html = this.heizungBloecke(), stuecke = html.split(/(?=<div class="glas-panel block">)/), teile = {};
    for (const [k, titel] of HZ_TEILE) { const x = stuecke.find(y => y.includes(`<b>${titel}</b>`)); teile[k] = x ? x.trim() : ''; }
    return teile;
  }
  hzKurz() {
    const d = this.d, e = d.e, az = this.azJetzt, C = d.bereiche.filter(b => !b.pumpe), H = this.z.HEUTE;
    const ausn = d.ausnahmen.filter(a => a.datum >= H).sort((a, b) => a.datum.localeCompare(b.datum));
    const ft = this.feiertage(), ur = this.urlaube(), naechsterFt = ft && ft[0];
    const modi = MODI.map(([k, t]) => [t, C.filter(b => b.modus === k).length]).filter(x => x[1]);
    const woche = TAGE.map(t => { const p = this.planTag(t); return p && zahl(p.ende) && zahl(p.extra) ? Math.max(0, p.ende - p.extra) / 60 : 0; });
    const L = this.last(), zeiten = t => az && az.tage[t] ? az.tage[t].join('–') : 'frei';
    return {
      woche, plan: `${woche.filter(Boolean).length} Heiztage · ${de(summe(woche), 0)} h`,
      wann: `${L.laufen} von ${L.hk.length} Heizkörpern an`,
      az: az ? esc(az.name || 'Arbeitszeit') : 'keine Arbeitszeit', az2: az ? `Mo ${zeiten('Mo')} · Fr ${zeiten('Fr')}` : 'unter Arbeitszeit anlegen',
      ausn: ausn.length ? `${ausn.length} geplant` : 'keine', ausn2: ausn.length ? `nächste ${wtag(ausn[0].datum)} ${kurzDatum(ausn[0].datum)}` : 'Samstag, länger, frei …',
      regeln: `Soll ${de(e.soll, 1)} °C`, regeln2: `vor ${e.vorheizen} · nach ${e.nachheizen} min · Grenze ${de(e.grenze, 0)} °C · ${e.frost ? `Frost ${de(e.frost_temp, 1)}–${de(e.frost_aus, 1)} °C` : 'Frostschutz aus'}`,
      trocknen: `ab ${de(e.tr_mm, 1)} mm Regen`, trocknen2: `+${e.tr_laenger} min · früher ${e.tr_frueher} min`,
      container: `${C.length} Container`, container2: modi.map(([t, n]) => `${n} ${t}`).join(' · ') || '–',
      urlaub: ur === null ? 'Lädt …' : ur.length ? `${ur.length} Urlaub` : 'kein Urlaub', urlaub2: naechsterFt ? `Feiertag ${wtag(naechsterFt.von)} ${kurzDatum(naechsterFt.von)}` : e.feiertag_frei ? '' : 'an Feiertagen wird gearbeitet',
    };
  }
  hzHeld() {
    const d = this.d, e = d.e, H = this.z.HEUTE, p = this.planTag(this.z.HEUTE_TAG), hg = d.heizgrenze || {}, pm = d.plan[plusTage(H, 1)], L = this.last();
    const heizt = /heizt|♨/.test(this.statusText());
    const chips = [
      !e.auto ? '⏸ Automatik aus' : '',
      p ? `🕖 ${uhr(p.a)}–${uhr(p.b)}` : `🕖 ${this.freiText(H)}`,
      hg.zu_warm ? '🌡 zu warm – kein Heizen' : '',
      p && p.codes.includes('trocknen') ? `🌧 trocknen +${e.tr_laenger} min` : '',
      p && p.codes.includes('fruehstart') ? '❄ Frühstart heute' : pm && (pm.gruende || []).includes('fruehstart') ? '❄ Frühstart morgen' : '',
      e.staffel && L.warten ? `⚡ ${L.warten} wartet` : '',
      d.jetztBis ? `♨ alle heizen bis ${d.jetztBis}` : '',
    ].filter(Boolean).map(c => `<span class="hz-chip">${c}</span>`).join('');
    return `<div class="glas-panel hz-held klickbar" data-act="hz-auf" data-k="heute" role="button" tabindex="0">
      <div class="hz-held-kopf"><div><div class="glas-klein">HEUTE · ${this.z.HEUTE_TAG} ${kurzDatum(H)}</div><div class="hz-status ${heizt ? 'an' : ''}">${esc(this.statusText())}</div></div><span class="chev">›</span></div>
      <div class="tl">${this.zeitstrahl(p, true)}<div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div></div>
      ${chips ? `<div class="hz-chips">${chips}</div>` : ''}</div>`;
  }
  v_heizung() {
    const d = this.d, k = this.hzKurz(), heuteNr = TAGE.indexOf(this.z.HEUTE_TAG), max = Math.max(1, ...k.woche);
    const kachel = (id, sym, titel, wert, unter, extra = '') => `<button class="glas-panel hz-kachel" data-act="hz-auf" data-k="${id}">
      <span class="hz-k-kopf"><span class="hz-sym">${sym}</span><span class="chev">›</span></span>
      <span class="hz-k-titel">${titel}</span><b class="hz-k-wert">${wert}</b>${extra}<span class="leise hz-k-unter">${unter || ''}</span></button>`;
    const mini = `<span class="hz-mini">${k.woche.map((h, i) => `<i style="height:${Math.max(3, h / max * 100)}%" class="${i === heuteNr ? 'heute' : ''}"></i>`).join('')}</span>`;
    return `${this.kopf('Heizung', esc(d.titel), `<div>${schalter(d.e.auto, 'auto')}</div>`)}${this.hzHeld()}
      <div class="hz-raster">
        ${kachel('plan', '📅', 'Diese Woche', k.plan, 'Heizplan aus Arbeitszeit und Wetter', mini)}
        ${kachel('wann', '🔥', 'Wann heizt was', k.wann, 'gemessen je Heizkörper')}
        ${kachel('container', '🏠', 'Container', k.container, k.container2)}
        ${kachel('az', '👷', 'Arbeitszeit', k.az, k.az2)}
        ${kachel('ausn', '✳️', 'Ausnahmen', k.ausn, k.ausn2)}
        ${kachel('regeln', '⚙️', 'Regeln', k.regeln, k.regeln2)}
        ${kachel('trocknen', '👕', 'Kleidung trocknen', k.trocknen, k.trocknen2)}
        ${kachel('urlaub', '🏖', 'Urlaub & Feiertage', k.urlaub, k.urlaub2)}
      </div>`;
  }
  heizungBloecke() {
    const d = this.d, e = d.e, st = (k, s, fmt) => this.stepper(k, s, fmt);
    const grad = v => `${de(v, 1)} °C`, min = v => `${v} min`, mm = v => `${de(v, 1)} mm`;
    const p = this.planTag(this.z.HEUTE_TAG), az = this.azJetzt, hg = d.heizgrenze || {}, w = d.wetter || {};
    const bezug = zahl(hg.bezug) ? hg.bezug : e.basis === 'jetzt' ? w.aussen : w.aussen_max;
    const ft = this.feiertage(), naechster = ft && ft[0];
    const morgen = plusTage(this.z.HEUTE, 1), wm = this.wetterTag(morgen), pm = this.d.plan[morgen];
    const regel = (ic, titel, text, an) => `<div class="hr-zeile ${an ? 'an' : ''}"><span class="hr-ic">${ic}</span><div><b>${titel}</b><div class="leise">${text}</div></div><span class="hr-an">${an ? '●' : '○'}</span></div>`;
    const C = d.bereiche.filter(b => !b.pumpe), ur = this.urlaube();
    const freiT = e.urlaub === 'absenk' ? `heute abgesenkt auf ${de(e.absenk)} °C (mit Fühler), sonst Frostschutz` : e.urlaub === 'aus' ? 'heute alles aus – auch kein Frostschutz' : 'heute nur Frostschutz';
    const frei = { urlaub: ['Urlaub', freiT], feiertag: ['Feiertag', freiT] }[d.status];
    const urlaubsKal = d.optionen.urlaub_kalender, feiertagsKal = d.optionen.feiertag_kalender;
    return `${this.kopf('Heizung', esc(d.titel), `<div>${schalter(e.auto, 'auto')}</div>`)}
      <div class="glas-panel block"><div class="block-kopf"><b>Heute</b><span class="leise">welche Regeln greifen</span></div>
        ${regel('🕖', `Arbeitszeit ${p ? `${uhr(p.a)}–${uhr(p.b)}` : 'frei'}`, `${az ? `„${esc(az.name)}“` : 'keine Arbeitszeit'} · heizt ${p ? `${uhr(p.extra)}–${uhr(p.ende)}` : 'nicht'}`, !!p)}
        ${regel('🌡', `Heizgrenze ${de(e.grenze, 0)} °C`, zahl(bezug) ? `${e.basis === 'jetzt' ? 'jetzt' : 'Höchstwert heute'} ${de(bezug, 0)} °C → ${hg.zu_warm ?? bezug > e.grenze ? 'zu warm, es wird nicht geheizt' : 'es wird geheizt'}` : 'kein Wert vom Wetter', !(hg.zu_warm ?? (zahl(bezug) && bezug > e.grenze)))}
        ${regel('🌧', 'Kleidung trocknen', zahl(w.regen_heute) ? `${de(w.regen_heute, w.regen_heute % 1 ? 1 : 0)} mm Regen seit gestern (ab ${de(e.tr_mm)} mm) → ${w.regen_heute >= e.tr_mm ? `${e.tr_laenger} min länger, bis ${p ? uhr(p.ende) : '–'}` : 'nicht nötig'}` : 'kein Regenwert vom Wetter', zahl(w.regen_heute) && w.regen_heute >= e.tr_mm)}
        ${regel('❄', 'Kälte-Frühstart morgen', zahl(wm.kalt) ? `${de(wm.kalt).replace('-', '−')} °C erwartet (unter ${de(e.frueh_temp, 0).replace('-', '−')} °C) → ${wm.kalt < e.frueh_temp ? `${e.frueh_min} min früher` : 'nicht nötig'}${pm && (pm.gruende || []).includes('frueher_nach_regen') ? `, dazu ${e.tr_frueher} min nach Regen` : ''}` : 'noch keine Vorhersage für morgen', e.fruehstart && zahl(wm.kalt) && wm.kalt < e.frueh_temp)}
        ${e.staffel ? (() => { const L = this.last(); return regel('⚡', `Staffelung: ${L.laufen} von ${L.hk.length} Heizkörpern`, `${L.warten ? `${L.warten} wartet, weil ein Anschluss ausgelastet ist` : 'alle haben Platz'} · höchstens ${e.max_gleich} gleichzeitig · Vorheizen startet 15 min früher, damit alle warm werden`, true); })() : ''}
        ${frei ? regel('🏖', frei[0], frei[1], true) : regel('🏖', 'Kein Urlaub, kein Feiertag', naechster ? `nächster Feiertag ${wtag(naechster.von)} ${kurzDatum(naechster.von)} ${esc(naechster.name)}` : feiertagsKal ? (ft === null ? 'Feiertage laden …' : 'kein Feiertag im Kalender') : 'kein Feiertagskalender gewählt', false)}</div>
      ${this.uebersichtHeizzeiten()}
      <div class="glas-panel block"><div class="block-kopf"><b>Heizplan · diese Woche</b><span class="leise">aus Arbeitszeit und Wetter</span></div>${this.heizplanInhalt()}</div>
      ${this.azBlock()}
      ${this.ausnahmenBlock()}
      <div class="glas-panel block"><div class="block-kopf"><b>So wird geheizt</b><span class="leise">in der Arbeitszeit immer</span></div>
        <div class="zeile"><div><b>Vorheizen</b><div class="leise">vor Arbeitsbeginn, damit es warm ist</div></div>${st('vorheizen', 5, min)}</div>
        <div class="zeile"><div><b>Nachheizen</b><div class="leise">nach Arbeitsende, jeden Tag</div></div>${st('nachheizen', 5, min)}</div>
        <div class="zeile"><div><b>⚡ Schnell aufheizen</b><div class="leise">alle Heizkörper eines Containers zugleich, Vorrang in der Staffelung – bis zum Soll, ohne Fühler für</div></div>${st('boost_min', 5, min)}</div>
        <div class="zeile"><div><b>🚪 Tür offen</b><div class="leise">Heizung pausieren nach</div></div>${st('tuer_pause', 1, min)}</div>
        <div class="zeile unter"><span>Nachricht nach</span>${st('tuer_melden', 5, min)}</div>
        <div class="zeile"><div><b>🌡 Solltemperatur</b><div class="leise">für Container mit Fühler; ohne Fühler regelt der Heizkörperthermostat</div></div>${st('soll', .5, grad)}</div>
        <div class="zeile"><div><b>Heizgrenze</b><div class="leise">nicht heizen, wenn es wärmer ist</div></div>${st('grenze', .5, grad)}</div>
        <div class="zeile"><span>Grundlage</span><div class="seg klein">${['jetzt', 'Tageshöchstwert'].map(v => `<button data-act="basis" data-v="${v}" class="${e.basis === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="zeile"><div><b>Kälte-Frühstart</b><div class="leise">unter ${de(e.frueh_temp, 0).replace('-', '−')} °C zusätzlich früher</div></div>${schalter(e.fruehstart, 'e-bool', 'data-k="fruehstart"')}</div>
        ${e.fruehstart ? `<div class="zeile unter"><span>wenn morgens kälter als</span>${st('frueh_temp', 1, v => `${de(v, 0).replace('-', '−')} °C`)}</div>
        <div class="zeile unter"><span>so viel früher</span>${st('frueh_min', 5, min)}</div>` : ''}
        <div class="zeile"><div><b>Frostschutz</b><div class="leise">hält jeden Container über der Grenze, auch außerhalb der Arbeitszeit</div></div>${schalter(e.frost, 'e-bool', 'data-k="frost"')}</div>
        ${e.frost ? `<div class="zeile unter"><span>ein unter</span>${st('frost_temp', .5, grad)}</div>
        <div class="zeile unter"><span>aus über</span>${st('frost_aus', .5, grad)}</div>
        <div class="zeile unter"><div><span>auch bei Automatik aus</span><div class="leise">schaltet dann nur den Frostschutz, sonst nichts</div></div>${schalter(e.frost_immer, 'e-bool', 'data-k="frost_immer"')}</div>` : ''}
        ${erkl(e.erklaer, 'Vorheizen und Nachheizen gelten jeden Arbeitstag. Die Heizgrenze verhindert Heizen an warmen Tagen. Der Frostschutz springt unter „ein“ an und hört erst über „aus“ wieder auf, damit der Heizkörper nicht dauernd ein- und ausschaltet. Ohne Fühler kennt die Integration keine Innentemperatur – der Frostschutz braucht einen Fühler.')}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>👕 Kleidung trocknen</b><span class="leise">nach Regen zusätzlich zum Nachheizen</span></div>
        <div class="zeile"><span>ab Regen (seit gestern)</span>${st('tr_mm', .5, mm)}</div>
        <div class="zeile"><span>zusätzlich nach dem Nachheizen</span>${st('tr_laenger', 5, min)}</div>
        <div class="zeile"><span>am nächsten Morgen früher</span>${st('tr_frueher', 5, min)}</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Je Container</b><span class="leise">Modus · Trocknen · Soll</span></div>
        ${C.map(b => { const soll = b.soll ?? e.soll;
          return `<div class="jc"><div class="jc-name"><b>${esc(b.name)}</b><span class="leise">${b.offline ? 'offline' : b.t !== null ? `🌡 ${de(b.t)} °C` : 'ohne Fühler'}</span></div>
            <div class="jc-ctrl"><select class="jc-modus" data-jm="${b.id}" title="Modus" aria-label="Modus ${esc(b.name)}">${MODI.map(([k, t]) => `<option value="${k}" ${b.modus === k ? 'selected' : ''} ${k === 'thermo' && !b.fuehler ? 'disabled' : ''}>${t}</option>`).join('')}</select>
              <span class="jc-l">👕</span>${schalter(b.trocknen, 'tr-b', `data-id="${b.id}"`).replace('class="sw', 'class="sw klein')}
              ${b.fuehler ? `<span class="stepper klein"><button data-act="jc-soll" data-id="${b.id}" data-d="-0.5">−</button><b class="${b.soll !== undefined ? 'eigen' : ''}">${de(soll)}°</b><button data-act="jc-soll" data-id="${b.id}" data-d="0.5">+</button></span>`
                : '<span class="leise jc-th">Thermostat</span>'}</div></div>`; }).join('')}
        <div class="leise">Ein eigener Sollwert (bernstein) gilt nur für diesen Container, sonst gilt ${de(e.soll)} °C.</div>
        ${erkl(e.erklaer, 'Zeitplan: an in der Heizzeit, der Heizkörper regelt selbst. Thermostat: in der Heizzeit nach dem Fühler auf das Soll (nur mit Fühler). Bei Bedarf: nur per Schalter oder Termin. Hand: die Automatik schaltet nicht. Aus: nur Frostschutz.')}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>Urlaub &amp; Feiertage</b></div>
        <div class="zeile"><div><b>An Feiertagen frei</b><div class="leise">${feiertagsKal ? `Feiertage aus dem Kalender „${esc(this.name(feiertagsKal))}“` : 'noch kein Feiertagskalender gewählt'}</div></div>${schalter(e.feiertag_frei, 'e-bool', 'data-k="feiertag_frei"')}</div>
        <div class="zeile modus-z"><div><b>Im Urlaub und an freien Feiertagen</b><div class="leise">${{ frost: 'nur Frostschutz', absenk: `mit Fühler auf ${de(e.absenk)} °C halten, ohne Fühler nur Frostschutz`, aus: 'alles aus – auch kein Frostschutz. Nur, wenn nichts einfrieren kann.' }[e.urlaub]}</div></div>
          <div class="seg klein">${[['frost', 'nur Frostschutz'], ['absenk', 'absenken'], ['aus', 'alles aus']].map(([k, t]) => `<button data-act="e-wert" data-k="urlaub" data-v="${k}" class="${e.urlaub === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        ${e.urlaub === 'absenk' ? `<div class="zeile unter"><span>absenken auf</span>${st('absenk', .5, grad)}</div>` : ''}
        ${ft === null ? '<div class="leise">Lädt …</div>' : ft.slice(0, 4).map(f => { const t = wtag(f.von), we = t === 'Sa' || t === 'So';
          return `<div class="zeile unter"><span><b class="ft-d">${t} ${kurzDatum(f.von)}</b> ${esc(f.name)}</span><span class="leise">${we ? 'Wochenende' : 'frei'}</span></div>`; }).join('')}
        <div class="gruppe-t">Urlaub · ${urlaubsKal ? `Kalender „${esc(this.name(urlaubsKal))}“` : 'kein Kalender gewählt'}</div>
        ${ur === null ? '<div class="leise">Lädt …</div>' : ur.map((u, i) => `<div class="zeile unter"><span><b>${esc(u.name)}</b> <span class="leise">${kurzDatum(u.von)} – ${datum(u.bis)}</span></span><button class="x" data-act="urlaub-weg" data-i="${i}" title="Urlaub löschen">✕</button></div>`).join('') || '<div class="leise">Kein Urlaub eingetragen</div>'}
        <button class="zeile" data-act="sheet" data-s="${urlaubsKal ? 'urlaub' : 'wetterquelle'}"><span class="blau">${urlaubsKal ? '+ Urlaub eintragen' : 'Kalender für Urlaub wählen'}</span></button></div>`;
  }
  ausnahmenBlock() {
    const L = this.d.ausnahmen.filter(a => a.datum >= this.z.HEUTE).sort((a, b) => a.datum.localeCompare(b.datum));
    return `<div class="glas-panel block"><div class="block-kopf"><b>Ausnahmen</b><span class="leise">einmalig – die Arbeitszeit bleibt, wie sie ist</span></div>
      <div class="bedarf-dauer">${[['heute-laenger', '+ Heute länger'], ['morgen-spaeter', '+ Morgen später'], ['samstag', '+ Samstag arbeiten'], ['frei', '+ Freier Tag']].map(([k, t]) => `<button class="chip glas-panel" data-act="ausn-neu" data-v="${k}">${t}</button>`).join('')}</div>
      ${L.length ? L.map(a => `<div class="zeile ereignis"><span class="zeit t-wann">${wtag(a.datum)} ${kurzDatum(a.datum)}</span>
          <div><b>${a.art === 'frei' ? 'frei' : `${a.von}–${a.bis}`}</b> <span class="badge ${a.art === 'frei' ? '' : 'blau-b'}">${AUSNAHME[a.art]}</span>${a.notiz ? `<div class="leise">${esc(a.notiz)}</div>` : ''}</div>
          <button class="x" data-act="ausn-weg" data-d="${a.datum}" title="Ausnahme löschen">✕</button></div>`).join('') : '<div class="leise">Keine Ausnahmen</div>'}
      <button class="zeile" data-act="ausn-neu" data-v=""><span class="blau">+ Ausnahme für einen anderen Tag</span></button></div>`;
  }
  azBlock() {
    const L = this.azListe, jetzt = this.azJetzt;
    if (!jetzt) return `<div class="glas-panel block"><div class="block-kopf"><b>Arbeitszeit</b></div><div class="leise">Noch keine Arbeitszeit – ohne Arbeitszeit läuft nur der Frostschutz.</div>
      <button class="zeile" data-act="az-neu"><span class="blau">+ Neue Arbeitszeit ab …</span></button></div>`;
    const geplant = L.filter(a => a.ab > this.z.HEUTE), frueher = L.filter(a => a.ab < jetzt.ab).reverse();
    const idx = a => this.d.arbeitszeiten.indexOf(a);
    return `<div class="glas-panel block"><div class="block-kopf"><b>Arbeitszeit</b><span class="badge gruen">${jetzt.ab <= this.z.HEUTE ? 'gilt seit' : 'gilt ab'} ${datum(jetzt.ab)}</span></div>
      <div class="az-name">${esc(jetzt.name)}</div>
      ${jetzt.auto ? '<div class="leise">Automatisch angelegt – wird ersetzt, sobald du eine eigene Arbeitszeit speicherst (auch mit früherem Datum).</div>' : ''}
      <button class="zeile" data-act="sheet" data-s="az" data-i="${idx(jetzt)}"><span class="blau">Bearbeiten oder löschen</span><span class="chev">›</span></button>
      ${TAGE.map(t => { const z = jetzt.tage[t]; return `<div class="zeile az ${t === this.z.HEUTE_TAG ? 'heute' : ''}"><b class="tag-n">${t}</b>
        <span class="fenster">${z ? `<em>${z[0]}–${z[1]}</em>` : '<span class="leise">frei</span>'}</span><span class="leise">${z ? dauer(z[0], z[1]) : ''}</span></div>`; }).join('')}
      ${geplant.filter(a => a !== jetzt).map(a => `<button class="zeile" data-act="sheet" data-s="az" data-i="${idx(a)}"><span><span class="badge blau-b">geplant</span> ab ${datum(a.ab)} · ${esc(a.name)}</span><span class="chev">›</span></button>`).join('')}
      ${frueher.length ? `<button class="zeile" data-act="az-alt"><span>Frühere Arbeitszeiten (${frueher.length})</span><span class="chev">${this.s.azAlt ? '⌄' : '›'}</span></button>` : ''}
      ${this.s.azAlt ? frueher.map(a => `<button class="zeile unter" data-act="sheet" data-s="az" data-i="${idx(a)}"><span>${datum(a.ab)} · ${esc(a.name)}</span><span class="leise">${a.tage.Mo ? a.tage.Mo.join('–') : ''} ›</span></button>`).join('') : ''}
      <button class="zeile" data-act="az-neu"><span class="blau">+ Neue Arbeitszeit ab …</span></button></div>`;
  }

  /* ---- Auswertung ---- */
  v_auswertung() {
    const d = this.d, aw = this.s.aw ||= { zeitraum: 'Monat', auswahl: d.bereiche.map(b => b.id) }, z = aw.zeitraum;
    const alle = this.s.awScope === 'alle';
    // Kennzahlen, Vergleich zum Zeitraum davor, Ohne Automatik, Wetter, Ölradiator/Konvektor, Je Gerät: von der Integration (api §8)
    const A = this.awDaten(z), S = (A && A.summen) || {}, vd = k => (S.veraenderung || {})[k] ?? null, oa = S.ohne_automatik || null;
    const kwh = A ? S.kwh : null, hz = A ? S.heizzeit : null, pz = A ? S.pumpzeit : null, ohne = A ? S.ohne : null;
    const vgl = { Tag: 'gestern', Woche: 'Vorwoche', Monat: 'Vormonat', Jahr: String(this.zeitraum('Jahr', 1).jahr) }[z];
    const kz = (wert, text, dl) => `<div><b>${wert}</b><span>${text}</span>${dl !== null ? `<em class="${dl > 0 ? 'mehr' : 'weniger'}">${dl > 0 ? '▲' : '▼'} ${Math.abs(dl)} %</em>` : ''}</div>`;
    // Wetter-Einfluss: letzte 30 Heiztage, kWh je Tag gegen Tagesmittel außen, mit Gerade der Integration
    const W = A ? A.wetter || {} : null, pkt = W && (W.punkte || []), gerade = W && W.gerade;
    let streuHtml;
    if (!W) streuHtml = LAEDT;
    else if (!gerade) streuHtml = '<div class="leer">Noch zu wenige Heiztage für einen Vergleich</div>';
    else {
      const { k, d0, null0, eur_je_grad } = gerade;
      streuHtml = `<div class="chart-wrap">${streu('streu', pkt, k, d0)}</div>
        <div class="hinweis-k">${k < 0 ? `Je Grad kälter <b>≈ +${de(-k, 1)} kWh</b> am Tag (${de(eur_je_grad, 2)} €).${zahl(null0) ? ` Ab etwa <b>${de(null0, 0)} °C</b> wird kaum mehr geheizt – ` : ' '}` : 'Noch kein klarer Zusammenhang mit der Außentemperatur. '}die Heizgrenze steht auf ${de(d.e.grenze, 0)} °C.</div>`;
    }
    const T = ['oelradiator', 'konvektor'].map(t => { const x = (A && A.typ && A.typ[t]) || {}; return { kwhH: x.kwh_h ?? null, auf: x.auf ?? null, ab: x.ab ?? null, tag: x.tag ?? null }; });
    const f = (v, fn) => zahl(v) ? fn(v) : '–';
    // wie Mockup: fett ist der Nachteil (mehr kWh, langsamer aufheizen, schneller abkühlen); Kosten ohne Hervorhebung
    const nachteil = (i, hoch) => { const a = T[0][i], b = T[1][i]; if (hoch === null || !zahl(a) || !zahl(b) || a === b) return [false, false]; return hoch ? [a > b, b > a] : [a < b, b < a]; };
    const zeile = (titel, i, hoch, fn) => { const [x, y] = nachteil(i, hoch); return `<tr><td>${titel}</td><td>${x ? '<b>' : ''}${f(T[0][i], fn)}${x ? '</b>' : ''}</td><td>${y ? '<b>' : ''}${f(T[1][i], fn)}${y ? '</b>' : ''}</td></tr>`; };
    const weniger = (A && A.typ && A.typ.weniger) ?? null;
    const cmp = i => zahl(T[0][i]) && zahl(T[1][i]) && T[0][i] !== T[1][i] ? Math.sign(T[0][i] - T[1][i]) : 0;
    // Fußsatz aus den Messwerten, gebaut wie im Mockup („braucht länger, hält die Wärme aber besser und verbraucht rund 16 % weniger“)
    const auf = cmp('auf') < 0 ? 'braucht länger' : cmp('auf') > 0 ? 'heizt schneller auf' : '';
    const ab = cmp('ab') < 0 ? `hält die Wärme ${auf === 'braucht länger' ? 'aber ' : ''}besser` : cmp('ab') > 0 ? 'kühlt schneller ab' : '';
    const vb = weniger > 0 ? `verbraucht rund ${weniger} % weniger` : weniger < 0 ? `verbraucht rund ${-weniger} % mehr` : '';
    const teile = [auf, ab, vb].filter(Boolean), fussSatz = teile.length ? `Der Ölradiator ${teile.length > 1 ? `${teile.slice(0, -1).join(', ')} und ${teile.at(-1)}` : teile[0]}.` : 'Noch zu wenige Messungen für einen Vergleich.';
    return `${this.kopf('Auswertung', alle ? 'ALLE LAUFENDEN BAUSTELLEN' : esc(d.titel), `<button class="glas-panel chip" data-act="csv">⇩ CSV</button>`)}
      <div class="seg glas-panel">${[['diese', 'Diese Baustelle'], ['alle', `Alle laufenden (${this.laufende().length})`]].map(([k, t]) => `<button data-act="aw-scope" data-v="${k}" class="${(this.s.awScope || 'diese') === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="glas-panel kennz vier">${kz(zahl(kwh) ? de(kwh, 0) : '–', 'kWh', vd('kwh'))}${kz(zahl(kwh) ? `${de(S.eur, 0)} €` : '–', 'Kosten', vd('kwh'))}${kz(zahl(hz) ? `${de(hz, 0)} h` : '–', 'Heizzeit', vd('heizzeit'))}${kz(zahl(pz) ? `${de(pz, 1)} h` : '–', 'Pumpzeit', vd('pumpzeit'))}</div>
      <div class="leise vgl">Pfeile: im Vergleich zu ${vgl}</div>
      <div class="glas-panel block">${this.verbrauchInhalt(aw, 'aw', false)}</div>
      ${alle ? '' : this.leistungHeute()}
      ${alle ? '' : this.temperaturen()}
      ${this.abrechnung(z)}
      ${alle ? '' : this.geraeteBlock(z, A)}
      <div class="glas-panel block"><div class="block-kopf"><b>Wetter-Einfluss</b><span class="leise">letzte 30 Heiztage · kWh je Tag gegen Außentemperatur</span></div>
        ${streuHtml}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>Ohne Automatik</b><span class="leise">wenn alles rund um die Uhr liefe</span></div>
        ${!zahl(ohne) || !zahl(kwh) ? (ohne === null || kwh === null ? LAEDT : '<div class="leer">Noch keine Werte</div>') : !oa ? '<div class="leer">Noch keine Werte</div>' : `
        <div class="hbar"><span class="hb-n">mit Automatik</span><span class="hb-spur"><i style="width:${Math.min(100, kwh / ohne * 100)}%;background:var(--s1)"></i></span><span class="hb-w">${de(S.eur, 0)} €</span></div>
        <div class="hbar"><span class="hb-n">ohne (24/7)</span><span class="hb-spur"><i style="width:100%;background:var(--s2)"></i></span><span class="hb-w">${de(oa.ohne_eur, 0)} €</span></div>
        <div class="gespart">gespart <b>${de(oa.gespart_eur, 2)} €</b> · ${de(oa.prozent, 0)} %</div>`}
        ${erkl(d.e.erklaer, '„Ohne Automatik“ rechnet mit der gemessenen Leistung je Heizkörper, als liefe er rund um die Uhr – so, wie es ohne Steuerung oft ist.')}</div>
      ${alle ? '' : this.hochrechnung(A)}
      <div class="glas-panel block"><div class="block-kopf"><b>Ölradiator oder Konvektor</b><span class="leise">nur zum Vergleich · aus eigenen Messungen</span></div>
        <table class="vergleich"><tr><th></th><th>Ölradiator</th><th>Konvektor</th></tr>
          ${zeile('kWh je Heizstunde', 'kwhH', true, v => de(v, 2))}
          ${zeile('Aufheizen', 'auf', false, v => `${de(v, 1)} °C/h`)}
          ${zeile('Abkühlen nach Aus', 'ab', true, v => `${de(v, 1)} °C/h`)}
          ${zeile('Kosten je Tag', 'tag', null, v => `${de(v, 2)} €`)}</table>
        <div class="leise fuss">${fussSatz}</div></div>`;
  }

  /* ---- Pumpen (0.7.8, wie 0.6.3 eigener Reiter) ---- */
  v_pumpen() {
    const d = this.d, e = d.e, P = d.bereiche.filter(b => b.pumpe), pc = this.s.pchart || 'pumpzeit', st = (k, s, fmt) => this.stepper(k, s, fmt);
    const heuteNr = TAGE.indexOf(this.z.HEUTE_TAG), pumpen = P.flatMap(b => b.geraete.filter(g => g.rolle === 'pumpe'));
    const W = d.warnungen.filter(w => !w.stumm && P.some(b => b.id === w.b));
    const je = P.map(b => ({ b, h7: this.heizStunden(d, b, 'Woche'), z7: this.zyklen(d, b, 'Woche'), v7: this.verbrauch(d, b.id, 'Woche') }));
    const zyk = je.every(x => x.z7) ? summe(je.map(x => x.z7[heuteNr] || 0)) : null, lauf = je.every(x => x.h7) ? summe(je.map(x => x.h7[heuteNr] || 0)) : null;
    return `${this.kopf('Pumpen', esc(d.titel))}
      <div class="glas-panel kennz">${[['Zyklen heute', zahl(zyk) ? zyk : '–'], ['Laufzeit heute', stdMin(lauf)], ['Pumpen an', `${pumpen.filter(g => g.an).length} von ${pumpen.length}`]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
      ${W.map(w => `<button class="glas-panel warn-zeile ${w.stufe}" data-act="w-hin" data-id="${esc(w.b)}"><b>⚠ ${esc(this.bName(w.b))}: ${esc(w.titel)}</b><span class="leise">${esc(this.seitText(w.seitIso))}${w.hilfe ? ` · ${esc(w.hilfe)}` : ''}</span></button>`).join('')}
      ${je.map(({ b, h7, z7, v7 }) => { const r = pc === 'zyklen' ? z7 : pc === 'verbrauch' ? v7 : h7;
        return `<div class="glas-panel block"><div class="block-kopf"><b>${esc(b.name)}</b><button class="chip glas-panel" data-act="container" data-id="${b.id}">öffnen ›</button></div>
        <div class="p-schacht"><div class="p-illu">${illu(b)}</div><div>${b.geraete.map(g => `<div class="zeile geraet"><span class="g-ic ${g.an ? 'an' : ''}">💧</span><div class="g-t"><b>${esc(g.n)}</b><span class="leise">${!g.erreichbar ? 'offline' : g.an ? `läuft${zahl(g.kwJetzt) ? ` · ${de(g.kwJetzt, 2)} kW` : ''}` : 'aus'}</span></div></div>`).join('') || '<div class="leise">Noch keine Pumpe</div>'}
          <div class="leise">heute ${z7 ? z7[heuteNr] : '–'} Zyklen · ${stdMin(h7 ? h7[heuteNr] : null)} gelaufen</div></div></div>
        <div class="seg">${[['pumpzeit', 'Pumpzeit'], ['zyklen', 'Zyklen'], ['verbrauch', 'Verbrauch']].map(([k, t]) => `<button data-act="p-chart" data-v="${k}" class="${k === pc ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="chart-wrap">${r ? balken(`p${pc}-${b.id}`, r, TAGE, pc === 'zyklen' ? 'Zyklen' : pc === 'verbrauch' ? 'kWh' : 'h', pc === 'zyklen' ? 0 : 1) : LAEDT}</div></div>`; }).join('')}
      <div class="glas-panel block"><div class="block-kopf"><b>Überwachung</b><span class="leise">wann eine Pumpe gemeldet wird</span></div>
        <div class="zeile"><div><b>Offline</b><div class="leise">Shelly antwortet nicht (Stromausfall?) – melden nach</div></div>${st('offline_min', 1, v => `${de(v, 0)} min`)}</div>
        <div class="zeile"><div><b>Trockenlauf</b><div class="leise">Pumpe läuft, zieht aber weniger als</div></div>${st('trocken_w', 5, v => `${de(v, 0)} W`)}</div>
        <div class="zeile"><div><b>Dauerlauf</b><div class="leise">läuft ohne Pause länger als</div></div>${st('dauer_min', 5, v => `${v} min`)}</div>
        <div class="zeile"><div><b>Schaltet oft</b><div class="leise">mehr Zyklen je Stunde als</div></div>${st('zyklen_h', 1, v => `${v}`)}</div>
        <button class="zeile" data-act="tab-einst"><span class="blau">Welche Meldungen aufs Handy gehen</span><span class="chev">Einstellungen ›</span></button>
        ${erkl(e.erklaer, 'Pumpen werden nie geschaltet, nur überwacht. Ein Zyklus ist einmal an und wieder aus. Viele Zyklen je Stunde deuten auf einen hängenden Schwimmer oder steigendes Grundwasser, Trockenlauf auf einen leeren Schacht oder eine verstopfte Pumpe.')}</div>`;
  }
  /* ---- Auswertung: Leistung heute, Temperaturen, je Gerät, Hochrechnung (0.7.8) ---- */
  leistungHeute() {
    const d = this.d, Q = d.bereiche.map(b => ({ name: b.name, farbe: BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], v: this.verbrauch(d, b.id, 'Tag') }));
    return `<div class="glas-panel block"><div class="block-kopf"><b>Leistung heute</b><span class="leise">kW je Stunde (Mittel)</span></div>
      <div class="chart-wrap">${Q.some(q => !q.v) ? LAEDT : Q.length ? flaeche('kw-heute', Q, STUNDEN, 'kW', 6) : '<div class="leer">Noch keine Container</div>'}</div>
      <div class="leise">gestapelt nach Container – oben die ganze Baustelle</div></div>`;
  }
  /* Tagesmittel der Fühler und außen, letzte n Tage */
  tempTage(n) {
    const d = this.d, ids = [...new Set([...d.bereiche.filter(b => b.fuehler).map(b => b.fuehler), this.eid(d, d.entry, 'aussen')].filter(Boolean))].sort();
    const bis = plusTage(d.z.HEUTE, 1), von = plusTage(bis, -n), tage = [...Array(n)].map((_, k) => plusTage(von, k));
    if (!ids.length) return { tage, werte: {} };
    const roh = this._holen(`t:${d.entry}:${n}:${d.z.HEUTE}`, () => this._hass.callWS({ type: 'recorder/statistics_during_period',
      start_time: new Date(this.zoneMs(von, '00:00', d.z.zone)).toISOString(), end_time: new Date(this.zoneMs(bis, '00:00', d.z.zone)).toISOString(),
      statistic_ids: ids, period: 'day', types: ['mean'], units: {} }));
    if (roh === undefined) return null;
    const werte = {};
    for (const id of ids) { const arr = Array(n).fill(null);
      for (const p of (roh || {})[id] || []) { const ms = typeof p.start === 'number' ? (p.start < 1e11 ? p.start * 1000 : p.start) : Date.parse(p.start), i = tage.indexOf(this.lokal(ms, d.z.zone).slice(0, 10)); if (i >= 0 && zahl(p.mean)) arr[i] = Number(p.mean); }
      werte[id] = arr; }
    return { tage, werte };
  }
  temperaturen() {
    const d = this.d, tv = this.s.tv || 'heute', C = d.bereiche.filter(b => !b.pumpe && b.fuehler), aid = this.eid(d, d.entry, 'aussen');
    const farbe = b => BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], aussen = { name: 'Außen', farbe: 'var(--ink2)', aussen: true };
    let inhalt;
    if (tv === 'heute') { const st = this.statistik('Tag');
      inhalt = !st ? LAEDT : linien('tp-heute', [...C.map(b => ({ name: b.name, farbe: farbe(b), v: [...(st.werte[b.fuehler] || []), null] })), ...(aid ? [{ ...aussen, v: [...(st.werte[aid] || []), null] }] : [])],
        [...STUNDEN, '24'], 6, i => `${String(i).padStart(2, '0')}:00`);
    } else { const n = tv === '7' ? 7 : 30, t = this.tempTage(n);
      inhalt = !t ? LAEDT : linien(`tp-${n}`, [...C.map(b => ({ name: b.name, farbe: farbe(b), v: t.werte[b.fuehler] || Array(n).fill(null) })), ...(aid ? [{ ...aussen, v: t.werte[aid] || Array(n).fill(null) }] : [])],
        t.tage.map(kurzDatum), n === 7 ? 1 : 5, i => `${wtag(t.tage[i])} ${kurzDatum(t.tage[i])} · Tagesmittel`); }
    return `<div class="glas-panel block"><div class="block-kopf"><b>Temperaturen</b><span class="leise">alle Container mit Fühler</span></div>
      <div class="seg">${[['heute', 'Heute'], ['7', '7 Tage'], ['30', '30 Tage']].map(([k, t]) => `<button data-act="tv" data-v="${k}" class="${tv === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="chart-wrap">${C.length ? inhalt : '<div class="leer">Kein Container mit Temperaturfühler</div>'}</div>
      <div class="leise">${tv === 'heute' ? 'Stundenmittel, gestrichelt außen.' : 'Tagesmittel je Container, gestrichelt außen.'}${d.bereiche.some(b => !b.pumpe && !b.fuehler) ? ' Container ohne Fühler fehlen.' : ''}</div></div>`;
  }
  /* Je Gerät: Ø kW im Betrieb (Zähler mittel:<gid>), kWh aus dem Zählerstand des Shelly, Stunden ≈ kWh ÷ Ø kW (Pumpen: Pumpzeit) – rechnet die Integration */
  geraeteBlock(z, A) {
    const d = this.d;
    if (!A) return `<div class="glas-panel block"><div class="block-kopf"><b>Je Gerät</b></div>${LAEDT}</div>`;
    const zeilen = (A.je_geraet || []).map(r => { const b = d.bereiche.find(x => x.id === r.bereich), g = b && b.geraete.find(x => x.id === r.geraet); return g ? { ...r, b, g } : null; }).filter(Boolean);
    const f = (v, k) => zahl(v) ? de(v, k) : '–';
    return `<div class="glas-panel block"><div class="block-kopf"><b>Je Gerät</b><span class="leise">${{ Tag: 'heute', Woche: 'diese Woche', Monat: 'dieser Monat', Jahr: 'dieses Jahr' }[z]}</span></div>
      ${zeilen.length ? `<div class="tab-scroll"><table class="vergleich je-geraet"><tr><th>Gerät</th><th>Ø kW</th><th>Stunden</th><th>kWh</th><th>€</th></tr>
        ${zeilen.map(({ b, g, mittel, kwh, std, eur }) => `<tr><td><b>${esc(g.n)}</b><div class="leise">${esc(b.name)} · ${esc(g.typ)}</div></td><td>${f(mittel, 2)}</td><td>${f(std, 1)}</td><td>${f(kwh, 1)}</td><td>${zahl(kwh) ? de(eur, 2) : '–'}</td></tr>`).join('')}</table></div>`
        : '<div class="leer">Noch keine Geräte</div>'}
      ${erkl(d.e.erklaer, 'Ø kW ist die mittlere Leistung, während das Gerät läuft – so sieht man, ob ein Heizkörper schwächer ist als angegeben. kWh kommen aus dem Zählerstand des Shelly (ohne Energiezähler „–“), Stunden ≈ kWh ÷ Ø kW, bei Pumpen die gemessene Pumpzeit.')}</div>`;
  }
  hochrechnung(A) {
    // kWh und € rechnet die Integration (baustelle/auswertung → hochrechnung, heizperiode); die Seite zeigt sie nur an
    const d = this.d, [von, bis] = d.hp, mon = (bis - von + 12) % 12 + 1, hp = A && A.heizperiode, h = A && A.hochrechnung;
    const max = h ? Math.max(h.bisher_kwh || 0, h.mit_kwh || 0, h.ohne_kwh || 0) || 1 : 1;
    const balkenZ = (t, kwh, eur, farbe) => `<div class="hbar"><span class="hb-n">${t}</span><span class="hb-spur"><i style="width:${zahl(kwh) ? kwh / max * 100 : 0}%;background:${farbe}"></i></span><span class="hb-w">${zahl(eur) ? `${de(eur, 0)} €` : '–'}</span></div>`;
    return `<div class="glas-panel block"><div class="block-kopf"><b>Hochrechnung Heizperiode</b><span class="leise">${MONATE[von - 1]}–${MONATE[bis - 1]} · ${mon} Monate</span></div>
      ${!A ? LAEDT : !h || !zahl(h.mit_kwh) ? '<div class="leer">Noch zu wenige Tage für eine Hochrechnung</div>' : `${balkenZ('bisher', h.bisher_kwh, h.bisher_eur, 'var(--s3)')}${balkenZ('mit Automatik', h.mit_kwh, h.mit_eur, 'var(--s1)')}${balkenZ('ohne (24/7)', h.ohne_kwh, h.ohne_eur, 'var(--s2)')}
      <div class="gespart">bis ${hp && hp.bis !== hp.ende ? datum(hp.bis) : `Ende ${MONATE_LANG[bis - 1]}`} rund <b>${de(h.mit_kwh, 0)} kWh</b> · ${de(h.mit_eur, 0)} €${zahl(h.gespart_eur) ? ` – gespart ≈ <b>${de(h.gespart_eur, 0)} €</b>` : ''}</div>`}
      <div class="leise">aus dem bisherigen Verbrauch je Tag hochgerechnet${d.ende ? ` – bis zum geplanten Ende ${datum(d.ende)}, wenn es früher liegt` : ''}. Heizperiode unter Einstellungen › Baustelle.</div>
      ${erkl(d.e.erklaer, 'Die Hochrechnung nimmt den Verbrauch je Tag bisher und rechnet ihn auf die ganze Heizperiode hoch. Endet die Baustelle früher, zählt nur bis zum Ende.')}</div>`;
  }

  /* ---- Verlauf ---- */
  /* Kennzahlen einer Baustelle im Verlauf (kWh, €, gespart, Heiztage, Vergleich, kWh je Monat) – rechnet die Integration */
  kennz(x) {
    const v = this.verlaufDaten(x), zeit = x.aktiv ? (x.beginn ? `seit ${datum(x.beginn)}` : 'laufend') : `${x.beginn ? datum(x.beginn) : '–'} – ${x.ende ? datum(x.ende) : '–'}`;
    if (!v) return { zeit, kwh: null, eur: null, gespart: null, heiztage: null, container: x.bereiche.length, vergleich: {}, jeMonat: {}, monate: null, laedt: true };
    return { zeit, kwh: v.kwh ?? 0, eur: v.eur ?? 0, gespart: v.gespart ?? null, heiztage: v.heiztage ?? 0, container: v.container ?? x.bereiche.length,
      vergleich: v.vergleich || {}, jeMonat: v.je_monat || {}, monate: v.monate_je_container || { labels: [], reihen: [] }, laedt: false };
  }
  v_verlauf() {
    const BS = this.alle, liste = BS.filter(b => b.aktiv === (this.s.verlauf === 'aktiv')), m = this.s.vglArt || 'tag';
    const K = new Map(BS.map(b => [b.entry, this.kennz(b)]));
    const wert = b => K.get(b.entry).vergleich[m] || 0;   // kWh je Heiztag, € je Monat mit Heizung, gesamt (Integration)
    const fmt = v => m === 'tag' ? `${de(v, 1)} kWh` : m === 'monat' ? `${de(v, 0)} €` : `${de(v, 0)} kWh`, max = Math.max(...BS.map(wert), 0) || 1;
    const heute = (this.d || BS[0] || { z: { HEUTE: new Date().toISOString().slice(0, 10) } }).z.HEUTE, j = +heute.slice(0, 4), mo = +heute.slice(5, 7) - 1;
    const MONK = [...Array(12)].map((_, k) => { const mm = mo - 11 + k, jj = mm < 0 ? j - 1 : j; return `${jj}-${String(((mm % 12) + 12) % 12 + 1).padStart(2, '0')}`; });
    const MON = MONK.map(k => MONATE[+k.slice(5, 7) - 1]);
    const laedt = BS.some(b => K.get(b.entry).laedt);
    const mitDaten = BS.map((b, i) => ({ b, i })).filter(({ b }) => MONK.some(k => (K.get(b.entry).jeMonat[k] || 0) > .5));
    const reihen = mitDaten.map(({ b, i }) => ({ name: b.titel, v: MONK.map(k => K.get(b.entry).jeMonat[k] || 0), farbe: `var(--s${(i % 6) + 1})` }));
    const draussen = BS.filter(b => !mitDaten.some(x => x.b === b)).map(b => b.titel);
    return `${this.kopf('Verlauf', 'BAUSTELLEN')}
      <div class="glas-panel block"><div class="block-kopf"><b>Vergleich</b><span class="leise">alle Baustellen</span></div>
        <div class="seg">${[['tag', 'kWh je Heiztag'], ['monat', '€ je Monat'], ['ges', 'gesamt']].map(([k, t]) => `<button data-act="vgl" data-v="${k}" class="${k === m ? 'on' : ''}">${t}</button>`).join('')}</div>
        ${BS.length ? BS.map((b, i) => `<div class="hbar"><span class="hb-n">${esc(b.titel)}</span><span class="hb-spur"><i style="width:${wert(b) / max * 100}%;background:var(--s${(i % 6) + 1})"></i></span><span class="hb-w">${fmt(wert(b))}</span></div>`).join('') : '<div class="leer">Noch keine Baustelle</div>'}
        <div class="leise">${m === 'tag' ? 'Gut vergleichbar, weil unabhängig von der Dauer der Baustelle.' : m === 'monat' ? 'Kosten geteilt durch die Monate mit Heizung.' : 'Summe über die ganze Baustelle.'}</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Letzte 12 Monate</b><span class="leise">kWh je Monat, gestapelt nach Baustelle</span></div>
        <div class="chart-wrap">${laedt ? LAEDT : reihen.length ? flaeche('zwoelf', reihen, MON, 'kWh', 2) : '<div class="leer">Noch keine Werte</div>'}</div>
        ${draussen.length && !laedt ? `<div class="leise">Ohne Werte in diesem Zeitraum: ${draussen.map(esc).join(', ')}</div>` : ''}</div>
      <div class="seg glas-panel">${[['aktiv', 'Aktiv'], ['ab', 'Abgeschlossen']].map(([k, t]) => `<button data-act="verlauf" data-v="${k}" class="${k === this.s.verlauf ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${liste.length ? '' : `<div class="glas-panel block"><div class="leer">${this.s.verlauf === 'aktiv' ? 'Keine laufende Baustelle' : 'Noch keine abgeschlossene Baustelle'}</div></div>`}
      ${liste.map((b, i) => { const k = K.get(b.entry); return `<button class="glas-panel bs-karte" data-act="bs-oeffnen" data-id="${b.entry}" style="animation-delay:${i * 60}ms">
        <div class="bs-kopf"><b>${esc(b.titel)}</b><span class="badge ${b.aktiv ? 'gruen' : ''}">${b.aktiv ? 'aktiv' : 'abgeschlossen'}</span></div>
        <div class="leise">${k.zeit} · ${k.container} Container · ${k.laedt ? '–' : k.heiztage} Heiztage</div>
        <div class="bs-zahlen"><span><b>${de(k.kwh, 0)}</b> kWh</span><span><b>${de(k.eur, 2)}</b> €</span><span class="leise">${b.aktiv ? 'Übersicht ›' : 'ansehen ›'}</span></div></button>`; }).join('')}
      ${this.s.verlauf === 'aktiv' && this.d ? this.protokoll() : ''}`;
  }
  v_ueber() {
    const V = this.version, cl = this.changelog, offen = this.s.cl ?? 0, eigen = cl && cl.find(c => c.version === V);
    const neu = eigen ? eigen.punkte : ['Staffelung der Heizungen je Stromanschluss', 'Arbeitszeiten mit Startdatum, Vor- und Nachheizen', 'Firmen und Abrechnung, Auswertung über alle laufenden Baustellen',
      'Container nur bei Bedarf, Termine und Serien, schnell aufheizen', 'Türkontakt, Warnungen mit Stufen, dauerhaftes Protokoll', 'Handy-Nachrichten mit Knöpfen, Wochen-/Monatsbericht per E-Mail',
      'Glas-Oberfläche mit Himmel nach Tageszeit und Wetter', 'Seite „Über“ und Melden-Knopf'];
    const ha = (this._hass && this._hass.config && this._hass.config.version) || '–';
    return `<div class="zurueck-zeile"><button class="glas-panel chip" data-act="tab" data-v="einst">‹ Einstellungen</button></div>
      <div class="glas-panel ueber-kopf"><div class="ueber-illu">${bcContainer(BEREICH_FARBEN[0], 'heizt')}</div>
        <div><div class="glas-klein">HOME-ASSISTANT-INTEGRATION</div><div class="glas-titel">Baustelle</div><div class="ueber-v">Version <b>${esc(V)}</b>${eigen ? '' : ' <span class="badge blau-b">in Arbeit</span>'}</div>
          <div class="leise">Heizung und Pumpen auf der Baustelle · Integration und Seite haben dieselbe Nummer</div></div></div>
      <div class="glas-panel liste"><div class="gruppe">Dieses System</div>
        <div class="zeile"><span>Integration / Seite</span><span class="leise">${esc(V)} · baustelle</span></div>
        <div class="zeile"><span>Home Assistant</span><span class="leise">${esc(ha)}</span></div>
        <div class="zeile"><span>Quellcode</span><span class="leise">GitHub · herbertschrotter-blip/ha-baustelle (öffentlich, MIT-Lizenz)</span></div>
        <div class="zeile"><span>Baustellen</span><span class="leise">${this.alle.filter(b => b.aktiv).length} laufend · ${this.alle.filter(b => !b.aktiv).length} abgeschlossen</span></div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Neu in ${esc(V)}</b><span class="leise">${eigen ? datum(eigen.datum) : 'geplant'}</span></div>${neu.map(n => `<div class="cl-punkt">${esc(n)}</div>`).join('')}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>Verlauf</b><span class="leise">aus CHANGELOG.md</span></div>
        ${cl === null ? LAEDT : !cl.length ? '<div class="leise">Kein Verlauf vorhanden</div>' : cl.map((c, i) => `<button class="zeile cl-v" data-act="cl" data-i="${i}"><span><b>${esc(c.version)}</b> <span class="leise">${datum(c.datum)}</span></span><span class="chev">${offen === i ? '⌄' : '›'}</span></button>
          ${offen === i ? `<div class="cl-liste">${(c.punkte || []).map(p => `<div class="cl-punkt">${esc(p)}</div>`).join('')}</div>` : ''}`).join('')}</div>
      ${!this.d || this.d.e.melden ? `<button class="knopf" data-act="melden">Fehler, Wunsch oder Anregung melden</button>` : ''}`;
  }
  v_dev() {
    const f = this.s.mfilter || 'offen', alle = this.meldungen(), passt = m => f === 'alle' || (f === 'offen') === this.meldungOffen(m), M = (alle || []).filter(passt);
    const ART = { fehler: ['Fehler', 'rot-b'], wunsch: ['Wunsch', 'blau-b'], anregung: ['Anregung', 'gruen'] };
    const anzahl = k => !alle ? '' : k === 'alle' ? alle.length : alle.filter(m => (k === 'offen') === this.meldungOffen(m)).length;
    return `<div class="zurueck-zeile"><button class="glas-panel chip" data-act="tab" data-v="einst">‹ Einstellungen</button></div>
      ${this.kopf('Entwicklung', 'NUR FÜR DICH')}
      <div class="glas-panel block"><div class="block-kopf"><b>Meldungen</b><div class="seg klein">${[['offen', 'offen'], ['erledigt', 'erledigt'], ['alle', 'alle']].map(([k, t]) => `<button data-act="mfilter" data-v="${k}" class="${f === k ? 'on' : ''}">${t} ${anzahl(k)}</button>`).join('')}</div></div>
        ${alle === null ? LAEDT : M.length ? M.map(m => { const letzte = (m.verlauf || []).filter(v => v.notiz || v.version).at(-1);
          return `<div class="ml ${this.meldungOffen(m) ? 'offen' : 'erledigt'}"><div class="ml-kopf"><span><b class="ml-nr">${esc(m.ticket || '')}</b> <span class="badge ${(ART[m.art] || ART.wunsch)[1]}">${(ART[m.art] || ART.wunsch)[0]}</span> <span class="badge st-${esc(m.status)}">${esc(TICKET_STATUS[m.status] || m.status)}</span></span><span class="leise">${this.meldungZeit(m)} · ${esc(m.geraet || '–')} · v${esc(m.version || '–')}</span></div>
          <div class="ml-text">${esc(m.text)}</div><div class="leise">📍 ${esc(m.kontext || '–')}</div>
          ${letzte ? `<div class="leise ml-notiz">↳ ${esc(letzte.von || '')}: ${esc([letzte.version ? 'v' + letzte.version : '', letzte.notiz || ''].filter(Boolean).join(' · '))}</div>` : ''}
          <div class="wk-knoepfe"><button class="chip glas-panel" data-act="m-status" data-id="${esc(m.id)}">${this.meldungOffen(m) ? '✓ Schließen' : '↺ wieder öffnen'}</button><button class="chip glas-panel" data-act="m-weg" data-id="${esc(m.id)}">Löschen</button></div></div>`; }).join('')
          : '<div class="leer">Keine Meldungen</div>'}
        <div class="wk-knoepfe"><button class="chip glas-panel" data-act="m-md">Als Markdown kopieren</button><button class="chip glas-panel" data-act="m-json">Als JSON herunterladen</button></div>
        <div class="leise">Jede Meldung ist ein Ticket (FE Fehler, WU Wunsch, AN Anregung). In Claude Code mit „Tickets prüfen“ abarbeiten lassen – ist ein Ticket behoben und eingespielt, setzt Claude es auf erledigt. Passt es nicht, hier wieder öffnen.</div></div>
      <div class="glas-panel liste"><div class="gruppe">Werkzeuge</div>
        <button class="zeile" data-act="diagnose"><span>Diagnose herunterladen</span><span class="chev">›</span></button>
        <div class="zeile"><span>Melden-Knopf in jedem Fenster</span>${schalter(this.d.e.melden, 'e-bool', 'data-k="melden"')}</div>
        <div class="zeile"><span>Version</span><span class="leise">${esc(this.version)}${(this.changelog || []).find(c => c.version === this.version) ? ' · ' + (this.changelog.find(c => c.version === this.version).datum || '').slice(0, 7) : ''}</span></div></div>`;
  }
  v_bsdetail() {
    const x = this.alle.find(y => y.entry === this.s.bs);
    if (!x) return `<div class="zurueck-zeile"><button class="glas-panel chip" data-act="tab" data-v="verlauf">‹ Verlauf</button></div><div class="glas-panel block"><div class="leer">Baustelle nicht gefunden</div></div>`;
    const k = this.kennz(x), m = k.monate && { labels: k.monate.labels, reihen: k.monate.reihen.map((r, i) => { const b = x.bereiche.find(y => y.id === r.bereich);   // Verbrauch je Monat und Container: Integration
      return { name: r.name, v: r.v, kwh: r.kwh, eur: r.eur, anteil: r.anteil, farbe: BEREICH_FARBEN[(b && zahl(b.f) ? b.f : i) % BEREICH_FARBEN.length] }; }) };
    const prot = !x.geladen ? [] : this._holen(`bp:${x.entry}`, () => this._hass.callWS({ type: 'baustelle/protokoll', entry_id: x.entry, filter: 'alle', vor: null, limit: 5 }), 300000);   // nicht geladen: die Integration kennt sie nicht
    const ART = { einstellung: '⚙', warnung: '⚠', ok: '✓', schalten: '⏻', wetter: '☁', nachricht: '✉' };
    const eintraege = prot === undefined ? null : (Array.isArray(prot) ? prot : (prot && prot.eintraege) || []).slice(0, 5);
    return `<div class="zurueck-zeile"><button class="glas-panel chip" data-act="tab" data-v="verlauf">‹ Verlauf</button><button class="glas-panel chip" data-act="csv">⇩ CSV</button></div>
      ${this.kopf(esc(x.titel), x.aktiv ? 'LAUFEND' : 'ABGESCHLOSSEN · NUR ANSEHEN')}
      <div class="leise vgl">${k.zeit}</div>
      <div class="glas-panel kennz vier"><div><b>${de(k.kwh, 0)}</b><span>kWh</span></div><div><b>${de(k.eur, 0)} €</b><span>Kosten</span></div><div><b>${k.laedt ? '–' : k.heiztage}</b><span>Heiztage</span></div><div><b>${zahl(k.gespart) ? `${de(k.gespart, 0)} €` : '–'}</b><span>gespart</span></div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Verbrauch je Monat</b><span class="leise">gestapelt nach Container</span></div>
        ${!m ? LAEDT : !m.reihen.length ? '<div class="leer">Keine Container</div>' : `<div class="chart-wrap">${flaeche('bs-' + x.entry, m.reihen, m.labels, 'kWh', 1)}</div>
        <div class="vb-je">${m.reihen.map(q => `<div><i style="background:${q.farbe}"></i><span class="n">${esc(q.name)}</span><b>${de(q.kwh, 0)} kWh</b><span>${de(q.eur, 0)} €</span><span class="leise">${de(q.anteil, 0)} %</span></div>`).join('')}</div>`}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>Protokoll</b><span class="leise">Auszug</span></div>
        ${eintraege === null ? LAEDT : eintraege.length ? eintraege.map(p => { const l = this.lokal(p[0], x.z.zone); return `<div class="zeile ereignis"><span class="zeit">${kurzDatum(l)}</span><span class="p-ic">${ART[p[1]] || '•'}</span><div><span>${p[2] ? `${esc((x.bereiche.find(b => b.id === p[2]) || { name: p[2] }).name)}: ` : ''}${esc(p[3])}</span></div></div>`; }).join('') : '<div class="leer">Keine Einträge</div>'}</div>
      ${x.aktiv ? '' : knopf2('Wieder aktiv setzen', 'bs-aktiv', x.entry)}`;
  }
  protokoll() {
    const f = this.s.pfilter || 'alle', ART = { warnung: ['⚠', 'var(--rot)'], ok: ['✓', '#30d158'], schalten: ['⏻', 'var(--amber)'], wetter: ['☁', 'var(--blau)'], nachricht: ['✉', 'var(--ink2)'], einstellung: ['⚙', 'var(--ink2)'] };
    const passt = e => f === 'alle' || e[2] === f || (f === 'warnung' && e[2] === 'ok') || (f === 'schalten' && e[2] === 'einstellung');
    let quelle = this.d.protokoll;
    if ((f !== 'alle' || this.s.pmehr) && this.d.geladen) {
      const r = this._holen('p:' + this.d.entry, () => this._hass.callWS({ type: 'baustelle/protokoll', entry_id: this.d.entry, filter: 'alle', vor: null, limit: 200 }), 60000);
      quelle = r === undefined ? null : (Array.isArray(r) ? r : (r && r.eintraege) || []).map(p => this.protokollZeile(p, this.z));
    }
    const kopf = `<div class="block-kopf"><b>Protokoll</b><span class="leise">bleibt mit der Baustelle gespeichert · auch im HA-Logbuch</span></div>
      <div class="vb-wer">${[['alle', 'Alle'], ['warnung', 'Warnungen'], ['schalten', 'Schalten'], ['wetter', 'Wetter'], ['nachricht', 'Nachrichten']].map(([k, t]) => `<button data-act="pfilter" data-v="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    if (quelle === null) return `<div class="glas-panel block">${kopf}${LAEDT}</div>`;
    let liste = quelle.filter(passt); const mehr = !this.s.pmehr && (liste.length > 12 || (f === 'alle' && quelle.length >= 20)); if (mehr) liste = liste.slice(0, 12);
    let tag = '';
    return `<div class="glas-panel block">${kopf}
      ${liste.length ? liste.map(e => { const [ic, farbe] = ART[e[2]] || ['•', 'var(--ink2)'], kopfT = e[0] !== tag ? `<div class="p-tag">${(tag = e[0])}</div>` : '';
        return `${kopfT}<div class="zeile ereignis"><span class="zeit">${e[1]}</span><span class="p-ic" style="color:${farbe}">${ic}</span><div>${e[3] ? `<b>${esc(this.bName(e[3]))}</b> ` : ''}<span class="${e[3] ? 'leise' : ''}">${esc(e[4])}</span></div></div>`; }).join('')
        : '<div class="leer">Keine Einträge</div>'}
      ${mehr ? '<button class="zeile" data-act="pmehr"><span class="blau">Ältere Einträge laden</span></button>' : ''}</div>`;
  }

  /* ---- Einstellungen ---- */
  v_einst() {
    const d = this.d, e = d.e, st = (k, s, fmt) => this.stepper(k, s, fmt), M = this.meldungen(), o = d.optionen;
    return `${this.kopf('Einstellungen', esc(d.titel))}
      <div class="glas-panel liste"><div class="gruppe">Baustelle</div>
        <button class="zeile" data-act="sheet" data-s="name"><span>Name</span><span class="leise">${esc(d.titel)} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="zeitraum-bs"><span>Beginn und Ende</span><span class="leise">${this.bsZeit(d)} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="zeitraum-bs"><span>Heizperiode</span><span class="leise">${MONATE[d.hp[0] - 1]} – ${MONATE[d.hp[1] - 1]} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="abschliessen"><span>Baustelle abschließen</span><span class="leise">kommt in den Verlauf ›</span></button>
        <button class="zeile" data-act="sheet" data-s="baustelle-neu"><span class="blau">+ Neue Baustelle</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">App</div>
        <button class="zeile" data-act="tab" data-v="ueber"><span>Über</span><span class="leise">Version ${esc(this.version)} ›</span></button>
        <div class="zeile"><div><b>Erklärungen anzeigen</b><div class="leise">kurze Texte „ⓘ“ unter Heizung, Pumpen und Auswertung</div></div>${schalter(e.erklaer, 'e-bool', 'data-k="erklaer"')}</div>
        <div class="zeile"><div><b>Melden-Knopf</b><div class="leise">kleiner Knopf in jedem Fenster für Fehler, Wünsche und Anregungen</div></div>${schalter(e.melden, 'e-bool', 'data-k="melden"')}</div>
        <button class="zeile" data-act="tab" data-v="dev"><span>Entwicklung</span><span class="leise">${M === null ? '–' : M.filter(m => this.meldungOffen(m)).length} offene Meldungen ›</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Firmen · für die Abrechnung</div>
        ${d.firmen.map(f => { const n = d.bereiche.filter(b => (b.firma || 'eigen') === f.id).length;
          return `<button class="zeile" data-act="firma-auf" data-id="${esc(f.id)}"><span>${esc(f.name)}${f.eigen ? ' <span class="badge">eigene</span>' : ''}</span><span class="leise">${n} Container ›</span></button>`; }).join('')}
        <button class="zeile" data-act="firma-auf"><span class="blau">+ Firma hinzufügen</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Container und Geräte</div>
        ${d.bereiche.map(b => `<button class="zeile" data-act="bereich-einst" data-id="${b.id}"><span><i class="farbpunkt" style="background:${BEREICH_FARBEN[b.f % 6]}"></i>${esc(b.name)}</span><span class="leise">${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'} ›</span></button>`).join('')}
        <button class="zeile" data-act="sheet" data-s="container-neu"><span class="blau">+ Container oder Schacht</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Strom</div>
        <label class="zeile"><span>Preis je kWh</span><span class="eingabe"><input type="number" step="0.01" data-k="preis" value="${e.preis}"> €</span></label>
        <div class="zeile"><div><b>⚡ Staffelung</b><div class="leise">verteilt die Heizungen auf den freien Strom – geschaltet werden nur Heizungen</div></div>${schalter(e.staffel, 'e-bool', 'data-k="staffel"')}</div>
        ${e.staffel ? `<div class="gruppe-t gt-einzug">Anschlüsse</div>
        ${d.anschluesse.map(a => `<button class="zeile unter" data-act="anschluss-auf" data-id="${esc(a.id)}"><div><b>${esc(a.name)}</b><div class="leise">${a.phasen === 3 ? '3 × ' : ''}${a.ampere} A · Reserve ${de(a.reserve)} kW · ${d.bereiche.filter(b => b.anschluss === a.id).map(b => esc(b.name)).join(', ') || 'keine Container'}</div></div><span class="chev">›</span></button>`).join('')}
        <button class="zeile unter" data-act="anschluss-auf"><span class="blau">+ Anschluss hinzufügen</span></button>
        <div class="zeile unter"><div><span>Nutzbar je Anschluss</span><div class="leise">vorsichtig, weil unbekannt ist, welche Steckdose an welcher Phase hängt</div></div>${st('nutzbar', 5, v => `${v} %`)}</div>
        <div class="zeile unter"><span>Höchstens gleichzeitig</span>${st('max_gleich', 1, v => `${v} Heizk.`)}</div>
        <div class="zeile unter"><span>Mindestlaufzeit</span>${st('min_lauf', 1, v => `${v} min`)}</div>
        <div class="zeile unter"><span>Mindestpause</span>${st('min_pause', 1, v => `${v} min`)}</div>
        <div class="zeile unter"><div><span>Wechsel im Rundlauf</span><div class="leise">wenn nicht alle gleichzeitig dürfen</div></div>${st('takt', 5, v => `${v} min`)}</div>
        <div class="zeile unter"><span class="leise">Gesamtzähler: keiner – gerechnet wird mit den Shellys und der Reserve je Anschluss. Später kann je Anschluss ein Zähler dazukommen.</span></div>
        <div class="gruppe-t gt-einzug">Vorrang, wenn nicht alle dürfen</div>
        ${d.bereiche.filter(b => !b.pumpe).map(b => `<div class="zeile unter"><span>${esc(b.name)}</span><div class="seg klein">${['niedrig', 'normal', 'hoch'].map(v => `<button data-act="prio" data-id="${b.id}" data-v="${v}" class="${(b.prio || 'normal') === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>`).join('')}
        <div class="leise p-fuss">Frostschutz geht immer vor. Pumpen und andere Verbraucher werden mitgezählt, aber nie geschaltet.</div>` : ''}</div>
      <div class="glas-panel liste"><div class="gruppe">Wetter und Kalender</div>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Wetter</span><span class="leise">${o.wetter ? esc(this.name(o.wetter)) : 'keins gewählt'} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Außentemperatur</span><span class="leise">${o.temp_sensor ? esc(this.name(o.temp_sensor)) : 'aus der Vorhersage'} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="urlaub"><span>Urlaub</span><span class="leise">${o.urlaub_kalender ? `Kalender „${esc(this.name(o.urlaub_kalender))}“` : 'kein Kalender'} ›</span></button>
        <div class="zeile"><span>Feiertage</span><span class="leise">${o.feiertag_kalender ? esc(this.name(o.feiertag_kalender)) : 'kein Kalender'}</span></div></div>
      <div class="glas-panel liste"><div class="gruppe">Bericht</div>
        <div class="zeile"><span>Wie oft</span><div class="seg klein">${[['aus', 'aus'], ['woche', 'Woche'], ['monat', 'Monat'], ['beides', 'beides']].map(([k, t]) => `<button data-act="e-wert" data-k="bericht" data-v="${k}" class="${e.bericht === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        ${e.bericht !== 'aus' ? `<div class="zeile unter"><span class="leise">${{ woche: 'jeden Montag 07:00 für die Vorwoche', monat: 'am 1. des Monats 07:00 für den Vormonat', beides: 'Montag 07:00 und am 1. des Monats' }[e.bericht] || ''}</span></div>
        <div class="zeile unter"><span>📱 aufs Handy</span>${schalter(e.bericht_handy, 'e-bool', 'data-k="bericht_handy"')}</div>
        <div class="zeile unter"><span>✉ per E-Mail</span>${schalter(e.bericht_mail, 'e-bool', 'data-k="bericht_mail"')}</div>
        ${e.bericht_mail ? `<label class="zeile unter"><span>an</span><input type="email" value="${esc(e.mail)}" data-k="mail" class="mail-feld"></label>
        <div class="zeile unter"><span>Abrechnung als CSV anhängen</span>${schalter(e.bericht_csv, 'e-bool', 'data-k="bericht_csv"')}</div>
        <div class="zeile unter"><span class="leise">über den Dienst notify.${esc(e.mail_dienst || 'baustelle_mail')} (z. B. Google Mail oder SMTP in HA eingerichtet)</span></div>` : ''}
        <button class="zeile" data-act="sheet" data-s="bericht"><span class="blau">Beispiel ansehen</span><span class="chev">›</span></button>
        <button class="zeile" data-act="bericht-senden"><span class="blau">Jetzt senden</span></button>` : ''}</div>
      <div class="glas-panel liste"><div class="gruppe">Meldungen · Störungen</div>
        <div class="zeile"><span>Empfänger</span><span class="leise">${esc(e.empfaenger)}</span></div>
        <div class="zeile"><div><b>Knöpfe in der Nachricht</b><div class="leise">direkt aus der Nachricht reagieren, z. B. „bis morgen stumm“</div></div>${schalter(e.knoepfe, 'e-bool', 'data-k="knoepfe"')}</div>
        <button class="zeile" data-act="sheet" data-s="nachrichten"><span class="blau">Beispiele ansehen</span><span class="chev">›</span></button>
        <button class="zeile" data-act="test-meldung"><span class="blau">Test-Nachricht senden</span></button>
        <div class="zeile"><span>Stromausfall / offline (nach ${de(e.offline_min, 0)} min)</span>${schalter(e.m_offline, 'e-bool', 'data-k="m_offline"')}</div>
        <div class="zeile"><span>Pumpe Trockenlauf (unter ${de(e.trocken_w, 0)} W)</span>${schalter(e.m_trocken, 'e-bool', 'data-k="m_trocken"')}</div>
        <div class="zeile"><span>Pumpe Dauerlauf über ${e.dauer_min} min</span>${schalter(e.m_dauer, 'e-bool', 'data-k="m_dauer"')}</div>
        <div class="zeile"><span>Pumpe schaltet oft (ab ${e.zyklen_h} je Stunde)</span>${schalter(e.m_zyklen, 'e-bool', 'data-k="m_zyklen"')}</div>
        <div class="zeile"><span>Heizkörper zieht keinen Strom</span>${schalter(e.m_leistung, 'e-bool', 'data-k="m_leistung"')}</div>
        <div class="zeile"><span>Frostgefahr trotz Frostschutz</span>${schalter(e.m_frost, 'e-bool', 'data-k="m_frost"')}</div>
        <div class="gruppe">Hinweise</div>
        <div class="zeile"><span>Zu kalt trotz Heizung (nach ${e.kalt_min} min)</span>${schalter(e.m_kalt, 'e-bool', 'data-k="m_kalt"')}</div>
        <div class="zeile"><span>Fühler meldet nichts / Batterie schwach</span>${schalter(e.m_fuehler, 'e-bool', 'data-k="m_fuehler"')}</div>
        <div class="zeile"><span>Keine Wettervorhersage</span>${schalter(e.m_wetter, 'e-bool', 'data-k="m_wetter"')}</div>
        <div class="zeile"><span>Handbetrieb länger als ${e.hand_h} h</span>${schalter(e.m_hand, 'e-bool', 'data-k="m_hand"')}</div>
        <div class="leise p-fuss">Störungen, offene Tür und langer Handbetrieb kommen aufs Handy, andere Hinweise nur ins Protokoll und in den Warnung-Chip.</div></div>`;
  }

  /* ---- Auswahllisten aus HA (für die Einrichtungs-Dialoge) ---- */
  entitaeten(filter) {
    const eigene = new Set(this._eigene || []);
    return Object.values((this._hass && this._hass.states) || {}).filter(s => !eigene.has(s.entity_id) && filter(s))
      .map(s => [s.entity_id, s.attributes.friendly_name || s.entity_id]).sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }
  freieSchalter(auch) {
    const belegt = new Set(this.alle.filter(x => x.aktiv).flatMap(x => x.bereiche.flatMap(b => b.geraete.map(g => g.schalter))));
    return this.entitaeten(s => s.entity_id.startsWith('switch.') && (!belegt.has(s.entity_id) || s.entity_id === auch));
  }
  optionen(liste, aktuell, leer) { return (leer ? `<option value="">${leer}</option>` : '') + liste.map(([v, n]) => `<option value="${esc(v)}" ${v === aktuell ? 'selected' : ''}>${esc(n)}</option>`).join(''); }

  /* ---- Einblendungen von unten ---- */
  sheet() {
    const s = this.s.sheet, d = this.d, knopf = (t, act = 'zu', art = '') => `<button class="knopf ${art}" data-act="${act}">${t}</button>`;
    const griff = '<div class="griff"></div>';
    if (s.art === 'verbrauch') return `${griff}${this.verbrauchInhalt(s, 'sheet', true)}${knopf('Schließen')}`;
    if (s.art === 'hz') { const T = this.hzTeile(), def = HZ_TEILE.find(x => x[0] === s.k) || HZ_TEILE[0];
      const inhalt = s.k === 'heute' ? T.heute + T.wann : s.k === 'az' ? T.az + T.ausn : T[s.k];
      return `${griff}<div class="block-kopf"><h3>${def[2]} ${esc(def[3])}</h3></div>${(inhalt || '').replace(/class="glas-panel block"/g, 'class="block hz-innen"')}${knopf('Schließen')}`; }
    if (s.art === 'wetter') {
      const a = s.wa || 'std', e = d.e, ws = this.zustand(d.wetterEid), w = d.wetter || {};
      const folge = (t, mm) => [zahl(t) && t < e.frueh_temp ? '<span class="w-folge blau">Frühstart</span>' : '', zahl(mm) && mm >= e.tr_mm ? '<span class="w-folge amber">Kleidung trocknen</span>' : '',
        zahl(t) && t > e.grenze ? '<span class="w-folge">über Heizgrenze</span>' : ''].join('');
      const H = this.vorhersage.hourly, D = this.vorhersage.daily, jetzt = d.z.jetztMs;
      let inhalt;
      if (a === 'std') {
        const std = (H || []).filter(x => Date.parse(x.datetime) > jetzt - 36e5).slice(0, 6);
        inhalt = H === null ? LAEDT : !std.length ? '<div class="leer">Keine stündliche Vorhersage</div>' : `<div class="w-std">${std.map(x => `<div><span class="leise">${this.lokal(x.datetime).slice(11, 13)}:00</span>${wetterIcon(x.condition, 36)}<b>${de(x.temperature, 0)}°</b>
          <span class="w-regen">${zahl(x.precipitation) && x.precipitation > 0 ? de(x.precipitation) + ' mm' : '–'}</span><span class="leise">${zahl(x.precipitation_probability) ? x.precipitation_probability : 0} %</span></div>`).join('')}</div>`;
      } else if (a === 'tag') {
        const teile = [['Morgen', 7], ['Mittag', 12], ['Nachmittag', 16], ['Nacht', 22]], jetztH = +d.z.JETZT.slice(0, 2);
        const tagSt = this.statistik('Tag'), aussen = tagSt && tagSt.werte[this.eid(d, d.entry, 'aussen')];
        const stunde = (tag, h) => (H || []).find(x => this.lokal(x.datetime).slice(0, 13) === `${tag} ${String(h).padStart(2, '0')}`);
        inhalt = H === null ? LAEDT : [['Heute', d.z.HEUTE], ['Morgen', plusTage(d.z.HEUTE, 1)]].map(([name, tag]) => `<div class="w-tag"><div class="w-tag-n">${name}</div><div class="w-teile">${teile.map(([t, h]) => {
          const x = stunde(tag, h), vorbei = tag === d.z.HEUTE && h < jetztH, temp = x ? x.temperature : vorbei && aussen ? aussen[h] : null;
          return `<div class="${vorbei ? 'vorbei' : ''}"><span class="leise">${t}</span>${wetterIcon(x ? x.condition : (ws ? ws.state : 'cloudy'), 34)}<b>${zahl(temp) ? de(temp, 0) + '°' : '–'}</b><span class="w-regen">${x && zahl(x.precipitation) && x.precipitation > 0 ? de(x.precipitation) + ' mm' : '–'}</span></div>`; }).join('')}</div></div>`).join('');
      } else {
        const tage = (D || []).filter(x => this.lokal(x.datetime).slice(0, 10) > d.z.HEUTE).slice(0, 3);
        inhalt = D === null ? LAEDT : !tage.length ? '<div class="leer">Keine Tagesvorhersage</div>' : `<div class="w-3">${tage.map(x => { const t = this.lokal(x.datetime).slice(0, 10); return `<div class="w-3z">
          <div class="w-3t"><b>${wtag(t)}</b><span class="leise">${kurzDatum(t)}</span></div>${wetterIcon(x.condition, 40)}
          <div class="w-3w"><b>${de(x.temperature, 0)}°</b><span class="leise">${de(x.templow, 0)}°</span></div>
          <div class="w-3r"><span class="w-regen">${zahl(x.precipitation) && x.precipitation > 0 ? de(x.precipitation) + ' mm' : '–'}</span><span class="leise">${zahl(x.precipitation_probability) ? x.precipitation_probability : 0} %</span></div>
          <div class="w-3f">${folge(x.templow, x.precipitation)}</div></div>`; }).join('')}</div>`;
      }
      const [wz, wt, wtemp] = this.wetterJetzt(), gef = ws && ws.attributes.apparent_temperature;
      const morgen = plusTage(d.z.HEUTE, 1), pm = d.plan[morgen], wm = this.wetterTag(morgen), g = (pm && pm.gruende) || [];
      const fuer = [g.includes('frueher_nach_regen') ? `Kleidung trocknen morgen früh aktiv (Regen über ${de(e.tr_mm)} mm)` : '',
        g.includes('fruehstart') ? `Kälte-Frühstart morgen ${e.frueh_min} min früher${zahl(wm.kalt) ? ` (${de(wm.kalt, 0).replace('-', '−')} °C)` : ''}` : ''].filter(Boolean);
      return `${griff}<h3>Wetter · ${esc(this.name(d.wetterEid) || d.titel)}</h3><div class="w-jetzt">${wetterIcon(wz, 72)}<div><b>${zahl(wtemp) ? de(wtemp) + ' °C' : '–'}</b><div class="leise">${esc([ws ? WETTER_TEXT[ws.state] || ws.state : wt, zahl(w.regen_heute) && w.regen_heute > 0 ? `${de(w.regen_heute, w.regen_heute % 1 ? 1 : 0)} mm seit gestern` : '', zahl(gef) ? `gefühlt ${de(gef, 0)} °C` : ''].filter(Boolean).join(' · '))}</div></div></div>
        <div class="seg">${[['std', 'Stündlich'], ['tag', 'Tagesverlauf'], ['3', '3 Tage']].map(([k, t]) => `<button data-act="wa" data-v="${k}" class="${a === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="w-inhalt">${inhalt}</div>
        <div class="leise">Für die Heizung: ${fuer.length ? fuer.join(', ') + '.' : 'morgen nichts Besonderes.'}</div>${knopf('Schließen')}`;
    }
    if (s.art === 'warnungen') {
      const W = d.warnungen, karte = w => `<div class="wk ${w.stufe} ${w.stumm ? 'stumm' : ''}"><div class="wk-kopf"><b>${esc(this.bName(w.b))}</b><span class="leise">${this.seitText(w.seitIso)}</span></div>
        <div class="wk-titel">${esc(w.titel)}</div><div class="leise">${esc(w.hilfe)}</div>
        <div class="wk-knoepfe">${w.b && d.bereiche.some(b => b.id === w.b) ? `<button class="chip glas-panel" data-act="w-hin" data-id="${w.b}">Zum Container ›</button>` : ''}
          <button class="chip glas-panel" data-act="w-stumm" data-id="${esc(w.id)}">${w.stumm ? '🔔 wieder melden' : '🔕 bis morgen stumm'}</button></div></div>`;
      const gruppe = (titel, liste) => liste.length ? `<div class="gruppe-t">${titel} · ${liste.length}</div>${liste.map(karte).join('')}` : '';
      const offen = W.filter(w => !w.stumm);
      return `${griff}<div class="block-kopf"><h3>Warnungen</h3><span class="leise">${offen.length} offen</span></div>
        ${offen.length ? '' : '<div class="leer">Alles in Ordnung ✓</div>'}
        ${gruppe('Störungen', offen.filter(w => w.stufe === 'stoerung'))}${gruppe('Hinweise', offen.filter(w => w.stufe === 'hinweis'))}${gruppe('Stumm bis morgen', W.filter(w => w.stumm))}
        <button class="zeile" data-act="w-protokoll"><span class="blau">Alle Einträge im Protokoll</span><span class="chev">›</span></button>
        ${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'baustellen') return `${griff}<h3>Baustelle wählen</h3>${this.alle.map(b => `<div class="zeile bs-zeile"><button class="bs-wahl" data-act="bs-wahl" data-id="${esc(b.entry)}"><span>${esc(b.titel)}${d && b.entry === d.entry ? ' ✓' : ''}</span><span class="badge ${b.aktiv ? 'gruen' : ''}">${b.aktiv ? 'aktiv' : 'abgeschlossen'}</span></button>
        <button class="bs-ic" data-act="bs-bearbeiten" data-id="${esc(b.entry)}" title="Bearbeiten" aria-label="${esc(b.titel)} bearbeiten">✎</button><button class="x" data-act="sheet" data-s="bs-loeschen" data-id="${esc(b.entry)}" title="Löschen" aria-label="${esc(b.titel)} löschen">✕</button></div>`).join('')}
      <button class="zeile" data-act="sheet" data-s="baustelle-neu"><span class="blau">+ Neue Baustelle</span></button>`;
    if (s.art === 'bs-loeschen') { const x = this.alle.find(y => y.entry === s.id);
      if (!x) return `${griff}<h3>Baustelle löschen</h3><div class="leise">Diese Baustelle gibt es nicht mehr.</div>${knopf('Schließen', 'zu', 'leise-k')}`;
      return `${griff}<h3>„${esc(x.titel)}“ löschen?</h3><div class="leise">Die Baustelle wird aus HA entfernt – mit Containern, Geräten, Einstellungen und Zählern. Sie steht danach auch nicht im Verlauf. Die Messwerte der Shellys bleiben in HA.${x.aktiv ? ' Wer die Werte behalten will, schließt die Baustelle stattdessen ab.' : ''}</div>
        ${knopf('Endgültig löschen', 'bs-loeschen', 'rot')}${knopf('Abbrechen', 'zu', 'leise-k')}`; }
    if (s.art === 'heizplan') {
      const az = this.azJetzt;
      return `${griff}<div class="block-kopf"><h3>Heizplan · diese Woche</h3><span class="leise">${az ? `${esc(az.name)} · seit ${datum(az.ab)}` : 'keine Arbeitszeit'}</span></div>
        ${d.e.auto ? '' : '<div class="warn-k"><b>Automatik ist aus</b><div class="leise">Der Plan wird gerade nicht ausgeführt.</div></div>'}
        ${this.heizplanInhalt()}
        <div class="bedarf-dauer">${d.jetztBis ? `<button class="chip glas-panel amber" data-act="jetzt-aus">■ alle heizen bis ${d.jetztBis} – beenden</button>` : `<button class="chip glas-panel" data-act="jetzt-an">▶ alle jetzt 1 h heizen</button>`}<button class="chip glas-panel" data-act="ausn-neu" data-v="">+ Ausnahme</button></div>
        ${knopf('Arbeitszeit ändern', 'az-heizung', 'amber')}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'az') {
      const a = d.arbeitszeiten[s.i]; if (!a) { this.s.sheet = null; return ''; }
      const geplant = a.ab > this.z.HEUTE, aktuell = a === this.azJetzt;
      return `${griff}<div class="block-kopf"><h3>${esc(a.name)}</h3><span class="badge ${aktuell ? 'gruen' : geplant ? 'blau-b' : ''}">${aktuell ? 'gilt jetzt' : geplant ? 'geplant' : 'früher'}</span></div>
        <div class="leise">gilt ab ${datum(a.ab)}</div>
        ${TAGE.map(t => `<div class="zeile"><b class="tag-n">${t}</b><span>${a.tage[t] ? a.tage[t].join('–') : '<span class="leise">frei</span>'}</span></div>`).join('')}
        ${a.auto ? '<div class="leise">Automatisch angelegt – wird durch deine erste eigene Arbeitszeit ersetzt.</div>' : ''}
        ${knopf('Bearbeiten', 'az-bearbeiten', 'amber')}${knopf('Als Vorlage für eine neue', 'az-vorlage')}
        ${d.arbeitszeiten.length > 1 ? knopf('Löschen', 'az-weg', 'rot') : '<div class="leise">Die letzte Arbeitszeit lässt sich nicht löschen – ohne Arbeitszeit liefe nur der Frostschutz.</div>'}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'firma') {
      const f = s.form, neu = !f.id, eigen = !neu && this.firma(f.id).eigen;
      // wählbar: Container ohne fremde Firma, dazu die, die schon dieser Firma gehören
      const frei = d.bereiche.filter(b => (b.firma || 'eigen') === 'eigen' || (!neu && b.firma === f.id));
      return `${griff}<h3>${neu ? 'Neue Firma' : 'Firma'}</h3>
        <label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Trockenbau Maier" data-fn ${eigen ? 'disabled' : ''}></label>
        ${eigen ? `<div class="gruppe-t">Container der eigenen Firma</div>
          ${d.bereiche.filter(b => (b.firma || 'eigen') === 'eigen').map(b => `<div class="zeile"><span>${esc(b.name)}</span></div>`).join('')}
          <div class="leise">Hierher gehören alle Container, die keiner anderen Firma zugeordnet sind.</div>`
        : `<div class="gruppe-t">Container zuordnen</div>
          ${frei.length ? frei.map(b => `<div class="zeile"><span>${esc(b.name)}</span>${schalter(f.container.includes(b.id), 'firma-c', `data-id="${b.id}"`)}</div>`).join('')
            : '<div class="leise">Alle Container sind schon anderen Firmen zugeordnet.</div>'}
          ${f.neu.map((c, i) => `<div class="zeile fc-neu"><input value="${esc(c.name)}" placeholder="Name des Containers" data-fnc="${i}">
            <div class="seg klein">${['Container', 'Schacht'].map(a => `<button data-act="fc-art" data-i="${i}" data-v="${a}" class="${c.art === a ? 'on' : ''}">${a}</button>`).join('')}</div>
            <button class="x" data-act="fc-weg" data-i="${i}" title="nicht anlegen">✕</button></div>`).join('')}
          <button class="zeile" data-act="fc-neu"><span class="blau">+ Neuer Container für diese Firma</span></button>
          <div class="leise">Nur Container ohne andere Firma sind wählbar. Nimmst du einen weg, gehört er wieder der eigenen Firma. Frühere Werte bleiben bei der bisherigen Firma.</div>`}
        ${eigen ? knopf('Schließen', 'zu', 'leise-k') : knopf('Speichern', 'firma-speichern', 'amber') + (neu ? '' : knopf('Firma löschen', 'firma-weg', 'rot')) + knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'strom') {
      const L = this.last(), e = d.e;
      const zustand = x => x.b.offline || !x.g.erreichbar ? ['offline', 'rot-t'] : x.b.boost && x.g.an ? ['heizt – schnell, Vorrang', 'amber-t'] : x.b.z === 'pause' ? ['pausiert – Tür offen', 'lila']
        : x.g.warte ? [`wartet${zahl(x.g.warte.dran_in_min) ? ` – dran in ${x.g.warte.dran_in_min} min` : ''}`, 'blau'] : x.g.an ? ['heizt', 'amber-t'] : ['aus', 'leise'];
      return `${griff}<div class="block-kopf"><h3>Stromverteilung</h3><span class="leise">${L.laufen} von ${L.hk.length} Heizkörpern an · höchstens ${L.max}</span></div>
        <div class="strom-leg"><span><i class="s-heiz"></i>Heizung ${de(L.heiz)} kW</span><span><i class="s-pumpe"></i>Pumpen ${de(L.pumpe)} kW</span><span><i class="s-sonst"></i>Sonstiges ${de(L.sonst)} kW</span><span><i class="s-res"></i>Reserve (Kran, Werkzeug)</span></div>
        ${L.A.map(a => { const w = v => `${a.grenze > 0 ? Math.max(0, v / a.grenze * 100) : 0}%`;
          return `<div class="an-block"><div class="an-kopf"><b>${esc(a.name)}</b><span class="leise">${a.phasen === 3 ? '3 × ' : ''}${a.ampere ?? '–'} A · ${de(a.heiz + a.pumpe + a.sonst)} von ${de(a.grenze)} kW</span></div>
          <div class="strom-spur"><i class="s-heiz" style="width:${w(a.heiz)}"></i><i class="s-pumpe" style="width:${w(a.pumpe)}"></i><i class="s-sonst" style="width:${w(a.sonst)}"></i><i class="s-res" style="width:${w(a.reserve)}"></i></div>
          <div class="leise">${a.frei < 2 ? `<span class="amber-t">nur ${de(Math.max(0, a.frei))} kW frei</span>` : `${de(a.frei)} kW frei`} für Heizungen</div>
          ${L.hk.filter(x => x.b.anschluss === a.id).map(x => { const [t, k] = zustand(x); return `<div class="zeile"><span>${esc(x.b.name)} · ${esc(x.g.n)}</span><span class="${k}">${t}</span></div>`; }).join('')}</div>`; }).join('')}
        <div class="hinweis-k">Je Anschluss gilt: ${e.nutzbar} % der Anschlussleistung (vorsichtig, weil die Verteilung auf die Phasen unbekannt ist) minus Reserve minus alles, was schon läuft. Ein Heizkörper kommt erst dazu, wenn eine Minute lang genug frei ist. Jeder läuft mindestens ${e.min_lauf} min und pausiert mindestens ${e.min_pause} min; dürfen nicht alle, wechseln sie alle ${e.takt} min – wer am weitesten unter dem Soll ist, zuerst.</div>
        ${knopf('Anschlüsse einstellen', 'tab-einst', 'leise-k')}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'anschluss') {
      const f = s.form, neu = !f.id;
      return `${griff}<h3>${neu ? 'Neuer Anschluss' : 'Anschluss'}</h3>
        <label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Verteiler West" data-an="name"></label>
        <div class="zeile"><span>Absicherung</span><div class="seg klein">${[16, 32, 63].map(v => `<button data-act="an-wert" data-k="ampere" data-v="${v}" class="${f.ampere === v ? 'on' : ''}">${v} A</button>`).join('')}</div></div>
        <div class="zeile"><span>Art</span><div class="seg klein">${[3, 1].map(v => `<button data-act="an-wert" data-k="phasen" data-v="${v}" class="${f.phasen === v ? 'on' : ''}">${v === 3 ? 'Starkstrom (CEE)' : 'Schuko 230 V'}</button>`).join('')}</div></div>
        <div class="zeile"><div><span>Reserve</span><div class="leise">für Ungemessenes wie Kran oder Werkzeug</div></div><span class="stepper"><button data-act="an-res" data-d="-1">−</button><b>${de(f.reserve)} kW</b><button data-act="an-res" data-d="1">+</button></span></div>
        <div class="leise">Anschlussleistung ${de(f.ampere * .23 * f.phasen)} kW, davon rechnet die Staffelung mit ${d.e.nutzbar} % = ${de(f.ampere * .23 * f.phasen * d.e.nutzbar / 100)} kW, abzüglich ${de(f.reserve)} kW Reserve.</div>
        <div class="gruppe-t">Container an diesem Anschluss</div>
        ${d.bereiche.map(b => `<div class="zeile"><span>${esc(b.name)} <span class="leise">${f.container.includes(b.id) ? '' : '· ' + esc(this.anschluss(b.anschluss).name)}</span></span>${schalter(f.container.includes(b.id), 'an-c', `data-id="${b.id}"`)}</div>`).join('')}
        <div class="leise">Ein Container hängt an genau einem Anschluss.</div>
        ${knopf('Speichern', 'an-speichern', 'amber')}${!neu && d.anschluesse.length > 1 ? knopf('Anschluss löschen', 'an-weg', 'rot') : ''}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'nachrichten') {
      // Beispiele mit echten Containern: bevorzugt der, auf den es gerade passt (offline, Tür offen, Gerät auf Hand)
      const B = d.bereiche, c = k => (B[k] || B[0] || { name: 'Container', id: '' });
      const wOff = d.warnungen.find(w => w.art === 'offline' && w.b), GB = B.flatMap(b => b.geraete.map(g => ({ b, g })));
      const off = (wOff && B.find(b => b.id === wOff.b)) || B.find(b => b.offline) || c(0);   // Container der Warnung „nicht erreichbar“
      const pumpe = B.find(b => b.pumpe), steck = GB.find(x => x.g.hand && !x.g.heizer) || GB.find(x => x.g.hand) || GB.find(x => !x.g.heizer && x.g.rolle !== 'pumpe');
      const n = (ic, titel, text, knoepfe, b) => `<div class="noti"><div class="noti-kopf"><span class="noti-app">🏗 Home Assistant · jetzt</span></div><b>${ic} ${esc(titel)}</b><div>${esc(text)}</div>
        ${d.e.knoepfe ? `<div class="noti-knoepfe">${knoepfe.map(k => `<button data-act="n-knopf" data-t="${k}" data-b="${b || ''}">${k}</button>`).join('')}</div>` : ''}</div>`;
      const tuer = B.find(b => b.tuer && b.tuer.offen) || B.find(b => b.tuer) || c(0), p = this.planTag(TAGE[(TAGE.indexOf(this.z.HEUTE_TAG) + 1) % 7]);
      const frueh = p ? p.vor - d.e.frueh_min : null;   // Frühstart; „Noch früher“ startet 30 min davor (Integration: laufzeit.frueher)
      return `${griff}<h3>Nachrichten aufs Handy</h3><div class="leise">So kommen sie in der Home-Assistant-App an. ${d.e.knoepfe ? 'Tippe einen Knopf zum Ausprobieren.' : 'Knöpfe sind ausgeschaltet.'}</div>
        ${n('⚠', `${off.name} nicht erreichbar`, 'Seit 10:42 keine Antwort – Stromausfall oder Stecker gezogen?', ['Zum Container', 'Bis morgen stumm'], off.id)}
        ${n('🚪', `${tuer.name}: Tür seit ${d.e.tuer_melden} min offen`, 'Die Heizung ist pausiert und heizt wieder, sobald die Tür zu ist.', ['Trotzdem heizen', '1 h stumm'], tuer.id)}
        ${n('❄', 'Morgen −4 °C', `Vorheizen startet schon um ${p ? uhr(frueh) : '05:30'}. Arbeitsbeginn ${p ? uhr(p.a) : '07:00'}.`, ['Morgen nicht heizen', `Noch früher (${p ? uhr(frueh - 30) : '05:00'})`])}
        ${n('✋', `${steck ? `${steck.g.n} ${steck.b.name}` : (pumpe ? pumpe.name : c(0).name)} seit ${d.e.hand_h} h auf Hand`, 'Von Hand eingeschaltet und nicht zurückgestellt.', ['Automatik übernehmen', 'So lassen'], steck ? steck.b.id : c(0).id)}
        <div class="leise">Die Knöpfe sind Aktionen der HA-App (mobile_app). Ein Tipp löst die Aktion aus und landet im Protokoll.</div>${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'bericht') {
      // Inhalt kommt von der Integration (baustelle/bericht) – dieselben Zahlen und Texte, die der Bericht verschickt
      const e = d.e, art = e.bericht === 'monat' ? 'monat' : 'woche';
      const v = !d.geladen ? null : this._holen(`b:${d.entry}:${art}:${d.z.HEUTE}:${e.bericht_mail}:${e.bericht_csv}:${e.mail}`, () => this._hass.callWS({ type: 'baustelle/bericht', entry_id: d.entry, art }), 120000);
      if (!v) return `${griff}<h3>Bericht · Beispiel</h3>${v === undefined ? LAEDT : '<div class="leer">Bericht nicht verfügbar</div>'}${knopf('Schließen', 'zu', 'leise-k')}`;
      return `${griff}<h3>Bericht · Beispiel</h3>
        <div class="mail"><div class="mail-kopf"><div><span class="leise">An</span> ${v.mail_an ? esc(v.mail_an) : '—'}</div><div><span class="leise">Betreff</span> ${esc(v.betreff)}</div>
          ${v.anhang ? `<div class="mail-anhang">📎 ${esc(v.anhang)}</div>` : ''}</div>
          <div class="mail-inhalt"><b>${esc(v.summe)}</b> ${v.vergleich ? `<span class="leise">${esc(v.vergleich)}</span>` : ''}
            <div class="mail-t">Je Firma</div>${(v.firmen || []).map(f => `<div class="mail-z"><span>${esc(f.name)}</span><span>${de(f.kwh, 0)} kWh · ${de(f.eur, 2)} €</span></div>`).join('') || '<div class="mail-z"><span>–</span></div>'}
            <div class="mail-t">Je Container</div>${(v.container || []).map(c => `<div class="mail-z"><span>${esc(c.name)}</span><span>${de(c.kwh, 0)} kWh</span></div>`).join('')}
            <div class="mail-t">Heizung</div><div class="mail-z"><span>Heiztage</span><span>${zahl(v.heiztage) ? v.heiztage : '–'}</span></div><div class="mail-z"><span>gespart durch Automatik</span><span>${zahl(v.gespart_eur) ? `${de(v.gespart_eur, 0)} €` : '–'}</span></div>
            <div class="mail-t">Offene Warnungen</div>${(v.warnungen || []).map(w => `<div class="mail-z"><span>${esc(w.bereich ? `${w.bereich}: ${w.titel}` : w.titel)}</span></div>`).join('') || '<div class="mail-z"><span>keine</span></div>'}</div></div>
        <div class="leise">${e.bericht_handy ? 'Aufs Handy kommt eine Kurzfassung (Summe, Kosten, Warnungen) mit Knopf „Bericht öffnen“. ' : ''}Die E-Mail geht über einen Mail-Dienst in HA (Google Mail oder SMTP); die Zugangsdaten stehen in secrets.yaml.</div>
        ${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'bedarf') {
      const b = d.bereiche.find(x => x.id === s.cid); if (!b) { this.s.sheet = null; return ''; }
      const ende = this.arbeitsende(), warm = b.t !== null ? Math.max(0, Math.round(((b.soll ?? d.e.soll) - b.t) * 4)) : null;
      return `${griff}<h3>${esc(b.name)} heizen</h3><div class="leise">Jetzt ${b.t !== null ? `${de(b.t)} °C` : 'ohne Fühler'} · wird ${b.t !== null ? `in etwa ${warm} min warm` : 'sofort eingeschaltet'}</div>
        <div class="zeile"><div><b>⚡ Schnell aufheizen</b><div class="leise">alle Heizkörper zugleich, Vorrang in der Staffelung</div></div>${schalter(s.boost, 'bedarf-boost')}</div>
        <div class="bedarf-dauer gross">${[['60', '1 Stunde'], ['120', '2 Stunden'], ...(ende ? [['ende', `bis Arbeitsende (${ende})`]] : []), ['abend', 'bis 19:00']].map(([v, t]) => `<button class="knopf" data-act="bedarf-an" data-id="${b.id}" data-v="${v}">▶ ${t}</button>`).join('')}</div>
        <button class="zeile" data-act="sheet" data-s="termin" data-id="${b.id}"><span class="blau">Lieber einen Termin eintragen</span><span class="chev">›</span></button>
        ${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'termin') {
      const f = s.form, kal = d.termineKal;
      return `${griff}<h3>Termin eintragen</h3>
        <label class="feld">Titel<input value="${esc(f.titel)}" placeholder="z. B. Baubesprechung" data-tm="titel"></label>
        <label class="feld">${f.wieder === 'einmal' ? 'Tag' : 'Ab (Wochentag gilt für die Serie)'}<input type="date" value="${f.datum}" data-tm="datum"></label>
        <div class="zeile"><span>Wiederholen</span><div class="seg klein">${Object.entries(WIEDER).map(([k, t]) => `<button data-act="tm-wieder" data-v="${k}" class="${f.wieder === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <div class="zeile"><div><b>⚡ Schnell aufheizen</b><div class="leise">vor dem Termin alle Heizkörper zugleich</div></div>${schalter(f.boost, 'tm-boost')}</div>
        <div class="raster-2"><label class="feld">von<input type="time" value="${f.von}" data-tm="von"></label><label class="feld">bis<input type="time" value="${f.bis}" data-tm="bis"></label></div>
        ${f.wieder !== 'einmal' && f.datum ? `<div class="leise">Serie: ${WIEDER[f.wieder]} am ${wtag(f.datum)} ab ${datum(f.datum)}</div>` : ''}
        <div class="leise">Kommt in den HA-Kalender „${esc(kal ? this.name(kal) : 'Termine')}“ (Serien als Wiederholung im Kalender). Die Heizung startet ${d.e.vorheizen} min vorher (Vorheizen) und hört zum Ende auf.</div>
        ${knopf('Eintragen', 'termin-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'melden') {
      const f = s.form;
      return `${griff}<h3>Melden</h3><div class="leise">Fehler, Wunsch oder Anregung – landet im Entwicklermenü.</div>
        <div class="seg">${[['fehler', 'Fehler'], ['wunsch', 'Wunsch'], ['anregung', 'Anregung']].map(([k, t]) => `<button data-act="ml-art" data-v="${k}" class="${f.art === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <label class="feld">${{ fehler: 'Was ist passiert, was hättest du erwartet?', wunsch: 'Was wünschst du dir?', anregung: 'Deine Idee' }[f.art]}<textarea rows="4" data-ml="text" placeholder="kurz beschreiben">${esc(f.text)}</textarea></label>
        <div class="ml-kontext"><div><span class="leise">Fenster</span> ${esc(f.kontext)}</div><div><span class="leise">Version</span> ${esc(this.version)} · ${f.geraet} · ${d ? `${wtag(d.z.HEUTE)} ${kurzDatum(d.z.HEUTE)} ${d.z.JETZT}` : ''}</div></div>
        <div class="zeile"><div><b>Stand der Seite mitschicken</b><div class="leise">Zustand und Einstellungen als Anhang – hilft beim Nachstellen, ohne Zugangsdaten</div></div>${schalter(f.stand, 'ml-stand')}</div>
        ${knopf('Senden', 'ml-senden', 'amber')}${knopf('Abbrechen', 'ml-zurueck', 'leise-k')}`;
    }
    if (s.art === 'ausnahme') {
      const f = s.form, az = this.azJetzt, z = az && az.tage[wtag(f.datum)];
      return `${griff}<h3>Ausnahme</h3>
        <label class="feld">Tag<input type="date" value="${f.datum}" data-au="datum"></label>
        <div class="leise">${wtag(f.datum)} ${kurzDatum(f.datum)} · laut Arbeitszeit ${z ? z.join('–') : 'frei'}</div>
        <div class="seg">${Object.entries(AUSNAHME).map(([k, t]) => `<button data-act="au-art" data-v="${k}" class="${f.art === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        ${f.art === 'frei' ? '<div class="leise">An diesem Tag wird nicht geheizt, nur der Frostschutz läuft.</div>'
          : `<div class="raster-2"><label class="feld">von<input type="time" value="${f.von}" data-au="von"></label><label class="feld">bis<input type="time" value="${f.bis}" data-au="bis"></label></div>
          <div class="leise">Vorheizen ${d.e.vorheizen} min und Nachheizen ${d.e.nachheizen} min gelten auch hier – geheizt wird ${uhr(minu(f.von) - d.e.vorheizen)}–${uhr(minu(f.bis) + d.e.nachheizen)}.</div>`}
        <label class="feld">Notiz<input value="${esc(f.notiz)}" placeholder="z. B. Betonieren" data-au="notiz"></label>
        ${knopf('Speichern', 'au-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'az-neu') {
      const f = s.form, aendern = f.alt_ab !== undefined;
      return `${griff}<h3>${aendern ? 'Arbeitszeit bearbeiten' : 'Neue Arbeitszeit'}</h3>
        <div class="raster-2"><label class="feld">Gilt ab<input type="date" value="${f.ab}" data-azn="ab"></label><label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Winter" data-azn="name"></label></div>
        ${TAGE.map(t => { const z = f.tage[t]; return `<div class="zeile azn"><b class="tag-n">${t}</b>${schalter(!!z, 'azn-tag', `data-t="${t}"`)}
          ${z ? `<input type="time" value="${z[0]}" data-azt="${t}" data-p="0"><span class="leise">bis</span><input type="time" value="${z[1]}" data-azt="${t}" data-p="1">` : '<span class="leise frei">frei</span>'}</div>`; }).join('')}
        <button class="zeile" data-act="azn-wie-mo"><span class="blau">Di–Do wie Montag</span></button>
        <div class="leise">${aendern ? 'Es gilt immer die jüngste Arbeitszeit, die schon begonnen hat.' : 'Die bisherige Arbeitszeit bleibt gespeichert. Liegt das Datum in der Zukunft, gilt die neue automatisch ab diesem Tag.'}
          ${d.arbeitszeiten.some(x => x.auto) ? ' Die automatisch angelegte Arbeitszeit fällt beim Speichern weg.' : ''}</div>
        ${knopf('Speichern', 'azn-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'container-neu') {
      const f = s.form, schacht = f.art === 'Pumpenschacht';
      const fuehler = this.entitaeten(x => (x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'temperature') || x.entity_id.startsWith('climate.'));
      return `${griff}<h3>Neuer Container</h3>
      <label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Lager Nord" data-neu="name"></label>
      <div class="feld">Art<div class="seg klein">${['Container', 'Pumpenschacht'].map(v => `<button data-act="neu-art" data-v="${v}" class="${f.art === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <label class="feld">Temperaturfühler<select data-neu="fuehler">${this.optionen(fuehler, f.fuehler, '– keiner –')}</select></label>
      <label class="feld">Shelly<select data-neu="schalter">${this.optionen(this.freieSchalter().map(([v, n]) => [v, `${n} (${v})`]), f.schalter, '– später –')}</select></label>
      <label class="feld">${schacht ? 'Gerät' : 'Heizkörper'}<select data-neu="typ">${this.optionen((schacht ? ['Pumpe'] : ['Ölradiator', 'Konvektor']).map(t => [t, t]), f.typ)}</select></label>
      ${knopf('Anlegen', 'neu-anlegen', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'bereich') {
      const b = this.b; if (!b) { this.s.sheet = null; return ''; }
      const e = s.edit ||= { bedarf: !!b.bedarf, name: b.name, anschluss: b.anschluss || (d.anschluesse[0] && d.anschluesse[0].id) || '', tuer: (b.tuer && b.tuer.eid) || '', firma: b.firma || 'eigen', fuehler: b.fuehler || '',
        geraete: b.geraete.map(g => ({ id: g.id, n: g.n, typ: g.typ, schalter: g.schalter, leistung: g.leistung, energie: g.energie, alt: { n: g.n, typ: g.typ } })) };
      const typen = b.pumpe ? ['Pumpe'] : ['Ölradiator', 'Konvektor', 'Bautrockner', 'Steckdose'];
      const wahl = (i, g) => `<select data-ge="typ" data-i="${i}">${typen.map(t => `<option ${g.typ === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      const tueren = this.entitaeten(x => x.entity_id.startsWith('binary_sensor.') && ['door', 'window', 'opening', 'garage_door'].includes(x.attributes.device_class));
      const fuehler = this.entitaeten(x => (x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'temperature') || x.entity_id.startsWith('climate.'));
      if (e.fuehler && !fuehler.some(x => x[0] === e.fuehler)) fuehler.unshift([e.fuehler, this.name(e.fuehler)]);
      if (e.tuer && !tueren.some(x => x[0] === e.tuer)) tueren.unshift([e.tuer, this.name(e.tuer)]);
      return `${griff}<div class="block-kopf"><h3>Bearbeiten</h3><span class="leise">${b.pumpe ? 'Pumpenschacht' : 'Container'}</span></div>
        <label class="feld">Name<input value="${esc(e.name)}" data-b="name"></label>
        ${b.pumpe ? '' : `<div class="zeile"><div><b>Nur bei Bedarf heizen</b><div class="leise">z. B. Besprechungscontainer: heizt nur per Schalter oder Termin, sonst Frostschutz</div></div>${schalter(e.bedarf, 'ge-bedarf')}</div>`}
        ${b.pumpe ? '' : `<label class="feld">Temperaturfühler<select data-bfu>${this.optionen(fuehler, e.fuehler, '– keiner –')}</select></label>`}
        ${b.pumpe ? '' : `<label class="feld">Türkontakt<select data-btuer>${this.optionen(tueren, e.tuer, 'keiner')}</select></label>`}
        <label class="feld">Stromanschluss<select data-ban>${d.anschluesse.map(a => `<option value="${esc(a.id)}" ${e.anschluss === a.id ? 'selected' : ''}>${esc(a.name)} · ${a.phasen === 3 ? '3 × ' : ''}${a.ampere} A</option>`).join('')}</select></label>
        <label class="feld">Firma · für die Abrechnung<select data-bf="firma">${d.firmen.map(f => `<option value="${esc(f.id)}" ${e.firma === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
        <div class="gruppe-t">${b.pumpe ? 'Pumpen' : 'Geräte'} · ${e.geraete.filter(g => !g.weg).length}</div>
        ${e.geraete.map((g, i) => g.weg ? `<div class="ge-zeile weg"><span>${esc(g.n)} wird entfernt</span><button class="chip glas-panel" data-act="ge-zurueck" data-i="${i}">rückgängig</button></div>`
          : `<div class="ge-zeile"><div class="ge-felder">
            ${g.neu ? `<select data-ge="schalter" data-i="${i}">${this.optionen(this.freieSchalter().map(([v, n]) => [v, `${n} (${v})`]), g.schalter, '– Shelly wählen –')}</select>` : `<span class="leise ge-shelly">${esc(this.name(g.schalter))} · ${esc(g.schalter)}</span>`}
            <div class="ge-zwei"><input value="${esc(g.n)}" data-ge="n" data-i="${i}" placeholder="Name">${wahl(i, g)}</div></div>
            <button class="x" data-act="ge-weg" data-i="${i}" title="Gerät entfernen">✕</button></div>`).join('')}
        <button class="zeile" data-act="ge-neu"><span class="blau">+ Gerät hinzufügen</span></button>
        <div class="leise">Der Heizkörpertyp gilt nur für den Vergleich Ölradiator/Konvektor. Entfernte Geräte behalten ihre Werte im Verlauf.</div>
        ${knopf('Speichern', 'b-speichern', 'amber')}${knopf('Container entfernen', 'b-weg', 'rot')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'zeitraum-bs') { const f = s.form;
      const mon = i => `<select data-hp="${i}">${MONATE.map((m, k) => `<option value="${k + 1}" ${f.hp[i] === k + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select>`;
      return `${griff}<h3>Beginn, Ende, Heizperiode</h3>
      <div class="raster-2"><label class="feld">Beginn<input type="date" value="${esc(f.beginn)}" data-bsz="beginn"></label><label class="feld">Ende (geplant)<input type="date" value="${esc(f.ende)}" data-bsz="ende"></label></div>
      <div class="leise">Gezählt wird ab Beginn. <b>Beginn leer</b> = automatisch der Tag, an dem die Baustelle angelegt wurde${this.d.beginnAuto && this.d.beginn ? ` (${datum(this.d.beginn)})` : ''}.
        <b>Ende leer</b> = offen; beim Abschließen wird immer der Tag des Abschließens eingetragen – ein geplantes Ende dient nur der Hochrechnung.</div>
      <div class="raster-2"><label class="feld">Heizperiode von${mon(0)}</label><label class="feld">bis${mon(1)}</label></div>
      <div class="leise">Die Auswertung rechnet Verbrauch und Kosten auf die Heizperiode hoch – bis zum Ende der Baustelle, wenn es früher liegt.</div>
      ${knopf('Speichern', 'bsz-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`; }
    /* AN-0002: ✎ im Dialog „Baustellen“ – nur die Daten dieser Baustelle; Staffelung, Bericht, Meldungen und App bleiben unter Einstellungen */
    if (s.art === 'bs-bearbeiten') {
      const e = d.e, o = d.optionen;
      return `${griff}<div class="block-kopf"><h3>Baustelle bearbeiten</h3><span class="leise">${esc(d.titel)}</span></div>
        <div class="gruppe-t">Baustelle</div>
        <button class="zeile" data-act="sheet" data-s="name"><span>Name</span><span class="leise">${esc(d.titel)} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="zeitraum-bs"><span>Beginn und Ende</span><span class="leise">${this.bsZeit(d)} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="zeitraum-bs"><span>Heizperiode</span><span class="leise">${MONATE[d.hp[0] - 1]} – ${MONATE[d.hp[1] - 1]} ›</span></button>
        <div class="gruppe-t">Ort</div>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Wetter</span><span class="leise">${o.wetter ? esc(this.name(o.wetter)) : 'keins gewählt'} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Außentemperatur</span><span class="leise">${o.temp_sensor ? esc(this.name(o.temp_sensor)) : 'aus der Vorhersage'} ›</span></button>
        <div class="gruppe-t">Container und Geräte · ${d.bereiche.length}</div>
        ${d.bereiche.map(b => `<button class="zeile" data-act="bereich-einst" data-id="${b.id}"><span><i class="farbpunkt" style="background:${BEREICH_FARBEN[b.f % 6]}"></i>${esc(b.name)}</span><span class="leise">${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'} ›</span></button>`).join('')}
        <button class="zeile" data-act="sheet" data-s="container-neu"><span class="blau">+ Container oder Schacht</span></button>
        <div class="gruppe-t">Strom und Abrechnung</div>
        <label class="zeile"><span>Preis je kWh</span><span class="eingabe"><input type="number" step="0.01" data-k="preis" value="${e.preis}"> €</span></label>
        ${d.firmen.map(f => { const n = d.bereiche.filter(b => (b.firma || 'eigen') === f.id).length;
          return `<button class="zeile" data-act="firma-auf" data-id="${esc(f.id)}"><span>${esc(f.name)}${f.eigen ? ' <span class="badge">eigene</span>' : ''}</span><span class="leise">${n} Container ›</span></button>`; }).join('')}
        <button class="zeile" data-act="firma-auf"><span class="blau">+ Firma hinzufügen</span></button>
        ${d.aktiv ? '<button class="zeile" data-act="sheet" data-s="abschliessen"><span>Baustelle abschließen</span><span class="leise">kommt in den Verlauf ›</span></button>' : ''}
        <div class="leise p-fuss">Staffelung, Bericht, Meldungen und App stehen unter Einstellungen.</div>
        <button class="zeile" data-act="tab" data-v="einst"><span class="blau">Alle Einstellungen</span><span class="chev">›</span></button>
        ${knopf('Fertig', 'zu', 'amber')}`;
    }
    if (s.art === 'abschliessen') return `${griff}<h3>Baustelle abschließen?</h3><div class="leise">Die Heizung wird abgeschaltet. Als Ende wird heute (${datum(this.z.HEUTE)}) eingetragen. Werte und Diagramme bleiben im Verlauf, gelöscht wird nichts.</div>${knopf('Abschließen', 'abschliessen', 'rot')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    if (s.art === 'urlaub') {
      if (!d.optionen.urlaub_kalender) return `${griff}<h3>Urlaub eintragen</h3><div class="leise">Zuerst einen Kalender für den Urlaub wählen.</div>${knopf('Kalender wählen', 'wetterquelle-auf', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
      return `${griff}<h3>Urlaub eintragen</h3><label class="feld">Name<input value="${esc(s.form.name)}" placeholder="z. B. Semesterferien" data-ur="name"></label>
      <div class="raster-2"><label class="feld">Von<input type="date" value="${s.form.von}" data-ur="von"></label><label class="feld">Bis<input type="date" value="${s.form.bis}" data-ur="bis"></label></div>
      <div class="leise">Wird in den Kalender „${esc(this.name(d.optionen.urlaub_kalender))}“ eingetragen; in der Zeit läuft nur der Frostschutz.</div>${knopf('Eintragen', 'urlaub-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'wetterquelle') {
      const f = s.form, kal = this.entitaeten(x => x.entity_id.startsWith('calendar.'));
      return `${griff}<h3>Wetter</h3>
        <label class="feld">Wetter<select data-wq="wetter">${this.optionen(this.entitaeten(x => x.entity_id.startsWith('weather.')), f.wetter, '– keins –')}</select></label>
        <label class="feld">Außentemperatur<select data-wq="temp_sensor">${this.optionen(this.entitaeten(x => x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'temperature'), f.temp_sensor, 'aus der Vorhersage')}</select></label>
        <label class="feld">Regenmenge<select data-wq="regen_sensor">${this.optionen(this.entitaeten(x => x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'precipitation'), f.regen_sensor, 'aus der Vorhersage')}</select></label>
        <div class="gruppe-t">Kalender</div>
        <label class="feld">Urlaub<select data-wq="urlaub_kalender">${this.optionen(kal, f.urlaub_kalender, '– keiner –')}</select></label>
        <label class="feld">Feiertage<select data-wq="feiertag_kalender">${this.optionen(kal, f.feiertag_kalender, '– keiner –')}</select></label>
        <label class="feld">Termine (Container nur bei Bedarf)<select data-wq="termine_kalender">${this.optionen(kal, f.termine_kalender, '– keiner –')}</select></label>
        ${knopf('Speichern', 'wetterquelle-speichern', 'amber')}`;
    }
    return `${griff}<h3>${{ name: 'Name', 'baustelle-neu': 'Neue Baustelle' }[s.art] || ''}</h3>
      <label class="feld">Name<input value="${esc(s.form ? s.form.name : '')}" placeholder="z. B. Wohnbau Kalsdorf" data-nm="name"></label>
      ${knopf('Speichern', s.art === 'name' ? 'name-speichern' : 'baustelle-anlegen', 'amber')}`;
  }

  /* ---- Aufrufe an die Integration (docs/api-0.7.md §2) und an HA ---- */
  fehlerText(e) { return (e && e.body && e.body.message) || (e && e.message) || (e && e.code) || String(e); }
  async ws(msg, ok) {
    try { const r = await this._hass.callWS(msg); if (ok) this.toast(ok); return r === undefined ? true : r; }
    catch (e) { this.toast(`Fehler: ${this.fehlerText(e)}`); return null; }
    finally { this._laden(); }
  }
  /* Einstellung setzen: sofort anzeigen, dann an die Integration (Pfad wie im Store) */
  setzen(pfad, wert, ok) {
    const r = this.d && this.d.r;
    this._rohText = null;   // Antwort der Integration immer übernehmen (auch wenn sie den Wert ablehnt)
    if (r) { let o = r.einstellungen ||= {}; for (const k of pfad.slice(0, -1)) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; o[pfad[pfad.length - 1]] = wert; this._neuBauen(); this.render(); }
    return this.ws({ type: 'baustelle/setzen', entry_id: this.d.entry, pfad, wert }, ok);
  }
  aktion(aktion, felder, ok) { return this.ws({ type: 'baustelle/aktion', entry_id: this.d.entry, aktion, ...felder }, ok); }
  liste(liste, aktion, eintrag, ok) { return this.ws({ type: 'baustelle/liste', entry_id: this.d.entry, liste, aktion, eintrag }, ok); }
  /* Einrichtungs-Dialoge von HA (dieselben wie unter Einstellungen → Geräte & Dienste) */
  async dialog(pfad, start, daten) {
    const form = await this._hass.callApi('POST', pfad, start);
    if (!form || form.type !== 'form') return form;
    return this._hass.callApi('POST', `${pfad}/${form.flow_id}`, daten);
  }
  flowFehler(r) { return r && ((r.type === 'form' && r.errors && (r.errors.base || Object.values(r.errors)[0])) || (r.type === 'abort' && !['reconfigure_successful'].includes(r.reason) && r.reason)); }
  async einrichten(lauf, ok) {
    try { const r = await lauf(); const f = this.flowFehler(r); if (f) { this.toast(`Nicht gespeichert: ${f}`); return null; } if (ok) this.toast(ok); return r || true; }
    catch (e) { this.toast(`Fehler: ${this.fehlerText(e)}`); return null; }
  }
  optionenSpeichern(x, aenderung) {
    const o = { ...x.optionen, ...aenderung };
    for (const k of Object.keys(o)) if (o[k] === '' || o[k] === null || o[k] === undefined) delete o[k];
    return this.dialog('config/config_entries/options/flow', { handler: x.entry }, o);
  }
  bereichDaten(name, art, fuehler) { return { name, art, ...(fuehler ? { fuehler } : {}) }; }
  geraetDaten(bid, g) { const [rolle, typ] = TYP_ROLLE[g.typ] || TYP_ROLLE.Ölradiator;
    return { bereich: bid, schalter: g.schalter, name: (g.n || '').trim() || this.name(g.schalter) || g.typ, rolle, typ: typ === 'oelradiator' && rolle !== 'heizkoerper' ? 'konvektor' : typ,
      ...(g.leistung ? { leistung: g.leistung } : {}), ...(g.energie ? { energie: g.energie } : {}) }; }
  async bereichAnlegen(name, schacht) {
    const r = await this.dialog('config/config_entries/subentries/flow', { handler: [this.d.entry, 'bereich'] }, this.bereichDaten(name, schacht ? 'pumpenschacht' : 'container'));
    const f = this.flowFehler(r); if (f) throw new Error(f);
    return r;
  }
  async neueIds(namen) { await this._laden(); return namen.map(n => (this.d.bereiche.find(b => b.name === n) || {}).id).filter(Boolean); }
  morgenFrueh() { return new Date(this.zoneMs(plusTage(this.z.HEUTE, 1), '07:00', this.z.zone)).toISOString(); }   // „bis morgen stumm“ = morgen 07:00
  isoHeute(hhmm) { return new Date(this.zoneMs(this.z.HEUTE, hhmm, this.z.zone)).toISOString(); }

  /* ---- Aktionen ---- */
  klick(ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, d = this.d, b = this.b, S = this.s;
    const neu = () => this.render();
    switch (a) {
      case 'menue': return this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true }));
      case 'tab': return this.gehe(el.dataset.v);
      case 'neu-laden': return this.neuLaden();
      case 'container': S.chart = 'temp'; return this.gehe('container', el.dataset.id);
      case 'w-hin': return this.gehe('container', el.dataset.id);
      case 'w-stumm': { const w = d.warnungen.find(x => x.id === el.dataset.id); if (!w) return;
        return this.aktion('warnung_stumm', { key: w.key, bis: w.stumm ? null : this.morgenFrueh() }, w.stumm ? 'Wird wieder gemeldet' : 'Stumm bis morgen – bleibt im Protokoll'); }
      case 'w-protokoll': S.verlauf = 'aktiv'; S.pfilter = 'warnung'; return this.gehe('verlauf');
      case 'pfilter': S.pfilter = el.dataset.v; S.pmehr = false; return neu();
      case 'pmehr': S.pmehr = true; return neu();
      case 'sheet': {
        const art = el.dataset.s;
        if (art === 'termin') { S.sheet = { art: 'termin', form: { b: el.dataset.id || S.cid, titel: '', datum: plusTage(this.z.HEUTE, 7), von: '09:00', bis: '10:00', wieder: 'einmal', boost: false } }; return neu(); }
        if (art === 'urlaub') { S.sheet = { art: 'urlaub', form: { name: '', von: plusTage(this.z.HEUTE, 14), bis: plusTage(this.z.HEUTE, 18) } }; return neu(); }
        if (art === 'container-neu') { S.sheet = { art, form: { name: '', art: 'Container', fuehler: '', schalter: '', typ: 'Ölradiator' } }; return neu(); }
        if (art === 'wetterquelle') { const o = d.optionen; S.sheet = { art, form: { wetter: o.wetter || '', temp_sensor: o.temp_sensor || '', regen_sensor: o.regen_sensor || '', urlaub_kalender: o.urlaub_kalender || '', feiertag_kalender: o.feiertag_kalender || '', termine_kalender: d.termineKal || '' } }; return neu(); }
        if (art === 'bs-loeschen') { S.sheet = { art, id: el.dataset.id }; return neu(); }
        if (art === 'zeitraum-bs') { S.sheet = { art, form: { beginn: d.beginnAuto ? '' : d.beginn || '', ende: d.ende || '', hp: [...d.hp] } }; return neu(); }
        if (art === 'name' || art === 'baustelle-neu') { S.sheet = { art, form: { name: art === 'name' && d ? d.titel : '' } }; return neu(); }
        S.sheet = { art, t: el.dataset.t, i: +el.dataset.i, auswahl: el.dataset.id ? [el.dataset.id] : [], zeitraum: 'Tag' }; return neu(); }
      case 'wetterquelle-auf': return this.klick({ target: { closest: () => ({ dataset: { act: 'sheet', s: 'wetterquelle' } }) } });
      case 'wa': S.sheet.wa = el.dataset.v; return neu();
      case 'vb-gruppe': { const st = el.dataset.ziel === 'aw' ? S.aw : S.sheet; st.gruppe = el.dataset.v; st.auswahl = this.quellen(st, el.dataset.ziel).map(q => q.id); return neu(); }
      case 'aw-scope': S.awScope = el.dataset.v; S.aw.auswahl = this.quellen(S.aw, 'aw').map(q => q.id); return neu();
      case 'vb-zeitraum': (el.dataset.ziel === 'aw' ? S.aw : S.sheet).zeitraum = el.dataset.v; return neu();
      case 'vb-wer': { const sh = el.dataset.ziel === 'aw' ? S.aw : S.sheet, id = el.dataset.id;
        if (!id) sh.auswahl = []; else if (id === '*') sh.auswahl = this.quellen(sh, el.dataset.ziel || 'sheet').map(q => q.id);
        else sh.auswahl = sh.auswahl.includes(id) ? sh.auswahl.filter(x => x !== id) : [...sh.auswahl, id];
        return neu(); }
      case 'bereich-einst': S.cid = el.dataset.id; S.sheet = { art: 'bereich' }; return neu();
      case 'zu': S.sheet = null; return neu();
      case 'melden': { const namen = { uebersicht: 'Übersicht', container: 'Container', heizung: 'Heizung', auswertung: 'Auswertung', verlauf: 'Verlauf', einst: 'Einstellungen', ueber: 'Über', dev: 'Entwicklung', bsdetail: 'Baustelle (abgeschlossen)' };
        const kontext = [namen[S.view] || S.view, S.view === 'container' && this.b ? this.b.name : '', S.sheet ? `Dialog „${S.sheet.art}“` : ''].filter(Boolean).join(' · ');
        const breite = this.root && this.root.getBoundingClientRect ? this.root.getBoundingClientRect().width : 1000, geraet = breite < 700 ? 'Handy' : 'Desktop';
        S.sheet = { art: 'melden', vorher: S.sheet, form: { art: 'wunsch', text: '', kontext, geraet, stand: true } }; return neu(); }
      case 'ml-art': S.sheet.form.art = el.dataset.v; return neu();
      case 'ml-stand': S.sheet.form.stand = !S.sheet.form.stand; return neu();
      case 'ml-zurueck': S.sheet = S.sheet.vorher || null; return neu();
      case 'ml-senden': { const f = S.sheet.form; if (!f.text.trim()) return this.toast('Bitte kurz beschreiben');
        // „Stand der Seite mitschicken“ → Feld `seite` (api §5; `stand` ist in der Integration der Zeitpunkt der Statusänderung)
        const meldung = { art: f.art, text: f.text.trim(), kontext: f.kontext, version: this.version, geraet: f.geraet,
          seite: f.stand ? { view: S.view, cid: S.cid, baustelle: d ? d.entry : null, dialog: S.sheet.vorher ? S.sheet.vorher.art : null } : null };
        S.sheet = S.sheet.vorher || null; neu(); delete this.cache.meldungen;
        return this.ws({ type: 'baustelle/meldung', entry_id: d && d.entry, aktion: 'neu', meldung }).then(r => { if (r) this.toast(`Danke – gemeldet als ${r.ticket || 'Ticket'}`); }); }
      case 'mfilter': S.mfilter = el.dataset.v; return neu();
      case 'm-status': { const m = (this.meldungen() || []).find(x => x.id === el.dataset.id); if (!m) return; delete this.cache.meldungen;
        return this.ws({ type: 'baustelle/meldung', entry_id: d.entry, aktion: 'status', meldung_id: m.id, status: this.meldungOffen(m) ? 'geschlossen' : 'neu' }); }
      case 'm-weg': delete this.cache.meldungen; return this.ws({ type: 'baustelle/meldung', entry_id: d.entry, aktion: 'loeschen', meldung_id: el.dataset.id }, 'Meldung gelöscht');
      case 'm-md': { const md = this.meldungenMarkdown(); if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(md).catch(() => {}); return this.toast(`${(this.meldungen() || []).length} Meldungen als Markdown kopiert`); }
      case 'm-json': this.datei(JSON.stringify(this.meldungen() || [], null, 2), 'baustelle-meldungen.json', 'application/json'); return this.toast('baustelle-meldungen.json');
      case 'cl': { const i = +el.dataset.i; S.cl = (S.cl ?? 0) === i ? -1 : i; return neu(); }
      case 'toast': return this.toast(el.dataset.t);
      case 'diagnose': return this.ws({ type: 'auth/sign_path', path: `/api/diagnostics/config_entry/${d.entry}` }).then(r => { if (r && r.path) { this.herunterladen(r.path, `baustelle-${d.entry}.json`); this.toast('Diagnose wird heruntergeladen (wie in HA unter Geräte & Dienste)'); } });
      case 'auto': return this.setzen(['automatik'], !d.e.auto, !d.e.auto ? 'Automatik ein' : 'Automatik aus – Geräte bleiben, wie sie sind');
      case 'bedarf-auf': S.sheet = { art: 'bedarf', cid: el.dataset.id, boost: false }; return neu();
      case 'bedarf-an': { const x = d.bereiche.find(y => y.id === el.dataset.id), v = el.dataset.v, boost = !!(S.sheet && S.sheet.art === 'bedarf' && S.sheet.boost);
        const felder = v === 'ende' ? { bis: this.isoHeute(this.arbeitsende() || '16:30') } : v === 'abend' ? { bis: this.isoHeute('19:00') } : { minuten: +v };
        const bisText = v === 'ende' ? this.arbeitsende() : v === 'abend' ? '19:00' : uhr(minu(this.z.JETZT) + +v);
        S.sheet = null; neu(); return this.aktion('bedarf', { bereich: x.id, ...felder, boost }, `${x.name} heizt bis ${bisText}`); }
      case 'bedarf-aus': { const x = d.bereiche.find(y => y.id === el.dataset.id); return this.aktion('bedarf_aus', { bereich: x.id }, `${x.name} aus – nur Frostschutz`); }
      case 'termin-weg': { const t = d.termine[+el.dataset.i]; if (!t) return; if (!t.uid) return this.toast('Dieser Kalender nennt keine Kennung – Termin bitte im Kalender löschen');
        return this.ws({ type: 'calendar/event/delete', entity_id: d.termineKal, uid: t.uid }, `Termin „${t.titel}“ gelöscht`); }
      case 'termin-speichern': { const f = S.sheet.form; if (!f.titel.trim() || !f.datum || f.bis <= f.von) return this.toast('Bitte Titel, Tag und Uhrzeit prüfen');
        if (!d.termineKal) return this.toast('Zuerst einen Kalender für Termine wählen');
        const ev = { summary: f.titel.trim(), dtstart: `${f.datum}T${f.von}:00`, dtend: `${f.datum}T${f.bis}:00`, description: `baustelle:${f.b}${f.boost ? '\nboost' : ''}` };   // Zuordnung zum Container (api §4)
        if (f.wieder !== 'einmal') ev.rrule = f.wieder === 'woche' ? 'FREQ=WEEKLY' : 'FREQ=WEEKLY;INTERVAL=2';
        S.sheet = null; neu();
        return this.ws({ type: 'calendar/event/create', entity_id: d.termineKal, event: ev }, `Eingetragen${f.wieder !== 'einmal' ? ` – ${WIEDER[f.wieder]} am ${wtag(f.datum)}` : ''} – heizt ab ${uhr(minu(f.von) - d.e.vorheizen)}`); }
      case 'bedarf-boost': S.sheet.boost = !S.sheet.boost; return neu();
      case 'tm-wieder': S.sheet.form.wieder = el.dataset.v; return neu();
      case 'tm-boost': S.sheet.form.boost = !S.sheet.form.boost; return neu();
      case 'boost': { const x = d.bereiche.find(y => y.id === el.dataset.id); return this.aktion('boost', { bereich: x.id, an: !x.boost }, !x.boost ? `${x.name}: schnell aufheizen` : `${x.name}: normal weiter`); }
      case 'hz-art': S.hzArt = el.dataset.v; return neu();
      case 'hz-tag': S.hzTag = el.dataset.v; if (el.dataset.art) S.hzArt = 'tag'; return neu();
      case 'ausn-neu': { const v = el.dataset.v, az = (this.azJetzt || { tage: {} }).tage, h = this.z.HEUTE, morgen = plusTage(h, 1);
        const sa = plusTage(h, (5 - (new Date(h + 'T12:00:00Z').getUTCDay() + 6) % 7 + 7) % 7 || 7);   // nächster Samstag
        const vor = { 'heute-laenger': { datum: h, art: 'zeiten', von: (az[wtag(h)] || ['07:00'])[0], bis: '18:00', notiz: 'heute länger' },
          'morgen-spaeter': { datum: morgen, art: 'zeiten', von: '09:00', bis: (az[wtag(morgen)] || ['', '16:30'])[1], notiz: 'morgen später' },
          samstag: { datum: sa, art: 'arbeit', von: '07:00', bis: '12:00', notiz: '' }, frei: { datum: morgen, art: 'frei', von: '07:00', bis: '16:30', notiz: '' } }[v]
          || { datum: plusTage(h, 7), art: 'zeiten', von: '07:00', bis: '16:30', notiz: '' };
        S.sheet = { art: 'ausnahme', form: { ...vor } }; return neu(); }
      case 'au-art': S.sheet.form.art = el.dataset.v; return neu();
      case 'au-speichern': { const f = S.sheet.form; if (!f.datum || (f.art !== 'frei' && f.bis <= f.von)) return this.toast('Bitte Tag und Uhrzeit prüfen');
        S.sheet = null; neu();
        return this.liste('ausnahmen', 'speichern', { datum: f.datum, art: f.art, von: f.von, bis: f.bis, notiz: f.notiz.trim() }, `Ausnahme ${wtag(f.datum)} ${kurzDatum(f.datum)} gespeichert`); }
      case 'ausn-weg': return this.liste('ausnahmen', 'loeschen', { datum: el.dataset.d }, 'Ausnahme gelöscht – es gilt wieder die Arbeitszeit');
      case 'jetzt-an': return this.aktion('jetzt_heizen', { minuten: 60 }, `Alle heizen bis ${uhr(minu(this.z.JETZT) + 60)}`);
      case 'jetzt-aus': return this.aktion('jetzt_heizen', { minuten: null }, 'Zurück zum Plan');
      case 'b-auto': return this.setzen(['bereiche', b.id, 'auto'], !b.auto);
      case 'hz-auf': S.sheet = { art: 'hz', k: el.dataset.k }; return neu();
      case 'modus': { const x = d.bereiche.find(y => y.id === el.dataset.id), m = el.dataset.v; if (!x || x.modus === m) return undefined;
        return this.setzen(['bereiche', x.id, 'modus'], m, `${x.name}: ${(MODI.find(q => q[0] === m) || [m, m])[1]}`); }
      case 'p-chart': S.pchart = el.dataset.v; return neu();
      case 'tv': S.tv = el.dataset.v; return neu();
      case 'test-meldung': return this.aktion('test_meldung', {}).then(r => { if (r && r.an) this.toast(r.an.length ? `Test-Nachricht an ${r.an.join(', ')} gesendet` : 'Kein Empfänger – bitte unter Meldungen wählen'); });
      case 'bsz-speichern': { const f = S.sheet.form; if (f.ende && f.ende < (f.beginn || (d.beginnAuto ? d.beginn : ''))) return this.toast('Bitte Beginn und Ende prüfen');
        S.sheet = null; neu();
        return this.einrichten(() => this.optionenSpeichern(d, { beginn: f.beginn || null, ende: f.ende || null, heizperiode_von: String(f.hp[0]), heizperiode_bis: String(f.hp[1]) }), 'Gespeichert').then(() => this._laden()); }
      case 'b-trocknen': case 'tr-b': { const x = a === 'tr-b' ? d.bereiche.find(y => y.id === el.dataset.id) : b; return this.setzen(['bereiche', x.id, 'trocknen'], !x.trocknen); }
      case 'geraet': { const g = b.geraete[+el.dataset.i]; return this.aktion('schalten', { geraet: g.id, an: !g.an }, b.auto && d.e.auto ? 'Handbetrieb bis zum nächsten Schaltpunkt' : undefined); }
      case 'chart': S.chart = el.dataset.c; return neu();
      case 'verlauf': S.verlauf = el.dataset.v; return neu();
      case 'basis': return this.setzen(PFAD.basis, el.dataset.v === 'jetzt' ? 'jetzt' : 'tageshoechst');
      case 'e-bool': { const k = el.dataset.k;
        if (ARTEN[k]) return this.setzen(['meldungen_einst', 'arten', ARTEN[k]], !d.e[k]);
        return this.setzen(PFAD[k], !d.e[k]); }
      case 'st': { const k = el.dataset.k, [min, max] = GRENZEN[k] || [0, 1e9];
        const wert = Math.min(max, Math.max(min, Math.round((d.e[k] + +el.dataset.d) * 10) / 10)); if (wert === d.e[k]) return undefined;
        if (k === 'frost_aus' && wert <= d.e.frost_temp) return this.toast('„aus über“ muss über „ein unter“ liegen');
        if (k === 'frost_temp' && wert >= d.e.frost_aus) return this.toast('„ein unter“ muss unter „aus über“ liegen');
        return this.setzen(PFAD[k], wert); }
      case 'jc-auto': { const x = d.bereiche.find(y => y.id === el.dataset.id); return this.setzen(['bereiche', x.id, 'auto'], !x.auto); }
      case 'jc-soll': { const x = d.bereiche.find(y => y.id === el.dataset.id), [min, max] = GRENZEN.soll;
        return this.setzen(['bereiche', x.id, 'soll'], Math.min(max, Math.max(min, Math.round(((x.soll ?? d.e.soll) + +el.dataset.d) * 2) / 2))); }
      case 'urlaub-weg': { const u = (this.urlaube() || [])[+el.dataset.i]; if (!u) return; delete this.cache['k:' + d.optionen.urlaub_kalender];
        return this.ws({ type: 'calendar/event/delete', entity_id: d.optionen.urlaub_kalender, uid: u.uid, ...(u.recurrence_id ? { recurrence_id: u.recurrence_id } : {}) }, `${u.name} gelöscht`); }
      case 'urlaub-speichern': { const f = S.sheet.form; if (!f.von || !f.bis || f.bis < f.von) return this.toast('Bitte Von und Bis prüfen');
        S.sheet = null; neu(); delete this.cache['k:' + d.optionen.urlaub_kalender];
        return this.ws({ type: 'calendar/event/create', entity_id: d.optionen.urlaub_kalender, event: { summary: f.name.trim() || 'Urlaub', dtstart: f.von, dtend: plusTage(f.bis, 1) } }, 'Eingetragen – in der Zeit nur Frostschutz'); }
      case 'vgl': S.vglArt = el.dataset.v; return neu();
      case 'bs-oeffnen': case 'bs-wahl': { const x = this.alle.find(y => y.entry === el.dataset.id); if (!x) return;
        if (x.aktiv) { this.bid = x.entry; this._merken(); this._neuBauen(); this._vorhersageAbo(); this._stimmung(true); S.aw = null; return this.gehe('uebersicht'); }
        S.bs = x.entry; return this.gehe('bsdetail'); }
      case 'bs-bearbeiten': { const x = this.alle.find(y => y.entry === el.dataset.id); if (!x) return;   // aktiv → „Baustelle bearbeiten“ (AN-0002), abgeschlossen → Detailseite (wieder aktiv setzen)
        if (!x.aktiv) { S.bs = x.entry; return this.gehe('bsdetail'); }
        if (x.entry !== this.bid) { this.bid = x.entry; this._merken(); this._neuBauen(); this._vorhersageAbo(); this._stimmung(true); S.aw = null; }
        S.sheet = { art: 'bs-bearbeiten' }; return neu(); }
      case 'bs-loeschen': { const x = this.alle.find(y => y.entry === S.sheet.id); S.sheet = null; if (!x) return neu();
        const weg = (d && d.entry === x.entry) || (S.view === 'bsdetail' && S.bs === x.entry); neu();
        return this.einrichten(() => this._hass.callApi('DELETE', `config/config_entries/entry/${x.entry}`), `${x.titel} gelöscht`)
          .then(r => { if (!r) return; this._rohText = null; return this._laden().then(() => { if (weg) this.gehe('uebersicht'); }); }); }
      case 'bs-aktiv': { const x = this.alle.find(y => y.entry === el.dataset.t); if (!x) return;
        return this.einrichten(() => this.optionenSpeichern(x, { status: 'aktiv', ende: null }), 'Baustelle wieder aktiv – Automatik bleibt aus, bis du sie einschaltest').then(() => this._laden()); }
      case 'csv': return this.csv(el.dataset.art);
      case 'firma-auf': { const f = el.dataset.id ? this.firma(el.dataset.id) : null;
        S.sheet = { art: 'firma', form: { id: f && f.id, name: (f && f.name) || '', neu: [], container: f ? d.bereiche.filter(x => (x.firma || 'eigen') === f.id).map(x => x.id) : [] } }; return neu(); }
      case 'firma-c': { const c = S.sheet.form.container, id = el.dataset.id; S.sheet.form.container = c.includes(id) ? c.filter(x => x !== id) : [...c, id]; return neu(); }
      case 'firma-speichern': { const f = S.sheet.form; if (!f.name.trim()) return this.toast('Bitte einen Namen eingeben');
        const neue = f.neu.filter(c => c.name.trim());
        S.sheet = null; neu();
        return (async () => {
          let ids = [];
          if (neue.length) { try { for (const c of neue) await this.bereichAnlegen(c.name.trim(), c.art === 'Schacht'); ids = await this.neueIds(neue.map(c => c.name.trim())); } catch (e) { return this.toast(`Nicht angelegt: ${this.fehlerText(e)}`); } }
          return this.liste('firmen', 'speichern', { ...(f.id ? { id: f.id } : {}), name: f.name.trim(), container: [...f.container, ...ids] }, `${f.name.trim()} gespeichert${neue.length ? ` · ${neue.length} Container angelegt` : ''}`);
        })(); }
      case 'fc-neu': S.sheet.form.neu.push({ name: '', art: 'Container' }); return neu();
      case 'fc-weg': S.sheet.form.neu.splice(+el.dataset.i, 1); return neu();
      case 'fc-art': S.sheet.form.neu[+el.dataset.i].art = el.dataset.v; return neu();
      case 'firma-weg': { const id = S.sheet.form.id; S.sheet = null; neu(); return this.liste('firmen', 'loeschen', { id }, 'Firma gelöscht – Container gehören wieder der eigenen Firma'); }
      case 'e-wert': { const v = el.dataset.v; return this.setzen(PFAD[el.dataset.k], isNaN(+v) ? v : +v); }
      case 'prio': return this.setzen(['bereiche', el.dataset.id, 'prio'], el.dataset.v);
      case 'n-knopf': return this.toast(`„${el.dataset.t}“ – so reagierst du direkt aus der Nachricht`);
      case 'bericht-senden': { const art = d.e.bericht === 'monat' ? 'monat' : 'woche'; return this.aktion('bericht_senden', { art }, `Bericht für ${art === 'monat' ? 'den Vormonat' : 'die Vorwoche'} gesendet`); }
      case 'anschluss-auf': { const x = el.dataset.id ? this.anschluss(el.dataset.id) : null;
        S.sheet = { art: 'anschluss', form: { id: x && x.id, name: (x && x.name) || '', ampere: (x && x.ampere) || 32, phasen: (x && x.phasen) || 3, reserve: x ? x.reserve : 3, container: x ? d.bereiche.filter(y => y.anschluss === x.id).map(y => y.id) : [] } }; return neu(); }
      case 'an-wert': S.sheet.form[el.dataset.k] = +el.dataset.v; return neu();
      case 'an-res': S.sheet.form.reserve = Math.max(0, S.sheet.form.reserve + +el.dataset.d); return neu();
      case 'an-c': { const c = S.sheet.form.container, id = el.dataset.id; S.sheet.form.container = c.includes(id) ? c.filter(x => x !== id) : [...c, id]; return neu(); }
      case 'an-speichern': { const f = S.sheet.form; if (!f.name.trim()) return this.toast('Bitte einen Namen eingeben');
        S.sheet = null; neu();
        return this.liste('anschluesse', 'speichern', { ...(f.id ? { id: f.id } : {}), name: f.name.trim(), ampere: f.ampere, phasen: f.phasen, reserve_kw: f.reserve, container: f.container }, `${f.name.trim()} gespeichert`); }
      case 'an-weg': { const id = S.sheet.form.id, rest = d.anschluesse.find(x => x.id !== id); S.sheet = null; neu();
        return this.liste('anschluesse', 'loeschen', { id }, `Gelöscht – Container hängen jetzt an ${rest ? rest.name : 'keinem Anschluss'}`); }
      case 'tab-einst': return this.gehe('einst');
      case 'az-alt': S.azAlt = !S.azAlt; return neu();
      case 'az-heizung': return this.gehe('heizung');
      case 'az-neu': case 'az-vorlage': { const v = a === 'az-vorlage' ? d.arbeitszeiten[S.sheet.i] : this.azJetzt;
        const tage = v ? JSON.parse(JSON.stringify(v.tage)) : { Mo: ['07:00', '16:30'], Di: ['07:00', '16:30'], Mi: ['07:00', '16:30'], Do: ['07:00', '16:30'], Fr: ['07:00', '12:30'], Sa: null, So: null };
        const mo = plusTage(this.z.WOCHE_ISO[0], 7);
        S.sheet = { art: 'az-neu', form: { ab: mo, name: '', tage } }; return neu(); }
      case 'az-bearbeiten': { const v = d.arbeitszeiten[S.sheet.i]; if (!v) return;   // FE-0002
        S.sheet = { art: 'az-neu', form: { alt_ab: v.ab, ab: v.ab, name: v.auto ? '' : v.name, tage: JSON.parse(JSON.stringify(v.tage)) } }; return neu(); }
      case 'az-weg': { if (d.arbeitszeiten.length < 2) return this.toast('Die letzte Arbeitszeit bleibt'); const x = d.arbeitszeiten[S.sheet.i]; S.sheet = null; neu(); return this.liste('arbeitszeiten', 'loeschen', { ab: x.ab }, `${x.name} gelöscht`); }
      case 'azn-tag': { const t = el.dataset.t, f = S.sheet.form; f.tage[t] = f.tage[t] ? null : [...(f.tage.Mo || ['07:00', '16:30'])]; return neu(); }
      case 'azn-wie-mo': { const f = S.sheet.form; for (const t of ['Di', 'Mi', 'Do']) f.tage[t] = f.tage.Mo ? [...f.tage.Mo] : null; return neu(); }
      case 'azn-speichern': { const f = S.sheet.form;
        if (!f.ab) return this.toast('Bitte ein Startdatum wählen');
        if (d.arbeitszeiten.some(x => x.ab === f.ab && x.ab !== f.alt_ab && !x.auto)) return this.toast(`Ab ${datum(f.ab)} gibt es schon eine Arbeitszeit`);
        const tage = Object.fromEntries(TAGE.map((t, k) => [String(k), f.tage[t] ? [...f.tage[t]] : null]));
        // gilt die neue gleich? – jüngste begonnene; die automatische zählt nicht mehr (FE-0002)
        const bleiben = d.arbeitszeiten.filter(x => x.ab !== f.alt_ab && !x.auto), gilt = f.ab <= this.z.HEUTE && !bleiben.some(x => x.ab > f.ab && x.ab <= this.z.HEUTE);
        const text = f.ab > this.z.HEUTE ? `Geplant – gilt ab ${datum(f.ab)}` : gilt ? (f.alt_ab !== undefined ? 'Gespeichert – gilt jetzt' : 'Gilt jetzt – die bisherige bleibt gespeichert') : 'Gespeichert – eine jüngere Arbeitszeit gilt weiter';
        S.sheet = null; neu();
        return this.liste('arbeitszeiten', 'speichern', { ab: f.ab, name: f.name.trim() || `ab ${datum(f.ab)}`, tage, ...(f.alt_ab !== undefined ? { alt_ab: f.alt_ab } : {}) }, text); }
      case 'neu-art': S.sheet.form.art = el.dataset.v; S.sheet.form.typ = el.dataset.v === 'Pumpenschacht' ? 'Pumpe' : 'Ölradiator'; return neu();
      case 'neu-anlegen': { const f = S.sheet.form, name = f.name.trim() || 'Neuer Container', schacht = f.art === 'Pumpenschacht';
        S.sheet = null; neu();
        return this.einrichten(async () => {
          const r = await this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'bereich'] }, this.bereichDaten(name, schacht ? 'pumpenschacht' : 'container', f.fuehler));
          if (this.flowFehler(r) || !f.schalter) return r;
          const [bid] = await this.neueIds([name]); if (!bid) return r;
          return this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'geraet'] }, this.geraetDaten(bid, { n: schacht ? 'Pumpe 1' : '', typ: f.typ, schalter: f.schalter }));
        }, `${name} angelegt`).then(() => this._laden()); }
      case 'b-speichern': { const e = S.sheet.edit, x = b; S.sheet = null; neu();
        return this.einrichten(async () => {
          const eb = { ...((d.r.einstellungen.bereiche || {})[x.id] || {}) }, pfad = k => ['bereiche', x.id, k];
          if (e.name.trim() && (e.name.trim() !== x.name || (e.fuehler || '') !== (x.fuehler || ''))) {
            const r = await this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'bereich'], subentry_id: x.id }, this.bereichDaten(e.name.trim(), x.art || 'container', e.fuehler));
            if (this.flowFehler(r)) return r; }
          const call = (k, w) => this._hass.callWS({ type: 'baustelle/setzen', entry_id: d.entry, pfad: pfad(k), wert: w });
          if (e.bedarf !== !!eb.bedarf) await call('bedarf', e.bedarf);
          if ((e.tuer || null) !== (eb.tuer || null)) await call('tuer', e.tuer || null);
          if (e.anschluss && e.anschluss !== x.anschluss) await call('anschluss', e.anschluss);
          if (e.firma !== x.firma) {
            if (x.firma !== 'eigen') await this._hass.callWS({ type: 'baustelle/liste', entry_id: d.entry, liste: 'firmen', aktion: 'speichern', eintrag: { id: x.firma, name: this.firma(x.firma).name, container: d.bereiche.filter(y => y.firma === x.firma && y.id !== x.id).map(y => y.id) } });
            if (e.firma !== 'eigen') await this._hass.callWS({ type: 'baustelle/liste', entry_id: d.entry, liste: 'firmen', aktion: 'speichern', eintrag: { id: e.firma, name: this.firma(e.firma).name, container: [...d.bereiche.filter(y => y.firma === e.firma).map(y => y.id), x.id] } });
          }
          for (const g of e.geraete) {
            if (g.weg && !g.neu) await this._hass.callWS({ type: 'config_entries/subentries/delete', entry_id: d.entry, subentry_id: g.id });
            else if (g.neu && !g.weg && g.schalter) { const r = await this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'geraet'] }, this.geraetDaten(x.id, g)); if (this.flowFehler(r)) return r; }
            else if (!g.neu && !g.weg && (g.n !== g.alt.n || g.typ !== g.alt.typ)) { const r = await this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'geraet'], subentry_id: g.id }, this.geraetDaten(x.id, g)); if (this.flowFehler(r)) return r; }
          }
          return true;
        }, e.geraete.some(g => g.weg && !g.neu) ? `Gespeichert · ${e.geraete.filter(g => g.weg && !g.neu).length} entfernt – Werte bleiben im Verlauf` : 'Gespeichert').then(() => this._laden()); }
      case 'ge-bedarf': S.sheet.edit.bedarf = !S.sheet.edit.bedarf; return neu();
      case 'ge-weg': { const g = S.sheet.edit.geraete[+el.dataset.i]; if (g.neu) S.sheet.edit.geraete.splice(+el.dataset.i, 1); else g.weg = true; return neu(); }
      case 'ge-zurueck': S.sheet.edit.geraete[+el.dataset.i].weg = false; return neu();
      case 'ge-neu': S.sheet.edit.geraete.push({ neu: true, schalter: '', n: '', typ: b.pumpe ? 'Pumpe' : 'Ölradiator' }); return neu();
      case 'temp-vb': S.tempVb = S.tempVb === false; return neu();
      case 'b-weg': { const x = b; S.sheet = null; this.gehe('uebersicht');
        return this.einrichten(async () => {
          for (const g of x.geraete) await this._hass.callWS({ type: 'config_entries/subentries/delete', entry_id: d.entry, subentry_id: g.id });
          await this._hass.callWS({ type: 'config_entries/subentries/delete', entry_id: d.entry, subentry_id: x.id }); return true;
        }, `${x.name} entfernt – Werte bleiben im Verlauf`).then(() => this._laden()); }
      case 'abschliessen': S.leeren(); neu();
        return this.einrichten(() => this.optionenSpeichern(d, { status: 'abgeschlossen' }), 'Abgeschlossen – steht jetzt im Verlauf').then(() => this._laden());
      case 'name-speichern': { const n = S.sheet.form.name.trim(); if (!n) return this.toast('Bitte einen Namen eingeben'); S.sheet = null; neu();
        return this.ws({ type: 'config_entries/update', entry_id: d.entry, title: n }, 'Gespeichert'); }
      case 'baustelle-anlegen': { const n = S.sheet.form.name.trim(); if (!n) return this.toast('Bitte einen Namen eingeben'); S.sheet = null; neu();
        const heute = this.d ? this.z.HEUTE : new Date().toISOString().slice(0, 10);
        return this.einrichten(() => this.dialog('config/config_entries/flow', { handler: 'baustelle', show_advanced_options: false }, { name: n, beginn: heute, heizung: true, pumpen: true }), `${n} angelegt – jetzt Container anlegen`)
          .then(r => { if (r && r.next_flow) this._hass.callApi('DELETE', `config/config_entries/subentries/flow/${r.next_flow[1]}`).catch(() => {});
            if (r && r.result && r.result.entry_id) { this.bid = r.result.entry_id; this._merken(); } this._laden(); }); }
      case 'wetterquelle-speichern': { const f = S.sheet.form; S.sheet = null; neu();
        return this.einrichten(async () => {
          const r = await this.optionenSpeichern(d, { wetter: f.wetter, temp_sensor: f.temp_sensor, regen_sensor: f.regen_sensor, urlaub_kalender: f.urlaub_kalender, feiertag_kalender: f.feiertag_kalender });
          if (this.flowFehler(r)) return r;
          if ((f.termine_kalender || null) !== (d.termineKal || null)) await this._hass.callWS({ type: 'baustelle/setzen', entry_id: d.entry, pfad: ['termine_kalender'], wert: f.termine_kalender || null });
          return r;
        }, 'Gespeichert').then(() => { this.cache = {}; this._aboFuer = null; this._laden(); }); }
    }
    return undefined;
  }
  eingabe(ev) {
    const el = ev.target, ds = (el && el.dataset) || {}, sh = this.s.sheet;
    if (ds.azn) sh.form[ds.azn] = el.value;
    if (ds.ur) sh.form[ds.ur] = el.value;
    if (ds.tm) sh.form[ds.tm] = el.value;
    if (ds.au) { sh.form[ds.au] = el.value; if (ds.au === 'datum') this.render(); }
    if (ds.ml) sh.form[ds.ml] = el.value;
    if (ds.ge) sh.edit.geraete[+ds.i][ds.ge] = el.value;
    if (ds.bf) sh.edit.firma = el.value;
    if (ds.btuer !== undefined) sh.edit.tuer = el.value;
    if (ds.bfu !== undefined) sh.edit.fuehler = el.value;
    if (ds.ban !== undefined) { sh.edit.anschluss = el.value; this.render(); }
    if (ds.an) sh.form[ds.an] = el.value;
    if (ds.fn !== undefined) sh.form.name = el.value;
    if (ds.fnc !== undefined) sh.form.neu[+ds.fnc].name = el.value;
    if (ds.b === 'name' && sh && sh.edit) sh.edit.name = el.value;
    if (ds.azt) sh.form.tage[ds.azt][+ds.p] = el.value;
    if (ds.neu) sh.form[ds.neu] = el.value;
    if (ds.wq) sh.form[ds.wq] = el.value;
    if (ds.nm) sh.form.name = el.value;
    if (ds.bsz) sh.form[ds.bsz] = el.value;
    if (ds.hp) sh.form.hp[+ds.hp] = +el.value;
  }
  /* Felder, die direkt speichern: erst beim Verlassen (change), nicht bei jedem Tastendruck */
  aenderung(ev) {
    const el = ev.target, k = el && el.dataset && el.dataset.k;
    if (k === 'preis') { const v = parseFloat(String(el.value).replace(',', '.')); if (Number.isFinite(v) && v >= 0) return this.setzen(PFAD.preis, v, 'Preis gespeichert'); return this.toast('Bitte einen Preis eingeben'); }
    if (k === 'mail') return this.setzen(PFAD.mail, String(el.value).trim(), 'Gespeichert');
    const jm = el && el.dataset && el.dataset.jm;
    if (jm) { const x = this.d.bereiche.find(y => y.id === jm); if (!x || x.modus === el.value) return undefined;
      return this.setzen(['bereiche', jm, 'modus'], el.value, `${x.name}: ${(MODI.find(q => q[0] === el.value) || [el.value, el.value])[1]}`); }
    return undefined;
  }
  hover(ev) {
    const svg = ev.target && ev.target.closest && ev.target.closest('svg.chart'); if (!svg) return this.tip(null);
    const c = CHARTS[svg.dataset.chart]; if (!c) return this.tip(null);
    const r = svg.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width, p = this.d ? this.d.e.preis : 0;
    if (c.art === 'streu') {
      const vx = (ev.clientX - r.left) / r.width * 320, vy = ((ev.clientY ?? 0) - (r.top ?? 0)) / r.width * 320;
      let best = 0, bd = 1e9; c.pkt.forEach((q, i) => { const dd = (c.x(q[0]) - vx) ** 2 + (c.y(q[1]) - vy) ** 2; if (dd < bd) { bd = dd; best = i; } });
      if (bd > 900) { svg.querySelector('.hover').innerHTML = ''; return this.tip(null); }
      const q = c.pkt[best];
      svg.querySelector('.hover').innerHTML = `<circle cx="${c.x(q[0])}" cy="${c.y(q[1])}" r="7" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`;
      return this.tip(ev, `<b>${de(q[0], 1)} °C außen</b><div>${de(q[1], 0)} kWh · ${de(q[1] * p, 2)} €</div>`);
    }
    if (c.art === 'flaeche') {
      const vx = fx * c.W, i = Math.max(0, Math.min(c.n - 1, Math.round((vx - c.x0) / (c.x1 - c.x0) * (c.n - 1)))), x = c.x0 + i / Math.max(1, c.n - 1) * (c.x1 - c.x0);
      const h = c.einheit === 'kWh/h' || c.einheit === 'kW', sum = c.reihen.reduce((a, q) => a + q.v[i], 0);
      if (c.einheit === 'kW') { svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="138" class="kreuz"/>` + c.reihen.map(q => `<circle cx="${x}" cy="${c.y(q.o[i])}" r="3.5" fill="${q.farbe}" class="punkt"/>`).join('');
        return this.tip(ev, `<b>${c.labels[i]}:00</b>` + (c.reihen.length > 1 ? [...c.reihen].reverse().map(q => `<div><i style="background:${q.farbe}"></i>${esc(q.name)} <b>${de(q.v[i], 2)} kW</b></div>`).join('') + `<div class="tip-summe">zusammen <b>${de(sum, 2)} kW</b></div>` : `<div>${de(sum, 2)} kW</div>`)); }
      svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="138" class="kreuz"/>` + c.reihen.map(q => `<circle cx="${x}" cy="${c.y(q.o[i])}" r="3.5" fill="${q.farbe}" class="punkt"/>`).join('');
      return this.tip(ev, `<b>${c.labels[i]}${h ? ':00' : ''}</b>` + (c.reihen.length > 1
        ? [...c.reihen].reverse().map(q => `<div><i style="background:${q.farbe}"></i>${esc(q.name)} <b>${de(q.v[i], 2)} kWh</b></div>`).join('') + `<div class="tip-summe">zusammen <b>${de(sum, 2)} kWh</b> · ${de(sum * p, 2)} €</div>`
        : `<div>${de(sum, 2)} kWh</div><div class="leise">${de(sum * p, 2)} €</div>`));
    }
    if (c.art === 'linien') {
      const vx = fx * c.W, i = Math.max(0, Math.min(c.n - 1, Math.round((vx - c.x0) / (c.x1 - c.x0) * (c.n - 1)))), x = c.x0 + i / Math.max(1, c.n - 1) * (c.x1 - c.x0);
      svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="${c.unten}" class="kreuz"/>` + c.reihen.map(q => !zahl(q.v[i]) ? '' : `<circle cx="${x}" cy="${c.y(q.v[i])}" r="3.5" fill="${q.farbe}" class="punkt"/>`).join('');
      return this.tip(ev, `<b>${c.titel(i)}</b>${c.reihen.map(q => !zahl(q.v[i]) ? '' : `<div><i style="background:${q.farbe}"></i>${esc(q.name)} <b>${de(q.v[i])} °C</b></div>`).join('')}`);
    }
    if (c.art === 'linie') {
      const vx = fx * c.W, i = Math.max(0, Math.min(24, Math.round((vx - c.x0) / (c.x1 - c.x0) * 24))), x = c.x0 + i / 24 * (c.x1 - c.x0);
      const v = c.vb ? c.vb[Math.min(i, c.vb.length - 1)] || 0 : null, kv = c.reihen.length + 1;
      svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="${c.unten}" class="kreuz"/>` + c.reihen.map((s, k) => !zahl(s.v[i]) ? '' : `<circle cx="${x}" cy="${c.y(s.v[i])}" r="4" fill="var(--s${k + 1})" class="punkt"/>`).join('')
        + (c.vb ? `<circle cx="${x}" cy="${c.yv(v)}" r="3.5" fill="var(--s${kv})" class="punkt"/>` : '');
      return this.tip(ev, `<b>${String(i).padStart(2, '0')}:00</b>${c.reihen.map((s, k) => !zahl(s.v[i]) ? '' : `<div><i style="background:var(--s${k + 1})"></i>${s.name} <b>${de(s.v[i])} ${c.einheit}</b></div>`).join('')}`
        + (c.vb ? `<div><i style="background:var(--s${kv})"></i>Verbrauch <b>${de(v, 2)} kWh</b></div>` : ''));
    }
    const bar = ev.target.closest('.bar'); svg.querySelectorAll('.bar').forEach(x => x.classList.toggle('matt', !!bar && x !== bar));
    if (!bar) return this.tip(null); const i = +bar.dataset.i;
    return this.tip(ev, `<b>${c.labels[i]}</b><div>${de(c.werte[i], c.d)} ${c.einheit}</div>`);
  }
  tip(ev, html) {
    const t = this.root && this.root.querySelector('.tip'); if (!t) return;
    if (!ev || !html) { t.classList.remove('an'); this.root.querySelectorAll('.chart .hover').forEach(h => { h.innerHTML = ''; }); this.root.querySelectorAll('.bar.matt').forEach(x => x.classList.remove('matt')); return; }
    const r = this.root.getBoundingClientRect(); t.innerHTML = html; t.classList.add('an');
    const x = Math.min(ev.clientX - r.left + 12, r.width - t.offsetWidth - 8); t.style.left = x + 'px'; t.style.top = (ev.clientY - r.top - t.offsetHeight - 12) + 'px';
  }
}
if (!customElements.get('baustelle-panel')) customElements.define('baustelle-panel', BaustellePanel);
