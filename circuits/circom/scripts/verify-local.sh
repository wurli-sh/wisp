#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR/artifacts"
snarkjs groth16 verify verification_key.json public.json proof.json
