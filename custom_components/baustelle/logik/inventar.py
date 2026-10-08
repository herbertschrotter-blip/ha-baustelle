"""Container-Inventar: Kürzel, Namen, Entity-IDs, Labels, Nummern (BSM-031.03, docs/bauplan-inventar.md §3–§5) – ohne
Home-Assistant-Code.

Schema (Herbert 05./08.10.2026, Kürzel deutsch): Container `NNN_C_<Art>` (eigen, Nummer für die ganze Firma) bzw.
`<FIRMA>-NN_C_<Art>` (fremd, Nummer je Baustelle und Firma); Geräte nach ihrem Container `NNN-GG_C_<Typ>_<Art>`,
Heizkörper zusätzlich `_<Konvektor|Radiator><Nr>`; Fühler, Tür, Fenster am Container `NNN_C_<Typ>_<Art>` (ab dem zweiten
mit `_2` …); Messwerte `<Gerätename>_<Endung>`. Entity-IDs: Name klein, `-` → `_`. Labels deutsch.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping

# Die eine Kürzeltabelle (§3) – neue Kürzel nur hier, mit Test
CONTAINER_ARTEN: dict[str, str] = {
    "POL": "Polier", "MAN": "Mannschaft", "BES": "Besprechung", "BUE": "Büro",
    "LAG": "Lager", "MAT": "Material", "SAN": "Sanitär", "TRO": "Trocken",
}
GERAETE: dict[str, str] = {   # Kürzel → Label (Gerätetyp)
    "PLUG": "Shelly Plug", "HZ": "Heizkörper", "TEMP": "Shelly H&Temp Sensor", "DOOR": "Shelly Door Sensor",
    "FEN": "Shelly Door Sensor", "PUMP": "Pumpe", "BTR": "Bautrockner",
}
AM_CONTAINER = ("TEMP", "DOOR", "FEN")   # gehören zum Container, nicht zu einem Plug (ohne GG)
HEIZTYPEN = {"konvektor": "Konvektor", "oelradiator": "Radiator", "radiator": "Radiator"}
ENDUNGEN = ("Temperatur", "Feuchte", "Batterie", "Tuer", "Drehung", "Lichtstufe", "Licht")
LABEL_CONTAINER = "Container"
STATUS_AUSRUESTUNG = ("aktiv", "verliehen", "defekt")

_KUERZEL = re.compile(r"^[A-Z]{2,5}$")


class InventarFehler(ValueError):
    """Ungültige Angabe (unbekanntes Kürzel, Firmenkürzel, Nummer)."""


def _art(art: str) -> str:
    if art not in CONTAINER_ARTEN:
        raise InventarFehler(f"unbekannte Containerart {art!r}")
    return art


def firmenkuerzel_pruefen(kuerzel: str | None) -> str:
    """2–5 Großbuchstaben (A–Z), z. B. STRA; Kleinbuchstaben werden groß."""
    k = (kuerzel or "").strip().upper()
    if not _KUERZEL.match(k):
        raise InventarFehler("Firmenkürzel: 2 bis 5 Buchstaben (A–Z)")
    return k


def praefix(*, nr: int | None = None, firma: str | None = None, fremd_nr: int | None = None) -> str:
    """Nummernteil des Containers: eigen `002`, fremd `STRA-01`."""
    if firma:
        if not fremd_nr or fremd_nr < 1:
            raise InventarFehler("Fremdcontainer braucht eine Nummer je Baustelle")
        return f"{firmenkuerzel_pruefen(firma)}-{fremd_nr:02d}"
    if not nr or nr < 1:
        raise InventarFehler("eigener Container braucht eine Nummer")
    return f"{nr:03d}"


def container_name(art: str, *, nr: int | None = None, firma: str | None = None, fremd_nr: int | None = None) -> str:
    """`002_C_MAN` bzw. `STRA-01_C_MAN`."""
    return f"{praefix(nr=nr, firma=firma, fremd_nr=fremd_nr)}_C_{_art(art)}"


def geraet_name(praefix_: str, art: str, typ: str, gg: int | None = None, *, heiztyp: str | None = None,
                heiz_nr: int = 1, nr: int = 1) -> str:
    """Name eines Geräts im Container `praefix_` (aus `praefix`).

    PLUG/PUMP/BTR: `002-01_C_PLUG_MAN`; HZ: `002-01_C_HZ_MAN_Konvektor01` (GG des schaltenden Plugs); TEMP/DOOR/FEN am
    Container ohne GG: `002_C_TEMP_MAN`, ab dem zweiten `002_C_DOOR_MAN_2`."""
    _art(art)
    if typ not in GERAETE:
        raise InventarFehler(f"unbekannter Gerätetyp {typ!r}")
    if typ in AM_CONTAINER:
        return f"{praefix_}_C_{typ}_{art}" + (f"_{nr}" if nr > 1 else "")
    if not gg or gg < 1:
        raise InventarFehler(f"{typ} braucht eine Gerätenummer im Container")
    name = f"{praefix_}-{gg:02d}_C_{typ}_{art}"
    if typ == "HZ":
        name += f"_{HEIZTYPEN.get((heiztyp or '').lower(), 'Konvektor')}{heiz_nr:02d}"
    return name


def messwert_name(geraet: str, endung: str) -> str:
    """`<Gerätename>_<Endung>`, z. B. `002_C_TEMP_MAN_Temperatur`."""
    return f"{geraet}_{endung}"


def entity_id(domain: str, name: str) -> str:
    """Entity-ID aus dem Namen: klein, `-` und andere Zeichen → `_` (wie HA, ohne doppelte `_`)."""
    objekt = re.sub(r"_+", "_", re.sub(r"[^a-z0-9]", "_", name.lower())).strip("_")
    return f"{domain}.{objekt}"


def labels(art: str, typ: str | None = None, firma: str | None = None) -> list[str]:
    """Labels eines Containers bzw. Geräts: „Container“, die Art, bei Geräten der Gerätetyp, bei Fremden die Firma."""
    aus = [LABEL_CONTAINER, CONTAINER_ARTEN[_art(art)]]
    if typ:
        aus.append(GERAETE[typ])
    if firma:
        aus.append(firma)
    return list(dict.fromkeys(aus))   # FEN und DOOR haben dasselbe Label – nichts doppelt


def eigene_labels() -> set[str]:
    """Alle Labels, die das Inventar setzt – nur diese darf es auch wieder entfernen (§5)."""
    return {LABEL_CONTAINER, *CONTAINER_ARTEN.values(), *GERAETE.values()}


def naechste(vorhanden: Iterable[int | None]) -> int:
    """Nächste Nummer: größte bisher + 1, nie eine Lücke füllen (eine Nummer gilt für immer)."""
    return max((n for n in vorhanden if n), default=0) + 1


def konflikte(neu: Mapping[str, str], belegt: Iterable[str]) -> dict[str, str]:
    """Entity-IDs, die schon eine fremde Entität trägt: {alt: neu} der Schritte, die so nicht gehen. Eine Umbenennung
    auf sich selbst oder unter den umbenannten Entitäten im Kreis ist kein Konflikt."""
    frei_werdend = set(neu)
    belegt_set = set(belegt) - frei_werdend
    gesehen: set[str] = set()
    aus: dict[str, str] = {}
    for alt, ziel in neu.items():
        if ziel != alt and (ziel in belegt_set or ziel in gesehen):
            aus[alt] = ziel
        gesehen.add(ziel)
    return aus
