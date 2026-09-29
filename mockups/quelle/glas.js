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

const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Baustelle – Glas, klickbar</title>
<style>${wetterCss}
${bcCss}
${css}</style></head>
<body>
<div class="bar"><b>Baustelle · Glas · klickbarer Prototyp</b><button id="modus">Hell / Dunkel</button>
<span class="leise">Beispieldaten · alles anklickbar: Kacheln, Chips, Schalter, Zeitplan, Diagramme (Maus darüber), ⚙</span></div>
<div class="buehne">
  <div><h2>Handy · 390 px</h2><div class="telefon"><div class="app"></div></div></div>
  <div><h2>Desktop</h2><div class="desktop"><div class="app"></div></div></div>
</div>
<script>
${js}
${app}
</script></body></html>`;
const ziel = path.join(repo, 'mockups', 'glas.html');
fs.writeFileSync(ziel, html);
console.log('geschrieben', path.relative(repo, ziel), Math.round(html.length / 1024), 'KB');
