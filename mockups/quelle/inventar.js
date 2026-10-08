// BSM-031.04: Vorschlag „Container-Inventar“ in vier Varianten auf Basis des Master-Mockups (docs/bauplan-inventar.md §1–§6).
// Baut mockups/inventar.html: node mockups/quelle/inventar.js   ·   prüfen: node mockups/quelle/vorschau/pruefen.cjs mockups/inventar.html
//
// Varianten (Herbert 08.10.2026, umschaltbar in der Vorführ-Leiste; gleiche Beispieldaten und Inhalte):
//   1 Einstellungen-Gruppe „📦 Inventar“ – Vorschau als Tabelle (Was / Alt / Neu / Zustand)
//   2 Eigener Reiter „Inventar“ mit Container-Kacheln (Symbol) – Vorschau als Karten je Gerät
//   3 Im Container selbst (Kopf mit Nummer/Art, Abschnitt Inventar), Liste nur als Suche ⌕ – Vorschau zum Aufklappen je Gruppe
//   4 Assistent Schritt für Schritt (Art → Nummer/Firma → Ausrüstung → Vorschau → Übernehmen), Liste unter Einstellungen –
//     Vorschau Vorher/Nachher nebeneinander
//
// Gebaut mit dem Rahmen (quelle/rahmen.js): Einstellungen-Gruppe (V1, V4), Reiter (V2), Abschnitte in der Container-Ansicht
// (V3) und Einblendungen „inv-…“ hängen über R.gruppe/R.reiter/R.abschnitt/R.einblendung in der echten Seite. Container-Symbol
// aus quelle/archiv/container-zeichner.js (BSM-032). Namen, Nummern, Konflikte und Verweise kommen später fertig von der
// Integration (logik/inventar.py, baustelle/inventar*); das Mockup bildet sie nur nach. Keine echten MACs, Koordinaten, Tokens.
// Bilder: node mockups/quelle/inventar.js --bilder <ordner>
const rahmen = require('./rahmen');
const ZEICHNER = require('./archiv/container-zeichner.js');

