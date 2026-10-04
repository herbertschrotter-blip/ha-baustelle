// Vorschlag „Strompreis mit gilt ab“ und „Preis simulieren“ (Herbert 04.10.2026, nach FE-0016) auf Basis des Master-Mockups.
// Baut mockups/strompreis.html: node mockups/quelle/archiv/strompreis.js (Vorschlag – eingebaut in 0.8.46)
// 1. Einstellungen › Strom (und Baustelle bearbeiten): Preisliste mit „gilt ab“ statt eines Preises – Auswertung,
//    Abrechnung und CSV rechnen jeden Tag mit dem Preis, der damals galt.
// 2. Neue Kachel „Preis simulieren“ (Katalog › Baustelle): Verbrauch mit einem anderen Preis – im echten Bau rechnet die
//    Integration (kWh je Tag × simulierter Preis); im Mockup die Seite aus den Beispielwerten.
// 3. Auswertung: Chip „💶 Preis“ – tatsächlich (je Tag der gültige) oder simuliert; alle € der Auswertung mit diesem Preis.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const CSS = `
.sp-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 6px; vertical-align: middle; }
.sp-zeile { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--gridc); } .sp-zeile:first-of-type { border-top: 0; }
.sp-zeile b { font-size: 15px; } .sp-zeile .x { margin-left: auto; }
.sp-sim { display: flex; align-items: center; gap: 8px; } .sp-sim b { font-size: 18px; min-width: 64px; text-align: center; }
.sp-chip-sim { background: color-mix(in srgb, #bf5af2 30%, transparent) !important; }
.sp-hinweis { font-size: 12px; color: var(--ink2); }
.sp-band { margin: 6px 0; font-size: 12px; padding: 6px 10px; border-radius: 10px; background: color-mix(in srgb, #bf5af2 18%, transparent); }
`;

const SKRIPT = `
/* ================= Strompreis mit „gilt ab“ und Preis simulieren (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { bloecke: p.einstBloecke, sheet: p.sheet, klick: p.klick, aufbauen: p._aufbauen, daten: p.kkDaten, aw: p.awSeite, wahl: p.kkWahl, kachel: p.kkKachel };
  const NEU = '<span class="sp-neu">neu</span>';
  p._aufbauen = function () { const erst = !this.root; alt.aufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS)}; this.shadowRoot.appendChild(s); } };
  const SP = window.SP = { liste: [{ ab: '2026-09-01', preis: 0.28 }, { ab: '2026-10-04', preis: 0.20 }], sim: 0.15, awSim: false };
  const jetzt = () => [...SP.liste].sort((a, b) => a.ab.localeCompare(b.ab)).filter(x => x.ab <= '2026-10-04').at(-1);
  const euro = v => de(v, 2) + ' €';
  p.spListe = function () {
    const L = [...SP.liste].sort((a, b) => b.ab.localeCompare(a.ab)), j = jetzt();
    return '<div class="gruppe-t">Strompreis' + NEU + '</div>' + L.map((x, i) => { const bis = i ? L[i - 1].ab : null;
      return '<div class="sp-zeile"><b>' + de(x.preis, 2) + ' €/kWh</b><span class="leise">' + (x === j ? '<span class="badge gruen">gilt jetzt</span> ' : '') + 'ab ' + datum(x.ab) + (bis ? ' bis ' + datum(plusTage(bis, -1)) : '') + '</span>'
        + (L.length > 1 ? '<button class="x" data-act="sp-weg" data-ab="' + x.ab + '" title="Preis löschen">✕</button>' : '') + '</div>'; }).join('')
      + '<button class="zeile" data-act="sp-neu"><span class="blau">+ Neuer Preis ab …</span></button>'
      + '<div class="sp-hinweis">Auswertung, Abrechnung nach Firma und CSV rechnen jeden Tag mit dem Preis, der an dem Tag galt. Ein neuer Preis ändert nichts an Vergangenem.</div>';
  };
  const ersetzePreis = h => h.replace(/<label class="zeile"><span>Preis je kWh<\\/span>[\\s\\S]*?<\\/label>/, () => p.spListe.call(window.__sp));
  p.einstBloecke = function () { window.__sp = this; return ersetzePreis(alt.bloecke.call(this)); };
  p.sheet = function () {
    const s = this.s.sheet; window.__sp = this;
    if (s && s.art === 'sp-neu') return '<div class="griff"></div><h3>Neuer Strompreis</h3><label class="feld">gilt ab<input type="date" value="' + s.ab + '" data-sp="ab"></label>'
      + '<label class="feld">Preis je kWh<input type="number" step="0.01" value="' + s.preis + '" data-sp="preis"></label>'
      + '<div class="leise">Bis zu diesem Tag gilt weiter der bisherige Preis – Vergangenes bleibt, wie es war.</div><button class="knopf amber" data-act="sp-speichern">Speichern</button><button class="knopf leise-k" data-act="zu">Abbrechen</button>';
    return ersetzePreis(alt.sheet.call(this));
  };
  /* Kachel „Preis simulieren“ */
  KK['b-preis'] = { ber: 'baustelle', ic: '🧮', name: 'Preis simulieren', text: 'Verbrauch mit einem anderen Strompreis – was hätte es gekostet', such: 'euro preis simulieren tarif was wäre wenn' };
  p.kkKachel = function (x, i, ort, c) {
    if (x.k !== 'b-preis') return alt.kachel.call(this, x, i, ort, c);
    const S = c.S, kwh = S.kwh || 0, echt = S.eur || 0, sim = kwh * SP.sim, diff = sim - echt, gr = x.st;
    const kopf = '<div class="kk-kopf"><span class="kk-ic">🧮</span><small>Preis simulieren</small>' + NEU + '</div>';
    const regler = '<div class="sp-sim"><button class="glas-panel chip" data-act="sp-sim" data-d="-0.01">−</button><b>' + de(SP.sim, 2) + ' €</b><button class="glas-panel chip" data-act="sp-sim" data-d="0.01">+</button></div>';
    const unter = (diff > 0 ? '+' : '−') + euro(Math.abs(diff)) + ' gegenüber tatsächlich ' + euro(echt);
    let inhalt;
    if (gr === 'S') inhalt = kopf + '<b class="kk-zahl">' + de(sim, 0) + '<small> €</small></b><span class="kk-wo">bei ' + de(SP.sim, 2) + ' €/kWh</span>';
    else if (gr === 'M') inhalt = '<div class="kk-m-l">' + kopf + '<b class="kk-zahl">' + de(sim, 0) + '<small> €</small></b><span class="kk-vgl">' + unter + '</span></div><div class="kk-m-r">' + regler + '<span class="kk-wo">' + de(kwh, 0) + ' kWh · ' + this.zrText(c.z, c.v) + '</span></div>';
    else inhalt = kopf + '<div class="kk-l-zeile"><b class="kk-zahl">' + de(sim, 0) + '<small> €</small></b><span class="kk-wo">' + this.zrText(c.z, c.v) + '</span></div><span class="kk-vgl">' + unter + '</span>' + regler
      + '<div class="kk-dia zeilen"><div class="kk-dia-in">' + kkBalken([['tatsächlich', echt, euro(echt), 'var(--s1)'], ['bei ' + de(SP.sim, 2) + ' €', sim, euro(sim), '#bf5af2']]) + '</div></div>'
      + '<div class="sp-hinweis">tatsächlich = je Tag der damals gültige Preis · simuliert = alle ' + de(kwh, 0) + ' kWh × ' + de(SP.sim, 2) + ' €</div>';
    return ort === 'kat' ? '<div class="glas-panel kk kk-' + gr + '">' + inhalt + '</div>' : '<div class="glas-panel kk kk-' + gr + '" data-ort="' + ort + '" data-i="' + i + '">' + inhalt + '</div>';
  };
  /* Auswertung: Chip „💶 Preis“ – tatsächlich oder simuliert */
  p.awSeite = function (B, A, z, alle) {
    let h = alt.aw.call(this, B, A, z, alle);
    const chip = '<button class="glas-panel chip ' + (SP.awSim ? 'sp-chip-sim' : '') + '" data-act="sp-aw">💶 ' + (SP.awSim ? 'simuliert ' + de(SP.sim, 2) + ' €' : 'Preis: tatsächlich') + '</button>';
    h = h.replace('<button class="glas-panel chip" data-act="csv">', chip + '<button class="glas-panel chip" data-act="csv">');
    if (SP.awSim) h = h.replace('<div class="aw-leiste">', '<div class="sp-band">🧮 Simuliert: alle € dieser Auswertung mit ' + de(SP.sim, 2) + ' €/kWh <button class="rv-link" data-act="sp-aw">zurück auf tatsächlich</button>' + NEU + '</div><div class="aw-leiste">');
    return h;
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    if (a === 'sp-neu') { this.s.sheet = { art: 'sp-neu', ab: '2026-11-01', preis: 0.22 }; return this.render(); }
    if (a === 'sp-speichern') { const s = this.s.sheet; SP.liste = SP.liste.filter(x => x.ab !== s.ab).concat({ ab: s.ab, preis: +s.preis }); this.s.sheet = null; this.toast('Preis ' + de(+s.preis, 2) + ' € ab ' + datum(s.ab) + ' gespeichert'); return this.render(); }
    if (a === 'sp-weg') { SP.liste = SP.liste.filter(x => x.ab !== el.dataset.ab); return this.render(); }
    if (a === 'sp-sim') { SP.sim = Math.max(0, Math.round((SP.sim + +el.dataset.d) * 100) / 100); return this.render(); }
    if (a === 'sp-aw') { SP.awSim = !SP.awSim; return this.render(); }
    return alt.klick.call(this, ev);
  };
  const ein = p.eingabe; p.eingabe = function (ev) { const el = ev.target; if (el && el.dataset && el.dataset.sp && this.s.sheet) { this.s.sheet[el.dataset.sp] = el.value; return; } return ein.call(this, ev); };
})();
`;

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Strompreis</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>Strompreis mit „gilt ab“ und Preis simulieren · Vorschlag auf Seite $1</b>');
ersetze('<button id="neu">Beispiel neu laden</button>', `<button id="neu">Beispiel neu laden</button>
<label>zeigen <select id="sp-ziel"><option value="einst">Einstellungen › Strom</option><option value="uebersicht">Übersicht mit Kachel</option><option value="auswertung">Auswertung</option></select></label>`);
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
const spZiel = document.getElementById('sp-ziel');
const spZeigen = () => { for (const p of P) { if (spZiel.value === 'einst') { p.s.evGruppe = 'strom'; p.gehe('einst'); }
  else { if (spZiel.value === 'uebersicht' && !p.kkListe('ue').some(x => x.k === 'b-preis')) { p.kkListe('ue').unshift(p.kkGross({ k: 'b-preis', an: true }, 'L'), p.kkGross({ k: 'b-preis', an: true }, 'M')); } p.gehe(spZiel.value); } } };
spZiel.onchange = spZeigen; spZeigen();`);
fs.writeFileSync(path.join(repo, 'mockups', 'strompreis.html'), html);
console.log(`mockups/strompreis.html gebaut (${Math.round(html.length / 1024)} KB)`);
