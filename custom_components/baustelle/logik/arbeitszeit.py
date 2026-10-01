"""Arbeitszeit und Heizplan eines Tages – reine Fachlogik ohne Home-Assistant-Code.

Zeiten sind Minuten seit Mitternacht (`int`), Tage `datetime.date`, Wochentag `0 = Montag`.
Vorbild ist das abgenommene Mockup (`mockups/quelle/glas-app.js`: `planTag`, `heizzeiten`, `statusText`,
`bedarfBlock`), Vorgabe der Bauplan 0.7 Abschnitt 2.1.

Ein Tagesplan besteht aus den Abschnitten (wie der Zeitstrahl im Mockup):
`[start, vor)` Frühstart · `[vor, a)` Vorheizen · `[a, b)` Arbeitszeit · `[b, nach)` Nachheizen · `[nach, ende)` Kleidung trocknen.

Entscheidungen, wo der Bauplan offen ist (im Sinne des Mockups):
- Die Arbeitszeit wird je Tag gewählt (`gueltige_arbeitszeit(liste, tag)`); das Mockup nimmt die heute gültige für die
  ganze Woche, was nur bei einem Wechsel innerhalb der Woche abweicht.
- Eine Ausnahme `arbeit`/`zeiten` geht vor `frei` (Feiertag/Urlaub): wer an einem Feiertag ausdrücklich eine Ausnahme
  einträgt, will arbeiten. Eine Ausnahme `frei` macht den Tag immer frei.
- Frühstart gilt nur mit `fruehstart=True` (Schalter „Kälte-Frühstart“ im Mockup); fehlende Wetterwerte ändern nichts.
- `start` wird bei 0, `ende` bei 1440 begrenzt (das Mockup rechnet ohne Grenze, zeigt aber nur 04:00–20:00); über
  Mitternacht wird nicht in den Nachbartag geheizt.
- Arbeitszeiten mit `bis <= von` (leer oder verdreht) gelten als frei; das Mockup lässt sie beim Speichern gar nicht zu.
- Haben mehrere Arbeitszeiten dasselbe `ab`, gilt wie im Mockup (`azListe` stabil sortiert, `.at(-1)`) die zuletzt
  eingetragene.
- Der Abschnitt vor dem Vorheizen heißt immer „fruehstart“, auch wenn er (teils) vom Regen am Vortag kommt – das Mockup
  zeichnet beides als einen Abschnitt „Frühstart“.
- Lernende Container mit gelernter Aufheizzeit (`WarmAb`, AN-0004): Vorheizen = „Soll erreicht vor Beginn“ + Aufheizzeit,
  höchstens `max_min`; kein Kälte-Frühstart; Nachheizen = „warm halten“. Früher nach Regen und Kleidung trocknen
  kommen wie bisher dazu (Herbert 01.10.2026).
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import StrEnum
from typing import Any

TAG_MINUTEN = 24 * 60


class AusnahmeArt(StrEnum):
    """Art einer Einmal-Ausnahme von der Arbeitszeit (Texte wie Mockup `AUSNAHME`)."""

    ARBEIT = "arbeit"  # zusätzlich arbeiten
    ZEITEN = "zeiten"  # andere Zeiten
    FREI = "frei"  # frei


class PlanGrund(StrEnum):
    """Warum der Plan eines Tages von der Arbeitszeit abweicht."""

    AUSNAHME = "ausnahme"
    FRUEHSTART = "fruehstart"
    FRUEHER_NACH_REGEN = "frueher_nach_regen"
    TROCKNEN = "trocknen"
    GELERNT = "gelernt"   # AN-0004: Beginn aus der gelernten Aufheizzeit


class Abschnitt(StrEnum):
    """Abschnitt eines Tagesplans (Zeitstrahl im Mockup)."""

    FRUEHSTART = "fruehstart"
    VORHEIZEN = "vorheizen"
    ARBEITSZEIT = "arbeitszeit"
    NACHHEIZEN = "nachheizen"
    TROCKNEN = "trocknen"


def minuten(uhrzeit: str) -> int:
    """„07:30“ → 450."""
    stunden, minute = uhrzeit.split(":")
    return int(stunden) * 60 + int(minute)


def uhrzeit(minute: int) -> str:
    """450 → „07:30“."""
    return f"{minute // 60:02d}:{minute % 60:02d}"


@dataclass(frozen=True)
class Arbeitszeit:
    """Arbeitszeiten je Wochentag, gültig ab `ab`; `None` = frei an diesem Wochentag."""

    ab: date
    name: str
    tage: dict[int, tuple[int, int] | None] = field(default_factory=dict)

    @classmethod
    def aus_store(cls, daten: dict[str, Any]) -> Arbeitszeit:
        """Aus dem Store (`{"ab": "2026-10-05", "name": …, "tage": {"0": ["07:00", "16:30"], …}}`)."""
        tage: dict[int, tuple[int, int] | None] = {}
        for schluessel, zeit in (daten.get("tage") or {}).items():
            tage[int(schluessel)] = (minuten(zeit[0]), minuten(zeit[1])) if zeit else None
        return cls(ab=date.fromisoformat(daten["ab"]), name=daten.get("name", ""), tage=tage)


@dataclass(frozen=True)
class Ausnahme:
    """Einmal-Ausnahme von der Arbeitszeit für genau ein Datum."""

    datum: date
    art: str  # AusnahmeArt
    von: int = 0
    bis: int = 0
    notiz: str = ""

    @classmethod
    def aus_store(cls, daten: dict[str, Any]) -> Ausnahme:
        """Aus dem Store (`{"datum": "2026-10-03", "art": "arbeit", "von": "07:00", "bis": "12:00", "notiz": ""}`)."""
        von, bis = daten.get("von"), daten.get("bis")
        return cls(
            datum=date.fromisoformat(daten["datum"]),
            art=AusnahmeArt(daten["art"]),
            von=minuten(von) if von else 0,
            bis=minuten(bis) if bis else 0,
            notiz=daten.get("notiz") or "",
        )


@dataclass(frozen=True)
class HeizRegeln:
    """Einstellungen für den Heizplan (Standardwerte wie im Mockup)."""

    vorheizen_min: int = 45
    nachheizen_min: int = 15
    fruehstart: bool = True
    fruehstart_unter: float = 0.0
    fruehstart_min: int = 30
    trocknen_ab_mm: float = 2.0
    trocknen_laenger_min: int = 45
    trocknen_frueher_min: int = 15


@dataclass(frozen=True)
class WarmAb:
    """„Warm ab“ eines lernenden Containers (AN-0004, Optimum Start).

    Soll erreicht `vor_min` vor Arbeitsbeginn, warm halten bis `nach_min` nach Arbeitsende, nie früher als `max_min`
    vor Arbeitsbeginn beginnen. `aufheiz_min`: gelernte Minuten bis zum Soll (`lernen.aufheiz_min`); None = noch nicht
    gelernt – dann gelten Vorheizen, Kälte-Frühstart und Nachheizen wie bisher.
    """

    vor_min: int = 0
    nach_min: int = 0
    max_min: int = 120
    aufheiz_min: int | None = None


@dataclass(frozen=True)
class WetterTag:
    """Wetter eines Tages für den Plan; fehlende Werte sind None."""

    frueh_min_temp: float | None = None
    regen_vortag_mm: float | None = None
    regen_heute_mm: float | None = None


@dataclass(frozen=True)
class Plan:
    """Heizplan eines Tages: `start ≤ vor ≤ a < b ≤ nach ≤ ende` (Minuten)."""

    start: int
    vor: int
    a: int
    b: int
    nach: int
    ende: int
    gruende: tuple[str, ...] = ()
    ausnahme: Ausnahme | None = None

    def abschnitte(self) -> list[tuple[int, int, Abschnitt]]:
        """Nicht leere Abschnitte `(von, bis, art)` in zeitlicher Folge (Mockup `heizzeiten`)."""
        teile = [
            (self.start, self.vor, Abschnitt.FRUEHSTART),
            (self.vor, self.a, Abschnitt.VORHEIZEN),
            (self.a, self.b, Abschnitt.ARBEITSZEIT),
            (self.b, self.nach, Abschnitt.NACHHEIZEN),
            (self.nach, self.ende, Abschnitt.TROCKNEN),
        ]
        return [t for t in teile if t[1] > t[0]]

    def abschnitt(self, minute: int) -> Abschnitt | None:
        """Abschnitt zur Minute; None außerhalb von `[start, ende)`."""
        for von, bis, art in self.abschnitte():
            if von <= minute < bis:
                return art
        return None


# Arbeitszeit einer neuen Baustelle (Mockup „Herbst 2026“): Mo–Do 07:00–16:30, Fr 07:00–12:30 – Store-Form je Wochentag
STANDARD_TAGE: dict[str, list[str] | None] = {
    "0": ["07:00", "16:30"], "1": ["07:00", "16:30"], "2": ["07:00", "16:30"], "3": ["07:00", "16:30"],
    "4": ["07:00", "12:30"], "5": None, "6": None,
}
STANDARD_NAME = "Arbeitszeit"


def erste_arbeitszeit(heute: date) -> dict[str, Any]:
    """Automatisch angelegte Arbeitszeit einer neuen Baustelle; die erste eigene ersetzt sie (FE-0002)."""
    return {"ab": heute.isoformat(), "name": STANDARD_NAME, "auto": True,
            "tage": {k: (list(v) if v else None) for k, v in STANDARD_TAGE.items()}}


def ist_automatisch(eintrag: dict[str, Any]) -> bool:
    """Automatisch angelegt? Vor 0.7.28 ohne Kennzeichen gespeichert: dann am Namen und den Standardzeiten erkannt."""
    if "auto" in eintrag:
        return bool(eintrag["auto"])
    tage = {str(k): (list(v) if v else None) for k, v in (eintrag.get("tage") or {}).items()}
    return eintrag.get("name") == STANDARD_NAME and tage == STANDARD_TAGE


def arbeitszeiten_bereinigen(liste: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Beim Laden: automatische kennzeichnen (vor 0.7.28 ohne Kennzeichen) und wegnehmen, sobald es eine eigene gibt –
    dieselbe Regel wie beim Speichern, damit schon gespeicherte eigene Arbeitszeiten sofort gelten (FE-0002)."""
    markiert = [{**a, "auto": ist_automatisch(a)} for a in liste]
    eigene = [a for a in markiert if not a["auto"]]
    return eigene or markiert


