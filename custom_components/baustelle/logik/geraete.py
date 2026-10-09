"""Geräte einer Baustelle: was nach dem Entfernen eines Geräts oder Containers übrig bleibt – ohne Home-Assistant-Code.

BSM-034.01 (Bauplan Geräte §3 Fehler 6): Einstellungen je Gerät, Zähler, „stumm“ und Reparatur-Hinweise hängen an der
ID des Unter-Eintrags (Gerät `gid`, Container `bid`). Wird einer gelöscht, räumt die Integration beim nächsten Laden auf.
Die Werte im Verlauf (Datenbank, Langzeitstatistik) bleiben.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

# Zähler je Gerät bzw. je Container: Schlüssel `<art>:<id>` (bei `stand` auch `stand:<id>:zeit`)
ZAEHLER_GERAET = ("stand", "mittel", "pumpzeit", "zyklen")
ZAEHLER_BEREICH = ("energie", "kosten", "heizzeit", "heizzeit_strom", "aufheiz", "abkuehl", "gradh",
                   "vgl_kwh", "vgl_gradh", "vgl_aufheiz", "vgl_abkuehl")


def _weg_zaehler(key: str, bereiche: set[str], geraete: set[str]) -> bool:
    art, _, rest = key.partition(":")
    kennung = rest.split(":", 1)[0]
    if not kennung:
        return False
    return (art in ZAEHLER_GERAET and kennung not in geraete) or (art in ZAEHLER_BEREICH and kennung not in bereiche)


def _weg_stumm(key: str, bereiche: set[str], geraete: set[str]) -> bool:
    """Warnungs-Schlüssel `art[:bereich[:gerät]]` (logik/warnungen.warn_key)."""
    teile = key.split(":")
    return (len(teile) > 1 and teile[1] not in bereiche) or (len(teile) > 2 and teile[2] not in geraete)


def reste_entfernen(daten: dict[str, Any], bereiche: Iterable[str], geraete: Iterable[str]) -> list[str]:
    """Einstellungen je Gerät, Zähler und „stumm“ gelöschter Geräte und Container aus `daten` (Einstellungen der
    Baustelle) entfernen; liefert die entfernten Schlüssel (`geraete:<gid>`, `zaehler:<key>`, `stumm:<key>`)."""
    b, g = set(bereiche), set(geraete)
    weg: list[str] = []
    for gid in [x for x in daten.get("geraete") or {} if x not in g]:
        del daten["geraete"][gid]
        weg.append(f"geraete:{gid}")
    for key in [k for k in daten.get("zaehler") or {} if _weg_zaehler(k, b, g)]:
        del daten["zaehler"][key]
        weg.append(f"zaehler:{key}")
    for key in [k for k in daten.get("stumm") or {} if _weg_stumm(k, b, g)]:
        del daten["stumm"][key]
        weg.append(f"stumm:{key}")
    return weg


def hinweise_reste(issue_ids: Iterable[str], entry_id: str, geraete: Iterable[str], erwartet: Iterable[str]) -> list[str]:
    """Reparatur-Hinweise dieser Baustelle, die zu keinem Gerät bzw. keiner erwarteten Entität mehr gehören
    (`ohne_leistung_<entry>_<gid>`, `fehlt_<entry>_<entity_id>`)."""
    g, e = set(geraete), set(erwartet)
    ohne, fehlt = f"ohne_leistung_{entry_id}_", f"fehlt_{entry_id}_"
    return [i for i in issue_ids
            if (i.startswith(ohne) and i[len(ohne):] not in g) or (i.startswith(fehlt) and i[len(fehlt):] not in e)]
