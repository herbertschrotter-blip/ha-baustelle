// BSM-034.05: Vorschlag „Geräte zusammenführen“ in drei Varianten auf Basis des Master-Mockups (docs/bauplan-geraete.md §5 .05).
// Baut mockups/geraete.html: node mockups/quelle/geraete.js   ·   prüfen: node mockups/quelle/vorschau/pruefen.cjs mockups/geraete.html
//
// Alle Varianten zeigen dasselbe (Bauplan §5): eine Liste aller Geräte und Sensoren mit einheitlichen Symbolen und Zählern,
// Warnungen am Gerät, Batterie und Signal; ein Gerätedialog statt drei (✎ im Container, ✎ in Bearbeiten, Inventar –
// überall derselbe; alles erst bei „Speichern“, Herbert 09.10.2026). Unterschied ist der Ort:
//   1 Einstellungen-Gruppe „🔌 Geräte“ mit Reitern Übersicht / Inventar (ersetzt › Geräte und › 📦 Inventar)
//   2 Eigener Reiter oben „Geräte“ (Übersicht / Inventar), Einstellungen ohne Geräte und Inventar
//   3 Im Container: Abschnitt „Geräte und Sensoren“ mit Batterie/Signal/Warnungen; Einstellungen › Geräte nur noch Probleme
// Daten: echte Seite mit Beispieldaten (Bereiche, Geräte, Sensorliste, Warnungen); Batterie/Signal, wo die Beispieldaten
// keine haben, als Beispielwerte. Keine echten MACs, Koordinaten, Tokens.
// Bilder: node mockups/quelle/geraete.js --bilder <ordner>
const rahmen = require('./rahmen');

