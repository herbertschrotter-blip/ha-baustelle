"""Auswertung aus der Langzeitstatistik – reine Fachlogik ohne Home-Assistant-Code.

Bisher rechnete das die Seite selbst (`frontend/baustelle-panel.js`: `zeitraum`, `statistik`, `verbrauch`,
`abrechnungDaten`, `firmaAm`, `bucketMs`, `csv`, `heizperiodeEnde`, `verlaufWerte`, `kennzahlen`,
`monateJeContainer`, `typVergleich`, `tageswerte`, Gerade in `v_auswertung`, `jeGeraet`). Hier steht jede Regel einmal;
Integration, Bericht und Seite nehmen dieselben Zahlen (docs/bauplan-module.md). Geprüft gegen die Referenzwerte der
Seite in `tests/vektoren/auswertung-*.json`.

Eingaben sind die Antworten von `recorder/statistics_during_period` (je Statistik-ID eine Liste von Punkten mit `start`
und `change` bzw. `mean`; `start` als Zeitstempel in s oder ms, ISO-Text oder datetime) und Werte aus Store/Zählern.

Abweichend von der Seite (fachlich richtig, wie Bericht und Zähler der Integration – docs/bauplan-module.md §5):

- **Firma je Tag:** Verbrauch gehört der Firma, der der Container zu Tagesbeginn gehört (`firma_am_tag`); ein
  Wechsel mitten am Tag gilt ab dem Folgetag. Die Seite nahm bei „Tag“ die Firma je Stunde und beim „Jahr“ die Firma am
  Monatsersten für den ganzen Monat – für das Jahr bekommt `abrechnung` deshalb Werte je Tag.
- **Heiztage ohne Zähler:** Tage ab Beginn, an denen ein Container geheizt hat (Heizzeit > 0, wie Zähler `heiztage` und
  Bericht), nicht Tage mit mehr als 0,5 kWh der ganzen Baustelle; Monate = Monate mit einem Heiztag.
"""

from __future__ import annotations

import math
from calendar import monthrange
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone, tzinfo
from typing import Any

from .abrechnung import EIGEN, firma_von, zahl as fest

ARTEN = ("Tag", "Woche", "Monat", "Jahr")
TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
MONATE = ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
HEIZER = ("heizung", "heizkoerper")
EIGENE_FIRMA = {"id": EIGEN, "name": "Eigene Firma", "eigen": True}

Punkt = Mapping[str, Any]
Statistik = Mapping[str, Sequence[Punkt]]


def ist_zahl(wert: Any) -> bool:
    """Endliche Zahl (auch als Text) – wie `zahl()` der Seite."""
    if wert is None or wert == "" or isinstance(wert, bool):
        return False
    try:
        return math.isfinite(float(wert))
    except (TypeError, ValueError):
        return False


def summe(werte: Iterable[Any]) -> float:
    """Summe, fehlende Werte zählen 0."""
    ergebnis = 0.0
    for wert in werte:
        ergebnis += float(wert) if ist_zahl(wert) else 0.0
    return ergebnis


def addieren(reihen: Sequence[Sequence[float | None]]) -> list[float]:
    """Reihen stellenweise addieren; Länge der ersten Reihe, fehlende Werte zählen 0."""
    if not reihen:
        return []
    ergebnis = list(reihen[0])
    for reihe in reihen[1:]:
        ergebnis = [v + (reihe[i] or 0.0 if i < len(reihe) else 0.0) for i, v in enumerate(ergebnis)]
    return ergebnis


def js_runden(wert: float) -> int:
    """Auf ganze Zahl, bei genau halb nach oben (`Math.round`)."""
    unten = math.floor(wert)
    return int(unten + 1 if wert - unten >= 0.5 else unten)


# ------------------------------------------------------------------ Zeit


def mitternacht(tag: date, zone: tzinfo) -> datetime:
    """Tagesbeginn 00:00 in der Zone der Baustelle (UTC)."""
    return datetime(tag.year, tag.month, tag.day, tzinfo=zone).astimezone(timezone.utc)


