// BSM-033.03: Vorschlag „Hochrechnung mit Spanne, Energiesignatur, Klimamittel“ auf Basis des Master-Mockups
// (docs/bauplan-hochrechnung.md §2 .03). Baut mockups/hochrechnung.html: node mockups/quelle/hochrechnung.js
// prüfen: node mockups/quelle/vorschau/pruefen.cjs mockups/hochrechnung.html · Bilder: --bilder <ordner>
//
// Die Zahlen liefert die Integration (baustelle/auswertung › hochrechnung, 0.8.124): methode, mit/unten/oben/normjahr in kWh
// und €, hgt_rest, vorhersage_tage, je Container Signatur (stand, tage, grenze, kwh_je_grad, grundlast, cv_rmse) und Rest.
// Die Seite rechnet nichts; im Mockup stehen Beispielwerte (Lage: lernt / Signatur / gemischt).
// Herbert 10.10.2026: Variante 2 – eine Karte „Heizperiode“ mit Reitern Hochrechnung / Signatur / Klima; Heizperiode in der
// Karte einstellbar (dieselbe Einstellung wie Einstellungen › Baustelle); im Reiter Hochrechnung ein Diagramm über die ganze
// Heizperiode: tatsächlich (bis heute), Prognose mit Automatik (mit Spanne) und Prognose ohne Automatik, aufsummiert.
// (Variante 1 „Blöcke erweitern“ verworfen.)
const rahmen = require('./rahmen');

