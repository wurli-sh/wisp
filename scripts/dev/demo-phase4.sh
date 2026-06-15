#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
PIDFILE="${ROOT}/.amoeba/issuer-service.pid"
LOGFILE="${ROOT}/.amoeba/issuer-service.log"
ARTIFACTS="${ROOT}/circuits/circom/artifacts"
PUBLIC_CIRCUITS="${ROOT}/frontend/public/circuits"
PUBLIC_FIXTURES="${ROOT}/frontend/public/fixtures"

echo "=== Amoeba Phase 4 Frontend Gate ==="
cd "$ROOT"

echo ""
echo "1. Copy circuit artifacts to frontend/public (if missing)"
mkdir -p "$PUBLIC_CIRCUITS" "$PUBLIC_FIXTURES"

WASM_SRC="${ARTIFACTS}/compliance_corridor_js/compliance_corridor.wasm"
ZKEY_SRC="${ARTIFACTS}/compliance_corridor_final.zkey"
WASM_DST="${PUBLIC_CIRCUITS}/compliance_corridor.wasm"
ZKEY_DST="${PUBLIC_CIRCUITS}/compliance_corridor_final.zkey"

if [[ ! -f "$WASM_DST" ]]; then
  if [[ -f "$WASM_SRC" ]]; then
    cp "$WASM_SRC" "$WASM_DST"
    echo "  copied wasm"
  else
    echo "  WARN: wasm missing at $WASM_SRC — run pnpm setup:circuit first for browser prove"
  fi
fi

if [[ ! -f "$ZKEY_DST" ]]; then
  if [[ -f "$ZKEY_SRC" ]]; then
    cp "$ZKEY_SRC" "$ZKEY_DST"
    echo "  copied zkey"
  else
    echo "  WARN: zkey missing at $ZKEY_SRC — run pnpm setup:circuit first for browser prove"
  fi
fi

if [[ ! -f "${PUBLIC_FIXTURES}/demo-transfer-testnet.json" ]]; then
  if [[ -f "${ROOT}/bindings/fixtures/demo-transfer-testnet.json" ]]; then
    cp "${ROOT}/bindings/fixtures/demo-transfer-testnet.json" "${PUBLIC_FIXTURES}/"
    echo "  copied demo-transfer-testnet fixture"
  fi
fi

echo ""
echo "2. Build JS packages (@amoeba/js + @amoeba/sdk)"
pnpm build:js

echo ""
echo "3. Optional: start issuer-service"
START_ISSUER="${AMOEBA_START_ISSUER:-0}"
if [[ "$START_ISSUER" == "1" ]]; then
  mkdir -p "${ROOT}/.amoeba"
  export ISSUER_STATE_PATH="${ISSUER_STATE_PATH:-${ROOT}/.amoeba/issuer-state.json}"
  export ISSUER_API_TOKEN="${ISSUER_API_TOKEN:-demo-token}"
  export AMOEBA_FIXTURES_DIR="${ROOT}/bindings/fixtures"

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
echo "=== Phase 4 frontend gate: PASSED ==="
echo ""
echo "Dev server:"
echo "  pnpm dev:frontend"
echo ""
echo "With issuer (demo prove package fetch):"
echo "  AMOEBA_START_ISSUER=1 ./scripts/dev/demo-phase4.sh && pnpm dev:frontend"
