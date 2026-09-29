#!/bin/sh
# Liefert Integration und Dashboard nach /config aus. Nur Kopieren – Konfiguration prüfen und
# Neustart bleiben eigene Schritte (siehe README.md, Abschnitt Auslieferung).
set -eu

REPO=$(cd "$(dirname "$0")/.." && pwd)
ZIEL=${HA_CONFIG:-/config}
QUELLE="$REPO/custom_components/baustelle"
ZIEL_INT="$ZIEL/custom_components/baustelle"

# Integration: Dateien kopieren; Dateien, die es im Repo nicht mehr gibt, im Ziel entfernen
mkdir -p "$ZIEL_INT"
(cd "$QUELLE" && find . -type d -name __pycache__ -prune -o -type f -print) | while read -r datei; do
  mkdir -p "$ZIEL_INT/$(dirname "$datei")"
  cp "$QUELLE/$datei" "$ZIEL_INT/$datei"
done
(cd "$ZIEL_INT" && find . -type d -name __pycache__ -prune -o -type f -print) | while read -r datei; do
  [ -e "$QUELLE/$datei" ] || { rm -f "$ZIEL_INT/$datei"; echo "entfernt: $datei"; }
done
echo "ausgeliefert: $ZIEL_INT (Version $(sed -n 's/.*"version": "\(.*\)".*/\1/p' "$ZIEL_INT/manifest.json"))"

# Dashboard
mkdir -p "$ZIEL/dashboards"
cp "$REPO/ha/dashboards/baustelle.yaml" "$ZIEL/dashboards/baustelle.yaml"
echo "ausgeliefert: $ZIEL/dashboards/baustelle.yaml"
echo "Jetzt: Konfiguration prüfen und Home Assistant neu starten."
