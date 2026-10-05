// Notprogramm „Baustelle“ für Shelly Plug S Gen3 (Bauplan 0.7 §9) – ENTWURF, noch nicht am Gerät getestet.
//
// Solange Home Assistant sich meldet (Lebenszeichen), tut das Skript nichts – HA steuert. Bleibt das Lebenszeichen
// aus, schaltet das Skript nach dem Programm, das HA vorher in den Speicher (KVS) geschrieben hat. Es rechnet keine
// Fachregeln: Fenster, Soll, Frostgrenzen kommen fertig von HA (Feiertage, Urlaub, Vorheizen schon eingerechnet).
//
// Speicher (KVS, schreibt HA):
//   bs_cfg  JSON {m: "plan|thermo|bedarf|hand|aus", tol: 0.3, fe: 5, fa: 7, t: 200, d: 201, tp: 3, v: 1}
//           m = Modus, tol = Toleranz, fe/fa = Frostschutz ein unter / aus über (°C, null = aus),
//           t/d = Komponenten-Nr. des BLU H&T bzw. Türsensors (bthomesensor:<nr>, null = keiner), tp = Tür-Pause (min)
//   bs_p0 … bs_p6  Fenster als Unix-Sekunden „start,ende,soll;start,ende,soll“ (UTC – keine Zeitzonen im Gerät)
// Lebenszeichen: HA ruft alle 5 min  http://<plug>/script/<id>/hb  auf (nur im RAM, schont den Speicher).
// Stundenbuch (schreibt das Skript, nur im Notbetrieb): bb_<n> = „stunde,wh,min_ein,temp*10,tuer_s;…“ (6 h je Schlüssel)

let HB_MAX_S = 15 * 60;        // so lange ohne Lebenszeichen, dann übernimmt das Skript
let FUEHLER_MAX_S = 30 * 60;   // älter = Fühler weg → im Thermostat zurück auf Zeitplan
let TASTE_S = 3600;            // Taste: 1 h heizen
let BUCH_SCHLUESSEL = 28;      // 28 × 6 h = 7 Tage

let cfg = null, fenster = [], hbZeit = 0, frost = false, tasteBis = 0, tuerSeit = 0;
let buch = { stunde: 0, wh: 0, sek: 0, tsum: 0, tn: 0, tuer: 0, e0: null };

function jetzt() { let s = Shelly.getComponentStatus("sys"); return s && s.unixtime ? s.unixtime : 0; }   // 0 = keine Uhrzeit

// Ein Aufruf für alles (BSM-013: mehrere KVS.Get gleichzeitig → „Too many calls in progress“)
function laden() {
  Shelly.call("KVS.GetMany", { match: "bs_*" }, function (r) {
    if (!r || !r.items) return;
    let liste = r.items, f2 = [], neuCfg = null;
    for (let i = 0; i < liste.length; i++) {
      let k = liste[i].key, w = liste[i].value;
      if (k === "bs_cfg") neuCfg = JSON.parse(w);
      else if (k.indexOf("bs_p") === 0 && w) {
        let teile = w.split(";");
        for (let j = 0; j < teile.length; j++) {
          let f = teile[j].split(",");
          if (f.length === 3) f2.push({ s: JSON.parse(f[0]), e: JSON.parse(f[1]), soll: JSON.parse(f[2]) });
        }
      }
    }
    cfg = neuCfg; fenster = f2;
  });
}

function sensor(nr) {   // {wert, alter_s} oder null – PRÜFEN: Status-Felder der BTHome-Komponente in Firmware 2.x
  if (nr === null || nr === undefined) return null;
  let s = Shelly.getComponentStatus("bthomesensor:" + nr);
  if (!s || s.value === undefined) return null;
  return { wert: s.value, alter: s.last_updated_ts ? jetzt() - s.last_updated_ts : 0 };
}

function aktuellesFenster(t) {
  for (let i = 0; i < fenster.length; i++) if (fenster[i].s <= t && t < fenster[i].e) return fenster[i];
  return null;
}

