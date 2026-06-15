#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CEREMONY_DIR="${CEREMONY_DIR:-$ROOT/circuits/circom/artifacts/ceremony}"
CEREMONY_MANIFEST="${CEREMONY_MANIFEST:-$CEREMONY_DIR/manifest.json}"
CEREMONY_FINAL_ZKEY="${CEREMONY_FINAL_ZKEY:-$CEREMONY_DIR/compliance_corridor_final.zkey}"
TRANSCRIPT="${TRANSCRIPT:-$CEREMONY_DIR/transcript.jsonl}"
VK_JSON="${CEREMONY_VK_JSON:-$CEREMONY_DIR/verification_key.json}"
VK_HASH_TXT="${CEREMONY_VK_HASH_TXT:-$CEREMONY_DIR/vk_hash.txt}"
SCRIPT_DIR="$ROOT/circuits/circom/scripts"

if [[ "${AMOEBA_MAINNET_APPROVED:-}" != "1" ]]; then
  echo "ERROR: mainnet deploy requires AMOEBA_MAINNET_APPROVED=1 after completing MAINNET_BLOCKERS.md."
  exit 1
fi

for required in "$TRANSCRIPT" "$CEREMONY_MANIFEST" "$VK_JSON" "$VK_HASH_TXT" "$CEREMONY_FINAL_ZKEY"; do
  if [[ ! -f "$required" ]]; then
    echo "ERROR: missing ceremony evidence: $required"
    echo "Complete CEREMONY_RUNBOOK.md before mainnet."
    exit 1
  fi
done

python3 "$SCRIPT_DIR/ceremony_lib.py" check-manifest-flags \
  --manifest "$CEREMONY_MANIFEST" \
  --require-published \
  --require-sync

CEREMONY_DIR="$CEREMONY_DIR" \
CEREMONY_MANIFEST="$CEREMONY_MANIFEST" \
CEREMONY_FINAL_ZKEY="$CEREMONY_FINAL_ZKEY" \
TRANSCRIPT="$TRANSCRIPT" \
  "$SCRIPT_DIR/ceremony-verify.sh"

LOCAL_VK_HASH="$(tr -d '[:space:]' < "$VK_HASH_TXT")"
export LOCAL_VK_HASH
echo "LOCAL_VK_HASH=$LOCAL_VK_HASH"
