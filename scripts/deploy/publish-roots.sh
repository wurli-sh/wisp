#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
FIXTURE="${FIXTURE:-${ROOT}/circuits/circom/inputs/valid.us-mx.json}"
DEPLOY_DIR="${ROOT}/.amoeba"

if [[ -f "$DEPLOY_DIR/compliance.env" ]]; then
  # shellcheck disable=SC1091
  source "$DEPLOY_DIR/compliance.env"
fi

if [[ -z "${COMPLIANCE_ID:-}" ]]; then
  echo "ERROR: COMPLIANCE_ID not set. Run deploy-compliance.sh first."
  exit 1
fi

if [[ ! -f "$FIXTURE" ]]; then
  echo "ERROR: fixture not found: $FIXTURE"
  exit 1
fi

read_field() {
  python3 - "$1" "$FIXTURE" <<'PY'
import json, sys
field = sys.argv[1]
with open(sys.argv[2]) as f:
    data = json.load(f)
print(data[field])
PY
}

field_hex() {
  python3 - "$1" <<'PY'
import sys

BN254_R = 21888242871839275222246405745257275088548364400416034343698204186575808495617
n = int(sys.argv[1]) % BN254_R
print(n.to_bytes(32, "big").hex())
PY
}

merkle_root=$(read_field merkle_root)
sanctions_root=$(read_field sanctions_root)
jurisdiction_root=$(read_field jurisdiction_root)
corridor_id=$(read_field corridor_id)
corridor_config_hash=$(read_field corridor_config_hash)
source_jurisdiction_root=$(read_field source_jurisdiction_root)
dest_address_root=$(read_field dest_address_root)

ISSUER="${ISSUER:-$SOURCE}"

echo "=== Publishing issuer + corridor roots ==="
echo "Compliance: ${COMPLIANCE_ID}"
echo "Issuer:     ${ISSUER}"

stellar contract invoke \
  --id "$COMPLIANCE_ID" \
  --source-account "$SOURCE" \
  --network "$NETWORK" \
  -- register_issuer \
  --issuer "$ISSUER" \
  --merkle_root "$(field_hex "$merkle_root")" \
  --sanctions_root "$(field_hex "$sanctions_root")" \
  --jurisdiction_root "$(field_hex "$jurisdiction_root")"

stellar contract invoke \
  --id "$COMPLIANCE_ID" \
  --source-account "$SOURCE" \
  --network "$NETWORK" \
  -- register_corridor \
  --corridor_id "$corridor_id" \
  --source_jurisdiction_root "$(field_hex "$source_jurisdiction_root")" \
  --dest_address_root "$(field_hex "$dest_address_root")" \
  --corridor_config_hash "$(field_hex "$corridor_config_hash")"

echo "Roots published from valid.us-mx.json"
