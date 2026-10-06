#!/bin/sh
# Liefert die Integration nach /config aus (die Seite „Baustelle“ ist Teil davon). Nur Kopieren – Konfiguration prüfen und
# Neustart bleiben eigene Schritte (siehe README.md, Abschnitt Auslieferung).
#
# Eine Filterregel für Kopieren und Aufräumen (BSM-022, bauplan-lit §4): aus frontend/ nur die gebaute Seite und der
# Verlauf (Positivliste) – Quellen (src/), Bauwerkzeuge (bauen.mjs, package*.json, version.json) und node_modules nie.
# Im Ziel wird entfernt, was nicht zugelassen ist oder in der Quelle fehlt. Die Seite wird über eine Zwischendatei
# ersetzt, changelog.json (Versions-Hinweis der Seite) zuletzt.
set -eu

REPO=$(cd "$(dirname "$0")/.." && pwd)
ZIEL=${HA_CONFIG:-/config}
QUELLE="$REPO/custom_components/baustelle"
ZIEL_INT="$ZIEL/custom_components/baustelle"

ausliefern() {   # $1 = Pfad relativ zur Integration, z. B. ./frontend/baustelle-panel.js
  case "$1" in
    */__pycache__/*) return 1 ;;
    ./frontend/baustelle-panel.js|./frontend/changelog.json) return 0 ;;
    ./frontend/*) return 1 ;;
    *) return 0 ;;
  esac
}

dateien() {   # alle Dateien unter $1 (ohne __pycache__ und node_modules), relativ
  (cd "$1" && find . \( -type d \( -name __pycache__ -o -name node_modules \) -prune \) -o -type f -print)
}

kopieren() {
  mkdir -p "$ZIEL_INT/$(dirname "$1")"
  cp "$QUELLE/$1" "$ZIEL_INT/$1.neu"
  mv -f "$ZIEL_INT/$1.neu" "$ZIEL_INT/$1"
}

mkdir -p "$ZIEL_INT"
dateien "$QUELLE" | while read -r datei; do
  [ "$datei" = "./frontend/changelog.json" ] && continue   # zuletzt
  if ausliefern "$datei"; then kopieren "$datei"; fi
done
kopieren "./frontend/changelog.json"
dateien "$ZIEL_INT" | while read -r datei; do
  if ! ausliefern "$datei" || [ ! -e "$QUELLE/$datei" ]; then rm -f "$ZIEL_INT/$datei"; echo "entfernt: $datei"; fi
done
find "$ZIEL_INT" -mindepth 1 -type d -empty ! -name __pycache__ -delete   # leer gewordene Ordner (z. B. frontend/src)
echo "ausgeliefert: $ZIEL_INT (Version $(sed -n 's/.*"version": "\(.*\)".*/\1/p' "$ZIEL_INT/manifest.json"))"

echo "Jetzt: Konfiguration prüfen und Home Assistant neu starten."
