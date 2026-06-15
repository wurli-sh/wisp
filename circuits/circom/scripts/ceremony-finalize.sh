#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS="$DIR/artifacts"
CEREMONY_DIR="$ARTIFACTS/ceremony"
POWER="${POWER:-17}"
PTAU_FINAL="${PTAU_FINAL:-$ARTIFACTS/pot${POWER}_final.ptau}"
R1CS="${R1CS:-$ARTIFACTS/compliance_corridor.r1cs}"
TRANSCRIPT="$CEREMONY_DIR/transcript.jsonl"
FINAL_ZKEY="$ARTIFACTS/compliance_corridor_final.zkey"

usage() {
  echo "Usage: $0 <last-contribution.zkey>"
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

INPUT_ZKEY="$1"
BEACON_ZKEY="$CEREMONY_DIR/compliance_corridor_beacon.zkey"
BEACON_HEX="${CEREMONY_BEACON_HEX:-}"
BEACON_ROUNDS="${CEREMONY_BEACON_ROUNDS:-10}"

if [[ ! -f "$INPUT_ZKEY" ]]; then
  echo "ERROR: missing input zkey: $INPUT_ZKEY"
  exit 1
fi

if [[ -z "$BEACON_HEX" ]]; then
  echo "ERROR: set CEREMONY_BEACON_HEX to a public random hex beacon before finalization."
  echo "Example sources: future block hash, drand randomness, or another precommitted public randomness source."
  exit 1
fi

sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}

echo "=== Verifying final contributed zkey ==="
snarkjs zkey verify "$R1CS" "$PTAU_FINAL" "$INPUT_ZKEY"

echo "=== Applying public beacon ==="
snarkjs zkey beacon "$INPUT_ZKEY" "$BEACON_ZKEY" "$BEACON_HEX" "$BEACON_ROUNDS" \
  -n="Amoeba final beacon"

echo "=== Verifying beaconed zkey ==="
snarkjs zkey verify "$R1CS" "$PTAU_FINAL" "$BEACON_ZKEY"

cp "$BEACON_ZKEY" "$FINAL_ZKEY"
snarkjs zkey export verificationkey "$FINAL_ZKEY" "$ARTIFACTS/verification_key.json"

cat >> "$TRANSCRIPT" <<EOF
{"kind":"finalize","input":"$(basename "$INPUT_ZKEY")","input_sha256":"$(sha256_file "$INPUT_ZKEY")","beacon_hex":"$BEACON_HEX","beacon_rounds":$BEACON_ROUNDS,"final_zkey":"$(basename "$FINAL_ZKEY")","final_zkey_sha256":"$(sha256_file "$FINAL_ZKEY")","verification_key":"verification_key.json","verification_key_sha256":"$(sha256_file "$ARTIFACTS/verification_key.json")","created_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF

echo "Final zkey:       $FINAL_ZKEY"
echo "Verification key: $ARTIFACTS/verification_key.json"
echo "Transcript:       $TRANSCRIPT"
echo "Next: ./circuits/circom/scripts/export-vk.sh"
