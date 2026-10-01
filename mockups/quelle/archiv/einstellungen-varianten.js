// WU-0007: vier Varianten der Einstellungen auf Basis des Master-Mockups (echte Seite + Beispieldaten).
// Baut mockups/einstellungen-varianten.html: node mockups/quelle/einstellungen-varianten.js
// Überschreibt nur v_einst (und hängt eigenes CSS in die Seite); alle Regler sind die echten der Seite.
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const CSS_EV = `
.ev-sl { display: grid; grid-template-columns: 230px 1fr; gap: 14px; align-items: start; }
.ev-nav { position: sticky; top: 8px; display: flex; flex-direction: column; gap: 2px; padding: 8px; border-radius: 18px; }
.ev-nav button { display: grid; grid-template-columns: 30px 1fr; align-items: center; gap: 2px 8px; text-align: left; font: inherit; color: inherit; background: none; border: 0; border-radius: 12px; padding: 8px 10px; cursor: pointer; }
.ev-nav button small { grid-column: 2; font-size: 11px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-nav button .ev-ic, .ev-kachel .ev-ic, .ev-li .ev-ic { grid-row: 1 / 3; font-size: 18px; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: rgba(127,127,127,.16); }
.ev-nav button:hover { background: rgba(127,127,127,.12); } .ev-nav button.on { background: rgba(127,127,127,.22); font-weight: 600; }
.ev-nav .ev-trenn { height: 1px; background: rgba(127,127,127,.25); margin: 6px 8px; }
.ev-inhalt > * + * { margin-top: 12px; }
.ev-titel { display: flex; align-items: center; gap: 10px; margin: 2px 4px 10px; } .ev-titel b { font-size: 20px; } .ev-titel .leise { font-size: 12px; }
.ev-chips { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 10px; scrollbar-width: none; } .ev-chips button { flex: 0 0 auto; }
.ev-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.ev-kachel { display: grid; grid-template-columns: 34px 1fr; gap: 2px 10px; align-items: center; text-align: left; font: inherit; color: inherit; border: 0; border-radius: 18px; padding: 14px; cursor: pointer; min-height: 78px; }
.ev-kachel b { font-size: 14.5px; } .ev-kachel small { grid-column: 2; font-size: 11.5px; color: var(--ink2); }
.ev-kachel .ev-ic { width: 34px; height: 34px; font-size: 19px; }
.ev-kachel.dev { opacity: .85; }
.ev-suche { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 16px; margin-bottom: 10px; }
.ev-suche input { flex: 1; font: inherit; font-size: 15px; color: inherit; background: none; border: 0; outline: none; }
.ev-sprung { position: sticky; top: 0; z-index: 3; padding: 6px 0 8px; }
.ev-abschnitt { scroll-margin-top: 60px; } .ev-abschnitt > h3 { display: flex; align-items: center; gap: 8px; margin: 18px 4px 8px; font-size: 16px; }
.ev-leer { display: none; padding: 20px; text-align: center; color: var(--ink2); }
.ev-li { display: grid; grid-template-columns: 30px 1fr auto 18px; align-items: center; gap: 2px 10px; width: 100%; text-align: left; font: inherit; color: inherit; background: none; border: 0; padding: 10px 14px; cursor: pointer; }
.ev-li + .ev-li, .ev-li + .ev-auf + .ev-li { border-top: 1px solid rgba(127,127,127,.18); }
.ev-li small { grid-column: 2; font-size: 11.5px; color: var(--ink2); } .ev-li .ev-wert { grid-row: 1 / 3; grid-column: 3; font-size: 12px; color: var(--ink2); }
.ev-li .ev-pf { grid-row: 1 / 3; grid-column: 4; color: var(--ink2); transition: transform .2s; } .ev-li.offen .ev-pf { transform: rotate(90deg); }
.ev-auf { padding: 4px 10px 12px; } .ev-auf > * + * { margin-top: 10px; }
.ev-gruppe-t { margin: 14px 18px 6px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--ink2); }
.ev-liste { border-radius: 18px; overflow: hidden; padding: 0; }
.ev-dev-reiter { margin-bottom: 10px; }
.ev-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 6px; vertical-align: middle; }
@media (max-width: 700px) { .ev-sl { grid-template-columns: 1fr; } .ev-nav { display: none; } }
.schmal .ev-sl { grid-template-columns: 1fr; } .schmal .ev-nav { display: none; }
`;

