#!/usr/bin/env bash
# Start issuer-service + frontend dev server (testnet profile).
# Usage: ./scripts/dev/bru.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PIDFILE="${ROOT}/.amoeba/issuer-service.pid"
LOGFILE="${ROOT}/.amoeba/issuer-service.log"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
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
export STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
export NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-$NETWORK_PASSPHRASE}"
export WEB_AUTH_DOMAIN="${WEB_AUTH_DOMAIN:-localhost}"
export HORIZON_URL="${HORIZON_URL:-https://horizon-testnet.stellar.org}"
export KYC_MODE="${KYC_MODE:-sep10}"
export RUST_LOG="${RUST_LOG:-issuer_service=debug,tower_http=info}"
export PROVIDER_WEBHOOK_SECRETS="${PROVIDER_WEBHOOK_SECRETS:-fixture=demo-fixture-secret}"

if [[ -z "${COMPLIANCE_CONTRACT_ID}" ]]; then
  echo "COMPLIANCE_CONTRACT_ID missing — run bootstrap-testnet-demo.sh first" >&2
  exit 1
fi
if [[ -z "${ISSUER_PUBLIC_KEY}" ]]; then
  echo "ISSUER_PUBLIC_KEY missing — run bootstrap-testnet-demo.sh first" >&2
  exit 1
fi

ISSUER_MIGRATION_SQL="${ROOT}/backend/crates/issuer-service/migrations/001_supabase_issuer.sql"
ISSUER_MIGRATION_003="${ROOT}/backend/crates/issuer-service/migrations/003_root_snapshots_compliance_contract.sql"
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
  PGOPTIONS='-c client_min_messages=warning' psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -q -f "${ISSUER_MIGRATION_SQL}"
  if [[ -f "${ISSUER_MIGRATION_003}" ]]; then
    PGOPTIONS='-c client_min_messages=warning' psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -q -f "${ISSUER_MIGRATION_003}"
  fi
else
  echo "SUPABASE_DB_URL unset — issuer will use in-memory store (mock KYC still works locally)"
fi

mkdir -p "${ROOT}/.amoeba"

LAST_COMPLIANCE_FILE="${ROOT}/.amoeba/last-compliance-id"
REPUBLISH_ROOTS=0
if [[ ! -f "${ISSUER_STATE_PATH}" ]]; then
  REPUBLISH_ROOTS=1
  echo "Fresh issuer state — will republish roots after startup"
fi
if [[ -n "${COMPLIANCE_CONTRACT_ID}" ]]; then
  if [[ -f "${LAST_COMPLIANCE_FILE}" ]] && [[ "$(tr -d '[:space:]' < "${LAST_COMPLIANCE_FILE}")" != "${COMPLIANCE_CONTRACT_ID}" ]]; then
    REPUBLISH_ROOTS=1
    echo "Compliance contract changed — will republish issuer roots after startup"
  fi
  echo "${COMPLIANCE_CONTRACT_ID}" > "${LAST_COMPLIANCE_FILE}"
fi

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" || true
  sleep 1
fi

cleanup() {
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
}
trap cleanup EXIT INT TERM

echo "issuer-service (testnet) → http://${ISSUER_LISTEN_ADDR}"
echo "  state:   ${ISSUER_STATE_PATH}"
echo "  fixture: ${AMOEBA_FIXTURE_PROFILE}"
echo "  kyc:     ${KYC_MODE} (domain=${WEB_AUTH_DOMAIN})"
echo "  rustlog: ${RUST_LOG}"
echo "  log:     ${LOGFILE}"
echo ""
echo "frontend → http://localhost:${FRONTEND_PORT}  (/issuer → issuer-service)"
echo ""
echo "Operator checklist:"
echo "  1. ./scripts/dev/bootstrap-testnet-demo.sh  (Circle SAC + contracts + fixtures)"
echo "  2. ./scripts/dev/check-circle-usdc-testnet.sh  (fund sender if fail)"
echo "  3. ./scripts/dev/bru.sh  (issuer + frontend)"
echo "  4. Freighter testnet → SEP-10 sign → approve USDC → prove → settle"
echo ""

cargo run -p issuer-service >>"$LOGFILE" 2>&1 &
echo $! >"$PIDFILE"

for _ in $(seq 1 30); do
  if curl -sf "http://${ISSUER_LISTEN_ADDR}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf "http://${ISSUER_LISTEN_ADDR}/health" >/dev/null 2>&1; then
  echo "issuer-service failed to start — see ${LOGFILE}" >&2
  exit 1
fi

if [[ "${REPUBLISH_ROOTS}" == "1" ]]; then
  echo "Republishing roots for compliance contract ${COMPLIANCE_CONTRACT_ID}"
  "${ROOT}/scripts/dev/publish-roots-testnet-via-issuer.sh" || \
    echo "WARN: root republish failed — run ./scripts/dev/publish-roots-testnet-via-issuer.sh" >&2
fi

if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  "${ROOT}/scripts/dev/patch-corridor-circle-asset.sh" 2>/dev/null || \
    echo "WARN: corridor asset patch skipped — run ./scripts/dev/patch-corridor-circle-asset.sh after issuer is up" >&2
fi

pnpm dev:frontend
