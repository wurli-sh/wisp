#!/usr/bin/env bash
# Publish @amoeba_/* packages to npm in dependency order.
# Full runbook: scripts/publish/CLAUDE.md
# Prerequisites: npm login or granular token, @amoeba_ org access, Node 25 (see .nvmrc).
# Optional: NPM_OTP=123456 for 2FA auth-and-writes accounts.
# Usage: ./scripts/publish/publish-packages.sh [--dry-run]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DRY_RUN=()
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=(--dry-run)
fi

OTP_ARGS=()
if [[ -n "${NPM_OTP:-}" ]]; then
  OTP_ARGS=(--otp "$NPM_OTP")
fi

echo "Building all publishable packages…"
pnpm build:js

PACKAGES=(
  "@amoeba_/js"
  "@amoeba_/compliance"
  "@amoeba_/verifier"
  "@amoeba_/bindings"
  "@amoeba_/sdk"
  "@amoeba_/issuer-sdk"
)

for pkg in "${PACKAGES[@]}"; do
  echo ""
  echo "Publishing ${pkg}…"
  pnpm --filter "${pkg}" publish --access public --no-git-checks "${OTP_ARGS[@]}" "${DRY_RUN[@]}"
done

echo ""
echo "All packages published."
