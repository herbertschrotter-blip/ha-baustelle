// Himmel der Seite „Baustelle“: WebGL-Shader mit CSS-Rückfall, Sonnen-/Mondlauf, Partikel (BSM-022 Stufe 1b).
import { zahl } from './hilfen.js';

/* Himmel hinter Glas (mockups/quelle/himmel.frag + himmel.js) */
export const HIMMEL_FS = "// Hintergrund „Himmel hinter einer Glasscheibe“: Stimmung nach Tageszeit und Wetter.\n// Eigene Umsetzung (WebGL 1 / GLSL ES 1.0). Einheiten: CSS-Pixel, y nach unten.\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n\nuniform vec2 uRes;        // Gerätepixel\nuniform float uDpr;\nuniform float uTime;      // Sekunden\nuniform vec3 uG1, uG2, uG3, uF1, uF2, uF3;   // Verlauf und Lichtflecken der Stimmung\nuniform float uBlobA, uSat;\nuniform vec3 uDunstC; uniform float uDunst;\nuniform vec3 uWolkeD, uWolkeH, uNebelC;\nuniform float uWolken, uRegen, uSchnee, uNebel, uSonne, uNachtKlar, uBlitz, uBlitzX;\nuniform vec2 uSonnePos; uniform vec3 uSonneF;\nuniform vec2 uMondPos; uniform float uMondK, uMondSeite;   // Mond: Ort, cos(2π·Mondalter), +1 zunehmend / −1 abnehmend\n\nvec2 R;\n\nfloat h11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }\nvec3 h31(float p) { vec3 q = fract(vec3(p) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xxy + q.yzz) * q.zyx); }\nfloat h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }\nfloat rausch(vec2 p) {\n  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);\n  return mix(mix(h21(i), h21(i + vec2(1., 0.)), u.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), u.x), u.y);\n}\nfloat fbm(vec2 p) {\n  float s = 0., a = .5;\n  for (int i = 0; i < 5; i++) { s += a * rausch(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; }\n  return s;\n}\n\nvec3 fleck(vec3 col, vec3 f, vec2 c, float r, float ph, vec2 p) {\n  float k = .5 - .5 * cos(6.2832 * uTime / 14. + ph);\n  c += vec2(30., 40.) * k; r *= 1. + .15 * k;\n  float g = dot(f, vec3(.299, .587, .114));\n  f = mix(vec3(g), f, uSat);\n  float d = length(p - c) / (r + 60.);\n  return mix(col, f, uBlobA * exp(-d * d * 2.2));\n}\n\nvec3 grund(vec2 p) {\n  float a = radians(165.);\n  vec2 dir = vec2(sin(a), -cos(a));\n  float t = clamp(dot(p - R * .5, dir) / (abs(R.x * dir.x) + abs(R.y * dir.y)) + .5, 0., 1.);\n  vec3 col = t < .5 ? mix(uG1, uG2, t * 2.) : mix(uG2, uG3, t * 2. - 1.);\n  col = fleck(col, uF1, vec2(70., 70.), 130., 0., p);\n  col = fleck(col, uF2, vec2(R.x - 40., 420.), 120., -2.244, p);\n  col = fleck(col, uF3, vec2(140., R.y - 60.), 100., -4.039, p);\n  return col;\n}\n\n/* Alles hinter der Scheibe */\nvec3 szene(vec2 p) {\n  vec2 uv = p / R;\n  vec3 col = grund(p);\n\n  if (uSonne > .01) {\n    vec2 d = p - uSonnePos * R;\n    float r = length(d) / R.y;\n    float ang = atan(d.y, d.x);\n    float strahl = pow(rausch(vec2(ang * 11., uTime * .04)), 4.) * exp(-r * 4.) * smoothstep(.02, .08, r) * .05;\n    // gedämpft, damit die Schrift auf dem Glas davor lesbar bleibt\n    col += uSonneF * (exp(-r * 7.) * .08 + exp(-r * 30.) * .14 + strahl) * uSonne;\n    col = mix(col, vec3(1., .98, .93), smoothstep(.016, .011, r) * .55 * uSonne);\n  }\n\n  if (uNachtKlar > .01) {\n    vec2 id = floor(p / 26.), f = fract(p / 26.) - .5;\n    vec3 n = h31(id.x * 57.3 + id.y * 113.1);\n    float s = smoothstep(.05 + .05 * n.z, 0., length(f - (n.xy - .5) * .7)) * step(.6, n.z);\n    s *= .55 + .45 * sin(uTime * (1. + n.x * 3.) + n.y * 6.28);\n    col += vec3(.9, .95, 1.) * s * smoothstep(.9, .25, uv.y) * uNachtKlar;\n    vec2 mp = uMondPos * R, mq = (p - mp) / 20.;\n    float mr = length(p - mp), anteil = .5 - .5 * uMondK;   // beleuchteter Anteil der Scheibe\n    col += vec3(.55, .65, .9) * exp(-mr / 70.) * .35 * (.2 + .8 * anteil) * uNachtKlar;\n    float scheibe = smoothstep(21., 19.5, mr);\n    // Schattengrenze: beleuchtet, wo x (zur Lichtseite) über uMondK·√(1−y²) liegt\n    float grenze = uMondK * sqrt(max(1. - mq.y * mq.y, 0.));\n    float licht = smoothstep(grenze - .06, grenze + .06, mq.x * uMondSeite);\n    vec3 mf = vec3(.95, .94, .88) - fbm((p - mp) * .14) * .3;\n    col = mix(col, mix(col * .75 + mf * .06, mf, licht), scheibe * uNachtKlar);\n  }\n\n  if (uWolken > .01) {\n    vec2 q = uv * vec2(R.x / R.y, 1.) * 2.4 + vec2(uTime * .015, 0.);\n    float w = fbm(q + fbm(q * 1.6 + vec2(0., uTime * .02)) * 1.3);\n    float bed = mix(.62, .22, clamp(uWolken, 0., 1.));\n    float dichte = smoothstep(bed, bed + .38, w) * (1. - .35 * uv.y);\n    float licht = smoothstep(.3, .85, fbm(q * 2.1 + vec2(3.1, -uTime * .01)) * .6 + (w - bed) * .9);\n    vec3 wf = mix(uWolkeD, uWolkeH, licht);\n    wf += vec3(.8, .84, 1.) * uBlitz * (.25 + licht * .55) * .6;\n    col = mix(col, wf, clamp(dichte * uWolken * 1.15, 0., 1.));\n  }\n\n  if (uBlitz > .01) {\n    float y = uv.y;\n    float x = uBlitzX * R.x + (fbm(vec2(y * 7., uBlitzX * 40.)) - .5) * 160. + (rausch(vec2(y * 40., uBlitzX * 9.)) - .5) * 18.;\n    float strahl = smoothstep(2.5, 0., abs(p.x - x)) + smoothstep(14., 0., abs(p.x - x)) * .35;\n    col += vec3(.9, .92, 1.) * strahl * smoothstep(.62, .45, y) * uBlitz;\n    col += uBlitz * .05;\n  }\n\n  if (uRegen > .01) {\n    vec2 rp = vec2(p.x + p.y * .2, p.y);\n    float sp = floor(rp.x / 5.);\n    vec3 n = h31(sp * 13.7 + 2.);\n    float y = fract(rp.y / (R.y * .7) - uTime * (1.1 + n.x * .8) + n.y);\n    float strich = smoothstep(0., .015, y) * smoothstep(.16, .02, y) * smoothstep(.22, 0., abs(fract(rp.x / 5.) - .5));\n    col += vec3(.75, .82, .95) * strich * step(n.z, .28 * min(uRegen, 1.4)) * .16;\n  }\n\n  if (uNebel > .01) {\n    vec2 q = uv * vec2(R.x / R.y, 1.) * 2.2;\n    float n1 = fbm(q * vec2(.7, 1.5) + vec2(uTime * .03, 0.));\n    float n2 = fbm(q * vec2(1.4, 2.6) - vec2(uTime * .055, uTime * .01) + 5.2);\n    float dichte = smoothstep(.32, .8, n1 * .55 + n2 * .55);\n    vec3 nf = mix(uNebelC * .92, uNebelC * 1.18, dichte);\n    col = mix(col, nf, clamp(.3 + dichte * .6 * (.55 + .45 * uv.y), 0., 1.) * uNebel);\n  }\n\n  if (uSchnee > .01) {\n    for (int k = 0; k < 3; k++) {\n      float fk = float(k) / 2.;\n      float zelle = mix(95., 26., fk), rad = mix(4.2, 1.1, fk), v = mix(62., 22., fk), weich = mix(3.2, .6, fk);\n      vec2 q = p + vec2(sin(uTime * .4 + fk * 3.) * 24., -uTime * v);\n      vec2 id = floor(q / zelle), f = q - (id + .5) * zelle;\n      vec3 n = h31(id.x * 31.7 + id.y * 17.3 + fk * 71.);\n      vec2 o = (n.xy - .5) * zelle * .7 + vec2(sin(uTime * (.7 + n.z) + n.x * 6.28) * zelle * .12, 0.);\n      float fl = smoothstep(rad + weich, rad - weich * .3, length(f - o)) * step(n.z, .8);\n      col = mix(col, vec3(1.), fl * mix(.8, .55, fk) * uSchnee);\n    }\n  }\n\n  return mix(col, uDunstC, uDunst);\n}\n\n/* Tropfen auf der Scheibe: xy = Versatz für die Brechung, z = Wasser, w = klares Glas */\nvec4 laufend(vec2 p) {\n  float cw = 32.;\n  float spalte = floor(p.x / cw);\n  vec3 n = h31(spalte * 17.13 + 3.1);\n  if (n.x > .45 * uRegen) return vec4(0.);\n  float x0 = (spalte + .5) * cw + (n.y - .5) * cw * .18;\n  float dauer = mix(4.5, 9., n.z) / max(uRegen, .6);\n  float k = uTime / dauer + n.x * 7.;\n  vec3 m = h31(spalte * 3.7 + floor(k) * 11.9);\n  float stufen = 7.;\n  float g = fract(k) * stufen;\n  g = (floor(g) + smoothstep(.5, 1., fract(g))) / stufen;\n  float yK = mix(-.08, 1.12, g) * R.y;\n  float r = mix(4.5, 8.5, m.x);\n  float xl = x0 + sin(p.y * .02 + m.y * 6.) * 2.5;\n  vec2 q = vec2(p.x - xl, p.y - yK);\n  q.y *= q.y < 0. ? .6 : 1.05;\n  float wasser = smoothstep(1., .85, length(q) / r);\n  vec2 v = q / r;\n  float oben = yK - p.y;\n  float lang = mix(70., 200., m.z);\n  float xs = abs(p.x - xl);\n  float inSpur = step(0., oben) * smoothstep(lang, 0., oben);\n  float abst = 15.;\n  float yr = mod(oben, abst) - abst * .5;\n  float rr = r * .42 * inSpur * (.55 + .45 * h11(floor(oben / abst) + spalte * 7.));\n  vec2 qr = vec2(p.x - xl, yr);\n  float perle = rr > .2 ? smoothstep(rr, rr * .7, length(qr)) * step(abst * .7, oben) : 0.;\n  if (perle > wasser) { wasser = perle; v = qr / max(rr, .5); }\n  float klar = max(smoothstep(r * .55, r * .25, xs) * step(0., oben) * smoothstep(lang * 1.4, 0., oben), wasser);\n  return vec4(v, wasser, klar);\n}\n\nvec4 stehend(vec2 p, float zelle, float rMin, float rMax, float dichte, float seed) {\n  vec2 id = floor(p / zelle);\n  vec3 n = h31(id.x * 127.1 + id.y * 311.7 + seed);\n  float per = mix(7., 15., n.z);\n  float t = uTime / per + n.x * 5.;\n  float leben = fract(t);\n  vec3 m = h31(id.x * 7.3 + id.y * 13.1 + seed + floor(t) * 1.7);\n  float r = mix(rMin, rMax, m.x) * smoothstep(0., .12, leben) * smoothstep(1., .85, leben) * step(n.y, dichte);\n  if (r < .3) return vec4(0.);\n  vec2 c = (id + .5) * zelle + (m.yz - .5) * (zelle - 2. * rMax) * .9;\n  vec2 q = p - c;\n  float wasser = smoothstep(r, r * .8, length(q));\n  return vec4(q / r, wasser, wasser);\n}\n\nvoid main() {\n  R = uRes / uDpr;\n  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;\n  vec3 col = szene(p);\n  if (uRegen > .01) {\n    vec4 a = laufend(p);\n    vec4 b = stehend(p, 19., 1.2, 3.4, .5 + .3 * min(uRegen, 1.), 1.);\n    vec4 c = stehend(p, 40., 3.5, 8.5, .5 * min(uRegen, 1.), 7.);\n    float weg = a.w;\n    b.z *= 1. - weg; c.z *= 1. - weg;\n    vec4 w = a;\n    if (b.z > w.z) w = vec4(b.xy, b.z, max(a.w, b.z));\n    if (c.z > w.z) w = vec4(c.xy, c.z, max(a.w, c.z));\n    float wasser = w.z * min(uRegen, 1.);\n    if (wasser > .01) {\n      vec2 qn = w.xy;                                  // Lage im Tropfen, Mitte 0, Rand 1\n      float lq = length(qn);\n      // Linse: der Himmel erscheint verkleinert und auf dem Kopf\n      vec3 linse = szene(p - qn * 22. + vec2(0., -6.)) * 1.08;\n      linse *= 1. - .38 * smoothstep(.15, 1., -qn.y) * smoothstep(.4, 1., lq);   // oben dunkler Rand\n      linse += vec3(.9, .95, 1.) * .22 * smoothstep(.1, .9, qn.y) * smoothstep(1., .75, lq); // unten helle Sichel\n      linse *= 1. - .25 * smoothstep(.72, 1., lq);                              // Kante\n      linse += vec3(1.) * .75 * smoothstep(.2, .04, length(qn - vec2(-.3, -.42))); // Glanzpunkt\n      col = mix(col, linse, wasser);\n      col *= 1. - .18 * smoothstep(.0, .5, wasser) * smoothstep(1., .5, wasser);   // Schatten am Außenrand\n    }\n    col *= 1. - .035 * max(a.w - wasser, 0.);         // nasse Spur hinter laufenden Tropfen\n    float beschlag = (1. - max(w.w, wasser)) * .07 * min(uRegen, 1.);\n    col = mix(col, uNebelC, beschlag);\n  }\n  if (uSchnee > .01) {\n    vec2 uv = p / R;\n    float rand = min(min(uv.x, 1. - uv.x) * R.x / R.y * 1.4, (1. - uv.y) * .8);\n    float eis = smoothstep(.09, 0., rand + (fbm(p * .018) - .5) * .14) * (.4 + .6 * uv.y);\n    float kristall = smoothstep(.55, .75, fbm(p * .12 + 3.)) * .5 + .5;\n    col = mix(col, vec3(.93, .97, 1.), eis * kristall * .6 * uSchnee);\n  }\n  gl_FragColor = vec4(col, 1.);\n}\n";

