#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS="$DIR/artifacts"
# shellcheck source=ceremony-paths.sh
source "$DIR/scripts/ceremony-paths.sh"
POWER="${POWER:-17}"
PTAU_FINAL="${PTAU_FINAL:-$ARTIFACTS/pot${POWER}_final.ptau}"
R1CS="${R1CS:-$ARTIFACTS/compliance_corridor.r1cs}"
SCRIPT_DIR="$DIR/scripts"

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

if [[ ! -f "$TRANSCRIPT" ]]; then
  echo "ERROR: missing transcript: $TRANSCRIPT"
  exit 1
fi

if [[ -f "$CEREMONY_MANIFEST" ]]; then
  echo "ERROR: manifest already exists: $CEREMONY_MANIFEST"
  exit 1
fi

if [[ ! -f "$INPUT_ZKEY" ]]; then
  echo "ERROR: missing input zkey: $INPUT_ZKEY"
  exit 1
fi

if [[ -z "$BEACON_HEX" ]]; then
  echo "ERROR: set CEREMONY_BEACON_HEX to a public random hex beacon before finalization."
  echo "Example sources: future block hash, drand randomness, or another precommitted public randomness source."
  exit 1
fi

python3 "$SCRIPT_DIR/ceremony_lib.py" validate-finalize-pre \
  --transcript "$TRANSCRIPT" \
  --input-zkey "$INPUT_ZKEY"

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
snarkjs zkey export verificationkey "$FINAL_ZKEY" "$VK_JSON"

FINAL_STEP="$(python3 - <<PY
import json
from pathlib import Path
rows = [json.loads(line) for line in Path("$TRANSCRIPT").read_text().splitlines() if line.strip()]
print(rows[-1]["step"] + 1)
PY
)"

cat >> "$TRANSCRIPT" <<EOF
{"step":$FINAL_STEP,"kind":"finalize","input":"$(basename "$INPUT_ZKEY")","input_sha256":"$(sha256_file "$INPUT_ZKEY")","beacon_hex":"$BEACON_HEX","beacon_rounds":$BEACON_ROUNDS,"final_zkey":"$FINAL_ZKEY_BASENAME","final_zkey_sha256":"$(sha256_file "$FINAL_ZKEY")","verification_key":"$VK_JSON_BASENAME","verification_key_sha256":"$(sha256_file "$VK_JSON")","created_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF

python3 "$SCRIPT_DIR/ceremony_lib.py" write-finalize-manifest \
  --ceremony-dir "$CEREMONY_DIR" \
  --artifacts-dir "$ARTIFACTS" \
  --transcript "$TRANSCRIPT" \
  --r1cs "$R1CS" \
  --ptau "$PTAU_FINAL"

echo "Final zkey:       $FINAL_ZKEY"
echo "Verification key: $VK_JSON"
echo "Manifest:         $CEREMONY_MANIFEST"
echo "Transcript:       $TRANSCRIPT"
echo "Ceremony is NOT publishable until verifier sync completes."
echo "Next: $SCRIPT_DIR/sync-verifier-from-ceremony.sh"