def arbeitszeiten_speichern(liste: list[dict[str, Any]], neu: dict[str, Any], alt_ab: str | None = None) -> list[dict[str, Any]]:
    """Arbeitszeit anlegen oder ändern (`alt_ab` = bisheriges `ab` beim Ändern), nach `ab` sortiert.

    Eine eigene Arbeitszeit ersetzt die automatisch angelegte (FE-0002: sonst gewann die automatische ab dem Tag der
    Anlage gegen eine eigene mit früherem Datum). Doppeltes `ab` → `ValueError`.
    """
    andere = [a for a in liste if a["ab"] != alt_ab and not ist_automatisch(a)]
    if any(a["ab"] == neu["ab"] for a in andere):
        raise ValueError(neu["ab"])
    return sorted([*andere, {k: v for k, v in neu.items() if k != "auto"}], key=lambda a: a["ab"])


def arbeitszeit_loeschen(liste: list[dict[str, Any]], ab: str) -> list[dict[str, Any]]:
    """Arbeitszeit löschen; unbekannt → `KeyError`, die letzte bleibt (ohne Arbeitszeit liefe nur der Frostschutz) → `ValueError`."""
    rest = [a for a in liste if a["ab"] != ab]
    if len(rest) == len(liste):
        raise KeyError(ab)
    if not rest:
        raise ValueError("letzte")
    return rest