def zeitpunkt(start: float | int | str | datetime) -> datetime:
    """Beginn eines Statistik-Punkts als datetime (Zahl < 1e11 in Sekunden, sonst Millisekunden)."""
    if isinstance(start, datetime):
        return start if start.tzinfo else start.replace(tzinfo=timezone.utc)
    if isinstance(start, (int, float)):
        return datetime.fromtimestamp(start if start < 1e11 else start / 1000, timezone.utc)
    return datetime.fromisoformat(start)


def lokal(start: float | int | str | datetime, zone: tzinfo) -> datetime:
    """Beginn eines Statistik-Punkts in der Zone der Baustelle."""
    return zeitpunkt(start).astimezone(zone)


@dataclass(frozen=True)
class Zeitraum:
    """Zeitraum der Auswertung: Tag (je Stunde), Woche/Monat (je Tag), Jahr (je Monat)."""

    art: str
    von: date
    bis: date   # erster Tag danach
    periode: str   # hour, day, month (wie der Recorder)
    n: int
    labels: tuple[str, ...]
    monat: int | None = None   # 1–12 (nur Monat)
    jahr: int | None = None   # nur Monat und Jahr

    def index(self, zeit: datetime) -> int:
        """Stelle einer lokalen Zeit im Zeitraum; -1 außerhalb (Woche: ohne Prüfung der Grenzen, wie die Seite)."""
        tag = zeit.date()
        if self.art == "Tag":
            return zeit.hour if tag == self.von else -1
        if self.art == "Woche":
            return (tag - self.von).days
        if self.art == "Monat":
            return tag.day - 1 if (tag.year, tag.month) == (self.von.year, self.von.month) else -1
        return tag.month - 1 if tag.year == self.jahr else -1

    def beginn(self, i: int, zone: tzinfo) -> datetime:
        """Beginn der i-ten Stunde/Tag/Monat (UTC)."""
        if self.periode == "hour":
            return mitternacht(self.von, zone) + timedelta(hours=i)
        if self.periode == "day":
            return mitternacht(self.von + timedelta(days=i), zone)
        return mitternacht(date(self.jahr or self.von.year, i + 1, 1), zone)

    def label_csv(self, i: int) -> str:
        """Spalte „Zeit“ im CSV: 07:00, 29.09.2026 bzw. Sep 2026."""
        if self.art == "Tag":
            return f"{self.labels[i]}:00"
        if self.art == "Jahr":
            return f"{MONATE[i]} {self.jahr}"
        return (self.von + timedelta(days=i)).strftime("%d.%m.%Y")


def zeitraum(art: str, heute: date, versatz: int = 0) -> Zeitraum:
    """Zeitraum `art` mit `heute`; `versatz` 1 = der davor (gestern, Vorwoche, Vormonat, Vorjahr)."""
    if art == "Tag":
        tag = heute - timedelta(days=versatz)
        return Zeitraum(art, tag, tag + timedelta(days=1), "hour", 24, tuple(f"{h:02d}" for h in range(24)))
    if art == "Woche":
        montag = heute - timedelta(days=heute.weekday() + 7 * versatz)
        return Zeitraum(art, montag, montag + timedelta(days=7), "day", 7, tuple(TAGE))
    if art == "Monat":
        m, j = heute.month - 1 - versatz, heute.year
        while m < 0:
            m, j = m + 12, j - 1
        n = monthrange(j, m + 1)[1]
        von = date(j, m + 1, 1)
        return Zeitraum(art, von, von + timedelta(days=n), "day", n, tuple(f"{i + 1}." for i in range(n)), m + 1, j)
    if art != "Jahr":
        raise ValueError(f"unbekannter Zeitraum {art!r}")
    j = heute.year - versatz
    return Zeitraum(art, date(j, 1, 1), date(j + 1, 1, 1), "month", 12, tuple(MONATE), None, j)


def reihen(zr: Zeitraum, statistik: Statistik, zone: tzinfo) -> dict[str, list[float | None]]:
    """Statistik je ID als Wert je Stunde/Tag/Monat des Zeitraums (Änderung addiert, sonst Mittel); ohne Wert None."""
    ergebnis: dict[str, list[float | None]] = {}
    for sid, punkte in statistik.items():
        werte: list[float | None] = [None] * zr.n
        for p in punkte or []:
            i = zr.index(lokal(p["start"], zone))
            if i < 0 or i >= zr.n:
                continue
            if ist_zahl(p.get("change")):
                werte[i] = (werte[i] or 0.0) + float(p["change"])
            elif ist_zahl(p.get("mean")):
                werte[i] = float(p["mean"])
        ergebnis[sid] = werte
    return ergebnis


