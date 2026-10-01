// WU-0014: Vorschlag „Kachel-Katalog“ – jede Auswertung als Kachel in drei Größen (S/M/L), für Übersicht und Auswertung.
// Baut mockups/kachel-katalog.html: node mockups/quelle/archiv/kachel-katalog.js (Vorschlag – eingebaut in 0.8.30, Variante 3)
// Grundlage ist das Master-Mockup glas.html (echte Seite mit Beispieldaten); dieses Skript überschreibt nur einzelne Methoden
// der Seite (Übersicht, Auswertung, Einblendung, Klick, Eingabe) und hängt den Bereich „Meine Kacheln“ an.
// Werte kommen aus den Beispieldaten der Seite; wo die Seite nichts hat (Signal, „Warm ab“, ohne Automatik je Container),
// stehen feste Mockup-Werte. Drei Varianten, wie man eine Kachel aus dem Katalog hinzufügt (Leiste „Katalog“).
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };
const sicher = t => t.replace(/<\/script/gi, '<\\/script');

/* Die Seite in glas.html auf den aktuellen Stand bringen (wie glas.js), damit der Vorschlag auf der echten Seite sitzt */
const panel = fs.readFileSync(path.join(repo, 'custom_components/baustelle/frontend/baustelle-panel.js'), 'utf8');
{
  const m = [...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].find(x => x[1].includes("customElements.define('baustelle-panel'"));
  if (!m) throw new Error('Seite in glas.html nicht gefunden');
  html = html.slice(0, m.index) + '<script>\n' + sicher(panel) + '\n</script>' + html.slice(m.index + m[0].length);
}

const CSS = `
.kk-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 4px; vertical-align: middle; letter-spacing: 0; }
.kk-bereich { display: flex; flex-direction: column; gap: 10px; margin: 4px 0 14px; }
.kk-titel { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 0 4px; } .kk-titel > b { font-size: 17px; }
.kk-knoepfe { margin-left: auto; display: flex; gap: 8px; } .kk-plus { color: var(--amber) !important; font-weight: 600; }
.kk-raster { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 118px; gap: 12px; grid-auto-flow: dense; }
@container (max-width: 560px) { .kk-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.kk-zelle { position: relative; min-width: 0; } .kk-S { grid-column: span 1; } .kk-M { grid-column: span 2; } .kk-L { grid-column: span 2; grid-row: span 2; }
.kk { height: 100%; box-sizing: border-box; border-radius: 20px !important; padding: 12px 14px; display: flex; flex-direction: column; gap: 3px; cursor: pointer; overflow: hidden;
  transition: transform .15s; color: var(--ink); text-align: left; min-width: 0; }
.kk:active { transform: scale(.98); }
.kk-kopf { display: flex; align-items: center; gap: 6px; min-width: 0; }
.kk-kopf small { font-size: 10.5px; letter-spacing: 1.1px; text-transform: uppercase; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kk-ic { font-size: 15px; line-height: 1; flex: none; }
.kk-zahl { font-size: 28px; font-weight: 300; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .kk-zahl small { font-size: 13px; color: var(--ink2); font-weight: 400; }
.kk-S .kk-zahl { margin-top: auto; font-size: 26px; }
.kk-wo { font-size: 12px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kk-vgl { font-size: 12px; color: var(--ink2); line-height: 1.35; } .kk-vgl em { font-style: normal; } .kk-vgl em.mehr { color: var(--amber); } .kk-vgl em.weniger { color: #30d158; }
.kk-M .kk { flex-direction: row; gap: 12px; align-items: stretch; }
.kk-m-l { flex: 1 1 52%; min-width: 0; display: flex; flex-direction: column; gap: 2px; } .kk-m-l .kk-vgl { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kk-m-r { flex: 1 1 48%; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 5px; }
.kk-funke { width: 100%; height: 62px; display: block; }
.kk-l-zeile { display: flex; align-items: baseline; gap: 4px 10px; flex-wrap: wrap; }
.kk-dia { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
.kk-dia > svg { width: 100%; height: 100%; max-height: 100%; } .kk-dia .legende { display: none; }
.kk-dia.zeilen { flex-direction: column; align-items: stretch; justify-content: center; }
.kk-dia-in { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.kk-dz { display: grid; grid-template-columns: 74px 1fr; gap: 8px; align-items: center; font-size: 11px; color: var(--ink2); } .kk-dz > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kk-dz .tl-spur { height: 12px; border-radius: 5px; }
.kk-dz.heute > span { color: var(--amber); font-weight: 600; }
.kk-kennz { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; align-content: center; margin-top: 4px; }
.kk-kennz div { display: flex; flex-direction: column; border-top: 1px solid var(--gridc); padding-top: 6px; min-width: 0; }
.kk-kennz b { font-size: 17px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .kk-kennz span { font-size: 11px; color: var(--ink2); }
.kk-balken { display: grid; grid-template-columns: minmax(0, 1fr) 1.2fr auto; gap: 6px; align-items: center; font-size: 11.5px; } .kk-balken > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kk-balken i { display: block; height: 7px; border-radius: 4px; } .kk-balken em { font-style: normal; color: var(--ink2); }
.kk-sig { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; } .kk-sig i { width: 4px; border-radius: 1px; background: var(--gridc); } .kk-sig i.an { background: #30d158; }
.kk-sig i:nth-child(1) { height: 25%; } .kk-sig i:nth-child(2) { height: 50%; } .kk-sig i:nth-child(3) { height: 75%; } .kk-sig i:nth-child(4) { height: 100%; }
.kk-mock { font-size: 9.5px; color: var(--ink2); opacity: .8; }
.kk-neu-k { border-style: dashed !important; background: transparent !important; box-shadow: none !important; color: var(--ink2); display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 2px; font-size: 13px; border-radius: 20px !important; } .kk-neu-k span { font-size: 26px; font-weight: 300; line-height: 1; }
.kk-frisch .kk { animation: kk-frisch 1.8s ease-out; } @keyframes kk-frisch { 0%, 40% { box-shadow: 0 0 0 3px var(--amber); } 100% { box-shadow: 0 0 0 0 transparent; } }
.kk.bearb { opacity: .7; }
.kk-werk { position: absolute; inset: 0; border: 2px dashed var(--amber); border-radius: 20px; display: flex; flex-wrap: wrap; align-content: flex-end; gap: 4px; padding: 6px; pointer-events: none; }
.kk-werk > * { pointer-events: auto; } .kk-werk button { background: var(--sheet); border-radius: 9px; padding: 3px 7px; font-size: 12px; color: var(--ink); }
.kk-werk button.on { background: var(--amber); color: #1a1000; font-weight: 600; } .kk-werk .kk-x { position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 50%; padding: 0; }
.kk-werk button:disabled { opacity: .35; }
/* Katalog (Einblendung) */
.kk-kat { display: flex; flex-direction: column; gap: 8px; }
.kk-kat h3 { display: flex; gap: 8px; align-items: center; }
.kk-liste .zeile { cursor: pointer; text-align: left; } .kk-z-ic { font-size: 20px; width: 28px; text-align: center; flex: none; } .kk-z-t { flex: 1; min-width: 0; }
.kk-gr-hint { font-size: 10.5px; color: var(--ink2); letter-spacing: 2px; white-space: nowrap; }
.kk-wahl { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.kk-vorschau { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; grid-auto-rows: 108px; }
.kk-wahl .vb-wer { display: flex; flex-wrap: wrap; gap: 6px; } .kk-wahl .vb-wer i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.kk-zurueck { color: var(--blau); font-size: 14px; align-self: flex-start; }
.kk-gal { display: grid; grid-template-columns: 1fr; gap: 10px; }
.kk-gal-karte { border-radius: 16px; padding: 10px 12px; background: rgba(120,120,128,.14); border: 1.5px solid transparent; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.kk-gal-karte.on { border-color: var(--amber); grid-column: 1 / -1; }
.kk-gal-kopf { display: flex; gap: 8px; align-items: baseline; } .kk-gal-kopf b { font-size: 14px; }
.kk-gal-vs { display: grid; grid-template-columns: 60px 125px 125px; gap: 8px; align-items: start; justify-content: start; }
.kk-gal-v { display: flex; flex-direction: column; gap: 3px; cursor: pointer; border-radius: 10px; padding: 2px; }
.kk-gal-v > small { font-size: 11px; color: var(--ink2); text-align: center; } .kk-gal-v.on { background: color-mix(in srgb, var(--amber) 22%, transparent); } .kk-gal-v.on > small { color: var(--amber); font-weight: 600; }
.kk-gal-box { zoom: .4; pointer-events: none; grid-auto-rows: 118px !important; }
.kk-gal-box.s1 { grid-template-columns: 150px !important; } .kk-gal-box.s2 { grid-template-columns: 150px 150px !important; }
.kk-such input { width: 100%; box-sizing: border-box; font-size: 15px; padding: 10px 14px; border-radius: 14px; }
.kk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.kk-chip { padding: 5px 11px !important; border-radius: 14px !important; background: rgba(120,120,128,.18) !important; font-size: 12px; white-space: nowrap; }
.kk-chip.on { background: var(--amber) !important; color: #1a1000 !important; font-weight: 600; }
.kk-tr-zeile { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-top: 1px solid var(--gridc); cursor: pointer; }
.kk-tr-zeile.on { background: color-mix(in srgb, var(--amber) 12%, transparent); border-radius: 12px; }
.kk-tr-gr { display: flex; gap: 3px; flex: none; } .kk-tr-gr button { width: 28px; height: 26px; border-radius: 8px; background: rgba(120,120,128,.2); font-size: 12px; text-align: center; }
.kk-tr-gr button.on { background: var(--amber); color: #1a1000; font-weight: 600; }
.kk-such mark { background: color-mix(in srgb, var(--amber) 45%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }
.kk-tr-leer { padding: 14px 4px; color: var(--ink2); font-size: 13px; }
@container (min-width: 700px) { .sheet:has(.kk-gal), .sheet:has(.kk-such) { width: 720px; } .kk-gal { grid-template-columns: 1fr 1fr; } }
`;