/* Himmel hinter Glas: Werte je Stimmung (Tageszeit × Wetter × hell/dunkel) und WebGL-Zeichner.
   himmelZiel() ist rein (ohne DOM) und wird auch von der Standbild-Vorschau benutzt. */
export const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export const HIMMEL_FARBEN = {
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

export function himmelZiel(phase, wetter, hell) {
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
export function himmelZielBei(hoehe, steigt, wetter, hell) {
  const anteil = (a, b) => Math.min(1, Math.max(0, (hoehe - a) / (b - a))), warm = steigt ? 'morgen' : 'abend';
  const [a, b, w] = hoehe < 0 ? ['nacht', warm, anteil(-8, 0)] : [warm, 'tag', anteil(4, 15)];
  const za = himmelZiel(a, wetter, hell), zb = himmelZiel(b, wetter, hell);
  const m = (x, y) => Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * w) : x + (y - x) * w;
  return Object.fromEntries(Object.keys(za).map(n => [n, m(za[n], zb[n])]));
}

/* Lauf von Sonne und Mond auf einem Bogen von links (Aufgang) nach rechts (Untergang), tagesaktuell aus sun.sun
   (next_rising/next_setting). Nachts läuft der Mond denselben Bogen vom Untergang bis zum nächsten Aufgang. */
export function himmelsBahn(sonne, jetzt = Date.now()) {
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
export function mondAlter(jetzt = Date.now()) { const p = ((jetzt - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1; return p < 0 ? p + 1 : p; }

export const himmelsBogen = t => [.08 + .84 * t, .4 - .3 * Math.sin(Math.PI * t)];

/* Werte für Sonne und Mond; in der Dämmerung (Sonne knapp unter dem Horizont) steht die Sonne am Rand */
export function himmelLauf(sonne, jetzt = Date.now()) {
  const b = himmelsBahn(sonne, jetzt), alter = mondAlter(jetzt), steigt = sonne && sonne.attributes && sonne.attributes.rising;
  return { uSonnePos: himmelsBogen(b.oben ? b.t : steigt === false ? 1 : 0), uMondPos: himmelsBogen(b.oben ? .5 : b.t),
    uMondK: Math.cos(2 * Math.PI * alter), uMondSeite: alter < .5 ? 1 : -1 };
}

export const HIMMEL_VS = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0., 1.); }';

export class Himmel {
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

/* ---------- Stimmung: Hintergrund nach Tageszeit (sun.sun) und Wetter (weather.*) ---------- */
export const zufall = seed => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

export function partikel(phase, wetter) {
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
export function phaseAusSonne(sonne) {
  if (!sonne) return 'tag';
  const a = sonne.attributes || {}, hoehe = Number(a.elevation), steigt = a.rising;
  if (!zahl(hoehe)) return sonne.state === 'below_horizon' ? 'nacht' : 'tag';
  if (hoehe < -6) return 'nacht';
  if (hoehe < 12) return steigt === false ? 'abend' : 'morgen';
  return 'tag';
}