def verbrauch(werte: Mapping[str, Sequence[float | None]], ids: Sequence[str], n: int) -> list[float]:
    """kWh je Periode eines Containers: Energie des Containers bzw. Summe seiner Geräte (`ids`)."""
    teile = [[v or 0.0 for v in (werte.get(sid) or [0.0] * n)] for sid in ids]
    return addieren(teile) or [0.0] * n


# ------------------------------------------------------------------ Abrechnung nach Firma


def _firma(firmen: Sequence[Mapping[str, Any]], fid: str) -> Mapping[str, Any]:
    """Firma zur ID; unbekannt → die erste (eigene) Firma."""
    return next((f for f in firmen if f.get("id") == fid), firmen[0])


def firma_am_tag(baustelle: Mapping[str, Any], bereich: str, zeit: datetime, zone: tzinfo) -> Mapping[str, Any]:
    """Firma, der der Container am Tag von `zeit` gehört (zu Tagesbeginn); gelöschte Firma → eigene Firma."""
    firmen = baustelle.get("firmen") or [EIGENE_FIRMA]
    beginn = mitternacht(zeit.astimezone(zone).date(), zone).astimezone(zone)  # in der Zone: `ab` ohne Zone gilt dort
    return _firma(firmen, firma_von(list(baustelle.get("zuordnung") or []), firmen, bereich, beginn))


def abrechnung(
    baustellen: Sequence[Mapping[str, Any]],
    werte: Mapping[str, Mapping[str, Sequence[tuple[Any, float | None]]]],
    zone: tzinfo,
) -> list[dict[str, Any]]:
    """kWh je Firma und Container: `[{"firma", "eigen", "kwh", "container": [{"entry", "bereich", "kwh"}]}]`.

    `werte[entry][bereich]` = `[(beginn, kWh), …]` je Stunde oder Tag (beim Jahr je Tag, nicht je Monat). Firmen
    verschiedener Baustellen mit gleichem Namen sind eine Zeile; die eigene Firma zuerst, sonst in der Reihenfolge des
    ersten Verbrauchs. Firmen ohne Verbrauch fehlen.
    """
    zeilen: dict[str, dict[str, Any]] = {}
    for b in baustellen:
        for bereich in b["bereiche"]:
            for beginn, kwh in werte[b["entry"]][bereich["id"]]:
                if not kwh:
                    continue
                f = firma_am_tag(b, bereich["id"], zeitpunkt(beginn), zone)
                zeile = zeilen.setdefault(EIGEN if f.get("eigen") else f["name"], {"f": f, "c": {}, "kwh": 0.0})
                zeile["kwh"] += kwh
                c = zeile["c"].setdefault((b["entry"], bereich["id"]), {"entry": b["entry"], "bereich": bereich["id"], "kwh": 0.0})
                c["kwh"] += kwh
    liste = sorted(zeilen.values(), key=lambda z: 0 if z["f"].get("eigen") else 1)
    return [
        {"firma": z["f"]["name"], "eigen": bool(z["f"].get("eigen")), "kwh": z["kwh"], "container": list(z["c"].values())}
        for z in liste
    ]


def firmen_reihen(
    baustellen: Sequence[Mapping[str, Any]],
    werte: Mapping[str, Mapping[str, Sequence[tuple[Any, float | None]]]],
    zr: Zeitraum,
    zone: tzinfo,
) -> dict[str, list[float]]:
    """kWh je Firma und Periode des Zeitraums (Verbrauch gestapelt nach Firma): `{"eigen" bzw. Firmenname: [kWh, …]}`.

    Firma je Tag wie `abrechnung` (dieselben `werte`, je Stunde oder Tag); die Periode kommt aus dem Beginn, beim Jahr
    zählen so die Tage eines Monats je nach ihrer Firma. Firmen ohne Verbrauch fehlen.
    """
    ergebnis: dict[str, list[float]] = {}
    for b in baustellen:
        for bereich in b["bereiche"]:
            for beginn, kwh in werte[b["entry"]][bereich["id"]]:
                i = zr.index(lokal(beginn, zone))
                if not kwh or i < 0 or i >= zr.n:
                    continue
                f = firma_am_tag(b, bereich["id"], zeitpunkt(beginn), zone)
                ergebnis.setdefault(EIGEN if f.get("eigen") else f["name"], [0.0] * zr.n)[i] += kwh
    return ergebnis


