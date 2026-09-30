// Baut mockups/glas.html: node mockups/quelle/glas.js
// Wettersymbole und Container-Grafiken kommen unverändert aus dem Panel, damit Mockup und Seite gleich aussehen.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..');
const panel = fs.readFileSync(path.join(repo, 'custom_components/baustelle/frontend/baustelle-panel.js'), 'utf8');
const zwischen = (a, b, ab = 0) => { const i = panel.indexOf(a, ab); const j = panel.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error('nicht gefunden: ' + a); return panel.slice(i, j); };

const js = zwischen('/* Realistische, animierte Wettersymbole', '\nconst CSS = `');
const ohneHost = css => css.split('\n').filter(z => !z.startsWith(':host')).join('\n');
const wetterCss = ohneHost(zwischen('/* Wetter */', '/* Übersicht: Baustelle und Container als Kacheln */'));
const bcCss = '.bc { width: 100%; height: auto; display: block; overflow: visible; } .bc.offline { filter: grayscale(.8) brightness(.8); }\n'
  + zwischen('@keyframes rein', '`;', panel.indexOf('/* Übersicht: Baustelle und Container als Kacheln */'));
const css = fs.readFileSync(path.join(__dirname, 'glas.css'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'glas-app.js'), 'utf8');
// Himmel: Shader als Zeichenkette, dazu Werte je Stimmung und der WebGL-Zeichner
// Über-Seite: Verlauf direkt aus CHANGELOG.md (eine Quelle, nichts doppelt pflegen)
const changelog = fs.readFileSync(path.join(repo, 'CHANGELOG.md'), 'utf8').split(/^## /m).slice(1).map(teil => {
  const [kopf, ...rest] = teil.split('\n'), m = kopf.match(/\[([^\]]+)\]\s*–\s*(\S+)/);
  const punkte = rest.join('\n').split(/^- /m).slice(1).map(p => p.replace(/\s*\n\s*/g, ' ').trim());
  return m ? { version: m[1], datum: m[2], punkte } : null; }).filter(Boolean);
const himmel = `const HIMMEL_FS = ${JSON.stringify(fs.readFileSync(path.join(__dirname, 'himmel.frag'), 'utf8'))};\n` + fs.readFileSync(path.join(__dirname, 'himmel.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Baustelle – Glas, klickbar</title>
<style>${wetterCss}
${bcCss}
${css}</style></head>
<body>
<div class="bar"><b>Baustelle · Glas · klickbarer Prototyp</b><button id="modus">Hell / Dunkel</button>
<label>Datum <input type="date" id="datum"></label>
<label>Uhrzeit <input type="range" id="uhr" min="0" max="1435" step="5"> <span id="uhr-text"></span></label><button id="raffer">▶ Zeitraffer</button>
<button id="az-auto" title="FE-0002: nur die automatisch angelegte Arbeitszeit">Arbeitszeit wie neue Baustelle</button>
<label>Wetter <select id="wetter"><option value="klar" selected>klar</option><option value="wolkig">bewölkt</option><option value="regen">Regen</option><option value="gewitter">Gewitter</option><option value="nebel">Nebel</option><option value="schnee">Schnee</option></select></label>
<span class="leise">Vorführung: Sonnenstand wie sun.sun (hier nachgebildet für etwa 47° N), Mondphase aus dem Datum, Wetter aus der Wetter-Entität</span></div>
<div class="buehne">
  <div><h2>Handy · 390 px</h2><div class="telefon"><div class="app"></div></div></div>
  <div><h2>Desktop</h2><div class="desktop"><div class="app"></div></div></div>
</div>
<script>
${js}
${himmel}
const CHANGELOG = ${JSON.stringify(changelog)};
${app}
</script></body></html>`;
const ziel = path.join(repo, 'mockups', 'glas.html');
fs.writeFileSync(ziel, html);
console.log('geschrieben', path.relative(repo, ziel), Math.round(html.length / 1024), 'KB');
