// Entwicklung (Meldungen aus dem Melde-Knopf, Werkzeuge) mit Lit (BSM-022 Stufe 3a). Eigene Ansicht und – in Teilen –
// Gruppe „Entwicklung“ der Einstellungen (dort bis Stufe 3e als dauerhafter Lit-Bereich im alten v_einst).
import { html, nothing } from 'lit';
import { TICKET_STATUS } from '../tabellen.js';
import { kopfVorlage } from './allgemein.js';

const ART = { fehler: ['Fehler', 'rot-b'], wunsch: ['Wunsch', 'blau-b'], anregung: ['Anregung', 'gruen'] };

function meldungVorlage(p, m) {
  const letzte = (m.verlauf || []).filter(v => v.notiz || v.version).at(-1), art = ART[m.art] || ART.wunsch, offen = p.meldungOffen(m);
  return html`<div class="ml ${offen ? 'offen' : 'erledigt'}" data-meldung=${m.id}><div class="ml-kopf"><span><b class="ml-nr">${m.ticket || ''}</b> <span class="badge ${art[1]}">${art[0]}</span> <span class="badge st-${m.status}">${TICKET_STATUS[m.status] || m.status}</span></span><span class="leise">${p.meldungZeit(m)} · ${m.geraet || '–'} · v${m.version || '–'}</span></div>
          <div class="ml-text">${m.text}</div><div class="leise">📍 ${m.kontext || '–'}</div>
          ${(m.bilder || []).length ? html`<div class="ml-bilder">${m.bilder.map((_, i) => { const u = p.mlBild(m, i); return u ? html`<img src=${u} alt="Bild ${i + 1}" role="button" @click=${() => p.meldungBild(m.id, i)}>` : html`<span class="ml-bild-laedt"></span>`; })}</div>` : nothing}
          ${letzte ? html`<div class="leise ml-notiz">↳ ${letzte.von || ''}: ${[letzte.version ? 'v' + letzte.version : '', letzte.notiz || ''].filter(Boolean).join(' · ')}</div>` : nothing}
          <div class="wk-knoepfe"><button class="chip glas-panel ml-status" @click=${() => p.meldungStatus(m.id)}>${offen ? '✓ Schließen' : '↺ wieder öffnen'}</button><button class="chip glas-panel ml-weg" @click=${() => p.meldungWeg(m.id)}>Löschen</button></div></div>`;
}

/** teil: 'alle' (eigene Ansicht), 'meldungen' bzw. 'werkzeuge' (Gruppe in den Einstellungen, ohne Zurück und Kopf) */
export function devVorlage(p, { teil = 'alle' } = {}) {
  const f = p.s.mfilter || 'offen', alle = p.meldungen(), passt = m => f === 'alle' || (f === 'offen') === p.meldungOffen(m), M = (alle || []).filter(passt);
  const anzahl = k => !alle ? '' : k === 'alle' ? alle.length : alle.filter(m => (k === 'offen') === p.meldungOffen(m)).length;
  const filter = k => { p.s.mfilter = k; p.neuZeichnen(); };
  const meldungen = html`<div class="glas-panel block"><div class="block-kopf"><b>Meldungen</b><div class="seg klein">${[['offen', 'offen'], ['erledigt', 'erledigt'], ['alle', 'alle']].map(([k, t]) => html`<button class=${f === k ? 'on' : ''} @click=${() => filter(k)}>${t} ${anzahl(k)}</button>`)}</div></div>
        ${alle === null ? html`<div class="leer">Lädt …</div>` : M.length ? M.map(m => meldungVorlage(p, m)) : html`<div class="leer">Keine Meldungen</div>`}
        <div class="wk-knoepfe"><button class="chip glas-panel dev-md" @click=${() => p.meldungenKopieren()}>Als Markdown kopieren</button><button class="chip glas-panel dev-json" @click=${() => p.meldungenJson()}>Als JSON herunterladen</button></div>
        <div class="leise">Jede Meldung ist ein Ticket (FE Fehler, WU Wunsch, AN Anregung). In Claude Code mit „Tickets prüfen“ abarbeiten lassen – ist ein Ticket behoben und eingespielt, setzt Claude es auf erledigt. Passt es nicht, hier wieder öffnen.</div></div>`;
  const eigen = (p.changelog || []).find(c => c.version === p.version);
  const werkzeuge = html`<div class="glas-panel liste"><div class="gruppe">Werkzeuge</div>
        <button class="zeile dev-diagnose" @click=${() => p.diagnoseHerunterladen()}><span>Diagnose herunterladen</span><span class="chev">›</span></button>
        <div class="zeile"><span>Version</span><span class="leise">${p.version}${eigen ? ' · ' + (eigen.datum || '').slice(0, 7) : ''}</span></div></div>`;
  if (teil === 'meldungen') return meldungen;
  if (teil === 'werkzeuge') return werkzeuge;
  return html`<div class="zurueck-zeile"><button class="glas-panel chip" @click=${() => p.gehe('einst')}>‹ Einstellungen</button></div>
      ${kopfVorlage('Entwicklung', 'NUR FÜR DICH')}
      ${meldungen}
      ${werkzeuge}`;
}
