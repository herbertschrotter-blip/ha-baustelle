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
    """Version: CHANGELOG.md → version.json und manifest.json (tools/changelog.py) → gebaute Seite (bauen.mjs, BSM-022)."""
    werkzeug = _werkzeug()
    assert werkzeug.VERSION.read_text(encoding="utf-8") == werkzeug.version_json(), "tools/changelog.py ausführen"
    manifest = json.loads((REPO / "custom_components" / "baustelle" / "manifest.json").read_text(encoding="utf-8"))
    version = json.loads(werkzeug.VERSION.read_text(encoding="utf-8"))["version"]
    assert manifest["version"] == version, "manifest.json#version zieht mit CHANGELOG.md mit"
    js = (REPO / "custom_components" / "baustelle" / "frontend" / "baustelle-panel.js").read_text(encoding="utf-8")
    assert f'SEITE_VERSION = "{version}";' in js, "Seite neu bauen: node custom_components/baustelle/frontend/bauen.mjs"