def _feld(wert: Any) -> str:
    """CSV-Feld; mit Semikolon, Anführungszeichen oder Zeilenumbruch in Anführungszeichen."""
    text = str(wert)
    return '"' + text.replace('"', '""') + '"' if any(z in text for z in ';"\n') else text


def _zeile(felder: Iterable[Any]) -> str:
    return ";".join(_feld(f) for f in felder)


def _namen(baustellen: Sequence[Mapping[str, Any]]) -> tuple[dict[str, str], dict[tuple[str, str], str]]:
    titel = {b["entry"]: b["titel"] for b in baustellen}
    container = {(b["entry"], c["id"]): c["name"] for b in baustellen for c in b["bereiche"]}
    return titel, container


def csv_firma(daten: Sequence[Mapping[str, Any]], baustellen: Sequence[Mapping[str, Any]], art: str, preis: float) -> list[str]:
    """Zeilen der Abrechnung als CSV (Kopf + je Firma und Container), Dezimalkomma ohne Tausendertrennung."""
    titel, container = _namen(baustellen)
    zeilen = [_zeile(["Zeitraum", "Firma", "Baustelle", "Container", "kWh", "Preis €/kWh", "Betrag €"])]
    for z in daten:
        for c in z["container"]:
            zeilen.append(_zeile([art, z["firma"], titel[c["entry"]], container[(c["entry"], c["bereich"])],
                                  fest(c["kwh"], 2), fest(preis, 2), fest(c["kwh"] * preis, 2)]))
    return zeilen


def csv_verbrauch(
    baustellen: Sequence[Mapping[str, Any]],
    werte: Mapping[str, Mapping[str, Sequence[tuple[Any, float | None]]]],
    zr: Zeitraum,
    preis: float,
    zone: tzinfo,
) -> list[str]:
    """Verbrauch je Periode, Baustelle und Container als CSV (Firma zu Beginn der Periode, nach dem Tag)."""
    zeilen = [_zeile(["Zeit", "Baustelle", "Firma", "Container", "kWh", "Kosten €"])]
    for b in baustellen:
        for bereich in b["bereiche"]:
            for i, (beginn, kwh) in enumerate(werte[b["entry"]][bereich["id"]]):
                f = firma_am_tag(b, bereich["id"], zeitpunkt(beginn), zone)
                w = float(kwh) if ist_zahl(kwh) else 0.0
                zeilen.append(_zeile([zr.label_csv(i), b["titel"], f["name"], bereich["name"], fest(w, 3), fest(w * preis, 2)]))
    return zeilen


# ------------------------------------------------------------------ Heizperiode


def heizperiode_ende(heute: date, von: int, bis: int) -> date:
    """Letzter Tag der laufenden (bzw. zuletzt begonnenen) Heizperiode `von`–`bis` (Monate), wie `zaehlen.tage_heizperiode`."""
    jahr = heute.year if heute.month >= von else heute.year - 1
    ende_jahr = jahr if bis >= von else jahr + 1
    return date(ende_jahr, bis, monthrange(ende_jahr, bis)[1])


def heizperiode_bis(heute: date, von: int, bis: int, ende: date | None) -> date:
    """Bis wann die Hochrechnung zählt: geplantes Ende der Baustelle, wenn es vor dem Ende der Heizperiode liegt."""
    hp = heizperiode_ende(heute, von, bis)
    return ende if ende is not None and ende < hp else hp


# ------------------------------------------------------------------ Verlauf und Kennzahlen


def verlauf_zeitraum(heute: date, beginn: date | None, ende: date | None) -> tuple[date, date]:
    """Tage für den Verlauf einer Baustelle: seit Beginn, mindestens die letzten 12 Monate; bis Ende bzw. heute."""
    vor12 = date(heute.year - 1, heute.month + 1, 1) if heute.month < 12 else date(heute.year, 1, 1)
    von = min(beginn or vor12, vor12)
    return von, (ende or heute) + timedelta(days=1)


