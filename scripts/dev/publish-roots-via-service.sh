#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADDR="${ISSUER_LISTEN_ADDR:-127.0.0.1:3000}"
TOKEN="${ISSUER_API_TOKEN:?ISSUER_API_TOKEN required}"

curl -sf -X POST "http://${ADDR}/v1/roots/publish" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"

echo ""
echo "Roots published via issuer-service"
