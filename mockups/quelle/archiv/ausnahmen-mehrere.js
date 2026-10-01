// FE-0012: Vorschlag „mehrere Zeitfenster je Tag“ (Ausnahmen) auf Basis des Master-Mockups.
// Baut mockups/ausnahmen-mehrere.html: node mockups/quelle/archiv/ausnahmen-mehrere.js (Vorschlag – eingebaut in 0.8.38)
// Ändert nur die Anzeige: Heizung › Ausnahmen (je Tag eine Karte mit mehreren Zeitfenstern), die Einblendung
// „Ausnahme“ (zeigt, was am Tag schon eingetragen ist, und die Heizzeiten des Tages als Zeitstrahl) und „Diese Woche“.
// Regeln im Vorschlag: „zusätzlich arbeiten“ kommt zur Arbeitszeit dazu, „andere Zeiten“ ersetzt sie, „frei“ hebt alles
// auf. Vor-/Nachheizen nur für den Arbeitszeit-Block; ein Fenster, das an ihn grenzt, verlängert ihn, ein Fenster für
// sich heizt genau seine Zeit (Herbert 02.10.2026).
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const CSS = `
.am-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 6px; vertical-align: middle; }
.am-tag { border-top: 1px solid var(--gridc); padding: 8px 0; } .am-tag:first-of-type { border-top: 0; }
.am-tag-kopf { display: flex; align-items: baseline; gap: 8px; } .am-tag-kopf b { font-size: 14px; }
.am-fenster { display: flex; align-items: center; gap: 8px; padding: 4px 0 4px 12px; font-size: 13.5px; }
.am-fenster b { font-weight: 600; } .am-fenster .x { margin-left: auto; }
.am-strahl { margin: 4px 0 2px 12px; } .am-strahl .tl-spur { height: 12px; border-radius: 5px; }
.tl-eigen { background: #64a8ff; }
.am-hinweis { font-size: 12px; color: var(--ink2); padding-left: 12px; }
.am-schon { border-radius: 12px; background: rgba(120,120,128,.12); padding: 8px 12px; margin: 6px 0; font-size: 13px; }
.am-schon b { font-weight: 600; }
.am-woche .kk-dz, .am-woche-z { display: grid; grid-template-columns: 54px 1fr; gap: 8px; align-items: center; font-size: 12px; margin: 3px 0; }
`;