def gueltige_arbeitszeit(liste: Iterable[Arbeitszeit], tag: date) -> Arbeitszeit | None:
    """Die jüngste Arbeitszeit, die am `tag` schon begonnen hat; alte bleiben gespeichert, künftige gelten erst ab `ab`."""
    gueltig: Arbeitszeit | None = None
    for arbeitszeit in liste:
        # bei gleichem `ab` gewinnt die spätere in der Liste (Mockup: stabil sortiert, `.at(-1)`)
        if arbeitszeit.ab <= tag and (gueltig is None or arbeitszeit.ab >= gueltig.ab):
            gueltig = arbeitszeit
    return gueltig


def ausnahme_am(ausnahmen: Iterable[Ausnahme], tag: date) -> Ausnahme | None:
    """Die Ausnahme für genau diesen Tag (je Datum gibt es höchstens eine)."""
    return next((x for x in ausnahmen if x.datum == tag), None)


def arbeit_am(liste: Iterable[Arbeitszeit], ausnahmen: Iterable[Ausnahme], tag: date) -> tuple[int, int] | None:
    """Arbeitszeit `(a, b)` eines Tages; die Ausnahme geht vor, `frei` → None."""
    ausnahme = ausnahme_am(ausnahmen, tag)
    if ausnahme is not None:
        return None if ausnahme.art == AusnahmeArt.FREI else (ausnahme.von, ausnahme.bis)
    arbeitszeit = gueltige_arbeitszeit(liste, tag)
    if arbeitszeit is None:
        return None
    return arbeitszeit.tage.get(tag.weekday())


