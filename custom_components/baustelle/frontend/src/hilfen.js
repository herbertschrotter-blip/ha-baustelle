// Hilfen der Seite „Baustelle“: Formatieren, Datum/Zeit der Anzeige, kleine HTML-Bausteine (BSM-022 Stufe 1a).
// Reine Anzeige – gerechnet wird in der Integration.
/* ---------- Hilfen (wie im Mockup, aber sicher gegen fehlende Werte) ---------- */
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export const zahl = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));

export const de = (x, d = 1) => { if (!zahl(x)) return '–'; const n = Number(x); return (Math.abs(n) < .5 * 10 ** -d ? 0 : n).toLocaleString('de-AT', { minimumFractionDigits: d, maximumFractionDigits: d }); };

export const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const minu = t => { if (!t) return 0; const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export const uhr = m => { m = Math.max(0, Math.round(zahl(m) ? m : 0)); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export const datum = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('.') : '–';

export const tageZwischen = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

/* FE-0008: Zeitraum wählen – Versatz 0 = aktuell, 1 = davor …; h = heute, mo = Montag dieser Woche */
export const kwNr = iso => { const t = new Date(iso + 'T12:00:00Z'), w = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - w + 3); const j = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return 1 + Math.round(((t - j) / 864e5 - 3 + ((j.getUTCDay() + 6) % 7)) / 7); };

export function zrVersatz(z, iso, h, mo) {
  if (z === 'Tag') return tageZwischen(iso, h);
  if (z === 'Woche') { const w = (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7; return tageZwischen(plusTage(iso, -w), mo) / 7; }
  if (z === 'Monat') return (+h.slice(0, 4) - +iso.slice(0, 4)) * 12 + +h.slice(5, 7) - +iso.slice(5, 7);
  return +h.slice(0, 4) - +iso.slice(0, 4);
}

export function zrInfo(z, v, h, mo) {
  if (z === 'Tag') { const t = plusTage(h, -v); return { text: v === 0 ? 'Heute' : v === 1 ? 'Gestern' : `${wtag(t)} ${datum(t)}`, unter: v < 2 ? `${wtag(t)} ${datum(t)}` : '', iso: t }; }
  if (z === 'Woche') { const m = plusTage(mo, -7 * v), so = plusTage(m, 6);
    return { text: v === 0 ? 'Diese Woche' : v === 1 ? 'Vorwoche' : `KW ${kwNr(m)}`, unter: `KW ${kwNr(m)} · ${datum(m).slice(0, 6)}–${datum(so)}`, iso: m }; }
  if (z === 'Monat') { let m = +h.slice(5, 7) - 1 - v, j = +h.slice(0, 4); while (m < 0) { m += 12; j--; }
    return { text: `${MONATE_LANG[m]} ${j}`, unter: v === 0 ? 'aktueller Monat' : '', iso: `${j}-${String(m + 1).padStart(2, '0')}-01` }; }
  const j = +h.slice(0, 4) - v; return { text: String(j), unter: v === 0 ? 'aktuelles Jahr' : '', iso: `${j}-01-01` };
}

export const plusTage = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* Liegt ein (wiederkehrender) Termin auf diesem Tag? */
const terminAm = (t, iso) => { const d = tageZwischen(t.datum, iso); return t.wieder === 'einmal' ? d === 0 : d >= 0 && d % (t.wieder === '2wochen' ? 14 : 7) === 0; };

export const naechsterTermin = (t, ab) => { for (let k = 0; k < 28; k++) { const iso = plusTage(ab, k); if (terminAm(t, iso)) return iso; } return null; };

export const kurzDatum = iso => iso ? String(iso).slice(0, 10).split('-').reverse().slice(0, 2).join('.') + '.' : '–';

export const wtag = iso => iso ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(String(iso).slice(0, 10) + 'T12:00:00Z').getUTCDay()] : '–';

export const dauer = (a, b) => { const m = minu(b) - minu(a); return `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`; };

export const stdMin = h => { if (!zahl(h)) return '–'; const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };

export const MONATE = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export const MONATE_LANG = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const summe = a => (a || []).reduce((x, v) => x + (zahl(v) ? Number(v) : 0), 0);

export const addieren = arr => arr.length ? arr.reduce((a, w) => a.map((v, i) => v + (w[i] || 0))) : [];

/* Erklärtexte „ⓘ“ (abschaltbar unter Einstellungen › App) */
export const erkl = (an, text) => an ? `<div class="erkl">ⓘ ${text}</div>` : '';

export const knopf2 = (t, act, text) => `<button class="knopf leise-k" data-act="${act}" data-t="${esc(text)}">${t}</button>`;

export const schalter = (on, act, extra = '') => `<button class="sw ${on ? 'on' : ''}" data-act="${act}" ${extra} role="switch" aria-checked="${!!on}"><i></i></button>`;

/* Versionen vergleichen: 0.7.10 > 0.7.9 */
export const verNeuer = (a, b) => { const x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (Number.isNaN(d)) return false; if (d) return d > 0; } return false; };