/* Läuft nur im Browser (als Text eingesetzt, Node führt es nie aus) */
function browser(R) {
  const { html, nothing } = R;
  const VARIANTE = { 1: 'Einstellungen-Gruppe · Vorschau als Tabelle', 2: 'Eigener Reiter · Vorschau als Karten je Gerät', 3: 'Im Container · Vorschau zum Aufklappen', 4: 'Assistent · Vorschau Vorher/Nachher' };

  /* ---------- Beispieldaten (später von der Integration: baustelle/inventar) ---------- */
  const ART = { POL: 'Polier', MAN: 'Mannschaft', BES: 'Besprechung', BUE: 'Büro', LAG: 'Lager', MAT: 'Material', SAN: 'Sanitär', TRO: 'Trocken' };
  const GERAET = { PLUG: 'Shelly Plug', HZ: 'Heizkörper', TEMP: 'Shelly H&Temp Sensor', DOOR: 'Shelly Door Sensor', FEN: 'Shelly Door Sensor', PUMP: 'Pumpe', BTR: 'Bautrockner' };
  const GERAET_IC = { PLUG: '🔌', HZ: '♨', TEMP: '🌡', DOOR: '🚪', FEN: '🪟', PUMP: '💧', BTR: '💨' };
  const FARBE = { POL: '#3987e5', MAN: '#199e70', BES: '#d55181', BUE: '#c98500', LAG: '#8e8e93', MAT: '#d95926', SAN: '#2a78d6', TRO: '#008300' };
  const BS = { dobl: 'ÖWG Dobl Zwaring', kalsdorf: 'Reihenhäuser Kalsdorf', lieboch: 'Wohnanlage Lieboch', wundschuh: 'Volksschule Wundschuh' };
  const FIRMEN = [{ id: 'strabag', name: 'Strabag AG', kuerzel: 'STRA' }, { id: 'huber', name: 'Elektro Huber GmbH', kuerzel: 'HUBE' }, { id: 'leitner', name: 'Installateur Leitner', kuerzel: '' }];
  let zaehler = 0;
  const A = (typ, gg, modell, alt, x = {}) => ({ id: 'a' + (++zaehler), typ, gg, modell, status: 'aktiv', alt, ...x });
  const plugIds = s => ({ switch: 'switch.' + s, leistung: 'sensor.' + s + '_leistung', energie: 'sensor.' + s + '_energie' });
  const INV = window.INV = { v: 1, filter: 'alle', lage: 'normal', umb: {}, protokoll: [], suche: '',
    container: [
      { id: 'c1', nr: 1, art: 'POL', status: 'aktiv', angelegt: '05.10.2026', bs: 'dobl', bereich: 'polier', bName: 'Poliercontainer',
        ausr: [A('PLUG', 1, 'Shelly Plug S Gen3', { ha: '001-01_C_PLUG_POL', plug: '001-01_C_PLUG_POL', ids: plugIds('heizung_01') }, { hz: { typ: 'Radiator', nr: 1, alt: 'Radiator 1' } }),
          A('PLUG', 2, 'Shelly Plug S Gen3', { ha: '001-02_C_PLUG_POL', plug: '001-02_C_PLUG_POL', ids: plugIds('heizung_02') }, { hz: { typ: 'Konvektor', nr: 1, alt: 'Radiator 2' } }),
          A('TEMP', 0, 'Shelly H&T Gen3', { ha: '001_C_TEMP_POL', ids: { temperatur: 'sensor.polier_temperatur', feuchte: 'sensor.polier_feuchte', batterie: 'sensor.polier_batterie' } })],
        einsaetze: [['dobl', 'Poliercontainer', '01.09.2026', null, '286 kWh · 22 Heiztage'], ['wundschuh', 'Polier', '09.03.2026', '28.08.2026', '412 kWh · 51 Heiztage'], ['lieboch', 'Polier', '14.10.2025', '27.02.2026', '1.904 kWh · 96 Heiztage']] },
      { id: 'c2', nr: 2, art: 'MAN', status: 'aktiv', angelegt: '05.10.2026', bs: 'dobl', bereich: 'mannschaft', bName: 'Mannschaft',
        ausr: [A('PLUG', 1, 'Shelly Plug S Gen3', { ha: 'Heizung 02', plug: 'heizung-02', ids: plugIds('mannschaft_k') }, { hz: { typ: 'Konvektor', nr: 1, alt: 'Konvektor' }, gateway: true }),
          A('PLUG', 2, 'Shelly Plug S Gen3', { ha: 'Heizung 03', plug: 'heizung-03', ids: plugIds('mannschaft_r1') }, { hz: { typ: 'Radiator', nr: 1, alt: 'Radiator 1' } }),
          A('PLUG', 3, 'Shelly Plug S Gen3', { ha: 'Trockner Mannschaft', plug: 'trockner', ids: plugIds('mannschaft_t') }, { btr: { alt: 'Trockner' }, status: 'verliehen' }),
          A('TEMP', 0, 'Shelly H&T Gen3', { ha: 'Temperatur Mannschaft', bthome: 'Fühler Mannschaft', ids: { temperatur: 'sensor.mannschaft_temperatur', feuchte: 'sensor.mannschaft_feuchte', batterie: 'sensor.mannschaft_batterie' } }),
          A('DOOR', 0, 'Shelly BLU Door/Window', { ha: 'Türsensor 01', bthome: 'tursensor_01', ids: { tuer: 'binary_sensor.tursensor_01_tuer', batterie: 'sensor.tursensor_01_batterie' } })],
        einsaetze: [['dobl', 'Mannschaft', '01.09.2026', null, '641 kWh · 22 Heiztage'], ['kalsdorf', 'Mannschaft Kalsdorf', '02.03.2026', '29.08.2026', '388 kWh · 40 Heiztage']] },
      { id: 'c3', nr: 3, art: 'MAN', status: 'aktiv', angelegt: '05.10.2026', bs: 'kalsdorf', bereich: 'k-mannschaft', bName: 'Mannschaft Kalsdorf',
        ausr: [A('PLUG', 1, 'Shelly Plug S Gen3', { ha: 'Heizung 05', plug: 'heizung-05', ids: plugIds('k_mannschaft_r1') }, { hz: { typ: 'Konvektor', nr: 1, alt: 'Radiator 1' } }),
          A('PLUG', 2, 'Shelly Plug S Gen3', { ha: 'Heizung 06', plug: 'heizung-06', ids: plugIds('k_mannschaft_r2') }, { hz: { typ: 'Konvektor', nr: 2, alt: 'Radiator 2' }, status: 'defekt' })],
        einsaetze: [['kalsdorf', 'Mannschaft Kalsdorf', '01.09.2026', null, '402 kWh · 22 Heiztage']] },
      { id: 'c4', nr: 4, art: 'MAN', status: 'aktiv', angelegt: '05.10.2026', bs: 'lieboch', bereich: 'lieboch-1', bName: 'Mannschaft 1',
        ausr: [A('PLUG', 1, 'Shelly Plug S Gen3', { ha: 'Heizung 07', plug: 'heizung-07', ids: plugIds('lieboch_1') }, { hz: { typ: 'Konvektor', nr: 1, alt: 'Radiator' } })],
        einsaetze: [['lieboch', 'Mannschaft 1', '15.09.2026', null, '96 kWh · 9 Heiztage'], ['wundschuh', 'Mannschaft', '09.03.2026', '28.08.2026', '377 kWh · 48 Heiztage']] },
      { id: 'f1', firma: 'strabag', fnr: 1, art: 'MAN', status: 'aktiv', angelegt: '22.09.2026', bs: 'dobl', bereich: null, bName: 'Mannschaft Strabag',
        ausr: [A('PLUG', 1, 'Shelly Plug S Gen3', { ha: 'STRA-01-01_C_PLUG_MAN', plug: 'STRA-01-01_C_PLUG_MAN', ids: plugIds('stra_01_01_c_plug_man') }, { hz: { typ: 'Radiator', nr: 1, alt: 'STRA-01-01_C_HZ_MAN_Radiator01' } })],
        einsaetze: [['dobl', 'Mannschaft Strabag', '22.09.2026', null, '118 kWh · 12 Heiztage']] },
      { id: 'f2', firma: 'huber', fnr: 1, art: 'LAG', status: 'ausgeschieden', angelegt: '02.06.2026', bs: 'kalsdorf', bereich: null, bName: 'Lager Huber',
        ausr: [], einsaetze: [['kalsdorf', 'Lager Huber', '02.06.2026', '30.09.2026', '74 kWh · 9 Heiztage']] },
    ],
    frei: [A('PLUG', 0, 'Shelly Plug S Gen3', { ha: 'Plug Lager 07', plug: 'plug-lager-07', ids: plugIds('plug_lager_07') }, { zuletzt: '004_C_MAN bis 14.09.2026' }),
      A('TEMP', 0, 'Shelly H&T Gen3', { ha: 'Shelly H&T Gen3', ids: { temperatur: 'sensor.shelly_h_t_gen3_temperatur', feuchte: 'sensor.shelly_h_t_gen3_feuchte', batterie: 'sensor.shelly_h_t_gen3_batterie' } }, { zuletzt: 'neu, noch nie eingesetzt' }),
      A('DOOR', 0, 'Shelly BLU Door/Window', { ha: 'Shelly BLU Door/Window', ids: { tuer: 'binary_sensor.shelly_blu_door_window_tuer', batterie: 'sensor.shelly_blu_door_window_batterie' } }, { zuletzt: '003_C_MAN bis 30.08.2026', status: 'defekt' })],
  };
  // Container der Beispielbaustelle (struktur-0.7.json, Dobl) ohne Inventar – „übernehmen“
  const BESTAND = [['magazin', 'Magazin', 'MAT'], ['sanitaer', 'Sanitär', 'SAN'], ['lager', 'Lager Süd', 'LAG'], ['besprechung', 'Besprechung', 'BES']];
  // Was in HA eine alte Entity-ID nennt (Suche der Integration in Automationen, Skripten, Dashboards)
  const VERWEISE = { c2: [['Automation', 'Mannschaft morgens vorheizen', 'switch.mannschaft_k', 'switch.002_01_c_plug_man'], ['Automation', 'Tür Mannschaft offen – Nachricht', 'binary_sensor.tursensor_01_tuer', 'binary_sensor.002_c_door_man_tuer'],
    ['Dashboard', 'Handy › Baustelle', 'sensor.mannschaft_temperatur', 'sensor.002_c_temp_man_temperatur']], c1: [['Automation', 'Polier Frostschutz Wochenende', 'switch.heizung_01', 'switch.001_01_c_plug_pol']] };

  /* ---------- Namensregeln (später logik/inventar.py, §4) ---------- */
  const z2 = n => String(n).padStart(2, '0'), z3 = n => String(n).padStart(3, '0');
  const firma = id => FIRMEN.find(f => f.id === id) || { name: id, kuerzel: '' };
  const praefix = c => c.firma ? (firma(c.firma).kuerzel || c.kuerzel || '????') + '-' + z2(c.fnr) : z3(c.nr);
  const cName = c => praefix(c) + '_C_' + c.art;
  function gName(c, a, teil) {   // teil: 'hz' | 'btr' | sonst das Gerät selbst
    const p = praefix(c), gg = z2(a.gg);
    if (a.typ === 'PLUG' && teil === 'hz') return p + '-' + gg + '_C_HZ_' + c.art + '_' + a.hz.typ + z2(a.hz.nr);
    if (a.typ === 'PLUG' && teil === 'btr') return p + '-' + gg + '_C_BTR_' + c.art;
    if (a.typ === 'PLUG') return p + '-' + gg + '_C_PLUG_' + c.art;
    const gleiche = c.ausr.filter(x => x.typ === a.typ), i = gleiche.indexOf(a);
    return p + '_C_' + a.typ + '_' + c.art + (i > 0 ? '_' + (i + 1) : '');   // ab dem zweiten Fühler/Tür mit Nummer
  }
  const eid = (domain, name, endung) => domain + '.' + (name + (endung ? '_' + endung : '')).toLowerCase().replace(/-/g, '_');
  const ENT = { switch: ['Schalter', 'switch', '', ''], leistung: ['Leistung', 'sensor', 'leistung', '_Leistung'], energie: ['Energie', 'sensor', 'energie', '_Energie'],
    temperatur: ['Temperatur', 'sensor', 'temperatur', '_Temperatur'], feuchte: ['Feuchte', 'sensor', 'feuchte', '_Feuchte'], batterie: ['Batterie', 'sensor', 'batterie', '_Batterie'], tuer: ['Tür', 'binary_sensor', 'tuer', '_Tuer'] };
  const altEntName = (a, k) => k === 'switch' ? a.alt.ha : a.fertig ? a.alt.ha + ENT[k][3] : a.alt.ha + ' ' + ENT[k][0];   // fertig = schon nach Schema benannt
  const labels = (c, a) => ['Container', ART[c.art], ...(c.firma ? [firma(c.firma).name] : []), GERAET[a.typ]];
  const altLabels = (c, a) => c.nr === 1 || c.firma === 'strabag' || a.fertig ? labels(c, a) : a.neu ? [] : ['Container'];

  /* ---------- Vorschau: je HA-Gerät die Schritte alt → neu (§6) ---------- */
  function schritte(c, nurA) {
    const G = [], lage = INV.lage, gw = c.ausr.find(x => x.gateway);
    for (const a of nurA || c.ausr) {
      const neu = gName(c, a), z = [];
      z.push({ was: 'HA-Gerät', alt: a.alt.ha, neu, k: 'geraet' });
      for (const k of Object.keys(a.alt.ids)) {
        const [t, dom, end, nameEnd] = ENT[k], r = { was: 'Entität · ' + t, alt: altEntName(a, k), altId: a.alt.ids[k], neu: k === 'switch' ? neu : neu + nameEnd, neuId: eid(dom, neu, end), k: 'ent' };
        if (lage === 'konflikt' && c.id === 'c2' && a.gg === 2 && k === 'switch') r.konflikt = 'switch.002_02_c_plug_man ist schon vergeben – Entität „Steckdose Werkstatt“ (anderes Gerät). Schritt bleibt aus, bis sie umbenannt oder gelöscht ist.';
        z.push(r);
      }
      if (a.alt.plug) { const r = { was: 'Plug-Name', alt: a.alt.plug, neu, k: 'plug' };
        if (lage === 'offline' && c.id === 'c2' && a.gg === 2) r.offline = 'Plug nicht erreichbar (seit 16:02) – wird nachgeholt, sobald er sich meldet';
        z.push(r); }
      if (a.hz) z.push({ was: 'Heizkörper (Integration)', alt: a.hz.alt, neu: gName(c, a, 'hz'), k: 'geraet' });
      if (a.btr) z.push({ was: 'Bautrockner (Integration)', alt: a.btr.alt, neu: gName(c, a, 'btr'), k: 'geraet' });
      if (a.alt.bthome && gw) {
        z.push({ was: 'BTHome-Gerät am Plug ' + z2(gw.gg), alt: a.alt.bthome, neu, k: 'bt' });
        for (const k of Object.keys(a.alt.ids)) if (k !== 'batterie') z.push({ was: 'BTHome-Messwert · ' + ENT[k][0], alt: a.alt.bthome + ' ' + ENT[k][0], neu: neu + ENT[k][3], k: 'bt' });
      }
      const L = altLabels(c, a); for (const l of labels(c, a)) z.push({ was: 'Label', alt: L.includes(l) ? l : '–', neu: l, k: 'label' });
      for (const r of z) r.art = r.konflikt ? 'konflikt' : r.offline ? 'offline' : (r.alt === r.neu && (r.altId || '') === (r.neuId || '')) ? 'gleich' : r.alt === '–' ? 'neu' : 'aendern';
      G.push({ a, ic: GERAET_IC[a.typ], titel: neu, altTitel: a.alt.ha, sub: a.modell + ' · ' + GERAET[a.typ] + (a.hz ? ' · schaltet ' + a.hz.typ : a.btr ? ' · schaltet Bautrockner' : ''), z });
    }
    return G;
  }
  const zaehle = G => { const Z = G.flatMap(g => g.z); return { aendern: Z.filter(r => ['aendern', 'neu'].includes(r.art)).length, gleich: Z.filter(r => r.art === 'gleich').length,
    konflikt: Z.filter(r => r.art === 'konflikt').length, offline: Z.filter(r => r.art === 'offline').length, ids: Z.filter(r => r.neuId && r.altId !== r.neuId && ['aendern', 'offline'].includes(r.art)).length }; };
  const abweichend = c => { const u = INV.umb[c.id]; if (u) return u.offen;   // umbenannt: nur noch offene Schritte
    const n = zaehle(schritte(c)); return n.aendern + n.konflikt + n.offline; };

  /* ---------- Hilfen ---------- */
  const P_ = R.P, neuAlle = R.neuAlle;
  const uhrzeit = () => new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  const GRIFF = html`<div class="griff"></div>`;
  const knopf = (t, fn, art = '') => html`<button class="knopf ${art}" @click=${fn}>${t}</button>`;
  const marke = R.marke;
  const band = () => R.band(html`<b>Variante ${INV.v}</b> · ${VARIANTE[INV.v]}`);
  const statusChip = (st, fn) => html`<button class="inv-st ${st}" title="Status ändern (aktiv → verliehen → defekt)" @click=${fn}>${{ aktiv: '● aktiv', verliehen: '↗ verliehen', defekt: '✕ defekt' }[st]}</button>`;
  const bsText = c => BS[c.bs] + (c.bName ? ' › ' + c.bName : '');
  const cZeit = e => e[3] ? e[2] + ' – ' + e[3] : 'seit ' + e[2];
  const naechstesGG = c => Math.max(0, ...c.ausr.map(a => a.gg)) + 1;
  const naechsteNr = () => Math.max(...INV.container.filter(c => !c.firma).map(c => c.nr)) + 1;
  const svg = R.svg;
  const symbol = c => svg(csZeichnen({ farbe: FARBE[c.art], doppel: c.art === 'BES', tueren: [{ wand: 'front', pos: .22 }], fenster: [{ wand: 'front', pos: .68 }, { wand: 'seite', pos: .5 }] }, { off: c.status !== 'aktiv' }));
  const auf = R.auf;
  function statusWeiter(a) { a.status = { aktiv: 'verliehen', verliehen: 'defekt', defekt: 'aktiv' }[a.status]; neuAlle(); }
  const sichtbar = f => INV.container.filter(c => f === 'ausgeschieden' ? c.status === 'ausgeschieden' : c.status === 'aktiv' && (f === 'alle' || (f === 'eigen') === !c.firma));
  const anzahl = k => sichtbar(k).length;
  const gruppeKurz = () => { const C = sichtbar('alle'); return C.length + ' Container · ' + C.filter(c => c.firma).length + ' fremd · ' + C.reduce((s, c) => s + c.ausr.length, 0) + ' Geräte'; };
  const neuForm = (x = {}) => ({ eigen: true, art: 'MAN', firma: 'strabag', kuerzel: '', bereich: '', ...x });
  const anlegenAuf = (p, form) => INV.v === 4 ? auf(p, { art: 'inv-assistent', schritt: form && form.bereich ? 2 : 1, form: neuForm(form), wahl: [], haengt: {} }) : auf(p, { art: 'inv-neu', form: neuForm(form) });
  const zuordnenAuf = (p, c, zurueck) => INV.v === 4 ? auf(p, { art: 'inv-assistent', schritt: 3, cId: c.id, form: neuForm(), wahl: [], haengt: {}, zurueck }) : auf(p, { art: 'inv-zuordnen', id: c.id, wahl: null, haengt: 'Konvektor', zurueck });
  const containerAuf = (p, c, zurueck) => INV.v === 3 && c.bereich && c.bs === 'dobl' && c.status === 'aktiv' ? (p.s.sheet = null, p.containerOeffnen(c.bereich)) : auf(p, { art: 'inv-container', id: c.id, zurueck });

  /* ---------- Bausteine der Liste (V1, V2, V4) ---------- */
  const filterSeg = p => html`<div class="seg glas-panel inv-filter">${[['alle', 'Alle'], ['eigen', 'Eigen'], ['fremd', 'Fremd'], ['ausgeschieden', 'Ausgeschieden']].map(([k, t]) => html`<button data-v=${k} class=${INV.filter === k ? 'on' : ''} @click=${() => { INV.filter = k; p.neuZeichnen(); }}>${t} <span class="leise">${anzahl(k)}</span></button>`)}</div>`;
  const cZeile = (p, c) => { const ab = c.status === 'aktiv' ? abweichend(c) : 0;
    return html`<button class="zeile inv-c" data-id=${c.id} @click=${() => containerAuf(p, c)}><div class="inv-c-t"><b class="inv-id">${cName(c)}</b>${c.firma ? html`<span class="badge">fremd · ${firma(c.firma).name}</span>` : nothing}
      <div class="leise">${ART[c.art]} · ${c.status === 'aktiv' ? bsText(c) : 'ausgeschieden ' + c.einsaetze[0][3] + ' · ' + BS[c.bs]}</div>
      ${ab ? html`<div class="leise"><span class="amber-t">Namen prüfen: ${ab} Änderungen offen</span></div>` : nothing}</div>
      <span class="leise inv-zahl">${c.ausr.length} ${c.ausr.length === 1 ? 'Gerät' : 'Geräte'}</span><span class="chev">›</span></button>`; };
  const protokollListe = () => { const L = INV.protokoll.slice(-3).reverse(); return L.length ? html`<div class="glas-panel liste"><div class="gruppe">Umbenennungen</div>${L.map(e => html`<div class="zeile ereignis"><span class="zeit">${e.zeit}</span><span class="p-ic">${e.ic}</span><div><span>${e.text}</span>${e.unter ? html`<div class="leise">${e.unter}</div>` : nothing}</div></div>`)}</div>` : nothing; };
  const bestandListe = p => html`<div class="glas-panel liste"><div class="gruppe">Noch nicht im Inventar · ${p.d.titel}</div>
      ${BESTAND.map(([id, name, art]) => html`<button class="zeile nur-admin" @click=${p.nurAdmin(() => anlegenAuf(p, { art, bereich: id, bName: name }))}><div><b>${name}</b><div class="leise">Container der Baustelle · Art vermutlich ${ART[art]}</div></div><span class="leise">übernehmen ›</span></button>`)}</div>`;
  const freiListe = () => html`<div class="glas-panel liste"><div class="gruppe">Ausrüstung ohne Container · ${INV.frei.length}</div>
      ${INV.frei.map(a => html`<div class="zeile"><div><b>${GERAET_IC[a.typ]} ${a.alt.ha}</b><div class="leise">${a.modell} · zuletzt ${a.zuletzt}</div></div>${statusChip(a.status, () => statusWeiter(a))}</div>`)}</div>`;
  const fuss = html`<div class="leise p-fuss">Nummern eigener Container gelten für die ganze Firma und werden nie neu vergeben. Fremdcontainer heißen nach Firmenkürzel und Nummer je Baustelle; verlassen sie die Baustelle, scheiden sie aus – ihre Daten bleiben bei der Baustelle.</div>`;

  /* V1 / V4: Inhalt der Gruppe Einstellungen › Inventar */
  function gruppeInhalt(p) {
    const f = INV.filter, C = sichtbar(f);
    return html`${band()}${filterSeg(p)}
      <div class="glas-panel liste"><div class="gruppe">${f === 'ausgeschieden' ? 'Ausgeschiedene Container' : 'Container'} · ${C.length}</div>
        ${C.length ? C.map(c => cZeile(p, c)) : html`<div class="leer">Keine Container</div>`}
        ${f !== 'ausgeschieden' ? html`<button class="zeile nur-admin" @click=${p.nurAdmin(() => anlegenAuf(p, { eigen: f !== 'fremd' }))}><span class="blau">+ Container anlegen${INV.v === 4 ? ' (Assistent)' : ''}</span><span class="leise">eigen oder fremd</span></button>` : nothing}</div>
      ${protokollListe()}${f !== 'ausgeschieden' ? html`${bestandListe(p)}${freiListe()}` : nothing}${fuss}`;
  }
  /* V2: eigene Ansicht (Reiter) mit Kacheln */
  function reiterAnsicht(p) {
    const f = INV.filter, C = sichtbar(f);
    const kachel = (c, i) => { const ab = c.status === 'aktiv' ? abweichend(c) : 0;
      return html`<div class="glas-panel glas-k inv-k" role="button" tabindex="0" data-id=${c.id} style="animation-delay:${i * 60}ms" @click=${() => containerAuf(p, c)}>
        <div class="glas-illu">${symbol(c)}</div><div class="glas-name inv-id">${cName(c)}</div>
        <div class="glas-status">${ART[c.art]}${c.firma ? ' · ' + firma(c.firma).name : ''}</div>
        <div class="leise inv-k-ort">${c.status === 'aktiv' ? bsText(c) : 'ausgeschieden ' + c.einsaetze[0][3]}</div>
        <div class="glas-geraete">${c.ausr.map(a => html`<i class=${a.status === 'aktiv' ? 'an' : ''}></i>`)}<span>${c.ausr.length} Geräte</span></div>
        ${ab ? html`<div class="leise amber-t">⚠ ${ab} Änderungen offen</div>` : nothing}</div>`; };
    return html`${band()}<div class="glas-kopf glas-panel"><div><div class="glas-klein">Inventar · alle Baustellen</div><div class="glas-titel">Container und Ausrüstung</div></div><span class="leise">${gruppeKurz()}</span></div>
      ${filterSeg(p)}<div class="glas-raster">${C.map(kachel)}${f !== 'ausgeschieden' ? html`<button class="glas-panel glas-k neu nur-admin" @click=${p.nurAdmin(() => anlegenAuf(p, { eigen: f !== 'fremd' }))}><span>+</span>Container anlegen</button>` : nothing}</div>
      ${protokollListe()}${f !== 'ausgeschieden' ? html`<div class="inv-zwei">${bestandListe(p)}${freiListe()}</div>` : nothing}${fuss}`;
  }
  /* V3: Inventar im Container – Kopf davor, Abschnitt danach */
  function v3Kopf(p, b) {
    const c = INV.container.find(x => x.bereich === b.id && x.bs === 'dobl'), suche = html`<button class="chip glas-panel" title="Alle Container suchen" @click=${() => auf(p, { art: 'inv-suche' })}>⌕ Container suchen</button>`;
    if (!c) { const B = BESTAND.find(x => x[0] === b.id);
      return html`${band()}<div class="glas-panel inv-kopf"><div class="inv-kopf-t"><span class="inv-kopf-nr leise">— —</span><div><b>Noch nicht im Inventar</b><div class="leise">${b.name} hat keine Inventarnummer</div></div></div>
        <div class="inv-kopf-k">${B ? html`<button class="chip glas-panel amber nur-admin" @click=${p.nurAdmin(() => anlegenAuf(p, { art: B[2], bereich: B[0], bName: B[1] }))}>+ ins Inventar</button>` : nothing}${suche}</div></div>`; }
    const ab = abweichend(c), u = INV.umb[c.id];
    return html`${band()}<div class="glas-panel inv-kopf"><div class="inv-kopf-t"><span class="inv-kopf-nr inv-id">${c.firma ? praefix(c) : z3(c.nr)}</span><div><b class="inv-id">${cName(c)}</b><div class="leise">${ART[c.art]} · ${c.firma ? 'Fremdcontainer ' + firma(c.firma).name : 'eigener Container'} · ${c.ausr.length} Geräte</div></div></div>
      <div class="inv-kopf-k">${u ? html`<span class="chip glas-panel ${u.status === 'teilweise' ? 'amber' : ''}">${u.status === 'teilweise' ? '◐ teilweise' : '✓ umbenannt'}</span>` : ab ? html`<button class="chip glas-panel amber" @click=${() => auf(p, { art: 'inv-vorschau', id: c.id })}>⚠ ${ab} Änderungen offen</button>` : html`<span class="chip glas-panel">✓ Namen</span>`}${suche}</div></div>`;
  }
  function v3Abschnitt(p, b) {
    const c = INV.container.find(x => x.bereich === b.id && x.bs === 'dobl'); if (!c) return nothing;
    return html`<div class="glas-panel liste inv-abschnitt"><div class="gruppe">Inventar · Ausrüstung${marke}</div>${ausruestungZeilen(p, c)}</div>
      <div class="glas-panel liste"><div class="gruppe">Inventar · Geschichte</div>${geschichte(c)}</div>${aktionen(p, c, null)}`;
  }

  /* ---------- gemeinsame Teile Container ---------- */
  function ausruestungZeilen(p, c, zurueck) {
    const bez = a => a.typ === 'PLUG' ? [[gName(c, a), a], ...(a.hz ? [[gName(c, a, 'hz'), { typ: 'HZ', modell: a.hz.typ === 'Radiator' ? 'Ölradiator' : 'Konvektor' }]] : a.btr ? [[gName(c, a, 'btr'), { typ: 'BTR', modell: 'Bautrockner' }]] : [])] : [[gName(c, a), a]];
    const G = c.ausr.flatMap(a => bez(a).map(([n, x], i) => ({ n, x, a, unter: i > 0 })));
    return html`${G.length ? G.map(g => html`<div class="zeile ${g.unter ? 'inv-unter' : ''}"><div class="inv-g"><b class="inv-id">${g.unter ? '└ ' : ''}${g.n}</b><div class="leise">${GERAET_IC[g.x.typ]} ${g.x.modell} · ${GERAET[g.x.typ]}${!g.unter && g.a.typ === 'PLUG' ? ' · GG ' + z2(g.a.gg) : ''}</div></div>${g.unter ? nothing : statusChip(g.a.status, () => statusWeiter(g.a))}</div>`)
      : html`<div class="leer">Keine Ausrüstung</div>`}
      ${c.status === 'aktiv' ? html`<button class="zeile nur-admin" @click=${p.nurAdmin(() => zuordnenAuf(p, c, zurueck))}><span class="blau">+ Gerät zuordnen</span><span class="leise">GG ${z2(naechstesGG(c))} ist frei</span></button>` : nothing}`;
  }
  const geschichte = c => c.einsaetze.map(e => html`<div class="zeile"><div><b>${BS[e[0]]}</b><div class="leise">${e[1]} · ${e[4]}</div></div><span class="leise">${cZeit(e)}</span></div>`);
  function aktionen(p, c, zurueck) {
    if (c.status !== 'aktiv') return nothing;
    const u = INV.umb[c.id];
    return html`${knopf('Namen prüfen', () => auf(p, { art: 'inv-vorschau', id: c.id, zurueck }), 'amber')}
      ${u && u.status === 'teilweise' ? knopf('Fehlende Schritte nachholen', p.nurAdmin(() => nachholen(p, c)), 'nur-admin') : nothing}
      ${u ? knopf('Rückgängig …', p.nurAdmin(() => auf(p, { art: 'inv-vorschau', id: c.id, zurueck, rueck: true })), 'nur-admin') : nothing}
      ${c.firma ? knopf('Verlässt die Baustelle (ausscheiden)', p.nurAdmin(() => { c.status = 'ausgeschieden'; c.einsaetze[0][3] = '08.10.2026'; p.toast(cName(c) + ' ausgeschieden – Daten bleiben bei der Baustelle'); p.s.sheet = null; neuAlle(); }), 'rot nur-admin') : nothing}`;
  }

  /* ---------- Einblendung: Container ---------- */
  function containerSheet(p, s) {
    const c = INV.container.find(x => x.id === s.id), ab = c.status === 'aktiv' ? abweichend(c) : 0, u = INV.umb[c.id];
    const bereich = c.bereich && c.bs === 'dobl' && p.d.bereiche.find(b => b.id === c.bereich);
    return html`${GRIFF}${band()}<div class="block-kopf"><h3 class="inv-id inv-gross">${cName(c)}</h3></div>
      <div class="leise inv-unterzeile">${ART[c.art]} · ${c.firma ? 'Fremdcontainer · ' + firma(c.firma).name + ' (' + firma(c.firma).kuerzel + ')' : 'eigener Container · Nr. ' + z3(c.nr)}${c.status === 'ausgeschieden' ? ' · ausgeschieden' : ''}</div>
      ${INV.v === 2 ? html`<div class="inv-symbol">${symbol(c)}</div>` : nothing}
      <div class="glas-panel liste">
        <div class="zeile"><span>Jetzt</span><span class="leise">${c.status === 'aktiv' ? bsText(c) : '–'}</span></div>
        <div class="zeile"><span>Im Inventar seit</span><span class="leise">${c.angelegt}</span></div>
        ${bereich ? html`<button class="zeile" @click=${() => { p.containerOeffnen(bereich.id); }}><span>Container öffnen</span><span class="leise">Heizung, Diagramme ›</span></button>` : nothing}
        ${c.status === 'aktiv' ? (u ? html`<div class="zeile"><span class=${u.status === 'teilweise' ? 'amber-t' : 'gruen-t'}>${u.status === 'teilweise' ? '◐ teilweise umbenannt' : '✓ umbenannt'} · ${u.zeit}</span><span class="leise">${u.status === 'teilweise' ? u.offen + ' Schritte offen' : u.n + ' Schritte'}</span></div>`
          : ab ? html`<div class="zeile"><span class="amber-t">⚠ Namen prüfen: ${ab} Änderungen offen</span></div>` : html`<div class="zeile"><span class="gruen-t">✓ alle Namen nach Schema</span></div>`) : nothing}</div>
      <div class="glas-panel liste"><div class="gruppe">Ausrüstung · ${c.ausr.length}</div>${ausruestungZeilen(p, c, s)}</div>
      <div class="glas-panel liste"><div class="gruppe">Geschichte · Einsätze</div>${geschichte(c)}</div>
      ${aktionen(p, c, s)}${knopf('Schließen', () => p.schliessen(), 'leise-k')}`;
  }

  /* ---------- Suche (V3) ---------- */
  function sucheSheet(p, s) {
    const q = INV.suche.toLowerCase(), f = INV.filter;
    const C = sichtbar(f).filter(c => !q || (cName(c) + ' ' + ART[c.art] + ' ' + bsText(c) + ' ' + (c.firma ? firma(c.firma).name : '')).toLowerCase().includes(q));
    return html`${GRIFF}${band()}<h3>⌕ Container suchen</h3>
      <input class="inv-suchfeld" placeholder="Nummer, Art, Baustelle, Firma …" .value=${INV.suche} @input=${e => { INV.suche = e.target.value; p.neuZeichnen(); }}>
      <div class="inv-zahlen">${[['alle', 'Alle'], ['eigen', 'Eigen'], ['fremd', 'Fremd'], ['ausgeschieden', 'Ausgeschieden']].map(([k, t]) => html`<button class="chip glas-panel ${f === k ? 'amber' : ''}" @click=${() => { INV.filter = k; p.neuZeichnen(); }}>${t} ${anzahl(k)}</button>`)}</div>
      <div class="glas-panel liste">${C.length ? C.map(c => html`<button class="zeile inv-c" @click=${() => containerAuf(p, c, s)}><div class="inv-c-t"><b class="inv-id">${cName(c)}</b><div class="leise">${ART[c.art]} · ${c.status === 'aktiv' ? bsText(c) : 'ausgeschieden'}</div></div><span class="leise inv-zahl">${c.ausr.length} Geräte</span><span class="chev">›</span></button>`) : html`<div class="leer">Nichts gefunden</div>`}</div>
      ${knopf('+ Container anlegen', p.nurAdmin(() => anlegenAuf(p, {})), 'nur-admin')}${knopf('Schließen', () => p.schliessen(), 'leise-k')}`;
  }

  /* ---------- Formular Art / Nummer / Firma (Anlegen und Assistent) ---------- */
  function nummerDaten(f) {
    const fi = firma(f.firma), kz = fi.kuerzel || f.kuerzel, nr = naechsteNr(), fnr = INV.container.filter(c => c.firma === f.firma && c.bs === 'dobl').length + 1;
    return { fi, kz, nr, fnr, name: f.eigen ? z3(nr) + '_C_' + f.art : (kz || '????') + '-' + z2(fnr) + '_C_' + f.art, ok: f.eigen || /^[A-Z]{2,5}$/.test(kz) };
  }
  const eigenSeg = (f, z) => html`<div class="seg"><button class=${f.eigen ? 'on' : ''} @click=${() => { f.eigen = true; z(); }}>Eigener Container</button><button class=${f.eigen ? '' : 'on'} @click=${() => { f.eigen = false; z(); }}>Fremdcontainer</button></div>`;
  const artWahl = (f, z) => html`<div class="feld">Art<div class="inv-arten">${Object.entries(ART).map(([k, t]) => html`<button class="inv-art ${f.art === k ? 'on' : ''}" data-v=${k} @click=${() => { f.art = k; z(); }}><b>${k}</b><span>${t}</span></button>`)}</div></div>`;
  function nummerFelder(p, f, z) {
    const N = nummerDaten(f);
    return html`${f.eigen ? html`<div class="zeile inv-feldzeile"><div><b>Nummer</b><div class="leise">nächste freie für die ganze Firma – vergibt die Datenbank beim Anlegen, nie doppelt</div></div><b class="inv-id inv-riesig">${z3(N.nr)}</b></div>`
      : html`<label class="feld">Firma<select @change=${e => { f.firma = e.target.value; f.kuerzel = ''; z(); }}>${FIRMEN.map(x => html`<option value=${x.id} ?selected=${x.id === f.firma}>${x.name}${x.kuerzel ? ' (' + x.kuerzel + ')' : ' – noch ohne Kürzel'}</option>`)}</select></label>
        ${N.fi.kuerzel ? nothing : html`<label class="feld">Firmenkürzel (2–5 Großbuchstaben, eindeutig auf der Baustelle)<input placeholder="z. B. LEIT" .value=${f.kuerzel} @input=${e => { f.kuerzel = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); z(); }}></label>`}
        <div class="zeile inv-feldzeile"><div><b>Nummer je Baustelle</b><div class="leise">nächste freie für ${N.kz || 'diese Firma'} auf ${p.d.titel}</div></div><b class="inv-id inv-riesig">${z2(N.fnr)}</b></div>`}
      <label class="feld">Auf der Baustelle<select @change=${e => { f.bereich = e.target.value; const B = BESTAND.find(x => x[0] === f.bereich); f.bName = B ? B[1] : ''; z(); }}><option value="">– neuer Container auf ${p.d.titel} –</option>${BESTAND.map(([id, n]) => html`<option value=${id} ?selected=${f.bereich === id}>${n} (schon da, ohne Inventar)</option>`)}</select></label>`;
  }
  const namenVorschau = (f, N) => html`<div class="glas-panel inv-vorschau-name"><div class="leise">Vorschau</div><div class="inv-id inv-riesig">${N.name}</div>
      <div class="leise">Entity-IDs beginnen mit <span class="inv-id">${N.name.toLowerCase().replace(/-/g, '_')}</span> · Labels: ${['Container', ART[f.art], ...(f.eigen ? [] : [N.fi.name])].join(', ')}</div>
      ${f.bereich ? html`<div class="leise">„${f.bName || f.bereich}“ behält Heizung, Verlauf und Verbrauch</div>` : nothing}</div>`;

  /* ---------- Einblendung: Container anlegen (V1–V3) ---------- */
  function anlegenSheet(p, s) {
    const f = s.form, z = () => p.neuZeichnen(), N = nummerDaten(f);
    return html`${GRIFF}${band()}<h3>Container anlegen</h3>${eigenSeg(f, z)}${artWahl(f, z)}${nummerFelder(p, f, z)}${namenVorschau(f, N)}
      ${N.ok ? nothing : html`<div class="leise amber-t inv-p">Bitte zuerst ein Firmenkürzel eintragen</div>`}
      ${knopf(f.bereich ? 'Anlegen und Namen prüfen' : 'Anlegen', p.nurAdmin(() => { if (!N.ok) return p.toast('Firmenkürzel fehlt'); const c = anlegen(p, f, N); if (f.bereich) auf(p, { art: 'inv-vorschau', id: c.id, zurueck: { art: 'inv-container', id: c.id } }); else auf(p, { art: 'inv-container', id: c.id }); }), 'amber nur-admin')}${knopf('Abbrechen', () => p.schliessen(), 'leise-k')}
      <div class="leise p-fuss">Anlegen braucht die Datenbank – ist sie nicht erreichbar, lehnt die Seite das Anlegen mit Hinweis ab.</div>`;
  }
  // Geräte eines Containers der Baustelle, der noch nicht im Inventar ist (aus der Struktur der Integration)
  function bestandAusr(p, bereichId) {
    const b = p.d.bereiche.find(x => x.id === bereichId); if (!b) return [];
    let gg = 0; const typNr = {};
    return b.geraete.map(g => { const typ = g.gtyp === 'konvektor' ? 'Konvektor' : 'Radiator'; typNr[typ] = (typNr[typ] || 0) + 1;
      return A('PLUG', ++gg, 'Shelly Plug S Gen3', { ha: g.n, plug: g.schalter.split('.')[1].replace(/_/g, '-'), ids: { switch: g.schalter, leistung: g.leistung, energie: g.energie } },
        g.rolle === 'heizung' ? { hz: { typ, nr: typNr[typ], alt: g.n } } : g.rolle === 'trockner' ? { btr: { alt: g.n } } : {}); });
  }
  function anlegen(p, f, N, ausr) {
    if (!f.eigen && !firma(f.firma).kuerzel) firma(f.firma).kuerzel = f.kuerzel;
    const c = { id: 'n' + Date.now(), art: f.art, status: 'aktiv', angelegt: '08.10.2026', bs: 'dobl', bereich: f.bereich || null, bName: f.bName || ART[f.art], ausr: ausr || (f.bereich ? bestandAusr(p, f.bereich) : []),
      einsaetze: [['dobl', f.bName || ART[f.art], f.bereich ? '01.09.2026' : '08.10.2026', null, f.bereich ? 'Werte seit Baubeginn' : 'noch keine Werte']], ...(f.eigen ? { nr: N.nr } : { firma: f.firma, fnr: N.fnr }) };
    INV.container.push(c); const i = BESTAND.findIndex(b => b[0] === f.bereich); if (i >= 0) BESTAND.splice(i, 1);
    INV.protokoll.push({ zeit: uhrzeit(), ic: '📦', text: N.name + ' angelegt', unter: 'von Herbert · ' + p.d.titel });
    p.toast(N.name + ' angelegt'); return c;
  }

  /* ---------- Einblendung: Gerät zuordnen (V1–V3) ---------- */
  function probeGeraet(c, a, haengt) {
    return { ...a, gg: a.typ === 'PLUG' ? naechstesGG(c) : 0, neu: true, ...(a.typ === 'PLUG' && haengt !== 'nichts' ? haengt === 'Bautrockner' ? { btr: { alt: '–' } } : { hz: { typ: haengt, nr: c.ausr.filter(x => x.hz && x.hz.typ === haengt).length + 1, alt: '–' } } : {}) };
  }
  function neueNamen(c, probe) { const t = { ...c, ausr: [...c.ausr, probe] };
    return [[gName(t, probe), GERAET[probe.typ]], ...(probe.hz ? [[gName(t, probe, 'hz'), 'Heizkörper']] : probe.btr ? [[gName(t, probe, 'btr'), 'Bautrockner']] : [])]; }
  const freieWahl = (s, z, mehrfach) => html`<div class="glas-panel liste"><div class="gruppe">Freie Ausrüstung</div>
      ${INV.frei.map(x => { const an = mehrfach ? s.wahl.includes(x.id) : s.wahl === x.id;
        return html`<button class="zeile" data-id=${x.id} @click=${() => { if (x.status === 'defekt') return; if (mehrfach) s.wahl = an ? s.wahl.filter(y => y !== x.id) : [...s.wahl, x.id]; else s.wahl = x.id; z(); }}><div><b>${GERAET_IC[x.typ]} ${x.alt.ha}</b><div class="leise">${x.modell}${x.status === 'defekt' ? ' · defekt – nicht zuordenbar' : ' · zuletzt ' + x.zuletzt}</div></div><span class=${an ? 'blau' : 'leise'}>${x.status === 'defekt' ? '–' : an ? '✓' : '○'}</span></button>`; })}
      <div class="zeile"><span class="leise">Neue Shellys erscheinen hier, sobald Home Assistant sie kennt</span></div></div>`;
  const haengtSeg = (wert, setze) => html`<div class="feld">Was hängt an diesem Plug?<div class="seg klein inv-seg">${['Konvektor', 'Radiator', 'Bautrockner', 'nichts'].map(t => html`<button class=${wert === t ? 'on' : ''} @click=${() => setze(t)}>${t}</button>`)}</div></div>`;
  function zuordnenSheet(p, s) {
    const c = INV.container.find(x => x.id === s.id), a = s.wahl && INV.frei.find(x => x.id === s.wahl), z = () => p.neuZeichnen(), probe = a && probeGeraet(c, a, s.haengt);
    return html`${GRIFF}${band()}<h3>Gerät zuordnen</h3><div class="leise inv-unterzeile">zu <span class="inv-id">${cName(c)}</span> · ${bsText(c)}</div>
      ${freieWahl(s, z, false)}
      ${a && a.typ === 'PLUG' ? haengtSeg(s.haengt, t => { s.haengt = t; z(); }) : nothing}
      ${a ? html`<div class="glas-panel inv-vorschau-name"><div class="leise">${a.typ === 'PLUG' ? 'Gerätenummer GG ' + z2(probe.gg) + ' (nächste freie in ' + cName(c) + ')' : 'ohne Gerätenummer – ' + (c.ausr.some(x => x.typ === a.typ) ? 'zweiter ' + GERAET[a.typ] + ' im Container, darum mit Nummer' : 'einer je Container')}</div>
        ${neueNamen(c, probe).map(([n, t]) => html`<div class="inv-name-z"><span class="inv-id inv-riesig">${n}</span><span class="leise">${t}</span></div>`)}</div>` : html`<div class="leise inv-p">Gerät wählen – Nummer und Namen bildet die Integration.</div>`}
      ${knopf('Weiter zur Vorschau', () => { if (!a) return p.toast('Bitte ein Gerät wählen'); auf(p, { art: 'inv-vorschau', id: c.id, neuA: [probe], freiIds: [a.id], zurueck: s }); }, 'amber')}${knopf('Abbrechen', () => p.schliessen(), 'leise-k')}`;
  }

  /* ---------- Vorschau alt → neu: vier Darstellungen ---------- */
  const MARKE = { gleich: html`<span class="inv-m leise">= unverändert</span>`, neu: html`<span class="inv-m gruen-t">+ neu</span>`, aendern: html`<span class="inv-m leise">ändern</span>`,
    konflikt: html`<span class="inv-m rot-t">✕ Konflikt</span>`, offline: html`<span class="inv-m amber-t">⚠ offline</span>`, fertig: html`<span class="inv-m gruen-t">✓ erledigt</span>`, weg: html`<span class="inv-m rot-t">− entfernen</span>`, offen: html`<span class="inv-m amber-t">◐ offen</span>` };
  const wert = (n, id) => html`<span class="inv-w">${n}${id ? html`<span class="inv-id">${id}</span>` : nothing}</span>`;
  const zustandVon = (r, ergebnis, rueck) => rueck && r.art === 'neu' ? 'weg' : ergebnis ? (r.art === 'gleich' ? 'gleich' : ['konflikt', 'offline'].includes(r.art) ? 'offen' : 'fertig') : r.art;
  const seiten = (r, rueck) => rueck ? [r.neu, r.neuId, r.alt, r.altId] : [r.alt, r.altId, r.neu, r.neuId];
  const hinweis = r => r.konflikt || r.offline ? html`<span class="inv-hinweis ${r.konflikt ? 'rot-t' : 'amber-t'}">${r.konflikt || r.offline}</span>` : nothing;
  const gKopf = (g, rueck) => html`<div class="inv-g-kopf"><span class="inv-g-ic">${g.ic}</span><div><b class="inv-id">${rueck ? g.altTitel : g.titel}</b><div class="leise">${g.sub}${!rueck && g.altTitel !== g.titel ? ' · heute „' + g.altTitel + '“' : ''}</div></div></div>`;
  // V1: Tabelle Was / Alt / Neu / Zustand
  const tabelle = (G, rueck, erg) => G.map(g => html`<div class="glas-panel liste inv-gruppe">${gKopf(g, rueck)}
      <div class="inv-tr inv-th"><span class="t-was">Was</span><span class="t-alt">Alt</span><span class="t-neu">Neu</span><span class="t-m">Zustand</span></div>
      ${g.z.map(r => { const st = zustandVon(r, erg, rueck), [a1, a2, n1, n2] = seiten(r, rueck);
        return html`<div class="inv-tr ${st}"><span class="t-was">${r.was}</span><span class="t-alt">${st === 'neu' ? html`<span class="leise">–</span>` : wert(a1, a2)}</span><span class="t-neu">${st === 'gleich' ? html`<span class="leise">=</span>` : wert(n1, n2)}</span><span class="t-m">${MARKE[st]}</span>${hinweis(r)}</div>`; })}</div>`);
  // V2: Karten je Gerät – je Karte alle Namen dieses Geräts
  const karten = (G, rueck, erg) => html`<div class="inv-karten">${G.map(g => { const Z = g.z.filter(r => r.art !== 'gleich'), gl = g.z.length - Z.length;
      return html`<div class="glas-panel inv-karte">${gKopf(g, rueck)}${Z.map(r => { const st = zustandVon(r, erg, rueck), [a1, a2, n1, n2] = seiten(r, rueck);
        return html`<div class="inv-kz ${st}"><div class="inv-kz-was"><span>${r.was}</span>${MARKE[st]}</div><div class="inv-kz-neu">${wert(n1, n2)}</div>${st === 'neu' ? nothing : html`<div class="inv-kz-alt">bisher <s>${a1}</s>${a2 ? html` · <s class="inv-id">${a2}</s>` : nothing}</div>`}${hinweis(r)}</div>`; })}
        ${gl ? html`<div class="leise inv-kz-gleich">+ ${gl} unverändert</div>` : nothing}</div>`; })}</div>`;
  // V3: kompakte Liste nach Art des Namens, je Gruppe aufklappbar
  const ARTEN_K = [['geraet', '📟', 'Geräte (HA und Integration)'], ['ent', '🔣', 'Entitäten · Name und Entity-ID'], ['plug', '🔌', 'Plug-Namen'], ['bt', '📡', 'BTHome-Kopplungen'], ['label', '🏷', 'Labels']];
  function aufklappen(p, s, G, rueck, erg) {
    s.auf = s.auf || {}; const Z = G.flatMap(g => g.z.map(r => ({ r, g })));
    return html`<div class="glas-panel liste inv-akk">${ARTEN_K.map(([k, ic, t]) => { const L = Z.filter(x => x.r.k === k), aend = L.filter(x => x.r.art !== 'gleich'), kon = L.filter(x => x.r.art === 'konflikt').length, off = L.filter(x => x.r.art === 'offline').length;
      if (!L.length) return nothing; const offen = s.auf[k] ?? (kon + off > 0);
      return html`<button class="zeile inv-akk-k" @click=${() => { s.auf[k] = !offen; p.neuZeichnen(); }}><span class="inv-g-ic">${ic}</span><div class="inv-akk-t"><b>${t}</b><div class="leise">${aend.length} ${rueck ? 'zurück' : aend.length === 1 ? 'Änderung' : 'Änderungen'}${L.length - aend.length ? ' · ' + (L.length - aend.length) + ' unverändert' : ''}${kon ? html` · <span class="rot-t">${kon} Konflikt</span>` : nothing}${off ? html` · <span class="amber-t">${off} offline</span>` : nothing}</div></div><span class="chev inv-chev ${offen ? 'auf' : ''}">›</span></button>
        ${offen ? html`<div class="inv-akk-inhalt">${aend.map(({ r, g }) => { const st = zustandVon(r, erg, rueck), [a1, a2, n1, n2] = seiten(r, rueck);
          return html`<div class="inv-kl ${st}"><span class="leise inv-kl-wer">${rueck ? g.altTitel : g.titel}${k === 'ent' || k === 'bt' ? ' · ' + r.was.split(' · ')[1] : ''}</span>
            <span class="inv-kl-z"><span class="inv-id inv-kl-alt">${k === 'ent' ? a2 : a1}</span> → <span class="inv-id">${k === 'ent' ? n2 : n1}</span>${st === 'aendern' ? nothing : MARKE[st]}</span>${hinweis(r)}</div>`; })}</div>` : nothing}`; })}</div>`;
  }
  // V4: Vorher / Nachher nebeneinander
  const vorherNachher = (G, rueck, erg) => G.map(g => html`<div class="glas-panel inv-vn">${gKopf(g, rueck)}<div class="inv-vn-raster"><div class="inv-vn-k">Vorher</div><div class="inv-vn-k">Nachher</div>
      ${g.z.map(r => { const st = zustandVon(r, erg, rueck), [a1, a2, n1, n2] = seiten(r, rueck);
        return html`<div class="inv-vn-z alt ${st}"><small>${r.was}</small>${st === 'neu' ? html`<span class="leise">–</span>` : wert(a1, a2)}</div><div class="inv-vn-z neu ${st}"><small>${r.was}${st === 'aendern' || st === 'gleich' ? '' : ' · '}${st === 'aendern' || st === 'gleich' ? nothing : MARKE[st]}</small>${wert(n1, n2)}</div>${r.konflikt || r.offline ? html`<div class="inv-vn-hin">${hinweis(r)}</div>` : nothing}`; })}</div></div>`);

  function vorschauDaten(c, s) {
    const u = INV.umb[c.id], rueck = !!s.rueck;
    let G = s.neuA ? schritte({ ...c, ausr: [...c.ausr, ...s.neuA] }, s.neuA) : schritte(c);
    if (rueck && u) G = u.G.map(g => ({ ...g, z: g.z.filter(r => r.art !== 'gleich' && r.art !== 'konflikt' && !(u.status === 'teilweise' && r.art === 'offline')) })).filter(g => g.z.length);
    if (s.ergebnis && !rueck && u) G = u.G;
    if (s.G) G = s.G;   // nach dem Zurücknehmen: was zurückgenommen wurde
    return { G, nz: zaehle(G), rueck, u };
  }
  function vorschauKoerper(p, s, c, D) {
    const { G, nz, rueck } = D, erg = s.ergebnis && !rueck, schrittZahl = rueck ? G.reduce((a, g) => a + g.z.length, 0) : nz.aendern;
    const V = rueck || s.neuA || s.ergebnis ? [] : (VERWEISE[c.id] || []);
    const zahlen = html`<div class="inv-zahlen">${rueck ? html`<span class="chip glas-panel">↶ ${schrittZahl} Schritte zurück</span>`
      : html`<span class="chip glas-panel">${schrittZahl} Änderungen</span><span class="chip glas-panel">${nz.ids} Entity-IDs</span>${nz.gleich ? html`<span class="chip glas-panel leise">${nz.gleich} unverändert</span>` : nothing}${nz.konflikt ? html`<span class="chip glas-panel rot">${nz.konflikt} Konflikt</span>` : nothing}${nz.offline ? html`<span class="chip glas-panel amber">Plug offline</span>` : nothing}`}</div>`;
    const verweise = V.length ? html`<div class="glas-panel liste inv-warn"><div class="zeile"><div><b class="amber-t">⚠ ${V.length} ${V.length === 1 ? 'Eintrag nennt' : 'Einträge nennen'} alte Entity-IDs</b><div class="leise">Home Assistant passt eigene Automationen, Skripte und Dashboards nicht an – danach dort die neue ID eintragen. Verlauf und Statistik ziehen mit.</div></div></div>
      ${V.map(([art, n, id, neu]) => html`<div class="zeile"><div class="inv-g"><b>${n}</b><div class="leise">${art} · <span class="inv-id">${id}</span> → <span class="inv-id">${neu}</span></div></div></div>`)}</div>` : nothing;
    const inhalt = INV.v === 1 ? tabelle(G, rueck, erg) : INV.v === 2 ? karten(G, rueck, erg) : INV.v === 3 ? aufklappen(p, s, G, rueck, erg) : vorherNachher(G, rueck, erg);
    return { zahlen, verweise, inhalt, schrittZahl };
  }
  function vorschauSheet(p, s) {
    const c = INV.container.find(x => x.id === s.id), D = vorschauDaten(c, s), { nz, rueck } = D, B = vorschauKoerper(p, s, c, D), ergebnis = s.ergebnis;
    const titel = rueck ? 'Rückgängig' : s.neuA ? 'Gerät zuordnen · Vorschau' : 'Namen prüfen';
    let ende;
    if (ergebnis) ende = html`${ergebnisZeile(c, ergebnis, rueck)}
      ${ergebnis.status === 'teilweise' ? knopf('Fehlende Schritte nachholen', p.nurAdmin(() => nachholen(p, c, s)), 'amber nur-admin') : nothing}
      ${!rueck ? knopf('Rückgängig …', p.nurAdmin(() => auf(p, { art: 'inv-vorschau', id: c.id, rueck: true, zurueck: s.zurueck })), 'nur-admin') : nothing}${knopf('Schließen', () => p.schliessen(), 'leise-k')}`;
    else ende = html`${nz.offline && !rueck ? html`<div class="leise amber-t inv-p">Ein Plug ist offline: Namen in Home Assistant werden jetzt übernommen, Plug-Name dort später („teilweise“).</div>` : nothing}
      ${knopf((rueck ? 'Zurücknehmen · ' : 'Übernehmen · ') + B.schrittZahl + ' Schritte' + (nz.konflikt && !rueck ? ' (ohne ' + nz.konflikt + ' Konflikt)' : ''), p.nurAdmin(() => uebernehmen(p, c, s, D)), 'amber nur-admin')}
      <div class="leise inv-p">nur Admins · das Schalten von ${cName(c)} pausiert dafür kurz, die Automatik bleibt an${rueck ? ' · nur die jüngste Umbenennung des Containers' : ''}</div>${knopf('Abbrechen', () => p.schliessen(), 'leise-k')}`;
    return html`${GRIFF}${band()}<div class="block-kopf"><h3>${titel}</h3></div><div class="leise inv-unterzeile"><span class="inv-id">${cName(c)}</span> · ${rueck ? 'neu → alt, in umgekehrter Reihenfolge' : 'alt → neu, gruppiert nach Gerät in Home Assistant'}</div>
      ${B.zahlen}${B.verweise}<div class="inv-inhalt">${B.inhalt}</div>
      ${!rueck && !s.neuA && !ergebnis ? html`<div class="leise inv-p">Dazu ziehen die Verweise der Integration mit (Schalter, Leistung, Energie, Fühler, Tür im Container) – der Bereich in HA bleibt.</div>` : nothing}${ende}`;
  }
  const ergebnisZeile = (c, e, rueck) => { const teil = e.status === 'teilweise';
    return html`<div class="glas-panel liste"><div class="zeile ereignis"><span class="zeit">${e.zeit}</span><span class="p-ic">${rueck ? '↶' : teil ? '◐' : '✓'}</span><div><span>${cName(c)} ${rueck ? 'zurückgenommen' : teil ? 'teilweise umbenannt' : 'umbenannt'} · ${e.n} Schritte${teil ? ' · ' + e.offen + ' offen (Plug nicht erreichbar)' : ''}</span><div class="leise">von Herbert · steht im Protokoll der Baustelle${teil ? ' · wird von selbst nachgeholt, sobald der Plug sich meldet' : ''}</div></div></div></div>`; };
  function uebernehmen(p, c, s, D) {
    const zeit = uhrzeit(), { G, nz } = D;
    if (s.rueck) { const n = G.reduce((a, g) => a + g.z.length, 0); delete INV.umb[c.id]; INV.protokoll.push({ zeit, ic: '↶', text: cName(c) + ' zurückgenommen', unter: 'von Herbert · ' + n + ' Schritte' }); s.ergebnis = { zeit, status: 'zurueck', n }; s.G = G; return neuAlle(); }
    if (s.neuA) { for (const id of s.freiIds) INV.frei.splice(INV.frei.findIndex(x => x.id === id), 1);
      for (const a of s.neuA) c.ausr.push({ ...a, neu: false, fertig: true, alt: { ...a.alt, ha: gName({ ...c, ausr: [...c.ausr, a] }, a), plug: a.alt.plug && gName(c, a), ids: Object.fromEntries(Object.keys(a.alt.ids).map(k => [k, eid(ENT[k][1], gName({ ...c, ausr: [...c.ausr, a] }, a), ENT[k][2])])) }, hz: a.hz && { ...a.hz, alt: gName(c, a, 'hz') }, btr: a.btr && { alt: gName(c, a, 'btr') } });
      INV.protokoll.push({ zeit, ic: '🔌', text: s.neuA.length + ' Gerät' + (s.neuA.length > 1 ? 'e' : '') + ' zu ' + cName(c), unter: 'von Herbert · ' + nz.aendern + ' Schritte' }); p.toast('Zugeordnet und umbenannt'); return auf(p, { art: 'inv-container', id: c.id }); }
    const teil = nz.offline > 0;
    INV.umb[c.id] = { zeit, status: teil ? 'teilweise' : 'ausgefuehrt', n: nz.aendern, offen: nz.offline, G };
    INV.protokoll.push({ zeit, ic: teil ? '◐' : '✓', text: cName(c) + (teil ? ' teilweise umbenannt' : ' umbenannt'), unter: 'von Herbert · ' + nz.aendern + ' Schritte' + (teil ? ' · ' + nz.offline + ' offen' : '') + (nz.konflikt ? ' · ' + nz.konflikt + ' Konflikt ausgelassen' : '') });
    s.ergebnis = { zeit, status: teil ? 'teilweise' : 'ausgefuehrt', n: nz.aendern, offen: nz.offline }; neuAlle();
  }
  function nachholen(p, c, s) {
    const u = INV.umb[c.id]; if (!u) return; u.status = 'ausgefuehrt'; u.n += u.offen; u.offen = 0; for (const g of u.G) for (const r of g.z) if (r.art === 'offline') r.art = 'aendern';
    INV.protokoll.push({ zeit: uhrzeit(), ic: '✓', text: cName(c) + ': fehlende Schritte nachgeholt', unter: 'Plug wieder erreichbar' });
    if (s && s.ergebnis) s.ergebnis = { ...s.ergebnis, status: 'ausgefuehrt', n: u.n, offen: 0 };
    p.toast('Fehlende Schritte nachgeholt'); neuAlle();
  }

  /* ---------- V4: Assistent ---------- */
  const SCHRITTE = ['Art', 'Nummer', 'Ausrüstung', 'Vorschau', 'Übernehmen'];
  function assistentSheet(p, s) {
    const z = () => p.neuZeichnen(), f = s.form, vorhanden = s.cId && !s.angelegt && INV.container.find(x => x.id === s.cId);
    const N = nummerDaten(f), erster = vorhanden ? 3 : 1;
    // Container für Vorschau und Übernahme: vorhanden oder Entwurf
    const basis = vorhanden || { id: 'entwurf', art: f.art, ausr: [], ...(f.eigen ? { nr: N.nr } : { firma: f.firma, fnr: N.fnr, kuerzel: f.kuerzel }) };
    const bestand = !vorhanden && f.bereich ? (s.bestand = s.bestand && s.bestand.bereich === f.bereich ? s.bestand : { bereich: f.bereich, ausr: bestandAusr(p, f.bereich) }).ausr : [];
    const neu = []; let t = { ...basis, ausr: [...basis.ausr, ...bestand] };
    for (const id of s.wahl) { const a = INV.frei.find(x => x.id === id); if (!a) continue; const pr = probeGeraet(t, a, s.haengt[id] || 'Konvektor'); neu.push(pr); t = { ...t, ausr: [...t.ausr, pr] }; }
    const kopf = html`<div class="inv-schritte">${SCHRITTE.map((n, i) => html`<span class="inv-schritt ${i + 1 === s.schritt ? 'on' : i + 1 < s.schritt ? 'fertig' : ''} ${i + 1 < erster ? 'aus' : ''}"><i>${i + 1 < s.schritt ? '✓' : i + 1}</i>${n}</span>`)}</div>`;
    const weiter = (t2, fn) => knopf(t2, fn, 'amber'), zurueck = s.schritt > erster && s.schritt < 5 ? knopf('‹ Zurück', () => { s.schritt--; z(); }, 'leise-k') : nothing;
    let inhalt;
    if (s.schritt === 1) inhalt = html`${eigenSeg(f, z)}${artWahl(f, z)}${weiter('Weiter ›', () => { s.schritt = 2; z(); })}`;
    else if (s.schritt === 2) inhalt = html`<div class="leise inv-p">${f.eigen ? 'Eigener Container' : 'Fremdcontainer'} · ${ART[f.art]}</div>${nummerFelder(p, f, z)}${namenVorschau(f, N)}${N.ok ? nothing : html`<div class="leise amber-t inv-p">Bitte zuerst ein Firmenkürzel eintragen</div>`}
      ${weiter('Weiter ›', () => { if (!N.ok) return p.toast('Firmenkürzel fehlt'); s.schritt = 3; z(); })}`;
    else if (s.schritt === 3) inhalt = html`<div class="leise inv-p">für <span class="inv-id">${cName(t)}</span>${vorhanden ? ' · ' + bsText(vorhanden) : ''}</div>
      ${bestand.length ? html`<div class="glas-panel liste"><div class="gruppe">Schon im Container (aus Home Assistant)</div>${bestand.map(a => html`<div class="zeile"><div><b>${GERAET_IC[a.typ]} ${a.alt.ha}</b><div class="leise">${a.modell} · wird GG ${z2(a.gg)}${a.hz ? ' · ' + a.hz.typ : a.btr ? ' · Bautrockner' : ''}</div></div><span class="blau">✓</span></div>`)}</div>` : nothing}
      ${freieWahl(s, z, true)}
      ${neu.filter(a => a.typ === 'PLUG').map(a => html`<div class="glas-panel inv-vorschau-name"><div class="leise">${a.alt.ha} wird <span class="inv-id">${gName(t, a)}</span></div>${haengtSeg(s.haengt[a.id] || 'Konvektor', v => { s.haengt[a.id] = v; z(); })}</div>`)}
      ${weiter(neu.length || bestand.length || vorhanden ? 'Weiter zur Vorschau ›' : 'Ohne Ausrüstung weiter ›', () => { if (vorhanden && !neu.length) return p.toast('Bitte ein Gerät wählen'); s.schritt = 4; z(); })}`;
    else if (s.schritt === 4) {
      const G = schritte(t, vorhanden ? neu : t.ausr), nz = zaehle(G), D = { G, nz, rueck: false }, B = vorschauKoerper(p, { ...s, neuA: neu }, t, D);
      inhalt = html`${G.length ? html`${B.zahlen}<div class="inv-inhalt">${B.inhalt}</div>` : html`<div class="glas-panel liste"><div class="zeile"><span class="leise">Noch keine Ausrüstung – nur der Container wird angelegt (Labels kommen mit dem ersten Gerät).</span></div></div>`}
        ${knopf((vorhanden ? 'Übernehmen · ' : 'Anlegen und übernehmen · ') + nz.aendern + ' Schritte', p.nurAdmin(() => {
          if (vorhanden) { uebernehmen(p, vorhanden, { neuA: neu, freiIds: s.wahl }, D); s.ergebnis = { zeit: uhrzeit(), n: nz.aendern }; p.s.sheet = s; }
          else { const c = anlegen(p, f, N, [...bestand, ...neu].map(a => ({ ...a, neu: false, fertig: true, alt: { ...a.alt, ha: gName(t, a), plug: a.alt.plug && gName(t, a), ids: Object.fromEntries(Object.keys(a.alt.ids).map(k => [k, eid(ENT[k][1], gName(t, a), ENT[k][2])])) }, hz: a.hz && { ...a.hz, alt: gName(t, a, 'hz') }, btr: a.btr && { alt: gName(t, a, 'btr') } }))); for (const id of s.wahl) INV.frei.splice(INV.frei.findIndex(x => x.id === id), 1); s.cId = c.id; s.angelegt = true; s.ergebnis = { zeit: uhrzeit(), n: nz.aendern, neu: true }; }
          s.schritt = 5; z(); }), 'amber nur-admin')}<div class="leise inv-p">nur Admins · Anlegen braucht die Datenbank</div>`;
    } else { const c = INV.container.find(x => x.id === s.cId), e = s.ergebnis || { zeit: uhrzeit(), n: 0 };
      inhalt = html`<div class="glas-panel liste"><div class="zeile ereignis"><span class="zeit">${e.zeit}</span><span class="p-ic">✓</span><div><span>${cName(c)} ${e.neu ? 'angelegt' : 'ergänzt'} · ${e.n} Schritte</span><div class="leise">von Herbert · steht im Protokoll der Baustelle</div></div></div></div>
        ${knopf('Container ansehen', () => auf(p, { art: 'inv-container', id: c.id }), 'amber')}${knopf('Rückgängig …', p.nurAdmin(() => toast(p, 'Rückgängig: wie bei „Namen prüfen“ (eigene Vorschau neu → alt)')), 'nur-admin')}${knopf('Schließen', () => { p.s.sheet = null; neuAlle(); }, 'leise-k')}`; }
    return html`${GRIFF}${band()}<h3>${vorhanden ? 'Gerät zuordnen' : 'Container anlegen'} · Schritt ${s.schritt} von 5</h3>${kopf}${inhalt}${zurueck}${s.schritt < 5 ? knopf('Abbrechen', () => p.schliessen(), 'leise-k') : nothing}`;
  }
  const toast = (p, t) => p.toast(t);

  /* ---------- Einhängen über den Rahmen ---------- */
  R.gruppe({ k: 'inventar', ic: '📦', t: 'Inventar', marke: true, nach: 'container', wann: () => INV.v === 1 || INV.v === 4, kurz: gruppeKurz, inhalt: gruppeInhalt });
  R.reiter({ k: 'inventar', t: 'Inventar', tKurz: '📦', nach: 'verlauf', wann: () => INV.v === 2, inhalt: reiterAnsicht });
  R.abschnitt({ ansicht: 'container', wann: p => INV.v === 3 && p.b && !p.b.pumpe, vor: p => v3Kopf(p, p.b), nach: p => v3Abschnitt(p, p.b) });
  const breit = sh => sh.art === 'inv-vorschau' || (sh.art === 'inv-assistent' && sh.schritt === 4);
  for (const [art, fn] of Object.entries({ 'inv-container': containerSheet, 'inv-neu': anlegenSheet, 'inv-zuordnen': zuordnenSheet, 'inv-vorschau': vorschauSheet, 'inv-suche': sucheSheet, 'inv-assistent': assistentSheet })) R.einblendung(art, fn, { breit });
  R.stil(`
.inv-id { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 13px; letter-spacing: .2px; overflow-wrap: anywhere; }
.inv-gross { font-size: 20px; } .inv-riesig { font-size: 18px; font-weight: 600; color: var(--ink); }
.inv-unterzeile { padding: 0 4px 6px; } .inv-p { padding: 6px 4px; }
.inv-filter .leise { font-size: 11px; } .inv-filter button { flex: 1 1 auto; min-width: 0; padding: 7px 4px; }
.inv-c { text-align: left; } .inv-c-t { flex: 1; min-width: 0; } .inv-c .badge { margin-left: 6px; } .inv-zahl { white-space: nowrap; }
.inv-g { min-width: 0; } .inv-unter { padding-left: 30px !important; } .inv-unter .inv-id { font-size: 12px; color: var(--ink2); }
.inv-st { font-size: 12px; padding: 3px 10px !important; border-radius: 12px !important; white-space: nowrap; background: rgba(120,120,128,.18) !important; flex: none; }
.inv-st.aktiv { color: #30d158; } .inv-st.verliehen { color: var(--blau); } .inv-st.defekt { color: var(--rot); }
.inv-arten { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.inv-art { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 7px 4px !important; border-radius: 12px !important; background: rgba(120,120,128,.18) !important; color: var(--ink) !important; text-align: center !important; }
.inv-art b { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 14px; } .inv-art span { font-size: 11px; color: var(--ink2); }
.inv-art.on { background: var(--amber) !important; color: #1a1000 !important; } .inv-art.on span { color: #1a1000; }
.inv-vorschau-name { padding: 12px 16px; border-radius: 18px; display: flex; flex-direction: column; gap: 4px; }
.inv-name-z { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.inv-feldzeile { padding: 8px 0; } .inv-feldzeile > .inv-id { white-space: nowrap; }
.inv-seg { flex-wrap: wrap; } .inv-seg button { flex: 1 1 auto; }
.sheet > .feld, .sheet > .seg, .sheet > .glas-panel, .sheet > .knopf, .sheet > .inv-zahlen, .sheet > .inv-karten, .sheet > .inv-schritte, .sheet > .inv-suchfeld, .sheet > .inv-inhalt { margin-top: 10px; }
.inv-inhalt > * + * { margin-top: 10px; }
.inv-suchfeld { width: 100%; box-sizing: border-box; font-size: 15px !important; }
.inv-zahlen { display: flex; flex-wrap: wrap; gap: 6px; } .inv-zahlen .chip { font-size: 12px; padding: 4px 10px; }
.inv-symbol { max-width: 200px; margin: 0 auto; filter: drop-shadow(0 12px 14px rgba(0,0,0,.35)); } .inv-symbol svg { width: 100%; height: auto; display: block; }
.inv-k { cursor: pointer; min-width: 0; } .inv-k .glas-name { font-size: 14px; } .inv-k-ort { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.inv-zwei { display: grid; gap: 12px; } @container (min-width: 700px) { .inv-zwei { grid-template-columns: 1fr 1fr; align-items: start; } }
.inv-gruppe { padding: 4px 14px 8px; } .inv-g-kopf { display: flex; gap: 10px; align-items: center; padding: 8px 0 6px; }
.inv-g-ic { font-size: 17px; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: rgba(127,127,127,.16); flex: none; }
.inv-w { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; } .inv-w .inv-id { font-size: 12px; }
.inv-m { font-size: 11px; white-space: nowrap; }
.inv-hinweis { font-size: 11px; margin-top: 2px; }
.inv-warn .zeile { padding: 8px 16px; }
/* V1 Tabelle */
.inv-tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "was m" "alt neu" "hin hin"; column-gap: 10px; row-gap: 2px; padding: 6px 0; border-top: 1px solid var(--gridc); font-size: 13px; }
.inv-tr .t-was { grid-area: was; font-size: 11px; color: var(--ink2); } .inv-tr .t-alt { grid-area: alt; color: var(--ink2); min-width: 0; } .inv-tr .t-neu { grid-area: neu; font-weight: 500; min-width: 0; } .inv-tr .t-m { grid-area: m; text-align: right; } .inv-tr .inv-hinweis { grid-area: hin; }
.inv-th { font-size: 10px !important; letter-spacing: 1px; text-transform: uppercase; color: var(--ink2); border-top: 0; padding: 0 0 2px; grid-template-areas: "alt neu"; } .inv-th .t-was, .inv-th .t-m { display: none; } .inv-th .t-neu { font-weight: 400; }
.inv-tr.konflikt .t-neu, .inv-tr.offen .t-neu { opacity: .55; }
/* V2 Karten */
.inv-karten { display: grid; gap: 10px; } .inv-karte { padding: 4px 14px 10px; border-radius: 18px; }
.inv-kz { padding: 7px 0; border-top: 1px solid var(--gridc); } .inv-kz-was { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--ink2); }
.inv-kz-neu { font-weight: 500; font-size: 13px; } .inv-kz-alt { font-size: 11px; color: var(--ink2); overflow-wrap: anywhere; } .inv-kz-alt s { text-decoration-color: rgba(127,127,127,.6); } .inv-kz-alt .inv-id { font-size: 11px; }
.inv-kz-gleich { padding: 6px 0 0; border-top: 1px solid var(--gridc); } .inv-kz.konflikt .inv-kz-neu, .inv-kz.offen .inv-kz-neu { opacity: .55; }
/* V3 Aufklappen */
.inv-akk-k { text-align: left; padding: 8px 14px !important; } .inv-akk .zeile + .zeile, .inv-akk .inv-akk-inhalt + .zeile { border-top: 1px solid var(--gridc); } .inv-akk-t { flex: 1; min-width: 0; } .inv-chev { transition: transform .2s; display: inline-block; } .inv-chev.auf { transform: rotate(90deg); }
.inv-akk-inhalt { padding: 0 14px 8px 54px; } .inv-kl { display: flex; flex-direction: column; padding: 5px 0; border-top: 1px solid var(--gridc); font-size: 12px; }
.inv-kl-wer { font-size: 11px; } .inv-kl-z { overflow-wrap: anywhere; } .inv-kl-z .inv-id { font-size: 12px; } .inv-kl-alt { color: var(--ink2); text-decoration: line-through; text-decoration-color: rgba(127,127,127,.6); } .inv-kl .inv-m { margin-left: 6px; }
/* V4 Vorher/Nachher */
.inv-vn { padding: 4px 14px 10px; border-radius: 18px; } .inv-vn-raster { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 10px; }
.inv-vn-k { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink2); padding: 2px 0 4px; }
.inv-vn-z { display: flex; flex-direction: column; padding: 5px 0; border-top: 1px solid var(--gridc); font-size: 13px; min-width: 0; } .inv-vn-z small { font-size: 10px; color: var(--ink2); }
.inv-vn-z.alt { color: var(--ink2); } .inv-vn-z.neu.aendern, .inv-vn-z.neu.neu, .inv-vn-z.neu.fertig { color: var(--blau); } .inv-vn-z.neu.konflikt, .inv-vn-z.neu.offen { opacity: .6; } .inv-vn-z.gleich { opacity: .6; }
.inv-vn-hin { grid-column: 1 / -1; padding: 0 0 4px; }
/* V3 Kopf im Container */
.inv-kopf { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; border-radius: 20px; }
.inv-kopf-t { display: flex; gap: 12px; align-items: center; min-width: 0; } .inv-kopf-nr { white-space: nowrap; font-size: 26px; font-weight: 600; color: var(--amber); } .inv-kopf-k { display: flex; gap: 6px; flex-wrap: wrap; } .inv-kopf-k .chip { font-size: 12px; padding: 5px 10px; }
/* V4 Schritte */
.inv-schritte { display: flex; gap: 4px; flex-wrap: wrap; } .inv-schritt { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ink2); padding: 3px 8px 3px 3px; border-radius: 12px; background: rgba(120,120,128,.14); }
.inv-schritt i { font-style: normal; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: rgba(120,120,128,.3); font-size: 10px; }
.inv-schritt.on { color: var(--ink); font-weight: 600; } .inv-schritt.on i { background: var(--amber); color: #1a1000; } .inv-schritt.fertig i { background: #30d158; color: #002; } .inv-schritt.aus { opacity: .35; }
@container (min-width: 700px) {
  .r-breit .inv-tr { grid-template-columns: 170px minmax(0, 1fr) minmax(0, 1fr) 96px; grid-template-areas: "was alt neu m" ". hin hin hin"; align-items: start; }
  .r-breit .inv-tr .t-was { font-size: 12px; } .r-breit .inv-tr .t-m { text-align: left; }
  .r-breit .inv-th { grid-template-areas: "was alt neu m"; } .r-breit .inv-th .t-was, .r-breit .inv-th .t-m { display: block; font-size: 10px; }
  .r-breit .inv-karten { grid-template-columns: 1fr 1fr; align-items: start; }
}`);

  /* ---------- Vorführ-Leiste ---------- */
  function einstieg(q) {
    INV.filter = 'alle';
    if (INV.v === 2) q.gehe('inventar'); else if (INV.v === 3) q.containerOeffnen('mannschaft'); else { q.s.evGruppe = 'inventar'; q.gehe('einst'); }
  }
  const zeigen = (v, ziel) => {
    INV.v = v;
    for (const q of P_()) {
      einstieg(q);
      const c2 = { art: 'inv-container', id: 'c2' }, zur = INV.v === 3 ? undefined : c2;
      if (ziel === 'container' && INV.v !== 3) q.s.sheet = c2;
      if (ziel === 'fremd') q.s.sheet = { art: 'inv-container', id: 'f1' };
      if (ziel === 'suche') q.s.sheet = { art: 'inv-suche' };
      if (ziel === 'neu') q.s.sheet = INV.v === 4 ? { art: 'inv-assistent', schritt: 1, form: neuForm(), wahl: [], haengt: {} } : { art: 'inv-neu', form: neuForm() };
      if (ziel === 'neu-fremd') q.s.sheet = INV.v === 4 ? { art: 'inv-assistent', schritt: 2, form: neuForm({ eigen: false, firma: 'leitner' }), wahl: [], haengt: {} } : { art: 'inv-neu', form: neuForm({ eigen: false, firma: 'leitner' }) };
      if (ziel === 'zuordnen') q.s.sheet = INV.v === 4 ? { art: 'inv-assistent', schritt: 3, cId: 'c2', form: neuForm(), wahl: [INV.frei[0].id], haengt: {}, zurueck: zur } : { art: 'inv-zuordnen', id: 'c2', wahl: INV.frei[0] && INV.frei[0].id, haengt: 'Konvektor', zurueck: zur };
      if (ziel === 'assistent-vorschau') q.s.sheet = { art: 'inv-assistent', schritt: 4, form: neuForm({ bereich: 'magazin', bName: 'Magazin', art: 'MAT' }), wahl: [INV.frei[0].id], haengt: {} };
      if (ziel === 'vorschau') q.s.sheet = INV.umb.c2 ? { art: 'inv-vorschau', id: 'c2', ergebnis: { ...INV.umb.c2 }, zurueck: zur } : { art: 'inv-vorschau', id: 'c2', zurueck: zur };
      if (ziel === 'rueck') q.s.sheet = INV.umb.c2 ? { art: 'inv-vorschau', id: 'c2', rueck: true, zurueck: zur } : { art: 'inv-vorschau', id: 'c2', zurueck: zur };
      q.neuZeichnen();
    }
  };
  const lageSetzen = lage => {
    INV.lage = lage === 'nach' ? 'normal' : lage === 'nach-teil' ? 'offline' : lage; delete INV.umb.c2;
    INV.protokoll = INV.protokoll.filter(e => !e.text.startsWith('002_C_MAN'));
    if (lage === 'nach' || lage === 'nach-teil') { const G = schritte(INV.container.find(c => c.id === 'c2')), nz = zaehle(G), teil = nz.offline > 0;
      INV.umb.c2 = { zeit: '16:12', status: teil ? 'teilweise' : 'ausgefuehrt', n: nz.aendern, offen: nz.offline, G };
      INV.protokoll.push({ zeit: '16:12', ic: teil ? '◐' : '✓', text: '002_C_MAN ' + (teil ? 'teilweise umbenannt' : 'umbenannt'), unter: 'von Herbert · ' + nz.aendern + ' Schritte' + (teil ? ' · ' + nz.offline + ' offen' : '') }); }
  };
  R.vorfuehren(w => { lageSetzen(w.lage); zeigen(+w.variante, w.zeigen); });
}

