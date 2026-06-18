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
MIGRATE_FAILED=0
for migration in \
  "${MIGRATIONS_DIR}/001_supabase_issuer.sql" \
  "${MIGRATIONS_DIR}/002_mock_kyc_challenges.sql" \
  "${MIGRATIONS_DIR}/003_root_snapshots_compliance_contract.sql"; do
  if [[ ! -f "${migration}" ]]; then
    echo "migrate-issuer-db: missing migration: ${migration}" >&2
    exit 1
  fi
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
