// WU-0016: Vorschlag „Screenshot zur Meldung“ auf Basis des Master-Mockups.
// Baut mockups/melden-bilder.html: node mockups/quelle/archiv/melden-bilder.js (Vorschlag – eingebaut in 0.8.40)
// Ändert nur das Melde-Fenster: bis zu 3 Bilder – „📎 Bild wählen“ (Handy: Galerie/Kamera, PC: Datei), Strg+V (PC,
// Zwischenablage) und „🖥 Fenster aufnehmen“ (PC, Bildschirmfreigabe). Im Mockup funktionieren Datei und Strg+V echt;
// ohne Datei fügt „Beispielbild“ ein Platzhalterbild ein. Verkleinert wird auf höchstens 1600 px (JPEG).
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..', '..');
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a.slice(0, 60)); html = html.replace(a, b); };

const CSS = `
.mb-neu { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--amber); color: #000; margin-left: 6px; vertical-align: middle; }
.mb-box { border-radius: 14px; background: rgba(120,120,128,.10); padding: 10px 12px; margin: 6px 0; }
.mb-kopf { display: flex; align-items: baseline; gap: 6px; } .mb-kopf b { font-size: 14px; }
.mb-knoepfe { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 4px; }
.mb-knoepfe label, .mb-knoepfe button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 12px; border: 0; background: rgba(120,120,128,.2); color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.mb-knoepfe input { display: none; }
.mb-bilder { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.mb-bild { position: relative; border-radius: 10px; overflow: hidden; background: rgba(0,0,0,.25); aspect-ratio: 9 / 16; }
.mb-bild.quer { aspect-ratio: 16 / 10; } .mb-bild img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mb-bild .x { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%; border: 0; background: rgba(0,0,0,.6); color: #fff; cursor: pointer; }
.mb-bild small { position: absolute; left: 0; right: 0; bottom: 0; font-size: 10px; padding: 2px 6px; background: rgba(0,0,0,.55); color: #fff; }
.mb-hinweis { font-size: 12px; color: var(--ink2); }
`;

