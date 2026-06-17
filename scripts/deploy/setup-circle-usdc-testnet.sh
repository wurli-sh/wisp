#!/usr/bin/env bash
# Circle testnet USDC: trustline helper + pinned SAC env for Amoeba demo.
# Usage: ./scripts/deploy/setup-circle-usdc-testnet.sh [--all-demo-accounts] [sender_identity]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
CIRCLE_JSON="${ROOT}/bindings/fixtures/circle-testnet-usdc.json"
DEPLOY_DIR="${ROOT}/.amoeba"
ALL_DEMO=0
SENDER_IDENTITY="${SENDER_IDENTITY:-amoeba-sender}"

for arg in "$@"; do
  case "$arg" in
    --all-demo-accounts) ALL_DEMO=1 ;;
    -*) echo "Unknown option: $arg" >&2; exit 1 ;;
    *) SENDER_IDENTITY="$arg" ;;
  esac
done

if [[ ! -f "${CIRCLE_JSON}" ]]; then
  echo "ERROR: missing ${CIRCLE_JSON}" >&2
  exit 1
fi

USDC_ISSUER="$(jq -r '.usdc_issuer' "${CIRCLE_JSON}")"
USDC_SAC_ID="$(jq -r '.sac_contract_id' "${CIRCLE_JSON}")"

echo "=== Circle testnet USDC setup ==="
echo "Issuer: ${USDC_ISSUER}"
echo "SAC:    ${USDC_SAC_ID}"
echo "Sender: ${SENDER_IDENTITY}"

if ! command -v stellar >/dev/null 2>&1; then
  echo "ERROR: stellar CLI not found" >&2
  exit 1
fi

ensure_trustline() {
  "${ROOT}/scripts/deploy/ensure-circle-usdc-trustlines.sh" "$@"
}

ensure_trustline "${SENDER_IDENTITY}"
if [[ "${ALL_DEMO}" == "1" ]]; then
  ensure_trustline "amoeba-recipient"
fi

SENDER_ADDR="$(stellar keys public-key "${SENDER_IDENTITY}")"

mkdir -p "${DEPLOY_DIR}"
{
  echo "SAC_CONTRACT_ID=${USDC_SAC_ID}"
  echo "ASSET_ID=${USDC_SAC_ID}"
  echo "USDC_ISSUER=${USDC_ISSUER}"
  echo "SENDER_IDENTITY=${SENDER_IDENTITY}"
  echo "SENDER_PUBLIC_KEY=${SENDER_ADDR}"
} | tee "${DEPLOY_DIR}/sac.env"

cat <<EOF

Pinned Circle testnet USDC SAC → ${DEPLOY_DIR}/sac.env

Next steps:
  1. ./scripts/dev/check-circle-usdc-testnet.sh  (verify sender USDC balance)
  2. Fund ${SENDER_ADDR} with testnet USDC if check fails
  3. Run ./scripts/dev/gen-testnet-fixture.ts to refresh demo-transfer-testnet.json
  4. ./scripts/dev/bru.sh && pnpm dev:frontend

Circle quickstart: https://developers.circle.com/stablecoins/quickstart-setup-usdc-trustline-stellar
EOF
