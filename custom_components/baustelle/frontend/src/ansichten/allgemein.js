// Allgemeine Ansichten der Seite „Baustelle“ mit Lit (BSM-022 Stufe 3a): Laden, Fehler, keine laufende Baustelle; Kopf.
import { html, nothing } from 'lit';

/** Kopf einer Ansicht (wie BaustellePanel.kopf, als Vorlage) */
export const kopfVorlage = (titel, klein, rechts = nothing) => html`<div class="glas-kopf glas-panel"><div><div class="glas-klein">${klein}</div><div class="glas-titel">${titel}</div></div>${rechts}</div>`;

/** Integration noch nicht geantwortet (Lädt …) oder Fehler */
export const ladenVorlage = fehler => html`<div class="glas-panel block">${fehler ? html`<div class="leer">Die Integration antwortet nicht: ${fehler}</div>` : html`<div class="leer">Lädt …</div>`}</div>`;

/** Keine laufende Baustelle */
export const leerVorlage = p => html`${kopfVorlage('Baustelle', 'KEINE LAUFENDE BAUSTELLE')}
      <div class="glas-panel liste"><div class="zeile"><span class="leise">Lege eine Baustelle an – danach kommen Container und Shellys dazu.</span></div>
        <button class="zeile" @click=${() => p.einblenden('baustelle-neu')}><span class="blau">+ Neue Baustelle</span></button>
        ${p.alle.length ? html`<button class="zeile" @click=${() => p.gehe('verlauf')}><span>Abgeschlossene Baustellen</span><span class="chev">›</span></button>` : nothing}</div>`;

/** Ein/Aus-Schalter (wie hilfen.schalter, als Vorlage); die Nur-Lesen-Sperre greift über die Klasse `.sw` */
export const schalterVorlage = (on, fn) => html`<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked=${!!on} @click=${fn}><i></i></button>`;

/** − Wert + für eine Einstellung der Baustelle (wie BaustellePanel.stepper); data-k/data-d nur als Test-Merkmal */
export const stepperVorlage = (p, k, d, fmt) => html`<span class="stepper"><button data-k=${k} data-d=${-d} @click=${() => p.stufeSchritt(k, -d)}>−</button><b>${fmt(p.d.e[k])}</b><button data-k=${k} data-d=${d} @click=${() => p.stufeSchritt(k, d)}>+</button></span>`;