def heiztag_daten(heizzeit: Mapping[str, Iterable[tuple[date, float | None]]], von: date | None = None, bis: date | None = None) -> set[date]:
    """Tage (von–bis einschließlich) mit Heizzeit über 0 in irgendeinem Container – wie der Zähler `heiztage`.

    `heizzeit[bereich]` = `[(tag, Stunden), …]`; Pumpenschächte gibt der Aufrufer nicht hinein.
    """
    return {
        tag for werte in heizzeit.values() for tag, stunden in werte
        if (stunden or 0) > 0 and (von is None or tag >= von) and (bis is None or tag <= bis)
    }


def verlauf_werte(
    energie: Sequence[Punkt] | None,
    heizzeit: Mapping[str, Sequence[Punkt]],
    zone: tzinfo,
    beginn: date | None = None,
    heiztage_zaehler: float | None = None,
) -> dict[str, Any]:
    """Heiztage, Monate mit Heizung und kWh je Monat (`JJJJ-MM`) einer Baustelle aus der Tagesstatistik.

    `energie`: Energie der Baustelle je Tag; `heizzeit`: Heizzeit je Container und Tag. Heiztage zählt die Integration
    (`heiztage_zaehler`); nur ohne Zähler kommen sie aus der Heizzeit.
    """
    je_monat: dict[str, float] = {}
    for p in energie or []:
        monat = lokal(p["start"], zone).strftime("%Y-%m")
        je_monat[monat] = je_monat.get(monat, 0.0) + (float(p["change"]) if ist_zahl(p.get("change")) else 0.0)
    tage = heiztag_daten(
        {sid: [(lokal(p["start"], zone).date(), float(p["change"]) if ist_zahl(p.get("change")) else 0.0) for p in punkte]
         for sid, punkte in heizzeit.items()},
        von=beginn,
    )
    heiztage = heiztage_zaehler if ist_zahl(heiztage_zaehler) else len(tage)
    return {"heiztage": heiztage, "monate": len({(t.year, t.month) for t in tage}), "je_monat": je_monat}


def kennzahlen(
    zaehler: Mapping[str, Any],
    zustaende: Mapping[str, float | None],
    preis: float,
    container: int,
    heiztage: float,
    monate: int,
) -> dict[str, Any]:
    """Kennzahlen einer Baustelle (Verlauf): kWh, €, gespart, dazu die Werte für den Vergleich der Baustellen.

    `zustaende`: aktuelle Werte der Sensoren `energie`, `kosten`, `ersparnis` (None ohne Wert) – nur, wenn der Zähler fehlt.
    """
    kwh = float(zaehler["energie"]) if ist_zahl(zaehler.get("energie")) else (zustaende.get("energie") if zustaende.get("energie") is not None else 0.0)
    if ist_zahl(zaehler.get("kosten")):
        eur = float(zaehler["kosten"])
    else:
        eur = zustaende["kosten"] if zustaende.get("kosten") is not None else kwh * preis
    gespart = zustaende.get("ersparnis")
    if gespart is None and ist_zahl(zaehler.get("ohne")) and ist_zahl(zaehler.get("energie_heizen")):
        gespart = max(0.0, float(zaehler["ohne"]) - float(zaehler["energie_heizen"])) * preis
    return {
        "kwh": kwh, "eur": eur, "gespart": gespart, "container": container, "heiztage": heiztage, "monate": monate,
        "vergleich": {
            "tag": kwh / heiztage if heiztage else 0.0,   # kWh je Heiztag
            "monat": eur / monate if monate else 0.0,   # € je Monat mit Heizung
            "ges": kwh,
        },
    }


def veraenderung(jetzt: float | None, vorher: float | None) -> int | None:
    """Veränderung zum Zeitraum davor in ganzen % (Pfeile der Auswertung); ohne Wert davor None."""
    if jetzt is None or vorher is None or vorher <= 0:
        return None
    return js_runden((jetzt - vorher) / vorher * 100)


