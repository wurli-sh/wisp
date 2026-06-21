#!/usr/bin/env bash
# Seed testnet demo sender + corridor destinations in issuer-service.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
FIXTURE="${ROOT}/bindings/fixtures/demo-transfer-testnet.json"
DEST_FIXTURE="${ROOT}/bindings/fixtures/demo-destinations-testnet.json"
TOKEN="${ISSUER_API_TOKEN:-demo-token}"

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
CORRIDOR_ID="$(read_fixture corridor_id)"

curl -sf -X POST "http://${ADDR}/v1/provider/webhooks/fixture" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: ${FIXTURE_WEBHOOK_SECRET:-demo-fixture-secret}" \
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
)" >/dev/null

if [[ -f "${DEST_FIXTURE}" ]]; then
  python3 - "${DEST_FIXTURE}" "${ADDR}" "${TOKEN}" <<'PY'
import json, sys, urllib.request

path, addr, token = sys.argv[1:4]
with open(path) as f:
    data = json.load(f)
corridor_id = data["corridor_id"]
for address in data.get("addresses", []):
    body = json.dumps({"address": address, "enabled": True}).encode()
    req = urllib.request.Request(
        f"http://{addr}/v1/admin/corridors/{corridor_id}/destinations",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as res:
            res.read()
        print(f"[seed] destination ok {address[:8]}…")
    except urllib.error.HTTPError as err:
        text = err.read().decode()
        if err.code == 400 and "already" in text.lower():
            print(f"[seed] destination exists {address[:8]}…")
        else:
            raise
PY
fi

echo "[seed] ok sender + destinations corridor=${CORRIDOR_ID}"

if [[ -n "${COMPLIANCE_CONTRACT_ID:-${COMPLIANCE_ID:-}}" ]]; then
  RESP="$(curl -sf -X POST "http://${ADDR}/v1/admin/roots/publish" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"corridor_id\": ${CORRIDOR_ID}}")"
  if command -v jq >/dev/null 2>&1; then
    STATUS="$(echo "${RESP}" | jq -r '.results[0].status // empty')"
    echo "[seed] roots publish ${STATUS:-ok}"
  else
    echo "[seed] roots published"
  fi
fi
