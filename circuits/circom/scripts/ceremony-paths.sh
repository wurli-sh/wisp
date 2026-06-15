#!/usr/bin/env bash
# Shared ceremony artifact paths. Source from other ceremony scripts after setting DIR/ARTIFACTS.
CEREMONY_DIR="${CEREMONY_DIR:-$ARTIFACTS/ceremony}"
CEREMONY_MANIFEST="${CEREMONY_MANIFEST:-$CEREMONY_DIR/manifest.json}"
FINAL_ZKEY="${CEREMONY_FINAL_ZKEY:-$CEREMONY_DIR/compliance_corridor_final.zkey}"
VK_JSON="${CEREMONY_VK_JSON:-$CEREMONY_DIR/verification_key.json}"
VK_HASH_TXT="${CEREMONY_VK_HASH_TXT:-$CEREMONY_DIR/vk_hash.txt}"
TRANSCRIPT="${TRANSCRIPT:-$CEREMONY_DIR/transcript.jsonl}"
FINAL_ZKEY_BASENAME="$(basename "$FINAL_ZKEY")"
VK_JSON_BASENAME="$(basename "$VK_JSON")"
VK_HASH_BASENAME="$(basename "$VK_HASH_TXT")"
TRANSCRIPT_BASENAME="$(basename "$TRANSCRIPT")"
