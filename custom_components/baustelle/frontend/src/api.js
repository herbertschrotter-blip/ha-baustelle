// Aufrufe an die Integration und an HA (docs/api-0.7.md §2): Fehlertexte und Antworten der Einrichtungs-Dialoge
// (BSM-022 Stufe 1c).

/* Schreibende Nachrichten an die Integration (api §2) – gesendet über BaustellePanel.ws (Rechte, Hinweis, Neuladen) */
export const nachricht = {
  setzen: (entry, pfad, wert) => ({ type: 'baustelle/setzen', entry_id: entry, pfad, wert }),
  aktion: (entry, aktion, felder) => ({ type: 'baustelle/aktion', entry_id: entry, aktion, ...felder }),
  liste: (entry, liste, aktion, eintrag) => ({ type: 'baustelle/liste', entry_id: entry, liste, aktion, eintrag }),
};
/* Antworten auswerten */
export function fehlerText(e) { return (e && e.body && e.body.message) || (e && e.message) || (e && e.code) || String(e); }
export function flowFehler(r) { return r && ((r.type === 'form' && r.errors && (r.errors.base || Object.values(r.errors)[0])) || (r.type === 'abort' && !['reconfigure_successful'].includes(r.reason) && r.reason)); }