const V = [['1', '1 · Einstellungen-Gruppe · Tabelle'], ['2', '2 · Eigener Reiter · Karten'], ['3', '3 · Im Container · Aufklappen'], ['4', '4 · Assistent · Vorher/Nachher']];
const ZEIGEN = [['einstieg', 'Einstieg'], ['container', 'Container 002_C_MAN'], ['fremd', 'Fremdcontainer STRA-01'], ['suche', 'Suche ⌕'], ['neu', 'Container anlegen (eigen)'], ['neu-fremd', 'Container anlegen (fremd)'],
  ['zuordnen', 'Gerät zuordnen'], ['vorschau', 'Vorschau alt → neu'], ['assistent-vorschau', 'Anlegen: Vorschau (Magazin übernehmen)'], ['rueck', 'Rückgängig']];
const LAGEN = [['normal', 'normal'], ['konflikt', 'Konflikt (Entity-ID vergeben)'], ['offline', 'Plug offline'], ['nach', 'nach Übernahme'], ['nach-teil', 'nach Übernahme · teilweise']];
const faelle = [];
for (const [v] of V) for (const [z, l] of [['einstieg', 'normal'], ['container', 'normal'], ['neu', 'normal'], ['zuordnen', 'normal'], ['vorschau', 'normal'], ['vorschau', 'konflikt'], ['vorschau', 'offline'], ['vorschau', 'nach-teil'], ['rueck', 'nach'], ['neu-fremd', 'normal'], ['suche', 'normal'], ['assistent-vorschau', 'normal'], ['fremd', 'normal']])
  faelle.push({ name: `v${v}-${z}${l === 'normal' ? '' : '-' + l}`, werte: { variante: v, lage: l, zeigen: z } });
