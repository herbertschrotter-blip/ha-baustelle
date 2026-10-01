// Beispiel-hass der Seite „Baustelle“: Zustände, Statistik, Verlauf und Antworten der Integration wie im echten HA.
// Eine Quelle für den Panel-Test (tests/panel/test_panel.js, Node) und das Master-Mockup (mockups/glas.html, Browser).
// beispielHass({ STRUKTUR, REFERENZ, ZUSTAENDE, VEKTOR, WELT, JETZT, welt, fehlt, haengt, mit, mitRest })
//   welt(): aktuelle Baustellen (der Test tauscht sie aus) · fehlt()/haengt(): Struktur-Fehler bzw. hängt
//   mit(m)/mitRest(r): jeden WebSocket- bzw. REST-Aufruf mitschreiben
(function (wurzel) {
'use strict';
function beispielHass({ STRUKTUR, REFERENZ = false, ZUSTAENDE = null, VEKTOR = {}, WELT = null, JETZT = Date.parse('2026-09-29T16:20:00+02:00'),
  welt = () => STRUKTUR, fehlt = () => false, haengt = () => false, mit = () => {}, mitRest = () => {} }) {
  const api = [];
  const zufall = s => () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const hash = t => { let h = 7; for (const c of t) h = (h * 31 + c.charCodeAt(0)) % 100003; return h; };
  function statistik(m) {
    const von = Date.parse(m.start_time), bis = Math.min(Date.parse(m.end_time || new Date(JETZT).toISOString()), JETZT), erg = {};
    for (const id of m.statistic_ids) {
      const r = zufall(hash(id + m.period)), punkte = [];
      for (let t = von; t < bis;) {
        const h = new Date(t).getUTCHours() + 2, tag = new Date(t).getUTCDay();
        let p = {};
        if (/aussen|temperatur/.test(id)) p = { mean: id.includes('aussen') ? 4 + 3 * Math.sin((h - 9) / 24 * 2 * Math.PI) + r() : 17 + r() * 3 };
        else if (/pumpzyklen/.test(id)) p = { change: Math.round((m.period === 'hour' ? 1 : 30) * r()) };
        else if (/heizzeit|pumpzeit/.test(id)) p = { change: (m.period === 'hour' ? .7 : m.period === 'day' ? 6 : 150) * r() };
        else p = { change: (m.period === 'hour' ? (h >= 6 && h < 18 ? 2.5 : .2) : m.period === 'day' ? (tag === 0 || tag === 6 ? 2 : 14) : 300) * (.6 + r() * .6) * (id.includes('ohne') ? 4 : 1) };
        punkte.push({ start: t, end: t + 36e5, ...p });
        if (m.period === 'hour') t += 36e5; else if (m.period === 'day') t += 864e5; else { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + 1); t = d.getTime(); }
      }
      erg[id] = punkte;
    }
    return erg;
  }
  function verlauf(m) {
    const von = Date.parse(m.start_time), erg = {};
    for (const id of m.entity_ids) {
      const liste = [];
      for (let t = von, k = 0; t < JETZT; t += 20 * 6e4, k++) {
        const h = (new Date(t).getUTCHours() + 2) % 24, an = h >= 6 && h < 17 && k % 3 !== 2;
        liste.push({ s: id.includes('lager_r') && t > Date.parse('2026-09-29T10:42:00+02:00') ? 'unavailable' : an ? '1980' : '0.4', lu: t / 1000 });
      }
      erg[id] = liste;
    }
    return erg;
  }
  const meldungen = [
    { id: 'm1', art: 'wunsch', text: 'Eigene Kachel für Bautrockner mit Laufzeit, damit man sie der Firma verrechnen kann.', kontext: 'Übersicht', zeit: '2026-09-28T17:02:00+02:00', version: '0.7.0', geraet: 'Handy', status: 'offen', stand: null },
    { id: 'm2', art: 'fehler', text: 'Nebel-Symbol war im Dunkelmodus kaum zu sehen.', kontext: 'Übersicht · Wetter', zeit: '2026-09-28T20:15:00+02:00', version: '0.6.2', geraet: 'Desktop', status: 'erledigt', stand: null }];
  const states = {};
  const setze = (eid, state, attributes = {}) => { states[eid] = { entity_id: eid, state: String(state), attributes: { friendly_name: eid.split('.')[1].replace(/_/g, ' '), ...attributes } }; };
  for (const b of STRUKTUR) for (const eid of Object.values(b.entitaeten)) setze(eid, eid.startsWith('switch') || eid.startsWith('binary') ? 'on' : '12.5');
  for (const b of STRUKTUR) for (const g of b.geraete) { setze(g.schalter, 'on', { friendly_name: `${g.name} ${g.bereich}` }); setze(g.leistung, '1980', { device_class: 'power' }); }
  setze('sun.sun', 'above_horizon', { elevation: 18, rising: false });
  if (ZUSTAENDE) for (const [eid, z] of Object.entries(ZUSTAENDE.zustaende)) states[eid] = { entity_id: eid, state: z.state, attributes: z.attributes };   // echte Zustände
  if (REFERENZ) {
    setze('sensor.dobl_energie', '412', {}); setze('sensor.dobl_energie_oelradiator', '240'); setze('sensor.dobl_heizzeit_oelradiator', '148'); setze('sensor.dobl_energie_konvektor', '160'); setze('sensor.dobl_heizzeit_konvektor', '82');
    setze('sensor.dobl_ersparnis', '515.2');
    setze('sun.sun', 'above_horizon', { elevation: 18, rising: false });
    setze('weather.dobl', 'rainy', { friendly_name: 'Open-Meteo Dobl', temperature: 4.2, apparent_temperature: 1 });
    setze('weather.kalsdorf', 'cloudy', { friendly_name: 'Open-Meteo Kalsdorf', temperature: 4.6 });
    for (const t of ['polier', 'mannschaft', 'sanitaer', 'besprechung']) setze(`sensor.${t}_temperatur`, '19', { device_class: 'temperature', friendly_name: `${t} Temperatur` });
    setze('binary_sensor.tuer_polier', 'off', { device_class: 'door', friendly_name: 'Tür Polier' });
    setze('binary_sensor.tuer_magazin', 'on', { device_class: 'door', friendly_name: 'Tür Magazin' });
    setze('binary_sensor.tuer_mannschaft', 'off', { device_class: 'door', friendly_name: 'Tür Mannschaft (neu)' });
    setze('switch.heizung_03', 'off', { friendly_name: 'Heizung 03' }); setze('switch.heizung_04', 'off', { friendly_name: 'Heizung 04' });
    setze('calendar.besprechungen', 'off', { friendly_name: 'Besprechungen' }); setze('calendar.baustelle_urlaub', 'off', { friendly_name: 'Baustelle Urlaub' });
    setze('calendar.feiertage_oesterreich', 'off', { friendly_name: 'Feiertage' }); setze('notify.mobile_app_handy_herbert', 'unknown', { friendly_name: 'Handy Herbert' });
    setze('sensor.regen_dobl', '6', { device_class: 'precipitation' });
  }
  const vorhersage = art => art === 'daily'
    ? ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((t, i) => ({ datetime: `${t}T12:00:00+02:00`, condition: ['rainy', 'fog', 'partlycloudy', 'rainy', 'sunny'][i], temperature: [9, 7.1, 9.4, 8.2, 11][i], templow: [2, -1.2, 1.8, 4.1, 3][i], precipitation: [6, 0, 0, 5.5, 0][i], precipitation_probability: [90, 10, 15, 80, 5][i] }))
    : [...Array(30)].map((_, i) => ({ datetime: new Date(JETZT + (i + 1) * 36e5 - 20 * 6e4).toISOString(), condition: i < 2 ? 'rainy' : i < 5 ? 'cloudy' : 'clear-night', temperature: 3.8 - i * .3, precipitation: i < 2 ? .8 - i * .4 : 0, precipitation_probability: Math.max(0, 70 - i * 15) }));
  /* ---------- Auswertung und Abrechnung wie die Integration (api §8) ----------
     Die Seite rechnet nichts Fachliches mehr. Für die Beispiel-Welten nimmt der Fake die Werte, die logik/auswertung.py für
     genau diese Baustellen liefert (tests/vektoren/auswertung-*.json, `erwartet`), sonst einfache erfundene Werte. */
  const vektorFall = (art, name) => WELT ? (VEKTOR[art] || []).find(f => f.name === `${WELT} ${name}`) : undefined;
  const zz = (v, d) => Number(v).toFixed(d).replace('.', ',');
  const csvText = zeilen => '\ufeff' + zeilen.join('\r\n');
  function perioden(z, heute) { const [j, m] = heute.split('-').map(Number); return { Tag: 24, Woche: 7, Monat: new Date(Date.UTC(j, m, 0)).getUTCDate(), Jahr: 12 }[z]; }
  function fakeAbrechnung(m) {
    const b = welt().find(x => x.baustelle.entry_id === m.entry_id), preis = (b.einstellungen || {}).preis ?? 0;
    const lauf = m.scope === 'alle' ? welt().filter(x => (x.baustelle.status || 'aktiv') !== 'abgeschlossen') : [b];
    const f = vektorFall('abrechnung', `${m.entry_id} ${m.scope} ${m.zeitraum}`);
    const titel = e => (welt().find(x => x.baustelle.entry_id === e) || { baustelle: { titel: e } }).baustelle.titel;
    const name = (e, bid) => ((welt().find(x => x.baustelle.entry_id === e) || { bereiche: [] }).bereiche.find(x => x.id === bid) || { name: bid }).name;
    const zeilen = f ? f.erwartet.zeilen : [{ firma: 'Eigene Firma', eigen: true, kwh: 0, container: lauf.flatMap(l => l.bereiche.map((c, i) => ({ entry: l.baustelle.entry_id, bereich: c.id, kwh: 10 + i }))) }];
    if (!f) zeilen[0].kwh = zeilen[0].container.reduce((a, c) => a + c.kwh, 0);
    const ges = zeilen.reduce((a, z) => a + z.kwh, 0), n = perioden(m.zeitraum, b.baustelle.heute || '2026-09-29');
    const csvFirma = f ? f.erwartet.csv_firma : ['Zeitraum;Firma;Baustelle;Container;kWh;Preis €/kWh;Betrag €', ...zeilen.flatMap(z => z.container.map(c => [m.zeitraum, z.firma, titel(c.entry), name(c.entry, c.bereich), zz(c.kwh, 2), zz(preis, 2), zz(c.kwh * preis, 2)].join(';')))];
    const csvVerbrauch = f ? f.erwartet.csv_verbrauch : ['Zeit;Baustelle;Firma;Container;kWh;Kosten €', ...zeilen[0].container.flatMap(c => [...Array(n)].map((_, i) => [`${i + 1}.`, titel(c.entry), 'Eigene Firma', name(c.entry, c.bereich), zz(c.kwh / n, 3), zz(c.kwh / n * preis, 2)].join(';')))];
    return { zeitraum: { art: m.zeitraum, n }, preis, kwh: ges,
      firmen: zeilen.map(z => ({ id: z.eigen ? 'eigen' : z.firma, firma: z.firma, eigen: z.eigen, kwh: z.kwh, eur: z.kwh * preis, anteil: ges ? z.kwh / ges * 100 : 0,
        container: z.container.map(c => ({ ...c, titel: titel(c.entry), name: name(c.entry, c.bereich), eur: c.kwh * preis })) })),
      reihen: Object.fromEntries(zeilen.filter(z => z.kwh).map(z => [z.eigen ? 'eigen' : z.firma, Array(n).fill(z.kwh / n)])),
      csv: { firma: csvText(csvFirma), verbrauch: csvText(csvVerbrauch) } };
  }
  function fakeAuswertung(m) {
    const b = welt().find(x => x.baustelle.entry_id === m.entry_id), id = m.entry_id, zl = b.zaehler || {}, preis = (b.einstellungen || {}).preis ?? 0;
    if (m.teil === 'verlauf') {
      const k = vektorFall('kennzahlen', id), v = vektorFall('verlauf', id), mo = vektorFall('monate', id);
      const kwh = k ? k.erwartet.kwh : zl.energie ?? 0, heiztage = zl.heiztage ?? (k ? k.erwartet.heiztage : 0);
      const roh = mo ? mo.erwartet.reihen.map((r, i) => ({ bereich: (b.bereiche[i] || {}).id || null, ...r })) : b.bereiche.map(c => ({ bereich: c.id, name: c.name, v: [50] }));
      const ges = roh.reduce((a, r) => a + r.v.reduce((x, y) => x + y, 0), 0);   // kWh, € und Anteil je Container wie logik/auswertung.monate_summen
      const reihen = roh.map(r => { const s = r.v.reduce((x, y) => x + y, 0); return { ...r, kwh: s, eur: s * preis, anteil: ges ? s / ges * 100 : 0 }; });
      return { kwh, eur: k ? k.erwartet.eur : zl.kosten ?? 0, gespart: k ? k.erwartet.gespart : null, container: b.bereiche.length, heiztage, monate: k ? k.erwartet.monate : 1,
        vergleich: k ? k.erwartet.vergleich : { tag: heiztage ? kwh / heiztage : 0, monat: 0, ges: kwh }, je_monat: v ? v.erwartet.je_monat : { '2026-09': 100 },
        monate_je_container: { labels: mo ? mo.erwartet.labels : ['Sep'], reihen },
        csv: csvText(mo ? mo.erwartet.csv : ['Monat;Baustelle;Container;kWh;Kosten €', ...reihen.map(r => ['Sep', b.baustelle.titel, r.name, zz(r.v[0], 2), zz(r.v[0] * preis, 2)].join(';'))]) };
    }
    const abr = fakeAbrechnung({ ...m, versatz: 0 }), kwh = abr.kwh, pumpen = b.geraete.some(g => g.rolle === 'pumpe');
    const tv = vektorFall('typvergleich', id), w = vektorFall('wetter', id), g = vektorFall('je-geraet', `${id} ${m.zeitraum}`), leer = { kwh_h: null, auf: null, ab: null, tag: null };
    const ende = (b.baustelle.optionen || {}).ende;
    return { zeitraum: abr.zeitraum, preis,
      summen: { kwh, eur: kwh * preis, heizzeit: 42.5, pumpzeit: pumpen ? 3.25 : 0, ohne: kwh * 3, vorher: { kwh: kwh * .9, heizzeit: 40, pumpzeit: pumpen ? 3 : 0 },
        veraenderung: { kwh: kwh ? 11 : null, heizzeit: 6, pumpzeit: pumpen ? 8 : null }, ohne_automatik: kwh ? { ohne_eur: kwh * 3 * preis, gespart_eur: kwh * 2 * preis, prozent: 66.7 } : null },
      je_geraet: (g ? g.erwartet.zeilen : b.geraete.map(x => ({ bereich: x.bereich, geraet: x.id, mittel: null, kwh: 1.5, std: null }))).map(z => ({ ...z, eur: z.kwh === null ? null : z.kwh * preis })),
      wetter: w ? { punkte: w.erwartet.punkte, gerade: w.erwartet.regression && { ...w.erwartet.regression, eur_je_grad: w.erwartet.regression.k < 0 ? -w.erwartet.regression.k * preis : null } } : { punkte: [], gerade: null },
      typ: tv ? tv.erwartet : { oelradiator: leer, konvektor: leer, weniger: null },
      heizperiode: { ende: '2026-04-30', bis: ende && ende < '2026-04-30' ? ende : '2026-04-30' }, heiztage: zl.heiztage ?? 0,
      hochrechnung: { bisher_kwh: 412, bisher_eur: 115.36, mit_kwh: 2310, mit_eur: 646.8, ohne_kwh: 10626, ohne_eur: 2975.28, gespart_eur: 2328.48 },
      // WU-0005: Rangliste und Erkenntnisse (wie logik/auswertung.rangliste/erkenntnisse)
      rangliste: b.bereiche.filter(c => c.art !== 'pumpenschacht').map((c, i) => ({ bereich: c.id, name: c.name, baustelle: b.baustelle.titel, kwh: 40 - i * 5, heizzeit: 20 - i, eur: (40 - i * 5) * preis, kwh_h: (40 - i * 5) / (20 - i), anteil: 0 })),
      erkenntnisse: kwh ? [{ art: 'gespart', eur: kwh * 2 * preis, prozent: 66.7 }, { art: 'groesster', bereich: b.bereiche[0].id, name: b.bereiche[0].name, kwh: 40, anteil: 38 }, { art: 'wetter', kwh_je_grad: 7.2, eur_je_grad: 2, null0: 15.5 }, { art: 'mehr', prozent: 18 }] : [] };
  }
  const hass = {
    states, themes: { darkMode: true }, config: { version: '2026.9.4' }, language: 'de',
    connection: { subscribeMessage: (cb, msg) => { cb({ type: msg.forecast_type, forecast: vorhersage(msg.forecast_type) }); return Promise.resolve(() => {}); } },
    callWS: async m => {
      mit(m);
      switch (m.type) {
        case 'baustelle/struktur': if (fehlt()) throw { code: 'unknown_command', message: 'Unknown command.' }; if (haengt()) return new Promise(() => {}); return JSON.parse(JSON.stringify(welt()));
        case 'recorder/statistics_during_period': return statistik(m);
        case 'baustelle/auswertung': return fakeAuswertung(m);
        case 'baustelle/abrechnung': return fakeAbrechnung(m);
        case 'history/history_during_period': return verlauf(m);
        case 'baustelle/protokoll': { const b = welt().find(x => x.baustelle.entry_id === m.entry_id); const p = b.laufzeit.protokoll.length ? b.laufzeit.protokoll : [['2026-04-17T12:00:00+02:00', 'einstellung', null, 'Baustelle abgeschlossen – Heizung aus, Werte gespeichert'], ['2026-03-03T06:00:00+02:00', 'warnung', `${m.entry_id}-3`, 'Frostgefahr 3,8 °C trotz Frostschutz'], ['2026-03-02T11:00:00+02:00', 'ok', `${m.entry_id}-3`, 'wieder über 5 °C']];
          return [...p, ...p.map(e => [e[0].replace('2026-09-2', '2026-09-1'), ...e.slice(1)])].slice(0, m.limit); }
        case 'baustelle/meldungen': return JSON.parse(JSON.stringify(meldungen));
        case 'baustelle/bericht': { const b = welt().find(x => x.baustelle.entry_id === m.entry_id), mon = m.art === 'monat', titel = b ? b.baustelle.titel : '';   // wie nachrichten.async_bericht_vorschau
          return { art: m.art, von: mon ? '2026-08-01' : '2026-09-21', bis: mon ? '2026-08-31' : '2026-09-27', betreff: `Baustelle ${titel} – ${mon ? 'August 2026' : 'Woche 21.–27.09.2026'}`,
            summe: mon ? 'August: 1 480 kWh · 414,40 €' : 'Vorwoche: 312 kWh · 87,47 €', vergleich: mon ? '(+31 % zum Juli)' : '(−4 % zur Woche davor)',
            firmen: [{ name: 'Eigene Firma', kwh: 250, eur: 70 }, { name: 'Elektro Huber GmbH', kwh: 62.4, eur: 17.47 }], container: (b ? b.bereiche : []).map((c, i) => ({ name: c.name, kwh: 10 * i })),
            heiztage: 5, gespart_eur: null, warnungen: [{ bereich: 'Lager Süd', titel: 'nicht erreichbar' }, { bereich: null, titel: 'Keine Wettervorhersage' }], mail_an: 'herbert@example.at', anhang: mon ? 'abrechnung-2026-08.csv' : 'abrechnung-kw39.csv', handy: true }; }
        case 'auth/sign_path': return { path: `${m.path}?authSig=abc` };
        case 'baustelle/setzen': { const b = welt().find(x => x.baustelle.entry_id === m.entry_id); let o = b.einstellungen;   // wie die Integration: Wert bleibt gespeichert
          for (const k of m.pfad.slice(0, -1)) o = o[k] ||= {}; o[m.pfad.at(-1)] = m.wert; return { ok: true }; }
        default: return { ok: true };
      }
    },
    callApi: async (methode, pfad, daten) => {   // REST wie die Seite ihn ruft; mitgeschrieben für test_abgleich.py
      const antwort = await callApiFake(methode, pfad, daten);
      mitRest({ type: 'rest', methode, pfad, daten: daten ?? null, antwort: methode === 'GET' ? null : JSON.parse(JSON.stringify(antwort ?? null)) });
      return antwort;
    },
    callService: async () => { throw new Error('Die Seite soll Dienste nicht direkt aufrufen'); },
  };
  async function callApiFake(methode, pfad, daten) {
    {
      api.push([methode, pfad, daten]);
      if (methode === 'GET' && ZUSTAENDE) return JSON.parse(JSON.stringify((ZUSTAENDE.kalender || {})[pfad.split('?')[0].slice(10)] || []));   // echte Kalender
      if (methode === 'GET' && pfad.startsWith('calendars/calendar.feiertage')) return [['2026-10-26', 'Nationalfeiertag'], ['2026-11-01', 'Allerheiligen'], ['2026-12-08', 'Mariä Empfängnis'], ['2026-12-25', 'Christtag'], ['2026-12-26', 'Stefanitag']]
        .map(([t, n], i) => ({ summary: n, start: { date: t }, end: { date: t }, uid: 'f' + i }));
      if (methode === 'GET') return [{ summary: 'Weihnachten', start: { date: '2026-12-23' }, end: { date: '2027-01-07' }, uid: 'urlaub-1' }];
      if (methode === 'DELETE') return {};
      if (/flow$/.test(pfad)) return { type: 'form', flow_id: 'F' + api.length };
      if (pfad.includes('subentries') && daten && daten.art) {   // neuer Bereich → erscheint in der Struktur
        const b = welt()[0]; if (!b.bereiche.some(x => x.name === daten.name)) b.bereiche.push({ id: 'neu-' + b.bereiche.length, name: daten.name, art: daten.art, fuehler: daten.fuehler || null, nr: b.bereiche.length });
        return { type: 'create_entry' };
      }
      if (pfad.includes('subentries')) return api.some(a => a[2] && a[2].subentry_id) ? { type: 'abort', reason: 'reconfigure_successful' } : { type: 'create_entry' };
      if (pfad.includes('options')) return { type: 'create_entry' };
      return { type: 'create_entry', result: { entry_id: 'neu' }, next_flow: ['config_subentries_flow', 'S1'] };
    }
  }

  return { hass, states, api, meldungen, setze, statistik, verlauf, vorhersage, fakeAuswertung, fakeAbrechnung };
}
if (typeof module === 'object' && module.exports) module.exports = { beispielHass };
else wurzel.beispielHass = beispielHass;
})(typeof globalThis !== 'undefined' ? globalThis : this);
