#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
PIDFILE="${ROOT}/.wisp/issuer-service.pid"
LOGFILE="${ROOT}/.wisp/issuer-service.log"

echo "=== Wisp Phase 3 E2E (local) ==="
cd "$ROOT"

echo ""
echo "1. Blocker gate (local)"
./scripts/dev/verify-phase3-blockers.sh

echo ""
echo "2. Build JS packages"
pnpm build:js

echo ""
echo "3. Start issuer-service"
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
sleep 4

cleanup() {
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
}
trap cleanup EXIT

echo ""
echo "4. SDK tests (prove + golden public inputs)"
pnpm test:sdk

echo ""
echo "=== Phase 3 local E2E: PASSED ==="
echo ""
echo "Testnet settlement:"
echo "  ./scripts/dev/bootstrap-testnet-demo.sh   # once"
echo "  ./scripts/dev/verify-phase3-testnet.sh"
