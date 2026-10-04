// AN-0014: Vorschlag „Containergröße“ auf Basis des Master-Mockups.
// Baut mockups/containergroesse.html: node mockups/quelle/archiv/containergroesse.js
// 1. Container bearbeiten: Größe – Einzel (innen ≈ 13,5 m², 31 m³), Doppel (≈ 28 m², 64 m³) oder m² frei (Höhe 2,30 m).
// 2. Lernen: solange nichts gelernt ist, schätzt die Größe die Aufheizzeit („geschätzt aus der Größe“).
// 3. Vergleiche: „kWh je m²“ in der Rangliste („Wer verbraucht was“) und „je m²“ beim Ölradiator/Konvektor.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const SKRIPT = `
/* ================= AN-0014: Containergröße (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { sheet: p.sheet, klick: p.klick, stueck: p.awStueck };
  const NEU = '<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:6px;background:var(--amber);color:#000;margin-left:6px">neu</span>';
  const G = window.CG = { polier: 28 };   // Beispiel: Poliercontainer Doppel, die anderen Einzel
  const m2 = b => G[b.id] ?? (b.pumpe ? null : 13.5);
  p.sheet = function () {
    const h = alt.sheet.call(this), s = this.s.sheet; if (!s || s.art !== 'bereich' || !this.b || this.b.pumpe) return h;
    const b = this.b, w = m2(b), art = w === 13.5 ? 'einzel' : w === 28 ? 'doppel' : 'frei';
    const box = '<div class="zeile"><div><b>Größe</b>' + NEU + '<div class="leise">für Vergleiche (kWh je m²) und als Startwert der lernenden Regelung</div></div>'
      + '<div class="seg klein">' + [['einzel', 'Einzel'], ['doppel', 'Doppel'], ['frei', 'm²']].map(([k, t]) => '<button data-act="cg-art" data-v="' + k + '" class="' + (art === k ? 'on' : '') + '">' + t + '</button>').join('') + '</div></div>'
      + (art === 'frei' ? '<label class="zeile unter"><span>Fläche innen</span><span class="eingabe"><input type="number" step="0.5" value="' + w + '" data-cg="m2"> m²</span></label><div class="leise" style="padding:0 0 6px 12px">Höhe 2,30 m ≈ ' + de(w * 2.3, 0) + ' m³</div>' : '<div class="leise" style="padding:0 0 6px 12px">' + (art === 'einzel' ? 'Einzelcontainer innen 5,90 × 2,29 m ≈ 13,5 m² · 2,30 m hoch ≈ 31 m³' : 'Doppelcontainer innen 5,90 × 4,74 m ≈ 28 m² · 2,30 m hoch ≈ 64 m³') + '</div>')
      + (b.lern && b.lern.an && !(b.lern.warm && b.lern.warm.gelernt) ? '<div class="leise" style="padding:0 0 6px 12px">🧠 Noch nichts gelernt: Aufheizen geschätzt aus der Größe – ' + de(2.5 * 13.5 / w, 1) + ' °C/h</div>' : '');
    return h.replace('<label class="feld">Temperaturfühler', box + '<label class="feld">Temperaturfühler');
  };
  p.awStueck = function (k, B, A, z, gr) {
    let h = alt.stueck.call(this, k, B, A, z, gr);
    if (k === 'rangliste' && (!gr || gr.w > 2)) {
      h = h.replace('<span>kWh/h</span><span>jetzt</span>', '<span>kWh/h</span><span>kWh/m²</span><span>jetzt</span>');
      const rang = (A && A.rangliste) || [];
      let i = 0; h = h.replace(/(<span>(?:[\\d,]+|–)<\\/span>)(<span>(?:[\\d,]+°|–)<\\/span><\\/button>)/g, (m, a, b2) => { const c = rang[i++], bb = c && this.d.bereiche.find(x => x.id === c.bereich), q = bb && m2(bb);
        return a + '<span>' + (c && q ? de(c.kwh / q, 2) : '–') + '</span>' + b2; });
      h = h.replace('class="aw-tab-kopf"', 'class="aw-tab-kopf" style="grid-template-columns:1.6fr .6fr .6fr .7fr .6fr .6fr .5fr"').replace(/class="aw-tab-zeile"/g, 'class="aw-tab-zeile" style="grid-template-columns:1.6fr .6fr .6fr .7fr .6fr .6fr .5fr"');
    }
    if (k === 'vergleich') h = h.replace('<tr><td>zählt</td>', '<tr><td>kWh je Gradstunde und m²' + NEU + '</td><td>0,0021</td><td>0,0028</td></tr><tr><td>zählt</td>');
    return h;
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    if (a === 'cg-art') { const b = this.b; G[b.id] = { einzel: 13.5, doppel: 28, frei: 20 }[el.dataset.v]; return this.render(); }
    return alt.klick.call(this, ev);
  };
})();
`;
ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Containergröße</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>AN-0014 Containergröße · Vorschlag auf Seite $1</b>');
ersetze('<button id="neu">Beispiel neu laden</button>', `<button id="neu">Beispiel neu laden</button>
<label>zeigen <select id="cg-ziel"><option value="bereich">Container bearbeiten</option><option value="auswertung">Auswertung (Rangliste, Ölradiator/Konvektor)</option></select></label>`);
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
const cgZiel = document.getElementById('cg-ziel');
const cgZeigen = () => { for (const p of P) { if (cgZiel.value === 'bereich') { const b = p.d.bereiche.find(x => x.id === 'polier') || p.d.bereiche[0]; p.gehe('container', b.id); p.klick({ target: { closest: () => ({ dataset: { act: 'sheet', s: 'bereich' } }) } }); }
  else { p.gehe('auswertung'); p.awAuswahl().forEach(x => { if (['rangliste', 'vergleich'].includes(x.k)) Object.assign(x, { an: true, w: 4, h: 4, st: 'L' }); }); p.render(); } } };
cgZiel.onchange = cgZeigen; cgZeigen();`);
fs.writeFileSync(path.join(repo, 'mockups', 'containergroesse.html'), html);
console.log(`mockups/containergroesse.html gebaut (${Math.round(html.length / 1024)} KB)`);
