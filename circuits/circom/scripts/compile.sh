#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
circom "$DIR/compliance_corridor.circom" --r1cs --wasm --sym -o "$DIR/artifacts/"
ls -lh "$DIR/artifacts/"
