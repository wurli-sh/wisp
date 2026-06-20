#!/usr/bin/env bash
# Redeploy verifier + compliance when embedded vk.rs drifts from on-chain contracts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-$NETWORK_PASSPHRASE}"
DEPLOY_DIR="${ROOT}/.wisp"
ZKEY="${ROOT}/circuits/circom/artifacts/compliance_corridor_final.zkey"
VK_JSON="${ROOT}/circuits/circom/artifacts/verification_key.json"

if [[ ! -f "${ZKEY}" ]]; then
  echo "ERROR: missing proving key: ${ZKEY}" >&2
  exit 1
fi

TMP_VK="$(mktemp "${TMPDIR:-/tmp}/wisp-vk-from-zkey.XXXXXX.json")"
trap 'rm -f "${TMP_VK}"' EXIT
pnpm exec snarkjs zkey export verificationkey "${ZKEY}" "${TMP_VK}" >/dev/null
if [[ ! -f "${VK_JSON}" ]] || ! cmp -s "${TMP_VK}" "${VK_JSON}"; then
  echo "VK artifacts drift — regenerating verifier from active zkey"
  "${ROOT}/circuits/circom/scripts/export-vk.sh"
fi

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
  echo "VK ok"
  exit 0
fi

echo "VK drift — redeploying verifier + compliance"
rm -f "${DEPLOY_DIR}/verifier.env" "${DEPLOY_DIR}/compliance.env"
"${ROOT}/scripts/deploy/deploy-verifier.sh"
# shellcheck disable=SC1091
source "${DEPLOY_DIR}/verifier.env"
"${ROOT}/scripts/deploy/deploy-compliance.sh"

if curl -sf "http://127.0.0.1:3000/health" >/dev/null 2>&1; then
  ISSUER_API_TOKEN="${ISSUER_API_TOKEN:-demo-token}" \
    "${ROOT}/scripts/dev/publish-roots-testnet-via-issuer.sh" || \
    echo "WARN: root publish failed — run publish-roots-testnet-via-issuer.sh" >&2
else
  echo "Redeployed — run publish-roots-testnet-via-issuer.sh before settle"
fi
