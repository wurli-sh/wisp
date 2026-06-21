#!/usr/bin/env bash
# Ensure Circle testnet USDC classic trustlines for Stellar CLI identities.
# Usage: ./scripts/deploy/ensure-circle-usdc-trustlines.sh [identity...]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
CIRCLE_JSON="${ROOT}/bindings/fixtures/circle-testnet-usdc.json"
HORIZON_URL="${HORIZON_URL:-https://horizon-testnet.stellar.org}"

if [[ ! -f "${CIRCLE_JSON}" ]]; then
  echo "ERROR: missing ${CIRCLE_JSON}" >&2
  exit 1
fi

if ! command -v stellar >/dev/null 2>&1; then
  echo "ERROR: stellar CLI not found" >&2
  exit 1
fi

USDC_ISSUER="$(jq -r '.usdc_issuer' "${CIRCLE_JSON}")"
export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

has_circle_trustline() {
  local addr="$1"
  curl -sf "${HORIZON_URL}/accounts/${addr}" 2>/dev/null | jq -e --arg iss "${USDC_ISSUER}" \
    '.balances[] | select(.asset_code == "USDC" and .asset_issuer == $iss)' >/dev/null 2>&1
}

ensure_trustline() {
  local identity_or_address="$1"
  local addr source_account
  if [[ "${identity_or_address}" == G* ]]; then
    addr="${identity_or_address}"
    if [[ -n "${STELLAR_SOURCE_SECRET:-}" ]]; then
      source_account="${STELLAR_SOURCE_SECRET}"
    else
      echo "ERROR: G-address '${addr}' requires STELLAR_SOURCE_SECRET (Freighter secret) or a stellar CLI identity name" >&2
      exit 1
    fi
  else
    if ! stellar keys public-key "${identity_or_address}" >/dev/null 2>&1; then
      echo "ERROR: identity '${identity_or_address}' not found" >&2
      exit 1
    fi
    source_account="${identity_or_address}"
    addr="$(stellar keys public-key "${identity_or_address}")"
  fi
  if has_circle_trustline "${addr}"; then
    echo "  ${identity_or_address}: Circle USDC trustline OK (${addr})"
    return 0
  fi
  echo "  ${identity_or_address}: creating Circle USDC trustline (${addr})..."
  local err
  if err="$(stellar tx new change-trust \
    --source-account "${source_account}" \
    --network "${NETWORK}" \
    --line "USDC:${USDC_ISSUER}" \
    --send=yes 2>&1)"; then
    echo "  ${identity_or_address}: trustline created"
    return 0
  fi
  if has_circle_trustline "${addr}"; then
    echo "  ${identity_or_address}: trustline OK (already present)"
    return 0
  fi
  echo "ERROR: ${identity_or_address} trustline failed: ${err}" >&2
  exit 1
}

IDENTITIES=("$@")
if [[ ${#IDENTITIES[@]} -eq 0 ]]; then
  IDENTITIES=(amoeba-sender amoeba-recipient)
fi

for identity in "${IDENTITIES[@]}"; do
  ensure_trustline "${identity}"
done