const EV = `
/* ================= WU-0007: Einstellungen in vier Varianten (Vorführ-Leiste „Einstellungen“) ================= */
let EV_VAR = '1';
(() => {
  const K = customElements.get('baustelle-panel'), proto = K.prototype, altEinst = proto.v_einst, altKlick = proto.klick, altEingabe = proto.eingabe, altAufbauen = proto._aufbauen;
  proto._aufbauen = function () { const erst = !this.root; altAufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS_EV)}; this.shadowRoot.appendChild(s); } };
  /* Blöcke der heutigen Einstellungen nach Überschrift */
  proto.evAlt = function () {
    const h = altEinst.call(this), teile = {};
    for (const x of h.split('<div class="glas-panel liste">').slice(1)) { const t = (x.match(/<div class="gruppe">([^<]*)<\\/div>/) || [])[1]; if (t) teile[t] = '<div class="glas-panel liste">' + x; }
    return teile;
  };
  proto.evGruppen = function () {
    const d = this.d, e = d.e, o = d.optionen, alt = this.evAlt(), hz = this.hzTeile(), st = (k, s, fmt) => this.stepper(k, s, fmt), M = this.meldungen();
    const neu = '<span class="ev-neu">neu hier</span>', zeile = (t, x, sub = '') => '<div class="zeile"><div><b>' + t + '</b>' + (sub ? '<div class="leise">' + sub + '</div>' : '') + '</div>' + x + '</div>';
    const knopf = (t, wert, act, extra = '') => '<button class="zeile" data-act="' + act + '" ' + extra + '><span>' + t + '</span><span class="leise">' + wert + ' ›</span></button>';
    const liste = (titel, inhalt) => '<div class="glas-panel liste"><div class="gruppe">' + titel + '</div>' + inhalt + '</div>';
    const n = arr => arr.length, pumpen = d.bereiche.filter(b => b.pumpe), cont = d.bereiche.filter(b => !b.pumpe), geraete = d.bereiche.reduce((a, b) => a + b.geraete.length, 0);
    const mAn = ['m_offline', 'm_trocken', 'm_dauer', 'm_zyklen', 'm_leistung', 'm_frost', 'm_kalt', 'm_fuehler', 'm_wetter', 'm_hand'].filter(k => e[k]).length;
    const offen = M === null ? '–' : M.filter(m => this.meldungOffen(m)).length;
    const nm = x => x ? esc(this.name(x)) : '–';
    const wk = liste('Wetter und Kalender', knopf('Wetter', o.wetter ? nm(o.wetter) : 'keins gewählt', 'sheet', 'data-s="wetterquelle"')
      + knopf('Außentemperatur', o.temp_sensor ? nm(o.temp_sensor) : 'aus der Vorhersage', 'sheet', 'data-s="wetterquelle"')
      + knopf('Regenmenge' + neu, o.regen_sensor ? nm(o.regen_sensor) : 'aus der Vorhersage', 'sheet', 'data-s="wetterquelle"')
      + knopf('Urlaub', o.urlaub_kalender ? 'Kalender „' + nm(o.urlaub_kalender) + '“' : 'kein Kalender', 'sheet', 'data-s="wetterquelle"')
      + knopf('Feiertage' + neu, o.feiertag_kalender ? nm(o.feiertag_kalender) : 'kein Kalender', 'sheet', 'data-s="wetterquelle"')
      + knopf('Termine (Bei Bedarf)' + neu, o.termine_kalender || e.termine_kalender ? nm(o.termine_kalender || e.termine_kalender) : 'kein Kalender', 'sheet', 'data-s="wetterquelle"'));
    const G = [
      { k: 'baustelle', ic: '🏗', t: 'Baustelle', kurz: esc(d.titel) + ' · ' + this.bsZeit(d), html: (alt['Baustelle'] || '') + wk },
      { k: 'heizung', ic: '🔥', t: 'Heizung', kurz: 'Automatik ' + (e.auto ? 'an' : 'aus') + ' · Soll ' + de(e.soll) + ' °C · Vorheizen ' + e.vorheizen + ' min',
        html: liste('Automatik', zeile('Automatik', schalter(e.auto, 'auto'), 'die Integration schaltet die Heizungen nach Plan und Regeln'))
          + (hz.regeln || '') + (hz.trocknen || '') + (hz.urlaub || '')
          + liste('Zeiten', knopf('Arbeitszeit', 'ändern, neue ab Datum', 'hz-auf', 'data-k="az"') + knopf('Ausnahmen', 'einmalig', 'hz-auf', 'data-k="ausn"') + knopf('Heizplan · diese Woche', 'ansehen', 'hz-auf', 'data-k="plan"')) },
      { k: 'container', ic: '🏠', t: 'Container & Geräte', kurz: n(cont) + ' Container · ' + n(pumpen) + ' Schacht · ' + geraete + ' Geräte', html: (alt['Container und Geräte'] || '') + (hz.container || '') },
      { k: 'pumpen', ic: '💧', t: 'Pumpen', kurz: n(pumpen) ? 'Offline nach ' + e.offline_min + ' min · Trockenlauf unter ' + e.trocken_w + ' W' : 'keine Schächte',
        html: liste('Überwachung der Pumpen' + neu, zeile('Offline – melden nach', st('offline_min', 1, v => v + ' min')) + zeile('Trockenlauf unter', st('trocken_w', 5, v => v + ' W'))
          + zeile('Dauerlauf länger als', st('dauer_min', 5, v => v + ' min')) + zeile('Schaltet oft ab', st('zyklen_h', 1, v => v + ' / h'))
          + pumpen.map(b => zeile('♨ Automatik · ' + esc(b.name), schalter(b.auto, 'b-auto', 'data-id="' + b.id + '"'))).join('')) },
      { k: 'strom', ic: '⚡', t: 'Strom & Staffelung', kurz: de(e.preis, 2) + ' €/kWh · Staffelung ' + (e.staffel ? 'an' : 'aus'), html: alt['Strom'] || '' },
      { k: 'firmen', ic: '🏢', t: 'Firmen', kurz: n(d.firmen) + ' Firmen für die Abrechnung', html: alt['Firmen · für die Abrechnung'] || '' },
      { k: 'meldungen', ic: '🔔', t: 'Meldungen', kurz: mAn + ' von 10 an · ' + esc(e.empfaenger || ''),
        html: (alt['Meldungen · Störungen'] || '') + liste('Schwellen der Hinweise' + neu, zeile('Zu kalt trotz Heizung nach', st('kalt_min', 15, v => v + ' min')) + zeile('Handbetrieb länger als', st('hand_h', 1, v => v + ' h'))
          + zeile('Tür offen – Nachricht nach', st('tuer_melden', 5, v => v + ' min'))) },
      { k: 'bericht', ic: '📊', t: 'Bericht', kurz: { aus: 'aus', woche: 'jede Woche', monat: 'jeden Monat', beides: 'Woche und Monat' }[e.bericht] || e.bericht, html: alt['Bericht'] || '' },
      { k: 'app', ic: '🖥', t: 'Ansicht', kurz: 'Erklärungen ' + (e.erklaer ? 'an' : 'aus') + ' · Melden-Knopf ' + (e.melden ? 'an' : 'aus'),
        html: liste('Ansicht', zeile('Erklärungen anzeigen', schalter(e.erklaer, 'e-bool', 'data-k="erklaer"'), 'kurze Texte „ⓘ“ unter Heizung, Pumpen und Auswertung')
          + zeile('Melden-Knopf', schalter(e.melden, 'e-bool', 'data-k="melden"'), 'kleiner Knopf in jedem Fenster für Fehler, Wünsche und Anregungen')
          + '<button class="zeile" data-act="aw-vorlage" data-v="misch"><span>Auswertung auf Vorschlag zurücksetzen' + neu + '</span><span class="leise">gilt für diesen Browser</span></button>') },
      { k: 'dev', ic: '🛠', t: 'Entwicklung', kurz: offen + ' offene Meldungen · Diagnose', dev: true,
        html: '<div class="seg ev-dev-reiter">' + [['meldungen', 'Meldungen'], ['werkzeuge', 'Werkzeuge']].map(([k, t]) => '<button data-act="ev-dev" data-v="' + k + '" class="' + ((this.s.evDev || 'meldungen') === k ? 'on' : '') + '">' + t + '</button>').join('') + '</div>'
          + (() => { const h = this.v_dev(), i = h.indexOf('<div class="glas-panel block">'), j = h.indexOf('<div class="glas-panel liste"><div class="gruppe">Werkzeuge');
            return (this.s.evDev || 'meldungen') === 'meldungen' ? h.slice(i, j) : h.slice(j).replace('<div class="zeile"><span>Melden-Knopf in jedem Fenster</span>', '<div class="zeile" style="display:none"><span>') + liste('Für Tests' + neu, '<button class="zeile" data-act="test-meldung"><span class="blau">Test-Nachricht senden</span></button><button class="zeile" data-act="sheet" data-s="nachrichten"><span>Beispiel-Nachrichten</span><span class="chev">›</span></button>'); })() },
      { k: 'ueber', ic: 'ℹ', t: 'Über', kurz: 'Version ' + esc(this.version), html: this.v_ueber().replace(/^[\\s\\S]*?(<div class="glas-panel)/, '$1') },
    ];
    return G;
  };
  const titel = g => '<div class="ev-titel"><span class="ev-ic">' + g.ic + '</span><div><b>' + g.t + '</b><div class="leise">' + g.kurz + '</div></div></div>';
  proto.v_einst = function () {
    const G = this.evGruppen(), wahl = G.find(g => g.k === this.s.evGruppe), kopf = this.kopf('Einstellungen', esc(this.d.titel));
    if (EV_VAR === '1') {   // Seitenleiste
      const g = wahl || G[0], schmal = this.narrow;
      const nav = '<nav class="ev-nav glas-panel">' + G.map((x, i) => (x.dev ? '<div class="ev-trenn"></div>' : '') + '<button data-act="ev-gruppe" data-v="' + x.k + '" class="' + (x === g ? 'on' : '') + '"><span class="ev-ic">' + x.ic + '</span><span>' + x.t + '</span><small>' + x.kurz + '</small></button>').join('') + '</nav>';
      const chips = '<div class="ev-chips">' + G.map(x => '<button class="glas-panel chip ' + (x === g ? 'amber' : '') + '" data-act="ev-gruppe" data-v="' + x.k + '">' + x.ic + ' ' + x.t + '</button>').join('') + '</div>';
      return kopf + '<div class="' + (schmal ? 'schmal' : '') + '">' + (schmal ? chips : '') + '<div class="ev-sl">' + nav + '<div class="ev-inhalt">' + titel(g) + g.html + '</div></div></div>';
    }
    if (EV_VAR === '2') {   // Kacheln → Unterseite
      if (wahl) return '<div class="zurueck-zeile"><button class="glas-panel chip" data-act="ev-gruppe" data-v="">‹ Einstellungen</button></div>' + titel(wahl) + '<div class="ev-inhalt">' + wahl.html + '</div>';
      return kopf + '<div class="ev-raster">' + G.map(x => '<button class="glas-panel ev-kachel ' + (x.dev ? 'dev' : '') + '" data-act="ev-gruppe" data-v="' + x.k + '"><span class="ev-ic">' + x.ic + '</span><b>' + x.t + '</b><small>' + x.kurz + '</small></button>').join('') + '</div>';
    }
    if (EV_VAR === '3') {   // eine Seite mit Suche und Sprungmarken
      return kopf + '<label class="ev-suche glas-panel">🔍<input type="search" data-evs placeholder="Einstellung suchen, z. B. Frost, Preis, Bericht" value="' + esc(this.s.evSuche || '') + '"></label>'
        + '<div class="ev-sprung"><div class="ev-chips">' + G.map(x => '<button class="glas-panel chip" data-act="ev-sprung" data-v="' + x.k + '">' + x.ic + ' ' + x.t + '</button>').join('') + '</div></div>'
        + G.map(x => '<section class="ev-abschnitt" data-evg="' + x.k + '"><h3><span>' + x.ic + '</span>' + x.t + '</h3><div class="ev-inhalt">' + x.html + '</div></section>').join('')
        + '<div class="ev-leer glas-panel">Nichts gefunden</div>';
    }
    /* 4 · gruppierte Liste, aufklappen statt Unterseite */
    const auf = this.s.evAuf || {}, zeilen = ks => G.filter(x => ks.includes(x.k)).map(x => '<button class="ev-li ' + (auf[x.k] ? 'offen' : '') + '" data-act="ev-auf" data-v="' + x.k + '"><span class="ev-ic">' + x.ic + '</span><b>' + x.t + '</b><small>' + x.kurz + '</small><span class="ev-pf">›</span></button>'
      + (auf[x.k] ? '<div class="ev-auf">' + x.html + '</div>' : '')).join('');
    return kopf + [['Baustelle', ['baustelle', 'firmen']], ['Betrieb', ['heizung', 'container', 'pumpen', 'strom']], ['Nachrichten', ['meldungen', 'bericht']], ['App', ['app', 'dev', 'ueber']]]
      .map(([t, ks]) => '<div class="ev-gruppe-t">' + t + '</div><div class="glas-panel ev-liste">' + zeilen(ks) + '</div>').join('');
  };
  proto.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    if (a === 'ev-gruppe') { this.s.evGruppe = el.dataset.v || null; return this.render(true); }
    if (a === 'ev-auf') { const x = this.s.evAuf ||= {}; x[el.dataset.v] = !x[el.dataset.v]; return this.render(); }
    if (a === 'b-auto' && el.dataset.id) { const x = this.d.bereiche.find(b => b.id === el.dataset.id); return x && this.setzen(['bereiche', x.id, 'auto'], !x.auto); }
    if (a === 'ev-dev') { this.s.evDev = el.dataset.v; return this.render(); }
    if (a === 'ev-sprung') { const z = this.shadowRoot.querySelector('[data-evg="' + el.dataset.v + '"]'); if (z) z.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    return altKlick.call(this, ev);
  };
  proto.eingabe = function (ev) {
    const el = ev.target;
    if (el && el.dataset && el.dataset.evs !== undefined) {   // Suche: nur ausblenden, nicht neu zeichnen (Fokus bleibt)
      const q = el.value.trim().toLowerCase(); this.s.evSuche = el.value; let treffer = 0;
      for (const s of this.shadowRoot.querySelectorAll('.ev-abschnitt')) {
        const titelPasst = s.querySelector('h3').textContent.toLowerCase().includes(q); let sicht = 0;
        for (const z of s.querySelectorAll('.zeile, .jc, .ab-firma')) { const ja = !q || titelPasst || z.textContent.toLowerCase().includes(q); z.style.display = ja ? '' : 'none'; if (ja) sicht++; }
        for (const g of s.querySelectorAll('.glas-panel')) g.style.display = !q || titelPasst || [...g.querySelectorAll('.zeile, .jc, .ab-firma')].some(z => z.style.display !== 'none') ? '' : 'none';
        s.style.display = !q || titelPasst || sicht ? '' : 'none'; if (s.style.display !== 'none') treffer++;
      }
      const leer = this.shadowRoot.querySelector('.ev-leer'); if (leer) leer.style.display = treffer ? 'none' : 'block';
      return;
    }
    return altEingabe.call(this, ev);
  };
})();
`;

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Einstellungen (WU-0007)</title>');
ersetze('<b>Baustelle · Master-Mockup · Seite', '<b>WU-0007 Einstellungen · Vorschlag auf Seite');
ersetze('<button id="neu">Beispiel neu laden</button>', `<button id="neu">Beispiel neu laden</button>
<label>Einstellungen <select id="evvar"><option value="1">1 · Seitenleiste</option><option value="2">2 · Kacheln mit Unterseiten</option><option value="3">3 · Eine Seite mit Suche</option><option value="4">4 · Gruppierte Liste zum Aufklappen</option></select></label>`);
// eigenes Skript nach dem Beispiel-hass, vor dem Start der Seiten
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
if (start < 0) throw new Error('Startskript nicht gefunden');
html = html.slice(0, start) + '<script>\n' + EV.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
for (const p of P) { p.s.view = 'einst'; p.render(true); }
document.getElementById('evvar').onchange = e => { EV_VAR = e.target.value; for (const p of P) { p.s.evGruppe = null; p.s.evAuf = null; p.s.evSuche = ''; p.gehe('einst'); } };`);
fs.writeFileSync(path.join(repo, 'mockups', 'einstellungen-varianten.html'), html);
console.log(`mockups/einstellungen-varianten.html gebaut (${Math.round(html.length / 1024)} KB)`);
