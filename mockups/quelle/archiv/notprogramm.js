// BSM-019: Vorschlag „Notprogramm anzeigen und prüfen“ auf Basis des Master-Mockups.
// Baut mockups/notprogramm.html: node mockups/quelle/archiv/notprogramm.js
// 1. Einstellungen › Notprogramm (neue Gruppe): Schalter, „Jetzt prüfen“, je Heizungs-Plug Zustand, Skript, Programm
//    gültig bis, Modus im Notbetrieb, Fühler/Tür am Plug; Tippen öffnet die Einzelheiten mit dem letzten Notbetrieb.
// 2. Einstellungen › Geräte: Schaltgeräte mit „🛟“ (bereit) bzw. rotem „🛟“ (Fehler) und dem Zustand im Text.
// 3. Container: Geräte-Chips mit 🛟-Marke; Warnung „Notprogramm … nimmt das Programm nicht an“ bei Fehler.
// Vorführ-Leiste: Lage (alles bereit / ein Plug im Notbetrieb / ein Plug mit Fehler / Notprogramm aus).
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const SKRIPT = `
/* ================= BSM-019: Notprogramm anzeigen und prüfen (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { gruppen: p.einstGruppen, liste: p.geraeteListe, sheet: p.sheet, klick: p.klick };
  const NEU = '<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:6px;background:var(--amber);color:#000;margin-left:6px">neu</span>';
  const N = window.NP = { lage: 'bereit', an: true, geprueft: Date.now() - 140000, prueft: false };
  const zeit = ms => new Date(ms).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  const vor = ms => { const s = Math.round((Date.now() - ms) / 1000); return s < 60 ? 'gerade eben' : 'vor ' + Math.round(s / 60) + ' min'; };
  // Zustand je Heizkörper-Plug (kommt später fertig von der Integration, struktur › geraete[].notprogramm)
  const plugs = d => d.bereiche.filter(b => !b.pumpe).flatMap(b => b.geraete.filter(g => g.heizer).map((g, i) => ({ b, g, i })));
  const stand = (d, x, k) => {
    const ohneKopplung = k === 3 && !!x.b.fuehler, thermo = !!x.b.fuehler && x.b.modus !== 'plan' && !ohneKopplung, tuer = !!x.b.tuer;
    const s = { zustand: 'bereit', version: 3, bis: 'So 18:30', modus: x.b.modus === 'hand' ? 'Hand – nicht anfassen' : thermo ? 'Thermostat ' + de(x.b.soll ?? d.e.soll) + ' °C' : 'Zeitplan',
      fuehler: thermo ? esc(this_name(x.b.fuehler)) + ' (Nr. ' + (202 + k) + ')' : null, tuer: tuer ? 'Tür am Plug' : null, frost: 'unter 3 °C', zuletzt: 'noch nie' };
    if (!N.an) return { ...s, zustand: 'aus' };
    if (N.lage === 'not' && k === 0) return { ...s, zustand: 'not', seit: Date.now() - 23 * 60000 };
    if (N.lage === 'fehler' && k === 1) return { ...s, zustand: 'fehler', text: 'nicht erreichbar (Zeitüberschreitung)', bis: 'Mi 18:30' };
    if (ohneKopplung) return { ...s, hinweis: 'Fühler noch nicht am Plug gekoppelt – im Notbetrieb nur Zeitplan' };
    return s;
  };
  const chip = s => s.zustand === 'bereit' ? '<span class="gruen-t">✓ bereit</span>' : s.zustand === 'not' ? '<span class="amber-t">⚠ Notbetrieb seit ' + zeit(s.seit) + '</span>'
    : s.zustand === 'fehler' ? '<span class="rot-t">✕ ' + s.text + '</span>' : '<span class="leise">aus</span>';
  const this_name = eid => (window.P && P[0] && P[0].name(eid)) || eid;
  const alle = d => plugs(d).map((x, k) => ({ ...x, s: stand(d, x, k) }));

  p.einstGruppen = function () {
    const G0 = alt.gruppen.call(this); if (G0.some(g => g.k === 'notprogramm')) return G0;   // seit 0.8.66 in der Seite
    const G = G0, d = this.d, P = alle(d), fehler = P.filter(x => x.s.zustand === 'fehler').length, not = P.filter(x => x.s.zustand === 'not').length;
    const kurz = !N.an ? 'aus' : not ? not + ' im Notbetrieb' : fehler ? fehler + ' mit Fehler' : P.length + ' Plugs bereit';
    const zeile = x => '<button class="zeile" data-act="np-plug" data-id="' + esc(x.g.schalter) + '"><div><b>🛟 ' + esc(this.name(x.g.schalter) || x.g.schalter) + '</b><div class="leise">' + esc(x.b.name) + (N.an ? ' · im Notbetrieb: ' + x.s.modus : '')
      + (N.an && x.s.tuer ? ' · Tür' : '') + (x.s.hinweis ? ' · <span class="amber-t">' + x.s.hinweis + '</span>' : '') + '</div></div><span class="ger-z">' + chip(x.s) + (N.an ? '<div class="leise">Programm bis ' + x.s.bis + '</div>' : '') + '</span><span class="chev">›</span></button>';
    const html = '<div class="glas-panel liste"><div class="gruppe">Notprogramm in den Plugs' + NEU + '</div>'
      + '<div class="zeile"><div><b>Notprogramm</b><div class="leise">Fällt Home Assistant oder das Netz aus, heizen die Plugs nach dem Programm der nächsten 7 Tage weiter – nach 15 min ohne Lebenszeichen</div></div>' + schalter(N.an, 'np-an') + '</div>'
      + (N.an ? '<button class="zeile" data-act="np-pruefen"><div><span class="blau">' + (N.prueft ? '⟳ prüft …' : '⟳ Jetzt prüfen') + '</span><div class="leise">Skript, Kopplungen, Programm und Lebenszeichen an allen Plugs – sonst alle 5 min von selbst</div></div><span class="leise">zuletzt ' + vor(N.geprueft) + '</span></button>' : '')
      + '</div><div class="glas-panel liste"><div class="gruppe">Heizungs-Plugs · ' + P.length + '</div>' + P.map(zeile).join('') + '</div>'
      + (fehler ? '<div class="glas-panel liste"><div class="zeile"><div><b class="rot-t">⚠ Ein Plug nimmt das Programm nicht an</b><div class="leise">Fällt Home Assistant jetzt aus, heizt er nach dem alten Programm (bis Mi 18:30) bzw. danach nur Frostschutz. Steht auch unter Warnungen.</div></div></div></div>' : '')
      + '<div class="leise p-fuss">Im Notbetrieb gilt: kein Lernen, keine Heizgrenze, keine Staffelung – Thermostat nur, wenn der Fühler am Plug gekoppelt ist (die Integration koppelt Fühler und Tür des Containers selbst).</div>';
    const i = G.findIndex(g => g.k === 'heizung');
    G.splice(i + 1, 0, { k: 'notprogramm', ic: '🛟', t: 'Notprogramm', kurz, html });
    return G;
  };
  p.geraeteListe = function () {
    const r = alt.liste.call(this), P = alle(this.d);
    for (const x of P) {
      const marke = x.s.zustand === 'aus' ? '' : '<span title="Notprogramm: ' + (x.s.zustand === 'fehler' ? x.s.text : x.s.zustand === 'not' ? 'Notbetrieb' : 'bereit') + '" style="margin-left:4px' + (x.s.zustand === 'fehler' ? ';filter:hue-rotate(-40deg) saturate(3)' : '') + '">🛟</span>';
      r.html = r.html.replace('<b>' + esc(this.name(x.g.schalter) || x.g.schalter) + '</b>', '<b>' + esc(this.name(x.g.schalter) || x.g.schalter) + '</b>' + marke);
    }
    return r;
  };
  p.sheet = function () {
    const s = this.s.sheet; if (!s || s.art !== 'np-plug') return alt.sheet.call(this);
    const x = alle(this.d).find(y => y.g.schalter === s.id), st = x.s, z = (t, w) => '<div class="zeile"><span>' + t + '</span><span class="leise">' + w + '</span></div>';
    return '<div class="griff"></div><div class="block-kopf"><h3>🛟 ' + esc(this.name(x.g.schalter) || x.g.schalter) + '</h3></div><div class="leise" style="padding:0 4px 8px">' + esc(x.b.name) + '</div>'
      + '<div class="glas-panel liste">' + z('Zustand', chip(st)) + z('Skript', 'Version ' + st.version + ' · läuft') + z('Programm', 'gültig bis ' + st.bis + ' · geladen')
      + z('Im Notbetrieb', st.modus) + z('Frostschutz', st.frost) + z('Fühler am Plug', st.fuehler ? esc(st.fuehler) : '<span class="amber-t">keiner – Zeitplan</span>') + z('Tür am Plug', st.tuer ? '✓ gekoppelt' : '–')
      + z('Letzte Prüfung', vor(N.geprueft)) + '</div>'
      + '<div class="glas-panel liste"><div class="gruppe">Notbetrieb</div>' + (st.zustand === 'not' ? z('läuft seit', zeit(st.seit) + ' · Home Assistant meldet sich nicht') : '')
      + z('zuletzt', st.zustand === 'not' ? '–' : '03.10. 02:14 – 02:41 (27 min) · 0,4 kWh nachgetragen') + '</div>'
      + '<button class="knopf" data-act="np-pruefen">⟳ Jetzt prüfen</button><button class="knopf" data-act="zu">Schließen</button>';
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    if (a === 'np-an') { N.an = !N.an; return this.render(true); }
    if (a === 'np-plug') { this.s.sheet = { art: 'np-plug', id: el.dataset.id }; return this.render(true); }
    if (a === 'np-pruefen') { N.prueft = true; this.render(true); setTimeout(() => { N.prueft = false; N.geprueft = Date.now(); if (N.lage === 'fehler') N.lage = 'bereit'; for (const q of P) q.render(true); }, 1500); return; }
    return alt.klick.call(this, ev);
  };
})();
`;
ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Notprogramm</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>BSM-019 Notprogramm · Vorschlag auf Seite $1</b>');
ersetze('<button id="neu">Beispiel neu laden</button>', `<button id="neu">Beispiel neu laden</button>
<label>Lage <select id="np-lage"><option value="bereit">alles bereit</option><option value="not">ein Plug im Notbetrieb</option><option value="fehler">ein Plug mit Fehler</option><option value="aus">Notprogramm aus</option></select></label>
<label>zeigen <select id="np-ziel"><option value="notprogramm">Einstellungen › Notprogramm</option><option value="geraete">Einstellungen › Geräte</option><option value="plug">Einzelheiten eines Plugs</option></select></label>`);
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
const npLage = document.getElementById('np-lage'), npZiel = document.getElementById('np-ziel');
const npZeigen = () => { NP.an = npLage.value !== 'aus'; NP.lage = npLage.value; for (const p of P) { p.s.sheet = null; p.s.evGruppe = npZiel.value === 'geraete' ? 'geraete' : 'notprogramm'; p.gehe('einst');
  if (npZiel.value === 'plug') { const g = p.d.bereiche.flatMap(b => b.geraete.filter(x => x.heizer))[0]; p.s.sheet = { art: 'np-plug', id: g.schalter }; p.render(true); } } };
npLage.onchange = npZeigen; npZiel.onchange = npZeigen; npZeigen();`);
fs.writeFileSync(path.join(repo, 'mockups', 'notprogramm.html'), html);
console.log(`mockups/notprogramm.html gebaut (${Math.round(html.length / 1024)} KB)`);