const SKRIPT = `
/* ================= WU-0016: Bilder zur Meldung (Vorschlag) ================= */
(() => {
  const K = customElements.get('baustelle-panel'), p = K.prototype, alt = { sheet: p.sheet, klick: p.klick, aufbauen: p._aufbauen, aenderung: p.aenderung };
  const NEU = '<span class="mb-neu">neu</span>', MAX = 3, PX = 1600;
  p._aufbauen = function () { const erst = !this.root; alt.aufbauen.call(this); if (erst && this.shadowRoot) { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS)}; this.shadowRoot.appendChild(s);
    // Strg+V: Bild aus der Zwischenablage, solange das Melde-Fenster offen ist
    window.addEventListener('paste', ev => { const s2 = this.s.sheet; if (!s2 || s2.art !== 'melden') return;
      const f = [...(ev.clipboardData && ev.clipboardData.items || [])].find(i => i.type.startsWith('image/')); if (!f) return; ev.preventDefault(); this.mbDatei(f.getAsFile(), 'eingefügt'); }); } };
  const bilder = s => (s.form.bilder ||= []);
  /* Bild verkleinern (höchstens 1600 px, JPEG) – im echten Bau ebenso vor dem Senden */
  p.mbDatei = function (datei, wie) {
    const s = this.s.sheet; if (!s || !datei || bilder(s).length >= MAX) return;
    const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const f = Math.min(1, PX / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.82); bilder(s).push({ url, b: c.width, h: c.height, kb: Math.round(url.length * 0.75 / 1024), wie }); this.render(); this.toast('Bild ' + wie); }; img.src = r.result; }; r.readAsDataURL(datei);
  };
  p.mbBeispiel = function (wie) {
    const s = this.s.sheet; if (bilder(s).length >= MAX) return this.toast('Höchstens ' + MAX + ' Bilder');
    const quer = wie === 'aufgenommen', b = quer ? 1600 : 900, h = quer ? 1000 : 1600;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + b + ' ' + h + '"><rect width="100%" height="100%" fill="#1d2433"/><rect x="60" y="60" width="' + (b - 120) + '" height="180" rx="40" fill="#2c3550"/><circle cx="' + b / 2 + '" cy="' + h / 2 + '" r="' + (b / 4) + '" fill="none" stroke="#ff9f0a" stroke-width="18"/><text x="50%" y="' + (h / 2 + 30) + '" font-size="110" fill="#fff" text-anchor="middle" font-family="sans-serif">19,4°</text></svg>';
    bilder(s).push({ url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), b, h, kb: quer ? 210 : 160, wie }); this.render(); this.toast('Bild ' + wie);
  };
  p.sheet = function () {
    const s = this.s.sheet; if (!s || s.art !== 'melden') return alt.sheet.call(this);
    const h = alt.sheet.call(this), B = bilder(s), pc = !this.narrow, voll = B.length >= MAX;
    const box = '<div class="mb-box"><div class="mb-kopf"><b>📷 Screenshot</b>' + NEU + '<span class="leise">' + B.length + ' von ' + MAX + '</span></div>'
      + (voll ? '' : '<div class="mb-knoepfe"><label>📎 Bild wählen<input type="file" accept="image/*" multiple data-mb="datei"></label>'
        + (pc ? '<button data-act="mb-fenster">🖥 Fenster aufnehmen</button>' : '') + '<button data-act="mb-beispiel">Beispielbild</button></div>')
      + '<div class="mb-hinweis">' + (pc ? 'oder einen Screenshot mit <b>Strg+V</b> einfügen (z. B. nach Win+Shift+S)' : 'Screenshot mit den Handy-Tasten machen, dann hier wählen') + ' · wird auf höchstens 1600 px verkleinert</div>'
      + (B.length ? '<div class="mb-bilder">' + B.map((x, i) => '<div class="mb-bild ' + (x.b > x.h ? 'quer' : '') + '"><img src="' + x.url + '" alt="Bild ' + (i + 1) + '"><button class="x" data-act="mb-weg" data-i="' + i + '" aria-label="Bild entfernen">✕</button><small>' + x.b + '×' + x.h + ' · ' + x.kb + ' KB</small></div>').join('') + '</div>' : '')
      + '</div>';
    return h.replace('<div class="zeile"><div><b>Stand der Seite mitschicken</b>', box + '<div class="zeile"><div><b>Stand der Seite mitschicken</b>');
  };
  p.aenderung = function (ev) {
    const el = ev.target; if (el && el.dataset && el.dataset.mb === 'datei') { [...(el.files || [])].slice(0, MAX).forEach(f => this.mbDatei(f, 'gewählt')); el.value = ''; return; }
    return alt.aenderung ? alt.aenderung.call(this, ev) : undefined;
  };
  p.klick = function (ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'), a = el && el.dataset.act, s = this.s.sheet;
    if (a === 'mb-weg') { bilder(s).splice(+el.dataset.i, 1); return this.render(); }
    if (a === 'mb-beispiel') return this.mbBeispiel('gewählt');
    if (a === 'mb-fenster') {   // echte Seite: getDisplayMedia → ein Bild aus dem Video, dann Freigabe beenden
      const md = navigator.mediaDevices; if (!md || !md.getDisplayMedia) return this.mbBeispiel('aufgenommen');
      return md.getDisplayMedia({ video: { displaySurface: 'browser' }, preferCurrentTab: true }).then(strom => { const v = document.createElement('video'); v.srcObject = strom; v.muted = true;
        return v.play().then(() => new Promise(r => setTimeout(r, 300))).then(() => { const c = document.createElement('canvas'), f = Math.min(1, PX / Math.max(v.videoWidth, v.videoHeight));
          c.width = Math.round(v.videoWidth * f); c.height = Math.round(v.videoHeight * f); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); strom.getTracks().forEach(t => t.stop());
          c.toBlob(b => this.mbDatei(b, 'aufgenommen'), 'image/jpeg', 0.82); }); }).catch(() => this.toast('Aufnahme abgebrochen'));
    }
    if (a === 'ml-senden' && s && s.art === 'melden' && bilder(s).length) { const n = bilder(s).length; this.s.sheet = null; this.render(); return this.toast('Danke – gemeldet mit ' + n + ' ' + (n === 1 ? 'Bild' : 'Bildern') + ' (Mockup: nichts gesendet)'); }
    return alt.klick.call(this, ev);
  };
})();
`;

ersetze('<title>Baustelle – Master-Mockup</title>', '<title>Baustelle – Screenshot zur Meldung</title>');
html = html.replace(/<b>Baustelle · Master-Mockup · Seite ([^<]*)<\/b>/, '<b>WU-0016 Screenshot zur Meldung · Vorschlag auf Seite $1</b>');
const start = html.lastIndexOf('<script>\nconst STRUKTUR');
html = html.slice(0, start) + '<script>\n' + SKRIPT.replace(/<\/script/gi, '<\\/script') + '\n</script>\n' + html.slice(start);
ersetze('setInterval(hassNeu, 60000);', `setInterval(hassNeu, 60000);
for (const p of P) { p.klick({ target: { closest: () => ({ dataset: { act: 'melden' } }) } }); }`);
fs.writeFileSync(path.join(repo, 'mockups', 'melden-bilder.html'), html);
console.log(`mockups/melden-bilder.html gebaut (${Math.round(html.length / 1024)} KB)`);
