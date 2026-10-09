"""Container-Symbol: Aussehen je Container und Zustand aus den Sensoren – reine Fachlogik (BSM-032, Herbert 05./06.10.2026).

Aussehen (`einstellungen.bereiche.<id>.symbol`, Mockup `mockups/container-symbol.html`): Einzel- oder Doppelcontainer,
Farbe, Stahlrahmen in eigener Farbe (oder keiner), Türen 1–2 und Fenster 1–4 je an Front oder Seite (im Symbol sichtbar
sind nur diese beiden Wände), je mit Sensor; dazu eine Licht-Quelle. Ohne Einstellung: eine Tür links und ein Fenster.
Lage: Türen sitzen links, mittig oder rechts an ihrer Wand (0,15 / 0,5 / 0,85); mehrere Fenster verteilt die Seite
gleichmäßig auf den Platz daneben, ihre Lage bestimmt nur die Reihenfolge (Herbert 06.10.2026).

Zustand (die Seite zeichnet nur):
- Tür offen = Kontakt meldet offen; Tür 1 ohne eigenen Sensor nimmt den Türkontakt des Containers.
- Fenster: Kontakt zu → zu; offen und um mindestens `KIPP_AB_GRAD` geneigt (Drehung des BLU Door/Window am Flügel)
  → gekippt; offen ohne Neigung → offen.
- Licht an: Schalter/Licht/Binärsensor „an“, Helligkeit über `LICHT_AB_LUX`.
"""

from __future__ import annotations

from typing import Any

WAENDE = ("front", "seite")
LAGEN = (0.15, 0.33, 0.5, 0.67, 0.85)
MAX_TUEREN, MAX_FENSTER = 2, 4
KIPP_AB_GRAD = 5.0
LICHT_AB_LUX = 50.0


def standard() -> dict[str, Any]:
    return {"doppel": False, "farbe": None, "rahmen": None, "tueren": [{"wand": "front", "pos": 0.15, "sensor": None}],
            "fenster": [{"wand": "front", "pos": 0.67, "sensor": None}], "licht": None}


def _element(x: Any) -> dict[str, Any]:
    if not isinstance(x, dict) or x.get("wand") not in WAENDE:
        raise ValueError("Tür bzw. Fenster braucht eine Wand (front oder seite)")
    pos = min(LAGEN, key=lambda lage: abs(lage - float(x.get("pos", 0.5))))   # auf die nächste Lage
    sensor = x.get("sensor") or None
    if sensor is not None and not (isinstance(sensor, str) and "." in sensor):
        raise ValueError("Sensor muss eine Entität sein")
    return {"wand": x["wand"], "pos": pos, "sensor": sensor}


def _farbe(x: Any) -> str | None:
    if not x:
        return None
    if not (isinstance(x, str) and len(x) == 7 and x.startswith("#") and all(c in "0123456789abcdefABCDEF" for c in x[1:])):
        raise ValueError("Farbe als #rrggbb")
    return x


def bereinigen(wert: Any) -> dict[str, Any] | None:
    """Prüfen und vereinheitlichen; None = Standard. Wirft ValueError bei Unsinn."""
    if wert is None:
        return None
    if not isinstance(wert, dict):
        raise ValueError("Symbol muss ein Objekt sein")
    tueren, fenster = wert.get("tueren") or [], wert.get("fenster") or []
    if not 1 <= len(tueren) <= MAX_TUEREN or not 1 <= len(fenster) <= MAX_FENSTER:
        raise ValueError(f"1–{MAX_TUEREN} Türen und 1–{MAX_FENSTER} Fenster")
    farbe, rahmen = _farbe(wert.get("farbe")), _farbe(wert.get("rahmen"))
    licht = wert.get("licht") or None
    if licht is not None and not (isinstance(licht, str) and "." in licht):
        raise ValueError("Licht muss eine Entität sein")
    return {"doppel": bool(wert.get("doppel")), "farbe": farbe, "rahmen": rahmen, "tueren": [_element(x) for x in tueren],
            "fenster": [_element(x) for x in fenster], "licht": licht}


def fenster_zustand(offen: bool | None, drehung: float | None) -> str:
    """zu | gekippt | offen."""
    if not offen:
        return "zu"
    return "gekippt" if drehung is not None and abs(drehung) >= KIPP_AB_GRAD else "offen"


def licht_an(zustand: str | None, zahl: float | None) -> bool:
    """Licht an aus dem Zustand einer Entität: Zahl (Helligkeit) über der Schwelle, sonst „on“."""
    if zahl is not None:
        return zahl > LICHT_AB_LUX
    return zustand == "on"


def sensor_eintragen(symbol: dict[str, Any] | None, art: str, entity_id: str, tuerkontakt: str | None = None
                     ) -> dict[str, Any] | None:
    """Tür- bzw. Fensterkontakt aus dem Inventar ins Aussehen eintragen (BSM-034.03): in die erste Tür bzw. das erste
    Fenster ohne Sensor (Tür 1 hat den Türkontakt des Containers, wenn einer gesetzt ist), sonst eine neue Tür bzw. ein
    neues Fenster an der Front, solange Platz ist. None = nichts zu tun (schon eingetragen oder kein Platz)."""
    s = bereinigen(symbol) or standard()
    liste_art = "tueren" if art == "tuer" else "fenster"
    eingetragen = [x["sensor"] for k in ("tueren", "fenster") for x in s[k]] + [tuerkontakt]
    if entity_id in eingetragen:
        return None
    liste = s[liste_art]
    for i, x in enumerate(liste):
        if not x["sensor"] and not (liste_art == "tueren" and i == 0 and tuerkontakt):
            x["sensor"] = entity_id
            return s
    if len(liste) >= (MAX_TUEREN if liste_art == "tueren" else MAX_FENSTER):
        return None
    belegt = {x["pos"] for k in ("tueren", "fenster") for x in s[k] if x["wand"] == "front"}
    pos = next((lage for lage in LAGEN if lage not in belegt), 0.5)
    liste.append({"wand": "front", "pos": pos, "sensor": entity_id})
    return s
