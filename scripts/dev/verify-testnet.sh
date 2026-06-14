#!/usr/bin/env bash
set -euo pipefail

# Phase 0 Gate Check: Verify a Groth16 proof on Stellar testnet
# This script confirms the pipeline works before Phase 1 begins.

NETWORK="testnet"
SOURCE="amoeba-admin"
CONTRACT_ID="CAUPSWAQLEK5UH63LSCTH4HELV6IIELGMRVHU4NTBEYQ7AOX2MHRTYUJ"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE_DIR="${SCRIPT_DIR}/../fixtures/groth16-testnet"
mkdir -p "${FIXTURE_DIR}"

echo "=== Phase 0 Gate Check ==="
echo "Network: ${NETWORK}"
echo "Contract: ${CONTRACT_ID}"
echo ""

# Generate VK, proof, and public signal fixtures
# These are from the multiplier2 circuit (a*b=c where a=3, b=11, c=33)
# Coordinates from soroban-examples/groth16_verifier test

# Check that stellar CLI is available
if ! command -v stellar &> /dev/null; then
    echo "ERROR: stellar CLI not found"
    exit 1
fi

# Check that source account exists
if ! stellar keys address "${SOURCE}" &>/dev/null; then
    echo "ERROR: Source account '${SOURCE}' not found. Run: stellar keys generate ${SOURCE} --network testnet"
    exit 1
fi

echo "1. Checking account balance..."
ADDR=$(stellar keys address "${SOURCE}")
curl -s "https://horizon-testnet.stellar.org/accounts/${ADDR}" | \
  python3 -c "import sys,json; b=json.load(sys.stdin)['balances']; print(f'   Balance: {b[0][\"balance\"]} XLM')" 2>/dev/null || \
  echo "   (unable to fetch balance)"

echo ""
echo "2. Verifying valid proof (c=33)..."
RESULT=$(stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source-account "${SOURCE}" \
  --network "${NETWORK}" \
  -- verify_proof \
  --vk-file-path "${FIXTURE_DIR}/vk.json" \
  --proof-file-path "${FIXTURE_DIR}/proof.json" \
  --pub-signals-file-path "${FIXTURE_DIR}/pub_signals.json" 2>&1)

if echo "${RESULT}" | grep -q "^true"; then
    echo "   ✅ Valid proof ACCEPTED"
else
    echo "   ❌ Valid proof REJECTED (unexpected)"
    echo "   Result: ${RESULT}"
    exit 1
fi

echo ""
echo "3. Verifying invalid proof (c=22)..."
echo '["22"]' > /tmp/pub_signals_wrong.json
RESULT=$(stellar contract invoke \
  --id "${CONTRACT_ID}" \
  --source-account "${SOURCE}" \
  --network "${NETWORK}" \
  -- verify_proof \
  --vk-file-path "${FIXTURE_DIR}/vk.json" \
  --proof-file-path "${FIXTURE_DIR}/proof.json" \
  --pub-signals-file-path /tmp/pub_signals_wrong.json 2>&1)
rm -f /tmp/pub_signals_wrong.json

if echo "${RESULT}" | grep -q "^false"; then
    echo "   ✅ Invalid proof REJECTED"
else
    echo "   ❌ Invalid proof ACCEPTED (unexpected)"
    echo "   Result: ${RESULT}"
    exit 1
fi

echo ""
echo "=== Phase 0 Gate: PASSED ==="
echo "A minimal Groth16 proof verifies inside Soroban on testnet."
echo "Phase 1 can proceed."
