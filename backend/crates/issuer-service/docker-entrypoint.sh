#!/bin/sh
set -eu

PORT="${PORT:-10000}"
export ISSUER_LISTEN_ADDR="0.0.0.0:${PORT}"

if [ -n "${SUPABASE_DB_URL:-}${DATABASE_URL:-}" ]; then
  MIGRATIONS_DIR="${MIGRATIONS_DIR:-/app/migrations}" \
    /app/scripts/deploy/migrate-issuer-db.sh
fi

exec /app/issuer-service
