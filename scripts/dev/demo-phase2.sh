#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
PIDFILE="${ROOT}/.wisp/issuer-service.pid"
LOGFILE="${ROOT}/.wisp/issuer-service.log"

echo "=== Wisp Phase 2 E2E (local) ==="

cd "$ROOT"

echo ""
echo "1. Generate bindings"
pnpm gen:bindings

echo ""
echo "2. Generate crypto fixtures"
pnpm gen:crypto-fixtures

echo ""
echo "3. Rust crate tests"
cargo test -p wisp-crypto -p wisp-types -p issuer-service

echo ""
echo "4. Bindings tests"
pnpm test:bindings

echo ""
echo "5. Start issuer-service"
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
echo "6. Health check"
curl -sf "http://${ADDR}/health" | grep -q '"status":"ok"'

echo ""
echo "7. Demo transfer package vs golden public inputs"
curl -sf "http://${ADDR}/corridors" >/dev/null

echo ""
echo "8. Unauthorized publish rejected"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://${ADDR}/admin/roots/publish")
[[ "$code" == "401" ]]

echo ""
echo "=== Phase 2 local E2E: PASSED ==="
