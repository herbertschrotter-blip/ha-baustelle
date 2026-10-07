// Bausteine der Auswertung und Kachel-Katalog: Tabellen (Namen, Größenstufen, Vorlagen) – aus der Seite gelöst, damit
// Übersicht, Kacheln und Auswertung sie als Module nutzen (BSM-022 Stufe 3f). Nur Anzeige-Zuordnungen, keine Fachlogik.

/* WU-0005: Auswertung aus Bausteinen (Mockup glas.html Variante 6, abgenommen 30.09.2026) – [Name, Beschreibung] */
export const AW_BAUSTEINE = {
  betrag: ['Kosten groß', 'Betrag des Zeitraums, Vergleich, Gespart, Hochrechnung'], kennzahlen: ['Kennzahlen', 'kWh, Kosten, Heizzeit, Pumpzeit mit Vergleich'],
  rangliste: ['Wer verbraucht was', 'Rangliste der Container'], verlauf: ['Verbrauchsdiagramm', 'gestapelt nach Container, Baustelle oder Firma'],
  erkenntnisse: ['Was fällt auf', 'Erkenntnisse der Integration'], abrechnung: ['Abrechnung nach Firma', 'mit CSV'],
  'k-kosten': ['Kachel Kosten', 'kurz'], 'k-gespart': ['Kachel Gespart', 'kurz'], 'k-hoch': ['Kachel Hochrechnung', 'kurz'], 'k-wer': ['Kachel Wer verbraucht', 'Top 4 als Balken'],
  'k-firmen': ['Kachel Firmen', 'Betrag je Firma'], 'k-wetter': ['Kachel Wetter', 'kWh je Grad kälter'], 'k-oel': ['Kachel Ölradiator', 'Vergleich kurz'], 'k-temp': ['Kachel Temperaturen', 'jetzt je Container'],
  geraete: ['Je Gerät', 'Tabelle je Gerät'], temperaturen: ['Temperaturen', 'Diagramm heute/7/30 Tage'], wetter: ['Wetter-Einfluss', 'Streudiagramm'],
  ohne: ['Ohne Automatik', 'Vergleich mit Dauerbetrieb'], hochrechnung: ['Hochrechnung Heizperiode', 'bis Ende der Heizperiode'], vergleich: ['Ölradiator oder Konvektor', 'Tabelle'],
  leistung: ['Leistung heute', 'Diagramm heute'], links: ['Weitere Auswertungen', 'Liste zum Antippen'],
};
/* FE-0006: Größenstufen je Baustein [Name, Breite, Höhe] – nur Größen, die zum Inhalt passen (Mockup glas.html) */
export const ST_KACHEL = [['S', 1, 1], ['M', 2, 1], ['L', 2, 2]];
export const AW_STUFEN = {
  betrag: [['M', 2, 2], ['L', 4, 2]], kennzahlen: [['M', 2, 2], ['L', 4, 2]], rangliste: [['M', 2, 3], ['L', 4, 3], ['XL', 4, 4]],
  verlauf: [['S', 2, 2], ['M', 2, 3], ['L', 4, 3], ['XL', 4, 4]], erkenntnisse: [['M', 2, 2], ['L', 4, 2]], abrechnung: [['M', 2, 4], ['L', 4, 4]],
  links: [['M', 2, 3], ['L', 4, 3]], geraete: [['L', 4, 4]], temperaturen: [['M', 2, 3], ['L', 4, 3]], wetter: [['S', 1, 1], ['M', 2, 3], ['L', 4, 3]],
  ohne: [['M', 2, 2], ['L', 4, 2]], hochrechnung: [['M', 2, 3], ['L', 4, 2]], vergleich: [['M', 2, 3], ['L', 4, 3]], leistung: [['M', 2, 3], ['L', 4, 3]],
};
export const awStufen = k => AW_STUFEN[k] || ST_KACHEL;
export const awStufe = (k, w, h) => awStufen(k).reduce((best, st) => { const dd = Math.abs(st[1] - w) * 2 + Math.abs(st[2] - h); return dd < best[0] ? [dd, st] : best; }, [1e9, null])[1];
export const AW_HOEHE = { betrag: 2, kennzahlen: 2, rangliste: 4, verlauf: 4, erkenntnisse: 2, abrechnung: 4, links: 3, geraete: 4, temperaturen: 4, wetter: 4, ohne: 2, hochrechnung: 3, vergleich: 3, leistung: 3 };
/* Vorlagen = die Varianten 1–5 des Mockups [Schlüssel, Breite 1–4, Höhe 1–6] */
export const AW_VORLAGEN = {
  kacheln: ['1 · Kacheln', [['k-kosten', 2, 2], ['k-gespart', 1, 2], ['k-hoch', 1, 2], ['verlauf', 4, 4], ['k-wer', 2, 2], ['k-firmen', 2, 2], ['k-wetter', 1, 2], ['k-oel', 1, 2], ['k-temp', 2, 2]]],
  kosten: ['2 · Kosten im Fokus', [['betrag', 4, 2], ['abrechnung', 4, 4], ['verlauf', 4, 4], ['links', 4, 3]]],
  wer: ['3 · Wer verbraucht was', [['kennzahlen', 4, 2], ['rangliste', 4, 4], ['erkenntnisse', 4, 2]]],
  verlauf: ['4 · Verlauf mit Erkenntnissen', [['verlauf', 4, 4], ['erkenntnisse', 4, 2], ['kennzahlen', 4, 2], ['links', 4, 3]]],
  misch: ['5 · Mischform (Vorschlag)', [['betrag', 4, 2], ['rangliste', 4, 4], ['verlauf', 4, 4], ['erkenntnisse', 4, 2], ['k-wetter', 2, 2], ['k-oel', 2, 2], ['links', 4, 3]]],
};
export const AW_SPEICHER = 'baustelle-aw-bausteine';
/* WU-0014: Kachel-Katalog – jede Auswertung der Seite als Kachel S (1×1), M (2×1) oder L (2×2, mit oder ohne Diagramm), auf der
   Übersicht und in der Auswertung (Mockup kachel-katalog.html, Variante 3 „Suche mit Filter-Chips“, abgenommen 01.10.2026).
   Die Kacheln zeigen nur an: Beträge, gespart, Hochrechnung, Wetter, Vergleich und „Warm ab“ kommen von der Integration,
   Verläufe aus der Statistik ihrer Sensoren. je: c = je Container, f = je Container mit Fühler, p = je Schacht */
