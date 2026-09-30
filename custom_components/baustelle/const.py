"""Konstanten der Integration Baustelle."""

from __future__ import annotations

from typing import Final

from homeassistant.const import Platform

DOMAIN: Final = "baustelle"

PLATFORMS: Final = [
    Platform.BINARY_SENSOR,
    Platform.SENSOR,
    Platform.SWITCH,
]
# Bis 0.6 gab es Einstellungs-Entitäten; ab 0.7 nur noch auf der Seite (api-0.7 §3)
ALTE_PLATTFORMEN: Final = ["button", "number", "select", "time"]

# Subentries
SUB_BEREICH: Final = "bereich"
SUB_GERAET: Final = "geraet"

# Eintrag (Baustelle)
CONF_HEIZUNG: Final = "heizung"
CONF_PUMPEN: Final = "pumpen"
CONF_STATUS: Final = "status"
CONF_BEGINN: Final = "beginn"
CONF_ENDE: Final = "ende"
CONF_WETTER: Final = "wetter"
CONF_TEMP_SENSOR: Final = "temp_sensor"
CONF_REGEN_SENSOR: Final = "regen_sensor"
CONF_FEIERTAG_KALENDER: Final = "feiertag_kalender"
CONF_URLAUB_KALENDER: Final = "urlaub_kalender"
CONF_EMPFAENGER: Final = "empfaenger"
CONF_HEIZPERIODE_VON: Final = "heizperiode_von"
CONF_HEIZPERIODE_BIS: Final = "heizperiode_bis"

STATUS_AKTIV: Final = "aktiv"
STATUS_ABGESCHLOSSEN: Final = "abgeschlossen"

# Bereich (Container oder Pumpenschacht)
CONF_ART: Final = "art"
CONF_FUEHLER: Final = "fuehler"
ART_CONTAINER: Final = "container"
ART_PUMPENSCHACHT: Final = "pumpenschacht"

# Gerät (ein Shelly)
CONF_BEREICH: Final = "bereich"
CONF_SCHALTER: Final = "schalter"
CONF_ROLLE: Final = "rolle"
CONF_TYP: Final = "typ"
CONF_LEISTUNG: Final = "leistung"
CONF_ENERGIE: Final = "energie"

ROLLE_HEIZKOERPER: Final = "heizkoerper"
ROLLE_BAUTROCKNER: Final = "bautrockner"
ROLLE_PUMPE: Final = "pumpe"
ROLLE_STECKDOSE: Final = "steckdose"
ROLLEN: Final = [ROLLE_HEIZKOERPER, ROLLE_BAUTROCKNER, ROLLE_PUMPE, ROLLE_STECKDOSE]
HEIZROLLEN: Final = (ROLLE_HEIZKOERPER, ROLLE_BAUTROCKNER)
ZIEHT_STROM_W: Final = 50  # „über 50 W = zieht Strom“ (api-0.7 §1)

TYP_OELRADIATOR: Final = "oelradiator"
TYP_KONVEKTOR: Final = "konvektor"
TYPEN: Final = [TYP_OELRADIATOR, TYP_KONVEKTOR]

WETTER_INTERVALL_MIN: Final = 30
TERMINE_INTERVALL_MIN: Final = 15

# Eigenes Ereignis je Protokolleintrag (für das HA-Logbuch, logbook.py)
EVENT_PROTOKOLL: Final = "baustelle_protokoll"
# Knöpfe der Handy-Nachrichten (mobile_app)
EVENT_NACHRICHT_AKTION: Final = "mobile_app_notification_action"
AKTION_PRAEFIX: Final = "BAUSTELLE"
URL_SEITE: Final = "/baustelle"