// Bedienung: Übernehmen (teilweise), nachholen, Rückgängig; Anlegen im Assistenten bis zum Ende; Zuordnen übernehmen
for (const [v] of V) faelle.push({ name: `v${v}-uebernommen`, werte: { variante: v, lage: 'offline', zeigen: 'vorschau' }, klick: ['Übernehmen', 'Fehlende Schritte nachholen'] });
for (const [v] of V) faelle.push({ name: `v${v}-zurueckgenommen`, werte: { variante: v, lage: 'nach', zeigen: 'rueck' }, klick: ['Zurücknehmen'] });
faelle.push({ name: 'v4-assistent-ende', werte: { variante: '4', lage: 'normal', zeigen: 'neu' }, klick: ['Weiter', 'Weiter', 'Ohne Ausrüstung', 'Anlegen und übernehmen'] });
faelle.push({ name: 'v1-zuordnen-ende', werte: { variante: '1', lage: 'normal', zeigen: 'zuordnen' }, klick: ['Weiter zur Vorschau', 'Übernehmen'] });
faelle.push({ name: 'v3-einstieg-abschnitt', werte: { variante: '3', lage: 'normal', zeigen: 'einstieg' }, scroll: '.inv-abschnitt' });
for (const [v] of V) for (const l of ['normal', 'konflikt']) faelle.push({ name: `v${v}-vorschau${l === 'normal' ? '' : '-' + l}-inhalt`, werte: { variante: v, lage: l, zeigen: 'vorschau' }, scroll: l === 'normal' ? '.inv-inhalt' : '.konflikt' });
rahmen.bauen({ datei: 'inventar.html', titel: 'Baustelle – Inventar (4 Varianten)', leiste: 'BSM-031 Inventar · 4 Varianten', vorher: ZEICHNER, browser, faelle,
  auswahl: [{ id: 'variante', t: 'Variante', optionen: V }, { id: 'lage', t: 'Lage', optionen: LAGEN }, { id: 'zeigen', t: 'zeigen', optionen: ZEIGEN }] });