def tagesplan(
    tag: date,
    liste: Iterable[Arbeitszeit],
    ausnahmen: Iterable[Ausnahme],
    regeln: HeizRegeln,
    wetter: WetterTag,
    trocknen: bool,
    frei: bool = False,
    warm: WarmAb | None = None,
) -> Plan | None:
    """Heizplan eines Containers an einem Tag (Mockup `planTag`); None, wenn frei.

    `frei` ist Feiertag oder Urlaub (der Aufrufer prüft `feiertag_frei`). Eine Ausnahme `arbeit`/`zeiten` geht vor.
    `trocknen` ist der Schalter „Kleidung trocknen“ des Containers. `warm`: lernender Container (AN-0004).
    """
    ausnahmen = list(ausnahmen)
    ausnahme = ausnahme_am(ausnahmen, tag)
    if frei and (ausnahme is None or ausnahme.art == AusnahmeArt.FREI):
        return None
    zeit = arbeit_am(liste, ausnahmen, tag)
    if zeit is None:
        return None
    a, b = zeit
    if b <= a:
        return None
    gruende: list[str] = [PlanGrund.AUSNAHME] if ausnahme is not None else []
    gelernt = warm is not None and warm.aufheiz_min is not None
    if gelernt:
        vor = a - min(warm.vor_min + warm.aufheiz_min, max(warm.max_min, warm.vor_min))
        gruende.append(PlanGrund.GELERNT)
    else:
        vor = a - regeln.vorheizen_min
    extra = 0
    if not gelernt and regeln.fruehstart and wetter.frueh_min_temp is not None and wetter.frueh_min_temp < regeln.fruehstart_unter:
        extra += regeln.fruehstart_min
        gruende.append(PlanGrund.FRUEHSTART)
    if trocknen and wetter.regen_vortag_mm is not None and wetter.regen_vortag_mm >= regeln.trocknen_ab_mm:
        extra += regeln.trocknen_frueher_min
        gruende.append(PlanGrund.FRUEHER_NACH_REGEN)
    laenger = 0
    if trocknen and wetter.regen_heute_mm is not None and wetter.regen_heute_mm >= regeln.trocknen_ab_mm:
        laenger = regeln.trocknen_laenger_min
        gruende.append(PlanGrund.TROCKNEN)
    nach = b + (warm.nach_min if gelernt else regeln.nachheizen_min)
    return Plan(
        start=max(0, vor - extra),
        vor=max(0, vor),
        a=a,
        b=b,
        nach=min(TAG_MINUTEN, nach),
        ende=min(TAG_MINUTEN, nach + laenger),
        gruende=tuple(gruende),
        ausnahme=ausnahme,
    )


def bedarf_fenster(termine: Iterable[tuple[datetime, datetime]], vorheizen_min: int) -> list[tuple[datetime, datetime]]:
    """Heizfenster eines Bedarfs-Containers: jeder Termin ab `von − vorheizen` bis `bis`, nach Beginn sortiert.

    Wie Mockup `heizzeiten` für Bedarfs-Container („heizt ab 08:15“ bei Termin 09:00 und 45 min Vorheizen).
    Serien löst der Kalender auf (RRULE), hier kommen nur einzelne Termine an.
    """
    vorlauf = timedelta(minutes=vorheizen_min)
    return sorted(((von - vorlauf, bis) for von, bis in termine if bis > von), key=lambda f: f[0])


def im_fenster(fenster: Iterable[tuple[datetime, datetime]], jetzt: datetime) -> bool:
    """Liegt `jetzt` in einem der Fenster `[von, bis)`?"""
    return any(von <= jetzt < bis for von, bis in fenster)


class StatusArt(StrEnum):
    """Kurzstatus der Baustelle (Mockup `statusText`)."""

    HEIZT = "heizt"  # „♨ heizt bis {minute}“
    START = "start"  # „Start um {minute}“ (heute)
    AUS = "aus"  # „aus · morgen ab {minute}“ bzw. „aus · Mi ab …“; ohne Tag: „aus“


@dataclass(frozen=True)
class Status:
    """Kurzstatus: Art, Tag und Minute des nächsten Schaltpunkts (Ende bzw. Start)."""

    art: StatusArt
    tag: date | None = None
    minute: int | None = None


def status(heute: date, minute: int, plan_am: Callable[[date], Plan | None]) -> Status:
    """Kurzstatus wie Mockup `statusText`: heizt bis Ende, Start heute oder nächster Start in den kommenden 7 Tagen."""
    plan = plan_am(heute)
    if plan is not None and plan.start <= minute < plan.ende:
        return Status(StatusArt.HEIZT, heute, plan.ende)
    if plan is not None and minute < plan.start:
        return Status(StatusArt.START, heute, plan.start)
    for k in range(1, 8):
        tag = heute + timedelta(days=k)
        naechster = plan_am(tag)
        if naechster is not None:
            return Status(StatusArt.AUS, tag, naechster.start)
    return Status(StatusArt.AUS)
