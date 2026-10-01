// AN-0012: Vorschlag „Regeln besser gruppiert, nichts versteckt“ (Heizung › Regeln) auf Basis des Master-Mockups.
// Baut mockups/regeln-varianten.html: node mockups/quelle/archiv/regeln-varianten.js (Vorschlag – Variante B eingebaut in 0.8.31)
// Zwei Gruppierungen (Leiste „Gruppierung“): A nach Thema, B nach Tagesablauf. Neu einstellbar (Mockup, nur lokal):
// Toleranz (gibt es schon, war versteckt), Hand-Nachfrist, Fühler ohne Wert halten, „heizt tatsächlich“ ab W.
// Die übrigen festen Werte stehen mit Erklärung in „Feste Regeln“ (nur Anzeige).
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const CSS = `
.rv-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 6px; vertical-align: middle; }
.rv-kopf { display: flex; align-items: baseline; gap: 8px; margin: 14px 2px 4px; } .rv-kopf b { font-size: 16px; } .rv-kopf .leise { font-size: 12px; }
.rv-karte { border-radius: 16px; background: rgba(120,120,128,.10); padding: 2px 12px; margin-bottom: 6px; }
.rv-karte > .zeile:first-child { border-top: 0; }
.rv-fest { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; padding: 8px 0; font-size: 13px; border-top: 1px solid var(--gridc); }
.rv-fest:first-child { border-top: 0; } .rv-fest b { font-weight: 600; white-space: nowrap; } .rv-fest .leise { grid-column: 1 / -1; margin-top: -4px; font-size: 12px; }
.rv-link { color: var(--blau); background: none; border: 0; font: inherit; cursor: pointer; padding: 0; }
.rv-suche { width: 100%; box-sizing: border-box; font-size: 15px; padding: 9px 14px; border-radius: 14px; margin: 4px 0 2px; }
`;

