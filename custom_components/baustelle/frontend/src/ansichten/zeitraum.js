// Zeitraum-Wahl ‹ Heute › mit Kalender als Lit-Vorlage (BSM-022 Stufe 3c; wie BaustellePanel.zrWahl, das die noch alten
// Ansichten bis Stufe 4 nutzen). Zustand und Grenzen kommen aus der Seite (zrSt, zrMax, zrInfo); hier nur die Anzeige.
import { html, nothing } from 'lit';
import { MONATE, MONATE_LANG, TAGE, kwNr, plusTage, zrVersatz } from '../hilfen.js';

/* Kalender: Tag → Monat mit Tagen, Woche → Monat mit KW-Zeilen, Monat → Jahr mit Monaten, Jahr → Jahre seit Beginn */
function kalender(p, ziel, z, v, max, k) {
  const h = p.z.HEUTE, mo0 = p.z.WOCHE_ISO[0], ver = iso => zrVersatz(z, iso, h, mo0), setz = x => () => p.zrSetzen(ziel, max, x);
  const knopf = (iso, text, cls = '') => { const x = ver(iso), an = x >= 0 && x <= max;
    return html`<button class="zr-k ${cls} ${x === v ? 'on' : ''} ${x === 0 ? 'jetzt' : ''}" data-v=${an ? x : nothing} ?disabled=${!an} @click=${an ? setz(x) : null}>${text}</button>`; };
  let kopf, inhalt, cls, frueher = false, spaeter = false;
  if (z === 'Tag' || z === 'Woche') {
    const erster = `${k.j}-${String(k.m + 1).padStart(2, '0')}-01`, start = plusTage(erster, -((new Date(erster + 'T12:00:00Z').getUTCDay() + 6) % 7));
    const wochen = []; for (let w = start; w.slice(0, 7) <= erster.slice(0, 7) && wochen.length < 6; w = plusTage(w, 7)) wochen.push(w);
    kopf = `${MONATE_LANG[k.m]} ${k.j}`; cls = 'zr-kal-tage';
    inhalt = html`<div class="zr-kw-kopf"><span>KW</span>${TAGE.map(x => html`<span>${x}</span>`)}</div>${wochen.map(mo => {
      const tage = [...Array(7)].map((_, n) => plusTage(mo, n)), fremd = iso => iso.slice(0, 7) !== erster.slice(0, 7) ? 'fremd' : '';
      if (z === 'Woche') { const x = ver(mo), an = x >= 0 && x <= max;
        return html`<button class="zr-woche ${x === v ? 'on' : ''} ${x === 0 ? 'jetzt' : ''}" data-v=${an ? x : nothing} ?disabled=${!an} @click=${an ? setz(x) : null}><b>${kwNr(mo)}</b>${tage.map(t => html`<span class=${fremd(t)}>${+t.slice(8)}</span>`)}</button>`; }
      return html`<div class="zr-woche-z"><b>${kwNr(mo)}</b>${tage.map(t => knopf(t, +t.slice(8), fremd(t)))}</div>`; })}`;
    frueher = ver(plusTage(erster, -1)) <= max; spaeter = ver(plusTage(wochen.at(-1), 7)) >= 0 && plusTage(erster, 31).slice(0, 7) <= h.slice(0, 7);
  } else if (z === 'Monat') {
    kopf = String(k.j); cls = 'zr-kal-monate';
    inhalt = MONATE.map((n, m) => knopf(`${k.j}-${String(m + 1).padStart(2, '0')}-01`, n));
    frueher = ver(`${k.j - 1}-12-01`) <= max; spaeter = k.j < +h.slice(0, 4);
  } else {
    const J0 = +h.slice(0, 4), ab = J0 - Math.min(max, 11); kopf = ab === J0 ? String(J0) : `${ab}–${J0}`; cls = 'zr-kal-monate';
    inhalt = [...Array(J0 - ab + 1)].map((_, n) => knopf(`${ab + n}-01-01`, ab + n));
  }
  return html`<div class="zr-kal glas-panel"><div class="zr-kal-kopf"><button class="zr-pf" ?disabled=${!frueher} aria-label="zurück" @click=${() => p.zrKalBlaettern(-1)}>‹</button><b>${kopf}</b>
        <button class="zr-pf" ?disabled=${!spaeter} aria-label="vor" @click=${() => p.zrKalBlaettern(1)}>›</button></div>
      <div class=${cls}>${inhalt}</div>
      <div class="zr-kal-fuss"><button class="glas-panel chip" @click=${setz(0)}>${{ Tag: 'Heute', Woche: 'Diese Woche', Monat: 'Dieser Monat', Jahr: 'Dieses Jahr' }[z]}</button></div></div>`;
}

/** ‹ Zeitraum › für ein Ziel (c-Tag, c-Woche, aw, sheet); grenze = frühester Tag (zrGrenze) */
export function zeitraumVorlage(p, ziel, z, grenze) {
  const v = p.zrV(ziel), max = p.zrMax(z, grenze), i = p.zrInfo(z, v), k = p.s.zrKal && p.s.zrKal.ziel === ziel ? p.s.zrKal : null;
  return html`<div class="zr-zeile" data-ziel=${ziel}><div class="zr-nav glas-panel"><button class="zr-pf" ?disabled=${v >= max} aria-label="früher" title="früher" @click=${() => p.zrSchritt(ziel, max, 1)}>‹</button>
        <button class="zr-mitte zr-auf" @click=${() => p.zrKalAuf(ziel)}><b>${i.text}</b>${i.unter ? html`<small>${i.unter}</small>` : nothing}<span class="zr-pfeil">${k ? '▴' : '▾'}</span></button>
        <button class="zr-pf" ?disabled=${v <= 0} aria-label="später" title="später" @click=${() => p.zrSchritt(ziel, max, -1)}>›</button></div>
      ${v ? html`<button class="glas-panel chip zr-akt" @click=${() => p.zrSetzen(ziel, max, 0)}>Aktuell</button>` : nothing}${k ? kalender(p, ziel, z, v, max, k) : nothing}</div>`;
}
