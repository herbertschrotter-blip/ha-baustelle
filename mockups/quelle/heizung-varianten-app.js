/* Reiter Heizung in drei Varianten (Herbert 30.09.2026: „sehr unübersichtlich – Fokus auf Hauptteile, Kacheln, Details
   öffnen“). Baut auf glas-app.js auf: die Inhalte der Blöcke kommen unverändert aus App.v_heizung (bisheriger Reiter),
   nur Anordnung und Einstieg ändern sich. Umschalten über die Vorführ-Leiste. */
let HZ_VARIANTE = 'A';
const HZ_TEILE = [
  // Schlüssel, Titel im bisherigen Reiter (zum Herauslösen), Symbol, Kurzname
  ['heute', 'Heute', '🕖', 'Heute'],
  ['wann', 'Wann welche Heizung heizt', '🔥', 'Wann heizt was'],
  ['plan', 'Heizplan · diese Woche', '📅', 'Diese Woche'],
  ['az', 'Arbeitszeit', '👷', 'Arbeitszeit'],
  ['ausn', 'Ausnahmen', '✳️', 'Ausnahmen'],
  ['regeln', 'So wird geheizt', '⚙️', 'Regeln'],
  ['trocknen', '👕 Kleidung trocknen', '👕', 'Kleidung trocknen'],
  ['container', 'Je Container', '🏠', 'Container'],
  ['urlaub', 'Urlaub &amp; Feiertage', '🏖', 'Urlaub & Feiertage'],
];
const hzOrig = App.prototype.v_heizung, hzSheetOrig = App.prototype.sheet, hzKlickOrig = App.prototype.klick;

/* Blöcke des bisherigen Reiters nach ihrem Titel herauslösen */
App.prototype.hzTeile = function () {
  const html = hzOrig.call(this), stuecke = html.split(/(?=<div class="glas-panel block">)/), teile = {};
  for (const [k, titel] of HZ_TEILE) {
    const s = stuecke.find(x => x.includes(`<b>${titel}</b>`));
    teile[k] = s ? s.trim() : '';
  }
  return teile;
};
/* Kurzwerte für Kacheln und Gruppenköpfe */
App.prototype.hzKurz = function () {
  const d = this.d, e = d.e, az = this.azJetzt, C = d.bereiche.filter(b => !b.pumpe);
  const ausn = d.ausnahmen.filter(a => a.datum >= HEUTE).sort((a, b) => a.datum.localeCompare(b.datum));
  const naechsterFt = d.feiertage.find(f => f[0] > HEUTE);
  const modi = MODI.map(([k, t]) => [t, C.filter(b => b.modus === k).length]).filter(x => x[1]);
  const woche = TAGE.map(t => { const p = this.planTag(t); return p ? (p.ende - p.extra) / 60 : 0; });
  const L = this.last(), hkAn = L.laufen;
  return {
    heute: this.statusText(),
    wann: `${hkAn} von ${L.hk.length} Heizkörpern an`,
    plan: `${woche.filter(Boolean).length} Heiztage · ${de(woche.reduce((a, v) => a + v, 0), 0)} h`, woche,
    az: `${az.name}`, az2: `Mo–Do ${az.tage.Mo ? az.tage.Mo.join('–') : 'frei'} · Fr ${az.tage.Fr ? az.tage.Fr.join('–') : 'frei'}`,
    ausn: ausn.length ? `${ausn.length} geplant` : 'keine', ausn2: ausn.length ? `nächste ${wtag(ausn[0].datum)} ${kurzDatum(ausn[0].datum)}` : 'Samstag, länger, frei …',
    regeln: `Soll ${de(e.soll, 0)} °C`, regeln2: `vor ${e.vorheizen} · nach ${e.nachheizen} min · Grenze ${de(e.grenze, 0)} °C`,
    frost: e.frost ? `Frost ${de(e.frost_temp, 0)}–${de(e.frost_aus, 0)} °C` : 'Frostschutz aus',
    trocknen: `ab ${de(e.tr_mm, 0)} mm`, trocknen2: `+${e.tr_laenger} min · früher ${e.tr_frueher} min`,
    container: `${C.length} Container`, container2: modi.map(([t, n]) => `${n} ${t}`).join(' · '),
    urlaub: this.d.urlaube.length ? `${this.d.urlaube.length} Urlaub` : 'kein Urlaub', urlaub2: naechsterFt ? `Feiertag ${wtag(naechsterFt[0])} ${kurzDatum(naechsterFt[0])}` : '',
  };
};
/* Heute als große Karte: Status, Zeitstrahl, greifende Regeln als Chips */
App.prototype.hzHeld = function (klickbar) {
  const p = this.planTag(HEUTE_TAG), e = this.d.e, k = this.hzKurz();
  const chips = [p ? `🕖 ${uhr(p.a)}–${uhr(p.b)}` : '🕖 frei', `🌡 Grenze ${de(e.grenze, 0)}° · heizt`, '🌧 trocknen +45 min', e.fruehstart ? '❄ Frühstart morgen' : '', e.staffel ? `⚡ ${this.last().warten} wartet` : '']
    .filter(Boolean).map(c => `<span class="hz-chip">${c}</span>`).join('');
  return `<div class="glas-panel hz-held ${klickbar ? 'klickbar' : ''}" ${klickbar ? 'data-act="hz-auf" data-k="heute"' : ''}>
    <div class="hz-held-kopf"><div><div class="glas-klein">HEUTE · ${HEUTE_TAG} ${kurzDatum(HEUTE)}</div><div class="hz-status">${k.heute}</div></div>${klickbar ? '<span class="chev">›</span>' : ''}</div>
    <div class="tl">${this.zeitstrahl(p, true)}<div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div></div>
    <div class="hz-chips">${chips}</div></div>`;
};
const hzKachel = (k, sym, titel, wert, unter, extra = '') => `<button class="glas-panel hz-kachel" data-act="hz-auf" data-k="${k}">
  <span class="hz-k-kopf"><span class="hz-sym">${sym}</span><span class="chev">›</span></span>
  <span class="hz-k-titel">${titel}</span><b class="hz-k-wert">${wert}</b>${extra}<span class="leise hz-k-unter">${unter || ''}</span></button>`;

