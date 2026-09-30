// Hintergrund „Himmel hinter einer Glasscheibe“: Stimmung nach Tageszeit und Wetter.
// Eigene Umsetzung (WebGL 1 / GLSL ES 1.0). Einheiten: CSS-Pixel, y nach unten.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;        // Gerätepixel
uniform float uDpr;
uniform float uTime;      // Sekunden
uniform vec3 uG1, uG2, uG3, uF1, uF2, uF3;   // Verlauf und Lichtflecken der Stimmung
uniform float uBlobA, uSat;
uniform vec3 uDunstC; uniform float uDunst;
uniform vec3 uWolkeD, uWolkeH, uNebelC;
uniform float uWolken, uRegen, uSchnee, uNebel, uSonne, uNachtKlar, uBlitz, uBlitzX;
uniform vec2 uSonnePos; uniform vec3 uSonneF;
uniform vec2 uMondPos; uniform float uMondK, uMondSeite;   // Mond: Ort, cos(2π·Mondalter), +1 zunehmend / −1 abnehmend

vec2 R;

float h11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 h31(float p) { vec3 q = fract(vec3(p) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xxy + q.yzz) * q.zyx); }
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float rausch(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), u.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0., a = .5;
  for (int i = 0; i < 5; i++) { s += a * rausch(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; }
  return s;
}

vec3 fleck(vec3 col, vec3 f, vec2 c, float r, float ph, vec2 p) {
  float k = .5 - .5 * cos(6.2832 * uTime / 14. + ph);
  c += vec2(30., 40.) * k; r *= 1. + .15 * k;
  float g = dot(f, vec3(.299, .587, .114));
  f = mix(vec3(g), f, uSat);
  float d = length(p - c) / (r + 60.);
  return mix(col, f, uBlobA * exp(-d * d * 2.2));
}

vec3 grund(vec2 p) {
  float a = radians(165.);
  vec2 dir = vec2(sin(a), -cos(a));
  float t = clamp(dot(p - R * .5, dir) / (abs(R.x * dir.x) + abs(R.y * dir.y)) + .5, 0., 1.);
  vec3 col = t < .5 ? mix(uG1, uG2, t * 2.) : mix(uG2, uG3, t * 2. - 1.);
  col = fleck(col, uF1, vec2(70., 70.), 130., 0., p);
  col = fleck(col, uF2, vec2(R.x - 40., 420.), 120., -2.244, p);
  col = fleck(col, uF3, vec2(140., R.y - 60.), 100., -4.039, p);
  return col;
}

