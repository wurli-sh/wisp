#!/usr/bin/env bash
set -euo pipefail

# Fund a test SAC for compliant_transfer demos.
# Set ASSET_ID manually after creating a Stellar Asset Contract on your network.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-amoeba-admin}"
DEPLOY_DIR="${ROOT}/.amoeba"
mkdir -p "$DEPLOY_DIR"

echo "=== Setup test SAC ==="
echo "Network: ${NETWORK}"
echo ""
echo "Create a test asset with your issuer workflow, then:"
echo "  echo 'ASSET_ID=C...' >> ${DEPLOY_DIR}/sac.env"
echo ""
echo "Mint to the sender address used in your proof public inputs and ensure"
echo "the sender has authorized the compliance contract if required."
