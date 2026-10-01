// Prüft den Prototyp ohne Browser: node mockups/quelle/vorschau/pruefen.cjs
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '../../glas.html'), 'utf8');
let script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const el = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} }, dataset: {}, scrollTop: 0, offsetWidth: 100, offsetHeight: 30, innerHTML: '', value: 'Neu', querySelector() { return this.kind ||= el(); } });
class Root { constructor() { this.teile = {}; } set innerHTML(v) {} addEventListener() {} querySelector(s) { return this.teile[s] ||= el(); } querySelectorAll() { return []; } contains() { return true; } getBoundingClientRect() { return { left: 0, top: 0, width: 390 }; } }
let root; global.document = { querySelectorAll: s => s === '.app' ? [root = new Root()] : [], getElementById: () => ({}), body: { classList: { contains: () => false } } };
console.warn = () => {};
const { A, CH, awStufenErste } = new Function('document', script.replace("document.querySelectorAll('.app').forEach(el => new App(el));", 'document.querySelectorAll(".app").forEach(el => new App(el));') + '; return { A: APPS[0], CH: CHARTS, awStufenErste: k => awStufen(k)[0][0] };')(global.document);
const f = [], ui = () => root.teile['.ui'].innerHTML, klick = ds => A.klick({ target: { closest: () => ({ dataset: ds }) } });
const pr = w => { if (/undefined|NaN|Infinity|\[object|>null</.test(ui().replace(/data-[a-z]+="[^"]*"/g, ''))) f.push(w + ': ' + (ui().match(/.{40}(undefined|NaN|Infinity|\[object|>null<).{15}/) || [''])[0]); };
const eing = (ds, value) => A.eingabe({ target: { dataset: ds, value } });
const hov = (x, y = 60) => { let t = ''; A.tip = (e, h) => t = h || ''; const key = [...ui().matchAll(/data-chart="([^"]+)"/g)].map(m => m[1]);
  for (const k of key) { const svg = { dataset: { chart: k }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320 }), querySelector: () => ({}), querySelectorAll: () => [] };
    const bar = { dataset: { i: '2' } }; A.hover({ target: { closest: sel => sel === 'svg.chart' ? svg : sel === '.bar' ? bar : null }, clientX: x, clientY: y }); if (/NaN|undefined/.test(t)) f.push('hover ' + k); } };
module.exports = { A, ui, klick, pr, eing, hov, f, CH };
if (require.main === module) {
  for (const v of ['uebersicht', 'heizung', 'auswertung', 'verlauf', 'einst']) { klick({ act: 'tab', v }); pr(v); hov(150); }
  for (const b of A.d.bereiche.map(b => b.id)) { klick({ act: 'container', id: b }); pr(b); for (const c of ['temp', 'verbrauch', 'heizzeit', 'pumpzeit', 'zyklen']) { klick({ act: 'chart', c }); pr(b + c); hov(150); } }
  for (const s of ['wetter', 'warnungen', 'baustellen', 'container-neu', 'bereich', 'abschliessen', 'urlaub', 'name', 'baustelle-neu', 'wetterquelle', 'verbrauch', 'heizplan']) { klick({ act: 'sheet', s, i: '1' }); pr('sheet ' + s); }
  /* AN-0002: ✎ im Dialog Baustellen öffnet „Baustelle bearbeiten“; Unterdialoge kehren dorthin zurück */
  klick({ act: 'sheet', s: 'baustellen' }); klick({ act: 'sheet', s: 'bs-bearbeiten', i: '0' }); pr('sheet bs-bearbeiten');
  if (A.s.sheet.art !== 'bs-bearbeiten') f.push('AN-0002: Baustelle bearbeiten öffnet nicht');
  for (const [act, ds] of [['sheet', { s: 'name' }], ['sheet', { s: 'zeitraum-bs' }], ['sheet', { s: 'wetterquelle' }], ['bereich-einst', { id: A.d.bereiche[0].id }], ['firma-auf', { id: A.d.firmen[0].id }]]) {
    klick({ act, ...ds }); pr('AN-0002 ' + act); klick({ act: 'zu' }); if (!A.s.sheet || A.s.sheet.art !== 'bs-bearbeiten') f.push('AN-0002: nach ' + act + ' nicht zurück'); }
  klick({ act: 'zu' }); if (A.s.sheet) f.push('AN-0002: Fertig schließt nicht');
  /* FE-0002: automatische Arbeitszeit wird durch die erste eigene ersetzt (auch mit früherem Datum); bearbeiten, löschen */
  A.d.arbeitszeiten = [{ ab: '2026-09-28', name: 'Arbeitszeit', auto: true, tage: { Mo: ['07:00', '16:30'], Di: null, Mi: null, Do: null, Fr: null, Sa: null, So: null } }];
  klick({ act: 'tab', v: 'heizung' }); pr('FE-0002 auto'); if (!/Automatisch angelegt/.test(ui())) f.push('FE-0002: Hinweis automatisch fehlt');
  klick({ act: 'az-neu' }); eing({ azn: 'ab' }, '2026-02-09'); eing({ azn: 'name' }, 'Meine'); klick({ act: 'azn-speichern' });
  if (A.azJetzt.name !== 'Meine' || A.d.arbeitszeiten.length !== 1) f.push('FE-0002: eigene gilt nicht: ' + A.azJetzt.name);
  klick({ act: 'sheet', s: 'az', i: '0' }); klick({ act: 'az-bearbeiten' }); pr('FE-0002 bearbeiten'); eing({ azn: 'name' }, 'Geändert'); klick({ act: 'azn-speichern' });
  if (A.d.arbeitszeiten.length !== 1 || A.azJetzt.name !== 'Geändert') f.push('FE-0002: bearbeiten ersetzt nicht');
  klick({ act: 'sheet', s: 'az', i: '0' }); klick({ act: 'az-weg' }); if (A.d.arbeitszeiten.length !== 1) f.push('FE-0002: letzte gelöscht');
  /* Lernende Regelung (0.8): Schalter nur mit Fühler, Lernstand-Einblendung */
  { const c = A.d.bereiche.find(x => !x.pumpe && x.t !== null); klick({ act: 'container', id: c.id }); c.modus = 'thermo';
    if (!/Lernende Regelung/.test(ui())) f.push('Lernen: Schalter fehlt');
    klick({ act: 'b-lernen' }); pr('lernen an'); if (!/Thermostat · lernend/.test(ui())) f.push('Lernen: Regelungszeile fehlt');
    klick({ act: 'sheet', s: 'lernen' }); pr('lernstand'); klick({ act: 'lern-k', v: 'mild' }); pr('lernstand mild'); klick({ act: 'zu' }); }
  klick({ act: 'zu' });
  /* WU-0004: Container-Ansicht D mit Thermostat-Rad */
  { const c = A.d.bereiche.find(x => !x.pumpe && x.t !== null); klick({ act: 'container', id: c.id }); A.b.modus = 'thermo'; A.render(); pr('container d');
    if (!ui().includes('cv-kern-1') || !ui().includes('data-act="c-soll"')) f.push('D: Rad/Soll fehlt');
    const vorher = A.cvSoll(A.b); klick({ act: 'c-soll', d: '0.5' }); if (A.cvSoll(A.b) !== vorher + .5) f.push('D: Soll +');
    A.b.modus = 'plan'; A.render(); if (ui().includes('data-act="c-soll"')) f.push('D: Soll im Zeitplan'); A.b.modus = 'thermo';
    for (const k of ['heute', 'woche', 'stunden']) { klick({ act: 'cvd', v: k }); pr(`d ${k}`); }
    const g = A.b.geraete[0]; klick({ act: 'g-aktiv', i: '0' }); if (!g.inaktiv) f.push('D: inaktiv'); klick({ act: 'g-aktiv', i: '0' });
    klick({ act: 'sheet', s: 'bereich' }); klick({ act: 'g-bearbeiten', i: '0' }); pr('gerät bearbeiten'); eing({ gf: 'n' }, 'Radiator neu'); klick({ act: 'gf-speichern' });
    if (g.n !== 'Radiator neu' || !A.s.sheet || A.s.sheet.art !== 'bereich') f.push('D: Gerät bearbeiten'); klick({ act: 'zu' });
    for (const x of A.d.bereiche.filter(y => !y.pumpe)) { klick({ act: 'container', id: x.id }); pr(`d ${x.id}`); } }
  /* WU-0005: Auswertung aus Bausteinen – alle Zeiträume, beide Umfänge, alle Details */
  for (const sc of ['diese', 'alle']) for (const z of ['Tag', 'Woche', 'Monat', 'Jahr']) { klick({ act: 'tab', v: 'auswertung' }); klick({ act: 'aw-scope', v: sc }); klick({ act: 'vb-zeitraum', ziel: 'aw', v: z }); pr(`auswertung ${sc} ${z}`); }
  for (const k of ['verbrauch', 'abrechnung', 'geraete', 'temperaturen', 'wetter', 'ohne', 'hochrechnung', 'vergleich']) { klick({ act: 'aw-detail', k }); pr(`aw-detail ${k}`); if (!A.s.sheet) f.push('aw-detail ' + k); klick({ act: 'zu' }); }
  /* Variante 6: alle Bausteine einschalten, verschieben, Breite, zurücksetzen */
  klick({ act: 'tab', v: 'auswertung' }); klick({ act: 'aw-bearb' }); pr('aw anpassen');
  A.awAuswahl().forEach((x, i) => { if (!x.an) klick({ act: 'aw-an', i: String(i) }); }); klick({ act: 'aw-hoch', i: '3' }); klick({ act: 'aw-gr', i: '0', k: 'w', d: '-1' }); klick({ act: 'aw-gr', i: '0', k: 'h', d: '1' }); klick({ act: 'aw-bearb' }); pr('aw alle bausteine');
  if (A.awAuswahl()[0].w !== 3 || A.awAuswahl()[0].h !== 3) f.push('Variante 6: Größe');
  klick({ act: 'aw-layout' }); pr('aw layout'); if (!ui().includes('data-zug="move"') || !ui().includes('data-zug="size"')) f.push('Variante 6: Layout-Griffe'); klick({ act: 'aw-weg', i: '0' }); if (A.awAuswahl()[0].an) f.push('Variante 6: ausblenden'); klick({ act: 'aw-an', i: '0' }); klick({ act: 'aw-layout' });
  if (!A.awAuswahl().every(x => x.an)) f.push('Variante 6: einschalten'); for (const k of Object.keys(A.awAuswahl().reduce((o, x) => (o[x.k] = 1, o), {}))) if (!ui().length) f.push(k);
  klick({ act: 'aw-bearb' }); klick({ act: 'aw-standard' }); klick({ act: 'aw-bearb' }); pr('aw standard');
  klick({ act: 'aw-bearb' }); if (!ui().includes('data-act="aw-vorlage"')) f.push('Variante 6: Vorlagen fehlen');
  for (const v of ['kacheln', 'kosten', 'wer', 'verlauf', 'misch']) { klick({ act: 'aw-vorlage', v }); if (!A.awAuswahl()[0].an) f.push('Vorlage ' + v); }
  klick({ act: 'aw-vorlage', v: 'wer' }); klick({ act: 'aw-bearb' }); pr('aw vorlage wer'); if (!ui().includes('aw-tab-zeile')) f.push('Vorlage wer: Rangliste fehlt');
  /* FE-0006: jede Stufe jedes Bausteins rendert, Kachel-Diagramm je Container/Firma */
  klick({ act: 'tab', v: 'auswertung' }); klick({ act: 'aw-bearb' }); A.awAuswahl().forEach((x, i) => { if (!x.an) klick({ act: 'aw-an', i: String(i) }); });
  A.awAuswahl().forEach((x, i) => ['S', 'M', 'L', 'XL'].forEach(n => { klick({ act: 'aw-stufe', i: String(i), v: n }); }));
  if (!A.awAuswahl().every(x => x.st)) f.push('FE-0006: Stufe fehlt'); klick({ act: 'aw-bearb' }); pr('alle bausteine groesste stufe');
  if (!ui().includes('aw-dia-svg')) f.push('FE-0006: Kachel-Diagramm fehlt');
  for (const g of ['firma', 'container']) for (const z of ['Tag', 'Woche', 'Monat', 'Jahr']) { klick({ act: 'aw-gruppe', v: g }); klick({ act: 'vb-zeitraum', ziel: 'aw', v: z }); pr(`dia ${g} ${z}`); }
  klick({ act: 'aw-bearb' }); A.awAuswahl().forEach((x, i) => klick({ act: 'aw-stufe', i: String(i), v: awStufenErste(x.k) })); klick({ act: 'aw-bearb' }); pr('alle bausteine kleinste stufe');
  klick({ act: 'aw-bearb' }); klick({ act: 'aw-vorlage', v: 'misch' }); klick({ act: 'aw-bearb' });
  klick({ act: 'aw-scope', v: 'diese' });
  console.log(f.length ? f.join('\n') : 'Grundprüfung sauber');
}