App.prototype.v_heizung = function () {
  const kopf = this.kopf('Heizung', 'ÖWG DOBL ZWARING', `<div>${schalter(this.s.auto, 'auto')}</div>`), k = this.hzKurz(), T = this.hzTeile();
  const mini = `<span class="hz-mini">${k.woche.map((h, i) => `<i style="height:${Math.max(3, h / 12 * 100)}%" class="${TAGE[i] === HEUTE_TAG ? 'heute' : ''}"></i>`).join('')}</span>`;
  if (HZ_VARIANTE === 'A') return `${kopf}${this.hzHeld(true)}
    <div class="hz-raster">
      ${hzKachel('plan', '📅', 'Diese Woche', k.plan, 'Heizplan aus Arbeitszeit und Wetter', mini)}
      ${hzKachel('wann', '🔥', 'Wann heizt was', k.wann, 'gemessen je Heizkörper')}
      ${hzKachel('container', '🏠', 'Container', k.container, k.container2)}
      ${hzKachel('az', '👷', 'Arbeitszeit', esc(k.az), k.az2)}
      ${hzKachel('ausn', '✳️', 'Ausnahmen', k.ausn, k.ausn2)}
      ${hzKachel('regeln', '⚙️', 'Regeln', k.regeln, `${k.regeln2} · ${k.frost}`)}
      ${hzKachel('trocknen', '👕', 'Kleidung trocknen', k.trocknen, k.trocknen2)}
      ${hzKachel('urlaub', '🏖', 'Urlaub & Feiertage', k.urlaub, k.urlaub2)}
    </div>
    <div class="leise hz-fuss">Variante A · Kacheln: Tippen öffnet die Details von unten.</div>`;
  if (HZ_VARIANTE === 'B') {
    const offen = this.s.hzGruppe ?? null;
    const gruppe = (id, sym, titel, kurz, inhalt) => `<div class="glas-panel hz-gruppe ${offen === id ? 'offen' : ''}">
      <button class="hz-g-kopf" data-act="hz-gruppe" data-k="${id}"><span class="hz-sym">${sym}</span><span class="hz-g-t"><b>${titel}</b><span class="leise">${kurz}</span></span><span class="chev">${offen === id ? '⌄' : '›'}</span></button>
      ${offen === id ? `<div class="hz-g-inhalt">${inhalt}</div>` : ''}</div>`;
    const ohneRahmen = h => h.replace('class="glas-panel block"', 'class="block hz-innen"');
    return `${kopf}${this.hzHeld(false)}
      ${ohneRahmen(T.wann)}
      ${gruppe('plan', '📅', 'Plan und Zeiten', `${k.plan} · ${esc(k.az)} · Ausnahmen: ${k.ausn}`, [T.plan, T.az, T.ausn].map(ohneRahmen).join(''))}
      ${gruppe('container', '🏠', 'Container', `${k.container} · ${k.container2}`, ohneRahmen(T.container))}
      ${gruppe('regeln', '⚙️', 'Regeln', `${k.regeln} · ${k.frost} · trocknen ${k.trocknen}`, [T.regeln, T.trocknen].map(ohneRahmen).join(''))}
      ${gruppe('urlaub', '🏖', 'Urlaub & Feiertage', `${k.urlaub} · ${k.urlaub2}`, ohneRahmen(T.urlaub))}
      <div class="leise hz-fuss">Variante B · Heute im Fokus, der Rest aufklappbar (immer nur eine Gruppe offen).</div>`;
  }
  const seg = this.s.hzSeg || 'jetzt';
  const seiten = {
    jetzt: `${this.hzHeld(false)}<div class="hz-zwei">${T.heute}${T.container}</div>${T.wann}`,
    plan: `<div class="hz-zwei">${T.plan}<div>${T.az}${T.ausn}</div></div>${T.urlaub}`,
    regeln: `<div class="hz-zwei">${T.regeln}${T.trocknen}</div>`,
  };
  return `${kopf}<div class="seg glas-panel hz-seg">${[['jetzt', 'Jetzt'], ['plan', 'Plan'], ['regeln', 'Regeln']].map(([x, t]) => `<button data-act="hz-seg" data-v="${x}" class="${seg === x ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${seiten[seg]}<div class="leise hz-fuss">Variante C · drei Bereiche: was jetzt passiert, wann geheizt wird, nach welchen Regeln.</div>`;
};
/* Details als Einblendung (Variante A) */
App.prototype.sheet = function () {
  const s = this.s.sheet;
  if (s && s.art === 'hz') {
    const T = this.hzTeile(), def = HZ_TEILE.find(x => x[0] === s.k) || HZ_TEILE[0];
    const inhalt = s.k === 'heute' ? T.heute + T.wann : s.k === 'az' ? T.az + T.ausn : T[s.k];
    return `<div class="griff"></div><div class="block-kopf"><h3>${def[2]} ${def[3]}</h3></div>
      ${inhalt.replace(/class="glas-panel block"/g, 'class="block hz-innen"')}<button class="knopf leise-k" data-act="zu">Schließen</button>`;
  }
  return hzSheetOrig.call(this);
};
App.prototype.klick = function (ev) {
  const el = ev.target && ev.target.closest && ev.target.closest('[data-act]');
  const a = el && el.dataset.act;
  if (a === 'hz-auf') { this.s.sheet = { art: 'hz', k: el.dataset.k }; return this.render(); }
  if (a === 'hz-gruppe') { this.s.hzGruppe = this.s.hzGruppe === el.dataset.k ? null : el.dataset.k; return this.render(); }
  if (a === 'hz-seg') { this.s.hzSeg = el.dataset.v; return this.render(); }
  return hzKlickOrig.call(this, ev);
};
for (const app of APPS) { app.s.view = 'heizung'; app.render(true); }
const hzWahl = document.getElementById('hz-variante');
if (hzWahl) hzWahl.onchange = () => { HZ_VARIANTE = hzWahl.value; for (const app of APPS) { app.s.sheet = null; app.s.view = 'heizung'; app.render(true); } };
