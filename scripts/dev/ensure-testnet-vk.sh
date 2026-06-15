#!/usr/bin/env bash
# Redeploy verifier + compliance when embedded vk.rs drifts from on-chain contracts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
DEPLOY_DIR="${ROOT}/.amoeba"

LOCAL_VK_HASH=$(python3 "${ROOT}/circuits/circom/scripts/compute-vk-hash.py" | tr -d '\n')

if [[ -f "${DEPLOY_DIR}/verifier.env" ]]; then
  # shellcheck disable=SC1091
  source "${DEPLOY_DIR}/verifier.env"
fi

if [[ -n "${VERIFIER_ID:-}" ]]; then
  ON_CHAIN_RAW=$(stellar contract invoke \
    --id "${VERIFIER_ID}" \
    --source-account "${SOURCE}" \
    --network "${NETWORK}" \
    -- vk_hash 2>/dev/null | tail -1 | tr -d '"')
  ON_CHAIN=$(python3 "${ROOT}/circuits/circom/scripts/ceremony_lib.py" normalize-vk-hash "${ON_CHAIN_RAW}")
else
  ON_CHAIN=""
fi

if [[ "${LOCAL_VK_HASH}" == "${ON_CHAIN}" ]]; then
  echo "   VK aligned (${LOCAL_VK_HASH})"
  exit 0
fi

echo "   VK drift detected (local=${LOCAL_VK_HASH} on-chain=${ON_CHAIN:-none})"
echo "   Redeploying verifier + compliance..."
rm -f "${DEPLOY_DIR}/verifier.env" "${DEPLOY_DIR}/compliance.env"
"${ROOT}/scripts/deploy/deploy-verifier.sh"
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/verifier.env"
"${ROOT}/scripts/deploy/deploy-compliance.sh"