const SKRIPT = `
/* ================= AN-0012: Regeln gruppiert (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { teile: p.hzTeile, klick: p.klick, aufbauen: p._aufbauen };
  const NEU = '<span class="rv-neu">neu</span>';
  p._aufbauen = function () { const erst = !this.root; alt.aufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS)}; this.shadowRoot.appendChild(s); } };
  const RV = window.RV = { variante: 'A', toleranz: 0.3, hand_nachfrist: 30, fuehler_halten: 15, zieht_w: 50 };
  const GRENZEN = { toleranz: [0.1, 2, 0.1], hand_nachfrist: [0, 240, 5], fuehler_halten: [0, 120, 5], zieht_w: [5, 500, 5] };

  p.rvZeilen = function () {
    const d = this.d, e = d.e, st = (k, s, fmt) => this.stepper(k, s, fmt), grad = v => de(v, 1) + ' °C', min = v => v + ' min';
    const neuSt = (k, fmt) => '<span class="stepper"><button data-act="rv-st" data-k="' + k + '" data-d="-1">−</button><b>' + fmt(RV[k]) + '</b><button data-act="rv-st" data-k="' + k + '" data-d="1">+</button></span>';
    const z = (titel, text, ctrl, unter) => '<div class="zeile' + (unter ? ' unter' : '') + '"><div>' + (unter ? '<span>' : '<b>') + titel + (unter ? '</span>' : '</b>') + (text ? '<div class="leise">' + text + '</div>' : '') + '</div>' + (ctrl || '') + '</div>';
    const C = d.bereiche.filter(b => !b.pumpe), lernend = C.filter(b => b.lern && b.lern.warm), zwei = C.some(b => b.geraete.filter(g => g.heizer).length >= 2);
    const nichtLern = lernend.length ? ' · <i>nicht für lernende Container</i>' : '';
    return {
      soll: z('Solltemperatur', 'für Container mit Fühler; ohne Fühler regelt der Heizkörperthermostat', st('soll', .5, grad)),
      toleranz: z('Schaltabstand ± um das Soll' + NEU, 'Thermostat: ein unter Soll − Abstand, aus über Soll + Abstand (bisher fest 0,3 °C, versteckt)', neuSt('toleranz', v => '± ' + de(v, 1) + ' °C')),
      grenze: z('Heizgrenze', 'nicht heizen, wenn es wärmer ist', st('grenze', .5, grad)),
      basis: z('Grundlage der Heizgrenze', '', '<div class="seg klein">' + ['jetzt', 'Tageshöchstwert'].map(v => '<button data-act="basis" data-v="' + v + '" class="' + (e.basis === v ? 'on' : '') + '">' + v + '</button>').join('') + '</div>', true),
      vorheizen: z('Vorheizen', 'vor Arbeitsbeginn, damit es warm ist' + nichtLern, st('vorheizen', 5, min)),
      nachheizen: z('Nachheizen', 'nach Arbeitsende, jeden Tag' + nichtLern, st('nachheizen', 5, min)),
      frueh: z('Kälte-Frühstart', 'unter ' + de(e.frueh_temp, 0).replace('-', '−') + ' °C zusätzlich früher' + nichtLern, schalter(e.fruehstart, 'e-bool', 'data-k="fruehstart"'))
        + (e.fruehstart ? z('wenn morgens kälter als', '', st('frueh_temp', 1, v => de(v, 0).replace('-', '−') + ' °C'), true) + z('so viel früher', '', st('frueh_min', 5, min), true) : ''),
      trocknen: z('👕 Kleidung trocknen', 'ab ' + de(e.tr_mm, 1) + ' mm Regen: +' + e.tr_laenger + ' min nach dem Nachheizen, am Morgen ' + e.tr_frueher + ' min früher', '<button class="rv-link" data-act="hz-auf" data-k="trocknen">ändern ›</button>'),
      lernend: z('🧠 Lernende Container', 'heizen selbst so früh, dass das Soll rechtzeitig erreicht ist – statt Vorheizen, Kälte-Frühstart und Nachheizen.' + (lernend.length ? ' Jetzt: ' + lernend.map(b => esc(b.name)).join(', ') + '.' : ' Gilt für Container mit Fühler, Modus Thermostat und lernender Regelung.'), ''),
      warm_vor: z('Soll erreicht', 'vor Arbeitsbeginn, z. B. zum Umziehen', st('warm_vor', 5, v => v ? v + ' min vorher' : 'bei Beginn'), true),
      warm_nach: z('Warm halten', 'nach Arbeitsende; Kleidung trocknen kommt dazu', st('warm_nach', 5, v => v ? v + ' min länger' : 'bis Ende'), true),
      warm_max: z('Frühestens', 'vor Arbeitsbeginn – Grenze, falls der Raum sehr kalt ist', st('warm_max', 15, v => v + ' min vorher'), true),
      boost: z('⚡ Schnell aufheizen', 'alle Heizkörper eines Containers zugleich, Vorrang in der Staffelung – bis zum Soll, ohne Fühler für', st('boost_min', 5, min)),
      zusatz: !zwei ? '' : z('🔥 Zusatz-Heizkörper', 'in Containern mit „Zusatz nur bei Bedarf“: zuerst heizt einer, der Zusatz kommt dazu, wenn …', '')
        + z('… der Raum weiter unter dem Soll ist als', '', st('stufen_abstand', .5, grad), true) + z('… einer schon so lange läuft', '', st('stufen_min', 5, min), true)
        + z('… und es dabei weniger wärmer wurde als', '', st('stufen_anstieg', .1, v => de(v) + ' °C'), true) + z('… es draußen kälter ist als (beide von Anfang an)', '', st('stufen_kalt', 1, v => de(v, 0).replace('-', '−') + ' °C'), true),
      zieht: z('Heizt tatsächlich ab' + NEU, 'Leistung, ab der ein Heizkörper als „heizt“ zählt – Heizzeit geheizt, Heiztage, Warm ab, Lernen, Wann heizt was (bisher fest 50 W)', neuSt('zieht_w', v => v + ' W')),
      tuer: z('🚪 Tür offen', 'Heizung pausieren nach', st('tuer_pause', 1, min)) + z('Nachricht nach', '', st('tuer_melden', 5, min), true),
      frost: z('❄ Frostschutz', 'hält jeden Container über der Grenze, auch außerhalb der Arbeitszeit', schalter(e.frost, 'e-bool', 'data-k="frost"'))
        + (e.frost ? z('ein unter', '', st('frost_temp', .5, grad), true) + z('aus über', '', st('frost_aus', .5, grad), true)
          + z('ohne Fühler: ein, wenn draußen unter', 'aus erst 2 °C darüber; der Heizkörperthermostat regelt dann selbst', e.frost_aussen === null ? '<span class="leise">aus</span>' : st('frost_aussen', 1, v => de(v, 0).replace('-', '−') + ' °C'), true)
          + z('auch bei Automatik aus', 'schaltet dann nur den Frostschutz, sonst nichts', schalter(e.frost_immer, 'e-bool', 'data-k="frost_immer"'), true) : ''),
      urlaub: z('🏖 Urlaub &amp; freie Feiertage', { frost: 'nur Frostschutz', absenk: 'absenken auf ' + de(e.absenk) + ' °C', aus: 'alles aus' }[e.urlaub], '<button class="rv-link" data-act="hz-auf" data-k="urlaub">ändern ›</button>'),
      hand: z('✋ Handbetrieb übernehmen nach' + NEU, 'Hat jemand einen Heizkörper von Hand geschaltet, übernimmt die Automatik ihn erst so lange nach dem Arbeitsende (bisher fest 30 min)', neuSt('hand_nachfrist', min)),
      fuehler: z('🌡 Fühler ohne Wert' + NEU, 'Meldet ein Fühler nichts, gilt sein letzter Wert noch so lange – danach regelt der Container wie ohne Fühler (bisher fest 15 min)', neuSt('fuehler_halten', min)),
      staffel: z('⚡ Staffelung', e.staffel ? e.nutzbar + ' % je Anschluss nutzbar · höchstens ' + e.max_gleich + ' gleichzeitig · mindestens ' + e.min_lauf + ' min an, ' + e.min_pause + ' min Pause' : 'aus – alle Heizkörper dürfen zugleich', '<button class="rv-link" data-act="tab-einst" data-g="strom">ändern ›</button>'),
      erkl: erkl(e.erklaer, 'Vorheizen und Nachheizen gelten jeden Arbeitstag. Die Verlängerungen zählen zusammen: vor der Arbeit Vorheizen + Kälte-Frühstart + früher nach Regen, danach Nachheizen + Kleidung trocknen. Der Frostschutz springt unter „ein“ an und hört erst über „aus“ wieder auf.'),
    };
  };
  /* Feste Regeln: bewährte Schwellen, nur zur Information */
  const FEST = [
    ['Außentemperatur ohne Wert', '6 h', 'der letzte Außenwert gilt noch so lange (Heizgrenze, Frostschutz ohne Fühler)'],
    ['Frostschutz ohne Fühler aus', '+2 °C', 'über der Außen-Grenze, damit er nicht dauernd ein- und ausschaltet'],
    ['„Schaltet sich selbst ein“', '3× in 10 min', 'so oft musste die Automatik ein Gerät ausschalten – dann Störung statt Protokoll jede Minute'],
    ['Lernen: Takt', '10 min, mind. 2 min ein', 'Thermostat lernend: Anteil je Takt; kürzere Pulse lohnen nicht'],
    ['Lernen: Aufheizen zählt', 'ab 1 °C unter Soll, ≥ 20 min, ≥ 0,5 °C', 'so wird die Aufheizrate gemessen; ab 3 Messungen je Außenband rechnet der Container selbst'],
    ['Lernen: kalt / mild', 'unter 5 °C außen', 'Aufheizraten getrennt nach kaltem und mildem Wetter'],
    ['Tür vermutlich offen', '−0,3 °C in 10 min', 'beim Heizen, während es draußen kaum kälter wurde – danach 10 min nichts lernen'],
  ];
  p.rvFest = function () { return '<div class="rv-karte">' + FEST.map(([t, w, x]) => '<div class="rv-fest"><span>' + t + '</span><b>' + w + '</b><div class="leise">' + x + '</div></div>').join('') + '</div>'; };
  p.rvRegeln = function () {
    const R = this.rvZeilen(), karte = (ic, titel, unter, teile) => { const inhalt = teile.map(k => R[k]).join(''); return inhalt ? '<div class="rv-kopf"><b>' + ic + ' ' + titel + '</b><span class="leise">' + unter + '</span></div><div class="rv-karte">' + inhalt + '</div>' : ''; };
    const fest = '<div class="rv-kopf"><b>📐 Feste Regeln</b><span class="leise">bewährte Schwellen, nicht änderbar</span></div>' + this.rvFest();
    const kopf = '<div class="leise">Variante ' + RV.variante + ': ' + (RV.variante === 'A' ? 'nach Thema' : 'nach Tagesablauf') + ' · „neu“ = bisher fest oder versteckt</div>';
    if (RV.variante === 'A') return kopf
      + karte('🌡', 'Temperatur', 'wie warm, ab wann nicht', ['soll', 'toleranz', 'grenze', 'basis'])
      + karte('🕖', 'Heizzeit', 'rund um die Arbeitszeit', ['vorheizen', 'nachheizen', 'frueh', 'trocknen'])
      + karte('🧠', 'Lernende Container', 'statt fester Vorheizzeit', ['lernend', 'warm_vor', 'warm_nach', 'warm_max'])
      + karte('♨', 'Heizkörper', 'wie viele, wie schnell', ['boost', 'zusatz', 'zieht'])
      + karte('🚪', 'Tür offen', '', ['tuer'])
      + karte('❄', 'Frost, Urlaub, Feiertage', 'außerhalb der Arbeitszeit', ['frost', 'urlaub'])
      + karte('⚙', 'Automatik', 'Hand, Ausfälle, Strom', ['hand', 'fuehler', 'staffel'])
      + fest + R.erkl;
    return kopf
      + karte('🌅', 'Vor der Arbeit', 'warm, wenn es losgeht', ['vorheizen', 'frueh', 'lernend', 'warm_vor', 'warm_max'])
      + karte('👷', 'In der Arbeitszeit', 'auf das Soll halten', ['soll', 'toleranz', 'grenze', 'basis', 'boost', 'zusatz', 'tuer'])
      + karte('🌇', 'Nach der Arbeit', 'warm halten, trocknen, übernehmen', ['nachheizen', 'warm_nach', 'trocknen', 'hand'])
      + karte('🌙', 'Nachts, frei, Urlaub', 'nur Frostschutz', ['frost', 'urlaub'])
      + karte('⏱', 'Immer', 'Messung und Strom', ['zieht', 'fuehler', 'staffel'])
      + fest + R.erkl;
  };
  p.hzTeile = function () { const t = alt.teile.call(this); t.regeln = '<div class="block">' + this.rvRegeln() + '</div>'; return t; };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act;
    if (a === 'rv-st') { const k = el.dataset.k, [lo, hi, s] = GRENZEN[k]; RV[k] = Math.round(Math.max(lo, Math.min(hi, RV[k] + s * +el.dataset.d)) * 10) / 10; return this.render(); }
    return alt.klick.call(this, ev);
  };
})();
`;

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Regeln gruppiert (AN-0012)</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>AN-0012 Regeln gruppiert · Vorschlag auf Seite $1</b>');
ersetze('<button id="neu">Beispiel neu laden</button>', `<button id="neu">Beispiel neu laden</button>
<label>Gruppierung <select id="rv-variante"><option value="A">A · nach Thema</option><option value="B">B · nach Tagesablauf</option></select></label>`);
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
const rvWahl = document.getElementById('rv-variante');
const rvAuf = () => { for (const p of P) { p.s.view = 'heizung'; p.s.sheet = { art: 'hz', k: 'regeln' }; p.render(true); } };
rvWahl.onchange = () => { RV.variante = rvWahl.value; rvAuf(); };
rvAuf();`);
fs.writeFileSync(path.join(repo, 'mockups', 'regeln-varianten.html'), html);
console.log(`mockups/regeln-varianten.html gebaut (${Math.round(html.length / 1024)} KB)`);
