// BSM-033.04 Teil b + Auflösung der Prognose: Vorschlag auf Basis des Master-Mockups (echte Karte „Heizperiode“, 0.8.125).
// Baut mockups/hochrechnung-j4b.html: node mockups/quelle/hochrechnung-j4b.js · Bilder: --bilder <ordner>
//
// Herbert 11.10.2026: „kann ich auch die Tagesprognose oder Woche oder Monat sehen?“ → im Reiter Hochrechnung ein Umschalter
// Heizperiode · Monat · Woche · Tag. Heizperiode = das bisherige Diagramm (aufsummiert). Monat/Woche/Tag = Balken je Zeitraum:
// tatsächlich (gemessen), Prognose mit Automatik (mit Spanne) und Prognose ohne Automatik; heute = gemessen + Rest von heute
// (0.8.128). Antippen eines Balkens zeigt die Zahlen und woher die Temperatur kommt (gemessen / Vorhersage / Klimamittel).
// J4b: neuer Reiter „Baseline“ – Schalter „Baseline messen“, Kostenrahmen je Monat, nächster Lauf mit „Absagen“, Fortschritt
// je Container, Liste der Läufe; im Reiter Signatur die Signatur „ohne Automatik“ neben „mit Automatik“.
// Die Zahlen liefert die Integration (baustelle/auswertung › hochrechnung: neu `perioden` je Monat/Woche/Tag, `baseline`);
// die Seite rechnet nichts. Im Mockup rechnet das Skript Beispielwerte.
const rahmen = require('./rahmen');