/* Läuft nur im Browser (als Text eingesetzt, Node führt es nie aus) */
function browser(R) {
  const { html, nothing } = R;
  const G = window.GER = { v: 1, lage: 'normal', reiter: 'uebersicht', filter: 'alle', gruppe: 'container' };
  const IC = { heizung: '♨', trockner: '💨', pumpe: '💧', steckdose: '🔌', fuehler: '🌡', tuer: '🚪', fenster: '🪟', licht: '💡' };
  const ST_TEXT = { aktiv: 'aktiv', inaktiv: 'inaktiv', verliehen: 'verliehen', defekt: 'defekt' };
  const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const zahl = x => x !== null && x !== undefined && x !== '' && !isNaN(+x);

  /* ---------- eine Liste: Schaltgeräte und Sensoren, je mit Zustand, Batterie, Signal, Warnungen ---------- */
  function liste(p) {
    const d = p.d, L = (d.r && d.r.geraete_links) || {}, st = eid => p._hass && p._hass.states[eid];
    const wert = eid => { const s = eid && st(eid); return s && zahl(s.state) ? +s.state : null; };
    const aus = [];
    for (const b of d.bereiche) {
      for (const g of b.geraete) {
        const l = L[g.schalter] || {}, sig = wert(l.signal) ?? -52 - hash(g.id) % 34;
        const w = d.warnungen.filter(x => x.g === g.id);
        const aus_ = G.lage === 'probleme' && g === b.geraete[0] && !b.pumpe && b === d.bereiche.find(x => !x.pumpe && x.geraete.length);
        if (aus_) w.push({ art: 'offline', stufe: 'stoerung', titel: `${g.n} nicht erreichbar`, hilfe: 'Shelly antwortet nicht. Stecker und Sicherung prüfen.' });
        aus.push({ art: 'schalt', id: g.id, b, g, ic: IC[g.rolle] || (g.heizer ? '♨' : '🔌'), name: g.n, unter: `${g.typ}${g.np ? ' · 🛟 Notprogramm' : ''}`,
          zustand: !g.erreichbar || aus_ ? 'nicht erreichbar' : g.an ? `an · ${(+(g.kwJetzt ?? g.kw)).toFixed(2).replace('.', ',')} kW` : 'aus',
          weg: !g.erreichbar || (G.lage === 'probleme' && w.some(x => x.art === 'offline')), status: g.status || 'aktiv', bat: null, sig, w, eid: g.schalter });
      }
      for (const s of b.sensoren || []) {
        const l = L[s.entity_id] || {}, z = st(s.entity_id);
        let bat = s.batterie ?? wert(l.batterie);
        if (bat === null && s.art !== 'licht') bat = [87, 62, 41, 95, 74][hash(s.entity_id) % 5];
        if (G.lage === 'probleme' && s.art === 'tuer') bat = 8;
        const w = d.warnungen.filter(x => x.key && x.key.endsWith(':' + s.entity_id));
        if (bat !== null && bat < 10) w.push({ art: 'fuehler_fehlt', stufe: 'hinweis', titel: `${s.name}: Batterie schwach, ${bat} %`, hilfe: 'Batterie tauschen – sonst meldet der Sensor bald nichts mehr.' });
        const leer = !z || z.state === 'unavailable' || z.state === 'unknown';
        aus.push({ art: 'sensor', id: s.entity_id, b, s, ic: IC[s.art] || '•', name: s.name, unter: (p.name && p.name(s.entity_id)) || s.entity_id,
          zustand: leer ? 'meldet nichts' : s.art === 'fuehler' ? `${(+z.state).toFixed(1).replace('.', ',')} °C` : s.art === 'licht' ? (z.state === 'on' ? 'an' : 'aus') : z.state === 'on' ? 'offen' : 'zu',
          weg: leer, status: 'aktiv', bat, sig: wert(l.signal) ?? -60 - hash(s.entity_id) % 30, w, eid: s.entity_id });
      }
    }
    return aus;
  }
  const zaehler = X => ({ n: X.length, weg: X.filter(x => x.weg).length, warn: X.filter(x => x.w.length).length,
    bat: X.filter(x => x.bat !== null && x.bat < 10).length, inaktiv: X.filter(x => x.status !== 'aktiv').length });
  const balken = db => { const n = db >= -55 ? 4 : db >= -67 ? 3 : db >= -78 ? 2 : 1;
    return html`<span class="g-sig" title="Signal ${db} dBm">${[1, 2, 3, 4].map(k => html`<i class=${k <= n ? 'an' : ''}></i>`)}</span>`; };
  const batterie = b => b === null ? nothing : html`<span class=${b < 10 ? 'rot-t' : b < 25 ? 'amber-t' : 'leise'} title="Batterie">🔋 ${b} %</span>`;

  /* ---------- Zeile und Zähler (überall gleich) ---------- */
  const zeile = (p, x, mitOrt = true) => html`<button class="zeile g-zeile ${x.weg ? 'weg' : ''}" data-id=${x.id} @click=${() => R.auf(p, { art: 'g-dialog', id: x.id, zurueck: p.s.sheet })}>
      <span class="g-ic">${x.ic}<i class="g-punkt ${x.weg ? 'weg' : 'da'}"></i></span>
      <div class="g-t"><b>${x.name}${x.status !== 'aktiv' ? html` <span class="g-st ${x.status}">${ST_TEXT[x.status]}</span>` : nothing}</b>
        <div class="leise">${mitOrt ? `${x.b.name} · ` : ''}${x.unter}</div>
        ${x.w.map(w => html`<div class="g-w ${w.stufe}">⚠ ${w.titel}</div>`)}</div>
      <span class="g-z"><span class=${x.weg ? 'rot-t' : ''}>${x.zustand}</span><span class="g-z2">${batterie(x.bat)} ${x.weg ? nothing : balken(x.sig)}</span></span><span class="chev">›</span></button>`;
  const zahlen = Z => html`<div class="g-zahlen">
      <span class="chip glas-panel">${Z.n} Geräte</span>
      <span class="chip glas-panel ${Z.weg ? 'rot-t' : ''}">● ${Z.n - Z.weg} erreichbar${Z.weg ? ` · ${Z.weg} nicht` : ''}</span>
      ${Z.warn ? html`<span class="chip glas-panel amber-t">⚠ ${Z.warn} mit Warnung</span>` : nothing}
      ${Z.bat ? html`<span class="chip glas-panel rot-t">🔋 ${Z.bat} Batterie schwach</span>` : nothing}
      ${Z.inaktiv ? html`<span class="chip glas-panel">${Z.inaktiv} nicht aktiv</span>` : nothing}</div>`;
  const FILTER = [['alle', 'Alle'], ['schalt', 'Schaltgeräte'], ['sensor', 'Sensoren'], ['probleme', 'Probleme']];
  const gefiltert = X => X.filter(x => G.filter === 'alle' || (G.filter === 'probleme' ? x.weg || x.w.length || x.status !== 'aktiv' : x.art === G.filter));

  function uebersicht(p) {
    const X = liste(p), F = gefiltert(X), z = () => R.neuAlle();
    const nachC = p.d.bereiche.map(b => [b, F.filter(x => x.b === b)]).filter(([, l]) => l.length);
    return html`${zahlen(zaehler(X))}
      <div class="seg glas-panel g-filter">${FILTER.map(([k, t]) => html`<button data-v=${k} class=${G.filter === k ? 'on' : ''} @click=${() => { G.filter = k; z(); }}>${t}</button>`)}</div>
      ${nachC.map(([b, l]) => html`<div class="glas-panel liste"><div class="gruppe g-gruppe"><span>${b.pumpe ? '💧' : '🏠'} ${b.name}</span>
          <span class="leise">${l.length}${p.invDaten && G.v !== 3 ? html` · <a class="blau" @click=${() => G.v === 3 ? p.containerOeffnen(b.id) : p.containerOeffnen(b.id)}>Container ›</a>` : nothing}</span></div>
        ${l.map(x => zeile(p, x, false))}</div>`)}
      ${nachC.length ? nothing : html`<div class="leer glas-panel">Keine Geräte in diesem Filter</div>`}
      <div class="leise p-fuss">Ein Gerät antippen: alles zu Gerät oder Sensor an einer Stelle – Zustand, Warnungen, Status, Einstellungen, Inventar.</div>`;
  }
  function inventar(p) {
    const I = p.invDaten && p.invDaten();
    if (!I) return html`<div class="leer glas-panel">Inventar lädt …</div>`;
    return html`<div class="glas-panel liste"><div class="gruppe">Container im Inventar · ${I.container.filter(c => c.status === 'aktiv').length}</div>
      ${I.container.filter(c => c.status === 'aktiv').map(c => html`<button class="zeile" @click=${() => p.invAuf({ art: 'inv-container', id: c.id })}>
        <div><b class="inv-id">${c.name}</b><div class="leise">${c.art_label} · ${c.ausruestung.length} Ausrüstung${c.nicht_in_ha ? ` · ${c.nicht_in_ha} nicht in HA` : ''}</div></div><span class="chev">›</span></button>`)}</div>
      <div class="leise p-fuss">Wie bisher unter › 📦 Inventar (Container, Ausrüstung, Namen prüfen, Zuordnen) – hier nur als zweiter Reiter neben der Übersicht.</div>`;
  }
  const reiterLeiste = (p) => html`<div class="seg glas-panel g-reiter">${[['uebersicht', 'Übersicht'], ['inventar', '📦 Inventar']].map(([k, t]) =>
    html`<button data-v=${k} class=${G.reiter === k ? 'on' : ''} @click=${() => { G.reiter = k; R.neuAlle(); }}>${t}</button>`)}</div>`;
  const geraeteSeite = p => html`${R.band('Variante ' + G.v)}${reiterLeiste(p)}${G.reiter === 'inventar' ? inventar(p) : uebersicht(p)}`;

  /* ---------- Variante 1: Einstellungen-Gruppe „Geräte“ (ersetzt › Geräte und › 📦 Inventar) ---------- */
  R.gruppeWeg({ k: 'geraete', wann: () => G.v === 1 || G.v === 2 });   // V1/V2 ersetzen › Geräte und › 📦 Inventar
  R.gruppeWeg({ k: 'inventar', wann: () => G.v === 1 || G.v === 2 });
  R.gruppeWeg({ k: 'geraete', wann: () => G.v === 3 });                 // V3: › Geräte wird „nur Probleme“
  R.gruppe({ k: 'g-geraete', ic: '🔌', t: 'Geräte', marke: true, nach: 'container', wann: () => G.v === 1,
    kurz: p => { const Z = zaehler(liste(p)); return `${Z.n} · ${Z.weg ? Z.weg + ' nicht erreichbar' : 'alle erreichbar'}`; }, inhalt: geraeteSeite });
  /* ---------- Variante 2: eigener Reiter oben ---------- */
  R.reiter({ k: 'g-geraete', t: 'Geräte', tKurz: '🔌', nach: 'verlauf', wann: () => G.v === 2, inhalt: p => html`<div class="g-seite">${geraeteSeite(p)}</div>` });
  /* ---------- Variante 3: im Container, Einstellungen nur Probleme ---------- */
  R.abschnitt({ ansicht: 'container', wann: p => G.v === 3 && p.b, nach: p => {
    const X = liste(p).filter(x => x.b === p.b), Z = zaehler(X);
    return html`<div class="glas-panel liste g-abschnitt">${R.band('Variante 3')}<div class="gruppe g-gruppe"><span>Geräte und Sensoren · ${X.length}</span>
        <span class="leise">${Z.weg ? html`<span class="rot-t">${Z.weg} nicht erreichbar</span>` : 'alle erreichbar'}${Z.bat ? html` · <span class="rot-t">🔋 ${Z.bat}</span>` : nothing}</span></div>
      ${X.map(x => zeile(p, x, false))}
      <button class="zeile nur-admin" @click=${() => R.auf(p, { art: 'g-dialog', neu: true, bid: p.b.id })}><span class="blau">+ Gerät oder Sensor</span></button></div>`; } });
  R.gruppe({ k: 'g-probleme', ic: '🔌', t: 'Geräte', marke: true, nach: 'container', wann: () => G.v === 3,
    kurz: p => { const Z = zaehler(liste(p)); return Z.weg + Z.bat ? `${Z.weg + Z.bat} Probleme` : 'alles in Ordnung'; },
    inhalt: p => { const X = liste(p), P = X.filter(x => x.weg || x.w.length);
      return html`${R.band('Variante 3')}${zahlen(zaehler(X))}<div class="glas-panel liste"><div class="gruppe">Probleme · ${P.length}</div>
        ${P.length ? P.map(x => zeile(p, x)) : html`<div class="leer">Alle Geräte erreichbar, keine Warnung</div>`}</div>
        <div class="leise p-fuss">Geräte und Sensoren stehen in ihrem Container (Abschnitt „Geräte und Sensoren“); das Inventar bleibt unter › 📦 Inventar.</div>`; } });

  /* ---------- Ein Gerätedialog (überall derselbe; alles erst bei „Speichern“) ---------- */
  function dialog(p, sh) {
    const X = liste(p), x = X.find(y => y.id === sh.id);
    if (sh.neu) return neuDialog(p, sh);
    if (!x) return html`<div class="leer">Gerät nicht gefunden</div>`;
    sh.form ||= { status: x.status, n: x.name };
    const f = sh.form, z = () => R.neuAlle(), I = p.invDaten && p.invDaten();
    const inv = I && I.container.flatMap(c => c.ausruestung.map(a => ({ c, a }))).find(({ a }) => x.art === 'schalt' ? a.geraet_id === x.id : false);
    const zl = (k, v) => html`<div class="zeile"><span>${k}</span><span class="leise g-wert">${v}</span></div>`;
    const seg = (wert, opts, fn) => html`<div class="seg klein">${opts.map(([v, t]) => html`<button data-v=${v} class=${wert === v ? 'on' : ''} @click=${() => { fn(v); z(); }}>${t}</button>`)}</div>`;
    const sel = (opts, wert) => html`<select>${opts.map(o => html`<option ?selected=${o === wert}>${o}</option>`)}</select>`;
    return html`<div class="block-kopf"><h3>${x.ic} ${x.name}</h3><span class="leise">${x.b.name}</span></div>
      ${R.band('ein Dialog für Gerät und Sensor')}
      <div class="glas-panel liste"><div class="gruppe">Jetzt</div>
        ${zl('Zustand', html`<span class=${x.weg ? 'rot-t' : ''}>${x.zustand}</span>`)}
        ${zl('Erreichbar', html`<i class="g-punkt-i ${x.weg ? 'weg' : 'da'}"></i> ${x.weg ? 'nein – seit 07:42' : 'ja'}`)}
        ${x.weg ? nothing : zl('Signal', html`${balken(x.sig)} ${x.sig} dBm`)}
        ${x.bat !== null ? zl('Batterie', batterie(x.bat)) : nothing}
        ${x.art === 'schalt' && x.g.np ? zl('Notprogramm', `🛟 ${x.g.np.zustand || 'bereit'}`) : nothing}</div>
      ${x.w.length ? html`<div class="glas-panel liste"><div class="gruppe">Warnungen · ${x.w.length}</div>${x.w.map(w => html`<div class="zeile g-wz"><div><b class=${w.stufe === 'stoerung' ? 'rot-t' : 'amber-t'}>⚠ ${w.titel}</b><div class="leise">${w.hilfe || ''}</div></div><button class="chip glas-panel">bis morgen stumm</button></div>`)}</div>` : nothing}
      <div class="glas-panel liste"><div class="gruppe">Status</div><div class="zeile"><div class="leise">nur „aktiv“ schaltet die Automatik und meldet Warnungen; gilt auch im Inventar</div></div>
        <div class="zeile">${seg(f.status, Object.entries(ST_TEXT), v => { f.status = v; })}</div></div>
      <div class="glas-panel liste"><div class="gruppe">Einstellungen</div><div class="g-felder">
        <label class="feld">Name<input .value=${f.n} @input=${e => { f.n = e.target.value; }}></label>
        ${x.art === 'schalt' ? html`
          <label class="feld">Shelly (Schalter)${sel([x.g.schalter], x.g.schalter)}</label>
          <div class="raster-2"><label class="feld">Typ${sel(x.b.pumpe ? ['Pumpe'] : ['Ölradiator', 'Konvektor', 'Bautrockner', 'Steckdose'], x.g.typ)}</label>
            <label class="feld">${x.b.pumpe ? 'Pumpenschacht' : 'Container'}${sel(p.d.bereiche.filter(b => !!b.pumpe === !!x.b.pumpe).map(b => b.name), x.b.name)}</label></div>
          <label class="feld">Leistungssensor${sel(['automatisch'], 'automatisch')}</label>`
        : html`
          <div class="raster-2"><label class="feld">Rolle${sel(['Fühler', 'Tür 1', 'Tür 2', 'Fenster 1', 'Fenster 2', 'Fenster 3', 'Fenster 4', 'Licht'], x.name)}</label>
            <label class="feld">Container${sel(p.d.bereiche.filter(b => !b.pumpe).map(b => b.name), x.b.name)}</label></div>
          <label class="feld">Sensor${sel([x.eid], x.eid)}</label>
          <div class="leise">${x.s.art === 'fuehler' ? 'Fühler: regelt das Soll, schreibt die Temperatur mit.' : x.s.art === 'licht' ? 'Licht: nur im Symbol.' : 'Tür/Fenster: offen oder gekippt pausiert die Heizung; Lage im Aussehen.'}</div>`}</div></div>
      <div class="glas-panel liste"><div class="gruppe">Inventar</div>
        ${inv ? html`${zl('Name', html`<b class="inv-id">${inv.a.name || inv.a.typ_label}</b>`)}${zl('Container', inv.c.name)}${zl('Modell', inv.a.modell || '–')}${zl('seit', String(inv.a.seit || '').slice(0, 10))}`
          : html`<div class="zeile"><span class="leise">${x.art === 'schalt' ? 'noch nicht im Inventar' : 'im Inventar über den Container'}</span>${x.art === 'schalt' ? html`<button class="chip glas-panel">Zuordnen</button>` : nothing}</div>`}</div>
      <div class="g-knoepfe"><button class="knopf amber nur-admin" @click=${() => p.schliessen()}>Speichern</button><button class="knopf rot nur-admin" @click=${() => p.schliessen()}>${x.art === 'schalt' ? 'Gerät entfernen' : 'Sensor entfernen'}</button><button class="knopf leise-k" @click=${() => p.schliessen()}>Abbrechen</button></div>`;
  }
  function neuDialog(p, sh) {
    const b = p.d.bereiche.find(y => y.id === sh.bid) || p.d.bereiche[0];
    return html`<div class="block-kopf"><h3>Gerät oder Sensor hinzufügen</h3><span class="leise">${b.name}</span></div>${R.band('derselbe Dialog')}
      <div class="seg glas-panel g-arten">${['🔌 Shelly', '🌡 Fühler', '🚪 Tür', '🪟 Fenster', '💡 Licht'].map((t, i) => html`<button class=${i === 0 ? 'on' : ''}>${t}</button>`)}</div>
      <div class="glas-panel liste"><label class="feld">Gerät aus Home Assistant<select><option>Plug Lager 09 (switch.plug_lager_09)</option></select></label>
        <label class="feld">Was hängt dran?<select><option>Konvektor</option><option>Ölradiator</option><option>Bautrockner</option><option>Steckdose</option></select></label>
        <label class="feld">Name<input value="Konvektor 2"></label><div class="leise">Kommt gleich ins Inventar des Containers (Abgleich).</div></div>
      <div class="g-knoepfe"><button class="knopf amber" @click=${() => p.schliessen()}>Hinzufügen</button><button class="knopf leise-k" @click=${() => p.schliessen()}>Abbrechen</button></div>`;
  }
  R.einblendung('g-dialog', dialog, { breit: () => false });

  /* ---------- Batterie/Signal im Container (alle Varianten): Leiste unter dem Kopf ---------- */
  R.abschnitt({ ansicht: 'container', wann: p => G.v !== 3 && p.b && !p.b.pumpe, nach: p => { const X = liste(p).filter(x => x.b === p.b && x.art === 'sensor');
    return X.length ? html`<div class="glas-panel g-sensoren">${X.map(x => html`<button class="chip g-sensor ${x.weg ? 'weg' : ''}" @click=${() => R.auf(p, { art: 'g-dialog', id: x.id })}>${x.ic} ${x.name} · ${x.zustand} ${batterie(x.bat)} ${x.weg ? nothing : balken(x.sig)}</button>`)}</div>` : nothing; } });

  R.stil(`
.g-zahlen { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; } .g-zahlen .chip { font-size: 12px; padding: 5px 10px; }
.g-filter, .g-reiter { margin: 0 0 10px; } .g-seite { display: flex; flex-direction: column; }
.g-gruppe { display: flex; justify-content: space-between; align-items: center; gap: 8px; } .g-gruppe a { cursor: pointer; }
.g-zeile { display: flex; align-items: center; gap: 10px; text-align: left; width: 100%; }
.g-zeile.weg .g-t b { color: var(--ink2); }
.g-ic { position: relative; font-size: 20px; width: 30px; text-align: center; flex: none; }
.g-punkt { position: absolute; right: -2px; bottom: 0; width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--bg, #000); }
.g-punkt.da, .g-punkt-i.da { background: #30d158; } .g-punkt.weg, .g-punkt-i.weg { background: var(--rot, #ff453a); }
.g-punkt-i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
.g-t { flex: 1; min-width: 0; } .g-t b { display: block; overflow-wrap: anywhere; } .g-t .leise { overflow-wrap: anywhere; }
.g-w { font-size: 12px; margin-top: 2px; } .g-w.stoerung { color: var(--rot, #ff453a); } .g-w.hinweis { color: var(--amber); }
.g-z { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 13px; white-space: nowrap; } .g-z2 { display: flex; gap: 6px; align-items: center; font-size: 11px; }
.g-sig { display: inline-flex; gap: 2px; align-items: flex-end; height: 12px; } .g-sig i { width: 3px; background: rgba(127,127,127,.35); border-radius: 1px; }
.g-sig i:nth-child(1) { height: 4px; } .g-sig i:nth-child(2) { height: 6px; } .g-sig i:nth-child(3) { height: 9px; } .g-sig i:nth-child(4) { height: 12px; } .g-sig i.an { background: var(--ink); }
.g-st { font-size: 11px; font-weight: 500; padding: 1px 6px; border-radius: 8px; background: rgba(120,120,128,.2); } .g-st.defekt { color: var(--rot, #ff453a); } .g-st.verliehen { color: var(--blau); }
.g-wert { display: inline-flex; gap: 6px; align-items: center; } .g-wz { align-items: flex-start; gap: 8px; } .g-wz .chip { font-size: 11px; white-space: nowrap; }
.g-knoepfe { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.g-sensoren { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px; border-radius: 18px; margin: 10px 0; } .g-sensor { font-size: 12px; display: inline-flex; gap: 5px; align-items: center; } .g-sensor.weg { opacity: .6; }
.g-abschnitt { margin-top: 10px; } .g-felder { padding: 2px 16px 12px; } .g-arten { flex-wrap: wrap; height: auto; } .g-arten button { flex: 1 1 30%; }`);

  /* ---------- Vorführ-Leiste ---------- */
  const zeigen = (v, ziel) => {
    G.v = v; G.filter = 'alle'; G.reiter = ziel === 'inventar' ? 'inventar' : 'uebersicht';
    for (const q of R.P()) {
      if (!q.d) continue;   // Daten noch nicht da (beim ersten Aufruf der Leiste)
      q.s.sheet = null;
      const b = q.d.bereiche.find(x => !x.pumpe && x.geraete.length) || q.d.bereiche[0], X = liste(q);
      if (ziel === 'container' || v === 3 && ziel !== 'einst') q.containerOeffnen(b.id);
      else if (v === 2) q.gehe('g-geraete');
      else { q.s.evGruppe = v === 1 ? 'g-geraete' : 'g-probleme'; q.gehe('einst'); }
      if (ziel === 'probleme') G.filter = 'probleme';
      if (ziel === 'dialog') q.s.sheet = { art: 'g-dialog', id: (X.find(x => x.art === 'schalt' && x.b === b) || X[0]).id };
      if (ziel === 'sensor') q.s.sheet = { art: 'g-dialog', id: (X.find(x => x.art === 'sensor') || X[0]).id };
      if (ziel === 'neu') q.s.sheet = { art: 'g-dialog', neu: true, bid: b.id };
      q.neuZeichnen();
    }
  };
  R.vorfuehren(w => { G.lage = w.lage; zeigen(+w.variante, w.zeigen); });
}

