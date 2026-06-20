#!/usr/bin/env bash
set -euo pipefail

# One-time testnet demo bootstrap: keys → fixture → prove → deploy → publish roots.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
DEPLOY_DIR="${ROOT}/.wisp"
mkdir -p "$DEPLOY_DIR"

echo "[bootstrap] testnet demo"

ensure_identity() {
  local name="$1"
  if ! stellar keys public-key "${name}" &>/dev/null; then
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

echo "[bootstrap] 1/6 circle USDC"
CIRCLE_SAC_ID="$(jq -r '.sac_contract_id' "${ROOT}/bindings/fixtures/circle-testnet-usdc.json")"
CURRENT_SAC=""
if [[ -f "${DEPLOY_DIR}/sac.env" ]]; then
  # shellcheck disable=SC1091
  source "${DEPLOY_DIR}/sac.env"
  CURRENT_SAC="${SAC_CONTRACT_ID:-${ASSET_ID:-}}"
fi
if [[ -z "${CURRENT_SAC}" ]] || [[ "${CURRENT_SAC}" != "${CIRCLE_SAC_ID}" ]]; then
  SENDER_IDENTITY=amoeba-sender "${ROOT}/scripts/deploy/setup-circle-usdc-testnet.sh" --all-demo-accounts
else
  "${ROOT}/scripts/deploy/ensure-circle-usdc-trustlines.sh" amoeba-sender amoeba-recipient
fi
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/sac.env"
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/testnet-demo.env"

echo "[bootstrap] 2/6 fixture"
node --import tsx "${ROOT}/scripts/dev/gen-testnet-fixture.ts"

echo "[bootstrap] 3/6 circuit"
if [[ ! -f "${ROOT}/circuits/circom/artifacts/compliance_corridor_final.zkey" ]]; then
  pnpm compile:circuit
  pnpm setup:circuit
fi

echo "[bootstrap] 4/6 prove"
export WISP_FIXTURE_PROFILE=testnet
node --import tsx "${ROOT}/circuits/circom/scripts/gen-fixture.ts"
"${ROOT}/circuits/circom/scripts/prove.sh" \
  "${ROOT}/circuits/circom/inputs/valid.testnet.json"

node --import tsx "${ROOT}/scripts/dev/write-testnet-golden.ts"

"${ROOT}/circuits/circom/scripts/prove.sh" \
  "${ROOT}/circuits/circom/inputs/valid.us-mx.json"

echo "[bootstrap] 5/6 deploy"
"${ROOT}/scripts/dev/ensure-testnet-vk.sh"
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/verifier.env"
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/compliance.env"

echo "[bootstrap] 6/6 roots"
"${ROOT}/scripts/dev/publish-roots-testnet-via-issuer.sh"

echo "[bootstrap] done compliance=${COMPLIANCE_ID}"
