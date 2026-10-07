// Notprogramm in den Plugs mit Lit (BSM-022 Stufe 3e, zuletzt; BSM-018/019/021): Gruppe der Einstellungen und
// Einzelheiten je Heizungs-Plug. Zustand, Programm, Kopplungen und Probe-Ergebnis kommen fertig von der Integration
// (laufzeit.geraete.<id>.notprogramm); die Seite zeigt nur an.
import { html, nothing } from 'lit';
import { de, zahl } from '../hilfen.js';
import { schalterVorlage } from './allgemein.js';

const GRIFF = html`<div class="griff"></div>`;
const knopf = (t, fn, art = '') => html`<button class="knopf ${art}" @click=${fn}>${t}</button>`;

/* Zustand eines Plugs als Chip */
const chip = (p, np) => ({ bereit: html`<span class="gruen-t">✓ bereit</span>`, not: html`<span class="amber-t">⚠ Notbetrieb seit ${p.npZeit(np.notbetrieb_seit, false)}</span>`,
  fehler: html`<span class="rot-t">✕ ${np.fehler || 'Fehler'}</span>`, offen: html`<span class="leise">noch nicht geprüft</span>`, aus: html`<span class="leise">aus</span>` }[np.zustand] || nothing);

/** Gruppe „Notprogramm“ der Einstellungen: { k, ic, t, kurz, inhalt } */
export function npGruppeVorlage(p) {
  const d = p.d, P = p.npPlugs(), an = !!d.e.notprogramm, fehler = P.filter(x => x.np.zustand === 'fehler').length, not = P.filter(x => x.np.zustand === 'not').length;
  const kurz = !an ? 'aus' : not ? `${not} im Notbetrieb` : fehler ? `${fehler} mit Fehler` : `${P.length} ${P.length === 1 ? 'Plug' : 'Plugs'} bereit`;
  const zeile = x => html`<button class="zeile" data-id=${x.g.id} @click=${() => p.npPlugAuf(x.g.id)}><div><b>🛟 ${p.name(x.g.schalter) || x.g.n}</b><div class="leise">${x.b.name}${an ? ` · im Notbetrieb: ${p.npModus(x.np)}${x.np.tuer ? ' · Tür' : ''}` : ''}${an && x.np.fuehler_fehlt ? html` · <span class="amber-t">Fühler nicht am Plug – im Notbetrieb nur Zeitplan</span>` : nothing}</div></div>
      <span class="ger-z">${chip(p, x.np)}${an && x.np.bis ? html`<div class="leise">Programm bis ${p.npZeit(x.np.bis)}</div>` : nothing}</span><span class="chev">›</span></button>`;
  const inhalt = () => html`<div class="glas-panel liste"><div class="gruppe">Notprogramm in den Plugs</div>
        <div class="zeile"><div><b>Notprogramm</b><div class="leise">Fällt Home Assistant oder das Netz aus, heizen die Plugs nach dem Programm der nächsten 7 Tage weiter – nach 15 min ohne Lebenszeichen</div></div>${schalterVorlage(an, () => p.einstellungUmschalten('notprogramm'))}</div>
        ${an ? html`<div class="zeile"><div><b>Taste am Plug = 1 h heizen</b><div class="leise">Drücken heizt den Container 1 h (mit Fühler bis zum Soll), nochmal drücken beendet – auch ohne Home Assistant. Die Automatik übernimmt danach das Relais (kein Handbetrieb).</div></div>${schalterVorlage(d.e.taste, () => p.einstellungUmschalten('taste'))}</div>` : nothing}
        ${an ? html`<button class="zeile" @click=${() => p.npPruefen()}><div><span class="blau">${p.s.npPrueft ? '⟳ prüft …' : '⟳ Jetzt prüfen'}</span><div class="leise">Skript, Kopplungen, Programm und Lebenszeichen an allen Plugs – sonst alle 5 min von selbst</div></div><span class="leise">zuletzt ${p.npVor(d.np && d.np.geprueft)}</span></button>` : nothing}</div>
      <div class="glas-panel liste"><div class="gruppe">Heizungs-Plugs · ${P.length}</div>${P.length ? P.map(zeile) : html`<div class="leer">Keine Heizkörper an Shelly-Plugs (Gen2 oder neuer)</div>`}</div>
      ${an && fehler ? html`<div class="glas-panel liste"><div class="zeile"><div><b class="rot-t">⚠ ${fehler === 1 ? 'Ein Plug nimmt' : `${fehler} Plugs nehmen`} das Programm nicht an</b><div class="leise">Fällt Home Assistant jetzt aus, heizt er nach dem zuletzt geladenen Programm bzw. danach nur Frostschutz. Nach 15 min auch unter Warnungen.</div></div></div></div>` : nothing}
      <div class="leise p-fuss">Im Notbetrieb gilt: kein Lernen, keine Heizgrenze, keine Staffelung – Thermostat nur, wenn der Fühler am Plug gekoppelt ist (die Integration koppelt Fühler und Tür des Containers selbst).</div>`;
  return { k: 'notprogramm', ic: '🛟', t: 'Notprogramm', kurz, inhalt };
}

