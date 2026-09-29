#!/bin/sh
# Liefert Paket und Dashboard nach /config aus. Nur Kopieren – Konfiguration prüfen, neu laden
# oder neu starten bleibt ein eigener Schritt (siehe README.md, Abschnitt Auslieferung).
set -eu

REPO=$(cd "$(dirname "$0")/.." && pwd)
ZIEL=${HA_CONFIG:-/config}

for datei in packages/baustelle.yaml dashboards/baustelle.yaml; do
  mkdir -p "$ZIEL/$(dirname "$datei")"
  cp "$REPO/ha/$datei" "$ZIEL/$datei"
  echo "ausgeliefert: $ZIEL/$datei"
done
