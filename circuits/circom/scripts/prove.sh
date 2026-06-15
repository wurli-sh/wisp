#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INPUT="${1:-$DIR/inputs/valid.us-mx.json}"
cd "$DIR/artifacts"

echo "=== Generating witness ==="
node compliance_corridor_js/generate_witness.js \
  compliance_corridor_js/compliance_corridor.wasm \
  "$INPUT" \
  witness.wtns

echo "=== Generating proof ==="
snarkjs groth16 prove compliance_corridor_final.zkey witness.wtns \
  proof.json public.json

echo "=== Done ==="
echo "Proof: proof.json"
echo "Public inputs: public.json"
cat public.json | python3 -m json.tool
