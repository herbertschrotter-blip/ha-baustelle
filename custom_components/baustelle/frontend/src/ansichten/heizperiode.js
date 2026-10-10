// Karte „Heizperiode“ der Auswertung (BSM-033.03, Mockup hochrechnung.html, abgenommen 10.10.2026): Reiter Hochrechnung
// (Prognose mit Spanne, Diagramm tatsächlich / Prognose mit / ohne Automatik über die Heizperiode), Signatur (je Container
// Streudiagramm mit Knickgerade, Heizgrenze, kWh je Grad, Grundlast, Güte) und Klima (Klimamittel, Vorhersage, Heizgradtage,
// Normjahr), dazu die Einblendung „Klimamittel“. Alle Zahlen kommen von der Integration (`A.hochrechnung`, logik/hochrechnung,
// logik/signatur); die Seite rechnet nur Pixel. Die Heizperiode stellt ✎ über die Einblendung „zeitraum-bs“ ein.
import { html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { MONATE, de, zahl } from '../hilfen.js';

const GRIFF = html`<div class="griff"></div>`;
const LAEDT = html`<div class="leer">Lädt …</div>`;
const MONATE_VOLL = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const STAND = { gut: ['gut', 'gruen-t'], brauchbar: ['brauchbar', 'amber-t'], unsicher: ['unsicher', 'rot-t'], lernt: ['lernt noch', 'leise'] };
const eur = x => zahl(x) ? `${de(x, 0)} €` : '–';
const tagText = iso => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '';
const imZeitraum = (m, [von, bis]) => von <= bis ? m >= von && m <= bis : m >= von || m <= bis;

const stand = c => { const [t, k] = STAND[c.stand] || [c.stand, ''];
  return html`<span class="hp-st ${k}">${t}${c.stand === 'lernt' ? ` · ${c.tage}/10 Tage` : ''}</span>`; };

/* ---------- Hochrechnung ---------- */
function zahlZeile(h) {
  return html`<div class="hp-zahl">≈ ${eur(h.mit_eur)}<span class="leise"> · ${zahl(h.unten_eur) ? `${de(h.unten_eur, 0)}–${eur(h.oben_eur)}` : `${de(h.mit_kwh, 0)} kWh`}</span></div>`;
}
/* Diagramm aus der Tagesreihe [Tag, tatsächlich, mit, unten, oben, ohne] (kWh aufsummiert) – nur Anordnung */
function diagramm(h) {
  const R = h.reihe || [];
  if (R.length < 2) return nothing;
  const W = 340, H = 180, L = 36, U = 22, n = R.length;
  const max = Math.max(...R.map(r => Math.max(r[2] || 0, r[4] || 0, r[5] || 0)), 1) * 1.05;
  const x = i => L + i / (n - 1) * (W - L - 6), y = v => H - U - v / max * (H - U - 10);
  const heute = Math.max(0, R.findLastIndex(r => r[1] !== null));
  const pfad = (k, von, bis) => R.slice(von, bis + 1).map((r, j) => r[k] === null ? '' : `${j ? 'L' : 'M'}${x(von + j).toFixed(1)},${y(r[k]).toFixed(1)}`).join(' ');
  const band = R[n - 1][3] !== null ? `M${x(heute).toFixed(1)},${y(R[heute][3]).toFixed(1)} ${R.slice(heute).map((r, j) => `L${x(heute + j).toFixed(1)},${y(r[4]).toFixed(1)}`).join(' ')} `
    + `${R.slice(heute).reverse().map((r, j) => `L${x(n - 1 - j).toFixed(1)},${y(r[3]).toFixed(1)}`).join(' ')} Z` : '';
  const stufen = [0, 0.25, 0.5, 0.75, 1].map(f => max / 1.05 * f), mwh = max > 4000;
  const monate = R.map((r, i) => [r[0], i]).filter(([t]) => t.endsWith('-01'));
  return unsafeHTML(`<svg class="hp-dia" viewBox="0 0 ${W} ${H}">
    ${stufen.map(v => `<line class="hp-gitter" x1="${L}" y1="${y(v)}" x2="${W - 6}" y2="${y(v)}"/><text class="hp-yt" x="${L - 4}" y="${y(v) + 3}">${de(mwh ? v / 1000 : v, 0)}</text>`).join('')}
    <text class="hp-yt" x="${L - 4}" y="8">${mwh ? 'MWh' : 'kWh'}</text>
    ${monate.map(([t, i]) => `<line class="hp-gitter" x1="${x(i)}" y1="10" x2="${x(i)}" y2="${H - U}"/><text x="${x(i) + 10}" y="${H - 6}">${MONATE[+t.slice(5, 7) - 1]}</text>`).join('')}
    ${band ? `<path class="hp-band" d="${band}"/>` : ''}
    ${R[0][5] !== null ? `<path class="hp-ohne" d="${pfad(5, 0, n - 1)}"/>` : ''}
    <path class="hp-prog" d="${pfad(2, heute, n - 1)}"/>
    ${heute ? `<path class="hp-ist" d="${pfad(1, 0, heute)}"/>` : ''}
    <line class="hp-heute" x1="${x(heute)}" y1="10" x2="${x(heute)}" y2="${H - U}"/><text class="hp-ht" x="${x(heute) + 3}" y="18">heute</text></svg>`);
}
function legende(h) {
  return html`<div class="hp-leg">
      <span><i class="l-ist"></i>tatsächlich <b>${eur(h.bisher_eur)}</b></span>
      <span><i class="l-prog"></i>Prognose mit Automatik <b>${eur(h.mit_eur)}</b>${zahl(h.unten_eur) ? html`<span class="leise"> (${de(h.unten_eur, 0)}–${de(h.oben_eur, 0)})</span>` : nothing}</span>
      ${zahl(h.ohne_eur) ? html`<span><i class="l-ohne"></i>Prognose ohne Automatik <b>${eur(h.ohne_eur)}</b></span>` : nothing}
      ${zahl(h.gespart_eur) ? html`<span>gespart ≈ <b>${eur(h.gespart_eur)}</b></span>` : nothing}</div>
    <div class="leise">„ohne Automatik“ ist bis zur gemessenen Baseline eine Schätzung (jeder Heizkörper rund um die Uhr).</div>`;
}
function herkunft(h) {
  const C = h.container || [], lernen = C.filter(c => c.methode !== 'signatur').length;
  return h.methode === 'signatur'
    ? html`aus der Energiesignatur je Container · ${h.vorhersage_tage ? `nächste ${h.vorhersage_tage} Tage aus der Vorhersage, danach ` : ''}Klimamittel${zahl(h.hgt_rest) ? ` · noch ${de(h.hgt_rest, 0)} Heizgradtage` : ''}`
    : html`<b>lernt noch</b> – ${lernen} von ${C.length} Containern rechnen mit dem Tagesschnitt, bis die Signatur steht (10 ganze Tage, 4 K Spanne).`;
}

/* ---------- Signatur ---------- */
function streu(c) {
  const P = c.punkte || [], W = 320, H = 150, tx = t => 28 + (t + 6) / 30 * (W - 36);
  const ymax = Math.max(10, ...P.map(q => q[1])), ty = v => H - 18 - v / ymax * (H - 28);
  const knick = zahl(c.grenze) ? `M${tx(-6)},${ty(c.grundlast + c.kwh_je_grad * (c.grenze + 6))} L${tx(c.grenze)},${ty(c.grundlast)} L${tx(24)},${ty(c.grundlast)}` : '';
  return unsafeHTML(`<svg class="hp-streu" viewBox="0 0 ${W} ${H}"><line class="hp-gitter" x1="28" y1="${H - 18}" x2="${W - 6}" y2="${H - 18}"/>
    ${[-5, 0, 5, 10, 15, 20].map(t => `<text x="${tx(t)}" y="${H - 4}" text-anchor="middle">${t}°</text>`).join('')}
    ${P.map(([t, v]) => `<circle cx="${tx(t).toFixed(1)}" cy="${ty(v).toFixed(1)}" r="2.6"/>`).join('')}
    ${knick ? `<path d="${knick}"/><line class="hp-grenze" x1="${tx(c.grenze)}" y1="10" x2="${tx(c.grenze)}" y2="${H - 18}"/><text class="hp-gt" x="${tx(c.grenze) + 3}" y="16">Heizgrenze ${de(c.grenze, 1)}°</text>` : ''}</svg>`);
}
function signatur(p, h) {
  const C = h.container || [];
  if (!C.length) return html`<div class="leer">Keine Container mit Heizung</div>`;
  const i = Math.min(p.s.hpC || 0, C.length - 1), c = C[i], name = x => (p.d.bereiche.find(b => b.id === x.bereich) || {}).name || x.bereich;
  const leer = !(c.punkte || []).length
    ? html`<div class="leer">${name(c)}: noch keine ganzen Tage.</div>`
    : nothing;
  return html`<label class="feld hp-wahl">Container<select @change=${e => { p.s.hpC = +e.target.value; p.neuZeichnen(); }}>${C.map((x, j) => html`<option value=${j} ?selected=${j === i}>${name(x)}</option>`)}</select></label>
    ${leer}${(c.punkte || []).length ? streu(c) : nothing}
    ${c.stand === 'lernt' ? html`<div class="leise">${name(c)} lernt noch: ${c.tage} von 10 ganzen Tagen. Danach zeigt sich, ab welcher Außentemperatur geheizt wird.</div>` : nothing}
    <div class="hp-zeilen">${C.map(x => html`<div class="hp-zeile"><b>${name(x)}</b>
      <span>${zahl(x.grenze) ? html`ab <b>${de(x.grenze, 1)} °C</b>` : zahl(x.kwh_je_grad) ? 'Heizgrenze noch offen' : '–'}</span>
      <span>${zahl(x.kwh_je_grad) ? `+${de(x.kwh_je_grad, 1)} kWh je Grad · Grundlast ${de(x.grundlast, 1)} kWh/Tag` : ''}</span>
      <span>${stand(x)}${zahl(x.cv_rmse) ? html`<span class="leise"> · ${de(x.cv_rmse * 100, 0)} %</span>` : nothing}</span></div>`)}</div>
    <div class="leise">Je Tag Verbrauch gegen mittlere Außentemperatur (ganze Tage ohne Ausfall). Unter der Heizgrenze steigt der
      Verbrauch je Grad kälter; die Güte ist die mittlere Abweichung (bis 20 % gut, bis 30 % brauchbar).</div>`;
}

/* ---------- Klima ---------- */
function klima(p, h) {
  const K = h.klima || [], min = Math.min(-2, ...K), max = Math.max(22, ...K), y = v => (v - min) / (max - min) * 100;
  return html`<div class="hp-monate">${K.map((t, i) => html`<div class="hp-m ${imZeitraum(i + 1, p.d.hp) ? 'hp' : ''}"><i style="height:${y(t)}%"></i><b>${de(t, 1)}</b><span>${MONATE[i]}</span></div>`)}</div>
    <div class="leise">Klimamittel ${h.klima_vorgabe ? 'Graz 1991–2020 (Vorgabe)' : '(eigene Werte)'} · hervorgehoben: Heizperiode.
      <a class="hp-link nur-admin" @click=${p.nurAdmin(() => p.einblenden('hp-klima'))}>Klimamittel ändern ›</a></div>
    ${(h.vorhersage || []).length ? html`<div class="hp-vh"><b>Vorhersage</b>${h.vorhersage.map(([t, v]) => html`<span class="chip glas-panel">${t.slice(8, 10)}.${t.slice(5, 7)}. ${de(v, 1)}°</span>`)}</div>` : nothing}
    <div class="hp-kz">${zahl(h.hgt_rest) ? html`<div><b>${de(h.hgt_rest, 0)}</b><span>Heizgradtage bis ${tagText(h.ende)}</span></div>` : nothing}
      ${zahl(h.normjahr_eur) ? html`<div><b>${eur(h.normjahr_eur)}</b><span>im Normjahr (witterungsbereinigt)</span></div>` : nothing}</div>`;
}

/* ---------- Karte ---------- */
const REITER = [['hoch', 'Hochrechnung'], ['sig', 'Signatur'], ['klima', 'Klima']];
export function heizperiodeVorlage(p, A, start = 'hoch') {
  const d = p.d, h = A && A.hochrechnung, r = p.s.hpReiter || start, [von, bis] = d.hp;
  return html`<div class="glas-panel block hp-karte"><div class="block-kopf"><b>Heizperiode</b>
      <button class="chip glas-panel hp-zeit nur-admin" @click=${p.nurAdmin(() => p.einblenden('zeitraum-bs'))}>${MONATE[von - 1]}–${MONATE[bis - 1]}${h && h.ende ? ` · bis ${tagText(h.ende)}` : ''} ✎</button></div>
    <div class="seg glas-panel hp-reiter">${REITER.map(([k, t]) => html`<button data-v=${k} class=${r === k ? 'on' : ''} @click=${() => { p.s.hpReiter = k; p.neuZeichnen(); }}>${t}</button>`)}</div>
    ${!A ? LAEDT : !h || !zahl(h.mit_kwh) ? html`<div class="leer">Noch zu wenige Tage für eine Hochrechnung</div>`
      : r === 'sig' ? signatur(p, h) : r === 'klima' ? klima(p, h)
      : html`${zahlZeile(h)}${diagramm(h)}${legende(h)}<div class="leise hp-her">${herkunft(h)}</div>`}</div>`;
}

/* ---------- Einblendung Klimamittel (Einstellung heizung.klimamittel; leer = Vorgabe) ---------- */
function hpKlima(p, s) {
  const A = p.awDaten(p.s.aw.zeitraum, p.zrV('aw')), h = A && A.hochrechnung, K = (s.werte ||= [...((h && h.klima) || [])]);
  const speichern = wert => p.setzen(['heizung', 'klimamittel'], wert, 'Gespeichert').then(() => p.schliessen());
  return html`${GRIFF}<div class="block-kopf"><h3>Klimamittel</h3><span class="leise">Monatsmittel außen, °C</span></div>
    <div class="glas-panel liste hp-eingabe">${K.map((t, i) => html`<label class="feld">${MONATE_VOLL[i]}<input inputmode="decimal" .value=${de(t, 1)}
      @change=${e => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (!isNaN(v)) K[i] = v; }}></label>`)}</div>
    <div class="leise">Vorgabe: Graz 1991–2020. Für eine andere Gegend die Klimamittel der nächsten Station von GeoSphere Austria
      eintragen. Die Hochrechnung nimmt sie für alle Tage ohne Vorhersage.</div>
    <div class="hp-knoepfe"><button class="knopf amber" data-k="hp-speichern" @click=${() => speichern(K.map(v => Math.round(v * 10) / 10))}>Speichern</button>
      <button class="knopf leise-k" data-k="hp-vorgabe" @click=${() => speichern(null)}>Vorgabe Graz</button>
      <button class="knopf leise-k" @click=${() => p.schliessen()}>Abbrechen</button></div>`;
}
export const HEIZPERIODE_EINBLENDUNGEN = { 'hp-klima': hpKlima };

