#!/usr/bin/env bash
# Verify Circle testnet USDC trustlines + sender balance for demo settle.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
CIRCLE_JSON="${ROOT}/bindings/fixtures/circle-testnet-usdc.json"
FIXTURE="${ROOT}/bindings/fixtures/demo-transfer-testnet.json"
DEPLOY_DIR="${ROOT}/.amoeba"

if [[ ! -f "${CIRCLE_JSON}" ]]; then
  echo "ERROR: missing ${CIRCLE_JSON}" >&2
  exit 1
fi

USDC_ISSUER="$(jq -r '.usdc_issuer' "${CIRCLE_JSON}")"
USDC_SAC_ID="$(jq -r '.sac_contract_id' "${CIRCLE_JSON}")"
SAC_DECIMALS="$(jq -r '.sac_decimals' "${CIRCLE_JSON}")"

# shellcheck disable=SC1091
[[ -f "${DEPLOY_DIR}/sac.env" ]] && source "${DEPLOY_DIR}/sac.env"
# shellcheck disable=SC1091
[[ -f "${DEPLOY_DIR}/testnet-demo.env" ]] && source "${DEPLOY_DIR}/testnet-demo.env"

USDC_SAC_ID="${SAC_CONTRACT_ID:-${ASSET_ID:-${USDC_SAC_ID}}}"
SENDER_IDENTITY="${SENDER_IDENTITY:-amoeba-sender}"
RECIPIENT_IDENTITY="${RECIPIENT_IDENTITY:-amoeba-recipient}"

MIN_AMOUNT="10000000"
if [[ -f "${FIXTURE}" ]]; then
  MIN_AMOUNT="$(jq -r '.amount // "10000000"' "${FIXTURE}")"
fi

if ! command -v stellar >/dev/null 2>&1; then
  echo "ERROR: stellar CLI not found" >&2
  exit 1
fi

export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

sender_addr() {
  if [[ -n "${SENDER_PUBLIC_KEY:-}" ]]; then
    echo "${SENDER_PUBLIC_KEY}"
  else
    stellar keys public-key "${SENDER_IDENTITY}"
  fi
}

recipient_addr() {
  if [[ -n "${RECIPIENT_PUBLIC_KEY:-}" ]]; then
    echo "${RECIPIENT_PUBLIC_KEY}"
  else
    stellar keys public-key "${RECIPIENT_IDENTITY}"
  fi
}

SENDER_ADDR="$(sender_addr)"
RECIPIENT_ADDR="$(recipient_addr)"

echo "=== Circle testnet USDC funding check ==="
echo "SAC:     ${USDC_SAC_ID}"
echo "Sender:  ${SENDER_ADDR}"
echo "Need:    ${MIN_AMOUNT} (SAC units, ${SAC_DECIMALS} decimals)"

echo "Ensuring Circle USDC trustlines..."
"${ROOT}/scripts/deploy/ensure-circle-usdc-trustlines.sh" \
  "${SENDER_IDENTITY}" "${RECIPIENT_IDENTITY}"

BALANCE="$(stellar contract invoke \
  --id "${USDC_SAC_ID}" \
  --source-account "${SENDER_IDENTITY}" \
  --network "${NETWORK}" \
  --send=no \
  -- balance \
  --id "${SENDER_ADDR}" 2>/dev/null | tr -d '"' || echo "0")"

echo "Sender SAC balance: ${BALANCE}"

if [[ "${BALANCE}" =~ ^-?[0-9]+$ ]] && [[ "${BALANCE}" -ge "${MIN_AMOUNT}" ]]; then
  echo "PASS: sender has enough USDC for demo transfer"
  exit 0
fi

echo ""
echo "FAIL: sender balance ${BALANCE} < required ${MIN_AMOUNT}"
echo ""
echo "Fund ${SENDER_ADDR} with Circle testnet USDC:"
echo "  Freighter → add USDC (circle.com / issuer GBBD47…)"
echo "  faucet.circle.com → USDC → Stellar Testnet"
echo "Default fixture amount ${MIN_AMOUNT} ≈ 1.0 USDC on SAC (${SAC_DECIMALS} decimals); UI may show 10.00."
echo ""
echo "Circle trustline guide:"
echo "  https://developers.circle.com/stablecoins/quickstart-setup-usdc-trustline-stellar"
exit 1
