#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS="$DIR/artifacts"
# shellcheck source=ceremony-paths.sh
source "$DIR/scripts/ceremony-paths.sh"
POWER="${POWER:-17}"
PTAU_FINAL="${PTAU_FINAL:-$ARTIFACTS/pot${POWER}_final.ptau}"
R1CS="${R1CS:-$ARTIFACTS/compliance_corridor.r1cs}"
INITIAL_ZKEY="$CEREMONY_DIR/compliance_corridor_0000.zkey"
SCRIPT_DIR="$DIR/scripts"

mkdir -p "$CEREMONY_DIR"

if [[ ! -f "$R1CS" ]]; then
  echo "ERROR: missing R1CS: $R1CS"
  echo "Run: ./circuits/circom/scripts/compile.sh"
  exit 1
fi

if [[ ! -f "$PTAU_FINAL" ]]; then
  echo "ERROR: missing PTAU: $PTAU_FINAL"
  echo "Run the Powers of Tau flow first, or set PTAU_FINAL=/path/to/pot_final.ptau"
  exit 1
fi

if [[ -f "$TRANSCRIPT" ]]; then
  echo "ERROR: ceremony transcript already exists: $TRANSCRIPT"
  exit 1
fi

if [[ -f "$CEREMONY_MANIFEST" ]]; then
  echo "ERROR: ceremony manifest already exists: $CEREMONY_MANIFEST"
  exit 1
fi

if [[ -f "$INITIAL_ZKEY" ]]; then
  echo "ERROR: ceremony already initialized: $INITIAL_ZKEY"
  exit 1
fi

sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}

echo "=== Initializing Amoeba Groth16 phase 2 ceremony ==="
snarkjs groth16 setup "$R1CS" "$PTAU_FINAL" "$INITIAL_ZKEY"
snarkjs zkey verify "$R1CS" "$PTAU_FINAL" "$INITIAL_ZKEY"

cat > "$TRANSCRIPT" <<EOF
{"step":0,"kind":"init","r1cs":"$(basename "$R1CS")","r1cs_sha256":"$(sha256_file "$R1CS")","ptau":"$(basename "$PTAU_FINAL")","ptau_sha256":"$(sha256_file "$PTAU_FINAL")","zkey":"$(basename "$INITIAL_ZKEY")","zkey_sha256":"$(sha256_file "$INITIAL_ZKEY")","created_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF

echo "Initial zkey: $INITIAL_ZKEY"
echo "Transcript:   $TRANSCRIPT"
echo "Ceremony dir: $CEREMONY_DIR"
echo "Next: $SCRIPT_DIR/ceremony-contribute.sh $INITIAL_ZKEY $CEREMONY_DIR/compliance_corridor_0001.zkey <contributor>"