/* Der Vorschlag selbst – läuft im Browser nach der Seite (als Text eingefügt, darum hier eine echte Funktion) */
function kachelVorschlag(CSS) {
  const K = customElements.get('baustelle-panel'), p = K.prototype;
  const alt = { aufbauen: p._aufbauen, uebersicht: p.v_uebersicht, awSeite: p.awSeite, sheet: p.sheet, klick: p.klick, eingabe: p.eingabe };
  const NEU = '<span class="kk-neu">neu</span>', MOCK = '<span class="kk-mock">· Mockup-Wert</span>';
  p._aufbauen = function () { const erst = !this.root; alt.aufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = CSS; this.shadowRoot.appendChild(s); } };

  /* ---------- Zustand: gemeinsam für Handy und Desktop, damit beide dasselbe zeigen ---------- */
  const KK = window.KK = { variante: '1', bearb: { uebersicht: false, auswertung: false }, frisch: null, listen: {
    uebersicht: [{ k: 'b-kosten', gr: 'M' }, { k: 'c-temp', id: 'polier', gr: 'S' }, { k: 'c-leistung', id: 'mannschaft', gr: 'S' }, { k: 'b-gespart', gr: 'M' },
      { k: 'c-verbrauch', id: 'polier', gr: 'L', dia: true }, { k: 'h-plan', gr: 'L', dia: false }, { k: 'p-pumpzeit', id: 'schacht', gr: 'S' }, { k: 'p-zyklen', id: 'schacht', gr: 'S' }],
    auswertung: [{ k: 'b-kosten', gr: 'L', dia: true }, { k: 'b-gespart', gr: 'S' }, { k: 'b-hoch', gr: 'S' }, { k: 'b-oel', gr: 'L', dia: false }, { k: 'b-wetter', gr: 'M' },
      { k: 'b-wer', gr: 'M' }, { k: 'b-strom', gr: 'M' }] } };
  const ORT = { uebersicht: 'Übersicht', auswertung: 'Auswertung' };
  const GROESSE = [['S', 'Klein', '1×1'], ['M', 'Mittel', '2×1'], ['L', 'Groß', '2×2']];
  const alleNeu = () => { for (const x of (typeof P !== 'undefined' ? P : [])) if (x.d) x.render(); };

  /* ---------- Hilfen ---------- */
  const f = (v, k = 1) => zahl(v) ? de(v, k) : '–';
  const pfeil = dl => zahl(dl) ? `<em class="${dl > 0 ? 'mehr' : 'weniger'}">${dl > 0 ? '▲' : '▼'} ${Math.abs(dl)} %</em>` : '';
  const farbeB = b => BEREICH_FARBEN[b.f % BEREICH_FARBEN.length];
  const sum = r => r ? summe(r) : null;
  const bisJetzt = (r, n) => r ? r.slice(0, n) : null;
  function funke(v, farbe = 'var(--s1)') {
    if (!v) return '';
    v = v.map(x => zahl(x) ? Number(x) : null); const w = 120, h = 40, z = v.filter(x => x !== null); if (z.length < 2) return '';
    const lo = Math.min(...z), hi = Math.max(...z), sp = hi - lo || 1;
    const pts = v.map((x, i) => x === null ? null : [i / (v.length - 1) * w, h - 3 - (x - lo) / sp * (h - 8)]).filter(Boolean);
    const dL = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('');
    return `<svg class="kk-funke" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${dL}L${pts.at(-1)[0].toFixed(1)} ${h}L${pts[0][0].toFixed(1)} ${h}z" fill="${farbe}" opacity=".2"/>`
      + `<path d="${dL}" fill="none" stroke="${farbe}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  }
  const balkenZeilen = (zeilen, n = 99) => { const max = Math.max(1e-9, ...zeilen.map(z => z[1] || 0));
    return zeilen.slice(0, n).map(([name, v, txt, farbe]) => `<div class="kk-balken"><span>${esc(name)}</span><i style="width:${Math.max(2, (v || 0) / max * 100)}%;background:${farbe || 'var(--s1)'}"></i><em>${txt}</em></div>`).join(''); };
  const signal = n4 => `<span class="kk-sig" aria-label="Signal ${n4} von 4">${[1, 2, 3, 4].map(k => `<i class="${k <= n4 ? 'an' : ''}"></i>`).join('')}</span>`;
  const dbm = i => -48 - (i * 7) % 33;   // Mockup: Signal je Gerät (die Seite liest es aus den Geräte-Links)
  const stufe4 = db => db >= -55 ? 4 : db >= -67 ? 3 : db >= -75 ? 2 : db >= -85 ? 1 : 0;
  const stundenLabels = STUNDEN.map((h, i) => i % 6 ? '' : h);

  /* ---------- Katalog: alle Auswertungen der Seite, je Bereich ----------
     daten(c, b) → { zahl, einh, unter, vgl, funke, mini, dia(id), kennz, wo } – nur Anzeige; Zahlen aus der Seite bzw. Mockup-Werte
     auf(b): öffnet die passende vorhandene Einblendung bzw. Ansicht der Seite */
  const BEREICHE = [['baustelle', 'Baustelle', '🏗'], ['container', 'Container', '🏠'], ['pumpen', 'Pumpen', '💧'], ['heizung', 'Heizung', '🔥']];
  const KAT = [
    { k: 'b-kosten', ber: 'baustelle', ic: '💶', name: 'Kosten & Verbrauch', text: 'Betrag und kWh im Zeitraum, Vergleich zum Vormonat', such: 'euro geld kwh strom monat zeitraum', dia: true,
      daten(c) { const S = c.S, tage = this.kkMonat(c);
        return { zahl: zahl(S.eur) ? de(S.eur, 0) : '–', einh: '€', wo: 'dieser Monat', vgl: `${f(S.kwh, 0)} kWh ${pfeil((S.veraenderung || {}).kwh)} zu ${this.zrVgl('Monat', 0)}`,
          funke: tage && tage.summe, kennz: [['Kosten', `${f(S.eur, 2)} €`], ['Verbrauch', `${f(S.kwh, 0)} kWh`], ['Heizzeit', `${f(S.heizzeit, 0)} h`], ['Pumpzeit', `${f(S.pumpzeit, 1)} h`]],
          dia: id => tage ? flaeche(id, tage.reihen, tage.labels, 'kWh', 7) : '' }; },
      auf() { this.kkOeffne({ act: 'sheet', s: 'verbrauch', t: 'eur' }, { zeitraum: 'Monat' }); } },
    { k: 'b-gespart', ber: 'baustelle', ic: '🌱', name: 'Gespart · ohne Automatik', text: 'Was die Automatik gegenüber Dauerbetrieb spart', such: 'euro ersparnis 24/7 dauerbetrieb automatik', dia: true,
      daten(c) { const oa = c.S.ohne_automatik, tage = this.kkMonat(c), ohne = tage && tage.ohne;
        return { zahl: oa ? de(oa.gespart_eur, 0) : '–', einh: '€', wo: 'dieser Monat', vgl: oa ? `${f(oa.prozent, 0)} % weniger als rund um die Uhr (${f(oa.ohne_eur, 0)} €)` : 'noch keine Werte',
          funke: ohne && tage.summe.map((v, i) => (ohne[i] || 0) - v), kennz: [['mit Automatik', `${f(c.S.eur, 0)} €`], ['ohne (24/7)', `${f(oa && oa.ohne_eur, 0)} €`], ['gespart', `${f(oa && oa.gespart_eur, 0)} €`], ['weniger', `${f(oa && oa.prozent, 0)} %`]],
          dia: id => tage && ohne ? flaeche(id, [{ name: 'mit Automatik', farbe: 'var(--s1)', v: tage.summe }], tage.labels, 'kWh', 7, { name: 'ohne Automatik', v: ohne }) : '' }; },
      auf() { this.kkDetail('ohne'); } },
    { k: 'b-hoch', ber: 'baustelle', ic: '📅', name: 'Hochrechnung Heizperiode', text: 'Kosten bis Ende der Heizperiode, mit und ohne Automatik', such: 'prognose euro heizperiode ende', dia: true,
      daten(c) { const h = c.A && c.A.hochrechnung || {};
        return { zahl: zahl(h.mit_eur) ? '≈ ' + de(h.mit_eur, 0) : '–', einh: '€', wo: 'bis Ende Heizperiode', vgl: `bisher ${f(h.bisher_eur, 0)} € · ohne Automatik ${f(h.ohne_eur, 0)} €`,
          mini: balkenZeilen([['bisher', h.bisher_eur, `${f(h.bisher_eur, 0)} €`, 'var(--s3)'], ['mit', h.mit_eur, `${f(h.mit_eur, 0)} €`, 'var(--s1)'], ['ohne', h.ohne_eur, `${f(h.ohne_eur, 0)} €`, 'var(--s2)']]),
          kennz: [['bisher', `${f(h.bisher_kwh, 0)} kWh`], ['mit Automatik', `${f(h.mit_kwh, 0)} kWh`], ['ohne (24/7)', `${f(h.ohne_kwh, 0)} kWh`], ['gespart ≈', `${f(h.gespart_eur, 0)} €`]],
          dia: id => balken(id, [h.bisher_eur, h.mit_eur, h.ohne_eur], ['bisher', 'mit Automatik', 'ohne'], '€', 0) }; },
      auf() { this.kkDetail('hochrechnung'); } },
    { k: 'b-wetter', ber: 'baustelle', ic: '🌦', name: 'Wetter-Einfluss', text: 'kWh je Grad kälter, letzte 30 Heiztage', such: 'temperatur außen kälte grad', dia: true,
      daten(c) { const W = (c.A && c.A.wetter) || {}, g = W.gerade;
        return { zahl: g && g.k < 0 ? '+' + de(-g.k, 1) : '–', einh: 'kWh/°C', wo: 'je Grad kälter am Tag', vgl: g ? `≈ ${f(g.eur_je_grad, 2)} € je Grad · Heizgrenze ${f(this.d.e.grenze, 0)} °C` : 'noch zu wenige Heiztage',
          mini: g ? `<svg class="kk-funke" viewBox="0 0 120 40" preserveAspectRatio="none">${(W.punkte || []).map(q => `<circle cx="${((Math.max(-10, Math.min(15, q[0])) + 10) / 25 * 116 + 2).toFixed(1)}" cy="${(38 - Math.min(1, q[1] / Math.max(1, ...W.punkte.map(x => x[1]))) * 34).toFixed(1)}" r="2" fill="var(--s1)"/>`).join('')}</svg>` : '',
          kennz: [['je Grad kälter', `+${f(g && -g.k, 1)} kWh`], ['je Grad', `${f(g && g.eur_je_grad, 2)} €`], ['Heiztage', `${(W.punkte || []).length}`], ['Heizgrenze', `${f(this.d.e.grenze, 0)} °C`]],
          dia: id => g ? streu(id, W.punkte || [], g.k, g.d0) : '' }; },
      auf() { this.kkDetail('wetter'); } },
    { k: 'b-strom', ber: 'baustelle', ic: '⚡', name: 'Stromverteilung · Staffelung', text: 'Last je Anschluss, Grenze und Reserve', such: 'anschluss ampere kw last verteiler staffel', dia: true,
      daten() { const L = this.last(), an = this.d.e.staffel && L.A.length;
        const spur = (a, g) => `<div class="strom klein"><div class="strom-spur">${[['s-heiz', a.heiz], ['s-pumpe', a.pumpe], ['s-sonst', a.sonst]].map(([k, v]) => `<i class="${k}" style="width:${g > 0 ? v / g * 100 : 0}%"></i>`).join('')}<i class="s-res" style="width:${g > 0 ? a.reserve / g * 100 : 0}%"></i></div></div>`;
        return { zahl: an ? de(L.gesamt, 1) : '–', einh: 'kW', wo: an ? `${L.A.length} Anschlüsse` : 'Staffelung aus', vgl: an ? `von ${de(L.grenze, 1)} kW nutzbar · ${L.laufen} Heizkörper an${L.warten ? ` · ${L.warten} wartet` : ''}` : 'keine Anschlüsse',
          mini: an ? this.stromBalken(L, true) : '', kennz: [['Heizung', `${f(L.heiz, 1)} kW`], ['Pumpen', `${f(L.pumpe, 2)} kW`], ['Sonstiges', `${f(L.sonst, 1)} kW`], ['Reserve', `${f(L.reserve, 0)} kW`]],
          dia: () => `<div class="kk-dia-in">${L.A.map(a => `<div class="kk-dz" style="grid-template-columns:1fr"><span>${esc(a.name)} · ${de(a.heiz + a.pumpe + a.sonst, 1)} von ${de(a.grenze, 1)} kW</span>${spur(a, a.grenze)}</div>`).join('')}</div>`, zeilen: true }; },
      auf() { this.kkOeffne({ act: 'sheet', s: 'strom' }); } },
    { k: 'b-oel', ber: 'baustelle', ic: '⚖', name: 'Ölradiator-Ersparnis', text: 'Ölradiator gegen Konvektor, fair verglichen', such: 'konvektor heizkörper typ vergleich euro', dia: true,
      daten(c) { const T = (c.A && c.A.typ) || {}, er = T.ersparnis, o = T.oelradiator || {}, kv = T.konvektor || {}, zr = this.zeitraum('Monat');
        return { zahl: zahl(T.weniger) ? `${T.weniger > 0 ? '−' : '+'}${de(Math.abs(T.weniger), 0)}` : '–', einh: '%', wo: 'Ölradiator gegen Konvektor', vgl: er ? `${de(Math.abs(er.erspart_eur), 2)} € ${er.erspart_eur < 0 ? 'mehr' : 'erspart'} · ${de(er.erspart_kwh, 0)} kWh` : 'noch nicht vergleichbar',
          funke: er && er.oel, kennz: [['Öl kWh/Gradstunde', f(o.kwh_gradh, 3)], ['Konv. kWh/Gradstunde', f(kv.kwh_gradh, 3)], ['erspart', `${f(er && er.erspart_eur, 2)} €`], ['Aufheizen Öl', `${f(o.auf, 1)} °C/h`]],
          dia: id => er ? flaeche(id, [{ name: 'Ölradiatoren', farbe: 'var(--s1)', v: er.oel }], zr.labels, 'kWh', 7, { name: 'mit Konvektoren', v: er.konvektor }) : '' }; },
      auf() { this.kkDetail('vergleich'); } },
    { k: 'b-geraete', ber: 'baustelle', ic: '📶', name: 'Geräte · erreichbar & Signal', text: 'Wie viele Shellys antworten, WLAN-Signal', such: 'shelly wlan signal offline erreichbar batterie', dia: true,
      daten() { const G = this.d.bereiche.flatMap(b => b.geraete.map(g => ({ b, g }))), ok = G.filter(x => x.g.erreichbar !== false), schlecht = G.filter((x, i) => x.g.erreichbar !== false && stufe4(dbm(i)) <= 2).length;
        const mittel = Math.round(G.reduce((s, x, i) => s + dbm(i), 0) / Math.max(1, G.length));
        return { zahl: `${ok.length}/${G.length}`, einh: '', wo: 'Geräte erreichbar', vgl: `${G.length - ok.length} nicht erreichbar · Signal Ø ${mittel} dBm ${MOCK}`,
          mini: `<div class="kk-vgl">${signal(stufe4(mittel))} Ø ${mittel} dBm</div>${G.filter(x => x.g.erreichbar === false).map(x => `<div class="kk-vgl rot-t">● ${esc(x.g.n)} · ${esc(x.b.name)}</div>`).join('')}`,
          kennz: [['erreichbar', `${ok.length}`], ['nicht erreichbar', `${G.length - ok.length}`], ['schwaches Signal', `${schlecht}`], ['Signal Ø', `${mittel} dBm`]],
          dia: () => `<div class="kk-dia-in">${G.slice(0, 8).map((x, i) => `<div class="kk-dz"><span>${esc(x.b.name)}</span><span>${x.g.erreichbar === false ? '<b class="rot-t">nicht erreichbar</b>' : `${signal(stufe4(dbm(i)))} ${dbm(i)} dBm · ${esc(x.g.n)}`}</span></div>`).join('')}${G.length > 8 ? `<div class="kk-vgl">+ ${G.length - 8} weitere</div>` : ''}</div>`, zeilen: true }; },
      auf() { this.kkOeffne({ act: 'tab-einst', g: 'geraete' }); } },
    { k: 'b-wer', ber: 'baustelle', ic: '🔥', name: 'Wer verbraucht was', text: 'Rangliste der Container nach kWh', such: 'rangliste container verbrauch kwh euro', dia: true,
      daten(c) { const R = (c.A && c.A.rangliste) || [], z = R.map(r => { const b = this.d.bereiche.find(x => x.id === r.bereich); return [r.name, r.kwh, `${f(r.kwh, 0)} kWh`, b ? farbeB(b) : 'var(--ink2)']; });
        return { zahl: R[0] ? de(R[0].kwh, 0) : '–', einh: 'kWh', unter: R[0] ? esc(R[0].name) : '', wo: R[0] ? `${R[0].name} vorne` : '', vgl: R[0] ? `${esc(R[0].name)} vorne · ${f(R[0].eur, 2)} €` : 'noch kein Verbrauch',
          mini: balkenZeilen(z, 3), kennz: R.slice(0, 4).map(r => [r.name, `${f(r.kwh, 0)} kWh · ${f(r.eur, 0)} €`]),
          dia: () => `<div class="kk-dia-in">${balkenZeilen(z, 7)}</div>`, zeilen: true }; },
      auf() { this.kkDetail('rangliste'); } },

    { k: 'c-temp', ber: 'container', je: 'c', fuehler: true, ic: '🌡', name: 'Temperatur', text: 'innen jetzt, Verlauf heute mit außen', such: 'grad celsius fühler innen außen', dia: true,
      daten(c, b) { const st = this.statistik('Tag'), inn = st && (st.werte[b.fuehler] || []), aid = this.eid(this.d, this.d.entry, 'aussen'), aus = st && (st.werte[aid] || []);
        const aj = aus && aus.filter(zahl).at(-1), z = inn ? inn.filter(zahl) : [], soll = b.soll ?? this.d.e.soll;
        return { zahl: f(b.t), einh: '°C', vgl: `Soll ${f(soll, 0)} °C · außen ${f(aj)} °C`, funke: inn, farbe: farbeB(b),
          kennz: [['jetzt', `${f(b.t)} °C`], ['Soll', `${f(soll, 0)} °C`], ['tiefste heute', `${z.length ? de(Math.min(...z)) : '–'} °C`], ['höchste heute', `${z.length ? de(Math.max(...z)) : '–'} °C`]],
          dia: id => inn ? linie(id, [{ name: 'Innen', v: [...inn, null] }, { name: 'Außen', v: [...(aus || []), null] }], '°C') : '' }; },
      auf(b) { this.kkOeffne({ act: 'container', id: b.id }); } },
    { k: 'c-leistung', ber: 'container', je: 'c', ic: '⚡', name: 'Leistung jetzt', text: 'kW gerade, Stundenmittel heute', such: 'kw watt strom gerade', dia: true,
      daten(c, b) { const r = this.verbrauch(this.d, b.id, 'Tag'), an = b.geraete.filter(g => g.an).length, h = +this.z.JETZT.slice(0, 2);
        return { zahl: de(kwVon(b), 2), einh: 'kW', vgl: `${an} von ${b.geraete.length} Geräten an`, funke: bisJetzt(r, h + 1), farbe: farbeB(b),
          kennz: [['jetzt', `${de(kwVon(b), 2)} kW`], ['Geräte an', `${an}/${b.geraete.length}`], ['Spitze heute', `${r ? de(Math.max(...r), 2) : '–'} kW`], ['Ø bis jetzt', `${r ? de(summe(r) / (h + 1), 2) : '–'} kW`]],
          dia: id => r ? flaeche(id, [{ name: b.name, farbe: farbeB(b), v: r }], STUNDEN, 'kW', 6) : '' }; },
      auf(b) { this.kkOeffne({ act: 'sheet', s: 'leistung', id: b.id }); } },
    { k: 'c-verbrauch', ber: 'container', je: 'c', ic: '📊', name: 'Verbrauch heute', text: 'kWh heute, je Stunde, Vergleich gestern', such: 'kwh energie strom tag', dia: true,
      daten(c, b) { const r = this.verbrauch(this.d, b.id, 'Tag'), g = this.verbrauch(this.d, b.id, 'Tag', 1), h = +this.z.JETZT.slice(0, 2), su = sum(r), sg = sum(g);
        const dl = zahl(su) && sg ? Math.round((su / sg - 1) * 100) : null;
        return { zahl: f(su), einh: 'kWh', vgl: `${pfeil(dl)} gestern ${f(sg)} kWh`, funke: bisJetzt(r, h + 1), farbe: farbeB(b),
          kennz: [['heute', `${f(su)} kWh`], ['gestern', `${f(sg)} kWh`], ['Kosten', `${f(zahl(su) ? su * this.d.e.preis : null, 2)} €`], ['meiste Stunde', `${r ? de(Math.max(...r), 2) : '–'} kWh`]],
          dia: id => r ? balken(id, r, stundenLabels, 'kWh') : '' }; },
      auf(b) { this.kkOeffne({ act: 'sheet', s: 'verbrauch', id: b.id }); } },
    { k: 'c-kosten', ber: 'container', je: 'c', ic: '💶', name: 'Kosten heute', text: 'Euro heute aus kWh × Strompreis', such: 'euro geld preis', dia: true,
      daten(c, b) { const r = this.verbrauch(this.d, b.id, 'Tag'), p = this.d.e.preis, h = +this.z.JETZT.slice(0, 2), su = sum(r);
        return { zahl: f(zahl(su) ? su * p : null, 2), einh: '€', vgl: `${f(su)} kWh × ${de(p, 2)} €/kWh`, funke: bisJetzt(r, h + 1), farbe: farbeB(b),
          kennz: [['heute', `${f(zahl(su) ? su * p : null, 2)} €`], ['kWh', f(su)], ['Strompreis', `${de(p, 2)} €`], ['teuerste Stunde', `${r ? de(Math.max(...r) * p, 2) : '–'} €`]],
          dia: id => r ? balken(id, r.map(v => (v || 0) * p), stundenLabels, '€', 2) : '' }; },
      auf(b) { this.kkOeffne({ act: 'sheet', s: 'verbrauch', id: b.id, t: 'eur' }); } },
    { k: 'c-heizzeit', ber: 'container', je: 'c', ic: '⏱', name: 'Heizzeit heute', text: 'Stunden geheizt, je Stunde', such: 'stunden laufzeit zeit', dia: true,
      daten(c, b) { const r = this.heizStunden(this.d, b, 'Tag'), h = +this.z.JETZT.slice(0, 2), su = sum(r);
        return { zahl: f(su), einh: 'h', vgl: esc(this.heuteText(b)), funke: bisJetzt(r, h + 1), farbe: farbeB(b),
          kennz: [['geheizt heute', stdMin(su)], ['Plan', esc(this.heuteText(b)).replace(/^Heizzeit /, '')], ['Heizkörper', `${b.geraete.filter(g => g.heizer).length}`], ['an jetzt', `${b.geraete.filter(g => g.heizer && g.an).length}`]],
          dia: id => r ? balken(id, r, stundenLabels, 'h') : '' }; },
      auf(b) { this.kkOeffne({ act: 'sheet', s: 'heizzeit-c', id: b.id }); } },
    { k: 'c-ohne', ber: 'container', je: 'c', ic: '🌱', name: 'Ohne Automatik', text: 'Container gegen Dauerbetrieb (24/7)', such: 'gespart ersparnis dauerbetrieb euro', dia: true,
      daten(c, b) { const r = this.verbrauch(this.d, b.id, 'Tag'), p = this.d.e.preis, kw = b.geraete.filter(g => g.heizer).reduce((s, g) => s + g.kw, 0), h = +this.z.JETZT.slice(0, 2);
        const mit = sum(r), ohne = kw * (h + 1), gesp = zahl(mit) ? Math.max(0, ohne - mit) : null;   // Mockup: Nennleistung × Stunden; echt liefert es baustelle/ohne
        return { zahl: f(zahl(gesp) ? gesp * p : null, 2), einh: '€', vgl: `gespart heute · ${ohne ? f(zahl(gesp) ? gesp / ohne * 100 : null, 0) : '–'} % weniger als 24/7 ${MOCK}`, farbe: 'var(--s3)',
          funke: r && r.slice(0, h + 1).map(v => kw - (v || 0)),
          kennz: [['mit Automatik', `${f(mit)} kWh`], ['ohne (24/7)', `${f(ohne)} kWh`], ['gespart', `${f(zahl(gesp) ? gesp * p : null, 2)} €`], ['Heizkörper', `${f(kw, 1)} kW`]],
          dia: id => r ? flaeche(id, [{ name: 'mit Automatik', farbe: farbeB(b), v: r }], STUNDEN, 'kWh', 6, { name: 'ohne Automatik', v: STUNDEN.map((_, i) => i <= h ? kw : null) }) : '' }; },
      auf(b) { this.kkOeffne({ act: 'sheet', s: 'verbrauch', id: b.id }); } },
    { k: 'c-warm', ber: 'container', je: 'c', fuehler: true, ic: '🧠', name: 'Warm ab (lernend)', text: 'Gelernter Heizbeginn, damit das Soll rechtzeitig erreicht ist', such: 'lernen aufheizen optimum start beginn', dia: true,
      daten(c, b) { const pl = this.planTag(this.z.HEUTE_TAG), soll = b.soll ?? this.d.e.soll, rate = b.id === 'polier' ? 3.2 : 2.6, innen = 16.4;   // Mockup: Aufheizrate und Startwert
        const ziel = pl ? pl.a - (this.d.e.warm_vor || 0) : null, dauer = Math.ceil(Math.max(0, soll - innen) / rate * 60 / 5) * 5, start = zahl(ziel) ? ziel - dauer : null;
        return { zahl: zahl(start) ? uhr(start) : '–', einh: 'Uhr', vgl: zahl(ziel) ? `${f(soll, 0)} °C um ${uhr(ziel)} · ${de(rate, 1)} °C/h gelernt ${MOCK}` : 'heute frei',
          mini: pl ? this.zeitstrahlSeg([[start, ziel, 'vor'], [pl.a, pl.b, 'heiz']], true) + `<div class="kk-vgl">${uhr(start)} → ${uhr(ziel)} · ${dauer} min</div>` : '',
          kennz: [['heizt ab', zahl(start) ? uhr(start) : '–'], ['warm um', zahl(ziel) ? uhr(ziel) : '–'], ['Aufheizen kalt', `${de(rate, 1)} °C/h`], ['Aufheizen mild', `${de(rate + .9, 1)} °C/h`]],
          dia: () => pl ? `<div class="kk-dia-in"><div class="kk-dz"><span>gelernt</span>${this.zeitstrahlSeg([[start, ziel, 'vor'], [pl.a, pl.b, 'heiz']], true)}</div><div class="kk-dz"><span>fest (alt)</span>${this.zeitstrahl(pl)}</div>
            <div class="kk-vgl">Beginn = Arbeitsbeginn − (Soll − innen) ÷ Aufheizrate: ${de(innen)} → ${f(soll, 0)} °C in ${dauer} min ${MOCK}</div></div>` : '', zeilen: true }; },
      auf(b) { this.kkOeffne({ act: 'container', id: b.id }); } },

    { k: 'p-pumpzeit', ber: 'pumpen', je: 'p', ic: '⏱', name: 'Pumpzeit', text: 'Wie lange gepumpt wurde, heute je Stunde', such: 'schacht pumpe laufzeit stunden wasser', dia: true,
      daten(c, b) { const r = this.heizStunden(this.d, b, 'Tag'), z = this.zyklen(this.d, b, 'Woche'), h = +this.z.JETZT.slice(0, 2), su = sum(r);
        return { zahl: zahl(su) ? stdMin(su) : '–', einh: '', vgl: `${z ? z[c.heuteNr] : '–'} Zyklen heute · ${b.geraete.filter(g => g.an).length} Pumpe läuft`, funke: bisJetzt(r, h + 1), farbe: 'var(--blau)',
          kennz: [['heute', stdMin(su)], ['Zyklen', `${z ? z[c.heuteNr] : '–'}`], ['Pumpen', `${b.geraete.length}`], ['läuft jetzt', `${b.geraete.filter(g => g.an).length}`]],
          dia: id => r ? balken(id, r, stundenLabels, 'h') : '' }; },
      auf(b) { this.kkOeffne({ act: 'sheet', s: 'heizzeit-c', id: b.id }); } },
    { k: 'p-zyklen', ber: 'pumpen', je: 'p', ic: '🔁', name: 'Zyklen', text: 'Ein/Aus je Tag – viele deuten auf Schwimmer oder Grundwasser', such: 'schacht pumpe schwimmer an aus', dia: true,
      daten(c, b) { const z = this.zyklen(this.d, b, 'Woche'), i = c.heuteNr;
        return { zahl: z ? `${z[i]}` : '–', einh: 'Zyklen', vgl: z && i > 0 ? `gestern ${z[i - 1]} · Woche ${summe(z)}` : '', funke: z && z.slice(0, i + 1), farbe: 'var(--blau)',
          kennz: [['heute', `${z ? z[i] : '–'}`], ['gestern', `${z && i > 0 ? z[i - 1] : '–'}`], ['diese Woche', `${z ? summe(z) : '–'}`], ['meiste/Tag', `${z ? Math.max(...z) : '–'}`]],
          dia: id => z ? balken(id, z, TAGE, 'Zyklen', 0) : '' }; },
      auf(b) { this.kkOeffne({ act: 'container', id: b.id }); this.s.chart = 'zyklen'; this.render(); } },

    { k: 'h-plan', ber: 'heizung', ic: '📅', name: 'Heizplan heute / Woche', text: 'Vorheizen, Arbeitszeit, Nachheizen, Trocknen', such: 'zeitplan arbeitszeit vorheizen nachheizen woche', dia: true,
      daten() { const pl = this.planTag(this.z.HEUTE_TAG);
        return { zahl: pl ? `${uhr(pl.vor)}–${uhr(pl.ende)}` : 'frei', einh: '', wo: 'heute', vgl: esc(this.statusText()) + (pl && pl.gruende.length ? ` · ${esc(pl.gruende[0])}` : ''),
          mini: this.zeitstrahl(pl, true) + '<div class="tl-achse"><span>4</span><span>12</span><span>20</span></div>',
          kennz: [['Vorheizen ab', pl ? uhr(pl.vor) : '–'], ['Arbeitszeit', pl ? `${uhr(pl.a)}–${uhr(pl.b)}` : '–'], ['Nachheizen bis', pl ? uhr(pl.nach) : '–'], ['Trocknen bis', pl && pl.ende > pl.nach ? uhr(pl.ende) : '–']],
          dia: () => `<div class="kk-dia-in">${this.z.WOCHE.map(([t, dt]) => `<div class="kk-dz ${t === this.z.HEUTE_TAG ? 'heute' : ''}"><span>${t} ${dt.slice(0, 2)}.</span>${this.zeitstrahl(this.planTag(t), t === this.z.HEUTE_TAG)}</div>`).join('')}</div>`, zeilen: true }; },
      auf() { this.kkOeffne({ act: 'hz-auf', k: 'plan' }); } },
    { k: 'h-wann', ber: 'heizung', ic: '🔥', name: 'Wann heizt was', text: 'Heizzeiten je Container heute', such: 'container zeitstrahl heute heizzeiten', dia: true,
      daten() { const C = this.d.bereiche.filter(b => !b.pumpe), Z = C.map(b => ({ b, seg: this.heizzeiten(b, this.z.HEUTE_TAG) })), mit = Z.filter(z => z.seg.length);
        const von = mit.length ? Math.min(...mit.map(z => z.seg[0][0])) : null, bis = mit.length ? Math.max(...mit.flatMap(z => z.seg.map(q => q[1]))) : null;
        return { zahl: `${mit.length}`, einh: `von ${C.length}`, wo: 'Container heizen heute', vgl: mit.length ? `erster ab ${uhr(von)} · letzter bis ${uhr(bis)}` : 'heute keine Heizzeit',
          mini: mit.slice(0, 3).map(z => `<div class="kk-dz" style="grid-template-columns:54px 1fr"><span>${esc(z.b.name)}</span>${this.zeitstrahlSeg(z.seg, true)}</div>`).join(''),
          kennz: [['heizen heute', `${mit.length} von ${C.length}`], ['erster ab', zahl(von) ? uhr(von) : '–'], ['letzter bis', zahl(bis) ? uhr(bis) : '–'], ['heizen jetzt', `${C.filter(b => b.z === 'heizt' || b.z === 'trocknen').length}`]],
          dia: () => `<div class="kk-dia-in">${Z.slice(0, 7).map(z => `<div class="kk-dz"><span>${esc(z.b.name)}</span>${this.zeitstrahlSeg(z.seg, true)}</div>`).join('')}</div>`, zeilen: true }; },
      auf() { this.kkOeffne({ act: 'hz-auf', k: 'wann' }); } },
  ];
  const KATM = Object.fromEntries(KAT.map(e => [e.k, e]));

  /* ---------- Daten für die Kacheln ---------- */
  p.kkCtx = function () { const A = this.awDaten('Monat', 0, 'diese'); return { A, S: (A && A.summen) || {}, heuteNr: TAGE.indexOf(this.z.HEUTE_TAG) }; };
  p.kkMonat = function () {   // Verbrauch je Tag dieses Monats, je Container und Summe (aus der Statistik der Seite), bis heute
    const d = this.d, zr = this.zeitraum('Monat'), n = +this.z.HEUTE.slice(8, 10), R = d.bereiche.map(b => ({ name: b.name, farbe: farbeB(b), v: this.verbrauch(d, b.id, 'Monat') }));
    if (R.some(r => !r.v)) return null;
    const st = this.statistik('Monat'), oid = st && Object.keys(st.werte).find(k => k.includes('ohne_automatik'));
    const ab = r => r.slice(0, n);
    return { labels: zr.labels.slice(0, n), reihen: R.map(r => ({ ...r, v: ab(r.v) })), summe: ab(zr.labels.map((_, i) => R.reduce((s, r) => s + (r.v[i] || 0), 0))), ohne: oid ? ab(st.werte[oid]) : null };
  };
  p.kkWahlListe = function (e) { const B = this.d.bereiche; return e.je === 'p' ? B.filter(b => b.pumpe) : e.je === 'c' ? B.filter(b => !b.pumpe && (!e.fuehler || b.fuehler)) : []; };
  p.kkB = function (x, e) { const L = this.kkWahlListe(e); return L.find(b => b.id === x.id) || L[0] || null; };

  /* ---------- eine Kachel in S / M / L ---------- */
  p.kkKachel = function (x, i, ort, uid = '') {
    const e = KATM[x.k], b = e.je ? this.kkB(x, e) : null, gr = x.gr, mitDia = gr === 'L' && x.dia !== false && e.dia;
    if (e.je && !b) return `<div class="kk-zelle kk-${gr}"><div class="glas-panel kk"><div class="kk-kopf"><span class="kk-ic">${e.ic}</span><small>${esc(e.name)}</small></div><span class="kk-wo">kein ${e.je === 'p' ? 'Schacht' : 'Container'} vorhanden</span></div></div>`;
    const D = e.daten.call(this, this.kkCtx(), b);
    const kopf = `<div class="kk-kopf"><span class="kk-ic">${e.ic}</span><small>${esc(e.name)}</small></div>`;
    const wo = b ? `<span class="kk-wo">${esc(b.name)}</span>` : D.wo ? `<span class="kk-wo">${esc(D.wo)}</span>` : '';
    const zahlH = `<b class="kk-zahl">${D.zahl}${D.einh ? `<small> ${D.einh}</small>` : ''}</b>`;
    let inhalt;
    if (gr === 'S') inhalt = `${kopf}${zahlH}${b ? wo : D.unter ? `<span class="kk-wo">${D.unter}</span>` : wo}`;
    else if (gr === 'M') inhalt = `<div class="kk-m-l">${kopf}${zahlH}<span class="kk-vgl">${D.vgl || ''}</span>${b ? wo : ''}</div><div class="kk-m-r">${D.mini || funke(D.funke, D.farbe)}</div>`;
    else {
      const dia = mitDia ? D.dia(`kk-${ort}-${uid || i}-${x.k}-${b ? b.id : 'bs'}`) : '';
      inhalt = `${kopf}<div class="kk-l-zeile">${zahlH}${b ? wo : D.wo ? `<span class="kk-wo">${esc(D.wo)}</span>` : ''}</div><span class="kk-vgl">${D.vgl || ''}</span>`
        + (mitDia ? `<div class="kk-dia ${D.zeilen ? 'zeilen' : ''}">${dia || '<div class="leer">Noch keine Werte</div>'}</div>`
          : `<div class="kk-kennz">${(D.kennz || []).map(([k, v]) => `<div><b>${v}</b><span>${esc(k)}</span></div>`).join('')}</div>`);
    }
    const bearb = ort !== 'vorschau' && KK.bearb[ort], L = KK.listen[ort] || [];
    const werk = !bearb ? '' : `<div class="kk-werk"><button class="kk-x" data-act="kk-weg" data-ort="${ort}" data-i="${i}" aria-label="entfernen">✕</button>
      <button data-act="kk-schieb" data-ort="${ort}" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="nach vorne">‹</button><button data-act="kk-schieb" data-ort="${ort}" data-i="${i}" data-d="1" ${i < L.length - 1 ? '' : 'disabled'} aria-label="nach hinten">›</button>
      ${GROESSE.map(([g]) => `<button data-act="kk-sgr" data-ort="${ort}" data-i="${i}" data-v="${g}" class="${g === gr ? 'on' : ''}">${g}</button>`).join('')}
      ${gr === 'L' && e.dia ? `<button data-act="kk-sdia" data-ort="${ort}" data-i="${i}" class="${x.dia !== false ? 'on' : ''}" title="mit oder ohne Diagramm">📈</button>` : ''}</div>`;
    const act = ort === 'vorschau' || bearb ? 'kk-nix' : 'kk-auf';
    return `<div class="kk-zelle kk-${gr} ${KK.frisch === `${ort}:${i}` ? 'kk-frisch' : ''}"><div class="glas-panel kk ${bearb ? 'bearb' : ''}" role="button" tabindex="0" data-act="${act}" data-ort="${ort}" data-i="${i}" title="${esc(e.name)}${b ? ' · ' + esc(b.name) : ''} – antippen öffnet die Ansicht">${inhalt}</div>${werk}</div>`;
  };
  p.kkBereich = function (ort) {
    const L = KK.listen[ort], bearb = KK.bearb[ort];
    const html = `<div class="kk-bereich"><div class="kk-titel"><b>Meine Kacheln</b>${NEU}<span class="leise">${L.length} ${L.length === 1 ? 'Kachel' : 'Kacheln'}</span>
        <span class="kk-knoepfe"><button class="glas-panel chip ${bearb ? 'amber' : ''}" data-act="kk-bearb" data-ort="${ort}">${bearb ? '✓ Fertig' : '✎ Anpassen'}</button><button class="glas-panel chip kk-plus" data-act="kk-plus" data-ort="${ort}">＋ Kachel</button></span></div>
      ${bearb ? '<div class="leise">‹ › verschieben · S/M/L Größe · 📈 Diagramm in der großen Kachel ein/aus · ✕ entfernen</div>' : ''}
      <div class="kk-raster">${L.map((x, i) => this.kkKachel(x, i, ort)).join('')}<button class="glas-panel kk-neu-k" data-act="kk-plus" data-ort="${ort}"><span>+</span>Kachel</button></div></div>`;
    return html;
  };
  p.v_uebersicht = function () { return alt.uebersicht.call(this) + this.kkBereich('uebersicht'); };
  p.awSeite = function (B, A, z, alle) {
    const h = alt.awSeite.call(this, B, A, z, alle); if (this.s.awBearb || alle) return h;
    const teil = this.kkBereich('auswertung'), i = h.indexOf('<div class="aw-raster');
    return i > 0 ? h.slice(0, i) + teil + h.slice(i) : h + teil;
  };

  /* ---------- Öffnen: vorhandene Einblendungen und Ansichten der Seite ---------- */
  p.kkOeffne = function (ds, extra) { alt.klick.call(this, { target: { closest: () => ({ dataset: ds }) } }); if (extra && this.s.sheet) { Object.assign(this.s.sheet, extra); this.render(); } };
  p.kkDetail = function (k) { this.v_auswertung(); this.kkOeffne({ act: 'aw-detail', k }); };   // aw-detail braucht die Bausteine der Auswertung – auch von der Übersicht aus

  /* ---------- Katalog: drei Varianten ---------- */
  const treffer = (e, q) => { if (!q) return true; const t = `${e.name} ${e.text} ${e.such} ${BEREICHE.find(x => x[0] === e.ber)[1]}`.toLowerCase(); return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => t.includes(w)); };
  const markiere = (t, q) => { let h = esc(t); for (const w of (q || '').split(/\s+/).filter(x => x.length > 1)) h = h.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'); return h; };
  p.kkSichtbar = function () { return KAT.filter(e => !e.je || this.kkWahlListe(e).length); };
  p.kkWahl = function (s, mitVorschau = true) {
    const e = KATM[s.k], opts = e.je ? this.kkWahlListe(e) : [];
    if (e.je && !opts.some(b => b.id === s.id)) s.id = opts[0] && opts[0].id;
    return `<div class="kk-wahl">
      ${e.je ? `<div class="gruppe-t">${e.je === 'p' ? 'Schacht' : 'Container'}${e.fuehler ? ' · nur mit Fühler' : ''}</div><div class="vb-wer">${opts.map(b => `<button data-act="kk-id" data-id="${b.id}" class="${b.id === s.id ? 'on' : ''}"><i style="background:${farbeB(b)}"></i>${esc(b.name)}</button>`).join('')}</div>` : ''}
      <div class="gruppe-t">Größe</div><div class="seg">${GROESSE.map(([g, t, m]) => `<button data-act="kk-gr" data-v="${g}" class="${s.gr === g ? 'on' : ''}">${t} · ${m}</button>`).join('')}</div>
      <div class="leise">${{ S: 'Symbol und eine Zahl', M: 'Zahl, Vergleich und Mini-Verlauf', L: s.dia ? 'mit Diagramm' : 'ausführliche Kennzahlen ohne Diagramm' }[s.gr]}</div>
      ${s.gr === 'L' && e.dia ? `<div class="zeile kk-sw" style="padding:4px 0"><div><span>mit Diagramm</span><div class="leise">aus: vier Kennzahlen statt Diagramm</div></div>${schalter(s.dia, 'kk-dia-w')}</div>` : ''}
      ${mitVorschau ? `<div class="gruppe-t">Vorschau</div><div class="kk-raster kk-vorschau">${this.kkKachel({ k: s.k, id: s.id, gr: s.gr, dia: s.dia }, 0, 'vorschau', 'v')}</div>` : ''}
      <button class="knopf amber" data-act="kk-hinzu">Zur ${ORT[s.ort]} hinzufügen</button></div>`;
  };
  p.kkKatalog = function (s) {
    const v = KK.variante, E = this.kkSichtbar(), griff = '<div class="griff"></div>', zu = '<button class="knopf" data-act="zu">Abbrechen</button>';
    const kopf = `<h3>＋ Kachel · ${ORT[s.ort]}</h3><div class="leise">${E.length} Auswertungen der ganzen Seite · Variante ${v}: ${{ 1: 'Liste nach Bereichen', 2: 'Galerie mit Vorschau S/M/L', 3: 'Suche mit Filter-Chips' }[v]}</div>`;
    if (v === '1') {
      if (s.k) { const e = KATM[s.k];
        return `${griff}<div class="kk-kat"><button class="kk-zurueck" data-act="kk-zurueck">‹ Katalog</button><h3><span>${e.ic}</span>${esc(e.name)}</h3><div class="leise">${esc(e.text)} · ${BEREICHE.find(x => x[0] === e.ber)[1]}</div>${this.kkWahl(s)}</div>`; }
      return `${griff}<div class="kk-kat">${kopf}${BEREICHE.map(([k, t, ic]) => { const L = E.filter(e => e.ber === k); return !L.length ? '' : `<div class="gruppe" style="padding-left:2px">${ic} ${t}</div><div class="liste kk-liste">${L.map(e =>
        `<button class="zeile" data-act="kk-k" data-k="${e.k}"><span class="kk-z-ic">${e.ic}</span><div class="kk-z-t"><b>${esc(e.name)}</b><div class="leise">${esc(e.text)}${e.je ? ` · je ${e.je === 'p' ? 'Schacht' : 'Container'} wählbar` : ''}</div></div><span class="kk-gr-hint">S M L</span><span class="chev">›</span></button>`).join('')}</div>`; }).join('')}${zu}</div>`;
    }
    if (v === '2') {
      const ber = s.ber || 'baustelle', L = E.filter(e => e.ber === ber);
      const karte = e => { const on = s.k === e.k, x = { k: e.k, id: on ? s.id : undefined, dia: on ? s.dia : true };
        return `<div class="kk-gal-karte ${on ? 'on' : ''}"><div class="kk-gal-kopf"><span>${e.ic}</span><b>${esc(e.name)}</b></div><div class="leise">${esc(e.text)}</div>
          <div class="kk-gal-vs">${GROESSE.map(([g, t]) => `<div class="kk-gal-v ${on && s.gr === g ? 'on' : ''}" data-act="kk-gk" data-k="${e.k}" data-v="${g}" role="button" tabindex="0"><div class="kk-raster kk-gal-box ${g === 'S' ? 's1' : 's2'}">${this.kkKachel({ ...x, gr: g }, 0, 'vorschau', 'g')}</div><small>${g} · ${t}</small></div>`).join('')}</div>
          ${on ? this.kkWahl(s, false) : ''}</div>`; };
      return `${griff}<div class="kk-kat">${kopf}<div class="seg">${BEREICHE.map(([k, t, ic]) => `<button data-act="kk-ber" data-v="${k}" class="${ber === k ? 'on' : ''}">${ic} ${t}</button>`).join('')}</div>
        <div class="leise">Größe direkt in der Vorschau antippen</div><div class="kk-gal">${L.map(karte).join('')}</div>${zu}</div>`;
    }
    return `${griff}<div class="kk-kat kk-such">${kopf}<input type="search" data-kk="q" placeholder="Suchen – z. B. Kosten, Temperatur, Pumpe" value="${esc(s.q || '')}" autocomplete="off">
      <div class="kk-chips">${[['alle', 'Alle'], ...BEREICHE.map(([k, t]) => [k, t])].map(([k, t]) => `<button class="kk-chip ${(s.f || 'alle') === k ? 'on' : ''}" data-act="kk-f" data-v="${k}">${t}</button>`).join('')}
        <button class="kk-chip ${s.nurJe ? 'on' : ''}" data-act="kk-nurje">je Container</button><button class="kk-chip ${s.nurEur ? 'on' : ''}" data-act="kk-nureur">€</button></div>
      <div class="kk-treffer">${this.kkTreffer(s)}</div>${zu}</div>`;
  };
  p.kkTreffer = function (s) {
    const L = this.kkSichtbar().filter(e => ((s.f || 'alle') === 'alle' || e.ber === s.f) && (!s.nurJe || e.je) && (!s.nurEur || /euro/.test(e.such + e.name)) && treffer(e, s.q));
    if (!L.length) return '<div class="kk-tr-leer">Keine Kachel gefunden – anderes Wort oder Filter „Alle“.</div>';
    return `<div class="leise">${L.length} ${L.length === 1 ? 'Treffer' : 'Treffer'}</div>` + L.map(e => { const on = s.k === e.k;
      return `<div class="kk-tr-zeile ${on ? 'on' : ''}" data-act="kk-k" data-k="${e.k}" role="button" tabindex="0"><span class="kk-z-ic">${e.ic}</span><div class="kk-z-t"><b>${markiere(e.name, s.q)}</b><div class="leise">${BEREICHE.find(x => x[0] === e.ber)[1]} · ${markiere(e.text, s.q)}</div></div>
        <span class="kk-tr-gr">${GROESSE.map(([g]) => `<button data-act="kk-gk" data-k="${e.k}" data-v="${g}" class="${on && s.gr === g ? 'on' : ''}">${g}</button>`).join('')}</span></div>${on ? this.kkWahl(s) : ''}`; }).join('');
  };
  p.sheet = function () { const s = this.s.sheet; return s && s.art === 'kk-katalog' ? this.kkKatalog(s) : alt.sheet.call(this); };

  /* ---------- Bedienung ---------- */
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act, s = this.s.sheet, ds = el ? el.dataset : {};
    if (!a || !a.startsWith('kk-')) return alt.klick.call(this, ev);
    const L = KK.listen[ds.ort];
    switch (a) {
      case 'kk-nix': return;
      case 'kk-plus': this.s.sheet = { art: 'kk-katalog', ort: ds.ort, k: null, gr: 'M', id: null, dia: true, q: '', f: 'alle', ber: 'baustelle' }; return this.render();
      case 'kk-k': if (s.k === ds.k && KK.variante === '3') s.k = null; else { s.k = ds.k; s.id = null; } return this.render();
      case 'kk-gk': s.k = ds.k; s.gr = ds.v; s.id = s.id && this.kkWahlListe(KATM[ds.k]).some(b => b.id === s.id) ? s.id : null; return this.render();
      case 'kk-zurueck': s.k = null; return this.render();
      case 'kk-id': s.id = ds.id; return this.render();
      case 'kk-gr': s.gr = ds.v; return this.render();
      case 'kk-dia-w': s.dia = !s.dia; return this.render();
      case 'kk-ber': s.ber = ds.v; s.k = null; return this.render();
      case 'kk-f': s.f = ds.v; return this.render();
      case 'kk-nurje': s.nurJe = !s.nurJe; return this.render();
      case 'kk-nureur': s.nurEur = !s.nurEur; return this.render();
      case 'kk-hinzu': { const e = KATM[s.k], neu = { k: s.k, gr: s.gr, ...(e.je ? { id: s.id } : {}), ...(s.gr === 'L' ? { dia: !!s.dia } : {}) };
        KK.listen[s.ort].push(neu); KK.frisch = `${s.ort}:${KK.listen[s.ort].length - 1}`; const b = e.je && this.kkB(neu, e);
        this.s.sheet = null; alleNeu(); this.toast(`Kachel „${e.name}${b ? ' · ' + b.name : ''}“ (${s.gr}) hinzugefügt`); setTimeout(() => { KK.frisch = null; }, 2000); return; }
      case 'kk-bearb': KK.bearb[ds.ort] = !KK.bearb[ds.ort]; return alleNeu();
      case 'kk-weg': L.splice(+ds.i, 1); return alleNeu();
      case 'kk-schieb': { const i = +ds.i, j = i + +ds.d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; return alleNeu(); }
      case 'kk-sgr': L[+ds.i].gr = ds.v; return alleNeu();
      case 'kk-sdia': L[+ds.i].dia = L[+ds.i].dia === false; return alleNeu();
      case 'kk-auf': { const x = L && L[+ds.i]; if (!x) return; const e = KATM[x.k]; return e.auf.call(this, e.je ? this.kkB(x, e) : null); }
    }
    return alt.klick.call(this, ev);
  };
  p.eingabe = function (ev) {
    const el = ev.target, ds = (el && el.dataset) || {}, s = this.s.sheet;
    if (ds.kk === 'q' && s && s.art === 'kk-katalog') { s.q = el.value; s.k = null; const t = this.shadowRoot && this.shadowRoot.querySelector('.kk-treffer'); if (t) t.innerHTML = this.kkTreffer(s); return; }
    return alt.eingabe.call(this, ev);
  };
  window.KK_KATALOG = KAT;
}

const SKRIPT = `/* ================= WU-0014: Kachel-Katalog (Vorschlag) ================= */\n(${kachelVorschlag.toString()})(${JSON.stringify(CSS)});`;
const version = (panel.match(/const SEITE_VERSION = '([^']+)'/) || [])[1] || '?';

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Kachel-Katalog (WU-0014)</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite [^<]*<\/b>/, `<b>WU-0014 Kachel-Katalog · Vorschlag auf Seite ${version}</b>`);
ersetze('<button id="neu">Beispiel neu laden</button>', `<button id="neu">Beispiel neu laden</button>
<label>Katalog <select id="kk-variante"><option value="1">1 · Liste nach Bereichen</option><option value="2">2 · Galerie mit Vorschau S/M/L</option><option value="3">3 · Suche mit Filter-Chips</option></select></label>
<label>zeigen auf <select id="kk-ziel"><option value="uebersicht">Übersicht</option><option value="auswertung">Auswertung</option></select></label>
<button id="kk-auf">＋ Katalog öffnen</button>`);
ersetze('<span class="leise">Die echte Seite mit Beispieldaten', '<span class="leise">„Meine Kacheln“ (neu) steht unter der Übersicht und oben in der Auswertung: ＋ Kachel öffnet den Katalog in der gewählten Variante, ✎ Anpassen ändert Größe/Reihenfolge, Antippen einer Kachel öffnet die volle Ansicht. Die echte Seite mit Beispieldaten');
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + sicher(SKRIPT) + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
/* Vorführ-Leiste WU-0014: Variante des Katalogs, Ort (Übersicht/Auswertung), Katalog öffnen */
const kkVar = document.getElementById('kk-variante'), kkZiel = document.getElementById('kk-ziel');
kkVar.onchange = () => { KK.variante = kkVar.value; for (const p of P) { if (p.s.sheet && p.s.sheet.art === 'kk-katalog') { p.s.sheet.k = null; p.render(); } } };
kkZiel.onchange = () => { for (const p of P) p.gehe(kkZiel.value); };
document.getElementById('kk-auf').onclick = () => { for (const p of P) { if (p.s.view !== kkZiel.value) p.gehe(kkZiel.value); p.klick({ target: { closest: () => ({ dataset: { act: 'kk-plus', ort: kkZiel.value } }) } }); } };`);
fs.writeFileSync(path.join(repo, 'mockups', 'kachel-katalog.html'), html);
console.log(`mockups/kachel-katalog.html gebaut (Seite ${version}, ${Math.round(html.length / 1024)} KB)`);
