// Notprogramm „Baustelle“ für Shelly Plug S Gen3 (Bauplan 0.7 §9, BSM-016). Die Integration spielt es ein.
//
// Solange Home Assistant sich meldet (Lebenszeichen), tut das Skript nichts – HA steuert. Bleibt das Lebenszeichen
// HB_MAX_MIN aus (auch nach einem Neustart des Plugs), schaltet es nach dem Programm, das HA in den Speicher (KVS) geschrieben hat, bis HA zurück ist. Es
// rechnet keine Fachregeln: Fenster, Soll, Frostgrenzen kommen fertig von HA (Feiertage, Urlaub, Vorheizen eingerechnet).
//
// Speicher (schreibt HA; Grenzen am Gerät: Wert ≤ 253 Zeichen, ≤ 50 Schlüssel):
//   bs_cfg  {"v":1,"m":"plan|thermo|bedarf|hand|aus","tol":0.3,"fe":5,"fa":7,"t":202,"d":null,"tp":3}
//           m Modus, tol Toleranz, fe/fa Frostschutz ein unter/aus über (°C, null = aus), t/d Nummer des Messwerts
//           Temperatur bzw. Tür (bthomesensor:<nr>, null = keiner), tp Tür-Pause in Minuten
//   bs_p0 … bs_p6  Fenster „start,ende,soll;…“ in Unix-Sekunden (UTC, keine Zeitzonen im Gerät)
// Lebenszeichen: HA ruft alle 5 min  http://<plug>/script/<id>/hb  auf (?neu = Programm neu laden); die Antwort nennt
//   Version, Stand des Programms, Notbetrieb seit (0 = nein) und das Ende der Taste.
// Stundenbuch (nur im Notbetrieb): bb_<0…27> = „stunde,wh,min_ein,temp*10,tuer_s;…“ – 6 Stunden je Schlüssel, 7 Tage
//   im Ring; HA holt es nach dem Ausfall ab und trägt es nach (BSM-020).
// Grenzen am Gerät (BSM-013): höchstens 5 gleichzeitige Aufrufe je Skript – hier höchstens zwei; Arbeitsspeicher
// für alle Skripte zusammen knapp (Plug S Gen3) – Fenster als Zahlenlisten, keine großen Objekte.

let VERSION = 3;
let HB_MAX_MIN = 15;        // Minuten ohne Lebenszeichen → Notbetrieb (gezählt, braucht keine Uhrzeit)
let FUEHLER_MAX_S = 1800;   // älterer Fühlerwert gilt als weg → im Thermostat wie Zeitplan
let TASTE_S = 3600;         // Taste: 1 h heizen
let BUCH_N = 28;            // Schlüssel im Stundenbuch (28 × 6 h = 7 Tage)

let cfg = null, fen = [], still = 0, nbSeit = 0, frost = false, taste = 0, tuerSeit = 0;
let bStunde = 0, bE0 = -1, bSek = 0, bTs = 0, bTn = 0, bTuer = 0;

function jetzt() { let s = Shelly.getComponentStatus("sys"); return s && s.unixtime ? s.unixtime : 0; }   // 0 = keine Uhrzeit

function laden() {   // ein Aufruf für alles
  Shelly.call("KVS.GetMany", { match: "bs_*" }, function (r) {
    if (!r || !r.items) return;
    let c = null, f = [];
    for (let i = 0; i < r.items.length; i++) {
      let k = r.items[i].key, w = r.items[i].value;
      if (k === "bs_cfg") c = JSON.parse(w);
      else if (k.indexOf("bs_p") === 0 && w) {
        let teile = w.split(";");
        for (let j = 0; j < teile.length; j++) {
          let x = teile[j].split(",");
          if (x.length === 3) f.push([JSON.parse(x[0]), JSON.parse(x[1]), JSON.parse(x[2])]);
        }
      }
    }
    cfg = c; fen = f;
  });
}

function wert(nr) {   // [wert, alter in s] oder null
  if (nr === null || nr === undefined) return null;
  let s = Shelly.getComponentStatus("bthomesensor:" + nr);
  if (!s || s.value === undefined || s.value === null) return null;
  let t = jetzt();
  return [s.value, t && s.last_updated_ts ? t - s.last_updated_ts : 0];
}

function fenster(t) {
  for (let i = 0; i < fen.length; i++) if (fen[i][0] <= t && t < fen[i][1]) return fen[i];
  return null;
}

function an() { return Shelly.getComponentStatus("switch", 0).output; }

