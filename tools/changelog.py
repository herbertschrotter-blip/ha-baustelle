#!/usr/bin/env python3
"""Erzeugt custom_components/baustelle/frontend/changelog.json aus CHANGELOG.md (Seite „Über“ › Verlauf).

Gleiche Struktur wie im Mockup-Baukasten (`mockups/quelle/glas.js`): Liste von
`{"version": "0.6.3", "datum": "2026-09-29", "punkte": ["…", …]}`, neueste zuerst; mehrzeilige Punkte werden zu einer
Zeile. Setzt außerdem `SEITE_VERSION` in `baustelle-panel.js` auf die neueste Version (Versions-Hinweis der Seite).
Aufruf: `python3 tools/changelog.py` (mit `--pruefen`: nur prüfen, ob beides aktuell ist).
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys

REPO = Path(__file__).resolve().parent.parent
QUELLE = REPO / "CHANGELOG.md"
ZIEL = REPO / "custom_components" / "baustelle" / "frontend" / "changelog.json"
SEITE = REPO / "custom_components" / "baustelle" / "frontend" / "baustelle-panel.js"
SEITE_VERSION = re.compile(r"^const SEITE_VERSION = '[^']*';", re.M)
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


def seite(text: str) -> str:
    """Text von `baustelle-panel.js` mit `SEITE_VERSION` = neueste Version aus CHANGELOG.md."""
    version = verlauf(QUELLE.read_text(encoding="utf-8"))[0]["version"]
    return SEITE_VERSION.sub(lambda _: f"const SEITE_VERSION = '{version}';", text, count=1)


def main() -> int:
    neu = inhalt()
    js = SEITE.read_text(encoding="utf-8")
    if "--pruefen" in sys.argv:
        aktuell = ZIEL.exists() and ZIEL.read_text(encoding="utf-8") == neu and seite(js) == js
        print("changelog.json und SEITE_VERSION sind aktuell" if aktuell else "veraltet – tools/changelog.py ausführen")
        return 0 if aktuell else 1
    ZIEL.write_text(neu, encoding="utf-8")
    SEITE.write_text(seite(js), encoding="utf-8")
    print(f"geschrieben {ZIEL.relative_to(REPO)} ({len(json.loads(neu))} Versionen), SEITE_VERSION {json.loads(neu)[0]['version']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
