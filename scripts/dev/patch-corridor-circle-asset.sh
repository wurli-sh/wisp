#!/usr/bin/env bash
# PATCH issuer corridor asset_hex to Circle USDC (Supabase or in-memory via issuer API).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
FIXTURE="${ROOT}/bindings/fixtures/demo-transfer-testnet.json"
CORRIDOR_ID="${CORRIDOR_ID:-1}"
TOKEN="${ISSUER_API_TOKEN:-demo-token}"

log_patch() {
  echo "[patch-corridor] $*"
}

if [[ ! -f "${FIXTURE}" ]]; then
  echo "ERROR: missing ${FIXTURE} — run gen-testnet-fixture.ts first" >&2
  exit 1
fi

ASSET_HEX="$(jq -r '.asset_hex' "${FIXTURE}")"
if [[ -z "${ASSET_HEX}" || "${ASSET_HEX}" == "null" ]]; then
  echo "ERROR: asset_hex missing in fixture" >&2
  exit 1
fi

if ! curl -sf "http://${ADDR}/health" >/dev/null 2>&1; then
  echo "ERROR: issuer-service not running on ${ADDR}" >&2
  exit 1
fi

log_patch "corridor=${CORRIDOR_ID} asset_hex=${ASSET_HEX}"
echo "PATCH corridor ${CORRIDOR_ID} asset_hex=${ASSET_HEX}"
RESP="$(curl -sf -X PATCH "http://${ADDR}/v1/admin/corridors/${CORRIDOR_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"asset_hex\":\"${ASSET_HEX}\"}")"
echo "${RESP}"
log_patch "ok"
echo "Corridor asset updated to Circle USDC SAC bytes"
