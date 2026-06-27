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

# The deploy tx may not have settled when this read simulates, surfacing as
# `Error(Storage, MissingValue)`. Retry with backoff until the instance exists.
ON_CHAIN_VK_HASH_RAW=""
for attempt in 1 2 3 4 5; do
  if vk_out=$(stellar contract invoke \
    --id "$VERIFIER_ID" \
    --source-account "$SOURCE" \
    --network "$NETWORK" \
    -- vk_hash 2>&1); then
    ON_CHAIN_VK_HASH_RAW=$(echo "$vk_out" | tail -1)
    break
  fi
  if [[ "$attempt" -eq 5 ]]; then
    echo "ERROR: verifier vk_hash read failed after ${attempt} attempts:" >&2
    echo "$vk_out" >&2
    exit 1
  fi
  echo "vk_hash read attempt ${attempt} failed (deploy settling?), retrying in ${attempt}s…" >&2
  sleep "$attempt"
done

if [[ "$NETWORK" == "mainnet" ]]; then
  python3 "$SCRIPT_DIR/ceremony_lib.py" compare-vk-hashes "$LOCAL_VK_HASH" "$ON_CHAIN_VK_HASH_RAW"
  echo "vk_hash verified against ceremony evidence"
fi

echo "VERIFIER_ID=${VERIFIER_ID}" | tee "$DEPLOY_DIR/verifier.env"
echo "Deployed verifier: ${VERIFIER_ID}"
