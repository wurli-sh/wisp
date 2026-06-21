#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
PIDFILE="${ROOT}/.wisp/issuer-service.pid"
LOGFILE="${ROOT}/.wisp/issuer-service.log"
ARTIFACTS="${ROOT}/circuits/circom/artifacts"
PUBLIC_CIRCUITS="${ROOT}/frontend/public/circuits"
PUBLIC_FIXTURES="${ROOT}/frontend/public/fixtures"

echo "=== Wisp Phase 4 Frontend Gate ==="
cd "$ROOT"

echo ""
echo "1. Copy circuit artifacts to frontend/public (if missing)"
mkdir -p "$PUBLIC_CIRCUITS" "$PUBLIC_FIXTURES"

WASM_SRC="${ARTIFACTS}/compliance_corridor_js/compliance_corridor.wasm"
ZKEY_SRC="${ARTIFACTS}/compliance_corridor_final.zkey"
WASM_DST="${PUBLIC_CIRCUITS}/compliance_corridor.wasm"
ZKEY_DST="${PUBLIC_CIRCUITS}/compliance_corridor_final.zkey"

copy_if_newer() {
  local src="$1"
  local dst="$2"
  local label="$3"
  if [[ ! -f "$src" ]]; then
    echo "  WARN: ${label} missing at $src — run pnpm setup:circuit first for browser prove"
    return 0
  fi
  if [[ ! -f "$dst" ]] || [[ "$src" -nt "$dst" ]]; then
    cp "$src" "$dst"
    echo "  copied ${label}"
  else
    echo "  ${label} up to date"
  fi
}

copy_if_newer "$WASM_SRC" "$WASM_DST" "wasm"
copy_if_newer "$ZKEY_SRC" "$ZKEY_DST" "zkey"

CIRCLE_SRC="${ROOT}/bindings/fixtures/circle-testnet-usdc.json"
CIRCLE_DST="${ROOT}/frontend/src/config/circle-testnet-usdc.json"
if [[ -f "${CIRCLE_SRC}" ]]; then
  cp "${CIRCLE_SRC}" "${CIRCLE_DST}"
  echo "  synced circle-testnet-usdc.json"
fi

if [[ -f "${ROOT}/bindings/fixtures/demo-transfer-testnet.json" ]]; then
  cp "${ROOT}/bindings/fixtures/demo-transfer-testnet.json" "${PUBLIC_FIXTURES}/"
  echo "  synced demo-transfer-testnet fixture"
elif [[ ! -f "${PUBLIC_FIXTURES}/demo-transfer-testnet.json" ]]; then
  echo "  WARN: demo-transfer-testnet.json missing — run gen-testnet-fixture.ts"
fi

echo ""
echo "2. Build JS packages (@wisp_/js + @wisp_/sdk)"
pnpm build:js

echo ""
echo "3. Optional: start issuer-service"
START_ISSUER="${WISP_START_ISSUER:-${AMOEBA_START_ISSUER:-0}}"
if [[ "$START_ISSUER" == "1" ]]; then
  mkdir -p "${ROOT}/.wisp"
  export ISSUER_STATE_PATH="${ISSUER_STATE_PATH:-${ROOT}/.wisp/issuer-state.json}"
  export ISSUER_API_TOKEN="${ISSUER_API_TOKEN:-demo-token}"
  export WISP_FIXTURES_DIR="${ROOT}/bindings/fixtures"

  if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    kill "$(cat "$PIDFILE")" || true
    sleep 1
  fi

  cargo build -p issuer-service >"$LOGFILE" 2>&1
  "$ROOT/target/debug/issuer-service" >>"$LOGFILE" 2>&1 &
  echo $! >"$PIDFILE"
  sleep 3
  echo "  issuer listening on $ADDR"
fi

echo ""
echo "4. Frontend typecheck + build"
pnpm build:frontend

echo ""
echo "5. Frontend e2e (Pay Links + demo smoke)"
pnpm --filter @wisp_/web exec playwright install chromium
pnpm test:e2e:frontend

echo ""
echo "=== Phase 4 frontend gate: PASSED ==="
echo ""
echo "Dev server:"
echo "  pnpm dev:frontend"
echo ""
echo "With issuer (demo prove package fetch):"
echo "  WISP_START_ISSUER=1 ./scripts/dev/demo-phase4.sh && pnpm dev:frontend"
