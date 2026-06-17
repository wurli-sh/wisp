#!/usr/bin/env bash
# Seed testnet demo sender (and corridor destination) in issuer-service via fixture webhook.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
FIXTURE="${ROOT}/bindings/fixtures/demo-transfer-testnet.json"
WEBHOOK_SECRET="${FIXTURE_WEBHOOK_SECRET:-demo-fixture-secret}"

if [[ ! -f "${FIXTURE}" ]]; then
  echo "missing fixture: ${FIXTURE}" >&2
  exit 1
fi

read_fixture() {
  python3 - "$1" "$FIXTURE" <<'PY'
import json, sys
field = sys.argv[1]
with open(sys.argv[2]) as f:
    data = json.load(f)
print(data[field])
PY
}

SENDER_HEX="$(read_fixture sender_hex)"
RECIPIENT_HEX="$(read_fixture recipient_hex)"
CORRIDOR_ID="$(read_fixture corridor_id)"

curl -sf -X POST "http://${ADDR}/v1/provider/webhooks/fixture" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: ${WEBHOOK_SECRET}" \
  -d "$(python3 - <<PY
import json
print(json.dumps({
    "wallet_hex": "${SENDER_HEX}",
    "jurisdiction": "US",
    "jurisdiction_code": 840,
    "credential_expiry": 2000000000,
    "sanctions_clear": True,
    "enabled": True,
    "credential_secret": "424242",
    "corridor_eligibility": [int("${CORRIDOR_ID}")],
}))
PY
)"

echo ""
echo "Seeded testnet sender ${SENDER_HEX} (corridor ${CORRIDOR_ID})"
echo "Destination ${RECIPIENT_HEX} is ensured via issuer fixture seed on startup"
