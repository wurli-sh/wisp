#!/usr/bin/env bash
# Start issuer-service briefly, seed testnet user, publish dynamic roots, then stop.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
LOGFILE="${ROOT}/.wisp/issuer-publish-roots.log"
PIDFILE="${ROOT}/.wisp/issuer-publish-roots.pid"

log_publish() { echo "[publish-roots] $*"; }

# shellcheck disable=SC1091
[[ -f "${ROOT}/.env" ]] && source "${ROOT}/.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.wisp/testnet-demo.env" ]] && source "${ROOT}/.wisp/testnet-demo.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.wisp/compliance.env" ]] && source "${ROOT}/.wisp/compliance.env"

export ISSUER_LISTEN_ADDR="${ADDR}"
export ISSUER_STATE_PATH="${ISSUER_STATE_PATH:-${ROOT}/.wisp/issuer-state-testnet.json}"
export ISSUER_API_TOKEN="${ISSUER_API_TOKEN:-demo-token}"
export WISP_FIXTURES_DIR="${WISP_FIXTURES_DIR:-${ROOT}/bindings/fixtures}"
export WISP_FIXTURE_PROFILE="${WISP_FIXTURE_PROFILE:-testnet}"
export COMPLIANCE_CONTRACT_ID="${COMPLIANCE_ID:-${COMPLIANCE_CONTRACT_ID:-}}"
export VERIFIER_CONTRACT_ID="${VERIFIER_ID:-${VERIFIER_CONTRACT_ID:-}}"
export EXPECTED_VK_HASH="${VK_HASH:-${EXPECTED_VK_HASH:-}}"
export ISSUER_PUBLIC_KEY="${ISSUER_PUBLIC_KEY:-}"
export PUBLISH_SOURCE_ACCOUNT="${PUBLISH_SOURCE_ACCOUNT:-amoeba-issuer}"
export ADMIN_PUBLIC_KEY="${ADMIN_PUBLIC_KEY:-$(stellar keys public-key "amoeba-admin" 2>/dev/null || true)}"
export STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
export NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-$NETWORK_PASSPHRASE}"
export PROVIDER_WEBHOOK_SECRETS="${PROVIDER_WEBHOOK_SECRETS:-fixture=demo-fixture-secret}"

if [[ -z "${COMPLIANCE_CONTRACT_ID}" ]]; then
  echo "[publish-roots] COMPLIANCE_CONTRACT_ID missing" >&2
  exit 1
fi

cleanup() {
  if [[ -f "${PIDFILE}" ]]; then
    kill "$(cat "${PIDFILE}")" 2>/dev/null || true
    rm -f "${PIDFILE}"
  fi
}
trap cleanup EXIT

if ! curl -sf "http://${ADDR}/health" >/dev/null 2>&1; then
  log_publish "starting issuer…"
  cargo build -p issuer-service >"${LOGFILE}" 2>&1
  "${ROOT}/target/debug/issuer-service" >>"${LOGFILE}" 2>&1 &
  echo $! >"${PIDFILE}"
  for _ in $(seq 1 30); do
    if curl -sf "http://${ADDR}/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! curl -sf "http://${ADDR}/health" >/dev/null 2>&1; then
  echo "[publish-roots] issuer failed — see ${LOGFILE}" >&2
  exit 1
fi

"${ROOT}/scripts/dev/seed-testnet-issuer.sh"

BODY="${PUBLISH_ROOTS_BODY:-{\"corridor_id\":1}}"
RESP="$(curl -sf -X POST "http://${ADDR}/v1/admin/roots/publish" \
  -H "Authorization: Bearer ${ISSUER_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${BODY}")"

if command -v jq >/dev/null 2>&1; then
  STATUS="$(echo "${RESP}" | jq -r '.results[0].status // .status // empty')"
  MSG="$(echo "${RESP}" | jq -r '.results[0].message // empty')"
  if [[ "${STATUS}" == "failed" ]]; then
    echo "[publish-roots] failed: ${MSG:-unknown}" >&2
    exit 1
  fi
  log_publish "ok ${STATUS:-published}"
else
  log_publish "ok"
fi
