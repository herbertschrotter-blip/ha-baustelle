// Rechte der Seite „Baustelle“: Nur-Lesen-Sperre und Vor-Ort-Aktionen (Bauplan 0.7 §8, BSM-022 Stufe 1c).

/* Bauplan 0.7 §8: Nicht-Admins sehen nur an. Gesperrt wird in der Integration; hier nur ausgegraut, was ändert
   (Schalter, die nur in der Seite wirken – Melden, Bedarf-Auswahl, Kachel-Katalog, eigene Auswertung –, bleiben frei).
   Was vor Ort trotzdem geht, liefert die Integration (`rechte.aktionen`); solche Knöpfe tragen die Klasse vor-ort. */
export const NUR_ANSEHEN = 'Nur ansehen – ändern dürfen nur Admins';
export const NUR_LESEN_SPERRE = ['.sw:not(.ml-stand):not(.vor-ort)', '.nur-admin'];   // ausgegraut; Klicks sperrt p.nurAdmin bzw. die Integration

/* Bauplan 0.7 §8: Rechte des angemeldeten Benutzers aus baustelle/struktur (ohne Angabe: alles wie bisher) */
export function rechteVon(roh) { const r = (roh || [])[0]; return (r && r.rechte) || { aendern: true, aktionen: [] }; }
export function darfSenden(msg, rechte) {   // Meldungen entscheidet die Integration (melden darf jeder, Status nur Admins)
  if (!!rechte.aendern || msg.type === 'baustelle/meldung') return true;
  return msg.type === 'baustelle/aktion' && rechte.aktionen.includes(msg.aktion);
}
