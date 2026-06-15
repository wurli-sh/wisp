#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS="$DIR/artifacts"
# shellcheck source=ceremony-paths.sh
source "$DIR/scripts/ceremony-paths.sh"
SCRIPT_DIR="$DIR/scripts"

if [[ ! -f "$CEREMONY_MANIFEST" ]]; then
  echo "ERROR: missing manifest: $CEREMONY_MANIFEST"
  exit 1
fi

python3 "$SCRIPT_DIR/ceremony_lib.py" check-manifest-flags \
  --manifest "$CEREMONY_MANIFEST" \
  --require-sync

"$SCRIPT_DIR/ceremony-verify.sh"

python3 "$SCRIPT_DIR/ceremony_lib.py" update-manifest-fields \
  --manifest "$CEREMONY_MANIFEST" \
  --json '{"published": true}'

echo "=== Ceremony published ==="
echo "Commit these evidence files to the repo:"
echo "  $TRANSCRIPT"
echo "  $CEREMONY_MANIFEST"
echo "  $VK_JSON"
echo "  $VK_HASH_TXT"
echo "Retain locally (not committed): $FINAL_ZKEY"

python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$CEREMONY_DIR" \
  --artifacts-dir "$ARTIFACTS" \
  --require-published \
  --require-sync \
  --skip-zkey-verify
