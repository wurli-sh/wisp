#!/usr/bin/env bash
set -euo pipefail

# Pin Circle testnet USDC SAC for compliant_transfer demos on testnet.
exec "$(cd "$(dirname "$0")" && pwd)/setup-circle-usdc-testnet.sh" "$@"
