/* Klickbarer Prototyp der Baustellen-Seite im Glas-Stil (Beispieldaten, keine Verbindung zu HA). */
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const de = (x, d = 1) => Number(x).toLocaleString('de-AT', { minimumFractionDigits: d, maximumFractionDigits: d });
const FARBE = { heizt: '#ff9f0a', trocknen: '#ff9f0a', aus: '#8e8e93', frost: '#64d2ff', offline: '#ff453a', laeuft: '#0a84ff', pause: '#bf5af2' };
const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const zufall = seed => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

const az = (ab, name, moDo, fr) => ({ ab, name, tage: { Mo: moDo, Di: moDo, Mi: moDo, Do: moDo, Fr: fr, Sa: null, So: null } });
const HEUTE = '2026-09-29', HEUTE_TAG = 'Di', JETZT = '16:20';
const WOCHE = [['Mo', '28.09.'], ['Di', '29.09.'], ['Mi', '30.09.'], ['Do', '01.10.'], ['Fr', '02.10.'], ['Sa', '03.10.'], ['So', '04.10.']];
const WETTER_WOCHE = { Di: { regen: 6 }, Mi: { kalt: -1.2, regenVortag: 6 }, Fr: { regen: 5.5 } };   // aus der Vorhersage
const minu = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const uhr = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const datum = iso => iso.split('-').reverse().join('.');
const kurzDatum = iso => iso.split('-').reverse().slice(0, 2).join('.') + '.';
const wtag = iso => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(iso + 'T12:00:00').getDay()];
const dauer = (a, b) => { const m = minu(b) - minu(a); return `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`; };
function daten() {
  const r = zufall(7);
  const aussen = [...Array(25)].map((_, h) => 4.2 + 3.2 * Math.sin((h - 9) / 24 * 2 * Math.PI) + (r() - .5) * .6);
  const reihe = (n, a, b) => [...Array(n)].map(() => a + r() * (b - a));
  const bereich = (id, name, f, z, t, geraete, extra = {}) => ({ id, name, f, z, t, geraete, auto: true, trocknen: false,
    innen: aussen.map((a, h) => t === null ? null : Math.max(a + 2, (h >= 7 && h <= 17 ? t : h === 6 ? t - 3 : h === 18 ? t - 2 : t - 6) + (r() - .5))),
    kwh7: reihe(7, 6, 16).map((v, i) => i > 4 ? v * .15 : v), h7: reihe(7, 3, 7).map((v, i) => i > 4 ? 0 : v), ...extra });
  let ph = 0; const g = (n, typ, kw, an) => ({ n, typ, kw, an, hand: false, phase: ['L1', 'L2', 'L3'][ph++ % 3] });
  return {
    aussen,
    baustellen: [
      { name: 'ÖWG Dobl Zwaring', aktiv: true, zeit: 'seit 08.09.2026', kwh: 412, eur: 115.4, container: 6, heiztage: 16, monate: .75, gespart: 1840,
        verlauf: { Sep: 412 }, namen: ['Poliercontainer', 'Mannschaft', 'Magazin', 'Sanitär', 'Lager Süd', 'Pumpenschacht Nord'] },
      { name: 'Reihenhäuser Kalsdorf', aktiv: true, zeit: 'seit 21.09.2026', kwh: 186, eur: 52.1, container: 3, heiztage: 7, monate: .3, gespart: 700,
        verlauf: { Sep: 186 }, namen: ['Polier Kalsdorf', 'Mannschaft Kalsdorf', 'Lager Kalsdorf'] },
      { name: 'Wohnanlage Lieboch', aktiv: false, zeit: '03.11.2025 – 17.04.2026', kwh: 3480, eur: 974.4, container: 5, heiztage: 118, monate: 5.5, gespart: 6120,
        verlauf: { Nov: 520, Dez: 760, Jän: 830, Feb: 690, Mär: 480, Apr: 200 }, namen: ['Polier', 'Mannschaft 1', 'Mannschaft 2', 'Sanitär', 'Magazin'] },
      { name: 'Volksschule Wundschuh', aktiv: false, zeit: '12.01.2025 – 28.03.2025', kwh: 1920, eur: 537.6, container: 3, heiztage: 55, monate: 2.5, gespart: 2990,
        verlauf: {}, namen: ['Polier', 'Mannschaft', 'Sanitär'] },
    ],
    firmen: [{ id: 'eigen', name: 'Eigene Firma', eigen: true }, { id: 'huber', name: 'Elektro Huber GmbH' }, { id: 'leitner', name: 'Installateur Leitner' }],
    // zweite laufende Baustelle (nur für die Auswertung „Alle laufenden“)
    kalsdorf: [
      bereich('k-polier', 'Polier Kalsdorf', 6, 'heizt', 20.1, [g('Radiator', 'Ölradiator', 2.0, 1)], { firma: 'eigen' }),
      bereich('k-mannschaft', 'Mannschaft Kalsdorf', 7, 'heizt', 18.9, [g('Radiator 1', 'Konvektor', 2.0, 1), g('Radiator 2', 'Konvektor', 2.0, 1)], { firma: 'eigen' }),
      bereich('k-lager', 'Lager Kalsdorf', 8, 'aus', null, [g('Radiator', 'Ölradiator', 1.5, 0)], { firma: 'huber' }),
    ],
    bereiche: [
      bereich('polier', 'Poliercontainer', 0, 'heizt', 19.4, [g('Radiator 1', 'Ölradiator', 2.0, 1), g('Radiator 2', 'Konvektor', 1.99, 1)], { trocknen: true, firma: 'eigen', tuer: { sensor: 'Tür Polier', offen: 0 } }),
      bereich('mannschaft', 'Mannschaft', 1, 'trocknen', 17.8, [g('Radiator 1', 'Ölradiator', 2.0, 1), { ...g('Konvektor', 'Konvektor', 2.0, 0), warte: 6 }, g('Trockner', 'Steckdose', 1.79, 1)], { trocknen: true, firma: 'eigen', prio: 'hoch' }),
      bereich('magazin', 'Magazin', 2, 'pause', null, [g('Radiator', 'Ölradiator', 1.5, 0), g('Steckdose', 'Steckdose', 0.4, 0)], { firma: 'huber', prio: 'niedrig', tuer: { sensor: 'Tür Magazin', offen: 6 } }),
      bereich('sanitaer', 'Sanitär', 3, 'frost', 4.2, [g('Frostwächter', 'Konvektor', 2.0, 1)], { firma: 'eigen' }),
      bereich('lager', 'Lager Süd', 4, 'offline', null, [g('Radiator', 'Ölradiator', 2.0, 0)], { offline: true, firma: 'leitner' }),
      bereich('schacht', 'Pumpenschacht Nord', 5, 'laeuft', null, [g('Pumpe 1', 'Pumpe', 0.76, 1), g('Pumpe 2 (Reserve)', 'Pumpe', 0.76, 0)],
        { pumpe: true, firma: 'eigen', zyklen: 36, lauf: '1 h 12 min', laengster: '4 min', kwh7: reihe(7, 0.6, 1.4), h7: reihe(7, 0.8, 1.8), zyk7: reihe(7, 20, 44).map(Math.round) }),
    ],
    // Arbeitszeiten mit Startdatum: es gilt die jüngste, die schon begonnen hat; alte bleiben gespeichert
    arbeitszeiten: [
      az('2025-11-03', 'Winter 2025/26', ['07:30', '16:30'], ['07:30', '12:00']),
      az('2026-03-30', 'Sommer 2026', ['06:30', '16:00'], ['06:30', '12:00']),
      az('2026-09-28', 'Herbst 2026', ['07:00', '16:30'], ['07:00', '12:30']),
      az('2026-11-02', 'Winter 2026/27', ['07:30', '16:30'], ['07:30', '12:00']),
    ],
    e: { preis: 0.28, feiertag_frei: true,
      staffel: true, absicherung: 16, phasen: 3, reserve: 1, max_gleich: 5, min_lauf: 10, min_pause: 5, takt: 15, zaehler: 'keiner',
      tuer_pause: 3, tuer_melden: 10, knoepfe: true,
      bericht: 'woche', bericht_handy: true, bericht_mail: true, mail: 'herbert@example.at', bericht_csv: true, vorheizen: 45, nachheizen: 15, soll: 20, grenze: 15, basis: 'Tageshöchstwert', fruehstart: true, frueh_temp: 0, frueh_min: 30, frost: true, frost_temp: 5,
      tr_mm: 2, tr_laenger: 45, tr_frueher: 15, empfaenger: 'Handy Herbert', m_offline: true, m_trocken: true, m_dauer: true, dauer_min: 20,
      m_leistung: true, m_kalt: true, kalt_min: 60, m_frost: true, m_fuehler: true, m_wetter: true, m_hand: true, hand_h: 8, m_zyklen: true, zyklen_h: 10 },
    feiertage: [['2026-10-26', 'Nationalfeiertag'], ['2026-11-01', 'Allerheiligen'], ['2026-12-08', 'Mariä Empfängnis'], ['2026-12-25', 'Christtag'],
      ['2026-12-26', 'Stefanitag'], ['2027-01-01', 'Neujahr'], ['2027-01-06', 'Heilige Drei Könige']],
    urlaube: [{ name: 'Weihnachten', von: '2026-12-23', bis: '2027-01-06' }],
    // offene Warnungen: stufe 'stoerung' (rot) oder 'hinweis' (gelb)
    warnungen: [
      { id: 'w1', stufe: 'stoerung', b: 'lager', titel: 'nicht erreichbar', seit: 'seit 10:42', hilfe: 'Shelly antwortet nicht. Stecker und Sicherung prüfen – bei Stromausfall meldet er sich von selbst zurück.' },
      { id: 'w2', stufe: 'stoerung', b: 'sanitaer', titel: 'Frostgefahr: 4,2 °C', seit: 'seit 05:40', hilfe: 'Unter der Frostgrenze (5 °C), obwohl der Frostschutz heizt. Tür offen? Heizkörper prüfen.' },
      { id: 'w3', stufe: 'hinweis', b: 'mannschaft', titel: 'zu kalt: 17,8 °C statt 20 °C', seit: 'seit 07:00', hilfe: 'Erreicht in der Arbeitszeit das Soll nicht. Tür oder Fenster offen? Heizkörper zu schwach?' },
      { id: 'w4', stufe: 'hinweis', b: 'magazin', titel: 'Steckdose seit 3 Tagen auf Hand', seit: 'seit Sa 26.09.', hilfe: 'Von Hand eingeschaltet und nicht zurückgestellt. Soll wieder die Automatik übernehmen?' },
      { id: 'w6', stufe: 'hinweis', b: 'magazin', titel: 'Tür seit 6 min offen – Heizung pausiert', seit: 'seit 16:14', hilfe: 'Heizt wieder, sobald die Tür zu ist. Nach 10 min kommt eine Nachricht aufs Handy.' },
      { id: 'w5', stufe: 'hinweis', b: 'schacht', titel: 'Pumpe schaltet oft: 14 Zyklen je Stunde', seit: 'seit 13:10', hilfe: 'Üblich sind hier 3–5. Schwimmer prüfen – oder das Grundwasser steigt.' },
    ],
    // Protokoll: dauerhaft bei der Baustelle gespeichert, zusätzlich im HA-Logbuch
    protokoll: [
      ['Heute', '16:30', 'schalten', 'mannschaft', 'Arbeitsende – Nachheizen 15 min, dann Kleidung trocknen 45 min'],
      ['Heute', '16:14', 'schalten', 'magazin', 'Tür offen – Heizung pausiert'],
      ['Heute', '16:08', 'schalten', 'mannschaft', 'Staffelung: Konvektor wartet, Radiator 1 heizt weiter (Rundlauf 15 min)'],
      ['Heute', '13:10', 'warnung', 'schacht', 'Pumpe schaltet oft: 14 Zyklen je Stunde'],
      ['Heute', '10:43', 'nachricht', null, 'An Handy Herbert: „Lager Süd nicht erreichbar – Stromausfall?“'],
      ['Heute', '10:42', 'warnung', 'lager', 'nicht erreichbar'],
      ['Heute', '07:40', 'warnung', 'mannschaft', 'zu kalt: 17,8 °C statt 20 °C'],
      ['Heute', '07:00', 'schalten', null, 'Arbeitsbeginn – Arbeitszeit „Herbst 2026“ 07:00–16:30'],
      ['Heute', '06:15', 'schalten', null, 'Vorheizen – alle Container ein'],
      ['Heute', '05:40', 'warnung', 'sanitaer', 'Frostgefahr: 4,2 °C trotz Frostschutz'],
      ['Heute', '05:00', 'wetter', null, 'Regen 6 mm seit gestern – heute Kleidung trocknen'],
      ['Gestern', '16:45', 'schalten', null, 'Nachheizen beendet – alle Container aus'],
      ['Gestern', '14:05', 'ok', 'lager', 'wieder erreichbar'],
      ['Gestern', '13:20', 'warnung', 'lager', 'nicht erreichbar'],
      ['Gestern', '07:00', 'schalten', null, 'Arbeitsbeginn 07:00'],
      ['Gestern', '06:15', 'schalten', null, 'Vorheizen – alle Container ein'],
      ['Gestern', '05:00', 'wetter', null, 'Heizgrenze nicht erreicht (Höchstwert 9 °C) – es wird geheizt'],
      ['Mo 28.09.', '18:02', 'einstellung', null, 'Neue Arbeitszeit „Herbst 2026“ gilt ab 28.09.2026'],
      ['Mo 28.09.', '09:30', 'schalten', 'magazin', 'Steckdose von Hand eingeschaltet'],
      ['Mo 28.09.', '06:15', 'schalten', null, 'Vorheizen – alle Container ein'],
      ['Sa 26.09.', '11:35', 'ok', 'schacht', 'Pumpe 1 wieder normal'],
      ['Sa 26.09.', '11:12', 'nachricht', null, 'An Handy Herbert: „Pumpenschacht Nord: Dauerlauf 25 min“'],
      ['Sa 26.09.', '11:10', 'warnung', 'schacht', 'Pumpe 1 Dauerlauf 25 min'],
    ],
  };
}

const AKTIV = z => ['heizt', 'trocknen', 'frost', 'laeuft'].includes(z);
const kwVon = b => b.geraete.reduce((s, g) => s + (g.an ? g.kw : 0), 0);
const wertHtml = b => b.pumpe ? `${b.zyklen}<small> Zyklen</small>` : b.t !== null ? `${de(b.t)}<small>°C</small>` : '–';
const illu = b => b.pumpe ? bcSchacht(b.z === 'laeuft') : bcContainer(BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], b.z === 'pause' ? 'aus' : b.z);
const TEXT = b => ({ heizt: b.t === null ? 'an · Thermostat regelt' : 'heizt · Arbeitszeit', trocknen: 'Kleidung trocknen', aus: 'aus bis 06:15', frost: 'Frostschutz', offline: 'nicht erreichbar', laeuft: 'Pumpe läuft', pause: 'pausiert · Tür offen' }[b.z]);
const knopf2 = (t, act, text) => `<button class="knopf leise-k" data-act="${act}" data-t="${text}">${t}</button>`;
// mdi:cog – dasselbe Zahnrad wie in Home Assistant (im Panel später <ha-icon icon="mdi:cog">)
const ICON_COG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>';
const schalter = (on, act, extra = '') => `<button class="sw ${on ? 'on' : ''}" data-act="${act}" ${extra} role="switch" aria-checked="${!!on}"><i></i></button>`;

