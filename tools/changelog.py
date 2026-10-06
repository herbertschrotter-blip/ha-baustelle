#!/usr/bin/env python3
"""Leitet aus CHANGELOG.md (einzige Versionsquelle) ab, was Seite und Integration brauchen (BSM-022, bauplan-lit §4):

- `custom_components/baustelle/frontend/changelog.json` – Verlauf für die Seite „Über“ (gleiche Struktur wie im
  Mockup-Baukasten: Liste von `{"version", "datum", "punkte"}`, neueste zuerst, mehrzeilige Punkte als eine Zeile),
- `custom_components/baustelle/frontend/version.json` – `{"version": "…"}`; `frontend/bauen.mjs` setzt sie beim Bauen in
  die Seite ein (`SEITE_VERSION`, Versions-Hinweis),
- das Feld `version` in `custom_components/baustelle/manifest.json` (übrige Felder bleiben, wie sie sind).

Danach die Seite bauen: `node custom_components/baustelle/frontend/bauen.mjs`.
Aufruf: `python3 tools/changelog.py` (mit `--pruefen`: nur prüfen, ob alle drei aktuell sind, nichts schreiben).
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys

REPO = Path(__file__).resolve().parent.parent
QUELLE = REPO / "CHANGELOG.md"
FRONTEND = REPO / "custom_components" / "baustelle" / "frontend"
ZIEL = FRONTEND / "changelog.json"
VERSION = FRONTEND / "version.json"
MANIFEST = REPO / "custom_components" / "baustelle" / "manifest.json"
MANIFEST_VERSION = re.compile(r'("version"\s*:\s*")[^"]*(")')
KOPF = re.compile(r"\[([^\]]+)\]\s*–\s*(\S+)")


def verlauf(text: str) -> list[dict]:
    """Einträge aus dem Text von CHANGELOG.md (wie `glas.js`)."""
    ergebnis = []
    for teil in re.split(r"^## ", text, flags=re.M)[1:]:
        kopf, _, rest = teil.partition("\n")
        treffer = KOPF.search(kopf)
        if not treffer:
            continue
        punkte = [re.sub(r"\s*\n\s*", " ", p).strip() for p in re.split(r"^- ", rest, flags=re.M)[1:]]
        ergebnis.append({"version": treffer.group(1), "datum": treffer.group(2), "punkte": punkte})
    return ergebnis


def inhalt() -> str:
    return json.dumps(verlauf(QUELLE.read_text(encoding="utf-8")), ensure_ascii=False, indent=2) + "\n"


def neueste() -> str:
    return verlauf(QUELLE.read_text(encoding="utf-8"))[0]["version"]


def version_json() -> str:
    return json.dumps({"version": neueste()}) + "\n"


def manifest(text: str) -> str:
    """Text von `manifest.json` mit `version` = neueste Version aus CHANGELOG.md."""
    return MANIFEST_VERSION.sub(lambda m: f"{m.group(1)}{neueste()}{m.group(2)}", text, count=1)


def main() -> int:
    soll = {ZIEL: inhalt(), VERSION: version_json(), MANIFEST: manifest(MANIFEST.read_text(encoding="utf-8"))}
    if "--pruefen" in sys.argv:
        veraltet = [p.name for p, t in soll.items() if not p.exists() or p.read_text(encoding="utf-8") != t]
        print("changelog.json, version.json und manifest.json sind aktuell" if not veraltet
              else f"veraltet: {', '.join(veraltet)} – tools/changelog.py ausführen")
        return 1 if veraltet else 0
    for pfad, text in soll.items():
        pfad.write_text(text, encoding="utf-8")
    print(f"geschrieben changelog.json ({len(json.loads(soll[ZIEL]))} Versionen), version.json und manifest.json: {neueste()}"
          " – jetzt node custom_components/baustelle/frontend/bauen.mjs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
