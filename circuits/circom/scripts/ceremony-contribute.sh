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
  echo "Usage: $0 <input.zkey> <output.zkey> <contributor-name>"
  echo "Example: $0 artifacts/ceremony/compliance_corridor_0000.zkey artifacts/ceremony/compliance_corridor_0001.zkey alice"
}

if [[ $# -ne 3 ]]; then
  usage
  exit 1
fi

INPUT_ZKEY="$1"
OUTPUT_ZKEY="$2"
CONTRIBUTOR="$3"

if [[ ! -f "$TRANSCRIPT" ]]; then
  echo "ERROR: missing transcript: $TRANSCRIPT"
  echo "Run: $SCRIPT_DIR/ceremony-init.sh"
  exit 1
fi

if [[ ! -f "$INPUT_ZKEY" ]]; then
  echo "ERROR: missing input zkey: $INPUT_ZKEY"
  exit 1
fi

if [[ -f "$OUTPUT_ZKEY" ]]; then
  echo "ERROR: output zkey already exists: $OUTPUT_ZKEY"
  exit 1
fi

if [[ ! -f "$R1CS" || ! -f "$PTAU_FINAL" ]]; then
  echo "ERROR: missing R1CS or PTAU. Expected:"
  echo "  R1CS=$R1CS"
  echo "  PTAU_FINAL=$PTAU_FINAL"
  exit 1
fi

python3 "$SCRIPT_DIR/ceremony_lib.py" validate-contribute-pre \
  --transcript "$TRANSCRIPT" \
  --input-zkey "$INPUT_ZKEY" \
  --output-zkey "$OUTPUT_ZKEY" \
  --contributor "$CONTRIBUTOR"

mkdir -p "$(dirname "$OUTPUT_ZKEY")"

sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}

INPUT_SHA="$(sha256_file "$INPUT_ZKEY")"
ENTROPY="${CEREMONY_ENTROPY:-}"
if [[ -z "$ENTROPY" ]]; then
  echo "ERROR: set CEREMONY_ENTROPY to private high-entropy text for this contribution."
  echo "Do not reuse entropy and do not commit it."
  exit 1
fi

echo "=== Verifying input zkey ==="
snarkjs zkey verify "$R1CS" "$PTAU_FINAL" "$INPUT_ZKEY"

echo "=== Applying contribution: $CONTRIBUTOR ==="
snarkjs zkey contribute "$INPUT_ZKEY" "$OUTPUT_ZKEY" \
  --name="$CONTRIBUTOR" -v -e="$ENTROPY"

echo "=== Verifying output zkey ==="
snarkjs zkey verify "$R1CS" "$PTAU_FINAL" "$OUTPUT_ZKEY"

OUTPUT_SHA="$(sha256_file "$OUTPUT_ZKEY")"
STEP="$(python3 - <<PY
import json
from pathlib import Path
rows = [json.loads(line) for line in Path("$TRANSCRIPT").read_text().splitlines() if line.strip()]
print(rows[-1]["step"] + 1)
PY
)"

cat >> "$TRANSCRIPT" <<EOF
{"step":$STEP,"kind":"contribution","contributor":"$CONTRIBUTOR","input":"$(basename "$INPUT_ZKEY")","input_sha256":"$INPUT_SHA","output":"$(basename "$OUTPUT_ZKEY")","output_sha256":"$OUTPUT_SHA","created_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF

echo "Output zkey: $OUTPUT_ZKEY"
echo "Transcript:  $TRANSCRIPT"