/* Alles hinter der Scheibe */
vec3 szene(vec2 p) {
  vec2 uv = p / R;
  vec3 col = grund(p);

  if (uSonne > .01) {
    vec2 d = p - uSonnePos * R;
    float r = length(d) / R.y;
    float ang = atan(d.y, d.x);
    float strahl = pow(rausch(vec2(ang * 11., uTime * .04)), 4.) * exp(-r * 4.) * smoothstep(.02, .08, r) * .05;
    // gedämpft, damit die Schrift auf dem Glas davor lesbar bleibt
    col += uSonneF * (exp(-r * 7.) * .08 + exp(-r * 30.) * .14 + strahl) * uSonne;
    col = mix(col, vec3(1., .98, .93), smoothstep(.016, .011, r) * .55 * uSonne);
  }

  if (uNachtKlar > .01) {
    vec2 id = floor(p / 26.), f = fract(p / 26.) - .5;
    vec3 n = h31(id.x * 57.3 + id.y * 113.1);
    float s = smoothstep(.05 + .05 * n.z, 0., length(f - (n.xy - .5) * .7)) * step(.6, n.z);
    s *= .55 + .45 * sin(uTime * (1. + n.x * 3.) + n.y * 6.28);
    col += vec3(.9, .95, 1.) * s * smoothstep(.9, .25, uv.y) * uNachtKlar;
    vec2 mp = uMondPos * R, mq = (p - mp) / 20.;
    float mr = length(p - mp), anteil = .5 - .5 * uMondK;   // beleuchteter Anteil der Scheibe
    col += vec3(.55, .65, .9) * exp(-mr / 70.) * .35 * (.2 + .8 * anteil) * uNachtKlar;
    float scheibe = smoothstep(21., 19.5, mr);
    // Schattengrenze: beleuchtet, wo x (zur Lichtseite) über uMondK·√(1−y²) liegt
    float grenze = uMondK * sqrt(max(1. - mq.y * mq.y, 0.));
    float licht = smoothstep(grenze - .06, grenze + .06, mq.x * uMondSeite);
    vec3 mf = vec3(.95, .94, .88) - fbm((p - mp) * .14) * .3;
    col = mix(col, mix(col * .75 + mf * .06, mf, licht), scheibe * uNachtKlar);
  }

  if (uWolken > .01) {
    vec2 q = uv * vec2(R.x / R.y, 1.) * 2.4 + vec2(uTime * .015, 0.);
    float w = fbm(q + fbm(q * 1.6 + vec2(0., uTime * .02)) * 1.3);
    float bed = mix(.62, .22, clamp(uWolken, 0., 1.));
    float dichte = smoothstep(bed, bed + .38, w) * (1. - .35 * uv.y);
    float licht = smoothstep(.3, .85, fbm(q * 2.1 + vec2(3.1, -uTime * .01)) * .6 + (w - bed) * .9);
    vec3 wf = mix(uWolkeD, uWolkeH, licht);
    wf += vec3(.8, .84, 1.) * uBlitz * (.25 + licht * .55) * .6;
    col = mix(col, wf, clamp(dichte * uWolken * 1.15, 0., 1.));
  }

  if (uBlitz > .01) {
    float y = uv.y;
    float x = uBlitzX * R.x + (fbm(vec2(y * 7., uBlitzX * 40.)) - .5) * 160. + (rausch(vec2(y * 40., uBlitzX * 9.)) - .5) * 18.;
    float strahl = smoothstep(2.5, 0., abs(p.x - x)) + smoothstep(14., 0., abs(p.x - x)) * .35;
    col += vec3(.9, .92, 1.) * strahl * smoothstep(.62, .45, y) * uBlitz;
    col += uBlitz * .05;
  }

  if (uRegen > .01) {
    vec2 rp = vec2(p.x + p.y * .2, p.y);
    float sp = floor(rp.x / 5.);
    vec3 n = h31(sp * 13.7 + 2.);
    float y = fract(rp.y / (R.y * .7) - uTime * (1.1 + n.x * .8) + n.y);
    float strich = smoothstep(0., .015, y) * smoothstep(.16, .02, y) * smoothstep(.22, 0., abs(fract(rp.x / 5.) - .5));
    col += vec3(.75, .82, .95) * strich * step(n.z, .28 * min(uRegen, 1.4)) * .16;
  }

  if (uNebel > .01) {
    vec2 q = uv * vec2(R.x / R.y, 1.) * 2.2;
    float n1 = fbm(q * vec2(.7, 1.5) + vec2(uTime * .03, 0.));
    float n2 = fbm(q * vec2(1.4, 2.6) - vec2(uTime * .055, uTime * .01) + 5.2);
    float dichte = smoothstep(.32, .8, n1 * .55 + n2 * .55);
    vec3 nf = mix(uNebelC * .92, uNebelC * 1.18, dichte);
    col = mix(col, nf, clamp(.3 + dichte * .6 * (.55 + .45 * uv.y), 0., 1.) * uNebel);
  }

  if (uSchnee > .01) {
    for (int k = 0; k < 3; k++) {
      float fk = float(k) / 2.;
      float zelle = mix(95., 26., fk), rad = mix(4.2, 1.1, fk), v = mix(62., 22., fk), weich = mix(3.2, .6, fk);
      vec2 q = p + vec2(sin(uTime * .4 + fk * 3.) * 24., -uTime * v);
      vec2 id = floor(q / zelle), f = q - (id + .5) * zelle;
      vec3 n = h31(id.x * 31.7 + id.y * 17.3 + fk * 71.);
      vec2 o = (n.xy - .5) * zelle * .7 + vec2(sin(uTime * (.7 + n.z) + n.x * 6.28) * zelle * .12, 0.);
      float fl = smoothstep(rad + weich, rad - weich * .3, length(f - o)) * step(n.z, .8);
      col = mix(col, vec3(1.), fl * mix(.8, .55, fk) * uSchnee);
    }
  }

  return mix(col, uDunstC, uDunst);
}

