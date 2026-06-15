#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
cd "$DIR/artifacts"

if [[ ! -f compliance_corridor_final.zkey ]]; then
  echo "ERROR: compliance_corridor_final.zkey not found. Run ./scripts/setup.sh first."
  exit 1
fi

echo "=== Exporting verification key ==="
snarkjs zkey export verificationkey compliance_corridor_final.zkey verification_key.json
echo "Written: verification_key.json"
python3 -m json.tool verification_key.json > /dev/null && echo "Valid JSON"

if ! command -v soroban-verifier-gen &>/dev/null; then
  echo "ERROR: soroban-verifier-gen not found. Install with: cargo install soroban-verifier-gen"
  exit 1
fi

echo "=== Regenerating Soroban verifier contract ==="
soroban-verifier-gen \
  --curve bn254 \
  --vk verification_key.json \
  --out "$ROOT/contracts/verifier" \
  --crate-name verifier \
  --contract-name Groth16Verifier

"$ROOT/scripts/patch-verifier.sh"

echo "Regenerated and patched: $ROOT/contracts/verifier"
echo "Run: cargo test -p verifier"
