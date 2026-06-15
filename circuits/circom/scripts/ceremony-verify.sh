#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS="$DIR/artifacts"
POWER="${POWER:-17}"
PTAU_FINAL="${PTAU_FINAL:-$ARTIFACTS/pot${POWER}_final.ptau}"
R1CS="${R1CS:-$ARTIFACTS/compliance_corridor.r1cs}"
ZKEY="${1:-$ARTIFACTS/compliance_corridor_final.zkey}"
TRANSCRIPT="${TRANSCRIPT:-$ARTIFACTS/ceremony/transcript.jsonl}"

if [[ ! -f "$ZKEY" ]]; then
  echo "ERROR: missing zkey: $ZKEY"
  exit 1
fi

if [[ ! -f "$R1CS" || ! -f "$PTAU_FINAL" ]]; then
  echo "ERROR: missing R1CS or PTAU. Expected:"
  echo "  R1CS=$R1CS"
  echo "  PTAU_FINAL=$PTAU_FINAL"
  exit 1
fi

sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}

echo "=== Verifying zkey ==="
snarkjs zkey verify "$R1CS" "$PTAU_FINAL" "$ZKEY"

echo "=== Hashes ==="
echo "R1CS_SHA256=$(sha256_file "$R1CS")"
echo "PTAU_SHA256=$(sha256_file "$PTAU_FINAL")"
echo "ZKEY_SHA256=$(sha256_file "$ZKEY")"

if [[ -f "$TRANSCRIPT" ]]; then
  echo "TRANSCRIPT_SHA256=$(sha256_file "$TRANSCRIPT")"
  echo "Transcript: $TRANSCRIPT"
else
  echo "WARN: transcript not found: $TRANSCRIPT"
fi