const V = [['1', '1 · Einstellungen-Gruppe „Geräte“'], ['2', '2 · Eigener Reiter „Geräte“'], ['3', '3 · Im Container']];
const ZEIGEN = [['einstieg', 'Einstieg'], ['probleme', 'Filter: Probleme'], ['inventar', 'Reiter Inventar'], ['container', 'Container-Ansicht'],
  ['dialog', 'Dialog: Heizkörper'], ['sensor', 'Dialog: Sensor'], ['neu', 'Gerät hinzufügen'], ['einst', 'Einstellungen (V3)']];
const LAGEN = [['normal', 'normal'], ['probleme', 'mit Problemen (offline, Batterie)']];
const faelle = [];
for (const [v] of V) for (const z of ['einstieg', 'container', 'dialog', 'sensor', 'neu']) for (const l of ['normal', 'probleme'])
  faelle.push({ name: `v${v}-${z}${l === 'normal' ? '' : '-' + l}`, werte: { variante: v, lage: l, zeigen: z } });
for (const v of ['1', '2']) faelle.push({ name: `v${v}-inventar`, werte: { variante: v, lage: 'normal', zeigen: 'inventar' } });
faelle.push({ name: 'v3-einst-probleme', werte: { variante: '3', lage: 'probleme', zeigen: 'einst' } });
faelle.push({ name: 'v3-container-abschnitt', werte: { variante: '3', lage: 'probleme', zeigen: 'container' }, scroll: '.g-abschnitt' });
rahmen.bauen({ datei: 'geraete.html', titel: 'Baustelle – Geräte (3 Varianten)', leiste: 'BSM-034.05 Geräte · 3 Varianten', browser, faelle,
  auswahl: [{ id: 'variante', t: 'Variante', optionen: V }, { id: 'lage', t: 'Lage', optionen: LAGEN }, { id: 'zeigen', t: 'zeigen', optionen: ZEIGEN }] });
