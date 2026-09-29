"""Tests gegen Home Assistant (pytest-homeassistant-custom-component, Python 3.14+)."""

import pytest

pytest_plugins = ["pytest_homeassistant_custom_component"]


@pytest.fixture(autouse=True)
def eigene_integration(enable_custom_integrations):
    """custom_components/baustelle laden lassen."""
    return
