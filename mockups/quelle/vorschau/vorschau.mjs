// Standbilder des Himmel-Shaders ohne Browser: node vorschau.mjs <breite> <hoehe> <dpr> <zeit> phase:wetter:hell ...
import GLSL from 'glsl-transpiler';
import { PNG } from 'pngjs';
import fs from 'fs';
const src = fs.readFileSync('../himmel.frag', 'utf8').replace(/#ifdef[\s\S]*?#endif/, '');
const js = GLSL({ uniform: n => `U.${n}` }).compile(src);
const ziel = new Function(fs.readFileSync('../himmel.js', 'utf8').split('const HIMMEL_VS')[0] + '; return himmelZiel;')();
const [w, h, dpr, zeit, ...faelle] = process.argv.slice(2);
for (const fall of faelle) {
  const [phase, wetter, hell, blitz] = fall.split(':');
  const U = { ...ziel(phase, wetter, hell === 'hell'), uRes: [w * dpr, h * dpr], uDpr: +dpr, uTime: +zeit, uBlitz: +(blitz || 0), uBlitzX: .45 };
  const fc = new Float32Array(4), fo = new Float32Array(4);
  const main = new Function('U', 'gl_FragCoord', 'gl_FragColor', js.replace(/var gl_FragColor[^\n]*\n/, '').replace(/var gl_FragCoord[^\n]*\n/, '') + '; return main;')(U, fc, fo);
  const W = w * dpr, H = h * dpr, png = new PNG({ width: W, height: H }), t0 = Date.now();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    fc[0] = x + .5; fc[1] = H - y - .5; main();
    const i = (y * W + x) * 4; for (let k = 0; k < 3; k++) png.data[i + k] = Math.max(0, Math.min(255, Math.round(fo[k] * 255))); png.data[i + 3] = 255;
  }
  fs.writeFileSync(`bild-${fall.replace(/:/g, '-')}.png`, PNG.sync.write(png));
  console.log(fall, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}
