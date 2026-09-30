"""Protokoll der Baustelle im HA-Logbuch: eigenes Ereignis `baustelle_protokoll` lesbar beschreiben."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from homeassistant.components.logbook.const import LOGBOOK_ENTRY_ICON, LOGBOOK_ENTRY_MESSAGE, LOGBOOK_ENTRY_NAME
from homeassistant.core import Event, HomeAssistant, callback

from .const import DOMAIN, EVENT_PROTOKOLL

SYMBOL = {
    "warnung": "mdi:alert",
    "ok": "mdi:check-circle",
    "schalten": "mdi:radiator",
    "wetter": "mdi:weather-partly-rainy",
    "nachricht": "mdi:cellphone-message",
    "einstellung": "mdi:cog",
    "meldung": "mdi:message-alert-outline",
}


@callback
def async_describe_events(
    hass: HomeAssistant,
    async_describe_event: Callable[[str, str, Callable[[Event], dict[str, Any]]], None],
) -> None:
    """Protokolleinträge im Logbuch: „Baustelle <Name> · <Container>“ und der Text."""

    @callback
    def beschreiben(event: Event) -> dict[str, Any]:
        d = event.data
        name = f"Baustelle {d.get('baustelle') or ''}".strip()
        if d.get("bereich_name"):
            name = f"{name} · {d['bereich_name']}"
        return {
            LOGBOOK_ENTRY_NAME: name,
            LOGBOOK_ENTRY_MESSAGE: str(d.get("text") or ""),
            LOGBOOK_ENTRY_ICON: SYMBOL.get(str(d.get("art")), "mdi:crane"),
        }

    async_describe_event(DOMAIN, EVENT_PROTOKOLL, beschreiben)
