#!/usr/bin/env bash
set -euo pipefail

# Phase 1 Gate: verify the compliance-corridor Groth16 proof on Stellar testnet.

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="${ROOT}/.amoeba"
FIXTURE_DIR="${ROOT}/scripts/fixtures/compliance-testnet"

echo "=== Phase 1 Testnet Gate ==="
echo "Network: ${NETWORK}"
echo ""

if ! command -v stellar &>/dev/null; then
  echo "ERROR: stellar CLI not found"
  exit 1
fi

if ! stellar keys address "${SOURCE}" &>/dev/null; then
  echo "ERROR: Source '${SOURCE}' not found. Run: stellar keys generate ${SOURCE} --network ${NETWORK}"
  exit 1
fi

if [[ ! -f "${ROOT}/circuits/circom/artifacts/proof.json" ]]; then
  echo "ERROR: proof.json missing. Run circuits/circom/scripts/prove.sh"
  exit 1
fi

echo "1. Serializing proof for Stellar CLI..."
node --import tsx "${ROOT}/scripts/dev/serialize-compliance-proof.ts"

if [[ -f "${DEPLOY_DIR}/verifier.env" ]]; then
  # shellcheck disable=SC1091
  source "${DEPLOY_DIR}/verifier.env"
fi

if [[ -z "${VERIFIER_ID:-}" ]]; then
  echo "2. Deploying verifier (no .amoeba/verifier.env)..."
  "${ROOT}/scripts/deploy/deploy-verifier.sh"
  # shellcheck disable=SC1091
  source "${DEPLOY_DIR}/verifier.env"
else
  echo "2. Using deployed verifier: ${VERIFIER_ID}"
fi

PROOF_JSON="${FIXTURE_DIR}/proof.json"
PUB_SIGNALS=$(python3 -c "import json; print(json.dumps(json.load(open('${PROOF_JSON}'))['pub_signals']))")
PROOF_A=$(python3 -c "import json; print(json.load(open('${PROOF_JSON}'))['proof']['a'])")
PROOF_B=$(python3 -c "import json; print(json.load(open('${PROOF_JSON}'))['proof']['b'])")
PROOF_C=$(python3 -c "import json; print(json.load(open('${PROOF_JSON}'))['proof']['c'])")

echo ""
echo "3. Verifying compliance proof on-chain..."
RESULT=$(stellar contract invoke \
  --id "${VERIFIER_ID}" \
  --source-account "${SOURCE}" \
  --network "${NETWORK}" \
  --send=no \
  -- verify_proof \
  --proof "{\"a\":\"${PROOF_A}\",\"b\":\"${PROOF_B}\",\"c\":\"${PROOF_C}\"}" \
  --pub_signals "${PUB_SIGNALS}" 2>&1) || true

if echo "${RESULT}" | grep -qiE '^true$|true'; then
  echo "   ✅ Compliance proof ACCEPTED on testnet"
else
  echo "   ❌ Compliance proof REJECTED (unexpected)"
  echo "   Result: ${RESULT}"
  echo ""
  echo "   If argument encoding failed, inspect with:"
  echo "   stellar contract invoke --id ${VERIFIER_ID} --network ${NETWORK} --send=no -- verify_proof --help"
  exit 1
fi

echo ""
echo "4. Rejecting tampered public signal..."
TAMPERED=$(python3 -c "import json; s=json.load(open('${PROOF_JSON}'))['pub_signals']; s[9]=str(int(s[9])+1); print(json.dumps(s))")
RESULT=$(stellar contract invoke \
  --id "${VERIFIER_ID}" \
  --source-account "${SOURCE}" \
  --network "${NETWORK}" \
  --send=no \
  -- verify_proof \
  --proof "{\"a\":\"${PROOF_A}\",\"b\":\"${PROOF_B}\",\"c\":\"${PROOF_C}\"}" \
  --pub_signals "${TAMPERED}" 2>&1) || true

if echo "${RESULT}" | grep -qiE '^false$|false'; then
  echo "   ✅ Tampered public input REJECTED"
else
  echo "   ❌ Tampered public input ACCEPTED (unexpected)"
  echo "   Result: ${RESULT}"
  exit 1
fi

echo ""
echo "=== Phase 1 Testnet Gate: PASSED ==="
echo "Verifier: ${VERIFIER_ID}"
