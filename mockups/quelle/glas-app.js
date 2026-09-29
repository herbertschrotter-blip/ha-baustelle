/* Klickbarer Prototyp der Baustellen-Seite im Glas-Stil (Beispieldaten, keine Verbindung zu HA). */
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const de = (x, d = 1) => Number(x).toLocaleString('de-AT', { minimumFractionDigits: d, maximumFractionDigits: d });
const FARBE = { heizt: '#ff9f0a', trocknen: '#ff9f0a', aus: '#8e8e93', frost: '#64d2ff', offline: '#ff453a', laeuft: '#0a84ff' };
const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const zufall = seed => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

const az = (ab, name, moDo, fr) => ({ ab, name, tage: { Mo: moDo, Di: moDo, Mi: moDo, Do: moDo, Fr: fr, Sa: null, So: null } });
const HEUTE = '2026-09-29', HEUTE_TAG = 'Di', JETZT = '16:20';
const WOCHE = [['Mo', '28.09.'], ['Di', '29.09.'], ['Mi', '30.09.'], ['Do', '01.10.'], ['Fr', '02.10.'], ['Sa', '03.10.'], ['So', '04.10.']];
const WETTER_WOCHE = { Di: { regen: 6 }, Mi: { kalt: -1.2, regenVortag: 6 }, Fr: { regen: 5.5 } };   // aus der Vorhersage
const minu = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const uhr = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const datum = iso => iso.split('-').reverse().join('.');
const dauer = (a, b) => { const m = minu(b) - minu(a); return `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`; };
function daten() {
  const r = zufall(7);
  const aussen = [...Array(25)].map((_, h) => 4.2 + 3.2 * Math.sin((h - 9) / 24 * 2 * Math.PI) + (r() - .5) * .6);
  const reihe = (n, a, b) => [...Array(n)].map(() => a + r() * (b - a));
  const bereich = (id, name, f, z, t, geraete, extra = {}) => ({ id, name, f, z, t, geraete, auto: true, trocknen: false,
    innen: aussen.map((a, h) => t === null ? null : Math.max(a + 2, (h >= 7 && h <= 17 ? t : h === 6 ? t - 3 : h === 18 ? t - 2 : t - 6) + (r() - .5))),
    kwh7: reihe(7, 6, 16).map((v, i) => i > 4 ? v * .15 : v), h7: reihe(7, 3, 7).map((v, i) => i > 4 ? 0 : v), ...extra });
  const g = (n, typ, kw, an) => ({ n, typ, kw, an, hand: false });
  return {
    aussen,
    baustellen: [
      { name: 'ÖWG Dobl Zwaring', aktiv: true, zeit: 'seit 08.09.2026', kwh: 412, eur: 115.4, container: 6 },
      { name: 'Wohnanlage Lieboch', aktiv: false, zeit: '03.11.2025 – 17.04.2026', kwh: 3480, eur: 974.4, container: 5 },
      { name: 'Volksschule Wundschuh', aktiv: false, zeit: '12.01.2025 – 28.03.2025', kwh: 1920, eur: 537.6, container: 3 },
    ],
    bereiche: [
      bereich('polier', 'Poliercontainer', 0, 'heizt', 19.4, [g('Radiator 1', 'Ölradiator', 2.0, 1), g('Radiator 2', 'Konvektor', 1.99, 1)], { trocknen: true }),
      bereich('mannschaft', 'Mannschaft', 1, 'trocknen', 17.8, [g('Radiator 1', 'Ölradiator', 2.0, 1), g('Konvektor', 'Konvektor', 2.0, 1), g('Trockner', 'Steckdose', 1.79, 1)], { trocknen: true }),
      bereich('magazin', 'Magazin', 2, 'heizt', null, [g('Radiator', 'Ölradiator', 1.5, 1), g('Steckdose', 'Steckdose', 0.4, 0)]),
      bereich('sanitaer', 'Sanitär', 3, 'frost', 4.2, [g('Frostwächter', 'Konvektor', 2.0, 1)]),
      bereich('lager', 'Lager Süd', 4, 'offline', null, [g('Radiator', 'Ölradiator', 2.0, 0)], { offline: true }),
      bereich('schacht', 'Pumpenschacht Nord', 5, 'laeuft', null, [g('Pumpe 1', 'Pumpe', 0.76, 1), g('Pumpe 2 (Reserve)', 'Pumpe', 0.76, 0)],
        { pumpe: true, zyklen: 36, lauf: '1 h 12 min', laengster: '4 min', kwh7: reihe(7, 0.6, 1.4), h7: reihe(7, 0.8, 1.8), zyk7: reihe(7, 20, 44).map(Math.round) }),
    ],
    // Arbeitszeiten mit Startdatum: es gilt die jüngste, die schon begonnen hat; alte bleiben gespeichert
    arbeitszeiten: [
      az('2025-11-03', 'Winter 2025/26', ['07:30', '16:30'], ['07:30', '12:00']),
      az('2026-03-30', 'Sommer 2026', ['06:30', '16:00'], ['06:30', '12:00']),
      az('2026-09-28', 'Herbst 2026', ['07:00', '16:30'], ['07:00', '12:30']),
      az('2026-11-02', 'Winter 2026/27', ['07:30', '16:30'], ['07:30', '12:00']),
    ],
    e: { preis: 0.28, vorheizen: 45, nachheizen: 15, soll: 20, grenze: 15, basis: 'Tageshöchstwert', fruehstart: true, frueh_temp: 0, frueh_min: 30, frost: true, frost_temp: 5,
      tr_mm: 2, tr_laenger: 45, tr_frueher: 15, empfaenger: 'Handy Herbert', m_offline: true, m_trocken: true, m_dauer: true, dauer_min: 20,
      m_leistung: true, m_kalt: true, kalt_min: 60, m_frost: true, m_fuehler: true, m_wetter: true, m_hand: true, hand_h: 8, m_zyklen: true, zyklen_h: 10 },
    // offene Warnungen: stufe 'stoerung' (rot) oder 'hinweis' (gelb)
    warnungen: [
      { id: 'w1', stufe: 'stoerung', b: 'lager', titel: 'nicht erreichbar', seit: 'seit 10:42', hilfe: 'Shelly antwortet nicht. Stecker und Sicherung prüfen – bei Stromausfall meldet er sich von selbst zurück.' },
      { id: 'w2', stufe: 'stoerung', b: 'sanitaer', titel: 'Frostgefahr: 4,2 °C', seit: 'seit 05:40', hilfe: 'Unter der Frostgrenze (5 °C), obwohl der Frostschutz heizt. Tür offen? Heizkörper prüfen.' },
      { id: 'w3', stufe: 'hinweis', b: 'mannschaft', titel: 'zu kalt: 17,8 °C statt 20 °C', seit: 'seit 07:00', hilfe: 'Erreicht in der Arbeitszeit das Soll nicht. Tür oder Fenster offen? Heizkörper zu schwach?' },
      { id: 'w4', stufe: 'hinweis', b: 'magazin', titel: 'Steckdose seit 3 Tagen auf Hand', seit: 'seit Sa 26.09.', hilfe: 'Von Hand eingeschaltet und nicht zurückgestellt. Soll wieder die Automatik übernehmen?' },
      { id: 'w5', stufe: 'hinweis', b: 'schacht', titel: 'Pumpe schaltet oft: 14 Zyklen je Stunde', seit: 'seit 13:10', hilfe: 'Üblich sind hier 3–5. Schwimmer prüfen – oder das Grundwasser steigt.' },
    ],
    // Protokoll: dauerhaft bei der Baustelle gespeichert, zusätzlich im HA-Logbuch
    protokoll: [
      ['Heute', '16:30', 'schalten', 'mannschaft', 'Arbeitsende – Nachheizen 15 min, dann Kleidung trocknen 45 min'],
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
const illu = b => b.pumpe ? bcSchacht(b.z === 'laeuft') : bcContainer(BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], b.z);
const TEXT = b => ({ heizt: b.t === null ? 'an · Thermostat regelt' : 'heizt · Arbeitszeit', trocknen: 'Kleidung trocknen', aus: 'aus bis 06:15', frost: 'Frostschutz', offline: 'nicht erreichbar', laeuft: 'Pumpe läuft' }[b.z]);
const schalter = (on, act, extra = '') => `<button class="sw ${on ? 'on' : ''}" data-act="${act}" ${extra} role="switch" aria-checked="${!!on}"><i></i></button>`;

/* ---------- Diagramme: dünne Marken, Haarraster, Hover-Anzeige ---------- */
function linie(id, reihen, einheit, vb = null) {
  const W = 320, H0 = 150, L = 28, R = 8, T = 10, U = 22, H = H0 + (vb ? 74 : 0);
  const alle = reihen.flatMap(s => s.v.filter(v => v !== null));
  const lo = Math.floor(Math.min(...alle) / 5) * 5, hi = Math.ceil(Math.max(...alle) / 5) * 5;
  const x = i => L + i / 24 * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (H0 - T - U);
  const raster = [...Array((hi - lo) / 5 + 1)].map((_, k) => lo + k * 5).map(v =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${v}°</text>`).join('');
  const achse = [0, 6, 12, 18, 24].map(h => `<text x="${x(h)}" y="${H - 6}" class="ax" text-anchor="middle">${String(h).padStart(2, '0')}</text>`).join('');
  const pfade = reihen.map((s, k) => `<path d="${s.v.map((v, i) => v === null ? '' : `${i && s.v[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')}" fill="none" stroke="var(--s${k + 1})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  let streifen = '', yv = null, unten = H0 - U;
  if (vb) {   // Verbrauch als Fläche in einem eigenen Streifen – keine zweite Skala im Temperaturbereich
    const bt = H0 - U + 16, bb = H - U, vmax = Math.max(.5, Math.ceil(Math.max(...vb) * 2) / 2), wert = i => vb[Math.min(i, vb.length - 1)];
    yv = v => bb - v / vmax * (bb - bt); unten = bb;
    const d = [...Array(25)].map((_, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${yv(wert(i)).toFixed(1)}`).join('');
    const k = reihen.length + 1;
    streifen = `<defs><linearGradient id="vbg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--s${k})" stop-opacity=".5"/><stop offset="1" stop-color="var(--s${k})" stop-opacity=".05"/></linearGradient></defs>
      <line x1="${L}" x2="${W - R}" y1="${bb}" y2="${bb}" class="gr"/><line x1="${L}" x2="${W - R}" y1="${bt}" y2="${bt}" class="gr" stroke-dasharray="2 3"/>
      <text x="${L - 5}" y="${bt + 3}" class="ax" text-anchor="end">${de(vmax, vmax % 1 ? 1 : 0)}</text><text x="${L - 5}" y="${bb + 3}" class="ax" text-anchor="end">0</text>
      <text x="${L + 3}" y="${bt - 3}" class="ax">kWh je Stunde</text>
      <path class="fl-flaeche" d="${d}L${x(24)} ${bb}L${x(0)} ${bb}z" fill="url(#vbg-${id})"/><path class="fl-linie" d="${d}" fill="none" stroke="var(--s${k})" stroke-width="1.5" stroke-linejoin="round"/>`;
  }
  CHARTS[id] = { art: 'linie', x0: L, x1: W - R, W, n: 25, reihen, einheit, y, vb, yv, unten };
  return `<svg class="chart" data-chart="${id}" viewBox="0 0 ${W} ${H}">${raster}${achse}${pfade}${streifen}<g class="hover"></g></svg>
    <div class="legende">${reihen.map((s, k) => `<span><i style="background:var(--s${k + 1})"></i>${s.name}</span>`).join('')}${vb ? `<span><i style="background:var(--s${reihen.length + 1})"></i>Verbrauch</span>` : ''}</div>`;
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
    if (zeitraum === 'Monat') return [...Array(30)].map((_, d) => { const we = [5, 6].includes((d + 1) % 7); return we ? p * r() * .6 : p * (4.2 + r() * 1.8); });
    return MONATE.map((_, m) => { const saison = [1, .95, .8, .45, .08, 0, 0, 0, .8, 1, 1.05, .95][m]; return p * 135 * saison * (.9 + r() * .2); });
  };
  const k = { Tag: 1, Monat: 2, Jahr: 3 }[zeitraum];
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
  get b() { return this.d.bereiche.find(x => x.id === this.s.cid); }
  gehe(view, cid = null) { this.s.view = view; this.s.cid = cid; this.s.sheet = null; this.render(true); }
  toast(t) { const el = this.root.querySelector('.toast'); el.textContent = t; el.classList.remove('an'); void el.offsetWidth; el.classList.add('an'); }

  render(neu = false) {
    const scroll = this.root.querySelector('.scroll'), pos = scroll && !neu ? scroll.scrollTop : 0;
    const tabs = [['uebersicht', 'Übersicht'], ['heizung', 'Heizung'], ['auswertung', 'Auswertung'], ['verlauf', 'Verlauf'], ['einst', '⚙']];
    const aktivTab = this.s.view === 'container' ? 'uebersicht' : this.s.view;
    this.ui.innerHTML = `<div class="scroll"><div class="seite ${neu ? 'rein' : ''}">${this['v_' + this.s.view]()}</div></div>
      <nav class="glas-nav glas-panel">${tabs.map(([k, t]) => `<button data-act="tab" data-v="${k}" class="${k === aktivTab ? 'on' : ''}">${t}</button>`).join('')}</nav>
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
        <div><div class="klickbar" data-act="sheet" data-s="baustellen"><div class="glas-klein">BAUSTELLE</div><div class="glas-titel">ÖWG Dobl Zwaring <span class="pfeil">▾</span></div></div>
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
        <div class="glas-name">${esc(b.name)}</div>
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
        <div class="zeile"><span>♨ Automatik für ${b.pumpe ? 'diesen Schacht' : 'diesen Container'}</span>${schalter(b.auto, 'b-auto')}</div>
        ${b.pumpe ? '' : `<div class="zeile"><span>👕 Kleidung trocknen nach Regen</span>${schalter(b.trocknen, 'b-trocknen')}</div>`}
      </div>
      <div class="glas-panel block"><div class="block-kopf"><b>${b.pumpe ? 'Pumpen' : 'Geräte'}</b><span class="leise">Schalten = Handbetrieb bis zum nächsten Schaltpunkt</span></div>
        ${b.geraete.map((g, i) => `<div class="zeile geraet"><span class="g-ic ${g.an ? 'an' : ''}">${g.typ === 'Pumpe' ? '💧' : g.typ === 'Steckdose' ? '⏻' : '♨'}</span>
          <div class="g-t"><b>${esc(g.n)}</b><span class="leise">${g.typ} · ${de(g.kw, 2)} kW${g.hand ? ' · <em class="hand">Hand</em>' : ''}</span></div>
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
    return `${this.kopf('Heizung', 'ÖWG DOBL ZWARING', `<div>${schalter(this.s.auto, 'auto')}</div>`)}
      ${this.azBlock()}
      <div class="glas-panel block"><div class="block-kopf"><b>So wird geheizt</b><span class="leise">in der Arbeitszeit immer</span></div>
        <div class="zeile"><div><b>Vorheizen</b><div class="leise">vor Arbeitsbeginn, damit es warm ist</div></div>${st('vorheizen', 5, min)}</div>
        <div class="zeile"><div><b>Nachheizen</b><div class="leise">nach Arbeitsende, jeden Tag</div></div>${st('nachheizen', 5, min)}</div>
        <div class="zeile"><div><b>🌡 Mit Fühler</b><div class="leise">${this.d.bereiche.filter(b => !b.pumpe && b.t !== null).map(b => esc(b.name)).join(', ')} – regelt auf</div></div>${st('soll', .5, grad)}</div>
        <div class="zeile"><div><b>Ohne Fühler</b><div class="leise">${this.d.bereiche.filter(b => !b.pumpe && b.t === null).map(b => esc(b.name)).join(', ')} – Heizung bleibt an, der Thermostat am Heizkörper regelt</div></div></div>
        <div class="zeile"><div><b>Heizgrenze</b><div class="leise">nicht heizen, wenn es wärmer ist</div></div>${st('grenze', .5, grad)}</div>
        <div class="zeile"><span>Grundlage</span><div class="seg klein">${['jetzt', 'Tageshöchstwert'].map(v => `<button data-act="basis" data-v="${v}" class="${e.basis === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="zeile"><div><b>Kälte-Frühstart</b><div class="leise">unter ${de(e.frueh_temp, 0)} °C zusätzlich früher</div></div>${schalter(e.fruehstart, 'e-bool', 'data-k="fruehstart"')}</div>
        ${e.fruehstart ? `<div class="zeile unter"><span>so viel früher</span>${st('frueh_min', 5, min)}</div>` : ''}
        <div class="zeile"><div><b>Frostschutz</b><div class="leise">hält jeden Container über der Grenze</div></div>${schalter(e.frost, 'e-bool', 'data-k="frost"')}</div>
        ${e.frost ? `<div class="zeile unter"><span>Frostgrenze</span>${st('frost_temp', .5, grad)}</div>` : ''}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>👕 Kleidung trocknen</b><span class="leise">nach Regen zusätzlich zum Nachheizen</span></div>
        <div class="zeile"><span>ab Regen (seit gestern)</span>${st('tr_mm', .5, mm)}</div>
        <div class="zeile"><span>zusätzlich nach dem Nachheizen</span>${st('tr_laenger', 5, min)}</div>
        <div class="zeile"><span>am nächsten Morgen früher</span>${st('tr_frueher', 5, min)}</div>
        ${this.d.bereiche.filter(b => !b.pumpe).map(b => `<div class="zeile unter"><span>${esc(b.name)}</span>${schalter(b.trocknen, 'tr-b', `data-id="${b.id}"`)}</div>`).join('')}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>Urlaub &amp; Feiertage</b></div>
        <div class="zeile"><div><b>Nächster Feiertag</b><div class="leise">aus dem Kalender „Feiertage“ (Österreich, jedes Jahr neu)</div></div><span>Sa 01.11.</span></div>
        <div class="zeile"><div><b>Urlaub</b><div class="leise">Weihnachten 23.12. – 06.01.</div></div><button class="chip glas-panel" data-act="sheet" data-s="urlaub">Eintragen</button></div></div>`;
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
    const f = { Tag: 1, Woche: 6.2, Monat: 26, Heizperiode: 150 }[this.s.zeitraum], preis = this.d.e.preis;
    const kwh = 18.6 * f, ohne = 96 * f, B = this.d.bereiche;
    const labels = { Tag: ['00', '04', '08', '12', '16', '20'], Woche: TAGE, Monat: ['KW36', 'KW37', 'KW38', 'KW39', 'KW40'], Heizperiode: ['Okt', 'Nov', 'Dez', 'Jän', 'Feb', 'Mär'] }[this.s.zeitraum];
    const r = zufall(labels.length * 3), werte = labels.map(() => kwh / labels.length * (.6 + r() * .8));
    const anteil = [.24, .3, .08, .2, .04, .14], maxA = Math.max(...anteil);
    return `${this.kopf('Auswertung', 'VERBRAUCH UND KOSTEN')}
      <div class="seg glas-panel">${['Tag', 'Woche', 'Monat', 'Heizperiode'].map(z => `<button data-act="zeitraum" data-v="${z}" class="${z === this.s.zeitraum ? 'on' : ''}">${z}</button>`).join('')}</div>
      <div class="glas-panel kennz"><div><b>${de(kwh, 0)}</b><span>kWh</span></div><div><b>${de(kwh * preis, 2)} €</b><span>Kosten</span></div><div><b>${de(kwh / 3.6, 0)} h</b><span>Heizzeit</span></div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Verbrauch</b><span class="leise">kWh je ${this.s.zeitraum === 'Tag' ? '4 Stunden' : this.s.zeitraum === 'Woche' ? 'Tag' : this.s.zeitraum === 'Monat' ? 'Woche' : 'Monat'}</span></div>
        <div class="chart-wrap">${balken('aw-' + this.s.zeitraum, werte, labels, 'kWh')}</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Je Container</b><span class="leise">kWh · Anteil</span></div>
        ${B.map((b, i) => `<div class="hbar"><span class="hb-n">${esc(b.name)}</span><span class="hb-spur"><i style="width:${anteil[i] / maxA * 100}%;background:var(--s${i + 1})"></i></span><span class="hb-w">${de(kwh * anteil[i], 0)}</span></div>`).join('')}</div>
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

  /* ---- Verlauf ---- */
  v_verlauf() {
    const liste = this.d.baustellen.filter(b => b.aktiv === (this.s.verlauf === 'aktiv'));
    return `${this.kopf('Verlauf', 'BAUSTELLEN')}
      <div class="seg glas-panel">${[['aktiv', 'Aktiv'], ['ab', 'Abgeschlossen']].map(([k, t]) => `<button data-act="verlauf" data-v="${k}" class="${k === this.s.verlauf ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${liste.map((b, i) => `<button class="glas-panel bs-karte" data-act="sheet" data-s="baustelle" data-i="${this.d.baustellen.indexOf(b)}" style="animation-delay:${i * 60}ms">
        <div class="bs-kopf"><b>${esc(b.name)}</b><span class="badge ${b.aktiv ? 'gruen' : ''}">${b.aktiv ? 'aktiv' : 'abgeschlossen'}</span></div>
        <div class="leise">${b.zeit} · ${b.container} Container</div>
        <div class="bs-zahlen"><span><b>${de(b.kwh, 0)}</b> kWh</span><span><b>${de(b.eur, 2)}</b> €</span></div></button>`).join('')}
      ${this.s.verlauf === 'aktiv' ? this.protokoll() : ''}`;
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
    const e = this.d.e;
    return `${this.kopf('Einstellungen', 'ÖWG DOBL ZWARING')}
      <div class="glas-panel liste"><div class="gruppe">Baustelle</div>
        <button class="zeile" data-act="sheet" data-s="name"><span>Name</span><span class="leise">ÖWG Dobl Zwaring ›</span></button>
        <button class="zeile" data-act="sheet" data-s="abschliessen"><span>Baustelle abschließen</span><span class="leise">kommt in den Verlauf ›</span></button>
        <button class="zeile" data-act="sheet" data-s="baustelle-neu"><span class="blau">+ Neue Baustelle</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Container und Geräte</div>
        ${this.d.bereiche.map(b => `<button class="zeile" data-act="bereich-einst" data-id="${b.id}"><span><i class="farbpunkt" style="background:${BEREICH_FARBEN[b.f % 6]}"></i>${esc(b.name)}</span><span class="leise">${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'} ›</span></button>`).join('')}
        <button class="zeile" data-act="sheet" data-s="container-neu"><span class="blau">+ Container oder Schacht</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Strom</div>
        <label class="zeile"><span>Preis je kWh</span><span class="eingabe"><input type="number" step="0.01" data-k="preis" value="${e.preis}"> €</span></label></div>
      <div class="glas-panel liste"><div class="gruppe">Wetter und Kalender</div>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Wetter</span><span class="leise">Open-Meteo · Zone Baustelle ›</span></button>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Außentemperatur</span><span class="leise">aus der Vorhersage ›</span></button>
        <button class="zeile" data-act="sheet" data-s="urlaub"><span>Urlaub</span><span class="leise">Kalender „Baustelle Urlaub“ ›</span></button>
        <div class="zeile"><span>Feiertage</span><span class="leise">Österreich, automatisch</span></div></div>
      <div class="glas-panel liste"><div class="gruppe">Meldungen · Störungen</div>
        <div class="zeile"><span>Empfänger</span><span class="leise">${e.empfaenger}</span></div>
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
      const B = this.d.bereiche, z = s.zeitraum, aus = B.filter(b => s.auswahl.includes(b.id)), alle = aus.length === B.length;
      const farbe = b => BEREICH_FARBEN[b.f % BEREICH_FARBEN.length];
      const reihen = aus.length ? aus.map(b => ({ name: b.name, v: verbrauch(B, b.id, z), farbe: farbe(b) })) : [{ name: 'Baustelle', v: verbrauch(B, null, z), farbe: 'var(--s1)' }];
      const labels = z === 'Tag' ? [...Array(24)].map((_, h) => String(h).padStart(2, '0')) : z === 'Monat' ? [...Array(30)].map((_, d) => `${d + 1}.`) : MONATE;
      const summeJe = labels.map((_, i) => reihen.reduce((a, r) => a + r.v[i], 0)), summe = summeJe.reduce((a, v) => a + v, 0);
      const spitze = Math.max(...summeJe), wo = labels[summeJe.indexOf(spitze)];
      const einheit = z === 'Tag' ? 'kWh/h' : 'kWh', je = { Tag: 'je Stunde · heute', Monat: 'je Tag · September', Jahr: 'je Monat · 2026' }[z];
      const titel = !aus.length ? 'ÖWG Dobl Zwaring · Summe' : aus.length === 1 ? esc(aus[0].name) : `${aus.length} Container gestapelt`;
      return `${griff}<div class="block-kopf"><h3>Verbrauch</h3><span class="leise">${titel}</span></div>
        <div class="seg">${['Tag', 'Monat', 'Jahr'].map(v => `<button data-act="vb-zeitraum" data-v="${v}" class="${v === z ? 'on' : ''}">${v}</button>`).join('')}</div>
        <div class="vb-wer"><button data-act="vb-wer" class="${!aus.length ? 'on' : ''}"><i style="background:var(--s1)"></i>Baustelle</button>
          <button data-act="vb-wer" data-id="*" class="${alle ? 'on' : ''}">Alle gestapelt</button>
          ${B.map(b => `<button data-act="vb-wer" data-id="${b.id}" class="${s.auswahl.includes(b.id) ? 'on' : ''}"><i style="background:${farbe(b)}"></i>${esc(b.name)}${s.auswahl.includes(b.id) ? ' ✓' : ''}</button>`).join('')}</div>
        <div class="kennz"><div><b>${de(summe, summe < 100 ? 1 : 0)}</b><span>kWh ${z === 'Tag' ? 'heute' : z === 'Monat' ? 'im Monat' : 'im Jahr'}${reihen.length > 1 ? ' zusammen' : ''}</span></div>
          <div><b>${de(summe * this.d.e.preis, 2)} €</b><span>Kosten</span></div><div><b>${wo}</b><span>Spitze ${de(spitze, 1)} kWh</span></div></div>
        ${reihen.length > 1 ? `<div class="vb-je">${reihen.map(r => { const su = r.v.reduce((a, v) => a + v, 0), sp = Math.max(...r.v);
            return `<div><i style="background:${r.farbe}"></i><span class="n">${esc(r.name)}</span><b>${de(su, su < 100 ? 1 : 0)} kWh</b><span>${de(su * this.d.e.preis, 2)} €</span><span class="leise">Spitze ${labels[r.v.indexOf(sp)]}</span></div>`; }).join('')}</div>`
          : ''}
        <div class="leise">${einheit} ${je}${aus.length > 1 ? ' · gestapelt, oberste Kante = Summe' : ''}</div>
        <div class="chart-wrap">${flaeche(`vb-${aus.map(b => b.id).join('_') || 'alle'}-${z}`, reihen, labels, einheit, z === 'Tag' ? 6 : z === 'Monat' ? 7 : 3)}</div>
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
        <div class="hp-legende"><span><i class="tl-extra"></i>Frühstart</span><span><i class="tl-vor"></i>Vor- und Nachheizen ${this.d.e.vorheizen}/${this.d.e.nachheizen} min</span><span><i class="tl-heiz"></i>Arbeitszeit</span><span><i class="tl-trock"></i>Kleidung trocknen</span></div>
        <div class="hp">${WOCHE.map(([t, d]) => { const p = this.planTag(t), h = t === HEUTE_TAG;
          return `<div class="hp-zeile ${h ? 'heute' : ''}"><div class="hp-tag"><b>${h ? 'heute' : t}</b><span>${d}</span></div>
            <div class="hp-mitte">${this.zeitstrahl(p, h)}<div class="leise">${p ? p.gruende.join(' · ') : 'frei · nur Frostschutz'}</div></div>
            <div class="hp-zeit">${p ? `${uhr(p.extra)}<br>${uhr(p.ende)}` : '–'}</div></div>`; }).join('')}
          <div class="hp-zeile achse"><div></div><div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div><div></div></div></div>
        ${knopf('Arbeitszeit ändern', 'az-heizung', 'amber')}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'az') {
      const a = this.d.arbeitszeiten[s.i], geplant = a.ab > HEUTE, aktuell = a === this.azJetzt;
      return `${griff}<div class="block-kopf"><h3>${esc(a.name)}</h3><span class="badge ${aktuell ? 'gruen' : geplant ? 'blau-b' : ''}">${aktuell ? 'gilt jetzt' : geplant ? 'geplant' : 'früher'}</span></div>
        <div class="leise">gilt ab ${datum(a.ab)}</div>
        ${TAGE.map(t => `<div class="zeile"><b class="tag-n">${t}</b><span>${a.tage[t] ? a.tage[t].join('–') : '<span class="leise">frei</span>'}</span></div>`).join('')}
        ${knopf('Als Vorlage für eine neue', 'az-vorlage', 'amber')}${geplant ? knopf('Löschen', 'az-weg', 'rot') : ''}${knopf('Schließen', 'zu', 'leise-k')}`;
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
      const b = this.b, e = s.edit ||= { name: b.name, geraete: b.geraete.map(g => ({ ...g })) };
      const typen = b.pumpe ? ['Pumpe'] : ['Ölradiator', 'Konvektor', 'Steckdose'];
      const wahl = (i, g) => `<select data-ge="typ" data-i="${i}">${typen.map(t => `<option ${g.typ === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      return `${griff}<div class="block-kopf"><h3>Bearbeiten</h3><span class="leise">${b.pumpe ? 'Pumpenschacht' : 'Container'}</span></div>
        <label class="feld">Name<input value="${esc(e.name)}" data-b="name"></label>
        <div class="gruppe-t">${b.pumpe ? 'Pumpen' : 'Geräte'} · ${e.geraete.filter(g => !g.weg).length}</div>
        ${e.geraete.map((g, i) => g.weg ? `<div class="ge-zeile weg"><span>${esc(g.n)} wird entfernt</span><button class="chip glas-panel" data-act="ge-zurueck" data-i="${i}">rückgängig</button></div>`
          : `<div class="ge-zeile"><div class="ge-felder">
            ${g.neu ? `<select data-ge="shelly" data-i="${i}">${['Heizung 03 · Shelly Plug S', 'Heizung 04 · Shelly Plug S', 'Pumpe 3 · Shelly Plus 1PM'].map(x => `<option ${g.shelly === x ? 'selected' : ''}>${x}</option>`).join('')}</select>` : `<span class="leise ge-shelly">${esc(g.shelly || g.n.toLowerCase().replace(/[^a-z0-9]+/g, '_'))} · Shelly Plug S</span>`}
            <div class="ge-zwei"><input value="${esc(g.n)}" data-ge="n" data-i="${i}" placeholder="Name">${wahl(i, g)}</div></div>
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
    if (s.art === 'urlaub') return `${griff}<h3>Urlaub</h3><label class="feld">Von<input type="date" value="2026-12-23"></label><label class="feld">Bis<input type="date" value="2027-01-06"></label>
      <div class="leise">Wird in den Kalender „Baustelle Urlaub“ eingetragen; in der Zeit läuft nur der Frostschutz.</div>${knopf('Eintragen', 'toast-zu', 'amber')}`;
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
      case 'sheet': this.s.sheet = { art: el.dataset.s, t: el.dataset.t, i: +el.dataset.i, auswahl: el.dataset.id ? [el.dataset.id] : [], zeitraum: 'Tag' }; return neu();
      case 'wa': this.s.sheet.wa = el.dataset.v; return neu();
      case 'vb-zeitraum': this.s.sheet.zeitraum = el.dataset.v; return neu();
      case 'vb-wer': { const sh = this.s.sheet, id = el.dataset.id;
        if (!id) sh.auswahl = []; else if (id === '*') sh.auswahl = d.bereiche.map(x => x.id);
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
      case 'st': { const k = el.dataset.k; d.e[k] = Math.max(0, Math.round((d.e[k] + +el.dataset.d) * 10) / 10); return neu(); }
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
      case 'neu-anlegen': { const name = this.root.querySelector('[data-neu="name"]').value.trim() || 'Neuer Container', p = this.s.sheet.neuArt === 'Pumpenschacht';
        d.bereiche.push({ id: 'n' + d.bereiche.length, name, f: d.bereiche.length, z: p ? 'aus' : 'aus', t: null, auto: true, trocknen: false, pumpe: p, zyklen: 0, lauf: '0 min', laengster: '–',
          innen: [], kwh7: Array(7).fill(0), h7: Array(7).fill(0), zyk7: Array(7).fill(0), geraete: [{ n: p ? 'Pumpe 1' : 'Heizung 03', typ: p ? 'Pumpe' : 'Ölradiator', kw: p ? .76 : 2, an: 0, hand: false }] });
        this.s.sheet = null; neu(); return this.toast(`${name} angelegt`); }
      case 'b-speichern': { const e = this.s.sheet.edit, kw = { Ölradiator: 2, Konvektor: 2, Steckdose: .5, Pumpe: .76 };
        if (e.name.trim()) b.name = e.name.trim();
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
    if (el.dataset.ge) this.s.sheet.edit.geraete[+el.dataset.i][el.dataset.ge] = el.value;
    if (el.dataset.b === 'name' && this.s.sheet?.edit) this.s.sheet.edit.name = el.value;
    if (el.dataset.azt) this.s.sheet.form.tage[el.dataset.azt][+el.dataset.p] = el.value;
  }
  hover(ev) {
    const svg = ev.target.closest('svg.chart'); if (!svg) return this.tip(null);
    const c = CHARTS[svg.dataset.chart], r = svg.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width;
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
