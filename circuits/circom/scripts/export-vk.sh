#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
ARTIFACTS="$DIR/artifacts"
# shellcheck source=ceremony-paths.sh
source "$DIR/scripts/ceremony-paths.sh"
SCRIPT_DIR="$DIR/scripts"
DEV_ZKEY="$ARTIFACTS/compliance_corridor_final.zkey"
DEV_VK="$ARTIFACTS/verification_key.json"

if [[ ! -f "$FINAL_ZKEY" ]]; then
  if [[ -n "${CEREMONY_FINAL_ZKEY:-}" && -f "${CEREMONY_FINAL_ZKEY}" ]]; then
    FINAL_ZKEY="${CEREMONY_FINAL_ZKEY}"
  elif [[ -f "$DEV_ZKEY" ]]; then
    FINAL_ZKEY="$DEV_ZKEY"
    echo "Using dev zkey: $FINAL_ZKEY"
  else
    echo "ERROR: final zkey not found."
    echo "Expected ceremony zkey: $CEREMONY_DIR/compliance_corridor_final.zkey"
    echo "Or set CEREMONY_FINAL_ZKEY=/path/to/final.zkey"
    exit 1
  fi
fi

if [[ "$FINAL_ZKEY" == "$DEV_ZKEY" ]]; then
  VK_OUT="$DEV_VK"
else
  VK_OUT="$VK_JSON"
fi

mkdir -p "$(dirname "$VK_OUT")"

echo "=== Exporting verification key ==="
snarkjs zkey export verificationkey "$FINAL_ZKEY" "$VK_OUT"
echo "Written: $VK_OUT"
python3 -m json.tool "$VK_OUT" > /dev/null && echo "Valid JSON"

if ! command -v soroban-verifier-gen &>/dev/null; then
  echo "ERROR: soroban-verifier-gen not found. Install with: cargo install soroban-verifier-gen"
  exit 1
fi

echo "=== Regenerating Soroban verifier contract ==="
soroban-verifier-gen \
  --curve bn254 \
  --vk "$VK_OUT" \
  --out "$ROOT/contracts/verifier" \
  --crate-name verifier \
  --contract-name Groth16Verifier

"$ROOT/scripts/patch-verifier.sh"

echo "Regenerated and patched: $ROOT/contracts/verifier"
echo "Next: stellar contract build --package verifier"
echo "Then: python3 $SCRIPT_DIR/compute-vk-hash.py"
