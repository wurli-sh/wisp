#!/usr/bin/env bash
# Start issuer-service briefly, seed testnet user, publish dynamic roots, then stop.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
LOGFILE="${ROOT}/.amoeba/issuer-publish-roots.log"
PIDFILE="${ROOT}/.amoeba/issuer-publish-roots.pid"

log_publish() {
  echo "[publish-roots] $*"
}

# shellcheck disable=SC1091
[[ -f "${ROOT}/.env" ]] && source "${ROOT}/.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.amoeba/testnet-demo.env" ]] && source "${ROOT}/.amoeba/testnet-demo.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.amoeba/compliance.env" ]] && source "${ROOT}/.amoeba/compliance.env"

export ISSUER_LISTEN_ADDR="${ADDR}"
export ISSUER_STATE_PATH="${ISSUER_STATE_PATH:-${ROOT}/.amoeba/issuer-state-testnet.json}"
export ISSUER_API_TOKEN="${ISSUER_API_TOKEN:-demo-token}"
export AMOEBA_FIXTURES_DIR="${AMOEBA_FIXTURES_DIR:-${ROOT}/bindings/fixtures}"
export AMOEBA_FIXTURE_PROFILE="${AMOEBA_FIXTURE_PROFILE:-testnet}"
export COMPLIANCE_CONTRACT_ID="${COMPLIANCE_ID:-${COMPLIANCE_CONTRACT_ID:-}}"
export ISSUER_PUBLIC_KEY="${ISSUER_PUBLIC_KEY:-}"
export PUBLISH_SOURCE_ACCOUNT="${PUBLISH_SOURCE_ACCOUNT:-amoeba-issuer}"
export ADMIN_PUBLIC_KEY="${ADMIN_PUBLIC_KEY:-$(stellar keys public-key "amoeba-admin" 2>/dev/null || true)}"
export STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
export NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-$NETWORK_PASSPHRASE}"
export PROVIDER_WEBHOOK_SECRETS="${PROVIDER_WEBHOOK_SECRETS:-fixture=demo-fixture-secret}"

if [[ -z "${COMPLIANCE_CONTRACT_ID}" ]]; then
  echo "COMPLIANCE_CONTRACT_ID missing" >&2
  exit 1
fi

log_publish "compliance=${COMPLIANCE_CONTRACT_ID} issuer=${ISSUER_PUBLIC_KEY} source=${PUBLISH_SOURCE_ACCOUNT}"

cleanup() {
  if [[ -f "${PIDFILE}" ]]; then
    kill "$(cat "${PIDFILE}")" 2>/dev/null || true
    rm -f "${PIDFILE}"
  fi
}
trap cleanup EXIT

if curl -sf "http://${ADDR}/health" >/dev/null 2>&1; then
  log_publish "issuer-service already running on ${ADDR}"
  echo "issuer-service already running on ${ADDR}"
else
  log_publish "starting issuer-service on ${ADDR}"
  echo "Starting issuer-service for root publish..."
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
  echo "issuer-service failed to start — see ${LOGFILE}" >&2
  exit 1
fi

"${ROOT}/scripts/dev/seed-testnet-issuer.sh"
log_publish "seeded testnet issuer user"
BODY="${PUBLISH_ROOTS_BODY:-{\"corridor_id\":1}}"
log_publish "POST /v1/admin/roots/publish corridor_id=1"
RESP="$(curl -sf -X POST "http://${ADDR}/v1/admin/roots/publish" \
  -H "Authorization: Bearer ${ISSUER_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${BODY}")"
echo "${RESP}"
if command -v jq >/dev/null 2>&1; then
  STATUS="$(echo "${RESP}" | jq -r '.results[0].status // .status // empty')"
  MSG="$(echo "${RESP}" | jq -r '.results[0].message // empty')"
  log_publish "result status=${STATUS:-unknown} ${MSG:+$MSG}"
  if [[ "${STATUS}" == "failed" ]]; then
    echo "ERROR: root publish failed: ${MSG:-unknown}" >&2
    exit 1
  fi
else
  log_publish "result ${RESP}"
fi

echo ""
echo "Dynamic roots published via issuer-service"
