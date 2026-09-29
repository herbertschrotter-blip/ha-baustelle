// node montage.mjs ziel.png spalten bild1.png bild2.png ...
import { PNG } from 'pngjs'; import fs from 'fs';
const [ziel, sp, ...bilder] = process.argv.slice(2); const b = bilder.map(f => PNG.sync.read(fs.readFileSync(f)));
const w = b[0].width, h = b[0].height, S = +sp, Z = Math.ceil(b.length / S), rand = 6;
const out = new PNG({ width: S * w + (S - 1) * rand, height: Z * h + (Z - 1) * rand }); out.data.fill(255);
b.forEach((img, k) => { const ox = (k % S) * (w + rand), oy = Math.floor(k / S) * (h + rand);
  for (let y = 0; y < h; y++) img.data.copy(out.data, ((oy + y) * out.width + ox) * 4, y * w * 4, (y + 1) * w * 4); });
fs.writeFileSync(ziel, PNG.sync.write(out)); console.log('montage', out.width, 'x', out.height);
