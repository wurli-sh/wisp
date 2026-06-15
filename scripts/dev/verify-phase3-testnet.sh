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
node "${ROOT}/scripts/dev/gen-testnet-fixture.mjs"
export AMOEBA_FIXTURE_PROFILE=testnet
node "${ROOT}/circuits/circom/scripts/gen-fixture.mjs"
"${ROOT}/circuits/circom/scripts/prove.sh" \
  "${ROOT}/circuits/circom/inputs/valid.testnet.json"
node "${ROOT}/scripts/dev/write-testnet-golden.mjs"

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
echo "3. Build compliance client + SDK deps"
if [[ ! -d "${ROOT}/sdk/node_modules/@stellar/stellar-sdk" ]]; then
  echo "   Installing @amoeba/sdk dependencies..."
  (cd "${ROOT}/sdk" && npm install --silent)
fi
export NODE_PATH="${ROOT}/sdk/node_modules${NODE_PATH:+:${NODE_PATH}}"
(cd "${ROOT}/bindings/generated/compliance" && npm install --silent && npx tsc)

SENDER_SECRET=$(stellar keys secret amoeba-sender)
export SENDER_SECRET
export AMOEBA_FIXTURE_PROFILE=testnet

echo ""
echo "4. Prove → settle → audit → replay check"
(cd "${ROOT}" && node --input-type=module <<'NODE'
import { AmoebaClient } from "./sdk/src/index.mjs";
import { loadAmoebaEnv } from "./scripts/dev/load-amoeba-env.mjs";

const env = loadAmoebaEnv();
const client = AmoebaClient.fromEnv({
  AMOEBA_FIXTURE_PROFILE: "testnet",
  ISSUER_PUBLIC_KEY: env.ISSUER_PUBLIC_KEY,
  COMPLIANCE_CONTRACT_ID: env.COMPLIANCE_ID ?? env.COMPLIANCE_CONTRACT_ID,
});

const pkg = await client.issuer.getDemoTransfer();
console.log("Proving (epoch=%s)...", pkg.transfer.epoch);
const proven = await client.prove({ package: pkg });
console.log("Settling on testnet...");
const secret = process.env.SENDER_SECRET;
const result = await client.settleWithKeypair(proven, pkg, secret);
console.log("Tx:", result.getTransactionResponse?.txHash ?? result.sendTransactionResponse?.hash ?? result);

const senderPk = env.SENDER_PUBLIC_KEY;
if (!senderPk) throw new Error("SENDER_PUBLIC_KEY missing from testnet-demo.env");
const audit = await client.audit(proven.nullifier, senderPk);
console.log("Attestation:", audit.attested);
if (!audit.attested) process.exit(1);

console.log("Replay check (expect failure)...");
try {
  await client.settleWithKeypair(proven, pkg, secret);
  console.error("ERROR: duplicate settle succeeded");
  process.exit(1);
} catch (e) {
  console.log("Duplicate settle rejected as expected:", e.message?.slice(0, 120));
}
NODE
)

echo ""
echo "=== Phase 3 Testnet Gate: PASSED ==="