/** Einzelheiten eines Plugs (Art „np-plug“) mit Ausfall-Probe (BSM-021) */
export function npPlugEinblendung(p, s) {
  const x = p.npPlugs().find(y => y.g.id === s.id); if (!x) return html`${GRIFF}<div class="leer">Plug nicht gefunden</div>${knopf('Schließen', () => p.schliessen())}`;
  const np = x.np, z = (t, w) => html`<div class="zeile"><span>${t}</span><span class="leise">${w}</span></div>`;
  const frost = zahl(np.frost_ein) ? `ein unter ${de(np.frost_ein)} °C, aus ab ${de(np.frost_aus)} °C` : 'aus', an = p.d.e.notprogramm;
  return html`${GRIFF}<div class="block-kopf"><h3>🛟 ${p.name(x.g.schalter) || x.g.n}</h3></div><div class="leise" style="padding:0 4px 8px">${x.b.name}</div>
      <div class="glas-panel liste">${z('Zustand', chip(p, np))}${z('Skript', np.version ? `Version ${np.version} · läuft` : '–')}${z('Programm', np.bis ? `gültig bis ${p.npZeit(np.bis)} · geladen` : np.programm ? 'geladen · ohne Heizzeit in den nächsten 7 Tagen' : '–')}
        ${z('Im Notbetrieb', p.npModus(np))}${z('Frostschutz', frost)}${z('Fühler am Plug', np.fuehler ? `Messwert Nr. ${np.fuehler}` : np.fuehler_fehlt ? html`<span class="amber-t">keiner – Zeitplan</span>` : '–')}
        ${z('Tür am Plug', np.tuer ? `✓ Messwert Nr. ${np.tuer}` : '–')}${z('Letzte Prüfung', p.npVor(np.zuletzt))}</div>
      <div class="glas-panel liste"><div class="gruppe">Notbetrieb</div>${np.zustand === 'not' ? z('läuft seit', `${p.npZeit(np.notbetrieb_seit)} · Home Assistant meldet sich nicht`) : nothing}
        ${z('zuletzt', np.notbetrieb_zuletzt ? `${p.npZeit(np.notbetrieb_zuletzt[0])} – ${p.npZeit(np.notbetrieb_zuletzt[1], false)}` : 'noch nie (seit dem Start von Home Assistant)')}</div>
      ${an ? html`<div class="glas-panel liste"><div class="gruppe">Ausfall-Probe</div>
        <div class="zeile"><div class="leise">Home Assistant schickt dem Plug so lange kein Lebenszeichen und schaltet ihn nicht – nach 15 min übernimmt das Notprogramm. Danach vergleicht HA das Stundenbuch mit der eigenen Messung.</div></div>
        ${np.probe_bis ? html`<div class="zeile"><span class="amber-t">⚗ Probe läuft bis ${p.npZeit(np.probe_bis, false)}</span><button class="knopf klein" data-min="0" @click=${() => p.npProbe(x.g.id, 0)}>Beenden</button></div>`
          : html`<div class="zeile"><span>Probe starten</span><div class="seg klein">${[30, 60, 120, 180].map(m => html`<button data-min=${m} @click=${() => p.npProbe(x.g.id, m)}>${m < 60 ? m + ' min' : m / 60 + ' h'}</button>`)}</div></div>`}
        ${np.probe_ergebnis ? (e => z('Letzte Probe', `${p.npZeit(e.von)} – ${p.npZeit(e.bis, false)} · Stundenbuch ${de(e.buch_kwh, 2)} kWh, ${e.buch_min} min · HA ${de(e.ha_kwh, 2)} kWh, ${e.ha_min} min`))(np.probe_ergebnis) : nothing}</div>` : nothing}
      ${an ? knopf(p.s.npPrueft ? '⟳ prüft …' : '⟳ Jetzt prüfen', () => p.npPruefen()) : nothing}${knopf('Schließen', () => p.schliessen())}`;
}
