// BSM-032: Zeichner für das anpassbare Container-Symbol (für container-symbol.html und container-zustaende.html).
// Liefert den Quelltext einer Funktion csZeichnen(s, z, stil) → SVG:
//   s    = { doppel, farbe, tueren: [{ wand: 'front'|'seite', pos: 0…1 }], fenster: [{ wand, pos }] }
//   z    = { heizt, frost, trocknen, off, tuer: [Index offener Türen], kipp: [Index], offen: [Index], licht: bool }
//   stil = { tuer: 'A'|'B'|'C', kipp: …, offen: …, licht: … }  (Versionen zum Vergleich)
module.exports = String.raw`
function csZeichnen(s, z, stil) {
  stil = Object.assign({ tuer: 'A', kipp: 'A', offen: 'A', licht: 'A' }, stil || {});
  const farbe = s.farbe || '#3987e5', dop = !!s.doppel, heizt = !!z.heizt, off = !!z.off;
  const licht = !!z.licht, lichtFenster = licht && stil.licht !== 'C';
  const AMBER = '#ffb300', DUNKEL = '#141414', LICHT = stil.licht === 'B' ? '#fff6d8' : '#ffe9a8';
  const dunkler = 'color-mix(in srgb, ' + farbe + ' 70%, #000)', heller = 'color-mix(in srgb, ' + farbe + ' 75%, #fff)';
  const SL = dop ? 80 : 50, sdy = SL * -18 / 50, dy = dop ? 11 : 0, W = dop ? 200 : 170, H = dop ? 131 : 120;
  const wand = w => w === 'front' ? { x0: 22, y0: 30, L: 84, n: 20 / 84 } : { x0: 106, y0: 50, L: SL, n: -18 / 50 };
  const ort = (w, t, b) => { const g = wand(w), x = g.x0 + t * g.L - b / 2; return { x, y: g.y0 + (x - g.x0) * g.n, n: g.n, w }; };
  const para = (x, y, b, d, h, attr) => '<path d="M' + x + ' ' + y + 'l' + b + ' ' + d + 'v' + h + 'l' + (-b) + ' ' + (-d) + 'z" ' + attr + '/>';
  const plakette = (x, y, inhalt) => '<g transform="translate(' + x + ' ' + y + ')"><circle r="6.5" fill="' + AMBER + '" stroke="#000" stroke-opacity=".35"/>' + inhalt + '</g>';
  const has = (l, i) => (l || []).includes(i);
  let schein = '';   // Lichtschein vor den Fenstern (Licht B), hinter dem Container-Rand gezeichnet

  const fenster = (fe, i) => {
    const b = 17, h = 15, a = ort(fe.wand, fe.pos, b), x = a.x, y = a.y + 11, d = b * a.n;
    const kipp = has(z.kipp, i), offen = has(z.offen, i), markiert = (kipp && stil.kipp === 'C') || (offen && stil.offen === 'C');
    const glas = lichtFenster ? LICHT : heizt ? '#ffb74d' : 'var(--fenster)';
    let r = para(x - 1.6, y - 1.6, b + 3.2, d, h + 3.2, 'fill="' + (markiert ? AMBER : 'var(--rahmen)') + '"');
    if (offen && stil.offen !== 'C') {
      r += para(x, y, b, d, h, 'fill="' + (lichtFenster ? 'color-mix(in srgb, ' + LICHT + ' 55%, #000)' : DUNKEL) + '"');
      if (stil.offen === 'B') r += para(x - 9, y + 2, 9, d * .2 - 2, h, 'fill="var(--fenster)" stroke="var(--rahmen)" stroke-width="1.4" opacity=".95"');   // Flügel nach außen
    } else {
      r += para(x, y, b, d, h, 'class="' + (lichtFenster ? 'cs-licht' : heizt ? 'bc-glut' : '') + '" fill="' + glas + '"');
      if (kipp && stil.kipp === 'A') r += para(x, y, b, d, 4, 'fill="' + DUNKEL + '" opacity=".8"') + '<path d="M' + (x - 1) + ' ' + (y + 4) + 'l' + (b + 2) + ' ' + d + '" stroke="var(--rahmen)" stroke-width="1.6"/>';
      if (kipp && stil.kipp === 'B') r += '<path d="M' + x + ' ' + y + 'l' + b + ' ' + d + 'l-3 6l' + (-(b - 6)) + ' ' + (-d) + 'z" fill="' + DUNKEL + '" opacity=".7"/>'
        + '<path d="M' + (x + 3) + ' ' + (y + 6) + 'l' + (b - 6) + ' ' + d + '" stroke="var(--rahmen)" stroke-width="1.6"/>'
        + '<path d="M' + x + ' ' + y + 'l3 6M' + (x + b) + ' ' + (y + d) + 'l-3 6" stroke="var(--rahmen)" stroke-width="1.2"/>';
      if (!kipp) r += '<path d="M' + (x + b / 2) + ' ' + (y + b / 2 * a.n) + 'v' + h + '" stroke="var(--rahmen)" stroke-width="1.4"/>';
      if (!lichtFenster) r += '<path d="M' + (x + 2.5) + ' ' + (y + 3) + 'l' + (b * .35) + ' ' + (d * .35 + 7) + '" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".3"/>';
    }
    if (kipp && stil.kipp === 'C') r += plakette(x + b / 2, y - 8 + d / 2, '<path d="M-3 -2l3 3 3-3" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round"/>');
    if (offen && stil.offen === 'C') r += plakette(x + b / 2, y - 8 + d / 2, '<path d="M-3 -3v6M3 -3v6" stroke="#000" stroke-width="1.6" stroke-linecap="round"/>');
    if (licht && stil.licht === 'B' && !offen) schein += '<path d="M' + (x - 2) + ' ' + (y + h + 2) + 'l' + (b + 4) + ' ' + (d) + 'l' + (a.w === 'front' ? 6 : 10) + ' ' + (a.w === 'front' ? 16 : 12) + 'l' + (-(b + 16)) + ' ' + (-d) + 'z" fill="#ffe082" opacity=".35"/>';
    return '<g>' + r + '</g>';
  };
  const tuer = (t, i) => {
    const b = 14, h = 44, a = ort(t.wand, t.pos, b), x = a.x, y = a.y + 9, d = b * a.n, offen = has(z.tuer, i);
    const innen = lichtFenster ? 'color-mix(in srgb, ' + LICHT + ' 60%, #000)' : DUNKEL;
    if (offen && stil.tuer === 'A')   // Öffnung, Türblatt nach außen aufgeschwenkt
      return para(x, y, b, d, h, 'fill="' + innen + '" stroke="var(--rahmen)" stroke-width="1.2"') + '<path d="M' + x + ' ' + y + 'l-7 ' + (5 - d * .2) + 'v' + h + 'l7 -5z" fill="' + dunkler + '" stroke="var(--rahmen)" stroke-width="1.2"/>';
    if (offen && stil.tuer === 'B')   // Öffnung, Türblatt nach innen (schmaler Streifen am Scharnier), Lichtstreifen am Boden
      return para(x, y, b, d, h, 'fill="' + innen + '" stroke="var(--rahmen)" stroke-width="1.2"') + para(x + 1, y + 1.5, 4, d * .3, h - 2, 'fill="' + dunkler + '" stroke="var(--rahmen)" stroke-width=".8"')
        + '<path d="M' + x + ' ' + (y + h) + 'l' + b + ' ' + d + 'l5 4l' + (-b) + ' ' + (-d) + 'z" fill="' + (lichtFenster ? '#ffe082' : '#000') + '" opacity="' + (lichtFenster ? .45 : .25) + '"/>';
    const zu = para(x, y, b, d, h, 'fill="' + dunkler + '" stroke="' + (offen ? AMBER : 'var(--rahmen)') + '" stroke-width="' + (offen ? 2.2 : 1.2) + '"')
      + '<path d="M' + (x + 3) + ' ' + (y + 4 + 3 * a.n) + 'l8 ' + (8 * a.n) + 'v7l-8 ' + (-8 * a.n) + 'z" fill="' + (lichtFenster ? LICHT : heizt ? '#ffcc80' : 'var(--fenster)') + '" opacity=".9"/>'
      + '<circle cx="' + (x + b - 2.5) + '" cy="' + (y + d + 24) + '" r="1.2" fill="#e0e0e0"/>';
    return offen ? zu + plakette(x + b / 2, y - 7 + d / 2, '<path d="M-3 3v-6h4v6M1 -3l2.5 1.5v4" fill="none" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>') : zu;   // C: Tür zu gezeichnet, gelb markiert
  };
  const rippen = (w, k) => { const g = wand(w), n = Math.round(g.L / (w === 'front' ? 10.5 : 9)); let r = '';
    for (let j = 1; j < n; j++) { const x = g.x0 + j * g.L / n; r += '<path d="M' + x + ' ' + (g.y0 + (x - g.x0) * g.n + 1) + 'v58" stroke="rgba(0,0,0,' + k + ')" stroke-width="1.4"/>'; } return r; };
  const naht = dop ? '<path d="M' + (106 + SL / 2) + ' ' + (50 + sdy / 2) + 'v58" stroke="rgba(0,0,0,.45)" stroke-width="2.2"/><path d="M' + (22 + SL / 2) + ' ' + (30 + sdy / 2) + 'l84 20" stroke="rgba(0,0,0,.3)" stroke-width="1.6"/>' : '';
  const teile = (s.tueren || []).map(tuer).join('') + (s.fenster || []).map(fenster).join('');
  const birne = licht && stil.licht === 'C' ? plakette(22 + SL / 2 + 42, 30 + sdy / 2 + 10 - 9, '<circle cy="-1" r="2.6" fill="#fff8e1" stroke="#000" stroke-width="1"/><path d="M-1.4 2.4h2.8" stroke="#000" stroke-width="1.2"/>') : '';
  return '<svg class="bc ' + (off ? 'offline' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" style="--f:' + farbe + '"><g transform="translate(0 ' + dy + ')">'
    + '<ellipse cx="' + (86 + SL / 2 - 25) + '" cy="104" rx="' + (70 + SL / 2 - 25) + '" ry="9" fill="#000" opacity=".22"/>'
    + '<path d="M22 88l84 20 ' + SL + ' ' + sdy + '" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="4" stroke-linecap="round"/>'
    + '<path d="M106 50l' + SL + ' ' + sdy + 'v58l' + (-SL) + ' ' + (-sdy) + 'z" fill="' + dunkler + '"/>' + rippen('seite', .18)
    + '<path d="M22 30l84 20v58l-84-20z" fill="' + farbe + '"/>' + rippen('front', .14)
    + '<path d="M22 30l' + SL + ' ' + sdy + ' 84 20 ' + (-SL) + ' ' + (-sdy) + 'z" fill="' + heller + '"/><path d="M22 30l84 20 ' + SL + ' ' + sdy + '" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>'
    + naht + teile + schein + birne
    + (z.trocknen ? '<g class="bc-jacke" style="transform-origin:88.5px 42px"><path d="M84 44l3-2h3l3 2-1.4 3-1.4-.6v6h-5.6v-6l-1.4.6z" fill="#1565c0"/></g>' : '')
    + (heizt && !z.frost ? [0, 1, 2].map(k => '<path class="bc-waerme" style="animation-delay:' + (k * .7) + 's" d="M' + (62 + k * 18 + (dop ? 15 : 0)) + ' ' + (24 - k + sdy / 2 + 9) + ' q4 -5 0 -10 q-4 -5 0 -10" fill="none" stroke="#ff9800" stroke-width="2.2" stroke-linecap="round"/>').join('') : '')
    + (off ? '<g class="bc-alarm"><circle cx="' + (W - 30) + '" cy="20" r="11" fill="#d03b3b"/><path d="M' + (W - 30) + ' 13v9" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="' + (W - 30) + '" cy="27" r="1.8" fill="#fff"/></g>' : '')
    + '</g></svg>';
}
`;
