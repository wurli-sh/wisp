#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CIRCOM="$ROOT/circuits/circom"

echo "=== Amoeba Phase 1 E2E (local) ==="

echo ""
echo "1. Generate fixtures (if missing)"
if [[ ! -f "$CIRCOM/inputs/valid.us-mx.json" ]]; then
  pnpm exec tsx "$CIRCOM/scripts/gen-fixture.ts"
fi

echo ""
echo "2. Compile circuit"
"$CIRCOM/scripts/compile.sh"

echo ""
echo "3. Trusted setup (skip if zkey exists)"
if [[ ! -f "$CIRCOM/artifacts/compliance_corridor_final.zkey" ]]; then
  "$CIRCOM/scripts/setup.sh"
fi

echo ""
echo "4. Prove valid fixture"
"$CIRCOM/scripts/prove.sh" "$CIRCOM/inputs/valid.us-mx.json"

echo ""
echo "5. Local snarkjs verify"
"$CIRCOM/scripts/verify-local.sh"

echo ""
echo "6. Export VK + regenerate verifier"
CEREMONY_FINAL_ZKEY="$CIRCOM/artifacts/compliance_corridor_final.zkey" \
  "$CIRCOM/scripts/export-vk.sh"

echo ""
echo "7. Circuit fixture checks"
"$CIRCOM/test/verify-fixtures.sh"

echo ""
echo "8. Contract unit tests"
cd "$ROOT"
cargo test -p verifier -p compliance -p mock-sac

echo ""
echo "9. Build Soroban WASM"
stellar contract build

echo ""
echo "=== Phase 1 local E2E: PASSED ==="
echo ""
echo "Optional testnet deploy sequence:"
echo "  ./scripts/deploy/deploy-verifier.sh"
echo "  ./scripts/deploy/deploy-compliance.sh"
echo "  ./scripts/deploy/setup-sac.sh"
echo "  ./scripts/deploy/publish-roots.sh"
echo ""
echo "SAC bypass caveat: direct SAC transfers can bypass Amoeba unless issuer"
echo "authorization is configured. The demo proves a compliant transfer rail."
