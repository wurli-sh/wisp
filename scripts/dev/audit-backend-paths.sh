#!/usr/bin/env bash
# Fail if backend Rust crates use stale ../../bindings paths (need ../../../bindings).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Match stale ../../bindings only — not ../../../ or deeper.
BAD=$(rg -n '\.\./\.\./bindings' "$ROOT/backend" --glob '*.rs' \
  | grep -vE '\.\./\.\./\.\./' || true)

if [[ -n "$BAD" ]]; then
  echo "ERROR: backend/ must use ../../../bindings, not ../../bindings:"
  echo "$BAD"
  exit 1
fi

echo "backend/ bindings paths OK"
