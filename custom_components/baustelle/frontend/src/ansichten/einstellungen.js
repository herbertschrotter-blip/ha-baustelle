// Einstellungen mit Lit (BSM-022 Stufe 3e; WU-0007, Mockup einstellungen-varianten.html Variante 1 „Seitenleiste“).
// Alle Einstellungen in Gruppen: links die Seitenleiste, auf dem Handy Chips oben. Jede Gruppe ist eine eigene Vorlage
// (vorher schnitt einstBlock() die Gruppen per Titelsuche aus einem HTML-Text). Die Heizung-Blöcke kommen aus heizung.js,
// „Entwicklung“ und „Über“ aus dev.js/ueber.js. Das Notprogramm bleibt bis zu seiner Lieferung HTML-Text der Seite.
import { html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { MONATE, datum, de, plusTage, zahl } from '../hilfen.js';
import { BEREICH_FARBEN, sigHtml } from '../symbole.js';
import { WETTER_TEXT } from '../tabellen.js';
import { kopfVorlage, schalterVorlage, stepperVorlage } from './allgemein.js';
import { HZ_BLOECKE } from './heizung.js';
import { devVorlage } from './dev.js';
import { ueberVorlage } from '../ueber.js';

const liste = (titel, inhalt) => html`<div class="glas-panel liste"><div class="gruppe">${titel}</div>${inhalt}</div>`;
const zeile = (t, x, sub = '') => html`<div class="zeile"><div><b>${t}</b>${sub ? html`<div class="leise">${sub}</div>` : nothing}</div>${x}</div>`;
const knopf = (t, wert, fn, cls = '') => html`<button class="zeile ${cls}" @click=${fn}><span>${t}</span><span class="leise">${wert} ›</span></button>`;

function baustelle(p) {
  const d = p.d, e = d.e, o = d.optionen, nm = x => x ? p.name(x) : '–', tk = o.termine_kalender || e.termine_kalender, auf = art => p.nurAdmin(() => p.einblenden(art));
  return html`<div class="glas-panel liste"><div class="gruppe">Baustelle</div>
        <button class="zeile nur-admin" @click=${auf('name')}><span>Name</span><span class="leise">${d.titel} ›</span></button>
        <button class="zeile nur-admin" @click=${auf('zeitraum-bs')}><span>Beginn und Ende</span><span class="leise">${p.bsZeit(d)} ›</span></button>
        <button class="zeile nur-admin" @click=${auf('zeitraum-bs')}><span>Heizperiode</span><span class="leise">${MONATE[d.hp[0] - 1]} – ${MONATE[d.hp[1] - 1]} ›</span></button>
        <button class="zeile" @click=${() => p.einblenden('abschliessen')}><span>Baustelle abschließen</span><span class="leise">kommt in den Verlauf ›</span></button>
        <button class="zeile nur-admin" @click=${auf('baustelle-neu')}><span class="blau">+ Neue Baustelle</span></button></div>
      ${liste('Wetter und Kalender', html`${knopf('Wetter', o.wetter ? nm(o.wetter) : 'keins gewählt', auf('wetterquelle'), 'nur-admin')}${knopf('Außentemperatur', o.temp_sensor ? nm(o.temp_sensor) : 'aus der Vorhersage', auf('wetterquelle'), 'nur-admin')}${knopf('Regenmenge', o.regen_sensor ? nm(o.regen_sensor) : 'aus der Vorhersage', auf('wetterquelle'), 'nur-admin')}${knopf('Urlaub', o.urlaub_kalender ? `Kalender „${nm(o.urlaub_kalender)}“` : 'kein Kalender', auf('wetterquelle'), 'nur-admin')}${knopf('Feiertage', o.feiertag_kalender ? nm(o.feiertag_kalender) : 'kein Kalender', auf('wetterquelle'), 'nur-admin')}${knopf('Termine (Bei Bedarf)', tk ? nm(tk) : 'kein Kalender', auf('wetterquelle'), 'nur-admin')}`)}`;
}

const heizung = p => html`${liste('Automatik', zeile('Automatik', schalterVorlage(p.d.e.auto, () => p.automatikUmschalten()), 'die Integration schaltet die Heizungen nach Plan und Regeln'))}${['regeln', 'trocknen', 'urlaub'].map(k => HZ_BLOECKE[k](p, 'glas-panel block'))}${liste('Zeiten', html`${knopf('Arbeitszeit', 'ändern, neue ab Datum', () => p.hzAuf('az'))}${knopf('Ausnahmen', 'einmalig', () => p.hzAuf('ausn'))}${knopf('Heizplan · diese Woche', 'ansehen', () => p.hzAuf('plan'))}`)}`;

const container = p => { const d = p.d; return html`<div class="glas-panel liste"><div class="gruppe">Container und Geräte</div>
        ${d.bereiche.map(b => html`<button class="zeile" data-id=${b.id} @click=${() => p.bereichEinst(b.id)}><span><i class="farbpunkt" style="background:${BEREICH_FARBEN[b.f % 6]}"></i>${b.name}</span><span class="leise">${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'} ›</span></button>`)}
        <button class="zeile nur-admin" @click=${p.nurAdmin(() => p.einblenden('container-neu'))}><span class="blau">+ Container oder Schacht</span></button></div>${HZ_BLOECKE.container(p, 'glas-panel block')}`; };

/* WU-0010: alle eingebundenen Geräte nach Funktion – Ort, Zustand, Batterie; Klick öffnet die Gerätewebsite
   (configuration_url), sonst die Geräteseite in HA (Links von der Integration: geraete_links) */
function geraeteListe(p) {
  const d = p.d, L = (d.r && d.r.geraete_links) || {}, o = d.optionen || {}, z = eid => p._hass && p._hass.states[eid];
  const weg = s => !s || s.state === 'unavailable' || s.state === 'unknown';
  let n = 0, offline = 0;
  const balken = sig => !sig || !zahl(sig.state) ? '' : sigHtml(+sig.state);   // AN-0009: Signal in 4 Strichen, Wert im Tooltip
  const zeileG = (eid, ic, ort, text, schlecht, marke = '') => {
    n++; if (schlecht) offline++;
    const l = L[eid] || {}, href = l.web || l.ha, bat = l.batterie && z(l.batterie), name = p.name(eid) || eid, s0 = z(eid);
    const seit = schlecht && s0 && s0.last_changed ? ` seit ${new Date(s0.last_changed).toLocaleTimeString('de-AT', { timeZone: d.z.zone, hour: '2-digit', minute: '2-digit' })}` : '';
    const inhalt = html`<span class="ger-ic">${ic}<i class="ger-punkt ${schlecht ? 'weg' : 'da'}" title=${schlecht ? 'nicht erreichbar – angemeldet, aber nicht gefunden (Stecker gezogen?)' : 'erreichbar'}></i></span><div><b>${name}</b>${unsafeHTML(marke)}<div class="leise">${ort}${l.modell ? ` · ${l.modell}` : ''}${l.web ? ' · Website' : ''}</div></div>
        <span class="ger-z ${schlecht ? 'rot-t' : ''}">${text}${seit}${bat && zahl(bat.state) ? ` · 🔋 ${de(+bat.state, 0)} %` : ''} ${schlecht ? '' : unsafeHTML(balken(l.signal && z(l.signal)))}</span>${href ? html`<span class="chev">↗</span>` : nothing}`;
    return href ? html`<a class="zeile ger" href=${href} target="_blank" rel="noopener" title=${l.web ? 'Website des Geräts öffnen' : 'Gerät in Home Assistant öffnen'}>${inhalt}</a>` : html`<div class="zeile ger">${inhalt}</div>`;
  };
  const wert = eid => { const s = z(eid); if (weg(s)) return ['meldet nichts', true]; const e = (s.attributes || {}).unit_of_measurement || '';
    return [zahl(s.state) ? `${de(+s.state)} ${e}` : s.state, false]; };
  const C = d.bereiche;
  const schalt = C.flatMap(b => b.geraete.map(g => zeileG(g.schalter, g.heizer ? '♨' : b.pumpe ? '💧' : '⏻', `${b.name} · ${g.typ}${g.aktiv ? '' : ' · inaktiv'}`,
    !g.erreichbar ? 'nicht erreichbar' : g.an ? `an · ${de(zahl(g.kwJetzt) ? g.kwJetzt : g.kw, 2)} kW` : 'aus', !g.erreichbar, p.npMarke(g))));
  const temp = [...C.filter(b => b.fuehler).map(b => { const [t, x] = wert(b.fuehler); return zeileG(b.fuehler, '🌡', b.name, t, x); }),
    ...(o.temp_sensor ? [(() => { const [t, x] = wert(o.temp_sensor); return zeileG(o.temp_sensor, '🌡', 'Außen', t, x); })()] : [])];
  const tuer = C.filter(b => b.tuer).map(b => { const s = z(b.tuer.eid); return zeileG(b.tuer.eid, '🚪', b.name, weg(s) ? 'meldet nichts' : s.state === 'on' ? 'offen' : 'zu', weg(s)); });
  const wetter = [o.wetter && zeileG(o.wetter, '☁', 'Wetter', weg(z(o.wetter)) ? 'meldet nichts' : WETTER_TEXT[z(o.wetter).state] || z(o.wetter).state, weg(z(o.wetter))),
    o.regen_sensor && (() => { const [t, x] = wert(o.regen_sensor); return zeileG(o.regen_sensor, '🌧', 'Regen', t, x); })()].filter(Boolean);
  const teil = (titel, zeilen) => zeilen.length ? html`<div class="glas-panel liste"><div class="gruppe">${titel} · ${zeilen.length}</div>${zeilen}</div>` : nothing;
  return { inhalt: html`${teil('Schaltgeräte', schalt)}${teil('Temperaturfühler', temp)}${teil('Türkontakte', tuer)}${teil('Wetter und Regen', wetter)}<div class="leise p-fuss">Tippen öffnet die Website des Geräts (z. B. die Shelly-Oberfläche); ohne Website die Geräteseite in Home Assistant.</div>`, n, offline };
}

function pumpen(p) {
  const st = (k, s, fmt) => stepperVorlage(p, k, s, fmt), P = p.d.bereiche.filter(b => b.pumpe);
  return liste('Überwachung der Pumpen', html`${zeile('Offline – melden nach', st('offline_min', 1, v => `${v} min`))}${zeile('Trockenlauf unter', st('trocken_w', 5, v => `${v} W`))}${zeile('Dauerlauf länger als', st('dauer_min', 5, v => `${v} min`))}${zeile('Schaltet oft ab', st('zyklen_h', 1, v => `${v} / h`))}${P.map(b => zeile(`♨ Automatik · ${b.name}`, schalterVorlage(b.auto, () => p.bereichAuto(b))))}`);
}

function strom(p) {
  const d = p.d, e = d.e, H = p.z.HEUTE, st = (k, s, fmt) => stepperVorlage(p, k, s, fmt);
  const L = (e.preise.length ? e.preise : [{ ab: null, preis: e.preis }]).slice().sort((a, b) => String(b.ab).localeCompare(String(a.ab))), jetzt = L.find(x => !x.ab || x.ab <= H);
  return html`<div class="glas-panel liste"><div class="gruppe">Strom</div>
        <div class="gruppe-t">Strompreis</div>${L.map((x, i) => { const bis = i && L[i - 1].ab ? plusTage(L[i - 1].ab, -1) : null;
      return html`<div class="sp-zeile"><b>${de(x.preis, 2)} €/kWh</b><span class="leise">${x === jetzt ? html`<span class="badge gruen">gilt jetzt</span> ` : x.ab > H ? html`<span class="badge blau-b">geplant</span> ` : nothing}${x.ab && x.ab > '2000-01-01' ? `ab ${datum(x.ab)}` : 'bisher'}${bis ? ` bis ${datum(bis)}` : ''}</span>
        ${L.length > 1 && x.ab ? html`<button class="x nur-admin" title="Preis löschen" @click=${p.nurAdmin(() => p.preisWeg(x.ab))}>✕</button>` : nothing}</div>`; })}
      <button class="zeile" @click=${() => p.preisNeu()}><span class="blau">+ Neuer Preis ab …</span></button>
      <div class="leise">Auswertung, Abrechnung nach Firma und CSV rechnen jeden Tag mit dem Preis, der an dem Tag galt. Ein neuer Preis ändert nichts an Vergangenem.</div>
        <div class="zeile"><div><b>⚡ Staffelung</b><div class="leise">verteilt die Heizungen auf den freien Strom – geschaltet werden nur Heizungen</div></div>${schalterVorlage(e.staffel, () => p.einstellungUmschalten('staffel'))}</div>
        ${e.staffel ? html`<div class="gruppe-t gt-einzug">Anschlüsse</div>
        ${d.anschluesse.map(a => html`<button class="zeile unter" data-id=${a.id} @click=${() => p.anschlussAuf(a.id)}><div><b>${a.name}</b><div class="leise">${a.phasen === 3 ? '3 × ' : ''}${a.ampere} A · Reserve ${de(a.reserve)} kW · ${d.bereiche.filter(b => b.anschluss === a.id).map(b => b.name).join(', ') || 'keine Container'}</div></div><span class="chev">›</span></button>`)}
        <button class="zeile unter" @click=${() => p.anschlussAuf()}><span class="blau">+ Anschluss hinzufügen</span></button>
        <div class="zeile unter"><div><span>Nutzbar je Anschluss</span><div class="leise">vorsichtig, weil unbekannt ist, welche Steckdose an welcher Phase hängt</div></div>${st('nutzbar', 5, v => `${v} %`)}</div>
        <div class="zeile unter"><span>Höchstens gleichzeitig</span>${st('max_gleich', 1, v => `${v} Heizk.`)}</div>
        <div class="zeile unter"><span>Mindestlaufzeit</span>${st('min_lauf', 1, v => `${v} min`)}</div>
        <div class="zeile unter"><span>Mindestpause</span>${st('min_pause', 1, v => `${v} min`)}</div>
        <div class="zeile unter"><div><span>Wechsel im Rundlauf</span><div class="leise">wenn nicht alle gleichzeitig dürfen</div></div>${st('takt', 5, v => `${v} min`)}</div>
        <div class="zeile unter"><span class="leise">Gesamtzähler: keiner – gerechnet wird mit den Shellys und der Reserve je Anschluss. Später kann je Anschluss ein Zähler dazukommen.</span></div>
        <div class="gruppe-t gt-einzug">Vorrang, wenn nicht alle dürfen</div>
        ${d.bereiche.filter(b => !b.pumpe).map(b => html`<div class="zeile unter"><span>${b.name}</span><div class="seg klein">${['niedrig', 'normal', 'hoch'].map(v => html`<button data-v=${v} class=${(b.prio || 'normal') === v ? 'on' : ''} @click=${() => p.vorrang(b, v)}>${v}</button>`)}</div></div>`)}
        <div class="leise p-fuss">Frostschutz geht immer vor. Pumpen und andere Verbraucher werden mitgezählt, aber nie geschaltet.</div>` : nothing}</div>`;
}

const firmen = p => { const d = p.d; return html`<div class="glas-panel liste"><div class="gruppe">Firmen · für die Abrechnung</div>
        ${d.firmen.map(f => { const n = d.bereiche.filter(b => (b.firma || 'eigen') === f.id).length;
          return html`<button class="zeile" data-id=${f.id} @click=${() => p.firmaAuf(f.id)}><span>${f.name}${f.eigen ? html` <span class="badge">eigene</span>` : nothing}</span><span class="leise">${n} Container ›</span></button>`; })}
        <button class="zeile" @click=${() => p.firmaAuf()}><span class="blau">+ Firma hinzufügen</span></button></div>`; };

function meldungen(p) {
  const e = p.d.e, st = (k, s, fmt) => stepperVorlage(p, k, s, fmt), sw = k => schalterVorlage(e[k], () => p.einstellungUmschalten(k));
  const m = (t, k) => html`<div class="zeile"><span>${t}</span>${sw(k)}</div>`;
  return html`<div class="glas-panel liste"><div class="gruppe">Meldungen · Störungen</div>
        <div class="zeile"><span>Empfänger</span><span class="leise">${e.empfaenger}</span></div>
        <div class="zeile"><div><b>Knöpfe in der Nachricht</b><div class="leise">direkt aus der Nachricht reagieren, z. B. „bis morgen stumm“</div></div>${sw('knoepfe')}</div>
        <button class="zeile" @click=${() => p.einblenden('nachrichten')}><span class="blau">Beispiele ansehen</span><span class="chev">›</span></button>
        <button class="zeile" @click=${() => p.testMeldung()}><span class="blau">Test-Nachricht senden</span></button>
        ${m(`Stromausfall / offline (nach ${de(e.offline_min, 0)} min)`, 'm_offline')}${m(`Pumpe Trockenlauf (unter ${de(e.trocken_w, 0)} W)`, 'm_trocken')}${m(`Pumpe Dauerlauf über ${e.dauer_min} min`, 'm_dauer')}${m(`Pumpe schaltet oft (ab ${e.zyklen_h} je Stunde)`, 'm_zyklen')}${m('Heizkörper zieht keinen Strom', 'm_leistung')}${m('Frostgefahr trotz Frostschutz', 'm_frost')}${m('Gerät schaltet sich selbst wieder ein (Auto-ON am Shelly?)', 'm_selbst')}
        <div class="gruppe">Hinweise</div>
        ${m(`Zu kalt trotz Heizung (nach ${e.kalt_min} min)`, 'm_kalt')}${m('Fühler meldet nichts / Batterie schwach', 'm_fuehler')}${m('Keine Wettervorhersage', 'm_wetter')}${m(`Handbetrieb länger als ${e.hand_h} h`, 'm_hand')}
        <div class="leise p-fuss">Störungen, offene Tür und langer Handbetrieb kommen aufs Handy, andere Hinweise nur ins Protokoll und in den Warnung-Chip.</div></div>
      ${liste('Schwellen der Hinweise', html`${zeile('Zu kalt trotz Heizung nach', st('kalt_min', 15, v => `${v} min`))}${zeile('Handbetrieb länger als', st('hand_h', 1, v => `${de(v)} h`))}${zeile('Tür offen – Nachricht nach', st('tuer_melden', 5, v => `${v} min`))}`)}`;
}

function bericht(p) {
  const e = p.d.e, sw = k => schalterVorlage(e[k], () => p.einstellungUmschalten(k));
  return html`<div class="glas-panel liste"><div class="gruppe">Bericht</div>
        <div class="zeile"><span>Wie oft</span><div class="seg klein">${[['aus', 'aus'], ['woche', 'Woche'], ['monat', 'Monat'], ['beides', 'beides']].map(([k, t]) => html`<button data-v=${k} class=${e.bericht === k ? 'on' : ''} @click=${() => p.einstellungWert('bericht', k)}>${t}</button>`)}</div></div>
        ${e.bericht !== 'aus' ? html`<div class="zeile unter"><span class="leise">${{ woche: 'jeden Montag 07:00 für die Vorwoche', monat: 'am 1. des Monats 07:00 für den Vormonat', beides: 'Montag 07:00 und am 1. des Monats' }[e.bericht] || ''}</span></div>
        <div class="zeile unter"><span>📱 aufs Handy</span>${sw('bericht_handy')}</div>
        <div class="zeile unter"><span>✉ per E-Mail</span>${sw('bericht_mail')}</div>
        ${e.bericht_mail ? html`<label class="zeile unter"><span>an</span><input type="email" value=${e.mail} .value=${e.mail} class="mail-feld nur-admin" @change=${p.nurAdmin(ev => p.mailSetzen(ev.target.value))}></label>
        <div class="zeile unter"><span>Abrechnung als CSV anhängen</span>${sw('bericht_csv')}</div>
        <div class="zeile unter"><span class="leise">über den Dienst notify.${e.mail_dienst || 'baustelle_mail'} (z. B. Google Mail oder SMTP in HA eingerichtet)</span></div>` : nothing}
        <button class="zeile" @click=${() => p.einblenden('bericht')}><span class="blau">Beispiel ansehen</span><span class="chev">›</span></button>
        <button class="zeile" @click=${() => p.berichtSenden()}><span class="blau">Jetzt senden</span></button>` : nothing}</div>`;
}

const ansicht = p => { const e = p.d.e; return liste('Ansicht', html`${zeile('Erklärungen anzeigen', schalterVorlage(e.erklaer, () => p.einstellungUmschalten('erklaer')), 'kurze Texte „ⓘ“ unter Heizung, Pumpen und Auswertung')}${zeile('Melden-Knopf', schalterVorlage(e.melden, () => p.einstellungUmschalten('melden')), 'kleiner Knopf in jedem Fenster für Fehler, Wünsche und Anregungen')}<button class="zeile" @click=${() => p.awVorlageWahl('misch')}><span>Auswertung auf Vorschlag zurücksetzen</span><span class="leise">gilt für diesen Browser</span></button>`); };

function entwicklung(p) {
  const dev = (p.s.evDev || 'meldungen') === 'meldungen', setze = k => { p.s.evDev = k; p.neuZeichnen(); };
  return html`<div class="seg ev-dev-reiter">${[['meldungen', 'Meldungen'], ['werkzeuge', 'Werkzeuge']].map(([k, t]) => html`<button data-v=${k} class=${(dev ? 'meldungen' : 'werkzeuge') === k ? 'on' : ''} @click=${() => setze(k)}>${t}</button>`)}</div>
    ${dev ? devVorlage(p, { teil: 'meldungen' }) : html`${devVorlage(p, { teil: 'werkzeuge' })}${liste('Für Tests', html`<button class="zeile" @click=${() => p.testMeldung()}><span class="blau">Test-Nachricht senden</span></button><button class="zeile" @click=${() => p.einblenden('nachrichten')}><span>Beispiel-Nachrichten</span><span class="chev">›</span></button>`)}`}`;
}

/* Gruppen: Schlüssel, Symbol, Titel, Kurzwert, Inhalt */
function gruppen(p) {
  const d = p.d, e = d.e, M = p.meldungen(), P = d.bereiche.filter(b => b.pumpe), C = d.bereiche.filter(b => !b.pumpe), geraete = d.bereiche.reduce((a, b) => a + b.geraete.length, 0);
  const mAn = ['m_offline', 'm_trocken', 'm_dauer', 'm_zyklen', 'm_leistung', 'm_frost', 'm_selbst', 'm_kalt', 'm_fuehler', 'm_wetter', 'm_hand'].filter(k => e[k]).length;
  const offen = M === null ? '–' : M.filter(m => p.meldungOffen(m)).length, np = p.npGruppe(), gl = geraeteListe(p);
  return [
    { k: 'baustelle', ic: '🏗', t: 'Baustelle', kurz: `${d.titel} · ${p.bsZeit(d)}`, inhalt: () => baustelle(p) },
    { k: 'heizung', ic: '🔥', t: 'Heizung', kurz: `Automatik ${e.auto ? 'an' : 'aus'} · Soll ${de(e.soll)} °C · Vorheizen ${e.vorheizen} min`, inhalt: () => heizung(p) },
    { k: np.k, ic: np.ic, t: np.t, kurz: np.kurz, inhalt: () => unsafeHTML(np.html) },   // Notprogramm: HTML-Text bis zur eigenen Lieferung (3e)
    { k: 'container', ic: '🏠', t: 'Container & Geräte', kurz: `${C.length} Container · ${P.length} ${P.length === 1 ? 'Schacht' : 'Schächte'} · ${geraete} Geräte`, inhalt: () => container(p) },
    { k: 'geraete', ic: '🔌', t: 'Geräte', kurz: `${gl.n} Geräte${gl.offline ? ` · ${gl.offline} meldet nichts` : ' · alle erreichbar'}`, inhalt: () => gl.inhalt },
    { k: 'pumpen', ic: '💧', t: 'Pumpen', kurz: P.length ? `offline nach ${e.offline_min} min · Trockenlauf unter ${e.trocken_w} W` : 'keine Schächte', inhalt: () => pumpen(p) },
    { k: 'strom', ic: '⚡', t: 'Strom & Staffelung', kurz: `${de(e.preis, 2)} €/kWh · Staffelung ${e.staffel ? 'an' : 'aus'}`, inhalt: () => strom(p) },
    { k: 'firmen', ic: '🏢', t: 'Firmen', kurz: `${d.firmen.length} ${d.firmen.length === 1 ? 'Firma' : 'Firmen'} für die Abrechnung`, inhalt: () => firmen(p) },
    { k: 'meldungen', ic: '🔔', t: 'Meldungen', kurz: `${mAn} von 11 an${e.empfaenger ? ` · ${e.empfaenger}` : ''}`, inhalt: () => meldungen(p) },
    { k: 'bericht', ic: '📊', t: 'Bericht', kurz: { aus: 'aus', woche: 'jede Woche', monat: 'jeden Monat', beides: 'Woche und Monat' }[e.bericht] || e.bericht, inhalt: () => bericht(p) },
    { k: 'app', ic: '🖥', t: 'Ansicht', kurz: `Erklärungen ${e.erklaer ? 'an' : 'aus'} · Melden-Knopf ${e.melden ? 'an' : 'aus'}`, inhalt: () => ansicht(p) },
    { k: 'dev', ic: '🛠', t: 'Entwicklung', kurz: `${offen} offene Meldungen · Diagnose`, dev: true, inhalt: () => entwicklung(p) },
    { k: 'ueber', ic: 'ℹ', t: 'Über', kurz: `Version ${p.version}`, inhalt: () => ueberVorlage(p, { mitZurueck: false }) },
  ];
}

export function einstellungenVorlage(p) {
  const G = gruppen(p), g = G.find(x => x.k === p.s.evGruppe) || G[0], schmal = p.narrow, wahl = k => () => p.einstGruppeWahl(k);
  const nav = html`<nav class="ev-nav glas-panel">${G.map(x => html`${x.dev ? html`<div class="ev-trenn"></div>` : nothing}<button data-v=${x.k} class=${x === g ? 'on' : ''} @click=${wahl(x.k)}><span class="ev-ic">${x.ic}</span><span>${x.t}</span><small>${x.kurz}</small></button>`)}</nav>`;
  const chips = html`<div class="ev-chips">${G.map(x => html`<button class="glas-panel chip ${x === g ? 'amber' : ''}" data-v=${x.k} @click=${wahl(x.k)}>${x.ic} ${x.t}</button>`)}</div>`;
  return html`${kopfVorlage('Einstellungen', p.d.titel)}<div class=${schmal ? 'schmal' : ''}>${schmal ? chips : nothing}<div class="ev-sl">${schmal ? nothing : nav}
      <div class="ev-inhalt"><div class="ev-titel"><span class="ev-ic">${g.ic}</span><div><b>${g.t}</b><div class="leise">${g.kurz}</div></div></div>${g.inhalt()}</div></div></div>`;
}
