#!/usr/bin/env bash
set -euo pipefail

# Deploy mock SAC for compliant_transfer demos on testnet.
exec "$(cd "$(dirname "$0")" && pwd)/deploy-mock-sac.sh" "$@"
