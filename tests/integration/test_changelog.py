"""`frontend/changelog.json` (Seite „Über“ › Verlauf) ist auf dem Stand von CHANGELOG.md (`tools/changelog.py`)."""

import importlib.util
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def _werkzeug():
    spec = importlib.util.spec_from_file_location("changelog", REPO / "tools" / "changelog.py")
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


def test_changelog_json_aktuell() -> None:
    werkzeug = _werkzeug()
    datei = REPO / "custom_components" / "baustelle" / "frontend" / "changelog.json"
    assert datei.read_text(encoding="utf-8") == werkzeug.inhalt(), "tools/changelog.py ausführen"
    verlauf = json.loads(datei.read_text(encoding="utf-8"))
    assert verlauf[0].keys() == {"version", "datum", "punkte"}


def test_verlauf_wie_mockup_baukasten() -> None:
    text = "# Changelog\n\n## [0.7.0] – 2026-10-01\n\n- Erster Punkt\n  mit zweiter Zeile.\n- Zweiter.\n\n## Ohne Version\n\n- x\n"
    assert _werkzeug().verlauf(text) == [
        {"version": "0.7.0", "datum": "2026-10-01", "punkte": ["Erster Punkt mit zweiter Zeile.", "Zweiter."]}
    ]


def test_seite_version_wie_changelog_und_manifest() -> None:
    """Der Versions-Hinweis der Seite vergleicht `SEITE_VERSION` mit der Version von HA – alle drei gleich."""
    werkzeug = _werkzeug()
    js = werkzeug.SEITE.read_text(encoding="utf-8")
    assert werkzeug.seite(js) == js, "tools/changelog.py ausführen"
    manifest = json.loads((REPO / "custom_components" / "baustelle" / "manifest.json").read_text(encoding="utf-8"))
    assert f"const SEITE_VERSION = '{manifest['version']}';" in js, "manifest.json#version zieht mit CHANGELOG.md mit"
