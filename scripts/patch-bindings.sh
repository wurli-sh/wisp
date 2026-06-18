#!/usr/bin/env bash
# Re-apply Amoeba-specific fixes after `soroban contract bindings ts` overwrites clients.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for pkg in compliance verifier; do
  src="$ROOT/bindings/generated/$pkg/src/index.ts"
  if [[ ! -f "$src" ]]; then
    echo "skip: $src not found"
    continue
  fi
  sed -i '/^export \* from "@stellar\/stellar-sdk";$/d' "$src"
  echo "patched $src"
done

pnpm --filter @amoeba_/compliance --filter @amoeba_/verifier run build