export const KK_BEREICHE = [['baustelle', 'Baustelle'], ['container', 'Container'], ['pumpen', 'Pumpen'], ['heizung', 'Heizung'], ['auswertung', 'Auswertung']];
export const KK = {
  'b-kosten': { ber: 'baustelle', ic: '💶', name: 'Kosten & Verbrauch', text: 'Betrag und kWh im Zeitraum, Vergleich zum Zeitraum davor', such: 'euro geld kwh strom monat' },
  'b-gespart': { ber: 'baustelle', ic: '🌱', name: 'Gespart · ohne Automatik', text: 'Was die Automatik gegenüber Dauerbetrieb spart', such: 'euro ersparnis 24/7 dauerbetrieb' },
  'b-hoch': { ber: 'baustelle', ic: '📅', name: 'Hochrechnung Heizperiode', text: 'Kosten bis Ende der Heizperiode, mit und ohne Automatik', such: 'prognose euro heizperiode ende' },
  'b-wetter': { ber: 'baustelle', ic: '🌦', name: 'Wetter-Einfluss', text: 'kWh je Grad kälter, letzte 30 Heiztage', such: 'temperatur außen kälte grad' },
  'b-strom': { ber: 'baustelle', ic: '⚡', name: 'Stromverteilung · Staffelung', text: 'Last je Anschluss, Grenze und Reserve', such: 'anschluss ampere kw last verteiler staffel' },
  'b-oel': { ber: 'baustelle', ic: '⚖', name: 'Ölradiator-Ersparnis', text: 'Ölradiator gegen Konvektor, fair verglichen', such: 'konvektor heizkörper typ vergleich euro' },
  'b-preis': { ber: 'baustelle', ic: '🧮', name: 'Preis simulieren', text: 'Verbrauch mit einem anderen Strompreis – was hätte es gekostet', such: 'euro preis simulieren tarif was wäre wenn' },
  'b-geraete': { ber: 'baustelle', ic: '📶', name: 'Geräte · erreichbar & Signal', text: 'Wie viele Shellys antworten, WLAN-Signal', such: 'shelly wlan signal offline erreichbar' },
  'b-wer': { ber: 'baustelle', ic: '🔥', name: 'Wer verbraucht was', text: 'Rangliste der Container nach kWh', such: 'rangliste container verbrauch kwh euro' },
  'c-temp': { ber: 'container', je: 'f', ic: '🌡', name: 'Temperatur', text: 'innen jetzt, Verlauf heute mit außen', such: 'grad celsius fühler innen außen' },
  'c-leistung': { ber: 'container', je: 'c', ic: '⚡', name: 'Leistung jetzt', text: 'kW gerade, Stundenmittel heute', such: 'kw watt strom gerade' },
  'c-verbrauch': { ber: 'container', je: 'c', ic: '📊', name: 'Verbrauch', text: 'kWh im Zeitraum, Vergleich zum Zeitraum davor', such: 'kwh energie strom tag' },
  'c-kosten': { ber: 'container', je: 'c', ic: '💶', name: 'Kosten', text: 'Euro im Zeitraum (kWh × Strompreis)', such: 'euro geld preis' },
  'c-heizzeit': { ber: 'container', je: 'c', ic: '⏱', name: 'Heizzeit', text: 'eingeschaltet und tatsächlich geheizt', such: 'stunden laufzeit zeit strom' },
  'c-ohne': { ber: 'container', je: 'c', ic: '🌱', name: 'Ohne Automatik', text: 'Container gegen Dauerbetrieb (24/7)', such: 'gespart ersparnis dauerbetrieb euro' },
  'c-warm': { ber: 'container', je: 'f', ic: '🧠', name: 'Warm ab (lernend)', text: 'Gelernter Heizbeginn, damit das Soll rechtzeitig erreicht ist', such: 'lernen aufheizen beginn start' },
  'v-kwh': { ber: 'container', je: 'v', ic: '⚖', name: 'Vergleich kWh', text: '2–4 Container gegenüber – Verbrauch', such: 'vergleich gegenüber kwh verbrauch container' },   // WU-0017
  'v-eur': { ber: 'container', je: 'v', ic: '⚖', name: 'Vergleich Kosten', text: '2–4 Container gegenüber – Kosten in €', such: 'vergleich gegenüber euro kosten container' },
  'p-pumpzeit': { ber: 'pumpen', je: 'p', ic: '⏱', name: 'Pumpzeit', text: 'Wie lange gepumpt wurde', such: 'schacht pumpe laufzeit stunden wasser' },
  'p-zyklen': { ber: 'pumpen', je: 'p', ic: '🔁', name: 'Zyklen', text: 'Ein/Aus im Zeitraum – viele deuten auf Schwimmer oder Grundwasser', such: 'schacht pumpe schwimmer an aus' },
  'h-plan': { ber: 'heizung', ic: '📅', name: 'Heizplan heute / Woche', text: 'Vorheizen, Arbeitszeit, Nachheizen, Trocknen', such: 'zeitplan arbeitszeit vorheizen nachheizen woche' },
  'h-wann': { ber: 'heizung', ic: '🔥', name: 'Wann heizt was', text: 'Heizzeiten je Container heute', such: 'container zeitstrahl heute heizzeiten' },
};
export const KK_GROESSE = [['S', 'Klein', '1×1'], ['M', 'Mittel', '2×1'], ['L', 'Groß', '2×2']];
export const KK_SPEICHER = 'baustelle-kacheln-uebersicht';
export const KK_START = [{ k: 'b-kosten', st: 'M' }, { k: 'b-gespart', st: 'M' }, { k: 'h-wann', st: 'M' }];
export const KK_JEDES = { Tag: 6, Woche: 1, Monat: 7, Jahr: 3 };

