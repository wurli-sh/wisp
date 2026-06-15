#!/usr/bin/env bash
set -euo pipefail

# Stage 1 gate — must pass before Phase 3 SDK / frontend work.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
PIDFILE="${ROOT}/.amoeba/issuer-service.pid"
LOGFILE="${ROOT}/.amoeba/issuer-service.log"
RUN_TESTNET="${AMOEBA_RUN_TESTNET_BLOCKERS:-0}"

echo "=== Phase 3 Blocker Gate ==="

cd "$ROOT"

echo ""
echo "1. Issuer-service unit tests"
cargo test -p issuer-service

echo ""
echo "2. Witness module round-trip"
pnpm test:witness

echo ""
echo "3. Local fixture generation (profile=local)"
AMOEBA_FIXTURE_PROFILE=local pnpm exec tsx circuits/circom/scripts/gen-fixture.ts

echo ""
echo "4. Phase 1 contract + circuit tests"
cargo test -p verifier -p compliance -p mock-sac
NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [[ "${NODE_MAJOR}" -ge 25 ]]; then
  pnpm test:circuit
else
  echo "   Skipping circuit TS tests (Node 25+ required; have $(node -v))"
fi
./circuits/circom/test/verify-fixtures.sh

echo ""
echo "5. Phase 2 pipeline"
./scripts/dev/demo-phase2.sh

if [[ "${RUN_TESTNET}" != "1" ]]; then
  echo ""
  echo "=== Phase 3 Blocker Gate: PASSED (local) ==="
  echo "Set AMOEBA_RUN_TESTNET_BLOCKERS=1 to run testnet prove + double publish checks."
  exit 0
fi

echo ""
echo "6. Testnet profile prove"
if [[ ! -f "${ROOT}/bindings/fixtures/demo-transfer-testnet.json" ]]; then
  echo "   Running bootstrap-testnet-demo.sh..."
  "${ROOT}/scripts/dev/bootstrap-testnet-demo.sh"
fi

export AMOEBA_FIXTURE_PROFILE=testnet
pnpm exec tsx circuits/circom/scripts/gen-fixture.ts
./circuits/circom/scripts/prove.sh circuits/circom/inputs/valid.testnet.json
pnpm exec tsx scripts/dev/write-testnet-golden.ts
test -f bindings/fixtures/public-inputs.testnet.json

echo ""
echo "7. Issuer double publish (idempotent update_issuer_root --auth)"
mkdir -p "${ROOT}/.amoeba"
export ISSUER_STATE_PATH="${ISSUER_STATE_PATH:-${ROOT}/.amoeba/issuer-state-testnet.json}"
export ISSUER_API_TOKEN="${ISSUER_API_TOKEN:-demo-token}"
export AMOEBA_FIXTURE_PROFILE=testnet
export AMOEBA_FIXTURES_DIR="${ROOT}/bindings/fixtures"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.amoeba/compliance.env" ]] && source "${ROOT}/.amoeba/compliance.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/.amoeba/testnet-demo.env" ]] && source "${ROOT}/.amoeba/testnet-demo.env"

export COMPLIANCE_CONTRACT_ID="${COMPLIANCE_ID:-${COMPLIANCE_CONTRACT_ID:-}}"
export ISSUER_PUBLIC_KEY="${ISSUER_PUBLIC_KEY:-}"
export PUBLISH_SOURCE_ACCOUNT="${PUBLISH_SOURCE_ACCOUNT:-${SOURCE:-amoeba-admin}}"
export ADMIN_PUBLIC_KEY="${ADMIN_PUBLIC_KEY:-$(stellar keys public-key "${PUBLISH_SOURCE_ACCOUNT}" 2>/dev/null || true)}"
unset ADMIN_SECRET_KEY ISSUER_SECRET_KEY

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" || true
  sleep 1
fi

cargo build -p issuer-service >"$LOGFILE" 2>&1
"${ROOT}/target/debug/issuer-service" >>"$LOGFILE" 2>&1 &
echo $! >"$PIDFILE"
sleep 4

cleanup() {
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
}
trap cleanup EXIT

curl -sf "http://${ADDR}/health" | grep -q '"status":"ok"'

code1=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer ${ISSUER_API_TOKEN}" \
  "http://${ADDR}/v1/roots/publish")
[[ "$code1" == "200" ]] || { echo "first publish failed: HTTP $code1"; exit 1; }

code2=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer ${ISSUER_API_TOKEN}" \
  "http://${ADDR}/v1/roots/publish")
[[ "$code2" == "200" ]] || { echo "second publish failed (G1 auth?): HTTP $code2"; exit 1; }

echo ""
echo "=== Phase 3 Blocker Gate: PASSED (local + testnet) ==="