/* ---------- Diagramme: dünne Marken, Haarraster, Hover-Anzeige ---------- */
function linie(id, reihen, einheit, vb = null) {
  // mit vb: Verbrauch als Fläche im selben Diagramm – links °C, rechts kWh (Herbert, 29.09.2026)
  const W = 320, H = 160, L = 28, R = vb ? 30 : 8, T = 16, U = 22;
  const alle = reihen.flatMap(s => s.v.filter(v => v !== null));
  const lo = Math.floor(Math.min(...alle) / 5) * 5, hi = Math.ceil(Math.max(...alle) / 5) * 5, n = (hi - lo) / 5;
  const x = i => L + i / 24 * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - U);
  const raster = [...Array(n + 1)].map((_, k) => lo + k * 5).map(v =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${v}°</text>`).join('');
  const achse = [0, 6, 12, 18, 24].map(h => `<text x="${x(h)}" y="${H - 6}" class="ax" text-anchor="middle">${String(h).padStart(2, '0')}</text>`).join('');
  const pfade = reihen.map((s, k) => `<path d="${s.v.map((v, i) => v === null ? '' : `${i && s.v[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')}" fill="none" stroke="var(--s${k + 1})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  let flaeche = '', rechts = '', yv = null;
  if (vb) {
    // rechte Achse auf dieselben Rasterlinien legen: n Schritte, Schrittweite glatt gerundet
    const roh = Math.max(...vb) * 1.1 / n, schritt = [.1, .2, .25, .5, 1, 1.5, 2, 2.5, 5].find(st => st >= roh) || 10, vmax = schritt * n;
    yv = v => T + (1 - v / vmax) * (H - T - U);
    const wert = i => vb[Math.min(i, vb.length - 1)], k = reihen.length + 1;
    const d = [...Array(25)].map((_, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${yv(wert(i)).toFixed(1)}`).join('');
    flaeche = `<defs><linearGradient id="vbg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--s${k})" stop-opacity=".42"/><stop offset="1" stop-color="var(--s${k})" stop-opacity=".06"/></linearGradient></defs>
      <path class="fl-flaeche" d="${d}L${x(24)} ${yv(0)}L${x(0)} ${yv(0)}z" fill="url(#vbg-${id})"/><path class="fl-linie" d="${d}" fill="none" stroke="var(--s${k})" stroke-width="1.5" stroke-linejoin="round" opacity=".8"/>`;
    rechts = [...Array(n + 1)].map((_, q) => q * schritt).map(v => `<text x="${W - R + 5}" y="${yv(v) + 3}" class="ax">${de(v, schritt < 1 ? (schritt < .25 ? 1 : 2) : 0)}</text>`).join('')
      + `<text x="${W - R + 5}" y="${T - 7}" class="ax ax-e">kWh</text>`;
  }
  const links = `<text x="${L - 5}" y="${T - 7}" class="ax ax-e" text-anchor="end">°C</text>`;
  CHARTS[id] = { art: 'linie', x0: L, x1: W - R, W, n: 25, reihen, einheit, y, vb, yv, unten: H - U };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}">${raster}${achse}${flaeche}${pfade}${vb ? links + rechts : ''}<g class="hover"></g></svg>
    <div class="legende">${reihen.map((s, k) => `<span><i style="background:var(--s${k + 1})"></i>${s.name} (°C, links)</span>`).join('')}${vb ? `<span><i style="background:var(--s${reihen.length + 1})"></i>Verbrauch (kWh je Stunde, rechts)</span>` : ''}</div>`;
}
function balken(id, werte, labels, einheit, d = 1) {
  const W = 320, H = 150, L = 28, R = 8, T = 10, U = 22, n = werte.length, hi = Math.max(...werte) * 1.15 || 1;
  const bw = (W - L - R) / n, y = v => T + (1 - v / hi) * (H - T - U), stufe = hi > 20 ? 10 : hi > 6 ? 2 : hi > 2 ? 1 : .5;
  const raster = [...Array(Math.floor(hi / stufe) + 1)].map((_, k) => k * stufe).map(v =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${de(v, stufe < 1 ? 1 : 0)}</text>`).join('');
  const b = werte.map((v, i) => { const h = H - U - y(v), bx = L + i * bw + 1, w = bw - 2;
    return `<path d="M${bx} ${H - U}V${y(v) + Math.min(4, h)}q0 -4 4 -4h${w - 8}q4 0 4 4V${H - U}z" fill="var(--s1)" class="bar" data-i="${i}"/>
      <text x="${bx + w / 2}" y="${H - 6}" class="ax" text-anchor="middle">${labels[i]}</text>`; }).join('');
  CHARTS[id] = { art: 'balken', werte, labels, einheit, d };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}">${raster}${b}<rect class="treffer" x="0" y="0" width="0" height="0"/></svg>`;
}
const CHARTS = {};
function streu(id, pkt, k, d0) {
  const W = 320, H = 170, L = 30, R = 8, T = 10, U = 24;
  const tx = [-10, -5, 0, 5, 10, 15], ymax = Math.ceil(Math.max(...pkt.map(q => q[1])) / 50) * 50;
  const x = t => L + (t + 10) / 25 * (W - L - R), y = v => T + (1 - v / ymax) * (H - T - U);
  const raster = [...Array(ymax / 50 + 1)].map((_, q) => q * 50).map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${v}</text>`).join('');
  const achse = tx.map(t => `<text x="${x(t)}" y="${H - 8}" class="ax" text-anchor="middle">${t}°</text>`).join('');
  const t1 = -8, t2 = Math.min(15, -d0 / k);
  const trend = `<line x1="${x(t1)}" y1="${y(k * t1 + d0)}" x2="${x(t2)}" y2="${y(Math.max(0, k * t2 + d0))}" stroke="var(--s2)" stroke-width="2" stroke-dasharray="5 4"/>`;
  const punkte = pkt.map((q, i) => `<circle class="punkt-s" data-i="${i}" cx="${x(q[0]).toFixed(1)}" cy="${y(q[1]).toFixed(1)}" r="4.5" fill="var(--s1)"/>`).join('');
  CHARTS[id] = { art: 'streu', pkt, x, y };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}">${raster}${achse}<text x="${W - R}" y="${H - 8}" class="ax" text-anchor="end" dx="0" opacity="0">.</text>${trend}${punkte}<g class="hover"></g></svg>
    <div class="legende"><span><i style="background:var(--s1)"></i>ein Heiztag</span><span><i style="background:var(--s2)"></i>Trend</span><span class="leise">x: Tagesmittel außen · y: kWh</span></div>`;
}
function flaeche(id, reihen, labels, einheit, jedes) {
  const W = 320, H = 160, L = 30, R = 8, T = 10, U = 22, n = labels.length, viele = reihen.length > 1;
  // gestapelt: jede Reihe liegt auf der Summe der darunterliegenden, die oberste Kante ist die Summe der Auswahl
  let unten = Array(n).fill(0);
  const lagen = reihen.map(r => { const u = unten, o = r.v.map((v, i) => u[i] + v); unten = o; return { ...r, u, o }; });
  const hi0 = Math.max(...unten) * 1.1 || 1;
  const stufe = [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(st => hi0 / st <= 5) || 10000, hi = Math.ceil(hi0 / stufe) * stufe;
  const x = i => L + i / (n - 1) * (W - L - R), y = v => T + (1 - v / hi) * (H - T - U);
  const raster = [...Array(hi / stufe + 1)].map((_, k) => k * stufe).map(v =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${de(v, stufe < 1 ? 1 : 0)}</text>`).join('');
  const achse = labels.map((t, i) => i % jedes ? '' : `<text x="${x(i)}" y="${H - 6}" class="ax" text-anchor="middle">${t}</text>`).join('');
  const g = k => `fl-${id.replace(/[^a-z0-9]/gi, '')}-${k}`;
  const defs = lagen.map((r, k) => `<linearGradient id="${g(k)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r.farbe}" stop-opacity="${viele ? .75 : .45}"/><stop offset="1" stop-color="${r.farbe}" stop-opacity="${viele ? .45 : .03}"/></linearGradient>`).join('');
  const linie = a => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const zurueck = a => a.map((v, i) => [i, v]).reverse().map(([i, v]) => `L${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const flaechen = lagen.map((r, k) => `<path class="fl-flaeche" style="animation-delay:${k * 40}ms" d="${linie(r.o)}${zurueck(r.u)}z" fill="url(#${g(k)})"/>`).join('');
  const kanten = lagen.map(r => `<path class="fl-linie" d="${linie(r.o)}" fill="none" stroke="${viele ? 'var(--trenn)' : r.farbe}" stroke-width="${viele ? 1.5 : 2}" stroke-linejoin="round"/>`).join('');
  const oben = viele ? `<path d="${linie(unten)}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round" opacity=".8"/>` : '';
  CHARTS[id] = { art: 'flaeche', x0: L, x1: W - R, W, n, reihen: lagen, labels, einheit, y };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${raster}${achse}${flaechen}${kanten}${oben}<g class="hover"></g></svg>
    ${viele ? `<div class="legende">${[...lagen].reverse().map(r => `<span><i style="background:${r.farbe}"></i>${esc(r.name)}</span>`).join('')}</div>` : ''}`;
}
const MONATE = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
/* Verbrauch in kWh je Stunde (Tag), je Tag (Monat) oder je Monat (Jahr); Baustelle = Summe der Container */
function verbrauch(bereiche, cid, zeitraum) {
  const eins = (b, k) => { const r = zufall(k * 97 + b.f * 13 + 5), p = b.geraete.reduce((s, g) => s + g.kw, 0) * (b.pumpe ? .25 : 1);
    if (zeitraum === 'Tag') return [...Array(24)].map((_, h) => { const heiz = h >= 6 && h < (b.trocknen ? 18 : 17);   // Vorheizen, Arbeitszeit, Nachheizen (+ Trocknen)
      return b.z === 'frost' ? p * (.3 + r() * .2) : b.offline && h > 10 ? 0 : heiz ? p * (.65 + r() * .3) : p * r() * .06; });
    if (zeitraum === 'Woche') return TAGE.map((_, d) => d > 4 ? p * r() * .5 : p * (4.2 + r() * 1.8));
    if (zeitraum === 'Monat') return [...Array(30)].map((_, d) => { const we = [5, 6].includes((d + 1) % 7); return we ? p * r() * .6 : p * (4.2 + r() * 1.8); });
    return MONATE.map((_, m) => { const saison = [1, .95, .8, .45, .08, 0, 0, 0, .8, 1, 1.05, .95][m]; return p * 135 * saison * (.9 + r() * .2); });
  };
  const k = { Tag: 1, Monat: 2, Jahr: 3, Woche: 4 }[zeitraum];
  const liste = cid ? bereiche.filter(b => b.id === cid) : bereiche; // cid null = Summe der Baustelle
  return liste.map(b => eins(b, k)).reduce((a, w) => a.map((v, i) => v + w[i]));
}

/* ---------- Stimmung: Hintergrund nach Tageszeit (sun.sun) und Wetter (weather.*) ---------- */
const STIMMUNG = { phase: 'tag', wetter: 'regen' };
const WETTER_ANZEIGE = { klar: ['sunny', 'Sonnig'], wolkig: ['cloudy', 'Bewölkt'], regen: ['rainy', 'Regen · 6 mm'], nebel: ['fog', 'Nebel'],
  schnee: ['snowy', 'Schnee · 2 cm'], gewitter: ['lightning-rainy', 'Gewitter · 9 mm'] };
const wetterJetzt = () => { const [w, t] = WETTER_ANZEIGE[STIMMUNG.wetter]; return [w === 'sunny' && STIMMUNG.phase === 'nacht' ? 'clear-night' : w, w === 'sunny' && STIMMUNG.phase === 'nacht' ? 'Klar' : t]; };
function partikel(phase, wetter) {
  const r = zufall(42), z = (a, b) => (a + r() * (b - a)).toFixed(2);
  const tropfen = n => [...Array(n)].map(() => `<i class="tropfen" style="left:${z(-10, 130)}%;--l:${z(12, 26)}px;--d:${z(.55, 1)}s;--v:-${z(0, 2)}s;opacity:${z(.35, .9)}"></i>`).join('');
  const teile = [];
  if (wetter === 'regen') teile.push(tropfen(70));
  if (wetter === 'gewitter') teile.push(tropfen(120), '<i class="blitzlicht"></i>');
  if (wetter === 'schnee') teile.push([...Array(60)].map(() => `<i class="flocke" style="left:${z(-5, 105)}%;--d:${z(7, 14)}s;--v:-${z(0, 14)}s"><b style="--s:${z(2, 5)}px;--w:${z(2, 4)}s"></b></i>`).join(''));
  if (wetter === 'nebel') teile.push([...Array(4)].map((_, k) => `<i class="schwade" style="top:${10 + k * 22}%;--d:${24 + k * 7}s;--v:-${k * 6}s"></i>`).join(''));
  if (wetter === 'wolkig' || wetter === 'regen' || wetter === 'gewitter') teile.push([...Array(3)].map((_, k) => `<i class="wolke" style="top:${z(-5, 45)}%;--d:${z(50, 80)}s;--v:-${z(0, 60)}s"></i>`).join(''));
  if (wetter === 'klar' && phase === 'nacht') teile.push([...Array(45)].map(() => `<i class="stern" style="left:${z(0, 100)}%;top:${z(0, 60)}%;--v:-${z(0, 4)}s;--s:${z(1, 2.4)}px"></i>`).join(''));
  if (wetter === 'klar' && phase !== 'nacht') teile.push('<i class="strahlen"></i>');
  return teile.join('');
}
const APPS = [];

/* ---------- App ---------- */
class App {
  constructor(root) {
    this.root = root; APPS.push(this);
    root.innerHTML = `<div class="glas-bg"><i class="k1"></i><i class="k2"></i><i class="k3"></i><div class="dunst"></div><div class="partikel"></div></div><div class="ui"></div>`;
    this.bg = root.querySelector('.glas-bg'); this.ui = root.querySelector('.ui');
    this.himmel = Himmel.an(this.bg);          // WebGL-Himmel; ohne WebGL bleibt der CSS-Hintergrund
    this.d = daten();
    this.s = { view: 'uebersicht', cid: null, auto: true, sheet: null, chart: 'temp', zeitraum: 'Woche', verlauf: 'aktiv' };
    root.addEventListener('click', e => this.klick(e));
    root.addEventListener('input', e => this.eingabe(e));
    root.addEventListener('pointermove', e => this.hover(e));
    root.addEventListener('pointerleave', () => this.tip(null));
    this.stimmung(false);
    this.render();
  }
  stimmung(neuZeichnen = true) {
    const { phase, wetter } = STIMMUNG;
    if (this.bg.dataset.phase !== phase || this.bg.dataset.wetter !== wetter) this.bg.querySelector('.partikel').innerHTML = partikel(phase, wetter);
    this.bg.dataset.phase = phase; this.bg.dataset.wetter = wetter;
    this.himmel?.setze(phase, wetter, document.body.classList.contains('hell'));
    if (neuZeichnen) this.render();
  }
  get azListe() { return [...this.d.arbeitszeiten].sort((a, b) => a.ab.localeCompare(b.ab)); }
  get azJetzt() { return this.azListe.filter(a => a.ab <= HEUTE).at(-1); }
  /* Heizplan eines Tages aus Arbeitszeit, Vorheizen, Kälte-Frühstart und Kleidung trocknen */
  planTag(tag, trocknen = true) {
    const zeit = this.azJetzt.tage[tag], e = this.d.e, w = WETTER_WOCHE[tag] || {};
    if (!zeit) return null;
    const [a, b] = zeit.map(minu), gruende = [];
    let extra = 0;
    if (e.fruehstart && w.kalt !== undefined && w.kalt < e.frueh_temp) { extra += e.frueh_min; gruende.push(`Frühstart ${de(w.kalt).replace('-', '−')} °C`); }
    if (trocknen && w.regenVortag >= e.tr_mm) { extra += e.tr_frueher; gruende.push(`früher nach Regen`); }
    const tr = trocknen && w.regen >= e.tr_mm ? e.tr_laenger : 0;
    if (tr) gruende.push(`Kleidung trocknen, ${de(w.regen, w.regen % 1 ? 1 : 0)} mm Regen`);
    return { vor: a - e.vorheizen, extra: a - e.vorheizen - extra, a, b, nach: b + e.nachheizen, ende: b + e.nachheizen + tr, gruende };
  }
  statusText() {
    if (!this.s.auto) return 'Handbetrieb – nichts wird geschaltet';
    const p = this.planTag(HEUTE_TAG), j = minu(JETZT);
    if (p && j >= p.extra && j < p.ende) return `♨ heizt bis ${uhr(p.ende)}`;
    if (p && j < p.extra) return `Start um ${uhr(p.extra)}`;
    const i = WOCHE.findIndex(w => w[0] === HEUTE_TAG);
    for (let k = 1; k < 8; k++) { const t = WOCHE[(i + k) % 7][0], q = this.planTag(t); if (q) return `aus · ${k === 1 ? 'morgen' : t} ab ${uhr(q.extra)}`; }
    return 'aus';
  }
  zeitstrahl(p, jetzt = false) {
    const A = 4 * 60, B = 20 * 60, x = m => Math.max(0, Math.min(100, (m - A) / (B - A) * 100));
    const seg = (von, bis, k) => bis > von ? `<i class="${k}" style="left:${x(von)}%;width:${x(bis) - x(von)}%"></i>` : '';
    const inhalt = p ? seg(p.extra, p.vor, 'tl-extra') + seg(p.vor, p.a, 'tl-vor') + seg(p.a, p.b, 'tl-heiz') + seg(p.b, p.nach, 'tl-vor') + seg(p.nach, p.ende, 'tl-trock') : '';
    return `<div class="tl-spur">${inhalt}${jetzt ? `<i class="tl-jetzt" style="left:${x(minu(JETZT))}%"></i>` : ''}</div>`;
  }
  bName(id) { return id ? (this.d.bereiche.find(b => b.id === id) || { name: id }).name : 'Baustelle'; }
  /* Staffelung: gemessene Last, Grenze und freier Platz (nur Heizungen werden geschaltet) */
  last() {
    const e = this.d.e, G = this.d.bereiche.flatMap(b => b.geraete.map(g => ({ b, g }))), heizt = x => ['Ölradiator', 'Konvektor'].includes(x.g.typ);
    const an = G.filter(x => x.g.an && !x.b.offline), summe = l => l.reduce((a, x) => a + x.g.kw, 0);
    const heiz = summe(an.filter(heizt)), pumpe = summe(an.filter(x => x.g.typ === 'Pumpe')), sonst = summe(an.filter(x => !heizt(x) && x.g.typ !== 'Pumpe'));
    const phaseMax = e.absicherung * 230 / 1000, grenze = phaseMax * e.phasen, frei = grenze - e.reserve - pumpe - sonst;
    const phasen = (e.phasen === 3 ? ['L1', 'L2', 'L3'] : ['L1']).map(ph => { const auf = an.filter(x => e.phasen === 1 || x.g.phase === ph);
      return { ph, heiz: summe(auf.filter(heizt)), pumpe: summe(auf.filter(x => x.g.typ === 'Pumpe')), sonst: summe(auf.filter(x => !heizt(x) && x.g.typ !== 'Pumpe')), max: phaseMax * (e.phasen === 1 ? 1 : 1) }; });
    const hk = G.filter(heizt), laufen = hk.filter(x => x.g.an && !x.b.offline).length, warten = hk.filter(x => x.g.warte).length;
    return { heiz, pumpe, sonst, grenze, frei, phasen, hk, laufen, warten, gesamt: heiz + pumpe + sonst };
  }
  stromBalken(L, klein) {
    const w = v => `${Math.max(0, v / L.grenze * 100)}%`;
    return `<div class="strom ${klein ? 'klein' : ''}"><div class="strom-spur"><i class="s-heiz" style="width:${w(L.heiz)}"></i><i class="s-pumpe" style="width:${w(L.pumpe)}"></i><i class="s-sonst" style="width:${w(L.sonst)}"></i>
      <i class="s-res" style="width:${w(this.d.e.reserve)}"></i></div></div>`;
  }
  laufende() { return [{ id: 'dobl', name: 'ÖWG Dobl Zwaring', bereiche: this.d.bereiche }, { id: 'kalsdorf', name: 'Reihenhäuser Kalsdorf', bereiche: this.d.kalsdorf }]; }
  firma(id) { return this.d.firmen.find(f => f.id === id) || this.d.firmen[0]; }
  /* Was im Verbrauch gestapelt wird: Container dieser Baustelle, laufende Baustellen oder Firmen */
  quellen(st, ziel) {
    const alle = ziel === 'aw' && this.s.awScope === 'alle', lauf = alle ? this.laufende() : [this.laufende()[0]];
    const summe = arr => arr.reduce((a, w) => a.map((v, i) => v + w[i]));
    if (st.gruppe === 'firma') return this.d.firmen.map((f, k) => ({ f, k, teile: lauf.flatMap(l => l.bereiche.filter(b => (b.firma || 'eigen') === f.id).map(b => [l, b])) }))
      .filter(x => x.teile.length).map(({ f, k, teile }) => ({ id: f.id, name: f.name, farbe: `var(--s${k + 1})`, v: z => summe(teile.map(([l, b]) => verbrauch(l.bereiche, b.id, z))) }));
    if (alle) return lauf.map((l, k) => ({ id: l.id, name: l.name, farbe: `var(--s${k + 1})`, v: z => verbrauch(l.bereiche, null, z) }));
    return this.d.bereiche.map(b => ({ id: b.id, name: b.name, farbe: BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], v: z => verbrauch(this.d.bereiche, b.id, z) }));
  }
  verbrauchInhalt(st, ziel, kennzahlen) {
    const Q = this.quellen(st, ziel), z = st.zeitraum, aus = Q.filter(q => st.auswahl.includes(q.id)), alleGewaehlt = aus.length === Q.length;
    const alle = ziel === 'aw' && this.s.awScope === 'alle', summenName = alle ? 'Alle laufenden' : 'ÖWG Dobl Zwaring';
    const reihen = aus.length ? aus.map(q => ({ name: q.name, v: q.v(z), farbe: q.farbe })) : [{ name: 'Summe', v: Q.map(q => q.v(z)).reduce((a, w) => a.map((v, i) => v + w[i])), farbe: 'var(--s1)' }];
    const labels = z === 'Tag' ? [...Array(24)].map((_, h) => String(h).padStart(2, '0')) : z === 'Woche' ? TAGE : z === 'Monat' ? [...Array(30)].map((_, d) => `${d + 1}.`) : MONATE;
    const summeJe = labels.map((_, i) => reihen.reduce((a, r) => a + r.v[i], 0)), summe = summeJe.reduce((a, v) => a + v, 0);
    const spitze = Math.max(...summeJe), wo = labels[summeJe.indexOf(spitze)];
    const einheit = z === 'Tag' ? 'kWh/h' : 'kWh', je = { Tag: 'je Stunde · heute', Woche: 'je Tag · diese Woche', Monat: 'je Tag · September', Jahr: 'je Monat · 2026' }[z];
    const was = st.gruppe === 'firma' ? 'Firmen' : alle ? 'Baustellen' : 'Container';
    const titel = !aus.length ? `${summenName} · Summe` : aus.length === 1 ? esc(aus[0].name) : `${aus.length} ${was} gestapelt`;
    const zd = `data-ziel="${ziel}"`;
    return `<div class="block-kopf">${ziel === 'sheet' ? '<h3>Verbrauch</h3>' : '<b>Verbrauch</b>'}<span class="leise">${titel}</span></div>
      <div class="seg">${['Tag', 'Woche', 'Monat', 'Jahr'].map(v => `<button data-act="vb-zeitraum" ${zd} data-v="${v}" class="${v === z ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="vb-gruppe"><span class="leise">stapeln nach</span><div class="seg klein">${[['teil', alle ? 'Baustelle' : 'Container'], ['firma', 'Firma']].map(([k, t]) => `<button data-act="vb-gruppe" ${zd} data-v="${k}" class="${(st.gruppe || 'teil') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="vb-wer"><button data-act="vb-wer" ${zd} class="${!aus.length ? 'on' : ''}"><i style="background:var(--s1)"></i>Summe</button>
        <button data-act="vb-wer" ${zd} data-id="*" class="${alleGewaehlt ? 'on' : ''}">Alle gestapelt</button>
        ${Q.map(q => `<button data-act="vb-wer" ${zd} data-id="${q.id}" class="${st.auswahl.includes(q.id) ? 'on' : ''}"><i style="background:${q.farbe}"></i>${esc(q.name)}${st.auswahl.includes(q.id) ? ' ✓' : ''}</button>`).join('')}</div>
      ${kennzahlen ? `<div class="kennz"><div><b>${de(summe, summe < 100 ? 1 : 0)}</b><span>kWh ${{ Tag: 'heute', Woche: 'diese Woche', Monat: 'im Monat', Jahr: 'im Jahr' }[z]}${reihen.length > 1 ? ' zusammen' : ''}</span></div>
        <div><b>${de(summe * this.d.e.preis, 2)} €</b><span>Kosten</span></div><div><b>${wo}</b><span>Spitze ${de(spitze, 1)} kWh</span></div></div>` : ''}
      <div class="leise">${einheit} ${je}${aus.length > 1 ? ' · gestapelt, oberste Kante = Summe' : ''}</div>
      <div class="chart-wrap">${flaeche(`vb-${ziel}-${this.s.awScope || ''}-${st.gruppe || ''}-${aus.map(q => q.id).join('_') || 'alle'}-${z}`, reihen, labels, einheit, z === 'Tag' ? 6 : z === 'Monat' ? 7 : z === 'Woche' ? 1 : 3)}</div>
      ${reihen.length > 1 ? `<div class="vb-je">${reihen.map(r => { const su = r.v.reduce((a, v) => a + v, 0), sp = Math.max(...r.v);
          return `<div><i style="background:${r.farbe}"></i><span class="n">${esc(r.name)}</span><b>${de(su, su < 100 ? 1 : 0)} kWh</b><span>${de(su * this.d.e.preis, 2)} €</span><span class="leise">Spitze ${labels[r.v.indexOf(sp)]}</span></div>`; }).join('')}</div>` : ''}`;
  }
  /* Abrechnung: je Firma die Container mit kWh und Kosten im gewählten Zeitraum */
  abrechnung(z) {
    const lauf = this.s.awScope === 'alle' ? this.laufende() : [this.laufende()[0]], p = this.d.e.preis;
    const zeilen = this.d.firmen.map(f => ({ f, c: lauf.flatMap(l => l.bereiche.filter(b => (b.firma || 'eigen') === f.id).map(b => ({ l, b, kwh: verbrauch(l.bereiche, b.id, z).reduce((a, v) => a + v, 0) }))) }))
      .filter(x => x.c.length).map(x => ({ ...x, kwh: x.c.reduce((a, c) => a + c.kwh, 0) }));
    const ges = zeilen.reduce((a, x) => a + x.kwh, 0);
    return `<div class="glas-panel block"><div class="block-kopf"><b>Abrechnung nach Firma</b><span class="leise">${{ Tag: 'heute', Woche: 'diese Woche', Monat: 'September 2026', Jahr: '2026' }[z]} · ${de(p, 2)} € je kWh</span></div>
      ${zeilen.map(({ f, c, kwh }) => `<div class="ab-firma ${f.eigen ? 'eigen' : ''}"><div class="ab-kopf"><b>${esc(f.name)}</b><span><b>${de(kwh * p, 2)} €</b> <span class="leise">${de(kwh, 0)} kWh · ${de(kwh / ges * 100, 0)} %</span></span></div>
        ${c.map(x => `<div class="ab-c"><span>${esc(x.b.name)}${lauf.length > 1 ? ` <span class="leise">· ${esc(x.l.name)}</span>` : ''}</span><span class="leise">${de(x.kwh, 0)} kWh · ${de(x.kwh * p, 2)} €</span></div>`).join('')}</div>`).join('')}
      <button class="knopf" data-act="csv" data-art="firma">⇩ Abrechnung als CSV</button></div>`;
  }
  heizplanInhalt() {
    return `<div class="hp-legende"><span><i class="tl-extra"></i>Frühstart</span><span><i class="tl-vor"></i>Vor- und Nachheizen ${this.d.e.vorheizen}/${this.d.e.nachheizen} min</span><span><i class="tl-heiz"></i>Arbeitszeit</span><span><i class="tl-trock"></i>Kleidung trocknen</span></div>
      <div class="hp">${WOCHE.map(([t, d]) => { const p = this.planTag(t), h = t === HEUTE_TAG;
        return `<div class="hp-zeile ${h ? 'heute' : ''}"><div class="hp-tag"><b>${h ? 'heute' : t}</b><span>${d}</span></div>
          <div class="hp-mitte">${this.zeitstrahl(p, h)}<div class="leise">${p ? p.gruende.join(' · ') : 'frei · nur Frostschutz'}</div></div>
          <div class="hp-zeit">${p ? `${uhr(p.extra)}<br>${uhr(p.ende)}` : '–'}</div></div>`; }).join('')}
        <div class="hp-zeile achse"><div></div><div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div><div></div></div></div>`;
  }
  get b() { return this.d.bereiche.find(x => x.id === this.s.cid); }
  gehe(view, cid = null) { this.s.view = view; this.s.cid = cid; this.s.sheet = null; this.render(true); }
  csv(art) {
    // Export (Semikolon, deutsches Komma – öffnet direkt in Excel). art 'firma': Abrechnung je Firma und Container
    const z = (this.s.aw || { zeitraum: 'Monat' }).zeitraum, p = this.d.e.preis, lauf = this.s.awScope === 'alle' ? this.laufende() : [this.laufende()[0]];
    const labels = z === 'Tag' ? [...Array(24)].map((_, h) => `${String(h).padStart(2, '0')}:00`) : z === 'Woche' ? WOCHE.map(w => `${w[0]} ${w[1]}`) : z === 'Monat' ? [...Array(30)].map((_, d) => `${String(d + 1).padStart(2, '0')}.09.2026`) : MONATE.map(m => `${m} 2026`);
    const zeilen = [], zahl = (v, d) => v.toFixed(d).replace('.', ',');   // ohne Tausendertrennung, damit Excel es als Zahl liest
    if (art === 'firma') {
      zeilen.push(['Zeitraum', 'Firma', 'Baustelle', 'Container', 'kWh', 'Preis €/kWh', 'Betrag €'].join(';'));
      for (const f of this.d.firmen) for (const l of lauf) for (const b of l.bereiche.filter(b => (b.firma || 'eigen') === f.id)) {
        const k = verbrauch(l.bereiche, b.id, z).reduce((a, v) => a + v, 0); zeilen.push([z, f.name, l.name, b.name, zahl(k, 2), zahl(p, 2), zahl(k * p, 2)].join(';')); }
    } else {
      zeilen.push(['Zeit', 'Baustelle', 'Firma', 'Container', 'kWh', 'Kosten €'].join(';'));
      for (const l of lauf) for (const b of l.bereiche) verbrauch(l.bereiche, b.id, z).forEach((v, i) => zeilen.push([labels[i], l.name, this.firma(b.firma).name, b.name, zahl(v, 3), zahl(v * p, 2)].join(';')));
    }
    const name = `baustelle-${art === 'firma' ? 'abrechnung' : 'verbrauch'}-${lauf.length > 1 ? 'alle' : 'oewg-dobl-zwaring'}-${z.toLowerCase()}.csv`;
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL && typeof document.createElement === 'function') {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + zeilen.join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click();
    }
    this.toast(`${name} · ${zeilen.length - 1} Zeilen`);
    return zeilen;
  }
  neuerContainer(name, p, firma) {
    const d = this.d;
    d.bereiche.push({ id: 'n' + d.bereiche.length + Date.now().toString(36), name, f: d.bereiche.length, z: 'aus', t: null, auto: true, trocknen: false, pumpe: p, firma, zyklen: 0, lauf: '0 min', laengster: '–',
      innen: [], kwh7: Array(7).fill(0), h7: Array(7).fill(0), zyk7: Array(7).fill(0), geraete: [{ n: p ? 'Pumpe 1' : 'Heizung 03', typ: p ? 'Pumpe' : 'Ölradiator', kw: p ? .76 : 2, an: 0, hand: false }] });
  }
  toast(t) { const el = this.root.querySelector('.toast'); el.textContent = t; el.classList.remove('an'); void el.offsetWidth; el.classList.add('an'); }

  render(neu = false) {
    const scroll = this.root.querySelector('.scroll'), pos = scroll && !neu ? scroll.scrollTop : 0;
    const tabs = [['uebersicht', 'Übersicht'], ['heizung', 'Heizung'], ['auswertung', 'Auswertung'], ['verlauf', 'Verlauf'], ['einst', '⚙']];
    const aktivTab = this.s.view === 'container' ? 'uebersicht' : this.s.view === 'bsdetail' ? 'verlauf' : this.s.view;
    this.ui.innerHTML = `<div class="scroll"><div class="seite ${neu ? 'rein' : ''}">${this['v_' + this.s.view]()}</div></div>
      <nav class="glas-nav glas-panel">${tabs.map(([k, t]) => `<button data-act="tab" data-v="${k}" class="${k === aktivTab ? 'on' : ''} ${k === 'einst' ? 'nav-ic' : ''}" ${k === 'einst' ? 'aria-label="Einstellungen" title="Einstellungen"' : ''}>${k === 'einst' ? ICON_COG : t}</button>`).join('')}</nav>
      <div class="schleier ${this.s.sheet ? 'an' : ''}" data-act="zu"></div>
      <div class="sheet glas-panel ${this.s.sheet ? 'an' : ''}">${this.s.sheet ? this.sheet() : ''}</div>
      <div class="tip"></div><div class="toast glas-panel"></div>`;
    this.root.querySelector('.scroll').scrollTop = pos;
  }

  kopf(titel, klein, rechts = '') {
    return `<div class="glas-kopf glas-panel"><div><div class="glas-klein">${klein}</div><div class="glas-titel">${titel}</div></div>${rechts}</div>`;
  }

  /* ---- Übersicht ---- */
  v_uebersicht() {
    const B = this.d.bereiche, kw = B.reduce((s, b) => s + kwVon(b), 0), W = this.d.warnungen.filter(w => !w.stumm);
    const st = W.filter(w => w.stufe === 'stoerung').length, hi = W.length - st;
    const an = B.flatMap(b => b.geraete).filter(g => g.an).length, alle = B.flatMap(b => b.geraete).length;
    return `<div class="glas-kopf glas-panel">
        <div><div class="klickbar" data-act="sheet" data-s="baustellen"><div class="glas-klein">BAUSTELLE</div><div class="glas-titel">ÖWG Dobl Zwaring <span class="pfeil">▾</span></div>
        ${this.d.e.staffel ? (() => { const L = this.last(); return `<button class="strom-knopf" data-act="sheet" data-s="strom">${this.stromBalken(L, true)}<span class="strom-t"><b>${de(L.gesamt)} / ${de(L.grenze)} kW</b> · ${L.laufen} Heizkörper an${L.warten ? ` · ${L.warten} wartet` : ''} ›</span></button>`; })() : ''}</div>
          <button class="kopf-wetter" data-act="sheet" data-s="wetter">${wetterIcon(wetterJetzt()[0], 22)}<span>${STIMMUNG.wetter === 'schnee' ? '−2,1°' : STIMMUNG.phase === 'nacht' ? '1,8°' : '4,2°'}</span><span class="kw-t">${wetterJetzt()[1]}</span></button></div>
        <button class="glas-kw kw-knopf" data-act="sheet" data-s="verbrauch" title="Verbrauch anzeigen"><span class="blitz ${kw ? 'an' : ''}">⚡</span>${de(kw)}<small> kW</small><span class="kw-pfeil">›</span></button></div>
      <div class="glas-chips">
        <button class="glas-panel chip auto-chip ${this.s.auto ? 'on' : ''}" data-act="auto" role="switch" aria-checked="${this.s.auto}" title="Automatik ${this.s.auto ? 'ausschalten' : 'einschalten'}"><span class="mini-sw"><i></i></span>Automatik</button>
        <button class="chip-status ${this.s.auto ? 'amber' : ''}" data-act="sheet" data-s="heizplan" title="Heizplan anzeigen">${this.statusText()} <span class="pfeil">›</span></button>
        ${W.length ? `<button class="glas-panel chip warn-chip ${st ? 'rot' : 'gelb'}" data-act="sheet" data-s="warnungen">⚠ ${W.length === 1 ? `${esc(this.bName(W[0].b))}: ${esc(W[0].titel)}`
          : [st ? `${st} ${st === 1 ? 'Störung' : 'Störungen'}` : '', hi ? `${hi} ${hi === 1 ? 'Hinweis' : 'Hinweise'}` : ''].filter(Boolean).join(' · ')}</button>` : ''}
        <span class="chip-leise">${an} von ${alle} Geräten an</span>
      </div>
      <div class="glas-raster">${B.map((b, i) => `<button class="glas-panel glas-k ${b.z}" data-act="container" data-id="${b.id}" style="animation-delay:${i * 60}ms;--c:${FARBE[b.z]}">
        <div class="glas-illu">${illu(b)}</div>
        <div class="glas-name">${esc(b.name)}</div>${this.firma(b.firma).eigen ? '' : `<div class="firma-tag">${esc(this.firma(b.firma).name)}</div>`}${b.tuer?.offen ? `<div class="tuer-tag">🚪 offen ${b.tuer.offen} min</div>` : ''}
        <div class="glas-zeile"><span class="glas-wert">${wertHtml(b)}</span><span class="glas-kwk">${de(kwVon(b))} kW</span></div>
        <div class="glas-status"><span class="glas-dot"></span>${TEXT(b)}</div>
        <div class="glas-geraete">${b.geraete.map(g => `<i class="${g.an ? 'an' : ''}"></i>`).join('')}<span>${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'}</span></div></button>`).join('')}
        <button class="glas-panel glas-k neu" data-act="sheet" data-s="container-neu"><span>+</span>Container</button></div>`;
  }

  /* ---- Container ---- */
  v_container() {
    const b = this.b, tl = this.zeitleiste(b);
    const tabs = b.pumpe ? [['pumpzeit', 'Pumpzeit'], ['zyklen', 'Zyklen'], ['verbrauch', 'Verbrauch']] : [['temp', 'Temperatur'], ['verbrauch', 'Verbrauch'], ['heizzeit', 'Heizzeit']];
    if (!tabs.some(t => t[0] === this.s.chart)) this.s.chart = tabs[0][0];
    const c = this.s.chart, tage = TAGE, mitVb = this.s.tempVb !== false;
    const chart = c === 'temp' ? (b.t === null ? '<div class="leer">Kein Temperaturfühler zugeordnet · <button class="link" data-act="tab" data-v="einst">zuordnen</button></div>'
        : linie(`t-${b.id}-${mitVb ? 'vb' : ''}`, [{ name: 'Innen', v: b.innen }, { name: 'Außen', v: this.d.aussen }], '°C', mitVb ? verbrauch(this.d.bereiche, b.id, 'Tag') : null))
      : c === 'verbrauch' ? balken('v-' + b.id, b.kwh7, tage, 'kWh') : c === 'zyklen' ? balken('z-' + b.id, b.zyk7, tage, 'Zyklen', 0) : balken('h-' + b.id, b.h7, tage, 'h');
    const kennz = b.pumpe ? [['Zyklen heute', b.zyklen], ['Laufzeit', b.lauf], ['Längster Lauf', b.laengster]]
      : [['kWh heute', de(b.kwh7[2])], ['Kosten', `${de(b.kwh7[2] * this.d.e.preis, 2)} €`], ['Heizzeit', `${de(b.h7[2])} h`]];
    return `<div class="zurueck-zeile"><button class="glas-panel chip" data-act="tab" data-v="uebersicht">‹ Übersicht</button>
        <button class="glas-panel chip" data-act="sheet" data-s="bereich">Bearbeiten</button></div>
      <div class="glas-panel c-held ${b.z}" style="--c:${FARBE[b.z]}">
        <div class="c-illu">${illu(b)}</div>
        <div class="c-text"><div class="glas-klein">${b.pumpe ? 'PUMPENSCHACHT' : 'CONTAINER'}</div><div class="glas-titel">${esc(b.name)}</div>
          <div class="c-wert">${wertHtml(b)}</div><div class="glas-status"><span class="glas-dot"></span>${TEXT(b)}</div>
          <div class="c-kw">⚡ ${de(kwVon(b))} kW jetzt</div></div>
      </div>
      <button class="glas-panel kennz kennz-knopf" data-act="sheet" data-s="verbrauch" data-id="${b.id}">${kennz.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}<span class="kennz-mehr">Verbrauch ›</span></button>
      <div class="glas-panel block"><div class="seg">${tabs.map(([k, t]) => `<button data-act="chart" data-c="${k}" class="${k === c ? 'on' : ''}">${t}</button>`).join('')}</div>
        ${c === 'temp' && b.t !== null ? `<div class="chart-optionen"><button class="chip auto-chip ${mitVb ? 'on' : ''}" data-act="temp-vb"><span class="mini-sw"><i></i></span>Verbrauch einblenden</button></div>` : ''}
        <div class="chart-wrap">${chart}</div></div>
      ${b.pumpe ? '' : `<div class="glas-panel block"><div class="block-kopf"><b>Heute</b><span class="leise">Vorheizen · Arbeitszeit · Nachheizen · Kleidung trocknen</span></div>${tl}
        <div class="regelung">${b.t !== null ? `<b>🌡 Mit Fühler</b><span>regelt in der Arbeitszeit auf ${de(this.d.e.soll)} °C (jetzt ${de(b.t)} °C)</span>`
          : `<b>Ohne Fühler</b><span>Heizung bleibt in der Arbeitszeit an, der Thermostat am Heizkörper regelt</span>`}</div></div>`}
      <div class="glas-panel liste">
        ${b.tuer ? `<div class="zeile"><div><b>🚪 ${esc(b.tuer.sensor)}</b><div class="leise">${b.tuer.offen ? `offen seit ${b.tuer.offen} min – Heizung pausiert nach ${this.d.e.tuer_pause} min, Meldung nach ${this.d.e.tuer_melden} min` : 'zu'}</div></div><span class="tuer-z ${b.tuer.offen ? 'offen' : ''}">${b.tuer.offen ? 'offen' : 'zu'}</span></div>` : ''}
        <div class="zeile"><span>♨ Automatik für ${b.pumpe ? 'diesen Schacht' : 'diesen Container'}</span>${schalter(b.auto, 'b-auto')}</div>
        ${b.pumpe ? '' : `<div class="zeile"><span>👕 Kleidung trocknen nach Regen</span>${schalter(b.trocknen, 'b-trocknen')}</div>`}
      </div>
      <div class="glas-panel block"><div class="block-kopf"><b>${b.pumpe ? 'Pumpen' : 'Geräte'}</b><span class="leise">Schalten = Handbetrieb bis zum nächsten Schaltpunkt</span></div>
        ${b.geraete.map((g, i) => `<div class="zeile geraet"><span class="g-ic ${g.an ? 'an' : ''}">${g.typ === 'Pumpe' ? '💧' : g.typ === 'Steckdose' ? '⏻' : '♨'}</span>
          <div class="g-t"><b>${esc(g.n)}</b><span class="leise">${g.typ} · ${de(g.kw, 2)} kW${this.d.e.phasen === 3 ? ` · ${g.phase}` : ''}${g.hand ? ' · <em class="hand">Hand</em>' : ''}${g.warte ? ` · <em class="warte">wartet – Staffel, dran in ${g.warte} min</em>` : ''}${b.z === 'pause' && ['Ölradiator', 'Konvektor'].includes(g.typ) ? ' · <em class="warte">pausiert – Tür offen</em>' : ''}</span></div>
          ${b.offline ? '<span class="leise rot-t">offline</span>' : schalter(g.an, 'geraet', `data-i="${i}"`)}</div>`).join('')}
        <button class="zeile" data-act="sheet" data-s="bereich"><span class="blau">Geräte bearbeiten</span><span class="chev">›</span></button></div>
      ${b.pumpe ? `<div class="glas-panel liste"><div class="zeile"><span>Trockenlauf (unter 30 W beim Laufen)</span><span class="ok">● überwacht</span></div>
        <div class="zeile"><span>Dauerlauf über ${this.d.e.dauer_min} min</span><span class="ok">● überwacht</span></div>
        <div class="zeile"><span>Stromausfall / offline</span><span class="ok">● überwacht</span></div></div>` : ''}`;
  }
  zeitleiste(b) {
    const p = this.planTag(HEUTE_TAG, b.trocknen);
    return `<div class="tl">${this.zeitstrahl(p, true)}<div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div></div>
      ${p ? `<div class="leise">Arbeitszeit ${uhr(p.a)}–${uhr(p.b)} · heizt ${uhr(p.extra)}–${uhr(p.ende)}${p.gruende.length ? ' · ' + p.gruende.join(' · ') : ''}</div>` : ''}`;
  }

  /* ---- Heizung ---- */
  v_heizung() {
    const e = this.d.e, st = (k, d, fmt) => `<span class="stepper"><button data-act="st" data-k="${k}" data-d="${-d}">−</button><b>${fmt(e[k])}</b><button data-act="st" data-k="${k}" data-d="${d}">+</button></span>`;
    const grad = v => `${de(v, 1)} °C`, min = v => `${v} min`, mm = v => `${de(v, 1)} mm`;
    const p = this.planTag(HEUTE_TAG), az = this.azJetzt, hoechst = 9, jetztT = 4.2, bezug = e.basis === 'jetzt' ? jetztT : hoechst;
    const naechster = this.d.feiertage.find(f => f[0] > HEUTE);
    const regel = (ic, titel, text, an) => `<div class="hr-zeile ${an ? 'an' : ''}"><span class="hr-ic">${ic}</span><div><b>${titel}</b><div class="leise">${text}</div></div><span class="hr-an">${an ? '●' : '○'}</span></div>`;
    const C = this.d.bereiche.filter(b => !b.pumpe);
    return `${this.kopf('Heizung', 'ÖWG DOBL ZWARING', `<div>${schalter(this.s.auto, 'auto')}</div>`)}
      <div class="glas-panel block"><div class="block-kopf"><b>Heute</b><span class="leise">welche Regeln greifen</span></div>
        ${regel('🕖', `Arbeitszeit ${p ? `${uhr(p.a)}–${uhr(p.b)}` : 'frei'}`, `„${esc(az.name)}“ · heizt ${p ? `${uhr(p.extra)}–${uhr(p.ende)}` : 'nicht'}`, !!p)}
        ${regel('🌡', `Heizgrenze ${de(e.grenze, 0)} °C`, `${e.basis === 'jetzt' ? 'jetzt' : 'Höchstwert heute'} ${de(bezug, 0)} °C → ${bezug > e.grenze ? 'zu warm, es wird nicht geheizt' : 'es wird geheizt'}`, bezug <= e.grenze)}
        ${regel('🌧', 'Kleidung trocknen', `6 mm Regen seit gestern (ab ${de(e.tr_mm)} mm) → ${e.tr_laenger} min länger, bis ${p ? uhr(p.ende) : '–'}`, 6 >= e.tr_mm)}
        ${regel('❄', 'Kälte-Frühstart morgen', `−1,2 °C erwartet (unter ${de(e.frueh_temp, 0)} °C) → ${e.frueh_min} min früher, dazu ${e.tr_frueher} min nach Regen`, e.fruehstart)}
        ${e.staffel ? (() => { const L = this.last(); return regel('⚡', `Staffelung: ${L.laufen} von ${L.hk.length} Heizkörpern`, `höchstens ${e.max_gleich} gleichzeitig, ${de(L.frei)} kW frei · Vorheizen startet 15 min früher, damit alle warm werden`, true); })() : ''}
        ${regel('🏖', 'Kein Urlaub, kein Feiertag', `nächster Feiertag ${wtag(naechster[0])} ${kurzDatum(naechster[0])} ${naechster[1]}`, false)}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>Heizplan · diese Woche</b><span class="leise">aus Arbeitszeit und Wetter</span></div>${this.heizplanInhalt()}</div>
      ${this.azBlock()}
      <div class="glas-panel block"><div class="block-kopf"><b>So wird geheizt</b><span class="leise">in der Arbeitszeit immer</span></div>
        <div class="zeile"><div><b>Vorheizen</b><div class="leise">vor Arbeitsbeginn, damit es warm ist</div></div>${st('vorheizen', 5, min)}</div>
        <div class="zeile"><div><b>Nachheizen</b><div class="leise">nach Arbeitsende, jeden Tag</div></div>${st('nachheizen', 5, min)}</div>
        <div class="zeile"><div><b>🚪 Tür offen</b><div class="leise">Heizung pausieren nach</div></div>${st('tuer_pause', 1, min)}</div>
        <div class="zeile unter"><span>Nachricht nach</span>${st('tuer_melden', 5, min)}</div>
        <div class="zeile"><div><b>🌡 Solltemperatur</b><div class="leise">für Container mit Fühler; ohne Fühler regelt der Heizkörperthermostat</div></div>${st('soll', .5, grad)}</div>
        <div class="zeile"><div><b>Heizgrenze</b><div class="leise">nicht heizen, wenn es wärmer ist</div></div>${st('grenze', .5, grad)}</div>
        <div class="zeile"><span>Grundlage</span><div class="seg klein">${['jetzt', 'Tageshöchstwert'].map(v => `<button data-act="basis" data-v="${v}" class="${e.basis === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="zeile"><div><b>Kälte-Frühstart</b><div class="leise">unter ${de(e.frueh_temp, 0)} °C zusätzlich früher</div></div>${schalter(e.fruehstart, 'e-bool', 'data-k="fruehstart"')}</div>
        ${e.fruehstart ? `<div class="zeile unter"><span>so viel früher</span>${st('frueh_min', 5, min)}</div>` : ''}
        <div class="zeile"><div><b>Frostschutz</b><div class="leise">hält jeden Container über der Grenze, auch außerhalb der Arbeitszeit</div></div>${schalter(e.frost, 'e-bool', 'data-k="frost"')}</div>
        ${e.frost ? `<div class="zeile unter"><span>Frostgrenze</span>${st('frost_temp', .5, grad)}</div>` : ''}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>👕 Kleidung trocknen</b><span class="leise">nach Regen zusätzlich zum Nachheizen</span></div>
        <div class="zeile"><span>ab Regen (seit gestern)</span>${st('tr_mm', .5, mm)}</div>
        <div class="zeile"><span>zusätzlich nach dem Nachheizen</span>${st('tr_laenger', 5, min)}</div>
        <div class="zeile"><span>am nächsten Morgen früher</span>${st('tr_frueher', 5, min)}</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Je Container</b><span class="leise">Automatik · Trocknen · Soll</span></div>
        ${C.map(b => { const soll = b.soll ?? e.soll;
          return `<div class="jc"><div class="jc-name"><b>${esc(b.name)}</b><span class="leise">${b.offline ? 'offline' : b.t !== null ? `🌡 ${de(b.t)} °C` : 'ohne Fühler'}</span></div>
            <div class="jc-ctrl"><span class="jc-l">Auto</span>${schalter(b.auto, 'jc-auto', `data-id="${b.id}"`).replace('class="sw', 'class="sw klein')}
              <span class="jc-l">👕</span>${schalter(b.trocknen, 'tr-b', `data-id="${b.id}"`).replace('class="sw', 'class="sw klein')}
              ${b.t !== null ? `<span class="stepper klein"><button data-act="jc-soll" data-id="${b.id}" data-d="-0.5">−</button><b class="${b.soll !== undefined ? 'eigen' : ''}">${de(soll)}°</b><button data-act="jc-soll" data-id="${b.id}" data-d="0.5">+</button></span>`
                : '<span class="leise jc-th">Thermostat</span>'}</div></div>`; }).join('')}
        <div class="leise">Ein eigener Sollwert (bernstein) gilt nur für diesen Container, sonst gilt ${de(e.soll)} °C.</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Urlaub &amp; Feiertage</b></div>
        <div class="zeile"><div><b>An Feiertagen nur Frostschutz</b><div class="leise">Feiertage aus dem Kalender „Feiertage“ – Österreich, jedes Jahr neu berechnet</div></div>${schalter(e.feiertag_frei, 'e-bool', 'data-k="feiertag_frei"')}</div>
        ${this.d.feiertage.filter(f => f[0] > HEUTE).slice(0, 4).map(f => { const t = wtag(f[0]), we = t === 'Sa' || t === 'So';
          return `<div class="zeile unter"><span><b class="ft-d">${t} ${kurzDatum(f[0])}</b> ${f[1]}</span><span class="leise">${we ? 'Wochenende' : 'frei'}</span></div>`; }).join('')}
        <div class="gruppe-t">Urlaub · Kalender „Baustelle Urlaub“</div>
        ${this.d.urlaube.map((u, i) => `<div class="zeile unter"><span><b>${esc(u.name)}</b> <span class="leise">${kurzDatum(u.von)} – ${datum(u.bis)}</span></span><button class="x" data-act="urlaub-weg" data-i="${i}" title="Urlaub löschen">✕</button></div>`).join('') || '<div class="leise">Kein Urlaub eingetragen</div>'}
        <button class="zeile" data-act="sheet" data-s="urlaub"><span class="blau">+ Urlaub eintragen</span></button></div>`;
  }
  azBlock() {
    const L = this.azListe, jetzt = this.azJetzt, geplant = L.filter(a => a.ab > HEUTE), frueher = L.filter(a => a.ab < jetzt.ab).reverse();
    const idx = a => this.d.arbeitszeiten.indexOf(a);
    return `<div class="glas-panel block"><div class="block-kopf"><b>Arbeitszeit</b><span class="badge gruen">gilt seit ${datum(jetzt.ab)}</span></div>
      <div class="az-name">${esc(jetzt.name)}</div>
      ${TAGE.map(t => { const z = jetzt.tage[t]; return `<div class="zeile az ${t === HEUTE_TAG ? 'heute' : ''}"><b class="tag-n">${t}</b>
        <span class="fenster">${z ? `<em>${z[0]}–${z[1]}</em>` : '<span class="leise">frei</span>'}</span><span class="leise">${z ? dauer(z[0], z[1]) : ''}</span></div>`; }).join('')}
      ${geplant.map(a => `<button class="zeile" data-act="sheet" data-s="az" data-i="${idx(a)}"><span><span class="badge blau-b">geplant</span> ab ${datum(a.ab)} · ${esc(a.name)}</span><span class="chev">›</span></button>`).join('')}
      ${frueher.length ? `<button class="zeile" data-act="az-alt"><span>Frühere Arbeitszeiten (${frueher.length})</span><span class="chev">${this.s.azAlt ? '⌄' : '›'}</span></button>` : ''}
      ${this.s.azAlt ? frueher.map(a => `<button class="zeile unter" data-act="sheet" data-s="az" data-i="${idx(a)}"><span>${datum(a.ab)} · ${esc(a.name)}</span><span class="leise">${a.tage.Mo ? a.tage.Mo.join('–') : ''} ›</span></button>`).join('') : ''}
      <button class="zeile" data-act="az-neu"><span class="blau">+ Neue Arbeitszeit ab …</span></button></div>`;
  }

  /* ---- Auswertung ---- */
  v_auswertung() {
    const aw = this.s.aw ||= { zeitraum: 'Monat', auswahl: this.d.bereiche.map(b => b.id) }, z = aw.zeitraum, preis = this.d.e.preis;
    const alle = this.s.awScope === 'alle', lauf = alle ? this.laufende() : [this.laufende()[0]];
    const kwh = lauf.reduce((a, l) => a + verbrauch(l.bereiche, null, z).reduce((x, v) => x + v, 0), 0), ohne = kwh * 4.6;
    const vergleich = { Tag: ['gestern', 8, -3, 5], Woche: ['Vorwoche', -4, -6, 12], Monat: ['Vormonat', 31, 26, -8], Jahr: ['2025', 12, 9, 4] }[z];
    const kz = (wert, text, delta) => `<div><b>${wert}</b><span>${text}</span><em class="${delta > 0 ? 'mehr' : 'weniger'}">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} %</em></div>`;
    // Wetter-Einfluss: letzte 30 Heiztage, kWh je Tag gegen Tagesmittel außen
    const r = zufall(11), pkt = [...Array(30)].map(() => { const t = -6 + r() * 20; return [t, Math.max(4, 7.4 * (15.5 - t) + (r() - .5) * 22)]; });
    const mx = pkt.reduce((a, q) => a + q[0], 0) / 30, my = pkt.reduce((a, q) => a + q[1], 0) / 30;
    const k = pkt.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0) / pkt.reduce((a, q) => a + (q[0] - mx) ** 2, 0), d0 = my - k * mx, null0 = -d0 / k;
    return `${this.kopf('Auswertung', alle ? 'ALLE LAUFENDEN BAUSTELLEN' : 'ÖWG DOBL ZWARING', `<button class="glas-panel chip" data-act="csv">⇩ CSV</button>`)}
      <div class="seg glas-panel">${[['diese', 'Diese Baustelle'], ['alle', `Alle laufenden (${this.laufende().length})`]].map(([k, t]) => `<button data-act="aw-scope" data-v="${k}" class="${(this.s.awScope || 'diese') === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="glas-panel kennz vier">${kz(de(kwh, 0), 'kWh', vergleich[1])}${kz(`${de(kwh * preis, 0)} €`, 'Kosten', vergleich[1])}${kz(`${de(kwh / 11, 0)} h`, 'Heizzeit', vergleich[2])}${kz(`${de(kwh / 90, 1)} h`, 'Pumpzeit', vergleich[3])}</div>
      <div class="leise vgl">Pfeile: im Vergleich zu ${vergleich[0]}</div>
      <div class="glas-panel block">${this.verbrauchInhalt(aw, 'aw', false)}</div>
      ${this.abrechnung(z)}
      <div class="glas-panel block"><div class="block-kopf"><b>Wetter-Einfluss</b><span class="leise">letzte 30 Heiztage · kWh je Tag gegen Außentemperatur</span></div>
        <div class="chart-wrap">${streu('streu', pkt, k, d0)}</div>
        <div class="hinweis-k">Je Grad kälter <b>≈ +${de(-k, 1)} kWh</b> am Tag (${de(-k * preis, 2)} €). Ab etwa <b>${de(null0, 0)} °C</b> wird kaum mehr geheizt – die Heizgrenze steht auf ${de(this.d.e.grenze, 0)} °C.</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Ohne Automatik</b><span class="leise">wenn alles rund um die Uhr liefe</span></div>
        <div class="hbar"><span class="hb-n">mit Automatik</span><span class="hb-spur"><i style="width:${kwh / ohne * 100}%;background:var(--s1)"></i></span><span class="hb-w">${de(kwh * preis, 0)} €</span></div>
        <div class="hbar"><span class="hb-n">ohne (24/7)</span><span class="hb-spur"><i style="width:100%;background:var(--s2)"></i></span><span class="hb-w">${de(ohne * preis, 0)} €</span></div>
        <div class="gespart">gespart <b>${de((ohne - kwh) * preis, 2)} €</b> · ${de((1 - kwh / ohne) * 100, 0)} %</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Ölradiator oder Konvektor</b><span class="leise">nur zum Vergleich · aus eigenen Messungen</span></div>
        <table class="vergleich"><tr><th></th><th>Ölradiator</th><th>Konvektor</th></tr>
          <tr><td>kWh je Heizstunde</td><td>1,62</td><td><b>1,94</b></td></tr>
          <tr><td>Aufheizen auf 18 °C</td><td><b>48 min</b></td><td>31 min</td></tr>
          <tr><td>Abkühlen nach Aus</td><td>2,1 °C/h</td><td><b>3,4 °C/h</b></td></tr>
          <tr><td>Kosten je Tag</td><td>2,72 €</td><td>3,26 €</td></tr></table>
        <div class="leise fuss">Der Ölradiator braucht länger, hält die Wärme aber besser und verbraucht rund 16 % weniger.</div></div>`;
  }

  v_verlauf() {
    const BS = this.d.baustellen, liste = BS.filter(b => b.aktiv === (this.s.verlauf === 'aktiv')), m = this.s.vglArt || 'tag';
    const wert = b => m === 'tag' ? b.kwh / b.heiztage : m === 'monat' ? b.eur / b.monate : b.kwh;
    const fmt = v => m === 'tag' ? `${de(v, 1)} kWh` : m === 'monat' ? `${de(v, 0)} €` : `${de(v, 0)} kWh`, max = Math.max(...BS.map(wert));
    const MON = ['Okt', 'Nov', 'Dez', 'Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep'];
    const mitDaten = BS.map((b, i) => ({ b, i })).filter(({ b }) => Object.keys(b.verlauf).length);
    const reihen = mitDaten.map(({ b, i }) => ({ name: b.name, v: MON.map(x => b.verlauf[x] || 0), farbe: `var(--s${i + 1})` }));
    const draussen = BS.filter(b => !Object.keys(b.verlauf).length).map(b => b.name);
    return `${this.kopf('Verlauf', 'BAUSTELLEN')}
      <div class="glas-panel block"><div class="block-kopf"><b>Vergleich</b><span class="leise">alle Baustellen</span></div>
        <div class="seg">${[['tag', 'kWh je Heiztag'], ['monat', '€ je Monat'], ['ges', 'gesamt']].map(([k, t]) => `<button data-act="vgl" data-v="${k}" class="${k === m ? 'on' : ''}">${t}</button>`).join('')}</div>
        ${BS.map((b, i) => `<div class="hbar"><span class="hb-n">${esc(b.name)}</span><span class="hb-spur"><i style="width:${wert(b) / max * 100}%;background:var(--s${i + 1})"></i></span><span class="hb-w">${fmt(wert(b))}</span></div>`).join('')}
        <div class="leise">${m === 'tag' ? 'Gut vergleichbar, weil unabhängig von der Dauer der Baustelle.' : m === 'monat' ? 'Kosten geteilt durch die Monate mit Heizung.' : 'Summe über die ganze Baustelle.'}</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Letzte 12 Monate</b><span class="leise">kWh je Monat, gestapelt nach Baustelle</span></div>
        <div class="chart-wrap">${flaeche('zwoelf', reihen, MON, 'kWh', 2)}</div>
        ${draussen.length ? `<div class="leise">Ohne Werte in diesem Zeitraum: ${draussen.map(esc).join(', ')}</div>` : ''}</div>
      <div class="seg glas-panel">${[['aktiv', 'Aktiv'], ['ab', 'Abgeschlossen']].map(([k, t]) => `<button data-act="verlauf" data-v="${k}" class="${k === this.s.verlauf ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${liste.map((b, i) => `<button class="glas-panel bs-karte" data-act="bs-oeffnen" data-i="${BS.indexOf(b)}" style="animation-delay:${i * 60}ms">
        <div class="bs-kopf"><b>${esc(b.name)}</b><span class="badge ${b.aktiv ? 'gruen' : ''}">${b.aktiv ? 'aktiv' : 'abgeschlossen'}</span></div>
        <div class="leise">${b.zeit} · ${b.container} Container · ${b.heiztage} Heiztage</div>
        <div class="bs-zahlen"><span><b>${de(b.kwh, 0)}</b> kWh</span><span><b>${de(b.eur, 2)}</b> €</span><span class="leise">${b.aktiv ? 'Übersicht ›' : 'ansehen ›'}</span></div></button>`).join('')}
      ${this.s.verlauf === 'aktiv' ? this.protokoll() : ''}`;
  }
  v_bsdetail() {
    const b = this.d.baustellen[this.s.bs], r = zufall(this.s.bs * 7 + 3), MON = Object.keys(b.verlauf).length ? Object.keys(b.verlauf) : ['Jän', 'Feb', 'Mär'];
    const gesamt = MON.map(x => b.verlauf[x] || b.kwh / MON.length), ant = b.namen.map(() => .5 + r()), su = ant.reduce((a, v) => a + v, 0);
    const reihen = b.namen.map((n, k) => ({ name: n, v: gesamt.map(g => g * ant[k] / su), farbe: BEREICH_FARBEN[k % BEREICH_FARBEN.length] }));
    return `<div class="zurueck-zeile"><button class="glas-panel chip" data-act="tab" data-v="verlauf">‹ Verlauf</button><button class="glas-panel chip" data-act="csv">⇩ CSV</button></div>
      ${this.kopf(esc(b.name), 'ABGESCHLOSSEN · NUR ANSEHEN')}
      <div class="leise vgl">${b.zeit}</div>
      <div class="glas-panel kennz vier"><div><b>${de(b.kwh, 0)}</b><span>kWh</span></div><div><b>${de(b.eur, 0)} €</b><span>Kosten</span></div><div><b>${b.heiztage}</b><span>Heiztage</span></div><div><b>${de(b.gespart * this.d.e.preis, 0)} €</b><span>gespart</span></div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Verbrauch je Monat</b><span class="leise">gestapelt nach Container</span></div>
        <div class="chart-wrap">${flaeche('bs-' + this.s.bs, reihen, MON, 'kWh', 1)}</div>
        <div class="vb-je">${reihen.map(q => { const s2 = q.v.reduce((a, v) => a + v, 0); return `<div><i style="background:${q.farbe}"></i><span class="n">${esc(q.name)}</span><b>${de(s2, 0)} kWh</b><span>${de(s2 * this.d.e.preis, 0)} €</span><span class="leise">${de(s2 / b.kwh * 100, 0)} %</span></div>`; }).join('')}</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Protokoll</b><span class="leise">Auszug</span></div>
        ${[['17.04.', 'einstellung', 'Baustelle abgeschlossen – Heizung aus, Werte gespeichert'], ['03.03.', 'warnung', 'Sanitär: Frostgefahr 3,8 °C trotz Frostschutz'], ['02.03.', 'ok', 'Sanitär: wieder über 5 °C'], ['24.12.', 'schalten', 'Urlaub Weihnachten – nur Frostschutz bis 06.01.'], ['03.11.', 'einstellung', 'Baustelle angelegt, 5 Container']]
          .map(([t, a, x]) => `<div class="zeile ereignis"><span class="zeit">${t}</span><span class="p-ic">${{ einstellung: '⚙', warnung: '⚠', ok: '✓', schalten: '⏻' }[a]}</span><div><span>${x}</span></div></div>`).join('')}</div>
      ${knopf2('Wieder aktiv setzen', 'toast', 'Baustelle wieder aktiv – Automatik bleibt aus, bis du sie einschaltest')}`;
  }
  protokoll() {
    const f = this.s.pfilter || 'alle', ART = { warnung: ['⚠', 'var(--rot)'], ok: ['✓', '#30d158'], schalten: ['⏻', 'var(--amber)'], wetter: ['☁', 'var(--blau)'], nachricht: ['✉', 'var(--ink2)'], einstellung: ['⚙', 'var(--ink2)'] };
    const passt = e => f === 'alle' || e[2] === f || (f === 'warnung' && e[2] === 'ok') || (f === 'schalten' && e[2] === 'einstellung');
    let liste = this.d.protokoll.filter(passt); const mehr = !this.s.pmehr && liste.length > 12; if (mehr) liste = liste.slice(0, 12);
    let tag = '';
    return `<div class="glas-panel block"><div class="block-kopf"><b>Protokoll</b><span class="leise">bleibt mit der Baustelle gespeichert · auch im HA-Logbuch</span></div>
      <div class="vb-wer">${[['alle', 'Alle'], ['warnung', 'Warnungen'], ['schalten', 'Schalten'], ['wetter', 'Wetter'], ['nachricht', 'Nachrichten']].map(([k, t]) => `<button data-act="pfilter" data-v="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${liste.length ? liste.map(e => { const [ic, farbe] = ART[e[2]], kopf = e[0] !== tag ? `<div class="p-tag">${(tag = e[0])}</div>` : '';
        return `${kopf}<div class="zeile ereignis"><span class="zeit">${e[1]}</span><span class="p-ic" style="color:${farbe}">${ic}</span><div>${e[3] ? `<b>${esc(this.bName(e[3]))}</b> ` : ''}<span class="${e[3] ? 'leise' : ''}">${esc(e[4])}</span></div></div>`; }).join('')
        : '<div class="leer">Keine Einträge</div>'}
      ${mehr ? '<button class="zeile" data-act="pmehr"><span class="blau">Ältere Einträge laden</span></button>' : ''}</div>`;
  }

  /* ---- Einstellungen ---- */
  v_einst() {
    const e = this.d.e, st = (k, d, fmt) => `<span class="stepper"><button data-act="st" data-k="${k}" data-d="${-d}">−</button><b>${fmt(e[k])}</b><button data-act="st" data-k="${k}" data-d="${d}">+</button></span>`;
    return `${this.kopf('Einstellungen', 'ÖWG DOBL ZWARING')}
      <div class="glas-panel liste"><div class="gruppe">Baustelle</div>
        <button class="zeile" data-act="sheet" data-s="name"><span>Name</span><span class="leise">ÖWG Dobl Zwaring ›</span></button>
        <button class="zeile" data-act="sheet" data-s="abschliessen"><span>Baustelle abschließen</span><span class="leise">kommt in den Verlauf ›</span></button>
        <button class="zeile" data-act="sheet" data-s="baustelle-neu"><span class="blau">+ Neue Baustelle</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Firmen · für die Abrechnung</div>
        ${this.d.firmen.map(f => { const n = this.d.bereiche.filter(b => (b.firma || 'eigen') === f.id).length;
          return `<button class="zeile" data-act="firma-auf" data-id="${f.id}"><span>${esc(f.name)}${f.eigen ? ' <span class="badge">eigene</span>' : ''}</span><span class="leise">${n} Container ›</span></button>`; }).join('')}
        <button class="zeile" data-act="firma-auf"><span class="blau">+ Firma hinzufügen</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Container und Geräte</div>
        ${this.d.bereiche.map(b => `<button class="zeile" data-act="bereich-einst" data-id="${b.id}"><span><i class="farbpunkt" style="background:${BEREICH_FARBEN[b.f % 6]}"></i>${esc(b.name)}</span><span class="leise">${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'} ›</span></button>`).join('')}
        <button class="zeile" data-act="sheet" data-s="container-neu"><span class="blau">+ Container oder Schacht</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Strom</div>
        <label class="zeile"><span>Preis je kWh</span><span class="eingabe"><input type="number" step="0.01" data-k="preis" value="${e.preis}"> €</span></label>
        <div class="zeile"><div><b>⚡ Staffelung</b><div class="leise">verteilt die Heizungen auf den freien Strom – geschaltet werden nur Heizungen</div></div>${schalter(e.staffel, 'e-bool', 'data-k="staffel"')}</div>
        ${e.staffel ? `<div class="zeile unter"><span>Absicherung je Phase</span>${st('absicherung', 1, v => `${v} A`)}</div>
        <div class="zeile unter"><span>Phasen</span><div class="seg klein">${[1, 3].map(v => `<button data-act="e-wert" data-k="phasen" data-v="${v}" class="${e.phasen === v ? 'on' : ''}">${v === 1 ? '1 Phase' : '3 Phasen'}</button>`).join('')}</div></div>
        <div class="zeile unter"><div><span>Reserve</span><div class="leise">für Werkzeug und Ungemessenes</div></div>${st('reserve', .5, v => `${de(v)} kW`)}</div>
        <div class="zeile unter"><span>Höchstens gleichzeitig</span>${st('max_gleich', 1, v => `${v} Heizk.`)}</div>
        <div class="zeile unter"><span>Mindestlaufzeit</span>${st('min_lauf', 1, v => `${v} min`)}</div>
        <div class="zeile unter"><span>Mindestpause</span>${st('min_pause', 1, v => `${v} min`)}</div>
        <div class="zeile unter"><div><span>Wechsel im Rundlauf</span><div class="leise">wenn nicht alle gleichzeitig dürfen</div></div>${st('takt', 5, v => `${v} min`)}</div>
        <div class="zeile unter"><span>Gesamtzähler</span><select data-k="zaehler"><option value="keiner" ${e.zaehler === 'keiner' ? 'selected' : ''}>keiner – nur Shellys + Reserve</option><option value="3em" ${e.zaehler === '3em' ? 'selected' : ''}>Shelly Pro 3EM am Verteiler</option></select></div>
        <div class="gruppe-t gt-einzug">Vorrang, wenn nicht alle dürfen</div>
        ${this.d.bereiche.filter(b => !b.pumpe).map(b => `<div class="zeile unter"><span>${esc(b.name)}</span><div class="seg klein">${['niedrig', 'normal', 'hoch'].map(v => `<button data-act="prio" data-id="${b.id}" data-v="${v}" class="${(b.prio || 'normal') === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>`).join('')}
        <div class="leise p-fuss">Frostschutz geht immer vor. Pumpen und andere Verbraucher werden mitgezählt, aber nie geschaltet.</div>` : ''}</div>
      <div class="glas-panel liste"><div class="gruppe">Wetter und Kalender</div>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Wetter</span><span class="leise">Open-Meteo · Zone Baustelle ›</span></button>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Außentemperatur</span><span class="leise">aus der Vorhersage ›</span></button>
        <button class="zeile" data-act="sheet" data-s="urlaub"><span>Urlaub</span><span class="leise">Kalender „Baustelle Urlaub“ ›</span></button>
        <div class="zeile"><span>Feiertage</span><span class="leise">Österreich, automatisch</span></div></div>
      <div class="glas-panel liste"><div class="gruppe">Bericht</div>
        <div class="zeile"><span>Wie oft</span><div class="seg klein">${[['aus', 'aus'], ['woche', 'Woche'], ['monat', 'Monat'], ['beides', 'beides']].map(([k, t]) => `<button data-act="e-wert" data-k="bericht" data-v="${k}" class="${e.bericht === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        ${e.bericht !== 'aus' ? `<div class="zeile unter"><span class="leise">${{ woche: 'jeden Montag 07:00 für die Vorwoche', monat: 'am 1. des Monats 07:00 für den Vormonat', beides: 'Montag 07:00 und am 1. des Monats' }[e.bericht]}</span></div>
        <div class="zeile unter"><span>📱 aufs Handy</span>${schalter(e.bericht_handy, 'e-bool', 'data-k="bericht_handy"')}</div>
        <div class="zeile unter"><span>✉ per E-Mail</span>${schalter(e.bericht_mail, 'e-bool', 'data-k="bericht_mail"')}</div>
        ${e.bericht_mail ? `<label class="zeile unter"><span>an</span><input type="email" value="${esc(e.mail)}" data-k="mail" class="mail-feld"></label>
        <div class="zeile unter"><span>Abrechnung als CSV anhängen</span>${schalter(e.bericht_csv, 'e-bool', 'data-k="bericht_csv"')}</div>
        <div class="zeile unter"><span class="leise">über den Dienst notify.baustelle_mail (z. B. Google Mail oder SMTP in HA eingerichtet)</span></div>` : ''}
        <button class="zeile" data-act="sheet" data-s="bericht"><span class="blau">Beispiel ansehen</span><span class="chev">›</span></button>
        <button class="zeile" data-act="toast" data-t="Bericht für die Vorwoche gesendet"><span class="blau">Jetzt senden</span></button>` : ''}</div>
      <div class="glas-panel liste"><div class="gruppe">Meldungen · Störungen</div>
        <div class="zeile"><span>Empfänger</span><span class="leise">${e.empfaenger}</span></div>
        <div class="zeile"><div><b>Knöpfe in der Nachricht</b><div class="leise">direkt aus der Nachricht reagieren, z. B. „bis morgen stumm“</div></div>${schalter(e.knoepfe, 'e-bool', 'data-k="knoepfe"')}</div>
        <button class="zeile" data-act="sheet" data-s="nachrichten"><span class="blau">Beispiele ansehen</span><span class="chev">›</span></button>
        <div class="zeile"><span>Stromausfall / offline</span>${schalter(e.m_offline, 'e-bool', 'data-k="m_offline"')}</div>
        <div class="zeile"><span>Pumpe Trockenlauf</span>${schalter(e.m_trocken, 'e-bool', 'data-k="m_trocken"')}</div>
        <div class="zeile"><span>Pumpe Dauerlauf über ${e.dauer_min} min</span>${schalter(e.m_dauer, 'e-bool', 'data-k="m_dauer"')}</div>
        <div class="zeile"><span>Pumpe schaltet oft (ab ${e.zyklen_h} je Stunde)</span>${schalter(e.m_zyklen, 'e-bool', 'data-k="m_zyklen"')}</div>
        <div class="zeile"><span>Heizkörper zieht keinen Strom</span>${schalter(e.m_leistung, 'e-bool', 'data-k="m_leistung"')}</div>
        <div class="zeile"><span>Frostgefahr trotz Frostschutz</span>${schalter(e.m_frost, 'e-bool', 'data-k="m_frost"')}</div>
        <div class="gruppe">Hinweise</div>
        <div class="zeile"><span>Zu kalt trotz Heizung (nach ${e.kalt_min} min)</span>${schalter(e.m_kalt, 'e-bool', 'data-k="m_kalt"')}</div>
        <div class="zeile"><span>Fühler meldet nichts / Batterie schwach</span>${schalter(e.m_fuehler, 'e-bool', 'data-k="m_fuehler"')}</div>
        <div class="zeile"><span>Keine Wettervorhersage</span>${schalter(e.m_wetter, 'e-bool', 'data-k="m_wetter"')}</div>
        <div class="zeile"><span>Handbetrieb länger als ${e.hand_h} h</span>${schalter(e.m_hand, 'e-bool', 'data-k="m_hand"')}</div>
        <div class="leise p-fuss">Störungen gehen als Nachricht aufs Handy, Hinweise nur ins Protokoll und in den Warnung-Chip.</div></div>`;
  }

  /* ---- Einblendungen von unten ---- */
  sheet() {
    const s = this.s.sheet, knopf = (t, act = 'zu', art = '') => `<button class="knopf ${art}" data-act="${act}">${t}</button>`;
    const griff = '<div class="griff"></div>';
    if (s.art === 'verbrauch') {
      return `${griff}${this.verbrauchInhalt(s, 'sheet', true)}
        ${knopf('Schließen')}`;
    }
    if (s.art === 'wetter') {
      const a = s.wa || 'std', e = this.d.e;
      const folge = (t, mm) => [t < e.frueh_temp ? '<span class="w-folge blau">Frühstart</span>' : '', mm >= e.tr_mm ? '<span class="w-folge amber">Kleidung trocknen</span>' : '',
        t > e.grenze ? '<span class="w-folge">über Heizgrenze</span>' : ''].join('');
      let inhalt;
      if (a === 'std') {
        const std = [['17', 'rainy', 3.8, .8, 70], ['18', 'rainy', 3.1, .4, 55], ['19', 'cloudy', 2.4, 0, 20], ['20', 'cloudy', 1.9, 0, 10], ['21', 'fog', 1.2, 0, 5], ['22', 'clear-night', .6, 0, 0]];
        inhalt = `<div class="w-std">${std.map(([h, w, t, r, p]) => `<div><span class="leise">${h}:00</span>${wetterIcon(w, 36)}<b>${de(t, 0)}°</b>
          <span class="w-regen">${r ? de(r) + ' mm' : '–'}</span><span class="leise">${p} %</span></div>`).join('')}</div>`;
      } else if (a === 'tag') {
        const teile = ['Morgen', 'Mittag', 'Nachmittag', 'Nacht'];
        const tage = [['Heute', [['rainy', 2.1, 2.4], ['pouring', 4.8, 2.9], ['rainy', 4.2, .7], ['fog', 1.0, 0]], 2],
          ['Morgen', [['fog', -1.2, 0], ['partlycloudy', 5.4, 0], ['sunny', 7.1, 0], ['clear-night', 0.4, 0]], 0]];
        inhalt = tage.map(([name, abschnitte, vorbei]) => `<div class="w-tag"><div class="w-tag-n">${name}</div><div class="w-teile">${abschnitte.map(([w, t, r], k) =>
          `<div class="${k < vorbei ? 'vorbei' : ''}"><span class="leise">${teile[k]}</span>${wetterIcon(w, 34)}<b>${de(t, 0)}°</b><span class="w-regen">${r ? de(r) + ' mm' : '–'}</span></div>`).join('')}</div></div>`).join('');
      } else {
        const tage = [['Mi', '30.09.', 'fog', 7.1, -1.2, 0, 10], ['Do', '01.10.', 'partlycloudy', 9.4, 1.8, 0, 15], ['Fr', '02.10.', 'rainy', 8.2, 4.1, 5.5, 80]];
        inhalt = `<div class="w-3">${tage.map(([t, d, w, hi, lo, mm, p]) => `<div class="w-3z">
          <div class="w-3t"><b>${t}</b><span class="leise">${d}</span></div>${wetterIcon(w, 40)}
          <div class="w-3w"><b>${de(hi, 0)}°</b><span class="leise">${de(lo, 0)}°</span></div>
          <div class="w-3r"><span class="w-regen">${mm ? de(mm) + ' mm' : '–'}</span><span class="leise">${p} %</span></div>
          <div class="w-3f">${folge(lo, mm)}</div></div>`).join('')}</div>`;
      }
      return `${griff}<h3>Wetter · Dobl</h3><div class="w-jetzt">${wetterIcon('rainy', 72)}<div><b>4,2 °C</b><div class="leise">Regen · 6 mm seit gestern · gefühlt 1 °C</div></div></div>
        <div class="seg">${[['std', 'Stündlich'], ['tag', 'Tagesverlauf'], ['3', '3 Tage']].map(([k, t]) => `<button data-act="wa" data-v="${k}" class="${a === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="w-inhalt">${inhalt}</div>
        <div class="leise">Für die Heizung: Kleidung trocknen morgen früh aktiv (Regen über ${de(e.tr_mm)} mm), Kälte-Frühstart morgen 15 min früher (−1 °C).</div>${knopf('Schließen')}`;
    }
    if (s.art === 'warnungen') {
      const W = this.d.warnungen, karte = w => `<div class="wk ${w.stufe} ${w.stumm ? 'stumm' : ''}"><div class="wk-kopf"><b>${esc(this.bName(w.b))}</b><span class="leise">${w.seit}</span></div>
        <div class="wk-titel">${esc(w.titel)}</div><div class="leise">${esc(w.hilfe)}</div>
        <div class="wk-knoepfe">${w.b ? `<button class="chip glas-panel" data-act="w-hin" data-id="${w.b}">Zum Container ›</button>` : ''}
          <button class="chip glas-panel" data-act="w-stumm" data-id="${w.id}">${w.stumm ? '🔔 wieder melden' : '🔕 bis morgen stumm'}</button></div></div>`;
      const gruppe = (titel, liste) => liste.length ? `<div class="gruppe-t">${titel} · ${liste.length}</div>${liste.map(karte).join('')}` : '';
      const offen = W.filter(w => !w.stumm);
      return `${griff}<div class="block-kopf"><h3>Warnungen</h3><span class="leise">${offen.length} offen</span></div>
        ${offen.length ? '' : '<div class="leer">Alles in Ordnung ✓</div>'}
        ${gruppe('Störungen', offen.filter(w => w.stufe === 'stoerung'))}${gruppe('Hinweise', offen.filter(w => w.stufe === 'hinweis'))}${gruppe('Stumm bis morgen', W.filter(w => w.stumm))}
        <button class="zeile" data-act="w-protokoll"><span class="blau">Alle Einträge im Protokoll</span><span class="chev">›</span></button>
        ${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'baustellen') return `${griff}<h3>Baustelle wählen</h3>${this.d.baustellen.map((b, i) => `<button class="zeile" data-act="zu"><span>${esc(b.name)}</span><span class="badge ${b.aktiv ? 'gruen' : ''}">${b.aktiv ? 'aktiv' : 'abgeschlossen'}</span></button>`).join('')}
      <button class="zeile" data-act="sheet" data-s="baustelle-neu"><span class="blau">+ Neue Baustelle</span></button>`;
    if (s.art === 'heizplan') {
      const az = this.azJetzt;
      return `${griff}<div class="block-kopf"><h3>Heizplan · diese Woche</h3><span class="leise">${esc(az.name)} · seit ${datum(az.ab)}</span></div>
        ${this.s.auto ? '' : '<div class="warn-k"><b>Automatik ist aus</b><div class="leise">Der Plan wird gerade nicht ausgeführt.</div></div>'}
        ${this.heizplanInhalt()}
        ${knopf('Arbeitszeit ändern', 'az-heizung', 'amber')}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'az') {
      const a = this.d.arbeitszeiten[s.i], geplant = a.ab > HEUTE, aktuell = a === this.azJetzt;
      return `${griff}<div class="block-kopf"><h3>${esc(a.name)}</h3><span class="badge ${aktuell ? 'gruen' : geplant ? 'blau-b' : ''}">${aktuell ? 'gilt jetzt' : geplant ? 'geplant' : 'früher'}</span></div>
        <div class="leise">gilt ab ${datum(a.ab)}</div>
        ${TAGE.map(t => `<div class="zeile"><b class="tag-n">${t}</b><span>${a.tage[t] ? a.tage[t].join('–') : '<span class="leise">frei</span>'}</span></div>`).join('')}
        ${knopf('Als Vorlage für eine neue', 'az-vorlage', 'amber')}${geplant ? knopf('Löschen', 'az-weg', 'rot') : ''}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'firma') {
      const f = s.form, neu = !f.id, eigen = !neu && this.firma(f.id).eigen;
      // wählbar: Container ohne fremde Firma, dazu die, die schon dieser Firma gehören
      const frei = this.d.bereiche.filter(b => (b.firma || 'eigen') === 'eigen' || (!neu && b.firma === f.id));
      return `${griff}<h3>${neu ? 'Neue Firma' : 'Firma'}</h3>
        <label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Trockenbau Maier" data-fn ${eigen ? 'disabled' : ''}></label>
        ${eigen ? `<div class="gruppe-t">Container der eigenen Firma</div>
          ${this.d.bereiche.filter(b => (b.firma || 'eigen') === 'eigen').map(b => `<div class="zeile"><span>${esc(b.name)}</span></div>`).join('')}
          <div class="leise">Hierher gehören alle Container, die keiner anderen Firma zugeordnet sind.</div>`
        : `<div class="gruppe-t">Container zuordnen</div>
          ${frei.length ? frei.map(b => `<div class="zeile"><span>${esc(b.name)}</span>${schalter(f.container.includes(b.id), 'firma-c', `data-id="${b.id}"`)}</div>`).join('')
            : '<div class="leise">Alle Container sind schon anderen Firmen zugeordnet.</div>'}
          ${f.neu.map((c, i) => `<div class="zeile fc-neu"><input value="${esc(c.name)}" placeholder="Name des Containers" data-fnc="${i}">
            <div class="seg klein">${['Container', 'Schacht'].map(a => `<button data-act="fc-art" data-i="${i}" data-v="${a}" class="${c.art === a ? 'on' : ''}">${a}</button>`).join('')}</div>
            <button class="x" data-act="fc-weg" data-i="${i}" title="nicht anlegen">✕</button></div>`).join('')}
          <button class="zeile" data-act="fc-neu"><span class="blau">+ Neuer Container für diese Firma</span></button>
          <div class="leise">Nur Container ohne andere Firma sind wählbar. Nimmst du einen weg, gehört er wieder der eigenen Firma. Frühere Werte bleiben bei der bisherigen Firma.</div>`}
        ${eigen ? knopf('Schließen', 'zu', 'leise-k') : knopf('Speichern', 'firma-speichern', 'amber') + (neu ? '' : knopf('Firma löschen', 'firma-weg', 'rot')) + knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'strom') {
      const L = this.last(), e = this.d.e, ph = L.phasen.length > 1;
      const zustand = x => x.b.offline ? ['offline', 'rot-t'] : x.b.z === 'pause' ? ['pausiert – Tür offen', 'lila'] : x.g.warte ? [`wartet – dran in ${x.g.warte} min`, 'blau'] : x.g.an ? ['heizt', 'amber-t'] : ['aus', 'leise'];
      return `${griff}<div class="block-kopf"><h3>Stromverteilung</h3><span class="leise">${L.laufen} von ${L.hk.length} Heizkörpern an · höchstens ${e.max_gleich}</span></div>
        <div class="strom-leg"><span><i class="s-heiz"></i>Heizung ${de(L.heiz)} kW</span><span><i class="s-pumpe"></i>Pumpen ${de(L.pumpe)} kW</span><span><i class="s-sonst"></i>Sonstiges ${de(L.sonst)} kW</span><span><i class="s-res"></i>Reserve ${de(e.reserve)} kW</span></div>
        ${this.stromBalken(L)}
        <div class="leise">${de(L.gesamt)} von ${de(L.grenze)} kW (${e.phasen} × ${e.absicherung} A) · frei für Heizungen ${de(L.frei)} kW${e.zaehler === 'keiner' ? ' · ohne Gesamtzähler: Ungemessenes steckt in der Reserve' : ''}</div>
        ${ph ? `<div class="gruppe-t">Je Phase · ${de(L.phasen[0].max)} kW</div>${L.phasen.map(p => `<div class="ph-zeile"><b>${p.ph}</b><div class="strom-spur ph"><i class="s-heiz" style="width:${p.heiz / p.max * 100}%"></i><i class="s-pumpe" style="width:${p.pumpe / p.max * 100}%"></i><i class="s-sonst" style="width:${p.sonst / p.max * 100}%"></i></div><span class="leise">${de(p.heiz + p.pumpe + p.sonst)} kW</span></div>`).join('')}` : ''}
        <div class="gruppe-t">Heizkörper</div>
        ${L.hk.map(x => { const [t, k] = zustand(x); return `<div class="zeile"><span>${esc(x.b.name)} · ${esc(x.g.n)}${ph ? ` <span class="leise">${x.g.phase}</span>` : ''}</span><span class="${k}">${t}</span></div>`; }).join('')}
        <div class="hinweis-k">Neue Heizkörper kommen erst dazu, wenn eine Minute lang genug Strom frei ist. Jeder läuft mindestens ${e.min_lauf} min und pausiert mindestens ${e.min_pause} min. Dürfen nicht alle gleichzeitig, wechseln sie alle ${e.takt} min – wer am weitesten unter dem Soll ist, kommt zuerst.</div>
        ${knopf('Einstellungen', 'tab-einst', 'leise-k')}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'nachrichten') {
      const n = (ic, titel, text, knoepfe, b) => `<div class="noti"><div class="noti-kopf"><span class="noti-app">🏗 Home Assistant · jetzt</span></div><b>${ic} ${titel}</b><div>${text}</div>
        ${this.d.e.knoepfe ? `<div class="noti-knoepfe">${knoepfe.map(k => `<button data-act="n-knopf" data-t="${k}" data-b="${b || ''}">${k}</button>`).join('')}</div>` : ''}</div>`;
      return `${griff}<h3>Nachrichten aufs Handy</h3><div class="leise">So kommen sie in der Home-Assistant-App an. ${this.d.e.knoepfe ? 'Tippe einen Knopf zum Ausprobieren.' : 'Knöpfe sind ausgeschaltet.'}</div>
        ${n('⚠', 'Lager Süd nicht erreichbar', 'Seit 10:42 keine Antwort – Stromausfall oder Stecker gezogen?', ['Zum Container', 'Bis morgen stumm'], 'lager')}
        ${n('🚪', 'Magazin: Tür seit 10 min offen', 'Die Heizung ist pausiert und heizt wieder, sobald die Tür zu ist.', ['Trotzdem heizen', '1 h stumm'], 'magazin')}
        ${n('❄', 'Morgen −4 °C', 'Vorheizen startet schon um 05:30. Arbeitsbeginn 07:00.', ['Morgen nicht heizen', 'Noch früher (05:00)'])}
        ${n('✋', 'Steckdose Magazin seit 8 h auf Hand', 'Von Hand eingeschaltet und nicht zurückgestellt.', ['Automatik übernehmen', 'So lassen'], 'magazin')}
        <div class="leise">Die Knöpfe sind Aktionen der HA-App (mobile_app). Ein Tipp löst die Aktion aus und landet im Protokoll.</div>${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'bericht') {
      const e = this.d.e, mon = e.bericht === 'monat', z = mon ? 'Monat' : 'Woche', L = this.laufende()[0], p = e.preis;
      const je = L.bereiche.map(b => [b, verbrauch(L.bereiche, b.id, z).reduce((a, v) => a + v, 0)]), ges = je.reduce((a, x) => a + x[1], 0);
      const fi = this.d.firmen.map(f => [f, je.filter(([b]) => (b.firma || 'eigen') === f.id).reduce((a, x) => a + x[1], 0)]).filter(x => x[1] > 0);
      return `${griff}<h3>Bericht · Beispiel</h3>
        <div class="mail"><div class="mail-kopf"><div><span class="leise">An</span> ${e.bericht_mail ? esc(e.mail) : '—'}</div><div><span class="leise">Betreff</span> Baustelle ÖWG Dobl Zwaring – ${mon ? 'September 2026' : 'Woche 21.–27.09.2026'}</div>
          ${e.bericht_mail && e.bericht_csv ? `<div class="mail-anhang">📎 abrechnung-${mon ? '2026-09' : 'kw39'}.csv</div>` : ''}</div>
          <div class="mail-inhalt"><b>${mon ? 'September' : 'Vorwoche'}: ${de(ges, 0)} kWh · ${de(ges * p, 2)} €</b> <span class="leise">(${mon ? '+31 % zum August' : '−4 % zur Woche davor'})</span>
            <div class="mail-t">Je Firma</div>${fi.map(([f, k]) => `<div class="mail-z"><span>${esc(f.name)}</span><span>${de(k, 0)} kWh · ${de(k * p, 2)} €</span></div>`).join('')}
            <div class="mail-t">Je Container</div>${je.map(([b, k]) => `<div class="mail-z"><span>${esc(b.name)}</span><span>${de(k, 0)} kWh</span></div>`).join('')}
            <div class="mail-t">Heizung</div><div class="mail-z"><span>Heiztage</span><span>${mon ? 16 : 5}</span></div><div class="mail-z"><span>gespart durch Automatik</span><span>${de(ges * 3.6 * p, 0)} €</span></div>
            <div class="mail-t">Offene Warnungen</div>${this.d.warnungen.filter(w => !w.stumm).map(w => `<div class="mail-z"><span>${esc(this.bName(w.b))}: ${esc(w.titel)}</span></div>`).join('')}</div></div>
        <div class="leise">${e.bericht_handy ? 'Aufs Handy kommt eine Kurzfassung (Summe, Kosten, Warnungen) mit Knopf „Bericht öffnen“. ' : ''}Die E-Mail geht über einen Mail-Dienst in HA (Google Mail oder SMTP); die Zugangsdaten stehen in secrets.yaml.</div>
        ${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'az-neu') {
      const f = s.form;
      return `${griff}<h3>Neue Arbeitszeit</h3>
        <div class="raster-2"><label class="feld">Gilt ab<input type="date" value="${f.ab}" data-azn="ab"></label><label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Winter" data-azn="name"></label></div>
        ${TAGE.map(t => { const z = f.tage[t]; return `<div class="zeile azn"><b class="tag-n">${t}</b>${schalter(!!z, 'azn-tag', `data-t="${t}"`)}
          ${z ? `<input type="time" value="${z[0]}" data-azt="${t}" data-p="0"><span class="leise">bis</span><input type="time" value="${z[1]}" data-azt="${t}" data-p="1">` : '<span class="leise frei">frei</span>'}</div>`; }).join('')}
        <button class="zeile" data-act="azn-wie-mo"><span class="blau">Di–Do wie Montag</span></button>
        <div class="leise">Die bisherige Arbeitszeit bleibt gespeichert. Liegt das Datum in der Zukunft, gilt die neue automatisch ab diesem Tag.</div>
        ${knopf('Speichern', 'azn-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'container-neu') return `${griff}<h3>Neuer Container</h3>
      <label class="feld">Name<input value="" placeholder="z. B. Lager Nord" data-neu="name"></label>
      <div class="feld">Art<div class="seg klein">${['Container', 'Pumpenschacht'].map(v => `<button data-act="neu-art" data-v="${v}" class="${(s.neuArt || 'Container') === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <label class="feld">Temperaturfühler<select><option>– keiner –</option><option>Poliercontainer Temperatur</option></select></label>
      <label class="feld">Shelly<select><option>Heizung 03 (Shelly Plug S)</option><option>Heizung 04 (Shelly Plug S)</option></select></label>
      <label class="feld">Heizkörper<select><option>Ölradiator</option><option>Konvektor</option></select></label>
      ${knopf('Anlegen', 'neu-anlegen', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    if (s.art === 'bereich') {
      const b = this.b, e = s.edit ||= { name: b.name, tuer: b.tuer?.sensor || '', firma: b.firma || 'eigen', geraete: b.geraete.map(g => ({ ...g })) };
      const typen = b.pumpe ? ['Pumpe'] : ['Ölradiator', 'Konvektor', 'Steckdose'];
      const wahl = (i, g) => `<select data-ge="typ" data-i="${i}">${typen.map(t => `<option ${g.typ === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      return `${griff}<div class="block-kopf"><h3>Bearbeiten</h3><span class="leise">${b.pumpe ? 'Pumpenschacht' : 'Container'}</span></div>
        <label class="feld">Name<input value="${esc(e.name)}" data-b="name"></label>
        ${b.pumpe ? '' : `<label class="feld">Türkontakt<select data-btuer>${['', 'Tür Polier', 'Tür Magazin', 'Tür Mannschaft (neu)'].map(t => `<option value="${t}" ${(e.tuer || '') === t ? 'selected' : ''}>${t ? `${t} · Shelly Door/Window` : 'keiner'}</option>`).join('')}</select></label>`}
        <label class="feld">Firma · für die Abrechnung<select data-bf="firma">${this.d.firmen.map(f => `<option value="${f.id}" ${e.firma === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
        <div class="gruppe-t">${b.pumpe ? 'Pumpen' : 'Geräte'} · ${e.geraete.filter(g => !g.weg).length}</div>
        ${e.geraete.map((g, i) => g.weg ? `<div class="ge-zeile weg"><span>${esc(g.n)} wird entfernt</span><button class="chip glas-panel" data-act="ge-zurueck" data-i="${i}">rückgängig</button></div>`
          : `<div class="ge-zeile"><div class="ge-felder">
            ${g.neu ? `<select data-ge="shelly" data-i="${i}">${['Heizung 03 · Shelly Plug S', 'Heizung 04 · Shelly Plug S', 'Pumpe 3 · Shelly Plus 1PM'].map(x => `<option ${g.shelly === x ? 'selected' : ''}>${x}</option>`).join('')}</select>` : `<span class="leise ge-shelly">${esc(g.shelly || g.n.toLowerCase().replace(/[^a-z0-9]+/g, '_'))} · Shelly Plug S</span>`}
            <div class="ge-zwei"><input value="${esc(g.n)}" data-ge="n" data-i="${i}" placeholder="Name">${wahl(i, g)}</div>
            ${this.d.e.phasen === 3 ? `<div class="ge-phase"><span class="leise">Phase</span><div class="seg klein">${['L1', 'L2', 'L3'].map(ph => `<button data-act="ge-phase" data-i="${i}" data-v="${ph}" class="${(g.phase || 'L1') === ph ? 'on' : ''}">${ph}</button>`).join('')}</div></div>` : ''}</div>
            <button class="x" data-act="ge-weg" data-i="${i}" title="Gerät entfernen">✕</button></div>`).join('')}
        <button class="zeile" data-act="ge-neu"><span class="blau">+ Gerät hinzufügen</span></button>
        <div class="leise">Der Heizkörpertyp gilt nur für den Vergleich Ölradiator/Konvektor. Entfernte Geräte behalten ihre Werte im Verlauf.</div>
        ${knopf('Speichern', 'b-speichern', 'amber')}${knopf('Container entfernen', 'b-weg', 'rot')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'baustelle') { const b = this.d.baustellen[s.i], r = zufall(s.i + 3), m = ['Sep', 'Okt', 'Nov', 'Dez', 'Jän', 'Feb', 'Mär', 'Apr'].slice(0, b.aktiv ? 2 : 6);
      return `${griff}<h3>${esc(b.name)}</h3><div class="leise">${b.zeit}</div>
        <div class="kennz"><div><b>${de(b.kwh, 0)}</b><span>kWh</span></div><div><b>${de(b.eur, 2)} €</b><span>Kosten</span></div><div><b>${b.container}</b><span>Container</span></div></div>
        <div class="chart-wrap">${balken('bs-' + s.i, m.map(() => b.kwh / m.length * (.5 + r())), m, 'kWh', 0)}</div>
        ${b.aktiv ? knopf('Öffnen', 'zu', 'amber') : knopf('Wieder aktiv setzen', 'toast-zu', 'leise-k')}`; }
    if (s.art === 'abschliessen') return `${griff}<h3>Baustelle abschließen?</h3><div class="leise">Die Heizung wird abgeschaltet. Werte und Diagramme bleiben im Verlauf, gelöscht wird nichts.</div>${knopf('Abschließen', 'toast-zu', 'rot')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    if (s.art === 'urlaub') return `${griff}<h3>Urlaub eintragen</h3><label class="feld">Name<input value="${esc(s.form.name)}" placeholder="z. B. Semesterferien" data-ur="name"></label>
      <div class="raster-2"><label class="feld">Von<input type="date" value="${s.form.von}" data-ur="von"></label><label class="feld">Bis<input type="date" value="${s.form.bis}" data-ur="bis"></label></div>
      <div class="leise">Wird in den Kalender „Baustelle Urlaub“ eingetragen; in der Zeit läuft nur der Frostschutz.</div>${knopf('Eintragen', 'urlaub-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    return `${griff}<h3>${{ name: 'Name', 'baustelle-neu': 'Neue Baustelle', wetterquelle: 'Wetter' }[s.art] || ''}</h3>
      ${s.art === 'wetterquelle' ? `<label class="feld">Wetter<select><option>Open-Meteo · Zone Baustelle Dobl Zwaring</option></select></label><label class="feld">Außentemperatur<select><option>aus der Vorhersage</option></select></label><label class="feld">Regenmenge<select><option>aus der Vorhersage</option></select></label>`
        : `<label class="feld">Name<input value="${s.art === 'name' ? 'ÖWG Dobl Zwaring' : ''}" placeholder="z. B. Wohnbau Kalsdorf"></label>`}
      ${knopf('Speichern', 'toast-zu', 'amber')}`;
  }

  /* ---- Aktionen ---- */
  klick(ev) {
    const el = ev.target.closest('[data-act]'); if (!el || !this.root.contains(el)) return;
    const a = el.dataset.act, d = this.d, b = this.b;
    const neu = () => this.render();
    switch (a) {
      case 'tab': return this.gehe(el.dataset.v);
      case 'container': this.s.chart = 'temp'; return this.gehe('container', el.dataset.id);
      case 'container-lager': return this.gehe('container', 'lager');
      case 'w-hin': return this.gehe('container', el.dataset.id);
      case 'w-stumm': { const w = d.warnungen.find(x => x.id === el.dataset.id); w.stumm = !w.stumm; neu(); return this.toast(w.stumm ? 'Stumm bis morgen – bleibt im Protokoll' : 'Wird wieder gemeldet'); }
      case 'w-protokoll': this.s.verlauf = 'aktiv'; this.s.pfilter = 'warnung'; return this.gehe('verlauf');
      case 'pfilter': this.s.pfilter = el.dataset.v; this.s.pmehr = false; return neu();
      case 'pmehr': this.s.pmehr = true; return neu();
      case 'sheet': if (el.dataset.s === 'urlaub') { this.s.sheet = { art: 'urlaub', form: { name: '', von: '2027-02-15', bis: '2027-02-19' } }; return neu(); }
      this.s.sheet = { art: el.dataset.s, t: el.dataset.t, i: +el.dataset.i, auswahl: el.dataset.id ? [el.dataset.id] : [], zeitraum: 'Tag' }; return neu();
      case 'wa': this.s.sheet.wa = el.dataset.v; return neu();
      case 'vb-gruppe': { const st = el.dataset.ziel === 'aw' ? this.s.aw : this.s.sheet; st.gruppe = el.dataset.v; st.auswahl = this.quellen(st, el.dataset.ziel).map(q => q.id); return neu(); }
      case 'aw-scope': this.s.awScope = el.dataset.v; this.s.aw.auswahl = this.quellen(this.s.aw, 'aw').map(q => q.id); return neu();
      case 'vb-zeitraum': (el.dataset.ziel === 'aw' ? this.s.aw : this.s.sheet).zeitraum = el.dataset.v; return neu();
      case 'vb-wer': { const sh = el.dataset.ziel === 'aw' ? this.s.aw : this.s.sheet, id = el.dataset.id;
        if (!id) sh.auswahl = []; else if (id === '*') sh.auswahl = this.quellen(sh, el.dataset.ziel || 'sheet').map(q => q.id);
        else sh.auswahl = sh.auswahl.includes(id) ? sh.auswahl.filter(x => x !== id) : [...sh.auswahl, id];
        return neu(); }
      case 'bereich-einst': this.s.cid = el.dataset.id; this.s.sheet = { art: 'bereich' }; return neu();
      case 'zu': this.s.sheet = null; return neu();
      case 'toast': return this.toast(el.dataset.t);
      case 'toast-zu': this.s.sheet = null; neu(); return this.toast('Gespeichert');
      case 'auto': this.s.auto = !this.s.auto; neu(); return this.toast(this.s.auto ? 'Automatik ein' : 'Automatik aus – Geräte bleiben, wie sie sind');
      case 'b-auto': b.auto = !b.auto; return neu();
      case 'b-trocknen': case 'tr-b': { const x = a === 'tr-b' ? d.bereiche.find(y => y.id === el.dataset.id) : b; x.trocknen = !x.trocknen; return neu(); }
      case 'geraet': { const g = b.geraete[+el.dataset.i]; g.an = g.an ? 0 : 1; g.hand = b.auto;
        const an = b.geraete.some(x => x.an); if (b.pumpe) b.z = b.geraete[0].an ? 'laeuft' : 'aus'; else b.z = an ? (b.z === 'aus' ? 'heizt' : b.z) : 'aus';
        neu(); return b.auto && this.toast('Handbetrieb bis zum nächsten Schaltpunkt'); }
      case 'chart': this.s.chart = el.dataset.c; return neu();
      case 'zeitraum': this.s.zeitraum = el.dataset.v; return neu();
      case 'verlauf': this.s.verlauf = el.dataset.v; return neu();
      case 'basis': d.e.basis = el.dataset.v; return neu();
      case 'e-bool': d.e[el.dataset.k] = !d.e[el.dataset.k]; return neu();
      case 'st': { const k = el.dataset.k, min = { absicherung: 6, max_gleich: 1, min_lauf: 1, takt: 5, tuer_pause: 1, tuer_melden: 1 }[k] || 0; d.e[k] = Math.max(min, Math.round((d.e[k] + +el.dataset.d) * 10) / 10); return neu(); }
      case 'jc-auto': { const x = d.bereiche.find(y => y.id === el.dataset.id); x.auto = !x.auto; return neu(); }
      case 'jc-soll': { const x = d.bereiche.find(y => y.id === el.dataset.id); x.soll = Math.round(((x.soll ?? d.e.soll) + +el.dataset.d) * 2) / 2; return neu(); }
      case 'urlaub-weg': { const u = d.urlaube.splice(+el.dataset.i, 1)[0]; neu(); return this.toast(`${u.name} gelöscht`); }
      case 'urlaub-speichern': { const f = this.s.sheet.form; if (!f.von || !f.bis || f.bis < f.von) return this.toast('Bitte Von und Bis prüfen');
        d.urlaube.push({ name: f.name.trim() || 'Urlaub', von: f.von, bis: f.bis }); d.urlaube.sort((a, b) => a.von.localeCompare(b.von)); this.s.sheet = null; neu(); return this.toast('Eingetragen – in der Zeit nur Frostschutz'); }
      case 'vgl': this.s.vglArt = el.dataset.v; return neu();
      case 'bs-oeffnen': { const i = +el.dataset.i; if (d.baustellen[i].aktiv) return this.gehe('uebersicht'); this.s.bs = i; return this.gehe('bsdetail'); }
      case 'csv': return this.csv(el.dataset.art);
      case 'firma-auf': { const f = el.dataset.id ? this.firma(el.dataset.id) : null;
        this.s.sheet = { art: 'firma', form: { id: f?.id, name: f?.name || '', neu: [], container: f ? d.bereiche.filter(b => (b.firma || 'eigen') === f.id).map(b => b.id) : [] } }; return neu(); }
      case 'firma-c': { const c = this.s.sheet.form.container, id = el.dataset.id; this.s.sheet.form.container = c.includes(id) ? c.filter(x => x !== id) : [...c, id]; return neu(); }
      case 'firma-speichern': { const f = this.s.sheet.form; if (!f.name.trim()) return this.toast('Bitte einen Namen eingeben');
        let id = f.id; if (!id) { id = 'f' + Date.now().toString(36); d.firmen.push({ id, name: f.name.trim() }); } else this.firma(id).name = f.name.trim();
        for (const b of d.bereiche) { if (f.container.includes(b.id)) b.firma = id; else if ((b.firma || 'eigen') === id && id !== 'eigen') b.firma = 'eigen'; }
        const neue = f.neu.filter(c => c.name.trim()); for (const c of neue) this.neuerContainer(c.name.trim(), c.art === 'Schacht', id);
        this.s.sheet = null; neu(); return this.toast(`${f.name.trim()} gespeichert${neue.length ? ` · ${neue.length} Container angelegt` : ''}`); }
      case 'fc-neu': this.s.sheet.form.neu.push({ name: '', art: 'Container' }); return neu();
      case 'fc-weg': this.s.sheet.form.neu.splice(+el.dataset.i, 1); return neu();
      case 'fc-art': this.s.sheet.form.neu[+el.dataset.i].art = el.dataset.v; return neu();
      case 'firma-weg': { const id = this.s.sheet.form.id; for (const b of d.bereiche) if (b.firma === id) b.firma = 'eigen'; d.firmen = d.firmen.filter(f => f.id !== id); this.s.sheet = null; neu(); return this.toast('Firma gelöscht – Container gehören wieder der eigenen Firma'); }
      case 'e-wert': { const v = el.dataset.v; d.e[el.dataset.k] = isNaN(+v) ? v : +v; return neu(); }
      case 'prio': d.bereiche.find(x => x.id === el.dataset.id).prio = el.dataset.v; return neu();
      case 'ge-phase': this.s.sheet.edit.geraete[+el.dataset.i].phase = el.dataset.v; return neu();
      case 'n-knopf': d.protokoll.unshift(['Heute', JETZT, 'nachricht', el.dataset.b || null, `Knopf „${el.dataset.t}“ in der Nachricht gedrückt`]); return this.toast(`„${el.dataset.t}“ ausgeführt – steht im Protokoll`);
      case 'tab-einst': return this.gehe('einst');
      case 'az-alt': this.s.azAlt = !this.s.azAlt; return neu();
      case 'az-heizung': return this.gehe('heizung');
      case 'az-neu': case 'az-vorlage': { const v = a === 'az-vorlage' ? d.arbeitszeiten[this.s.sheet.i] : this.azJetzt;
        this.s.sheet = { art: 'az-neu', form: { ab: '2026-10-05', name: '', tage: JSON.parse(JSON.stringify(v.tage)) } }; return neu(); }
      case 'az-weg': { const x = d.arbeitszeiten[this.s.sheet.i]; d.arbeitszeiten.splice(this.s.sheet.i, 1); this.s.sheet = null; neu(); return this.toast(`${x.name} gelöscht`); }
      case 'azn-tag': { const t = el.dataset.t, f = this.s.sheet.form; f.tage[t] = f.tage[t] ? null : [...(f.tage.Mo || ['07:00', '16:30'])]; return neu(); }
      case 'azn-wie-mo': { const f = this.s.sheet.form; for (const t of ['Di', 'Mi', 'Do']) f.tage[t] = f.tage.Mo ? [...f.tage.Mo] : null; return neu(); }
      case 'azn-speichern': { const f = this.s.sheet.form;
        if (!f.ab) return this.toast('Bitte ein Startdatum wählen');
        if (d.arbeitszeiten.some(x => x.ab === f.ab)) return this.toast(`Ab ${datum(f.ab)} gibt es schon eine Arbeitszeit`);
        d.arbeitszeiten.push({ ab: f.ab, name: f.name.trim() || `ab ${datum(f.ab)}`, tage: f.tage }); this.s.sheet = null; neu();
        return this.toast(f.ab > HEUTE ? `Geplant – gilt ab ${datum(f.ab)}` : `Gilt jetzt – die bisherige bleibt gespeichert`); }
      case 'neu-art': this.s.sheet.neuArt = el.dataset.v; return neu();
      case 'neu-anlegen': { const name = this.root.querySelector('[data-neu="name"]').value.trim() || 'Neuer Container';
        this.neuerContainer(name, this.s.sheet.neuArt === 'Pumpenschacht', 'eigen'); this.s.sheet = null; neu(); return this.toast(`${name} angelegt`); }
      case 'b-speichern': { const e = this.s.sheet.edit, kw = { Ölradiator: 2, Konvektor: 2, Steckdose: .5, Pumpe: .76 };
        if (e.name.trim()) b.name = e.name.trim();
        b.firma = e.firma; b.tuer = e.tuer ? { sensor: e.tuer, offen: b.tuer?.sensor === e.tuer ? b.tuer.offen : 0 } : undefined;
        const weg = e.geraete.filter(g => g.weg).length;
        b.geraete = e.geraete.filter(g => !g.weg).map(g => g.neu ? { n: g.n || g.shelly.split(' · ')[0], typ: g.typ, kw: kw[g.typ], an: 0, hand: false } : { ...g });
        this.s.sheet = null; neu(); return this.toast(weg ? `Gespeichert · ${weg} entfernt – Werte bleiben im Verlauf` : 'Gespeichert'); }
      case 'ge-weg': { const g = this.s.sheet.edit.geraete[+el.dataset.i]; if (g.neu) this.s.sheet.edit.geraete.splice(+el.dataset.i, 1); else g.weg = true; return neu(); }
      case 'ge-zurueck': this.s.sheet.edit.geraete[+el.dataset.i].weg = false; return neu();
      case 'ge-neu': this.s.sheet.edit.geraete.push({ neu: true, shelly: 'Heizung 03 · Shelly Plug S', n: '', typ: b.pumpe ? 'Pumpe' : 'Ölradiator' }); return neu();
      case 'temp-vb': this.s.tempVb = this.s.tempVb === false; return neu();
      case 'b-weg': d.bereiche = d.bereiche.filter(x => x !== b); this.toast(`${b.name} entfernt – Werte bleiben im Verlauf`); return this.gehe('uebersicht');
    }
  }
  eingabe(ev) {
    const el = ev.target;
    if (el.dataset.k === 'preis') this.d.e.preis = +el.value || 0;
    if (el.dataset.azn) this.s.sheet.form[el.dataset.azn] = el.value;
    if (el.dataset.ur) this.s.sheet.form[el.dataset.ur] = el.value;
    if (el.dataset.ge) this.s.sheet.edit.geraete[+el.dataset.i][el.dataset.ge] = el.value;
    if (el.dataset.bf) this.s.sheet.edit.firma = el.value;
    if (el.dataset.btuer !== undefined) this.s.sheet.edit.tuer = el.value;
    if (el.dataset.k === 'zaehler' || el.dataset.k === 'mail') { this.d.e[el.dataset.k] = el.value; if (el.dataset.k === 'zaehler') this.render(); }
    if (el.dataset.fn !== undefined) this.s.sheet.form.name = el.value;
    if (el.dataset.fnc !== undefined) this.s.sheet.form.neu[+el.dataset.fnc].name = el.value;
    if (el.dataset.b === 'name' && this.s.sheet?.edit) this.s.sheet.edit.name = el.value;
    if (el.dataset.azt) this.s.sheet.form.tage[el.dataset.azt][+el.dataset.p] = el.value;
  }
  hover(ev) {
    const svg = ev.target.closest('svg.chart'); if (!svg) return this.tip(null);
    const c = CHARTS[svg.dataset.chart], r = svg.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width;
    if (c.art === 'streu') {
      const r = svg.getBoundingClientRect(), vx = (ev.clientX - r.left) / r.width * 320, vy = ((ev.clientY ?? 0) - (r.top ?? 0)) / r.width * 320;
      let best = 0, bd = 1e9; c.pkt.forEach((q, i) => { const dd = (c.x(q[0]) - vx) ** 2 + (c.y(q[1]) - vy) ** 2; if (dd < bd) { bd = dd; best = i; } });
      if (bd > 900) { svg.querySelector('.hover').innerHTML = ''; return this.tip(null); }
      const q = c.pkt[best];
      svg.querySelector('.hover').innerHTML = `<circle cx="${c.x(q[0])}" cy="${c.y(q[1])}" r="7" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`;
      return this.tip(ev, `<b>${de(q[0], 1)} °C außen</b><div>${de(q[1], 0)} kWh · ${de(q[1] * this.d.e.preis, 2)} €</div>`);
    }
    if (c.art === 'flaeche') {
      const vx = fx * c.W, i = Math.max(0, Math.min(c.n - 1, Math.round((vx - c.x0) / (c.x1 - c.x0) * (c.n - 1)))), x = c.x0 + i / (c.n - 1) * (c.x1 - c.x0);
      const h = c.einheit === 'kWh/h', sum = c.reihen.reduce((a, r) => a + r.v[i], 0), p = this.d.e.preis;
      svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="138" class="kreuz"/>` + c.reihen.map(r => `<circle cx="${x}" cy="${c.y(r.o[i])}" r="3.5" fill="${r.farbe}" class="punkt"/>`).join('');
      return this.tip(ev, `<b>${c.labels[i]}${h ? ':00' : ''}</b>` + (c.reihen.length > 1
        ? [...c.reihen].reverse().map(r => `<div><i style="background:${r.farbe}"></i>${esc(r.name)} <b>${de(r.v[i], 2)} kWh</b></div>`).join('') + `<div class="tip-summe">zusammen <b>${de(sum, 2)} kWh</b> · ${de(sum * p, 2)} €</div>`
        : `<div>${de(sum, 2)} kWh</div><div class="leise">${de(sum * p, 2)} €</div>`));
    }
    if (c.art === 'linie') {
      const vx = fx * c.W, i = Math.max(0, Math.min(24, Math.round((vx - c.x0) / (c.x1 - c.x0) * 24))), x = c.x0 + i / 24 * (c.x1 - c.x0);
      const v = c.vb ? c.vb[Math.min(i, c.vb.length - 1)] : null, kv = c.reihen.length + 1;
      svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="${c.unten}" class="kreuz"/>` + c.reihen.map((s, k) => s.v[i] === null ? '' : `<circle cx="${x}" cy="${c.y(s.v[i])}" r="4" fill="var(--s${k + 1})" class="punkt"/>`).join('')
        + (c.vb ? `<circle cx="${x}" cy="${c.yv(v)}" r="3.5" fill="var(--s${kv})" class="punkt"/>` : '');
      this.tip(ev, `<b>${String(i).padStart(2, '0')}:00</b>${c.reihen.map((s, k) => s.v[i] === null ? '' : `<div><i style="background:var(--s${k + 1})"></i>${s.name} <b>${de(s.v[i])} ${c.einheit}</b></div>`).join('')}`
        + (c.vb ? `<div><i style="background:var(--s${kv})"></i>Verbrauch <b>${de(v, 2)} kWh</b></div>` : ''));
    } else {
      const bar = ev.target.closest('.bar'); svg.querySelectorAll('.bar').forEach(x => x.classList.toggle('matt', !!bar && x !== bar));
      if (!bar) return this.tip(null); const i = +bar.dataset.i;
      this.tip(ev, `<b>${c.labels[i]}</b><div>${de(c.werte[i], c.d)} ${c.einheit}</div>`);
    }
  }
  tip(ev, html) {
    const t = this.root.querySelector('.tip'); if (!t) return;
    if (!ev || !html) { t.classList.remove('an'); this.root.querySelectorAll('.chart .hover').forEach(h => h.innerHTML = ''); this.root.querySelectorAll('.bar.matt').forEach(x => x.classList.remove('matt')); return; }
    const r = this.root.getBoundingClientRect(); t.innerHTML = html; t.classList.add('an');
    const x = Math.min(ev.clientX - r.left + 12, r.width - t.offsetWidth - 8); t.style.left = x + 'px'; t.style.top = (ev.clientY - r.top - t.offsetHeight - 12) + 'px';
  }
}
document.querySelectorAll('.app').forEach(el => new App(el));
document.getElementById('modus').onclick = () => { document.body.classList.toggle('hell'); APPS.forEach(a => a.stimmung(false)); };
for (const [id, k] of [['phase', 'phase'], ['wetter', 'wetter']]) {
  const el = document.getElementById(id); if (el) el.onchange = () => { STIMMUNG[k] = el.value; APPS.forEach(a => a.stimmung()); };
}