// Entscheidung: soll die Heizung jetzt an sein? (nur Tabelle ausführen, keine Fachregeln)
function soll_an(t) {
  let temp = sensor(cfg.t), tuer = sensor(cfg.d);
  let tGut = temp !== null && temp.alter < FUEHLER_MAX_S;
  // Frostschutz in jedem Modus (mit Fühler)
  if (tGut && cfg.fe !== null) {
    if (temp.wert < cfg.fe) frost = true;
    if (temp.wert > cfg.fa) frost = false;
    if (frost) return true;
  }
  if (t === 0) return false;                                   // ohne Uhrzeit nur Frostschutz (Herbert)
  // Tür offen länger als die Pause → aus
  if (tuer !== null && tuer.wert === true) { if (!tuerSeit) tuerSeit = t; if (t - tuerSeit > cfg.tp * 60) return false; }
  else tuerSeit = 0;
  if (tasteBis > t) return true;                               // Taste: 1 h heizen
  if (cfg.m === "aus" || cfg.m === "hand") return null;        // aus: bleibt wie es ist (HA hat aus geschaltet); Hand: nicht anfassen
  let f = aktuellesFenster(t);
  if (f === null) return false;
  if (cfg.m === "thermo" && tGut) {                            // Thermostat: Soll ± Toleranz
    let an = Shelly.getComponentStatus("switch", 0).output;
    if (temp.wert < f.soll - cfg.tol) return true;
    if (temp.wert > f.soll + cfg.tol) return false;
    return an;
  }
  return true;                                                 // Zeitplan, Bei Bedarf (Fenster = Anforderung), Thermostat ohne Fühler
}

function schalten(an) {
  if (an === null) return;
  let ist = Shelly.getComponentStatus("switch", 0).output;
  if (ist !== an) Shelly.call("Switch.Set", { id: 0, on: an });
}

// Stundenbuch: je Stunde Wh, Minuten ein, Ø Temperatur, Tür offen – HA holt es nach dem Ausfall ab (Bauplan Datenbank Phase 7)
function buchen(t) {
  let sw = Shelly.getComponentStatus("switch", 0), stunde = Math.floor(t / 3600);
  if (buch.e0 === null) buch.e0 = sw.aenergy.total;
  if (sw.output) buch.sek += 60;
  let temp = sensor(cfg.t); if (temp !== null) { buch.tsum += temp.wert; buch.tn++; }
  if (tuerSeit) buch.tuer += 60;
  if (buch.stunde && stunde !== buch.stunde) {
    let eintrag = buch.stunde + "," + Math.round(sw.aenergy.total - buch.e0) + "," + Math.round(buch.sek / 60) + ","
      + (buch.tn ? Math.round(buch.tsum / buch.tn * 10) : "") + "," + buch.tuer;
    let key = "bb_" + (Math.floor(buch.stunde / 6) % BUCH_SCHLUESSEL);
    Shelly.call("KVS.Get", { key: key }, function (r) {
      let alt = r && r.value ? r.value.split(";") : [];
      if (alt.length && Math.floor(JSON.parse(alt[0].split(",")[0]) / 6) !== Math.floor(buch.stunde / 6)) alt = [];   // Ring: alter Block
      alt.push(eintrag);
      Shelly.call("KVS.Set", { key: key, value: alt.join(";") });
    });
    buch = { stunde: stunde, wh: 0, sek: 0, tsum: 0, tn: 0, tuer: 0, e0: sw.aenergy.total };
  }
  if (!buch.stunde) buch.stunde = stunde;
}

// jede Minute: übernimmt nur ohne Lebenszeichen
Timer.set(60 * 1000, true, function () {
  if (cfg === null) return;
  let t = jetzt(), notbetrieb = hbZeit === 0 || (t && t - hbZeit > HB_MAX_S);
  if (!notbetrieb) { buch.stunde = 0; buch.e0 = null; return; }   // HA steuert
  schalten(soll_an(t));
  if (t) buchen(t);
});

// Lebenszeichen von HA (Uhrzeit des Plugs, damit es auch ohne Uhr vergleichbar bleibt)
HTTPServer.registerEndpoint("hb", function (req, res) {
  hbZeit = jetzt() || 1;
  if (req.query === "neu") laden();                            // HA hat ein neues Programm geschrieben
  res.code = 200; res.body = JSON.stringify({ ok: true, v: cfg ? cfg.v : null, tasteBis: tasteBis }); res.send();
});

// Taste: 1 h heizen bzw. beenden (Herbert) – mit HA meldet das Skript nur, HA schaltet „Bei Bedarf“; ohne HA selbst.
// PRÜFEN: Ereignis der Taste am Plug S Gen3 und Einstellung, damit die Taste das Relais nicht direkt umschaltet.
Shelly.addEventHandler(function (ev) {
  if (!ev.info || ev.info.event !== "single_push") return;
  let t = jetzt();
  tasteBis = tasteBis > t ? 0 : t + TASTE_S;
  Shelly.emitEvent("baustelle_taste", { bis: tasteBis });       // HA: Ereignis → aktion „bedarf“ bzw. „bedarf_aus“
  if (hbZeit === 0 || t - hbZeit > HB_MAX_S) schalten(soll_an(t));
});

laden();
