#!/usr/bin/env bash
# Print the first event ledger for a compliance contract (COMPLIANCE_DEPLOY_LEDGER).
set -euo pipefail

COMPLIANCE_ID="${1:-}"
if [[ -z "${COMPLIANCE_ID}" ]]; then
  echo "usage: compliance-deploy-ledger.sh <COMPLIANCE_CONTRACT_ID>" >&2
  exit 1
fi

RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
SCAN_LEDGERS="${COMPLIANCE_EVENT_SCAN_LEDGERS:-10000}"

latest="$(curl -sf "${RPC_URL}" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' | jq -r '.result.sequence')"
start=$((latest - SCAN_LEDGERS))
if [[ "${start}" -lt 1 ]]; then start=1; fi

events="$(curl -sf "${RPC_URL}" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg id "$COMPLIANCE_ID" --argjson start "$start" \
    '{jsonrpc:"2.0",id:1,method:"getEvents",params:{startLedger:$start,filters:[{type:"contract",contractIds:[$id]}],limit:200}}')")"

count="$(echo "${events}" | jq '.result.events | length')"
if [[ "${count}" == "0" ]]; then
  echo "no events for ${COMPLIANCE_ID} since ledger ${start}" >&2
  exit 1
fi

echo "${events}" | jq '[.result.events[].ledger] | min'
