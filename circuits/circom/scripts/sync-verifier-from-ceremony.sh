#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
ARTIFACTS="$DIR/artifacts"
# shellcheck source=ceremony-paths.sh
source "$DIR/scripts/ceremony-paths.sh"
SCRIPT_DIR="$DIR/scripts"
VERIFIER_WASM="$ROOT/target/wasm32v1-none/release/verifier.wasm"

for required in "$CEREMONY_MANIFEST" "$TRANSCRIPT" "$FINAL_ZKEY"; do
  if [[ ! -f "$required" ]]; then
    echo "ERROR: missing required file: $required"
    exit 1
  fi
done

"$SCRIPT_DIR/export-vk.sh"

cd "$ROOT"
echo "=== Building verifier wasm ==="
stellar contract build --package verifier

if [[ ! -f "$VERIFIER_WASM" ]]; then
  echo "ERROR: verifier wasm not found: $VERIFIER_WASM"
  exit 1
fi

VK_HASH="$(python3 "$SCRIPT_DIR/compute-vk-hash.py")"
WASM_SHA="$(sha256sum "$VERIFIER_WASM" | awk '{print $1}')"
VK_JSON_SHA="$(sha256sum "$VK_JSON" | awk '{print $1}')"

printf '%s\n' "$VK_HASH" > "$VK_HASH_TXT"

python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$CEREMONY_DIR" \
  --artifacts-dir "$ARTIFACTS" \
  --skip-zkey-verify

python3 "$SCRIPT_DIR/ceremony_lib.py" update-manifest-fields \
  --manifest "$CEREMONY_MANIFEST" \
  --json "$(python3 - <<PY
import json
print(json.dumps({
    "vk_hash": "$VK_HASH",
    "vk_hash_file": "$(basename "$VK_HASH_TXT")",
    "verification_key_sha256": "$VK_JSON_SHA",
    "verifier_contract_synced": True,
    "verifier_wasm_sha256": "$WASM_SHA",
}))
PY
)"

echo "vk_hash.txt:      $VK_HASH_TXT"
echo "vk_hash:          $VK_HASH"
echo "verifier wasm:    $VERIFIER_WASM"
echo "verifier wasm sha256: $WASM_SHA"
echo "manifest updated: verifier_contract_synced=true"
echo "Next: $SCRIPT_DIR/ceremony-publish.sh"
