#!/usr/bin/env python3
"""Tickets aus dem Melden-Knopf der Seite „Baustelle“ lesen und ändern (Ticket-Profil in CLAUDE.md).

Lesen:   <config>/baustelle/meldungen.json (schreibt die Integration bei jeder Änderung neu).
Ändern:  nur über den HA-Dienst `baustelle.ticket` (REST-API des Supervisors mit SUPERVISOR_TOKEN aus der Umgebung des
         Add-ons – der Token wird nirgends gespeichert). Die Datei selbst wird nie bearbeitet.

  python3 tools/ticket.py liste [alle]
  python3 tools/ticket.py zeige FE-0001
  python3 tools/ticket.py status FE-0001 angenommen|in_arbeit|geloest|geschlossen|neu [--version 0.7.4] [--commit abc123]
  python3 tools/ticket.py notiz FE-0001 "Ursache: …"
  python3 tools/ticket.py verwerfen FE-0001 "Grund"
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

CONFIG = Path(os.environ.get("HA_CONFIG", "/config"))
DATEI = CONFIG / "baustelle" / "meldungen.json"
API = os.environ.get("HA_API", "http://supervisor/core/api")
STATUS = ["neu", "angenommen", "in_arbeit", "geloest", "geschlossen", "verworfen"]
OFFEN = {"neu", "angenommen", "in_arbeit", "geloest"}
TEXT = {"neu": "neu", "angenommen": "angenommen", "in_arbeit": "in Arbeit", "geloest": "gelöst",
        "geschlossen": "geschlossen", "verworfen": "verworfen"}
ART = {"fehler": "Fehler", "wunsch": "Wunsch", "anregung": "Anregung"}


def laden() -> list[dict]:
    if not DATEI.exists():
        sys.exit(f"{DATEI} fehlt – ist die Integration Baustelle ab 0.7.2 geladen?")
    return json.loads(DATEI.read_text(encoding="utf-8"))


def finden(nr: str) -> dict:
    m = next((x for x in laden() if str(x.get("ticket", "")).upper() == nr.upper()), None)
    if m is None:
        sys.exit(f"Ticket {nr} gibt es nicht")
    return m


def dienst(daten: dict) -> dict:
    token = os.environ.get("SUPERVISOR_TOKEN") or os.environ.get("HASSIO_TOKEN")
    if not token:
        sys.exit("Kein SUPERVISOR_TOKEN in der Umgebung – im Claude-Terminal-Add-on ausführen oder Dienst baustelle.ticket in HA aufrufen")
    anfrage = urllib.request.Request(f"{API}/services/baustelle/ticket?return_response", method="POST",
                                     data=json.dumps(daten).encode(), headers={"Authorization": f"Bearer {token}",
                                                                               "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(anfrage, timeout=20) as antwort:
            return json.loads(antwort.read() or b"{}")
    except urllib.error.HTTPError as err:
        sys.exit(f"HA lehnt ab ({err.code}): {err.read().decode(errors='replace')[:300]}")


def zeile(m: dict) -> str:
    return (f"{m.get('ticket', '?'):8} {TEXT.get(m.get('status'), m.get('status')):11} {ART.get(m.get('art'), m.get('art')):8} "
            f"{str(m.get('zeit') or '')[:16].replace('T', ' ')}  {str(m.get('text') or '').strip().splitlines()[0][:70]}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    u = p.add_subparsers(dest="befehl", required=True)
    liste = u.add_parser("liste"); liste.add_argument("alle", nargs="?")
    u.add_parser("zeige").add_argument("nr")
    st = u.add_parser("status"); st.add_argument("nr"); st.add_argument("status", choices=STATUS)
    st.add_argument("--version"); st.add_argument("--commit"); st.add_argument("--notiz")
    no = u.add_parser("notiz"); no.add_argument("nr"); no.add_argument("text")
    ve = u.add_parser("verwerfen"); ve.add_argument("nr"); ve.add_argument("grund")
    a = p.parse_args()

    if a.befehl == "liste":
        tickets = [m for m in laden() if a.alle == "alle" or m.get("status") in OFFEN]
        print("\n".join(zeile(m) for m in reversed(tickets)) or "keine offenen Tickets")
    elif a.befehl == "zeige":
        m = finden(a.nr)
        print(zeile(m)); print()
        print(str(m.get("text") or "").strip()); print()
        for k in ("kontext", "seite", "baustelle", "geraet", "version", "id"):
            if m.get(k):
                print(f"{k}: {json.dumps(m[k], ensure_ascii=False) if isinstance(m[k], dict) else m[k]}")
        for b in m.get("bilder") or []:   # WU-0016: Screenshots zur Meldung (mit Read ansehen)
            print(f"bild: {DATEI.parent / 'meldungen' / b}")
        for v in m.get("verlauf") or []:
            print(f"- {str(v.get('zeit'))[:16]} {v.get('von', '')}: " + " · ".join(
                str(x) for x in (TEXT.get(v.get("status"), ""), v.get("version") and "v" + v["version"], v.get("commit"), v.get("notiz")) if x))
    elif a.befehl == "status":
        finden(a.nr)
        if a.status in ("geloest", "geschlossen") and not (a.version and a.commit and a.notiz):
            sys.exit(f"{a.status} braucht --version, --commit und --notiz (was behoben wurde)")
        r = dienst({"ticket": a.nr, "status": a.status, **{k: v for k, v in (("version", a.version), ("commit", a.commit), ("notiz", a.notiz)) if v}})
        print(f"{r.get('service_response', r).get('ticket', a.nr)}: {r.get('service_response', r).get('status_text', a.status)}")
    elif a.befehl == "notiz":
        finden(a.nr)
        dienst({"ticket": a.nr, "notiz": a.text}); print(f"{a.nr}: Notiz gespeichert")
    elif a.befehl == "verwerfen":
        finden(a.nr)
        dienst({"ticket": a.nr, "status": "verworfen", "notiz": a.grund}); print(f"{a.nr}: verworfen")


if __name__ == "__main__":
    main()
