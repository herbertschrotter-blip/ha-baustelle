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
  };
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
    new ResizeObserver(() => this.groesse()).observe(bg); this.groesse();
    this.t0 = performance.now(); this.letzt = 0; this.schleife = this.schleife.bind(this); requestAnimationFrame(this.schleife);
  }
  groesse() { const d = Math.min(devicePixelRatio || 1, 1.5); this.dpr = d; this.cv.width = Math.round(this.bg.clientWidth * d); this.cv.height = Math.round(this.bg.clientHeight * d); this.gl.viewport(0, 0, this.cv.width, this.cv.height); }
  setze(phase, wetter, hell) { this.ziel = himmelZiel(phase, wetter, hell); this.gewitter = wetter === 'gewitter'; if (!this.jetzt) this.jetzt = JSON.parse(JSON.stringify(this.ziel)); }
  u(n, v) { const l = this.loc[n] ??= this.gl.getUniformLocation(this.pr, n); if (l === null) return;
    Array.isArray(v) ? this.gl['uniform' + v.length + 'fv'](l, v) : this.gl.uniform1f(l, v); }
  schleife(ms) {
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
