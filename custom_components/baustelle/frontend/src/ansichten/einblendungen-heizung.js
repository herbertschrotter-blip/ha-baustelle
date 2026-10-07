// Dialoge der Heizung mit Lit (BSM-022 Stufe 3d): Heizplan, Arbeitszeit, Neue/Arbeitszeit bearbeiten, Ausnahme.
// Formulare sind Entwurf in s.form (getrennt von den Serverdaten); Felder bleiben beim Neuzeichnen stehen. Plan und
// Zeitstrahl kommen von der Seite (heizplanInhalt, zeitstrahl – Text bis Stufe 4).
import { html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { TAGE, datum, kurzDatum, minu, uhr, wtag } from '../hilfen.js';
import { AUSNAHME } from '../tabellen.js';
import { schalterVorlage } from './allgemein.js';

const GRIFF = html`<div class="griff"></div>`;
const knopf = (t, fn, art = '') => html`<button class="knopf ${art}" @click=${fn}>${t}</button>`;
/* Feld eines Entwurfs: Wert als Attribut (Ausgabe wie bisher) und als Eigenschaft (live), Eingabe schreibt in ziel[k] */
const feld = (ziel, k, typ, attr, nach) => html`<input type=${typ || nothing} value=${ziel[k]} .value=${live(ziel[k])} placeholder=${attr.ph || nothing} data-f=${attr.marke || k} @input=${e => { ziel[k] = e.target.value; if (nach) nach(); }}>`;

export function heizplanEinblendung(p) {
  const d = p.d, az = p.azJetzt;
  return html`${GRIFF}<div class="block-kopf"><h3>Heizplan · diese Woche</h3><span class="leise">${az ? `${az.name} · seit ${datum(az.ab)}` : 'keine Arbeitszeit'}</span></div>
        ${d.e.auto ? nothing : html`<div class="warn-k"><b>Automatik ist aus</b><div class="leise">Der Plan wird gerade nicht ausgeführt.</div></div>`}
        ${unsafeHTML(p.heizplanInhalt())}
        <div class="bedarf-dauer">${d.jetztBis ? html`<button class="chip glas-panel amber" @click=${() => p.jetztHeizen(false)}>■ alle heizen bis ${d.jetztBis} – beenden</button>` : html`<button class="chip glas-panel" @click=${() => p.jetztHeizen(true)}>▶ alle jetzt 1 h heizen</button>`}<button class="chip glas-panel" @click=${() => p.ausnahmeNeu('')}>+ Ausnahme</button></div>
        ${knopf('Arbeitszeit ändern', () => p.gehe('heizung'), 'amber')}${knopf('Schließen', () => p.schliessen(), 'leise-k')}`;
}

export function arbeitszeitEinblendung(p, s) {
  const d = p.d, a = d.arbeitszeiten[s.i]; if (!a) { p.s.sheet = null; return nothing; }
  const geplant = a.ab > p.z.HEUTE, aktuell = a === p.azJetzt;
  return html`${GRIFF}<div class="block-kopf"><h3>${a.name}</h3><span class="badge ${aktuell ? 'gruen' : geplant ? 'blau-b' : ''}">${aktuell ? 'gilt jetzt' : geplant ? 'geplant' : 'früher'}</span></div>
        <div class="leise">gilt ab ${datum(a.ab)}</div>
        ${TAGE.map(t => html`<div class="zeile"><b class="tag-n">${t}</b><span>${a.tage[t] ? a.tage[t].join('–') : html`<span class="leise">frei</span>`}</span></div>`)}
        ${a.auto ? html`<div class="leise">Automatisch angelegt – wird durch deine erste eigene Arbeitszeit ersetzt.</div>` : nothing}
        ${knopf('Bearbeiten', p.nurAdmin(() => p.azBearbeiten(a)), 'amber nur-admin')}${knopf('Als Vorlage für eine neue', () => p.azNeu(a))}
        ${d.arbeitszeiten.length > 1 ? knopf('Löschen', p.nurAdmin(() => p.azWeg(a)), 'rot nur-admin') : html`<div class="leise">Die letzte Arbeitszeit lässt sich nicht löschen – ohne Arbeitszeit liefe nur der Frostschutz.</div>`}${knopf('Schließen', () => p.schliessen(), 'leise-k')}`;
}

export function ausnahmeEinblendung(p, s) {
  const d = p.d, f = s.form, az = p.azJetzt, z = az && az.tage[wtag(f.datum)];
  const schon = d.ausnahmen.filter(a => a.datum === f.datum), pl = schon.length ? p.planIso(f.datum) : null;   // FE-0012
  return html`${GRIFF}<h3>Ausnahme</h3>
        <label class="feld">Tag${feld(f, 'datum', 'date', { marke: 'datum' }, () => p.neuZeichnen())}</label>
        <div class="leise">${wtag(f.datum)} ${kurzDatum(f.datum)} · laut Arbeitszeit ${z ? z.join('–') : 'frei'}</div>
        <div class="seg">${Object.entries(AUSNAHME).map(([k, t]) => html`<button data-v=${k} class=${f.art === k ? 'on' : ''} @click=${() => { f.art = k; p.neuZeichnen(); }}>${t}</button>`)}</div>
        ${f.art === 'frei' ? html`<div class="leise">An diesem Tag wird nicht geheizt, nur der Frostschutz läuft.</div>`
          : html`<div class="raster-2"><label class="feld">von${feld(f, 'von', 'time', {})}</label><label class="feld">bis${feld(f, 'bis', 'time', {})}</label></div>
          <div class="leise">Vorheizen ${d.e.vorheizen} min und Nachheizen ${d.e.nachheizen} min gelten auch hier – geheizt wird ${uhr(minu(f.von) - d.e.vorheizen)}–${uhr(minu(f.bis) + d.e.nachheizen)}.</div>`}
        ${!schon.length ? nothing : html`<div class="am-schon">An diesem Tag schon eingetragen: ${schon.map((a, i) => html`${i ? ', ' : ''}<b>${a.art === 'frei' ? 'frei' : `${a.von}–${a.bis}`}</b> ${AUSNAHME[a.art]}`)}<br>
            ${f.art === 'frei' ? '„Frei“ ersetzt alle Zeitfenster dieses Tages.' : 'Das neue Fenster kommt dazu – nichts wird überschrieben. Grenzt es an die Arbeitszeit, verlängert es sie (mit Vor-/Nachheizen); sonst heizt es genau seine Zeit.'}
            ${pl && f.art !== 'frei' ? html`<div class="am-strahl" style="margin-left:0">${unsafeHTML(p.zeitstrahl(pl))}</div><div class="leise">bisher: ${p.planFensterText(pl)}</div>` : nothing}</div>`}
        <label class="feld">Notiz${feld(f, 'notiz', null, { ph: 'z. B. Betonieren' })}</label>
        ${knopf('Speichern', p.nurAdmin(() => p.ausnahmeSpeichern()), 'amber nur-admin')}${knopf('Abbrechen', () => p.schliessen(), 'leise-k')}`;
}

export function arbeitszeitNeuEinblendung(p, s) {
  const d = p.d, f = s.form, aendern = f.alt_ab !== undefined, neu = () => p.neuZeichnen();
  const zeit = (t, i) => html`<input type="time" value=${f.tage[t][i]} .value=${live(f.tage[t][i])} data-azt=${t} data-p=${i} @input=${e => { f.tage[t][i] = e.target.value; }}>`;
  return html`${GRIFF}<h3>${aendern ? 'Arbeitszeit bearbeiten' : 'Neue Arbeitszeit'}</h3>
        <div class="raster-2"><label class="feld">Gilt ab${feld(f, 'ab', 'date', {})}</label><label class="feld">Name${feld(f, 'name', null, { ph: 'z. B. Winter' })}</label></div>
        ${TAGE.map(t => { const z = f.tage[t]; return html`<div class="zeile azn"><b class="tag-n">${t}</b>${schalterVorlage(!!z, () => { f.tage[t] = f.tage[t] ? null : [...(f.tage.Mo || ['07:00', '16:30'])]; neu(); })}
          ${z ? html`${zeit(t, 0)}<span class="leise">bis</span>${zeit(t, 1)}` : html`<span class="leise frei">frei</span>`}</div>`; })}
        <button class="zeile" @click=${() => { for (const t of ['Di', 'Mi', 'Do']) f.tage[t] = f.tage.Mo ? [...f.tage.Mo] : null; neu(); }}><span class="blau">Di–Do wie Montag</span></button>
        <div class="leise">${aendern ? 'Es gilt immer die jüngste Arbeitszeit, die schon begonnen hat.' : 'Die bisherige Arbeitszeit bleibt gespeichert. Liegt das Datum in der Zukunft, gilt die neue automatisch ab diesem Tag.'}
          ${d.arbeitszeiten.some(x => x.auto) ? ' Die automatisch angelegte Arbeitszeit fällt beim Speichern weg.' : ''}</div>
        ${knopf('Speichern', p.nurAdmin(() => p.azSpeichern()), 'amber nur-admin')}${knopf('Abbrechen', () => p.schliessen(), 'leise-k')}`;
}

/** Dialoge der Heizung (Art → Vorlage) */
export const HEIZUNG_EINBLENDUNGEN = { heizplan: heizplanEinblendung, az: arbeitszeitEinblendung, ausnahme: ausnahmeEinblendung, 'az-neu': arbeitszeitNeuEinblendung };
