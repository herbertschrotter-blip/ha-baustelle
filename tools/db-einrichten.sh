#!/bin/sh
# Datenbank-Server für die Baustelle einrichten (BSM-026, docs/bauplan-datenbank.md §4a) – führt Herbert selbst aus,
# in einem Terminal-Fenster (fragt Passwörter ab, zeigt sie nie an):
#
#   /config/projekte/ha-baustelle/tools/db-einrichten.sh
#
# Was es tut: Add-on „TimescaleDB“ starten (falls aus), das Standard-Passwort von postgres ersetzen, Benutzer
# `baustelle` (schreibt, Eigentümer der Datenbank `baustelle`) und `baustelle_leser` (nur lesen: Excel/Power BI, Rechte
# auf die Ansichten vergibt die Integration) anlegen, TimescaleDB in `baustelle` einschalten. Wiederholbar.
# Geheimnisse schreibt es nirgends hin – die Zeile für secrets.yaml trägst du selbst ein.
set -eu

SLUG=77b2833f_timescaledb
HOST=77b2833f-timescaledb
API="http://supervisor/addons/$SLUG"

command -v psql >/dev/null 2>&1 || apk add --no-cache postgresql17-client >/dev/null

zustand=$(curl -s -H "Authorization: Bearer $SUPERVISOR_TOKEN" "$API/info" | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['state'])")
if [ "$zustand" != "started" ]; then
  echo "Add-on TimescaleDB starten …"
  curl -s -X POST -H "Authorization: Bearer $SUPERVISOR_TOKEN" "$API/start" >/dev/null
  i=0; until pg_isready -h "$HOST" -p 5432 -q || [ $i -ge 60 ]; do sleep 2; i=$((i + 1)); done
fi
pg_isready -h "$HOST" -p 5432 -q || { echo "Server antwortet nicht ($HOST:5432)"; exit 1; }

frage() {   # $1 = Text; Passwort zweimal, ohne Anzeige
  while :; do
    printf '%s: ' "$1" >/dev/tty; stty -echo </dev/tty; read -r a </dev/tty; stty echo </dev/tty; echo >/dev/tty
    printf '%s (nochmal): ' "$1" >/dev/tty; stty -echo </dev/tty; read -r b </dev/tty; stty echo </dev/tty; echo >/dev/tty
    [ -n "$a" ] && [ "$a" = "$b" ] && { printf '%s' "$a"; return; }
    echo "Leer oder ungleich – bitte nochmal." >/dev/tty
  done
}

# Anmeldung als postgres: zuerst das Standard-Passwort des Add-ons, sonst das bisherige erfragen
export PGPASSWORD=homeassistant
if ! psql -h "$HOST" -U postgres -d postgres -tAc "SELECT 1" >/dev/null 2>&1; then
  printf 'Bisheriges Passwort von postgres: ' >/dev/tty; stty -echo </dev/tty; read -r PGPASSWORD </dev/tty; stty echo </dev/tty; echo >/dev/tty
  export PGPASSWORD
fi

ADMIN=$(frage "Neues Passwort für postgres (Verwaltung)")
SCHREIBER=$(frage "Passwort für den Benutzer baustelle (Integration)")
LESER=$(frage "Passwort für den Benutzer baustelle_leser (Excel/Power BI)")

psql -h "$HOST" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -v admin="$ADMIN" -v schreiber="$SCHREIBER" -v leser="$LESER" <<'SQL'
SELECT 'CREATE ROLE baustelle LOGIN' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'baustelle') \gexec
SELECT 'CREATE ROLE baustelle_leser LOGIN' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'baustelle_leser') \gexec
SELECT 'CREATE DATABASE baustelle' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'baustelle') \gexec
ALTER ROLE baustelle PASSWORD :'schreiber';
ALTER ROLE baustelle_leser PASSWORD :'leser';
ALTER DATABASE baustelle OWNER TO baustelle;
REVOKE ALL ON DATABASE baustelle FROM PUBLIC;
GRANT CONNECT ON DATABASE baustelle TO baustelle, baustelle_leser;
\c baustelle
CREATE EXTENSION IF NOT EXISTS timescaledb;
ALTER SCHEMA public OWNER TO baustelle;
GRANT USAGE ON SCHEMA public TO baustelle_leser;
\c postgres
ALTER ROLE postgres PASSWORD :'admin';
SQL

cat <<EOF

Fertig. Jetzt selbst eintragen:

1. /config/secrets.yaml:
     baustelle_db_url: postgresql://baustelle:<Passwort von baustelle>@$HOST:5432/baustelle

2. /config/packages/baustelle.yaml (legt Claude an, sobald du es willst):
     baustelle:
       db_url: !secret baustelle_db_url

3. Konfiguration prüfen, Neustart – beim ersten Start zieht die Integration die SQLite-Datei einmal um
   (dauert je nach Größe einige Minuten; die Datei bleibt als Rückweg liegen).

Für Excel/Power BI: Benutzer baustelle_leser, Datenbank baustelle (Port 5432 dafür im Add-on freigeben).
EOF
