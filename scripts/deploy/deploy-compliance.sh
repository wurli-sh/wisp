#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
ADMIN="${ADMIN:-$SOURCE}"
DEPLOY_DIR="${ROOT}/.amoeba"
mkdir -p "$DEPLOY_DIR"

if [[ "$NETWORK" == "mainnet" ]]; then
  if [[ "${AMOEBA_MAINNET_APPROVED:-}" != "1" ]]; then
    echo "ERROR: mainnet deploy requires AMOEBA_MAINNET_APPROVED=1 after completing MAINNET_BLOCKERS.md."
    exit 1
  fi
  if [[ ! -f "${ROOT}/circuits/circom/artifacts/ceremony/transcript.jsonl" ]]; then
    echo "ERROR: missing ceremony transcript. Complete CEREMONY_RUNBOOK.md before mainnet."
    exit 1
  fi
  "${ROOT}/circuits/circom/scripts/ceremony-verify.sh"
fi

if [[ -f "$DEPLOY_DIR/verifier.env" ]]; then
  # shellcheck disable=SC1091
  source "$DEPLOY_DIR/verifier.env"
fi

if [[ -z "${VERIFIER_ID:-}" ]]; then
  echo "ERROR: VERIFIER_ID not set. Run deploy-verifier.sh first or export VERIFIER_ID."
  exit 1
fi

echo "=== Deploy compliance contract ==="
echo "Network:  ${NETWORK}"
echo "Verifier: ${VERIFIER_ID}"

cd "$ROOT"
stellar contract build --package compliance

VK_HASH=$(stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source-account "$SOURCE" \
  --network "$NETWORK" \
  -- vk_hash | tail -1)

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
  --verifier "$VERIFIER_ID" \
  --expected_vk_hash "$VK_HASH"

{
  echo "VERIFIER_ID=${VERIFIER_ID}"
  echo "COMPLIANCE_ID=${COMPLIANCE_ID}"
  echo "VK_HASH=${VK_HASH}"
} | tee "$DEPLOY_DIR/compliance.env"

echo "Deployed compliance: ${COMPLIANCE_ID}"
