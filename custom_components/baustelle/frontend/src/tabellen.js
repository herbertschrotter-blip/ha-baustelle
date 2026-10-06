// Zuordnungstabellen der Seite „Baustelle“: Zustände, Modi, Gerätetypen, Meldungsarten → Anzeige (BSM-022 Stufe 1c).
export const FARBE = { bereit: '#8e8e93', heizt: '#ff9f0a', trocknen: '#ff9f0a', aus: '#8e8e93', frost: '#64d2ff', offline: '#ff453a', laeuft: '#0a84ff', pause: '#bf5af2' };

export const WIEDER = { einmal: 'einmalig', woche: 'jede Woche', '2wochen': 'alle 2 Wochen' };

export const AUSNAHME = { arbeit: 'zusätzlich arbeiten', zeiten: 'andere Zeiten', frei: 'frei' };

/* Zuordnung der Geräte: Rolle und Typ der Integration → Anzeige wie im Mockup */
export const HEIZER = g => ['heizung', 'heizkoerper'].includes(g.rolle);

export const TYP_TEXT = g => g.rolle === 'pumpe' ? 'Pumpe' : HEIZER(g) ? (g.typ === 'konvektor' ? 'Konvektor' : 'Ölradiator')
  : ['trockner', 'bautrockner'].includes(g.rolle) ? 'Bautrockner' : 'Steckdose';

/* Modus je Container (0.7.8): wie im Mockup, Thermostat nur mit Fühler */
export const MODI = [['plan', 'Zeitplan'], ['thermo', 'Thermostat'], ['bedarf', 'Bei Bedarf'], ['hand', 'Hand'], ['aus', 'Aus']];

export const FREI_TEXT = { frost: 'nur Frostschutz', absenk: 'abgesenkt', aus: 'alles aus' };

export const ARTEN = { m_selbst: 'selbst_ein', m_offline: 'offline', m_trocken: 'trockenlauf', m_dauer: 'dauerlauf', m_zyklen: 'zyklen_oft', m_leistung: 'keine_leistung', m_frost: 'frostgefahr',
  m_kalt: 'zu_kalt', m_fuehler: 'fuehler_fehlt', m_wetter: 'kein_wetter', m_hand: 'hand_zu_lange' };
