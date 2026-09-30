"""Lernende Regelung (0.8) – TPI-Regelung mit gelerntem Nachlauf und gelernten K-Werten, ohne Home-Assistant-Code.

Vorbild ist das bewährte TPI-Verfahren von Versatile Thermostat (Herbert 30.09.2026: „Gleich B“, Mockup glas.html):
je Zyklus von `ZYKLUS_MIN` Minuten ein Einschaltanteil

    Anteil = K innen × (Soll − innen − erwarteter Nachlauf) + K außen × (Soll − außen), begrenzt auf 0…1.

Dazu lernt jeder Container selbst:
- **Nachlauf:** Nach jedem Ausschalten steigt der Fühler noch (Ölradiatoren speichern Wärme). Gemessen wird bis zur
  Spitze, gemerkt je Heizkörperart (mit Ölradiator / nur Konvektor), Heizdauer davor (kurz/mittel/lang) und
  Außentemperatur (kalt/mild) als gleitender Mittelwert. Beim Regeln wird er vom Innenwert „vorweggenommen“.
- **K innen** (Trägheit): liegt die Spitze nach dem Ausschalten deutlich über dem Soll, wird er kleiner, deutlich
  darunter größer (je Messung ein Schritt).
- **K außen** (Wärmeverlust): bleibt der Raum in einem ruhigen Zyklus nahe am Soll im Mittel darunter, wird er größer,
  darüber kleiner.

Alle Werte sind begrenzt; ohne Messung gilt Nachlauf 0 und die Startwerte – dann verhält sich die Regelung wie TPI.
Zeiten sind `datetime` (mit Zone), Temperaturen °C.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any

ZYKLUS_MIN = 10
MIN_EIN_MIN = 2                # kürzere Pulse lohnen nicht: Anteil unter 20 % → aus, über 80 % → ganz ein
KINT_START, KEXT_START = 0.6, 0.01
KINT_GRENZEN = (0.1, 2.0)
KEXT_GRENZEN = (0.0, 0.1)
KINT_SCHRITT = 0.05            # je Messung ±5 %
KEXT_SCHRITT = 0.001
LERN_ZYKLEN = 50               # ab so vielen Anpassungen gilt ein K-Wert als gelernt
NACHLAUF_MAX = 3.0
GEWICHT = 0.2                  # gleitender Mittelwert: neuer Wert zählt 20 %
KALT_UNTER = 5.0               # Außentemperatur darunter: „kalt“
STOPP_AB_MIN = 20              # bleibt er so lange aus, ist es ein Ausschalten (sonst nur eine TPI-Pause)
BEOBACHTEN_MAX_MIN = 90
SPITZE_VORBEI = 0.2            # so weit unter der Spitze: sie ist vorbei
TREFFER_TOLERANZ = 0.3         # Spitze so nahe am Soll gilt als getroffen
TREFFER_MAX = 10
EIN_FENSTER_MIN = 60           # Heizdauer = Minuten „ein“ in der Stunde vor dem Ausschalten
KLASSEN = (("kurz", 15), ("mittel", 45), ("lang", None))
ARTEN = ("oel", "konvektor")
BAENDER = ("kalt", "mild")


# ---------------------------------------------------------------------------------------------------------- Regeln
@dataclass(frozen=True)
class Tpi:
    """Was die Regelung eines lernenden Containers zur Minute braucht."""

    kint: float
    kext: float
    nachlauf: float
    aussen: float | None
    minute_im_zyklus: int


def tpi_anteil(innen: float, soll: float, t: Tpi) -> float:
    """Einschaltanteil 0…1 (siehe Modul-Docstring); ohne Außentemperatur nur der innere Teil."""
    wert = t.kint * (soll - innen - t.nachlauf) + (t.kext * (soll - t.aussen) if t.aussen is not None else 0.0)
    return max(0.0, min(1.0, wert))


def tpi_ein(anteil: float, minute_im_zyklus: int) -> bool:
    """Ein zu Beginn des Zyklus für `anteil × ZYKLUS_MIN` Minuten; sehr kurze Pulse bzw. Pausen entfallen."""
    dauer = anteil * ZYKLUS_MIN
    if dauer < MIN_EIN_MIN:
        return False
    if dauer > ZYKLUS_MIN - MIN_EIN_MIN:
        return True
    return minute_im_zyklus % ZYKLUS_MIN < dauer


def klasse(ein_minuten: float) -> str:
    for name, bis in KLASSEN:
        if bis is None or ein_minuten < bis:
            return name
    return KLASSEN[-1][0]


def band(aussen: float | None) -> str:
    return "kalt" if aussen is not None and aussen < KALT_UNTER else "mild"


def schluessel(art: str, kl: str, bd: str) -> str:
    return f"{art}|{kl}|{bd}"


def ein_minuten(log: Iterable[tuple[datetime, datetime | None]], jetzt: datetime, fenster_min: float = EIN_FENSTER_MIN) -> float:
    """Minuten „ein“ in den letzten `fenster_min` Minuten; `None` als Ende = läuft noch."""
    ab = jetzt.timestamp() - fenster_min * 60
    summe = 0.0
    for start, ende in log:
        von, bis = max(start.timestamp(), ab), (ende or jetzt).timestamp()
        if bis > von:
            summe += bis - von
    return summe / 60


def nachlauf_erwartet(tabelle: Mapping[str, list[float]], art: str, kl: str, bd: str) -> float:
    """Gelernter Nachlauf; fehlt der Fall, der des anderen Außenbands, sonst 0 (wie ohne Lernen)."""
    for b in (bd, *(x for x in BAENDER if x != bd)):
        wert = tabelle.get(schluessel(art, kl, b))
        if wert and wert[2] > 0:
            return float(wert[0])
    return 0.0


def mittel_neu(alt: list[float] | None, grad: float, minuten: float) -> list[float]:
    """[Nachlauf °C, Minuten bis zur Spitze, Anzahl] – der erste Wert zählt ganz, danach gleitend mit `GEWICHT`."""
    grad = max(0.0, min(NACHLAUF_MAX, grad))
    if not alt or alt[2] <= 0:
        return [round(grad, 3), round(minuten, 1), 1]
    return [round(alt[0] + GEWICHT * (grad - alt[0]), 3), round(alt[1] + GEWICHT * (minuten - alt[1]), 1), int(alt[2]) + 1]


def kint_neu(kint: float, abweichung: float) -> float:
    """Spitze − Soll nach einem Ausschalten: deutlich drüber → kleiner, deutlich drunter → größer."""
    if abweichung > TREFFER_TOLERANZ:
        kint *= 1 - KINT_SCHRITT
    elif abweichung < -TREFFER_TOLERANZ:
        kint *= 1 + KINT_SCHRITT
    return round(max(KINT_GRENZEN[0], min(KINT_GRENZEN[1], kint)), 4)


def kext_neu(kext: float, mittel_unter_soll: float) -> float:
    """Mittlere Abweichung (Soll − innen) eines ruhigen Zyklus: bleibt es kühler → größer, wärmer → kleiner."""
    if mittel_unter_soll > TREFFER_TOLERANZ:
        kext += KEXT_SCHRITT
    elif mittel_unter_soll < -TREFFER_TOLERANZ:
        kext -= KEXT_SCHRITT
    return round(max(KEXT_GRENZEN[0], min(KEXT_GRENZEN[1], kext)), 4)


# ------------------------------------------------------------------------------------------------- Lernstand je Minute
def neuer_stand() -> dict[str, Any]:
    """Lernstand eines Containers (JSON-fähig, im Store unter laufzeit.lernen.<container>)."""
    return {"kint": KINT_START, "kext": KEXT_START, "n_kint": 0, "n_kext": 0, "nachlauf": {}, "treffer": [], "zyklen": 0,
            "ein": [], "beob": None, "zyklus": None, "letzte": None}


def _zeit(text: str | None) -> datetime | None:
    return datetime.fromisoformat(text) if text else None


def _iso(zeit: datetime) -> str:
    return zeit.isoformat(timespec="seconds")


def takt(
    stand: dict[str, Any], *, jetzt: datetime, heizt: bool, innen: float | None, soll: float, aussen: float | None,
    art: str, regelt: bool,
) -> dict[str, Any]:
    """Eine Minute Lernen: Ein-Zeiten mitschreiben, Nachlauf nach dem Ausschalten beobachten, K-Werte anpassen.

    `heizt`: ein Heizkörper des Containers zieht gerade Strom. `art`: „oel“ oder „konvektor“ (was eingeschaltet ist
    bzw. zuletzt war). `regelt`: der Container regelt gerade selbst (lernender Thermostat) – nur dann wird K außen
    gelernt. Gibt den neuen Stand zurück (der alte bleibt unverändert).
    """
    s = {**neuer_stand(), **stand}
    log = [(_zeit(a), _zeit(e)) for a, e in s["ein"]]
    lief = bool(log) and log[-1][1] is None
    # Ein-Zeiten der letzten zwei Stunden
    if heizt and not lief:
        log.append((jetzt, None))
        if s["beob"] is not None:    # wieder ein, bevor die Spitze klar war
            s = _beob_ende(s, jetzt, abbruch=True)
    elif not heizt and lief:
        start = log[-1][0]
        log[-1] = (start, jetzt)
        # Ausgangswert: Temperatur der letzten Heizminute – das Ausschalten wird erst eine Minute später gesehen
        ab = s["letzte"] if s["letzte"] is not None else innen
        if ab is not None:
            dauer = ein_minuten(log, jetzt)
            s["beob"] = {"aus": _iso(jetzt), "temp": ab, "spitze": max(ab, innen if innen is not None else ab),
                         "spitze_zeit": _iso(jetzt), "soll": soll, "schluessel": schluessel(art, klasse(dauer), band(aussen))}
    if innen is not None:
        s["letzte"] = innen
    grenze = jetzt.timestamp() - 2 * 3600
    s["ein"] = [[_iso(a), _iso(e) if e else None] for a, e in log if e is None or e.timestamp() > grenze]
    # Nachlauf beobachten
    b = s["beob"]
    if b is not None and innen is not None and not heizt:
        if innen > b["spitze"]:
            s["beob"] = b = {**b, "spitze": innen, "spitze_zeit": _iso(jetzt)}
        seit = (jetzt - _zeit(b["aus"])).total_seconds() / 60
        if innen <= b["spitze"] - SPITZE_VORBEI or seit >= BEOBACHTEN_MAX_MIN:
            s = _beob_ende(s, jetzt, abbruch=False)
    # K außen: ruhiger Zyklus nahe am Soll (je ZYKLUS_MIN Minuten ein Mittelwert)
    z = s["zyklus"]
    if not regelt or innen is None or abs(soll - innen) >= 1.0:
        s["zyklus"] = None
    elif z is None or (jetzt - _zeit(z["start"])).total_seconds() / 60 >= ZYKLUS_MIN:
        if z is not None and z["n"] >= ZYKLUS_MIN - 1:
            s["kext"] = kext_neu(float(s["kext"]), z["summe"] / z["n"])
            s["n_kext"] = int(s["n_kext"]) + 1
        s["zyklus"] = {"start": _iso(jetzt), "summe": soll - innen, "n": 1}
    else:
        s["zyklus"] = {**z, "summe": z["summe"] + soll - innen, "n": z["n"] + 1}
    return s


def _beob_ende(s: dict[str, Any], jetzt: datetime, *, abbruch: bool) -> dict[str, Any]:
    """Beobachtung abschließen: zu kurz unterbrochen (TPI-Pause) → verwerfen, sonst Nachlauf, Treffer, K innen lernen."""
    b = s["beob"]
    s = {**s, "beob": None}
    seit = (jetzt - _zeit(b["aus"])).total_seconds() / 60
    if abbruch and seit < STOPP_AB_MIN:
        return s
    grad = b["spitze"] - b["temp"]
    minuten = (_zeit(b["spitze_zeit"]) - _zeit(b["aus"])).total_seconds() / 60
    s["nachlauf"] = {**s["nachlauf"], b["schluessel"]: mittel_neu(s["nachlauf"].get(b["schluessel"]), grad, minuten)}
    s["zyklen"] = int(s["zyklen"]) + 1
    abweichung = b["spitze"] - b["soll"]
    s["treffer"] = [*s["treffer"], round(abweichung, 2)][-TREFFER_MAX:]
    if b["soll"] - b["temp"] < 1.0:      # nahe am Soll ausgeschaltet: sagt etwas über K innen
        s["kint"] = kint_neu(float(s["kint"]), abweichung)
        s["n_kint"] = int(s["n_kint"]) + 1
    return s


def anzeige(stand: Mapping[str, Any]) -> dict[str, Any]:
    """Lernstand für die Seite: K-Werte mit Fortschritt, Nachlauf-Tabelle, Treffer."""
    s = {**neuer_stand(), **stand}
    return {
        "zyklen": s["zyklen"],
        "kint": {"wert": s["kint"], "start": KINT_START, "fort": min(1.0, s["n_kint"] / LERN_ZYKLEN)},
        "kext": {"wert": s["kext"], "start": KEXT_START, "fort": min(1.0, s["n_kext"] / LERN_ZYKLEN)},
        "nachlauf": {k: {"grad": v[0], "min": v[1], "n": v[2]} for k, v in s["nachlauf"].items()},
        "treffer": list(s["treffer"]),
    }