export const HEIZPERIODE_CSS = `
.hp-zeit { font-size: 12px; padding: 4px 10px; cursor: pointer; white-space: nowrap; }
.hp-reiter { margin: 4px 0 8px; } .hp-zahl { font-size: 26px; font-weight: 600; margin: 4px 0 2px; } .hp-zahl .leise { font-size: 14px; font-weight: 400; }
.hp-dia { width: 100%; max-width: 540px; height: auto; display: block; margin: 6px auto; }
.hp-dia text, .hp-streu text { font-size: 9px; fill: var(--ink2); } .hp-dia .hp-yt { text-anchor: end; }
.hp-gitter { stroke: rgba(127,127,127,.18); }
.hp-dia path { fill: none; stroke-width: 2.4; } .hp-dia .hp-ist { stroke: var(--s3); stroke-width: 3; }
.hp-dia .hp-prog { stroke: var(--s1); stroke-dasharray: 6 4; } .hp-dia .hp-ohne { stroke: var(--s2); stroke-dasharray: 2 3; }
.hp-dia .hp-band { fill: var(--s1); opacity: .2; stroke: none; }
.hp-heute, .hp-grenze { stroke: var(--amber); stroke-dasharray: 3 3; } .hp-ht, .hp-gt { fill: var(--amber) !important; }
.hp-leg { display: flex; flex-direction: column; gap: 4px; font-size: 13px; margin: 4px 0; }
.hp-leg i { display: inline-block; width: 18px; height: 0; margin-right: 6px; vertical-align: middle; border-top: 3px solid; }
.hp-leg .l-ist { border-color: var(--s3); } .hp-leg .l-prog { border-color: var(--s1); border-top-style: dashed; } .hp-leg .l-ohne { border-color: var(--s2); border-top-style: dotted; }
.hp-her { margin-top: 6px; } .hp-link { cursor: pointer; color: var(--blau); white-space: nowrap; }
.hp-st { font-size: 12px; white-space: nowrap; } .gruen-t { color: #30d158; }
.hp-wahl select { width: 100%; }
.hp-streu { width: 100%; max-width: 520px; height: auto; display: block; margin: 4px auto; }
.hp-streu circle { fill: var(--ink2); opacity: .7; } .hp-streu path { fill: none; stroke: var(--s1); stroke-width: 2.5; }
.hp-zeilen { display: flex; flex-direction: column; margin: 6px 0; }
.hp-zeile { display: flex; flex-wrap: wrap; gap: 2px 12px; padding: 6px 0; font-size: 13px; border-bottom: 1px solid rgba(127,127,127,.15); } .hp-zeile > b { flex: 1 1 100%; }
.hp-monate { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; height: 120px; align-items: end; margin: 6px 0; }
.hp-m { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; font-size: 10px; min-width: 0; }
.hp-m i { width: 70%; border-radius: 3px 3px 0 0; background: rgba(127,127,127,.3); } .hp-m.hp i { background: var(--s2); }
.hp-m b { font-weight: 500; font-size: 9px; } .hp-m span { color: var(--ink2); }
.hp-vh { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0; } .hp-vh .chip { font-size: 12px; padding: 4px 8px; }
.hp-kz { display: flex; gap: 16px; flex-wrap: wrap; } .hp-kz div { display: flex; flex-direction: column; } .hp-kz b { font-size: 18px; } .hp-kz span { font-size: 12px; color: var(--ink2); }
.hp-eingabe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 10px; padding: 10px 14px; } .hp-eingabe input { width: 100%; min-width: 0; box-sizing: border-box; }
.hp-knoepfe { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }`;
