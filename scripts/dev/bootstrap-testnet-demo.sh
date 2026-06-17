#!/usr/bin/env bash
set -euo pipefail

# One-time testnet demo bootstrap: keys → fixture → prove → deploy → publish roots.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
DEPLOY_DIR="${ROOT}/.amoeba"
mkdir -p "$DEPLOY_DIR"

echo "=== Bootstrap testnet demo (Phase 3 blockers) ==="
echo "Network: ${NETWORK}"

ensure_identity() {
  local name="$1"
  if ! stellar keys public-key "${name}" &>/dev/null; then
    echo "Generating identity ${name}..."
    stellar keys generate "${name}" --fund
  fi
}

for id in amoeba-sender amoeba-recipient amoeba-issuer; do
  ensure_identity "${id}"
done

# Record public keys for scripts
{
  echo "SENDER_IDENTITY=amoeba-sender"
  echo "RECIPIENT_IDENTITY=amoeba-recipient"
  echo "ISSUER_IDENTITY=amoeba-issuer"
  echo "SENDER_PUBLIC_KEY=$(stellar keys public-key amoeba-sender)"
  echo "RECIPIENT_PUBLIC_KEY=$(stellar keys public-key amoeba-recipient)"
  echo "ISSUER_PUBLIC_KEY=$(stellar keys public-key amoeba-issuer)"
  echo "NETWORK=${NETWORK}"
} > "${DEPLOY_DIR}/testnet-demo.env"

echo ""
echo "1. Circle testnet USDC SAC"
CIRCLE_SAC_ID="$(jq -r '.sac_contract_id' "${ROOT}/bindings/fixtures/circle-testnet-usdc.json")"
CURRENT_SAC=""
if [[ -f "${DEPLOY_DIR}/sac.env" ]]; then
  # shellcheck disable=SC1091
  source "${DEPLOY_DIR}/sac.env"
  CURRENT_SAC="${SAC_CONTRACT_ID:-${ASSET_ID:-}}"
fi
if [[ -z "${CURRENT_SAC}" ]] || [[ "${CURRENT_SAC}" != "${CIRCLE_SAC_ID}" ]]; then
  echo "   Setting up Circle USDC (current=${CURRENT_SAC:-none})"
  SENDER_IDENTITY=amoeba-sender "${ROOT}/scripts/deploy/setup-circle-usdc-testnet.sh" --all-demo-accounts
else
  echo "   Using Circle SAC in ${DEPLOY_DIR}/sac.env"
  "${ROOT}/scripts/deploy/ensure-circle-usdc-trustlines.sh" amoeba-sender amoeba-recipient
fi
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/sac.env"
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/testnet-demo.env"

echo ""
echo "2. Generate testnet transfer fixture (dynamic epoch)"
node --import tsx "${ROOT}/scripts/dev/gen-testnet-fixture.ts"

echo ""
echo "3. Compile / setup circuit (if needed)"
if [[ ! -f "${ROOT}/circuits/circom/artifacts/compliance_corridor_final.zkey" ]]; then
  pnpm compile:circuit
  pnpm setup:circuit
fi

echo ""
echo "4. Generate witness + prove (testnet profile)"
export AMOEBA_FIXTURE_PROFILE=testnet
node --import tsx "${ROOT}/circuits/circom/scripts/gen-fixture.ts"
"${ROOT}/circuits/circom/scripts/prove.sh" \
  "${ROOT}/circuits/circom/inputs/valid.testnet.json"

node --import tsx "${ROOT}/scripts/dev/write-testnet-golden.ts"

echo "   Restoring local CI proof (valid.us-mx)"
"${ROOT}/circuits/circom/scripts/prove.sh" \
  "${ROOT}/circuits/circom/inputs/valid.us-mx.json"

echo ""
echo "5. Deploy contracts (align VK with embedded vk.rs)"
"${ROOT}/scripts/dev/ensure-testnet-vk.sh"
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/verifier.env"
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/compliance.env"

echo ""
echo "6. Publish dynamic roots via issuer-service"
"${ROOT}/scripts/dev/publish-roots-testnet-via-issuer.sh"

echo ""
echo "=== Bootstrap complete ==="
echo "  Fixture: bindings/fixtures/demo-transfer-testnet.json"
echo "  Golden:  bindings/fixtures/public-inputs.testnet.json"
echo "  SAC:     ${SAC_CONTRACT_ID:-${ASSET_ID:-unknown}}"
echo "  Compliance: ${COMPLIANCE_ID}"