// Soll die Heizung jetzt an sein? true/false, null = nicht anfassen (nur Tabelle ausführen, keine Fachregeln;
// Reihenfolge wie logik/regelung: Frost → Tür → Taste → Hand → Aus → Fenster)
function entscheiden(t) {
  let temp = wert(cfg.t), tuer = wert(cfg.d);
  let ok = temp !== null && temp[1] < FUEHLER_MAX_S;
  let frostEnde = false;
  if (ok && cfg.fe !== null && cfg.fe !== undefined) {   // Frostschutz in jedem Modus
    if (temp[0] < cfg.fe) frost = true;
    if (frost && temp[0] >= cfg.fa) { frost = false; frostEnde = true; }
    if (frost) return true;
  }
  if (t === 0) return false;                               // ohne Uhrzeit nur Frostschutz
  if (tuer !== null && tuer[0] === true) { if (!tuerSeit) tuerSeit = t; if (t - tuerSeit > cfg.tp * 60) return false; }
  else tuerSeit = 0;
  if (taste > t) return true;                              // Taste: 1 h heizen
  if (cfg.m === "hand") return frostEnde ? false : null;   // Frost vorbei: einmal aus, danach nicht anfassen
  if (cfg.m === "aus") return false;
  let f = fenster(t);
  if (f === null) return false;
  if (cfg.m === "thermo" && ok) {
    if (temp[0] < f[2] - cfg.tol) return true;
    if (temp[0] > f[2] + cfg.tol) return false;
    return an();
  }
  return true;                                             // Zeitplan, Bei Bedarf, Thermostat ohne Fühler
}

function schalten(soll) {
  if (soll === null || soll === an()) return;
  Shelly.call("Switch.Set", { id: 0, on: soll });
}

// Stundenbuch: je Stunde Wh, Minuten ein, Ø Temperatur*10, Tür offen in s – geschrieben beim Stundenwechsel
function buchen(t) {
  let sw = Shelly.getComponentStatus("switch", 0), e = sw.aenergy ? sw.aenergy.total : 0, h = Math.floor(t / 3600);
  if (bStunde && h !== bStunde) {
    let eintrag = bStunde + "," + Math.round(e - bE0) + "," + Math.round(bSek / 60) + "," + (bTn ? Math.round(bTs / bTn * 10) : "") + "," + bTuer;
    let key = "bb_" + (Math.floor(bStunde / 6) % BUCH_N), block = Math.floor(bStunde / 6);
    Shelly.call("KVS.Get", { key: key }, function (r) {
      let alt = r && r.value ? r.value.split(";") : [];
      if (alt.length && Math.floor(JSON.parse(alt[0].split(",")[0]) / 6) !== block) alt = [];   // Ring: alter Block
      alt.push(eintrag);
      Shelly.call("KVS.Set", { key: key, value: alt.join(";") });
    });
    bSek = 0; bTs = 0; bTn = 0; bTuer = 0;
  }
  if (!bStunde || h !== bStunde) { bStunde = h; bE0 = e; }
  if (sw.output) bSek += 60;
  let temp = cfg ? wert(cfg.t) : null;
  if (temp !== null) { bTs += temp[0]; bTn++; }
  if (tuerSeit) bTuer += 60;
}

// jede Minute
Timer.set(60000, true, function () {
  if (cfg === null) return;
  let t = jetzt();
  still++;
  if (still <= HB_MAX_MIN) { nbSeit = 0; bStunde = 0; return; }   // HA steuert
  if (!nbSeit) nbSeit = t || 1;
  schalten(entscheiden(t));
  if (t) buchen(t);
});

// Lebenszeichen von HA
HTTPServer.registerEndpoint("hb", function (req, res) {
  res.code = 200;
  res.body = JSON.stringify({ v: VERSION, programm: cfg ? cfg.v : null, fenster: fen.length, nb: nbSeit, taste: taste });
  res.send();
  still = 0; nbSeit = 0;
  if (req.query && req.query.indexOf("neu") >= 0) laden();
});

// Taste: 1 h heizen bzw. beenden – mit HA nur melden (HA schaltet „Bei Bedarf“), ohne HA selbst.
// PRÜFEN am Gerät (BSM-013): Name des Tastenereignisses beim Plug S Gen3; die Taste darf das Relais nicht selbst schalten.
// Tasten gekoppelter Bluetooth-Sensoren (bthomedevice/bthomesensor) melden ebenfalls „single_push“ – nicht mitzählen.
Shelly.addEventHandler(function (ev) {
  if (!ev || !ev.info || ev.info.event !== "single_push") return;
  let k = ev.component || ev.info.component || "";
  if (k.indexOf("bthome") === 0) return;
  let t = jetzt();
  taste = taste > t ? 0 : t + TASTE_S;
  Shelly.emitEvent("baustelle_taste", { bis: taste });
  if (cfg !== null && still > HB_MAX_MIN) schalten(entscheiden(t));
});

laden();
