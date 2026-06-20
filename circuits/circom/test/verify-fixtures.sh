#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS="$DIR/artifacts"
WASM="$ARTIFACTS/compliance_corridor_js/compliance_corridor.wasm"
GEN_WITNESS="$ARTIFACTS/compliance_corridor_js/generate_witness.js"

if [[ ! -f "$WASM" ]]; then
  echo "ERROR: circuit wasm missing. Run ./scripts/compile.sh"
  exit 1
fi

pass() { echo "  OK: $1"; }
fail() { echo "  FAIL: $1"; exit 1; }

echo "=== Valid fixture should generate witness ==="
node "$GEN_WITNESS" "$WASM" "$DIR/inputs/valid.us-mx.json" /tmp/wisp-valid.wtns
pass "valid.us-mx.json"

echo "=== Invalid fixtures should fail witness generation ==="
for fixture in invalid.amount.json invalid.recipient.json invalid.expired.json invalid.sanctioned.json invalid.corridor.json; do
  if node "$GEN_WITNESS" "$WASM" "$DIR/inputs/$fixture" "/tmp/wisp-${fixture}" 2>/dev/null; then
    fail "$fixture produced a witness (expected constraint failure)"
  else
    pass "$fixture rejected"
  fi
done

rm -f /tmp/wisp-*.wtns
echo "=== Circuit fixture checks passed ==="
