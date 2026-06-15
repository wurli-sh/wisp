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
ROOT="$(cd "$DIR/../.." && pwd)"
VK_RS="$ROOT/backend/programs/verifier/src/vk.rs"

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "ERROR: missing required file: $1"
    exit 1
  fi
}

require_file "$FINAL_ZKEY"
require_file "$TRANSCRIPT"
require_file "$CEREMONY_MANIFEST"
require_file "$VK_JSON"
require_file "$VK_HASH_TXT"
require_file "$R1CS"
require_file "$PTAU_FINAL"

echo "=== Verifying zkey (snarkjs) ==="
snarkjs zkey verify "$R1CS" "$PTAU_FINAL" "$FINAL_ZKEY"

VK_HASH="$(python3 "$SCRIPT_DIR/compute-vk-hash.py" --vk-rs "$VK_RS")"

python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$CEREMONY_DIR" \
  --artifacts-dir "$ARTIFACTS" \
  --vk-hash-from-vk-rs "$VK_HASH"

echo "=== Ceremony package verified ==="
echo "R1CS_SHA256=$(sha256sum "$R1CS" | awk '{print $1}')"
echo "PTAU_SHA256=$(sha256sum "$PTAU_FINAL" | awk '{print $1}')"
echo "ZKEY_SHA256=$(sha256sum "$FINAL_ZKEY" | awk '{print $1}')"
echo "TRANSCRIPT_SHA256=$(sha256sum "$TRANSCRIPT" | awk '{print $1}')"
echo "VK_HASH=$VK_HASH"
echo "Ceremony dir: $CEREMONY_DIR"
