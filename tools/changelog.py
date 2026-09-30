#!/usr/bin/env python3
"""Erzeugt custom_components/baustelle/frontend/changelog.json aus CHANGELOG.md (Seite „Über“ › Verlauf).

Gleiche Struktur wie im Mockup-Baukasten (`mockups/quelle/glas.js`): Liste von
`{"version": "0.6.3", "datum": "2026-09-29", "punkte": ["…", …]}`, neueste zuerst; mehrzeilige Punkte werden zu einer
Zeile. Aufruf: `python3 tools/changelog.py` (mit `--pruefen`: nur prüfen, ob die Datei aktuell ist).
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys

REPO = Path(__file__).resolve().parent.parent
QUELLE = REPO / "CHANGELOG.md"
ZIEL = REPO / "custom_components" / "baustelle" / "frontend" / "changelog.json"
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


def main() -> int:
    neu = inhalt()
    if "--pruefen" in sys.argv:
        aktuell = ZIEL.exists() and ZIEL.read_text(encoding="utf-8") == neu
        print("changelog.json ist aktuell" if aktuell else "changelog.json ist veraltet – tools/changelog.py ausführen")
        return 0 if aktuell else 1
    ZIEL.write_text(neu, encoding="utf-8")
    print(f"geschrieben {ZIEL.relative_to(REPO)} ({len(json.loads(neu))} Versionen)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
