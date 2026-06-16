#!/usr/bin/env bash
# Start issuer-service for frontend demo (testnet profile).
# Usage: ./scripts/dev/bru.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
[[ -f "${ROOT}/.env" ]] && source "${ROOT}/.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.amoeba/testnet-demo.env" ]] && source "${ROOT}/.amoeba/testnet-demo.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.amoeba/compliance.env" ]] && source "${ROOT}/.amoeba/compliance.env"

export ISSUER_LISTEN_ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
export ISSUER_STATE_PATH="${ISSUER_STATE_PATH:-${ROOT}/.amoeba/issuer-state-testnet.json}"
export ISSUER_API_TOKEN="${ISSUER_API_TOKEN:-demo-token}"
export AMOEBA_FIXTURES_DIR="${AMOEBA_FIXTURES_DIR:-${ROOT}/bindings/fixtures}"
export AMOEBA_FIXTURE_PROFILE="${AMOEBA_FIXTURE_PROFILE:-testnet}"
export COMPLIANCE_CONTRACT_ID="${COMPLIANCE_CONTRACT_ID:-${COMPLIANCE_ID:-}}"
export ISSUER_PUBLIC_KEY="${ISSUER_PUBLIC_KEY:-}"
export PUBLISH_SOURCE_ACCOUNT="${PUBLISH_SOURCE_ACCOUNT:-amoeba-admin}"
export ADMIN_PUBLIC_KEY="${ADMIN_PUBLIC_KEY:-$(stellar keys public-key "${PUBLISH_SOURCE_ACCOUNT}")}"
export RUST_LOG="${RUST_LOG:-issuer_service=debug,tower_http=info}"

if [[ -z "${COMPLIANCE_CONTRACT_ID}" ]]; then
  echo "COMPLIANCE_CONTRACT_ID missing — run bootstrap-testnet-demo.sh first" >&2
  exit 1
fi
if [[ -z "${ISSUER_PUBLIC_KEY}" ]]; then
  echo "ISSUER_PUBLIC_KEY missing — run bootstrap-testnet-demo.sh first" >&2
  exit 1
fi

ISSUER_MIGRATION_SQL="${ROOT}/backend/crates/issuer-service/migrations/001_supabase_issuer.sql"
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "SUPABASE_DB_URL is set but psql is not installed — mock KYC needs schema migration" >&2
    exit 1
  fi
  if [[ ! -f "${ISSUER_MIGRATION_SQL}" ]]; then
    echo "missing migration: ${ISSUER_MIGRATION_SQL}" >&2
    exit 1
  fi
  echo "Applying issuer schema (idempotent) → Supabase"
  psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -f "${ISSUER_MIGRATION_SQL}"
else
  echo "SUPABASE_DB_URL unset — issuer will use in-memory store (mock KYC still works locally)"
fi

echo "issuer-service (testnet) → http://${ISSUER_LISTEN_ADDR}"
echo "  state:   ${ISSUER_STATE_PATH}"
echo "  fixture: ${AMOEBA_FIXTURE_PROFILE}"
echo "  rustlog: ${RUST_LOG}"

exec cargo run -p issuer-service
