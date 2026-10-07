// Rechte der Seite „Baustelle“: Nur-Lesen-Sperre und Vor-Ort-Aktionen (Bauplan 0.7 §8, BSM-022 Stufe 1c).

/* Bauplan 0.7 §8: Nicht-Admins sehen nur an. Gesperrt wird in der Integration; hier nur ausgegraut, was ändert
   (Schalter, die nur in der Seite wirken – Melden, Bedarf-Auswahl, Kachel-Katalog, eigene Auswertung –, bleiben frei).
   Was vor Ort trotzdem geht, liefert die Integration (`rechte.aktionen`); VOR_ORT ordnet die Knöpfe diesen Aktionen zu. */
export const NUR_ANSEHEN = 'Nur ansehen – ändern dürfen nur Admins';
export const NUR_LESEN_SPERRE = ['.sw:not(.ml-stand):not(.vor-ort):not([data-act="bedarf-boost"]):not([data-act="kk-dia-w"]):not([data-act="aw-an"])', '[data-act$="-speichern"]', '[data-act$="-weg"]', '[data-act$="-bearbeiten"]', '[data-act="lern-reset"]',
  '[data-act="abschliessen"]', '[data-act="neu-anlegen"]', '.nur-admin', '[data-act="wetterquelle-auf"]', 'input[data-k]', 'select[data-jm]',
  ...['termin', 'urlaub', 'container-neu', 'wetterquelle', 'bs-loeschen', 'zeitraum-bs', 'name', 'baustelle-neu'].map(x => `[data-act="sheet"][data-s="${x}"]`)];
export const VOR_ORT = { 'w-stumm': 'warnung_stumm', 'sg-gefuehl': 'gefuehl', 'bedarf-auf': 'bedarf', 'bedarf-an': 'bedarf', 'bedarf-aus': 'bedarf_aus',
  boost: 'boost', 'jetzt-an': 'jetzt_heizen', 'jetzt-aus': 'jetzt_heizen' };

/* Bauplan 0.7 §8: Rechte des angemeldeten Benutzers aus baustelle/struktur (ohne Angabe: alles wie bisher) */
export function rechteVon(roh) { const r = (roh || [])[0]; return (r && r.rechte) || { aendern: true, aktionen: [] }; }
export function gesperrt(el, rechte) {
  if (!!rechte.aendern || !el || !el.matches) return false;
  const a = VOR_ORT[el.dataset && el.dataset.act]; return a ? !rechte.aktionen.includes(a) : NUR_LESEN_SPERRE.some(x => el.matches(x));
}
export function darfSenden(msg, rechte) {   // Meldungen entscheidet die Integration (melden darf jeder, Status nur Admins)
  if (!!rechte.aendern || msg.type === 'baustelle/meldung') return true;
  return msg.type === 'baustelle/aktion' && rechte.aktionen.includes(msg.aktion);
}
