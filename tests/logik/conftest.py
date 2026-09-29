"""Die Fachlogik ohne Home Assistant importierbar machen (Paket `logik`)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "custom_components" / "baustelle"))
