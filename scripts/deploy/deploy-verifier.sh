#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
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

echo "=== Deploy Groth16 verifier ==="
echo "Network: ${NETWORK}"
echo "Source:  ${SOURCE}"

cd "$ROOT"
stellar contract build --package verifier

VERIFIER_ID=$(stellar contract deploy \
  --package verifier \
  --source-account "$SOURCE" \
  --network "$NETWORK" | tail -1)

echo "VERIFIER_ID=${VERIFIER_ID}" | tee "$DEPLOY_DIR/verifier.env"
echo "Deployed verifier: ${VERIFIER_ID}"
