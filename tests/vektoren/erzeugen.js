// Referenzwerte der Auswertung (Bauplan Module, Phase 0): rechnet die HEUTIGE Seite gegen die Beispiel-Strukturen
// (tests/panel/struktur-0.7.json, struktur-echt.json) und eine feste Langzeitstatistik und schreibt Eingaben und
// Ergebnisse nach tests/vektoren/auswertung-*.json. tests/logik/test_auswertung.py prüft logik/auswertung.py dagegen.
//
// Aufruf: node tests/vektoren/erzeugen.js [baustelle-panel.js]           schreibt die Vektoren
//         node tests/vektoren/erzeugen.js --pruefen [baustelle-panel.js] vergleicht nur (Exit 1 bei Abweichung)
// Ohne Datei nimmt es die Seite vom Git-Tag `vor-module`: seit Phase 3 rechnet die Seite nicht mehr selbst (die
// Rechnungen, die hier nachgerechnet werden, gibt es nur noch in der Seite vor dem Umbau).
//
// Reproduzierbar: feste Uhrzeit (29.09.2026 16:20), Statistik aus einer Hash-Funktion statt Zufall, keine Uhr des Rechners.
// Wo die Seite heute anders rechnet als die Integration (Firma je Tag statt je Stunde/Monat, Heiztage aus der Heizzeit),
// steht neben `seite` das fachlich richtige `erwartet` und `abweichung` mit dem Grund (Bauplan-Module §5).
'use strict';
const fs = require('fs');
const path = require('path');

const argumente = process.argv.slice(2), pruefen = argumente.includes('--pruefen');
const REPO = path.resolve(__dirname, '..', '..');
const datei = argumente.find(a => a !== '--pruefen');
const ZIEL = __dirname;
const STRUKTUREN = ['struktur-0.7.json', 'struktur-echt.json'].map(n => path.join(REPO, 'tests/panel', n));

/* ---------- Seite laden (wie tests/panel/test_panel.js, ohne Anzeige) ---------- */
class HTMLElement {
  constructor() { this.dataset = {}; }
  attachShadow() { this.shadowRoot = { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }; return this.shadowRoot; }
  dispatchEvent() { return true; }
}
global.HTMLElement = HTMLElement;
const registry = {};
global.customElements = { define: (n, c) => { registry[n] = c; }, get: n => registry[n] };
global.localStorage = { getItem: () => null, setItem() {} };
global.document = { createElement: () => ({ click() {} }) };
global.setInterval = () => 1; global.clearInterval = () => {};
console.warn = () => {};
// Die Hilfen der Seite (summe, zahl, …) liegen im eval-Bereich; __methode baut dort eine Funktion aus Quelltext der Seite
const seite = datei ? fs.readFileSync(datei, 'utf8')
  : require('child_process').execFileSync('git', ['show', 'vor-module:custom_components/baustelle/frontend/baustelle-panel.js'], { cwd: REPO, encoding: 'utf8' });
eval(seite + '\n;globalThis.__methode = q => eval("(" + q + ")");');
const P = registry['baustelle-panel'];
if (!P) { console.error('baustelle-panel wurde nicht registriert'); process.exit(1); }
const quelle = name => { const q = P.prototype[name].toString(); return q.startsWith('function') ? q : 'function ' + q; };
/* Ausschnitt einer Methode als eigene Funktion: vom Text `von` bis einschließlich `bis`, Rückgabe `rueck` */
const ausschnitt = (methode, parameter, von, bis, rueck) => {
  const q = quelle(methode), a = q.indexOf(von), b = q.indexOf(bis, a);
  if (a < 0 || b < 0) throw new Error(`${methode}: Ausschnitt „${von}“ … „${bis}“ nicht gefunden – Seite geändert?`);
  return globalThis.__methode(`function (${parameter}) { ${q.slice(a, b + bis.length)} return ${rueck}; }`);
};

