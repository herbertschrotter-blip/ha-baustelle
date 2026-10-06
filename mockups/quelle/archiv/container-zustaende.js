// BSM-032: Vergleich – je Zustand drei Versionen (Tür offen, Fenster gekippt, Fenster offen, Licht an).
// Baut mockups/container-zustaende.html: node mockups/quelle/archiv/container-zustaende.js
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
const ZEICHNER = require('./container-zeichner.js');

const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Container-Zustände</title>
<style>
:root { --bg: #eef1f5; --karte: #ffffff; --ink: #1c1f24; --ink2: #5b6470; --linie: #d9dee5; --rahmen: #d8dde3; --fenster: #8fc3e8; --amber: #ffb300; --wahl: #1e88e5; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #111418; --karte: #1c2026; --ink: #e8ebef; --ink2: #9aa4b1; --linie: #2c323a; --rahmen: #c9ced6; --fenster: #5d8fb5; } }
:root[data-theme="dark"] { --bg: #111418; --karte: #1c2026; --ink: #e8ebef; --ink2: #9aa4b1; --linie: #2c323a; --rahmen: #c9ced6; --fenster: #5d8fb5; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
header { padding: 18px 16px 8px; max-width: 1100px; margin: 0 auto; }
h1 { font-size: 20px; margin: 0 0 4px; } .leise { color: var(--ink2); font-size: 13px; }
.leiste { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
.leiste label { display: inline-flex; gap: 6px; align-items: center; background: var(--karte); border: 1px solid var(--linie); border-radius: 10px; padding: 6px 10px; font-size: 14px; }
main { max-width: 1100px; margin: 0 auto; padding: 0 16px 32px; }
h2 { font-size: 16px; margin: 22px 0 8px; }
.reihe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.karte { background: var(--karte); border: 1px solid var(--linie); border-radius: 14px; padding: 10px 12px 12px; }
.karte svg { width: 100%; height: auto; display: block; }
.karte b { font-size: 14px; } .karte .leise { margin-top: 2px; }
.cs-licht { filter: drop-shadow(0 0 4px #ffd54f); }
@media (max-width: 720px) { .reihe { grid-template-columns: 1fr; } }
</style></head><body>
<header><h1>Container-Zustände · drei Versionen</h1>
<div class="leise">BSM-032 Vorschlag: so zeigt das Container-Symbol, was die Sensoren melden. Je Zustand A, B oder C wählen – unten alle drei zusammen.</div>
<div class="leiste"><label><input type="checkbox" id="dop"> Doppelcontainer</label><label><input type="checkbox" id="heiz"> heizt</label>
<label>Ansicht <select id="thema"><option value="">wie das Gerät</option><option value="light">hell</option><option value="dark">dunkel</option></select></label></div></header>
<main id="inhalt"></main>
<script>
${ZEICHNER}
const ZUST = [
  ['tuer', '🚪 Tür offen', { tuer: [0] }, { A: 'Öffnung dunkel, Türblatt steht nach außen auf', B: 'Türblatt nach innen (schmal am Scharnier), heller Streifen am Boden', C: 'Tür bleibt gezeichnet, gelber Rahmen und Plakette' }],
  ['kipp', '↘ Fenster gekippt', { kipp: [1] }, { A: 'dunkler Spalt oben über die ganze Breite', B: 'Flügel oben nach innen geneigt – Keil mit Seitenschatten', C: 'Glas bleibt, gelber Rahmen und Plakette ⌄' }],
  ['offen', '⇔ Fenster offen', { offen: [1] }, { A: 'ganze Öffnung dunkel', B: 'Öffnung dunkel, Flügel nach außen aufgeschwenkt', C: 'Glas bleibt, gelber Rahmen und Plakette ‖' }],
  ['licht', '💡 Licht an', { licht: true }, { A: 'Fenster hellgelb mit leichtem Schein', B: 'warmweiß, Lichtkegel vor den Fenstern', C: 'Fenster bleiben, Glühbirnen-Plakette am Dach' }],
];
const sym = () => ({ doppel: document.getElementById('dop').checked, farbe: '#3987e5', tueren: [{ wand: 'front', pos: .15 }],
  fenster: [{ wand: 'front', pos: .5 }, { wand: 'front', pos: .85 }, { wand: 'seite', pos: .5 }] });
const zeigen = () => {
  const heizt = document.getElementById('heiz').checked, s = sym();
  let h = '';
  for (const [k, titel, z, text] of ZUST) {
    h += '<h2>' + titel + '</h2><div class="reihe">' + ['A', 'B', 'C'].map(v => '<div class="karte">' + csZeichnen(s, { heizt, ...z }, { [k]: v })
      + '<b>' + v + '</b><div class="leise">' + text[v] + '</div></div>').join('') + '</div>';
  }
  h += '<h2>Alles zusammen (Tür offen, ein Fenster gekippt, eins offen, Licht an)</h2><div class="reihe">' + ['A', 'B', 'C'].map(v => '<div class="karte">'
    + csZeichnen(s, { heizt, tuer: [0], kipp: [1], offen: [2], licht: true }, { tuer: v, kipp: v, offen: v, licht: v }) + '<b>alle ' + v + '</b></div>').join('') + '</div>';
  h += '<h2>Zum Vergleich: alles zu</h2><div class="reihe"><div class="karte">' + csZeichnen(s, { heizt }, {}) + '<b>zu</b></div></div>';
  document.getElementById('inhalt').innerHTML = h;
};
for (const id of ['dop', 'heiz']) document.getElementById(id).onchange = zeigen;
document.getElementById('thema').onchange = e => { if (e.target.value) document.documentElement.dataset.theme = e.target.value; else delete document.documentElement.dataset.theme; };
zeigen();
</script></body></html>`;
fs.writeFileSync(path.join(repo, 'mockups', 'container-zustaende.html'), html);
console.log('mockups/container-zustaende.html gebaut');
