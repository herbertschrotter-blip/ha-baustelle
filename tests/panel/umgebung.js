// DOM-Umgebung für den Panel-Test (BSM-022 Stufe 0b.1, docs/bauplan-lit.md §6): ein happy-dom-Fenster statt des früheren
// Mini-DOMs. Die gebaute Seite läuft im Node-Kontext gegen die Klassen dieses Fensters (HTMLElement, customElements,
// document …); Klicks und Eingaben sind echte DOM-Ereignisse durch die Listener der Seite.
// happy-dom kommt aus custom_components/baustelle/frontend/node_modules (npm ci dort).
'use strict';
const fs = require('fs');
const path = require('path');
const FRONTEND = path.join(__dirname, '..', '..', 'custom_components', 'baustelle', 'frontend');
let Window;
try { ({ Window } = require(path.join(FRONTEND, 'node_modules', 'happy-dom'))); } catch (e) {
  console.error('happy-dom fehlt – npm --prefix custom_components/baustelle/frontend ci'); process.exit(2);
}

/** Fenster anlegen und seine DOM-Klassen global machen; gibt Fenster, Downloads und Ereignisse zurück. */
function einrichten() {
  const fenster = new Window({ url: 'http://localhost:8123/baustelle', width: 390, height: 844,
    settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true, navigator: { userAgent: 'baustelle-test' } } });
  const downloads = [], events = [];
  for (const name of ['document', 'customElements', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'PointerEvent',
    'KeyboardEvent', 'InputEvent', 'FocusEvent', 'ResizeObserver', 'MutationObserver', 'matchMedia', 'getComputedStyle', 'DOMParser',
    'HTMLInputElement', 'HTMLCanvasElement', 'SVGElement', 'DocumentFragment', 'ShadowRoot', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    Object.defineProperty(global, name, { value: fenster[name], configurable: true, writable: true });
  }
  global.window = fenster;
  global.localStorage = { getItem: () => null, setItem() {} };   // jeder Lauf startet ohne gemerkte Baustelle
  global.setInterval = () => 1; global.clearInterval = () => {};   // kein Minutentakt im Test
  // Downloads (CSV, Diagnose) und Zwischenablage mitschreiben statt auszuführen
  fenster.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
  Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: t => { downloads.push('clipboard:' + t.length); return Promise.resolve(); } },
    userAgent: 'baustelle-test' }, configurable: true });
  // happy-dom rechnet kein Layout: Testfälle können Maße je Element vorgeben (layout.setzen(fn), fn(el, name) → Zahl/undefined)
  for (const name of ['clientWidth', 'clientHeight', 'offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight']) {
    let o = fenster.Element.prototype, d; for (const k of [fenster.HTMLElement.prototype, fenster.Element.prototype]) if ((d = Object.getOwnPropertyDescriptor(k, name))) { o = k; break; }
    if (!d) continue;
    Object.defineProperty(o, name, { configurable: true, get() { const v = layout.fn && layout.fn(this, name); return v === undefined ? d.get.call(this) : v; } });
  }
  return { fenster, downloads, events, layout };
}
const layout = { fn: null, setzen(fn) { this.fn = fn; } };

/** Gebaute Seite laden (wie das Modul im Browser: einmal, im globalen Kontext). */
function seiteLaden(datei) {
  (0, eval)(fs.readFileSync(datei, 'utf8'));
  return global.customElements.get('baustelle-panel');
}

const kebab = k => k.replace(/[A-Z]/g, b => '-' + b.toLowerCase());
const passt = (el, ds) => { const soll = Object.entries(ds).filter(([, v]) => v !== undefined), ist = Object.keys(el.dataset);
  return ist.length === soll.length && soll.every(([k, v]) => el.dataset[k] === String(v)); };

/** Helfer für echte Ereignisse in der Seite. Ein Klick trifft das Element mit genau diesen data-Attributen; gibt es keins
 *  (Testfall greift einer Ansicht vor), wird ein unsichtbarer Knopf in `.ui` eingesetzt und geklickt – die Zählung zeigt,
 *  wie viele Klicks auf echte Elemente gingen. Felder (input/select) bekommen keinen Klick, sondern den Knopf. */
function helfer(panel) {
  const zahl = { echt: 0, ersatz: 0, fehlend: {} };
  const finden = ds => {
    const sel = Object.entries(ds).filter(([, v]) => v !== undefined).map(([k, v]) => `[data-${kebab(k)}="${String(v).replace(/["\\]/g, '\\$&')}"]`).join('');
    return [...panel.shadowRoot.querySelectorAll(sel)].find(el => passt(el, ds));
  };
  const ersatz = (ds, tag = 'button') => {
    const el = global.document.createElement(tag); el.hidden = true;
    for (const [k, v] of Object.entries(ds)) if (v !== undefined) el.dataset[k] = String(v);
    (panel.shadowRoot.querySelector('.ui') || panel.shadowRoot).appendChild(el); return el;
  };
  return {
    zahl,
    klick(ds) {
      let el = finden(ds), weg = false;
      if (el && !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) zahl.echt++; else { el = ersatz(ds); weg = true; zahl.ersatz++; const k = JSON.stringify(Object.fromEntries(Object.entries(ds).filter(([k]) => ['act', 'v', 's'].includes(k)))); zahl.fehlend[k] = (zahl.fehlend[k] || 0) + 1; }
      el.dispatchEvent(new global.MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
      if (weg) el.remove();
    },
    /** Wert in ein Feld schreiben und `input` (art='input') oder `change` auslösen. */
    feld(ds, value, art = 'input') {
      let el = finden(ds), weg = false;
      if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { el = ersatz(ds, 'input'); weg = true; }
      if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(value))) { const o = global.document.createElement('option'); o.value = String(value); el.appendChild(o); }
      if (el.type === 'checkbox' && typeof value === 'boolean') el.checked = value; else el.value = String(value);
      el.dispatchEvent(new global.Event(art, { bubbles: true, composed: true }));
      if (weg) el.remove();
    },
  };
}

module.exports = { einrichten, seiteLaden, helfer, FRONTEND };