def ohne_automatik(kwh: float, ohne: float, preis: float) -> dict[str, float] | None:
    """„Ohne Automatik“: gespart in € und % gegenüber Dauerbetrieb (`ohne` kWh); ohne Wert (0) None."""
    if ohne <= 0:
        return None
    return {"gespart_eur": max(0.0, ohne - kwh) * preis, "prozent": max(0.0, 1 - kwh / ohne) * 100}


def monate_zeitraum(heute: date, beginn: date | None, ende: date | None) -> tuple[date, date, list[str]]:
    """Verbrauch je Monat: erster Tag der Anfrage, Tag danach und die Monate `JJJJ-MM` (höchstens 36)."""
    von = beginn or heute - timedelta(days=365)
    bis = (ende or heute) + timedelta(days=1)
    monate: list[str] = []
    j, m = von.year, von.month
    while (j, m) <= (bis.year, bis.month) and len(monate) < 36:
        monate.append(f"{j}-{m:02d}")
        j, m = (j + 1, 1) if m == 12 else (j, m + 1)
    if bis.day == 1 and len(monate) > 1:
        monate.pop()
    return von.replace(day=1), bis, monate


def monate_je_container(
    monate: Sequence[str], bereiche: Sequence[Mapping[str, Any]], statistik: Statistik, zone: tzinfo
) -> dict[str, Any]:
    """kWh je Monat und Container: `{"labels": ["Nov", …], "reihen": [{"name", "v"}]}` (Container ohne Energie: 0)."""
    reihen_ = []
    for b in bereiche:
        werte = [0.0] * len(monate)
        for p in (statistik.get(b["energie"]) or []) if b.get("energie") else []:
            monat = lokal(p["start"], zone).strftime("%Y-%m")
            if monat in monate and ist_zahl(p.get("change")):
                werte[monate.index(monat)] += float(p["change"])
        reihen_.append({"name": b["name"], "v": werte})
    return {"labels": [MONATE[int(k[5:7]) - 1] for k in monate], "reihen": reihen_}


def csv_text(zeilen: Sequence[str]) -> str:
    """CSV-Datei wie die Seite sie speichert: BOM (Excel erkennt UTF-8), Zeilen mit CRLF, keine Zeilenumschaltung am Ende."""
    return "\ufeff" + "\r\n".join(zeilen)


def csv_monate(titel: str, preis: float, daten: Mapping[str, Any]) -> list[str]:
    """Verbrauch je Monat und Container als CSV (Detailseite einer Baustelle)."""
    zeilen = [_zeile(["Monat", "Baustelle", "Container", "kWh", "Kosten €"])]
    for r in daten["reihen"]:
        for i, v in enumerate(r["v"]):
            zeilen.append(_zeile([daten["labels"][i], titel, r["name"], fest(v, 2), fest(v * preis, 2)]))
    return zeilen


# ------------------------------------------------------------------ Ölradiator oder Konvektor


def typ_vergleich(
    bereiche: Sequence[Mapping[str, Any]],
    zaehler: Mapping[str, Any],
    energie: Mapping[str, float | None],
    heizzeit: Mapping[str, float | None],
    heiztage: float,
    preis: float,
) -> dict[str, Any]:
    """Je Typ kWh je Heizstunde, Aufheiz- und Abkühlrate (°C/h, Mittel der Container), Kosten je Heiztag; dazu `weniger`
    = um wie viel % der Ölradiator weniger je Heizstunde braucht als der Konvektor (gerundet, None ohne Werte).

    `bereiche`: `[{"id", "geraete": [{"rolle", "typ"}]}]`; `energie`/`heizzeit`: Summe je Typ (kWh bzw. h).
    """
    def rate(typ: str, art: str) -> float | None:
        werte = [
            zaehler[f"{art}:{b['id']}"] for b in bereiche
            if any(g.get("rolle") in HEIZER and (g.get("typ") or "oelradiator") == typ for g in b["geraete"])
            and ist_zahl(zaehler.get(f"{art}:{b['id']}"))
        ]
        return summe(werte) / len(werte) if werte else None

    ergebnis: dict[str, Any] = {}
    for typ in ("oelradiator", "konvektor"):
        en, hz = energie.get(typ), heizzeit.get(typ)
        ergebnis[typ] = {
            "kwh_h": en / hz if en is not None and hz else None,
            "auf": rate(typ, "aufheiz"),
            "ab": rate(typ, "abkuehl"),
            "tag": en / heiztage * preis if en is not None and heiztage else None,
        }
    o, k = ergebnis["oelradiator"]["kwh_h"], ergebnis["konvektor"]["kwh_h"]
    ergebnis["weniger"] = js_runden((1 - o / k) * 100) if o is not None and k is not None and k > 0 else None
    return ergebnis


