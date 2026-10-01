// AN-0004: Vorschlag „Warm ab“ für lernende Container (Optimum Start) auf Basis des Master-Mockups.
// Baut mockups/warm-ab.html: node mockups/quelle/warm-ab.js
// Ändert nur die Anzeige (Heizung › So wird geheizt, Heute, Container, Lernstand, Bearbeiten); Werte im Beispiel erfunden.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const CSS = `
.wa-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 6px; vertical-align: middle; }
.wa-alt { opacity: .55; }
.wa-tab { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 10px; align-items: center; margin: 4px 0 8px; }
.wa-tab > b { font-size: 12px; color: var(--ink2); font-weight: 500; } .wa-tab > div b { font-size: 15px; } .wa-tab > div .leise { display: block; font-size: 11px; }
.wa-heute { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 14px; background: rgba(255,159,10,.12); margin: 6px 0; font-size: 13px; }
.wa-heute b { font-size: 15px; }
`;

const SKRIPT = `
/* ================= AN-0004: „Warm ab“ für lernende Container (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { bauen: p.bauen, bloecke: p.heizungBloecke, sheet: p.sheet, regel: p.cRegelText, klick: p.klick, aufbauen: p._aufbauen, teile: p.containerTeile };
  const NEU = '<span class="wa-neu">neu</span>';
  p._aufbauen = function () { const erst = !this.root; alt.aufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS)}; this.shadowRoot.appendChild(s); } };
  /* Beispiel: Poliercontainer lernt, Werte erfunden */
  const WA = { vor: 15, nach: 0, max: 120, eigen: {} };
  p.bauen = function (r) {
    const d = alt.bauen.call(this, r);
    d.e.warm_vor = WA.vor; d.e.warm_nach = WA.nach; d.e.warm_max = WA.max;
    for (const b of d.bereiche) if (b.fuehler && !b.pumpe && (b.id === 'polier' || b.id === 'mannschaft')) {
      b.modus = 'thermo';
      b.lern = { an: true, zyklen: b.id === 'polier' ? 24 : 2, zyklus_min: 10, anteil: 40, erwartet: .6, aus_bei: 19.4,
        kint: { wert: .52, start: .6, fort: .48 }, kext: { wert: .012, start: .01, fort: .3 }, nachlauf: { 'oel|lang|kalt': { grad: .8, min: 14, n: 7 } }, treffer: [.2, -.1, .3, .1],
        aufheizen: b.id === 'polier' ? { kalt: { rate: 3.2, n: 6 }, mild: { rate: 4.1, n: 9 } } : { kalt: null, mild: { rate: 2.2, n: 1 } } };
      b.warm = WA.eigen[b.id] || {};
    }
    return d;
  };
  /* Rechnung des Vorschlags (später in logik/): Start = Arbeitsbeginn − warm ab − (Soll − innen) / Aufheizrate */
  p.waPlan = function (b) {
    const d = this.d, pl = this.planTag(this.z.HEUTE_TAG), l = b.lern, soll = b.soll ?? d.e.soll; if (!pl || !l || !l.an) return null;
    const vor = b.warm.vor ?? d.e.warm_vor, nach = b.warm.nach ?? d.e.warm_nach, bd = 'kalt', a = l.aufheizen[bd] && l.aufheizen[bd].n >= 3 ? l.aufheizen[bd] : null;
    const innen = b.id === 'polier' ? 16.4 : 15.0, ziel = pl.a - vor;
    if (!a) return { gelernt: false, ziel, vor, nach, start: pl.vor - (pl.vor - pl.extra), innen, soll };
    const roh = Math.ceil(Math.max(0, soll - innen) / a.rate * 60 / 5) * 5, dauer = Math.min(roh, d.e.warm_max - vor);
    return { gelernt: true, rate: a.rate, n: a.n, ziel, vor, nach, dauer, gekappt: roh > dauer, start: ziel - dauer, ende: pl.b + nach, innen, soll };
  };
  const uhr2 = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0');
  p.heizungBloecke = function () {
    let h = alt.bloecke.call(this); const e = this.d.e, st = (k, s, f) => '<span class="stepper"><button data-act="wa-st" data-k="' + k + '" data-d="' + (-s) + '">−</button><b>' + f(e[k]) + '</b><button data-act="wa-st" data-k="' + k + '" data-d="' + s + '">+</button></span>';
    const lernend = this.d.bereiche.filter(b => b.lern && b.lern.an);
    const block = '<div class="zeile"><div><b>🧠 Lernende Container' + NEU + '</b><div class="leise">heizen selbst so früh, dass das Soll rechtzeitig erreicht ist – statt Vorheizen, Kälte-Frühstart und Nachheizen. Bis genug gelernt ist, gelten die Werte oben.' + (lernend.length ? ' Jetzt: ' + lernend.map(b => esc(b.name)).join(', ') + '.' : '') + '</div></div></div>'
      + '<div class="zeile unter"><div><span>Soll erreicht</span><div class="leise">vor Arbeitsbeginn, z. B. zum Umziehen</div></div>' + st('warm_vor', 5, v => v ? v + ' min vorher' : 'bei Beginn') + '</div>'
      + '<div class="zeile unter"><div><span>Warm halten</span><div class="leise">nach Arbeitsende; Kleidung trocknen kommt dazu</div></div>' + st('warm_nach', 5, v => v ? v + ' min länger' : 'bis Ende') + '</div>'
      + '<div class="zeile unter"><div><span>Frühestens</span><div class="leise">vor Arbeitsbeginn – Grenze, falls der Raum sehr kalt ist</div></div>' + st('warm_max', 15, v => v + ' min vorher') + '</div>';
    h = h.replace(/(<div class="zeile"><div><b>Vorheizen<\\/b><div class="leise">)vor Arbeitsbeginn, damit es warm ist/, '$1vor Arbeitsbeginn, damit es warm ist · <i>nicht für lernende Container</i>');
    h = h.replace(/(<div class="zeile"><div><b>Nachheizen<\\/b><div class="leise">)nach Arbeitsende, jeden Tag/, '$1nach Arbeitsende, jeden Tag · <i>nicht für lernende Container</i>');
    h = h.replace(/(<div class="zeile"><div><b>Kälte-Frühstart<\\/b><div class="leise">)/, '$1<i>nicht für lernende Container</i> · ');
    const i = h.indexOf('<div class="zeile"><div><b>⚡ Schnell aufheizen</b>'); if (i > 0) h = h.slice(0, i) + block + h.slice(i);
    /* Heute: je lernendem Container der gelernte Beginn */
    const heute = lernend.map(b => { const w = this.waPlan(b); return !w ? '' : '<div class="zeile unter"><span class="leise">🧠 <b>' + esc(b.name) + '</b>: ' + (w.gelernt
      ? 'heizt ab ' + uhr2(w.start) + ', damit um ' + uhr2(w.ziel) + ' ' + de(w.soll) + ' °C (jetzt ' + de(w.innen) + ' °C, ' + de(w.rate) + ' °C/h gelernt' + (w.gekappt ? ', begrenzt' : '') + ') · warm bis ' + uhr2(w.ende)
      : 'lernt noch (' + (b.lern.aufheizen.kalt ? b.lern.aufheizen.kalt.n : 0) + '/3 Aufheizungen bei Kälte) – bis dahin Vorheizen und Kälte-Frühstart') + NEU + '</span></div>'; }).join('');
    const j = h.indexOf('<div class="zeile unter hz-rechnung">'); if (j > 0) { const k = h.indexOf('</div></div>', j) + 12; h = h.slice(0, k) + heute + h.slice(k); }
    return h;
  };
  p.cRegelText = function (b) {
    const t = alt.regel.call(this, b), w = b.lern && b.lern.an && this.waPlan(b);
    return w ? t + (w.gelernt ? ' · heute ab ' + uhr2(w.start) + ' → ' + de(w.soll) + ' °C um ' + uhr2(w.ziel) : ' · Aufheizen lernt noch') : t;
  };
  p.sheet = function () {
    let h = alt.sheet.call(this); const s = this.s.sheet, b = this.b;
    if (s && s.art === 'lernen' && b && b.lern) {
      const a = b.lern.aufheizen, w = this.waPlan(b), z = x => x ? '<div><b>' + de(x.rate) + ' °C/h</b><span class="leise">' + x.n + '× gemessen' + (x.n < 3 ? ' · noch zu wenig' : '') + '</span></div>' : '<div><span class="leise">noch nicht gelernt</span></div>';
      const teil = '<div class="gruppe-t">Aufheizen' + NEU + '</div><div class="wa-tab"><b></b><b>kalt < 5 °C</b><b>mild</b><span>wie schnell es warm wird</span>' + z(a.kalt) + z(a.mild) + '</div>'
        + (w && w.gelernt ? '<div class="wa-heute">⏰<div>Heute ab <b>' + uhr2(w.start) + '</b> – ' + w.dauer + ' min für ' + de(w.innen) + ' → ' + de(w.soll) + ' °C, warm um <b>' + uhr2(w.ziel) + '</b> (' + (w.vor ? w.vor + ' min vor Arbeitsbeginn' : 'bei Arbeitsbeginn') + ')</div></div>' : '<div class="leise">Ab 3 Aufheizungen je Wetter rechnet der Container den Beginn selbst; bis dahin gelten Vorheizen und Kälte-Frühstart.</div>')
        + '<div class="leise">Gemessen wird jedes Aufheizen von mindestens 1 °C unter dem Soll, solange der Heizkörper durchgehend läuft. Kälte draußen steckt in der Rate – darum braucht es keinen eigenen Kälte-Frühstart.</div>';
      const i = h.indexOf('<div class="block-kopf"><div class="gruppe-t">Nachlauf'); if (i > 0) h = h.slice(0, i) + teil + h.slice(i);
    }
    if (s && s.art === 'bereich' && b && b.lern && b.lern.an) {
      const e = this.d.e, wv = b.warm.vor, wn = b.warm.nach, st = (k, v, def, f) => '<span class="stepper klein"><button data-act="wa-eigen" data-k="' + k + '" data-d="-5">−</button><b class="' + (v !== undefined ? 'eigen' : '') + '">' + f(v ?? def) + '</b><button data-act="wa-eigen" data-k="' + k + '" data-d="5">+</button></span>';
      const teil = '<div class="gruppe-t">🧠 Warm ab' + NEU + '</div><div class="zeile"><div><span>Soll erreicht</span><div class="leise">' + (wv === undefined ? 'wie die Baustelle' : 'eigener Wert') + '</div></div>' + st('vor', wv, e.warm_vor, v => v ? v + ' min vorher' : 'bei Beginn') + '</div>'
        + '<div class="zeile"><div><span>Warm halten</span><div class="leise">' + (wn === undefined ? 'wie die Baustelle' : 'eigener Wert') + '</div></div>' + st('nach', wn, e.warm_nach, v => v ? v + ' min länger' : 'bis Ende') + '</div>'
        + (wv !== undefined || wn !== undefined ? '<button class="zeile" data-act="wa-zurueck"><span class="blau">Wie die Baustelle</span></button>' : '');
      const i = h.indexOf('<label class="feld">Temperaturfühler'); if (i > 0) h = h.slice(0, i) + teil + h.slice(i);
    }
    return h;
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    if (a === 'wa-st') { const k = el.dataset.k.slice(5); WA[k] = Math.max(k === 'max' ? 30 : 0, Math.min(k === 'max' ? 360 : 120, WA[k] + +el.dataset.d)); this.alle = (this.roh || []).map(r => this.bauen(r)); this.d = this.alle.find(x => x.entry === this.d.entry) || this.alle[0]; return this.render(); }
    if (a === 'wa-eigen') { const b = this.b, x = WA.eigen[b.id] ||= {}, k = el.dataset.k; x[k] = Math.max(0, Math.min(120, (x[k] ?? this.d.e['warm_' + k]) + +el.dataset.d)); b.warm = x; return this.render(); }
    if (a === 'wa-zurueck') { delete WA.eigen[this.b.id]; this.b.warm = {}; return this.render(); }
    return alt.klick.call(this, ev);
  };
})();
`;

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Warm ab (AN-0004)</title>');
ersetze('<b>Baustelle · Master-Mockup · Seite', '<b>AN-0004 „Warm ab“ für lernende Container · Vorschlag auf Seite');
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
for (const p of P) { p.s.view = 'heizung'; p.render(true); }`);
fs.writeFileSync(path.join(repo, 'mockups', 'warm-ab.html'), html);
console.log(`mockups/warm-ab.html gebaut (${Math.round(html.length / 1024)} KB)`);
