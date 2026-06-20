#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
ADMIN="${ADMIN:-$SOURCE}"
TREASURY="${TREASURY:-$ADMIN}"
REGISTRATION_TOKEN="${REGISTRATION_TOKEN:-${SAC_CONTRACT_ID:-${ASSET_ID:-}}}"
REGISTRATION_FEE="${REGISTRATION_FEE:-0}"
DEPLOY_DIR="${ROOT}/.wisp"
SCRIPT_DIR="$ROOT/circuits/circom/scripts"
mkdir -p "$DEPLOY_DIR"

if [[ "$NETWORK" == "mainnet" ]]; then
  # shellcheck source=ceremony-mainnet-gate.sh
  source "$ROOT/scripts/deploy/ceremony-mainnet-gate.sh"
fi

if [[ -f "$DEPLOY_DIR/verifier.env" ]]; then
  # shellcheck disable=SC1091
  source "$DEPLOY_DIR/verifier.env"
fi

if [[ -z "${VERIFIER_ID:-}" ]]; then
  echo "ERROR: VERIFIER_ID not set. Run deploy-verifier.sh first or export VERIFIER_ID."
  exit 1
fi

if [[ -z "${REGISTRATION_TOKEN}" ]]; then
  echo "ERROR: REGISTRATION_TOKEN not set. Export REGISTRATION_TOKEN or SAC_CONTRACT_ID for v2 issuer registration fees."
  exit 1
fi

echo "Deploy compliance (${NETWORK}) verifier=${VERIFIER_ID}"

cd "$ROOT"
stellar contract build --package compliance

VK_HASH_RAW=$(stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source-account "$SOURCE" \
  --network "$NETWORK" \
  -- vk_hash | tail -1)

VK_HASH=$(python3 "$SCRIPT_DIR/ceremony_lib.py" normalize-vk-hash "$VK_HASH_RAW")

if [[ "$NETWORK" == "mainnet" ]]; then
  python3 "$SCRIPT_DIR/ceremony_lib.py" compare-vk-hashes "$LOCAL_VK_HASH" "$VK_HASH_RAW"
  echo "vk_hash verified against ceremony evidence"
fi

COMPLIANCE_ID=$(stellar contract deploy \
  --package compliance \
  --source-account "$SOURCE" \
  --network "$NETWORK" | tail -1)

stellar contract invoke \
  --id "$COMPLIANCE_ID" \
  --source-account "$ADMIN" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$ADMIN" \
  --treasury "$TREASURY" \
  --registration_token "$REGISTRATION_TOKEN" \
  --registration_fee "$REGISTRATION_FEE" \
  --verifier "$VERIFIER_ID" \
  --expected_vk_hash "$VK_HASH_RAW"

COMPLIANCE_DEPLOY_LEDGER=""
if command -v jq >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
  COMPLIANCE_DEPLOY_LEDGER="$("${ROOT}/scripts/dev/compliance-deploy-ledger.sh" "${COMPLIANCE_ID}" 2>/dev/null || true)"
fi

{
  echo "VERIFIER_ID=${VERIFIER_ID}"
  echo "COMPLIANCE_ID=${COMPLIANCE_ID}"
  echo "VK_HASH=${VK_HASH}"
  echo "TREASURY=${TREASURY}"
  echo "REGISTRATION_TOKEN=${REGISTRATION_TOKEN}"
  echo "REGISTRATION_FEE=${REGISTRATION_FEE}"
  if [[ -n "${COMPLIANCE_DEPLOY_LEDGER}" ]]; then
    echo "COMPLIANCE_DEPLOY_LEDGER=${COMPLIANCE_DEPLOY_LEDGER}"
  fi
} | tee "$DEPLOY_DIR/compliance.env"

echo "Compliance deployed: ${COMPLIANCE_ID}"
