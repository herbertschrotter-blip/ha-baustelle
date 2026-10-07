/* =========================================================================================
   Baustelle – eigene Seite in Home Assistant (0.7.0), gebaut aus dem abgenommenen Mockup mockups/glas.html
   (Quellen mockups/quelle/: glas-app.js, glas.css, himmel.frag, himmel.js).
   Daten: WebSocket „baustelle/struktur“ (docs/api-0.7.md §1), Verlauf/Statistik aus dem Recorder.
   Bedienung: baustelle/setzen|aktion|liste|protokoll|meldung(en) (api §2) und die HA-Standardwege
   (Subentry-/Options-Dialoge, calendar/event/*, Diagnose). Gerechnet wird in der Integration, nicht hier.
   ========================================================================================= */
import { ARTEN, AUSNAHME, FARBE, MODI, TEXT, TICKET_STATUS, WARTE, WIEDER, illu, kwVon, wertHtml } from './tabellen.js';

import { Himmel, himmelLauf, partikel, phaseAusSonne } from './himmel.js';
import { CHARTS, balken, flaeche, funke, kkBalken, linie, linien, streu, stufen } from './diagramme.js';

import { MONATE, MONATE_LANG, TAGE, addieren, datum, dauer, de, erkl, esc, knopf2, kurzDatum, kwNr, minu, plusTage, schalter, stdMin, summe, tageZwischen, uhr, verNeuer, wtag, zahl, zrInfo, zrVersatz } from './hilfen.js';
import { BEREICH_FARBEN, ICON_COG, ICON_MELDEN, SYMBOL_STANDARD, bcContainer, sigHtml, sigStufe, wetterIcon } from './symbole.js';
import { bauen, lokal, minSeitAb, protokollZeile, zoneMs } from './daten.js';
import { NUR_ANSEHEN, NUR_LESEN_SPERRE, darfSenden, gesperrt, rechteVon } from './rechte.js';
import { fehlerText, flowFehler, nachricht } from './api.js';
import { LitElement, html, render as litRender, unsafeCSS } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { keyed } from 'lit/directives/keyed.js';
import { ueberVorlage } from './ueber.js';
import { MB_MAX, MB_PX, meldenVorlage } from './melden.js';
import { ladenVorlage, leerVorlage } from './ansichten/allgemein.js';
import { devVorlage } from './ansichten/dev.js';
import { bsdetailVorlage, verlaufVorlage } from './ansichten/verlauf.js';
import { pumpenVorlage, schachtVorlage } from './ansichten/pumpen.js';
import { containerVorlage } from './ansichten/container.js';

const CSS = `/* Wetter */
.wetter .wjetzt { display: flex; align-items: center; gap: 14px; }
.wetter .wjetzt .big { font-size: 34px; line-height: 1.1; }
.wetter .wtage { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; border-top: 1px solid var(--divider-color); padding-top: 10px; }
.wetter .wtag { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.wetter .wt { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
.wetter .max { font-weight: 600; }
.wetter .frost { color: #2a78d6; font-weight: 600; }
.wetter .regen { color: #2a78d6; }
@keyframes wi-dreh { to { transform: rotate(360deg); } }
@keyframes wi-wolke { 0%, 100% { transform: translateX(-1.5px); } 50% { transform: translateX(1.5px); } }
@keyframes wi-tropfen { 0% { transform: translateY(-5px); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateY(9px); opacity: 0; } }
@keyframes wi-flocke { 0% { transform: translate(-1px, -5px); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(2px, 9px); opacity: 0; } }
@keyframes wi-blitz { 0%, 86%, 100% { opacity: .15; } 88%, 93% { opacity: 1; } 90% { opacity: .3; } }
@keyframes wi-nebel { 0%, 100% { transform: translateX(-3px); } 50% { transform: translateX(3px); } }
@keyframes wi-stern { 50% { opacity: .2; } }
@keyframes wi-wind { 0% { stroke-dashoffset: 60; } 100% { stroke-dashoffset: 0; } }
.wi .wi-dreh { animation: wi-dreh 18s linear infinite; }
.wi .wi-wolke > g { animation: wi-wolke 6s ease-in-out infinite; }
.wr .wr-kristall { transform-box: fill-box; animation: wi-dreh 6s linear infinite; }
@keyframes wb-puls { 0%, 100% { opacity: .55; transform: scale(.94); } 50% { opacity: 1; transform: scale(1.06); } }
.wi .wb-puls { transform-box: fill-box; transform-origin: center; animation: wb-puls 3.5s ease-in-out infinite; }
.wi .wi-tropfen { animation: wi-tropfen 1.3s linear infinite; }
.wi .wi-flocke { animation: wi-flocke 2.6s linear infinite; }
.wi .wi-blitz { animation: wi-blitz 3.2s linear infinite; }
.wi .wi-nebel { animation: wi-nebel 5s ease-in-out infinite; }
.wi .wi-stern { animation: wi-stern 2.4s ease-in-out infinite; }
.wi .wi-wind { stroke-dasharray: 60; animation: wi-wind 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .wi * { animation: none !important; } }

/* Übersicht: Baustelle und Container als Kacheln */
.bc { width: 100%; height: auto; display: block; overflow: visible; } .bc.offline { filter: grayscale(.8) brightness(.8); }
@keyframes rein { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes atmen { 50% { opacity: .55; } }
@keyframes fuellen { from { width: 0; } }
@keyframes blitz { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12) rotate(-6deg); } }
.bc-licht { filter: drop-shadow(0 0 4px #ffd54f); }   /* BSM-032 */
.sym-zeile { gap: 10px; } .sym-zeile > div { flex: 1; text-align: left; } .sym-mini { width: 56px; flex: none; } .sym-mini svg { width: 100%; height: auto; display: block; }
.sym-vorschau { max-width: 320px; margin: 0 auto 10px; } .sym-vorschau svg { width: 100%; height: auto; }
.sym-farben { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.sym-farbe { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; padding: 0; } .sym-farbe.on { border-color: var(--ink); box-shadow: 0 0 0 2px rgba(0,0,0,.4); }
.bc-glut { animation: bc-glut 2.6s ease-in-out infinite; } @keyframes bc-glut { 50% { fill: #ffd180; filter: drop-shadow(0 0 4px #ff9800); } }
.bc-waerme { animation: bc-waerme 2.1s ease-in infinite; opacity: 0; } @keyframes bc-waerme { 0% { transform: translateY(6px); opacity: 0; } 30% { opacity: .9; } 100% { transform: translateY(-12px); opacity: 0; } }
.bc-jacke { animation: bc-jacke 2.4s ease-in-out infinite; } @keyframes bc-jacke { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
.bc-eis { animation: bc-eis 2s ease-in-out infinite; } @keyframes bc-eis { 50% { opacity: .3; } }
.bc-alarm { animation: bc-alarm 1s steps(2) infinite; } @keyframes bc-alarm { 50% { opacity: .25; } }
.bc-pegel { animation: bc-pegel 5s ease-in-out infinite; } @keyframes bc-pegel { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
.bc-welle { animation: bc-welle 3s linear infinite; } @keyframes bc-welle { to { transform: translateX(-60px); } }
.bc-rad { animation: bc-rad .9s linear infinite; transform-box: fill-box; transform-origin: center; } @keyframes bc-rad { to { transform: rotate(360deg); } }
.bc-fluss { stroke-dasharray: 5 5; animation: bc-fluss .6s linear infinite; } @keyframes bc-fluss { to { stroke-dashoffset: -10; } }
@media (prefers-reduced-motion: reduce) { .bc *, .kc, .kc *, .bk * { animation: none !important; } }
`;

/* Glas-Stil aus dem Mockup (mockups/quelle/glas.css) */
const GLAS_CSS = `:host { display: block; height: 100%; }
.lit-bereich { display: contents; }   /* dauerhafter Lit-Bereich (BSM-022 2a.1) – ohne eigene Box */
.wurzel { position: relative; height: 100vh; height: 100dvh; background: #0b0b0b; color: #fff; font-family: -apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif; font-size: 14px; }
.wurzel.hell { background: #d9dee5; color: #111; }
/* Seitenleiste auf dem Handy (HA zeigt bei eigenen Seiten keinen Kopf) */
.still .glas-k { animation: schweben2 6s ease-in-out infinite; } .still .glas-k.neu, .still .bs-karte, .still .fl-flaeche, .still .fl-linie, .still .hb-spur i, .still .w-inhalt, .still .hz-kachel { animation: none; }
.menue-knopf { position: absolute; top: 10px; left: 14px; z-index: 6; width: 36px; height: 36px; border-radius: 50% !important; display: grid; place-items: center; font-size: 17px; color: var(--ink2); }
/* Glas-Stil (Variante C) – klickbarer Prototyp */

/* Farben der Diagramme (validierte Palette, eigene Stufen für dunkel) */
.ui { position: absolute; inset: 0; }
.app { --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300;
  --ink: #fff; --ink2: rgba(255,255,255,.66); --gridc: rgba(255,255,255,.14); --axisc: rgba(255,255,255,.55); --amber: #ff9f0a; --rot: #ff6961; --blau: #64a8ff;
  --panel: rgba(255,255,255,.05); --panel-rand: rgba(255,255,255,.2); --sheet: rgba(28,32,44,.82);
  --fenster: #2b3a44; --rahmen: #cfd8dc; --wr-nebel: #c5d0d7; --wr-wind: #cfe3f3;
  position: relative; height: 100%; overflow: hidden; color: var(--ink); container-type: inline-size; }
.hell .app { --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #e87ba4; --s6: #008300;
  --ink: #111; --ink2: rgba(0,0,0,.6); --gridc: rgba(0,0,0,.1); --axisc: rgba(0,0,0,.5); --amber: #d97800; --rot: #d7372b; --blau: #0a64d6;
  --panel: rgba(255,255,255,.2); --panel-rand: rgba(255,255,255,.65); --sheet: rgba(250,250,252,.86);
  --fenster: #cfe3f3; --rahmen: #eceff1; --wr-nebel: #8a99a3; --wr-wind: #7d98ad; }
/* Grundform für Knöpfe ohne Gewicht (:where), damit Klassen wie .glas-panel oder .glas-kw sie überschreiben */
:where(.app button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; }
.app input, .app select { font: inherit; color: var(--ink); background: rgba(127,127,127,.16); border: 1px solid var(--panel-rand); border-radius: 10px; padding: 7px 10px; }
.app select option { color: #111; }

/* Hintergrund: Stimmung nach Tageszeit und Wetter. Farben als registrierte Eigenschaften, damit sie weich überblenden */
@property --g1 { syntax: '<color>'; inherits: true; initial-value: #1c3552; }
@property --g2 { syntax: '<color>'; inherits: true; initial-value: #1f4a70; }
@property --g3 { syntax: '<color>'; inherits: true; initial-value: #2a5575; }
@property --f1 { syntax: '<color>'; inherits: true; initial-value: #ffd27a; }
@property --f2 { syntax: '<color>'; inherits: true; initial-value: #3aa0ff; }
@property --f3 { syntax: '<color>'; inherits: true; initial-value: #7fd0ff; }
.glas-bg { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(165deg, var(--g1) 0%, var(--g2) 50%, var(--g3) 100%);
  transition: --g1 2.5s, --g2 2.5s, --g3 2.5s, --f1 2.5s, --f2 2.5s, --f3 2.5s; --dunst-farbe: #3c4655; --tropfen: rgba(200,225,255,.6); }
.glas-bg[data-phase=morgen] { --g1: #2e2748; --g2: #4a3150; --g3: #6b4040; --f1: #ff8a5c; --f2: #6a7bd6; --f3: #d07ab8; }
.glas-bg[data-phase=tag]    { --g1: #1c3552; --g2: #1f4a70; --g3: #2a5575; --f1: #ffc766; --f2: #3aa0ff; --f3: #7fd0ff; }
.glas-bg[data-phase=abend]  { --g1: #2a1a36; --g2: #45203d; --g3: #5a2a2c; --f1: #ff7a2e; --f2: #d0457a; --f3: #7a4bd0; }
.glas-bg[data-phase=nacht]  { --g1: #070d1c; --g2: #0c1528; --g3: #131a33; --f1: #2c3e8a; --f2: #1b4a7a; --f3: #4b3a8a; }
.hell .glas-bg { --dunst-farbe: #c9ced6; --tropfen: rgba(50,80,120,.35); }
.hell .glas-bg[data-phase=morgen] { --g1: #ffd9c7; --g2: #f5e0f0; --g3: #cfdcff; --f1: #ff9a6a; --f2: #9fb4ff; --f3: #f0a0c8; }
.hell .glas-bg[data-phase=tag]    { --g1: #cfe6ff; --g2: #e3f1ff; --g3: #fff3d6; --f1: #ffd060; --f2: #6ab8ff; --f3: #a8e0ff; }
.hell .glas-bg[data-phase=abend]  { --g1: #ffd2b0; --g2: #f7c6d8; --g3: #d9ccff; --f1: #ff8a3a; --f2: #ff6f9a; --f3: #a58aff; }
.hell .glas-bg[data-phase=nacht]  { --g1: #b9c4e0; --g2: #c9cde6; --g3: #d8d0ec; --f1: #6d80c8; --f2: #7fa3dc; --f3: #9a88d2; }
.glas-bg > i { position: absolute; border-radius: 50%; filter: blur(40px) saturate(1); opacity: .7; animation: schweben 14s ease-in-out infinite; transition: filter 2.5s, opacity 2.5s; }
.glas-bg .k1 { width: 260px; height: 260px; background: var(--f1); top: -60px; left: -60px; }
.glas-bg .k2 { width: 240px; height: 240px; background: var(--f2); top: 300px; right: -80px; animation-delay: -5s; }
.glas-bg .k3 { width: 200px; height: 200px; background: var(--f3); bottom: -40px; left: 40px; animation-delay: -9s; }
.glas-bg[data-phase=nacht] > i { opacity: .45; }
/* Wetter dämpft die Farben und legt Dunst darüber */
.dunst { position: absolute; inset: 0; background: var(--dunst-farbe); opacity: 0; transition: opacity 2.5s; }
.glas-bg[data-wetter=wolkig] .dunst { opacity: .3; }  .glas-bg[data-wetter=wolkig] > i { filter: blur(50px) saturate(.6); }
.glas-bg[data-wetter=regen] .dunst { opacity: .42; }  .glas-bg[data-wetter=regen] > i { filter: blur(55px) saturate(.45); opacity: .5; }
.glas-bg[data-wetter=gewitter] .dunst { opacity: .55; background: #1c2230; } .glas-bg[data-wetter=gewitter] > i { filter: blur(55px) saturate(.35); opacity: .4; }
.hell .glas-bg[data-wetter=gewitter] .dunst { background: #9aa3b2; }
.glas-bg[data-wetter=nebel] .dunst { opacity: .62; }  .glas-bg[data-wetter=nebel] > i { filter: blur(70px) saturate(.3); opacity: .35; }
.glas-bg[data-wetter=schnee] .dunst { opacity: .35; background: #dfe8f2; } .glas-bg[data-wetter=schnee] > i { filter: blur(50px) saturate(.4); }
.glas-bg:not(.hell *)[data-wetter=schnee] .dunst { opacity: .16; }
/* Bewegung */
.partikel { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.partikel i { position: absolute; display: block; }
.tropfen { top: -40px; width: 1.5px; height: var(--l); border-radius: 1px; background: linear-gradient(transparent, var(--tropfen));
  transform: rotate(12deg); animation: fallen var(--d) linear infinite; animation-delay: var(--v); }
@keyframes fallen { to { transform: translate(-200px, 950px) rotate(12deg); } }
.blitzlicht { inset: 0; background: #fff; opacity: 0; animation: blitzen 7s linear infinite; }
@keyframes blitzen { 0%, 86%, 88.5%, 91%, 100% { opacity: 0; } 87% { opacity: .35; } 90% { opacity: .22; } }
.flocke { top: -12px; animation: schneien var(--d) linear infinite; animation-delay: var(--v); }
.flocke b { display: block; width: var(--s); height: var(--s); border-radius: 50%; background: rgba(255,255,255,.9); box-shadow: 0 0 4px rgba(255,255,255,.6);
  animation: pendeln var(--w) ease-in-out infinite alternate; }
.hell .flocke b { background: #fff; box-shadow: 0 0 3px rgba(80,100,130,.5); }
@keyframes schneien { to { transform: translateY(950px); } }
@keyframes pendeln { from { transform: translateX(-10px); } to { transform: translateX(10px); } }
.schwade { left: -40%; width: 180%; height: 140px; background: radial-gradient(ellipse at center, rgba(225,232,240,.4), transparent 70%); filter: blur(12px);
  animation: ziehen var(--d) ease-in-out infinite alternate; animation-delay: var(--v); }
@keyframes ziehen { from { transform: translateX(-12%); } to { transform: translateX(12%); } }
.wolke { left: -60%; width: 340px; height: 130px; border-radius: 50%; background: rgba(255,255,255,.12); filter: blur(28px);
  animation: wandern var(--d) linear infinite; animation-delay: var(--v); }
.hell .wolke { background: rgba(255,255,255,.55); }
@keyframes wandern { to { transform: translateX(260%); } }
.stern { width: var(--s); height: var(--s); border-radius: 50%; background: #fff; box-shadow: 0 0 4px #fff; animation: funkeln 3.5s ease-in-out infinite; animation-delay: var(--v); }
.hell .stern { background: #fffbe8; box-shadow: 0 0 4px #7d8fd0; }
@keyframes funkeln { 50% { opacity: .2; } }
.strahlen { top: calc(var(--sonne-y, 8%) - 360px); left: calc(var(--sonne-x, 8%) - 360px); width: 720px; height: 720px; border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(255,236,170,.14) 0 6deg, transparent 6deg 18deg);
  -webkit-mask: radial-gradient(circle, #000 12%, transparent 62%); mask: radial-gradient(circle, #000 12%, transparent 62%); animation: drehen 90s linear infinite; }
@keyframes drehen { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .partikel { display: none; } }
/* WebGL-Himmel: zeichnet Verlauf, Lichtflecken, Wolken, Wetter und Tropfen selbst */
.himmel { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.glas-bg.gl-an > i, .glas-bg.gl-an .dunst { visibility: hidden; }
.glas-bg.gl-an .partikel { display: none; }

.scroll { position: absolute; inset: 0; overflow-y: auto; }
.seite { padding: 56px 14px 120px; display: flex; flex-direction: column; gap: 12px; max-width: 1100px; margin: 0 auto; }
/* Einblenden nur am Anfang (backwards): eine festgehaltene Deckkraft machte die Seite zur eigenen Ebene – dann bleibt das Glas ohne Unschärfe */
.seite.rein { animation: seite .28s cubic-bezier(.2,.7,.2,1) backwards; }

.glas-panel { background: var(--panel); border: 1px solid var(--panel-rand); backdrop-filter: blur(12px) saturate(1.4); -webkit-backdrop-filter: blur(12px) saturate(1.4);
  border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.22); }
.glas-kopf { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 18px; }
.klickbar { cursor: pointer; }
.kopf-wetter { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; padding: 2px 10px 2px 2px !important; border-radius: 14px !important;
  font-size: 13px; color: var(--ink2) !important; transition: background .2s; }
.kopf-wetter:hover { background: rgba(255,255,255,.1) !important; } .kopf-wetter span:first-of-type { color: var(--ink); font-weight: 500; }
.kopf-wetter .wi { margin: -4px 0; } .pfeil { font-size: 14px; opacity: .6; }
.glas-klein { font-size: 11px; letter-spacing: 1.2px; color: var(--ink2); text-transform: uppercase; }
.glas-titel { font-size: 22px; font-weight: 600; }
.glas-kw { font-size: 38px; font-weight: 300; letter-spacing: -.5px; display: flex; align-items: baseline; gap: 4px; white-space: nowrap; line-height: 1; }
.glas-kw small { font-size: 16px !important; opacity: .75 !important; font-weight: 400; letter-spacing: 0; }
.glas-kw small, .glas-wert small, .c-wert small { font-size: .5em; opacity: .7; }
.blitz { font-size: 26px; opacity: .4; align-self: center; } .blitz.an { opacity: 1; filter: drop-shadow(0 0 8px rgba(255,214,10,.9)); animation: blitz 2.4s ease-in-out infinite; }

.glas-chips { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.chip { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; padding: 6px 12px; border-radius: 18px !important; transition: transform .15s; }
.chip:active { transform: scale(.96); } .chip.rot { color: var(--rot); } .chip.amber { color: var(--amber); }
.chip-leise { font-size: 12px; color: var(--ink2); margin-left: 4px; }
.auto-chip { gap: 8px !important; padding-left: 7px !important; font-weight: 600; }
.mini-sw { position: relative; width: 28px; height: 16px; border-radius: 8px; background: rgba(120,120,128,.45); transition: background .25s; flex: none; }
.mini-sw i { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3);
  transition: transform .25s cubic-bezier(.3,.7,.2,1.2); }
.auto-chip.on .mini-sw { background: var(--amber); } .auto-chip.on .mini-sw i { transform: translateX(12px); }
.chip-status { font-size: 13px; color: var(--ink2); } .chip-status.amber { color: var(--amber); font-weight: 500; }

.glas-raster { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.glas-k { padding: 12px; display: flex; flex-direction: column; gap: 3px; animation: rein .5s ease-out backwards, schweben2 6s ease-in-out infinite;
  transition: transform .2s cubic-bezier(.2,.7,.2,1), box-shadow .2s; }
.glas-k:nth-child(2n) { animation-delay: 0s, -3s; }
.glas-k:hover { box-shadow: 0 14px 40px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.3); } .glas-k:active { transform: scale(.97); }
.glas-illu { margin: -4px -6px -2px; filter: drop-shadow(0 12px 14px rgba(0,0,0,.35)); }
.glas-name { font-weight: 600; font-size: 15px; }
.glas-zeile { display: flex; justify-content: space-between; align-items: baseline; }
.glas-wert { font-size: 26px; font-weight: 300; } .glas-kwk { font-size: 12px; color: var(--ink2); }
.glas-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink2); }
.glas-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c); animation: atmen 2s infinite; flex: none; }
.glas-geraete { display: flex; align-items: center; gap: 4px; margin-top: 3px; font-size: 11px; color: var(--ink2); }
.glas-geraete i { width: 6px; height: 6px; border-radius: 50%; background: rgba(142,142,147,.55); } .glas-geraete i.an { background: var(--amber); box-shadow: 0 0 6px var(--amber); }
.glas-geraete span { margin-left: 4px; }
.glas-k.neu { align-items: center; justify-content: center; min-height: 180px; color: var(--ink2); background: transparent; border-style: dashed; box-shadow: none; animation: rein .5s ease-out backwards; }
.glas-k.neu span { font-size: 34px; font-weight: 200; color: var(--ink); }

.glas-nav { position: absolute; left: 14px; right: 14px; bottom: 22px; display: flex; justify-content: space-around; padding: 6px; z-index: 5; }
.glas-nav button { flex: 1; text-align: center; padding: 8px 2px; border-radius: 16px; font-size: 13px; color: var(--ink2); transition: background .2s, color .2s; }
.glas-nav button.nav-ic { flex: 0 0 48px; display: grid; place-items: center; padding: 5px 2px; }
.glas-nav button.nav-ic svg { display: block; transition: transform .4s cubic-bezier(.3,.7,.2,1); } .glas-nav button.nav-ic:hover svg { transform: rotate(60deg); }
.glas-nav button.on { color: var(--ink); font-weight: 700; background: rgba(255,255,255,.16); }
.hell .glas-nav button.on { background: rgba(255,255,255,.7); }

/* Verbrauch (Klick auf kW) */
.kw-knopf { cursor: pointer; border-radius: 14px !important; padding: 4px 8px !important; margin: -4px -8px -4px 0 !important; transition: background .2s; }
.kw-knopf:hover { background: rgba(255,255,255,.12) !important; } .kw-pfeil { font-size: 22px; opacity: .5; margin-left: 4px; align-self: center; }
.c-kw.kw-knopf { margin: 4px 0 0 -8px !important; }
.vb-wer { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
.vb-wer button { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 12px; padding: 5px 10px !important; border-radius: 14px !important;
  border: 1px solid var(--panel-rand) !important; color: var(--ink2) !important; transition: background .2s, color .2s; }
.vb-wer button.on { background: rgba(255,255,255,.2) !important; color: var(--ink) !important; font-weight: 600; } .hell .vb-wer button.on { background: #fff !important; }
.vb-wer i { width: 8px; height: 8px; border-radius: 50%; }
.app { --trenn: rgba(20,24,34,.85); } .hell .app { --trenn: rgba(255,255,255,.95); }
.tip-summe { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--gridc); }
.vb-je { display: flex; flex-direction: column; font-size: 13px; }
.vb-je div { display: grid; grid-template-columns: 10px 1fr auto 62px 78px; gap: 8px; align-items: center; padding: 6px 0; }
.vb-je div + div { border-top: 1px solid var(--gridc); } .vb-je i { width: 8px; height: 8px; border-radius: 50%; }
.vb-je .n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .vb-je span:not(.n) { text-align: right; } .vb-je b { font-weight: 600; text-align: right; }
.fl-flaeche, .fl-linie { animation: seite .4s ease-out backwards; }

/* Heizt: Kachel glüht am Rand warm */
.glas-k, .c-held { position: relative; }
.glas-k.heizt::after, .glas-k.trocknen::after, .glas-k.frost::after, .c-held.heizt::after, .c-held.trocknen::after, .c-held.frost::after {
  content: ""; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 26px 1px rgba(255, 84, 40, .42), 0 0 22px rgba(255, 84, 40, .22); animation: gluehen 3.4s ease-in-out infinite; }
.hell .glas-k.heizt::after, .hell .glas-k.trocknen::after, .hell .glas-k.frost::after, .hell .c-held.heizt::after, .hell .c-held.trocknen::after, .hell .c-held.frost::after {
  box-shadow: inset 0 0 24px 1px rgba(240, 80, 30, .32), 0 0 20px rgba(240, 80, 30, .18); }
@keyframes gluehen { 50% { opacity: .55; } }
.glas-k:nth-child(3n)::after { animation-delay: -1.2s; } .glas-k:nth-child(3n+1)::after { animation-delay: -2.3s; }

/* Verbrauch oben in der Container-Ansicht, Diagramm-Optionen, Bearbeiten */
.kennz-knopf { position: relative; width: 100%; cursor: pointer; transition: transform .15s; } .kennz-knopf:active { transform: scale(.98); }
.kennz-mehr { position: absolute; right: 12px; top: 6px; font-size: 11px; color: var(--ink2); }
.chart-optionen { display: flex; justify-content: flex-end; } .chart-optionen .chip { font-size: 12px; font-weight: 500 !important; background: rgba(120,120,128,.18) !important; }
.ge-zeile { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--gridc); }
.ge-zeile.weg { justify-content: space-between; color: var(--ink2); text-decoration: line-through; } .ge-zeile.weg .chip { text-decoration: none; font-size: 12px; }
.ge-felder { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; } .ge-shelly { font-size: 11px; }
.ge-zwei { display: grid; grid-template-columns: 1fr 120px; gap: 6px; } .ge-zwei input, .ge-zwei select, .ge-felder > select { min-width: 0; }

/* Container-Ansicht */
.zurueck-zeile { display: flex; justify-content: space-between; }
.c-held { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; padding: 14px; }
.c-illu { filter: drop-shadow(0 16px 18px rgba(0,0,0,.35)); animation: schweben2 6s ease-in-out infinite; }
.c-wert { font-size: 40px; font-weight: 300; margin: 4px 0; } .c-kw { font-size: 13px; color: var(--ink2); margin-top: 4px; }
.block { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.block-kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.leise { color: var(--ink2); font-size: 12px; } .rot-t { color: var(--rot); } .blau { color: var(--blau); } .ok { color: #30d158; font-size: 12px; }
.liste { padding: 4px 0; }
.zeile { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; width: 100%; box-sizing: border-box; min-height: 44px; }
.block .zeile { padding: 8px 0; }
.liste .zeile + .zeile, .block .zeile + .zeile { border-top: 1px solid var(--gridc); }
.zeile.unter { padding-left: 14px; font-size: 14px; }
.block .zeile.unter { padding-left: 14px; }
.gruppe { font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--ink2); padding: 10px 16px 2px; }
.geraet { justify-content: flex-start; } .g-t { flex: 1; display: flex; flex-direction: column; } .g-t .leise em.hand { color: var(--amber); font-style: normal; font-weight: 600; }
.g-ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: rgba(142,142,147,.22); flex: none; transition: background .25s, box-shadow .25s; }
.g-ic.an { background: color-mix(in srgb, var(--amber) 28%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--amber) 50%, transparent); }
.farbpunkt { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }

/* Schalter */
.sw { width: 50px; height: 30px; border-radius: 15px !important; background: rgba(120,120,128,.36) !important; position: relative; flex: none; transition: background .25s; }
.sw i { position: absolute; top: 2px; left: 2px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 3px 8px rgba(0,0,0,.2); transition: transform .25s cubic-bezier(.3,.7,.2,1.2); }
.sw.on { background: var(--amber) !important; } .sw.on i { transform: translateX(20px); }

/* Segmente und Stepper */
.seg { display: flex; padding: 3px; border-radius: 14px; background: rgba(120,120,128,.2); gap: 2px; }
.seg.glas-panel { border-radius: 16px; padding: 4px; }
.seg button { flex: 1; text-align: center; padding: 7px 6px; border-radius: 11px; font-size: 13px; color: var(--ink2); transition: background .2s, color .2s; white-space: nowrap; }
.seg button.on { background: rgba(255,255,255,.2); color: var(--ink); font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.hell .seg button.on { background: #fff; }
.seg.klein button { padding: 5px 10px; font-size: 12px; flex: none; }
.stepper { display: flex; align-items: center; gap: 4px; background: rgba(120,120,128,.2); border-radius: 12px; padding: 2px; }
.stepper button { width: 32px; height: 30px; text-align: center; border-radius: 10px; font-size: 18px; }
.stepper button:active { background: rgba(255,255,255,.2); } .stepper b { min-width: 66px; text-align: center; font-size: 14px; font-weight: 600; }

/* Zeitplan */
.tag { cursor: pointer; } .tag-n { width: 28px; } .fenster { flex: 1; display: flex; gap: 6px; flex-wrap: wrap; }
.fenster em { font-style: normal; font-size: 12px; padding: 3px 8px; border-radius: 8px; background: color-mix(in srgb, var(--amber) 22%, transparent); color: var(--ink); }
.chev { color: var(--ink2); font-size: 18px; }
.tl-spur { position: relative; height: 22px; border-radius: 8px; background: rgba(120,120,128,.2); overflow: hidden; }
.tl-spur i { position: absolute; top: 0; bottom: 0; }
.tl-heiz { background: var(--amber); opacity: .85; }
.tl-trock { background: repeating-linear-gradient(45deg, var(--amber) 0 3px, transparent 3px 7px); }
.tl-jetzt { width: 2px; background: var(--ink); box-shadow: 0 0 6px var(--ink); }
.tl-achse { display: flex; justify-content: space-between; font-size: 11px; color: var(--ink2); margin-top: 4px; }

/* Arbeitszeit und Heizplan */
.tl-vor { background: color-mix(in srgb, var(--amber) 45%, transparent); }
.tl-extra { background: repeating-linear-gradient(45deg, var(--blau) 0 3px, transparent 3px 7px); opacity: .8; }
.chip-status { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px !important; border-radius: 12px !important; transition: background .2s; }
.chip-status:hover { background: rgba(255,255,255,.12) !important; }
.regelung { display: flex; flex-direction: column; gap: 2px; font-size: 13px; padding-top: 8px; border-top: 1px solid var(--gridc); }
.regelung span { color: var(--ink2); font-size: 12px; }
.az-name { font-size: 18px; font-weight: 600; margin-top: -2px; }
.zeile.az.heute .tag-n { color: var(--amber); }
.badge.blau-b { background: color-mix(in srgb, var(--blau) 22%, transparent); color: var(--blau); }
.hp-legende { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 11px; color: var(--ink2); }
.hp-legende i { display: inline-block; width: 14px; height: 8px; border-radius: 3px; margin-right: 5px; vertical-align: middle; }
.hp { display: flex; flex-direction: column; }
.hp-zeile { display: grid; grid-template-columns: 48px 1fr 42px; gap: 10px; align-items: center; padding: 7px 0; }
.hp-zeile + .hp-zeile { border-top: 1px solid var(--gridc); } .hp-zeile.achse { border-top: 0; padding-top: 0; }
.hp-zeile.heute { background: rgba(255,255,255,.07); border-radius: 12px; margin: 0 -8px; padding: 7px 8px; }
.hp-zeile .tl-spur { height: 14px; border-radius: 5px; } .hp-mitte .leise { font-size: 11px; margin-top: 3px; min-height: 13px; }
.hp-tag { display: flex; flex-direction: column; font-size: 11px; color: var(--ink2); } .hp-tag b { font-size: 14px; color: var(--ink); }
.hp-zeile.heute .hp-tag b { color: var(--amber); }
.hp-zeit { font-size: 11px; text-align: right; color: var(--ink2); line-height: 1.35; font-variant-numeric: tabular-nums; }
.azn input[type=time] { flex: 1; min-width: 0; padding: 5px 6px; } .azn .frei { flex: 1; }
.raster-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

/* Warnungen und Protokoll */
.warn-chip { display: inline-block !important; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip.gelb { color: #ffd60a; } .hell .chip.gelb { color: #9a6b00; }
.gruppe-t { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink2); margin-top: 4px; }
.wk { border-left: 3px solid var(--rot); padding: 6px 0 8px 12px; display: flex; flex-direction: column; gap: 3px; }
.wk.hinweis { border-color: #ffd60a; } .hell .wk.hinweis { border-color: #d9a400; } .wk.stumm { opacity: .55; border-color: var(--ink2); }
.wk-kopf { display: flex; justify-content: space-between; gap: 8px; } .wk-titel { font-size: 15px; font-weight: 500; }
.wk.stoerung .wk-titel { color: var(--rot); }
.wk-knoepfe { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; } .wk-knoepfe .chip { font-size: 12px; padding: 4px 10px; }
.p-tag { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink2); margin-top: 8px; padding-bottom: 2px; }
.p-ic { width: 16px; text-align: center; flex: none; font-size: 13px; }
.ereignis > div { font-size: 13px; } .p-fuss { padding: 6px 16px 10px; }

/* Heizung: Regeln heute, je Container, Feiertage */
.hr-zeile { display: grid; grid-template-columns: 26px 1fr 14px; gap: 8px; align-items: center; padding: 7px 0; opacity: .6; }
.hr-zeile + .hr-zeile { border-top: 1px solid var(--gridc); } .hr-zeile.an { opacity: 1; }
.hr-ic { font-size: 18px; text-align: center; } .hr-an { color: var(--ink2); font-size: 11px; } .hr-zeile.an .hr-an { color: var(--amber); }
.jc { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--gridc); flex-wrap: wrap; }
.jc-name { display: flex; flex-direction: column; min-width: 110px; } .jc-ctrl { display: flex; align-items: center; gap: 6px; }
.jc-l { font-size: 11px; color: var(--ink2); } .jc-th { width: 92px; text-align: center; font-size: 11px; }
.sw.klein { width: 38px; height: 22px; } .sw.klein i { width: 18px; height: 18px; } .sw.klein.on i { transform: translateX(16px); }
.stepper.klein button { width: 24px; height: 24px; font-size: 15px; } .stepper.klein b { min-width: 40px; font-size: 13px; } .stepper b.eigen { color: var(--amber); }
.ft-d { font-weight: 600; min-width: 64px; display: inline-block; }
/* Auswertung */
.kennz.vier { grid-template-columns: repeat(4, 1fr); } .kennz em { display: block; font-style: normal; font-size: 10.5px; margin-top: 2px; }
.kennz em.mehr { color: var(--rot); } .kennz em.weniger { color: #30d158; }
@container (max-width: 420px) { .kennz.vier { grid-template-columns: repeat(2, 1fr); row-gap: 10px; } .kennz.vier div:nth-child(3) { border-left: 0; } }
.vgl { margin: -6px 6px 0; }
.hinweis-k { font-size: 13px; padding: 8px 10px; border-radius: 12px; background: rgba(120,120,128,.14); }
.punkt-s { stroke: var(--sheet); stroke-width: 1.5; opacity: .9; }

/* Firmen und Abrechnung */
.firma-tag { align-self: flex-start; font-size: 10.5px; padding: 1px 7px; border-radius: 8px; background: rgba(120,120,128,.25); color: var(--ink2); margin-top: -1px; }
.fc-neu input { flex: 1; min-width: 0; }
.vb-gruppe { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.ab-firma { padding: 8px 0; border-top: 1px solid var(--gridc); } .ab-firma:first-of-type { border-top: 0; }
.ab-kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.ab-c { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; padding: 3px 0 0 12px; }

/* Staffelung / Strom */
.strom-knopf { display: flex; flex-direction: column; gap: 5px; width: calc(100% + 0px); margin-top: 12px; padding-top: 10px !important; border-top: 1px solid var(--gridc) !important; cursor: pointer; }
.glas-kopf { flex-wrap: wrap; } .glas-kopf .strom-knopf { flex-basis: 100%; }
.strom-t { font-size: 12px; color: var(--ink2); } .strom-t b { color: var(--ink); font-weight: 600; }
.strom-spur { position: relative; display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: rgba(120,120,128,.2); gap: 2px; }
.strom.klein .strom-spur { height: 7px; } .strom-spur i { display: block; height: 100%; transition: width .5s cubic-bezier(.2,.7,.2,1); }
.strom-spur .s-res { margin-left: auto; }
.s-heiz { background: var(--amber); } .s-pumpe { background: var(--blau); } .s-sonst { background: rgba(142,142,147,.85); }
.s-res { background: repeating-linear-gradient(45deg, rgba(142,142,147,.6) 0 3px, transparent 3px 6px); }
.strom-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--ink2); }
.strom-leg i { display: inline-block; width: 12px; height: 8px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
.an-block { display: flex; flex-direction: column; gap: 5px; padding: 8px 0; border-top: 1px solid var(--gridc); }
.an-kopf { display: flex; justify-content: space-between; gap: 8px; }
.ph-zeile { display: grid; grid-template-columns: 24px 1fr 56px; gap: 8px; align-items: center; font-size: 12px; } .ph-zeile .leise { text-align: right; }
.amber-t { color: var(--amber); } .lila { color: #bf5af2; } .blau { color: var(--blau); }
.g-t em.warte { color: var(--blau); font-style: normal; }
.gt-einzug { padding: 8px 16px 0; }
/* Tür */
.tuer-tag { align-self: flex-start; font-size: 10.5px; padding: 1px 7px; border-radius: 8px; background: rgba(191,90,242,.22); color: #d9a6f7; }
.hell .tuer-tag { color: #8a2fb8; }
.tuer-z { font-size: 12px; padding: 2px 9px; border-radius: 10px; background: rgba(48,209,88,.2); color: #30d158; } .tuer-z.offen { background: rgba(191,90,242,.22); color: #bf5af2; }
.ge-phase { display: flex; align-items: center; gap: 8px; }
/* Nachrichten und Bericht */
.noti { background: rgba(250,250,252,.96); color: #111; border-radius: 18px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; font-size: 13px; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.noti-app { font-size: 11px; color: #666; } .noti b { font-size: 14px; }
.noti-knoepfe { display: flex; gap: 14px; margin-top: 6px; } .noti-knoepfe button { color: #0a64d6 !important; font-weight: 600; font-size: 13px; padding: 4px 0 !important; }
.mail { border-radius: 14px; overflow: hidden; border: 1px solid var(--panel-rand); font-size: 13px; }
.mail-kopf { padding: 8px 12px; background: rgba(120,120,128,.16); display: flex; flex-direction: column; gap: 2px; }
.mail-anhang { font-size: 12px; margin-top: 3px; } .mail-inhalt { padding: 10px 12px; }
.mail-t { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink2); margin-top: 10px; }
.mail-z { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
.mail-feld { flex: 1; min-width: 0; margin-left: 12px; }

/* Nur bei Bedarf */
.glas-k.bereit { opacity: .88; }
.bedarf-knopf { align-self: stretch; margin-top: 6px; padding: 7px 10px !important; border-radius: 12px !important; text-align: center !important; font-size: 13px; font-weight: 600;
  background: rgba(120,120,128,.22) !important; transition: background .2s, transform .12s; }
.bedarf-knopf:active { transform: scale(.96); } .bedarf-knopf.an { background: color-mix(in srgb, var(--amber) 30%, transparent) !important; color: var(--amber) !important; }
.bedarf-dauer { display: flex; gap: 8px; flex-wrap: wrap; } .bedarf-dauer.gross { flex-direction: column; }
.bedarf-an { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: var(--amber); }
.glas-k[role=button] { cursor: pointer; }

/* Heizzeiten-Übersicht */
.tl-termin { background: color-mix(in srgb, var(--amber) 70%, #bf5af2); }
.hz-tag { display: flex; flex-direction: column; gap: 6px; }
.hz-zeile { display: grid; grid-template-columns: 96px 1fr 40px; gap: 8px; align-items: center; } .hz-zeile.aus { opacity: .45; }
.hz-n { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .hz-h { font-size: 11px; color: var(--ink2); text-align: right; }
.tl-spur.hz { height: 14px; border-radius: 5px; }
.hz-woche { display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
.hz-wk, .hz-wz { display: grid; grid-template-columns: 92px repeat(7, 1fr) 40px; gap: 3px; align-items: center; }
.hz-wk span { text-align: center; font-size: 11px; color: var(--ink2); line-height: 1.1; } .hz-wk span.heute { color: var(--amber); font-weight: 700; }
.hz-zelle { height: 26px; border-radius: 6px !important; text-align: center !important; font-size: 11px; background: color-mix(in srgb, var(--amber) calc(var(--a) * 100%), rgba(120,120,128,.14)) !important; }
.hz-sum { text-align: right; font-size: 11px; }
.t-wann { width: 70px !important; }

/* Melden, Über, Entwicklung */
.melden-knopf { position: absolute; right: 16px; bottom: 90px; z-index: 6; width: 38px; height: 38px; border-radius: 50% !important; display: grid; place-items: center; color: var(--ink2);
  opacity: .8; transition: opacity .2s, transform .15s; } .melden-knopf:hover { opacity: 1; color: var(--ink); } .melden-knopf:active { transform: scale(.92); }
.melden-knopf.im-sheet { position: absolute; top: 10px; right: 12px; bottom: auto; width: 32px; height: 32px; z-index: 2; background: rgba(120,120,128,.18); }
.sheet > .block-kopf:first-of-type, .sheet > h3:first-of-type { padding-right: 40px; }
.app textarea { font: inherit; color: var(--ink); background: rgba(127,127,127,.16); border: 1px solid var(--panel-rand); border-radius: 10px; padding: 8px 10px; resize: vertical; font-size: 15px; }
.ml-kontext { font-size: 12px; padding: 8px 10px; border-radius: 10px; background: rgba(120,120,128,.14); display: flex; flex-direction: column; gap: 2px; }
.ml-nr { font-variant-numeric: tabular-nums; } .ml-notiz { font-style: italic; }
.badge.st-neu { background: rgba(10,132,255,.2); color: var(--blau); } .badge.st-angenommen, .badge.st-in_arbeit { background: color-mix(in srgb, var(--amber) 22%, transparent); color: var(--amber); } .badge.st-geloest { background: rgba(48,209,88,.22); color: #30d158; }
.ml { padding: 8px 0 8px 12px; border-left: 3px solid var(--blau); display: flex; flex-direction: column; gap: 3px; } .ml.erledigt { opacity: .55; border-color: var(--ink2); }
.ml + .ml { margin-top: 6px; } .ml-kopf { display: flex; justify-content: space-between; gap: 8px; } .ml-text { font-size: 14px; }
.badge.rot-b { background: rgba(255,69,58,.2); color: var(--rot); }
.ueber-kopf { display: grid; grid-template-columns: 110px 1fr; gap: 12px; align-items: center; padding: 16px; } .ueber-illu { filter: drop-shadow(0 10px 12px rgba(0,0,0,.3)); }
.ueber-v { font-size: 15px; margin: 4px 0; }
.cl-punkt { font-size: 13px; padding: 4px 0 4px 14px; position: relative; } .cl-punkt::before { content: ""; position: absolute; left: 2px; top: 11px; width: 5px; height: 5px; border-radius: 50%; background: var(--amber); }
.cl-liste { padding: 0 0 8px 4px; } .cl-v { border-top: 1px solid var(--gridc); }
@container (min-width: 700px) { .melden-knopf { bottom: 24px; right: 24px; } }

.hp-zeile.ausn .hp-tag b::after { content: ' •'; color: var(--blau); }

.hz-ohne { margin: 4px 0 2px; } .hz-wz-ohne { grid-column: 2 / -1; text-align: left; font: inherit; font-size: 11.5px; background: none; border: 1px dashed var(--divider-color); border-radius: 8px; padding: 4px 8px; cursor: pointer; color: var(--secondary-text-color); }
.hz-c { display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px; font-size: 12.5px; } .hz-cn { font-weight: 600; } .hz-cp { font-size: 11px; }
.hz-g { padding-left: 10px; color: var(--ink2); font-size: 11.5px; }
.tl-spur.hz { height: 12px; }
.hz-plan { background: color-mix(in srgb, var(--amber) 22%, transparent); } .hz-plan.vorbei { background: color-mix(in srgb, var(--amber) 12%, transparent); }
.hz-an { background: var(--amber); border-radius: 2px; } .hz-off { background: repeating-linear-gradient(45deg, rgba(255,69,58,.5) 0 3px, transparent 3px 6px); }
.hp-legende i.hz-plan, .hp-legende i.hz-an, .hp-legende i.hz-off { display: inline-block; width: 14px; height: 8px; }
.hz-zelle.geplant { opacity: .55; font-style: italic; }
.hz-wk, .hz-wz { grid-template-columns: 124px repeat(7, 1fr) 40px; } .hz-wz .hz-n { font-size: 11.5px; }

/* Kennzahlen */
.kennz { display: grid; grid-template-columns: repeat(3, 1fr); padding: 14px 6px; text-align: center; }
.kennz div + div { border-left: 1px solid var(--gridc); }
.kennz b { display: block; font-size: 20px; font-weight: 500; } .kennz span { font-size: 11px; color: var(--ink2); }

/* Diagramme */
.chart-wrap { position: relative; }
.chart { width: 100%; height: auto; display: block; overflow: visible; }
.chart .gr { stroke: var(--gridc); stroke-width: 1; } .chart .ax-e { font-weight: 600; font-size: 9px; } .chart .ax { fill: var(--axisc); font-size: 10px; }
.chart .kreuz { stroke: var(--ink2); stroke-width: 1; stroke-dasharray: 2 3; } .chart .punkt { stroke: var(--sheet); stroke-width: 2; }
.chart .bar { transition: opacity .15s; } .chart .bar.matt { opacity: .35; }
.legende { display: flex; gap: 14px; font-size: 12px; color: var(--ink2); margin-top: 4px; }
.legende i, .tip i { display: inline-block; width: 10px; height: 3px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
.leer { font-size: 13px; color: var(--ink2); padding: 24px 0; text-align: center; } .link { color: var(--blau) !important; }
.tip { position: absolute; z-index: 30; pointer-events: none; opacity: 0; transition: opacity .12s; background: var(--sheet); color: var(--ink); border: 1px solid var(--panel-rand);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-radius: 12px; padding: 7px 10px; font-size: 12px; box-shadow: 0 6px 20px rgba(0,0,0,.25); white-space: nowrap; }
.tip.an { opacity: 1; }
.hbar { display: grid; grid-template-columns: 110px 1fr 54px; align-items: center; gap: 10px; font-size: 13px; }
.hb-spur { height: 10px; border-radius: 5px; background: rgba(120,120,128,.18); overflow: hidden; }
.hb-spur i { display: block; height: 100%; border-radius: 5px; animation: wachsen .6s cubic-bezier(.2,.7,.2,1) both; transform-origin: left; }
.hb-w { text-align: right; font-weight: 600; } .hb-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gespart { font-size: 14px; } .gespart b { color: #30d158; }
.vergleich { width: 100%; border-collapse: collapse; font-size: 13px; }
.vergleich th { text-align: right; font-weight: 600; color: var(--ink2); font-size: 12px; padding: 4px 0; } .vergleich td { padding: 7px 0; border-top: 1px solid var(--gridc); }
.vergleich td + td { text-align: right; } .fuss { margin-top: 4px; }

/* Verlauf */
.bs-karte { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; animation: rein .45s ease-out backwards; }
.bs-kopf { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.bs-zahlen { display: flex; gap: 18px; margin-top: 6px; font-size: 13px; color: var(--ink2); } .bs-zahlen b { font-size: 18px; color: var(--ink); font-weight: 500; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: rgba(142,142,147,.25); color: var(--ink2); }
.badge.gruen { background: rgba(48,209,88,.22); color: #30d158; }
.ereignis { justify-content: flex-start; align-items: flex-start; } .ereignis .zeit { width: 42px; font-size: 12px; color: var(--ink2); padding-top: 2px; } .ereignis .glas-dot { margin-top: 5px; }
.eingabe input { width: 70px; text-align: right; }

/* Einblendung von unten */
.schleier { position: absolute; inset: 0; background: rgba(0,0,0,.35); opacity: 0; pointer-events: none; transition: opacity .25s; z-index: 20; }
.schleier.an { opacity: 1; pointer-events: auto; }
.sheet { position: absolute; left: 8px; right: 8px; bottom: 8px; max-height: 82%; overflow-y: auto; z-index: 21; padding: 8px 18px 18px; background: var(--sheet);
  transform: translateY(110%); transition: transform .32s cubic-bezier(.2,.8,.2,1); border-radius: 28px; display: flex; flex-direction: column; gap: 10px; }
.sheet.an { transform: none; }
.sheet > * { flex-shrink: 0; }   /* nichts zusammendrücken – die Einblendung scrollt (sonst verschwindet z. B. die Chip-Reihe) */
.sheet h3 { margin: 4px 0 0; font-size: 20px; }
.griff { width: 40px; height: 5px; border-radius: 3px; background: var(--ink2); opacity: .5; margin: 0 auto 4px; }
.bs-zeile .bs-wahl { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; text-align: left; }
.bs-zeile .bs-ic { color: var(--ink2); padding: 4px 8px; font-size: 16px; }
.neu-version { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; margin-bottom: 12px; border-color: var(--amber); }
${NUR_LESEN_SPERRE.map(x => `.nur-lesen ${x}`).join(', ')} { opacity: .45; filter: grayscale(1); cursor: not-allowed; }
.nur-lesen-hinweis { border-color: var(--line, rgba(127,127,127,.4)); }
.neu-version .chip { color: var(--amber); background: color-mix(in srgb, var(--amber) 18%, transparent); font-weight: 600; white-space: nowrap; }
.sheet .zeile { padding: 8px 0; } .sheet .zeile + .zeile { border-top: 1px solid var(--gridc); }
.sheet input[type=time] { flex: 1; } .x { color: var(--rot) !important; padding: 4px 8px !important; }
.feld { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--ink2); } .feld input, .feld select { font-size: 15px; }
.knopf { width: 100%; text-align: center !important; padding: 13px !important; border-radius: 16px !important; background: rgba(120,120,128,.24) !important; font-weight: 600; transition: transform .12s; }
.knopf:active { transform: scale(.98); } .knopf.amber { background: var(--amber) !important; color: #1a1000 !important; } .knopf.rot { color: var(--rot) !important; }
.knopf.leise-k { background: transparent !important; color: var(--ink2) !important; }
.w-jetzt { display: flex; gap: 12px; align-items: center; } .w-jetzt b { font-size: 30px; font-weight: 400; }
.w-std { display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; gap: 2px; font-size: 12px; }
.w-inhalt { animation: seite .25s ease-out backwards; }
.w-regen { color: var(--blau); font-size: 12px; }
.w-std b, .w-teile b { font-size: 16px; font-weight: 500; }
.w-tag + .w-tag { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--gridc); }
.w-tag-n { font-size: 12px; font-weight: 600; letter-spacing: .5px; margin-bottom: 4px; }
.w-teile { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; font-size: 12px; }
.w-teile div { display: flex; flex-direction: column; align-items: center; gap: 2px; } .w-teile .vorbei { opacity: .38; }
.w-3z { display: grid; grid-template-columns: 58px 44px 54px 58px 1fr; align-items: center; gap: 6px; padding: 6px 0; font-size: 13px; }
.w-3z + .w-3z { border-top: 1px solid var(--gridc); }
.w-3t, .w-3w, .w-3r { display: flex; flex-direction: column; } .w-3w b { font-size: 17px; font-weight: 500; }
.w-3f { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.w-folge { font-size: 10.5px; padding: 2px 7px; border-radius: 9px; background: rgba(142,142,147,.22); white-space: nowrap; }
.w-folge.amber { color: var(--amber); background: color-mix(in srgb, var(--amber) 16%, transparent); }
.w-folge.blau { color: var(--blau); background: color-mix(in srgb, var(--blau) 16%, transparent); }
.w-std div { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.warn-k { border-left: 3px solid var(--rot); padding: 4px 0 4px 12px; }
.toast { position: absolute; left: 50%; bottom: 100px; transform: translate(-50%, 20px); opacity: 0; pointer-events: none; z-index: 25; padding: 10px 16px; font-size: 13px;
  white-space: nowrap; border-radius: 18px; background: var(--sheet); }
.toast.an { animation: toast 2.6s ease both; }

/* Desktop: breiteres Raster, Navigation oben */
@container (min-width: 700px) {
  .seite { padding: 84px 28px 40px; }
  .glas-nav { top: 16px; bottom: auto; left: 50%; right: auto; transform: translateX(-50%); width: 560px; }
  .glas-raster { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
  .c-held { grid-template-columns: 1fr 1.2fr; padding: 22px 28px; }
  .sheet { left: 50%; right: auto; width: 460px; bottom: auto; top: 50%; transform: translate(-50%, -40%) scale(.96); opacity: 0; pointer-events: none;
    transition: transform .25s cubic-bezier(.2,.8,.2,1), opacity .2s; }
  .sheet.an { transform: translate(-50%, -50%); opacity: 1; pointer-events: auto; }
  .griff { display: none; } .toast { bottom: 28px; }
  .raster2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
}

@keyframes schweben { 50% { transform: translate(30px, 40px) scale(1.15); } }
@keyframes schweben2 { 50% { transform: translateY(-3px); } }
@keyframes seite { from { opacity: 0; transform: translateY(10px); } }
@keyframes wachsen { from { transform: scaleX(0); } }
@keyframes toast { 0% { opacity: 0; transform: translate(-50%, 20px); } 10%, 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, 10px); } }
@media (prefers-reduced-motion: reduce) { .app *, .app *::before { animation: none !important; transition: none !important; } }
/* 0.7.8 – Punkte aus 0.6.3 zurück (Mockup glas.html) */
.erkl { font-size: 12px; color: var(--ink2); background: rgba(255,255,255,.06); border-radius: 10px; padding: 8px 10px; margin-top: 8px; line-height: 1.45; }
.hell .erkl { background: rgba(0,0,0,.04); }
.glas-nav.sechs button { font-size: 12px; padding-left: 1px; padding-right: 1px; } .glas-nav.sechs button.nav-ic { flex-basis: 40px; }
.modus-z { flex-wrap: wrap; } .modus-z > div:first-child { flex: 1 1 200px; } .modus-z .seg { flex: 1 1 100%; }
.seg button[disabled] { opacity: .35; cursor: not-allowed; }
.jc-modus { font: inherit; font-size: 12px; color: var(--ink); background: rgba(255,255,255,.1); border: 1px solid var(--gridc); border-radius: 9px; padding: 4px 6px; }
.hell .jc-modus { background: rgba(255,255,255,.7); }
.warn-zeile { display: block; width: 100%; text-align: left; padding: 10px 14px; margin-bottom: 10px; }
.warn-zeile.stoerung b { color: var(--rot); } .warn-zeile.hinweis b { color: var(--amber); } .warn-zeile .leise { display: block; font-size: 12px; margin-top: 2px; }
.p-schacht { display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: center; margin-bottom: 8px; } .p-illu .bc { max-width: 96px; }
/* Lernende Regelung (0.8) */
.lern-fort { height: 6px; border-radius: 3px; background: rgba(127,127,127,.25); margin-top: 6px; overflow: hidden; width: 160px; max-width: 100%; }
.lern-fort i { display: block; height: 100%; background: var(--amber); }
.lern-tab { display: grid; grid-template-columns: auto 1fr 1fr; gap: 6px 12px; align-items: center; font-size: 13px; margin: 6px 0; }
.lern-tab > div { display: flex; flex-direction: column; } .lern-tab > b { font-size: 12px; color: var(--ink2); }
.lern-treffer { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 13px; margin: 6px 0 10px; }
.lern-treffer span { padding: 2px 8px; border-radius: 8px; background: rgba(255,152,0,.18); } .lern-treffer span.gut { background: rgba(76,175,80,.2); }
/* Container-Ansicht (WU-0004): Kopf mit Thermostat-Rad, Kacheln, Tagesdiagramm, Geräte-Chips */
.c-d-held { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: center; padding: 16px; margin-bottom: 12px; }
.c-d-info { display: flex; flex-direction: column; gap: 14px; } .c-d-knoepfe { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.c-rad { position: relative; width: 210px; margin: 0 auto; }   /* WU-0018: mittig über „zu kalt / passt / zu warm“ */ .c-rad svg { width: 210px; height: 210px; display: block; }
.c-rad-k { font-size: 11px; letter-spacing: 2px; fill: var(--ink2); } .c-rad-t { font-size: 38px; font-weight: 700; fill: var(--ink); } .c-rad-s { font-size: 13px; font-weight: 600; }
.c-rad-pm { position: absolute; left: 0; right: 0; bottom: 6px; display: flex; justify-content: center; gap: 36px; }
.c-pm, .c-power { display: inline-flex; align-items: center; justify-content: center; padding: 0; line-height: 1; border-radius: 50%; border: 1px solid var(--panel-rand); background: rgba(255,255,255,.08); color: var(--ink); cursor: pointer; backdrop-filter: blur(8px); }
.c-pm { width: 44px; height: 44px; } .c-pm:active, .c-power:active { transform: scale(.94); } .c-pm .ic, .c-power .ic { width: 55%; height: 55%; display: block; }
.wurzel.hell .c-pm, .wurzel.hell .c-power { background: rgba(255,255,255,.6); }
.c-ohne-t { text-align: center; max-width: 220px; margin: 4px auto 0; }
.c-ohne { padding: 14px 16px; border-radius: 18px; display: flex; flex-direction: column; gap: 4px; min-width: 200px; } .c-ohne b { font-size: 30px; } .c-ohne small { font-size: 11px; letter-spacing: 1.5px; color: var(--ink2); }
.c-kacheln { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
.c-kachel { display: flex; flex-direction: column; align-items: flex-start; padding: 12px; border-radius: 16px; color: var(--ink); cursor: pointer; text-align: left; font: inherit; }
.c-kachel span { font-size: 18px; } .c-kachel b { font-size: 22px; margin-top: 4px; } .c-kachel small { color: var(--ink2); font-size: 12px; }
.c-tag-svg { width: 100%; height: auto; display: block; } .c-achse { font-size: 11px; fill: var(--ink2); }
.c-legende { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--ink2); margin-top: 6px; } .c-legende i { display: inline-block; width: 12px; height: 4px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
.c-legende i.gestr { background: repeating-linear-gradient(90deg, var(--ink) 0 4px, transparent 4px 7px); }
.c-chips { display: flex; flex-wrap: wrap; gap: 10px; } .c-chip { flex: 1 1 260px; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; }
.c-chip-t { flex: 1; display: flex; flex-direction: column; } .c-chip-t small { color: var(--ink2); font-size: 12px; } .c-chip-t .link { font-size: 12px; text-align: left; padding: 0; }
.c-chip.an { box-shadow: inset 0 0 0 1px var(--amber); } .c-chip.inaktiv { opacity: .55; }
.c-power { width: 42px; height: 42px; color: var(--ink2); } .c-power.an { background: var(--amber); color: #fff; border-color: transparent; box-shadow: 0 0 14px rgba(255,159,10,.55); }
.c-power:disabled { opacity: .35; cursor: not-allowed; } .c-aktiv { display: flex; flex-direction: column; align-items: center; gap: 2px; } .c-aktiv small { font-size: 10px; color: var(--ink2); }
@media (max-width: 700px) { .c-d-held { grid-template-columns: 1fr; } .c-kern { justify-self: center; } .c-kacheln { grid-template-columns: repeat(2, 1fr); } }
/* Verlauf (WU-0006): Reiter, Archiv-Karten, Vergleich, Chronik */
.vl-reiter { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; } .vl-reiter .seg { margin: 0; }
.vl-archiv { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.vl-karte { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 18px; color: var(--ink); text-align: left; cursor: pointer; font: inherit; }
.vl-karte.aktiv { box-shadow: inset 0 0 0 1px rgba(48,209,88,.5); } .vl-funke { width: 100%; height: 40px; display: block; margin-top: 4px; }
.vl-monate { display: flex; justify-content: space-between; font-size: 10px; color: var(--ink2); }
.vl-zahlen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; } .vl-zahlen div { display: flex; flex-direction: column; } .vl-zahlen b { font-size: 16px; } .vl-zahlen small { font-size: 11px; color: var(--ink2); }
.vl-mehr { align-self: flex-end; }
.vl-filter { padding: 10px 12px; margin-bottom: 12px; } .vl-suche { width: 100%; box-sizing: border-box; margin-bottom: 8px; font: inherit; color: var(--ink); background: rgba(127,127,127,.16); border: 1px solid var(--panel-rand); border-radius: 10px; padding: 7px 10px; }
.vl-tag { padding: 10px 14px; margin-bottom: 10px; } .vl-tag-kopf { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding-bottom: 6px; border-bottom: 1px solid var(--gridc); margin-bottom: 4px; }
.vl-ereignis { display: grid; grid-template-columns: 44px 24px 1fr; gap: 8px; align-items: center; padding: 5px 0; font-size: 13px; }
.vl-punkt { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; }
.vl-tab-kopf, .vl-tab-zeile { display: grid; grid-template-columns: 1.6fr repeat(6, 1fr); gap: 6px; align-items: center; font-size: 13px; text-align: right; }
.vl-tab-kopf button { background: none; border: 0; color: var(--ink2); font: inherit; font-size: 11px; text-align: right; cursor: pointer; padding: 4px 0; } .vl-tab-kopf button:first-child { text-align: left; } .vl-tab-kopf button.on { color: var(--ink); font-weight: 600; }
.vl-tab-zeile { width: 100%; background: none; border: 0; border-top: 1px solid var(--gridc); color: var(--ink); font: inherit; padding: 9px 0; cursor: pointer; }
.vl-tab-name { text-align: left; display: flex; flex-direction: column; } .vl-tab-name small { color: var(--ink2); font-size: 11px; }
@media (max-width: 700px) { .vl-tab-kopf, .vl-tab-zeile { grid-template-columns: 1.6fr repeat(3, 1fr); } .vl-tab-kopf button:nth-child(n+5), .vl-tab-zeile > :nth-child(n+5) { display: none; } }
/* Auswertung aus Bausteinen (WU-0005) */
.aw-dia { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; padding: 12px 14px; gap: 6px; }
.aw-dia-kopf { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .aw-dia-kopf .seg { margin: 0 0 0 auto; }
.aw-dia-svg { flex: 1; width: 100%; min-height: 0; } .aw-dia-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--ink2); }
.aw-dia-leg i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.aw-klein .aw-rang-z { width: 100%; grid-template-columns: 1fr 1fr auto; background: none; border: 0; color: var(--ink); font: inherit; padding: 6px 0; cursor: pointer; text-align: left; }
.aw-klein .aw-rang-z em { font-style: normal; color: var(--ink2); }
.aw-knoepfe { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; } .aw-hinweis { margin: -4px 2px 10px; }
/* FE-0008: Zeitraum wählen */
.zr-zeile { position: relative; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: -4px 0 12px; }
.zr-nav { display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 14px; min-width: 260px; }
.zr-pf { width: 38px; height: 38px; border: 0; border-radius: 11px; background: none; color: var(--primary-text-color); font-size: 22px; line-height: 1; cursor: pointer; display: grid; place-items: center; }
.zr-pf:hover:not(:disabled) { background: rgba(127,127,127,.15); } .zr-pf:disabled { opacity: .3; cursor: default; }
.zr-mitte { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 38px; font: inherit; color: inherit; background: none; border: 0; padding: 0 6px; }
.zr-mitte b { font-size: 15px; } .zr-mitte small, .zr-gewaehlt small { font-size: 11px; color: var(--secondary-text-color); }
.zr-auf { cursor: pointer; border-radius: 10px; position: relative; } .zr-auf:hover { background: rgba(127,127,127,.12); } .zr-pfeil { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--secondary-text-color); }
.zr-kal { position: absolute; top: 48px; left: 0; z-index: 20; width: 300px; padding: 10px; border-radius: 16px; }
.zr-kal-kopf { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; } .zr-kal-kopf b { font-size: 14.5px; }
.zr-kw-kopf, .zr-woche, .zr-woche-z { display: grid; grid-template-columns: 30px repeat(7, 1fr); gap: 2px; align-items: center; text-align: center; }
.zr-kw-kopf span { font-size: 10.5px; color: var(--secondary-text-color); padding: 2px 0; } .zr-kw-kopf span:first-child, .zr-woche b, .zr-woche-z b { font-size: 10.5px; font-weight: 500; color: var(--secondary-text-color); }
.zr-k { font: inherit; font-size: 13px; color: inherit; background: none; border: 0; border-radius: 9px; height: 34px; cursor: pointer; }
.zr-k:hover:not(:disabled), .zr-woche:hover:not(:disabled) { background: rgba(127,127,127,.14); } .zr-k:disabled, .zr-woche:disabled { opacity: .3; cursor: default; }
.zr-k.fremd, .zr-woche span.fremd { color: var(--secondary-text-color); opacity: .55; }
.zr-k.jetzt, .zr-woche.jetzt { box-shadow: inset 0 0 0 1.5px var(--s1); } .zr-k.on, .zr-woche.on { background: var(--s1); color: #fff; font-weight: 600; } .zr-woche.on b, .zr-woche.on span { color: #fff; opacity: 1; }
.zr-woche { width: 100%; font: inherit; font-size: 13px; color: inherit; background: none; border: 0; border-radius: 10px; height: 34px; cursor: pointer; padding: 0; }
.zr-kal-monate, .zr-kal-jahre { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; } .zr-kal-monate .zr-k, .zr-kal-jahre .zr-k { height: 42px; }
.zr-kal-fuss { display: flex; justify-content: center; margin-top: 8px; }
/* Einstellungen mit Seitenleiste (WU-0007) */
.ev-sl { display: grid; grid-template-columns: 230px 1fr; gap: 14px; align-items: start; }
.ev-nav { position: sticky; top: 8px; display: flex; flex-direction: column; gap: 2px; padding: 8px; border-radius: 18px; }
.ev-nav button { display: grid; grid-template-columns: 30px 1fr; align-items: center; gap: 2px 8px; text-align: left; font: inherit; color: inherit; background: none; border: 0; border-radius: 12px; padding: 8px 10px; cursor: pointer; }
.ev-nav button small { grid-column: 2; font-size: 11px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-nav button:hover { background: rgba(127,127,127,.12); } .ev-nav button.on { background: rgba(127,127,127,.22); font-weight: 600; }
.ev-nav .ev-trenn { height: 1px; background: rgba(127,127,127,.25); margin: 6px 8px; }
.ev-inhalt > * + * { margin-top: 12px; }
.ev-titel { display: flex; align-items: center; gap: 10px; margin: 2px 4px 10px; } .ev-titel b { font-size: 20px; } .ev-titel .leise { font-size: 12px; }
.ev-chips { position: relative; display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 10px; scrollbar-width: none; } .ev-chips button { flex: 0 0 auto; }
.ev-dev-reiter { margin-bottom: 10px; }
@media (max-width: 700px) { .ev-sl { grid-template-columns: 1fr; } .ev-nav { display: none; } }
.schmal .ev-sl { grid-template-columns: 1fr; } .schmal .ev-nav { display: none; }
.ev-nav button .ev-ic, .ev-titel .ev-ic { grid-row: 1 / 3; font-size: 18px; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: rgba(127,127,127,.16); }
/* Warm ab (AN-0004) */
.wa-tab { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 10px; align-items: center; margin: 4px 0 8px; }
.wa-tab > b { font-size: 12px; color: var(--ink2); font-weight: 500; } .wa-tab > div b { font-size: 15px; } .wa-tab > div .leise { display: block; font-size: 11px; }
.wa-heute { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 14px; background: rgba(255,159,10,.12); margin: 6px 0; font-size: 13px; } .wa-heute b { font-size: 15px; }
.lh-laedt { opacity: .45; transition: opacity .2s; pointer-events: none; }
.lh-regler { position: relative; margin: 4px 2px 18px; }
.lh-regler input[type=range] { width: 100%; margin: 0; height: 28px; background: transparent; -webkit-appearance: none; appearance: none; }
.lh-regler input[type=range]::-webkit-slider-runnable-track { height: 8px; border-radius: 4px; background: var(--spur); }
.lh-regler input[type=range]::-moz-range-track { height: 8px; border-radius: 4px; background: var(--spur); }
.lh-regler input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; margin-top: -8px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
.lh-regler input[type=range]::-moz-range-thumb { width: 24px; height: 24px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
.lh-skala { position: relative; height: 14px; margin: 0 12px; } .lh-skala span { position: absolute; transform: translateX(-50%); font-size: 11px; color: var(--ink2); }
.lh-stunden { display: flex; gap: 4px; overflow-x: auto; padding: 2px 0 10px; scrollbar-width: thin; } .lh-stunden .chip { flex: 0 0 auto; min-width: 38px; padding: 4px 6px; font-size: 12px; }
.zeile.ger { display: grid; grid-template-columns: 28px 1fr auto 14px; gap: 2px 10px; align-items: center; text-decoration: none; color: inherit; }
.ger-ic { position: relative; font-size: 17px; text-align: center; }
.ger-punkt { position: absolute; right: -2px; bottom: 0; width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--sheet, #1c1c1e); }
.ger-punkt.da { background: #30d158; } .ger-punkt.weg { background: var(--rot); }
.np-marke { margin-left: 5px; font-size: 12px; } .np-marke.rot { filter: hue-rotate(-40deg) saturate(3); }   /* BSM-019 */
.ger-sig { display: inline-flex; align-items: flex-end; gap: 2px; height: 12px; margin-left: 4px; vertical-align: -1px; }
.ger-sig i { width: 3px; border-radius: 1px; background: rgba(127,127,127,.35); } .ger-sig i:nth-child(1) { height: 25%; } .ger-sig i:nth-child(2) { height: 50%; }
.ger-sig i:nth-child(3) { height: 75%; } .ger-sig i:nth-child(4) { height: 100%; } .ger-sig i.an { background: var(--ink); } .ger-sig.s1 i.an { background: var(--rot); } .ger-z { font-size: 12.5px; text-align: right; white-space: nowrap; } a.zeile.ger:hover { background: rgba(127,127,127,.1); }
.aw-leiste { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; } .aw-leiste .seg { margin: 0; }
.aw-delta { font-style: normal; font-size: 12px; margin-left: 6px; } .aw-delta.mehr { color: #ff9f0a; } .aw-delta.weniger { color: #30d158; } .gruen-t { color: #30d158; }
.aw-raster { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 110px; gap: 12px; grid-auto-flow: dense; }
.aw-frei-s { grid-column: span min(var(--w), 4); grid-row: span var(--h); position: relative; min-width: 0; }
.aw-inhalt { height: 100%; overflow: auto; border-radius: 18px; } .aw-inhalt > .glas-panel, .aw-inhalt > .aw-karten { margin: 0; min-height: 100%; box-sizing: border-box; } .aw-inhalt > .aw-k { width: 100%; height: 100%; }
.aw-raster.layout .aw-inhalt { pointer-events: none; opacity: .8; }
.aw-ueber { position: absolute; inset: 0; border: 2px dashed var(--amber); border-radius: 18px; touch-action: none; }
.aw-griff { position: absolute; top: 6px; left: 6px; width: 30px; height: 30px; border-radius: 10px; background: var(--amber); color: #fff; display: flex; align-items: center; justify-content: center; cursor: grab; font-size: 18px; touch-action: none; }
.aw-name { position: absolute; top: 10px; left: 44px; font-size: 12px; background: var(--sheet); padding: 2px 8px; border-radius: 8px; max-width: calc(100% - 90px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aw-x { position: absolute; top: 6px; right: 6px; width: 30px; height: 30px; border-radius: 50%; border: 0; background: var(--sheet); color: var(--ink); cursor: pointer; }
.aw-groesse { position: absolute; right: 4px; bottom: 4px; width: 30px; height: 30px; display: flex; align-items: flex-end; justify-content: flex-end; color: var(--amber); font-size: 20px; cursor: nwse-resize; touch-action: none; }
.aw-frei-s.zieht { z-index: 5; opacity: .85; box-shadow: 0 12px 30px rgba(0,0,0,.4); border-radius: 18px; } .aw-frei-s.ziel .aw-ueber { border-style: solid; background: rgba(255,159,10,.12); }
.aw-k { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; border-radius: 18px; color: var(--ink); text-align: left; cursor: pointer; font: inherit; box-sizing: border-box; }
.aw-k small, .aw-betrag small { font-size: 11px; letter-spacing: 1.5px; color: var(--ink2); } .aw-k b { font-size: 28px; } .aw-k span { font-size: 13px; color: var(--ink2); }
.aw-rang { display: grid; grid-template-columns: 110px 1fr auto; gap: 8px; align-items: center; width: 100%; font-size: 13px; } .aw-rang i { display: block; height: 8px; border-radius: 4px; } .aw-rang em { font-style: normal; color: var(--ink2); font-size: 12px; }
.aw-zeile { display: flex; justify-content: space-between; width: 100%; font-size: 14px; } .aw-zeile b { font-size: 14px; }
.aw-betrag { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding: 18px; } .aw-betrag small { display: block; }
.aw-betrag > div > b { font-size: 46px; display: block; line-height: 1.1; margin: 4px 0; } .aw-betrag-r { display: flex; flex-direction: column; gap: 12px; } .aw-betrag-r b { font-size: 24px; }
.aw-tab-kopf, .aw-tab-zeile { display: grid; grid-template-columns: 1fr 56px 64px 64px 56px 56px 48px; gap: 8px; align-items: center; font-size: 13px; }
.aw-tab-kopf { color: var(--ink2); font-size: 11px; padding: 0 0 6px; text-align: right; } .aw-tab-kopf span:first-child { text-align: left; }
.aw-tab-zeile { width: 100%; padding: 8px 0; border: 0; border-top: 1px solid var(--gridc); background: none; color: var(--ink); font: inherit; cursor: pointer; text-align: right; }
.aw-tab-name { text-align: left; display: flex; flex-direction: column; gap: 4px; } .aw-tab-name em { font-style: normal; color: var(--ink2); margin-right: 6px; }
.aw-tab-name i { display: block; height: 6px; border-radius: 3px; } .aw-tab-name small { color: var(--ink2); font-size: 11px; }
.aw-karten { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.aw-karte { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; border-radius: 18px; color: var(--ink); text-align: left; cursor: pointer; font: inherit; }
.aw-karte span { font-size: 22px; } .aw-karte b { font-size: 15px; } .aw-karte small { color: var(--ink2); font-size: 12px; }
.aw-vorlagen { margin-bottom: 12px; } .aw-vorlagen-k { display: flex; flex-wrap: wrap; gap: 8px; }
.aw-wahl .zeile { gap: 12px; } .aw-wahl-k { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; } .aw-wahl-k .chip { min-width: 34px; justify-content: center; }
.aw-gr { display: inline-flex; align-items: center; gap: 4px; } .aw-gr small { font-size: 11px; color: var(--ink2); } .aw-gr b { min-width: 14px; text-align: center; }
@media (max-width: 700px) { .aw-raster { grid-template-columns: repeat(2, 1fr); } .aw-frei-s { grid-column: span min(var(--w), 2); }
  .aw-tab-kopf, .aw-tab-zeile { grid-template-columns: 1fr 44px 56px 44px; } .aw-tab-kopf span:nth-child(n+5), .aw-tab-zeile > span:nth-child(n+5) { display: none; } }
/* Rangliste der Staffelung (Bedarf in °C) */
.sr-kopf { display: flex; align-items: baseline; gap: 8px; margin: 14px 2px 6px; } .sr-kopf b { font-size: 16px; }
.sr-liste { border-radius: 16px; background: rgba(120,120,128,.10); padding: 2px 10px; }
.sr-zeile { display: grid; grid-template-columns: 28px 1fr auto; gap: 2px 10px; padding: 9px 4px; border-top: 1px solid var(--gridc); align-items: center; cursor: pointer; }
.sr-zeile:first-child { border-top: 0; } .sr-nr { font-size: 17px; font-weight: 600; text-align: center; color: var(--ink2); }
.sr-name b { font-size: 14px; } .sr-bedarf { text-align: right; font-size: 18px; font-weight: 500; white-space: nowrap; } .sr-bedarf small { display: block; font-size: 11px; color: var(--ink2); font-weight: 400; }
.sr-stufe { display: inline-block; font-size: 10.5px; padding: 1px 7px; border-radius: 8px; margin: 2px 4px 0 0; background: rgba(120,120,128,.2); }
.sr-stufe.frost { background: color-mix(in srgb, var(--blau) 30%, transparent); } .sr-stufe.boost { background: color-mix(in srgb, var(--amber) 35%, transparent); }
.sr-stufe.erster { background: color-mix(in srgb, #30d158 30%, transparent); }
.sr-auf { grid-column: 2 / -1; display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; font-size: 12.5px; padding: 6px 10px; margin-top: 4px; border-radius: 10px; background: rgba(120,120,128,.12); }
.sr-auf b { text-align: right; font-weight: 500; white-space: nowrap; } .sr-auf .summe { border-top: 1px solid var(--gridc); padding-top: 3px; font-weight: 600; }
.sr-zust { grid-column: 2 / -1; font-size: 12px; }
/* Strompreis mit „gilt ab“ und Preis simulieren */
.sp-zeile { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-top: 1px solid var(--gridc); } .sp-zeile b { font-size: 15px; } .sp-zeile .x { margin-left: auto; }
.sp-sim { display: inline-flex; align-items: center; gap: 6px; } .sp-sim b { font-size: 16px; min-width: 56px; text-align: center; }
.sp-chip-sim { background: color-mix(in srgb, #bf5af2 30%, transparent) !important; }
.sp-band { margin: 6px 0; font-size: 13px; padding: 6px 10px; border-radius: 12px; background: color-mix(in srgb, #bf5af2 18%, transparent); display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
/* WU-0017: Vergleich-Kacheln */
.vg-zeilen { display: flex; flex-direction: column; gap: 2px; margin-top: auto; font-size: 12px; } .vg-zeilen div { display: flex; justify-content: space-between; gap: 6px; }
.vg-zeilen span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink2); } .vg-zeilen b { font-weight: 600; white-space: nowrap; }
.vg-zeilen i, .vg-tab i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }
.vg-tab { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; } .vg-tab th { font-weight: 500; color: var(--ink2); text-align: right; padding: 2px 4px; }
.vg-tab th:first-child, .vg-tab td:first-child { text-align: left; } .vg-tab td { text-align: right; padding: 3px 4px; border-top: 1px solid var(--gridc); white-space: nowrap; }
.vg-chips button.on { outline: 2px solid var(--amber); } .vg-svg { width: 100%; height: 100%; } .vg-svg .ax { font-size: 9px; fill: var(--ink2); } .vg-svg .gr { stroke: var(--gridc); }
.aw-art-k { right: 78px; font-size: 11px; }
/* WU-0016: Bilder zur Meldung */
.mb-box { border-radius: 14px; background: rgba(120,120,128,.10); padding: 10px 12px; margin: 6px 0; } .mb-kopf { display: flex; align-items: baseline; gap: 6px; } .mb-kopf b { font-size: 14px; }
.mb-knoepfe { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 4px; }
.mb-knoepfe label, .mb-knoepfe button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 12px; border: 0; background: rgba(120,120,128,.2); color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.mb-knoepfe input { display: none; } .mb-hinweis { font-size: 12px; color: var(--ink2); }
.mb-bilder { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.mb-bild { position: relative; border-radius: 10px; overflow: hidden; background: rgba(0,0,0,.25); aspect-ratio: 9 / 16; } .mb-bild.quer { aspect-ratio: 16 / 10; }
.mb-bild img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mb-bild .x { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%; border: 0; background: rgba(0,0,0,.6); color: #fff; cursor: pointer; }
.mb-bild small { position: absolute; left: 0; right: 0; bottom: 0; font-size: 10px; padding: 2px 6px; background: rgba(0,0,0,.55); color: #fff; }
.ml-bilder { display: flex; gap: 6px; margin: 6px 0; } .ml-bilder img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; cursor: pointer; }
.ml-bild-laedt { width: 64px; height: 64px; border-radius: 8px; background: rgba(120,120,128,.2); } .mb-gross { width: 100%; border-radius: 12px; display: block; margin: 6px 0; }
/* FE-0012: mehrere Zeitfenster je Tag */
.am-tag { border-top: 1px solid var(--gridc); padding: 8px 0; } .am-tag:first-of-type { border-top: 0; }
.am-tag-kopf { display: flex; align-items: baseline; gap: 8px; } .am-tag-kopf b { font-size: 14px; }
.am-fenster { display: flex; align-items: center; gap: 8px; padding: 4px 0 4px 12px; font-size: 13.5px; } .am-fenster b { font-weight: 600; } .am-fenster .x { margin-left: auto; }
.am-strahl { margin: 4px 0 2px 12px; } .am-strahl .tl-spur { height: 12px; border-radius: 5px; }
.am-hinweis { font-size: 12px; color: var(--ink2); padding-left: 12px; }
.am-schon { border-radius: 12px; background: rgba(120,120,128,.12); padding: 8px 12px; margin: 6px 0; font-size: 13px; } .am-schon b { font-weight: 600; }
.tl-eigen { background: #64a8ff; }
/* Soll gleitend (Herbert 01.10.2026) */
.sg-heute { display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; font-size: 13px; padding: 8px 12px; border-radius: 12px; background: rgba(120,120,128,.12); margin: 6px 0; }
.sg-heute b { text-align: right; font-weight: 500; white-space: nowrap; } .sg-heute .summe { border-top: 1px solid var(--gridc); padding-top: 4px; font-weight: 600; font-size: 15px; }
.sg-kurve { width: 100%; height: 150px; display: block; margin: 4px 0; } .sg-kurve .ax { font-size: 9px; fill: var(--ink2); } .sg-kurve .gr { stroke: var(--gridc); stroke-width: 1; }
.sg-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--ink2); margin-bottom: 6px; } .sg-leg i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
.sg-box { margin: 14px 0 4px; } .sg-gefuehl { display: flex; gap: 8px; justify-content: center; margin: 0 0 4px; }
.sg-gefuehl button { flex: 1; max-width: 120px; white-space: nowrap; padding: 9px 6px; border-radius: 14px; border: 0; background: rgba(120,120,128,.18); color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.sg-gefuehl button:active { background: var(--amber); color: #1a1000; }
.sg-versch { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 2px 0 6px; font-size: 13px; } .sg-versch b { color: var(--amber); }
.sg-gefuehl-t { text-align: center; font-size: 11.5px; color: var(--ink2); }
/* AN-0012: Regeln nach Tagesablauf */
.rv-kopf { display: flex; align-items: baseline; gap: 8px; margin: 14px 2px 4px; } .rv-kopf b { font-size: 16px; } .rv-kopf .leise { font-size: 12px; }
.rv-karte { border-radius: 16px; background: rgba(120,120,128,.10); padding: 2px 12px; margin-bottom: 6px; } .rv-karte > .zeile:first-child { border-top: 0; }
.rv-fest { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; padding: 8px 0; font-size: 13px; border-top: 1px solid var(--gridc); }
.rv-fest:first-child { border-top: 0; } .rv-fest b { font-weight: 600; text-align: right; } .rv-fest .leise { grid-column: 1 / -1; margin-top: -4px; font-size: 12px; }
.rv-link { color: var(--blau); background: none; border: 0; font: inherit; cursor: pointer; padding: 0; white-space: nowrap; }
/* WU-0014: Kachel-Katalog – Kacheln S/M/L (Mockup kachel-katalog.html, Variante 3) */
.kk-bereich { display: flex; flex-direction: column; gap: 10px; margin: 14px 0 6px; }
.kk-titel { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 0 4px; } .kk-titel > b { font-size: 17px; }
.kk-knoepfe { margin-left: auto; display: flex; gap: 8px; } .kk-plus { color: var(--amber) !important; font-weight: 600; }
.kk { width: 100%; height: 100%; box-sizing: border-box; border-radius: 18px !important; padding: 12px 14px; display: flex; flex-direction: column; gap: 3px; cursor: pointer; overflow: hidden; color: var(--ink); text-align: left; min-width: 0; }
.kk:active { transform: scale(.98); }
.kk-kopf { display: flex; align-items: center; gap: 6px; min-width: 0; }
.kk-kopf small { font-size: 10.5px; letter-spacing: 1.1px; text-transform: uppercase; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kk-ic { font-size: 15px; line-height: 1; flex: none; }
.kk-zahl { font-size: 28px; font-weight: 300; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .kk-zahl small { font-size: 13px; color: var(--ink2); font-weight: 400; }
.kk-S .kk-zahl { margin-top: auto; font-size: 24px; }
.kk-wo { font-size: 12px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kk-vgl { font-size: 12px; color: var(--ink2); line-height: 1.35; } .kk-vgl em { font-style: normal; } .kk-vgl em.mehr { color: var(--amber); } .kk-vgl em.weniger { color: #30d158; }
.kk-M { flex-direction: row; gap: 12px; align-items: stretch; }
.kk-m-l { flex: 1 1 52%; min-width: 0; display: flex; flex-direction: column; gap: 2px; } .kk-m-l .kk-vgl { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kk-m-r { flex: 1 1 48%; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 5px; }
.kk-funke { width: 100%; height: 62px; display: block; }
.kk-l-zeile { display: flex; align-items: baseline; gap: 4px 10px; flex-wrap: wrap; }
.kk-dia { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
.kk-dia > svg { width: 100%; height: 100%; max-height: 100%; } .kk-dia .legende { display: none; }
.kk-dia.zeilen { flex-direction: column; align-items: stretch; justify-content: center; }
.kk-dia-in { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.kk-dz { display: grid; grid-template-columns: 74px 1fr; gap: 8px; align-items: center; font-size: 11px; color: var(--ink2); } .kk-dz > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kk-dz.eins { grid-template-columns: 1fr; } .kk-dz.schmal { grid-template-columns: 54px 1fr; } .kk-dz .tl-spur { height: 12px; border-radius: 5px; } .kk-dz.heute > span { color: var(--amber); font-weight: 600; }
.kk-kennz { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; align-content: center; margin-top: 4px; }
.kk-kennz div { display: flex; flex-direction: column; border-top: 1px solid var(--gridc); padding-top: 6px; min-width: 0; }
.kk-kennz b { font-size: 17px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .kk-kennz span { font-size: 11px; color: var(--ink2); }
.kk-balken { display: grid; grid-template-columns: minmax(0, 1fr) 1.2fr auto; gap: 6px; align-items: center; font-size: 11.5px; } .kk-balken > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kk-balken i { display: block; height: 7px; border-radius: 4px; } .kk-balken em { font-style: normal; color: var(--ink2); }
.kk-neu-k { grid-column: span 1; border-style: dashed !important; border-width: 1.5px !important; background: transparent !important; box-shadow: none !important; color: var(--ink2); display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 2px; font-size: 13px; border-radius: 18px !important; cursor: pointer; } .kk-neu-k span { font-size: 26px; font-weight: 300; line-height: 1; }
.kk-frisch .kk { animation: kk-frisch 1.8s ease-out; } @keyframes kk-frisch { 0%, 40% { box-shadow: 0 0 0 3px var(--amber); } 100% { box-shadow: 0 0 0 0 transparent; } }
.aw-dia-k { position: absolute; top: 6px; right: 42px; width: 30px; height: 30px; border-radius: 50%; border: 0; background: var(--sheet); cursor: pointer; opacity: .55; } .aw-dia-k.on { opacity: 1; background: var(--amber); }
.kk-kat { display: flex; flex-direction: column; gap: 8px; }
.kk-such input { width: 100%; box-sizing: border-box; font-size: 15px; padding: 10px 14px; border-radius: 14px; }
.kk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.kk-chip { padding: 5px 11px; border-radius: 14px; border: 0; background: rgba(120,120,128,.18); color: var(--ink); font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; }
.kk-chip.on { background: var(--amber); color: #1a1000; font-weight: 600; }
.kk-tr-zeile { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-top: 1px solid var(--gridc); cursor: pointer; }
.kk-tr-zeile.on { background: color-mix(in srgb, var(--amber) 12%, transparent); border-radius: 12px; }
.kk-z-ic { font-size: 20px; width: 28px; text-align: center; flex: none; } .kk-z-t { flex: 1; min-width: 0; }
.kk-tr-gr { display: flex; gap: 3px; flex: none; } .kk-tr-gr button { min-width: 28px; height: 26px; border-radius: 8px; border: 0; background: rgba(120,120,128,.2); color: var(--ink); font: inherit; font-size: 12px; cursor: pointer; }
.kk-tr-gr button.on { background: var(--amber); color: #1a1000; font-weight: 600; }
.kk-such mark { background: color-mix(in srgb, var(--amber) 45%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }
.kk-tr-leer { padding: 14px 4px; color: var(--ink2); font-size: 13px; }
.kk-wahl { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 8px; } .kk-wahl .vb-wer { display: flex; flex-wrap: wrap; gap: 6px; } .kk-wahl .vb-wer i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.kk-sw { padding: 4px 0; } .kk-vorschau { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
.kk-vorlagen summary { cursor: pointer; color: var(--blau); font-size: 14px; padding: 6px 2px; } .kk-vorlagen .aw-vorlagen-k { margin-top: 6px; }
.tab-scroll { overflow-x: auto; } .je-geraet td, .je-geraet th { white-space: nowrap; padding-left: 8px; } .je-geraet td:first-child { white-space: normal; padding-left: 0; }
/* 0.7.11 – Reiter Heizung als Kacheln (Mockup heizung-varianten.html, Variante A) */
.hz-held { padding: 14px 16px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; }
.hz-held-kopf { display: flex; justify-content: space-between; align-items: flex-start; }
.hz-status { font-size: 22px; font-weight: 600; margin-top: 2px; } .hz-status.an { color: var(--amber); }
.hz-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.hz-chip { font-size: 12px; padding: 4px 9px; border-radius: 12px; background: rgba(255,255,255,.12); white-space: nowrap; }
.hell .hz-chip { background: rgba(0,0,0,.06); }
.hz-raster { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media (min-width: 700px) { .hz-raster { grid-template-columns: repeat(4, 1fr); } }
.hz-kachel { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px; text-align: left; min-height: 118px; animation: rein .45s ease-out backwards; }
.hz-k-kopf { display: flex; justify-content: space-between; width: 100%; }
.hz-sym { font-size: 20px; line-height: 1; }
.hz-k-titel { font-size: 12px; color: var(--ink2); margin-top: 6px; }
.hz-k-wert { font-size: 17px; font-weight: 600; line-height: 1.2; }
.hz-k-unter { font-size: 11.5px; line-height: 1.35; }
.hz-mini { display: flex; align-items: flex-end; gap: 3px; height: 22px; margin: 3px 0 1px; width: 100%; }
.hz-mini i { flex: 1; background: var(--amber); opacity: .55; border-radius: 2px 2px 0 0; } .hz-mini i.heute { opacity: 1; }
.hz-innen { padding: 4px 0 8px; } .hz-innen + .hz-innen { border-top: 1px solid var(--gridc); padding-top: 12px; }
`;

const LAEDT = '<div class="leer">Lädt …</div>';

const TYP_ROLLE = { Ölradiator: ['heizkoerper', 'oelradiator'], Konvektor: ['heizkoerper', 'konvektor'], Bautrockner: ['bautrockner', 'oelradiator'],
  Steckdose: ['steckdose', 'oelradiator'], Pumpe: ['pumpe', 'oelradiator'] };
/* Einstellungen: Schlüssel der Seite (wie im Mockup) → Pfad im Store (bauplan §1) */
const PFAD = { preis: ['preis'], melden: ['melden_knopf'], feiertag_frei: ['heizung', 'feiertag_frei'], boost_min: ['heizung', 'boost_min'], toleranz: ['heizung', 'toleranz'], hand_nachfrist: ['heizung', 'hand_nachfrist_min'],
  fuehler_halten: ['heizung', 'fuehler_halten_min'], zieht_w: ['heizung', 'zieht_strom_w'],
  staffel: ['staffel', 'an'], nutzbar: ['staffel', 'nutzbar_prozent'], max_gleich: ['staffel', 'max_gleichzeitig'], min_lauf: ['staffel', 'min_lauf_min'],
  min_pause: ['staffel', 'min_pause_min'], takt: ['staffel', 'takt_min'], tuer_pause: ['heizung', 'tuer_pause_min'], tuer_melden: ['heizung', 'tuer_melden_min'],
  knoepfe: ['meldungen_einst', 'knoepfe'], bericht: ['bericht', 'haeufigkeit'], bericht_handy: ['bericht', 'handy'], bericht_mail: ['bericht', 'mail'],
  mail: ['bericht', 'mail_an'], bericht_csv: ['bericht', 'csv'], vorheizen: ['heizung', 'vorheizen_min'], nachheizen: ['heizung', 'nachheizen_min'], warm_vor: ['heizung', 'warm_vor_min'], frost_aussen: ['heizung', 'frost_aussen'], warm_nach: ['heizung', 'warm_nach_min'], warm_max: ['heizung', 'warm_max_min'], stufen_abstand: ['heizung', 'stufen_abstand'], stufen_min: ['heizung', 'stufen_min'], stufen_anstieg: ['heizung', 'stufen_anstieg'], stufen_kalt: ['heizung', 'stufen_kalt'],
  soll: ['heizung', 'soll'], soll_art: ['heizung', 'soll_art'], gleit_min: ['heizung', 'gleit_min'], gleit_max: ['heizung', 'gleit_max'],
  gleit_je: ['heizung', 'gleit_je'], gleit_bezug: ['heizung', 'gleit_bezug'], gleit_tage: ['heizung', 'gleit_tage'], grenze: ['heizung', 'heizgrenze'], basis: ['heizung', 'heizgrenze_basis'], fruehstart: ['heizung', 'fruehstart'],
  frueh_temp: ['heizung', 'fruehstart_unter'], frueh_min: ['heizung', 'fruehstart_min'], frost: ['heizung', 'frost'], frost_temp: ['heizung', 'frost_grenze'],
  tr_mm: ['heizung', 'trocknen_ab_mm'], tr_laenger: ['heizung', 'trocknen_laenger_min'], tr_frueher: ['heizung', 'trocknen_frueher_min'],
  dauer_min: ['meldungen_einst', 'dauerlauf_min'], kalt_min: ['meldungen_einst', 'kalt_min'], hand_h: ['meldungen_einst', 'hand_h'], zyklen_h: ['meldungen_einst', 'zyklen_h'],
  // aus 0.6.3 zurück (0.7.8, api §7)
  frost_aus: ['heizung', 'frost_aus'], urlaub: ['heizung', 'frei_modus'], absenk: ['heizung', 'absenk'], offline_min: ['meldungen_einst', 'offline_min'],
  trocken_w: ['meldungen_einst', 'trocken_unter_w'], erklaer: ['erklaer'], frost_immer: ['heizung', 'frost_immer'], notprogramm: ['heizung', 'notprogramm'], taste: ['heizung', 'taste'] };
/* Grenzen der Stepper: Untergrenze wie im Mockup, sonst die erlaubten Werte der Integration (panel.py SETZEN) –
   so schickt die Seite nie einen Wert, den die Integration ablehnt */
const GRENZEN = { nutzbar: [30, 100], max_gleich: [1, 50], min_lauf: [1, 120], min_pause: [0, 120], takt: [5, 240], tuer_pause: [1, 120], tuer_melden: [1, 240],
  vorheizen: [0, 240], nachheizen: [0, 240], soll: [5, 30], gleit_min: [5, 30], gleit_max: [5, 30], gleit_je: [0, 0.5], gleit_bezug: [0, 20], gleit_tage: [1, 7], grenze: [0, 30], frueh_temp: [-15, 20], frueh_min: [0, 240], frost_temp: [0, 15],
  tr_mm: [0, 100], tr_laenger: [0, 480], tr_frueher: [0, 240], boost_min: [5, 480], toleranz: [0.1, 3], hand_nachfrist: [0, 240], fuehler_halten: [0, 120], zieht_w: [5, 500],
  frost_aus: [1, 20], absenk: [5, 20], offline_min: [1, 1440], trocken_w: [5, 5000], dauer_min: [5, 1440], zyklen_h: [2, 200], kalt_min: [15, 1440], hand_h: [1, 240], warm_vor: [0, 240], warm_nach: [0, 240], frost_aussen: [-20, 10], warm_max: [15, 480], stufen_abstand: [0.5, 10], stufen_min: [5, 240], stufen_anstieg: [0, 5], stufen_kalt: [-30, 15] };
const MODUS_TEXT = { plan: 'an in der Heizzeit – der Thermostat am Heizkörper regelt', thermo: 'in der Heizzeit auf das Soll nach dem Fühler',
  bedarf: 'nur per Schalter oder Termin, sonst Frostschutz', hand: 'die Automatik schaltet nicht – Schalter unten', aus: 'alles aus, Frostschutz bleibt' };
const STUNDEN = [...Array(24)].map((_, h) => String(h).padStart(2, '0'));
/* Reiter Heizung als Kacheln: Schlüssel, Titel des bisherigen Blocks, Symbol, Name der Einblendung */
const HZ_TEILE = [['heute', 'Heute', '🕖', 'Heute'], ['wann', 'Wann welche Heizung heizt', '🔥', 'Wann heizt was'], ['plan', 'Heizplan · diese Woche', '📅', 'Diese Woche'],
  ['az', 'Arbeitszeit', '👷', 'Arbeitszeit'], ['ausn', 'Ausnahmen', '✳️', 'Ausnahmen'], ['regeln', 'So wird geheizt', '⚙️', 'Regeln'],
  ['trocknen', '👕 Kleidung trocknen', '👕', 'Kleidung trocknen'], ['container', 'Je Container', '🏠', 'Container'], ['urlaub', 'Urlaub &amp; Feiertage', '🏖', 'Urlaub & Feiertage']];
/* Abschnitte der Integration → Klassen der Zeitleiste im Mockup */
const ABSCHNITT = { fruehstart: 'extra', vorheizen: 'vor', nachheizen: 'vor', arbeitszeit: 'heiz', trocknen: 'trock', termin: 'termin', fenster: 'eigen' };
/* Wetter der Baustelle (weather.*) → Stimmung des Hintergrunds und Text im Kopf */
const WETTER_STIMMUNG = { sunny: 'klar', 'clear-night': 'klar', exceptional: 'klar', partlycloudy: 'wolkig', cloudy: 'wolkig', windy: 'wolkig', 'windy-variant': 'wolkig',
  rainy: 'regen', pouring: 'regen', hail: 'regen', lightning: 'gewitter', 'lightning-rainy': 'gewitter', fog: 'nebel', snowy: 'schnee', 'snowy-rainy': 'schnee' };
const WETTER_TEXT = { sunny: 'Sonnig', 'clear-night': 'Klar', exceptional: 'Unwetter', partlycloudy: 'Heiter', 'partlycloudy-night': 'Heiter', cloudy: 'Bewölkt', windy: 'Windig', 'windy-variant': 'Windig',
  rainy: 'Regen', pouring: 'Starkregen', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter', fog: 'Nebel', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen' };
const AKTIV = z => ['heizt', 'trocknen', 'frost', 'laeuft'].includes(z);

/* Einblendungen: Unterdialoge aus „Baustelle bearbeiten“ kehren beim Schließen dorthin zurück (AN-0002);
   s.leeren() schließt alles (Seitenwechsel, Abschließen) */
function einblendungen(s) {
  let jetzt = s.sheet || null, eltern = null;
  Object.defineProperty(s, 'sheet', { enumerable: true, get: () => jetzt, set: v => {
    if (v && v.art === 'bs-bearbeiten') eltern = null;
    else if (v && jetzt && ['bs-bearbeiten', 'bereich'].includes(jetzt.art) && v !== jetzt && v.art !== jetzt.art) eltern = jetzt;
    else if (!v && eltern && jetzt !== eltern) { v = eltern; eltern = null; }
    else if (!v) eltern = null;
    jetzt = v || null; } });
  s.leeren = () => { eltern = null; jetzt = null; };
  return s;
}

/* WU-0005: Auswertung aus Bausteinen (Mockup glas.html Variante 6, abgenommen 30.09.2026) – [Name, Beschreibung] */
const AW_BAUSTEINE = {
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
const ST_KACHEL = [['S', 1, 1], ['M', 2, 1], ['L', 2, 2]];
const AW_STUFEN = {
  betrag: [['M', 2, 2], ['L', 4, 2]], kennzahlen: [['M', 2, 2], ['L', 4, 2]], rangliste: [['M', 2, 3], ['L', 4, 3], ['XL', 4, 4]],
  verlauf: [['S', 2, 2], ['M', 2, 3], ['L', 4, 3], ['XL', 4, 4]], erkenntnisse: [['M', 2, 2], ['L', 4, 2]], abrechnung: [['M', 2, 4], ['L', 4, 4]],
  links: [['M', 2, 3], ['L', 4, 3]], geraete: [['L', 4, 4]], temperaturen: [['M', 2, 3], ['L', 4, 3]], wetter: [['S', 1, 1], ['M', 2, 3], ['L', 4, 3]],
  ohne: [['M', 2, 2], ['L', 4, 2]], hochrechnung: [['M', 2, 3], ['L', 4, 2]], vergleich: [['M', 2, 3], ['L', 4, 3]], leistung: [['M', 2, 3], ['L', 4, 3]],
};
const awStufen = k => AW_STUFEN[k] || ST_KACHEL;
const awStufe = (k, w, h) => awStufen(k).reduce((best, st) => { const dd = Math.abs(st[1] - w) * 2 + Math.abs(st[2] - h); return dd < best[0] ? [dd, st] : best; }, [1e9, null])[1];
const AW_HOEHE = { betrag: 2, kennzahlen: 2, rangliste: 4, verlauf: 4, erkenntnisse: 2, abrechnung: 4, links: 3, geraete: 4, temperaturen: 4, wetter: 4, ohne: 2, hochrechnung: 3, vergleich: 3, leistung: 3 };
/* Vorlagen = die Varianten 1–5 des Mockups [Schlüssel, Breite 1–4, Höhe 1–6] */
const AW_VORLAGEN = {
  kacheln: ['1 · Kacheln', [['k-kosten', 2, 2], ['k-gespart', 1, 2], ['k-hoch', 1, 2], ['verlauf', 4, 4], ['k-wer', 2, 2], ['k-firmen', 2, 2], ['k-wetter', 1, 2], ['k-oel', 1, 2], ['k-temp', 2, 2]]],
  kosten: ['2 · Kosten im Fokus', [['betrag', 4, 2], ['abrechnung', 4, 4], ['verlauf', 4, 4], ['links', 4, 3]]],
  wer: ['3 · Wer verbraucht was', [['kennzahlen', 4, 2], ['rangliste', 4, 4], ['erkenntnisse', 4, 2]]],
  verlauf: ['4 · Verlauf mit Erkenntnissen', [['verlauf', 4, 4], ['erkenntnisse', 4, 2], ['kennzahlen', 4, 2], ['links', 4, 3]]],
  misch: ['5 · Mischform (Vorschlag)', [['betrag', 4, 2], ['rangliste', 4, 4], ['verlauf', 4, 4], ['erkenntnisse', 4, 2], ['k-wetter', 2, 2], ['k-oel', 2, 2], ['links', 4, 3]]],
};
const AW_SPEICHER = 'baustelle-aw-bausteine';
/* WU-0014: Kachel-Katalog – jede Auswertung der Seite als Kachel S (1×1), M (2×1) oder L (2×2, mit oder ohne Diagramm), auf der
   Übersicht und in der Auswertung (Mockup kachel-katalog.html, Variante 3 „Suche mit Filter-Chips“, abgenommen 01.10.2026).
   Die Kacheln zeigen nur an: Beträge, gespart, Hochrechnung, Wetter, Vergleich und „Warm ab“ kommen von der Integration,
   Verläufe aus der Statistik ihrer Sensoren. je: c = je Container, f = je Container mit Fühler, p = je Schacht */
const KK_BEREICHE = [['baustelle', 'Baustelle'], ['container', 'Container'], ['pumpen', 'Pumpen'], ['heizung', 'Heizung'], ['auswertung', 'Auswertung']];
const KK = {
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
const KK_GROESSE = [['S', 'Klein', '1×1'], ['M', 'Mittel', '2×1'], ['L', 'Groß', '2×2']];
const KK_SPEICHER = 'baustelle-kacheln-uebersicht';
const KK_START = [{ k: 'b-kosten', st: 'M' }, { k: 'b-gespart', st: 'M' }, { k: 'h-wann', st: 'M' }];
const KK_JEDES = { Tag: 6, Woche: 1, Monat: 7, Jahr: 3 };

/* ---------- Seite ---------- */
const STATISCH = '/baustelle_static';
const SEITE_VERSION = __BAUSTELLE_VERSION__;   // Version dieser Seite – beim Bauen aus version.json (tools/changelog.py → bauen.mjs, BSM-022)
const LIT_SHEETS = ['melden'];   // Einblendungen, die Lit zeichnet (BSM-022 2a.2)
class BaustellePanel extends LitElement {
  static styles = [unsafeCSS(CSS), unsafeCSS(GLAS_CSS)];   // BSM-022 2b: Stile über Lit (adoptedStyleSheets)
  constructor() {
    super();
    this.s = einblendungen({ view: 'uebersicht', cid: null, sheet: null, chart: 'temp', verlauf: 'aktiv' });
    this.cache = {}; this.roh = null; this.alle = []; this.d = null; this.bid = null; this.fehler = null;
    this.vorhersage = { daily: null, hourly: null }; this.abos = []; this.changelog = null;
    this.st = { phase: 'tag', wetter: 'wolkig', hell: false };
    try { const u = JSON.parse(localStorage.getItem('baustelle-panel') || '{}'); this.bid = u.bid || null; } catch (e) { /* ohne Speicher */ }
  }

  /* ---- Lebenszyklus (panel_custom: hass, narrow, panel) ---- */
  set hass(h) {
    const erst = !this._hass;
    this._hass = h;
    if (erst) { this._starten(); this.requestUpdate(); } else this._beobachten(h);
    this._stimmung();
  }
  get hass() { return this._hass; }
  set narrow(n) { const alt = this._narrow; this._narrow = !!n; if (alt !== undefined && alt !== this._narrow) this.neuZeichnen(); }
  get narrow() { return this._narrow; }
  set panel(p) { this._panel = p; }
  get panel() { return this._panel; }
  connectedCallback() {
    super.connectedCallback(); this._fensterAn();
    if (this._hass && !this._timer) this._starten();
    this._vorhersageAbo();   // BSM-022.03: nach dem Wiedereinhängen die Wetter-Abos neu (_laden bricht bei unveränderter Struktur vorher ab)
    if (!this.himmel && this.bg) this.himmel = Himmel.an(this.bg); this._stimmung(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._timer); this._timer = null; clearTimeout(this._nachladen);
    this._aboEnde(); this._fensterAus(); if (this.himmel) { this.himmel.stop(); this.himmel = null; }
  }
  /* Listener am Fenster nur, solange die Seite eingehängt ist (BSM-022.03): sonst hält jede alte Seite sich selbst am Leben */
  _fensterAn() {
    if (this._fenster || typeof window === 'undefined' || !window.addEventListener) return;
    this._fenster = {
      // WU-0016: Screenshot mit Strg+V ins offene Melde-Fenster
      paste: e => { const sh = this.s && this.s.sheet; if (!sh || sh.art !== 'melden') return;
        const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.type && i.type.startsWith('image/')); if (!it) return;
        e.preventDefault(); this.mbDatei(it.getAsFile(), 'eingefügt'); },
      'location-changed': () => { this._adresseFertig = null; setTimeout(() => this._adresse(), 0); },
    };
    for (const [art, f] of Object.entries(this._fenster)) window.addEventListener(art, f);
  }
  _fensterAus() {
    if (!this._fenster) return;
    for (const [art, f] of Object.entries(this._fenster)) window.removeEventListener(art, f);
    this._fenster = null;
  }
  _starten() {
    this._laden();
    clearInterval(this._timer); this._timer = setInterval(() => this._laden(), 60000);
    if (typeof fetch === 'function') fetch(`${STATISCH}/changelog.json?v=${encodeURIComponent(this.version)}`).then(r => r.ok ? r.json() : null)
      .then(c => { this.changelog = Array.isArray(c) ? c : []; if (this.s.view === 'ueber') this.neuZeichnen(); }).catch(() => { this.changelog = []; });
  }
  get version() { return (this.d && this.d.version) || (this._panel && this._panel.config && this._panel.config.version) || '–'; }

  /* Der Rahmen steht nach dem ersten Zeichnen (render(), BSM-022 2b) und bleibt; die alten Ansichten melden Klicks und
     Eingaben über data-act an den Shadow Root (bis sie in Stufe 3 Lit-Vorlagen werden) */
  firstUpdated() {
    const sr = this.renderRoot;
    this.wurzel = sr.querySelector('.wurzel'); this.root = sr.querySelector('.app');
    this.bg = sr.querySelector('.glas-bg'); this.ui = sr.querySelector('.ui');
    sr.addEventListener('click', e => this.klick(e));
    sr.addEventListener('input', e => this.eingabe(e));
    sr.addEventListener('change', e => this.aenderung(e));
    sr.addEventListener('pointermove', e => this.hover(e));
    sr.addEventListener('pointerdown', e => this.zugStart(e));   // WU-0005: Layout der Auswertung (ziehen, Größe)
    sr.addEventListener('pointerleave', () => this.tip(null));
    sr.addEventListener('focusout', () => { if (this._wartet) { this._wartet = false; setTimeout(() => this._auffrischen(), 0); } });
    this.himmel = Himmel.an(this.bg);          // WebGL-Himmel; ohne WebGL bleibt der CSS-Hintergrund
    this._stimmung(true);
  }

  /* Eigene Entitäten geändert → Struktur kurz danach neu holen (Zustände kommen aus der Integration) */
  _beobachten(h) {
    const ids = this._eigene || [];
    let neu = !this._alt;
    if (this._alt) for (const id of ids) if (h.states[id] !== this._alt[id]) { neu = true; break; }
    this._alt = Object.fromEntries(ids.map(id => [id, h.states[id]]));
    if (neu && this._alt && ids.length && !this._nachladen) this._nachladen = setTimeout(() => { this._nachladen = null; this._laden(); }, 3000);
    // WU-0002: Diagramme und „kWh heute“ rechnen bis zum aktuellen Zählerstand – bei neuen Werten neu zeichnen (höchstens alle 10 s)
    if (neu && this.d && Date.now() - (this._liveGezeichnet || 0) > 10000) { this._liveGezeichnet = Date.now(); this._liveNeu(); }
  }

  async _laden() {
    if (!this._hass) return;
    try {
      const r = await this._hass.callWS({ type: 'baustelle/struktur' });
      // unverändert (bis auf die Uhrzeit) → nicht neu zeichnen; spätestens alle 5 min wegen der Jetzt-Marke
      const text = JSON.stringify(r, (k, v) => k === 'jetzt' ? undefined : v);
      if (text === this._rohText && !this.fehler && Date.now() - this._geholt < 300000) return;
      this._rohText = text; this._geholt = Date.now(); this.roh = Array.isArray(r) ? r : []; this.fehler = null;
      this._neuBauen();
      delete this.cache['p:' + (this.d && this.d.entry)];
    } catch (e) { this.fehler = (e && (e.message || e.code)) || String(e); if (!this.roh) this.roh = null; }
    this._vorhersageAbo(); this._stimmung(); this._adresse(); this._auffrischen(); this._versionPruefen();
  }
  /* Neuere Version als diese Seite? HA nach dem Neustart (struktur) oder eingespielt ohne Neustart (changelog.json auf der Platte) */
  _versionPruefen() {
    const vorher = this.neueVersion;
    for (const r of this.roh || []) if (verNeuer(r.version, this.neueVersion || SEITE_VERSION)) this.neueVersion = r.version;
    if (typeof fetch === 'function' && !(Date.now() - (this._platteGeprueft || 0) < 600000)) {
      this._platteGeprueft = Date.now();
      fetch(`${STATISCH}/changelog.json?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(c => {
        const v = Array.isArray(c) && c[0] && c[0].version;
        if (verNeuer(v, this.neueVersion || SEITE_VERSION)) { this.neueVersion = v; this.neuZeichnen(); }
      }).catch(() => {});
    }
    if (this.neueVersion !== vorher) this.neuZeichnen();
  }
  rechte() { return rechteVon(this.roh); }   /* Rechte und Sperren: src/rechte.js */
  nurLesen() { return !this.rechte().aendern; }
  gesperrt(el) { return gesperrt(el, this.rechte()); }
  darfSenden(msg) { return darfSenden(msg, this.rechte()); }
  nurLesenHinweis() {
    if (!this.roh || !this.nurLesen()) return '';
    return `<div class="glas-panel neu-version nur-lesen-hinweis"><span>👁 ${NUR_ANSEHEN} <span class="leise">· jetzt heizen, Gefühl und Warnungen stumm gehen trotzdem</span></span></div>`;
  }
  versionHinweis() {
    if (!this.neueVersion) return '';
    return `<div class="glas-panel neu-version"><span>Neue Version ${esc(this.neueVersion)} – bitte neu laden <span class="leise">(geladen ist ${SEITE_VERSION})</span></span><button class="chip" data-act="neu-laden">Neu laden</button></div>`;
  }
  async neuLaden() {
    this.toast('Lädt neu …');
    // Browser-Speicher auffrischen, sonst kommt nach dem Neuladen wieder die alte Datei
    const urls = [...new Set([this._panel && this._panel.config && this._panel.config.version, this.neueVersion, SEITE_VERSION].filter(Boolean))].map(v => `${STATISCH}/baustelle-panel.js?v=${encodeURIComponent(v)}`);
    await Promise.all([...urls, `${STATISCH}/baustelle-panel.js`].map(u => fetch(u, { cache: 'reload' }).catch(() => null)));
    location.reload();
  }
  _neuBauen() {
    this.alle = (this.roh || []).map(r => this.bauen(r));
    const aktiv = this.alle.filter(x => x.aktiv);
    this.d = aktiv.find(x => x.entry === this.bid) || aktiv[0] || null;
    if (this.d && this.d.entry !== this.bid) { this.bid = this.d.entry; this._merken(); }
    this._eigene = (this.roh || []).flatMap(r => Object.values(r.entitaeten || {}));
  }
  /* Adresse aus einer Handy-Nachricht (api §4): ?baustelle=<entry_id>&container=<bid>&ansicht=auswertung */
  _adresse() {
    const such = typeof location !== 'undefined' ? location.search : '';
    if (!such || such === this._adresseFertig || !this.roh) return;
    this._adresseFertig = such;
    const q = new URLSearchParams(such), bid = q.get('baustelle'), cid = q.get('container'), ansicht = q.get('ansicht');
    const x = bid && this.alle.find(y => y.entry === bid);
    if (x && x.aktiv) { this.bid = x.entry; this._merken(); this._neuBauen(); this._vorhersageAbo(); this._stimmung(true); }
    else if (x) { this.s.bs = x.entry; return this.gehe('bsdetail'); }
    if (cid && this.d && this.d.bereiche.some(b => b.id === cid)) return this.gehe('container', cid);
    if (ansicht && typeof this['v_' + ansicht] === 'function' && ansicht !== 'leer') return this.gehe(ansicht);
    if (x) this.gehe('uebersicht');
  }
  _merken() { try { localStorage.setItem('baustelle-panel', JSON.stringify({ bid: this.bid })); } catch (e) { /* egal */ } }
  get z() { return this.d.z; }

  /* Hintergrund aus der Baustelle: Tageszeit (sun.sun), Wetter (Wetter-Entität), hell/dunkel (Theme) */
  _stimmung(erzwingen = false) {
    if (!this.bg || !this._hass) return;
    const h = this._hass, eid = this.d && this.d.wetterEid, w = eid && h.states[eid];
    const sonne = h.states['sun.sun'], phase = phaseAusSonne(sonne), wetter = WETTER_STIMMUNG[w && w.state] || 'wolkig', hell = !(h.themes && h.themes.darkMode);
    /* Sonne/Mond wandern und Farben gleiten stufenlos (WU-0001): bei jedem Update nachführen, nicht nur beim Wechsel der Tageszeit */
    const lauf = this.lauf = himmelLauf(sonne);
    if (this.himmel) this.himmel.setze(phase, wetter, hell, sonne, lauf);
    this.bg.style.setProperty('--sonne-x', (lauf.uSonnePos[0] * 100).toFixed(1) + '%'); this.bg.style.setProperty('--sonne-y', (lauf.uSonnePos[1] * 100).toFixed(1) + '%');   // CSS-Rückfall
    const alt = this.st, neu = { phase, wetter, hell };
    if (!erzwingen && alt.phase === phase && alt.wetter === wetter && alt.hell === hell && this.bg.dataset.phase) return;
    if (this.bg.dataset.phase !== phase || this.bg.dataset.wetter !== wetter) { const p = this.bg.querySelector('.partikel'); if (p) p.innerHTML = partikel(phase, wetter); }
    this.bg.dataset.phase = phase; this.bg.dataset.wetter = wetter;
    if (this.wurzel) this.wurzel.classList.toggle('hell', hell);
    const kopfNeu = alt.wetter !== wetter || alt.phase !== phase;
    this.st = neu;
    if (kopfNeu && this.d) this._auffrischen();
  }

  _vorhersageAbo() {
    const eid = this.d && this.d.wetterEid, con = this._hass && this._hass.connection;
    if (!eid || !con || !con.subscribeMessage || this._aboFuer === eid) return;
    this._aboEnde(); this._aboFuer = eid; this.vorhersage = { daily: null, hourly: null };
    for (const art of ['daily', 'hourly']) {
      const abo = con.subscribeMessage(m => { this.vorhersage[art] = (m && m.forecast) || []; this._auffrischen(); },
        { type: 'weather/subscribe_forecast', entity_id: eid, forecast_type: art });
      if (abo && abo.catch) abo.catch(() => { this.vorhersage[art] = []; });
      this.abos.push(abo);
    }
  }
  _aboEnde() { for (const a of this.abos) if (a && a.then) a.then(ende => typeof ende === 'function' && ende()).catch(() => {}); this.abos = []; this._aboFuer = null; }

  lokal(t, zone = this.d && this.d.z.zone) { return lokal(t, zone); }   /* Zeit in der Zone der Baustelle (src/daten.js) */
  zoneMs(tag, zeit = '00:00', zone = this.d && this.d.z.zone) { return zoneMs(tag, zeit, zone); }
  isoUhr(iso) { return iso ? this.lokal(iso).slice(11, 16) : null; }
  seitText(iso) { if (!iso) return ''; const l = this.lokal(iso); return l.slice(0, 10) === this.z.HEUTE ? `seit ${l.slice(11, 16)}` : `seit ${wtag(l)} ${kurzDatum(l)}`; }
  tagText(l) { const t = l.slice(0, 10); return t === this.z.HEUTE ? 'Heute' : t === plusTage(this.z.HEUTE, -1) ? 'Gestern' : `${wtag(t)} ${kurzDatum(t)}`; }
  minSeit(iso) { const ms = Date.parse(iso); return Number.isFinite(ms) ? Math.max(0, Math.round((this.jetztMs() - ms) / 60000)) : null; }
  jetztMs() { return this.d ? this.d.z.jetztMs : Date.now(); }

  /* Adapter baustelle/struktur → Modell der Seite (src/daten.js) */
  bauen(r) { return bauen(r, this._hass, this.d && this.d.z.zone); }
  /* Beginn und Ende einer Baustelle als Text; „(angelegt)“ = Beginn automatisch (AN-0002) */
  bsZeit(x) { return `${x.beginn ? datum(x.beginn) : '–'}${x.beginnAuto ? ' (angelegt)' : ''} – ${x.ende ? datum(x.ende) : 'offen'}`; }
  minSeitAb(iso, jetztMs) { return minSeitAb(iso, jetztMs); }
  protokollZeile(p, z) { return protokollZeile(p, z, this.d && this.d.z.zone); }
  eid(d, besitzer, key) { return d.ent[`${besitzer}_${key}`] || null; }
  zustand(eid) { const s = eid && this._hass && this._hass.states[eid]; return s && !['unknown', 'unavailable'].includes(s.state) ? s : null; }
  name(eid) { const s = eid && this._hass && this._hass.states[eid]; return (s && s.attributes.friendly_name) || eid || ''; }

  /* ---- Nachladen mit Zwischenspeicher: gibt undefined zurück, solange es lädt ---- */
  _holen(key, holer, maxAlter = 300000) {
    const c = this.cache[key], jetzt = Date.now();
    if (!c || (!c.laeuft && jetzt - c.zeit > maxAlter)) {
      this.cache[key] = { ...(c || {}), laeuft: true, zeit: jetzt };
      Promise.resolve().then(holer).then(daten => { this.cache[key] = { daten, zeit: Date.now(), laeuft: false }; this._auffrischen(); })
        .catch(err => { this.cache[key] = { daten: null, fehler: String((err && err.message) || err), zeit: Date.now(), laeuft: false }; this._auffrischen(); });
    }
    return c && 'daten' in c ? c.daten : undefined;
  }
  /* Neu zeichnen ohne Eingaben zu stören */
  _auffrischen() {
    if (this._auffrischenGeplant) return;
    this._auffrischenGeplant = true;
    Promise.resolve().then(() => {
      this._auffrischenGeplant = false;
      const f = this.shadowRoot && this.shadowRoot.activeElement;
      if (this.leistungTeil()) return;   // WU-0012: Leistung offen – nur deren Daten nachladen
      if (f && ['INPUT', 'TEXTAREA', 'SELECT'].includes(f.tagName) && !f.closest('.lit-bereich') && !(this.s.sheet && LIT_SHEETS.includes(this.s.sheet.art) && f.closest('.sheet'))) { this._wartet = true; return; }   // Lit-Felder: kein Aufschub nötig (2a.2)
      this.neuZeichnen();
    });
  }

  /* Zeiträume der Auswertung: Tag (je Stunde), Woche/Monat (je Tag), Jahr (je Monat); versatz 1 = davor */
  zeitraum(z, versatz = 0, d = this.d) {
    const h = d.z.HEUTE, J = +h.slice(0, 4), M = +h.slice(5, 7);
    if (z === 'Tag') { const tag = plusTage(h, -versatz);
      return { von: tag, bis: plusTage(tag, 1), periode: 'hour', n: 24, labels: [...Array(24)].map((_, i) => String(i).padStart(2, '0')), index: l => l.slice(0, 10) === tag ? +l.slice(11, 13) : -1 }; }
    if (z === 'Woche') { const mo = plusTage(d.z.WOCHE_ISO[0], -7 * versatz);
      return { von: mo, bis: plusTage(mo, 7), periode: 'day', n: 7, labels: TAGE, index: l => tageZwischen(mo, l.slice(0, 10)) }; }
    if (z === 'Monat') { let m = M - 1 - versatz, j = J; while (m < 0) { m += 12; j--; }
      const von = `${j}-${String(m + 1).padStart(2, '0')}-01`, n = new Date(Date.UTC(j, m + 1, 0)).getUTCDate();
      return { von, bis: plusTage(von, n), periode: 'day', n, labels: [...Array(n)].map((_, i) => `${i + 1}.`), index: l => l.slice(0, 7) === von.slice(0, 7) ? +l.slice(8, 10) - 1 : -1, monat: m, jahr: j }; }
    const j = J - versatz;
    return { von: `${j}-01-01`, bis: `${j + 1}-01-01`, periode: 'month', n: 12, labels: MONATE, index: l => +l.slice(0, 4) === j ? +l.slice(5, 7) - 1 : -1, jahr: j };
  }
  statIds(d, mitTemp) {
    const ids = [];
    for (const b of d.bereiche) {
      const en = this.eid(d, b.id, 'energie'); if (en) ids.push(en); else ids.push(...b.geraete.map(g => g.energie).filter(Boolean));
      ids.push(this.eid(d, b.id, 'heizzeit'));
      if (!b.pumpe) ids.push(this.eid(d, b.id, 'heizzeit_strom'));   // AN-0011: davon tatsächlich geheizt (nur Container)
      for (const g of b.geraete) if (g.rolle === 'pumpe') ids.push(this.eid(d, g.id, 'pumpzeit'), this.eid(d, g.id, 'pumpzyklen'));
      if (mitTemp && b.fuehler) ids.push(b.fuehler);
    }
    ids.push(this.eid(d, d.entry, 'energie_ohne_automatik'));
    if (mitTemp) ids.push(this.eid(d, d.entry, 'aussen'));
    return [...new Set(ids.filter(Boolean))].sort();
  }
  /* Langzeitstatistik (Recorder) eines Zeitraums: {statistic_id: [Wert je Stunde/Tag/Monat]} */
  statistik(z, versatz = 0, d = this.d) {
    if (!d) return null;
    const zr = this.zeitraum(z, versatz, d), ids = this.statIds(d, z === 'Tag');
    if (!ids.length) return { ...zr, werte: {} };
    const vonMs = this.zoneMs(zr.von, '00:00', d.z.zone), bisMs = this.zoneMs(zr.bis, '00:00', d.z.zone), jetztMs = Date.now();
    const laufend = jetztMs >= vonMs && jetztMs < bisMs, frisch = laufend ? 60000 : undefined;   // enthält „jetzt“: nach 1 min neu holen
    const roh = this._holen(`s:${d.entry}:${z}:${zr.von}`, () => this._hass.callWS({ type: 'baustelle/statistik', entry_id: d.entry,
      start_time: new Date(vonMs).toISOString(), end_time: new Date(bisMs).toISOString(),
      statistic_ids: ids, period: zr.periode, types: ['change', 'mean', 'state'], units: {} }), frisch);
    if (roh === undefined) return null;
    /* WU-0002: HA schreibt eine Stunde erst nach ihrem Ende in die Stundenstatistik – die laufende Stunde (kurz nach der
       vollen Stunde auch die vorige, bis HA sie eingetragen hat) kommt aus der 5-Minuten-Statistik */
    let kurz = null, kurzAb = 0;
    if (laufend) {
      const stunde = Math.floor(jetztMs / 36e5) * 36e5; kurzAb = Math.max(vonMs, jetztMs - stunde < 60000 ? stunde - 36e5 : stunde);
      kurz = this._holen(`k:${d.entry}:${z}:${zr.von}:${kurzAb}`, () => this._hass.callWS({ type: 'baustelle/statistik', entry_id: d.entry,
        start_time: new Date(kurzAb).toISOString(), statistic_ids: ids, period: '5minute', types: ['change', 'mean', 'state'], units: {} }), 60000) || null;
    }
    const ms = p => typeof p.start === 'number' ? (p.start < 1e11 ? p.start * 1000 : p.start) : Date.parse(p.start);
    const werte = {};
    for (const id of ids) {
      const arr = Array(zr.n).fill(null);
      for (const p of (roh || {})[id] || []) {
        const i = zr.index(this.lokal(ms(p), d.z.zone));
        if (i < 0 || i >= zr.n) continue;
        if (zahl(p.change)) arr[i] = (arr[i] || 0) + Number(p.change); else if (zahl(p.mean)) arr[i] = Number(p.mean);
      }
      const mittel = {};   // Index → 5-Minuten-Mittelwerte (Temperatur)
      for (const p of (kurz || {})[id] || []) {
        const t = ms(p); if (t < kurzAb) continue;
        const i = zr.index(this.lokal(t, d.z.zone)); if (i < 0 || i >= zr.n) continue;
        const hatStunde = ((roh || {})[id] || []).some(q => zr.periode === 'hour' && ms(q) === Math.floor(t / 36e5) * 36e5);
        if (hatStunde) continue;   // diese Stunde hat HA schon eingetragen
        if (zahl(p.change)) arr[i] = (arr[i] || 0) + Number(p.change); else if (zahl(p.mean)) (mittel[i] ||= []).push(Number(p.mean));
      }
      for (const [i, v] of Object.entries(mittel)) if (arr[i] === null) arr[i] = v.reduce((x, y) => x + y, 0) / v.length;
      // bis „jetzt“ genau: was der Zähler seit dem letzten Statistikwert dazugezählt hat (aktueller Zustand − Stand dort)
      if (laufend) {
        const letzte = [...((roh || {})[id] || []), ...((kurz || {})[id] || [])].filter(q => zahl(q.change) && zahl(q.state)).sort((x, y) => ms(x) - ms(y)).at(-1);
        const jetzt = this._hass && this._hass.states[id], i = zr.index(this.lokal(jetztMs, d.z.zone));
        const dazu = letzte && jetzt && zahl(jetzt.state) ? Number(jetzt.state) - Number(letzte.state) : 0;
        if (dazu > 0 && i >= 0 && i < zr.n) arr[i] = (arr[i] || 0) + dazu;   // kleiner = Zähler neu gestartet: nichts dazu
      }
      werte[id] = arr;
    }
    return { ...zr, werte };
  }
  /* Verbrauch in kWh je Stunde (Tag), je Tag (Woche/Monat) oder je Monat (Jahr); bid null = Summe der Baustelle */
  verbrauch(d, bid, z, versatz = 0) {
    const st = this.statistik(z, versatz, d); if (!st) return null;
    const eins = b => { const en = this.eid(d, b.id, 'energie'), ids = en ? [en] : b.geraete.map(g => g.energie).filter(Boolean);
      const r = addieren(ids.map(id => (st.werte[id] || Array(st.n).fill(0)).map(v => v || 0))); return r.length ? r : Array(st.n).fill(0); };
    const liste = bid ? d.bereiche.filter(b => b.id === bid) : d.bereiche;
    return liste.length ? addieren(liste.map(eins)) : Array(st.n).fill(0);
  }
  reihe(d, id, z, versatz = 0) { const st = this.statistik(z, versatz, d); if (!st) return null; return (id && st.werte[id]) || Array(st.n).fill(null); }
  heizStunden(d, b, z, versatz = 0) {
    if (b.pumpe) { const r = b.geraete.filter(g => g.rolle === 'pumpe').map(g => this.reihe(d, this.eid(d, g.id, 'pumpzeit'), z, versatz)); if (r.some(x => !x)) return null; return addieren(r.map(x => x.map(v => v || 0))); }
    const r = this.reihe(d, this.eid(d, b.id, 'heizzeit'), z, versatz); return r && r.map(v => v || 0);
  }
  zyklen(d, b, z, versatz = 0) { const r = b.geraete.filter(g => g.rolle === 'pumpe').map(g => this.reihe(d, this.eid(d, g.id, 'pumpzyklen'), z, versatz)); if (r.some(x => !x)) return null; return addieren(r.map(x => x.map(v => Math.round(v || 0)))); }
  /* Auswertung, Abrechnung und Verlauf rechnet die Integration (api §8), die Seite zeigt nur an: null = lädt noch, {} = Fehler */
  /* ---- FE-0008: früheren Zeitraum wählen – ‹ › blättern, Kalender skaliert mit dem Zeitraum (Mockup glas.html, Variante 4) ---- */
  zrGrenze(alle = false) {   // frühester Zeitraum: Beginn der Baustelle (bei „alle“ die früheste), sonst fünf Jahre
    const b = (alle ? this.laufende() : [this.d]).map(x => x.beginn).filter(Boolean).sort()[0];
    return b && b <= this.z.HEUTE ? b : plusTage(this.z.HEUTE, -5 * 366);
  }
  zrMax(z, grenze) { return Math.max(0, zrVersatz(z, grenze, this.z.HEUTE, this.z.WOCHE_ISO[0])); }
  zrInfo(z, v) { return zrInfo(z, v, this.z.HEUTE, this.z.WOCHE_ISO[0]); }
  zrText(z, v = 0) { return v === 0 ? { Tag: 'heute', Woche: 'diese Woche' }[z] || this.zrInfo(z, 0).text : v === 1 && z !== 'Monat' && z !== 'Jahr' ? this.zrInfo(z, 1).text.toLowerCase() : this.zrInfo(z, v).text; }
  zrVgl(z, v = 0) { return z === 'Jahr' ? this.zrInfo('Jahr', v + 1).text : { Tag: v ? 'Vortag' : 'gestern', Woche: 'Vorwoche', Monat: 'Vormonat' }[z]; }
  zrSt(ziel) {
    if (ziel === 'aw') return this.s.aw;
    if (ziel === 'sheet') return this.s.sheet || {};
    const z = ziel === 'c-Tag' ? 'Tag' : 'Woche', c = this.s.cZr ||= {}; return c[z] ||= { zeitraum: z, v: 0 };
  }
  zrV(ziel) { return (this.zrSt(ziel) || {}).v || 0; }
  zrWahl(ziel, z, grenze) {
    const v = this.zrV(ziel), max = this.zrMax(z, grenze), i = this.zrInfo(z, v), k = this.s.zrKal && this.s.zrKal.ziel === ziel ? this.s.zrKal : null, zd = `data-ziel="${ziel}" data-max="${max}"`;
    return `<div class="zr-zeile"><div class="zr-nav glas-panel"><button class="zr-pf" data-act="zr-schritt" ${zd} data-d="1" ${v >= max ? 'disabled' : ''} aria-label="früher" title="früher">‹</button>
        <button class="zr-mitte zr-auf" data-act="zr-kal" ${zd}><b>${i.text}</b>${i.unter ? `<small>${i.unter}</small>` : ''}<span class="zr-pfeil">${k ? '▴' : '▾'}</span></button>
        <button class="zr-pf" data-act="zr-schritt" ${zd} data-d="-1" ${v <= 0 ? 'disabled' : ''} aria-label="später" title="später">›</button></div>
      ${v ? `<button class="glas-panel chip zr-akt" data-act="zr-setz" ${zd} data-v="0">Aktuell</button>` : ''}${k ? this.zrKalender(ziel, z, v, max, k) : ''}</div>`;
  }
  /* Kalender: Tag → Monat mit Tagen, Woche → Monat mit KW-Zeilen, Monat → Jahr mit Monaten, Jahr → Jahre seit Beginn */
  zrKalender(ziel, z, v, max, k) {
    const h = this.z.HEUTE, mo0 = this.z.WOCHE_ISO[0], ver = iso => zrVersatz(z, iso, h, mo0), zd = `data-ziel="${ziel}" data-max="${max}"`;
    const knopf = (iso, text, cls = '') => { const x = ver(iso), an = x >= 0 && x <= max;
      return `<button class="zr-k ${cls} ${x === v ? 'on' : ''} ${x === 0 ? 'jetzt' : ''}" ${an ? `data-act="zr-setz" ${zd} data-v="${x}"` : 'disabled'}>${text}</button>`; };
    let kopf, inhalt, cls, frueher = false, spaeter = false;
    if (z === 'Tag' || z === 'Woche') {
      const erster = `${k.j}-${String(k.m + 1).padStart(2, '0')}-01`, start = plusTage(erster, -((new Date(erster + 'T12:00:00Z').getUTCDay() + 6) % 7));
      const wochen = []; for (let w = start; w.slice(0, 7) <= erster.slice(0, 7) && wochen.length < 6; w = plusTage(w, 7)) wochen.push(w);
      kopf = `${MONATE_LANG[k.m]} ${k.j}`; cls = 'zr-kal-tage';
      inhalt = `<div class="zr-kw-kopf"><span>KW</span>${TAGE.map(x => `<span>${x}</span>`).join('')}</div>` + wochen.map(mo => {
        const tage = [...Array(7)].map((_, n) => plusTage(mo, n)), fremd = iso => iso.slice(0, 7) !== erster.slice(0, 7) ? 'fremd' : '';
        if (z === 'Woche') { const x = ver(mo), an = x >= 0 && x <= max;
          return `<button class="zr-woche ${x === v ? 'on' : ''} ${x === 0 ? 'jetzt' : ''}" ${an ? `data-act="zr-setz" ${zd} data-v="${x}"` : 'disabled'}><b>${kwNr(mo)}</b>${tage.map(t => `<span class="${fremd(t)}">${+t.slice(8)}</span>`).join('')}</button>`; }
        return `<div class="zr-woche-z"><b>${kwNr(mo)}</b>${tage.map(t => knopf(t, +t.slice(8), fremd(t))).join('')}</div>`; }).join('');
      frueher = ver(plusTage(erster, -1)) <= max; spaeter = ver(plusTage(wochen.at(-1), 7)) >= 0 && plusTage(erster, 31).slice(0, 7) <= h.slice(0, 7);
    } else if (z === 'Monat') {
      kopf = String(k.j); cls = 'zr-kal-monate';
      inhalt = MONATE.map((n, m) => knopf(`${k.j}-${String(m + 1).padStart(2, '0')}-01`, n)).join('');
      frueher = ver(`${k.j - 1}-12-01`) <= max; spaeter = k.j < +h.slice(0, 4);
    } else {
      const J0 = +h.slice(0, 4), ab = J0 - Math.min(max, 11); kopf = ab === J0 ? String(J0) : `${ab}–${J0}`; cls = 'zr-kal-monate';
      inhalt = [...Array(J0 - ab + 1)].map((_, n) => knopf(`${ab + n}-01-01`, ab + n)).join('');
    }
    return `<div class="zr-kal glas-panel"><div class="zr-kal-kopf"><button class="zr-pf" data-act="zr-kal-nav" data-d="-1" ${frueher ? '' : 'disabled'} aria-label="zurück">‹</button><b>${kopf}</b>
        <button class="zr-pf" data-act="zr-kal-nav" data-d="1" ${spaeter ? '' : 'disabled'} aria-label="vor">›</button></div>
      <div class="${cls}">${inhalt}</div>
      <div class="zr-kal-fuss"><button class="glas-panel chip" data-act="zr-setz" ${zd} data-v="0">${{ Tag: 'Heute', Woche: 'Diese Woche', Monat: 'Dieser Monat', Jahr: 'Dieses Jahr' }[z]}</button></div></div>`;
  }
  /* Preis simulieren (Herbert 04.10.2026): in der Auswertung mit dem Chip „💶 Preis“; die Integration rechnet alle € damit */
  simAktiv() { return !!this.s.awSim && this.s.view === 'auswertung'; }
  simPreis() { if (!zahl(this.s.simPreis)) { let v = null; try { v = parseFloat(localStorage.getItem('baustelle-sim-preis')); } catch (e) { v = null; } this.s.simPreis = zahl(v) ? v : this.d.e.preis; } return this.s.simPreis; }
  awDaten(z, versatz = 0, scope = this.s.awScope || 'diese', d = this.d, preis = this.simAktiv() ? this.simPreis() : null) {
    if (!d) return null;
    const r = this._holen(`aw:${d.entry}:${z}:${versatz}:${scope}:${d.z.HEUTE}:${preis ?? ''}`, () => this._hass.callWS({ type: 'baustelle/auswertung', entry_id: d.entry, zeitraum: z, versatz, scope, ...(preis !== null ? { preis } : {}) }));
    return r === undefined ? null : r || {};
  }
  abDaten(z, scope = this.s.awScope || 'diese', d = this.d, versatz = 0, preis = this.simAktiv() ? this.simPreis() : null) {
    if (!d) return null;
    const r = this._holen(`ab:${d.entry}:${z}:${versatz}:${scope}:${d.z.HEUTE}:${preis ?? ''}`, () => this._hass.callWS({ type: 'baustelle/abrechnung', entry_id: d.entry, zeitraum: z, versatz, scope, ...(preis !== null ? { preis } : {}) }));
    return r === undefined ? null : r || {};
  }
  verlaufDaten(x) {
    const r = this._holen(`v:${x.entry}:${x.z.HEUTE}`, () => this._hass.callWS({ type: 'baustelle/auswertung', entry_id: x.entry, teil: 'verlauf' }), 900000);
    return r === undefined ? null : r || {};
  }

  /* AN-0005: Leistung einer Stunde, jeder Messwert der Leistungssensoren (HA-Verlauf), je Gerät und als Summe */
  leistungInhalt(s) {
    const d = this.d, b = d.bereiche.find(x => x.id === s.auswahl[0]) || this.b; if (!b) return '';
    const v = s.v || 0, tag = plusTage(this.z.HEUTE, -v), jetztH = +this.z.JETZT.slice(0, 2), h = Math.min(zahl(s.h) ? s.h : v ? 12 : jetztH, v ? 23 : jetztH);
    const ganzerTag = s.lart === 'tag';   // WU-0011: Stunde oder ganzer Tag
    const von = this.zoneMs(tag, ganzerTag ? '00:00' : `${String(h).padStart(2, '0')}:00`, d.z.zone), bis = ganzerTag ? this.zoneMs(plusTage(tag, 1), '00:00', d.z.zone) : von + 36e5;
    const laufend = !v && (ganzerTag || h === jetztH);
    const geraete = b.geraete.filter(g => g.leistung), ids = geraete.map(g => g.leistung);
    // flackerfrei (Herbert 01.10.2026): einmal der ganze Tag, jede Stunde wird daraus nur ausgeschnitten – beim Ziehen kein Laden
    const tagVon = this.zoneMs(tag, '00:00', d.z.zone), tagBis = this.zoneMs(plusTage(tag, 1), '00:00', d.z.zone);
    const roh = !ids.length ? {} : this._holen(`lh:${d.entry}:${b.id}:${tag}:tag`, () => this._hass.callWS({ type: 'baustelle/verlauf', entry_id: d.entry, start_time: new Date(tagVon).toISOString(),
      end_time: new Date(Math.min(tagBis, d.z.jetztMs)).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false }), !v ? 30000 : undefined);
    const ende = laufend ? d.z.jetztMs : bis, farben = ['var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
    const hh = k => String(k).padStart(2, '0');
    // Streifen je Stunde: blau, wo der Container verbraucht hat (HA-Statistik), sonst grau – auch künftige Stunden
    const vb = this.verbrauch(d, b.id, 'Tag', v), farbe = k => (!v && k > jetztH) || !vb || !(vb[k] > 0.001) ? 'rgba(127,127,127,.25)' : 'var(--s1)';
    const grenze = k => Math.max(0, Math.min(100, (k - 0.5) / 23 * 100)).toFixed(2);
    const spur = `linear-gradient(90deg, ${[...Array(24)].map((_, k) => `${farbe(k)} ${grenze(k)}% ${grenze(k + 1)}%`).join(', ')})`;
    const regler = ganzerTag ? '' : `<div class="lh-regler" style="--spur:${spur}">
        <input type="range" min="0" max="23" step="1" value="${h}" data-lh aria-label="Stunde wählen">
        <div class="lh-skala">${[0, 6, 12, 18, 23].map(k => `<span style="left:${(k / 23 * 100).toFixed(1)}%">${k === 23 ? '23' : hh(k)}</span>`).join('')}</div></div>`;
    let inhalt;
    if (!ids.length) inhalt = '<div class="leer">Kein Leistungssensor an den Geräten</div>';
    else if (roh === undefined) inhalt = this._lhLetzt ? `<div class="lh-laedt">${this._lhLetzt}</div>` : LAEDT;   // WU-0012: alter Stand bleibt stehen
    else {
      const ausschnitt = alle => { const vorher = alle.filter(p => p[0] <= von).at(-1), drin = alle.filter(p => p[0] > von && p[0] < bis);
        return [...(vorher ? [[von, vorher[1]]] : []), ...drin]; };   // Stand zu Beginn der Stunde + alle Messwerte darin
      const reihen = geraete.map((g, k) => ({ name: g.n, farbe: farben[k % farben.length], punkte: ausschnitt(((roh || {})[g.leistung] || [])
        .map(x => [zahl(x.lu) ? x.lu * 1000 : Date.parse(x.last_updated || x.last_changed), zahl(x.s ?? x.state) ? Number(x.s ?? x.state) : null]).filter(p => Number.isFinite(p[0])).sort((p, q) => p[0] - q[0])) }));
      const zeiten = [...new Set(reihen.flatMap(r => r.punkte.map(p => p[0])))].sort((a, b2) => a - b2);
      const wert = (r, t) => { let w = null; for (const p of r.punkte) { if (p[0] > t) break; w = p[1]; } return w; };
      const summeR = { name: 'Summe', farbe: 'var(--s1)', summe: true, punkte: zeiten.map(t => [t, reihen.reduce((a, r) => a + (wert(r, t) || 0), 0)]) };
      const zeige = reihen.length > 1 ? [...reihen, summeR] : reihen.map(r => ({ ...r, farbe: 'var(--s1)', summe: true }));
      const spitze = Math.max(0, ...summeR.punkte.map(p => p[1]));
      const mittel = summeR.punkte.length ? summeR.punkte.reduce((a, p, i) => a + p[1] * ((i + 1 < summeR.punkte.length ? summeR.punkte[i + 1][0] : ende) - p[0]), 0) / Math.max(1, ende - summeR.punkte[0][0]) : 0;
      inhalt = `<div class="kennz"><div><b>${de(mittel / 1000, 2)}</b><span>kW im Mittel</span></div><div><b>${de(spitze / 1000, 2)}</b><span>kW Spitze</span></div><div><b>${reihen.reduce((a, r) => a + r.punkte.length, 0)}</b><span>Messwerte</span></div></div>
        <div class="chart-wrap">${stufen(`lh-${b.id}-${tag}-${ganzerTag ? 'tag' : h}`, zeige, von, bis, 'W', ganzerTag ? [0, 4, 8, 12, 16, 20, 24].map(k => [von + k * 36e5, hh(k)]) : null)}</div>
        <div class="legende">${zeige.map(r => `<span><i style="background:${r.farbe}"></i>${esc(r.name)}</span>`).join('')}<span class="leise">jeder Messwert des Shellys${laufend ? ' · bis jetzt' : ''}</span></div>`;
      this._lhLetzt = inhalt;
    }
    return `<div class="block-kopf"><h3>Leistung · ${esc(b.name)}</h3><span class="leise lh-wert">${ganzerTag ? 'ganzer Tag' : `${hh(h)}:00–${hh((h + 1) % 24)}:00`}</span></div>
      <div class="seg">${[['stunde', 'Stunde'], ['tag', 'Tag']].map(([k, t]) => `<button data-act="lh-art" data-v="${k}" class="${(ganzerTag ? 'tag' : 'stunde') === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${this.zrWahl('sheet', 'Tag', this.zrGrenze())}${regler}<div class="lh-daten">${inhalt}</div>`;
  }
  /* WU-0012: in der Leistungs-Einblendung nur Kopf und Datenteil tauschen (kein Neuzeichnen der ganzen Seite) */
  leistungTeil() {
    const s = this.s.sheet, ziel = s && s.art === 'leistung' && this.shadowRoot && this.shadowRoot.querySelector('.lh-daten');
    if (!ziel || !ziel.isConnected) return false;
    const neu = document.createElement('div'); neu.innerHTML = this.leistungInhalt(s);
    const daten = neu.querySelector('.lh-daten'), wert = neu.querySelector('.lh-wert'), alt = this.shadowRoot.querySelector('.lh-wert');
    if (!daten) return false;
    ziel.innerHTML = daten.innerHTML;
    if (wert && alt) alt.textContent = wert.textContent;
    const rNeu = neu.querySelector('.lh-regler'), rAlt = this.shadowRoot.querySelector('.lh-regler');   // Streifen nachfärben
    if (rNeu && rAlt && rNeu.getAttribute && rAlt.setAttribute) rAlt.setAttribute('style', rNeu.getAttribute('style') || '');
    return true;
  }
  /* FE-0009: Heizzeit eines Containers (Pumpenschacht: Pumpzeit) je Stunde, Tag oder Monat */
  heizzeitInhalt(s) {
    const d = this.d, b = d.bereiche.find(x => x.id === s.auswahl[0]) || this.b; if (!b) return '';
    const z = s.zeitraum || 'Tag', v = s.v || 0, zr = this.zeitraum(z, v), r = this.heizStunden(d, b, z, v), su = r ? summe(r) : null;
    const je = { Tag: 'je Stunde', Woche: 'je Tag', Monat: 'je Tag', Jahr: 'je Monat' }[z];
    // AN-0011: eingeschaltet (Shelly an) und davon tatsächlich geheizt (Strom über „heizt tatsächlich ab“) – zwei Zähler der Integration
    const sId = !b.pumpe && this.eid(d, b.id, 'heizzeit_strom'), rs = sId ? this.reihe(d, sId, z, v) : null, ss = rs ? summe(rs.map(x => x || 0)) : null;
    const lab = zr.labels.map((l, i) => z === 'Tag' ? (i % 3 ? '' : l) : z === 'Monat' ? (i % 5 ? '' : l) : l);
    if (sId) return `<div class="block-kopf"><h3>Heizzeit · ${esc(b.name)}</h3><span class="leise">${this.zrText(z, v)}</span></div>
      <div class="seg">${['Tag', 'Woche', 'Monat', 'Jahr'].map(x => `<button data-act="vb-zeitraum" data-ziel="sheet" data-v="${x}" class="${x === z ? 'on' : ''}">${x}</button>`).join('')}</div>
      ${this.zrWahl('sheet', z, this.zrGrenze())}
      <div class="kennz"><div><b>${zahl(su) ? de(su, 1) : '–'}</b><span>h eingeschaltet</span></div><div><b>${zahl(ss) ? de(ss, 1) : '–'}</b><span>h tatsächlich geheizt</span></div>
        <div><b>${zahl(su) && su > 0 && zahl(ss) ? `${de(Math.min(100, ss / su * 100), 0)} %` : '–'}</b><span>davon mit Strom</span></div></div>
      <div class="leise">h ${je} · ${this.zrText(z, v)}</div>
      <div class="chart-wrap">${r && rs ? flaeche(`hz-c-${b.id}-${z}-${v}`, [{ name: 'tatsächlich geheizt', v: rs.map(x => x || 0), farbe: 'var(--s1)' }], zr.labels, 'h',
        z === 'Tag' ? 6 : z === 'Monat' ? 7 : z === 'Woche' ? 1 : 3, { name: 'eingeschaltet', v: r }) : LAEDT}</div>
      <div class="leise">Eingeschaltet = der Shelly ist an. Tatsächlich geheizt = es fließt Strom (über ${this.d.e.zieht_w} W) – schaltet der Thermostat am Heizkörper ab, ist der Shelly an, geheizt wird aber nicht. Ohne Leistungssensor gilt die Schaltzeit. „Tatsächlich geheizt“ wird ab 0.8.29 gezählt.</div>`;
    return `<div class="block-kopf"><h3>${b.pumpe ? 'Pumpzeit' : 'Heizzeit'} · ${esc(b.name)}</h3><span class="leise">${this.zrText(z, v)}</span></div>
      <div class="seg">${['Tag', 'Woche', 'Monat', 'Jahr'].map(x => `<button data-act="vb-zeitraum" data-ziel="sheet" data-v="${x}" class="${x === z ? 'on' : ''}">${x}</button>`).join('')}</div>
      ${this.zrWahl('sheet', z, this.zrGrenze())}
      <div class="kennz"><div><b>${zahl(su) ? de(su, 1) : '–'}</b><span>Stunden ${b.pumpe ? 'gepumpt' : 'geheizt'}</span></div><div><b>${r ? de(Math.max(...r, 0), 1) : '–'}</b><span>h am meisten ${je}</span></div></div>
      <div class="leise">h ${je} · ${this.zrText(z, v)}</div>
      <div class="chart-wrap">${r ? balken(`hz-c-${b.id}-${z}-${v}`, r, zr.labels.map((l, i) => z === 'Tag' ? (i % 3 ? '' : l) : z === 'Monat' ? (i % 5 ? '' : l) : l), 'h') : LAEDT}</div>`;
  }
  /* Gemessen: wann zieht ein Gerät Strom (Leistung über „heizt tatsächlich ab“, Standard 50 W) – Verlauf der Leistungssensoren seit Montag */
  messung(d = this.d) {
    const geraete = d.bereiche.flatMap(b => b.geraete.map(g => ({ b, g, eid: g.leistung || g.schalter }))).filter(x => x.eid);
    if (!geraete.length) return {};
    const ids = [...new Set(geraete.map(x => x.eid))].sort(), start = this.zoneMs(d.z.WOCHE_ISO[0], '00:00', d.z.zone);
    const roh = this._holen(`h:${d.entry}:${d.z.HEUTE}:${d.z.JETZT.slice(0, 4)}`, () => this._hass.callWS({ type: 'baustelle/verlauf', entry_id: d.entry,
      start_time: new Date(start).toISOString(), end_time: new Date(d.z.jetztMs).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false }), 600000);
    if (roh === undefined) return null;
    const tagStart = d.z.WOCHE_ISO.map(t => this.zoneMs(t, '00:00', d.z.zone)), ende = d.z.jetztMs, erg = {};
    for (const { g, eid } of geraete) {
      const liste = ((roh || {})[eid] || []).map(x => ({ s: x.s ?? x.state, t: zahl(x.lu) ? x.lu * 1000 : zahl(x.lc) ? x.lc * 1000 : Date.parse(x.last_updated || x.last_changed) }))
        .filter(x => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
      const tage = TAGE.map(() => ({ an: [], off: [] }));
      liste.forEach((x, i) => {
        const von = Math.max(x.t, start), bis = i + 1 < liste.length ? liste[i + 1].t : ende; if (bis <= von) return;
        const art = x.s === 'unavailable' ? 'off' : (x.s === 'on' || (zahl(x.s) && Number(x.s) > d.e.zieht_w)) ? 'an' : null; if (!art) return;
        tagStart.forEach((ds, k) => { const a = Math.max(von, ds), b = Math.min(bis, ds + 864e5); if (b > a) tage[k][art].push([(a - ds) / 60000, (b - ds) / 60000]); });
      });
      for (const t of tage) for (const art of ['an', 'off']) { const m = []; for (const q of t[art]) { const l = m[m.length - 1]; if (l && q[0] - l[1] < 1) l[1] = Math.max(l[1], q[1]); else m.push([...q]); } t[art] = m; }
      erg[g.id] = tage;
    }
    return erg;
  }

  _kalender(eid, tage = 400) {
    if (!eid) return [];
    const start = new Date(this.zoneMs(this.d ? this.z.HEUTE : new Date().toISOString().slice(0, 10), '00:00', this.d && this.z.zone)), ende = new Date(start.getTime() + tage * 864e5);
    const r = this._holen(`k:${eid}`, () => this._hass.callApi('GET', `calendars/${eid}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(ende.toISOString())}`), 120000);
    return r === undefined ? null : (r || []).map(x => { const s = x.start || {}, e = x.end || {}, von = s.date || this.lokal(s.dateTime).slice(0, 10), bisX = e.date ? plusTage(e.date, -1) : this.lokal(e.dateTime).slice(0, 10);
      return { name: x.summary || '', von, bis: bisX < von ? von : bisX, uid: x.uid || null, recurrence_id: x.recurrence_id || null }; });
  }
  wetterTag(iso) {
    const d = this.d, w = d.wetter || {};
    if (iso === d.z.HEUTE) return { kalt: w.frueh_min, regen: w.regen_heute, regenVortag: w.regen_vortag };
    const f = x => (this.vorhersage.daily || []).find(y => this.lokal(y.datetime).slice(0, 10) === x);
    const t = f(iso), v = plusTage(iso, -1) === d.z.HEUTE ? { precipitation: w.regen_heute } : f(plusTage(iso, -1));
    return { kalt: t && t.templow, regen: t && t.precipitation, regenVortag: v && v.precipitation };
  }

  get azListe() { return [...this.d.arbeitszeiten].sort((a, b) => a.ab.localeCompare(b.ab)); }
  get azJetzt() { const L = this.azListe; return L.filter(a => a.ab <= this.z.HEUTE).at(-1) || L[0] || null; }
  /* Heizplan eines Tages – berechnet von der Integration (plan_woche), hier nur in Text übersetzt */
  /* WU-0009: Tür offen – die lernende Regelung lernt so lange nicht (Zustand von der Integration, lernen.offen) */
  offenText(b) {
    const o = b.lern && b.lern.offen; if (!o) return '';
    return o.art === 'vermutet' ? '🚪 Tür vermutlich offen – kühlt beim Heizen ab, lernt gerade nicht' : '🚪 Tür offen – lernt gerade nicht';
  }
  aufheizTeil(b) {
    const a = (b.lern && b.lern.aufheizen) || {}, w = b.lern && b.lern.warm, n0 = (b.lern && b.lern.auf_n) || 3;
    const z = x => x ? `<div><b>${de(x.rate)} °C/h</b><span class="leise">${x.n}× gemessen${x.n < n0 ? ' · noch zu wenig' : ''}</span></div>` : '<div><span class="leise">noch nicht gelernt</span></div>';
    const anz = [...new Set([1, ...Object.keys(a).map(k => +k.split('|')[1] || 1)])].sort((x, y) => x - y);   // AN-0006: je Anzahl laufender Heizkörper
    return `<div class="gruppe-t">Aufheizen</div><div class="wa-tab"><b></b><b>kalt &lt; 5 °C</b><b>mild</b>${anz.map(n => `<span>${n === 1 ? 'ein Heizkörper' : `${n} Heizkörper`}</span>${z(a[`kalt|${n}`])}${z(a[`mild|${n}`])}`).join('')}</div>
      ${w && w.gelernt && w.plan ? `<div class="wa-heute">⏰<div>Heute ab <b>${uhr(w.plan.start)}</b> – ${w.aufheiz_min} min für ${zahl(w.innen) ? de(w.innen) : '–'} → ${de(w.soll)} °C, warm um <b>${uhr(w.plan.ziel)}</b> (${w.vor ? `${w.vor} min vor Arbeitsbeginn` : 'bei Arbeitsbeginn'})${w.plan.begrenzt ? ' · begrenzt durch „Frühestens“' : ''}</div></div>`
        : w ? `<div class="leise">Ab ${n0} Aufheizungen je Wetter rechnet der Container den Beginn selbst; bis dahin gelten Vorheizen und Kälte-Frühstart.</div>` : '<div class="leise">Der gelernte Beginn wirkt im Modus Thermostat.</div>'}
      <div class="leise">Gemessen wird jedes Aufheizen von mindestens 1 °C unter dem Soll, solange der Heizkörper durchgehend läuft. Kälte draußen steckt in der Rate – darum braucht es keinen eigenen Kälte-Frühstart.</div>`;
  }
  /* AN-0004: „Warm ab“ eines lernenden Containers – alle Zahlen von der Integration (laufzeit.container.<id>.lernen.warm) */
  warmText(b, kurz = false) {
    const w = b.lern && b.lern.warm; if (!w) return '';
    if (!w.gelernt) return kurz ? 'Aufheizen lernt noch' : `lernt noch (${w.n}/${w.n_noetig} Aufheizungen bei ${w.band === 'kalt' ? 'Kälte' : 'mildem Wetter'}) – bis dahin Vorheizen und Kälte-Frühstart`;
    const pl = w.plan; if (!pl) return kurz ? '' : 'heute frei';
    if (kurz) return `heute ab ${uhr(pl.start)} → ${de(w.soll)} °C um ${uhr(pl.ziel)}`;
    return `heizt ab ${uhr(pl.start)}, damit um ${uhr(pl.ziel)} ${de(w.soll)} °C${zahl(w.innen) ? ` (jetzt ${de(w.innen)} °C` : ' ('}${zahl(w.rate) ? `, ${de(w.rate)} °C/h gelernt` : ''}${pl.begrenzt ? ', begrenzt' : ''}) · warm bis ${uhr(pl.ende)}`;
  }
  /* AN-0003: wie sich die Heizzeit zusammensetzt – nur die Abschnitte der Integration (start, vor, a, b, nach, ende) */
  planRechnung(p) {
    const min = (x, y) => `${Math.round(y - x)} min`, teile = [];
    if (p.vor > p.extra) teile.push(`${min(p.extra, p.vor)} früher (${[p.codes.includes('fruehstart') && 'Kälte', p.codes.includes('frueher_nach_regen') && 'Regen gestern'].filter(Boolean).join(' + ') || 'Frühstart'})`);
    if (p.a > p.vor) teile.push(`${min(p.vor, p.a)} Vorheizen`);
    teile.push(`Arbeit ${uhr(p.a)}–${uhr(p.b)}`);
    if (p.nach > p.b) teile.push(`${min(p.b, p.nach)} Nachheizen`);
    if (p.ende > p.nach) teile.push(`${min(p.nach, p.ende)} Kleidung trocknen`);
    return `Heizt ${uhr(p.extra)}–${uhr(p.ende)} = ${teile.join(' + ')}`;
  }
  planTag(tag) { return this.planIso(this.z.WOCHE_ISO[TAGE.indexOf(tag)]); }
  planIso(iso) {
    const q = this.d.plan[iso];
    if (!q) return null;
    const w = this.wetterTag(iso);
    const gruende = (q.gruende || []).map(c => c === 'ausnahme' ? `Ausnahme: ${(q.ausnahme && (q.ausnahme.notiz || AUSNAHME[q.ausnahme.art])) || 'andere Zeiten'}`
      : c === 'fruehstart' ? (zahl(w.kalt) ? `Frühstart ${de(w.kalt).replace('-', '−')} °C` : 'Frühstart')
      : c === 'frueher_nach_regen' ? 'früher nach Regen'
      : c === 'gelernt' ? '🧠 gelernter Beginn'
      : c === 'trocknen' ? (zahl(w.regen) ? `Kleidung trocknen, ${de(w.regen, w.regen % 1 ? 1 : 0)} mm Regen` : 'Kleidung trocknen') : String(c));
    return { vor: q.vor, extra: zahl(q.start) ? q.start : q.vor, a: q.a, b: q.b, nach: q.nach, ende: q.ende, gruende, codes: q.gruende || [], ausnahme: q.ausnahme || null,
      eigene: q.eigene || [], ausnahmen: q.ausnahmen || [] };
  }
  statusText() {
    const d = this.d;
    if (!d.geladen) return 'nicht geladen – Integration prüfen';   // Einrichtung fehlgeschlagen: keine Werte, nichts wird geschaltet
    if (!d.e.auto) return 'Handbetrieb – nichts wird geschaltet';
    if (d.jetztBis) return `♨ alle heizen bis ${d.jetztBis}`;
    if (d.statusText) return d.statusText;
    const p = this.planTag(this.z.HEUTE_TAG), j = minu(this.z.JETZT);
    if (p && j >= p.extra && j < p.ende) return `♨ heizt bis ${uhr(p.ende)}`;
    if (p && j < p.extra) return `Start um ${uhr(p.extra)}`;
    return 'aus';
  }
  zeitstrahl(p, jetzt = false) {
    const seg = p ? [[p.extra, p.vor, 'extra'], [p.vor, p.a, 'vor'], [p.a, p.b, 'heiz'], [p.b, p.nach, 'vor'], [p.nach, p.ende, 'trock'], ...(p.eigene || []).map(f => [f[0], f[1], 'eigen'])] : [];   // FE-0012
    return this.zeitstrahlSeg(seg, jetzt);
  }
  zeitstrahlSeg(liste, jetzt = false) {
    const A = 4 * 60, B = 20 * 60, x = m => Math.max(0, Math.min(100, (m - A) / (B - A) * 100));
    const seg = (von, bis, k) => bis > von ? `<i class="tl-${k}" style="left:${x(von)}%;width:${x(bis) - x(von)}%"></i>` : '';
    return `<div class="tl-spur">${liste.map(q => seg(q[0], q[1], q[2])).join('')}${jetzt ? `<i class="tl-jetzt" style="left:${x(minu(this.z.JETZT))}%"></i>` : ''}</div>`;
  }
  bName(id) { return id ? (this.d.bereiche.find(b => b.id === id) || { name: id }).name : 'Baustelle'; }
  /* Staffelung: gemessene Last, Grenze und freier Platz – gerechnet von der Integration (laufzeit.staffel) */
  last() {
    const d = this.d, S = d.staffel || {}, e = d.e;
    const alleG = d.bereiche.flatMap(b => b.geraete.map(g => ({ b, g }))), hk = alleG.filter(x => x.g.heizer);
    // Nur Werte der Integration; solange sie fehlen (vor der ersten Rechnung), gibt es hier keine Anschlüsse
    const n = x => zahl(x) ? Number(x) : 0;
    const A = (S.anschluesse || []).map(a => {
      const s = d.anschluesse.find(x => x.id === a.id) || {};
      return { id: a.id, name: a.name || s.name || a.id, ampere: s.ampere, phasen: s.phasen, voll: n(a.voll_kw), grenze: n(a.grenze_kw), reserve: n(a.reserve_kw),
        heiz: n(a.heiz_kw), pumpe: n(a.pumpe_kw), sonst: n(a.sonst_kw), frei: n(a.frei_kw) };
    });
    const s3 = k => A.reduce((x, a) => x + a[k], 0);
    return { A, heiz: s3('heiz'), pumpe: s3('pumpe'), sonst: s3('sonst'), grenze: s3('grenze'), reserve: s3('reserve'), gesamt: s3('heiz') + s3('pumpe') + s3('sonst'), hk,
      laufen: zahl(S.laufen) ? S.laufen : hk.filter(x => x.g.an && !x.b.offline).length, warten: zahl(S.warten) ? S.warten : hk.filter(x => x.g.warte).length, max: zahl(S.max) ? S.max : e.max_gleich };
  }
  stromBalken(L, klein) {
    const w = v => `${L.grenze > 0 ? Math.max(0, v / L.grenze * 100) : 0}%`;
    return `<div class="strom ${klein ? 'klein' : ''}"><div class="strom-spur"><i class="s-heiz" style="width:${w(L.heiz)}"></i><i class="s-pumpe" style="width:${w(L.pumpe)}"></i><i class="s-sonst" style="width:${w(L.sonst)}"></i>
      <i class="s-res" style="width:${w(L.reserve)}"></i></div></div>`;
  }
  arbeitsende() { const p = this.planTag(this.z.HEUTE_TAG); return p ? uhr(p.b) : null; }
  /* Heizzeiten eines Containers an einem Tag der Woche: Abschnitte der Integration [von, bis, art] in Minuten */
  heizzeiten(b, t) {
    if (b.pumpe) return [];
    const iso = this.z.WOCHE_ISO[TAGE.indexOf(t)], seg = (this.d.abschnitte[b.id] || {})[iso] || [];
    return seg.filter(q => zahl(q[0]) && zahl(q[1])).map(q => [Number(q[0]), Number(q[1]), ABSCHNITT[q[2]] || 'heiz']).filter(x => x[1] > x[0]).sort((p, q) => p[0] - q[0]);
  }
  /* Wann ein Heizkörper wirklich Strom zieht (Leistung über „heizt tatsächlich ab“, Standard 50 W) – aus dem Verlauf der Leistungssensoren */
  aktiv(b, g, t) {
    const leer = { an: [], off: [] };
    if (!g.heizer) return leer;
    const tagNr = TAGE.indexOf(t), heuteNr = TAGE.indexOf(this.z.HEUTE_TAG); if (tagNr > heuteNr) return leer;
    const m = this.mess && this.mess[g.id];
    return (m && m[tagNr]) || leer;
  }
  uebersichtHeizzeiten() {
    const art = this.s.hzArt || 'tag', tag = this.s.hzTag || this.z.HEUTE_TAG, C = this.d.bereiche.filter(b => !b.pumpe);
    const A = 4 * 60, B = 21 * 60, x = m => Math.max(0, Math.min(100, (m - A) / (B - A) * 100)), breite = (a, b) => Math.max(0, x(b) - x(a));
    const std = segs => segs.reduce((a, q) => a + (q[1] - q[0]), 0) / 60;
    const HZ = b => b.geraete.filter(g => g.heizer);
    const ohne = b => `<div class="hz-c"><span class="hz-cn">${esc(b.name)}</span><span class="leise hz-cp">noch kein Heizkörper</span></div>
      <div class="hz-ohne"><button class="chip glas-panel" data-act="container" data-id="${b.id}">+ Heizkörper zuordnen</button></div>`;   // FE-0007: Container ohne Heizkörper trotzdem zeigen
    const tagNr = TAGE.indexOf(tag), heuteNr = TAGE.indexOf(this.z.HEUTE_TAG), jetzt = minu(this.z.JETZT);
    this.mess = this.messung();
    const kopf = `<div class="block-kopf"><b>Wann welche Heizung heizt</b><div class="seg klein">${[['tag', 'Tag'], ['woche', 'Woche']].map(([k, t]) => `<button data-act="hz-art" data-v="${k}" class="${art === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;
    if (this.mess === null) return `<div class="glas-panel block">${kopf}${LAEDT}</div>`;
    let inhalt;
    if (!C.length) inhalt = '<div class="leer">Keine Container</div>';
    else if (art === 'tag') {
      const zukunft = tagNr > heuteNr, heute = tagNr === heuteNr;
      inhalt = `<div class="vb-wer">${this.z.WOCHE.map(([t, d]) => `<button data-act="hz-tag" data-v="${t}" class="${t === tag ? 'on' : ''}">${t === this.z.HEUTE_TAG ? 'heute' : t} ${d.slice(0, 2)}.</button>`).join('')}</div>
        <div class="leise">${zukunft ? 'Noch nichts gemessen – blass der Plan.' : heute ? 'Bis jetzt gemessen, danach blass der Plan.' : 'Gemessen an der Leistung: kräftig = zieht Strom (über 50 W).'}</div>
        <div class="hz-tag">${C.map(b => { if (!HZ(b).length) return ohne(b); const plan = this.heizzeiten(b, tag), ph = std(plan);
          return `<div class="hz-c"><span class="hz-cn">${esc(b.name)}${b.bedarf ? ' <span class="leise">bei Bedarf</span>' : ''}${b.offline ? ' <span class="rot-t">offline</span>' : ''}</span><span class="leise hz-cp">${ph ? `${de(ph)} h geplant` : b.bedarf ? 'kein Termin' : !b.auto ? 'Hand' : 'frei'}</span></div>
            ${HZ(b).map(g => { const a = this.aktiv(b, g, tag), ah = std(a.an);
              return `<div class="hz-zeile"><span class="hz-n hz-g">${esc(g.n)}</span>
                <div class="tl-spur hz">${plan.map(q => `<i class="hz-plan ${!zukunft && (!heute || q[1] <= jetzt) ? 'vorbei' : ''}" style="left:${x(q[0])}%;width:${breite(q[0], q[1])}%"></i>`).join('')}
                  ${zukunft ? '' : a.an.map(q => `<i class="hz-an" style="left:${x(q[0])}%;width:${breite(q[0], q[1])}%"></i>`).join('')}
                  ${a.off.map(q => `<i class="hz-off" style="left:${x(q[0])}%;width:${breite(q[0], q[1])}%"></i>`).join('')}
                  ${heute ? `<i class="tl-jetzt" style="left:${x(jetzt)}%"></i>` : ''}</div>
                <span class="hz-h">${zukunft ? '–' : `${de(ah)} h`}</span></div>`; }).join('')}`; }).join('')}
          <div class="hz-zeile achse"><span></span><div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div><span></span></div></div>
        <div class="hp-legende"><span><i class="hz-an"></i>zieht Strom</span><span><i class="hz-plan"></i>geplant</span><span><i class="hz-off"></i>offline</span><span class="leise">Lücken im Plan: Thermostat, Staffelung, Tür offen</span></div>`;
    } else {
      const zeilen = C.flatMap(b => HZ(b).length ? HZ(b).map(g => ({ b, g, h: TAGE.map((t, k) => k > heuteNr ? std(this.heizzeiten(b, t)) : std(this.aktiv(b, g, t).an)) })) : [{ b, g: null, h: null }]);
      const max = Math.max(...zeilen.flatMap(z => z.h || []), 1);
      inhalt = `<div class="hz-woche"><div class="hz-wk"><span></span>${this.z.WOCHE.map(([t, d]) => `<span class="${t === this.z.HEUTE_TAG ? 'heute' : ''}">${t}<br><small>${d.slice(0, 2)}.</small></span>`).join('')}<span>Σ</span></div>
        ${zeilen.map(({ b, g, h }) => !g ? `<div class="hz-wz"><span class="hz-n">${esc(b.name)}</span><button class="hz-wz-ohne leise" data-act="container" data-id="${b.id}">noch kein Heizkörper · zuordnen</button></div>` : `<div class="hz-wz"><span class="hz-n">${esc(b.name)} <span class="leise">· ${esc(g.n)}</span></span>${h.map((v, k) => `<button class="hz-zelle ${k > heuteNr ? 'geplant' : ''}" data-act="hz-tag" data-v="${TAGE[k]}" data-art="tag" style="--a:${v ? .15 + .75 * v / max : 0}" title="${esc(b.name)} · ${esc(g.n)} ${TAGE[k]}: ${de(v)} h ${k > heuteNr ? 'geplant' : 'gemessen'}">${v ? de(v, v % 1 ? 1 : 0) : ''}</button>`).join('')}<b class="hz-sum">${de(h.slice(0, heuteNr + 1).reduce((a, v) => a + v, 0), 0)} h</b></div>`).join('')}</div>
        <div class="leise">Stunden, in denen der Heizkörper Strom gezogen hat (heute bis jetzt); kommende Tage blass und kursiv = geplant. Σ = bisher gemessen. Tippen zeigt den Tag.</div>`;
    }
    return `<div class="glas-panel block">${kopf}${inhalt}</div>`;
  }
  anschluss(id) { return this.d.anschluesse.find(a => a.id === id) || this.d.anschluesse[0] || { id: null, name: 'kein Anschluss', ampere: 0, phasen: 3, reserve: 0 }; }
  laufende() { return this.alle.filter(x => x.aktiv); }
  firma(id, d = this.d) { return d.firmen.find(f => f.id === id) || d.firmen[0]; }
  /* Was im Verbrauch gestapelt wird: Container dieser Baustelle, laufende Baustellen oder Firmen */
  quellen(st, ziel) {
    const alle = ziel === 'aw' && this.s.awScope === 'alle', lauf = alle ? this.laufende() : [this.d], vs = st.v || 0;   // vs: gewählter früherer Zeitraum (FE-0008)
    if (st.gruppe === 'firma') {   // kWh je Firma und Periode rechnet die Integration (Firma je Tag)
      const namen = [...new Map(lauf.flatMap(l => l.firmen.map(f => [f.eigen ? 'eigen' : f.name, f]))).values()];
      return namen.map((f, k) => ({ id: f.eigen ? 'eigen' : f.name, name: f.name, farbe: `var(--s${(k % 6) + 1})`, v: z => { const a = this.abDaten(z, alle ? 'alle' : 'diese', this.d, vs); if (!a) return null;
        return (a.reihen || {})[f.eigen ? 'eigen' : f.name] || Array(this.zeitraum(z, vs).n).fill(0); } }));
    }
    if (alle) return lauf.map((l, k) => ({ id: l.entry, name: l.titel, farbe: `var(--s${(k % 6) + 1})`, v: z => this.verbrauch(l, null, z, vs) }));
    return this.d.bereiche.map(b => ({ id: b.id, name: b.name, farbe: BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], v: z => this.verbrauch(this.d, b.id, z, vs) }));
  }
  verbrauchInhalt(st, ziel, kennzahlen) {
    const Q = this.quellen(st, ziel), z = st.zeitraum, aus = Q.filter(q => st.auswahl.includes(q.id)), alleGewaehlt = aus.length === Q.length && Q.length > 0;
    const alle = ziel === 'aw' && this.s.awScope === 'alle', summenName = alle ? 'Alle laufenden' : this.d.titel;
    const zr = this.zeitraum(z, st.v || 0), labels = zr.labels, zd = `data-ziel="${ziel}"`;
    const was = st.gruppe === 'firma' ? 'Firmen' : alle ? 'Baustellen' : 'Container';
    const titel = !aus.length ? `${esc(summenName)} · Summe` : aus.length === 1 ? esc(aus[0].name) : `${aus.length} ${was} gestapelt`;
    const eur = st.t === 'eur', f = eur ? this.d.e.preis : 1;   // FE-0009: Kosten-Kachel zeigt denselben Verlauf in € (kWh × Preis)
    // WU-0013: ein Container mit Heizkörpern – „ohne Automatik“ von der Integration (baustelle/ohne)
    const einC = ziel === 'sheet' && st.auswahl.length === 1 ? this.d.bereiche.find(b => b.id === st.auswahl[0] && !b.pumpe && b.geraete.some(g => g.heizer)) : null;
    const basis = st.ohneBasis || 'geraet';
    const oa = einC ? this._holen(`oh:${this.d.entry}:${einC.id}:${z}:${st.v || 0}:${basis}`, () => this._hass.callWS({ type: 'baustelle/ohne', entry_id: this.d.entry, bereich: einC.id, zeitraum: z, versatz: st.v || 0, basis })) : undefined;
    const werte = Q.map(q => ({ q, v: q.v(z) })), laedt = werte.some(x => !x.v);
    const reihen = laedt ? [] : aus.length ? werte.filter(x => st.auswahl.includes(x.q.id)).map(({ q, v }) => ({ name: q.name, v, farbe: q.farbe }))
      : [{ name: 'Summe', v: addieren(werte.map(x => x.v)).length ? addieren(werte.map(x => x.v)) : Array(zr.n).fill(0), farbe: 'var(--s1)' }];
    const summeJe = labels.map((_, i) => reihen.reduce((a, r) => a + (r.v[i] || 0), 0)), sum = summe(summeJe);
    const spitze = Math.max(...summeJe, 0), wo = sum > 0 ? labels[summeJe.indexOf(spitze)] : '–';
    const einheit = eur ? '€' : z === 'Tag' ? 'kWh/h' : 'kWh', je = `${{ Tag: 'je Stunde', Woche: 'je Tag', Monat: 'je Tag', Jahr: 'je Monat' }[z]} · ${this.zrText(z, st.v || 0)}`;
    const p = this.d.e.preis;
    return `<div class="block-kopf">${ziel === 'sheet' ? `<h3>${eur ? 'Kosten' : 'Verbrauch'}</h3>` : '<b>Verbrauch</b>'}<span class="leise">${titel}</span></div>
      <div class="seg">${['Tag', 'Woche', 'Monat', 'Jahr'].map(v => `<button data-act="vb-zeitraum" ${zd} data-v="${v}" class="${v === z ? 'on' : ''}">${v}</button>`).join('')}</div>
      ${ziel === 'aw' ? '' : this.zrWahl(ziel, z, this.zrGrenze(alle))}
      <div class="vb-gruppe"><span class="leise">stapeln nach</span><div class="seg klein">${[['teil', alle ? 'Baustelle' : 'Container'], ['firma', 'Firma']].map(([k, t]) => `<button data-act="vb-gruppe" ${zd} data-v="${k}" class="${(st.gruppe || 'teil') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="vb-wer"><button data-act="vb-wer" ${zd} class="${!aus.length ? 'on' : ''}"><i style="background:var(--s1)"></i>Summe</button>
        <button data-act="vb-wer" ${zd} data-id="*" class="${alleGewaehlt ? 'on' : ''}">Alle gestapelt</button>
        ${Q.map(q => `<button data-act="vb-wer" ${zd} data-id="${esc(q.id)}" class="${st.auswahl.includes(q.id) ? 'on' : ''}"><i style="background:${q.farbe}"></i>${esc(q.name)}${st.auswahl.includes(q.id) ? ' ✓' : ''}</button>`).join('')}</div>
      ${kennzahlen ? `<div class="kennz"><div><b>${laedt ? '–' : de(sum, sum < 100 ? 1 : 0)}</b><span>kWh ${{ Tag: 'heute', Woche: 'diese Woche', Monat: 'im Monat', Jahr: 'im Jahr' }[z]}${reihen.length > 1 ? ' zusammen' : ''}</span></div>
        <div><b>${laedt ? '–' : de(sum * p, 2)} €</b><span>Kosten</span></div><div><b>${laedt ? '–' : wo}</b><span>Spitze ${laedt ? '–' : de(spitze, 1)} kWh</span></div></div>` : ''}
      ${einC ? `<div class="vb-gruppe"><span class="leise">ohne Automatik mit</span><div class="seg klein">${[['geraet', 'Ø je Gerät'], ['typ', 'Ø je Typ']].map(([k, t]) => `<button data-act="oh-basis" data-v="${k}" class="${basis === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        ${oa && oa.ergebnis ? `<div class="kennz"><div><b>${de(oa.ohne_kwh, oa.ohne_kwh < 100 ? 1 : 0)}</b><span>kWh ohne Automatik</span></div><div><b>${de(oa.ergebnis.gespart_eur, 2)} €</b><span>gespart</span></div><div><b>${de(oa.ergebnis.prozent, 0)} %</b><span>weniger</span></div></div>`
          : oa ? '<div class="leise">Noch keine gemessene Leistung der Heizkörper – „ohne Automatik“ folgt nach dem ersten Heizen.</div>' : ''}
        <div class="leise">So rechnet „ohne Automatik“: ${basis === 'typ' ? 'die Ø-Leistung aller Heizkörper desselben Typs (Ölradiator bzw. Konvektor)' : 'jeder Heizkörper mit seiner gemessenen Ø-Leistung im Betrieb (sobald er Strom zieht, ab 5 W)'} rund um die Uhr seit Beginn der Baustelle; gespart = ohne Automatik − tatsächlich verbraucht, mal Strompreis.</div>` : ''}
      <div class="leise">${einheit} ${je}${aus.length > 1 ? ' · gestapelt, oberste Kante = Summe' : ''}</div>
      <div class="chart-wrap">${laedt ? LAEDT : flaeche(`vb-${ziel}-${this.s.awScope || ''}-${st.gruppe || ''}-${aus.map(q => q.id).join('_') || 'alle'}-${z}${eur ? '-eur' : ''}`, eur ? reihen.map(r => ({ ...r, v: r.v.map(x => (x || 0) * f) })) : reihen, labels, einheit, z === 'Tag' ? 6 : z === 'Monat' ? 7 : z === 'Woche' ? 1 : 3,
        oa && oa.ergebnis ? { name: 'ohne Automatik', v: oa.reihe.map(x => x * f) } : null)}</div>
      ${reihen.length > 1 ? `<div class="vb-je">${reihen.map(r => { const su = summe(r.v), sp = Math.max(...r.v, 0);
          return `<div><i style="background:${r.farbe}"></i><span class="n">${esc(r.name)}</span><b>${de(su, su < 100 ? 1 : 0)} kWh</b><span>${de(su * p, 2)} €</span><span class="leise">Spitze ${su > 0 ? labels[r.v.indexOf(sp)] : '–'}</span></div>`; }).join('')}</div>` : ''}`;
  }
  /* Abrechnung: je Firma die Container mit kWh und Kosten im gewählten Zeitraum (rechnet die Integration, Firma je Tag) */
  abrechnung(z) {
    const lauf = this.s.awScope === 'alle' ? this.laufende() : [this.d], p = this.d.e.preis, vs = this.zrV('aw'), a = this.abDaten(z, undefined, this.d, vs), zeilen = a && (a.firmen || []);
    const wann = this.zrText(z, vs);
    return `<div class="glas-panel block"><div class="block-kopf"><b>Abrechnung nach Firma</b><span class="leise">${wann} · ${de(p, 2)} € je kWh</span></div>
      ${!zeilen ? LAEDT : !zeilen.length ? '<div class="leer">Noch kein Verbrauch in diesem Zeitraum</div>' : zeilen.map(f => `<div class="ab-firma ${f.eigen ? 'eigen' : ''}"><div class="ab-kopf"><b>${esc(f.firma)}</b><span><b>${de(f.eur, 2)} €</b> <span class="leise">${de(f.kwh, 0)} kWh · ${de(f.anteil, 0)} %</span></span></div>
        ${(f.container || []).map(x => `<div class="ab-c"><span>${esc(x.name)}${lauf.length > 1 ? ` <span class="leise">· ${esc(x.titel)}</span>` : ''}</span><span class="leise">${de(x.kwh, 0)} kWh · ${de(x.eur, 2)} €</span></div>`).join('')}</div>`).join('')}
      <button class="knopf" data-act="csv" data-art="firma">⇩ Abrechnung als CSV</button></div>`;
  }
  freiText(iso) {
    const a = this.d.ausnahmen.find(x => x.datum === iso), f = this.d.frei[iso];
    if (a && a.art === 'frei') return `Ausnahme: frei${a.notiz ? ' – ' + esc(a.notiz) : ''} · nur Frostschutz`;
    if (f === 'feiertag') return `${esc(this.d.freiName[iso] || 'Feiertag')} · nur Frostschutz`;
    if (f === 'urlaub') return 'Urlaub · nur Frostschutz';
    return 'frei · nur Frostschutz';
  }
  heizplanInhalt() {
    const e = this.d.e;
    return `<div class="hp-legende"><span><i class="tl-extra"></i>Frühstart</span><span><i class="tl-eigen"></i>eigenes Zeitfenster</span><span><i class="tl-vor"></i>Vor- und Nachheizen ${e.vorheizen}/${e.nachheizen} min</span><span><i class="tl-heiz"></i>Arbeitszeit</span><span><i class="tl-trock"></i>Kleidung trocknen</span></div>
      <div class="hp">${this.z.WOCHE.map(([t, d], k) => { const p = this.planTag(t), h = t === this.z.HEUTE_TAG, iso = this.z.WOCHE_ISO[k];
        return `<div class="hp-zeile ${h ? 'heute' : ''} ${this.d.ausnahmen.some(x => x.datum === iso) ? 'ausn' : ''}"><div class="hp-tag"><b>${h ? 'heute' : t}</b><span>${d}</span></div>
          <div class="hp-mitte">${this.zeitstrahl(p, h)}<div class="leise">${p ? p.gruende.map(esc).join(' · ') : this.freiText(iso)}</div></div>
          <div class="hp-zeit">${p ? `${uhr(p.extra)}<br>${uhr(p.ende)}` : '–'}</div></div>`; }).join('')}
        <div class="hp-zeile achse"><div></div><div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div><div></div></div></div>`;
  }
  get b() { return this.d && this.d.bereiche.find(x => x.id === this.s.cid); }
  gehe(view, cid = null) { this.s.view = view; this.s.cid = cid; this.s.leeren(); this.s.zrKal = null; this.neuZeichnen(true); }
  herunterladen(url, name) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    const a = document.createElement('a'); if (!a) return; a.href = url; a.download = name; if (a.click) a.click();
  }
  datei(inhalt, name, typ) {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
    this.herunterladen(URL.createObjectURL(new Blob([inhalt], { type: typ })), name);
  }
  csv(art) {
    // Export (Semikolon, deutsches Komma – öffnet direkt in Excel); die CSV baut die Integration (api §8). art 'firma': Abrechnung je Firma und Container
    let text, name;
    if (this.s.view === 'bsdetail') {
      const x = this.alle.find(y => y.entry === this.s.bs), v = x && this.verlaufDaten(x);
      if (!v || !v.csv) return this.toast('Werte laden noch …');
      text = v.csv; name = `baustelle-verbrauch-${x.titel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    } else {
      const z = (this.s.aw || { zeitraum: 'Monat' }).zeitraum, lauf = this.s.awScope === 'alle' ? this.laufende() : [this.d], a = this.abDaten(z, undefined, this.d, (this.s.aw || {}).v || 0);
      if (!a || !a.csv) return this.toast('Werte laden noch …');
      text = a.csv[art === 'firma' ? 'firma' : 'verbrauch'];
      name = `baustelle-${art === 'firma' ? 'abrechnung' : 'verbrauch'}-${lauf.length > 1 ? 'alle' : this.d.titel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${z.toLowerCase()}.csv`;
    }
    const zeilen = text.replace(/^\ufeff/, '').split('\r\n');
    this.datei(text, name, 'text/csv;charset=utf-8');
    this.toast(`${name} · ${zeilen.length - 1} Zeilen`);
    return zeilen;
  }
  meldungOffen(m) { return !['geschlossen', 'verworfen', 'erledigt'].includes(m.status); }
  meldungenMarkdown() {
    const ART = { fehler: 'Fehler', wunsch: 'Wunsch', anregung: 'Anregung' };
    return (this.meldungen() || []).map(m => `- [${this.meldungOffen(m) ? ' ' : 'x'}] **${m.ticket ? m.ticket + ' ' : ''}${ART[m.art] || m.art}** (${TICKET_STATUS[m.status] || m.status}, ${this.meldungZeit(m)}, v${m.version || '–'}, ${m.geraet || '–'}, ${m.kontext || '–'}): ${m.text}`).join('\n');
  }
  meldungen() { const r = this._holen('meldungen', () => this._hass.callWS({ type: 'baustelle/meldungen', entry_id: this.d ? this.d.entry : undefined }), 60000); return r === undefined ? null : Array.isArray(r) ? r : (r && r.meldungen) || []; }
  meldungZeit(m) { const l = this.lokal(m.zeit); return l ? `${wtag(l)} ${kurzDatum(l)} ${l.slice(11, 16)}` : '–'; }
  /* Einblendung öffnen (data-act="sheet" und Lit-Vorlagen); ds wie dataset des Knopfs (id, t, …) */
  einblenden(art, ds = {}) {
    const S = this.s, d = this.d, b = this.b, el = { dataset: { s: art, ...ds } }, neu = () => this.neuZeichnen();
    if (art === 'termin') { S.sheet = { art: 'termin', form: { b: el.dataset.id || S.cid, titel: '', datum: plusTage(this.z.HEUTE, 7), von: '09:00', bis: '10:00', wieder: 'einmal', boost: false } }; return neu(); }
    if (art === 'urlaub') { S.sheet = { art: 'urlaub', form: { name: '', von: plusTage(this.z.HEUTE, 14), bis: plusTage(this.z.HEUTE, 18) } }; return neu(); }
    if (art === 'container-neu') { S.sheet = { art, form: { name: '', art: 'Container', fuehler: '', schalter: '', typ: 'Ölradiator' } }; return neu(); }
    if (art === 'wetterquelle') { const o = d.optionen; S.sheet = { art, form: { wetter: o.wetter || '', temp_sensor: o.temp_sensor || '', regen_sensor: o.regen_sensor || '', urlaub_kalender: o.urlaub_kalender || '', feiertag_kalender: o.feiertag_kalender || '', termine_kalender: d.termineKal || '' } }; return neu(); }
    if (art === 'bs-loeschen') { S.sheet = { art, id: el.dataset.id }; return neu(); }
    if (art === 'zeitraum-bs') { S.sheet = { art, form: { beginn: d.beginnAuto ? '' : d.beginn || '', ende: d.ende || '', hp: [...d.hp] } }; return neu(); }
    if (art === 'name' || art === 'baustelle-neu') { S.sheet = { art, form: { name: art === 'name' && d ? d.titel : '' } }; return neu(); }
    S.sheet = { art, t: el.dataset.t, i: +el.dataset.i, auswahl: el.dataset.id ? [el.dataset.id] : [], zeitraum: 'Tag' }; return neu();
  }
  /* Container (src/ansichten/container.js, BSM-022 3d); Übersicht und Einblendungen nutzen sie über klick() */
  nurAdmin(fn) { return (...x) => this.nurLesen() ? this.toast(NUR_ANSEHEN) : fn(...x); }   // wie NUR_LESEN_SPERRE für Lit-Knöpfe (.nur-admin)
  modusSetzen(x, m) { if (x.modus === m) return undefined; return this.setzen(['bereiche', x.id, 'modus'], m, `${x.name}: ${(MODI.find(q => q[0] === m) || [m, m])[1]}`); }
  boostUmschalten(x) { return this.aktion('boost', { bereich: x.id, an: !x.boost }, !x.boost ? `${x.name}: schnell aufheizen` : `${x.name}: normal weiter`); }
  sollSchritt(x, dd) {
    if (this.d.e.soll_art === 'gleitend') return this.aktion('soll_versch', { bereich: x.id, d: dd }, `Soll heute ${dd > 0 ? 'wärmer' : 'kühler'} – ab morgen früh wieder gleitend · als „${dd > 0 ? 'zu kalt' : 'zu warm'}“ gemerkt`);   // gleitend: bis morgen früh verschieben und als Gefühl merken (Herbert 01.10.2026)
    return this.setzen(['bereiche', x.id, 'soll'], Math.max(5, Math.min(30, (x.soll ?? this.d.e.soll) + dd)));
  }
  gefuehl(x, v) { return this.aktion('gefuehl', { bereich: x.id, wert: v }, v === 0 ? 'Gemerkt: passt' : `Gemerkt: ${v < 0 ? 'zu kalt' : 'zu warm'} – das Soll lernt mit`); }
  sollZurueck(x) { return this.aktion('soll_versch_weg', { bereich: x.id }, 'Zurück auf gleitendes Soll'); }
  geraetAktiv(b, i) { const g = b.geraete[i]; return this.aktion('aktiv', { geraet: g.id, an: !g.aktiv }, g.aktiv ? `${g.n} inaktiv – die Automatik lässt es aus` : `${g.n} wieder aktiv`); }
  geraetAutomatik(b, i) { const g = b.geraete[i]; return this.aktion('automatik', { geraet: g.id }, `${g.n}: Automatik übernimmt`); }
  geraetBearbeiten(b, i) { const g = b.geraete[i];
    this.s.sheet = { art: 'geraet-edit', i, form: { n: g.n, schalter: g.schalter, typ: g.typ, bereich: b.id, leistung: g.leistungEigen || '', energie: g.energieEigen || '', aktiv: g.aktiv } }; return this.neuZeichnen(); }
  lernenUmschalten(x) { return this.setzen(['bereiche', x.id, 'lernen'], !(x.lern && x.lern.an)); }
  trocknenUmschalten(x) { return this.setzen(['bereiche', x.id, 'trocknen'], !x.trocknen); }
  bedarfAn(id, v) {
    const S = this.s, x = this.d.bereiche.find(y => y.id === id), boost = !!(S.sheet && S.sheet.art === 'bedarf' && S.sheet.boost);
    const felder = v === 'ende' ? { bis: this.isoHeute(this.arbeitsende() || '16:30') } : v === 'abend' ? { bis: this.isoHeute('19:00') } : { minuten: +v };
    const bisText = v === 'ende' ? this.arbeitsende() : v === 'abend' ? '19:00' : uhr(minu(this.z.JETZT) + +v);
    S.sheet = null; this.neuZeichnen(); return this.aktion('bedarf', { bereich: x.id, ...felder, boost }, `${x.name} heizt bis ${bisText}`);
  }
  bedarfAus(id) { const x = this.d.bereiche.find(y => y.id === id); return this.aktion('bedarf_aus', { bereich: x.id }, `${x.name} aus – nur Frostschutz`); }
  terminWeg(t) {
    if (!t.uid) return this.toast('Dieser Kalender nennt keine Kennung – Termin bitte im Kalender löschen');
    return this.ws({ type: 'calendar/event/delete', entity_id: this.d.termineKal, uid: t.uid }, `Termin „${t.titel}“ gelöscht`);
  }
  /* Aktionen der Ansichten (Lit-Vorlagen rufen sie direkt, die alten über klick(); BSM-022 3c) */
  containerOeffnen(id) { this.s.chart = 'temp'; this.s.cZr = null; return this.gehe('container', id); }
  einstGruppe(g) { this.s.evGruppe = g; return this.gehe('einst'); }
  bereichAuto(x) { return this.setzen(['bereiche', x.id, 'auto'], !x.auto); }
  geraetSchalten(b, i) { const g = b.geraete[i]; return this.aktion('schalten', { geraet: g.id, an: !g.an }, b.auto && this.d.e.auto ? 'Handbetrieb bis zum nächsten Schaltpunkt' : undefined); }
  stufeSchritt(k, schritt) {   // Stepper einer Einstellung: in den Grenzen, Frostschutz „ein unter“ < „aus über“
    const e = this.d.e, [min, max] = GRENZEN[k] || [0, 1e9];
    const wert = Math.min(max, Math.max(min, Math.round((e[k] + schritt) * 100) / 100)); if (wert === e[k]) return undefined;
    if (k === 'frost_aus' && wert <= e.frost_temp) return this.toast('„aus über“ muss über „ein unter“ liegen');
    if (k === 'frost_temp' && wert >= e.frost_aus) return this.toast('„ein unter“ muss unter „aus über“ liegen');
    return this.setzen(PFAD[k], wert);
  }
  zrSchritt(ziel, max, schritt) { const st = this.zrSt(ziel); st.v = Math.max(0, Math.min(max, (st.v || 0) + schritt)); this.s.zrKal = null; return this.neuZeichnen(); }
  zrSetzen(ziel, max, v) { this.zrSt(ziel).v = Math.max(0, Math.min(max, v)); this.s.zrKal = null; return this.neuZeichnen(); }
  zrKalAuf(ziel) {
    const S = this.s; if (S.zrKal && S.zrKal.ziel === ziel) { S.zrKal = null; return this.neuZeichnen(); }
    const st = this.zrSt(ziel), iso = this.zrInfo(st.zeitraum, st.v || 0).iso; S.zrKal = { ziel, j: +iso.slice(0, 4), m: +iso.slice(5, 7) - 1 }; return this.neuZeichnen();
  }
  zrKalBlaettern(dd) {
    const k = this.s.zrKal; if (!k) return undefined; const z = this.zrSt(k.ziel).zeitraum;
    if (z === 'Tag' || z === 'Woche') { k.m += dd; if (k.m < 0) { k.m = 11; k.j--; } if (k.m > 11) { k.m = 0; k.j++; } } else k.j += dd; return this.neuZeichnen();
  }
  /* Verlauf (src/ansichten/verlauf.js): Protokoll der Baustelle (vollständig nachgeladen, sonst aus der Struktur) */
  protokollQuelle(d) {
    let quelle = d.protokoll;
    if (d.geladen) { const rr = this._holen('p:' + d.entry, () => this._hass.callWS({ type: 'baustelle/protokoll', entry_id: d.entry, filter: 'alle', vor: null, limit: 200 }), 60000);
      if (rr !== undefined) quelle = (Array.isArray(rr) ? rr : (rr && rr.eintraege) || []).map(p => this.protokollZeile(p, this.z)); }
    return quelle;
  }
  /* Protokoll-Auszug einer (abgeschlossenen) Baustelle; nicht geladen: die Integration kennt nur die Struktur */
  bsProtokoll(x) {
    const prot = !x.geladen ? [] : this._holen(`bp:${x.entry}`, () => this._hass.callWS({ type: 'baustelle/protokoll', entry_id: x.entry, filter: 'alle', vor: null, limit: 5 }), 300000);
    return prot === undefined ? null : (Array.isArray(prot) ? prot : (prot && prot.eintraege) || []).slice(0, 5);
  }
  /* Baustelle öffnen: laufende → Übersicht dieser Baustelle, abgeschlossene → Detailseite */
  baustelleOeffnen(id) {
    const x = this.alle.find(y => y.entry === id); if (!x) return;
    if (x.aktiv) { this.bid = x.entry; this._merken(); this._neuBauen(); this._vorhersageAbo(); this._stimmung(true); this.s.aw = null; return this.gehe('uebersicht'); }
    this.s.bs = x.entry; return this.gehe('bsdetail');
  }
  baustelleAktiv(id) {
    const x = this.alle.find(y => y.entry === id); if (!x) return;
    return this.einrichten(() => this.optionenSpeichern(x, { status: 'aktiv', ende: null }), 'Baustelle wieder aktiv – Automatik bleibt aus, bis du sie einschaltest').then(() => this._laden());
  }
  /* Entwicklung (src/ansichten/dev.js) */
  meldungStatus(id) { const d = this.d, m = (this.meldungen() || []).find(x => x.id === id); if (!m) return; delete this.cache.meldungen;
    return this.ws({ type: 'baustelle/meldung', entry_id: d.entry, aktion: 'status', meldung_id: m.id, status: this.meldungOffen(m) ? 'geschlossen' : 'neu' }); }
  meldungBild(id, i) { this.s.sheet = { art: 'm-bild', id, i }; return this.neuZeichnen(); }
  meldungWeg(id) { delete this.cache.meldungen; return this.ws({ type: 'baustelle/meldung', entry_id: this.d.entry, aktion: 'loeschen', meldung_id: id }, 'Meldung gelöscht'); }
  meldungenKopieren() { const md = this.meldungenMarkdown(); if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(md).catch(() => {}); return this.toast(`${(this.meldungen() || []).length} Meldungen als Markdown kopiert`); }
  meldungenJson() { this.datei(JSON.stringify(this.meldungen() || [], null, 2), 'baustelle-meldungen.json', 'application/json'); return this.toast('baustelle-meldungen.json'); }
  diagnoseHerunterladen() { const d = this.d; return this.ws({ type: 'auth/sign_path', path: `/api/diagnostics/config_entry/${d.entry}` }).then(r => { if (r && r.path) { this.herunterladen(r.path, `baustelle-${d.entry}.json`); this.toast('Diagnose wird heruntergeladen (wie in HA unter Geräte & Dienste)'); } }); }
  /* Melde-Dialog (Lit, src/melden.js): senden und schließen */
  meldungSenden() {
    const f = this.s.sheet.form; if (!f.text.trim()) return this.toast('Bitte kurz beschreiben');
    // „Stand der Seite mitschicken“ → Feld `seite` (api §5; `stand` ist in der Integration der Zeitpunkt der Statusänderung)
    const meldung = { art: f.art, text: f.text.trim(), kontext: f.kontext, version: this.version, geraet: f.geraet,
      seite: f.stand ? { view: this.s.view, cid: this.s.cid, baustelle: this.d ? this.d.entry : null, dialog: this.s.sheet.vorher ? this.s.sheet.vorher.art : null } : null,
      ...((f.bilder || []).length ? { bilder: f.bilder.map(x => x.url) } : {}) };   // WU-0016
    this.s.sheet = this.s.sheet.vorher || null; this.neuZeichnen(); delete this.cache.meldungen;
    return this.ws({ type: 'baustelle/meldung', entry_id: this.d && this.d.entry, aktion: 'neu', meldung }).then(r => { if (r) this.toast(`Danke – gemeldet als ${r.ticket || 'Ticket'}`); });
  }
  meldenZu() { this.s.sheet = (this.s.sheet && this.s.sheet.vorher) || null; return this.neuZeichnen(); }
  /* Melde-Dialog öffnen (Knopf unten rechts, „Über“) */
  meldenAuf() {
    const namen = { uebersicht: 'Übersicht', container: 'Container', heizung: 'Heizung', auswertung: 'Auswertung', verlauf: 'Verlauf', einst: 'Einstellungen', ueber: 'Über', dev: 'Entwicklung', bsdetail: 'Baustelle (abgeschlossen)' };
    const kontext = [namen[this.s.view] || this.s.view, this.s.view === 'container' && this.b ? this.b.name : '', this.s.sheet ? `Dialog „${this.s.sheet.art}“` : ''].filter(Boolean).join(' · ');
    const breite = this.root && this.root.getBoundingClientRect ? this.root.getBoundingClientRect().width : 1000, geraet = breite < 700 ? 'Handy' : 'Desktop';
    this.s.sheet = { art: 'melden', vorher: this.s.sheet, form: { art: 'wunsch', text: '', kontext, geraet, stand: true } };
    return this.neuZeichnen();
  }
  toast(t, wieder = false) {
    const el = this.root && this.root.querySelector('.toast'); if (!el || !t) return;
    el.textContent = t; el.classList.remove('an'); void el.offsetWidth; el.classList.add('an'); this.letzterToast = t;
    if (!wieder) this._toastBis = Date.now() + 2000;
  }

  /* Neu zeichnen (BSM-022 2b): erst den Zustand ändern, dann neuZeichnen() – Lit zeichnet im nächsten Durchlauf, mehrere
     Aufrufe werden zusammengefasst; neu = Ansicht gewechselt (oben beginnen, Einblend-Animation) */
  neuZeichnen(neu = false) { if (neu) this._neu = true; this.requestUpdate(); return this.updateComplete; }
  willUpdate() {
    const evc = this.ui && this.ui.querySelector('.ev-chips'); this._evPos = evc ? evc.scrollLeft : 0;   // FE-0013: Chip-Leiste behält ihre Position
    if (this.ui) this.ui.classList.toggle('still', !this._neu && this._view === this.s.view);   // Neuzeichnen ohne Einblend-Animationen
    this._sheetVorher = this._sheetArt; this._view = this.s.view; this._sheetArt = this.s.sheet && this.s.sheet.art;
    // Reiter nach den Funktionen der Baustelle (api §8): Heizung nur mit Funktion heizung, Pumpen nur mit Funktion
    // pumpen und Pumpenschächten (0.7.8, wie 0.6.3)
    this._mitHeizung = !this.d || this.d.funktionen.includes('heizung');
    this._mitPumpen = !!(this.d && this.d.funktionen.includes('pumpen') && this.d.bereiche.some(b => b.pumpe));
    if (!this.d && !['verlauf', 'bsdetail', 'ueber'].includes(this.s.view)) this.s.view = 'uebersicht';
    if (this.s.view === 'pumpen' && !this._mitPumpen) this.s.view = 'uebersicht';
    if (this.s.view === 'heizung' && !this._mitHeizung) this.s.view = 'uebersicht';
    if (this.s.view === 'container' && !this.b) this.s.view = 'uebersicht';
  }
  /* Rahmen der Seite – bleibt stehen; Scrollbereich und Einblendung behalten so Position und Fokus von selbst */
  render() {
    return html`<div class="wurzel"><div class="app"><div class="glas-bg"><i class="k1"></i><i class="k2"></i><i class="k3"></i><div class="dunst"></div><div class="partikel"></div></div><div class="ui">${this._ui()}</div></div></div>`;
  }
  /* Inhalt: Lit-Teile direkt (Über, Melden); noch nicht umgestellte Ansichten als HTML-Text (unsafeHTML ersetzt sie nur,
     wenn sich der Text ändert) */
  _ui() {
    const neu = !!this._neu, S = this.s;
    const tabs = [['uebersicht', 'Übersicht'], ...(this._mitHeizung ? [['heizung', 'Heizung']] : []), ...(this._mitPumpen ? [['pumpen', 'Pumpen']] : []), ['auswertung', 'Auswertung'], ['verlauf', 'Verlauf'], ['einst', '⚙']];
    const aktivTab = S.view === 'container' ? 'uebersicht' : S.view === 'bsdetail' ? 'verlauf' : ['ueber', 'dev'].includes(S.view) ? 'einst' : S.view;
    let seite;
    const LIT = { ueber: () => ueberVorlage(this), dev: () => devVorlage(this), verlauf: () => verlaufVorlage(this), bsdetail: () => bsdetailVorlage(this), pumpen: () => pumpenVorlage(this),   // Ansichten, die schon Lit-Vorlagen sind (BSM-022 3a ff.)
      container: () => this.b.pumpe ? schachtVorlage(this) : containerVorlage(this) };
    if (!this.roh) seite = ladenVorlage(this.fehler);
    else if (!this.d && !['verlauf', 'bsdetail', 'ueber'].includes(S.view)) seite = leerVorlage(this);
    else seite = LIT[S.view] ? LIT[S.view]() : unsafeHTML(this['v_' + S.view]());
    const melden = this.d ? this.d.e.melden : true;
    let sheet = '';
    if (S.sheet && S.sheet.art === 'melden') sheet = meldenVorlage(this, S.sheet.form);
    else if (S.sheet) { try { sheet = unsafeHTML(this.sheet()); } catch (e) { S.sheet = null; sheet = ''; } }
    const kopf = `${this._narrow ? '<button class="menue-knopf glas-panel" data-act="menue" aria-label="Seitenleiste" title="Seitenleiste">☰</button>' : ''}
      <nav class="glas-nav glas-panel ${tabs.length > 5 ? 'sechs' : ''}">${tabs.map(([k, t]) => `<button data-act="tab" data-v="${k}" class="${k === aktivTab ? 'on' : ''} ${k === 'einst' ? 'nav-ic' : ''}" ${k === 'einst' ? 'aria-label="Einstellungen" title="Einstellungen"' : ''}>${k === 'einst' ? ICON_COG : t}</button>`).join('')}</nav>
      <div class="schleier ${S.sheet ? 'an' : ''}" data-act="zu"></div>`;
    const imSheet = melden && this.roh && S.sheet && S.sheet.art !== 'melden' ? `<button class="melden-knopf im-sheet" data-act="melden" title="Fehler, Wunsch oder Anregung melden" aria-label="Melden">${ICON_MELDEN}</button>` : '';
    const knopf = melden && this.roh && !S.sheet ? `<button class="melden-knopf glas-panel" data-act="melden" title="Fehler, Wunsch oder Anregung melden" aria-label="Melden">${ICON_MELDEN}</button>` : '';
    return html`<div class="scroll">${keyed(`${S.view}:${S.cid || ''}`, html`<div class="seite ${neu ? 'rein' : ''}">${unsafeHTML(this.versionHinweis() + this.nurLesenHinweis())}${seite}</div>`)}</div>
      ${unsafeHTML(kopf)}
      <div class="sheet glas-panel ${S.sheet ? 'an' : ''}">${unsafeHTML(imSheet)}${sheet}</div>
      <div class="tip"></div><div class="toast glas-panel"></div>
      ${unsafeHTML(knopf)}`;
  }
  updated() {
    if (!this.ui) return;
    this.ui.classList.toggle('nur-lesen', this.nurLesen());
    this._litEinhaengen();
    const sc = this.ui.querySelector('.scroll'); if (sc && this._neu) sc.scrollTop = 0;
    const sh = this.ui.querySelector('.sheet'); if (sh && this._sheetArt !== this._sheetVorher) sh.scrollTop = 0;
    const evc2 = this.ui.querySelector('.ev-chips');
    if (evc2) { evc2.scrollLeft = this._evPos; const on = evc2.querySelector('.chip.amber');   // gewählte Kategorie sichtbar, mittig, wenn sie draußen liegt
      if (on && (on.offsetLeft < evc2.scrollLeft || on.offsetLeft + on.offsetWidth > evc2.scrollLeft + evc2.clientWidth)) evc2.scrollLeft = Math.max(0, on.offsetLeft - (evc2.clientWidth - on.offsetWidth) / 2); }
    this._neu = false;
  }
  /* Dauerhafte Lit-Bereiche in den Einstellungen („Über“, „Entwicklung“ im noch alten v_einst, bis Stufe 3e): Platzhalter
     [data-lit] im HTML-Text, je Platzhalter derselbe Behälter, Lit zeichnet hinein */
  _litEinhaengen() {
    this._litBereich ||= {};
    for (const platz of this.ui.querySelectorAll('[data-lit]')) {
      const k = platz.dataset.lit, b = this._litBereich[k] ||= Object.assign(document.createElement('div'), { className: 'lit-bereich' });
      platz.replaceWith(b);
    }
    const vorlage = { 'ueber-einst': () => ueberVorlage(this, { mitZurueck: false }), 'dev-meldungen': () => devVorlage(this, { teil: 'meldungen' }), 'dev-werkzeuge': () => devVorlage(this, { teil: 'werkzeuge' }) };
    for (const [k, b] of Object.entries(this._litBereich)) if (b.isConnected && vorlage[k]) litRender(vorlage[k](), b, { host: this });
  }
  /* Lit-Teile neu zeichnen (Über, Melden) – unveränderte alte Ansichten bleiben dabei stehen */
  litNeu() { this.requestUpdate(); }

  kopf(titel, klein, rechts = '') {
    return `<div class="glas-kopf glas-panel"><div><div class="glas-klein">${klein}</div><div class="glas-titel">${titel}</div></div>${rechts}</div>`;
  }
  wetterJetzt() {
    const d = this.d, s = this.zustand(d.wetterEid), w = d.wetter || {};
    if (!s) return [w.zustand || 'cloudy', d.wetterEid ? 'kein Wetter' : 'Wetter wählen', w.aussen];
    const regen = ['rainy', 'pouring', 'lightning-rainy', 'snowy-rainy'].includes(s.state) && zahl(w.regen_heute) && w.regen_heute > 0 ? ` · ${de(w.regen_heute, w.regen_heute % 1 ? 1 : 0)} mm` : '';
    const z = this.nachtWetter(s.state);
    return [z, (WETTER_TEXT[z] || z) + regen, zahl(w.aussen) ? w.aussen : s.attributes.temperature];
  }
  /* FE-0005: Open-Meteo & Co. melden nachts „sunny“ bzw. „partlycloudy“ – wie die Wetterkarten von HA zeigt die Seite
     nachts Mond statt Sonne. Nacht = jetzt: sun.sun unter dem Horizont; später: vor Aufgang bzw. nach Untergang */
  nachtWetter(zustand, ms = Date.now()) {
    if (zustand !== 'sunny' && zustand !== 'partlycloudy') return zustand;
    return this.istNacht(ms) ? (zustand === 'sunny' ? 'clear-night' : 'partlycloudy-night') : zustand;
  }
  istNacht(ms = Date.now()) {
    const s = this._hass && this._hass.states['sun.sun']; if (!s) return false;
    if (Math.abs(ms - Date.now()) < 30 * 6e4) return s.state === 'below_horizon';
    const a = s.attributes || {}, hm = t => { const l = this.lokal(t); return l ? +l.slice(11, 13) * 60 + +l.slice(14, 16) : null; };
    const auf = hm(a.next_rising), ab = hm(a.next_setting), m = hm(ms);
    if (auf === null || ab === null || m === null) return false;
    return auf < ab ? m < auf || m >= ab : m >= ab && m < auf;   // Tag zwischen Aufgang und Untergang (auch über Mitternacht gerechnet)
  }

  /* ---- Übersicht ---- */
  pumpenWerte(d = this.d) {
    const st = this.statistik('Woche', 0, d), i = TAGE.indexOf(d.z.HEUTE_TAG);
    for (const b of d.bereiche) if (b.pumpe) { const z = st && this.zyklen(d, b, 'Woche'); b.zyklen = z ? z[i] : null; }
  }
  v_uebersicht() {
    const d = this.d, B = d.bereiche, kw = B.reduce((s, b) => s + kwVon(b), 0), W = d.warnungen.filter(w => !w.stumm);
    const st = W.filter(w => w.stufe === 'stoerung').length, hi = W.length - st;
    const an = B.flatMap(b => b.geraete).filter(g => g.an).length, alle = B.flatMap(b => b.geraete).length;
    const [wz, wt, wtemp] = this.wetterJetzt();
    this.pumpenWerte();
    return `<div class="glas-kopf glas-panel">
        <div><div class="klickbar" data-act="sheet" data-s="baustellen"><div class="glas-klein">BAUSTELLE</div><div class="glas-titel">${esc(d.titel)} <span class="pfeil">▾</span></div>
        ${d.e.staffel && this.last().A.length ? (() => { const L = this.last(); return `<button class="strom-knopf" data-act="sheet" data-s="strom">${this.stromBalken(L, true)}<span class="strom-t"><b>${de(L.gesamt)} kW</b> · ${L.A.length} ${L.A.length === 1 ? 'Anschluss' : 'Anschlüsse'} · ${L.laufen} Heizkörper an${L.warten ? ` · ${L.warten} wartet` : ''} ›</span></button>`; })() : ''}</div>
          <button class="kopf-wetter" data-act="sheet" data-s="${d.wetterEid ? 'wetter' : 'wetterquelle'}">${wetterIcon(wz, 22)}<span>${zahl(wtemp) ? de(wtemp) + '°' : '–'}</span><span class="kw-t">${esc(wt)}</span></button></div>
        <button class="glas-kw kw-knopf" data-act="sheet" data-s="verbrauch" title="Verbrauch anzeigen"><span class="blitz ${kw ? 'an' : ''}">⚡</span>${de(kw)}<small> kW</small><span class="kw-pfeil">›</span></button></div>
      <div class="glas-chips">
        <button class="glas-panel chip auto-chip ${d.e.auto ? 'on' : ''}" data-act="auto" role="switch" aria-checked="${d.e.auto}" title="Automatik ${d.e.auto ? 'ausschalten' : 'einschalten'}"><span class="mini-sw"><i></i></span>Automatik</button>
        <button class="chip-status ${d.e.auto ? 'amber' : ''}" data-act="sheet" data-s="heizplan" title="Heizplan anzeigen">${esc(this.statusText())} <span class="pfeil">›</span></button>
        ${W.length ? `<button class="glas-panel chip warn-chip ${st ? 'rot' : 'gelb'}" data-act="sheet" data-s="warnungen">⚠ ${W.length === 1 ? `${esc(this.bName(W[0].b))}: ${esc(W[0].titel)}`
          : [st ? `${st} ${st === 1 ? 'Störung' : 'Störungen'}` : '', hi ? `${hi} ${hi === 1 ? 'Hinweis' : 'Hinweise'}` : ''].filter(Boolean).join(' · ')}</button>` : ''}
        <span class="chip-leise">${an} von ${alle} Geräten an</span>
      </div>
      <div class="glas-raster">${B.map((b, i) => `<div class="glas-panel glas-k ${b.z}" role="button" tabindex="0" data-act="container" data-id="${b.id}" style="animation-delay:${i * 60}ms;--c:${FARBE[b.z]}">
        <div class="glas-illu">${illu(b)}</div>
        <div class="glas-name">${esc(b.name)}</div>${this.firma(b.firma).eigen ? '' : `<div class="firma-tag">${esc(this.firma(b.firma).name)}</div>`}${b.tuer && b.tuer.offen ? `<div class="tuer-tag">🚪 offen ${b.tuer.offen} min</div>` : ''}
        <div class="glas-zeile"><span class="glas-wert">${wertHtml(b)}</span><span class="glas-kwk">${de(kwVon(b))} kW</span></div>
        <div class="glas-status"><span class="glas-dot"></span>${esc(TEXT(b))}</div>
        <div class="glas-geraete">${b.geraete.map(g => `<i class="${g.an ? 'an' : ''}"></i>`).join('')}<span>${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'}</span></div>
        ${b.bedarf ? `<button class="bedarf-knopf ${b.bedarfBis ? 'an' : ''}" data-act="${b.bedarfBis ? 'bedarf-aus' : 'bedarf-auf'}" data-id="${b.id}">${b.bedarfBis ? `■ bis ${b.bedarfBis}` : '▶ jetzt heizen'}</button>` : ''}</div>`).join('')}
        <button class="glas-panel glas-k neu" data-act="sheet" data-s="container-neu"><span>+</span>Container</button></div>
      ${this.kkBereich()}`;
  }

  /* ---- Container ---- */
  /* Diagramm und Kennzahlen der Container-Ansicht – eigene Funktion, damit neue Sensorwerte nur diese zwei Stellen tauschen (WU-0002) */
  containerLive(b) {
    const d = this.d, heuteNr = TAGE.indexOf(this.z.HEUTE_TAG);
    const tabs = b.pumpe ? [['pumpzeit', 'Pumpzeit'], ['zyklen', 'Zyklen'], ['verbrauch', 'Verbrauch']] : [['temp', 'Temperatur'], ['leistung', 'Leistung'], ['verbrauch', 'Verbrauch'], ['heizzeit', 'Heizzeit']];
    if (!tabs.some(t => t[0] === this.s.chart)) this.s.chart = tabs[0][0];
    const c = this.s.chart, mitVb = this.s.tempVb !== false;
    const kwh7 = this.verbrauch(d, b.id, 'Woche'), h7 = this.heizStunden(d, b, 'Woche'), zyk7 = b.pumpe ? this.zyklen(d, b, 'Woche') : null;
    const vT = this.zrV('c-Tag'), vW = this.zrV('c-Woche'), tagArt = c === 'temp' || c === 'leistung';   // FE-0008
    const kwhW = vW ? this.verbrauch(d, b.id, 'Woche', vW) : kwh7, hW = vW ? this.heizStunden(d, b, 'Woche', vW) : h7, zykW = b.pumpe && vW ? this.zyklen(d, b, 'Woche', vW) : zyk7;
    let chart;
    if (c === 'temp') {
      if (!b.fuehler) chart = '<div class="leer">Kein Temperaturfühler zugeordnet · <button class="link" data-act="sheet" data-s="bereich">zuordnen</button></div>';
      else { const st = this.statistik('Tag', vT);
        if (!st) chart = LAEDT;
        else { const inn = [...(st.werte[b.fuehler] || []), null], aussen = [...(st.werte[this.eid(d, d.entry, 'aussen')] || []), null];
          chart = linie(`t-${b.id}-${mitVb ? 'vb' : ''}`, [{ name: 'Innen', v: inn }, { name: 'Außen', v: aussen }], '°C', mitVb ? this.verbrauch(d, b.id, 'Tag', vT) : null); } }
    } else if (c === 'leistung') { const kw = this.verbrauch(d, b.id, 'Tag', vT);   // kWh je Stunde = mittlere kW
      chart = kw ? flaeche('kw-' + b.id, [{ name: b.name, farbe: BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], v: kw }], STUNDEN, 'kW', 6) + `<div class="leise">Leistung ${this.zrText('Tag', vT)} in kW, Stundenmittel</div>` : LAEDT;
    } else if (c === 'verbrauch') chart = kwhW ? balken('v-' + b.id, kwhW, TAGE, 'kWh') : LAEDT;
    else if (c === 'zyklen') chart = zykW ? balken('z-' + b.id, zykW, TAGE, 'Zyklen', 0) : LAEDT;
    else chart = hW ? balken('h-' + b.id, hW, TAGE, 'h') : LAEDT;
    let kennz;
    if (b.pumpe) { this.mess = this.messung(); const pz = h7 ? h7[heuteNr] : null;
      const laengster = this.mess ? Math.max(0, ...b.geraete.flatMap(g => { const t = this.mess[g.id]; return t ? t[heuteNr].an.map(q => q[1] - q[0]) : []; })) : null;
      kennz = [['Zyklen heute', zyk7 ? zyk7[heuteNr] : '–'], ['Laufzeit', stdMin(pz)], ['Längster Lauf', zahl(laengster) ? `${Math.round(laengster)} min` : '–']];
    } else kennz = [['kWh heute', kwh7 ? de(kwh7[heuteNr]) : '–'], ['Kosten', kwh7 ? `${de(kwh7[heuteNr] * d.e.preis, 2)} €` : '–'], ['Heizzeit', h7 ? `${de(h7[heuteNr])} h` : '–']];
    b.zyklen = zyk7 ? zyk7[heuteNr] : null;
    return { tabs, c, mitVb, chart, kennz, zr: tagArt ? ['c-Tag', 'Tag', this.zrGrenze()] : ['c-Woche', 'Woche', this.zrGrenze()] };   // zr: Argumente der Zeitraum-Vorlage
  }
  /* Neue Sensorwerte: in der Container-Ansicht neu zeichnen (Lit tauscht nur Diagramm und Kennzahlen), außer eine
     Einblendung oder ein Tooltip ist offen – dann später wieder; sonst die Ansicht neu zeichnen wie bisher */
  _liveNeu() {
    const wrap = this.root && this.root.querySelector('.c-live .chart-wrap'), knopf = this.root && this.root.querySelector('.c-live-kennz');
    if (this.s.view !== 'container' || !this.b || !wrap || !knopf) return this._auffrischen();
    if (this.s.sheet || (this.root.querySelector('.tip') || { classList: { contains: () => false } }).classList.contains('an')) return;   // später wieder
    this.neuZeichnen();   // Container und Schacht sind Lit (3c/3d): gezeichnet wird nur, was sich geändert hat
  }

  /* ============ Container-Ansicht (WU-0004, Mockup glas.html „D mit Thermostat-Rad“, abgenommen 30.09.2026) ============
     Vorlage: src/ansichten/container.js (Lit, BSM-022 3d); hier Soll, Regeltext, Rad und Diagramme als Daten/SVG */
  /* gültiges Soll eines Containers von der Integration (fest oder gleitend, mit + / −), sonst eingestellt */
  sollVon(b) { return b.sollJ && zahl(b.sollJ.wert) ? b.sollJ.wert : b.soll ?? this.d.e.soll; }
  sollAktiv(b) { return !!b.fuehler && b.t !== null && ['thermo', 'bedarf'].includes(b.modus); }   // Soll gilt nur, wenn die Integration nach dem Fühler regelt
  cRegelText(b) {
    const soll = this.sollVon(b);
    if (b.modus === 'thermo' && b.lern && b.lern.an) return `🧠 Thermostat · lernend – ${b.lern.anteil !== null ? `${b.lern.anteil} % je ${b.lern.zyklus_min} min · ` : ''}Nachlauf +${de(b.lern.erwartet)} °C → aus bei ${de(b.lern.aus_bei)} °C${b.lern.warm && this.warmText(b, true) ? ` · ${this.warmText(b, true)}` : ''}${this.offenText(b) ? ` · ${this.offenText(b)}` : ''}`;
    return { thermo: `Thermostat regelt in der Heizzeit auf ${de(soll)} °C`, plan: 'Zeitplan – der Heizkörperthermostat regelt', hand: 'Hand – die Automatik schaltet nicht',
      bedarf: `nur bei Bedarf${b.fuehler ? ` · regelt auf ${de(soll)} °C` : ''}`, aus: 'Aus – nur Frostschutz' }[b.modus] || '';
  }
  /* Thermostat-Rad (SVG): Strichkranz 5–30 °C, zwischen Ist und Soll farbig, Soll-Knopf; − + setzt die Vorlage darunter */
  cRadSvg(b) {
    const mitSoll = this.sollAktiv(b), soll = this.sollVon(b), t = b.t, dd = t - soll;
    const farbe = !mitSoll ? 'var(--ink)' : dd > .5 ? '#ff9f0a' : dd < -.5 ? '#64a8ff' : '#30d158';
    const w = x => Math.max(0, Math.min(1, (x - 5) / 25)), R = 78, ang = f => (135 + 270 * f) * Math.PI / 180;
    const [von, bis] = mitSoll ? [Math.min(w(t), w(soll)), Math.max(w(t), w(soll))] : [0, w(t)];
    const striche = [...Array(61)].map((_, i) => { const f = i / 60, a = ang(f), an = f >= von - .001 && f <= bis + .001, lang = i % 10 === 0;
      return `<line x1="${(100 + (R - (lang ? 14 : 9)) * Math.cos(a)).toFixed(1)}" y1="${(100 + (R - (lang ? 14 : 9)) * Math.sin(a)).toFixed(1)}" x2="${(100 + R * Math.cos(a)).toFixed(1)}" y2="${(100 + R * Math.sin(a)).toFixed(1)}" stroke="${an ? farbe : 'var(--ink2)'}" stroke-width="${an ? 3 : 1.6}" stroke-linecap="round" opacity="${an ? 1 : .35}"/>`; }).join('');
    const ks = ang(w(soll));
    return `<svg viewBox="0 0 200 200" role="img" aria-label="Ist ${de(t)} °C${mitSoll ? `, Soll ${de(soll)} °C` : ''}"><defs><radialGradient id="cRadG" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="rgba(255,255,255,.16)"/><stop offset="1" stop-color="rgba(255,255,255,.02)"/></radialGradient></defs>
      <circle cx="100" cy="100" r="${R - 20}" fill="url(#cRadG)" stroke="var(--panel-rand)"/>${striche}
      ${mitSoll ? `<circle cx="${(100 + R * Math.cos(ks)).toFixed(1)}" cy="${(100 + R * Math.sin(ks)).toFixed(1)}" r="8" fill="#fff" stroke="${farbe}" stroke-width="3"/>` : ''}
      <text x="100" y="80" text-anchor="middle" class="c-rad-k">IST</text><text x="100" y="112" text-anchor="middle" class="c-rad-t">${de(t)}°</text>
      ${mitSoll ? `<text x="100" y="134" text-anchor="middle" class="c-rad-s" fill="${farbe}">Soll ${de(soll)}°</text>` : ''}</svg>`;
  }
  /* Tagesdiagramm: Heizzeit als Band, innen/außen, Soll gestrichelt, geheizte Stunden als Balken, Jetzt-Marke */
  cTag(b, vs = 0) {
    const d = this.d, innen = b.fuehler ? this.reihe(d, b.fuehler, 'Tag', vs) : [], aussen = this.reihe(d, this.eid(d, d.entry, 'aussen'), 'Tag', vs), kw = this.verbrauch(d, b.id, 'Tag', vs);
    if (!aussen || !kw || !innen) return LAEDT;
    const W = 640, H = 220, L = 34, Rr = 10, T = 12, B = 44, mitSoll = this.sollAktiv(b), soll = this.sollVon(b), farbe = BEREICH_FARBEN[b.f % BEREICH_FARBEN.length];
    const x = h => L + (W - L - Rr) * h / 24, alle = [...innen, ...aussen, ...(mitSoll ? [soll] : [])].filter(zahl);
    const lo = Math.floor(Math.min(...(alle.length ? alle : [15])) - 1), hi = Math.ceil(Math.max(...(alle.length ? alle : [25])) + 1), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const pfad = v => v.map((t, h) => !zahl(t) ? '' : `${h && zahl(v[h - 1]) ? 'L' : 'M'}${x(h + .5).toFixed(1)} ${y(t).toFixed(1)}`).join(' ');
    const kmax = Math.max(1, ...kw), jm = this.z.JETZT.split(':'), jetzt = +jm[0] + +jm[1] / 60;
    const tagNr = this.z.WOCHE_ISO.indexOf(plusTage(this.z.HEUTE, -vs));   // Heizzeiten gibt es nur für diese Woche
    const band = (tagNr < 0 ? [] : this.heizzeiten(b, TAGE[tagNr])).map(([von, bis]) => `<rect x="${x(von / 60).toFixed(1)}" y="${T}" width="${(x(bis / 60) - x(von / 60)).toFixed(1)}" height="${H - T - B}" fill="var(--amber)" opacity=".12"/>`).join('');
    const raster = [lo, Math.round((lo + hi) / 2), hi].map(v => `<line x1="${L}" x2="${W - Rr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--gridc)"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="c-achse">${v}°</text>`).join('');
    const stunden = [0, 6, 12, 18, 24].map(h => `<text x="${x(h).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="c-achse">${String(h).padStart(2, '0')}</text>`).join('');
    const bars = kw.map((k, h) => k > 0 ? `<rect x="${(x(h) + 2).toFixed(1)}" y="${(H - B + 6 + 22 * (1 - k / kmax)).toFixed(1)}" width="${(x(1) - x(0) - 4).toFixed(1)}" height="${(22 * k / kmax).toFixed(1)}" rx="2" fill="${farbe}" opacity=".8"><title>${String(h).padStart(2, '0')}:00 · ${de(k, 2)} kWh</title></rect>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="c-tag-svg">${band}${raster}
      ${mitSoll ? `<line x1="${L}" x2="${W - Rr}" y1="${y(soll).toFixed(1)}" y2="${y(soll).toFixed(1)}" stroke="var(--ink)" stroke-dasharray="5 4" opacity=".6"/><text x="${W - Rr}" y="${(y(soll) - 5).toFixed(1)}" text-anchor="end" class="c-achse">Soll ${de(soll)}°</text>` : ''}
      <path d="${pfad(aussen)}" fill="none" stroke="var(--ink2)" stroke-width="1.5" opacity=".7"/>${b.fuehler ? `<path d="${pfad(innen)}" fill="none" stroke="#ff9f0a" stroke-width="2.6"/>` : ''}
      ${bars}${vs ? '' : `<line x1="${x(jetzt).toFixed(1)}" x2="${x(jetzt).toFixed(1)}" y1="${T}" y2="${H - B + 28}" stroke="var(--ink)" opacity=".5"/>`}${stunden}</svg>
      <div class="c-legende">${b.fuehler ? '<span><i style="background:#ff9f0a"></i>innen</span>' : ''}<span><i style="background:var(--ink2)"></i>außen</span>${mitSoll ? '<span><i class="gestr"></i>Soll</span>' : ''}<span><i style="background:var(--amber);opacity:.4"></i>Heizzeit</span><span><i style="background:${farbe}"></i>geheizt (kWh je Stunde)</span></div>`;
  }
  /* Diagramm der Container-Ansicht (WU-0002) */
  containerTeile(b) {
    const d = this.d, c = ['heute', 'woche', 'stunden'].includes(this.s.cvd) ? this.s.cvd : 'heute';
    const vT = this.zrV('c-Tag'), vW = this.zrV('c-Woche'), kwhW = this.verbrauch(d, b.id, 'Woche', vW), hW = this.heizStunden(d, b, 'Woche', vW);   // FE-0008: Diagramm auch für frühere Tage/Wochen
    const chart = c === 'heute' ? this.cTag(b, vT) : c === 'woche' ? (kwhW ? balken('cw-' + b.id, kwhW, TAGE, 'kWh') : LAEDT) : (hW ? balken('ch-' + b.id, hW, TAGE, 'h') : LAEDT);
    return { c, chart };
  }
  heuteText(b) { const seg = this.heizzeiten(b, this.z.HEUTE_TAG); return seg.length ? `Heizzeit ${uhr(seg[0][0])}–${uhr(Math.max(...seg.map(q => q[1])))}` : this.freiText(this.z.HEUTE) || 'heute keine Heizzeit'; }
  minBis(iso) { const ms = Date.parse(iso); return Number.isFinite(ms) ? Math.max(0, Math.round((ms - this.jetztMs()) / 60000)) : null; }
  zeitleiste(b) {
    const seg = this.heizzeiten(b, this.z.HEUTE_TAG), p = this.planTag(this.z.HEUTE_TAG);
    const gruende = p ? p.gruende.filter((_, k) => b.trocknen || !['trocknen', 'frueher_nach_regen'].includes(p.codes[k])) : [];
    return `<div class="tl">${this.zeitstrahlSeg(seg, true)}<div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div></div>
      ${p ? `<div class="leise">Arbeitszeit ${uhr(p.a)}–${uhr(p.b)}${seg.length ? ` · heizt ${uhr(seg[0][0])}–${uhr(Math.max(...seg.map(q => q[1])))}` : b.auto ? '' : ' · Automatik aus'}${gruende.length ? ' · ' + gruende.map(esc).join(' · ') : ''}</div>`
        : `<div class="leise">${this.freiText(this.z.HEUTE)}</div>`}`;
  }

  /* ---- Heizung ---- */
  stepper(k, d, fmt) { const e = this.d.e; return `<span class="stepper"><button data-act="st" data-k="${k}" data-d="${-d}">−</button><b>${fmt(e[k])}</b><button data-act="st" data-k="${k}" data-d="${d}">+</button></span>`; }
  feiertage() { const k = this._kalender(this.d.optionen.feiertag_kalender); return k === null ? null : k.filter(f => f.von > this.z.HEUTE).sort((a, b) => a.von.localeCompare(b.von)); }
  urlaube() { const k = this._kalender(this.d.optionen.urlaub_kalender); return k === null ? null : k.filter(u => u.bis >= this.z.HEUTE).sort((a, b) => a.von.localeCompare(b.von)); }
  /* ---- Heizung als Kacheln (0.7.11, Mockup heizung-varianten.html Variante A, abgenommen 30.09.2026) ----
     Große Karte „Heute“, darunter die Hauptteile als Kacheln mit Kurzwert; ein Tipp öffnet den bisherigen Block als
     Einblendung (heizungBloecke – Inhalte unverändert). */
  hzTeile() {
    const html = this.heizungBloecke(), stuecke = html.split(/(?=<div class="glas-panel block">)/), teile = {};
    for (const [k, titel] of HZ_TEILE) { const x = stuecke.find(y => y.includes(`<b>${titel}</b>`)); teile[k] = x ? x.trim() : ''; }
    return teile;
  }
  hzKurz() {
    const d = this.d, e = d.e, az = this.azJetzt, C = d.bereiche.filter(b => !b.pumpe), H = this.z.HEUTE;
    const ausn = d.ausnahmen.filter(a => a.datum >= H).sort((a, b) => a.datum.localeCompare(b.datum));
    const ft = this.feiertage(), ur = this.urlaube(), naechsterFt = ft && ft[0];
    const modi = MODI.map(([k, t]) => [t, C.filter(b => b.modus === k).length]).filter(x => x[1]);
    const woche = TAGE.map(t => { const p = this.planTag(t); return p && zahl(p.ende) && zahl(p.extra) ? Math.max(0, p.ende - p.extra) / 60 : 0; });
    const L = this.last(), zeiten = t => az && az.tage[t] ? az.tage[t].join('–') : 'frei';
    return {
      woche, plan: `${woche.filter(Boolean).length} Heiztage · ${de(summe(woche), 0)} h`,
      wann: `${L.laufen} von ${L.hk.length} Heizkörpern an`,
      az: az ? esc(az.name || 'Arbeitszeit') : 'keine Arbeitszeit', az2: az ? `Mo ${zeiten('Mo')} · Fr ${zeiten('Fr')}` : 'unter Arbeitszeit anlegen',
      ausn: ausn.length ? `${ausn.length} geplant` : 'keine', ausn2: ausn.length ? `nächste ${wtag(ausn[0].datum)} ${kurzDatum(ausn[0].datum)}` : 'Samstag, länger, frei …',
      regeln: `Soll ${de(e.soll, 1)} °C`, regeln2: `vor ${e.vorheizen} · nach ${e.nachheizen} min · Grenze ${de(e.grenze, 0)} °C · ${e.frost ? `Frost ${de(e.frost_temp, 1)}–${de(e.frost_aus, 1)} °C` : 'Frostschutz aus'}`,
      trocknen: `ab ${de(e.tr_mm, 1)} mm Regen`, trocknen2: `+${e.tr_laenger} min · früher ${e.tr_frueher} min`,
      container: `${C.length} Container`, container2: modi.map(([t, n]) => `${n} ${t}`).join(' · ') || '–',
      urlaub: ur === null ? 'Lädt …' : ur.length ? `${ur.length} Urlaub` : 'kein Urlaub', urlaub2: naechsterFt ? `Feiertag ${wtag(naechsterFt.von)} ${kurzDatum(naechsterFt.von)}` : e.feiertag_frei ? '' : 'an Feiertagen wird gearbeitet',
    };
  }
  hzHeld() {
    const d = this.d, e = d.e, H = this.z.HEUTE, p = this.planTag(this.z.HEUTE_TAG), hg = d.heizgrenze || {}, pm = d.plan[plusTage(H, 1)], L = this.last();
    const heizt = /heizt|♨/.test(this.statusText());
    const chips = [
      !e.auto ? '⏸ Automatik aus' : '',
      p ? `🕖 ${uhr(p.a)}–${uhr(p.b)}` : `🕖 ${this.freiText(H)}`,
      hg.zu_warm ? '🌡 zu warm – kein Heizen' : '',
      p && p.codes.includes('trocknen') ? `🌧 trocknen +${e.tr_laenger} min` : '',
      p && p.codes.includes('fruehstart') ? '❄ Frühstart heute' : pm && (pm.gruende || []).includes('fruehstart') ? '❄ Frühstart morgen' : '',
      e.staffel && L.warten ? `⚡ ${L.warten} wartet` : '',
      d.jetztBis ? `♨ alle heizen bis ${d.jetztBis}` : '',
    ].filter(Boolean).map(c => `<span class="hz-chip">${c}</span>`).join('');
    return `<div class="glas-panel hz-held klickbar" data-act="hz-auf" data-k="heute" role="button" tabindex="0">
      <div class="hz-held-kopf"><div><div class="glas-klein">HEUTE · ${this.z.HEUTE_TAG} ${kurzDatum(H)}</div><div class="hz-status ${heizt ? 'an' : ''}">${esc(this.statusText())}</div></div><span class="chev">›</span></div>
      <div class="tl">${this.zeitstrahl(p, true)}<div class="tl-achse">${['04', '08', '12', '16', '20'].map(h => `<span>${h}</span>`).join('')}</div></div>
      ${chips ? `<div class="hz-chips">${chips}</div>` : ''}</div>`;
  }
  v_heizung() {
    const d = this.d, k = this.hzKurz(), heuteNr = TAGE.indexOf(this.z.HEUTE_TAG), max = Math.max(1, ...k.woche);
    const kachel = (id, sym, titel, wert, unter, extra = '') => `<button class="glas-panel hz-kachel" data-act="hz-auf" data-k="${id}">
      <span class="hz-k-kopf"><span class="hz-sym">${sym}</span><span class="chev">›</span></span>
      <span class="hz-k-titel">${titel}</span><b class="hz-k-wert">${wert}</b>${extra}<span class="leise hz-k-unter">${unter || ''}</span></button>`;
    const mini = `<span class="hz-mini">${k.woche.map((h, i) => `<i style="height:${Math.max(3, h / max * 100)}%" class="${i === heuteNr ? 'heute' : ''}"></i>`).join('')}</span>`;
    return `${this.kopf('Heizung', esc(d.titel), `<div>${schalter(d.e.auto, 'auto')}</div>`)}${this.hzHeld()}
      <div class="hz-raster">
        ${kachel('plan', '📅', 'Diese Woche', k.plan, 'Heizplan aus Arbeitszeit und Wetter', mini)}
        ${kachel('wann', '🔥', 'Wann heizt was', k.wann, 'gemessen je Heizkörper')}
        ${kachel('container', '🏠', 'Container', k.container, k.container2)}
        ${kachel('az', '👷', 'Arbeitszeit', k.az, k.az2)}
        ${kachel('ausn', '✳️', 'Ausnahmen', k.ausn, k.ausn2)}
        ${kachel('regeln', '⚙️', 'Regeln', k.regeln, k.regeln2)}
        ${kachel('trocknen', '👕', 'Kleidung trocknen', k.trocknen, k.trocknen2)}
        ${kachel('urlaub', '🏖', 'Urlaub & Feiertage', k.urlaub, k.urlaub2)}
      </div>`;
  }
  /* AN-0012: Regeln nach Tagesablauf gruppiert (Mockup regeln-varianten.html, Variante B, abgenommen 01.10.2026) – auch die bisher
     festen Werte: einstellbar (Schaltabstand, „heizt tatsächlich ab“, Handbetrieb übernehmen, Fühler ohne Wert) oder als „Feste Regeln“ */
  /* Solltemperatur fest oder gleitend – alle Zahlen von der Integration (laufzeit.soll_gleitend, logik/soll) */
  /* AN-0014: Größe im Dialog „Container bearbeiten“ – Einzel, Doppel oder m² frei; Werte und Schätzung von der Integration */
  groesseBlock(b, e) {
    const G = b.groesse, T = G.typen, art = e.groesseArt, typ = k => `${k === 'einzel' ? 'Einzel' : 'Doppel'}container innen ${de(T[k].laenge, 2)} × ${de(T[k].breite, 2)} m ≈ ${de(T[k].m2, 1)} m² · ${de(G.hoehe, 2)} m hoch ≈ ${de(T[k].m3, 0)} m³`;
    const w = b.lern && b.lern.warm, gleich = art === G.art && (art !== 'frei' || Number(e.m2) === G.m2);
    return `<div class="zeile"><div><b>Größe</b><div class="leise">für Vergleiche (kWh je m²) und als Startwert der lernenden Regelung</div></div>
      <div class="seg klein">${[['einzel', 'Einzel'], ['doppel', 'Doppel'], ['frei', 'm²']].map(([k, t]) => `<button data-act="groesse-art" data-v="${k}" class="${art === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      ${art === 'frei' ? `<label class="zeile unter"><span>Fläche innen</span><span class="eingabe"><input type="number" step="0.5" min="4" value="${esc(e.m2 ?? '')}" data-bm2> m²</span></label>
        <div class="leise" style="padding:0 0 6px 12px">Höhe ${de(G.hoehe, 2)} m${gleich ? ` ≈ ${de(G.m3, 0)} m³` : ''}</div>` : `<div class="leise" style="padding:0 0 6px 12px">${typ(art)}</div>`}
      ${w && w.geschaetzt && gleich ? `<div class="leise" style="padding:0 0 6px 12px">🧠 Noch nichts gelernt: Aufheizen geschätzt aus der Größe – ${de(w.geschaetzt, 1)} °C/h</div>` : ''}`;
  }

  sollBlock(z) {
    const e = this.d.e, G = this.d.sollG, gl = e.soll_art === 'gleitend', grad = v => `${de(v, 1)} °C`;
    const kopf = z('🌡 Solltemperatur', 'für Container mit Fühler; ohne Fühler regelt der Heizkörperthermostat',
      `<div class="seg klein">${[['fest', 'fest'], ['gleitend', 'gleitend']].map(([k, t]) => `<button data-act="e-wert" data-k="soll_art" data-v="${k}" class="${e.soll_art === k ? 'on' : ''}">${t}</button>`).join('')}</div>`);
    if (!gl) return kopf + z('Soll', '', this.stepper('soll', .5, grad), true);
    const st = (k, s, fmt) => this.stepper(k, s, fmt), f = v => `${v >= 0 ? '+' : '−'}${de(Math.abs(v), 1)} °C`;
    const heute = !G ? '<div class="leise">Noch keine Außentemperatur – bis dahin gilt das feste Soll.</div>'
      : `<div class="sg-heute"><span>Grundwert („mindestens“)${e.gleit_min >= 21 ? ' – Aufenthaltsräume (§ 36 BauV)' : ''}</span><b>${grad(e.gleit_min)}</b>
        <span>kalte Tage: Außenmittel der letzten ${G.tage} Tage ${de(G.aussen_mittel, 1)} °C</span><b>${f(G.start - e.gleit_min)}</b>
        <span>dein Gefühl: ${G.n} ${G.n === 1 ? 'Rückmeldung' : 'Rückmeldungen'} bei ähnlichem Wetter (je ${de(G.schritt, 2)} °C)</span><b>${f(G.gefuehl)}</b>
        <span class="summe">Soll heute</span><b class="summe">${grad(G.soll)}</b></div>${this.sollKurve(G)}`;
    return kopf + heute
      + z('mindestens', e.gleit_min < 21 ? '<span class="amber-t">unter 21 °C – § 36 BauV verlangt für Aufenthaltsräume 21 °C</span>' : 'nie darunter (§ 36 BauV: Aufenthaltsräume 21 °C)', st('gleit_min', .5, grad), true)
      + z('höchstens', '', st('gleit_max', .5, grad), true)
      + z('wärmer je Grad kälter draußen', `unter ${de(e.gleit_bezug, 0)} °C Außenmittel`, st('gleit_je', .05, v => `+${de(v, 2)} °C`), true)
      + z('ab Außenmittel unter', '', st('gleit_bezug', 1, v => `${de(v, 0)} °C`), true)
      + z('Außenmittel über', 'wie EN 16798-1: jüngere Tage zählen mehr', st('gleit_tage', 1, v => `${v} ${v === 1 ? 'Tag' : 'Tage'}`), true)
      + z('dein Gefühl', '„zu kalt / passt / zu warm“ und + / − im Container verschieben das Soll bei ähnlichem Wetter, höchstens ±1,5 °C', '<button class="rv-link" data-act="sg-vergessen">vergessen</button>', true)
      + '<div class="leise">Ein eigenes Soll im Container gilt als Verschiebung gegenüber dem der Baustelle (Je Container).</div>';
  }
  sollKurve(G) {
    const W = 320, H = 150, L = 30, R = 8, T = 8, U = 18, K = G.kurve || [], ys = K.flatMap(k => [k[1], k[2]]), lo = Math.floor(Math.min(20, ...ys)), hi = Math.ceil(Math.max(lo + 3, ...ys));
    const x = t => L + (t + 10) / 30 * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - U), soll = t => { const k = K.find(q => q[0] === Math.round(t)); return k ? k[2] : G.soll; };
    const pfad = i => K.map((k, n) => `${n ? 'L' : 'M'}${x(k[0]).toFixed(1)} ${y(k[i]).toFixed(1)}`).join('');
    const raster = [...Array(hi - lo + 1)].map((_, i) => lo + i).map(v => `<line class="gr" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ax" x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${v}°</text>`).join('')
      + [-10, 0, 10, 20].map(t => `<text class="ax" x="${x(t)}" y="${H - 4}" text-anchor="middle">${t}° außen</text>`).join('');
    const unter = lo < 21 ? `<rect x="${L}" y="${y(Math.min(21, hi)).toFixed(1)}" width="${W - L - R}" height="${(H - U - y(Math.min(21, hi))).toFixed(1)}" fill="rgba(255,69,58,.08)"/>` : '';
    const punkte = (G.rueck || []).map(([t, r]) => `<circle cx="${x(Math.max(-10, Math.min(20, t))).toFixed(1)}" cy="${y(soll(t) - r * .35).toFixed(1)}" r="4" fill="${r < 0 ? '#64a8ff' : r > 0 ? '#ff9f0a' : '#30d158'}"/>`).join('');
    const tm = Math.max(-10, Math.min(20, G.aussen_mittel));
    return `<svg class="sg-kurve" viewBox="0 0 ${W} ${H}">${raster}${unter}<path d="${pfad(1)}" fill="none" stroke="var(--ink2)" stroke-width="1.5" stroke-dasharray="5 4"/>
      <path d="${pfad(2)}" fill="none" stroke="var(--amber)" stroke-width="2.5"/>${punkte}<line x1="${x(tm).toFixed(1)}" x2="${x(tm).toFixed(1)}" y1="${T}" y2="${H - U}" stroke="var(--ink)" stroke-dasharray="2 3"/>
      <circle cx="${x(tm).toFixed(1)}" cy="${y(G.soll).toFixed(1)}" r="6" fill="#fff" stroke="var(--amber)" stroke-width="3"/></svg>
      <div class="sg-leg"><span><i style="background:var(--amber)"></i>Soll (mit deinem Gefühl)</span><span><i style="background:var(--ink2)"></i>Startwert nach draußen</span><span><i style="background:#64a8ff"></i>zu kalt</span><span><i style="background:#30d158"></i>passt</span><span><i style="background:#ff9f0a"></i>zu warm</span>${unter ? '<span><i style="background:rgba(255,69,58,.35)"></i>unter 21 °C</span>' : ''}</div>`;
  }
  regelnInhalt(lernend, C) {
    const e = this.d.e, st = (k, s, fmt) => this.stepper(k, s, fmt), grad = v => `${de(v, 1)} °C`, min = v => `${v} min`, minus = v => `${de(v, 0).replace('-', '−')} °C`;
    const z = (titel, text, ctrl, unter) => `<div class="zeile${unter ? ' unter' : ''}"><div>${unter ? `<span>${titel}</span>` : `<b>${titel}</b>`}${text ? `<div class="leise">${text}</div>` : ''}</div>${ctrl || ''}</div>`;
    const link = (act, extra) => `<button class="rv-link" data-act="${act}" ${extra}>ändern ›</button>`;
    const nichtLern = lernend.length ? ' · <i>nicht für lernende Container</i>' : '';
    const R = {
      vorheizen: z('Vorheizen', `vor Arbeitsbeginn, damit es warm ist${nichtLern}`, st('vorheizen', 5, min)),
      frueh: z('Kälte-Frühstart', `unter ${minus(e.frueh_temp)} zusätzlich früher${nichtLern}`, schalter(e.fruehstart, 'e-bool', 'data-k="fruehstart"'))
        + (e.fruehstart ? z('wenn morgens kälter als', '', st('frueh_temp', 1, minus), true) + z('so viel früher', '', st('frueh_min', 5, min), true) : ''),
      lernend: z('🧠 Lernende Container', `heizen selbst so früh, dass das Soll rechtzeitig erreicht ist – statt Vorheizen, Kälte-Frühstart und Nachheizen. Bis genug gelernt ist, gelten die Werte oben.${lernend.length ? ` Jetzt: ${lernend.map(b => esc(b.name)).join(', ')}.` : ' Gilt für Container mit Fühler, Modus Thermostat und lernender Regelung.'}`, ''),
      warm_vor: z('Soll erreicht', 'vor Arbeitsbeginn, z. B. zum Umziehen', st('warm_vor', 5, v => v ? `${v} min vorher` : 'bei Beginn'), true),
      warm_max: z('Frühestens', 'vor Arbeitsbeginn – Grenze, falls der Raum sehr kalt ist', st('warm_max', 15, v => `${v} min vorher`), true),
      soll: this.sollBlock(z),
      toleranz: z('Schaltabstand ± um das Soll', 'Thermostat: ein unter Soll − Abstand, aus über Soll + Abstand', st('toleranz', .1, v => `± ${de(v, 1)} °C`), true),
      grenze: z('Heizgrenze', 'nicht heizen, wenn es wärmer ist', st('grenze', .5, grad)),
      basis: z('Grundlage', '', `<div class="seg klein">${['jetzt', 'Tageshöchstwert'].map(v => `<button data-act="basis" data-v="${v}" class="${e.basis === v ? 'on' : ''}">${v}</button>`).join('')}</div>`, true),
      boost: z('⚡ Schnell aufheizen', 'alle Heizkörper eines Containers zugleich, Vorrang in der Staffelung – bis zum Soll, ohne Fühler für', st('boost_min', 5, min)),
      zusatz: !C.some(b => b.geraete.filter(g => g.heizer).length >= 2) ? '' : z('🔥 Zusatz-Heizkörper', `in Containern mit „Zusatz nur bei Bedarf“: zuerst heizt einer, der Zusatz kommt dazu, wenn …${(() => { const n = C.filter(b => b.stufenAn); return n.length ? ` Jetzt: ${n.map(b => esc(b.name)).join(', ')}.` : ' Einschalten im Container unter Bearbeiten.'; })()}`, '')
        + z('… der Raum weiter unter dem Soll ist als', '', st('stufen_abstand', .5, grad), true) + z('… einer schon so lange läuft', '', st('stufen_min', 5, min), true)
        + z('… und es dabei weniger wärmer wurde als', '', st('stufen_anstieg', .1, v => `${de(v)} °C`), true) + z('… es draußen kälter ist als (beide von Anfang an)', '', st('stufen_kalt', 1, minus), true),
      tuer: z('🚪 Tür offen', 'Heizung pausieren nach', st('tuer_pause', 1, min)) + z('Nachricht nach', '', st('tuer_melden', 5, min), true),
      nachheizen: z('Nachheizen', `nach Arbeitsende, jeden Tag${nichtLern}`, st('nachheizen', 5, min)),
      warm_nach: z('Warm halten (lernende)', 'nach Arbeitsende; Kleidung trocknen kommt dazu', st('warm_nach', 5, v => v ? `${v} min länger` : 'bis Ende'), true),
      trocknen: z('👕 Kleidung trocknen', `ab ${de(e.tr_mm, 1)} mm Regen: +${e.tr_laenger} min nach dem Nachheizen, am Morgen ${e.tr_frueher} min früher`, link('hz-auf', 'data-k="trocknen"')),
      hand: z('✋ Handbetrieb übernehmen nach', 'Läuft ein Heizkörper zu lange von Hand, kommt eine Nachricht – ohne „So lassen“ übernimmt die Automatik so viel später', st('hand_nachfrist', 5, min)),
      frost: z('❄ Frostschutz', 'hält jeden Container über der Grenze, auch außerhalb der Arbeitszeit', schalter(e.frost, 'e-bool', 'data-k="frost"'))
        + (e.frost ? z('ein unter', '', st('frost_temp', .5, grad), true) + z('aus über', '', st('frost_aus', .5, grad), true)
          + z('ohne Fühler: ein, wenn draußen unter', 'aus erst 2 °C darüber; der Heizkörperthermostat regelt dann selbst', e.frost_aussen === null ? '<span class="leise">aus</span>' : st('frost_aussen', 1, minus), true)
          + z('auch bei Automatik aus', 'schaltet dann nur den Frostschutz, sonst nichts', schalter(e.frost_immer, 'e-bool', 'data-k="frost_immer"'), true) : ''),
      urlaub: z('🏖 Urlaub &amp; freie Feiertage', { frost: 'nur Frostschutz', absenk: `absenken auf ${de(e.absenk)} °C`, aus: 'alles aus' }[e.urlaub], link('hz-auf', 'data-k="urlaub"')),
      zieht: z('Heizt tatsächlich ab', 'Leistung, ab der ein Heizkörper als „heizt“ zählt – Heizzeit geheizt, Heiztage, Warm ab, Lernen, Wann heizt was', st('zieht_w', 5, v => `${v} W`)),
      fuehler: z('🌡 Fühler ohne Wert', 'meldet ein Fühler nichts, gilt sein letzter Wert noch so lange – danach regelt der Container wie ohne Fühler', st('fuehler_halten', 5, min)),
      staffel: z('⚡ Staffelung', e.staffel ? `${e.nutzbar} % je Anschluss nutzbar · höchstens ${e.max_gleich} gleichzeitig · mindestens ${e.min_lauf} min an, ${e.min_pause} min Pause` : 'aus – alle Heizkörper dürfen zugleich', link('tab-einst', 'data-g="strom"')),
    };
    const karte = (ic, titel, unter, teile) => { const inhalt = teile.map(k => R[k]).join(''); return inhalt ? `<div class="rv-kopf"><b>${ic} ${titel}</b><span class="leise">${unter}</span></div><div class="rv-karte">${inhalt}</div>` : ''; };
    const FEST = [
      ['Außentemperatur ohne Wert', '6 h', 'der letzte Außenwert gilt noch so lange (Heizgrenze, Frostschutz ohne Fühler)'],
      ['Frostschutz ohne Fühler aus', '+2 °C', 'über der Außen-Grenze, damit er nicht dauernd ein- und ausschaltet'],
      ['„Schaltet sich selbst ein“', '3× in 10 min', 'so oft musste die Automatik ein Gerät ausschalten – dann Störung statt Protokoll jede Minute'],
      ['Lernen: Takt', '10 min, mind. 2 min ein', 'Thermostat lernend: Anteil je Takt; kürzere Pulse lohnen nicht'],
      ['Lernen: Aufheizen zählt', 'ab 1 °C unter Soll, ≥ 20 min, ≥ 0,5 °C', 'so wird die Aufheizrate gemessen; ab 3 Messungen je Außenband rechnet der Container selbst'],
      ['Lernen: kalt / mild', 'unter 5 °C außen', 'Aufheizraten getrennt nach kaltem und mildem Wetter'],
      ['Tür vermutlich offen', '−0,3 °C in 10 min', 'beim Heizen, während es draußen kaum kälter wurde – danach 10 min nichts lernen'],
    ];
    return karte('🌅', 'Vor der Arbeit', 'warm, wenn es losgeht', ['vorheizen', 'frueh', 'lernend', 'warm_vor', 'warm_max'])
      + karte('👷', 'In der Arbeitszeit', 'auf das Soll halten', ['soll', 'toleranz', 'grenze', 'basis', 'boost', 'zusatz', 'tuer'])
      + karte('🌇', 'Nach der Arbeit', 'warm halten, trocknen, übernehmen', ['nachheizen', 'warm_nach', 'trocknen', 'hand'])
      + karte('🌙', 'Nachts, frei, Urlaub', 'nur Frostschutz', ['frost', 'urlaub'])
      + karte('⏱', 'Immer', 'Messung und Strom', ['zieht', 'fuehler', 'staffel'])
      + `<div class="rv-kopf"><b>📐 Feste Regeln</b><span class="leise">bewährte Schwellen, nicht änderbar</span></div><div class="rv-karte">${FEST.map(([t, w, x]) => `<div class="rv-fest"><span>${t}</span><b>${w}</b><div class="leise">${x}</div></div>`).join('')}</div>`
      + erkl(e.erklaer, 'Vorheizen und Nachheizen gelten jeden Arbeitstag. Die Verlängerungen zählen zusammen: vor der Arbeit Vorheizen + Kälte-Frühstart + früher nach Regen, danach Nachheizen + Kleidung trocknen (AN-0003). Die Heizgrenze verhindert Heizen an warmen Tagen. Der Frostschutz springt unter „ein“ an und hört erst über „aus“ wieder auf, damit der Heizkörper nicht dauernd ein- und ausschaltet.');
  }
  heizungBloecke() {
    const d = this.d, e = d.e, st = (k, s, fmt) => this.stepper(k, s, fmt);
    const grad = v => `${de(v, 1)} °C`, min = v => `${v} min`, mm = v => `${de(v, 1)} mm`;
    const p = this.planTag(this.z.HEUTE_TAG), az = this.azJetzt, hg = d.heizgrenze || {}, w = d.wetter || {};
    const bezug = zahl(hg.bezug) ? hg.bezug : e.basis === 'jetzt' ? w.aussen : w.aussen_max;
    const ft = this.feiertage(), naechster = ft && ft[0];
    const morgen = plusTage(this.z.HEUTE, 1), wm = this.wetterTag(morgen), pm = this.d.plan[morgen];
    const regel = (ic, titel, text, an) => `<div class="hr-zeile ${an ? 'an' : ''}"><span class="hr-ic">${ic}</span><div><b>${titel}</b><div class="leise">${text}</div></div><span class="hr-an">${an ? '●' : '○'}</span></div>`;
    const C = d.bereiche.filter(b => !b.pumpe), ur = this.urlaube(), lernend = C.filter(b => b.lern && b.lern.warm);   // AN-0004
    const freiT = e.urlaub === 'absenk' ? `heute abgesenkt auf ${de(e.absenk)} °C (mit Fühler), sonst Frostschutz` : e.urlaub === 'aus' ? 'heute alles aus – auch kein Frostschutz' : 'heute nur Frostschutz';
    const frei = { urlaub: ['Urlaub', freiT], feiertag: ['Feiertag', freiT] }[d.status];
    const urlaubsKal = d.optionen.urlaub_kalender, feiertagsKal = d.optionen.feiertag_kalender;
    return `${this.kopf('Heizung', esc(d.titel), `<div>${schalter(e.auto, 'auto')}</div>`)}
      <div class="glas-panel block"><div class="block-kopf"><b>Heute</b><span class="leise">welche Regeln greifen</span></div>
        ${regel('🕖', `Arbeitszeit ${p ? `${uhr(p.a)}–${uhr(p.b)}` : 'frei'}`, `${az ? `„${esc(az.name)}“` : 'keine Arbeitszeit'} · heizt ${p ? `${uhr(p.extra)}–${uhr(p.ende)}` : 'nicht'}`, !!p)}
        ${p ? `<div class="zeile unter hz-rechnung"><span class="leise">${this.planRechnung(p)}</span></div>` : ''}
        ${lernend.map(b => `<div class="zeile unter"><span class="leise">🧠 <b>${esc(b.name)}</b>: ${this.warmText(b)}</span></div>`).join('')}
        ${regel('🌡', `Heizgrenze ${de(e.grenze, 0)} °C`, zahl(bezug) ? `${e.basis === 'jetzt' ? 'jetzt' : 'Höchstwert heute'} ${de(bezug, 0)} °C → ${hg.zu_warm ?? bezug > e.grenze ? 'zu warm, es wird nicht geheizt' : 'es wird geheizt'}` : 'kein Wert vom Wetter', !(hg.zu_warm ?? (zahl(bezug) && bezug > e.grenze)))}
        ${regel('🌧', 'Kleidung trocknen', zahl(w.regen_heute) ? `${de(w.regen_heute, w.regen_heute % 1 ? 1 : 0)} mm Regen seit gestern (ab ${de(e.tr_mm)} mm) → ${w.regen_heute >= e.tr_mm ? `${e.tr_laenger} min länger, bis ${p ? uhr(p.ende) : '–'}` : 'nicht nötig'}` : 'kein Regenwert vom Wetter', zahl(w.regen_heute) && w.regen_heute >= e.tr_mm)}
        ${regel('❄', 'Kälte-Frühstart morgen', zahl(wm.kalt) ? `${de(wm.kalt).replace('-', '−')} °C erwartet (unter ${de(e.frueh_temp, 0).replace('-', '−')} °C) → ${wm.kalt < e.frueh_temp ? `${e.frueh_min} min früher` : 'nicht nötig'}${pm && (pm.gruende || []).includes('frueher_nach_regen') ? `, dazu ${e.tr_frueher} min nach Regen` : ''}` : 'noch keine Vorhersage für morgen', e.fruehstart && zahl(wm.kalt) && wm.kalt < e.frueh_temp)}
        ${e.staffel ? (() => { const L = this.last(); return regel('⚡', `Staffelung: ${L.laufen} von ${L.hk.length} Heizkörpern`, `${L.warten ? `${L.warten} wartet, weil ein Anschluss ausgelastet ist` : 'alle haben Platz'} · höchstens ${e.max_gleich} gleichzeitig · Vorheizen startet 15 min früher, damit alle warm werden`, true); })() : ''}
        ${frei ? regel('🏖', frei[0], frei[1], true) : regel('🏖', 'Kein Urlaub, kein Feiertag', naechster ? `nächster Feiertag ${wtag(naechster.von)} ${kurzDatum(naechster.von)} ${esc(naechster.name)}` : feiertagsKal ? (ft === null ? 'Feiertage laden …' : 'kein Feiertag im Kalender') : 'kein Feiertagskalender gewählt', false)}</div>
      ${this.uebersichtHeizzeiten()}
      <div class="glas-panel block"><div class="block-kopf"><b>Heizplan · diese Woche</b><span class="leise">aus Arbeitszeit und Wetter</span></div>${this.heizplanInhalt()}</div>
      ${this.azBlock()}
      ${this.ausnahmenBlock()}
      <div class="glas-panel block"><div class="block-kopf"><b>So wird geheizt</b><span class="leise">nach Tagesablauf</span></div>
        ${this.regelnInhalt(lernend, C)}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>👕 Kleidung trocknen</b><span class="leise">nach Regen zusätzlich zum Nachheizen</span></div>
        <div class="zeile"><span>ab Regen (seit gestern)</span>${st('tr_mm', .5, mm)}</div>
        <div class="zeile"><span>zusätzlich nach dem Nachheizen</span>${st('tr_laenger', 5, min)}</div>
        <div class="zeile"><span>am nächsten Morgen früher</span>${st('tr_frueher', 5, min)}</div></div>
      <div class="glas-panel block"><div class="block-kopf"><b>Je Container</b><span class="leise">Modus · Trocknen · Soll</span></div>
        ${C.map(b => { const soll = this.sollVon(b);
          return `<div class="jc"><div class="jc-name"><b>${esc(b.name)}</b><span class="leise">${b.offline ? 'offline' : b.t !== null ? `🌡 ${de(b.t)} °C` : 'ohne Fühler'}</span></div>
            <div class="jc-ctrl"><select class="jc-modus" data-jm="${b.id}" title="Modus" aria-label="Modus ${esc(b.name)}">${MODI.map(([k, t]) => `<option value="${k}" ${b.modus === k ? 'selected' : ''} ${k === 'thermo' && !b.fuehler ? 'disabled' : ''}>${t}</option>`).join('')}</select>
              <span class="jc-l">👕</span>${schalter(b.trocknen, 'tr-b', `data-id="${b.id}"`).replace('class="sw', 'class="sw klein')}
              ${b.fuehler ? `<span class="stepper klein"><button data-act="jc-soll" data-id="${b.id}" data-d="-0.5">−</button><b class="${b.soll !== undefined ? 'eigen' : ''}">${de(soll)}°</b><button data-act="jc-soll" data-id="${b.id}" data-d="0.5">+</button></span>`
                : '<span class="leise jc-th">Thermostat</span>'}</div></div>`; }).join('')}
        <div class="leise">Ein eigener Sollwert (bernstein) gilt nur für diesen Container, sonst gilt ${de(e.soll)} °C.</div>
        ${erkl(e.erklaer, 'Zeitplan: an in der Heizzeit, der Heizkörper regelt selbst. Thermostat: in der Heizzeit nach dem Fühler auf das Soll (nur mit Fühler). Bei Bedarf: nur per Schalter oder Termin. Hand: die Automatik schaltet nicht. Aus: nur Frostschutz.')}</div>
      <div class="glas-panel block"><div class="block-kopf"><b>Urlaub &amp; Feiertage</b></div>
        <div class="zeile"><div><b>An Feiertagen frei</b><div class="leise">${feiertagsKal ? `Feiertage aus dem Kalender „${esc(this.name(feiertagsKal))}“` : 'noch kein Feiertagskalender gewählt'}</div></div>${schalter(e.feiertag_frei, 'e-bool', 'data-k="feiertag_frei"')}</div>
        <div class="zeile modus-z"><div><b>Im Urlaub und an freien Feiertagen</b><div class="leise">${{ frost: 'nur Frostschutz', absenk: `mit Fühler auf ${de(e.absenk)} °C halten, ohne Fühler nur Frostschutz`, aus: 'alles aus – auch kein Frostschutz. Nur, wenn nichts einfrieren kann.' }[e.urlaub]}</div></div>
          <div class="seg klein">${[['frost', 'nur Frostschutz'], ['absenk', 'absenken'], ['aus', 'alles aus']].map(([k, t]) => `<button data-act="e-wert" data-k="urlaub" data-v="${k}" class="${e.urlaub === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        ${e.urlaub === 'absenk' ? `<div class="zeile unter"><span>absenken auf</span>${st('absenk', .5, grad)}</div>` : ''}
        ${ft === null ? '<div class="leise">Lädt …</div>' : ft.slice(0, 4).map(f => { const t = wtag(f.von), we = t === 'Sa' || t === 'So';
          return `<div class="zeile unter"><span><b class="ft-d">${t} ${kurzDatum(f.von)}</b> ${esc(f.name)}</span><span class="leise">${we ? 'Wochenende' : 'frei'}</span></div>`; }).join('')}
        <div class="gruppe-t">Urlaub · ${urlaubsKal ? `Kalender „${esc(this.name(urlaubsKal))}“` : 'kein Kalender gewählt'}</div>
        ${ur === null ? '<div class="leise">Lädt …</div>' : ur.map((u, i) => `<div class="zeile unter"><span><b>${esc(u.name)}</b> <span class="leise">${kurzDatum(u.von)} – ${datum(u.bis)}</span></span><button class="x" data-act="urlaub-weg" data-i="${i}" title="Urlaub löschen">✕</button></div>`).join('') || '<div class="leise">Kein Urlaub eingetragen</div>'}
        <button class="zeile" data-act="sheet" data-s="${urlaubsKal ? 'urlaub' : 'wetterquelle'}"><span class="blau">${urlaubsKal ? '+ Urlaub eintragen' : 'Kalender für Urlaub wählen'}</span></button></div>`;
  }
  /* FE-0012: Ausnahmen je Tag mit mehreren Zeitfenstern; Arbeitszeit-Block und eigene Fenster rechnet die Integration (plan) */
  ausnahmenBlock() {
    const H = this.z.HEUTE, L = this.d.ausnahmen.filter(a => a.datum >= H), tage = [...new Set(L.map(a => a.datum))].sort();
    const badge = a => a.art === 'frei' ? '' : `<span class="badge ${a.art === 'zeiten' ? '' : 'blau-b'}">${AUSNAHME[a.art]}</span>`;
    return `<div class="glas-panel block"><div class="block-kopf"><b>Ausnahmen</b><span class="leise">einmalig – mehrere Zeitfenster je Tag möglich</span></div>
      <div class="bedarf-dauer">${[['heute-laenger', '+ Heute länger'], ['morgen-spaeter', '+ Morgen später'], ['samstag', '+ Samstag arbeiten'], ['frei', '+ Freier Tag']].map(([k, t]) => `<button class="chip glas-panel" data-act="ausn-neu" data-v="${k}">${t}</button>`).join('')}</div>
      ${tage.length ? tage.map(t => { const A = L.filter(a => a.datum === t).sort((x, y) => (x.von || '').localeCompare(y.von || '')), frei = A.some(a => a.art === 'frei'), p = this.planIso(t);
        const az = this.azJetzt && this.azJetzt.tage[wtag(t)], basis = !frei && !A.some(a => a.art === 'zeiten') && az ? `<div class="am-fenster leise">${az.join('–')} laut Arbeitszeit</div>` : '';
        return `<div class="am-tag"><div class="am-tag-kopf"><b>${wtag(t)} ${kurzDatum(t)}</b>${frei ? '<span class="badge">frei</span>' : ''}</div>${basis}
          ${A.map(a => `<div class="am-fenster">${a.art === 'frei' ? '<b>frei</b>' : `<b>${a.von}–${a.bis}</b>`} ${badge(a)}${a.notiz ? ` <span class="leise">${esc(a.notiz)}</span>` : ''}
            <button class="x" data-act="ausn-weg" data-d="${a.datum}" data-art="${a.art}" data-von="${a.von || ''}" data-bis="${a.bis || ''}" title="dieses Zeitfenster löschen">✕</button></div>`).join('')}
          ${frei || !p ? '' : `<div class="am-strahl">${this.zeitstrahl(p, t === H)}<div class="tl-achse"><span>04</span><span>12</span><span>20</span></div></div>
            <div class="am-hinweis">${this.planFensterText(p)}</div>`}
          ${frei ? '' : `<button class="zeile" data-act="ausn-dazu" data-d="${t}"><span class="blau">+ weiteres Zeitfenster an diesem Tag</span></button>`}</div>`; }).join('') : '<div class="leise">Keine Ausnahmen</div>'}
      <button class="zeile" data-act="ausn-neu" data-v=""><span class="blau">+ Ausnahme für einen anderen Tag</span></button></div>`;
  }
  planFensterText(p) {
    return [`Arbeit ${uhr(p.a)}–${uhr(p.b)}, geheizt ${uhr(p.extra)}–${uhr(p.ende)} (mit Vor-/Nachheizen)`,
      ...(p.eigene || []).map(f => `nur ${uhr(f[0])}–${uhr(f[1])} geheizt (eigenes Fenster, ohne Vor-/Nachheizen)`)].join(' · ');
  }
  azBlock() {
    const L = this.azListe, jetzt = this.azJetzt;
    if (!jetzt) return `<div class="glas-panel block"><div class="block-kopf"><b>Arbeitszeit</b></div><div class="leise">Noch keine Arbeitszeit – ohne Arbeitszeit läuft nur der Frostschutz.</div>
      <button class="zeile" data-act="az-neu"><span class="blau">+ Neue Arbeitszeit ab …</span></button></div>`;
    const geplant = L.filter(a => a.ab > this.z.HEUTE), frueher = L.filter(a => a.ab < jetzt.ab).reverse();
    const idx = a => this.d.arbeitszeiten.indexOf(a);
    return `<div class="glas-panel block"><div class="block-kopf"><b>Arbeitszeit</b><span class="badge gruen">${jetzt.ab <= this.z.HEUTE ? 'gilt seit' : 'gilt ab'} ${datum(jetzt.ab)}</span></div>
      <div class="az-name">${esc(jetzt.name)}</div>
      ${jetzt.auto ? '<div class="leise">Automatisch angelegt – wird ersetzt, sobald du eine eigene Arbeitszeit speicherst (auch mit früherem Datum).</div>' : ''}
      <button class="zeile" data-act="sheet" data-s="az" data-i="${idx(jetzt)}"><span class="blau">Bearbeiten oder löschen</span><span class="chev">›</span></button>
      ${TAGE.map(t => { const z = jetzt.tage[t]; return `<div class="zeile az ${t === this.z.HEUTE_TAG ? 'heute' : ''}"><b class="tag-n">${t}</b>
        <span class="fenster">${z ? `<em>${z[0]}–${z[1]}</em>` : '<span class="leise">frei</span>'}</span><span class="leise">${z ? dauer(z[0], z[1]) : ''}</span></div>`; }).join('')}
      ${geplant.filter(a => a !== jetzt).map(a => `<button class="zeile" data-act="sheet" data-s="az" data-i="${idx(a)}"><span><span class="badge blau-b">geplant</span> ab ${datum(a.ab)} · ${esc(a.name)}</span><span class="chev">›</span></button>`).join('')}
      ${frueher.length ? `<button class="zeile" data-act="az-alt"><span>Frühere Arbeitszeiten (${frueher.length})</span><span class="chev">${this.s.azAlt ? '⌄' : '›'}</span></button>` : ''}
      ${this.s.azAlt ? frueher.map(a => `<button class="zeile unter" data-act="sheet" data-s="az" data-i="${idx(a)}"><span>${datum(a.ab)} · ${esc(a.name)}</span><span class="leise">${a.tage.Mo ? a.tage.Mo.join('–') : ''} ›</span></button>`).join('') : ''}
      <button class="zeile" data-act="az-neu"><span class="blau">+ Neue Arbeitszeit ab …</span></button></div>`;
  }

  /* ---- Auswertung ---- */
  v_auswertung() {
    const d = this.d, aw = this.s.aw ||= { zeitraum: 'Monat', auswahl: d.bereiche.map(b => b.id) }, z = aw.zeitraum;
    const alle = this.s.awScope === 'alle';
    // Kennzahlen, Vergleich zum Zeitraum davor, Ohne Automatik, Wetter, Ölradiator/Konvektor, Je Gerät: von der Integration (api §8)
    const A = this.awDaten(z, aw.v || 0), S = (A && A.summen) || {}, vd = k => (S.veraenderung || {})[k] ?? null, oa = S.ohne_automatik || null;
    const kwh = A ? S.kwh : null, hz = A ? S.heizzeit : null, pz = A ? S.pumpzeit : null, ohne = A ? S.ohne : null;
    const vgl = this.zrVgl(z, aw.v || 0);
    const kz = (wert, text, dl) => `<div><b>${wert}</b><span>${text}</span>${dl !== null ? `<em class="${dl > 0 ? 'mehr' : 'weniger'}">${dl > 0 ? '▲' : '▼'} ${Math.abs(dl)} %</em>` : ''}</div>`;
    // Wetter-Einfluss: letzte 30 Heiztage, kWh je Tag gegen Tagesmittel außen, mit Gerade der Integration
    const W = A ? A.wetter || {} : null, pkt = W && (W.punkte || []), gerade = W && W.gerade;
    let streuHtml;
    if (!W) streuHtml = LAEDT;
    else if (!gerade) streuHtml = '<div class="leer">Noch zu wenige Heiztage für einen Vergleich</div>';
    else {
      const { k, d0, null0, eur_je_grad } = gerade;
      streuHtml = `<div class="chart-wrap">${streu('streu', pkt, k, d0)}</div>
        <div class="hinweis-k">${k < 0 ? `Je Grad kälter <b>≈ +${de(-k, 1)} kWh</b> am Tag (${de(eur_je_grad, 2)} €).${zahl(null0) ? ` Ab etwa <b>${de(null0, 0)} °C</b> wird kaum mehr geheizt – ` : ' '}` : 'Noch kein klarer Zusammenhang mit der Außentemperatur. '}die Heizgrenze steht auf ${de(d.e.grenze, 0)} °C.</div>`;
    }
    // AN-0008: fair – nur Zeiten im Modus Thermostat mit Fühler, Container mit einem Typ, kWh je Gradstunde (Integration)
    const T = ['oelradiator', 'konvektor'].map(t => { const x = (A && A.typ && A.typ[t]) || {}; return { kwhG: x.kwh_gradh ?? null, kwhGm2: x.kwh_gradh_m2 ?? null, auf: x.auf ?? null, ab: x.ab ?? null, container: x.container || [] }; });
    const vglOk = !!(A && A.typ && A.typ.vergleichbar), aussen = (A && A.typ && A.typ.ausgeschlossen) || [];
    // Was die Ölradiatoren gegenüber Konvektoren gespart haben (Integration: typ.ersparnis)
    const er = A && A.typ && A.typ.ersparnis, zrE = this.zeitraum(z, aw.v || 0);
    const ersparHtml = !er ? '' : `<div class="kennz"><div><b>${de(er.oel_kwh, er.oel_kwh < 100 ? 1 : 0)}</b><span>kWh Ölradiatoren</span></div>
        <div><b>${de(er.konvektor_kwh, er.konvektor_kwh < 100 ? 1 : 0)}</b><span>kWh mit Konvektoren</span></div>
        <div><b class="${er.erspart_eur < 0 ? 'rot-t' : ''}">${de(Math.abs(er.erspart_eur), 2)} €</b><span>${er.erspart_eur < 0 ? 'mehr' : 'erspart'}</span></div></div>
      <div class="leise">${{ Tag: 'kWh je Stunde', Woche: 'kWh je Tag', Monat: 'kWh je Tag', Jahr: 'kWh je Monat' }[z]} · ${this.zrText(z, aw.v || 0)}</div>
      <div class="chart-wrap">${flaeche(`typ-er-${z}-${aw.v || 0}`, [{ name: 'Ölradiatoren (tatsächlich)', v: er.oel, farbe: 'var(--s1)' }], zrE.labels, 'kWh',
        z === 'Tag' ? 6 : z === 'Monat' ? 7 : z === 'Woche' ? 1 : 3, { name: 'mit Konvektoren', v: er.konvektor })}</div>
      <div class="leise">„Mit Konvektoren“ = der tatsächliche Verbrauch der Ölradiatoren mal ${de(er.faktor, 2)} – so viel mehr bzw. weniger brauchen Konvektoren hier je Gradstunde.</div>`;
    const f = (v, fn) => zahl(v) ? fn(v) : '–';
    // wie Mockup: fett ist der Nachteil (mehr kWh, langsamer aufheizen, schneller abkühlen); Kosten ohne Hervorhebung
    const nachteil = (i, hoch) => { const a = T[0][i], b = T[1][i]; if (hoch === null || !zahl(a) || !zahl(b) || a === b) return [false, false]; return hoch ? [a > b, b > a] : [a < b, b < a]; };
    const zeile = (titel, i, hoch, fn) => { const [x, y] = nachteil(i, hoch); return `<tr><td>${titel}</td><td>${x ? '<b>' : ''}${f(T[0][i], fn)}${x ? '</b>' : ''}</td><td>${y ? '<b>' : ''}${f(T[1][i], fn)}${y ? '</b>' : ''}</td></tr>`; };
    const weniger = (A && A.typ && A.typ.weniger) ?? null;
    const cmp = i => zahl(T[0][i]) && zahl(T[1][i]) && T[0][i] !== T[1][i] ? Math.sign(T[0][i] - T[1][i]) : 0;
    // Fußsatz aus den Messwerten, gebaut wie im Mockup („braucht länger, hält die Wärme aber besser und verbraucht rund 16 % weniger“)
    const auf = cmp('auf') < 0 ? 'braucht länger' : cmp('auf') > 0 ? 'heizt schneller auf' : '';
    const ab = cmp('ab') < 0 ? `hält die Wärme ${auf === 'braucht länger' ? 'aber ' : ''}besser` : cmp('ab') > 0 ? 'kühlt schneller ab' : '';
    const vb = weniger > 0 ? `verbraucht rund ${weniger} % weniger` : weniger < 0 ? `verbraucht rund ${-weniger} % mehr` : '';
    const teile = [auf, ab, vb].filter(Boolean), fussSatz = !vglOk ? 'Noch nicht vergleichbar – es braucht je einen Container nur mit Ölradiator und nur mit Konvektor, mit Fühler im Modus Thermostat.'
      : teile.length ? `Der Ölradiator ${teile.length > 1 ? `${teile.slice(0, -1).join(', ')} und ${teile.at(-1)}` : teile[0]}.` : 'Noch zu wenige Messungen für einen Vergleich.';
    /* WU-0005: Bausteine der Auswertung – die Seite ordnet sie nach dem eigenen Layout an (Variante 6) */
    const B = {
      kennzahlen: `<div class="glas-panel kennz vier">${kz(zahl(kwh) ? de(kwh, 0) : '–', 'kWh', vd('kwh'))}${kz(zahl(kwh) ? `${de(S.eur, 0)} €` : '–', 'Kosten', vd('kwh'))}${kz(zahl(hz) ? `${de(hz, 0)} h` : '–', 'Heizzeit', vd('heizzeit'))}${kz(zahl(pz) ? `${de(pz, 1)} h` : '–', 'Pumpzeit', vd('pumpzeit'))}</div>
      <div class="leise vgl">Pfeile: im Vergleich zu ${vgl}</div>`,
      verlauf: `<div class="glas-panel block">${this.verbrauchInhalt(aw, 'aw', false)}</div>`,
      leistung: alle ? '' : this.leistungHeute(),
      temperaturen: alle ? '' : this.temperaturen(),
      abrechnung: this.abrechnung(z),
      geraete: alle ? '' : this.geraeteBlock(z, A),
      wetter: `<div class="glas-panel block"><div class="block-kopf"><b>Wetter-Einfluss</b><span class="leise">letzte 30 Heiztage · kWh je Tag gegen Außentemperatur</span></div>
        ${streuHtml}</div>`,
      ohne: `<div class="glas-panel block"><div class="block-kopf"><b>Ohne Automatik</b><span class="leise">wenn alles rund um die Uhr liefe</span></div>
        ${!zahl(ohne) || !zahl(kwh) ? (ohne === null || kwh === null ? LAEDT : '<div class="leer">Noch keine Werte</div>') : !oa ? '<div class="leer">Noch keine Werte</div>' : `
        <div class="hbar"><span class="hb-n">mit Automatik</span><span class="hb-spur"><i style="width:${Math.min(100, kwh / ohne * 100)}%;background:var(--s1)"></i></span><span class="hb-w">${de(S.eur, 0)} €</span></div>
        <div class="hbar"><span class="hb-n">ohne (24/7)</span><span class="hb-spur"><i style="width:100%;background:var(--s2)"></i></span><span class="hb-w">${de(oa.ohne_eur, 0)} €</span></div>
        <div class="gespart">gespart <b>${de(oa.gespart_eur, 2)} €</b> · ${de(oa.prozent, 0)} %</div>`}
        <div class="leise">So rechnet „ohne Automatik“: jeder Heizkörper mit seiner gemessenen Ø-Leistung im Betrieb (sobald er Strom zieht, ab 5 W) rund um die Uhr seit Beginn der Baustelle; gespart = ohne Automatik − tatsächlich verbraucht, mal Strompreis.</div></div>`,   // AN-0007: woher der Vergleich kommt
      hochrechnung: alle ? '' : this.hochrechnung(A),
      vergleich: `<div class="glas-panel block"><div class="block-kopf"><b>Ölradiator oder Konvektor</b><span class="leise">fair: gleiche Regelung · aus eigenen Messungen</span></div>
        <table class="vergleich"><tr><th></th><th>Ölradiator</th><th>Konvektor</th></tr>
          ${zeile('kWh je Gradstunde', 'kwhG', true, v => de(v, 3))}
          ${zeile('kWh je Gradstunde und m²', 'kwhGm2', true, v => de(v, 4))}
          ${zeile('Aufheizen', 'auf', false, v => `${de(v, 1)} °C/h`)}
          ${zeile('Abkühlen nach Aus', 'ab', true, v => `${de(v, 1)} °C/h`)}
          <tr><td>zählt</td><td class="leise">${T[0].container.map(esc).join(', ') || '–'}</td><td class="leise">${T[1].container.map(esc).join(', ') || '–'}</td></tr></table>
        <div class="leise fuss">${fussSatz}</div>
        ${ersparHtml}
        ${aussen.length ? `<div class="leise">Nicht im Vergleich: ${aussen.map(x => `${esc(x.name)} (${esc(x.grund)})`).join(', ')}.</div>` : ''}
        <div class="leise">kWh je Gradstunde = Strom je Stunde und °C, um den es drinnen wärmer ist als draußen. Gezählt werden nur Zeiten, in denen ein Container mit Fühler im Modus Thermostat geregelt wird; Container mit beiden Typen zählen nicht.</div></div>`,
    };
    return this.awSeite(B, A, z, alle);
  }

  /* ============ Auswertung aus Bausteinen (WU-0005): Vorlagen, Anpassen, Layout mit Ziehen – gemerkt je Browser ============ */
  awVgl(z) { return this.zrVgl(z, this.zrV('aw')); }
  awDelta(dl) { return dl === null || dl === undefined ? '' : `<em class="aw-delta ${dl > 0 ? 'mehr' : 'weniger'}">${dl > 0 ? '▲' : '▼'} ${Math.abs(dl)} %</em>`; }
  awAuswahl() {
    if (!this.s.awListe) { let l = null; try { l = JSON.parse(localStorage.getItem(AW_SPEICHER) || 'null'); } catch (e) { l = null; }
      if (!Array.isArray(l)) this.awVorlage('misch', false);
      else { const bekannt = l.filter(x => x && (AW_BAUSTEINE[x.k] || KK[x.k])).map(x => ({ k: x.k, an: !!x.an, ...(KK[x.k] ? { id: x.id, dia: x.dia, ids: x.ids, zr: x.zr, art: x.art } : {}), w: Math.min(4, Math.max(1, +x.w || 2)), h: Math.min(6, Math.max(1, +x.h || 2)) }));
        this.s.awListe = [...bekannt, ...Object.keys(AW_BAUSTEINE).filter(k => !bekannt.some(x => x.k === k)).map(k => ({ k, an: false, w: 4, h: AW_HOEHE[k] || 2 }))]; } }
    this.s.awListe = this.s.awListe.map(x => x.st ? x : this.awGross(x));
    return this.s.awListe;
  }
  awVorlage(name, merken = true) {
    const v = AW_VORLAGEN[name][1], rest = Object.keys(AW_BAUSTEINE).filter(k => !v.some(x => x[0] === k));
    this.s.awListe = [...v.map(([k, w, h]) => ({ k, an: true, w, h })), ...rest.map(k => ({ k, an: false, w: 4, h: AW_HOEHE[k] || 2 }))].map(x => this.awGross(x));
    if (merken) this.awMerken();
  }
  awGross(x) { const st = awStufe(x.k, x.w, x.h); return { ...x, w: st[1], h: st[2], st: st[0] }; }   // FE-0006: immer auf eine Stufe
  awMerken() { try { localStorage.setItem(AW_SPEICHER, JSON.stringify(this.s.awListe)); } catch (e) { /* egal */ } }
  /* „Was fällt auf“: die Integration wählt aus (logik/auswertung.erkenntnisse), die Seite macht nur den Text */
  awErkenntnisse(A, z) {
    return ((A && A.erkenntnisse) || []).map(x => ({
      gespart: ['💶', `${de(x.eur, 0)} € gespart`, `Die Automatik spart ${de(x.prozent, 0)} % gegenüber Dauerbetrieb.`, 'ohne'],
      groesster: ['🔥', `${esc(x.name)} verbraucht am meisten`, `${de(x.kwh, 0)} kWh · ${de(x.anteil, 0)} % des Verbrauchs.`, 'geraete'],
      sparsamster: ['⚙', `${esc(x.name)} heizt am sparsamsten`, `${de(x.kwh_h, 2)} kWh je Heizstunde.`, 'vergleich'],
      wetter: ['🌡', `Je Grad kälter +${de(x.kwh_je_grad, 1)} kWh am Tag`, [zahl(x.eur_je_grad) ? `≈ ${de(x.eur_je_grad, 2)} € je Grad` : '', zahl(x.null0) ? `unter ${de(x.null0, 0)} °C außen wird geheizt` : ''].filter(Boolean).join(' · '), 'wetter'],
      mehr: ['📈', `${x.prozent} % mehr als ${this.awVgl(z)}`, 'Verbrauch im Vergleich zum Zeitraum davor.', 'verlauf'],
      weniger: ['📉', `${x.prozent} % weniger als ${this.awVgl(z)}`, 'Verbrauch im Vergleich zum Zeitraum davor.', 'verlauf'],
      typ: ['⚖', x.weniger > 0 ? `Ölradiator ${de(x.weniger, 0)} % sparsamer` : `Konvektor ${de(-x.weniger, 0)} % sparsamer`, 'aus eigenen Messungen je Heizstunde.', 'vergleich'],
    })[x.art]).filter(Boolean);
  }
  awStueck(k, B, A, z, gr = { w: 4, h: 4 }) {
    const d = this.d, S = (A && A.summen) || {}, oa = S.ohne_automatik, h = A && A.hochrechnung, rang = (A && A.rangliste) || [], p = d.e.preis;
    const kachel = (kk, inhalt) => `<button class="glas-panel aw-k" data-act="aw-detail" data-k="${kk}">${inhalt}</button>`, laed = !A;
    const eur = zahl(S.eur) ? `${de(S.eur, 2)} €` : '–', max = Math.max(1, ...rang.map(c => c.kwh || 0)), wann = (this.zrV('aw') ? this.zrText(z, this.zrV('aw')) : { Tag: 'heute', Woche: 'diese Woche', Monat: 'dieser Monat', Jahr: 'dieses Jahr' }[z]).toUpperCase();
    const temp = id => { const b = d.bereiche.find(x => x.id === id); return b && b.t !== null ? `${de(b.t)}°` : '–'; };
    switch (k) {
      case 'betrag': return laed ? `<div class="glas-panel block">${LAEDT}</div>` : `<div class="glas-panel aw-betrag"><div><small>KOSTEN · ${wann}</small><b>${eur}</b>
          <span>${zahl(S.kwh) ? de(S.kwh, 0) : '–'} kWh ${this.awDelta((S.veraenderung || {}).kwh)} <span class="leise">zu ${this.awVgl(z)}</span></span></div>
        <div class="aw-betrag-r"><div><small>GESPART DURCH AUTOMATIK</small><b class="gruen-t">${oa ? `${de(oa.gespart_eur, 0)} €` : '–'}</b></div>
          <div><small>HOCHRECHNUNG HEIZPERIODE</small><b>${h && zahl(h.mit_eur) ? `≈ ${de(h.mit_eur, 0)} €` : '–'}</b></div></div></div>`;
      case 'rangliste': if (gr.w <= 2) return `<div class="glas-panel block aw-klein"><div class="block-kopf"><b>Wer verbraucht was</b><span class="leise">Top 3</span></div>
          ${laed ? LAEDT : !rang.length ? '<div class="leer">Noch kein Verbrauch</div>' : rang.slice(0, 3).map((c, i) => { const hier = d.bereiche.find(b => b.id === c.bereich);
            return `<button class="aw-rang aw-rang-z" ${hier ? `data-act="container" data-id="${esc(c.bereich)}"` : 'disabled'}><span><em>${i + 1}</em> ${esc(c.name)}</span><i style="width:${(c.kwh || 0) / max * 100}%;background:${hier ? BEREICH_FARBEN[hier.f % BEREICH_FARBEN.length] : 'var(--ink2)'}"></i><em>${de(c.kwh, 0)} kWh · ${de(c.eur, 2)} €</em></button>`; }).join('')}</div>`;
        return `<div class="glas-panel block"><div class="block-kopf"><b>Wer verbraucht was</b><span class="leise">antippen öffnet den Container</span></div>
        ${laed ? LAEDT : !rang.length ? '<div class="leer">Noch kein Verbrauch in diesem Zeitraum</div>' : `<div class="aw-tab-kopf"><span></span><span>kWh</span><span>€</span><span>Heizzeit</span><span>kWh/h</span><span>kWh/m²</span><span>jetzt</span></div>
        ${rang.map((c, i) => { const hier = d.bereiche.find(b => b.id === c.bereich), farbe = hier ? BEREICH_FARBEN[hier.f % BEREICH_FARBEN.length] : 'var(--ink2)';
          return `<button class="aw-tab-zeile" ${hier ? `data-act="container" data-id="${esc(c.bereich)}"` : 'disabled'}><span class="aw-tab-name"><span><em>${i + 1}</em>${esc(c.name)}</span>${this.s.awScope === 'alle' ? `<small>${esc(c.baustelle || '')}</small>` : ''}
            <i style="width:${(c.kwh || 0) / max * 100}%;background:${farbe}"></i></span><b>${de(c.kwh, 0)}</b><span>${de(c.eur, 2)}</span><span>${de(c.heizzeit, 1)} h</span><span>${zahl(c.kwh_h) ? de(c.kwh_h, 2) : '–'}</span><span>${zahl(c.kwh_m2) ? de(c.kwh_m2, 2) : '–'}</span><span>${hier ? temp(c.bereich) : '–'}</span></button>`; }).join('')}`}</div>`;
      case 'erkenntnisse': { const E = this.awErkenntnisse(A, z);
        return laed ? `<div class="glas-panel block">${LAEDT}</div>` : !E.length ? '<div class="glas-panel block"><div class="block-kopf"><b>Was fällt auf</b></div><div class="leer">Noch nichts Auffälliges</div></div>'
          : `<div class="aw-karten">${E.map(([i, t, x, kk]) => `<button class="glas-panel aw-karte" data-act="aw-detail" data-k="${kk}"><span>${i}</span><b>${t}</b><small>${x}</small></button>`).join('')}</div>`; }
      case 'k-kosten': return kachel('abrechnung', `<small>KOSTEN · ${wann}</small><b>${eur}</b><span>${zahl(S.kwh) ? de(S.kwh, 0) : '–'} kWh ${this.awDelta((S.veraenderung || {}).kwh)}</span>`);
      case 'k-gespart': return kachel('ohne', `<small>GESPART</small><b class="gruen-t">${oa ? `${de(oa.gespart_eur, 0)} €` : '–'}</b><span>${oa ? `${de(oa.prozent, 0)} % durch Automatik` : 'noch keine Werte'}</span>`);
      case 'k-hoch': return kachel('hochrechnung', `<small>HOCHRECHNUNG</small><b>${h && zahl(h.mit_eur) ? `${de(h.mit_eur, 0)} €` : '–'}</b><span>bis Ende Heizperiode</span>`);
      case 'k-wer': return kachel('geraete', `<small>WER VERBRAUCHT</small>${rang.slice(0, 4).map(c => { const hier = d.bereiche.find(b => b.id === c.bereich);
        return `<div class="aw-rang"><span>${esc(c.name)}</span><i style="width:${(c.kwh || 0) / max * 100}%;background:${hier ? BEREICH_FARBEN[hier.f % BEREICH_FARBEN.length] : 'var(--ink2)'}"></i><em>${de(c.kwh, 0)} kWh</em></div>`; }).join('') || '<span>–</span>'}`);
      case 'k-firmen': { const ab = this.abDaten(z, undefined, this.d, this.zrV('aw')), F = (ab && ab.firmen) || [];
        return kachel('abrechnung', `<small>FIRMEN</small>${F.map(f => `<div class="aw-zeile"><span>${esc(f.firma)}</span><b>${de(f.eur ?? (f.kwh || 0) * p, 2)} €</b></div>`).join('') || '<span>–</span>'}`); }
      case 'k-wetter': { const g = A && A.wetter && A.wetter.gerade; return kachel('wetter', `<small>WETTER</small><b>${g && g.k < 0 ? `+${de(-g.k, 1)}` : '–'}</b><span>kWh je Grad kälter</span>`); }
      case 'k-oel': { const w = A && A.typ && A.typ.weniger; return kachel('vergleich', `<small>ÖLRADIATOR</small><b>${zahl(w) ? `${w > 0 ? '−' : '+'}${de(Math.abs(w), 0)} %` : '–'}</b><span>gegenüber Konvektor</span>`); }
      case 'k-temp': return kachel('temperaturen', `<small>TEMPERATUREN JETZT</small>${d.bereiche.filter(b => !b.pumpe && b.t !== null).slice(0, 4).map(b => `<div class="aw-zeile"><span>${esc(b.name)}</span><b>${de(b.t)} °C</b></div>`).join('') || '<span>kein Fühler</span>'}`);
      case 'links': return `<div class="glas-panel liste">${[['abrechnung', '💶 Abrechnung nach Firma'], ['geraete', '♨ Je Gerät'], ['temperaturen', '🌡 Temperaturen'], ['wetter', '🌦 Wetter-Einfluss'], ['vergleich', '⚖ Ölradiator oder Konvektor'], ['hochrechnung', '📅 Hochrechnung Heizperiode']]
        .filter(([kk]) => B[kk]).map(([kk, t]) => `<button class="zeile" data-act="aw-detail" data-k="${kk}"><span>${t}</span><span class="chev">›</span></button>`).join('')}</div>`;
      case 'verlauf': return this.awDiagramm(z, gr);   // FE-0006: füllt die Kachel, ohne eigene Zeitraum-Leiste
      case 'wetter': return gr.w <= 1 ? this.awStueck('k-wetter', B, A, z) : B.wetter;
      default: return B[k] || '';
    }
  }
  /* FE-0006: Verbrauch als Kachel – gestapelt je Container/Baustelle oder Firma (quellen wie das große Diagramm), füllt die Kachel */
  awDiagramm(z, gr) {
    const st = this.s.aw, Q = this.quellen(st, 'aw'), werte = Q.map(q => ({ q, v: q.v(z) }));
    const alle = this.s.awScope === 'alle', firma = st.gruppe === 'firma', kopf = `<div class="aw-dia-kopf"><b>Verbrauch</b>
      <div class="seg klein">${[['teil', alle ? 'Baustelle' : 'Container'], ['firma', 'Firma']].map(([k, t]) => `<button data-act="vb-gruppe" data-ziel="aw" data-v="${k}" class="${(firma ? 'firma' : 'teil') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;
    if (werte.some(x => !x.v)) return `<div class="glas-panel aw-dia">${kopf}${LAEDT}</div>`;
    const zr = this.zeitraum(z, st.v || 0), labels = zr.labels, n = labels.length, reihen = werte.map(({ q, v }) => ({ name: q.name, farbe: q.farbe, v }));
    const summen = labels.map((_, i) => reihen.reduce((a, r) => a + (r.v[i] || 0), 0)), ges = summe(summen);
    const W = gr.w * 160, H = Math.max(90, gr.h * 110 + (gr.h - 1) * 12 - 78), L = 30, R = 6, T = 6, U = 16, hi = Math.max(...summen, 0) * 1.1 || 1;
    const stufe = hi > 200 ? 100 : hi > 40 ? 20 : hi > 12 ? 5 : hi > 4 ? 2 : hi > 1.5 ? .5 : .2, y = v => T + (1 - v / hi) * (H - T - U), bw = (W - L - R) / n, jedes = Math.max(1, Math.ceil(n / (gr.w * 4)));
    const raster = [...Array(Math.floor(hi / stufe) + 1)].map((_, q) => q * stufe).map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="gr"/><text x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" class="ax" text-anchor="end">${de(v, stufe < 1 ? 1 : 0)}</text>`).join('');
    const bars = labels.map((lab, i) => { let unten = 0;
      return reihen.map(r => { const v = r.v[i] || 0; if (!(v > 0)) return ''; const y1 = y(unten + v), y0 = y(unten); unten += v;
        return `<rect x="${(L + i * bw + bw * .12).toFixed(1)}" y="${y1.toFixed(1)}" width="${(bw * .76).toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${r.farbe}" rx="1.5"><title>${esc(String(lab))} · ${esc(r.name)} · ${de(v, 1)} kWh</title></rect>`; }).join('')
        + (i % jedes === 0 ? `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 3}" class="ax" text-anchor="middle">${esc(String(lab))}</text>` : ''); }).join('');
    return `<div class="glas-panel aw-dia">${kopf}
      <svg class="aw-dia-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${raster}${bars}</svg>
      <div class="aw-dia-leg">${reihen.map(r => `<span><i style="background:${r.farbe}"></i>${esc(r.name)}</span>`).join('')}<span class="leise">${de(ges, ges < 100 ? 1 : 0)} kWh · kWh je ${{ Tag: 'Stunde', Woche: 'Tag', Monat: 'Tag', Jahr: 'Monat' }[z]}</span></div></div>`;
  }
  /* ============ WU-0014: Kachel-Katalog – Kacheln S/M/L auf Übersicht ('ue', eigene Liste je Browser) und Auswertung ('aw', im Raster der Bausteine) ============ */
  kkListe(ort) {
    if (ort !== 'ue') return this.awAuswahl();
    if (!this.s.kkUe) { let l = null; try { l = JSON.parse(localStorage.getItem(KK_SPEICHER) || 'null'); } catch (e) { l = null; }
      this.s.kkUe = (Array.isArray(l) ? l.filter(x => x && KK[x.k]) : KK_START).map(x => this.kkGross({ k: x.k, id: x.id, dia: x.dia, ids: x.ids, zr: x.zr, art: x.art, an: true }, x.st)); }
    return this.s.kkUe;
  }
  kkGross(x, st) { const g = awStufen(x.k).find(q => q[0] === st) || awStufe(x.k, x.w || 2, x.h || 1); return { ...x, w: g[1], h: g[2], st: g[0] }; }
  kkMerken(ort) {
    if (ort !== 'ue') return this.awMerken();
    try { localStorage.setItem(KK_SPEICHER, JSON.stringify(this.s.kkUe.map(({ k, id, dia, st, ids, zr, art }) => ({ k, id, dia, st, ids, zr, art })))); } catch (e) { /* egal */ }
  }
  kkName(x) { if (AW_BAUSTEINE[x.k]) return AW_BAUSTEINE[x.k][0];
    if (KK[x.k] && KK[x.k].je === 'v') return `${KK[x.k].name}${(x.ids || []).length ? ` · ${x.ids.map(id => (this.d.bereiche.find(b => b.id === id) || { name: id }).name).join(' / ')}` : ''}`;
    const e = KK[x.k], b = e && e.je ? this.kkB(x) : null; return e ? `${e.name}${b ? ` · ${b.name}` : ''}` : x.k; }
  kkWahlListe(k) { const e = KK[k], B = this.d.bereiche; return !e || !e.je ? [] : e.je === 'p' ? B.filter(b => b.pumpe) : B.filter(b => !b.pumpe && (e.je !== 'f' || b.fuehler)); }
  kkB(x) { const L = this.kkWahlListe(x.k); return L.find(b => b.id === x.id) || L[0] || null; }
  /* Zeitraum und Werte: in der Auswertung der gewählte Zeitraum (auch für Container), auf der Übersicht Baustelle = dieser Monat, Container = heute */
  kkCtx(ort) {
    if (ort === 'aw') { const z = this.s.aw.zeitraum, v = this.zrV('aw'), A = this.awDaten(z, v); return { ort, A, S: (A && A.summen) || {}, z, v, zc: z, vc: v }; }
    const A = this.awDaten('Monat', 0, 'diese'); return { ort, A, S: (A && A.summen) || {}, z: 'Monat', v: 0, zc: 'Tag', vc: 0 };
  }
  kkSumme(c) {   // Verbrauch der Baustelle (bzw. aller laufenden) je Stunde/Tag/Monat – Statistik der Energie-Sensoren
    const L = c.ort === 'aw' && this.s.awScope === 'alle' ? this.laufende() : [this.d], r = L.map(l => this.verbrauch(l, null, c.z, c.v));
    return r.some(x => !x) ? null : addieren(r);
  }
  kkDaten(x, b, c) {
    const d = this.d, S = c.S, A = c.A, p = d.e.preis, f = (v, k = 1) => zahl(v) ? de(v, k) : '–', farbe = b ? BEREICH_FARBEN[b.f % BEREICH_FARBEN.length] : 'var(--s1)';
    const pfeil = dl => zahl(dl) ? `<em class="${dl > 0 ? 'mehr' : 'weniger'}">${dl > 0 ? '▲' : '▼'} ${Math.abs(dl)} %</em>` : '';
    const zr = this.zeitraum(c.z, c.v), zrc = this.zeitraum(c.zc, c.vc), wann = this.zrText(c.z, c.v), wannC = this.zrText(c.zc, c.vc);
    const lab = (z, labels) => z === 'Tag' ? labels.map((h, i) => i % 6 ? '' : h) : z === 'Woche' ? TAGE : labels;
    const heuteNr = TAGE.indexOf(this.z.HEUTE_TAG), soll = b ? this.sollVon(b) : null;
    switch (x.k) {
      case 'b-kosten': { const r = this.kkSumme(c);
        return { zahl: zahl(S.eur) ? de(S.eur, 0) : '–', einh: '€', wo: wann, vgl: `${f(S.kwh, 0)} kWh ${pfeil((S.veraenderung || {}).kwh)} zu ${this.zrVgl(c.z, c.v)}`, funke: r,
          kennz: [['Kosten', `${f(S.eur, 2)} €`], ['Verbrauch', `${f(S.kwh, 0)} kWh`], ['Heizzeit', `${f(S.heizzeit, 0)} h`], ['Pumpzeit', `${f(S.pumpzeit, 1)} h`]],
          dia: id => r ? flaeche(id, [{ name: 'Verbrauch', farbe: 'var(--s1)', v: r }], zr.labels, 'kWh', KK_JEDES[c.z]) : '' }; }
      case 'b-gespart': { const oa = S.ohne_automatik, r = this.kkSumme(c), alle = c.ort === 'aw' && this.s.awScope === 'alle';
        const ohne = alle ? null : this.reihe(d, this.eid(d, d.entry, 'energie_ohne_automatik'), c.z, c.v);
        return { zahl: oa ? de(oa.gespart_eur, 0) : '–', einh: '€', wo: wann, vgl: oa ? `${f(oa.prozent, 0)} % weniger als rund um die Uhr (${f(oa.ohne_eur, 0)} €)` : 'noch keine Werte', funke: r, farbe: 'var(--s3)',
          kennz: [['mit Automatik', `${f(S.eur, 0)} €`], ['ohne (24/7)', `${f(oa && oa.ohne_eur, 0)} €`], ['gespart', `${f(oa && oa.gespart_eur, 0)} €`], ['weniger', `${f(oa && oa.prozent, 0)} %`]],
          dia: id => r ? flaeche(id, [{ name: 'mit Automatik', farbe: 'var(--s1)', v: r }], zr.labels, 'kWh', KK_JEDES[c.z], ohne ? { name: 'ohne Automatik', v: ohne } : null) : '' }; }
      case 'b-hoch': { const h = (A && A.hochrechnung) || {};
        return { zahl: zahl(h.mit_eur) ? `≈ ${de(h.mit_eur, 0)}` : '–', einh: '€', wo: 'bis Ende Heizperiode', vgl: `bisher ${f(h.bisher_eur, 0)} € · ohne Automatik ${f(h.ohne_eur, 0)} €`,
          mini: kkBalken([['bisher', h.bisher_eur, `${f(h.bisher_eur, 0)} €`, 'var(--s3)'], ['mit', h.mit_eur, `${f(h.mit_eur, 0)} €`, 'var(--s1)'], ['ohne', h.ohne_eur, `${f(h.ohne_eur, 0)} €`, 'var(--s2)']]),
          kennz: [['bisher', `${f(h.bisher_kwh, 0)} kWh`], ['mit Automatik', `${f(h.mit_kwh, 0)} kWh`], ['ohne (24/7)', `${f(h.ohne_kwh, 0)} kWh`], ['gespart ≈', `${f(h.gespart_eur, 0)} €`]],
          dia: id => zahl(h.mit_eur) ? balken(id, [h.bisher_eur, h.mit_eur, h.ohne_eur], ['bisher', 'mit', 'ohne'], '€', 0) : '' }; }
      case 'b-wetter': { const W = (A && A.wetter) || {}, g = W.gerade, P = W.punkte || [];
        return { zahl: g && g.k < 0 ? `+${de(-g.k, 1)}` : '–', einh: 'kWh/°C', wo: 'je Grad kälter am Tag', vgl: g ? `≈ ${f(g.eur_je_grad, 2)} € je Grad${zahl(g.null0) ? ` · kaum geheizt ab ${de(g.null0, 0)} °C` : ''}` : 'noch zu wenige Heiztage',
          kennz: [['je Grad kälter', g ? `+${f(-g.k, 1)} kWh` : '–'], ['je Grad', `${f(g && g.eur_je_grad, 2)} €`], ['Heiztage im Vergleich', `${P.length}`], ['kaum geheizt ab', `${f(g && g.null0, 0)} °C`]],
          dia: id => g ? streu(id, P, g.k, g.d0) : '' }; }
      case 'b-strom': { const L = this.last(), an = d.e.staffel && L.A.length;
        return { zahl: an ? de(L.gesamt, 1) : '–', einh: 'kW', wo: an ? `${L.A.length} ${L.A.length === 1 ? 'Anschluss' : 'Anschlüsse'}` : 'Staffelung aus',
          vgl: an ? `von ${de(L.grenze, 1)} kW nutzbar · ${L.laufen} Heizkörper an${L.warten ? ` · ${L.warten} wartet` : ''}` : 'keine Anschlüsse', mini: an ? this.stromBalken(L, true) : '',
          kennz: [['Heizung', `${f(L.heiz, 1)} kW`], ['Pumpen', `${f(L.pumpe, 2)} kW`], ['Sonstiges', `${f(L.sonst, 1)} kW`], ['Reserve', `${f(L.reserve, 1)} kW`]],
          dia: () => an ? `<div class="kk-dia-in">${L.A.map(a => `<div class="kk-dz eins"><span>${esc(a.name)} · ${de(a.heiz + a.pumpe + a.sonst, 1)} von ${de(a.grenze, 1)} kW</span>${this.stromBalken({ ...a, grenze: a.grenze }, true)}</div>`).join('')}</div>` : '', zeilen: true }; }
      case 'b-oel': { const T = (A && A.typ) || {}, er = T.ersparnis, o = T.oelradiator || {}, kv = T.konvektor || {};
        return { zahl: zahl(T.weniger) ? `${T.weniger > 0 ? '−' : '+'}${de(Math.abs(T.weniger), 0)}` : '–', einh: '%', wo: 'Ölradiator gegen Konvektor',
          vgl: er ? `${de(Math.abs(er.erspart_eur), 2)} € ${er.erspart_eur < 0 ? 'mehr' : 'erspart'} · ${wann}` : 'noch nicht vergleichbar', funke: er && er.oel,
          kennz: [['Öl kWh/Gradstunde', f(o.kwh_gradh, 3)], ['Konv. kWh/Gradstunde', f(kv.kwh_gradh, 3)], [er && er.erspart_eur < 0 ? 'mehr' : 'erspart', `${f(er && Math.abs(er.erspart_eur), 2)} €`], ['Aufheizen Öl', `${f(o.auf, 1)} °C/h`]],
          dia: id => er ? flaeche(id, [{ name: 'Ölradiatoren', farbe: 'var(--s1)', v: er.oel }], zr.labels, 'kWh', KK_JEDES[c.z], { name: 'mit Konvektoren', v: er.konvektor }) : '' }; }
      case 'b-geraete': { const Lk = (d.r && d.r.geraete_links) || {}, st = eid => this._hass && this._hass.states[eid];
        const G = d.bereiche.flatMap(bb => bb.geraete.map(g => { const l = Lk[g.schalter] || {}, s = l.signal && st(l.signal); return { bb, g, db: s && zahl(s.state) ? +s.state : null }; }));
        const weg = G.filter(q => q.g.erreichbar === false), mit = G.filter(q => q.g.erreichbar !== false && q.db !== null), schwach = mit.filter(q => sigStufe(q.db) <= 2);
        const schlecht = mit.length ? mit.reduce((m, q) => q.db < m.db ? q : m) : null;
        return { zahl: `${G.length - weg.length}/${G.length}`, einh: '', wo: 'Geräte erreichbar', vgl: `${weg.length} nicht erreichbar${schwach.length ? ` · ${schwach.length} mit schwachem Signal` : ''}`,
          mini: `${schlecht ? `<div class="kk-vgl">schwächstes ${sigHtml(schlecht.db)} ${de(schlecht.db, 0)} dBm · ${esc(schlecht.g.n)}</div>` : ''}${weg.slice(0, 2).map(q => `<div class="kk-vgl rot-t">● ${esc(q.g.n)} · ${esc(q.bb.name)}</div>`).join('')}`,
          kennz: [['erreichbar', `${G.length - weg.length}`], ['nicht erreichbar', `${weg.length}`], ['schwaches Signal', `${schwach.length}`], ['schwächstes', schlecht ? `${de(schlecht.db, 0)} dBm` : '–']],
          dia: () => `<div class="kk-dia-in">${G.slice(0, 8).map(q => `<div class="kk-dz"><span>${esc(q.g.n)}</span><span>${q.g.erreichbar === false ? '<b class="rot-t">nicht erreichbar</b>' : q.db !== null ? `${sigHtml(q.db)} ${de(q.db, 0)} dBm` : 'kein Signalwert'} · ${esc(q.bb.name)}</span></div>`).join('')}${G.length > 8 ? `<div class="kk-vgl">+ ${G.length - 8} weitere</div>` : ''}</div>`, zeilen: true }; }
      case 'b-wer': { const R = (A && A.rangliste) || [], Z = R.map(r => { const bb = d.bereiche.find(q => q.id === r.bereich); return [r.name, r.kwh, `${f(r.kwh, 0)} kWh`, bb ? BEREICH_FARBEN[bb.f % BEREICH_FARBEN.length] : 'var(--ink2)']; });
        return { zahl: R[0] ? de(R[0].kwh, 0) : '–', einh: 'kWh', unter: R[0] ? esc(R[0].name) : '', wo: wann, vgl: R[0] ? `${esc(R[0].name)} vorne · ${f(R[0].eur, 2)} €` : 'noch kein Verbrauch',
          mini: kkBalken(Z, 3), kennz: R.slice(0, 4).map(r => [r.name, `${f(r.kwh, 0)} kWh · ${f(r.eur, 0)} €`]), dia: () => `<div class="kk-dia-in">${kkBalken(Z, 7)}</div>`, zeilen: true }; }
      case 'c-temp': { const st = this.statistik('Tag'), inn = st && (st.werte[b.fuehler] || []), aus = st && (st.werte[this.eid(d, d.entry, 'aussen')] || []), [, , wtemp] = this.wetterJetzt();
        return { zahl: f(b.t), einh: '°C', wo: 'jetzt', vgl: `Soll ${f(soll, 0)} °C · außen ${f(wtemp)} °C`, funke: inn, farbe,
          kennz: [['innen jetzt', `${f(b.t)} °C`], ['Soll', `${f(soll, 0)} °C`], ['außen jetzt', `${f(wtemp)} °C`], ['Zustand', esc(TEXT(b))]],
          dia: id => inn ? linie(id, [{ name: 'Innen', v: [...inn, null] }, { name: 'Außen', v: [...(aus || []), null] }], '°C') : '' }; }
      case 'c-leistung': { const r = this.verbrauch(d, b.id, 'Tag'), an = b.geraete.filter(g => g.an).length;   // kWh je Stunde = mittlere kW
        return { zahl: de(kwVon(b), 2), einh: 'kW', wo: 'jetzt', vgl: `${an} von ${b.geraete.length} Geräten an`, funke: r && r.slice(0, +this.z.JETZT.slice(0, 2) + 1), farbe,
          kennz: [['jetzt', `${de(kwVon(b), 2)} kW`], ['Geräte an', `${an}/${b.geraete.length}`], ['heute', `${f(r && summe(r))} kWh`], ['Zustand', esc(TEXT(b))]],
          dia: id => r ? flaeche(id, [{ name: b.name, farbe, v: r }], STUNDEN, 'kW', 6) : '' }; }
      case 'c-verbrauch': case 'c-kosten': { const eur = x.k === 'c-kosten', fk = eur ? p : 1, r = this.verbrauch(d, b.id, c.zc, c.vc), g = this.verbrauch(d, b.id, c.zc, c.vc + 1);
        const su = r && summe(r), sg = g && summe(g), e1 = eur ? '€' : 'kWh', k1 = eur ? 2 : 1;
        return { zahl: f(zahl(su) ? su * fk : null, k1), einh: e1, wo: wannC, vgl: eur ? `${f(su)} kWh × ${de(p, 2)} €/kWh` : `${this.zrVgl(c.zc, c.vc)} ${f(sg)} kWh`, funke: r && r.map(v => (v || 0) * fk), farbe,
          kennz: eur ? [[wannC, `${f(zahl(su) ? su * p : null, 2)} €`], ['kWh', f(su)], ['Strompreis', `${de(p, 2)} €/kWh`], [this.zrVgl(c.zc, c.vc), `${f(zahl(sg) ? sg * p : null, 2)} €`]]
            : [[wannC, `${f(su)} kWh`], [this.zrVgl(c.zc, c.vc), `${f(sg)} kWh`], ['Kosten', `${f(zahl(su) ? su * p : null, 2)} €`], ['Heizzeit', (h => h ? stdMin(summe(h)) : '–')(this.heizStunden(d, b, c.zc, c.vc))]],
          dia: id => r ? balken(id, r.map(v => (v || 0) * fk), lab(c.zc, zrc.labels), e1, eur ? 2 : 1) : '' }; }
      case 'c-heizzeit': { const r = this.heizStunden(d, b, c.zc, c.vc), rs = this.reihe(d, this.eid(d, b.id, 'heizzeit_strom'), c.zc, c.vc), su = r && summe(r), ss = rs && rs.some(zahl) ? summe(rs.map(v => v || 0)) : null;
        return { zahl: stdMin(su), einh: '', wo: wannC, vgl: zahl(ss) ? `tatsächlich geheizt ${stdMin(ss)}` : esc(this.heuteText(b)), funke: r, farbe,
          kennz: [['eingeschaltet', stdMin(su)], ['tatsächlich geheizt', stdMin(ss)], ['% davon mit Strom', zahl(ss) && su > 0 ? `${de(ss / su * 100, 0)} %` : '–'], ['Plan heute', esc(this.heuteText(b)).replace(/^Heizzeit /, '')]],
          dia: id => r ? balken(id, r, lab(c.zc, zrc.labels), 'h') : '' }; }
      case 'c-ohne': { const o = b.geraete.some(g => g.heizer) ? this._holen(`oh:${d.entry}:${b.id}:${c.zc}:${c.vc}:geraet`, () => this._hass.callWS({ type: 'baustelle/ohne', entry_id: d.entry, bereich: b.id, zeitraum: c.zc, versatz: c.vc, basis: 'geraet' })) : null;
        const e = o && o.ergebnis, r = this.verbrauch(d, b.id, c.zc, c.vc);
        return { zahl: e ? de(e.gespart_eur, 2) : '–', einh: '€', wo: wannC, vgl: !o ? (o === null ? 'kein Heizkörper' : 'lädt …') : e ? `gespart · ${f(e.prozent, 0)} % weniger als 24/7` : 'noch keine Werte', farbe: 'var(--s3)', funke: r,
          kennz: [['mit Automatik', `${f(o && o.kwh)} kWh`], ['ohne (24/7)', `${f(o && o.ohne_kwh)} kWh`], ['gespart', `${f(e && e.gespart_eur, 2)} €`], ['Heizkörper', `${f(o && o.kw, 2)} kW`]],
          dia: id => r && o && o.reihe ? flaeche(id, [{ name: 'mit Automatik', farbe, v: r }], zrc.labels, 'kWh', KK_JEDES[c.zc], { name: 'ohne Automatik', v: o.reihe }) : '' }; }
      case 'c-warm': { const w = b.lern && b.lern.warm, pl = w && w.plan;
        const seg = pl ? [[pl.start, pl.ziel, 'vor'], [pl.a, pl.b, 'heiz']] : [];
        return { zahl: pl ? uhr(pl.start) : '–', einh: pl ? 'Uhr' : '', wo: 'heizt heute ab',
          vgl: !w ? 'nur lernend im Modus Thermostat' : !pl ? 'heute frei' : w.gelernt ? `${f(w.soll, 0)} °C um ${uhr(pl.ziel)} · ${f(w.rate, 1)} °C/h gelernt` : `lernt noch (${w.n} von ${w.n_noetig})`,
          mini: pl ? `${this.zeitstrahlSeg(seg, true)}<div class="kk-vgl">${uhr(pl.start)} → ${uhr(pl.ziel)}${zahl(w.aufheiz_min) ? ` · ${de(w.aufheiz_min, 0)} min` : ''}</div>` : '',
          kennz: [['heizt ab', pl ? uhr(pl.start) : '–'], ['warm um', pl ? uhr(pl.ziel) : '–'], ['Aufheizen', w && zahl(w.rate) ? `${de(w.rate, 1)} °C/h` : '–'], ['Aufheizdauer', w && zahl(w.aufheiz_min) ? `${de(w.aufheiz_min, 0)} min` : '–']],
          dia: () => pl ? `<div class="kk-dia-in"><div class="kk-dz"><span>heute</span>${this.zeitstrahlSeg(seg, true)}</div><div class="kk-vgl">${this.warmText(b)}</div></div>` : '', zeilen: true }; }
      case 'p-pumpzeit': { const r = this.heizStunden(d, b, c.zc, c.vc), zy = this.zyklen(d, b, c.zc, c.vc), su = r && summe(r);
        return { zahl: stdMin(su), einh: '', wo: wannC, vgl: `${zy ? summe(zy) : '–'} Zyklen · ${b.geraete.filter(g => g.an).length} läuft jetzt`, funke: r, farbe: 'var(--blau)',
          kennz: [[wannC, stdMin(su)], ['Zyklen', `${zy ? summe(zy) : '–'}`], ['Pumpen', `${b.geraete.filter(g => g.rolle === 'pumpe').length}`], ['läuft jetzt', `${b.geraete.filter(g => g.an).length}`]],
          dia: id => r ? balken(id, r, lab(c.zc, zrc.labels), 'h') : '' }; }
      case 'p-zyklen': { const zy = this.zyklen(d, b, c.zc, c.vc), zv = this.zyklen(d, b, c.zc, c.vc + 1), w = this.zyklen(d, b, 'Woche');
        return { zahl: zy ? `${summe(zy)}` : '–', einh: 'Zyklen', wo: wannC, vgl: zv ? `${this.zrVgl(c.zc, c.vc)} ${summe(zv)}` : '', funke: w && w.slice(0, heuteNr + 1), farbe: 'var(--blau)',
          kennz: [[wannC, `${zy ? summe(zy) : '–'}`], [this.zrVgl(c.zc, c.vc), `${zv ? summe(zv) : '–'}`], ['diese Woche', `${w ? summe(w) : '–'}`], ['heute', `${w ? w[heuteNr] : '–'}`]],
          dia: id => zy ? balken(id, zy, lab(c.zc, zrc.labels), 'Zyklen', 0) : '' }; }
      case 'h-plan': { const pl = this.planTag(this.z.HEUTE_TAG);
        return { zahl: pl ? `${uhr(pl.vor)}–${uhr(pl.ende)}` : 'frei', einh: '', wo: 'heute', vgl: esc(this.statusText()) + (pl && pl.gruende && pl.gruende.length ? ` · ${esc(pl.gruende[0])}` : ''),
          mini: `${this.zeitstrahl(pl, true)}<div class="tl-achse"><span>4</span><span>12</span><span>20</span></div>`,
          kennz: [['Vorheizen ab', pl ? uhr(pl.vor) : '–'], ['Arbeitszeit', pl ? `${uhr(pl.a)}–${uhr(pl.b)}` : '–'], ['Nachheizen bis', pl ? uhr(pl.nach) : '–'], ['Trocknen bis', pl && pl.ende > pl.nach ? uhr(pl.ende) : '–']],
          dia: () => `<div class="kk-dia-in">${this.z.WOCHE.map(([t, dt]) => `<div class="kk-dz ${t === this.z.HEUTE_TAG ? 'heute' : ''}"><span>${t} ${dt.slice(0, 2)}.</span>${this.zeitstrahl(this.planTag(t), t === this.z.HEUTE_TAG)}</div>`).join('')}</div>`, zeilen: true }; }
      case 'h-wann': { const C = d.bereiche.filter(bb => !bb.pumpe), Z = C.map(bb => ({ bb, seg: this.heizzeiten(bb, this.z.HEUTE_TAG) })), mit = Z.filter(q => q.seg.length);
        const von = mit.length ? Math.min(...mit.map(q => q.seg[0][0])) : null, bis = mit.length ? Math.max(...mit.flatMap(q => q.seg.map(s => s[1]))) : null;
        return { zahl: `${mit.length}`, einh: `von ${C.length}`, wo: 'Container heizen heute', vgl: mit.length ? `erster ab ${uhr(von)} · letzter bis ${uhr(bis)}` : 'heute keine Heizzeit',
          mini: mit.slice(0, 3).map(q => `<div class="kk-dz schmal"><span>${esc(q.bb.name)}</span>${this.zeitstrahlSeg(q.seg, true)}</div>`).join(''),
          kennz: [['heizen heute', `${mit.length} von ${C.length}`], ['erster ab', zahl(von) ? uhr(von) : '–'], ['letzter bis', zahl(bis) ? uhr(bis) : '–'], ['heizen jetzt', `${C.filter(bb => bb.z === 'heizt' || bb.z === 'trocknen').length}`]],
          dia: () => `<div class="kk-dia-in">${Z.slice(0, 7).map(q => `<div class="kk-dz"><span>${esc(q.bb.name)}</span>${this.zeitstrahlSeg(q.seg, true)}</div>`).join('')}</div>`, zeilen: true }; }
    }
    return null;
  }
  /* eine Kachel in S / M / L (L mit Diagramm oder vier Kennzahlen); ort 'kat' = Vorschau im Katalog */
  kkKachel(x, i, ort, c) {
    if (KK[x.k] && KK[x.k].je === 'v') return this.vgKachel(x, i, ort, c);   // WU-0017
    if (x.k === 'b-preis') return this.spKachel(x, i, ort, c);
    const e = KK[x.k], b = e.je ? this.kkB(x) : null, gr = x.st, kopf = `<div class="kk-kopf"><span class="kk-ic">${e.ic}</span><small>${esc(e.name)}</small></div>`;
    if (e.je && !b) return `<div class="glas-panel kk">${kopf}<span class="kk-wo">kein ${e.je === 'p' ? 'Schacht' : 'Container'} vorhanden</span></div>`;
    const D = this.kkDaten(x, b, c), mitDia = gr === 'L' && x.dia !== false;
    const wo = `<span class="kk-wo">${esc(b ? b.name : D.wo || '')}</span>`, zahlH = `<b class="kk-zahl">${D.zahl}${D.einh ? `<small> ${D.einh}</small>` : ''}</b>`;
    let inhalt;
    if (gr === 'S') inhalt = `${kopf}${zahlH}${!b && D.unter ? `<span class="kk-wo">${D.unter}</span>` : wo}`;
    else if (gr === 'M') inhalt = `<div class="kk-m-l">${kopf}${zahlH}<span class="kk-vgl">${D.vgl || ''}</span>${b ? wo : ''}</div><div class="kk-m-r">${D.mini || funke(D.funke, D.farbe) || `<span class="kk-wo">${esc(b ? D.wo || '' : '')}</span>`}</div>`;
    else {
      const dia = mitDia ? D.dia(`kk-${ort}-${i}-${x.k}-${b ? b.id : 'b'}-${c.zc}${c.vc}`) : '';
      inhalt = `${kopf}<div class="kk-l-zeile">${zahlH}${wo}</div><span class="kk-vgl">${D.vgl || ''}</span>`
        + (mitDia ? `<div class="kk-dia ${D.zeilen ? 'zeilen' : ''}">${dia || '<div class="leer">Noch keine Werte</div>'}</div>`
          : `<div class="kk-kennz">${(D.kennz || []).map(([k, v]) => `<div><b>${v}</b><span>${esc(k)}</span></div>`).join('')}</div>`);
    }
    const tip = `${esc(this.kkName(x))} – antippen öffnet die Ansicht`;
    return ort === 'kat' ? `<div class="glas-panel kk kk-${gr}">${inhalt}</div>`
      : `<div class="glas-panel kk kk-${gr}" role="button" tabindex="0" data-act="kk-auf" data-ort="${ort}" data-i="${i}" title="${tip}">${inhalt}</div>`;
  }
  /* Raster mit Layout (ziehen, Größe, ✕, 📈) – Auswertung und Übersicht gleich */
  kkRaster(ort, teile, layout) {
    return `<div class="aw-raster ${layout ? 'layout' : ''}" data-ort="${ort}">${teile.map(({ x, i, html }) => `<div class="aw-frei-s ${this.s.kkFrisch === `${ort}:${x.k}:${x.id || ''}` ? 'kk-frisch' : ''}" data-i="${i}" style="--w:${x.w};--h:${x.h}"><div class="aw-inhalt">${html}</div>
        ${layout ? `<div class="aw-ueber"><span class="aw-griff" data-zug="move" title="verschieben">⠿</span><span class="aw-name">${esc(this.kkName(x))} · <b class="aw-mass">${x.st}</b></span>
          ${KK[x.k] && x.st === 'L' ? `<button class="aw-dia-k ${x.dia !== false ? 'on' : ''}" data-act="kk-dia" data-ort="${ort}" data-i="${i}" title="mit oder ohne Diagramm" aria-label="Diagramm ein/aus">📈</button>` : ''}
          ${KK[x.k] && KK[x.k].je === 'v' && x.st === 'L' && x.dia !== false ? `<button class="aw-dia-k aw-art-k on" data-act="vg-art-k" data-ort="${ort}" data-i="${i}" title="Balken oder Linien" aria-label="Balken oder Linien">${x.art === 'linien' ? '〰' : '▮▮'}</button>` : ''}
          <button class="aw-x" data-act="aw-weg" data-ort="${ort}" data-i="${i}" aria-label="${KK[x.k] ? 'entfernen' : 'ausblenden'}">✕</button><span class="aw-groesse" data-zug="size" title="Größe ändern">◢</span></div>` : ''}</div>`).join('')}
      ${layout ? '' : `<button class="glas-panel kk-neu-k" data-act="kk-plus" data-ort="${ort}"><span>+</span>Kachel</button>`}</div>`;
  }
  kkBereich() {
    const L = this.kkListe('ue'), layout = this.s.kkLayout, c = this.kkCtx('ue');
    const teile = L.map((x, i) => ({ x, i, html: this.kkKachel(x, i, 'ue', c) }));
    return `<div class="kk-bereich"><div class="kk-titel"><b>Meine Kacheln</b>
        <span class="kk-knoepfe">${L.length ? `<button class="glas-panel chip ${layout ? 'amber' : ''}" data-act="kk-layout">${layout ? '✓ Fertig' : '✥ Anpassen'}</button>` : ''}<button class="glas-panel chip kk-plus" data-act="kk-plus" data-ort="ue">＋ Kachel</button></span></div>
      ${layout ? '<div class="leise aw-hinweis">Kachel am Griff ⠿ ziehen zum Verschieben · am Griff ◢ ziehen für die Größe · 📈 Diagramm der großen Kachel ein/aus · ✕ entfernen</div>' : ''}
      ${this.kkRaster('ue', teile, layout)}</div>`;
  }
  /* Katalog (Einblendung): Suche mit Filter-Chips, Schnellknöpfe S/M/L, Auswahl mit Vorschau */
  kkEintraege(ort) {
    const E = Object.entries(KK).filter(([k, e]) => !e.je || this.kkWahlListe(k).length).map(([k, e]) => ({ k, ...e, stufen: ST_KACHEL }));
    if (ort !== 'aw') return E;
    return [...E, ...Object.entries(AW_BAUSTEINE).filter(([k]) => !k.startsWith('k-')).map(([k, [name, text]]) => ({ k, ber: 'auswertung', ic: '📊', name, text, such: '', stufen: awStufen(k), baustein: true }))];
  }
  kkTreffer(s) {
    const q = (s.q || '').toLowerCase().split(/\s+/).filter(Boolean), bt = k => (KK_BEREICHE.find(x => x[0] === k) || [])[1] || '';
    const markiere = t => { let h = esc(t); for (const w of q.filter(x => x.length > 1)) h = h.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'); return h; };
    const L = this.kkEintraege(s.ort).filter(e => ((s.f || 'alle') === 'alle' || e.ber === s.f) && (!s.nurJe || e.je) && (!s.nurEur || /euro/.test(`${e.such} ${e.name} ${e.text}`.toLowerCase()))
      && q.every(w => `${e.name} ${e.text} ${e.such} ${bt(e.ber)}`.toLowerCase().includes(w)));
    if (!L.length) return '<div class="kk-tr-leer">Keine Kachel gefunden – anderes Wort oder Filter „Alle“.</div>';
    return `<div class="leise">${L.length} ${L.length === 1 ? 'Kachel' : 'Kacheln'}</div>` + L.map(e => { const on = s.k === e.k;
      return `<div class="kk-tr-zeile ${on ? 'on' : ''}" data-act="kk-k" data-k="${e.k}" role="button" tabindex="0"><span class="kk-z-ic">${e.ic}</span><div class="kk-z-t"><b>${markiere(e.name)}</b><div class="leise">${bt(e.ber)} · ${markiere(e.text)}</div></div>
        <span class="kk-tr-gr">${e.stufen.map(([g]) => `<button data-act="kk-gk" data-k="${e.k}" data-v="${g}" class="${on && s.st === g ? 'on' : ''}">${g}</button>`).join('')}</span></div>${on ? this.kkWahl(s, e) : ''}`; }).join('');
  }
  kkWahl(s, e) {
    if (e.je === 'v') return this.vgWahl(s, e);   // WU-0017
    const opts = e.je ? this.kkWahlListe(e.k) : [], ort = s.ort === 'aw' ? 'Auswertung' : 'Übersicht';
    if (e.je && !opts.some(b => b.id === s.id)) s.id = opts[0] && opts[0].id;
    if (!e.stufen.some(q => q[0] === s.st)) s.st = (e.stufen.find(q => q[0] === 'M') || e.stufen[0])[0];
    if (e.baustein) { const x = this.awAuswahl().find(y => y.k === e.k);
      return `<div class="kk-wahl"><div class="gruppe-t">Größe</div><div class="seg">${e.stufen.map(([g, w, h]) => `<button data-act="kk-gr" data-v="${g}" class="${s.st === g ? 'on' : ''}">${g} · ${w}×${h}</button>`).join('')}</div>
        ${x && x.an ? '<div class="leise">ist schon in der Auswertung – „Hinzufügen“ stellt nur die Größe um</div>' : ''}<button class="knopf amber" data-act="kk-hinzu">Zur Auswertung hinzufügen</button></div>`; }
    const c = this.kkCtx(s.ort);
    return `<div class="kk-wahl">
      ${e.je ? `<div class="gruppe-t">${e.je === 'p' ? 'Schacht' : 'Container'}${e.je === 'f' ? ' · nur mit Fühler' : ''}</div><div class="vb-wer">${opts.map(b => `<button data-act="kk-id" data-id="${b.id}" class="${b.id === s.id ? 'on' : ''}"><i style="background:${BEREICH_FARBEN[b.f % BEREICH_FARBEN.length]}"></i>${esc(b.name)}</button>`).join('')}</div>` : ''}
      <div class="gruppe-t">Größe</div><div class="seg">${KK_GROESSE.map(([g, t, m]) => `<button data-act="kk-gr" data-v="${g}" class="${s.st === g ? 'on' : ''}">${t} · ${m}</button>`).join('')}</div>
      <div class="leise">${{ S: 'Symbol und eine Zahl', M: 'Zahl, Vergleich und Mini-Verlauf', L: s.dia ? 'mit Diagramm' : 'vier Kennzahlen statt Diagramm' }[s.st]}</div>
      ${s.st === 'L' ? `<div class="zeile kk-sw"><div><span>mit Diagramm</span><div class="leise">aus: vier Kennzahlen statt Diagramm</div></div>${schalter(s.dia, 'kk-dia-w')}</div>` : ''}
      <div class="gruppe-t">Vorschau</div><div class="aw-raster kk-vorschau"><div class="aw-frei-s" style="--w:${s.st === 'S' ? 1 : 2};--h:${s.st === 'L' ? 2 : 1}"><div class="aw-inhalt">${this.kkKachel({ k: e.k, id: s.id, st: s.st, dia: s.dia }, 0, 'kat', c)}</div></div></div>
      <button class="knopf amber" data-act="kk-hinzu">Zur ${ort} hinzufügen</button></div>`;
  }
  kkKatalog(s, griff) {
    return `${griff}<div class="kk-kat kk-such"><h3>＋ Kachel · ${s.ort === 'aw' ? 'Auswertung' : 'Übersicht'}</h3>
      <input type="search" data-kk="q" placeholder="Suchen – z. B. Kosten, Temperatur, Pumpe" value="${esc(s.q || '')}" autocomplete="off">
      <div class="kk-chips">${[['alle', 'Alle'], ...KK_BEREICHE.filter(([k]) => k !== 'auswertung' || s.ort === 'aw')].map(([k, t]) => `<button class="kk-chip ${(s.f || 'alle') === k ? 'on' : ''}" data-act="kk-f" data-v="${k}">${t}</button>`).join('')}
        <button class="kk-chip ${s.nurJe ? 'on' : ''}" data-act="kk-nurje">je Container</button><button class="kk-chip ${s.nurEur ? 'on' : ''}" data-act="kk-nureur">€</button></div>
      <div class="kk-treffer">${this.kkTreffer(s)}</div>
      ${s.ort === 'aw' ? `<details class="kk-vorlagen"><summary>Vorlage laden</summary><div class="aw-vorlagen-k">${Object.entries(AW_VORLAGEN).map(([k, [t]]) => `<button class="glas-panel chip" data-act="aw-vorlage" data-v="${k}">${t}</button>`).join('')}</div></details>` : ''}
      <button class="knopf" data-act="zu">Schließen</button></div>`;
  }
  kkHinzu(s) {
    const e = this.kkEintraege(s.ort).find(y => y.k === s.k); if (!e) return;
    const L = this.kkListe(s.ort);
    if (e.baustein) { const x = L.find(y => y.k === e.k); Object.assign(x, this.kkGross(x, s.st), { an: true }); }
    else if (e.je === 'v') L.push(this.kkGross({ k: e.k, an: true, ids: [...s.ids], zr: s.zr, art: s.art || 'balken', ...(s.st === 'L' ? { dia: !!s.dia } : {}) }, s.st));   // WU-0017
    else L.push(this.kkGross({ k: e.k, an: true, ...(e.je ? { id: s.id } : {}), ...(s.st === 'L' ? { dia: !!s.dia } : {}) }, s.st));
    this.kkMerken(s.ort);
    const neu = { k: e.k, id: e.je && e.je !== 'v' ? s.id : undefined, ids: e.je === 'v' ? s.ids : undefined };
    this.s.kkFrisch = `${s.ort}:${neu.k}:${neu.id || ''}`; clearTimeout(this._kkFrisch); this._kkFrisch = setTimeout(() => { this.s.kkFrisch = null; }, 2000);
    this.s.sheet = null; this.s.kkLayout = false; this.s.awLayout = false; this.s.awBearb = false; this.neuZeichnen();
    this.toast(`Kachel „${this.kkName(neu)}“ (${s.st}) hinzugefügt`);
  }
  /* WU-0017: Vergleich kWh / Kosten – 2 bis 4 Container gegenüber (Mockup vergleich-kacheln.html, abgenommen 02.10.2026):
     Summen aus der Statistik wie die anderen Container-Kacheln; Unterschied in kWh bzw. € und % zum sparsamsten */
  vgWerte(x, c) {
    const d = this.d, z = c.ort === 'aw' ? c.zc : (x.zr || 'Tag'), v = c.ort === 'aw' ? c.vc : 0, eur = x.k === 'v-eur', f = eur ? d.e.preis : 1;
    const R = (x.ids || []).map(id => d.bereiche.find(b => b.id === id)).filter(Boolean).map(b => {
      const r = this.verbrauch(d, b.id, z, v), h = this.heizStunden(d, b, z, v);
      return { b, r: r && r.map(q => (q || 0) * f), su: r ? summe(r) * f : null, kwh: r ? summe(r) : null, h: h ? summe(h) : null }; });
    const ok = R.filter(q => zahl(q.su)), min = ok.length ? Math.min(...ok.map(q => q.su)) : null, max = ok.length ? Math.max(...ok.map(q => q.su)) : null;
    return { z, v, eur, R, zr: this.zeitraum(z, v), wann: this.zrText(z, v), min, vorne: ok.find(q => q.su === max), hinten: ok.find(q => q.su === min) };
  }
  vgDia(W0, art) {
    const R = W0.R.filter(q => q.r); if (!R.length) return '';
    const n = W0.zr.labels.length, W = 320, H = 150, L = 34, Rr = 8, T = 8, U = 18, hi = Math.max(...R.flatMap(q => q.r), 0.01) * 1.1;
    const y = v => T + (1 - v / hi) * (H - T - U), bw = (W - L - Rr) / n, jedes = { Tag: 6, Woche: 1, Monat: 7 }[W0.z] || 3, fb = b => BEREICH_FARBEN[b.f % BEREICH_FARBEN.length];
    const stufe = hi > 200 ? 100 : hi > 40 ? 20 : hi > 12 ? 5 : hi > 4 ? 2 : hi > 1.5 ? .5 : .2;
    const raster = [...Array(Math.floor(hi / stufe) + 1)].map((_, q) => q * stufe).map(v => `<line class="gr" x1="${L}" x2="${W - Rr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ax" x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${de(v, stufe < 1 ? 1 : 0)}</text>`).join('');
    const achse = W0.zr.labels.map((t, i) => i % jedes ? '' : `<text class="ax" x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${esc(String(t))}</text>`).join('');
    const inhalt = art === 'linien'
      ? R.map(q => `<path d="${q.r.map((v, i) => `${i ? 'L' : 'M'}${(L + i * bw + bw / 2).toFixed(1)} ${y(v).toFixed(1)}`).join('')}" fill="none" stroke="${fb(q.b)}" stroke-width="2.2" stroke-linejoin="round"/>`).join('')
      : W0.zr.labels.map((_, i) => R.map((q, k) => { const w = bw * .8 / R.length, xx = L + i * bw + bw * .1 + k * w, v = q.r[i] || 0;
        return v > 0 ? `<rect x="${xx.toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(1, w - .5).toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" fill="${fb(q.b)}" rx="1"/>` : ''; }).join('')).join('');
    return `<svg class="vg-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${raster}${achse}${inhalt}</svg>`;
  }
  vgKachel(x, i, ort, c) {
    const e = KK[x.k], W0 = this.vgWerte(x, c), R = W0.R, gr = x.st, eur = W0.eur, fb = b => BEREICH_FARBEN[b.f % BEREICH_FARBEN.length];
    const wert = v => zahl(v) ? (eur ? `${de(v, 2)} €` : `${de(v, v < 100 ? 1 : 0)} kWh`) : '–';
    const kopf = `<div class="kk-kopf"><span class="kk-ic">${e.ic}</span><small>${esc(e.name)}</small></div>`;
    const { vorne, hinten, min } = W0, diff = vorne && hinten && vorne !== hinten ? vorne.su - hinten.su : null;
    const unter = diff === null ? (R.length ? 'gleich viel' : 'keine Container') : `${esc(vorne.b.name)} <b>+${wert(diff)}</b>${min > 0 ? ` (+${de((vorne.su / min - 1) * 100, 0)} %)` : ''} zu ${esc(hinten.b.name)}`;
    const zeilen = `<div class="vg-zeilen">${R.map(q => `<div><span><i style="background:${fb(q.b)}"></i>${esc(q.b.name)}</span><b>${wert(q.su)}</b></div>`).join('')}</div>`;
    let inhalt;
    if (gr === 'S') inhalt = kopf + zeilen;
    else if (gr === 'M') inhalt = `<div class="kk-m-l">${kopf}<span class="kk-wo">${esc(W0.wann)}</span><span class="kk-vgl">${unter}</span></div><div class="kk-m-r">${kkBalken(R.map(q => [q.b.name, q.su || 0, wert(q.su), fb(q.b)]))}</div>`;
    else inhalt = `${kopf}<div class="kk-l-zeile"><span class="kk-wo">${esc(W0.wann)}</span></div><span class="kk-vgl">${unter}</span>`
      + (x.dia !== false ? `<div class="kk-dia">${this.vgDia(W0, x.art) || '<div class="leer">Noch keine Werte</div>'}</div>${zeilen}`
        : `<table class="vg-tab"><tr><th></th><th>kWh</th><th>€</th><th>mehr</th><th>Heizzeit</th><th>kWh/h</th></tr>${R.map(q => `<tr><td><i style="background:${fb(q.b)}"></i>${esc(q.b.name)}</td>
          <td>${zahl(q.kwh) ? de(q.kwh, 1) : '–'}</td><td>${zahl(q.kwh) ? de(q.kwh * this.d.e.preis, 2) : '–'}</td><td>${zahl(q.su) && zahl(min) && q.su > min ? `+${wert(q.su - min)}` : '–'}</td><td>${stdMin(q.h)}</td><td>${q.h > 0 ? de(q.kwh / q.h, 2) : '–'}</td></tr>`).join('')}</table>`);
    return ort === 'kat' ? `<div class="glas-panel kk kk-${gr}">${inhalt}</div>`
      : `<div class="glas-panel kk kk-${gr}" role="button" tabindex="0" data-act="kk-auf" data-ort="${ort}" data-i="${i}" title="${esc(this.kkName(x))} – antippen öffnet den Verbrauch">${inhalt}</div>`;
  }
  vgWahl(s, e) {
    const B = this.d.bereiche.filter(b => !b.pumpe), ort = s.ort === 'aw' ? 'Auswertung' : 'Übersicht';
    s.ids = (s.ids || B.slice(0, 2).map(b => b.id)).filter(id => B.some(b => b.id === id)); s.zr ||= 'Tag'; s.art ||= 'balken';
    if (!['S', 'M', 'L'].includes(s.st)) s.st = 'M';
    return `<div class="kk-wahl"><div class="gruppe-t">Container · 2 bis 4 wählen</div><div class="vb-wer vg-chips">${B.map(b => `<button data-act="vg-id" data-id="${b.id}" class="${s.ids.includes(b.id) ? 'on' : ''}"><i style="background:${BEREICH_FARBEN[b.f % BEREICH_FARBEN.length]}"></i>${esc(b.name)}</button>`).join('')}</div>
      ${s.ort === 'aw' ? '<div class="leise">Zeitraum: der gewählte der Auswertung</div>' : `<div class="gruppe-t">Zeitraum</div><div class="seg">${[['Tag', 'heute'], ['Woche', 'diese Woche'], ['Monat', 'dieser Monat']].map(([k, t]) => `<button data-act="vg-zr" data-v="${k}" class="${s.zr === k ? 'on' : ''}">${t}</button>`).join('')}</div>`}
      <div class="gruppe-t">Größe</div><div class="seg">${KK_GROESSE.map(([g, t, m]) => `<button data-act="kk-gr" data-v="${g}" class="${s.st === g ? 'on' : ''}">${t} · ${m}</button>`).join('')}</div>
      ${s.st === 'L' ? `<div class="zeile kk-sw"><div><span>mit Diagramm</span><div class="leise">aus: Tabelle kWh, €, mehr als der sparsamste, Heizzeit, kWh je Stunde</div></div>${schalter(s.dia, 'kk-dia-w')}</div>
        ${s.dia ? `<div class="seg">${[['balken', '▮▮ Balken'], ['linien', '〰 Linien']].map(([k, t]) => `<button data-act="vg-art" data-v="${k}" class="${s.art === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}` : ''}
      <div class="gruppe-t">Vorschau</div><div class="aw-raster kk-vorschau"><div class="aw-frei-s" style="--w:${s.st === 'S' ? 1 : 2};--h:${s.st === 'L' ? 2 : 1}"><div class="aw-inhalt">${this.vgKachel({ k: e.k, ids: s.ids, zr: s.zr, st: s.st, dia: s.dia, art: s.art }, 0, 'kat', this.kkCtx(s.ort))}</div></div></div>
      <button class="knopf amber" data-act="kk-hinzu" ${s.ids.length < 2 ? 'disabled' : ''}>Zur ${ort} hinzufügen</button></div>`;
  }
  /* Antippen: die passende vorhandene Ansicht oder Einblendung der Seite */
  kkAuf(x, ort) {
    const S = this.s, c = this.kkCtx(ort), e = KK[x.k], b = e && e.je && e.je !== 'v' ? this.kkB(x) : null;
    if (e && e.je === 'v') { S.sheet = { art: 'verbrauch', t: x.k === 'v-eur' ? 'eur' : undefined, auswahl: [...(x.ids || [])], zeitraum: ort === 'aw' ? c.zc : x.zr || 'Tag', v: ort === 'aw' ? c.vc : 0 }; return this.neuZeichnen(); }   // WU-0017
    const blatt = (art, extra = {}) => { S.sheet = { art, auswahl: b ? [b.id] : [], zeitraum: c.zc, v: c.vc, ...extra }; this.neuZeichnen(); };
    const detail = k => { if (S.view !== 'auswertung') this.gehe('auswertung'); S.sheet = { art: 'aw-detail', k }; this.neuZeichnen(); };
    switch (x.k) {
      case 'b-kosten': S.sheet = { art: 'verbrauch', t: 'eur', auswahl: [], zeitraum: c.z, v: c.v }; return this.neuZeichnen();
      case 'b-gespart': return detail('ohne');
      case 'b-hoch': return detail('hochrechnung');
      case 'b-wetter': return detail('wetter');
      case 'b-oel': return detail('vergleich');
      case 'b-wer': return detail('rangliste');
      case 'b-strom': S.sheet = { art: 'strom' }; return this.neuZeichnen();
      case 'b-preis': S.awSim = true; return this.gehe('auswertung');   // Auswertung mit dem simulierten Preis
      case 'b-geraete': S.evGruppe = 'geraete'; return this.gehe('einst');
      case 'c-leistung': return blatt('leistung', { zeitraum: 'Tag', v: 0 });
      case 'c-verbrauch': case 'c-ohne': return blatt('verbrauch');
      case 'c-kosten': return blatt('verbrauch', { t: 'eur' });
      case 'c-heizzeit': case 'p-pumpzeit': return blatt('heizzeit-c');
      case 'p-zyklen': S.chart = 'zyklen'; S.cZr = null; return this.gehe('container', b.id);
      case 'c-temp': case 'c-warm': S.chart = 'temp'; S.cZr = null; return this.gehe('container', b.id);
      case 'h-plan': S.sheet = { art: 'hz', k: 'plan' }; return this.neuZeichnen();
      case 'h-wann': S.sheet = { art: 'hz', k: 'wann' }; return this.neuZeichnen();
    }
  }
  awSeite(B, A, z, alle) {
    const d = this.d, L = this.awAuswahl(), bearb = this.s.awBearb, layout = this.s.awLayout;
    this._awTeile = { B, A, z };   // für die Detail-Einblendung
    const kopf = this.kopf('Auswertung', alle ? 'ALLE LAUFENDEN BAUSTELLEN' : esc(d.titel), `<span class="aw-knoepfe"><button class="glas-panel chip ${layout ? 'amber' : ''}" data-act="aw-layout">${layout ? '✓ Fertig' : '✥ Layout'}</button>
        <button class="glas-panel chip ${bearb ? 'amber' : ''}" data-act="aw-bearb">${bearb ? '✓ Fertig' : '✎ Anpassen'}</button><button class="glas-panel chip ${this.s.awSim ? 'sp-chip-sim' : ''}" data-act="sp-aw">💶 ${this.s.awSim ? `simuliert ${de(this.simPreis(), 2)} €` : 'Preis: tatsächlich'}</button><button class="glas-panel chip" data-act="csv">⇩ CSV</button><button class="glas-panel chip kk-plus" data-act="kk-plus" data-ort="aw">＋ Kachel</button></span>`);
    const leiste = `${this.s.awSim ? `<div class="sp-band">🧮 Simuliert: alle € dieser Auswertung mit <span class="sp-sim"><button class="glas-panel chip" data-act="sp-sim" data-d="-0.01">−</button><b>${de(this.simPreis(), 2)} €/kWh</b><button class="glas-panel chip" data-act="sp-sim" data-d="0.01">+</button></span> <button class="rv-link" data-act="sp-aw">zurück auf tatsächlich</button></div>` : ''}<div class="aw-leiste"><div class="seg glas-panel">${['Tag', 'Woche', 'Monat', 'Jahr'].map(t => `<button data-act="vb-zeitraum" data-ziel="aw" data-v="${t}" class="${z === t ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="seg glas-panel">${[['diese', 'Diese Baustelle'], ['alle', `Alle laufenden (${this.laufende().length})`]].map(([k, t]) => `<button data-act="aw-scope" data-v="${k}" class="${(this.s.awScope || 'diese') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      ${this.zrWahl('aw', z, this.zrGrenze(alle))}`;
    if (bearb) {
      const _gr = (i, x, k, max) => `<span class="aw-gr"><small>${k === 'w' ? 'Breite' : 'Höhe'}</small><button class="glas-panel chip" data-act="aw-gr" data-i="${i}" data-k="${k}" data-d="-1" ${x[k] <= 1 ? 'disabled' : ''}>−</button><b>${x[k]}</b><button class="glas-panel chip" data-act="aw-gr" data-i="${i}" data-k="${k}" data-d="1" ${x[k] >= max ? 'disabled' : ''}>+</button></span>`;
      return `${kopf}${leiste}
        <div class="glas-panel block aw-vorlagen"><div class="block-kopf"><b>Vorlage</b><span class="leise">stellt Bausteine, Reihenfolge und Größe ein – danach frei anpassbar</span></div>
          <div class="aw-vorlagen-k">${Object.entries(AW_VORLAGEN).map(([k, [t]]) => `<button class="glas-panel chip" data-act="aw-vorlage" data-v="${k}">${t}</button>`).join('')}</div></div>
        <div class="glas-panel liste aw-wahl"><div class="gruppe">Bausteine · ein/aus, Reihenfolge, Größe (nur Stufen, die zum Inhalt passen)</div>
          ${L.map((x, i) => `<div class="zeile"><div><b>${esc(this.kkName(x))}</b><div class="leise">${AW_BAUSTEINE[x.k] ? AW_BAUSTEINE[x.k][1] : `Kachel · ${KK[x.k].text}`}${alle && !B[x.k] && B[x.k] !== undefined ? ' · nur für diese Baustelle' : ''}</div></div>
            <div class="aw-wahl-k"><button class="glas-panel chip" data-act="aw-hoch" data-i="${i}" ${i ? '' : 'disabled'} aria-label="nach oben">↑</button><button class="glas-panel chip" data-act="aw-runter" data-i="${i}" ${i < L.length - 1 ? '' : 'disabled'} aria-label="nach unten">↓</button>
              <div class="seg klein">${awStufen(x.k).map(([n, w, h]) => `<button data-act="aw-stufe" data-i="${i}" data-v="${n}" class="${x.st === n ? 'on' : ''}" title="${w}×${h}">${n}</button>`).join('')}</div>${schalter(x.an, 'aw-an', `data-i="${i}"`)}</div></div>`).join('')}
          <button class="zeile" data-act="aw-vorlage" data-v="misch"><span class="blau">Auf Vorschlag zurücksetzen</span></button></div>`;
    }
    const an = L.filter(x => x.an), c = this.kkCtx('aw');
    const teile = an.map((x, i) => ({ x, i, html: KK[x.k] ? this.kkKachel(x, i, 'aw', c) : this.awStueck(x.k, B, A, z, x) })).filter(t => t.html);
    return `${kopf}${leiste}
      ${layout ? '<div class="leise aw-hinweis">Kachel am Griff ⠿ ziehen zum Verschieben · am Griff ◢ ziehen für die Größe (rastet im Raster ein) · 📈 Diagramm der großen Kachel ein/aus · ✕ blendet aus</div>' : ''}
      ${teile.length || !layout ? this.kkRaster('aw', teile, layout) : '<div class="leer">Nichts ausgewählt – „＋ Kachel“</div>'}`;
  }
  /* Layout: Kachel ziehen (Reihenfolge) und Größe ziehen (rastet im Raster ein) – Maus und Finger */
  zugStart(ev) {
    const griff = ev.target && ev.target.closest && ev.target.closest('[data-zug]'); if (!griff) return;
    const kachel = griff.closest('.aw-frei-s'), raster = kachel && kachel.parentElement; if (!raster) return;
    const art = griff.dataset.zug, ort = raster.dataset.ort || 'aw', an = this.kkListe(ort).filter(x => x.an), item = an[+kachel.dataset.i]; if (!item) return;
    ev.preventDefault();
    const cs = getComputedStyle(raster), spalten = cs.gridTemplateColumns.split(' ').length, luecke = parseFloat(cs.columnGap) || 12;
    const breite = (raster.getBoundingClientRect().width - luecke * (spalten - 1)) / spalten, hoehe = parseFloat(cs.gridAutoRows) || 110;
    const x0 = ev.clientX, y0 = ev.clientY, w0 = item.w, h0 = item.h, mass = kachel.querySelector('.aw-mass'), wurzel = this.shadowRoot;
    kachel.classList.add(art === 'move' ? 'zieht' : 'waechst');
    let ziel = null;
    const bewegt = e => {
      if (art === 'size') {
        const st = awStufe(item.k, w0 + (e.clientX - x0) / (breite + luecke), h0 + (e.clientY - y0) / (hoehe + luecke));   // rastet auf Stufen ein (FE-0006)
        Object.assign(item, { w: st[1], h: st[2], st: st[0] });
        kachel.style.setProperty('--w', item.w); kachel.style.setProperty('--h', item.h); if (mass) mass.textContent = item.st;
      } else {
        kachel.style.transform = `translate(${e.clientX - x0}px, ${e.clientY - y0}px)`; kachel.style.pointerEvents = 'none';
        const unter = (wurzel.elementFromPoint ? wurzel : document).elementFromPoint(e.clientX, e.clientY), k = unter && unter.closest && unter.closest('.aw-frei-s');
        raster.querySelectorAll('.aw-frei-s.ziel').forEach(x => x.classList.remove('ziel'));
        ziel = k && k !== kachel && raster.contains(k) ? k : null; if (ziel) ziel.classList.add('ziel');
      }
    };
    const fertig = () => {
      window.removeEventListener('pointermove', bewegt); window.removeEventListener('pointerup', fertig); window.removeEventListener('pointercancel', fertig);
      if (art === 'move' && ziel) { const Lg = this.kkListe(ort), nach = an[+ziel.dataset.i], von = Lg.indexOf(item);
        Lg.splice(von, 1); Lg.splice(Lg.indexOf(nach) + (+ziel.dataset.i > +kachel.dataset.i ? 1 : 0), 0, item); }
      this.kkMerken(ort); this.neuZeichnen();
    };
    window.addEventListener('pointermove', bewegt); window.addEventListener('pointerup', fertig); window.addEventListener('pointercancel', fertig);
  }

  /* WU-0016: bis zu 3 Screenshots je Meldung – Datei/Kamera, Strg+V, am PC „Fenster aufnehmen“; vor dem Senden auf
     höchstens 1600 px verkleinert (JPEG). Mockup melden-bilder.html, abgenommen 02.10.2026 */
  mbBild(quelle, b, h, wie) {   // Bild/Video → verkleinertes JPEG ins offene Melde-Fenster
    const s = this.s.sheet; if (!s || s.art !== 'melden') return;
    const f = Math.min(1, MB_PX / Math.max(b, h)), c = document.createElement('canvas'); c.width = Math.round(b * f); c.height = Math.round(h * f);
    c.getContext('2d').drawImage(quelle, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.82), B = (s.form.bilder ||= []);
    if (B.length >= MB_MAX) return this.toast(`Höchstens ${MB_MAX} Bilder`);
    B.push({ url, b: c.width, h: c.height, kb: Math.round(url.length * 0.75 / 1024) }); this.neuZeichnen(); this.toast(`Bild ${wie}`);
  }
  mbDatei(datei, wie) {
    if (!datei || !(datei.type || '').startsWith('image/')) return;
    const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => this.mbBild(img, img.width, img.height, wie); img.onerror = () => this.toast('Bild nicht lesbar'); img.src = r.result; };
    r.readAsDataURL(datei);
  }
  mbFenster() {
    return navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, preferCurrentTab: true }).then(strom => {
      const v = document.createElement('video'); v.srcObject = strom; v.muted = true;
      return v.play().then(() => new Promise(r => setTimeout(r, 300))).then(() => { this.mbBild(v, v.videoWidth, v.videoHeight, 'aufgenommen'); strom.getTracks().forEach(t => t.stop()); });
    }).catch(() => this.toast('Aufnahme abgebrochen'));
  }
  mlBild(m, i) { const r = this._holen(`mb:${m.id}:${i}`, () => this._hass.callWS({ type: 'baustelle/meldung', aktion: 'bild', meldung_id: m.id, nr: i }), 3600000); return r && r.url; }
  /* Kachel „Preis simulieren“: tatsächliche € (je Tag der damalige Preis) gegen alle kWh × simulierter Preis – beides rechnet die Integration */
  spKachel(x, i, ort, c) {
    const sim = this.simPreis(), A2 = this.awDaten(c.z, c.v, ort === 'aw' ? this.s.awScope || 'diese' : 'diese', this.d, sim), S2 = (A2 && A2.summen) || {}, S = c.S;
    const echt = S.eur, simE = S2.eur, kwh = S.kwh, diff = zahl(simE) && zahl(echt) ? simE - echt : null, gr = x.st;
    const kopf = '<div class="kk-kopf"><span class="kk-ic">🧮</span><small>Preis simulieren</small></div>';
    const regler = `<div class="sp-sim"><button class="glas-panel chip" data-act="sp-sim" data-d="-0.01" aria-label="Preis niedriger">−</button><b>${de(sim, 2)} €</b><button class="glas-panel chip" data-act="sp-sim" data-d="0.01" aria-label="Preis höher">+</button></div>`;
    const zahlH = `<b class="kk-zahl">${zahl(simE) ? de(simE, simE < 100 ? 2 : 0) : '–'}<small> €</small></b>`;
    const unter = diff === null ? 'lädt …' : `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${de(Math.abs(diff), 2)} € gegenüber tatsächlich ${de(echt, 2)} €`;
    let inhalt;
    if (gr === 'S') inhalt = `${kopf}${zahlH}<span class="kk-wo">bei ${de(sim, 2)} €/kWh</span>`;
    else if (gr === 'M') inhalt = `<div class="kk-m-l">${kopf}${zahlH}<span class="kk-vgl">${unter}</span></div><div class="kk-m-r">${regler}<span class="kk-wo">${zahl(kwh) ? de(kwh, 0) : '–'} kWh · ${esc(this.zrText(c.z, c.v))}</span></div>`;
    else inhalt = `${kopf}<div class="kk-l-zeile">${zahlH}<span class="kk-wo">${esc(this.zrText(c.z, c.v))}</span></div><span class="kk-vgl">${unter}</span>${regler}
      <div class="kk-dia zeilen"><div class="kk-dia-in">${kkBalken([['tatsächlich', echt || 0, zahl(echt) ? `${de(echt, 2)} €` : '–', 'var(--s1)'], [`bei ${de(sim, 2)} €`, simE || 0, zahl(simE) ? `${de(simE, 2)} €` : '–', '#bf5af2']])}</div></div>
      <div class="leise">tatsächlich = je Tag der damals gültige Preis · simuliert = alle ${zahl(kwh) ? de(kwh, 0) : '–'} kWh × ${de(sim, 2)} €</div>`;
    return ort === 'kat' ? `<div class="glas-panel kk kk-${gr}">${inhalt}</div>`
      : `<div class="glas-panel kk kk-${gr}" role="button" tabindex="0" data-act="kk-auf" data-ort="${ort}" data-i="${i}" title="antippen: Auswertung mit diesem Preis">${inhalt}</div>`;
  }
  /* Strompreis mit „gilt ab“ (Herbert 04.10.2026, Mockup strompreis.html): Liste wie die Arbeitszeit; die Integration
     rechnet jeden Tag mit dem Preis, der damals galt */
  preisListe() {
    const e = this.d.e, H = this.z.HEUTE, L = (e.preise.length ? e.preise : [{ ab: null, preis: e.preis }]).slice().sort((a, b) => String(b.ab).localeCompare(String(a.ab)));
    const jetzt = L.find(x => !x.ab || x.ab <= H);
    return `<div class="gruppe-t">Strompreis</div>${L.map((x, i) => { const bis = i && L[i - 1].ab ? plusTage(L[i - 1].ab, -1) : null;
      return `<div class="sp-zeile"><b>${de(x.preis, 2)} €/kWh</b><span class="leise">${x === jetzt ? '<span class="badge gruen">gilt jetzt</span> ' : x.ab > H ? '<span class="badge blau-b">geplant</span> ' : ''}${x.ab && x.ab > '2000-01-01' ? `ab ${datum(x.ab)}` : 'bisher'}${bis ? ` bis ${datum(bis)}` : ''}</span>
        ${L.length > 1 && x.ab ? `<button class="x" data-act="sp-weg" data-ab="${x.ab}" title="Preis löschen">✕</button>` : ''}</div>`; }).join('')}
      <button class="zeile" data-act="sp-neu"><span class="blau">+ Neuer Preis ab …</span></button>
      <div class="leise">Auswertung, Abrechnung nach Firma und CSV rechnen jeden Tag mit dem Preis, der an dem Tag galt. Ein neuer Preis ändert nichts an Vergangenem.</div>`;
  }
  /* Rangliste der Staffelung (Herbert 01.10.2026, Mockup staffel-rang.html): Reihenfolge und Bedarf in °C rechnet die
     Integration (laufzeit.staffel.rang, laufzeit.container.<id>.bedarf) – die Seite zeigt nur an */
  stromRang(L, zustand) {
    const d = this.d, rang = (d.staffel && d.staffel.rang) || [], offen = this.s.srOffen || [];
    const nachId = Object.fromEntries(L.hk.map(x => [x.g.id, x])), zeilen = rang.map(id => nachId[id]).filter(Boolean);
    if (!zeilen.length) return '';
    const f = (v, k = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${de(Math.abs(v), k)}`, gesehen = new Set();
    const letzterAn = [...zeilen].reverse().find(x => x.g.an);
    return `<div class="sr-kopf"><b>Rangliste</b><span class="leise">oben = zuerst an, unten = gibt zuerst ab</span></div>
      <div class="sr-liste">${zeilen.map((x, i) => {
        const { b, g } = x, B = b.bedarfGrad, erster = !gesehen.has(b.id); gesehen.add(b.id);
        const stufen = (b.z === 'frost' ? '<span class="sr-stufe frost">❄ Frostschutz</span>' : '') + (b.boost ? '<span class="sr-stufe boost">⚡ Schnell</span>' : '')
          + (erster ? '<span class="sr-stufe erster">erster im Container</span>' : '<span class="sr-stufe">Zweitgerät</span>') + (b.prio && b.prio !== 'normal' ? `<span class="sr-stufe">Priorität ${esc(b.prio)}</span>` : '');
        const [zt, zk] = zustand(x), auf = offen.includes(g.id);
        const mitFuehler = B && zahl(B.jetzt);
        const wert = B ? `<div class="sr-bedarf">${f(B.summe)} °C<small>${mitFuehler ? `Bedarf in ${B.horizont_min} min` : 'ohne Fühler'}</small></div>` : '<div class="sr-bedarf">–<small>noch nicht gerechnet</small></div>';
        const teile = !B ? '' : mitFuehler ? [
          [`jetzt ${de(b.t, 1)} °C, Soll ${de(this.sollVon(b), 1)} °C`, B.jetzt],
          ...(zahl(B.abkuehlen) ? [[`kühlt ohne Heizen ${de(B.abkuehl_h, 1)} °C/h ab (${B.gemessen ? 'gemessen' : 'gelernt'}) → in ${B.horizont_min} min`, B.abkuehlen]] : []),
          ...(B.nachlauf ? [['heizt nach dem Aus noch nach (gelernt)', B.nachlauf]] : []),
          ...(B.ziel ? [[`schafft das Soll bis Arbeitsbeginn nicht (${zahl(B.aufheiz_h) ? `${de(B.aufheiz_h, 1)} °C/h gelernt` : 'gelernt'})`, B.ziel]] : []),
          ...(B.gerecht ? [[`wenig Heizzeit in der letzten Stunde (${B.heiz_min} min)`, B.gerecht]] : []),
        ] : [['Ohne Fühler kein Bedarf – kommt über die Heizzeit der letzten Stunde reihum dran', B.gerecht]];
        const aufHtml = !auf || !teile.length ? '' : `<div class="sr-auf">${teile.map(([t, v]) => `<span>${t}</span><b>${f(v)} °C</b>`).join('')}<span class="summe">Bedarf</span><b class="summe">${f(B.summe)} °C</b></div>`;
        return `<div class="sr-zeile" data-act="sr-auf" data-id="${esc(g.id)}" role="button" tabindex="0"><span class="sr-nr">${i + 1}</span><div class="sr-name"><b>${esc(b.name)} · ${esc(g.n)}</b><div>${stufen}</div></div>${wert}
          <div class="sr-zust"><span class="${zk}">${zt}${x === letzterAn && g.an ? ' · gibt als nächstes ab' : ''}</span> <span class="leise">· antippen: woraus</span></div>${aufHtml}</div>`; }).join('')}</div>`;
  }
  /* ---- Auswertung: Leistung heute, Temperaturen, je Gerät, Hochrechnung (0.7.8) ---- */
  leistungHeute() {
    const d = this.d, Q = d.bereiche.map(b => ({ name: b.name, farbe: BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], v: this.verbrauch(d, b.id, 'Tag') }));
    return `<div class="glas-panel block"><div class="block-kopf"><b>Leistung heute</b><span class="leise">kW je Stunde (Mittel)</span></div>
      <div class="chart-wrap">${Q.some(q => !q.v) ? LAEDT : Q.length ? flaeche('kw-heute', Q, STUNDEN, 'kW', 6) : '<div class="leer">Noch keine Container</div>'}</div>
      <div class="leise">gestapelt nach Container – oben die ganze Baustelle</div></div>`;
  }
  /* Tagesmittel der Fühler und außen, letzte n Tage */
  tempTage(n) {
    const d = this.d, ids = [...new Set([...d.bereiche.filter(b => b.fuehler).map(b => b.fuehler), this.eid(d, d.entry, 'aussen')].filter(Boolean))].sort();
    const bis = plusTage(d.z.HEUTE, 1), von = plusTage(bis, -n), tage = [...Array(n)].map((_, k) => plusTage(von, k));
    if (!ids.length) return { tage, werte: {} };
    const roh = this._holen(`t:${d.entry}:${n}:${d.z.HEUTE}`, () => this._hass.callWS({ type: 'baustelle/statistik', entry_id: d.entry,
      start_time: new Date(this.zoneMs(von, '00:00', d.z.zone)).toISOString(), end_time: new Date(this.zoneMs(bis, '00:00', d.z.zone)).toISOString(),
      statistic_ids: ids, period: 'day', types: ['mean'], units: {} }));
    if (roh === undefined) return null;
    const werte = {};
    for (const id of ids) { const arr = Array(n).fill(null);
      for (const p of (roh || {})[id] || []) { const ms = typeof p.start === 'number' ? (p.start < 1e11 ? p.start * 1000 : p.start) : Date.parse(p.start), i = tage.indexOf(this.lokal(ms, d.z.zone).slice(0, 10)); if (i >= 0 && zahl(p.mean)) arr[i] = Number(p.mean); }
      werte[id] = arr; }
    return { tage, werte };
  }
  temperaturen() {
    const d = this.d, tv = this.s.tv || 'heute', C = d.bereiche.filter(b => !b.pumpe && b.fuehler), aid = this.eid(d, d.entry, 'aussen');
    const farbe = b => BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], aussen = { name: 'Außen', farbe: 'var(--ink2)', aussen: true };
    let inhalt;
    if (tv === 'heute') { const st = this.statistik('Tag');
      inhalt = !st ? LAEDT : linien('tp-heute', [...C.map(b => ({ name: b.name, farbe: farbe(b), v: [...(st.werte[b.fuehler] || []), null] })), ...(aid ? [{ ...aussen, v: [...(st.werte[aid] || []), null] }] : [])],
        [...STUNDEN, '24'], 6, i => `${String(i).padStart(2, '0')}:00`);
    } else { const n = tv === '7' ? 7 : 30, t = this.tempTage(n);
      inhalt = !t ? LAEDT : linien(`tp-${n}`, [...C.map(b => ({ name: b.name, farbe: farbe(b), v: t.werte[b.fuehler] || Array(n).fill(null) })), ...(aid ? [{ ...aussen, v: t.werte[aid] || Array(n).fill(null) }] : [])],
        t.tage.map(kurzDatum), n === 7 ? 1 : 5, i => `${wtag(t.tage[i])} ${kurzDatum(t.tage[i])} · Tagesmittel`); }
    return `<div class="glas-panel block"><div class="block-kopf"><b>Temperaturen</b><span class="leise">alle Container mit Fühler</span></div>
      <div class="seg">${[['heute', 'Heute'], ['7', '7 Tage'], ['30', '30 Tage']].map(([k, t]) => `<button data-act="tv" data-v="${k}" class="${tv === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="chart-wrap">${C.length ? inhalt : '<div class="leer">Kein Container mit Temperaturfühler</div>'}</div>
      <div class="leise">${tv === 'heute' ? 'Stundenmittel, gestrichelt außen.' : 'Tagesmittel je Container, gestrichelt außen.'}${d.bereiche.some(b => !b.pumpe && !b.fuehler) ? ' Container ohne Fühler fehlen.' : ''}</div></div>`;
  }
  /* Je Gerät: Ø kW im Betrieb (Zähler mittel:<gid>), kWh aus dem Zählerstand des Shelly, Stunden ≈ kWh ÷ Ø kW (Pumpen: Pumpzeit) – rechnet die Integration */
  geraeteBlock(z, A) {
    const d = this.d;
    if (!A) return `<div class="glas-panel block"><div class="block-kopf"><b>Je Gerät</b></div>${LAEDT}</div>`;
    const zeilen = (A.je_geraet || []).map(r => { const b = d.bereiche.find(x => x.id === r.bereich), g = b && b.geraete.find(x => x.id === r.geraet); return g ? { ...r, b, g } : null; }).filter(Boolean);
    const f = (v, k) => zahl(v) ? de(v, k) : '–';
    return `<div class="glas-panel block"><div class="block-kopf"><b>Je Gerät</b><span class="leise">${{ Tag: 'heute', Woche: 'diese Woche', Monat: 'dieser Monat', Jahr: 'dieses Jahr' }[z]}</span></div>
      ${zeilen.length ? `<div class="tab-scroll"><table class="vergleich je-geraet"><tr><th>Gerät</th><th>Ø kW</th><th>Stunden</th><th>kWh</th><th>€</th></tr>
        ${zeilen.map(({ b, g, mittel, kwh, std, eur }) => `<tr><td><b>${esc(g.n)}</b><div class="leise">${esc(b.name)} · ${esc(g.typ)}</div></td><td>${f(mittel, 2)}</td><td>${f(std, 1)}</td><td>${f(kwh, 1)}</td><td>${zahl(kwh) ? de(eur, 2) : '–'}</td></tr>`).join('')}</table></div>`
        : '<div class="leer">Noch keine Geräte</div>'}
      ${erkl(d.e.erklaer, 'Ø kW ist die mittlere Leistung, während das Gerät läuft – so sieht man, ob ein Heizkörper schwächer ist als angegeben. kWh kommen aus dem Zählerstand des Shelly (ohne Energiezähler „–“), Stunden ≈ kWh ÷ Ø kW, bei Pumpen die gemessene Pumpzeit.')}</div>`;
  }
  hochrechnung(A) {
    // kWh und € rechnet die Integration (baustelle/auswertung → hochrechnung, heizperiode); die Seite zeigt sie nur an
    const d = this.d, [von, bis] = d.hp, mon = (bis - von + 12) % 12 + 1, hp = A && A.heizperiode, h = A && A.hochrechnung;
    const max = h ? Math.max(h.bisher_kwh || 0, h.mit_kwh || 0, h.ohne_kwh || 0) || 1 : 1;
    const balkenZ = (t, kwh, eur, farbe) => `<div class="hbar"><span class="hb-n">${t}</span><span class="hb-spur"><i style="width:${zahl(kwh) ? kwh / max * 100 : 0}%;background:${farbe}"></i></span><span class="hb-w">${zahl(eur) ? `${de(eur, 0)} €` : '–'}</span></div>`;
    return `<div class="glas-panel block"><div class="block-kopf"><b>Hochrechnung Heizperiode</b><span class="leise">${MONATE[von - 1]}–${MONATE[bis - 1]} · ${mon} Monate</span></div>
      ${!A ? LAEDT : !h || !zahl(h.mit_kwh) ? '<div class="leer">Noch zu wenige Tage für eine Hochrechnung</div>' : `${balkenZ('bisher', h.bisher_kwh, h.bisher_eur, 'var(--s3)')}${balkenZ('mit Automatik', h.mit_kwh, h.mit_eur, 'var(--s1)')}${balkenZ('ohne (24/7)', h.ohne_kwh, h.ohne_eur, 'var(--s2)')}
      <div class="gespart">bis ${hp && hp.bis !== hp.ende ? datum(hp.bis) : `Ende ${MONATE_LANG[bis - 1]}`} rund <b>${de(h.mit_kwh, 0)} kWh</b> · ${de(h.mit_eur, 0)} €${zahl(h.gespart_eur) ? ` – gespart ≈ <b>${de(h.gespart_eur, 0)} €</b>` : ''}</div>`}
      <div class="leise">aus dem bisherigen Verbrauch je Tag hochgerechnet${d.ende ? ` – bis zum geplanten Ende ${datum(d.ende)}, wenn es früher liegt` : ''}. Heizperiode unter Einstellungen › Baustelle.</div>
      ${erkl(d.e.erklaer, 'Die Hochrechnung nimmt den Verbrauch je Tag bisher und rechnet ihn auf die ganze Heizperiode hoch. Endet die Baustelle früher, zählt nur bis zum Ende.')}</div>`;
  }

  /* ---- Verlauf ---- */
  /* Kennzahlen einer Baustelle im Verlauf (kWh, €, gespart, Heiztage, Vergleich, kWh je Monat) – rechnet die Integration */
  kennz(x) {
    const v = this.verlaufDaten(x), zeit = x.aktiv ? (x.beginn ? `seit ${datum(x.beginn)}` : 'laufend') : `${x.beginn ? datum(x.beginn) : '–'} – ${x.ende ? datum(x.ende) : '–'}`;
    if (!v) return { zeit, kwh: null, eur: null, gespart: null, heiztage: null, container: x.bereiche.length, vergleich: {}, jeMonat: {}, monate: null, laedt: true };
    return { zeit, kwh: v.kwh ?? 0, eur: v.eur ?? 0, gespart: v.gespart ?? null, heiztage: v.heiztage ?? 0, container: v.container ?? x.bereiche.length,
      vergleich: v.vergleich || {}, jeMonat: v.je_monat || {}, monate: v.monate_je_container || { labels: [], reihen: [] }, laedt: false };
  }
  /* ============ Verlauf (WU-0006, Mockup glas.html Variante 5 abgenommen): Reiter Baustellen (Karten / Vergleich) und Protokoll ============ */
  vlMonatsKeys() {
    const heute = (this.d || this.alle[0] || { z: { HEUTE: new Date().toISOString().slice(0, 10) } }).z.HEUTE, j = +heute.slice(0, 4), mo = +heute.slice(5, 7) - 1;
    return [...Array(12)].map((_, k) => { const mm = mo - 11 + k, jj = mm < 0 ? j - 1 : j; return `${jj}-${String(((mm % 12) + 12) % 12 + 1).padStart(2, '0')}`; });
  }
  vlFunke(werte, farbe, w = 120, h = 34) {
    const max = Math.max(1, ...werte), bw = w / werte.length;
    return `<svg class="vl-funke" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${werte.map((v, i) => `<rect x="${(i * bw + 1).toFixed(1)}" y="${(h - v / max * h).toFixed(1)}" width="${Math.max(0, bw - 2).toFixed(1)}" height="${(v / max * h).toFixed(1)}" rx="1.5" fill="${farbe}" opacity="${v > .5 ? .9 : .15}"/>`).join('')}</svg>`;
  }

  protokoll() {
    const f = this.s.pfilter || 'alle', ART = { warnung: ['⚠', 'var(--rot)'], ok: ['✓', '#30d158'], schalten: ['⏻', 'var(--amber)'], wetter: ['☁', 'var(--blau)'], nachricht: ['✉', 'var(--ink2)'], einstellung: ['⚙', 'var(--ink2)'] };
    const passt = e => f === 'alle' || e[2] === f || (f === 'warnung' && e[2] === 'ok') || (f === 'schalten' && e[2] === 'einstellung');
    let quelle = this.d.protokoll;
    if ((f !== 'alle' || this.s.pmehr) && this.d.geladen) {
      const r = this._holen('p:' + this.d.entry, () => this._hass.callWS({ type: 'baustelle/protokoll', entry_id: this.d.entry, filter: 'alle', vor: null, limit: 200 }), 60000);
      quelle = r === undefined ? null : (Array.isArray(r) ? r : (r && r.eintraege) || []).map(p => this.protokollZeile(p, this.z));
    }
    const kopf = `<div class="block-kopf"><b>Protokoll</b><span class="leise">bleibt mit der Baustelle gespeichert · auch im HA-Logbuch</span></div>
      <div class="vb-wer">${[['alle', 'Alle'], ['warnung', 'Warnungen'], ['schalten', 'Schalten'], ['wetter', 'Wetter'], ['nachricht', 'Nachrichten']].map(([k, t]) => `<button data-act="pfilter" data-v="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    if (quelle === null) return `<div class="glas-panel block">${kopf}${LAEDT}</div>`;
    let liste = quelle.filter(passt); const mehr = !this.s.pmehr && (liste.length > 12 || (f === 'alle' && quelle.length >= 20)); if (mehr) liste = liste.slice(0, 12);
    let tag = '';
    return `<div class="glas-panel block">${kopf}
      ${liste.length ? liste.map(e => { const [ic, farbe] = ART[e[2]] || ['•', 'var(--ink2)'], kopfT = e[0] !== tag ? `<div class="p-tag">${(tag = e[0])}</div>` : '';
        return `${kopfT}<div class="zeile ereignis"><span class="zeit">${e[1]}</span><span class="p-ic" style="color:${farbe}">${ic}</span><div>${e[3] ? `<b>${esc(this.bName(e[3]))}</b> ` : ''}<span class="${e[3] ? 'leise' : ''}">${esc(e[4])}</span></div></div>`; }).join('')
        : '<div class="leer">Keine Einträge</div>'}
      ${mehr ? '<button class="zeile" data-act="pmehr"><span class="blau">Ältere Einträge laden</span></button>' : ''}</div>`;
  }

  /* ---- Einstellungen (WU-0007, Mockup einstellungen-varianten.html Variante 1 „Seitenleiste“, abgenommen 01.10.2026) ----
     Alle Einstellungen an einer Stelle in Gruppen; links die Seitenleiste, auf dem Handy Chips oben. Die Blöcke kommen
     aus den bisherigen Stellen (Einstellungen, Heizung, Pumpen, Entwicklung, Über), jede Einstellung bleibt ein Regler. */
  einstBlock(titel) {
    const h = this._einstAlt ||= this.einstBloecke(), x = h.split('<div class="glas-panel liste">').find(t => t.startsWith(`<div class="gruppe">${titel}</div>`));
    return x ? '<div class="glas-panel liste">' + x : '';
  }
  /* WU-0010: alle eingebundenen Geräte nach Funktion – Ort, Zustand, Batterie; Klick öffnet die Gerätewebsite
     (configuration_url), sonst die Geräteseite in HA (Links von der Integration: geraete_links) */
  geraeteListe() {
    const d = this.d, L = (d.r && d.r.geraete_links) || {}, o = d.optionen || {}, z = eid => this._hass && this._hass.states[eid];
    const weg = s => !s || s.state === 'unavailable' || s.state === 'unknown';
    let n = 0, offline = 0;
    const balken = sig => !sig || !zahl(sig.state) ? '' : sigHtml(+sig.state);   // AN-0009: Signal in 4 Strichen, Wert im Tooltip
    const zeile = (eid, ic, ort, text, schlecht, marke = '') => {
      n++; if (schlecht) offline++;
      const l = L[eid] || {}, href = l.web || l.ha, bat = l.batterie && z(l.batterie), name = this.name(eid) || eid, s0 = z(eid);
      const seit = schlecht && s0 && s0.last_changed ? ` seit ${new Date(s0.last_changed).toLocaleTimeString('de-AT', { timeZone: d.z.zone, hour: '2-digit', minute: '2-digit' })}` : '';
      const punkt = `<i class="ger-punkt ${schlecht ? 'weg' : 'da'}" title="${schlecht ? 'nicht erreichbar – angemeldet, aber nicht gefunden (Stecker gezogen?)' : 'erreichbar'}"></i>`;
      const inhalt = `<span class="ger-ic">${ic}${punkt}</span><div><b>${esc(name)}</b>${marke}<div class="leise">${esc(ort)}${l.modell ? ` · ${esc(l.modell)}` : ''}${l.web ? ' · Website' : ''}</div></div>
        <span class="ger-z ${schlecht ? 'rot-t' : ''}">${text}${seit}${bat && zahl(bat.state) ? ` · 🔋 ${de(+bat.state, 0)} %` : ''} ${schlecht ? '' : balken(l.signal && z(l.signal))}</span>${href ? '<span class="chev">↗</span>' : ''}`;
      return href ? `<a class="zeile ger" href="${esc(href)}" target="_blank" rel="noopener" title="${l.web ? 'Website des Geräts öffnen' : 'Gerät in Home Assistant öffnen'}">${inhalt}</a>` : `<div class="zeile ger">${inhalt}</div>`;
    };
    const wert = eid => { const s = z(eid); if (weg(s)) return ['meldet nichts', true]; const e = (s.attributes || {}).unit_of_measurement || '';
      return [zahl(s.state) ? `${de(+s.state)} ${esc(e)}` : esc(s.state), false]; };
    const C = d.bereiche;
    const schalt = C.flatMap(b => b.geraete.map(g => zeile(g.schalter, g.heizer ? '♨' : b.pumpe ? '💧' : '⏻', `${b.name} · ${g.typ}${g.aktiv ? '' : ' · inaktiv'}`,
      !g.erreichbar ? 'nicht erreichbar' : g.an ? `an · ${de(zahl(g.kwJetzt) ? g.kwJetzt : g.kw, 2)} kW` : 'aus', !g.erreichbar, this.npMarke(g))));
    const temp = [...C.filter(b => b.fuehler).map(b => { const [t, x] = wert(b.fuehler); return zeile(b.fuehler, '🌡', b.name, t, x); }),
      ...(o.temp_sensor ? [(() => { const [t, x] = wert(o.temp_sensor); return zeile(o.temp_sensor, '🌡', 'Außen', t, x); })()] : [])];
    const tuer = C.filter(b => b.tuer).map(b => { const s = z(b.tuer.eid); return zeile(b.tuer.eid, '🚪', b.name, weg(s) ? 'meldet nichts' : s.state === 'on' ? 'offen' : 'zu', weg(s)); });
    const wetter = [o.wetter && zeile(o.wetter, '☁', 'Wetter', weg(z(o.wetter)) ? 'meldet nichts' : esc(WETTER_TEXT[z(o.wetter).state] || z(o.wetter).state), weg(z(o.wetter))),
      o.regen_sensor && (() => { const [t, x] = wert(o.regen_sensor); return zeile(o.regen_sensor, '🌧', 'Regen', t, x); })()].filter(Boolean);
    const teil = (titel, zeilen) => zeilen.length ? `<div class="glas-panel liste"><div class="gruppe">${titel} · ${zeilen.length}</div>${zeilen.join('')}</div>` : '';
    const html = teil('Schaltgeräte', schalt) + teil('Temperaturfühler', temp) + teil('Türkontakte', tuer) + teil('Wetter und Regen', wetter)
      + '<div class="leise p-fuss">Tippen öffnet die Website des Geräts (z. B. die Shelly-Oberfläche); ohne Website die Geräteseite in Home Assistant.</div>';
    return { html, n, offline };
  }
  /* BSM-032: Container-Symbol – Aussehen bearbeiten; die Integration prüft und liefert den Zustand aus den Sensoren */
  symKonfig(b) { const x = this.s.sheet && this.s.sheet.sym; if (x) return x;
    const q = b.symbol || SYMBOL_STANDARD, el = y => ({ wand: y.wand, pos: y.pos, sensor: y.sensor || null });
    return (this.s.sheet.sym = { doppel: !!q.doppel, farbe: q.farbe || null, rahmen: q.rahmen || null, tueren: q.tueren.map(el), fenster: q.fenster.map(el), licht: q.licht || null }); }
  symSenden(b, c) { this.s.sheet.sym = c; this.neuZeichnen(); return this.setzen(['bereiche', b.id, 'symbol'], c); }
  symKlick(a, el) {
    const b = this.d.bereiche.find(x => x.id === this.s.sheet.id); if (!b) return undefined;
    const c = JSON.parse(JSON.stringify(this.symKonfig(b))), art = el.dataset.art, i = +el.dataset.i;
    if (a === 'sym-standard') { this.s.sheet.sym = null; return this.setzen(['bereiche', b.id, 'symbol'], null); }
    if (a === 'sym-doppel') c.doppel = !c.doppel;
    if (a === 'sym-farbe') c.farbe = el.dataset.v;
    if (a === 'sym-rahmen') c.rahmen = el.dataset.v || null;
    if (a === 'sym-wand') c[art][i].wand = el.dataset.v;
    if (a === 'sym-lage') c[art][i].pos = +el.dataset.v;
    if (a === 'sym-weg' && c[art].length > 1) c[art].splice(i, 1);
    if (a === 'sym-neu' && c[art].length < (art === 'tueren' ? 2 : 4)) { const frei = [.15, .33, .5, .67, .85].find(v => !c[art].some(y => y.wand === 'front' && y.pos === v)) ?? .5; c[art].push({ wand: 'front', pos: frei, sensor: null }); }
    return this.symSenden(b, c);
  }
  symAenderung(el) {
    const b = this.d.bereiche.find(x => x.id === this.s.sheet.id); if (!b) return undefined;
    const c = JSON.parse(JSON.stringify(this.symKonfig(b))), [k, i] = el.dataset.sym.split(':');
    if (k === 'farbe') c.farbe = el.value; else if (k === 'rahmen') c.rahmen = el.value; else if (k === 'licht') c.licht = el.value || null; else c[k][+i].sensor = el.value || null;
    return this.symSenden(b, c);
  }
  symDialog(s, griff, knopf) {
    const b = this.d.bereiche.find(x => x.id === s.id); if (!b) return `${griff}<div class="leer">Container nicht gefunden</div>${knopf('Schließen')}`;
    const c = this.symKonfig(b), ist = b.symbol || SYMBOL_STANDARD, std = BEREICH_FARBEN[b.f % BEREICH_FARBEN.length];
    const vorschau = { ...c, licht_an: ist.licht_an, tueren: c.tueren.map((t, i) => ({ ...t, offen: !!(ist.tueren[i] && ist.tueren[i].offen) })),
      fenster: c.fenster.map((f, i) => ({ ...f, zustand: (ist.fenster[i] && ist.fenster[i].zustand) || 'zu' })) };
    const kontakte = this.entitaeten(x => x.entity_id.startsWith('binary_sensor.') && ['door', 'window', 'opening', 'garage_door'].includes(x.attributes.device_class));
    const lichter = this.entitaeten(x => /^(light|switch)\./.test(x.entity_id) || (x.entity_id.startsWith('binary_sensor.') && x.attributes.device_class === 'light') || (x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'illuminance'));
    const seg = (act, art, i, wert, opts) => `<div class="seg klein">${opts.map(([v, t]) => `<button data-act="${act}" data-art="${art}" data-i="${i}" data-v="${v}" class="${String(wert) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const element = (art, x, i, n) => `<div class="zeile"><b>${art === 'tueren' ? '🚪 Tür' : '🪟 Fenster'} ${i + 1}</b>${n > 1 ? `<button class="knopf klein" data-act="sym-weg" data-art="${art}" data-i="${i}" aria-label="entfernen">✕</button>` : ''}</div>
      <div class="zeile unter"><span>Wand</span>${seg('sym-wand', art, i, x.wand, [['front', 'Front'], ['seite', 'Seite']])}</div>
      <div class="zeile unter"><span>${art === 'tueren' ? 'Sitzt' : 'Lage'}</span>${art === 'tueren' ? seg('sym-lage', art, i, x.pos < .4 ? .15 : x.pos > .6 ? .85 : .5, [[.15, 'links'], [.5, 'Mitte'], [.85, 'rechts']]) : seg('sym-lage', art, i, x.pos, [[.15, 'links'], [.33, '◧'], [.5, 'Mitte'], [.67, '◨'], [.85, 'rechts']])}</div>
      <label class="zeile unter"><span>${art === 'tueren' ? 'Türsensor' : 'Fenstersensor'}</span><select data-sym="${art}:${i}">${this.optionen(kontakte, x.sensor || '', art === 'tueren' && i === 0 ? 'wie Türkontakt des Containers' : 'keiner')}</select></label>`;
    return `${griff}<div class="block-kopf"><h3>🏠 Aussehen · ${esc(b.name)}</h3></div><div class="sym-vorschau">${bcContainer(std, b.z === 'pause' || b.z === 'bereit' ? 'aus' : b.z, { symbol: vorschau })}</div>
      <div class="glas-panel liste"><div class="zeile"><div><b>Doppelcontainer</b><div class="leise">zwei Container nebeneinander – das Symbol wird tiefer</div></div>${schalter(c.doppel, 'sym-doppel')}</div>
        <div class="zeile"><span>Farbe</span><span class="sym-farben">${['#3987e5', '#eb6834', '#1baf7a', '#c98500', '#d55181', '#199e70', '#7e57c2', '#78909c'].map(fb => `<button data-act="sym-farbe" data-v="${fb}" class="sym-farbe ${(c.farbe || std) === fb ? 'on' : ''}" style="background:${fb}" aria-label="Farbe ${fb}"></button>`).join('')}<input type="color" value="${c.farbe || std}" data-sym="farbe" aria-label="eigene Farbe"></span></div>
        <div class="zeile"><div><span>Rahmen</span><div class="leise">Stahlrahmen an Ecken, oben und unten (20 cm)</div></div><span class="sym-farben"><button data-act="sym-rahmen" data-v="" class="knopf klein ${c.rahmen ? '' : 'on'}">kein</button>${['#c62828', '#37474f', '#eceff1', '#1565c0', '#f9a825', '#2e7d32'].map(fb => `<button data-act="sym-rahmen" data-v="${fb}" class="sym-farbe ${c.rahmen === fb ? 'on' : ''}" style="background:${fb}" aria-label="Rahmen ${fb}"></button>`).join('')}<input type="color" value="${c.rahmen || '#37474f'}" data-sym="rahmen" aria-label="eigene Rahmenfarbe"></span></div></div>
      <div class="glas-panel liste"><div class="gruppe">Türen · ${c.tueren.length} von 2</div>${c.tueren.map((x, i) => element('tueren', x, i, c.tueren.length)).join('')}${c.tueren.length < 2 ? '<button class="zeile" data-act="sym-neu" data-art="tueren"><span class="blau">+ Tür</span></button>' : ''}</div>
      <div class="glas-panel liste"><div class="gruppe">Fenster · ${c.fenster.length} von 4</div>${c.fenster.map((x, i) => element('fenster', x, i, c.fenster.length)).join('')}${c.fenster.length < 4 ? '<button class="zeile" data-act="sym-neu" data-art="fenster"><span class="blau">+ Fenster</span></button>' : ''}</div>
      <div class="glas-panel liste"><div class="gruppe">Licht im Symbol</div><label class="zeile"><div><span>Licht kommt von</span><div class="leise">Fenster leuchten, wenn im Container Licht brennt</div></div><select data-sym="licht">${this.optionen(lichter, c.licht || '', 'keins')}</select></label></div>
      <div class="leise p-fuss">Türen sitzen links, mittig oder rechts an ihrer Wand; mehrere Fenster verteilen sich gleichmäßig auf den Platz daneben. Tür offen/zu, Fenster offen/gekippt/zu und Licht kommen von den zugeordneten Sensoren; ohne Sensor bleibt das Element zu bzw. dunkel.</div>
      ${b.symbol && b.symbol.eigen ? '<button class="knopf" data-act="sym-standard">Standard (eine Tür, ein Fenster)</button>' : ''}${knopf('Fertig')}`;
  }
  /* BSM-019: Notprogramm in den Plugs – Zustand je Heizkörper-Plug kommt fertig von der Integration (laufzeit.geraete.<id>.notprogramm) */
  npPlugs() { return this.d.bereiche.flatMap(b => b.geraete.filter(g => g.np).map(g => ({ b, g, np: g.np }))); }
  npModus(np) { return { thermo: `Thermostat ${zahl(np.soll) ? de(np.soll) + ' °C' : ''}`.trim(), plan: 'Zeitplan', bedarf: 'Bei Bedarf (Termine)', hand: 'Hand – nicht anfassen', aus: 'aus – nur Frostschutz' }[np.modus] || '–'; }
  npZeit(iso, mitTag = true) { if (!iso) return '–'; const l = this.lokal(iso, this.d.z.zone), t = l.slice(0, 10);
    return mitTag ? `${t === this.d.z.HEUTE ? 'heute' : `${wtag(t)} ${kurzDatum(t)}`} ${l.slice(11, 16)}` : l.slice(11, 16); }
  npVor(iso) { const m = iso ? this.minSeitAb(iso, this.d.z.jetztMs) : null; return m === null ? 'noch nie' : m < 1 ? 'gerade eben' : `vor ${m} min`; }
  npChip(np) { return { bereit: '<span class="gruen-t">✓ bereit</span>', not: `<span class="amber-t">⚠ Notbetrieb seit ${this.npZeit(np.notbetrieb_seit, false)}</span>`,
    fehler: `<span class="rot-t">✕ ${esc(np.fehler || 'Fehler')}</span>`, offen: '<span class="leise">noch nicht geprüft</span>', aus: '<span class="leise">aus</span>' }[np.zustand] || ''; }
  npMarke(g) { const np = g.np; if (!np || np.zustand === 'aus') return '';
    return `<span class="np-marke ${np.zustand === 'fehler' ? 'rot' : ''}" title="Notprogramm: ${np.zustand === 'fehler' ? esc(np.fehler || 'Fehler') : np.zustand === 'not' ? 'Notbetrieb' : np.zustand === 'offen' ? 'noch nicht geprüft' : 'bereit'}">🛟</span>`; }
  npGruppe() {
    const d = this.d, P = this.npPlugs(), an = !!d.e.notprogramm, fehler = P.filter(x => x.np.zustand === 'fehler').length, not = P.filter(x => x.np.zustand === 'not').length;
    const kurz = !an ? 'aus' : not ? `${not} im Notbetrieb` : fehler ? `${fehler} mit Fehler` : `${P.length} ${P.length === 1 ? 'Plug' : 'Plugs'} bereit`;
    const zeile = x => `<button class="zeile" data-act="np-plug" data-id="${esc(x.g.id)}"><div><b>🛟 ${esc(this.name(x.g.schalter) || x.g.n)}</b><div class="leise">${esc(x.b.name)}${an ? ` · im Notbetrieb: ${this.npModus(x.np)}${x.np.tuer ? ' · Tür' : ''}` : ''}${an && x.np.fuehler_fehlt ? ' · <span class="amber-t">Fühler nicht am Plug – im Notbetrieb nur Zeitplan</span>' : ''}</div></div>
      <span class="ger-z">${this.npChip(x.np)}${an && x.np.bis ? `<div class="leise">Programm bis ${this.npZeit(x.np.bis)}</div>` : ''}</span><span class="chev">›</span></button>`;
    const html = `<div class="glas-panel liste"><div class="gruppe">Notprogramm in den Plugs</div>
        <div class="zeile"><div><b>Notprogramm</b><div class="leise">Fällt Home Assistant oder das Netz aus, heizen die Plugs nach dem Programm der nächsten 7 Tage weiter – nach 15 min ohne Lebenszeichen</div></div>${schalter(an, 'np-an')}</div>
        ${an ? `<div class="zeile"><div><b>Taste am Plug = 1 h heizen</b><div class="leise">Drücken heizt den Container 1 h (mit Fühler bis zum Soll), nochmal drücken beendet – auch ohne Home Assistant. Die Automatik übernimmt danach das Relais (kein Handbetrieb).</div></div>${schalter(d.e.taste, 'np-taste')}</div>` : ''}
        ${an ? `<button class="zeile" data-act="np-pruefen"><div><span class="blau">${this.s.npPrueft ? '⟳ prüft …' : '⟳ Jetzt prüfen'}</span><div class="leise">Skript, Kopplungen, Programm und Lebenszeichen an allen Plugs – sonst alle 5 min von selbst</div></div><span class="leise">zuletzt ${this.npVor(d.np && d.np.geprueft)}</span></button>` : ''}</div>
      <div class="glas-panel liste"><div class="gruppe">Heizungs-Plugs · ${P.length}</div>${P.map(zeile).join('') || '<div class="leer">Keine Heizkörper an Shelly-Plugs (Gen2 oder neuer)</div>'}</div>
      ${an && fehler ? `<div class="glas-panel liste"><div class="zeile"><div><b class="rot-t">⚠ ${fehler === 1 ? 'Ein Plug nimmt' : `${fehler} Plugs nehmen`} das Programm nicht an</b><div class="leise">Fällt Home Assistant jetzt aus, heizt er nach dem zuletzt geladenen Programm bzw. danach nur Frostschutz. Nach 15 min auch unter Warnungen.</div></div></div></div>` : ''}
      <div class="leise p-fuss">Im Notbetrieb gilt: kein Lernen, keine Heizgrenze, keine Staffelung – Thermostat nur, wenn der Fühler am Plug gekoppelt ist (die Integration koppelt Fühler und Tür des Containers selbst).</div>`;
    return { k: 'notprogramm', ic: '🛟', t: 'Notprogramm', kurz, html };
  }
  npPlug(s, griff, knopf) {
    const x = this.npPlugs().find(y => y.g.id === s.id); if (!x) return `${griff}<div class="leer">Plug nicht gefunden</div>${knopf('Schließen')}`;
    const np = x.np, z = (t, w) => `<div class="zeile"><span>${t}</span><span class="leise">${w}</span></div>`;
    const frost = zahl(np.frost_ein) ? `ein unter ${de(np.frost_ein)} °C, aus ab ${de(np.frost_aus)} °C` : 'aus';
    return `${griff}<div class="block-kopf"><h3>🛟 ${esc(this.name(x.g.schalter) || x.g.n)}</h3></div><div class="leise" style="padding:0 4px 8px">${esc(x.b.name)}</div>
      <div class="glas-panel liste">${z('Zustand', this.npChip(np))}${z('Skript', np.version ? `Version ${np.version} · läuft` : '–')}${z('Programm', np.bis ? `gültig bis ${this.npZeit(np.bis)} · geladen` : np.programm ? 'geladen · ohne Heizzeit in den nächsten 7 Tagen' : '–')}
        ${z('Im Notbetrieb', this.npModus(np))}${z('Frostschutz', frost)}${z('Fühler am Plug', np.fuehler ? `Messwert Nr. ${np.fuehler}` : np.fuehler_fehlt ? '<span class="amber-t">keiner – Zeitplan</span>' : '–')}
        ${z('Tür am Plug', np.tuer ? `✓ Messwert Nr. ${np.tuer}` : '–')}${z('Letzte Prüfung', this.npVor(np.zuletzt))}</div>
      <div class="glas-panel liste"><div class="gruppe">Notbetrieb</div>${np.zustand === 'not' ? z('läuft seit', `${this.npZeit(np.notbetrieb_seit)} · Home Assistant meldet sich nicht`) : ''}
        ${z('zuletzt', np.notbetrieb_zuletzt ? `${this.npZeit(np.notbetrieb_zuletzt[0])} – ${this.npZeit(np.notbetrieb_zuletzt[1], false)}` : 'noch nie (seit dem Start von Home Assistant)')}</div>
      ${this.d.e.notprogramm ? `<div class="glas-panel liste"><div class="gruppe">Ausfall-Probe</div>
        <div class="zeile"><div class="leise">Home Assistant schickt dem Plug so lange kein Lebenszeichen und schaltet ihn nicht – nach 15 min übernimmt das Notprogramm. Danach vergleicht HA das Stundenbuch mit der eigenen Messung.</div></div>
        ${np.probe_bis ? `<div class="zeile"><span class="amber-t">⚗ Probe läuft bis ${this.npZeit(np.probe_bis, false)}</span><button class="knopf klein" data-act="np-probe" data-id="${esc(x.g.id)}" data-min="0">Beenden</button></div>`
          : `<div class="zeile"><span>Probe starten</span><div class="seg klein">${[30, 60, 120, 180].map(m => `<button data-act="np-probe" data-id="${esc(x.g.id)}" data-min="${m}">${m < 60 ? m + ' min' : m / 60 + ' h'}</button>`).join('')}</div></div>`}
        ${np.probe_ergebnis ? (e => z('Letzte Probe', `${this.npZeit(e.von)} – ${this.npZeit(e.bis, false)} · Stundenbuch ${de(e.buch_kwh, 2)} kWh, ${e.buch_min} min · HA ${de(e.ha_kwh, 2)} kWh, ${e.ha_min} min`))(np.probe_ergebnis) : ''}</div>` : ''}
      ${this.d.e.notprogramm ? knopf(this.s.npPrueft ? '⟳ prüft …' : '⟳ Jetzt prüfen', 'np-pruefen') : ''}${knopf('Schließen')}`;
  }
  einstGruppen() {
    const d = this.d, e = d.e, o = d.optionen, hz = this.hzTeile(), st = (k, s, fmt) => this.stepper(k, s, fmt), M = this.meldungen();
    this._einstAlt = null;
    const zeile = (t, x, sub = '') => `<div class="zeile"><div><b>${t}</b>${sub ? `<div class="leise">${sub}</div>` : ''}</div>${x}</div>`;
    const knopf = (t, wert, act, extra = '') => `<button class="zeile" data-act="${act}" ${extra}><span>${t}</span><span class="leise">${wert} ›</span></button>`;
    const liste = (titel, inhalt) => `<div class="glas-panel liste"><div class="gruppe">${titel}</div>${inhalt}</div>`;
    const nm = x => x ? esc(this.name(x)) : '–', wq = 'data-s="wetterquelle"', tk = o.termine_kalender || e.termine_kalender;
    const pumpen = d.bereiche.filter(b => b.pumpe), cont = d.bereiche.filter(b => !b.pumpe), geraete = d.bereiche.reduce((a, b) => a + b.geraete.length, 0);
    const mAn = ['m_offline', 'm_trocken', 'm_dauer', 'm_zyklen', 'm_leistung', 'm_frost', 'm_selbst', 'm_kalt', 'm_fuehler', 'm_wetter', 'm_hand'].filter(k => e[k]).length;
    const offen = M === null ? '–' : M.filter(m => this.meldungOffen(m)).length, ohneKopf = h => h.slice(Math.max(0, h.indexOf('<div class="glas-panel')));
    const dev = (this.s.evDev || 'meldungen') === 'meldungen';   // Entwicklung: dauerhafte Lit-Bereiche (src/ansichten/dev.js)
    return [
      { k: 'baustelle', ic: '🏗', t: 'Baustelle', kurz: `${esc(d.titel)} · ${this.bsZeit(d)}`, html: this.einstBlock('Baustelle')
        + liste('Wetter und Kalender', knopf('Wetter', o.wetter ? nm(o.wetter) : 'keins gewählt', 'sheet', wq) + knopf('Außentemperatur', o.temp_sensor ? nm(o.temp_sensor) : 'aus der Vorhersage', 'sheet', wq)
          + knopf('Regenmenge', o.regen_sensor ? nm(o.regen_sensor) : 'aus der Vorhersage', 'sheet', wq) + knopf('Urlaub', o.urlaub_kalender ? `Kalender „${nm(o.urlaub_kalender)}“` : 'kein Kalender', 'sheet', wq)
          + knopf('Feiertage', o.feiertag_kalender ? nm(o.feiertag_kalender) : 'kein Kalender', 'sheet', wq) + knopf('Termine (Bei Bedarf)', tk ? nm(tk) : 'kein Kalender', 'sheet', wq)) },
      { k: 'heizung', ic: '🔥', t: 'Heizung', kurz: `Automatik ${e.auto ? 'an' : 'aus'} · Soll ${de(e.soll)} °C · Vorheizen ${e.vorheizen} min`,
        html: liste('Automatik', zeile('Automatik', schalter(e.auto, 'auto'), 'die Integration schaltet die Heizungen nach Plan und Regeln'))
          + (hz.regeln || '') + (hz.trocknen || '') + (hz.urlaub || '')
          + liste('Zeiten', knopf('Arbeitszeit', 'ändern, neue ab Datum', 'hz-auf', 'data-k="az"') + knopf('Ausnahmen', 'einmalig', 'hz-auf', 'data-k="ausn"') + knopf('Heizplan · diese Woche', 'ansehen', 'hz-auf', 'data-k="plan"')) },
      this.npGruppe(),
      { k: 'container', ic: '🏠', t: 'Container & Geräte', kurz: `${cont.length} Container · ${pumpen.length} ${pumpen.length === 1 ? 'Schacht' : 'Schächte'} · ${geraete} Geräte`, html: this.einstBlock('Container und Geräte') + (hz.container || '') },
      (() => { const gl = this.geraeteListe(); return { k: 'geraete', ic: '🔌', t: 'Geräte', kurz: `${gl.n} Geräte${gl.offline ? ` · ${gl.offline} meldet nichts` : ' · alle erreichbar'}`, html: gl.html }; })(),
      { k: 'pumpen', ic: '💧', t: 'Pumpen', kurz: pumpen.length ? `offline nach ${e.offline_min} min · Trockenlauf unter ${e.trocken_w} W` : 'keine Schächte',
        html: liste('Überwachung der Pumpen', zeile('Offline – melden nach', st('offline_min', 1, v => `${v} min`)) + zeile('Trockenlauf unter', st('trocken_w', 5, v => `${v} W`))
          + zeile('Dauerlauf länger als', st('dauer_min', 5, v => `${v} min`)) + zeile('Schaltet oft ab', st('zyklen_h', 1, v => `${v} / h`))
          + pumpen.map(b => zeile(`♨ Automatik · ${esc(b.name)}`, schalter(b.auto, 'b-auto', `data-id="${b.id}"`))).join('')) },
      { k: 'strom', ic: '⚡', t: 'Strom & Staffelung', kurz: `${de(e.preis, 2)} €/kWh · Staffelung ${e.staffel ? 'an' : 'aus'}`, html: this.einstBlock('Strom') },
      { k: 'firmen', ic: '🏢', t: 'Firmen', kurz: `${d.firmen.length} ${d.firmen.length === 1 ? 'Firma' : 'Firmen'} für die Abrechnung`, html: this.einstBlock('Firmen · für die Abrechnung') },
      { k: 'meldungen', ic: '🔔', t: 'Meldungen', kurz: `${mAn} von 11 an${e.empfaenger ? ` · ${esc(e.empfaenger)}` : ''}`,
        html: this.einstBlock('Meldungen · Störungen') + liste('Schwellen der Hinweise', zeile('Zu kalt trotz Heizung nach', st('kalt_min', 15, v => `${v} min`))
          + zeile('Handbetrieb länger als', st('hand_h', 1, v => `${de(v)} h`)) + zeile('Tür offen – Nachricht nach', st('tuer_melden', 5, v => `${v} min`))) },
      { k: 'bericht', ic: '📊', t: 'Bericht', kurz: { aus: 'aus', woche: 'jede Woche', monat: 'jeden Monat', beides: 'Woche und Monat' }[e.bericht] || esc(e.bericht), html: this.einstBlock('Bericht') },
      { k: 'app', ic: '🖥', t: 'Ansicht', kurz: `Erklärungen ${e.erklaer ? 'an' : 'aus'} · Melden-Knopf ${e.melden ? 'an' : 'aus'}`,
        html: liste('Ansicht', zeile('Erklärungen anzeigen', schalter(e.erklaer, 'e-bool', 'data-k="erklaer"'), 'kurze Texte „ⓘ“ unter Heizung, Pumpen und Auswertung')
          + zeile('Melden-Knopf', schalter(e.melden, 'e-bool', 'data-k="melden"'), 'kleiner Knopf in jedem Fenster für Fehler, Wünsche und Anregungen')
          + '<button class="zeile" data-act="aw-vorlage" data-v="misch"><span>Auswertung auf Vorschlag zurücksetzen</span><span class="leise">gilt für diesen Browser</span></button>') },
      { k: 'dev', ic: '🛠', t: 'Entwicklung', kurz: `${offen} offene Meldungen · Diagnose`, dev: true,
        html: `<div class="seg ev-dev-reiter">${[['meldungen', 'Meldungen'], ['werkzeuge', 'Werkzeuge']].map(([k, t]) => `<button data-act="ev-dev" data-v="${k}" class="${(dev ? 'meldungen' : 'werkzeuge') === k ? 'on' : ''}">${t}</button>`).join('')}</div>`
          + (dev ? '<div data-lit="dev-meldungen"></div>' : '<div data-lit="dev-werkzeuge"></div>' + liste('Für Tests', '<button class="zeile" data-act="test-meldung"><span class="blau">Test-Nachricht senden</span></button><button class="zeile" data-act="sheet" data-s="nachrichten"><span>Beispiel-Nachrichten</span><span class="chev">›</span></button>')) },
      { k: 'ueber', ic: 'ℹ', t: 'Über', kurz: `Version ${esc(this.version)}`, html: '<div data-lit="ueber-einst"></div>' },
    ];
  }
  v_einst() {
    const G = this.einstGruppen(), g = G.find(x => x.k === this.s.evGruppe) || G[0], schmal = this.narrow;
    const nav = `<nav class="ev-nav glas-panel">${G.map(x => `${x.dev ? '<div class="ev-trenn"></div>' : ''}<button data-act="ev-gruppe" data-v="${x.k}" class="${x === g ? 'on' : ''}"><span class="ev-ic">${x.ic}</span><span>${x.t}</span><small>${x.kurz}</small></button>`).join('')}</nav>`;
    const chips = `<div class="ev-chips">${G.map(x => `<button class="glas-panel chip ${x === g ? 'amber' : ''}" data-act="ev-gruppe" data-v="${x.k}">${x.ic} ${x.t}</button>`).join('')}</div>`;
    return `${this.kopf('Einstellungen', esc(this.d.titel))}<div class="${schmal ? 'schmal' : ''}">${schmal ? chips : ''}<div class="ev-sl">${schmal ? '' : nav}
      <div class="ev-inhalt"><div class="ev-titel"><span class="ev-ic">${g.ic}</span><div><b>${g.t}</b><div class="leise">${g.kurz}</div></div></div>${g.html}</div></div></div>`;
  }
  einstBloecke() {
    const d = this.d, e = d.e, st = (k, s, fmt) => this.stepper(k, s, fmt), M = this.meldungen(), o = d.optionen;
    return `${this.kopf('Einstellungen', esc(d.titel))}
      <div class="glas-panel liste"><div class="gruppe">Baustelle</div>
        <button class="zeile" data-act="sheet" data-s="name"><span>Name</span><span class="leise">${esc(d.titel)} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="zeitraum-bs"><span>Beginn und Ende</span><span class="leise">${this.bsZeit(d)} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="zeitraum-bs"><span>Heizperiode</span><span class="leise">${MONATE[d.hp[0] - 1]} – ${MONATE[d.hp[1] - 1]} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="abschliessen"><span>Baustelle abschließen</span><span class="leise">kommt in den Verlauf ›</span></button>
        <button class="zeile" data-act="sheet" data-s="baustelle-neu"><span class="blau">+ Neue Baustelle</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">App</div>
        <button class="zeile" data-act="tab" data-v="ueber"><span>Über</span><span class="leise">Version ${esc(this.version)} ›</span></button>
        <div class="zeile"><div><b>Erklärungen anzeigen</b><div class="leise">kurze Texte „ⓘ“ unter Heizung, Pumpen und Auswertung</div></div>${schalter(e.erklaer, 'e-bool', 'data-k="erklaer"')}</div>
        <div class="zeile"><div><b>Melden-Knopf</b><div class="leise">kleiner Knopf in jedem Fenster für Fehler, Wünsche und Anregungen</div></div>${schalter(e.melden, 'e-bool', 'data-k="melden"')}</div>
        <button class="zeile" data-act="tab" data-v="dev"><span>Entwicklung</span><span class="leise">${M === null ? '–' : M.filter(m => this.meldungOffen(m)).length} offene Meldungen ›</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Firmen · für die Abrechnung</div>
        ${d.firmen.map(f => { const n = d.bereiche.filter(b => (b.firma || 'eigen') === f.id).length;
          return `<button class="zeile" data-act="firma-auf" data-id="${esc(f.id)}"><span>${esc(f.name)}${f.eigen ? ' <span class="badge">eigene</span>' : ''}</span><span class="leise">${n} Container ›</span></button>`; }).join('')}
        <button class="zeile" data-act="firma-auf"><span class="blau">+ Firma hinzufügen</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Container und Geräte</div>
        ${d.bereiche.map(b => `<button class="zeile" data-act="bereich-einst" data-id="${b.id}"><span><i class="farbpunkt" style="background:${BEREICH_FARBEN[b.f % 6]}"></i>${esc(b.name)}</span><span class="leise">${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'} ›</span></button>`).join('')}
        <button class="zeile" data-act="sheet" data-s="container-neu"><span class="blau">+ Container oder Schacht</span></button></div>
      <div class="glas-panel liste"><div class="gruppe">Strom</div>
        ${this.preisListe()}
        <div class="zeile"><div><b>⚡ Staffelung</b><div class="leise">verteilt die Heizungen auf den freien Strom – geschaltet werden nur Heizungen</div></div>${schalter(e.staffel, 'e-bool', 'data-k="staffel"')}</div>
        ${e.staffel ? `<div class="gruppe-t gt-einzug">Anschlüsse</div>
        ${d.anschluesse.map(a => `<button class="zeile unter" data-act="anschluss-auf" data-id="${esc(a.id)}"><div><b>${esc(a.name)}</b><div class="leise">${a.phasen === 3 ? '3 × ' : ''}${a.ampere} A · Reserve ${de(a.reserve)} kW · ${d.bereiche.filter(b => b.anschluss === a.id).map(b => esc(b.name)).join(', ') || 'keine Container'}</div></div><span class="chev">›</span></button>`).join('')}
        <button class="zeile unter" data-act="anschluss-auf"><span class="blau">+ Anschluss hinzufügen</span></button>
        <div class="zeile unter"><div><span>Nutzbar je Anschluss</span><div class="leise">vorsichtig, weil unbekannt ist, welche Steckdose an welcher Phase hängt</div></div>${st('nutzbar', 5, v => `${v} %`)}</div>
        <div class="zeile unter"><span>Höchstens gleichzeitig</span>${st('max_gleich', 1, v => `${v} Heizk.`)}</div>
        <div class="zeile unter"><span>Mindestlaufzeit</span>${st('min_lauf', 1, v => `${v} min`)}</div>
        <div class="zeile unter"><span>Mindestpause</span>${st('min_pause', 1, v => `${v} min`)}</div>
        <div class="zeile unter"><div><span>Wechsel im Rundlauf</span><div class="leise">wenn nicht alle gleichzeitig dürfen</div></div>${st('takt', 5, v => `${v} min`)}</div>
        <div class="zeile unter"><span class="leise">Gesamtzähler: keiner – gerechnet wird mit den Shellys und der Reserve je Anschluss. Später kann je Anschluss ein Zähler dazukommen.</span></div>
        <div class="gruppe-t gt-einzug">Vorrang, wenn nicht alle dürfen</div>
        ${d.bereiche.filter(b => !b.pumpe).map(b => `<div class="zeile unter"><span>${esc(b.name)}</span><div class="seg klein">${['niedrig', 'normal', 'hoch'].map(v => `<button data-act="prio" data-id="${b.id}" data-v="${v}" class="${(b.prio || 'normal') === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>`).join('')}
        <div class="leise p-fuss">Frostschutz geht immer vor. Pumpen und andere Verbraucher werden mitgezählt, aber nie geschaltet.</div>` : ''}</div>
      <div class="glas-panel liste"><div class="gruppe">Wetter und Kalender</div>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Wetter</span><span class="leise">${o.wetter ? esc(this.name(o.wetter)) : 'keins gewählt'} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Außentemperatur</span><span class="leise">${o.temp_sensor ? esc(this.name(o.temp_sensor)) : 'aus der Vorhersage'} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="urlaub"><span>Urlaub</span><span class="leise">${o.urlaub_kalender ? `Kalender „${esc(this.name(o.urlaub_kalender))}“` : 'kein Kalender'} ›</span></button>
        <div class="zeile"><span>Feiertage</span><span class="leise">${o.feiertag_kalender ? esc(this.name(o.feiertag_kalender)) : 'kein Kalender'}</span></div></div>
      <div class="glas-panel liste"><div class="gruppe">Bericht</div>
        <div class="zeile"><span>Wie oft</span><div class="seg klein">${[['aus', 'aus'], ['woche', 'Woche'], ['monat', 'Monat'], ['beides', 'beides']].map(([k, t]) => `<button data-act="e-wert" data-k="bericht" data-v="${k}" class="${e.bericht === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        ${e.bericht !== 'aus' ? `<div class="zeile unter"><span class="leise">${{ woche: 'jeden Montag 07:00 für die Vorwoche', monat: 'am 1. des Monats 07:00 für den Vormonat', beides: 'Montag 07:00 und am 1. des Monats' }[e.bericht] || ''}</span></div>
        <div class="zeile unter"><span>📱 aufs Handy</span>${schalter(e.bericht_handy, 'e-bool', 'data-k="bericht_handy"')}</div>
        <div class="zeile unter"><span>✉ per E-Mail</span>${schalter(e.bericht_mail, 'e-bool', 'data-k="bericht_mail"')}</div>
        ${e.bericht_mail ? `<label class="zeile unter"><span>an</span><input type="email" value="${esc(e.mail)}" data-k="mail" class="mail-feld"></label>
        <div class="zeile unter"><span>Abrechnung als CSV anhängen</span>${schalter(e.bericht_csv, 'e-bool', 'data-k="bericht_csv"')}</div>
        <div class="zeile unter"><span class="leise">über den Dienst notify.${esc(e.mail_dienst || 'baustelle_mail')} (z. B. Google Mail oder SMTP in HA eingerichtet)</span></div>` : ''}
        <button class="zeile" data-act="sheet" data-s="bericht"><span class="blau">Beispiel ansehen</span><span class="chev">›</span></button>
        <button class="zeile" data-act="bericht-senden"><span class="blau">Jetzt senden</span></button>` : ''}</div>
      <div class="glas-panel liste"><div class="gruppe">Meldungen · Störungen</div>
        <div class="zeile"><span>Empfänger</span><span class="leise">${esc(e.empfaenger)}</span></div>
        <div class="zeile"><div><b>Knöpfe in der Nachricht</b><div class="leise">direkt aus der Nachricht reagieren, z. B. „bis morgen stumm“</div></div>${schalter(e.knoepfe, 'e-bool', 'data-k="knoepfe"')}</div>
        <button class="zeile" data-act="sheet" data-s="nachrichten"><span class="blau">Beispiele ansehen</span><span class="chev">›</span></button>
        <button class="zeile" data-act="test-meldung"><span class="blau">Test-Nachricht senden</span></button>
        <div class="zeile"><span>Stromausfall / offline (nach ${de(e.offline_min, 0)} min)</span>${schalter(e.m_offline, 'e-bool', 'data-k="m_offline"')}</div>
        <div class="zeile"><span>Pumpe Trockenlauf (unter ${de(e.trocken_w, 0)} W)</span>${schalter(e.m_trocken, 'e-bool', 'data-k="m_trocken"')}</div>
        <div class="zeile"><span>Pumpe Dauerlauf über ${e.dauer_min} min</span>${schalter(e.m_dauer, 'e-bool', 'data-k="m_dauer"')}</div>
        <div class="zeile"><span>Pumpe schaltet oft (ab ${e.zyklen_h} je Stunde)</span>${schalter(e.m_zyklen, 'e-bool', 'data-k="m_zyklen"')}</div>
        <div class="zeile"><span>Heizkörper zieht keinen Strom</span>${schalter(e.m_leistung, 'e-bool', 'data-k="m_leistung"')}</div>
        <div class="zeile"><span>Frostgefahr trotz Frostschutz</span>${schalter(e.m_frost, 'e-bool', 'data-k="m_frost"')}</div>
        <div class="zeile"><span>Gerät schaltet sich selbst wieder ein (Auto-ON am Shelly?)</span>${schalter(e.m_selbst, 'e-bool', 'data-k="m_selbst"')}</div>
        <div class="gruppe">Hinweise</div>
        <div class="zeile"><span>Zu kalt trotz Heizung (nach ${e.kalt_min} min)</span>${schalter(e.m_kalt, 'e-bool', 'data-k="m_kalt"')}</div>
        <div class="zeile"><span>Fühler meldet nichts / Batterie schwach</span>${schalter(e.m_fuehler, 'e-bool', 'data-k="m_fuehler"')}</div>
        <div class="zeile"><span>Keine Wettervorhersage</span>${schalter(e.m_wetter, 'e-bool', 'data-k="m_wetter"')}</div>
        <div class="zeile"><span>Handbetrieb länger als ${e.hand_h} h</span>${schalter(e.m_hand, 'e-bool', 'data-k="m_hand"')}</div>
        <div class="leise p-fuss">Störungen, offene Tür und langer Handbetrieb kommen aufs Handy, andere Hinweise nur ins Protokoll und in den Warnung-Chip.</div></div>`;
  }

  /* ---- Auswahllisten aus HA (für die Einrichtungs-Dialoge) ---- */
  entitaeten(filter) {
    const eigene = new Set(this._eigene || []);
    return Object.values((this._hass && this._hass.states) || {}).filter(s => !eigene.has(s.entity_id) && filter(s))
      .map(s => [s.entity_id, s.attributes.friendly_name || s.entity_id]).sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }
  freieSchalter(auch) {
    const belegt = new Set(this.alle.filter(x => x.aktiv).flatMap(x => x.bereiche.flatMap(b => b.geraete.map(g => g.schalter))));
    return this.entitaeten(s => s.entity_id.startsWith('switch.') && (!belegt.has(s.entity_id) || s.entity_id === auch));
  }
  optionen(liste, aktuell, leer) { return (leer ? `<option value="">${leer}</option>` : '') + liste.map(([v, n]) => `<option value="${esc(v)}" ${v === aktuell ? 'selected' : ''}>${esc(n)}</option>`).join(''); }

  /* ---- Einblendungen von unten ---- */
  sheet() {
    const s = this.s.sheet, d = this.d, knopf = (t, act = 'zu', art = '') => `<button class="knopf ${art}" data-act="${act}">${t}</button>`;
    const griff = '<div class="griff"></div>';
    if (s.art === 'kk-katalog') return this.kkKatalog(s, griff);   // WU-0014
    if (s.art === 'np-plug') return this.npPlug(s, griff, knopf);   // BSM-019
    if (s.art === 'aussehen') return this.symDialog(s, griff, knopf);   // BSM-032
    if (s.art === 'verbrauch') return `${griff}${this.verbrauchInhalt(s, 'sheet', true)}${knopf('Schließen')}`;
    if (s.art === 'leistung') return `${griff}${this.leistungInhalt(s)}${knopf('Schließen')}`;
    if (s.art === 'heizzeit-c') return `${griff}${this.heizzeitInhalt(s)}${knopf('Schließen')}`;
    if (s.art === 'hz') { const T = this.hzTeile(), def = HZ_TEILE.find(x => x[0] === s.k) || HZ_TEILE[0];
      const inhalt = s.k === 'heute' ? T.heute + T.wann : s.k === 'az' ? T.az + T.ausn : T[s.k];
      return `${griff}<div class="block-kopf"><h3>${def[2]} ${esc(def[3])}</h3></div>${(inhalt || '').replace(/class="glas-panel block"/g, 'class="block hz-innen"')}${knopf('Schließen')}`; }
    if (s.art === 'wetter') {
      const a = s.wa || 'std', e = d.e, ws = this.zustand(d.wetterEid), w = d.wetter || {};
      const folge = (t, mm) => [zahl(t) && t < e.frueh_temp ? '<span class="w-folge blau">Frühstart</span>' : '', zahl(mm) && mm >= e.tr_mm ? '<span class="w-folge amber">Kleidung trocknen</span>' : '',
        zahl(t) && t > e.grenze ? '<span class="w-folge">über Heizgrenze</span>' : ''].join('');
      const H = this.vorhersage.hourly, D = this.vorhersage.daily, jetzt = d.z.jetztMs;
      let inhalt;
      if (a === 'std') {
        const std = (H || []).filter(x => Date.parse(x.datetime) > jetzt - 36e5).slice(0, 6);
        inhalt = H === null ? LAEDT : !std.length ? '<div class="leer">Keine stündliche Vorhersage</div>' : `<div class="w-std">${std.map(x => `<div><span class="leise">${this.lokal(x.datetime).slice(11, 13)}:00</span>${wetterIcon(this.nachtWetter(x.condition, Date.parse(x.datetime)), 36)}<b>${de(x.temperature, 0)}°</b>
          <span class="w-regen">${zahl(x.precipitation) && x.precipitation > 0 ? de(x.precipitation) + ' mm' : '–'}</span><span class="leise">${zahl(x.precipitation_probability) ? x.precipitation_probability : 0} %</span></div>`).join('')}</div>`;
      } else if (a === 'tag') {
        const teile = [['Morgen', 7], ['Mittag', 12], ['Nachmittag', 16], ['Nacht', 22]], jetztH = +d.z.JETZT.slice(0, 2);
        const tagSt = this.statistik('Tag'), aussen = tagSt && tagSt.werte[this.eid(d, d.entry, 'aussen')];
        const stunde = (tag, h) => (H || []).find(x => this.lokal(x.datetime).slice(0, 13) === `${tag} ${String(h).padStart(2, '0')}`);
        inhalt = H === null ? LAEDT : [['Heute', d.z.HEUTE], ['Morgen', plusTage(d.z.HEUTE, 1)]].map(([name, tag]) => `<div class="w-tag"><div class="w-tag-n">${name}</div><div class="w-teile">${teile.map(([t, h]) => {
          const x = stunde(tag, h), vorbei = tag === d.z.HEUTE && h < jetztH, temp = x ? x.temperature : vorbei && aussen ? aussen[h] : null;
          return `<div class="${vorbei ? 'vorbei' : ''}"><span class="leise">${t}</span>${wetterIcon(x ? this.nachtWetter(x.condition, Date.parse(x.datetime)) : (ws ? this.nachtWetter(ws.state) : 'cloudy'), 34)}<b>${zahl(temp) ? de(temp, 0) + '°' : '–'}</b><span class="w-regen">${x && zahl(x.precipitation) && x.precipitation > 0 ? de(x.precipitation) + ' mm' : '–'}</span></div>`; }).join('')}</div></div>`).join('');
      } else {
        const tage = (D || []).filter(x => this.lokal(x.datetime).slice(0, 10) > d.z.HEUTE).slice(0, 3);
        inhalt = D === null ? LAEDT : !tage.length ? '<div class="leer">Keine Tagesvorhersage</div>' : `<div class="w-3">${tage.map(x => { const t = this.lokal(x.datetime).slice(0, 10); return `<div class="w-3z">
          <div class="w-3t"><b>${wtag(t)}</b><span class="leise">${kurzDatum(t)}</span></div>${wetterIcon(x.condition, 40)}
          <div class="w-3w"><b>${de(x.temperature, 0)}°</b><span class="leise">${de(x.templow, 0)}°</span></div>
          <div class="w-3r"><span class="w-regen">${zahl(x.precipitation) && x.precipitation > 0 ? de(x.precipitation) + ' mm' : '–'}</span><span class="leise">${zahl(x.precipitation_probability) ? x.precipitation_probability : 0} %</span></div>
          <div class="w-3f">${folge(x.templow, x.precipitation)}</div></div>`; }).join('')}</div>`;
      }
      const [wz, wt, wtemp] = this.wetterJetzt(), gef = ws && ws.attributes.apparent_temperature;
      const morgen = plusTage(d.z.HEUTE, 1), pm = d.plan[morgen], wm = this.wetterTag(morgen), g = (pm && pm.gruende) || [];
      const fuer = [g.includes('frueher_nach_regen') ? `Kleidung trocknen morgen früh aktiv (Regen über ${de(e.tr_mm)} mm)` : '',
        g.includes('fruehstart') ? `Kälte-Frühstart morgen ${e.frueh_min} min früher${zahl(wm.kalt) ? ` (${de(wm.kalt, 0).replace('-', '−')} °C)` : ''}` : ''].filter(Boolean);
      return `${griff}<h3>Wetter · ${esc(this.name(d.wetterEid) || d.titel)}</h3><div class="w-jetzt">${wetterIcon(wz, 72)}<div><b>${zahl(wtemp) ? de(wtemp) + ' °C' : '–'}</b><div class="leise">${esc([ws ? WETTER_TEXT[this.nachtWetter(ws.state)] || ws.state : wt, zahl(w.regen_heute) && w.regen_heute > 0 ? `${de(w.regen_heute, w.regen_heute % 1 ? 1 : 0)} mm seit gestern` : '', zahl(gef) ? `gefühlt ${de(gef, 0)} °C` : ''].filter(Boolean).join(' · '))}</div></div></div>
        <div class="seg">${[['std', 'Stündlich'], ['tag', 'Tagesverlauf'], ['3', '3 Tage']].map(([k, t]) => `<button data-act="wa" data-v="${k}" class="${a === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="w-inhalt">${inhalt}</div>
        <div class="leise">Für die Heizung: ${fuer.length ? fuer.join(', ') + '.' : 'morgen nichts Besonderes.'}</div>${knopf('Schließen')}`;
    }
    if (s.art === 'warnungen') {
      const W = d.warnungen, karte = w => `<div class="wk ${w.stufe} ${w.stumm ? 'stumm' : ''}"><div class="wk-kopf"><b>${esc(this.bName(w.b))}</b><span class="leise">${this.seitText(w.seitIso)}</span></div>
        <div class="wk-titel">${esc(w.titel)}</div><div class="leise">${esc(w.hilfe)}</div>
        <div class="wk-knoepfe">${w.b && d.bereiche.some(b => b.id === w.b) ? `<button class="chip glas-panel" data-act="w-hin" data-id="${w.b}">Zum Container ›</button>` : ''}
          <button class="chip glas-panel" data-act="w-stumm" data-id="${esc(w.id)}">${w.stumm ? '🔔 wieder melden' : '🔕 bis morgen stumm'}</button></div></div>`;
      const gruppe = (titel, liste) => liste.length ? `<div class="gruppe-t">${titel} · ${liste.length}</div>${liste.map(karte).join('')}` : '';
      const offen = W.filter(w => !w.stumm);
      return `${griff}<div class="block-kopf"><h3>Warnungen</h3><span class="leise">${offen.length} offen</span></div>
        ${offen.length ? '' : '<div class="leer">Alles in Ordnung ✓</div>'}
        ${gruppe('Störungen', offen.filter(w => w.stufe === 'stoerung'))}${gruppe('Hinweise', offen.filter(w => w.stufe === 'hinweis'))}${gruppe('Stumm bis morgen', W.filter(w => w.stumm))}
        <button class="zeile" data-act="w-protokoll"><span class="blau">Alle Einträge im Protokoll</span><span class="chev">›</span></button>
        ${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'baustellen') return `${griff}<h3>Baustelle wählen</h3>${this.alle.map(b => `<div class="zeile bs-zeile"><button class="bs-wahl" data-act="bs-wahl" data-id="${esc(b.entry)}"><span>${esc(b.titel)}${d && b.entry === d.entry ? ' ✓' : ''}</span><span class="badge ${b.aktiv ? 'gruen' : ''}">${b.aktiv ? 'aktiv' : 'abgeschlossen'}</span></button>
        <button class="bs-ic" data-act="bs-bearbeiten" data-id="${esc(b.entry)}" title="Bearbeiten" aria-label="${esc(b.titel)} bearbeiten">✎</button><button class="x" data-act="sheet" data-s="bs-loeschen" data-id="${esc(b.entry)}" title="Löschen" aria-label="${esc(b.titel)} löschen">✕</button></div>`).join('')}
      <button class="zeile" data-act="sheet" data-s="baustelle-neu"><span class="blau">+ Neue Baustelle</span></button>`;
    if (s.art === 'bs-loeschen') { const x = this.alle.find(y => y.entry === s.id);
      if (!x) return `${griff}<h3>Baustelle löschen</h3><div class="leise">Diese Baustelle gibt es nicht mehr.</div>${knopf('Schließen', 'zu', 'leise-k')}`;
      return `${griff}<h3>„${esc(x.titel)}“ löschen?</h3><div class="leise">Die Baustelle wird aus HA entfernt – mit Containern, Geräten, Einstellungen und Zählern. Sie steht danach auch nicht im Verlauf. Die Messwerte der Shellys bleiben in HA.${x.aktiv ? ' Wer die Werte behalten will, schließt die Baustelle stattdessen ab.' : ''}</div>
        ${knopf('Endgültig löschen', 'bs-loeschen', 'rot')}${knopf('Abbrechen', 'zu', 'leise-k')}`; }
    if (s.art === 'heizplan') {
      const az = this.azJetzt;
      return `${griff}<div class="block-kopf"><h3>Heizplan · diese Woche</h3><span class="leise">${az ? `${esc(az.name)} · seit ${datum(az.ab)}` : 'keine Arbeitszeit'}</span></div>
        ${d.e.auto ? '' : '<div class="warn-k"><b>Automatik ist aus</b><div class="leise">Der Plan wird gerade nicht ausgeführt.</div></div>'}
        ${this.heizplanInhalt()}
        <div class="bedarf-dauer">${d.jetztBis ? `<button class="chip glas-panel amber" data-act="jetzt-aus">■ alle heizen bis ${d.jetztBis} – beenden</button>` : `<button class="chip glas-panel" data-act="jetzt-an">▶ alle jetzt 1 h heizen</button>`}<button class="chip glas-panel" data-act="ausn-neu" data-v="">+ Ausnahme</button></div>
        ${knopf('Arbeitszeit ändern', 'az-heizung', 'amber')}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'az') {
      const a = d.arbeitszeiten[s.i]; if (!a) { this.s.sheet = null; return ''; }
      const geplant = a.ab > this.z.HEUTE, aktuell = a === this.azJetzt;
      return `${griff}<div class="block-kopf"><h3>${esc(a.name)}</h3><span class="badge ${aktuell ? 'gruen' : geplant ? 'blau-b' : ''}">${aktuell ? 'gilt jetzt' : geplant ? 'geplant' : 'früher'}</span></div>
        <div class="leise">gilt ab ${datum(a.ab)}</div>
        ${TAGE.map(t => `<div class="zeile"><b class="tag-n">${t}</b><span>${a.tage[t] ? a.tage[t].join('–') : '<span class="leise">frei</span>'}</span></div>`).join('')}
        ${a.auto ? '<div class="leise">Automatisch angelegt – wird durch deine erste eigene Arbeitszeit ersetzt.</div>' : ''}
        ${knopf('Bearbeiten', 'az-bearbeiten', 'amber')}${knopf('Als Vorlage für eine neue', 'az-vorlage')}
        ${d.arbeitszeiten.length > 1 ? knopf('Löschen', 'az-weg', 'rot') : '<div class="leise">Die letzte Arbeitszeit lässt sich nicht löschen – ohne Arbeitszeit liefe nur der Frostschutz.</div>'}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'firma') {
      const f = s.form, neu = !f.id, eigen = !neu && this.firma(f.id).eigen;
      // wählbar: Container ohne fremde Firma, dazu die, die schon dieser Firma gehören
      const frei = d.bereiche.filter(b => (b.firma || 'eigen') === 'eigen' || (!neu && b.firma === f.id));
      return `${griff}<h3>${neu ? 'Neue Firma' : 'Firma'}</h3>
        <label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Trockenbau Maier" data-fn ${eigen ? 'disabled' : ''}></label>
        ${eigen ? `<div class="gruppe-t">Container der eigenen Firma</div>
          ${d.bereiche.filter(b => (b.firma || 'eigen') === 'eigen').map(b => `<div class="zeile"><span>${esc(b.name)}</span></div>`).join('')}
          <div class="leise">Hierher gehören alle Container, die keiner anderen Firma zugeordnet sind.</div>`
        : `<div class="gruppe-t">Container zuordnen</div>
          ${frei.length ? frei.map(b => `<div class="zeile"><span>${esc(b.name)}</span>${schalter(f.container.includes(b.id), 'firma-c', `data-id="${b.id}"`)}</div>`).join('')
            : '<div class="leise">Alle Container sind schon anderen Firmen zugeordnet.</div>'}
          ${f.neu.map((c, i) => `<div class="zeile fc-neu"><input value="${esc(c.name)}" placeholder="Name des Containers" data-fnc="${i}">
            <div class="seg klein">${['Container', 'Schacht'].map(a => `<button data-act="fc-art" data-i="${i}" data-v="${a}" class="${c.art === a ? 'on' : ''}">${a}</button>`).join('')}</div>
            <button class="x" data-act="fc-weg" data-i="${i}" title="nicht anlegen">✕</button></div>`).join('')}
          <button class="zeile" data-act="fc-neu"><span class="blau">+ Neuer Container für diese Firma</span></button>
          <div class="leise">Nur Container ohne andere Firma sind wählbar. Nimmst du einen weg, gehört er wieder der eigenen Firma. Frühere Werte bleiben bei der bisherigen Firma.</div>`}
        ${eigen ? knopf('Schließen', 'zu', 'leise-k') : knopf('Speichern', 'firma-speichern', 'amber') + (neu ? '' : knopf('Firma löschen', 'firma-weg', 'rot')) + knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'strom') {
      const L = this.last(), e = d.e;
      const zustand = x => x.b.offline || !x.g.erreichbar ? ['offline', 'rot-t'] : x.b.boost && x.g.an ? ['heizt – schnell, Vorrang', 'amber-t'] : x.b.z === 'pause' ? ['pausiert – Tür offen', 'lila']
        : x.g.warte ? [`wartet${zahl(x.g.warte.dran_in_min) ? ` – dran in ${x.g.warte.dran_in_min} min` : ''}`, 'blau']
        : x.g.an ? (zahl(x.g.kwJetzt) && x.g.kwJetzt < 0.05 ? ['an · zieht gerade nichts (Thermostat)', 'leise'] : [`heizt · ${de(zahl(x.g.kwJetzt) ? x.g.kwJetzt : x.g.kw, 2)} kW`, 'amber-t']) : ['aus', 'leise'];   // FE-0011: gemessen
      return `${griff}<div class="block-kopf"><h3>Stromverteilung</h3><span class="leise">${L.laufen} von ${L.hk.length} Heizkörpern an · höchstens ${L.max}</span></div>
        <div class="strom-leg"><span><i class="s-heiz"></i>Heizung ${de(L.heiz)} kW</span><span><i class="s-pumpe"></i>Pumpen ${de(L.pumpe)} kW</span><span><i class="s-sonst"></i>Sonstiges ${de(L.sonst)} kW</span><span><i class="s-res"></i>Reserve (Kran, Werkzeug)</span></div>
        ${L.A.map(a => { const w = v => `${a.grenze > 0 ? Math.max(0, v / a.grenze * 100) : 0}%`;
          return `<div class="an-block"><div class="an-kopf"><b>${esc(a.name)}</b><span class="leise">${a.phasen === 3 ? '3 × ' : ''}${a.ampere ?? '–'} A · ${de(a.heiz + a.pumpe + a.sonst)} von ${de(a.grenze)} kW</span></div>
          <div class="strom-spur"><i class="s-heiz" style="width:${w(a.heiz)}"></i><i class="s-pumpe" style="width:${w(a.pumpe)}"></i><i class="s-sonst" style="width:${w(a.sonst)}"></i><i class="s-res" style="width:${w(a.reserve)}"></i></div>
          <div class="leise">${a.frei < 2 ? `<span class="amber-t">nur ${de(Math.max(0, a.frei))} kW frei</span>` : `${de(a.frei)} kW frei`} für Heizungen</div>
          ${L.hk.filter(x => x.b.anschluss === a.id).map(x => { const [t, k] = zustand(x); return `<div class="zeile"><span>${esc(x.b.name)} · ${esc(x.g.n)}</span><span class="${k}">${t}</span></div>`; }).join('')}</div>`; }).join('')}
        ${e.staffel ? this.stromRang(L, zustand) : ''}
        <div class="hinweis-k">Je Anschluss gilt: ${e.nutzbar} % der Anschlussleistung (vorsichtig, weil die Verteilung auf die Phasen unbekannt ist) minus Reserve minus alles, was gerade läuft (gemessen). Gerechnet wird mit dem gemessenen Verbrauch: ein eingeschalteter Heizkörper, dessen Thermostat gerade abgeschaltet hat, zählt mit dem, was er zieht. Ist der Anschluss länger als 30 s zu voll, geht der unterste der Rangliste aus – bei gleichem Rang der größere. Die Rangliste: Frostschutz, Schnell aufheizen, erster im Container, Priorität, dann der Bedarf in °C (jetzt unter dem Soll + Abkühlen ohne Heizen − Nachlauf + was bis Arbeitsbeginn fehlt + wenig Heizzeit in der letzten Stunde). Ein Heizkörper kommt erst dazu, wenn eine Minute lang genug für seine volle Leistung frei ist. Jeder läuft mindestens ${e.min_lauf} min und pausiert mindestens ${e.min_pause} min; dürfen nicht alle, wechseln sie alle ${e.takt} min – der oberste Wartende gegen den untersten Laufenden. Jeder Container bekommt zuerst einen Heizkörper; ein zweiter im selben Container kommt erst dazu, wenn Platz ist, und verdrängt nie den einzigen eines anderen.</div>
        ${knopf('Anschlüsse einstellen', 'tab-einst', 'leise-k')}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'anschluss') {
      const f = s.form, neu = !f.id;
      return `${griff}<h3>${neu ? 'Neuer Anschluss' : 'Anschluss'}</h3>
        <label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Verteiler West" data-an="name"></label>
        <div class="zeile"><span>Absicherung</span><div class="seg klein">${[16, 32, 63].map(v => `<button data-act="an-wert" data-k="ampere" data-v="${v}" class="${f.ampere === v ? 'on' : ''}">${v} A</button>`).join('')}</div></div>
        <div class="zeile"><span>Art</span><div class="seg klein">${[3, 1].map(v => `<button data-act="an-wert" data-k="phasen" data-v="${v}" class="${f.phasen === v ? 'on' : ''}">${v === 3 ? 'Starkstrom (CEE)' : 'Schuko 230 V'}</button>`).join('')}</div></div>
        <div class="zeile"><div><span>Reserve</span><div class="leise">für Ungemessenes wie Kran oder Werkzeug</div></div><span class="stepper"><button data-act="an-res" data-d="-1">−</button><b>${de(f.reserve)} kW</b><button data-act="an-res" data-d="1">+</button></span></div>
        <div class="leise">Anschlussleistung ${de(f.ampere * .23 * f.phasen)} kW, davon rechnet die Staffelung mit ${d.e.nutzbar} % = ${de(f.ampere * .23 * f.phasen * d.e.nutzbar / 100)} kW, abzüglich ${de(f.reserve)} kW Reserve.</div>
        <div class="gruppe-t">Container an diesem Anschluss</div>
        ${d.bereiche.map(b => `<div class="zeile"><span>${esc(b.name)} <span class="leise">${f.container.includes(b.id) ? '' : '· ' + esc(this.anschluss(b.anschluss).name)}</span></span>${schalter(f.container.includes(b.id), 'an-c', `data-id="${b.id}"`)}</div>`).join('')}
        <div class="leise">Ein Container hängt an genau einem Anschluss.</div>
        ${knopf('Speichern', 'an-speichern', 'amber')}${!neu && d.anschluesse.length > 1 ? knopf('Anschluss löschen', 'an-weg', 'rot') : ''}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'nachrichten') {
      // Beispiele mit echten Containern: bevorzugt der, auf den es gerade passt (offline, Tür offen, Gerät auf Hand)
      const B = d.bereiche, c = k => (B[k] || B[0] || { name: 'Container', id: '' });
      const wOff = d.warnungen.find(w => w.art === 'offline' && w.b), GB = B.flatMap(b => b.geraete.map(g => ({ b, g })));
      const off = (wOff && B.find(b => b.id === wOff.b)) || B.find(b => b.offline) || c(0);   // Container der Warnung „nicht erreichbar“
      const pumpe = B.find(b => b.pumpe), steck = GB.find(x => x.g.hand && !x.g.heizer) || GB.find(x => x.g.hand) || GB.find(x => !x.g.heizer && x.g.rolle !== 'pumpe');
      const n = (ic, titel, text, knoepfe, b) => `<div class="noti"><div class="noti-kopf"><span class="noti-app">🏗 Home Assistant · jetzt</span></div><b>${ic} ${esc(titel)}</b><div>${esc(text)}</div>
        ${d.e.knoepfe ? `<div class="noti-knoepfe">${knoepfe.map(k => `<button data-act="n-knopf" data-t="${k}" data-b="${b || ''}">${k}</button>`).join('')}</div>` : ''}</div>`;
      const tuer = B.find(b => b.tuer && b.tuer.offen) || B.find(b => b.tuer) || c(0), p = this.planTag(TAGE[(TAGE.indexOf(this.z.HEUTE_TAG) + 1) % 7]);
      const frueh = p ? p.vor - d.e.frueh_min : null;   // Frühstart; „Noch früher“ startet 30 min davor (Integration: laufzeit.frueher)
      return `${griff}<h3>Nachrichten aufs Handy</h3><div class="leise">So kommen sie in der Home-Assistant-App an. ${d.e.knoepfe ? 'Tippe einen Knopf zum Ausprobieren.' : 'Knöpfe sind ausgeschaltet.'}</div>
        ${n('⚠', `${off.name} nicht erreichbar`, 'Seit 10:42 keine Antwort – Stromausfall oder Stecker gezogen?', ['Zum Container', 'Bis morgen stumm'], off.id)}
        ${n('🚪', `${tuer.name}: Tür seit ${d.e.tuer_melden} min offen`, 'Die Heizung ist pausiert und heizt wieder, sobald die Tür zu ist.', ['Trotzdem heizen', '1 h stumm'], tuer.id)}
        ${n('❄', 'Morgen −4 °C', `Vorheizen startet schon um ${p ? uhr(frueh) : '05:30'}. Arbeitsbeginn ${p ? uhr(p.a) : '07:00'}.`, ['Morgen nicht heizen', `Noch früher (${p ? uhr(frueh - 30) : '05:00'})`])}
        ${n('✋', `${steck ? `${steck.g.n} ${steck.b.name}` : (pumpe ? pumpe.name : c(0).name)} seit ${d.e.hand_h} h auf Hand`, 'Von Hand eingeschaltet und nicht zurückgestellt.', ['Automatik übernehmen', 'So lassen'], steck ? steck.b.id : c(0).id)}
        <div class="leise">Die Knöpfe sind Aktionen der HA-App (mobile_app). Ein Tipp löst die Aktion aus und landet im Protokoll.</div>${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'bericht') {
      // Inhalt kommt von der Integration (baustelle/bericht) – dieselben Zahlen und Texte, die der Bericht verschickt
      const e = d.e, art = e.bericht === 'monat' ? 'monat' : 'woche';
      const v = !d.geladen ? null : this._holen(`b:${d.entry}:${art}:${d.z.HEUTE}:${e.bericht_mail}:${e.bericht_csv}:${e.mail}`, () => this._hass.callWS({ type: 'baustelle/bericht', entry_id: d.entry, art }), 120000);
      if (!v) return `${griff}<h3>Bericht · Beispiel</h3>${v === undefined ? LAEDT : '<div class="leer">Bericht nicht verfügbar</div>'}${knopf('Schließen', 'zu', 'leise-k')}`;
      return `${griff}<h3>Bericht · Beispiel</h3>
        <div class="mail"><div class="mail-kopf"><div><span class="leise">An</span> ${v.mail_an ? esc(v.mail_an) : '—'}</div><div><span class="leise">Betreff</span> ${esc(v.betreff)}</div>
          ${v.anhang ? `<div class="mail-anhang">📎 ${esc(v.anhang)}</div>` : ''}</div>
          <div class="mail-inhalt"><b>${esc(v.summe)}</b> ${v.vergleich ? `<span class="leise">${esc(v.vergleich)}</span>` : ''}
            <div class="mail-t">Je Firma</div>${(v.firmen || []).map(f => `<div class="mail-z"><span>${esc(f.name)}</span><span>${de(f.kwh, 0)} kWh · ${de(f.eur, 2)} €</span></div>`).join('') || '<div class="mail-z"><span>–</span></div>'}
            <div class="mail-t">Je Container</div>${(v.container || []).map(c => `<div class="mail-z"><span>${esc(c.name)}</span><span>${de(c.kwh, 0)} kWh</span></div>`).join('')}
            <div class="mail-t">Heizung</div><div class="mail-z"><span>Heiztage</span><span>${zahl(v.heiztage) ? v.heiztage : '–'}</span></div><div class="mail-z"><span>gespart durch Automatik</span><span>${zahl(v.gespart_eur) ? `${de(v.gespart_eur, 0)} €` : '–'}</span></div>
            <div class="mail-t">Offene Warnungen</div>${(v.warnungen || []).map(w => `<div class="mail-z"><span>${esc(w.bereich ? `${w.bereich}: ${w.titel}` : w.titel)}</span></div>`).join('') || '<div class="mail-z"><span>keine</span></div>'}</div></div>
        <div class="leise">${e.bericht_handy ? 'Aufs Handy kommt eine Kurzfassung (Summe, Kosten, Warnungen) mit Knopf „Bericht öffnen“. ' : ''}Die E-Mail geht über einen Mail-Dienst in HA (Google Mail oder SMTP); die Zugangsdaten stehen in secrets.yaml.</div>
        ${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'bedarf') {
      const b = d.bereiche.find(x => x.id === s.cid); if (!b) { this.s.sheet = null; return ''; }
      const ende = this.arbeitsende(), warm = b.t !== null ? Math.max(0, Math.round((this.sollVon(b) - b.t) * 4)) : null;
      return `${griff}<h3>${esc(b.name)} heizen</h3><div class="leise">Jetzt ${b.t !== null ? `${de(b.t)} °C` : 'ohne Fühler'} · wird ${b.t !== null ? `in etwa ${warm} min warm` : 'sofort eingeschaltet'}</div>
        <div class="zeile"><div><b>⚡ Schnell aufheizen</b><div class="leise">alle Heizkörper zugleich, Vorrang in der Staffelung</div></div>${schalter(s.boost, 'bedarf-boost')}</div>
        <div class="bedarf-dauer gross">${[['60', '1 Stunde'], ['120', '2 Stunden'], ...(ende ? [['ende', `bis Arbeitsende (${ende})`]] : []), ['abend', 'bis 19:00']].map(([v, t]) => `<button class="knopf" data-act="bedarf-an" data-id="${b.id}" data-v="${v}">▶ ${t}</button>`).join('')}</div>
        <button class="zeile" data-act="sheet" data-s="termin" data-id="${b.id}"><span class="blau">Lieber einen Termin eintragen</span><span class="chev">›</span></button>
        ${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'termin') {
      const f = s.form, kal = d.termineKal;
      return `${griff}<h3>Termin eintragen</h3>
        <label class="feld">Titel<input value="${esc(f.titel)}" placeholder="z. B. Baubesprechung" data-tm="titel"></label>
        <label class="feld">${f.wieder === 'einmal' ? 'Tag' : 'Ab (Wochentag gilt für die Serie)'}<input type="date" value="${f.datum}" data-tm="datum"></label>
        <div class="zeile"><span>Wiederholen</span><div class="seg klein">${Object.entries(WIEDER).map(([k, t]) => `<button data-act="tm-wieder" data-v="${k}" class="${f.wieder === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <div class="zeile"><div><b>⚡ Schnell aufheizen</b><div class="leise">vor dem Termin alle Heizkörper zugleich</div></div>${schalter(f.boost, 'tm-boost')}</div>
        <div class="raster-2"><label class="feld">von<input type="time" value="${f.von}" data-tm="von"></label><label class="feld">bis<input type="time" value="${f.bis}" data-tm="bis"></label></div>
        ${f.wieder !== 'einmal' && f.datum ? `<div class="leise">Serie: ${WIEDER[f.wieder]} am ${wtag(f.datum)} ab ${datum(f.datum)}</div>` : ''}
        <div class="leise">Kommt in den HA-Kalender „${esc(kal ? this.name(kal) : 'Termine')}“ (Serien als Wiederholung im Kalender). Die Heizung startet ${d.e.vorheizen} min vorher (Vorheizen) und hört zum Ende auf.</div>
        ${knopf('Eintragen', 'termin-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'preis-neu') {
      return `${griff}<h3>Neuer Strompreis</h3><label class="feld">gilt ab<input type="date" value="${s.ab}" data-sp="ab"></label>
        <label class="feld">Preis je kWh<input type="number" step="0.01" min="0" value="${s.preis}" data-sp="preis"></label>
        <div class="leise">Bis zu diesem Tag gilt weiter der bisherige Preis – Vergangenes bleibt, wie es war.</div>${knopf('Speichern', 'sp-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'm-bild') {   // WU-0016: Bild einer Meldung groß
      const m = (this.meldungen() || []).find(x => x.id === s.id), u = m && this.mlBild(m, s.i);
      return `${griff}<h3>${esc((m && m.ticket) || 'Meldung')} · Bild ${s.i + 1}</h3>${u ? `<img class="mb-gross" src="${u}" alt="Bild">` : LAEDT}${knopf('Schließen')}`;
    }
    if (s.art === 'ausnahme') {
      const f = s.form, az = this.azJetzt, z = az && az.tage[wtag(f.datum)];
      return `${griff}<h3>Ausnahme</h3>
        <label class="feld">Tag<input type="date" value="${f.datum}" data-au="datum"></label>
        <div class="leise">${wtag(f.datum)} ${kurzDatum(f.datum)} · laut Arbeitszeit ${z ? z.join('–') : 'frei'}</div>
        <div class="seg">${Object.entries(AUSNAHME).map(([k, t]) => `<button data-act="au-art" data-v="${k}" class="${f.art === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        ${f.art === 'frei' ? '<div class="leise">An diesem Tag wird nicht geheizt, nur der Frostschutz läuft.</div>'
          : `<div class="raster-2"><label class="feld">von<input type="time" value="${f.von}" data-au="von"></label><label class="feld">bis<input type="time" value="${f.bis}" data-au="bis"></label></div>
          <div class="leise">Vorheizen ${d.e.vorheizen} min und Nachheizen ${d.e.nachheizen} min gelten auch hier – geheizt wird ${uhr(minu(f.von) - d.e.vorheizen)}–${uhr(minu(f.bis) + d.e.nachheizen)}.</div>`}
        ${(() => { const schon = d.ausnahmen.filter(a => a.datum === f.datum); if (!schon.length) return '';   // FE-0012
          const p = this.planIso(f.datum);
          return `<div class="am-schon">An diesem Tag schon eingetragen: ${schon.map(a => `<b>${a.art === 'frei' ? 'frei' : `${a.von}–${a.bis}`}</b> ${AUSNAHME[a.art]}`).join(', ')}<br>
            ${f.art === 'frei' ? '„Frei“ ersetzt alle Zeitfenster dieses Tages.' : 'Das neue Fenster kommt dazu – nichts wird überschrieben. Grenzt es an die Arbeitszeit, verlängert es sie (mit Vor-/Nachheizen); sonst heizt es genau seine Zeit.'}
            ${p && f.art !== 'frei' ? `<div class="am-strahl" style="margin-left:0">${this.zeitstrahl(p)}</div><div class="leise">bisher: ${this.planFensterText(p)}</div>` : ''}</div>`; })()}
        <label class="feld">Notiz<input value="${esc(f.notiz)}" placeholder="z. B. Betonieren" data-au="notiz"></label>
        ${knopf('Speichern', 'au-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'az-neu') {
      const f = s.form, aendern = f.alt_ab !== undefined;
      return `${griff}<h3>${aendern ? 'Arbeitszeit bearbeiten' : 'Neue Arbeitszeit'}</h3>
        <div class="raster-2"><label class="feld">Gilt ab<input type="date" value="${f.ab}" data-azn="ab"></label><label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Winter" data-azn="name"></label></div>
        ${TAGE.map(t => { const z = f.tage[t]; return `<div class="zeile azn"><b class="tag-n">${t}</b>${schalter(!!z, 'azn-tag', `data-t="${t}"`)}
          ${z ? `<input type="time" value="${z[0]}" data-azt="${t}" data-p="0"><span class="leise">bis</span><input type="time" value="${z[1]}" data-azt="${t}" data-p="1">` : '<span class="leise frei">frei</span>'}</div>`; }).join('')}
        <button class="zeile" data-act="azn-wie-mo"><span class="blau">Di–Do wie Montag</span></button>
        <div class="leise">${aendern ? 'Es gilt immer die jüngste Arbeitszeit, die schon begonnen hat.' : 'Die bisherige Arbeitszeit bleibt gespeichert. Liegt das Datum in der Zukunft, gilt die neue automatisch ab diesem Tag.'}
          ${d.arbeitszeiten.some(x => x.auto) ? ' Die automatisch angelegte Arbeitszeit fällt beim Speichern weg.' : ''}</div>
        ${knopf('Speichern', 'azn-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'container-neu') {
      const f = s.form, schacht = f.art === 'Pumpenschacht';
      const fuehler = this.entitaeten(x => (x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'temperature') || x.entity_id.startsWith('climate.'));
      return `${griff}<h3>Neuer Container</h3>
      <label class="feld">Name<input value="${esc(f.name)}" placeholder="z. B. Lager Nord" data-neu="name"></label>
      <div class="feld">Art<div class="seg klein">${['Container', 'Pumpenschacht'].map(v => `<button data-act="neu-art" data-v="${v}" class="${f.art === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <label class="feld">Temperaturfühler<select data-neu="fuehler">${this.optionen(fuehler, f.fuehler, '– keiner –')}</select></label>
      <label class="feld">Shelly<select data-neu="schalter">${this.optionen(this.freieSchalter().map(([v, n]) => [v, `${n} (${v})`]), f.schalter, '– später –')}</select></label>
      ${f.schalter ? `<label class="feld">${schacht ? 'Welches Gerät hängt an diesem Shelly?' : 'Welche Heizung hängt an diesem Shelly?'}<select data-neu="typ">${this.optionen((schacht ? ['Pumpe'] : ['Ölradiator', 'Konvektor']).map(t => [t, t]), f.typ)}</select></label>`
        : `<div class="leise">Ohne Shelly wird nur der ${schacht ? 'Schacht' : 'Container'} angelegt – ${schacht ? 'Pumpen' : 'Heizungen'} kommen später unter „Bearbeiten“ dazu.</div>`}
      ${knopf('Anlegen', 'neu-anlegen', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'bereich') {
      const b = this.b; if (!b) { this.s.sheet = null; return ''; }
      const e = s.edit ||= { bedarf: !!b.bedarf, name: b.name, anschluss: b.anschluss || (d.anschluesse[0] && d.anschluesse[0].id) || '', tuer: (b.tuer && b.tuer.eid) || '', firma: b.firma || 'eigen', fuehler: b.fuehler || '',
        groesseArt: (b.groesse && b.groesse.art) || 'einzel', m2: b.groesse ? b.groesse.m2 : null,
        geraete: b.geraete.map(g => ({ id: g.id, n: g.n, typ: g.typ, schalter: g.schalter, leistung: g.leistung, energie: g.energie, alt: { n: g.n, typ: g.typ } })) };
      const typen = b.pumpe ? ['Pumpe'] : ['Ölradiator', 'Konvektor', 'Bautrockner', 'Steckdose'];
      const wahl = (i, g) => `<select data-ge="typ" data-i="${i}">${typen.map(t => `<option ${g.typ === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      const tueren = this.entitaeten(x => x.entity_id.startsWith('binary_sensor.') && ['door', 'window', 'opening', 'garage_door'].includes(x.attributes.device_class));
      const fuehler = this.entitaeten(x => (x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'temperature') || x.entity_id.startsWith('climate.'));
      if (e.fuehler && !fuehler.some(x => x[0] === e.fuehler)) fuehler.unshift([e.fuehler, this.name(e.fuehler)]);
      if (e.tuer && !tueren.some(x => x[0] === e.tuer)) tueren.unshift([e.tuer, this.name(e.tuer)]);
      return `${griff}<div class="block-kopf"><h3>Bearbeiten</h3><span class="leise">${b.pumpe ? 'Pumpenschacht' : 'Container'}</span></div>
        <label class="feld">Name<input value="${esc(e.name)}" data-b="name"></label>
        ${!b.pumpe && b.geraete.filter(g => g.heizer).length >= 2 ? `<div class="zeile"><div><b>🔥 Zusatz-Heizkörper nur bei Bedarf</b><div class="leise">zuerst heizt einer; der Zusatz kommt bei Kälte, weit unter dem Soll oder wenn einer es nicht schafft. Welcher Zusatz ist, steht im Gerät.</div></div>${schalter(b.stufenAn, 'b-stufen')}</div>` : ''}
        ${b.pumpe ? '' : `<div class="zeile"><div><b>Nur bei Bedarf heizen</b><div class="leise">z. B. Besprechungscontainer: heizt nur per Schalter oder Termin, sonst Frostschutz</div></div>${schalter(e.bedarf, 'ge-bedarf')}</div>`}
        ${b.lern && b.lern.warm ? (() => { const w = { vor: b.warmVor ?? d.e.warm_vor, nach: b.warmNach ?? d.e.warm_nach, vor_eigen: b.warmVor !== null, nach_eigen: b.warmNach !== null }, sw = (k, v, eigen, f) => `<span class="stepper klein"><button data-act="warm-eigen" data-k="${k}" data-d="-5">−</button><b class="${eigen ? 'eigen' : ''}">${f(v)}</b><button data-act="warm-eigen" data-k="${k}" data-d="5">+</button></span>`;
          return `<div class="gruppe-t">🧠 Warm ab</div><div class="zeile"><div><span>Soll erreicht</span><div class="leise">${w.vor_eigen ? 'eigener Wert' : 'wie die Baustelle'}</div></div>${sw('vor', w.vor, w.vor_eigen, v => v ? `${v} min vorher` : 'bei Beginn')}</div>
            <div class="zeile"><div><span>Warm halten</span><div class="leise">${w.nach_eigen ? 'eigener Wert' : 'wie die Baustelle'}</div></div>${sw('nach', w.nach, w.nach_eigen, v => v ? `${v} min länger` : 'bis Ende')}</div>
            ${w.vor_eigen || w.nach_eigen ? '<button class="zeile" data-act="warm-zurueck"><span class="blau">Wie die Baustelle</span></button>' : ''}`; })() : ''}
        ${b.pumpe || !b.groesse ? '' : this.groesseBlock(b, e)}
        ${b.pumpe ? '' : `<div class="glas-panel liste"><button class="zeile sym-zeile" data-act="sym-auf"><span class="sym-mini">${bcContainer(BEREICH_FARBEN[b.f % BEREICH_FARBEN.length], 'aus', b)}</span><div><b class="blau">🏠 Aussehen</b><div class="leise">${b.symbol && b.symbol.doppel ? 'Doppel' : 'Einzel'} · ${b.symbol ? b.symbol.tueren.length : 1} ${b.symbol && b.symbol.tueren.length === 2 ? 'Türen' : 'Tür'} · ${b.symbol ? b.symbol.fenster.length : 1} Fenster · Farbe, Sensoren</div></div><span class="chev">›</span></button></div>`}
        ${b.pumpe ? '' : `<label class="feld">Temperaturfühler<select data-bfu>${this.optionen(fuehler, e.fuehler, '– keiner –')}</select></label>`}
        ${b.pumpe ? '' : `<label class="feld">Türkontakt<select data-btuer>${this.optionen(tueren, e.tuer, 'keiner')}</select></label>`}
        <label class="feld">Stromanschluss<select data-ban>${d.anschluesse.map(a => `<option value="${esc(a.id)}" ${e.anschluss === a.id ? 'selected' : ''}>${esc(a.name)} · ${a.phasen === 3 ? '3 × ' : ''}${a.ampere} A</option>`).join('')}</select></label>
        <label class="feld">Firma · für die Abrechnung<select data-bf="firma">${d.firmen.map(f => `<option value="${esc(f.id)}" ${e.firma === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
        <div class="gruppe-t">${b.pumpe ? 'Pumpen' : 'Geräte'} · ${e.geraete.filter(g => !g.weg).length}</div>
        ${e.geraete.map((g, i) => g.weg ? `<div class="ge-zeile weg"><span>${esc(g.n)} wird entfernt</span><button class="chip glas-panel" data-act="ge-zurueck" data-i="${i}">rückgängig</button></div>`
          : `<div class="ge-zeile"><div class="ge-felder">
            ${g.neu ? `<select data-ge="schalter" data-i="${i}">${this.optionen(this.freieSchalter().map(([v, n]) => [v, `${n} (${v})`]), g.schalter, '– Shelly wählen –')}</select>` : `<span class="leise ge-shelly">${esc(this.name(g.schalter))} · ${esc(g.schalter)}</span>`}
            <div class="ge-zwei"><input value="${esc(g.n)}" data-ge="n" data-i="${i}" placeholder="Name">${wahl(i, g)}</div></div>
            ${g.neu ? '' : `<button class="bs-ic" data-act="g-bearbeiten" data-i="${i}" title="Gerät bearbeiten" aria-label="${esc(g.n)} bearbeiten">✎</button>`}<button class="x" data-act="ge-weg" data-i="${i}" title="Gerät entfernen">✕</button></div>`).join('')}
        <button class="zeile" data-act="ge-neu"><span class="blau">+ Gerät hinzufügen</span></button>
        <div class="leise">Der Heizkörpertyp gilt nur für den Vergleich Ölradiator/Konvektor. Entfernte Geräte behalten ihre Werte im Verlauf.</div>
        ${knopf('Speichern', 'b-speichern', 'amber')}${knopf('Container entfernen', 'b-weg', 'rot')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'zeitraum-bs') { const f = s.form;
      const mon = i => `<select data-hp="${i}">${MONATE.map((m, k) => `<option value="${k + 1}" ${f.hp[i] === k + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select>`;
      return `${griff}<h3>Beginn, Ende, Heizperiode</h3>
      <div class="raster-2"><label class="feld">Beginn<input type="date" value="${esc(f.beginn)}" data-bsz="beginn"></label><label class="feld">Ende (geplant)<input type="date" value="${esc(f.ende)}" data-bsz="ende"></label></div>
      <div class="leise">Gezählt wird ab Beginn. <b>Beginn leer</b> = automatisch der Tag, an dem die Baustelle angelegt wurde${this.d.beginnAuto && this.d.beginn ? ` (${datum(this.d.beginn)})` : ''}.
        <b>Ende leer</b> = offen; beim Abschließen wird immer der Tag des Abschließens eingetragen – ein geplantes Ende dient nur der Hochrechnung.</div>
      <div class="raster-2"><label class="feld">Heizperiode von${mon(0)}</label><label class="feld">bis${mon(1)}</label></div>
      <div class="leise">Die Auswertung rechnet Verbrauch und Kosten auf die Heizperiode hoch – bis zum Ende der Baustelle, wenn es früher liegt.</div>
      ${knopf('Speichern', 'bsz-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`; }
    /* AN-0002: ✎ im Dialog „Baustellen“ – nur die Daten dieser Baustelle; Staffelung, Bericht, Meldungen und App bleiben unter Einstellungen */
    if (s.art === 'aw-detail') {   // WU-0005: Details einer Kachel/Karte der Auswertung
      const T = this._awTeile, html = T ? this.awStueck(s.k, T.B, T.A, T.z) : '';
      return `${griff}<div class="aw-detail">${html || '<div class="leer">Nur für diese Baustelle</div>'}</div>${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    /* WU-0004: Gerät bearbeiten – Name, Shelly, Typ, Container, Leistungs-/Energiesensor (leer = automatisch), aktiv */
    if (s.art === 'geraet-edit') {
      const b = this.b, g = b && b.geraete[s.i]; if (!g) { this.s.sheet = null; return ''; }
      const f = s.form, typen = ['Ölradiator', 'Konvektor', 'Bautrockner', 'Steckdose'];
      const leistung = this.entitaeten(x => x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'power');
      const energie = this.entitaeten(x => x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'energy');
      const auto = (eid, eigen) => `automatisch${!eigen && eid ? ` · ${this.name(eid) || eid}` : ''}`;
      return `${griff}<div class="block-kopf"><h3>Gerät bearbeiten</h3><span class="leise">${esc(b.name)}</span></div>
        <label class="feld">Name<input value="${esc(f.n)}" data-gf="n"></label>
        <label class="feld">Shelly (Schalter)<select data-gf="schalter">${this.optionen(this.freieSchalter(g.schalter).map(([v, n]) => [v, `${n} (${v})`]), f.schalter)}</select></label>
        <div class="raster-2"><label class="feld">Typ<select data-gf="typ">${typen.map(t => `<option ${f.typ === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="feld">Container<select data-gf="bereich">${this.optionen(d.bereiche.filter(x => !x.pumpe).map(x => [x.id, x.name]), f.bereich)}</select></label></div>
        <label class="feld">Leistungssensor<select data-gf="leistung">${this.optionen(leistung, f.leistung, auto(g.leistung, g.leistungEigen))}</select></label>
        <label class="feld">Energiesensor<select data-gf="energie">${this.optionen(energie, f.energie, auto(g.energie, g.energieEigen))}</select></label>
        <div class="zeile"><div><b>Aktiv</b><div class="leise">aus: die Automatik schaltet das Gerät nicht, es zählt nicht in der Staffelung, keine Warnungen</div></div>${schalter(f.aktiv, 'gf-aktiv')}</div>
        ${!g.leistung ? `<div class="zeile"><div><b>Leistung ohne Messung</b><div class="leise">zählt so in der Staffelung, wenn das Gerät an ist${g.nennKwEigen === null ? ' · Standard' : ''}</div></div><span class="stepper klein"><button data-act="g-kw" data-id="${g.id}" data-d="-0.1">−</button><b class="${g.nennKwEigen !== null ? 'eigen' : ''}">${de(g.nennKwEigen ?? g.kw, 1)} kW</b><button data-act="g-kw" data-id="${g.id}" data-d="0.1">+</button></span></div>` : ''}
        ${g.heizer && b.geraete.filter(x => x.heizer).length >= 2 ? `<div class="zeile"><div><b>🔥 Zusatz-Heizkörper</b><div class="leise">${b.stufenAn ? 'heizt nur dazu, wenn einer nicht reicht' : 'wirkt, wenn im Container „Zusatz nur bei Bedarf“ an ist'}${b.stufen && b.stufen.haupt.includes(g.id) && !g.zusatz ? ' · jetzt der erste' : ''}</div></div>${schalter(g.zusatz, 'g-zusatz', `data-id="${g.id}"`)}</div>` : ''}
        <div class="leise">Neuer Shelly: die Werte des alten bleiben im Verlauf. Anderer Container: der Verbrauch zählt ab jetzt dort.</div>
        ${knopf('Speichern', 'gf-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    /* Lernende Regelung (0.8): Lernstand eines Containers (Mockup glas.html, abgenommen 30.09.2026) */
    if (s.art === 'lernen') {
      const b = this.b, l = b && b.lern; if (!l) { this.s.sheet = null; return ''; }
      const kalt = (s.lk || 'kalt') === 'kalt', soll = this.sollVon(b), bd = kalt ? 'kalt' : 'mild';
      const balkenK = (name, k) => `<div class="zeile"><div><b>${name}</b> ${de(k.wert, 3)} <span class="leise">(Start ${de(k.start, 2)})</span>
          <div class="lern-fort"><i style="width:${Math.round(k.fort * 100)}%"></i></div></div><span class="leise">${k.fort >= 1 ? 'gelernt' : `${Math.round(k.fort * 50)}/50 Zyklen`}</span></div>`;
      const zelle = (art, kl) => { const z = (l.nachlauf || {})[`${art}|${kl}|${bd}`];
        return z && z.n ? `<b>+${de(z.grad)} °C</b><span class="leise">${de(z.min, 0)} min · ${z.n}×</span>` : '<span class="leise">noch nicht gelernt</span>'; };
      const tr = l.treffer || [], mittel = tr.length ? tr.reduce((x, y) => x + Math.abs(y), 0) / tr.length : null;
      return `${griff}<div class="block-kopf"><h3>Lernstand · ${esc(b.name)}</h3><span class="leise">${l.zyklen} Heizzyklen gemessen</span></div>
        ${this.offenText(b) ? `<div class="wa-heute">${this.offenText(b)}. Laufende Messungen sind verworfen; gelernt wird wieder 10 min, nachdem es vorbei ist.</div>` : ''}
        <div class="gruppe-t">Regelung (TPI, ${l.zyklus_min}-min-Zyklen)</div>
        ${balkenK('K innen – Trägheit des Raums', l.kint)}${balkenK('K außen – Wärmeverlust nach außen', l.kext)}
        <div class="leise">Einschaltanteil = K innen × (Soll − innen − Nachlauf) + K außen × (Soll − außen)</div>
        ${this.aufheizTeil(b)}
        <div class="block-kopf"><div class="gruppe-t">Nachlauf nach dem Ausschalten</div><div class="seg klein">${[['kalt', 'kalt < 5 °C'], ['mild', 'mild']].map(([k, t]) => `<button data-act="lern-k" data-v="${k}" class="${(s.lk || 'kalt') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <div class="lern-tab"><span></span><b>mit Ölradiator</b><b>nur Konvektor</b>
          ${[['kurz', '< 15 min'], ['mittel', '15–45 min'], ['lang', '> 45 min']].map(([kl, t]) => `<span>${t}</span><div>${zelle('oel', kl)}</div><div>${zelle('konvektor', kl)}</div>`).join('')}</div>
        <div class="leise">Wie weit die Temperatur nach dem Ausschalten noch steigt und wann die Spitze kommt, je nach Heizdauer davor. Zwei Heizkörper zählen mit ihrer Summe.</div>
        <div class="gruppe-t">Soll getroffen · letzte Zyklen (Soll ${de(soll)} °C)</div>
        ${tr.length ? `<div class="lern-treffer">${tr.map(x => `<span class="${Math.abs(x) <= .3 ? 'gut' : ''}">${x >= 0 ? '+' : '−'}${de(Math.abs(x))}</span>`).join('')}<b>Ø ±${de(mittel)} °C</b></div>` : '<div class="leer">Noch keine Messung – der erste Wert kommt nach dem nächsten Ausschalten</div>'}
        ${knopf('Lernstand zurücksetzen', 'lern-reset', 'rot')}${knopf('Schließen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'bs-bearbeiten') {
      const e = d.e, o = d.optionen;
      return `${griff}<div class="block-kopf"><h3>Baustelle bearbeiten</h3><span class="leise">${esc(d.titel)}</span></div>
        <div class="gruppe-t">Baustelle</div>
        <button class="zeile" data-act="sheet" data-s="name"><span>Name</span><span class="leise">${esc(d.titel)} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="zeitraum-bs"><span>Beginn und Ende</span><span class="leise">${this.bsZeit(d)} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="zeitraum-bs"><span>Heizperiode</span><span class="leise">${MONATE[d.hp[0] - 1]} – ${MONATE[d.hp[1] - 1]} ›</span></button>
        <div class="gruppe-t">Ort</div>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Wetter</span><span class="leise">${o.wetter ? esc(this.name(o.wetter)) : 'keins gewählt'} ›</span></button>
        <button class="zeile" data-act="sheet" data-s="wetterquelle"><span>Außentemperatur</span><span class="leise">${o.temp_sensor ? esc(this.name(o.temp_sensor)) : 'aus der Vorhersage'} ›</span></button>
        <div class="gruppe-t">Container und Geräte · ${d.bereiche.length}</div>
        ${d.bereiche.map(b => `<button class="zeile" data-act="bereich-einst" data-id="${b.id}"><span><i class="farbpunkt" style="background:${BEREICH_FARBEN[b.f % 6]}"></i>${esc(b.name)}</span><span class="leise">${b.geraete.length} ${b.pumpe ? 'Pumpen' : 'Geräte'} ›</span></button>`).join('')}
        <button class="zeile" data-act="sheet" data-s="container-neu"><span class="blau">+ Container oder Schacht</span></button>
        <div class="gruppe-t">Strom und Abrechnung</div>
        ${this.preisListe()}
        ${d.firmen.map(f => { const n = d.bereiche.filter(b => (b.firma || 'eigen') === f.id).length;
          return `<button class="zeile" data-act="firma-auf" data-id="${esc(f.id)}"><span>${esc(f.name)}${f.eigen ? ' <span class="badge">eigene</span>' : ''}</span><span class="leise">${n} Container ›</span></button>`; }).join('')}
        <button class="zeile" data-act="firma-auf"><span class="blau">+ Firma hinzufügen</span></button>
        ${d.aktiv ? '<button class="zeile" data-act="sheet" data-s="abschliessen"><span>Baustelle abschließen</span><span class="leise">kommt in den Verlauf ›</span></button>' : ''}
        <div class="leise p-fuss">Staffelung, Bericht, Meldungen und App stehen unter Einstellungen.</div>
        <button class="zeile" data-act="tab" data-v="einst"><span class="blau">Alle Einstellungen</span><span class="chev">›</span></button>
        ${knopf('Fertig', 'zu', 'amber')}`;
    }
    if (s.art === 'abschliessen') return `${griff}<h3>Baustelle abschließen?</h3><div class="leise">Die Heizung wird abgeschaltet. Als Ende wird heute (${datum(this.z.HEUTE)}) eingetragen. Werte und Diagramme bleiben im Verlauf, gelöscht wird nichts.</div>${knopf('Abschließen', 'abschliessen', 'rot')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    if (s.art === 'urlaub') {
      if (!d.optionen.urlaub_kalender) return `${griff}<h3>Urlaub eintragen</h3><div class="leise">Zuerst einen Kalender für den Urlaub wählen.</div>${knopf('Kalender wählen', 'wetterquelle-auf', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
      return `${griff}<h3>Urlaub eintragen</h3><label class="feld">Name<input value="${esc(s.form.name)}" placeholder="z. B. Semesterferien" data-ur="name"></label>
      <div class="raster-2"><label class="feld">Von<input type="date" value="${s.form.von}" data-ur="von"></label><label class="feld">Bis<input type="date" value="${s.form.bis}" data-ur="bis"></label></div>
      <div class="leise">Wird in den Kalender „${esc(this.name(d.optionen.urlaub_kalender))}“ eingetragen; in der Zeit läuft nur der Frostschutz.</div>${knopf('Eintragen', 'urlaub-speichern', 'amber')}${knopf('Abbrechen', 'zu', 'leise-k')}`;
    }
    if (s.art === 'wetterquelle') {
      const f = s.form, kal = this.entitaeten(x => x.entity_id.startsWith('calendar.'));
      return `${griff}<h3>Wetter</h3>
        <label class="feld">Wetter<select data-wq="wetter">${this.optionen(this.entitaeten(x => x.entity_id.startsWith('weather.')), f.wetter, '– keins –')}</select></label>
        <label class="feld">Außentemperatur<select data-wq="temp_sensor">${this.optionen(this.entitaeten(x => x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'temperature'), f.temp_sensor, 'aus der Vorhersage')}</select></label>
        <label class="feld">Regenmenge<select data-wq="regen_sensor">${this.optionen(this.entitaeten(x => x.entity_id.startsWith('sensor.') && x.attributes.device_class === 'precipitation'), f.regen_sensor, 'aus der Vorhersage')}</select></label>
        <div class="gruppe-t">Kalender</div>
        <label class="feld">Urlaub<select data-wq="urlaub_kalender">${this.optionen(kal, f.urlaub_kalender, '– keiner –')}</select></label>
        <label class="feld">Feiertage<select data-wq="feiertag_kalender">${this.optionen(kal, f.feiertag_kalender, '– keiner –')}</select></label>
        <label class="feld">Termine (Container nur bei Bedarf)<select data-wq="termine_kalender">${this.optionen(kal, f.termine_kalender, '– keiner –')}</select></label>
        ${knopf('Speichern', 'wetterquelle-speichern', 'amber')}`;
    }
    return `${griff}<h3>${{ name: 'Name', 'baustelle-neu': 'Neue Baustelle' }[s.art] || ''}</h3>
      <label class="feld">Name<input value="${esc(s.form ? s.form.name : '')}" placeholder="z. B. Wohnbau Kalsdorf" data-nm="name"></label>
      ${knopf('Speichern', s.art === 'name' ? 'name-speichern' : 'baustelle-anlegen', 'amber')}`;
  }

  fehlerText(e) { return fehlerText(e); }
  async ws(msg, ok) {
    if (!this.darfSenden(msg)) { this.toast(NUR_ANSEHEN); return null; }
    try { const r = await this._hass.callWS(msg); if (ok) this.toast(ok); return r === undefined ? true : r; }
    catch (e) { this.toast(`Fehler: ${this.fehlerText(e)}`); return null; }
    finally { this._laden(); }
  }
  /* Einstellung setzen: sofort anzeigen, dann an die Integration (Pfad wie im Store) */
  setzen(pfad, wert, ok) {
    if (this.nurLesen()) { this.toast(NUR_ANSEHEN); this.neuZeichnen(); return Promise.resolve(null); }   // Feld zurück auf den alten Wert
    const r = this.d && this.d.r;
    this._rohText = null;   // Antwort der Integration immer übernehmen (auch wenn sie den Wert ablehnt)
    if (r) { let o = r.einstellungen ||= {}; for (const k of pfad.slice(0, -1)) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; o[pfad[pfad.length - 1]] = wert; this._neuBauen(); this.neuZeichnen(); }
    return this.ws(nachricht.setzen(this.d.entry, pfad, wert), ok);
  }
  aktion(aktion, felder, ok) { return this.ws(nachricht.aktion(this.d.entry, aktion, felder), ok); }
  liste(liste, aktion, eintrag, ok) { return this.ws(nachricht.liste(this.d.entry, liste, aktion, eintrag), ok); }
  /* Einrichtungs-Dialoge von HA (dieselben wie unter Einstellungen → Geräte & Dienste) */
  async dialog(pfad, start, daten) {
    if (this.nurLesen()) throw new Error(NUR_ANSEHEN);
    const form = await this._hass.callApi('POST', pfad, start);
    if (!form || form.type !== 'form') return form;
    return this._hass.callApi('POST', `${pfad}/${form.flow_id}`, daten);
  }
  flowFehler(r) { return flowFehler(r); }
  async einrichten(lauf, ok) {
    try { const r = await lauf(); const f = this.flowFehler(r); if (f) { this.toast(`Nicht gespeichert: ${f}`); return null; } if (ok) this.toast(ok); return r || true; }
    catch (e) { this.toast(`Fehler: ${this.fehlerText(e)}`); return null; }
  }
  optionenSpeichern(x, aenderung) {
    const o = { ...x.optionen, ...aenderung };
    for (const k of Object.keys(o)) if (o[k] === '' || o[k] === null || o[k] === undefined) delete o[k];
    return this.dialog('config/config_entries/options/flow', { handler: x.entry }, o);
  }
  bereichDaten(name, art, fuehler) { return { name, art, ...(fuehler ? { fuehler } : {}) }; }
  geraetDaten(bid, g) { const [rolle, typ] = TYP_ROLLE[g.typ] || TYP_ROLLE.Ölradiator;
    return { bereich: bid, schalter: g.schalter, name: (g.n || '').trim() || this.name(g.schalter) || g.typ, rolle, typ: typ === 'oelradiator' && rolle !== 'heizkoerper' ? 'konvektor' : typ,
      ...(g.leistung ? { leistung: g.leistung } : {}), ...(g.energie ? { energie: g.energie } : {}) }; }
  async bereichAnlegen(name, schacht) {
    const r = await this.dialog('config/config_entries/subentries/flow', { handler: [this.d.entry, 'bereich'] }, this.bereichDaten(name, schacht ? 'pumpenschacht' : 'container'));
    const f = this.flowFehler(r); if (f) throw new Error(f);
    return r;
  }
  async neueIds(namen) { await this._laden(); return namen.map(n => (this.d.bereiche.find(b => b.name === n) || {}).id).filter(Boolean); }
  morgenFrueh() { return new Date(this.zoneMs(plusTage(this.z.HEUTE, 1), '07:00', this.z.zone)).toISOString(); }   // „bis morgen stumm“ = morgen 07:00
  isoHeute(hhmm) { return new Date(this.zoneMs(this.z.HEUTE, hhmm, this.z.zone)).toISOString(); }

  /* ---- Aktionen ---- */
  klick(ev) {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-act]'); if (!el) return;
    if (this.gesperrt(el)) return this.toast(NUR_ANSEHEN);
    const a = el.dataset.act, d = this.d, b = this.b, S = this.s;
    const neu = () => this.neuZeichnen();
    switch (a) {
      case 'menue': return this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true }));
      case 'tab': return this.gehe(el.dataset.v);
      case 'neu-laden': return this.neuLaden();
      case 'container': return this.containerOeffnen(el.dataset.id);
      case 'w-hin': return this.gehe('container', el.dataset.id);
      case 'w-stumm': { const w = d.warnungen.find(x => x.id === el.dataset.id); if (!w) return;
        return this.aktion('warnung_stumm', { key: w.key, bis: w.stumm ? null : this.morgenFrueh() }, w.stumm ? 'Wird wieder gemeldet' : 'Stumm bis morgen – bleibt im Protokoll'); }
      case 'w-protokoll': S.verlauf = 'aktiv'; S.pfilter = 'warnung'; return this.gehe('verlauf');
      case 'pfilter': S.pfilter = el.dataset.v; S.pmehr = false; return neu();
      case 'pmehr': S.pmehr = true; return neu();
      case 'sheet': return this.einblenden(el.dataset.s, el.dataset);
      case 'wetterquelle-auf': return this.klick({ target: { closest: () => ({ dataset: { act: 'sheet', s: 'wetterquelle' } }) } });
      case 'wa': S.sheet.wa = el.dataset.v; return neu();
      case 'lh-h': S.sheet.h = +el.dataset.v; return neu();   // AN-0005: Stunde der Leistung
      case 'lh-art': S.sheet.lart = el.dataset.v; return neu();   // WU-0011: Stunde | Tag
      case 'oh-basis': S.sheet.ohneBasis = el.dataset.v; return neu();   // WU-0013: Ø je Gerät | je Typ
      case 'vb-gruppe': { const st = el.dataset.ziel === 'aw' ? S.aw : S.sheet; st.gruppe = el.dataset.v; st.auswahl = this.quellen(st, el.dataset.ziel).map(q => q.id); return neu(); }
      case 'aw-scope': S.awScope = el.dataset.v; S.aw.auswahl = this.quellen(S.aw, 'aw').map(q => q.id); return neu();
      case 'vb-zeitraum': { const st = el.dataset.ziel === 'aw' ? S.aw : S.sheet; if (st.zeitraum !== el.dataset.v) st.v = 0; st.zeitraum = el.dataset.v; S.zrKal = null; return neu(); }
      case 'zr-schritt': return this.zrSchritt(el.dataset.ziel, +el.dataset.max || 0, +el.dataset.d);
      case 'zr-setz': return this.zrSetzen(el.dataset.ziel, +el.dataset.max || 0, +el.dataset.v);
      case 'zr-kal': return this.zrKalAuf(el.dataset.ziel);
      case 'zr-kal-nav': return this.zrKalBlaettern(+el.dataset.d);
      case 'vb-wer': { const sh = el.dataset.ziel === 'aw' ? S.aw : S.sheet, id = el.dataset.id;
        if (!id) sh.auswahl = []; else if (id === '*') sh.auswahl = this.quellen(sh, el.dataset.ziel || 'sheet').map(q => q.id);
        else sh.auswahl = sh.auswahl.includes(id) ? sh.auswahl.filter(x => x !== id) : [...sh.auswahl, id];
        return neu(); }
      case 'bereich-einst': S.cid = el.dataset.id; S.sheet = { art: 'bereich' }; return neu();
      case 'zu': S.sheet = null; return neu();
      case 'melden': return this.meldenAuf();
      case 'toast': return this.toast(el.dataset.t);
      case 'auto': return this.setzen(['automatik'], !d.e.auto, !d.e.auto ? 'Automatik ein' : 'Automatik aus – Geräte bleiben, wie sie sind');
      case 'bedarf-auf': S.sheet = { art: 'bedarf', cid: el.dataset.id, boost: false }; return neu();
      case 'bedarf-an': return this.bedarfAn(el.dataset.id, el.dataset.v);
      case 'bedarf-aus': return this.bedarfAus(el.dataset.id);
      case 'termin-weg': { const t = d.termine[+el.dataset.i]; return t && this.terminWeg(t); }
      case 'termin-speichern': { const f = S.sheet.form; if (!f.titel.trim() || !f.datum || f.bis <= f.von) return this.toast('Bitte Titel, Tag und Uhrzeit prüfen');
        if (!d.termineKal) return this.toast('Zuerst einen Kalender für Termine wählen');
        const ev = { summary: f.titel.trim(), dtstart: `${f.datum}T${f.von}:00`, dtend: `${f.datum}T${f.bis}:00`, description: `baustelle:${f.b}${f.boost ? '\nboost' : ''}` };   // Zuordnung zum Container (api §4)
        if (f.wieder !== 'einmal') ev.rrule = f.wieder === 'woche' ? 'FREQ=WEEKLY' : 'FREQ=WEEKLY;INTERVAL=2';
        S.sheet = null; neu();
        return this.ws({ type: 'calendar/event/create', entity_id: d.termineKal, event: ev }, `Eingetragen${f.wieder !== 'einmal' ? ` – ${WIEDER[f.wieder]} am ${wtag(f.datum)}` : ''} – heizt ab ${uhr(minu(f.von) - d.e.vorheizen)}`); }
      case 'bedarf-boost': S.sheet.boost = !S.sheet.boost; return neu();
      case 'tm-wieder': S.sheet.form.wieder = el.dataset.v; return neu();
      case 'tm-boost': S.sheet.form.boost = !S.sheet.form.boost; return neu();
      case 'boost': return this.boostUmschalten(d.bereiche.find(y => y.id === el.dataset.id));
      case 'hz-art': S.hzArt = el.dataset.v; return neu();
      case 'hz-tag': S.hzTag = el.dataset.v; if (el.dataset.art) S.hzArt = 'tag'; return neu();
      case 'ausn-neu': { const v = el.dataset.v, az = (this.azJetzt || { tage: {} }).tage, h = this.z.HEUTE, morgen = plusTage(h, 1);
        const sa = plusTage(h, (5 - (new Date(h + 'T12:00:00Z').getUTCDay() + 6) % 7 + 7) % 7 || 7);   // nächster Samstag
        const vor = { 'heute-laenger': { datum: h, art: 'zeiten', von: (az[wtag(h)] || ['07:00'])[0], bis: '18:00', notiz: 'heute länger' },
          'morgen-spaeter': { datum: morgen, art: 'zeiten', von: '09:00', bis: (az[wtag(morgen)] || ['', '16:30'])[1], notiz: 'morgen später' },
          samstag: { datum: sa, art: 'arbeit', von: '07:00', bis: '12:00', notiz: '' }, frei: { datum: morgen, art: 'frei', von: '07:00', bis: '16:30', notiz: '' } }[v]
          || { datum: plusTage(h, 7), art: 'zeiten', von: '07:00', bis: '16:30', notiz: '' };
        S.sheet = { art: 'ausnahme', form: { ...vor } }; return neu(); }
      case 'au-art': S.sheet.form.art = el.dataset.v; return neu();
      case 'au-speichern': { const f = S.sheet.form; if (!f.datum || (f.art !== 'frei' && f.bis <= f.von)) return this.toast('Bitte Tag und Uhrzeit prüfen');
        S.sheet = null; neu();
        const dazu = f.art !== 'frei' && d.ausnahmen.some(a => a.datum === f.datum && a.art !== 'frei');
        return this.liste('ausnahmen', 'speichern', { datum: f.datum, art: f.art, von: f.von, bis: f.bis, notiz: f.notiz.trim() }, `Ausnahme ${wtag(f.datum)} ${kurzDatum(f.datum)} ${dazu ? 'dazu – die anderen bleiben' : 'gespeichert'}`); }
      case 'ausn-weg': { const x = el.dataset, e = x.art ? { datum: x.d, art: x.art, von: x.von || null, bis: x.bis || null } : { datum: x.d };   // FE-0012: nur dieses Fenster
        return this.liste('ausnahmen', 'loeschen', e, x.art && x.art !== 'frei' ? `Zeitfenster ${x.von}–${x.bis} gelöscht – die anderen bleiben` : 'Ausnahme gelöscht – es gilt wieder die Arbeitszeit'); }
      case 'ausn-dazu': S.sheet = { art: 'ausnahme', form: { datum: el.dataset.d, art: 'arbeit', von: '17:00', bis: '19:00', notiz: '' } }; return neu();
      case 'jetzt-an': return this.aktion('jetzt_heizen', { minuten: 60 }, `Alle heizen bis ${uhr(minu(this.z.JETZT) + 60)}`);
      case 'jetzt-aus': return this.aktion('jetzt_heizen', { minuten: null }, 'Zurück zum Plan');
      case 'b-auto': { const x = el.dataset.id ? d.bereiche.find(y => y.id === el.dataset.id) : b; return x && this.bereichAuto(x); }
      case 'hz-auf': S.sheet = { art: 'hz', k: el.dataset.k }; return neu();
      case 'modus': { const x = d.bereiche.find(y => y.id === el.dataset.id); return x && this.modusSetzen(x, el.dataset.v); }
      case 'tv': S.tv = el.dataset.v; return neu();
      case 'sym-auf': S.sheet = { art: 'aussehen', id: S.cid || (this.b && this.b.id) }; return neu();   // BSM-032
      case 'sym-doppel': case 'sym-farbe': case 'sym-rahmen': case 'sym-wand': case 'sym-lage': case 'sym-weg': case 'sym-neu': case 'sym-standard': return this.symKlick(a, el);
      case 'np-an': return this.setzen(['heizung', 'notprogramm'], !d.e.notprogramm);   // BSM-019
      case 'np-probe': { const m = +el.dataset.min;   // BSM-021
        return this.ws({ type: 'baustelle/notprogramm_probe', entry_id: d.entry, geraet: el.dataset.id, minuten: m }, m ? `Ausfall-Probe ${m} min gestartet` : 'Ausfall-Probe beendet'); }
      case 'np-taste': return this.setzen(['heizung', 'taste'], !d.e.taste);   // BSM-018
      case 'np-plug': S.sheet = { art: 'np-plug', id: el.dataset.id }; return neu();
      case 'np-pruefen': if (S.npPrueft) return; S.npPrueft = true; this.neuZeichnen();
        return this.ws({ type: 'baustelle/notprogramm_pruefen', entry_id: d.entry }, 'Notprogramm geprüft').finally(() => { S.npPrueft = false; this.neuZeichnen(); });
      case 'test-meldung': return this.aktion('test_meldung', {}).then(r => { if (r && r.an) this.toast(r.an.length ? `Test-Nachricht an ${r.an.join(', ')} gesendet` : 'Kein Empfänger – bitte unter Meldungen wählen'); });
      case 'bsz-speichern': { const f = S.sheet.form; if (f.ende && f.ende < (f.beginn || (d.beginnAuto ? d.beginn : ''))) return this.toast('Bitte Beginn und Ende prüfen');
        S.sheet = null; neu();
        return this.einrichten(() => this.optionenSpeichern(d, { beginn: f.beginn || null, ende: f.ende || null, heizperiode_von: String(f.hp[0]), heizperiode_bis: String(f.hp[1]) }), 'Gespeichert').then(() => this._laden()); }
      case 'aw-bearb': S.awBearb = !S.awBearb; S.awLayout = false; return neu();
      case 'aw-layout': S.awLayout = !S.awLayout; S.awBearb = false; return neu();
      case 'aw-an': { const x = this.awAuswahl()[+el.dataset.i]; x.an = !x.an; this.awMerken(); return neu(); }
      case 'aw-weg': { const ort = el.dataset.ort || 'aw', Lg = this.kkListe(ort), x = Lg.filter(y => y.an)[+el.dataset.i]; if (!x) return;
        if (KK[x.k]) Lg.splice(Lg.indexOf(x), 1); else x.an = false; this.kkMerken(ort); return neu(); }
      /* WU-0014: Kachel-Katalog */
      case 'kk-plus': S.sheet = { art: 'kk-katalog', ort: el.dataset.ort, k: null, st: 'M', id: null, dia: true, q: '', f: 'alle', nurJe: false, nurEur: false }; return neu();
      case 'kk-k': { const sh = S.sheet; if (sh.k === el.dataset.k) sh.k = null; else { sh.k = el.dataset.k; sh.id = null; } return neu(); }
      case 'kk-gk': { const sh = S.sheet; if (sh.k !== el.dataset.k) sh.id = null; sh.k = el.dataset.k; sh.st = el.dataset.v; return neu(); }
      case 'kk-id': S.sheet.id = el.dataset.id; return neu();
      case 'kk-gr': S.sheet.st = el.dataset.v; return neu();
      case 'kk-dia-w': S.sheet.dia = !S.sheet.dia; return neu();
      case 'kk-f': S.sheet.f = el.dataset.v; S.sheet.k = null; return neu();
      case 'kk-nurje': S.sheet.nurJe = !S.sheet.nurJe; S.sheet.k = null; return neu();
      case 'kk-nureur': S.sheet.nurEur = !S.sheet.nurEur; S.sheet.k = null; return neu();
      case 'kk-hinzu': return this.kkHinzu(S.sheet);
      case 'vg-id': { const sh = S.sheet, j = sh.ids.indexOf(el.dataset.id);   // WU-0017: 2 bis 4 Container
        if (j >= 0) { if (sh.ids.length <= 2) return this.toast('Mindestens 2 Container'); sh.ids.splice(j, 1); } else { if (sh.ids.length >= 4) return this.toast('Höchstens 4 Container'); sh.ids.push(el.dataset.id); }
        return neu(); }
      case 'vg-zr': S.sheet.zr = el.dataset.v; return neu();
      case 'sp-neu': S.sheet = { art: 'preis-neu', ab: plusTage(this.z.HEUTE, 1), preis: d.e.preis }; return neu();
      case 'sp-speichern': { const f = S.sheet, p = parseFloat(String(f.preis).replace(',', '.')); if (!f.ab || !zahl(p) || p < 0) return this.toast('Bitte Datum und Preis prüfen');
        S.sheet = null; neu(); this.cache = {}; return this.liste('preise', 'speichern', { ab: f.ab, preis: p }, `Strompreis ${de(p, 2)} € ab ${datum(f.ab)} gespeichert`); }
      case 'sp-weg': this.cache = {}; return this.liste('preise', 'loeschen', { ab: el.dataset.ab }, 'Strompreis gelöscht');
      case 'sp-sim': { S.simPreis = Math.max(0, Math.round((this.simPreis() + +el.dataset.d) * 100) / 100); try { localStorage.setItem('baustelle-sim-preis', String(S.simPreis)); } catch (e) { /* egal */ } return neu(); }
      case 'sp-aw': S.awSim = !S.awSim; return neu();
      case 'vg-art': S.sheet.art = el.dataset.v; return neu();
      case 'vg-art-k': { const ort = el.dataset.ort, x = this.kkListe(ort).filter(y => y.an)[+el.dataset.i]; if (!x) return; x.art = x.art === 'linien' ? 'balken' : 'linien'; this.kkMerken(ort); return neu(); }
      case 'kk-layout': S.kkLayout = !S.kkLayout; return neu();
      case 'sg-gefuehl': return this.gefuehl(b, +el.dataset.v);
      case 'sg-zurueck': return this.sollZurueck({ id: el.dataset.id });
      case 'sg-vergessen': return this.aktion('gefuehl_vergessen', {}, 'Gelerntes Gefühl vergessen – es gilt der Startwert nach draußen');
      case 'sr-auf': { const o = S.srOffen ||= [], id = el.dataset.id; if (o.includes(id)) o.splice(o.indexOf(id), 1); else o.push(id); return neu(); }
      case 'kk-dia': { const ort = el.dataset.ort, x = this.kkListe(ort).filter(y => y.an)[+el.dataset.i]; if (!x) return; x.dia = x.dia === false; this.kkMerken(ort); return neu(); }
      case 'kk-auf': { const ort = el.dataset.ort, x = this.kkListe(ort).filter(y => y.an)[+el.dataset.i]; return x ? this.kkAuf(x, ort) : undefined; }
      case 'aw-stufe': { const x = this.awAuswahl()[+el.dataset.i], st = awStufen(x.k).find(q => q[0] === el.dataset.v); if (!st) return; Object.assign(x, { w: st[1], h: st[2], st: st[0] }); this.awMerken(); return neu(); }
      case 'aw-gr': { const x = this.awAuswahl()[+el.dataset.i], k = el.dataset.k; x[k] = Math.max(1, Math.min(k === 'w' ? 4 : 6, x[k] + +el.dataset.d)); this.awMerken(); return neu(); }
      case 'aw-hoch': case 'aw-runter': { const Lg = this.awAuswahl(), i = +el.dataset.i, j = a === 'aw-hoch' ? i - 1 : i + 1; if (j < 0 || j >= Lg.length) return; [Lg[i], Lg[j]] = [Lg[j], Lg[i]]; this.awMerken(); return neu(); }
      case 'aw-vorlage': this.awVorlage(el.dataset.v); if (S.sheet && S.sheet.art === 'kk-katalog') S.sheet = null; neu(); return this.toast(`Vorlage „${AW_VORLAGEN[el.dataset.v][0]}“ übernommen`);
      case 'aw-detail': S.sheet = { art: 'aw-detail', k: el.dataset.k }; return neu();
      case 'c-soll': return this.sollSchritt(b, +el.dataset.d);
      case 'cvd': S.cvd = el.dataset.v; return neu();
      case 'g-aktiv': return this.geraetAktiv(b, +el.dataset.i);
      case 'g-automatik': return this.geraetAutomatik(b, +el.dataset.i);
      case 'g-bearbeiten': return this.geraetBearbeiten(b, +el.dataset.i);
      case 'gf-aktiv': S.sheet.form.aktiv = !S.sheet.form.aktiv; return neu();
      case 'gf-speichern': { const f = S.sheet.form, g = b.geraete[S.sheet.i], x = b; if (!f.n.trim() || !f.schalter) return this.toast('Bitte Name und Shelly wählen');
        S.sheet = null; neu();
        const geaendert = f.n.trim() !== g.n || f.schalter !== g.schalter || f.typ !== g.typ || f.bereich !== x.id || f.leistung !== (g.leistungEigen || '') || f.energie !== (g.energieEigen || '');
        return this.einrichten(async () => {
          if (geaendert) {
            const r = await this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'geraet'], subentry_id: g.id },
              this.geraetDaten(f.bereich, { n: f.n.trim(), typ: f.typ, schalter: f.schalter, leistung: f.leistung || undefined, energie: f.energie || undefined }));
            if (this.flowFehler(r)) return r; }
          if (f.aktiv !== g.aktiv) await this._hass.callWS({ type: 'baustelle/aktion', entry_id: d.entry, aktion: 'aktiv', geraet: g.id, an: f.aktiv });
          return true;
        }, `${f.n.trim()} gespeichert`).then(() => this._laden()); }
      case 'b-lernen': return this.lernenUmschalten(b);
      case 'lern-k': S.sheet.lk = el.dataset.v; return neu();
      case 'lern-reset': { const x = b; S.sheet = null; neu(); return this.aktion('lern_reset', { bereich: x.id }, `${x.name}: Lernstand zurückgesetzt`); }
      case 'b-trocknen': case 'tr-b': return this.trocknenUmschalten(a === 'tr-b' ? d.bereiche.find(y => y.id === el.dataset.id) : b);
      case 'geraet': return this.geraetSchalten(b, +el.dataset.i);
      case 'chart': S.chart = el.dataset.c; return neu();
      case 'verlauf': S.verlauf = el.dataset.v; return neu();
      case 'basis': return this.setzen(PFAD.basis, el.dataset.v === 'jetzt' ? 'jetzt' : 'tageshoechst');
      case 'e-bool': { const k = el.dataset.k;
        if (ARTEN[k]) return this.setzen(['meldungen_einst', 'arten', ARTEN[k]], !d.e[k]);
        return this.setzen(PFAD[k], !d.e[k]); }
      case 'st': return this.stufeSchritt(el.dataset.k, +el.dataset.d);
      case 'jc-auto': { const x = d.bereiche.find(y => y.id === el.dataset.id); return this.setzen(['bereiche', x.id, 'auto'], !x.auto); }
      case 'jc-soll': { const x = d.bereiche.find(y => y.id === el.dataset.id), [min, max] = GRENZEN.soll;
        return this.setzen(['bereiche', x.id, 'soll'], Math.min(max, Math.max(min, Math.round(((x.soll ?? d.e.soll) + +el.dataset.d) * 2) / 2))); }
      case 'urlaub-weg': { const u = (this.urlaube() || [])[+el.dataset.i]; if (!u) return; delete this.cache['k:' + d.optionen.urlaub_kalender];
        return this.ws({ type: 'calendar/event/delete', entity_id: d.optionen.urlaub_kalender, uid: u.uid, ...(u.recurrence_id ? { recurrence_id: u.recurrence_id } : {}) }, `${u.name} gelöscht`); }
      case 'urlaub-speichern': { const f = S.sheet.form; if (!f.von || !f.bis || f.bis < f.von) return this.toast('Bitte Von und Bis prüfen');
        S.sheet = null; neu(); delete this.cache['k:' + d.optionen.urlaub_kalender];
        return this.ws({ type: 'calendar/event/create', entity_id: d.optionen.urlaub_kalender, event: { summary: f.name.trim() || 'Urlaub', dtstart: f.von, dtend: plusTage(f.bis, 1) } }, 'Eingetragen – in der Zeit nur Frostschutz'); }
      case 'vgl': S.vglArt = el.dataset.v; return neu();
      case 'bs-wahl': return this.baustelleOeffnen(el.dataset.id);
      case 'bs-bearbeiten': { const x = this.alle.find(y => y.entry === el.dataset.id); if (!x) return;   // aktiv → „Baustelle bearbeiten“ (AN-0002), abgeschlossen → Detailseite (wieder aktiv setzen)
        if (!x.aktiv) { S.bs = x.entry; return this.gehe('bsdetail'); }
        if (x.entry !== this.bid) { this.bid = x.entry; this._merken(); this._neuBauen(); this._vorhersageAbo(); this._stimmung(true); S.aw = null; }
        S.sheet = { art: 'bs-bearbeiten' }; return neu(); }
      case 'bs-loeschen': { const x = this.alle.find(y => y.entry === S.sheet.id); S.sheet = null; if (!x) return neu();
        const weg = (d && d.entry === x.entry) || (S.view === 'bsdetail' && S.bs === x.entry); neu();
        return this.einrichten(() => this._hass.callApi('DELETE', `config/config_entries/entry/${x.entry}`), `${x.titel} gelöscht`)
          .then(r => { if (!r) return; this._rohText = null; return this._laden().then(() => { if (weg) this.gehe('uebersicht'); }); }); }
      case 'csv': return this.csv(el.dataset.art);
      case 'firma-auf': { const f = el.dataset.id ? this.firma(el.dataset.id) : null;
        S.sheet = { art: 'firma', form: { id: f && f.id, name: (f && f.name) || '', neu: [], container: f ? d.bereiche.filter(x => (x.firma || 'eigen') === f.id).map(x => x.id) : [] } }; return neu(); }
      case 'firma-c': { const c = S.sheet.form.container, id = el.dataset.id; S.sheet.form.container = c.includes(id) ? c.filter(x => x !== id) : [...c, id]; return neu(); }
      case 'firma-speichern': { const f = S.sheet.form; if (!f.name.trim()) return this.toast('Bitte einen Namen eingeben');
        const neue = f.neu.filter(c => c.name.trim());
        S.sheet = null; neu();
        return (async () => {
          let ids = [];
          if (neue.length) { try { for (const c of neue) await this.bereichAnlegen(c.name.trim(), c.art === 'Schacht'); ids = await this.neueIds(neue.map(c => c.name.trim())); } catch (e) { return this.toast(`Nicht angelegt: ${this.fehlerText(e)}`); } }
          return this.liste('firmen', 'speichern', { ...(f.id ? { id: f.id } : {}), name: f.name.trim(), container: [...f.container, ...ids] }, `${f.name.trim()} gespeichert${neue.length ? ` · ${neue.length} Container angelegt` : ''}`);
        })(); }
      case 'fc-neu': S.sheet.form.neu.push({ name: '', art: 'Container' }); return neu();
      case 'fc-weg': S.sheet.form.neu.splice(+el.dataset.i, 1); return neu();
      case 'fc-art': S.sheet.form.neu[+el.dataset.i].art = el.dataset.v; return neu();
      case 'firma-weg': { const id = S.sheet.form.id; S.sheet = null; neu(); return this.liste('firmen', 'loeschen', { id }, 'Firma gelöscht – Container gehören wieder der eigenen Firma'); }
      case 'e-wert': { const v = el.dataset.v; return this.setzen(PFAD[el.dataset.k], isNaN(+v) ? v : +v); }
      case 'prio': return this.setzen(['bereiche', el.dataset.id, 'prio'], el.dataset.v);
      case 'n-knopf': return this.toast(`„${el.dataset.t}“ – so reagierst du direkt aus der Nachricht`);
      case 'bericht-senden': { const art = d.e.bericht === 'monat' ? 'monat' : 'woche'; return this.aktion('bericht_senden', { art }, `Bericht für ${art === 'monat' ? 'den Vormonat' : 'die Vorwoche'} gesendet`); }
      case 'anschluss-auf': { const x = el.dataset.id ? this.anschluss(el.dataset.id) : null;
        S.sheet = { art: 'anschluss', form: { id: x && x.id, name: (x && x.name) || '', ampere: (x && x.ampere) || 32, phasen: (x && x.phasen) || 3, reserve: x ? x.reserve : 3, container: x ? d.bereiche.filter(y => y.anschluss === x.id).map(y => y.id) : [] } }; return neu(); }
      case 'an-wert': S.sheet.form[el.dataset.k] = +el.dataset.v; return neu();
      case 'an-res': S.sheet.form.reserve = Math.max(0, S.sheet.form.reserve + +el.dataset.d); return neu();
      case 'an-c': { const c = S.sheet.form.container, id = el.dataset.id; S.sheet.form.container = c.includes(id) ? c.filter(x => x !== id) : [...c, id]; return neu(); }
      case 'an-speichern': { const f = S.sheet.form; if (!f.name.trim()) return this.toast('Bitte einen Namen eingeben');
        S.sheet = null; neu();
        return this.liste('anschluesse', 'speichern', { ...(f.id ? { id: f.id } : {}), name: f.name.trim(), ampere: f.ampere, phasen: f.phasen, reserve_kw: f.reserve, container: f.container }, `${f.name.trim()} gespeichert`); }
      case 'an-weg': { const id = S.sheet.form.id, rest = d.anschluesse.find(x => x.id !== id); S.sheet = null; neu();
        return this.liste('anschluesse', 'loeschen', { id }, `Gelöscht – Container hängen jetzt an ${rest ? rest.name : 'keinem Anschluss'}`); }
      case 'tab-einst': return this.einstGruppe(el.dataset.g || (S.sheet && S.sheet.art === 'strom' ? 'strom' : S.evGruppe));
      case 'ev-gruppe': S.evGruppe = el.dataset.v; S.evDev = null; return this.neuZeichnen(true);
      case 'ev-dev': S.evDev = el.dataset.v; return neu();
      case 'b-stufen': return b && this.setzen(['bereiche', b.id, 'stufen'], !b.stufenAn);   // AN-0006
      case 'g-kw': { const g = b && b.geraete.find(x => x.id === el.dataset.id); if (!g) return;   // Szenarien: Nennleistung ohne Messung
        return this.setzen(['geraete', g.id, 'nenn_kw'], Math.max(0, Math.min(10, Math.round(((g.nennKwEigen ?? g.kw) + +el.dataset.d) * 10) / 10))); }
      case 'g-zusatz': { const g = b && b.geraete.find(x => x.id === el.dataset.id); return g && this.setzen(['geraete', g.id, 'zusatz'], !g.zusatz); }
      case 'warm-eigen': { if (!b) return; const vor = el.dataset.k === 'vor', alt = vor ? b.warmVor ?? d.e.warm_vor : b.warmNach ?? d.e.warm_nach;   // AN-0004
        return this.setzen(['bereiche', b.id, vor ? 'warm_vor' : 'warm_nach'], Math.max(0, Math.min(240, alt + +el.dataset.d))); }
      case 'warm-zurueck': return this.setzen(['bereiche', b.id, 'warm_vor'], null).then(() => this.setzen(['bereiche', b.id, 'warm_nach'], null));
      case 'az-alt': S.azAlt = !S.azAlt; return neu();
      case 'az-heizung': return this.gehe('heizung');
      case 'az-neu': case 'az-vorlage': { const v = a === 'az-vorlage' ? d.arbeitszeiten[S.sheet.i] : this.azJetzt;
        const tage = v ? JSON.parse(JSON.stringify(v.tage)) : { Mo: ['07:00', '16:30'], Di: ['07:00', '16:30'], Mi: ['07:00', '16:30'], Do: ['07:00', '16:30'], Fr: ['07:00', '12:30'], Sa: null, So: null };
        const mo = plusTage(this.z.WOCHE_ISO[0], 7);
        S.sheet = { art: 'az-neu', form: { ab: mo, name: '', tage } }; return neu(); }
      case 'az-bearbeiten': { const v = d.arbeitszeiten[S.sheet.i]; if (!v) return;   // FE-0002
        S.sheet = { art: 'az-neu', form: { alt_ab: v.ab, ab: v.ab, name: v.auto ? '' : v.name, tage: JSON.parse(JSON.stringify(v.tage)) } }; return neu(); }
      case 'az-weg': { if (d.arbeitszeiten.length < 2) return this.toast('Die letzte Arbeitszeit bleibt'); const x = d.arbeitszeiten[S.sheet.i]; S.sheet = null; neu(); return this.liste('arbeitszeiten', 'loeschen', { ab: x.ab }, `${x.name} gelöscht`); }
      case 'azn-tag': { const t = el.dataset.t, f = S.sheet.form; f.tage[t] = f.tage[t] ? null : [...(f.tage.Mo || ['07:00', '16:30'])]; return neu(); }
      case 'azn-wie-mo': { const f = S.sheet.form; for (const t of ['Di', 'Mi', 'Do']) f.tage[t] = f.tage.Mo ? [...f.tage.Mo] : null; return neu(); }
      case 'azn-speichern': { const f = S.sheet.form;
        if (!f.ab) return this.toast('Bitte ein Startdatum wählen');
        if (d.arbeitszeiten.some(x => x.ab === f.ab && x.ab !== f.alt_ab && !x.auto)) return this.toast(`Ab ${datum(f.ab)} gibt es schon eine Arbeitszeit`);
        const tage = Object.fromEntries(TAGE.map((t, k) => [String(k), f.tage[t] ? [...f.tage[t]] : null]));
        // gilt die neue gleich? – jüngste begonnene; die automatische zählt nicht mehr (FE-0002)
        const bleiben = d.arbeitszeiten.filter(x => x.ab !== f.alt_ab && !x.auto), gilt = f.ab <= this.z.HEUTE && !bleiben.some(x => x.ab > f.ab && x.ab <= this.z.HEUTE);
        const text = f.ab > this.z.HEUTE ? `Geplant – gilt ab ${datum(f.ab)}` : gilt ? (f.alt_ab !== undefined ? 'Gespeichert – gilt jetzt' : 'Gilt jetzt – die bisherige bleibt gespeichert') : 'Gespeichert – eine jüngere Arbeitszeit gilt weiter';
        S.sheet = null; neu();
        return this.liste('arbeitszeiten', 'speichern', { ab: f.ab, name: f.name.trim() || `ab ${datum(f.ab)}`, tage, ...(f.alt_ab !== undefined ? { alt_ab: f.alt_ab } : {}) }, text); }
      case 'neu-art': S.sheet.form.art = el.dataset.v; S.sheet.form.typ = el.dataset.v === 'Pumpenschacht' ? 'Pumpe' : 'Ölradiator'; return neu();
      case 'neu-anlegen': { const f = S.sheet.form, name = f.name.trim() || 'Neuer Container', schacht = f.art === 'Pumpenschacht';
        S.sheet = null; neu();
        return this.einrichten(async () => {
          const r = await this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'bereich'] }, this.bereichDaten(name, schacht ? 'pumpenschacht' : 'container', f.fuehler));
          if (this.flowFehler(r) || !f.schalter) return r;
          const [bid] = await this.neueIds([name]); if (!bid) return r;
          return this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'geraet'] }, this.geraetDaten(bid, { n: schacht ? 'Pumpe 1' : '', typ: f.typ, schalter: f.schalter }));
        }, `${name} angelegt`).then(() => this._laden()); }
      case 'b-speichern': { const e = S.sheet.edit, x = b; S.sheet = null; neu();
        return this.einrichten(async () => {
          const eb = { ...((d.r.einstellungen.bereiche || {})[x.id] || {}) }, pfad = k => ['bereiche', x.id, k];
          if (e.name.trim() && (e.name.trim() !== x.name || (e.fuehler || '') !== (x.fuehler || ''))) {
            const r = await this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'bereich'], subentry_id: x.id }, this.bereichDaten(e.name.trim(), x.art || 'container', e.fuehler));
            if (this.flowFehler(r)) return r; }
          const call = (k, w) => this._hass.callWS({ type: 'baustelle/setzen', entry_id: d.entry, pfad: pfad(k), wert: w });
          if (e.bedarf !== !!eb.bedarf) await call('bedarf', e.bedarf);
          if (x.groesse) { const m2 = e.groesseArt === 'einzel' ? null : e.groesseArt === 'doppel' ? x.groesse.typen.doppel.m2 : (zahl(e.m2) && Number(e.m2) >= 4 ? Number(e.m2) : undefined);   // AN-0014
            if (m2 !== undefined && m2 !== (eb.groesse_m2 ?? null)) await call('groesse_m2', m2); }
          if ((e.tuer || null) !== (eb.tuer || null)) await call('tuer', e.tuer || null);
          if (e.anschluss && e.anschluss !== x.anschluss) await call('anschluss', e.anschluss);
          if (e.firma !== x.firma) {
            if (x.firma !== 'eigen') await this._hass.callWS({ type: 'baustelle/liste', entry_id: d.entry, liste: 'firmen', aktion: 'speichern', eintrag: { id: x.firma, name: this.firma(x.firma).name, container: d.bereiche.filter(y => y.firma === x.firma && y.id !== x.id).map(y => y.id) } });
            if (e.firma !== 'eigen') await this._hass.callWS({ type: 'baustelle/liste', entry_id: d.entry, liste: 'firmen', aktion: 'speichern', eintrag: { id: e.firma, name: this.firma(e.firma).name, container: [...d.bereiche.filter(y => y.firma === e.firma).map(y => y.id), x.id] } });
          }
          for (const g of e.geraete) {
            if (g.weg && !g.neu) await this._hass.callWS({ type: 'config_entries/subentries/delete', entry_id: d.entry, subentry_id: g.id });
            else if (g.neu && !g.weg && g.schalter) { const r = await this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'geraet'] }, this.geraetDaten(x.id, g)); if (this.flowFehler(r)) return r; }
            else if (!g.neu && !g.weg && (g.n !== g.alt.n || g.typ !== g.alt.typ)) { const r = await this.dialog('config/config_entries/subentries/flow', { handler: [d.entry, 'geraet'], subentry_id: g.id }, this.geraetDaten(x.id, g)); if (this.flowFehler(r)) return r; }
          }
          return true;
        }, e.geraete.some(g => g.weg && !g.neu) ? `Gespeichert · ${e.geraete.filter(g => g.weg && !g.neu).length} entfernt – Werte bleiben im Verlauf` : 'Gespeichert').then(() => this._laden()); }
      case 'ge-bedarf': S.sheet.edit.bedarf = !S.sheet.edit.bedarf; return neu();
      case 'groesse-art': { const e = S.sheet.edit; e.groesseArt = el.dataset.v; if (e.groesseArt === 'frei' && !zahl(e.m2)) e.m2 = b.groesse.m2; return neu(); }
      case 'ge-weg': { const g = S.sheet.edit.geraete[+el.dataset.i]; if (g.neu) S.sheet.edit.geraete.splice(+el.dataset.i, 1); else g.weg = true; return neu(); }
      case 'ge-zurueck': S.sheet.edit.geraete[+el.dataset.i].weg = false; return neu();
      case 'ge-neu': S.sheet.edit.geraete.push({ neu: true, schalter: '', n: '', typ: b.pumpe ? 'Pumpe' : 'Ölradiator' }); return neu();
      case 'temp-vb': S.tempVb = S.tempVb === false; return neu();
      case 'b-weg': { const x = b; S.sheet = null; this.gehe('uebersicht');
        return this.einrichten(async () => {
          for (const g of x.geraete) await this._hass.callWS({ type: 'config_entries/subentries/delete', entry_id: d.entry, subentry_id: g.id });
          await this._hass.callWS({ type: 'config_entries/subentries/delete', entry_id: d.entry, subentry_id: x.id }); return true;
        }, `${x.name} entfernt – Werte bleiben im Verlauf`).then(() => this._laden()); }
      case 'abschliessen': S.leeren(); neu();
        return this.einrichten(() => this.optionenSpeichern(d, { status: 'abgeschlossen' }), 'Abgeschlossen – steht jetzt im Verlauf').then(() => this._laden());
      case 'name-speichern': { const n = S.sheet.form.name.trim(); if (!n) return this.toast('Bitte einen Namen eingeben'); S.sheet = null; neu();
        return this.ws({ type: 'config_entries/update', entry_id: d.entry, title: n }, 'Gespeichert'); }
      case 'baustelle-anlegen': { const n = S.sheet.form.name.trim(); if (!n) return this.toast('Bitte einen Namen eingeben'); S.sheet = null; neu();
        const heute = this.d ? this.z.HEUTE : new Date().toISOString().slice(0, 10);
        return this.einrichten(() => this.dialog('config/config_entries/flow', { handler: 'baustelle', show_advanced_options: false }, { name: n, beginn: heute, heizung: true, pumpen: true }), `${n} angelegt – jetzt Container anlegen`)
          .then(r => { if (r && r.next_flow) this._hass.callApi('DELETE', `config/config_entries/subentries/flow/${r.next_flow[1]}`).catch(() => {});
            if (r && r.result && r.result.entry_id) { this.bid = r.result.entry_id; this._merken(); } this._laden(); }); }
      case 'wetterquelle-speichern': { const f = S.sheet.form; S.sheet = null; neu();
        return this.einrichten(async () => {
          const r = await this.optionenSpeichern(d, { wetter: f.wetter, temp_sensor: f.temp_sensor, regen_sensor: f.regen_sensor, urlaub_kalender: f.urlaub_kalender, feiertag_kalender: f.feiertag_kalender });
          if (this.flowFehler(r)) return r;
          if ((f.termine_kalender || null) !== (d.termineKal || null)) await this._hass.callWS({ type: 'baustelle/setzen', entry_id: d.entry, pfad: ['termine_kalender'], wert: f.termine_kalender || null });
          return r;
        }, 'Gespeichert').then(() => { this.cache = {}; this._aboFuer = null; this._laden(); }); }
    }
    return undefined;
  }
  eingabe(ev) {
    const el = ev.target, ds = (el && el.dataset) || {}, sh = this.s.sheet;
    if (ds.lh !== undefined) {   // AN-0010: beim Ziehen gleich mitladen (kurz entprellt), nur den Datenteil tauschen
      const max = sh && sh.v ? 23 : +this.z.JETZT.slice(0, 2), h = Math.min(+el.value, max), w = this.shadowRoot && this.shadowRoot.querySelector('.lh-wert');
      if (w) w.textContent = `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`;
      clearTimeout(this._lhZiehen);
      this._lhZiehen = setTimeout(() => { if (this.s.sheet && this.s.sheet.art === 'leistung' && this.s.sheet.h !== h) { this.s.sheet.h = h; this.leistungTeil(); } }, 150);
      return;
    }
    if (ds.sp && sh && sh.art === 'preis-neu') { sh[ds.sp] = el.value; return; }   // Strompreis ab …
    if (ds.kk === 'q' && sh && sh.art === 'kk-katalog') {   // WU-0014: Treffer neu, Fokus bleibt im Suchfeld
      sh.q = el.value; sh.k = null; const t = this.shadowRoot && this.shadowRoot.querySelector('.kk-treffer'); if (t) t.innerHTML = this.kkTreffer(sh); return;
    }
    if (ds.azn) sh.form[ds.azn] = el.value;
    if (ds.ur) sh.form[ds.ur] = el.value;
    if (ds.tm) sh.form[ds.tm] = el.value;
    if (ds.au) { sh.form[ds.au] = el.value; if (ds.au === 'datum') this.neuZeichnen(); }
    if (ds.ge) sh.edit.geraete[+ds.i][ds.ge] = el.value;
    if (ds.bf) sh.edit.firma = el.value;
    if (ds.btuer !== undefined) sh.edit.tuer = el.value;
    if (ds.bfu !== undefined) sh.edit.fuehler = el.value;
    if (ds.bm2 !== undefined) sh.edit.m2 = el.value;
    if (ds.ban !== undefined) { sh.edit.anschluss = el.value; this.neuZeichnen(); }
    if (ds.an) sh.form[ds.an] = el.value;
    if (ds.fn !== undefined) sh.form.name = el.value;
    if (ds.fnc !== undefined) sh.form.neu[+ds.fnc].name = el.value;
    if (ds.b === 'name' && sh && sh.edit) sh.edit.name = el.value;
    if (ds.azt) sh.form.tage[ds.azt][+ds.p] = el.value;
    if (ds.neu) { sh.form[ds.neu] = el.value; if (ds.neu === 'schalter') this.neuZeichnen(); }   // WU-0008: Heizungsart erst mit Shelly abfragen
    if (ds.wq) sh.form[ds.wq] = el.value;
    if (ds.nm) sh.form.name = el.value;
    if (ds.bsz) sh.form[ds.bsz] = el.value;
    if (ds.gf) sh.form[ds.gf] = el.value;
    if (ds.hp) sh.form.hp[+ds.hp] = +el.value;
  }
  /* Felder, die direkt speichern: erst beim Verlassen (change), nicht bei jedem Tastendruck */
  aenderung(ev) {
    const el = ev.target, k = el && el.dataset && el.dataset.k;
    if (el && el.dataset && el.dataset.lh !== undefined && this.s.sheet) {   // WU-0011: Regler losgelassen
      this.s.sheet.h = +el.value;
      const max = this.s.sheet.v ? 23 : +this.z.JETZT.slice(0, 2); if (+el.value > max) el.value = String(max);   // heute nur bis jetzt
      return this.leistungTeil() || this.neuZeichnen();   // WU-0012: nur den Datenteil tauschen
    }
    if (k === 'preis') { const v = parseFloat(String(el.value).replace(',', '.')); if (Number.isFinite(v) && v >= 0) return this.setzen(PFAD.preis, v, 'Preis gespeichert'); return this.toast('Bitte einen Preis eingeben'); }
    if (k === 'mail') return this.setzen(PFAD.mail, String(el.value).trim(), 'Gespeichert');
    if (el && el.dataset && el.dataset.sym) return this.symAenderung(el);   // BSM-032
    const jm = el && el.dataset && el.dataset.jm;
    if (jm) { const x = this.d.bereiche.find(y => y.id === jm); if (!x || x.modus === el.value) return undefined;
      return this.setzen(['bereiche', jm, 'modus'], el.value, `${x.name}: ${(MODI.find(q => q[0] === el.value) || [el.value, el.value])[1]}`); }
    return undefined;
  }
  hover(ev) {
    const svg = ev.target && ev.target.closest && ev.target.closest('svg.chart'); if (!svg) return this.tip(null);
    const c = CHARTS[svg.dataset.chart]; if (!c) return this.tip(null);
    const r = svg.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width, p = this.d ? this.d.e.preis : 0;
    if (c.art === 'streu') {
      const vx = (ev.clientX - r.left) / r.width * 320, vy = ((ev.clientY ?? 0) - (r.top ?? 0)) / r.width * 320;
      let best = 0, bd = 1e9; c.pkt.forEach((q, i) => { const dd = (c.x(q[0]) - vx) ** 2 + (c.y(q[1]) - vy) ** 2; if (dd < bd) { bd = dd; best = i; } });
      if (bd > 900) { svg.querySelector('.hover').innerHTML = ''; return this.tip(null); }
      const q = c.pkt[best];
      svg.querySelector('.hover').innerHTML = `<circle cx="${c.x(q[0])}" cy="${c.y(q[1])}" r="7" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`;
      return this.tip(ev, `<b>${de(q[0], 1)} °C außen</b><div>${de(q[1], 0)} kWh · ${de(q[1] * p, 2)} €</div>`);
    }
    if (c.art === 'flaeche') {
      const vx = fx * c.W, i = Math.max(0, Math.min(c.n - 1, Math.round((vx - c.x0) / (c.x1 - c.x0) * (c.n - 1)))), x = c.x0 + i / Math.max(1, c.n - 1) * (c.x1 - c.x0);
      const h = c.einheit === 'kWh/h' || c.einheit === 'kW', sum = c.reihen.reduce((a, q) => a + q.v[i], 0);
      if (c.einheit === 'kW') { svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="138" class="kreuz"/>` + c.reihen.map(q => `<circle cx="${x}" cy="${c.y(q.o[i])}" r="3.5" fill="${q.farbe}" class="punkt"/>`).join('');
        return this.tip(ev, `<b>${c.labels[i]}:00</b>` + (c.reihen.length > 1 ? [...c.reihen].reverse().map(q => `<div><i style="background:${q.farbe}"></i>${esc(q.name)} <b>${de(q.v[i], 2)} kW</b></div>`).join('') + `<div class="tip-summe">zusammen <b>${de(sum, 2)} kW</b></div>` : `<div>${de(sum, 2)} kW</div>`)); }
      svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="138" class="kreuz"/>` + c.reihen.map(q => `<circle cx="${x}" cy="${c.y(q.o[i])}" r="3.5" fill="${q.farbe}" class="punkt"/>`).join('');
      const vglTip = c.vergleich ? `<div class="leise">${esc(c.vglName || 'Vergleich')} ${de(c.vergleich[i], 2)} ${c.einheit === '€' ? '€' : 'kWh'}</div>` : '';
      return this.tip(ev, `<b>${c.labels[i]}${h ? ':00' : ''}</b>` + vglTip + (c.reihen.length > 1
        ? [...c.reihen].reverse().map(q => `<div><i style="background:${q.farbe}"></i>${esc(q.name)} <b>${de(q.v[i], 2)} ${c.einheit === '€' ? '€' : 'kWh'}</b></div>`).join('') + `<div class="tip-summe">zusammen <b>${de(sum, 2)} kWh</b> · ${de(sum * p, 2)} €</div>`
        : c.einheit === '€' ? `<div>${de(sum, 2)} €</div>` : `<div>${de(sum, 2)} kWh</div><div class="leise">${de(sum * p, 2)} €</div>`));
    }
    if (c.art === 'stufen') {   // AN-0005: Wert jedes Geräts zur Zeit unter dem Zeiger
      const vx = fx * c.W, t = c.von + Math.max(0, Math.min(1, (vx - c.L) / (c.B - c.L))) * (c.bis - c.von);
      const wert = r => { let w = null; for (const q of r.punkte) { if (q[0] > t) break; w = q[1]; } return w; }, x = c.x(t);
      svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="${c.unten}" class="kreuz"/>`;
      const zeit = new Date(t).toLocaleTimeString('de-AT', { timeZone: this.d.z.zone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return this.tip(ev, `<b>${zeit}</b>${c.reihen.map(r => { const w = wert(r); return zahl(w) ? `<div><i style="background:${r.farbe}"></i>${esc(r.name)} <b>${de(w, 0)} W</b></div>` : ''; }).join('')}`);
    }
    if (c.art === 'linien') {
      const vx = fx * c.W, i = Math.max(0, Math.min(c.n - 1, Math.round((vx - c.x0) / (c.x1 - c.x0) * (c.n - 1)))), x = c.x0 + i / Math.max(1, c.n - 1) * (c.x1 - c.x0);
      svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="${c.unten}" class="kreuz"/>` + c.reihen.map(q => !zahl(q.v[i]) ? '' : `<circle cx="${x}" cy="${c.y(q.v[i])}" r="3.5" fill="${q.farbe}" class="punkt"/>`).join('');
      return this.tip(ev, `<b>${c.titel(i)}</b>${c.reihen.map(q => !zahl(q.v[i]) ? '' : `<div><i style="background:${q.farbe}"></i>${esc(q.name)} <b>${de(q.v[i])} °C</b></div>`).join('')}`);
    }
    if (c.art === 'linie') {
      const vx = fx * c.W, i = Math.max(0, Math.min(24, Math.round((vx - c.x0) / (c.x1 - c.x0) * 24))), x = c.x0 + i / 24 * (c.x1 - c.x0);
      const v = c.vb ? c.vb[Math.min(i, c.vb.length - 1)] || 0 : null, kv = c.reihen.length + 1;
      svg.querySelector('.hover').innerHTML = `<line x1="${x}" x2="${x}" y1="10" y2="${c.unten}" class="kreuz"/>` + c.reihen.map((s, k) => !zahl(s.v[i]) ? '' : `<circle cx="${x}" cy="${c.y(s.v[i])}" r="4" fill="var(--s${k + 1})" class="punkt"/>`).join('')
        + (c.vb ? `<circle cx="${x}" cy="${c.yv(v)}" r="3.5" fill="var(--s${kv})" class="punkt"/>` : '');
      return this.tip(ev, `<b>${String(i).padStart(2, '0')}:00</b>${c.reihen.map((s, k) => !zahl(s.v[i]) ? '' : `<div><i style="background:var(--s${k + 1})"></i>${s.name} <b>${de(s.v[i])} ${c.einheit}</b></div>`).join('')}`
        + (c.vb ? `<div><i style="background:var(--s${kv})"></i>Verbrauch <b>${de(v, 2)} kWh</b></div>` : ''));
    }
    const bar = ev.target.closest('.bar'); svg.querySelectorAll('.bar').forEach(x => x.classList.toggle('matt', !!bar && x !== bar));
    if (!bar) return this.tip(null); const i = +bar.dataset.i;
    return this.tip(ev, `<b>${c.labels[i]}</b><div>${de(c.werte[i], c.d)} ${c.einheit}</div>`);
  }
  tip(ev, html) {
    const t = this.root && this.root.querySelector('.tip'); if (!t) return;
    if (!ev || !html) { t.classList.remove('an'); this.root.querySelectorAll('.chart .hover').forEach(h => { h.innerHTML = ''; }); this.root.querySelectorAll('.bar.matt').forEach(x => x.classList.remove('matt')); return; }
    const r = this.root.getBoundingClientRect(); t.innerHTML = html; t.classList.add('an');
    const x = Math.min(ev.clientX - r.left + 12, r.width - t.offsetWidth - 8); t.style.left = x + 'px'; t.style.top = (ev.clientY - r.top - t.offsetHeight - 12) + 'px';
  }
}
if (!customElements.get('baustelle-panel')) customElements.define('baustelle-panel', BaustellePanel);