/* Läuft nur im Browser (als Text eingesetzt, Node führt es nie aus) */
function browser(R) {
  const { html, nothing } = R;
  const H = window.HJ = { reiter: 'hoch', aufl: 'hp', ab: 0, wahl: null, c: 0, bl: 'geplant', an: true, rahmen: 60 };
  const de = (x, n = 0) => (+x).toLocaleString('de-AT', { minimumFractionDigits: n, maximumFractionDigits: n });
  const eur = x => `${de(x)} €`;
  const MON = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const KLIMA = [0.3, 2.0, 6.3, 11.1, 15.6, 19.4, 21.1, 20.6, 15.8, 10.6, 5.4, 1.0];
  const PREIS = 0.2, VORH = 6, REST = 14 / 24;   // heute 10:00 → noch 14 h
  const PARAM = [[15.5, 1.9, 2.1, 'oelradiator'], [14.0, 2.4, 1.6, 'konvektor'], [16.0, 2.1, 2.4, 'gemischt'], [13.0, 0.9, 0.8, 'konvektor']];
  const HEUTE = new Date(2026, 10, 20);   // Freitag, 20.11.2026
  const tt = t => `${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}.`;
  const gleich = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const klimaTag = t => { const m = t.getMonth(), f = (t.getDate() - 15) / 30, n = f >= 0 ? (m + 1) % 12 : (m + 11) % 12;
    return KLIMA[m] + (KLIMA[n] - KLIMA[m]) * Math.abs(f); };

  /* ---------- Beispiel: was die Integration liefern würde ---------- */
  function daten(p) {
    const C = p.d.bereiche.filter(b => !b.pumpe).map((b, i) => { const [g, k, d0, typ] = PARAM[i % 4]; return { id: b.id, name: b.name, g, k, d0, typ, i }; });
    const jeTag = (t, f = 1) => C.reduce((s, c) => s + c.d0 + c.k * Math.max(0, c.g - t), 0) * f;
    const ohneF = H.bl === 'fertig' ? 1.48 : 1.65;   // ohne Automatik: gemessen (Baseline) bzw. Schätzung 24/7
    const beginn = new Date(2026, 9, 1), ende = new Date(2027, 3, 30), tage = [];
    for (let t = new Date(beginn), n = 0; t <= ende; t.setDate(t.getDate() + 1), n++) {
      const d = new Date(t), vergangen = d < HEUTE && !gleich(d, HEUTE), heute = gleich(d, HEUTE), ab = Math.round((d - HEUTE) / 864e5);
      const quelle = vergangen ? 'gemessen' : ab >= 0 && ab <= VORH ? 'vorhersage' : 'klima';
      const temp = quelle === 'klima' ? klimaTag(d) : klimaTag(d) + Math.sin(n * 1.7) * 2.8 - (quelle === 'vorhersage' ? 1.5 : 0);
      const e = jeTag(temp), fest = quelle !== 'klima';
      tage.push({ t: d, temp, quelle, heute, ist: vergangen ? e : heute ? e * (1 - REST) : null, mit: e,
        unten: fest ? e : jeTag(temp + 1.5) * 0.93, oben: fest ? e : jeTag(temp - 1.5) * 1.07, ohne: e * ohneF + 4 });
    }
    return { C, tage, ohneGemessen: H.bl === 'fertig' };
  }
  // Zeiträume zusammenfassen (macht später die Integration: perioden.monat/woche/tag)
  function perioden(h, art) {
    const key = t => art === 'monat' ? `${t.getFullYear()}-${t.getMonth()}` : art === 'woche' ? (() => { const m = new Date(t); m.setDate(m.getDate() - (m.getDay() + 6) % 7); return m.toDateString(); })() : t.toDateString();
    const P = [];
    for (const d of h.tage) {
      const k = key(d.t); let z = P[P.length - 1];
      if (!z || z.k !== k) P.push(z = { k, von: d.t, bis: d.t, ist: 0, prog: 0, unten: 0, oben: 0, ohne: 0, temp: 0, n: 0, quellen: new Set(), heute: false, vorbei: true });
      z.bis = d.t; z.n++; z.temp += d.temp; z.quellen.add(d.quelle); z.ohne += d.ohne;
      if (d.ist !== null) z.ist += d.ist;
      if (d.heute) { z.heute = true; z.prog += d.mit * REST; z.unten += d.mit * REST; z.oben += d.mit * REST; z.vorbei = false; }
      else if (d.ist === null) { z.prog += d.mit; z.unten += d.unten; z.oben += d.oben; z.vorbei = false; }
    }
    for (const z of P) { z.temp /= z.n; z.mit = z.ist + z.prog; z.unten += z.ist; z.oben += z.ist; }
    return P;
  }
  const FENSTER = { tag: [7, 14], woche: [3, 9], monat: [99, 7] };   // vor heute, Anzahl
  function fenster(P, art) {
    const [vor, n] = FENSTER[art], jetzt = Math.max(0, P.findIndex(z => z.heute || !z.vorbei));
    const start = Math.max(0, Math.min(P.length - n, (art === 'monat' ? 0 : jetzt - vor) + H.ab * n));
    return { Z: P.slice(start, start + n), start, vor: start > 0, nach: start + n < P.length };
  }
  const name = z => z.heute ? 'heute' : null;
  const titel = (z, art) => art === 'monat' ? `${MON[z.von.getMonth()]} ${z.von.getFullYear()}` : art === 'woche' ? `${tt(z.von)}–${tt(z.bis)}` : `${WT[z.von.getDay()]} ${tt(z.von)}`;
  const QTEXT = { gemessen: 'gemessen', vorhersage: 'Vorhersage', klima: 'Klimamittel' };
  const herkunftZ = z => [...z.quellen].map(q => QTEXT[q]).join(' + ');

  /* ---------- Balken (Monat / Woche / Tag) ---------- */
  function balken(h, art) {
    const P = perioden(h, art), { Z, vor, nach } = fenster(P, art), W = 340, Hh = 190, L = 34, U = art === 'tag' ? 30 : 22, O = art === 'tag' ? 22 : 10;
    const max = Math.max(...Z.map(z => Math.max(z.oben, z.ohne)), 1) * 1.08;
    const bw = (W - L - 6) / Z.length, y = v => Hh - U - v / max * (Hh - U - O), x = i => L + i * bw;
    const stufen = [0, 0.25, 0.5, 0.75, 1].map(f => max / 1.08 * f), mwh = max > 4000;
    const wahl = H.wahl === null ? Z.findIndex(z => z.heute || !z.vorbei) : H.wahl;
    const s = Z.map((z, i) => {
      const b = bw * 0.62, x0 = x(i) + bw * 0.12, xo = x0 + b + 1, ow = Math.max(3, bw * 0.16), mit = z.ist + z.prog;
      return `<g class="hj-b ${i === wahl ? 'on' : ''}" data-i="${i}">
        <rect class="hj-hit" x="${x(i)}" y="${O}" width="${bw}" height="${Hh - U - O}"/>
        ${z.ist ? `<rect class="hj-ist" x="${x0}" y="${y(z.ist)}" width="${b}" height="${y(0) - y(z.ist)}"/>` : ''}
        ${z.prog ? `<rect class="hj-prog" x="${x0}" y="${y(mit)}" width="${b}" height="${y(z.ist) - y(mit)}"/>` : ''}
        ${z.prog && z.oben - z.unten > 0.5 ? `<line class="hj-sp" x1="${x0 + b / 2}" y1="${y(z.oben)}" x2="${x0 + b / 2}" y2="${y(z.unten)}"/><line class="hj-sp" x1="${x0 + b * .3}" y1="${y(z.oben)}" x2="${x0 + b * .7}" y2="${y(z.oben)}"/><line class="hj-sp" x1="${x0 + b * .3}" y1="${y(z.unten)}" x2="${x0 + b * .7}" y2="${y(z.unten)}"/>` : ''}
        <rect class="hj-ohne" x="${xo}" y="${y(z.ohne)}" width="${ow}" height="${y(0) - y(z.ohne)}"/>
        ${art === 'tag' ? `<text class="hj-temp ${z.quellen.has('klima') ? 'kl' : ''}" x="${x(i) + bw / 2}" y="${O - 8}">${de(z.temp, 0)}°</text>` : ''}
        <text class="hj-x ${z.heute ? 'heute' : ''}" x="${x(i) + bw / 2}" y="${Hh - U + 12}">${art === 'monat' ? MON[z.von.getMonth()] : art === 'woche' ? tt(z.von).slice(0, 6) : WT[z.von.getDay()]}</text>
        ${art === 'tag' ? `<text class="hj-x2 ${z.heute ? 'heute' : ''}" x="${x(i) + bw / 2}" y="${Hh - U + 23}">${z.heute ? 'heute' : `${z.von.getDate()}.`}</text>` : ''}</g>`; }).join('');
    const ht = Z.findIndex(z => z.heute || (!z.vorbei && art !== 'tag'));
    const svg = R.svg(`<svg class="hp-dia hj-dia" viewBox="0 0 ${W} ${Hh}">
      ${stufen.map(v => `<line class="hp-gitter" x1="${L}" y1="${y(v)}" x2="${W - 6}" y2="${y(v)}"/><text class="hp-yt" x="${L - 4}" y="${y(v) + 3}">${de(mwh ? v / 1000 : v, mwh ? 1 : 0)}</text>`).join('')}
      <text class="hp-yt" x="${L - 4}" y="${art === 'tag' ? O - 8 : 8}">${mwh ? 'MWh' : 'kWh'}</text>
      ${ht >= 0 ? `<line class="hp-heute" x1="${x(ht)}" y1="${O}" x2="${x(ht)}" y2="${Hh - U}"/>` : ''}${s}</svg>`);
    const z = Z[Math.max(0, Math.min(Z.length - 1, wahl))];
    const nav = (d, t, an) => html`<button class="chip glas-panel hj-nav" ?disabled=${!an} @click=${() => { H.ab += d; H.wahl = null; R.neuAlle(); }}>${t}</button>`;
    return html`<div class="hj-kopf">${art !== 'monat' ? nav(-1, '‹', vor) : nothing}
        <span class="hj-zr">${titel(Z[0], art).split('–')[0]} – ${titel(Z[Z.length - 1], art).split('–').pop()}</span>
        ${art !== 'monat' ? html`${nav(1, '›', nach)}${H.ab ? html`<button class="chip glas-panel hj-nav" @click=${() => { H.ab = 0; H.wahl = null; R.neuAlle(); }}>heute</button>` : nothing}` : nothing}</div>
      <div @click=${e => { const g = e.target.closest('.hj-b'); if (g) { H.wahl = +g.dataset.i; R.neuAlle(); } }}>${svg}</div>
      <div class="hj-leg"><span><i class="q-ist"></i>tatsächlich</span><span><i class="q-prog"></i>Prognose mit Automatik</span><span><i class="q-ohne"></i>ohne Automatik</span>${art === 'tag' ? html`<span class="leise">°C: Vorhersage · <em>kursiv</em> = Klimamittel</span>` : nothing}</div>
      ${detail(z, art, h)}`;
  }
  /* 24-h-Kurve des angetippten Tags: Verbrauch je Stunde (gemessen / Prognose), ohne Automatik, Außentemperatur, Heizzeiten */
  function kurve24(z) {
    const werktag = z.von.getDay() > 0 && z.von.getDay() < 6, jetztH = z.heute ? 10 : z.vorbei ? 24 : 0;
    const gew = Array.from({ length: 24 }, (_, s) => werktag ? (s === 5 ? 2.6 : s === 6 ? 1.6 : s >= 7 && s < 16 ? 1.0 : 0.08) : 0.35 + (s < 8 ? 0.15 : 0));
    const gs = gew.reduce((a, b) => a + b, 0), mit = z.ist + z.prog;
    const kwh = gew.map(g => mit * g / gs), temp = Array.from({ length: 24 }, (_, s) => z.temp + 3.2 * Math.sin((s - 9) / 24 * 2 * Math.PI));
    const ohneH = temp.map(t => z.ohne / 24 * (1 + (z.temp - t) * 0.06));
    const W = 340, Hh = 150, L = 30, Rr = 28, U = 18, O = 10, bw = (W - L - Rr) / 24, max = Math.max(...kwh, ...ohneH) * 1.1;
    const tmin = Math.floor(Math.min(...temp) - 1), tmax = Math.ceil(Math.max(...temp) + 1);
    const x = s => L + s * bw, y = v => Hh - U - v / max * (Hh - U - O), yt = t => Hh - U - (t - tmin) / (tmax - tmin) * (Hh - U - O);
    const plan = werktag ? [[5, 16]] : [];
    const svg = R.svg(`<svg class="hp-dia hj-24" viewBox="0 0 ${W} ${Hh}">
      ${plan.map(([a, e]) => `<rect class="hj-plan" x="${x(a)}" y="${O}" width="${(e - a) * bw}" height="${Hh - U - O}"/><text class="hj-pt" x="${x(a) + 3}" y="${O + 9}">Heizzeit</text>`).join('')}
      ${[0, .5, 1].map(f => max / 1.1 * f).map(v => `<line class="hp-gitter" x1="${L}" y1="${y(v)}" x2="${W - Rr}" y2="${y(v)}"/><text class="hp-yt" x="${L - 4}" y="${y(v) + 3}">${de(v, v < 10 ? 1 : 0)}</text>`).join('')}
      <text class="hp-yt" x="${L - 4}" y="${O - 2}">kWh</text>
      ${[tmin, tmax].map(t => `<text class="hj-tt" x="${W - Rr + 4}" y="${yt(t) + (t === tmax ? 8 : 0)}">${t}°</text>`).join('')}
      ${kwh.map((v, s) => `<rect class="${s < jetztH ? 'hj-ist' : 'hj-prog'}" x="${x(s) + bw * .12}" y="${y(v)}" width="${bw * .76}" height="${y(0) - y(v)}"/>`).join('')}
      <path class="hj-ol" d="${ohneH.map((v, s) => `${s ? 'L' : 'M'}${(x(s) + bw / 2).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>
      <path class="hj-tl" d="${temp.map((t, s) => `${s ? 'L' : 'M'}${(x(s) + bw / 2).toFixed(1)},${yt(t).toFixed(1)}`).join(' ')}"/>
      ${[0, 6, 12, 18, 24].map(s => `<text class="hj-x" x="${x(s)}" y="${Hh - 4}">${s}</text>`).join('')}
      ${z.heute ? `<line class="hp-heute" x1="${x(jetztH)}" y1="${O}" x2="${x(jetztH)}" y2="${Hh - U}"/><text class="hp-ht" x="${x(jetztH) + 3}" y="${Hh - U - 4}">jetzt</text>` : ''}</svg>`);
    return html`<div class="hj-titel">Verlauf 24 h</div>${svg}
      <div class="hj-leg"><span><i class="q-ist"></i>gemessen je Stunde</span><span><i class="q-prog"></i>Prognose</span><span><i class="q-ol"></i>ohne Automatik</span><span><i class="q-tl"></i>außen ${z.vorbei ? 'gemessen' : z.heute ? 'gemessen, dann Vorhersage' : z.quellen.has('klima') ? 'Klimamittel (typischer Tagesgang)' : 'Vorhersage'}</span></div>
      <div class="leise">${werktag ? 'Hell: Heizzeit laut Plan (Vorheizen ab 05:00, Arbeitszeit bis 16:00); außerhalb nur Frostschutz.' : 'Freier Tag: nur Frostschutz.'}
        ${z.vorbei ? '' : 'Die Prognose je Stunde verteilt den Tageswert nach Heizplan und Temperaturverlauf.'}</div>`;
  }
  function detail(z, art, h) {
    const mit = z.ist + z.prog;
    return html`<div class="glas-panel hj-det"><div class="hj-det-k"><b>${titel(z, art)}${z.heute ? ' · heute' : ''}</b>
        <span class="leise">Ø ${de(z.temp, 1)} °C außen · ${herkunftZ(z)}</span></div>
      <div class="hj-zeilen">
        ${z.ist ? html`<div><span><i class="q-ist"></i>tatsächlich${z.heute ? ' bis jetzt' : ''}</span><b>${de(z.ist)} kWh · ${eur(z.ist * PREIS)}</b></div>` : nothing}
        ${z.prog ? html`<div><span><i class="q-prog"></i>${!z.ist && !z.heute ? 'Prognose mit Automatik' : art === 'tag' ? 'Rest von heute (noch 14 h)' : `Prognose Rest ${art === 'woche' ? 'der Woche' : 'des Monats'}`}</span><b>${de(z.prog)} kWh · ${eur(z.prog * PREIS)}</b></div>` : nothing}
        ${z.ist && z.prog ? html`<div class="sum"><span>zusammen</span><b>${de(mit)} kWh · ${eur(mit * PREIS)}</b></div>` : nothing}
        ${z.prog && z.oben - z.unten > 0.5 ? html`<div class="leise"><span>Spanne milder–kalter Winter</span><span>${de(z.unten * PREIS)}–${eur(z.oben * PREIS)}</span></div>` : nothing}
        <div><span><i class="q-ohne"></i>ohne Automatik ${h.ohneGemessen ? '(gemessen)' : '(Schätzung)'}</span><b>${de(z.ohne)} kWh · ${eur(z.ohne * PREIS)}</b></div>
        <div class="gesp"><span>gespart</span><b>≈ ${eur((z.ohne - mit) * PREIS)}</b></div></div>${art === 'tag' ? kurve24(z) : nothing}</div>`;
  }

  /* ---------- Heizperiode (aufsummiert, wie bisher) ---------- */
  function linie(h) {
    const T = h.tage, W = 340, Hh = 180, L = 36, U = 22, n = T.length;
    let ist = 0, mit = 0, ohne = 0, unten = 0, oben = 0, hi = 0;
    const S = T.map((d, i) => { ohne += d.ohne; if (d.ist !== null) { ist += d.ist; hi = i; }
      if (d.heute) { mit = unten = oben = ist + d.mit * REST; } else if (d.ist === null) { mit += d.mit; unten += d.unten; oben += d.oben; } else { mit = unten = oben = ist; }
      return { ist: d.ist !== null ? ist : null, mit, unten, oben, ohne }; });
    const max = S[n - 1].ohne * 1.05, x = i => L + i / (n - 1) * (W - L - 6), y = v => Hh - U - v / max * (Hh - U - 10);
    const pfad = (k, a, b) => S.slice(a, b + 1).map((r, j) => `${j ? 'L' : 'M'}${x(a + j).toFixed(1)},${y(r[k]).toFixed(1)}`).join(' ');
    const band = `M${x(hi)},${y(S[hi].unten)} ` + S.slice(hi).map((r, j) => `L${x(hi + j).toFixed(1)},${y(r.oben).toFixed(1)}`).join(' ') + ' ' + S.slice(hi).reverse().map((r, j) => `L${x(n - 1 - j).toFixed(1)},${y(r.unten).toFixed(1)}`).join(' ') + ' Z';
    const z = S[n - 1];
    return { z, ist: S[hi].ist, svg: R.svg(`<svg class="hp-dia" viewBox="0 0 ${W} ${Hh}">
      ${[0, .25, .5, .75, 1].map(f => max / 1.05 * f).map(v => `<line class="hp-gitter" x1="${L}" y1="${y(v)}" x2="${W - 6}" y2="${y(v)}"/><text class="hp-yt" x="${L - 4}" y="${y(v) + 3}">${de(v / 1000)}</text>`).join('')}
      <text class="hp-yt" x="${L - 4}" y="8">MWh</text>
      ${T.map((d, i) => [d.t, i]).filter(([t]) => t.getDate() === 1).map(([t, i]) => `<line class="hp-gitter" x1="${x(i)}" y1="10" x2="${x(i)}" y2="${Hh - U}"/><text x="${x(i) + 10}" y="${Hh - 6}">${MON[t.getMonth()]}</text>`).join('')}
      <path class="hp-band" d="${band}"/><path class="hp-ohne" d="${pfad('ohne', 0, n - 1)}"/><path class="hp-prog" d="${pfad('mit', hi, n - 1)}"/><path class="hp-ist" d="${pfad('ist', 0, hi)}"/>
      <line class="hp-heute" x1="${x(hi)}" y1="10" x2="${x(hi)}" y2="${Hh - U}"/><text class="hp-ht" x="${x(hi) + 3}" y="18">heute</text></svg>`) };
  }
  function hochrechnung(p, h) {
    const AUF = [['hp', 'Heizperiode'], ['monat', 'Monat'], ['woche', 'Woche'], ['tag', 'Tag']];
    const seg = html`<div class="seg glas-panel hj-aufl">${AUF.map(([k, t]) => html`<button class=${H.aufl === k ? 'on' : ''} @click=${() => { H.aufl = k; H.ab = 0; H.wahl = null; R.neuAlle(); }}>${t}</button>`)}</div>`;
    const l = linie(h), z = l.z;
    const kopf = html`<div class="hp-zahl">≈ ${eur(z.mit * PREIS)}<span class="leise"> · ${de(z.unten * PREIS)}–${eur(z.oben * PREIS)}</span></div>`;
    if (H.aufl !== 'hp') return html`${kopf}${seg}${balken(h, H.aufl)}`;
    return html`${kopf}${seg}${l.svg}
      <div class="hp-leg"><span><i class="l-ist"></i>tatsächlich <b>${eur(l.ist * PREIS)}</b></span>
        <span><i class="l-prog"></i>Prognose mit Automatik <b>${eur(z.mit * PREIS)}</b></span>
        <span><i class="l-ohne"></i>Prognose ohne Automatik <b>${eur(z.ohne * PREIS)}</b>${h.ohneGemessen ? html` <span class="hj-gem">gemessen</span>` : nothing}</span>
        <span>gespart ≈ <b>${eur((z.ohne - z.mit) * PREIS)}</b></span></div>
      <div class="leise">${h.ohneGemessen ? html`„ohne Automatik“ aus den Baseline-Messungen (Signatur ohne Automatik je Container).`
        : html`„ohne Automatik“ ist bis zur gemessenen Baseline eine Schätzung (jeder Heizkörper rund um die Uhr). <a class="hp-link" @click=${() => { H.reiter = 'bl'; R.neuAlle(); }}>Baseline ›</a>`}</div>
      <div class="leise hp-her">aus der Energiesignatur je Container · heute: gemessen bis jetzt + Rest des Tages · nächste ${VORH} Tage aus der Vorhersage, danach Klimamittel</div>`;
  }

  /* ---------- Signatur mit „ohne Automatik“ ---------- */
  function signatur(p, h) {
    const C = h.C, c = C[Math.min(H.c, C.length - 1)], mitOhne = H.bl !== 'aus' && c.typ !== 'gemischt' && (c.i === 0 || H.bl === 'fertig');
    const W = 320, Hh = 160, tx = t => 28 + (t + 6) / 30 * (W - 36), f = 1.48, ymax = (c.d0 + c.k * (c.g + 6)) * f * 1.1, ty = v => Hh - 18 - v / ymax * (Hh - 28);
    const pk = (g, k, d0, fac, n0, n) => Array.from({ length: n }, (_, j) => { const t = -4 + ((j + n0) * 7 + c.i * 3) % 22, e = (d0 + k * Math.max(0, g - t)) * fac; return [t, e + Math.sin(j * 2.3 + c.i) * 0.12 * e]; });
    const knick = (g, k, d0, fac, cls) => `<path class="${cls}" d="M${tx(-6)},${ty((d0 + k * (g + 6)) * fac)} L${tx(g)},${ty(d0 * fac)} L${tx(24)},${ty(d0 * fac)}"/>`;
    const mitP = pk(c.g, c.k, c.d0, 1, 0, 24), ohneP = mitOhne ? pk(c.g + 1.5, c.k, c.d0, f, 3, H.bl === 'fertig' ? 6 : 3) : [];
    const svg = R.svg(`<svg class="hp-streu" viewBox="0 0 ${W} ${Hh}"><line class="hp-gitter" x1="28" y1="${Hh - 18}" x2="${W - 6}" y2="${Hh - 18}"/>
      ${[-5, 0, 5, 10, 15, 20].map(t => `<text x="${tx(t)}" y="${Hh - 4}" text-anchor="middle">${t}°</text>`).join('')}
      ${mitP.map(([t, v]) => `<circle cx="${tx(t).toFixed(1)}" cy="${ty(v).toFixed(1)}" r="2.6"/>`).join('')}
      ${ohneP.map(([t, v]) => `<rect class="hj-o" x="${(tx(t) - 3).toFixed(1)}" y="${(ty(v) - 3).toFixed(1)}" width="6" height="6"/>`).join('')}
      ${knick(c.g, c.k, c.d0, 1, '')}${mitOhne && ohneP.length >= 6 ? knick(c.g + 1.5, c.k, c.d0, f, 'hj-ok') : ''}
      <line class="hp-grenze" x1="${tx(c.g)}" y1="10" x2="${tx(c.g)}" y2="${Hh - 18}"/><text class="hp-gt" x="${tx(c.g) + 3}" y="16">Heizgrenze ${de(c.g, 1)}°</text></svg>`);
    return html`<label class="feld hp-wahl">Container<select @change=${e => { H.c = +e.target.value; R.neuAlle(); }}>${C.map((x, j) => html`<option value=${j} ?selected=${j === H.c}>${x.name}</option>`)}</select></label>
      ${svg}<div class="hj-leg"><span><i class="q-punkt"></i>mit Automatik</span><span><i class="q-quad"></i>ohne Automatik (Baseline)</span></div>
      <div class="hp-zeilen">${C.map(x => { const o = H.bl !== 'aus' && (x.i === 0 || H.bl === 'fertig'), od = H.bl === 'fertig' ? 6 : x.i === 0 ? 3 : 0;
        return html`<div class="hp-zeile"><b>${x.name}</b><span>ab <b>${de(x.g, 1)} °C</b></span><span>+${de(x.k, 1)} kWh je Grad · Grundlast ${de(x.d0, 1)} kWh/Tag</span>
          <span class="hj-oz">ohne Automatik: ${x.typ === 'gemischt' ? (H.bl === 'fertig' ? 'über das Verhältnis je Heizkörper-Typ' : html`<span class="leise">wird nicht gemessen</span>`)
            : o && od >= 6 ? html`+${de(x.k * f, 1)} kWh je Grad · <span class="hp-st gruen-t">gut</span> · ${od} Baseline-Tage` : html`<span class="leise">${od ? `lernt · ${od}/6 Baseline-Tage` : 'noch nicht gemessen'}</span>`}</span></div>`; })}</div>
      <div class="leise">Quadrate: Tage eines Baseline-Laufs (alle Heizkörper ohne Automatik, der Thermostat am Gerät regelt). Der Abstand
        der beiden Linien ist, was die Automatik je Tag spart.</div>`;
  }

  /* ---------- Reiter Baseline (J4b) ---------- */
  const LAEUFE = {
    aus: [],
    geplant: [['21.11.–22.11.', 0, 'geplant', '≈ 13 €'], ['14.11.–15.11.', 1, 'abgebrochen', '6,10 €', 'Tür offen am So 09:12 · Samstag zählt'], ['07.11.–08.11.', 0, 'fertig', '12,40 €']],
    laeuft: [['21.11.–22.11.', 0, 'laeuft', 'bisher 4,20 €'], ['14.11.–15.11.', 1, 'abgebrochen', '6,10 €', 'Tür offen am So 09:12 · Samstag zählt'], ['07.11.–08.11.', 0, 'fertig', '12,40 €']],
    fertig: [['05.12.–06.12.', 1, 'fertig', '14,80 €'], ['28.11.–29.11.', 3, 'fertig', '7,30 €'], ['21.11.–22.11.', 0, 'fertig', '13,10 €'], ['14.11.–15.11.', 1, 'abgebrochen', '6,10 €', 'Tür offen am So 09:12 · Samstag zählt'], ['07.11.–08.11.', 0, 'fertig', '12,40 €']],
  };
  const ST = { geplant: ['geplant', 'amber-t'], laeuft: ['läuft', 'blau-t'], fertig: ['fertig', 'gruen-t'], abgebrochen: ['abgebrochen', 'rot-t'], abgesagt: ['abgesagt', 'leise'] };
  function baseline(p, h) {
    const C = h.C, L = LAEUFE[H.an ? H.bl : 'aus'], verbraucht = H.bl === 'fertig' ? 14.8 : H.bl === 'aus' || !H.an ? 0 : 18.5;
    const naechst = H.an && (H.bl === 'geplant' || H.bl === 'laeuft') ? L[0] : null, nc = naechst && C[naechst[1] % C.length];
    const sw = html`<button class="sw ${H.an ? 'on' : ''}" role="switch" @click=${() => { H.an = !H.an; R.neuAlle(); }}><i></i></button>`;
    return html`<div class="hj-zeile1"><div><b>Baseline messen</b><div class="leise">an freien Tagen einen Container ohne Automatik heizen – misst, was die Automatik spart</div></div>${sw}</div>
      ${H.an ? html`
      <div class="hj-zeile1 hj-rahmen" @click=${() => R.auf(p, { art: 'hj-rahmen' })}><div><b>Kostenrahmen</b> <span class="leise">je Monat</span>
          <div class="hj-balken"><i style="width:${Math.min(100, verbraucht / H.rahmen * 100)}%"></i></div>
          <div class="leise">November: ${eur(verbraucht)} von ${eur(H.rahmen)} verbraucht</div></div><span class="chip glas-panel">${eur(H.rahmen)} ✎</span></div>
      ${naechst ? html`<div class="glas-panel hj-lauf ${H.bl}"><div class="hj-lauf-k"><b>${H.bl === 'laeuft' ? 'Läuft jetzt' : 'Nächster Lauf'}</b>${(([t, k]) => html`<span class="hp-st ${k}">${t}</span>`)(ST[naechst[2]])}</div>
          <div class="hj-lauf-z"><b>${nc.name}</b> · ${nc.typ === 'oelradiator' ? 'Ölradiator' : 'Konvektor'}</div>
          <div>Sa 21.11. 00:00 – So 22.11. 24:00 · alle Heizkörper ohne Automatik, der Thermostat am Gerät regelt</div>
          <div class="leise">${H.bl === 'laeuft' ? 'bisher 21 kWh · 4,20 € · endet bei offener Tür, Taste, Bedarf oder Termin' : 'geschätzt ≈ 13 € · angekündigt heute 12:00 aufs Handy'}</div>
          <button class="knopf ${H.bl === 'laeuft' ? 'rot' : 'leise-k'}" @click=${() => { H.bl = 'aus'; R.neuAlle(); }}>${H.bl === 'laeuft' ? 'Abbrechen – Automatik übernimmt' : 'Absagen'}</button></div>`
        : H.bl === 'fertig' ? html`<div class="glas-panel hj-lauf fertig"><b>Alle Container gemessen ✓</b><div class="leise">Die Prognose „ohne Automatik“ kommt jetzt aus der Messung. Neue Läufe nur, wenn eine Signatur unsicher wird.</div></div>`
        : html`<div class="leise">Nächster Lauf wird am Tag davor um 12:00 geplant und angekündigt (nur Wochenende und freie Tage).</div>`}
      <div class="hj-titel">Fortschritt je Container</div>
      <div class="hp-zeilen">${C.map(x => { const t = H.bl === 'fertig' ? (x.typ === 'gemischt' ? 0 : 6) : x.i === 0 ? 3 : 0;
        return html`<div class="hp-zeile hj-fz"><b>${x.name}</b><span class="leise">${x.typ === 'oelradiator' ? 'Ölradiator' : x.typ === 'konvektor' ? 'Konvektor' : 'gemischt'}</span>
          <span class="hj-punkte">${[0, 1, 2, 3, 4, 5].map(j => html`<i class=${j < t ? 'on' : ''}></i>`)}</span>
          <span>${x.typ === 'gemischt' ? html`<span class="leise">wird nicht gemessen · ${H.bl === 'fertig' ? 'Verhältnis der anderen' : 'später über das Verhältnis'}</span>`
            : t >= 6 ? html`<span class="hp-st gruen-t">gut</span>` : html`<span class="leise">${t}/6 Tage</span>`}</span></div>`; })}</div>
      <div class="hj-titel">Läufe</div>
      <div class="hj-liste">${L.map(([zr, ci, st, kosten, grund]) => html`<div class="hj-l"><span class="hj-l-d">${zr}</span><span class="hj-l-c">${C[ci % C.length].name}</span>
          <span class="hp-st ${ST[st][1]}">${ST[st][0]}</span><span class="hj-l-e">${kosten}</span>${grund ? html`<span class="leise hj-l-g">${grund}</span>` : nothing}</div>`)}</div>`
      : html`<div class="leise">Aus: „ohne Automatik“ bleibt eine Schätzung (jeder Heizkörper rund um die Uhr). Eingeschaltet plant die Integration
        an Wochenenden und freien Tagen je einen Container für bis zu 48 h, abwechselnd Ölradiator und Konvektor, im Kostenrahmen, und kündigt jeden
        Lauf am Vortag um 12:00 aufs Handy an (mit „Absagen“).</div>`}`;
  }

  /* ---------- Karte ---------- */
  function karte(p) {
    const h = daten(p), R_ = [['hoch', p.narrow ? 'Prognose' : 'Hochrechnung'], ['sig', 'Signatur'], ['klima', 'Klima'], ['bl', 'Baseline']];
    return html`<div class="glas-panel block hj-karte"><div class="block-kopf"><b>Heizperiode ${R.marke}</b><span class="chip glas-panel hp-zeit">Okt–Apr · bis 30.04.2027 ✎</span></div>
      <div class="seg glas-panel hp-reiter">${R_.map(([k, t]) => html`<button class=${H.reiter === k ? 'on' : ''} @click=${() => { H.reiter = k; R.neuAlle(); }}>${t}</button>`)}</div>
      ${H.reiter === 'hoch' ? hochrechnung(p, h) : H.reiter === 'sig' ? signatur(p, h) : H.reiter === 'bl' ? baseline(p, h)
        : html`<div class="leer">Reiter Klima wie bisher (unverändert)</div>`}</div>`;
  }
  R.abschnitt({ ansicht: 'auswertung', vor: karte });

  R.einblendung('hj-rahmen', p => html`<div class="block-kopf"><h3>Kostenrahmen Baseline</h3><span class="leise">je Monat</span></div>
      <div class="glas-panel liste hj-eing"><label class="feld">€ je Monat<input inputmode="decimal" .value=${de(H.rahmen)} @change=${e => { H.rahmen = +String(e.target.value).replace(',', '.') || 60; }}></label></div>
      <div class="leise">Ein Lauf wird nur geplant, wenn seine geschätzten Kosten in den Rest des Monats passen. Gemessene Kosten fertiger
        Läufe zählen gegen den Rahmen, abgesagte nicht. Vorgabe 60 €.</div>
      <div class="hp-knoepfe"><button class="knopf amber" @click=${() => { p.schliessen(); R.neuAlle(); }}>Speichern</button>
        <button class="knopf leise-k" @click=${() => p.schliessen()}>Abbrechen</button></div>`, { breit: () => false });

  R.stil(`
.hp-karte { display: none; }   /* echte Karte im Vorschlag ausblenden – hier steht der Vorschlag */
.hj-aufl { margin: 2px 0 8px; } .seg.hj-aufl button { padding: 6px 2px; font-size: 12px; min-width: 0; flex: 1 1 0; }
.hj-kopf { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } .hj-zr { flex: 1; text-align: center; font-size: 13px; font-weight: 600; }
.hj-nav { font-size: 13px; padding: 3px 10px; cursor: pointer; } .hj-nav[disabled] { opacity: .35; }
.hj-dia { cursor: pointer; } .hj-dia .hj-hit { fill: transparent; } .hj-dia .hj-b.on .hj-hit { fill: rgba(127,127,127,.12); }
.hj-dia .hj-ist { fill: var(--s3); } .hj-dia .hj-prog { fill: var(--s1); opacity: .45; } .hj-dia .hj-ohne { fill: var(--s2); opacity: .75; }
.hj-dia .hj-sp { stroke: var(--s1); stroke-width: 1.2; }
.hj-dia .hj-temp { text-anchor: middle; font-size: 9px; fill: var(--ink); } .hj-dia .hj-temp.kl { font-style: italic; fill: var(--ink2); }
.hj-dia .hj-x, .hj-dia .hj-x2 { text-anchor: middle; } .hj-dia .heute { fill: var(--amber); font-weight: 600; }
.seg.hp-reiter button { padding: 7px 2px; min-width: 0; flex: 1 1 0; font-size: 12px; }
.hj-zeilen b { white-space: nowrap; }
.hj-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; margin: 2px 0 6px; } .hj-leg i, .hj-zeilen i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.q-ist { background: var(--s3); } .q-prog { background: var(--s1); opacity: .45; } .q-ohne { background: var(--s2); opacity: .75; }
.q-punkt { background: var(--ink2); border-radius: 50% !important; } .q-quad { background: var(--s2); } .hj-kl { font-style: italic; }
.hj-det { padding: 10px 12px; border-radius: 14px; margin: 4px 0; } .hj-det-k { display: flex; flex-direction: column; margin-bottom: 4px; }
.hj-zeilen > div { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 3px 0; }
.hj-zeilen .sum { border-top: 1px solid rgba(127,127,127,.2); } .hj-zeilen .gesp b { color: #30d158; }
.hj-gem { font-size: 12px; color: var(--ink2); }
.hj-24 .hj-ist { fill: var(--s3); } .hj-24 .hj-prog { fill: var(--s1); opacity: .45; } .hj-24 .hj-plan { fill: var(--amber); opacity: .14; }
.hj-24 .hj-pt { fill: var(--amber); font-size: 8px; } .hj-24 .hj-x { text-anchor: middle; } .hj-24 .hj-tt { font-size: 9px; fill: var(--ink); }
.hj-24 path.hj-ol { fill: none; stroke: var(--s2); stroke-width: 1.8; stroke-dasharray: 2 3; } .hj-24 path.hj-tl { fill: none; stroke: var(--ink); stroke-width: 1.6; }
.q-ol { background: none !important; border-top: 2px dotted var(--s2); height: 0 !important; width: 14px !important; } .q-tl { background: none !important; border-top: 2px solid var(--ink); height: 0 !important; width: 14px !important; }
.hp-streu .hj-o { fill: var(--s2); } .hp-streu path.hj-ok { stroke: var(--s2); stroke-dasharray: 5 3; }
.hj-oz { flex: 1 1 100%; font-size: 12px; }
.hj-zeile1 { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(127,127,127,.15); }
.hj-rahmen { cursor: pointer; } .hj-rahmen > div { flex: 1; }
.hj-balken { height: 6px; border-radius: 3px; background: rgba(127,127,127,.2); margin: 6px 0 2px; } .hj-balken i { display: block; height: 100%; border-radius: 3px; background: var(--amber); }
.hj-lauf { padding: 10px 12px; border-radius: 14px; margin: 10px 0; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.hj-lauf-k { display: flex; justify-content: space-between; } .hj-lauf .knopf { margin-top: 6px; }
.blau-t { color: var(--blau); }
.hj-titel { font-size: 12px; color: var(--ink2); text-transform: uppercase; letter-spacing: .04em; margin: 12px 0 2px; }
.hj-fz { align-items: center; } .hj-fz > b { flex: 0 1 auto !important; } .hj-punkte { display: inline-flex; gap: 3px; }
.hj-punkte i { width: 9px; height: 9px; border-radius: 50%; background: rgba(127,127,127,.25); } .hj-punkte i.on { background: var(--s2); }
.hj-liste { display: flex; flex-direction: column; }
.hj-l { display: grid; grid-template-columns: auto 1fr auto auto; gap: 2px 10px; padding: 6px 0; font-size: 13px; border-bottom: 1px solid rgba(127,127,127,.15); align-items: baseline; }
.hj-l-c { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .hj-l-e { text-align: right; white-space: nowrap; } .hj-l-g { grid-column: 1 / -1; font-size: 12px; }
.hj-eing { padding: 10px 14px; } .hj-eing input { width: 100%; box-sizing: border-box; }`);

  /* ---------- Vorführ-Leiste ---------- */
  R.vorfuehren(w => {
    H.bl = w.baseline; H.an = w.baseline !== 'aus';
    const z = w.zeigen; H.reiter = z === 'signatur' ? 'sig' : z === 'baseline' ? 'bl' : 'hoch';
    if (['hp', 'monat', 'woche', 'tag'].includes(z)) H.aufl = z;
    H.ab = 0; H.wahl = null;
    for (const q of R.P()) {
      if (!q.d) continue;
      q.s.sheet = null; q.gehe('auswertung');
      if (z === 'rahmen') { H.reiter = 'bl'; q.s.sheet = { art: 'hj-rahmen' }; }
      q.neuZeichnen();
    }
  });
}

const BASELINE = [['aus', 'Baseline aus'], ['geplant', 'Lauf geplant'], ['laeuft', 'Lauf läuft'], ['fertig', 'alle gemessen']];
const ZEIGEN = [['tag', 'Hochrechnung · Tag'], ['woche', 'Hochrechnung · Woche'], ['monat', 'Hochrechnung · Monat'], ['hp', 'Hochrechnung · Heizperiode'],
  ['signatur', 'Reiter Signatur'], ['baseline', 'Reiter Baseline'], ['rahmen', 'Einblendung Kostenrahmen']];
const faelle = [];
for (const z of ['tag', 'woche', 'monat', 'hp']) faelle.push({ name: `hoch-${z}`, werte: { baseline: 'geplant', zeigen: z } });
faelle.push({ name: 'tag-24h', werte: { baseline: 'geplant', zeigen: 'tag' }, scroll: '.hj-det' });
faelle.push({ name: 'hoch-hp-gemessen', werte: { baseline: 'fertig', zeigen: 'hp' } });
for (const b of ['aus', 'geplant', 'laeuft', 'fertig']) faelle.push({ name: `baseline-${b}`, werte: { baseline: b, zeigen: 'baseline' } });
faelle.push({ name: 'signatur', werte: { baseline: 'fertig', zeigen: 'signatur' } });
faelle.push({ name: 'rahmen', werte: { baseline: 'geplant', zeigen: 'rahmen' } });
rahmen.bauen({ datei: 'hochrechnung-j4b.html', titel: 'Baustelle – Prognose je Tag und Baseline', leiste: 'BSM-033.04 Prognose Tag/Woche/Monat · Baseline', browser, faelle,
  auswahl: [{ id: 'zeigen', t: 'zeigen', optionen: ZEIGEN }, { id: 'baseline', t: 'Baseline', optionen: BASELINE }] });