/* ---------- feste Welt: Uhrzeit, Zone, Langzeitstatistik ---------- */
const ZONE = 'Europe/Vienna';
const JETZT = Date.parse('2026-09-29T16:20:00+02:00');
const panel = new P();
const lokal = ms => panel.lokal(ms, ZONE);
const mitternacht = tag => panel.zoneMs(tag, '00:00', ZONE);
const plusTag = (tag, n) => { const d = new Date(tag + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const plusMonat = monat => { const [j, m] = monat.split('-').map(Number); return m === 12 ? `${j + 1}-01` : `${j}-${String(m + 1).padStart(2, '0')}`; };
function hashZahl(text) {   // 0 … 1, fest je Text (FNV-1a mit Nachmischen)
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const rund = (x, n = 4) => Math.round(x * 10 ** n) / 10 ** n;   // kurze Zahlen in den Vektoren
/* Stundenwerte eines Sensors an einem Tag (lokal): Heizung werktags 6–18 Uhr, am Wochenende nur Bereitschaft
   (knapp über 0,5 kWh am Tag, aber keine Heizzeit – so unterscheiden sich die zwei Heiztage-Regeln) */
const stundenCache = new Map();
function stunden(id, tag) {
  const k = id + '|' + tag;
  if (stundenCache.has(k)) return stundenCache.get(k);
  const beginn = mitternacht(tag), ende = mitternacht(plusTag(tag, 1)), wt = new Date(tag + 'T12:00:00Z').getUTCDay(), monat = +tag.slice(5, 7);
  const werktag = wt >= 1 && wt <= 5, winter = monat >= 10 || monat <= 4, liste = [];
  for (let t = beginn, h = 0; t < ende; t += 36e5, h++) {
    const r = hashZahl(`${id}|${t}`), arbeit = werktag && h >= 6 && h < 18;
    let p;
    if (/aussen/.test(id)) p = { mean: rund(8 - 9 * Math.cos((monat - 1) / 12 * 2 * Math.PI) + 3 * Math.sin((h - 9) / 24 * 2 * Math.PI) + 2 * r, 2) };
    else if (/temperatur/.test(id)) p = { mean: rund(17 + 3 * r, 2) };
    else if (/pumpzyklen/.test(id)) p = { change: r < .3 ? 1 : 0 };
    else if (/pumpzeit|pump_time/.test(id)) p = { change: rund(.3 * r) };
    else if (/heizzeit|heating_time/.test(id)) p = { change: arbeit && (winter || r > .4) ? rund(.2 + .5 * r) : 0 };
    else {   // Energie (kWh): „ohne Automatik“ rund um die Uhr
      const ohne = /ohne/.test(id);
      p = { change: rund(ohne ? 2.2 * (.8 + .4 * r) : arbeit ? 2.5 * (.6 + .6 * r) * (winter ? 1 : .5) : werktag ? .2 * (.6 + .6 * r) : .03 * (.8 + .4 * r)) };
    }
    liste.push({ t, ...p });
  }
  stundenCache.set(k, liste);
  return liste;
}
/* recorder/statistics_during_period wie HA: Stunden in UTC, Tage und Monate lokal; laufende Periode bis jetzt */
function statistik(m) {
  const von = Date.parse(m.start_time), bis = Math.min(Date.parse(m.end_time), JETZT), erg = {};
  const zusammen = (id, a, b) => {   // Stunden [a, b) zusammenfassen
    const h = [];
    for (let tag = lokal(a).slice(0, 10); mitternacht(tag) < b; tag = plusTag(tag, 1)) for (const x of stunden(id, tag)) if (x.t >= a && x.t < b && x.t < JETZT) h.push(x);
    if (!h.length) return null;
    if ('mean' in h[0]) return { mean: rund(h.reduce((s, x) => s + x.mean, 0) / h.length, 3) };
    return { change: rund(h.reduce((s, x) => s + x.change, 0)) };
  };
  for (const id of m.statistic_ids) {
    const punkte = [];
    if (m.period === 'hour') for (let t = von; t < bis; t += 36e5) { const w = zusammen(id, t, t + 36e5); if (w) punkte.push({ start: t, end: t + 36e5, ...w }); }
    else if (m.period === 'day') for (let tag = lokal(von).slice(0, 10); mitternacht(tag) < bis; tag = plusTag(tag, 1)) {
      const a = mitternacht(tag), b = mitternacht(plusTag(tag, 1)), w = zusammen(id, Math.max(a, von), b); if (w) punkte.push({ start: a, end: b, ...w }); }
    else for (let mon = lokal(von).slice(0, 7); mitternacht(mon + '-01') < bis; mon = plusMonat(mon)) {
      const a = mitternacht(mon + '-01'), b = mitternacht(plusMonat(mon) + '-01'), w = zusammen(id, Math.max(a, von), b); if (w) punkte.push({ start: a, end: b, ...w }); }
    erg[id] = punkte;
  }
  return erg;
}

/* ---------- Fake-hass: Befehle werden mitgeschrieben (Eingaben der Vektoren) ---------- */
let mitschrift = [];
const states = {};
const hass = {
  states, language: 'de', config: { version: '2026.9.4' },
  callWS: m => { const antwort = m.type === 'recorder/statistics_during_period' ? statistik(m) : null; mitschrift.push({ m, antwort }); return antwort; },
};
panel._hass = hass;
panel._holen = (key, holer) => holer();   // ohne Zwischenspeicher, gleich die Antwort
panel._auffrischen = () => {};
const holeMitschrift = f => { mitschrift = []; const r = f(); const m = mitschrift; mitschrift = []; return [r, m]; };
const setze = (eid, state) => { states[eid] = { entity_id: eid, state: String(state), attributes: {} }; };
function zustaendeLaden(strukturDatei, S) {
  for (const k of Object.keys(states)) delete states[k];
  const zDatei = strukturDatei.replace(/\.json$/, '.zustaende.json');
  if (fs.existsSync(zDatei)) { for (const [eid, z] of Object.entries(JSON.parse(fs.readFileSync(zDatei, 'utf8')).zustaende)) states[eid] = { entity_id: eid, state: z.state, attributes: z.attributes }; return; }
  // Beispiel wie tests/panel/test_panel.js (Referenz „dobl“); die anderen Baustellen ohne Zustände
  if (S.some(b => b.baustelle.entry_id === 'dobl')) {
    setze('sensor.dobl_energie', '412'); setze('sensor.dobl_energie_oelradiator', '240'); setze('sensor.dobl_heizzeit_oelradiator', '148');
    setze('sensor.dobl_energie_konvektor', '160'); setze('sensor.dobl_heizzeit_konvektor', '82'); setze('sensor.dobl_ersparnis', '515.2');
    setze('sensor.kalsdorf_energie_konvektor', '60'); setze('sensor.kalsdorf_heizzeit_konvektor', 'unavailable');
  }
}
const zustandWert = eid => { const s = panel.zustand(eid); return s && zahl(s.state) ? Number(s.state) : null; };
const iso = ms => new Date(ms).toISOString();
/* gleich bis auf Rundung (Summen je Tag statt je Monat addieren sich in anderer Reihenfolge) */
const gleich = (a, b) => { const t = x => JSON.stringify(x, (k, v) => typeof v === 'number' ? Number(v.toPrecision(10)) : v); return t(a) === t(b); };
const zahl = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));

/* ---------- Welten: jede Struktur, dazu Varianten mit Firmenwechsel mitten am Tag / im Monat ---------- */
function welten() {
  const liste = [];
  for (const f of STRUKTUREN) {
    const S = JSON.parse(fs.readFileSync(f, 'utf8')), name = path.basename(f, '.json');
    liste.push({ name, datei: f, S });
    if (S.some(b => b.baustelle.entry_id === 'dobl')) {   // Magazin wechselt heute 10:30 zu Leitner, Lager am 12.03. zu Huber
      const V = JSON.parse(JSON.stringify(S)), e = V.find(b => b.baustelle.entry_id === 'dobl').einstellungen;
      e.zuordnung = [...e.zuordnung, { bereich: 'magazin', firma: 'leitner', ab: '2026-09-29T10:30:00+02:00' }, { bereich: 'lager', firma: 'huber', ab: '2026-03-12T00:00:00+01:00' },
        { bereich: 'polier', firma: 'geloescht', ab: '2026-09-22T00:00:00+02:00' }];
      Object.assign(V.find(b => b.baustelle.entry_id === 'dobl').zaehler, { 'mittel:polier_r1': 1980, 'mittel:polier_r2': 40, 'mittel:schacht_p1': 450 });   // Je Gerät: Stunden ≈ kWh ÷ Ø kW
      liste.push({ name: name + '+wechsel', datei: f, S: V });
    }
  }
  return liste;
}
function laden(welt) {
  zustaendeLaden(welt.datei, welt.S);
  panel.alle = welt.S.map(r => panel.bauen(r));
  return panel.alle;
}
const waehle = (d, scope = 'diese', aw = 'Monat') => { panel.d = d; panel.s = { view: 'auswertung', awScope: scope, aw: { zeitraum: aw, auswahl: [] } }; };
const ART = ['Tag', 'Woche', 'Monat', 'Jahr'];
const energieIds = (d, b) => { const en = panel.eid(d, b.id, 'energie'); return en ? [en] : b.geraete.map(g => g.energie).filter(Boolean); };
const baustelleEin = d => ({ entry: d.entry, titel: d.titel, firmen: d.firmen, zuordnung: d.zuordnung,
  bereiche: d.bereiche.map(b => ({ id: b.id, name: b.name })) });

/* ---------- 1 Zeiträume ---------- */
function vektorZeitraum() {
  const faelle = [];
  for (const heute of ['2026-09-29', '2026-01-01', '2026-03-29', '2026-10-25', '2024-02-29', '2026-12-31']) {
    const d = { z: { HEUTE: heute, WOCHE_ISO: [plusTag(heute, -((new Date(heute + 'T12:00:00Z').getUTCDay() + 6) % 7))], zone: ZONE } };
    for (const art of ART) for (const versatz of [0, 1, 2, 13]) {
      const zr = panel.zeitraum(art, versatz, d);
      const beginne = [...Array(zr.n)].map((_, i) => panel.bucketMs(zr, i, d));
      faelle.push({ name: `${heute} ${art} −${versatz}`, eingabe: { art, heute, versatz, zone: ZONE },
        erwartet: { von: zr.von, bis: zr.bis, periode: zr.periode, n: zr.n, labels: zr.labels, monat: zr.monat ?? null, jahr: zr.jahr ?? null,
          beginne: beginne.map(iso), index: beginne.map(ms => zr.index(lokal(ms))) } });
    }
  }
  return { hinweis: 'zeitraum(art, versatz) und bucketMs der Seite; monat wie die Seite 0–11; index = Stelle des Beginns jeder Periode (lokal)', faelle };
}

/* ---------- 2 Statistik → Reihen je Zeitraum, Verbrauch je Container ---------- */
function vektorReihen(W) {
  const faelle = [];
  for (const welt of W.filter(w => !w.name.includes('+'))) {
    const alle = laden(welt);
    for (const d of alle.filter(x => x.aktiv)) for (const art of ART) for (const versatz of [0, 1]) {
      waehle(d);
      const [st, mit] = holeMitschrift(() => panel.statistik(art, versatz, d));
      const anfrage = mit[0];
      faelle.push({ name: `${welt.name} ${d.entry} ${art} −${versatz}`,
        eingabe: { art, versatz, heute: d.z.HEUTE, zone: ZONE, statistik: anfrage ? anfrage.antwort : {},
          bereiche: d.bereiche.map(b => ({ id: b.id, energie: energieIds(d, b) })) },
        erwartet: { anfrage: anfrage ? { start_time: anfrage.m.start_time, end_time: anfrage.m.end_time, period: anfrage.m.period } : null,
          werte: st.werte, verbrauch: Object.fromEntries(d.bereiche.map(b => [b.id, panel.verbrauch(d, b.id, art, versatz)])), summe: panel.verbrauch(d, null, art, versatz) } });
    }
  }
  return { hinweis: 'statistik()/verbrauch() der Seite: Recorder-Antwort → Wert je Stunde/Tag/Monat; Verbrauch je Container (Energie des Containers, sonst Summe der Geräte)', faelle };
}

/* ---------- 3 Abrechnung nach Firma (Tabelle, CSV) ---------- */
/* fachlich richtig (wie logik/auswertung.firma_am_tag, früher abrechnung.aufteilen): ein Tag gehört der Firma, der der Container zu Tagesbeginn gehört */
function firmaTag(l, bid, ms) { return panel.firma(panel.firmaAm(l, bid, mitternacht(lokal(ms).slice(0, 10))), l); }
function abrechnungRichtig(lauf, werte) {
  const zeilen = new Map();
  for (const l of lauf) for (const b of l.bereiche) for (const [ms, x] of werte[l.entry][b.id]) {
    if (!x) continue;
    const f = firmaTag(l, b.id, ms), key = f.eigen ? 'eigen' : f.name;
    if (!zeilen.has(key)) zeilen.set(key, { f, c: new Map(), kwh: 0 });
    const z = zeilen.get(key), ck = `${l.entry}|${b.id}`; z.kwh += x;
    if (!z.c.has(ck)) z.c.set(ck, { l, b, kwh: 0 }); z.c.get(ck).kwh += x;
  }
  return [...zeilen.values()].sort((a, b) => (b.f.eigen ? 1 : 0) - (a.f.eigen ? 1 : 0)).map(x => ({ ...x, c: [...x.c.values()] }));
}
const abrechnungAus = daten => daten.map(({ f, c, kwh }) => ({ firma: f.name, eigen: !!f.eigen, kwh, container: c.map(x => ({ entry: x.l.entry, bereich: x.b.id, kwh: x.kwh })) }));
function vektorAbrechnung(W) {
  const faelle = [];
  for (const welt of W) {
    const alle = laden(welt);
    for (const d of alle.filter(x => x.aktiv)) for (const scope of ['diese', 'alle']) {
      if (scope === 'alle' && d !== alle.find(x => x.aktiv)) continue;
      for (const art of ART) {
        waehle(d, scope, art);
        const lauf = scope === 'alle' ? panel.laufende() : [d], zr = panel.zeitraum(art);
        const seite = abrechnungAus(panel.abrechnungDaten(art)), csvFirma = panel.csv('firma'), csvVerbrauch = panel.csv();
        // Eingabe: kWh je Container und Periode (Beginn), beim Jahr dazu je Tag (Firma je Tag statt je Monat)
        const werte = {}, werteTag = {};
        for (const l of lauf) { werte[l.entry] = {}; for (const b of l.bereiche) werte[l.entry][b.id] = panel.verbrauch(l, b.id, art).map((x, i) => [panel.bucketMs(zr, i, l), x]); }
        if (art === 'Jahr') for (const l of lauf) {
          werteTag[l.entry] = {};
          for (const b of l.bereiche) {
            const ids = energieIds(l, b), st = statistik({ start_time: iso(mitternacht(zr.von)), end_time: iso(mitternacht(zr.bis)), statistic_ids: ids, period: 'day' }), je = new Map();
            for (const id of ids) for (const p of st[id]) je.set(p.start, (je.get(p.start) || 0) + p.change);
            werteTag[l.entry][b.id] = [...je.entries()].sort((a, b) => a[0] - b[0]);
          }
        }
        const quelleRichtig = art === 'Jahr' ? werteTag : werte;
        const richtig = abrechnungAus(abrechnungRichtig(lauf, quelleRichtig));
        // CSV fachlich richtig: Firma je Zeile nach dem Tagesbeginn (betrifft nur „Tag“, dort je Stunde)
        const fa = panel.firmaAm, bm = panel.bucketMs;
        panel.firmaAm = (l, bid, ms) => fa.call(panel, l, bid, mitternacht(lokal(ms).slice(0, 10)));
        panel.abrechnungDaten = () => abrechnungRichtig(lauf, quelleRichtig);
        const csvFirmaR = panel.csv('firma'), csvVerbrauchR = panel.csv();
        panel.firmaAm = fa; panel.bucketMs = bm; delete panel.abrechnungDaten;
        const aus = w => Object.fromEntries(Object.entries(w).map(([e, bs]) => [e, Object.fromEntries(Object.entries(bs).map(([bid, v]) => [bid, v.map(([ms, x]) => [iso(ms), x])]))]));
        const fall = { name: `${welt.name} ${d.entry} ${scope} ${art}`,
          eingabe: { art, heute: d.z.HEUTE, zone: ZONE, preis: d.e.preis, baustellen: lauf.map(baustelleEin), werte: aus(werte), ...(art === 'Jahr' ? { werte_tag: aus(werteTag) } : {}) },
          seite: { zeilen: seite, csv_firma: csvFirma, csv_verbrauch: csvVerbrauch },
          erwartet: { zeilen: richtig, csv_firma: csvFirmaR, csv_verbrauch: csvVerbrauchR } };
        if (!gleich(fall.seite, fall.erwartet)) fall.abweichung = art === 'Jahr'
          ? 'Seite ordnet beim Jahr den ganzen Monat der Firma am Monatsersten zu; richtig ist je Tag (werte_tag), wie der Bericht (logik/abrechnung.aufteilen).'
          : 'Seite ordnet bei „Tag“ jede Stunde der Firma zu dieser Stunde zu; richtig gilt ein Wechsel ab dem Folgetag (Firma zu Tagesbeginn), wie der Bericht.';
        faelle.push(fall);
      }
    }
  }
  return { hinweis: 'abrechnungDaten()/csv(\'firma\')/csv() der Seite; werte = kWh je Container und Periode [Beginn UTC, kWh]; erwartet = Firma je Tag (Tagesbeginn), bei Abweichung steht der Grund in abweichung', faelle };
}

/* ---------- 4 Heizperiode ---------- */
function vektorHeizperiode() {
  const faelle = [];
  for (const heute of ['2026-09-29', '2026-10-01', '2026-01-15', '2026-04-30', '2026-05-01', '2026-12-31'])
    for (const [von, bis] of [[10, 4], [11, 3], [1, 4], [9, 9], [12, 12], [4, 10]])
      for (const ende of [null, '2026-02-15', '2027-03-01']) {
        panel.d = { hp: [von, bis], ende, z: { HEUTE: heute } };
        const hp = panel.heizperiodeEnde();
        faelle.push({ name: `${heute} ${von}–${bis} ${ende || 'offen'}`, eingabe: { heute, von, bis, ende }, erwartet: { ende: hp, bis: ende && ende < hp ? ende : hp } });
      }
  return { hinweis: 'heizperiodeEnde() der Seite; bis = geplantes Ende, wenn es früher liegt (Text der Hochrechnung)', faelle };
}

/* ---------- 5 Verlauf: Heiztage, Monate, kWh je Monat, Kennzahlen, Verbrauch je Monat und Container ---------- */
function vektorVerlauf(W) {
  const faelle = [], kennz = [], monate = [];
  const vergleich = ausschnitt('v_verlauf', 'k, m', 'return m === \'tag\'', ': k.kwh;', 'null');   // Balken „Vergleich“ der Seite
  for (const welt of W.filter(w => !w.name.includes('+'))) {
    const alle = laden(welt);
    for (const x of alle) {
      panel.d = x;
      const [v, mit] = holeMitschrift(() => panel.verlaufWerte(x)), anfrage = mit[0];
      const container = x.bereiche.filter(b => !b.pumpe).map(b => panel.eid(x, b.id, 'heizzeit')).filter(Boolean);
      const heizzeit = anfrage && container.length ? statistik({ ...anfrage.m, statistic_ids: container }) : {};
      // richtig (Zähler `heiztage`, Bericht seit 0.7.9): Tage ab Beginn, an denen ein Container geheizt hat (Heizzeit > 0)
      const tage = new Set();
      for (const id of container) for (const p of heizzeit[id] || []) { const t = lokal(p.start).slice(0, 10); if (p.change > 0 && (!x.beginn || t >= x.beginn)) tage.add(t); }
      const zaehler = x.zaehler && zahl(x.zaehler.heiztage) ? Number(x.zaehler.heiztage) : null;
      const seite = { anfrage: anfrage ? { start_time: anfrage.m.start_time, end_time: anfrage.m.end_time } : null, heiztage: v.heiztage, monate: v.monate, je_monat: v.jeMonat };
      const erwartet = { ...seite, heiztage: zaehler ?? tage.size, monate: new Set([...tage].map(t => t.slice(0, 7))).size };
      const fall = { name: `${welt.name} ${x.entry}`, eingabe: { heute: x.z.HEUTE, zone: ZONE, beginn: x.beginn, ende: x.ende, heiztage_zaehler: zaehler,
        energie: anfrage ? anfrage.antwort[anfrage.m.statistic_ids[0]] : null, heizzeit: Object.fromEntries(container.map(id => [id, heizzeit[id] || []])) }, seite, erwartet };
      if (!gleich(seite, erwartet)) fall.abweichung = 'Ohne Zähler zählt die Seite Tage mit mehr als 0,5 kWh der ganzen Baustelle (auch Pumpen, Bereitschaft); richtig sind Tage mit Heizzeit eines Containers wie Zähler `heiztage` und Bericht (0.7.9). Monate = Monate mit einem Heiztag.';
      faelle.push(fall);
      // Kennzahlen (mit den Verlaufswerten der Seite – rein, ohne Abweichung)
      const k = panel.kennzahlen(x);
      kennz.push({ name: `${welt.name} ${x.entry}`,
        eingabe: { zaehler: x.zaehler, zustaende: { energie: zustandWert(panel.eid(x, x.entry, 'energie')), kosten: zustandWert(panel.eid(x, x.entry, 'kosten')), ersparnis: zustandWert(panel.eid(x, x.entry, 'ersparnis')) },
          preis: x.e.preis, container: x.bereiche.length, heiztage: k.heiztage, monate: k.monate },
        erwartet: { kwh: k.kwh, eur: k.eur, gespart: k.gespart, container: k.container, heiztage: k.heiztage, monate: k.monate,
          vergleich: { tag: vergleich(k, 'tag'), monat: vergleich(k, 'monat'), ges: vergleich(k, 'ges') } } });
      // Verbrauch je Monat und Container (abgeschlossene Baustelle, CSV der Detailseite)
      const [m, mitM] = holeMitschrift(() => panel.monateJeContainer(x)), aM = mitM[0];
      panel.s = { view: 'bsdetail', bs: x.entry };
      const csvM = panel.csv();
      monate.push({ name: `${welt.name} ${x.entry}`, eingabe: { heute: x.z.HEUTE, zone: ZONE, beginn: x.beginn, ende: x.ende, titel: x.titel, preis: x.e.preis,
        bereiche: x.bereiche.map(b => ({ id: b.id, name: b.name, energie: panel.eid(x, b.id, 'energie') })), statistik: aM ? aM.antwort : {} },
        erwartet: { anfrage: aM ? { start_time: aM.m.start_time, end_time: aM.m.end_time } : null, labels: m.labels, reihen: m.reihen.map(r => ({ name: r.name, v: r.v })), csv: csvM } });
    }
  }
  return [
    { hinweis: 'verlaufWerte() der Seite: Anfrage (seit Beginn bzw. 12 Monate), Heiztage (Zähler, sonst Ersatzweg), Monate, kWh je Monat; erwartet = Heiztage aus der Heizzeit', faelle },
    { hinweis: 'kennzahlen() und Balken „Vergleich“ (kWh je Heiztag, € je Monat, gesamt) der Seite', faelle: kennz },
    { hinweis: 'monateJeContainer() und CSV der Detailseite (Verbrauch je Monat und Container)', faelle: monate },
  ];
}

/* ---------- 6 Ölradiator oder Konvektor ---------- */
function vektorTypvergleich(W) {
  const faelle = [], weniger = ausschnitt('v_auswertung', 'T', 'const weniger =', ': null;', 'weniger');
  for (const welt of W.filter(w => !w.name.includes('+'))) {
    const alle = laden(welt);
    for (const d of alle) {
      waehle(d);
      const T = panel.typVergleich(), heiztage = panel.verlaufWerte(d).heiztage;
      faelle.push({ name: `${welt.name} ${d.entry}`,
        eingabe: { preis: d.e.preis, heiztage, zaehler: Object.fromEntries(Object.entries(d.zaehler).filter(([k]) => /^(aufheiz|abkuehl):/.test(k))),
          bereiche: d.bereiche.map(b => ({ id: b.id, geraete: b.geraete.map(g => ({ rolle: g.rolle, typ: g.gtyp ?? null })) })),
          energie: Object.fromEntries(['oelradiator', 'konvektor'].map(t => [t, zustandWert(panel.eid(d, d.entry, `energie_${t}`))])),
          heizzeit: Object.fromEntries(['oelradiator', 'konvektor'].map(t => [t, zustandWert(panel.eid(d, d.entry, `heizzeit_${t}`))])) },
        erwartet: { oelradiator: { kwh_h: T[0].kwhH, auf: T[0].auf, ab: T[0].ab, tag: T[0].tag }, konvektor: { kwh_h: T[1].kwhH, auf: T[1].auf, ab: T[1].ab, tag: T[1].tag }, weniger: weniger(T) } });
    }
  }
  return { hinweis: 'typVergleich() der Seite und „rund x % weniger“ (Ölradiator gegen Konvektor)', faelle };
}

/* ---------- 7 Wetter-Einfluss ---------- */
function vektorWetter(W) {
  const faelle = [], regression = ausschnitt('v_auswertung', 'pkt', 'const mx =', 'null0 = k < 0 ? -d0 / k : null;', '{ k, d0, null0 }');
  const erg = pkt => pkt.length < 5 ? null : regression(pkt);
  for (const welt of W.filter(w => !w.name.includes('+'))) {
    const alle = laden(welt);
    for (const d of alle.filter(x => x.aktiv)) {
      waehle(d);
      const [pkt, mit] = holeMitschrift(() => panel.tageswerte(d)), a = mit[0];
      faelle.push({ name: `${welt.name} ${d.entry}`, eingabe: { heute: d.z.HEUTE, zone: ZONE, aussen: panel.eid(d, d.entry, 'aussen'),
        energie: d.bereiche.map(b => panel.eid(d, b.id, 'energie')).filter(Boolean), statistik: a ? a.antwort : {} },
        erwartet: { anfrage: a ? { start_time: a.m.start_time, end_time: a.m.end_time } : null, punkte: pkt, regression: erg(pkt) } });
    }
  }
  const hand = { 'zu wenige': [[1, 20], [2, 18], [3, 16], [4, 14]], 'alle gleich warm': [[5, 20], [5, 18], [5, 16], [5, 14], [5, 12]],
    'wärmer = mehr': [[0, 10], [2, 12], [4, 15], [6, 15], [8, 19]], 'kälter = mehr': [[-4, 40], [-1, 33], [2, 30], [5, 22], [8, 17], [11, 8]] };
  for (const [name, punkte] of Object.entries(hand)) faelle.push({ name: `von Hand: ${name}`, eingabe: { punkte }, erwartet: { regression: erg(punkte) } });
  return { hinweis: 'tageswerte() und die Gerade in v_auswertung() der Seite (kWh je Tag gegen Tagesmittel außen, ab 5 Tagen)', faelle };
}

/* ---------- 8 Je Gerät ---------- */
function vektorJeGeraet(W) {
  const faelle = [], zeilen = ausschnitt('jeGeraet', 'z', 'const d = this.d', '}));', 'zeilen.map(({ b, g, mittel, kwh, std }) => ({ bereich: b.id, geraet: g.id, mittel, kwh, std }))');
  for (const welt of W) {
    const alle = laden(welt);
    for (const d of alle.filter(x => x.aktiv)) for (const art of ART) {
      waehle(d);
      const [z, mit] = holeMitschrift(() => zeilen.call(panel, art)), a = mit.find(x => x.m.types.length === 1);
      const pumpen = d.bereiche.flatMap(b => b.geraete.filter(g => g.rolle === 'pumpe').map(g => [g.id, panel.reihe(d, panel.eid(d, g.id, 'pumpzeit'), art)]));
      faelle.push({ name: `${welt.name} ${d.entry} ${art}`, eingabe: { art, zaehler: Object.fromEntries(Object.entries(d.zaehler).filter(([k]) => k.startsWith('mittel:'))),
        geraete: d.bereiche.flatMap(b => b.geraete.map(g => ({ id: g.id, bereich: b.id, rolle: g.rolle, energie: g.energie || null }))),
        statistik: a ? a.antwort : {}, pumpzeit: Object.fromEntries(pumpen) }, erwartet: { zeilen: z } });
    }
  }
  return { hinweis: 'jeGeraet() der Seite: Ø kW (Zähler mittel, ab 50 W), kWh aus dem Energiezähler, Stunden ≈ kWh ÷ Ø kW (Pumpen: Pumpzeit)', faelle };
}

/* ---------- schreiben oder prüfen ---------- */
const W = welten();
const [verlauf, kennzahlen, monate] = vektorVerlauf(W);
const dateien = {
  'auswertung-zeitraum.json': vektorZeitraum(), 'auswertung-reihen.json': vektorReihen(W), 'auswertung-abrechnung.json': vektorAbrechnung(W),
  'auswertung-heizperiode.json': vektorHeizperiode(), 'auswertung-verlauf.json': verlauf, 'auswertung-kennzahlen.json': kennzahlen,
  'auswertung-monate.json': monate, 'auswertung-typvergleich.json': vektorTypvergleich(W), 'auswertung-wetter.json': vektorWetter(W),
  'auswertung-je-geraet.json': vektorJeGeraet(W),
};
let rot = 0;
for (const [name, inhalt] of Object.entries(dateien)) {
  // ein Fall je Zeile: klein genug fürs Repo und trotzdem mit git diff lesbar
  const text = `{"quelle": "tests/vektoren/erzeugen.js",\n "hinweis": ${JSON.stringify(inhalt.hinweis)},\n "faelle": [\n${inhalt.faelle.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`;
  const ziel = path.join(ZIEL, name);
  if (pruefen) { if (!fs.existsSync(ziel) || fs.readFileSync(ziel, 'utf8') !== text) { console.error(`${name}: weicht ab`); rot++; } }
  else fs.writeFileSync(ziel, text);
  const abw = (inhalt.faelle || []).filter(f => f.abweichung).length;
  console.log(`${name}: ${inhalt.faelle.length} Fälle${abw ? `, ${abw} mit Abweichung` : ''}`);
}
process.exit(rot ? 1 : 0);
