// Vorschlag „Staffelung nach Bedarf in °C“ (Herbert 01.10.2026, nach AN-0013) auf Basis des Master-Mockups.
// Baut mockups/staffel-rang.html: node mockups/quelle/archiv/staffel-rang.js (Vorschlag – eingebaut in 0.8.35)
// Ändert nur die Einblendung „Stromverteilung“: Rangliste je Heizkörper mit festen Stufen und „Bedarf in 15 min“
// (jetzt unter dem Soll + Trend + Nachlauf + Zuschläge). Trend, Nachlauf, Heizzeit der letzten Stunde: Beispielwerte.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const CSS = `
.sr-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 6px; vertical-align: middle; }
.sr-kopf { display: flex; align-items: baseline; gap: 8px; margin: 14px 2px 6px; } .sr-kopf b { font-size: 16px; }
.sr-zeile { display: grid; grid-template-columns: 28px 1fr auto; gap: 2px 10px; padding: 9px 4px; border-top: 1px solid var(--gridc); align-items: center; cursor: pointer; }
.sr-zeile:first-of-type { border-top: 0; }
.sr-nr { font-size: 17px; font-weight: 600; text-align: center; color: var(--ink2); }
.sr-name b { font-size: 14px; } .sr-name .leise { font-size: 12px; }
.sr-bedarf { text-align: right; font-size: 18px; font-weight: 500; white-space: nowrap; } .sr-bedarf small { display: block; font-size: 11px; color: var(--ink2); font-weight: 400; }
.sr-stufe { display: inline-block; font-size: 10.5px; padding: 1px 7px; border-radius: 8px; margin-right: 4px; background: rgba(120,120,128,.2); }
.sr-stufe.frost { background: color-mix(in srgb, var(--blau) 30%, transparent); } .sr-stufe.boost { background: color-mix(in srgb, var(--amber) 35%, transparent); }
.sr-stufe.erster { background: color-mix(in srgb, #30d158 30%, transparent); }
.sr-auf { grid-column: 2 / -1; display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; font-size: 12.5px; padding: 6px 10px; margin-top: 4px; border-radius: 10px; background: rgba(120,120,128,.10); }
.sr-auf b { text-align: right; font-weight: 500; } .sr-auf .summe { border-top: 1px solid var(--gridc); padding-top: 3px; font-weight: 600; }
.sr-zust { grid-column: 2 / -1; font-size: 12px; }
.sr-regel { font-size: 12.5px; line-height: 1.45; padding: 8px 12px; border-radius: 12px; background: rgba(120,120,128,.10); margin: 6px 0; }
.sr-regel ol { margin: 4px 0 0 18px; padding: 0; }
`;

const SKRIPT = `
/* ================= Staffelung nach Bedarf in °C (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { sheet: p.sheet, klick: p.klick, aufbauen: p._aufbauen };
  const NEU = '<span class="sr-neu">neu</span>', BSP = '<span class="leise">· Beispiel</span>';
  p._aufbauen = function () { const erst = !this.root; alt.aufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS)}; this.shadowRoot.appendChild(s); } };
  /* Beispielwerte je Heizkörper: Trend °C/h, gelernter Nachlauf °C, Heizzeit letzte Stunde (min) */
  const BEISPIEL = i => ({ trend: [2.0, -1.0, 0.6, -0.4, 1.2, -1.6][i % 6], nachlauf: [0.3, 0, 0.2, 0, 0.3, 0][i % 6], minuten: [55, 20, 40, 10, 35, 25][i % 6] });
  p.srRang = function () {
    const d = this.d, L = this.last(), soll0 = d.e.soll;
    const zeilen = L.hk.map((x, i) => {
      const b = x.b, g = x.g, B = BEISPIEL(i), soll = b.soll ?? soll0, oel = /öl/i.test(g.typ || '');
      const mitFuehler = b.t !== null && b.t !== undefined;
      const jetzt = mitFuehler ? soll - b.t : null, trend = mitFuehler ? -B.trend * 0.25 : null, nach = mitFuehler && g.an && oel ? -B.nachlauf : 0;
      const gerecht = Math.max(0, (35 - B.minuten) / 10 * 0.1);
      const bedarf = mitFuehler ? jetzt + trend + nach + gerecht : null;
      const stufe = b.z === 'frost' ? 'frost' : b.boost ? 'boost' : null;
      return { x, b, g, B, soll, oel, mitFuehler, jetzt, trend, nach, gerecht, bedarf, stufe, prio: b.prio || 'normal' };
    });
    // Rang: Frost > Schnell > erster seines Containers > Priorität > Bedarf (ohne Fühler: fester Anteil, hinten)
    const erste = {};   // je Container: der laufende, sonst der erste wartende
    for (const z of zeilen) if (z.g.an && !erste[z.b.id]) erste[z.b.id] = z;
    for (const z of zeilen) if (!erste[z.b.id]) erste[z.b.id] = z;
    for (const z of zeilen) z.erster = erste[z.b.id] === z;
    const P = { hoch: 2, normal: 1, niedrig: 0 };
    zeilen.sort((a, c) => (c.stufe === 'frost') - (a.stufe === 'frost') || (c.stufe === 'boost') - (a.stufe === 'boost') || c.erster - a.erster || P[c.prio] - P[a.prio]
      || (c.bedarf ?? -9) - (a.bedarf ?? -9));
    return zeilen;
  };
  p.srHtml = function () {
    const Z = this.srRang(), f = (v, k = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + de(Math.abs(v), k);
    const letzterAn = [...Z].reverse().find(z => z.g.an), ersterWartet = Z.find(z => !z.g.an && z.g.warte);
    return '<div class="sr-kopf"><b>Rangliste</b>' + NEU + '<span class="leise">oben = zuerst an, unten = gibt zuerst ab</span></div>'
      + '<div class="glas-panel liste" style="padding:2px 10px">' + Z.map((z, i) => {
        const auf = (this.s.srOffen || []).includes(z.g.id), kw = zahl(z.g.kwJetzt) ? z.g.kwJetzt : z.g.kw;
        const stufen = (z.stufe === 'frost' ? '<span class="sr-stufe frost">❄ Frostschutz</span>' : '') + (z.stufe === 'boost' ? '<span class="sr-stufe boost">⚡ Schnell</span>' : '')
          + (z.erster ? '<span class="sr-stufe erster">erster im Container</span>' : '<span class="sr-stufe">Zweitgerät</span>') + (z.prio !== 'normal' ? '<span class="sr-stufe">Priorität ' + z.prio + '</span>' : '');
        const zust = !z.g.an ? (z.g.warte ? '<span class="blau">wartet' + (z.x === ersterWartet ? ' – kommt als nächstes dran' : '') + '</span>' : '<span class="leise">aus</span>')
          : kw < 0.05 ? '<span class="leise">an · zieht gerade nichts (Thermostat)</span>' : '<span class="amber-t">heizt · ' + de(kw, 2) + ' kW' + (z === letzterAn ? ' · gibt als nächstes ab' : '') + '</span>';
        const bedarf = z.mitFuehler ? '<div class="sr-bedarf">' + f(z.bedarf) + ' °C<small>Bedarf in 15 min</small></div>' : '<div class="sr-bedarf">–<small>ohne Fühler</small></div>';
        const aufHtml = !auf ? '' : z.mitFuehler
          ? '<div class="sr-auf"><span>jetzt ' + de(z.b.t, 1) + ' °C, Soll ' + de(z.soll, 1) + ' °C</span><b>' + f(z.jetzt) + ' °C</b>'
            + '<span>Trend ' + f(-z.trend * 4, 1) + ' °C/h → in 15 min ' + BSP + '</span><b>' + f(z.trend) + ' °C</b>'
            + (z.oel && z.g.an ? '<span>Ölradiator heizt nach dem Aus noch nach (gelernt) ' + BSP + '</span><b>' + f(z.nach) + ' °C</b>' : '')
            + (z.gerecht ? '<span>wenig Heizzeit in der letzten Stunde (' + z.B.minuten + ' min) ' + BSP + '</span><b>' + f(z.gerecht) + ' °C</b>' : '')
            + '<span class="summe">Bedarf</span><b class="summe">' + f(z.bedarf) + ' °C</b></div>'
          : '<div class="sr-auf"><span>Ohne Fühler kein Bedarf: läuft mit festem Anteil – jeden zweiten Takt</span><b></b></div>';
        return '<div class="sr-zeile" data-act="sr-auf" data-id="' + z.g.id + '"><span class="sr-nr">' + (i + 1) + '</span><div class="sr-name"><b>' + esc(z.b.name) + ' · ' + esc(z.g.n) + '</b><div>' + stufen + '</div></div>' + bedarf
          + '<div class="sr-zust">' + zust + ' <span class="leise">· antippen: woraus</span></div>' + aufHtml + '</div>';
      }).join('') + '</div>'
      + '<div class="sr-regel"><b>So entscheidet die Staffelung</b><ol>'
      + '<li>Feste Stufen zuerst: Frostschutz, dann Schnell aufheizen, dann der erste Heizkörper jedes Containers, dann die Priorität.</li>'
      + '<li>Danach der <b>Bedarf in 15 min</b>: wie weit der Raum am Ende des Takts unter dem Soll wäre – jetzt unter dem Soll, plus Trend, minus Nachlauf des Ölradiators, plus Zuschläge (Soll bis Arbeitsbeginn nicht zu schaffen; wenig Heizzeit in der letzten Stunde).</li>'
      + '<li>Gerechnet wird mit dem gemessenen Verbrauch. Ist der Anschluss <b>länger als 30 s</b> zu voll, geht der unterste laufende aus' + NEU + '; bei gleichem Rang zuerst der größere Verbraucher' + NEU + '.</li>'
      + '<li>Rundlauf alle ' + this.d.e.takt + ' min: der oberste Wartende tauscht mit dem untersten Laufenden – nie ein Zweitgerät gegen den einzigen eines anderen Containers.</li></ol></div>';
  };
  p.sheet = function () {
    const h = alt.sheet.call(this), s = this.s.sheet;
    if (!s || s.art !== 'strom') return h;
    const i = h.indexOf('<div class="hinweis-k">');
    return i > 0 ? h.slice(0, i) + this.srHtml() + h.slice(i) : h + this.srHtml();
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    if (a === 'sr-auf') { const id = el.dataset.id, o = this.s.srOffen ||= []; o.includes(id) ? o.splice(o.indexOf(id), 1) : o.push(id); return this.render(); }
    return alt.klick.call(this, ev);
  };
})();
`;

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Staffelung nach Bedarf</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>Staffelung nach Bedarf in °C · Vorschlag auf Seite $1</b>');
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
for (const p of P) { p.s.sheet = { art: 'strom' }; p.render(true); }`);
fs.writeFileSync(path.join(repo, 'mockups', 'staffel-rang.html'), html);
console.log(`mockups/staffel-rang.html gebaut (${Math.round(html.length / 1024)} KB)`);