/* Läuft nur im Browser (als Text eingesetzt, Node führt es nie aus) */
function browser(R) {
  const { html, nothing } = R;
  const H = window.HR = { lage: 'signatur', reiter: 'hoch', c: 0, hp: [10, 4] };
  const de = (x, n = 0) => (+x).toLocaleString('de-AT', { minimumFractionDigits: n, maximumFractionDigits: n });
  const eur = x => `${de(x)}\u00a0€`;
  const MON = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const KLIMA = [0.3, 2.0, 6.3, 11.1, 15.6, 19.4, 21.1, 20.6, 15.8, 10.6, 5.4, 1.0];
  const PREIS = 0.2;
  const PARAM = [[15.5, 1.9, 2.1, 0.12], [14.0, 2.4, 1.6, 0.17], [16.0, 2.1, 2.4, 0.24], [13.0, 0.9, 0.8, 0.27]];   // Grenze, kWh/°C, Grundlast, CV

  /* ---------- Beispiel: was baustelle/auswertung › hochrechnung liefert (neu: Tagesreihe für das Diagramm) ---------- */
  const HEUTE = new Date(2026, 9, 10);
  const klimaTag = t => { const m = t.getMonth(), f = (t.getDate() - 15) / 30, n = f >= 0 ? (m + 1) % 12 : (m + 11) % 12;
    return KLIMA[m] + (KLIMA[n] - KLIMA[m]) * Math.abs(f); };
  function daten(p) {
    const C = p.d.bereiche.filter(b => !b.pumpe);
    const container = C.map((b, i) => {
      const [g, k, d0, cv0] = PARAM[i % 4], cv = H.lage === 'gemischt' && i === 2 ? 0.36 : cv0, lernt = H.lage === 'lernt' || (H.lage === 'gemischt' && i % 2 === 1);
      const stand = lernt ? 'lernt' : cv <= 0.2 ? 'gut' : cv <= 0.3 ? 'brauchbar' : 'unsicher', mitSig = !lernt && stand !== 'unsicher';
      return { bereich: b.id, name: b.name, methode: mitSig ? 'signatur' : 'tagesschnitt', stand, tage: lernt ? 9 : 24 + i * 3,
        grund: lernt ? 'erst 9 von 10 Tagen' : stand === 'unsicher' ? 'Tage streuen stark um die Signatur' : null,
        grenze: lernt ? null : g, kwh_je_grad: lernt ? null : k, grundlast: lernt ? null : d0, cv_rmse: lernt ? null : cv, g, k, d0, punkte: punkte(g, k, d0, cv, i) };
    });
    // Heizperiode von–bis (Monate), Tage von Beginn bis Ende; bis heute „tatsächlich“, danach Prognose
    const [von, bis] = H.hp, j0 = HEUTE.getMonth() + 1 >= von ? 2026 : 2025, beginn = new Date(j0, von - 1, 1), ende = new Date(j0 + (bis < von ? 1 : 0), bis, 0);
    const tage = []; for (let t = new Date(beginn); t <= ende; t.setDate(t.getDate() + 1)) tage.push(new Date(t));
    const jeTag = t => container.reduce((s, c) => s + c.d0 + c.k * Math.max(0, c.g - t), 0);
    let ist = 0, mit = 0, ohne = 0, unten = 0, oben = 0, istBis = 0;
    const reihe = tage.map((t, n) => {
      const T = klimaTag(t), gemessen = t < HEUTE;
      const e = jeTag(T + (gemessen ? Math.sin(n * 1.7) * 2.5 : 0)), o = e * 1.65 + 9;   // ohne: Thermostat am Heizkörper regelt (Beispiel)
      if (gemessen) { ist += e; mit = unten = oben = ist; istBis = n; } else { mit += e; unten += jeTag(T + 1.5) * 0.97; oben += jeTag(T - 1.5) * 1.03; }
      ohne += o;
      return { t, ist: gemessen ? ist : null, mit, unten, oben, ohne };
    });
    const alle = container.every(c => c.methode === 'signatur'), z = reihe[reihe.length - 1], bisher = istBis ? reihe[istBis].ist : 0;
    return { methode: alle ? 'signatur' : 'tagesschnitt', bisher_kwh: bisher, bisher_eur: bisher * PREIS, mit_kwh: z.mit, mit_eur: z.mit * PREIS,
      unten_kwh: alle ? z.unten : null, oben_kwh: alle ? z.oben : null, unten_eur: alle ? z.unten * PREIS : null, oben_eur: alle ? z.oben * PREIS : null,
      normjahr_kwh: alle ? z.mit * 1.03 : null, normjahr_eur: alle ? z.mit * 1.03 * PREIS : null, ohne_kwh: z.ohne, ohne_eur: z.ohne * PREIS,
      gespart_eur: (z.ohne - z.mit) * PREIS, hgt_rest: 2916, vorhersage_tage: 6, container, reihe, heute: istBis, alle,
      vorhersage: [6.5, 4.0, 2.5, 3.0, 5.5, 7.0], ende: ende.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      hpText: `${MON[von - 1]}–${MON[bis - 1]}` };
  }
  function punkte(g, k, d0, cv, i) {
    const P = [];
    for (let n = 0; n < 26; n++) { const t = -4 + (n * 7 + i * 3) % 22, e = d0 + k * Math.max(0, g - t), r = Math.sin(n * 2.3 + i) * cv * Math.max(e, 3);
      P.push([t, Math.max(0, e + r)]); }
    return P;
  }

  /* ---------- Bausteine ---------- */
  const STAND = { gut: ['gut', 'gruen-t'], brauchbar: ['brauchbar', 'amber-t'], unsicher: ['unsicher', 'rot-t'], lernt: ['lernt noch', 'leise'] };
  const stand = c => { const [t, k] = STAND[c.stand] || [c.stand, '']; return html`<span class="hr-st ${k}">${t}${c.stand === 'lernt' ? ` · ${c.tage}/10 Tage` : ''}</span>`; };
  const herkunft = h => h.methode === 'signatur'
    ? html`aus der Energiesignatur je Container · nächste ${h.vorhersage_tage} Tage aus der Vorhersage, danach Klimamittel · noch ${de(h.hgt_rest)} Heizgradtage`
    : html`<b>lernt noch</b> – ${h.container.filter(c => c.methode !== 'signatur').length} von ${h.container.length} Containern rechnen mit dem Tagesschnitt, bis die Signatur steht (10 ganze Tage, 4 K Spanne)`;

  function spanne(h, gross = true) {
    if (h.unten_eur === null) return html`<div class="hr-zahl">≈ ${de(h.mit_eur)} €<span class="leise"> · ${de(h.mit_kwh)} kWh</span></div>`;
    const min = h.unten_eur * 0.9, max = h.oben_eur * 1.05, x = v => (v - min) / (max - min) * 100;
    return html`<div class="hr-zahl">≈ ${de(h.mit_eur)} €<span class="leise"> · ${de(h.unten_eur)}–${de(h.oben_eur)} €</span></div>
      ${gross ? html`<div class="hr-spanne"><i class="hr-band" style="left:${x(h.unten_eur)}%;width:${x(h.oben_eur) - x(h.unten_eur)}%"></i><i class="hr-mitte" style="left:${x(h.mit_eur)}%"></i></div>
      <div class="hr-skala leise"><span>milder Winter ${de(h.unten_kwh)} kWh</span><span>kalter Winter ${de(h.oben_kwh)} kWh</span></div>` : nothing}`;
  }
  /* Diagramm: aufsummiert über die Heizperiode – tatsächlich, Prognose mit Automatik (Band = Spanne), Prognose ohne Automatik */
  function diagramm(h) {
    const W = 340, Hh = 180, L = 36, U = 22, n = h.reihe.length, max = h.reihe[n - 1].ohne * 1.05;
    const x = i => L + i / (n - 1) * (W - L - 6), y = v => Hh - U - v / max * (Hh - U - 10);
    const pfad = (k, von = 0, bis = n - 1) => h.reihe.slice(von, bis + 1).map((r, j) => `${j ? 'L' : 'M'}${x(von + j).toFixed(1)},${y(r[k]).toFixed(1)}`).join(' ');
    const band = h.alle ? `M${x(h.heute)},${y(h.reihe[h.heute].unten)} ` + h.reihe.slice(h.heute).map((r, j) => `L${x(h.heute + j).toFixed(1)},${y(r.oben).toFixed(1)}`).join(' ')
      + ' ' + h.reihe.slice(h.heute).reverse().map((r, j) => `L${x(n - 1 - j).toFixed(1)},${y(r.unten).toFixed(1)}`).join(' ') + ' Z' : '';
    const monate = h.reihe.map((r, i) => [r.t, i]).filter(([t]) => t.getDate() === 1);
    const stufen = [0, 0.25, 0.5, 0.75, 1].map(f => max / 1.05 * f);
    return R.svg(`<svg class="hr-dia" viewBox="0 0 ${W} ${Hh}">
      ${stufen.map(v => `<line class="hr-gitter" x1="${L}" y1="${y(v)}" x2="${W - 6}" y2="${y(v)}"/><text class="hr-yt" x="${L - 4}" y="${y(v) + 3}">${de(v / 1000, 0)}</text>`).join('')}
      <text class="hr-yt" x="${L - 4}" y="8">MWh</text>
      ${monate.map(([t, i]) => `<text x="${x(i) + 10}" y="${Hh - 6}">${MON[t.getMonth()]}</text><line class="hr-gitter" x1="${x(i)}" y1="10" x2="${x(i)}" y2="${Hh - U}"/>`).join('')}
      ${band ? `<path class="hr-bandf" d="${band}"/>` : ''}
      <path class="hr-ohne" d="${pfad('ohne')}"/>
      <path class="hr-prog" d="${pfad('mit', h.heute)}"/>
      ${h.heute ? `<path class="hr-ist" d="${pfad('ist', 0, h.heute)}"/>` : ''}
      <line class="hr-heute" x1="${x(h.heute)}" y1="10" x2="${x(h.heute)}" y2="${Hh - U}"/><text class="hr-ht" x="${x(h.heute) + 3}" y="18">heute</text></svg>`);
  }
  const legende = h => html`<div class="hr-leg">
      <span><i class="l-ist"></i>tatsächlich <b>${eur(h.bisher_eur)}</b></span>
      <span><i class="l-prog"></i>Prognose mit Automatik <b>${eur(h.mit_eur)}</b>${h.unten_eur !== null ? html`<span class="leise"> (${de(h.unten_eur)}–${de(h.oben_eur)})</span>` : nothing}</span>
      <span><i class="l-ohne"></i>Prognose ohne Automatik <b>${eur(h.ohne_eur)}</b></span>
      <span class="hr-gesp">gespart ≈ <b>${eur(h.gespart_eur)}</b></span></div>
    <div class="leise">„ohne Automatik“ ist bis zur gemessenen Baseline (J4) eine Schätzung.</div>`;
  const klimaLink = p => html`<a class="hr-link" @click=${() => R.auf(p, { art: 'hr-klima', zurueck: p.s.sheet })}>Klimamittel ändern ›</a>`;

  function streu(c) {
    const W = 320, Hh = 150, tx = t => 28 + (t + 6) / 30 * (W - 36), ymax = Math.max(...c.punkte.map(q => q[1]), 10), ty = v => Hh - 18 - v / ymax * (Hh - 28);
    const linie = c.grenze === null ? '' : `M${tx(-6)},${ty(c.grundlast + c.kwh_je_grad * (c.grenze + 6))} L${tx(c.grenze)},${ty(c.grundlast)} L${tx(24)},${ty(c.grundlast)}`;
    return R.svg(`<svg class="hr-streu" viewBox="0 0 ${W} ${Hh}"><g class="hr-achse"><line x1="28" y1="${Hh - 18}" x2="${W - 6}" y2="${Hh - 18}"/>
      ${[-5, 0, 5, 10, 15, 20].map(t => `<text x="${tx(t)}" y="${Hh - 4}">${t}°</text>`).join('')}</g>
      ${c.punkte.map(([t, v]) => `<circle cx="${tx(t)}" cy="${ty(v)}" r="2.6"/>`).join('')}
      ${linie ? `<path d="${linie}"/>` : ''}${c.grenze !== null ? `<line class="hr-grenze" x1="${tx(c.grenze)}" y1="10" x2="${tx(c.grenze)}" y2="${Hh - 18}"/><text class="hr-gt" x="${tx(c.grenze) + 3}" y="16">Heizgrenze ${de(c.grenze, 1)}°</text>` : ''}</svg>`);
  }
  function signatur(p, h) {
    const C = h.container, c = C[Math.min(H.c, C.length - 1)], z = () => R.neuAlle();
    return html`<label class="feld hr-wahl">Container<select @change=${e => { H.c = +e.target.value; z(); }}>${C.map((x, i) => html`<option value=${i} ?selected=${i === H.c}>${x.name}</option>`)}</select></label>
      ${c.grenze === null ? html`<div class="leer">${c.name} ${c.stand === 'lernt' ? html`lernt noch: ${c.tage} von 10 ganzen Tagen. Danach zeigt sich hier, ab welcher Außentemperatur geheizt wird.` : 'hat noch keine Signatur.'}</div>` : streu(c)}
      <div class="hr-zeilen">${C.map(x => html`<div class="hr-zeile"><b>${x.name}</b>
        <span>${x.grenze === null ? '–' : html`ab <b>${de(x.grenze, 1)} °C</b>`}</span>
        <span>${x.kwh_je_grad === null ? '' : `+${de(x.kwh_je_grad, 1)} kWh je Grad · Grundlast ${de(x.grundlast, 1)} kWh/Tag`}</span>
        <span>${stand(x)}${x.cv_rmse !== null ? html`<span class="leise"> · ${de(x.cv_rmse * 100)} %</span>` : nothing}</span></div>`)}</div>
      <div class="leise">Je Tag Verbrauch gegen mittlere Außentemperatur (ganze Tage ohne Ausfall). Unter der Heizgrenze steigt der Verbrauch je Grad
        kälter; die Güte ist die mittlere Abweichung (ASHRAE: bis 20 % gut, bis 30 % brauchbar).</div>`;
  }
  function klima(p, h) {
    const max = 22, min = -2, y = v => (v - min) / (max - min) * 100;
    return html`<div class="hr-monate">${KLIMA.map((t, i) => html`<div class="hr-m ${[9, 10, 11, 0, 1, 2, 3].includes(i) ? 'hp' : ''}"><i style="height:${y(t)}%"></i><b>${de(t, 1)}</b><span>${MON[i]}</span></div>`)}</div>
      <div class="leise">Klimamittel Graz 1991–2020 (Vorgabe) · hell: Heizperiode Okt–Apr. ${klimaLink(p)}</div>
      <div class="hr-vh"><b>Vorhersage</b>${h.vorhersage.map((t, i) => html`<span class="chip glas-panel">${['Sa', 'So', 'Mo', 'Di', 'Mi', 'Do'][i]} ${de(t, 1)}°</span>`)}</div>
      <div class="hr-kz"><div><b>${de(h.hgt_rest)}</b><span>Heizgradtage bis ${h.ende}</span></div>${h.normjahr_eur !== null ? html`<div><b>${de(h.normjahr_eur)} €</b><span>im Normjahr (witterungsbereinigt)</span></div>` : nothing}</div>`;
  }

  /* ---------- Karte „Heizperiode“ mit Reitern (Variante 2, Herbert 10.10.2026) ---------- */
  function karte(p) {
    const h = daten(p), z = () => R.neuAlle();
    const R_ = [['hoch', 'Hochrechnung'], ['sig', 'Signatur'], ['klima', 'Klima']];
    return html`<div class="glas-panel block"><div class="block-kopf"><b>Heizperiode ${R.marke}</b>
        <button class="chip glas-panel hr-hp" @click=${() => R.auf(p, { art: 'hr-hp' })}>${h.hpText} · bis ${h.ende} ✎</button></div>
        <div class="seg glas-panel hr-reiter">${R_.map(([k, t]) => html`<button class=${H.reiter === k ? 'on' : ''} @click=${() => { H.reiter = k; z(); }}>${t}</button>`)}</div>
        ${H.reiter === 'hoch' ? html`${spanne(h, false)}${diagramm(h)}${legende(h)}<div class="leise hr-her">${herkunft(h)}</div>`
          : H.reiter === 'sig' ? signatur(p, h) : klima(p, h)}</div>`;
  }
  R.abschnitt({ ansicht: 'auswertung', vor: karte });

  /* ---------- Einblendung Heizperiode (dieselbe Einstellung wie Einstellungen › Baustelle) ---------- */
  R.einblendung('hr-hp', p => { const z = () => R.neuAlle(), wahl = (k, i) => html`<label class="feld">${k}<select @change=${e => { H.hp[i] = +e.target.value; z(); }}>
      ${MON.map((m, j) => html`<option value=${j + 1} ?selected=${H.hp[i] === j + 1}>${['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][j]}</option>`)}</select></label>`;
    return html`<div class="block-kopf"><h3>Heizperiode</h3><span class="leise">gilt für diese Baustelle</span></div>
      <div class="glas-panel liste hr-eingabe2">${wahl('von', 0)}${wahl('bis einschließlich', 1)}</div>
      <div class="leise">Dieselbe Einstellung wie unter Einstellungen › Baustelle. Ein geplantes Ende der Baustelle vor dem Ende der
        Heizperiode kürzt die Hochrechnung.</div>
      <div class="hr-knoepfe"><button class="knopf amber" @click=${() => p.schliessen()}>Speichern</button>
        <button class="knopf leise-k" @click=${() => { H.hp = [10, 4]; p.schliessen(); z(); }}>Oktober bis April</button></div>`; }, { breit: () => false });

  /* ---------- Kachel „Hochrechnung“ (beide Varianten) ---------- */
  R.abschnitt({ ansicht: 'auswertung', vor: p => { const h = daten(p);
    return html`<div class="glas-panel hr-kachel"><small>HOCHRECHNUNG ${R.marke}</small><b>≈ ${de(h.mit_eur)} €</b>
      <span>${h.unten_eur === null ? 'lernt noch' : `${de(h.unten_eur)}–${de(h.oben_eur)} €`} · bis Ende Heizperiode</span></div>`; } });

  /* ---------- Einblendung Klimamittel ---------- */
  R.einblendung('hr-klima', p => html`<div class="block-kopf"><h3>Klimamittel</h3><span class="leise">Monatsmittel außen, °C</span></div>
      <div class="glas-panel liste hr-eingabe">${KLIMA.map((t, i) => html`<label class="feld">${MON[i]}<input inputmode="decimal" .value=${de(t, 1)}></label>`)}</div>
      <div class="leise">Vorgabe: Graz 1991–2020. Für eine andere Baustelle die Werte der nächsten Station von GeoSphere Austria
        (Klimamittel) eintragen. Die Hochrechnung nimmt sie für alle Tage ohne Vorhersage.</div>
      <div class="hr-knoepfe"><button class="knopf amber" @click=${() => p.schliessen()}>Speichern</button>
        <button class="knopf leise-k" @click=${() => p.schliessen()}>Vorgabe Graz</button></div>`, { breit: () => false });

  R.stil(`
.hr-zahl { font-size: 26px; font-weight: 600; margin: 4px 0 6px; } .hr-zahl .leise { font-size: 14px; font-weight: 400; }
.hr-spanne { position: relative; height: 10px; border-radius: 5px; background: rgba(127,127,127,.18); margin: 4px 0 2px; }
.hr-band { position: absolute; top: 0; bottom: 0; border-radius: 5px; background: var(--s1); opacity: .45; }
.hr-mitte { position: absolute; top: -3px; width: 3px; height: 16px; border-radius: 2px; background: var(--s1); }
.hr-skala { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px; gap: 8px; }
.hr-her { margin-top: 6px; } .hr-link { cursor: pointer; color: var(--blau); white-space: nowrap; }
.hr-st { font-size: 12px; white-space: nowrap; } .gruen-t { color: #30d158; }
.hr-wahl, .hr-reiter { margin: 4px 0 8px; flex-wrap: wrap; height: auto; } .hr-wahl button { flex: 1 1 22%; }
.hr-streu { width: 100%; max-width: 520px; height: auto; display: block; margin: 4px auto; }
.hr-streu circle { fill: var(--ink2); opacity: .7; } .hr-streu path { fill: none; stroke: var(--s1); stroke-width: 2.5; }
.hr-streu .hr-achse line { stroke: rgba(127,127,127,.4); } .hr-streu text { font-size: 9px; fill: var(--ink2); text-anchor: middle; }
.hr-streu .hr-grenze { stroke: var(--amber); stroke-dasharray: 3 3; } .hr-streu .hr-gt { text-anchor: start; fill: var(--amber); }
.hr-zeilen { display: flex; flex-direction: column; margin: 6px 0; } .hr-zeile { display: flex; flex-wrap: wrap; gap: 2px 12px; padding: 6px 0; font-size: 13px; border-bottom: 1px solid rgba(127,127,127,.15); }
.hr-zeile > b { flex: 1 1 100%; } .hr-wahl select { width: 100%; }
.hr-monate { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; height: 120px; align-items: end; margin: 6px 0; }
.hr-m { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; font-size: 10px; min-width: 0; }
.hr-m i { width: 70%; border-radius: 3px 3px 0 0; background: rgba(127,127,127,.3); } .hr-m.hp i { background: var(--s2); }
.hr-m b { font-weight: 500; font-size: 9px; } .hr-m span { color: var(--ink2); }
.hr-vh { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0; } .hr-vh .chip { font-size: 12px; padding: 4px 8px; }
.hr-kz { display: flex; gap: 16px; flex-wrap: wrap; } .hr-kz div { display: flex; flex-direction: column; } .hr-kz b { font-size: 18px; } .hr-kz span { font-size: 12px; color: var(--ink2); }
.hr-kachel { display: flex; flex-direction: column; padding: 12px 14px; border-radius: 18px; margin: 0 0 10px; max-width: 260px; }
.hr-kachel small { font-size: 11px; color: var(--ink2); } .hr-kachel b { font-size: 22px; } .hr-kachel span { font-size: 12px; color: var(--ink2); }
.hr-eingabe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 10px; padding: 10px 14px; } .hr-eingabe input { width: 100%; min-width: 0; box-sizing: border-box; }
.hr-knoepfe { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.hr-hp { font-size: 12px; padding: 4px 10px; cursor: pointer; white-space: nowrap; }
.hr-dia { width: 100%; max-width: 540px; height: auto; display: block; margin: 6px auto; }
.hr-dia text { font-size: 9px; fill: var(--ink2); } .hr-dia .hr-yt { text-anchor: end; }
.hr-dia .hr-gitter { stroke: rgba(127,127,127,.18); }
.hr-dia path { fill: none; stroke-width: 2.4; } .hr-dia .hr-ist { stroke: var(--s3); stroke-width: 3; }
.hr-dia .hr-prog { stroke: var(--s1); stroke-dasharray: 6 4; } .hr-dia .hr-ohne { stroke: var(--s2); stroke-dasharray: 2 3; }
.hr-dia .hr-bandf { fill: var(--s1); opacity: .2; stroke: none; }
.hr-dia .hr-heute { stroke: var(--amber); stroke-dasharray: 3 3; } .hr-dia .hr-ht { fill: var(--amber); }
.hr-leg { display: flex; flex-direction: column; gap: 4px; font-size: 13px; margin: 4px 0; } .hr-leg i { display: inline-block; width: 18px; height: 0; margin-right: 6px; vertical-align: middle; border-top: 3px solid; }
.hr-leg .l-ist { border-color: var(--s3); } .hr-leg .l-prog { border-color: var(--s1); border-top-style: dashed; } .hr-leg .l-ohne { border-color: var(--s2); border-top-style: dotted; }
.hr-gesp { margin-top: 2px; }
.hr-eingabe2 { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; } .hr-eingabe2 select { width: 100%; }`);

  /* ---------- Vorführ-Leiste ---------- */
  R.vorfuehren(w => {
    H.lage = w.lage; H.reiter = w.zeigen === 'signatur' ? 'sig' : w.zeigen === 'klima' ? 'klima' : 'hoch';
    for (const q of R.P()) {
      if (!q.d) continue;
      q.s.sheet = null; q.gehe('auswertung');
      if (w.zeigen === 'klimamittel') q.s.sheet = { art: 'hr-klima' };
      if (w.zeigen === 'heizperiode') q.s.sheet = { art: 'hr-hp' };
      q.neuZeichnen();
    }
  });
}

const LAGEN = [['signatur', 'alle mit Signatur'], ['gemischt', 'gemischt'], ['lernt', 'alle lernen noch']];
const ZEIGEN = [['hoch', 'Reiter Hochrechnung'], ['signatur', 'Reiter Signatur'], ['klima', 'Reiter Klima'], ['heizperiode', 'Einblendung Heizperiode'],
  ['klimamittel', 'Einblendung Klimamittel']];
const faelle = [];
for (const l of ['signatur', 'gemischt', 'lernt']) faelle.push({ name: `hoch-${l}`, werte: { lage: l, zeigen: 'hoch' } });
for (const z of ['signatur', 'klima', 'heizperiode', 'klimamittel']) faelle.push({ name: z, werte: { lage: 'signatur', zeigen: z } });
rahmen.bauen({ datei: 'hochrechnung.html', titel: 'Baustelle – Hochrechnung', leiste: 'BSM-033.03 Hochrechnung · Karte „Heizperiode“', browser, faelle,
  auswahl: [{ id: 'lage', t: 'Lage', optionen: LAGEN }, { id: 'zeigen', t: 'zeigen', optionen: ZEIGEN }] });
