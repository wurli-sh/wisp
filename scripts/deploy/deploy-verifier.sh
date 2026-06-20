#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
DEPLOY_DIR="${ROOT}/.wisp"
SCRIPT_DIR="$ROOT/circuits/circom/scripts"
mkdir -p "$DEPLOY_DIR"

if [[ "$NETWORK" == "mainnet" ]]; then
  # shellcheck source=ceremony-mainnet-gate.sh
  source "$ROOT/scripts/deploy/ceremony-mainnet-gate.sh"
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

ON_CHAIN_VK_HASH_RAW=$(stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source-account "$SOURCE" \
  --network "$NETWORK" \
  -- vk_hash | tail -1)

if [[ "$NETWORK" == "mainnet" ]]; then
  python3 "$SCRIPT_DIR/ceremony_lib.py" compare-vk-hashes "$LOCAL_VK_HASH" "$ON_CHAIN_VK_HASH_RAW"
  echo "vk_hash verified against ceremony evidence"
fi

echo "VERIFIER_ID=${VERIFIER_ID}" | tee "$DEPLOY_DIR/verifier.env"
echo "Deployed verifier: ${VERIFIER_ID}"
