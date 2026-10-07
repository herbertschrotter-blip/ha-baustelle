#!/bin/sh
# Test-PostgreSQL mit TimescaleDB für die Integrationstests (BSM-026). Läuft nur lokal im Terminal-Container, ohne
# Passwort (trust, nur Unix-Socket und 127.0.0.1), getrennt vom echten Server (Add-on „TimescaleDB“). Nichts davon kommt
# nach /config oder auf den Pilot. Nach einem Neustart des Terminal-Add-ons einfach erneut aufrufen.
#
#   tools/pg-test.sh          installieren (falls nötig), starten, URL ausgeben
#   tools/pg-test.sh stop     anhalten
#
# Tests: BAUSTELLE_TEST_PG=postgresql+psycopg://postgres@127.0.0.1:54329/postgres – ohne die Variable werden die
# PostgreSQL-Tests übersprungen (GitHub setzt sie über einen Dienst-Container).
set -eu

PORT=54329
DATEN=${BAUSTELLE_PG_DATEN:-/tmp/baustelle-pg-test}
URL="postgresql+psycopg://postgres@127.0.0.1:$PORT/postgres"

if [ "${1:-}" = "stop" ]; then
  su postgres -s /bin/sh -c "pg_ctl -D '$DATEN' -m fast stop" || true
  exit 0
fi

if ! command -v initdb >/dev/null 2>&1 || [ ! -e /usr/lib/postgresql17/timescaledb.so ]; then
  apk add --no-cache postgresql17 postgresql17-client postgresql17-contrib postgresql-timescaledb >/dev/null
fi

if [ ! -f "$DATEN/PG_VERSION" ]; then
  mkdir -p "$DATEN" && chown postgres:postgres "$DATEN"
  su postgres -s /bin/sh -c "initdb -D '$DATEN' -U postgres --auth=trust --encoding=UTF8 --locale=C" >/dev/null
  {
    echo "shared_preload_libraries = 'timescaledb'"
    echo "timescaledb.telemetry_level = off"
    echo "listen_addresses = '127.0.0.1'"
    echo "port = $PORT"
    echo "unix_socket_directories = '$DATEN'"
    echo "fsync = off"   # nur Testdaten
  } >> "$DATEN/postgresql.conf"
fi

if ! su postgres -s /bin/sh -c "pg_ctl -D '$DATEN' status" >/dev/null 2>&1; then
  su postgres -s /bin/sh -c "pg_ctl -D '$DATEN' -l '$DATEN/log' -w start" >/dev/null
fi
echo "$URL"
