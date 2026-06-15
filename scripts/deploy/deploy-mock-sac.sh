#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
DEPLOY_DIR="${ROOT}/.amoeba"
mkdir -p "$DEPLOY_DIR"

echo "=== Deploy mock SAC (testnet demo asset) ==="
echo "Network: ${NETWORK}"

if ! command -v stellar &>/dev/null; then
  echo "ERROR: stellar CLI not found"
  exit 1
fi

SENDER_IDENTITY="${SENDER_IDENTITY:-amoeba-sender}"
if ! stellar keys public-key "${SENDER_IDENTITY}" &>/dev/null; then
  echo "ERROR: identity '${SENDER_IDENTITY}' not found."
  echo "  stellar keys generate ${SENDER_IDENTITY} --fund"
  exit 1
fi

SENDER_ADDR=$(stellar keys public-key "${SENDER_IDENTITY}")
MINT_AMOUNT="${TESTNET_MINT_AMOUNT:-100000000}"

cd "$ROOT"
stellar contract build --package mock-sac

SAC_ID=$(stellar contract deploy \
  --package mock-sac \
  --source-account "${SOURCE}" \
  --network "${NETWORK}" | tail -1)

echo "Minting ${MINT_AMOUNT} to ${SENDER_ADDR}..."
stellar contract invoke \
  --id "${SAC_ID}" \
  --source-account "${SOURCE}" \
  --network "${NETWORK}" \
  --send=yes \
  -- mint \
  --to "${SENDER_ADDR}" \
  --amount "${MINT_AMOUNT}"

{
  echo "SAC_CONTRACT_ID=${SAC_ID}"
  echo "ASSET_ID=${SAC_ID}"
  echo "SENDER_IDENTITY=${SENDER_IDENTITY}"
  echo "SENDER_PUBLIC_KEY=${SENDER_ADDR}"
} | tee "${DEPLOY_DIR}/sac.env"

echo "Mock SAC deployed: ${SAC_ID}"