const SKRIPT = `
/* ================= FE-0012: mehrere Zeitfenster je Tag (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { block: p.ausnahmenBlock, sheet: p.sheet, klick: p.klick, aufbauen: p._aufbauen };
  const NEU = '<span class="am-neu">neu</span>';
  p._aufbauen = function () { const erst = !this.root; alt.aufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS)}; this.shadowRoot.appendChild(s); } };
  /* Beispiel: Freitag mit zwei Fenstern, Samstag „andere Zeiten“ in zwei Blöcken, ein freier Tag */
  const AM = window.AM = { liste: null };
  const plus = (iso, n) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  p.amListe = function () {
    if (!AM.liste) { const h = this.z.HEUTE, fr = [...Array(7)].map((_, i) => plus(h, i + 1)).find(t => wtag(t) === 'Fr'), sa = plus(fr, 1), di = [...Array(9)].map((_, i) => plus(h, i + 2)).find(t => wtag(t) === 'Di');
      AM.liste = [{ datum: fr, art: 'arbeit', von: '04:00', bis: '05:00', notiz: 'Betonpumpe' }, { datum: fr, art: 'arbeit', von: '12:30', bis: '16:30', notiz: 'länger' },
        { datum: sa, art: 'zeiten', von: '07:00', bis: '11:00', notiz: '' }, { datum: sa, art: 'zeiten', von: '12:00', bis: '15:00', notiz: 'Abnahme' },
        { datum: di, art: 'frei', von: null, bis: null, notiz: 'Betriebsausflug' }]; }
    return AM.liste;
  };
  /* Arbeitsfenster und Heizblöcke eines Tages (im echten Bau rechnet das die Integration) */
  p.amTag = function (iso) {
    // Herbert: Vor-/Nachheizen nur für den Arbeitszeit-Block – ein Fenster, das an ihn grenzt oder ihn überschneidet,
    // verlängert ihn; ein Fenster für sich heizt genau seine Zeit. Ohne Arbeitszeit an dem Tag gilt das erste Fenster als Block.
    const L = this.amListe().filter(a => a.datum === iso), az = this.azJetzt, regel = az && az.tage[wtag(iso)];
    if (L.some(a => a.art === 'frei')) return { fenster: [], bloecke: [], frei: true, L };
    const zeiten = L.filter(a => a.art === 'zeiten').map(a => [minu(a.von), minu(a.bis)]), extra = L.filter(a => a.art === 'arbeit').map(a => [minu(a.von), minu(a.bis)]);
    let rest = [...(zeiten.length ? zeiten : []), ...extra].sort((x, y) => x[0] - y[0]);
    let block = zeiten.length ? null : regel ? [minu(regel[0]), minu(regel[1])] : null;
    if (!block && rest.length) block = rest.shift();
    let geaendert = true;
    while (block && geaendert) { geaendert = false; rest = rest.filter(([a, b]) => { if (a <= block[1] && b >= block[0]) { block = [Math.min(a, block[0]), Math.max(b, block[1])]; geaendert = true; return false; } return true; }); }
    const e = this.d.e, bloecke = [];
    if (block) bloecke.push({ v: Math.max(0, block[0] - e.vorheizen), a: block[0], b: block[1], n: Math.min(1440, block[1] + e.nachheizen), haupt: true });
    for (const [a, b] of rest) bloecke.push({ v: a, a, b, n: b, haupt: false });
    bloecke.sort((x, y) => x.v - y.v);
    return { fenster: [...(block ? [block] : []), ...rest], bloecke, frei: false, L, block, rest };
  };
  p.amStrahl = function (iso) {
    const T = this.amTag(iso);
    return this.zeitstrahlSeg(T.bloecke.flatMap(x => [[x.v, x.a, 'vor'], [x.a, x.b, x.haupt ? 'heiz' : 'eigen'], [x.b, x.n, 'vor']]), iso === this.z.HEUTE);
  };
  p.amText = function (T) {
    return T.bloecke.map(x => x.haupt ? 'Arbeit ' + uhr(x.a) + '–' + uhr(x.b) + ', geheizt ' + uhr(x.v) + '–' + uhr(x.n) + ' (mit Vor-/Nachheizen)'
      : 'nur ' + uhr(x.a) + '–' + uhr(x.b) + ' geheizt (eigenes Fenster, ohne Vor-/Nachheizen)').join(' · ');
  };
  p.ausnahmenBlock = function () {
    const H = this.z.HEUTE, L = this.amListe().filter(a => a.datum >= H), tage = [...new Set(L.map(a => a.datum))].sort();
    const art = a => a.art === 'frei' ? '' : '<span class="badge ' + (a.art === 'zeiten' ? '' : 'blau-b') + '">' + AUSNAHME[a.art] + '</span>';
    return '<div class="glas-panel block"><div class="block-kopf"><b>Ausnahmen</b><span class="leise">einmalig – mehrere Zeitfenster je Tag möglich</span>' + NEU + '</div>'
      + '<div class="bedarf-dauer">' + [['heute-laenger', '+ Heute länger'], ['morgen-spaeter', '+ Morgen später'], ['samstag', '+ Samstag arbeiten'], ['frei', '+ Freier Tag']].map(([k, t]) => '<button class="chip glas-panel" data-act="ausn-neu" data-v="' + k + '">' + t + '</button>').join('') + '</div>'
      + (tage.length ? tage.map(t => { const T = this.amTag(t), A = L.filter(a => a.datum === t), az = this.azJetzt && this.azJetzt.tage[wtag(t)];
        const basis = !T.frei && !A.some(a => a.art === 'zeiten') && az ? '<div class="am-fenster leise">' + az.join('–') + ' laut Arbeitszeit</div>' : '';
        return '<div class="am-tag"><div class="am-tag-kopf"><b>' + wtag(t) + ' ' + kurzDatum(t) + '</b>' + (T.frei ? '<span class="badge">frei</span>' : '<span class="leise">' + T.fenster.length + ' ' + (T.fenster.length === 1 ? 'Zeitfenster' : 'Zeitfenster') + '</span>') + '</div>'
          + basis + A.map(a => '<div class="am-fenster">' + (a.art === 'frei' ? '<b>frei</b>' : '<b>' + a.von + '–' + a.bis + '</b>') + ' ' + art(a) + (a.notiz ? ' <span class="leise">' + esc(a.notiz) + '</span>' : '')
            + '<button class="x" data-act="am-weg" data-i="' + this.amListe().indexOf(a) + '" title="dieses Zeitfenster löschen">✕</button></div>').join('')
          + (T.frei ? '' : '<div class="am-strahl">' + this.amStrahl(t) + '<div class="tl-achse"><span>04</span><span>12</span><span>20</span></div></div>'
            + '<div class="am-hinweis">' + this.amText(T) + '</div>'
            + '<button class="zeile" data-act="am-dazu" data-d="' + t + '"><span class="blau">+ weiteres Zeitfenster an diesem Tag</span></button>') + '</div>'; }).join('')
        : '<div class="leise">Keine Ausnahmen</div>')
      + '<button class="zeile" data-act="ausn-neu" data-v=""><span class="blau">+ Ausnahme für einen anderen Tag</span></button></div>';
  };
  p.sheet = function () {
    const s = this.s.sheet; if (!s || s.art !== 'ausnahme') return alt.sheet.call(this);
    const h = alt.sheet.call(this), f = s.form, schon = this.amListe().filter(a => a.datum === f.datum);
    if (!schon.length) return h;
    const neu = { datum: f.datum, art: f.art, von: f.von, bis: f.bis }, vorher = AM.liste; AM.liste = [...vorher, neu]; const T = this.amTag(f.datum), strahl = this.amStrahl(f.datum); AM.liste = vorher;
    const box = '<div class="am-schon">An diesem Tag schon eingetragen: ' + schon.map(a => '<b>' + (a.art === 'frei' ? 'frei' : a.von + '–' + a.bis) + '</b> ' + AUSNAHME[a.art]).join(', ') + '<br>'
      + (f.art === 'frei' ? '„Frei“ ersetzt alle Zeitfenster dieses Tages.' : f.art === 'zeiten' ? 'Das neue Fenster kommt dazu; „andere Zeiten“ ersetzt nur die Arbeitszeit, nicht die anderen Ausnahmen.' : 'Das neue Fenster kommt dazu – nichts wird überschrieben.') + NEU
      + (f.art === 'frei' ? '' : '<div class="am-strahl" style="margin-left:0">' + strahl + '</div><div class="leise">' + this.amText(T) + '</div>') + '</div>';
    return h.replace('<label class="feld">Notiz', box + '<label class="feld">Notiz');
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    if (a === 'am-weg') { const x = this.amListe()[+el.dataset.i]; AM.liste = this.amListe().filter((_, i) => i !== +el.dataset.i); this.toast('Zeitfenster ' + (x.von ? x.von + '–' + x.bis : 'frei') + ' gelöscht – die anderen bleiben'); return this.render(); }
    if (a === 'am-dazu') { this.s.sheet = { art: 'ausnahme', form: { datum: el.dataset.d, art: 'arbeit', von: '17:00', bis: '19:00', notiz: '' } }; return this.render(); }
    if (a === 'au-speichern' && this.s.sheet && this.s.sheet.art === 'ausnahme') { const f = this.s.sheet.form;
      if (f.art === 'frei') AM.liste = this.amListe().filter(x => x.datum !== f.datum);
      else AM.liste = this.amListe().filter(x => !(x.datum === f.datum && x.art === 'frei'));
      AM.liste.push({ datum: f.datum, art: f.art, von: f.art === 'frei' ? null : f.von, bis: f.art === 'frei' ? null : f.bis, notiz: f.notiz || '' });
      this.s.sheet = null; this.toast('Ausnahme ' + wtag(f.datum) + ' ' + kurzDatum(f.datum) + ' dazu' + (f.art === 'frei' ? ' – Tag frei' : ' – die anderen bleiben')); return this.render(); }
    return alt.klick.call(this, ev);
  };
})();
`;

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – mehrere Ausnahmen je Tag</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>FE-0012 mehrere Zeitfenster je Tag · Vorschlag auf Seite $1</b>');
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
for (const p of P) { p.s.view = 'heizung'; p.s.sheet = { art: 'hz', k: 'az' }; p.render(true); }`);
fs.writeFileSync(path.join(repo, 'mockups', 'ausnahmen-mehrere.html'), html);
console.log(`mockups/ausnahmen-mehrere.html gebaut (${Math.round(html.length / 1024)} KB)`);
