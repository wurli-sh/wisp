#!/usr/bin/env bash
# Apply issuer-service SQL migrations to Postgres (Supabase or any PostgreSQL).
# Usage: SUPABASE_DB_URL='postgresql://...?sslmode=require' ./scripts/deploy/migrate-issuer-db.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-${ROOT}/backend/crates/issuer-service/migrations}"
DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "${DB_URL}" ]]; then
  echo "migrate-issuer-db: SUPABASE_DB_URL or DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "migrate-issuer-db: psql not found" >&2
  exit 1
fi

echo "migrate-issuer-db: applying migrations from ${MIGRATIONS_DIR}"

# Auto-discover migrations in lexicographic order so new files (e.g. 004_*, 005_*)
# are applied without editing this script. Migrations are idempotent
# (`create table if not exists`), so re-running is safe.
shopt -s nullglob
MIGRATIONS=("${MIGRATIONS_DIR}"/[0-9]*.sql)
shopt -u nullglob
if [[ "${#MIGRATIONS[@]}" -eq 0 ]]; then
  echo "migrate-issuer-db: no migrations found in ${MIGRATIONS_DIR}" >&2
  exit 1
fi
IFS=$'\n' MIGRATIONS=($(sort <<<"${MIGRATIONS[*]}")); unset IFS

MIGRATE_FAILED=0
for migration in "${MIGRATIONS[@]}"; do
  echo "migrate-issuer-db: applying $(basename "${migration}")"
  if ! PGOPTIONS='-c client_min_messages=warning' psql "${DB_URL}" -v ON_ERROR_STOP=1 -q -f "${migration}"; then
    MIGRATE_FAILED=1
    break
  fi
done
if [[ "${MIGRATE_FAILED}" -eq 1 ]]; then
  echo "migrate-issuer-db: connection failed — on Render use Supabase Session pooler URI (not db.*.supabase.co IPv6 direct)" >&2
  exit 1
fi
echo "migrate-issuer-db: ok"
