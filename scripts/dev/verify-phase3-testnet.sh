#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
PIDFILE="${ROOT}/.amoeba/issuer-service-testnet.pid"
LOGFILE="${ROOT}/.amoeba/issuer-service-testnet.log"

echo "=== Phase 3 Testnet Gate ==="
echo "Network: ${NETWORK}"

cd "${ROOT}"

if [[ ! -f "${ROOT}/bindings/fixtures/demo-transfer-testnet.json" ]]; then
  echo "Running bootstrap-testnet-demo.sh..."
  "${ROOT}/scripts/dev/bootstrap-testnet-demo.sh"
fi

# shellcheck disable=SC1091
source "${ROOT}/.amoeba/testnet-demo.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.amoeba/compliance.env" ]] && source "${ROOT}/.amoeba/compliance.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.amoeba/sac.env" ]] && source "${ROOT}/.amoeba/sac.env"

echo ""
echo "0. Ensure on-chain VK matches local vk.rs"
export SOURCE="${SOURCE:-amoeba-admin}"
"${ROOT}/scripts/dev/ensure-testnet-vk.sh"
# shellcheck disable=SC1091
source "${ROOT}/.amoeba/compliance.env"
# shellcheck disable=SC1091
source "${ROOT}/.amoeba/testnet-demo.env"

echo ""
echo "0b. Publish issuer + corridor roots (testnet fixture)"
export COMPLIANCE_ID
export ISSUER="${ISSUER_PUBLIC_KEY}"
FIXTURE="${ROOT}/circuits/circom/inputs/valid.testnet.json" \
  "${ROOT}/scripts/deploy/publish-roots.sh"

echo ""
echo "1. Refresh testnet fixture epoch + reprove"
pnpm exec tsx "${ROOT}/scripts/dev/gen-testnet-fixture.ts"
export AMOEBA_FIXTURE_PROFILE=testnet
pnpm exec tsx "${ROOT}/circuits/circom/scripts/gen-fixture.ts"
"${ROOT}/circuits/circom/scripts/prove.sh" \
  "${ROOT}/circuits/circom/inputs/valid.testnet.json"
pnpm exec tsx "${ROOT}/scripts/dev/write-testnet-golden.ts"

echo ""
echo "2. Start issuer-service (testnet profile)"
mkdir -p "${ROOT}/.amoeba"
export ISSUER_STATE_PATH="${ROOT}/.amoeba/issuer-state-testnet.json"
export ISSUER_API_TOKEN="${ISSUER_API_TOKEN:-demo-token}"
export AMOEBA_FIXTURES_DIR="${ROOT}/bindings/fixtures"
export COMPLIANCE_CONTRACT_ID="${COMPLIANCE_ID:-${COMPLIANCE_CONTRACT_ID:-}}"
export ISSUER_PUBLIC_KEY="${ISSUER_PUBLIC_KEY:-}"
export PUBLISH_SOURCE_ACCOUNT="${PUBLISH_SOURCE_ACCOUNT:-${SOURCE}}"
export ADMIN_PUBLIC_KEY="${ADMIN_PUBLIC_KEY:-$(stellar keys public-key "${SOURCE}")}"

rm -f "${ISSUER_STATE_PATH}"

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" || true
  sleep 1
fi

cargo build -p issuer-service >"${LOGFILE}" 2>&1
"${ROOT}/target/debug/issuer-service" >>"${LOGFILE}" 2>&1 &
echo $! >"${PIDFILE}"
sleep 4

cleanup() {
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
}
trap cleanup EXIT

curl -sf "http://${ADDR}/health" | grep -q '"status":"ok"'

echo ""
echo "3. Build JS packages"
pnpm build:js

SENDER_SECRET=$(stellar keys secret amoeba-sender)
export SENDER_SECRET
export AMOEBA_FIXTURE_PROFILE=testnet

echo ""
echo "4. Prove → settle → audit → replay check"
pnpm exec tsx "${ROOT}/scripts/dev/phase3-testnet-settle.ts"

echo ""
echo "=== Phase 3 Testnet Gate: PASSED ==="