/* Tropfen auf der Scheibe: xy = Versatz für die Brechung, z = Wasser, w = klares Glas */
vec4 laufend(vec2 p) {
  float cw = 32.;
  float spalte = floor(p.x / cw);
  vec3 n = h31(spalte * 17.13 + 3.1);
  if (n.x > .45 * uRegen) return vec4(0.);
  float x0 = (spalte + .5) * cw + (n.y - .5) * cw * .18;
  float dauer = mix(4.5, 9., n.z) / max(uRegen, .6);
  float k = uTime / dauer + n.x * 7.;
  vec3 m = h31(spalte * 3.7 + floor(k) * 11.9);
  float stufen = 7.;
  float g = fract(k) * stufen;
  g = (floor(g) + smoothstep(.5, 1., fract(g))) / stufen;
  float yK = mix(-.08, 1.12, g) * R.y;
  float r = mix(4.5, 8.5, m.x);
  float xl = x0 + sin(p.y * .02 + m.y * 6.) * 2.5;
  vec2 q = vec2(p.x - xl, p.y - yK);
  q.y *= q.y < 0. ? .6 : 1.05;
  float wasser = smoothstep(1., .85, length(q) / r);
  vec2 v = q / r;
  float oben = yK - p.y;
  float lang = mix(70., 200., m.z);
  float xs = abs(p.x - xl);
  float inSpur = step(0., oben) * smoothstep(lang, 0., oben);
  float abst = 15.;
  float yr = mod(oben, abst) - abst * .5;
  float rr = r * .42 * inSpur * (.55 + .45 * h11(floor(oben / abst) + spalte * 7.));
  vec2 qr = vec2(p.x - xl, yr);
  float perle = rr > .2 ? smoothstep(rr, rr * .7, length(qr)) * step(abst * .7, oben) : 0.;
  if (perle > wasser) { wasser = perle; v = qr / max(rr, .5); }
  float klar = max(smoothstep(r * .55, r * .25, xs) * step(0., oben) * smoothstep(lang * 1.4, 0., oben), wasser);
  return vec4(v, wasser, klar);
}

vec4 stehend(vec2 p, float zelle, float rMin, float rMax, float dichte, float seed) {
  vec2 id = floor(p / zelle);
  vec3 n = h31(id.x * 127.1 + id.y * 311.7 + seed);
  float per = mix(7., 15., n.z);
  float t = uTime / per + n.x * 5.;
  float leben = fract(t);
  vec3 m = h31(id.x * 7.3 + id.y * 13.1 + seed + floor(t) * 1.7);
  float r = mix(rMin, rMax, m.x) * smoothstep(0., .12, leben) * smoothstep(1., .85, leben) * step(n.y, dichte);
  if (r < .3) return vec4(0.);
  vec2 c = (id + .5) * zelle + (m.yz - .5) * (zelle - 2. * rMax) * .9;
  vec2 q = p - c;
  float wasser = smoothstep(r, r * .8, length(q));
  return vec4(q / r, wasser, wasser);
}

void main() {
  R = uRes / uDpr;
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec3 col = szene(p);
  if (uRegen > .01) {
    vec4 a = laufend(p);
    vec4 b = stehend(p, 19., 1.2, 3.4, .5 + .3 * min(uRegen, 1.), 1.);
    vec4 c = stehend(p, 40., 3.5, 8.5, .5 * min(uRegen, 1.), 7.);
    float weg = a.w;
    b.z *= 1. - weg; c.z *= 1. - weg;
    vec4 w = a;
    if (b.z > w.z) w = vec4(b.xy, b.z, max(a.w, b.z));
    if (c.z > w.z) w = vec4(c.xy, c.z, max(a.w, c.z));
    float wasser = w.z * min(uRegen, 1.);
    if (wasser > .01) {
      vec2 qn = w.xy;                                  // Lage im Tropfen, Mitte 0, Rand 1
      float lq = length(qn);
      // Linse: der Himmel erscheint verkleinert und auf dem Kopf
      vec3 linse = szene(p - qn * 22. + vec2(0., -6.)) * 1.08;
      linse *= 1. - .38 * smoothstep(.15, 1., -qn.y) * smoothstep(.4, 1., lq);   // oben dunkler Rand
      linse += vec3(.9, .95, 1.) * .22 * smoothstep(.1, .9, qn.y) * smoothstep(1., .75, lq); // unten helle Sichel
      linse *= 1. - .25 * smoothstep(.72, 1., lq);                              // Kante
      linse += vec3(1.) * .75 * smoothstep(.2, .04, length(qn - vec2(-.3, -.42))); // Glanzpunkt
      col = mix(col, linse, wasser);
      col *= 1. - .18 * smoothstep(.0, .5, wasser) * smoothstep(1., .5, wasser);   // Schatten am Außenrand
    }
    col *= 1. - .035 * max(a.w - wasser, 0.);         // nasse Spur hinter laufenden Tropfen
    float beschlag = (1. - max(w.w, wasser)) * .07 * min(uRegen, 1.);
    col = mix(col, uNebelC, beschlag);
  }
  if (uSchnee > .01) {
    vec2 uv = p / R;
    float rand = min(min(uv.x, 1. - uv.x) * R.x / R.y * 1.4, (1. - uv.y) * .8);
    float eis = smoothstep(.09, 0., rand + (fbm(p * .018) - .5) * .14) * (.4 + .6 * uv.y);
    float kristall = smoothstep(.55, .75, fbm(p * .12 + 3.)) * .5 + .5;
    col = mix(col, vec3(.93, .97, 1.), eis * kristall * .6 * uSchnee);
  }
  gl_FragColor = vec4(col, 1.);
}