# ------------------------------------------------------------------ Wetter-Einfluss

WETTER_TAGE = 30
WETTER_MIN_TAGE = 5


def tageswerte_zeitraum(heute: date) -> tuple[date, date]:
    """Tage für den Wetter-Einfluss: die letzten 45 Tage bis heute."""
    return heute - timedelta(days=45), heute + timedelta(days=1)


def tageswerte(statistik: Statistik, energie: Sequence[str], aussen: str | None, heute: date, zone: tzinfo) -> list[list[float]]:
    """Heiztage vor heute (mehr als 0,5 kWh und ein Tagesmittel außen) als `[außen °C, kWh]`, die letzten 30."""
    if not aussen:
        return []
    tage: dict[date, dict[str, Any]] = {}
    for sid in sorted({*energie, aussen}):
        for p in statistik.get(sid) or []:
            x = tage.setdefault(lokal(p["start"], zone).date(), {"kwh": 0.0, "aussen": None})
            if sid == aussen:
                if ist_zahl(p.get("mean")):
                    x["aussen"] = float(p["mean"])
            elif ist_zahl(p.get("change")):
                x["kwh"] += float(p["change"])
    liste = [[x["aussen"], x["kwh"]] for t, x in sorted(tage.items()) if t < heute and x["kwh"] > 0.5 and x["aussen"] is not None]
    return liste[-WETTER_TAGE:]


def wetter_einfluss(punkte: Sequence[Sequence[float]]) -> dict[str, float | None] | None:
    """Gerade kWh je Tag = k · außen + d0 (kleinste Quadrate); `null0` = Außentemperatur, ab der kaum mehr geheizt wird.

    Unter 5 Tagen None; alle Tage gleich warm → k = 0.
    """
    n = len(punkte)
    if n < WETTER_MIN_TAGE:
        return None
    mx = summe(p[0] for p in punkte) / n
    my = summe(p[1] for p in punkte) / n
    nn = summe((p[0] - mx) ** 2 for p in punkte)
    k = summe((p[0] - mx) * (p[1] - my) for p in punkte) / nn if nn else 0.0
    d0 = my - k * mx
    return {"k": k, "d0": d0, "null0": -d0 / k if k < 0 else None}


# ------------------------------------------------------------------ Je Gerät

MITTEL_MIN_W = 50


def je_geraet(
    geraete: Sequence[Mapping[str, Any]],
    zaehler: Mapping[str, Any],
    statistik: Statistik,
    pumpzeit: Mapping[str, Sequence[float | None]],
) -> list[dict[str, Any]]:
    """Je Gerät Ø kW im Betrieb (Zähler `mittel:<id>`, ab 50 W), kWh im Zeitraum (Energiezähler), Stunden.

    Stunden sind bei Pumpen die gemessene Pumpzeit, sonst eine Schätzung kWh ÷ Ø kW (docs/bauplan-module.md §5).
    `geraete`: `[{"id", "bereich", "rolle", "energie"}]`; `statistik`: Änderung je Energiezähler; `pumpzeit[id]`: Stunden
    je Periode.
    """
    zeilen = []
    for g in geraete:
        mw = zaehler.get(f"mittel:{g['id']}")
        mittel = float(mw) / 1000 if ist_zahl(mw) and float(mw) > MITTEL_MIN_W else None
        punkte = statistik.get(g["energie"]) if g.get("energie") else None
        kwh = summe(p.get("change") for p in punkte) if punkte is not None else None
        if g.get("rolle") == "pumpe":
            std = summe(pumpzeit[g["id"]]) if g["id"] in pumpzeit else None
        else:
            std = kwh / mittel if kwh is not None and mittel is not None else None
        zeilen.append({"bereich": g["bereich"], "geraet": g["id"], "mittel": mittel, "kwh": kwh, "std": std})
    return zeilen
