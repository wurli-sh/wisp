#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR/artifacts"

if [[ "${MAINNET:-}" == "1" || "${NETWORK:-}" == "mainnet" ]]; then
  echo "ERROR: setup.sh is a one-person dev/testnet setup path."
  echo "Use scripts/ceremony-*.sh for a multi-party ceremony before mainnet."
  exit 1
fi

echo "WARNING: setup.sh is for local/testnet development only."
echo "For guarded mainnet approval, use the multi-party ceremony scripts."

POWER=17
POW2=$((1 << POWER))
PTAU_FINAL="pot${POWER}_final.ptau"

if [ ! -f "$PTAU_FINAL" ]; then
  echo "=== Step 1/5: Powers of Tau (power=$POWER, 2^$POWER=$POW2) ==="
  snarkjs powersoftau new bn128 "$POWER" pot"${POWER}"_0000.ptau -v

  echo "=== Step 2/5: Contribute to Powers of Tau ==="
  snarkjs powersoftau contribute pot"${POWER}"_0000.ptau pot"${POWER}"_0001.ptau \
    --name="wisp contribution" -v -e="$(date +%s%N)"

  echo "=== Step 3/5: Prepare Phase 2 ==="
  snarkjs powersoftau prepare phase2 pot"${POWER}"_0001.ptau "$PTAU_FINAL" -v
else
  echo "=== Reusing existing $PTAU_FINAL ==="
fi

echo "=== Step 4/5: Groth16 Setup (Phase 2 zkey) ==="
snarkjs groth16 setup compliance_corridor.r1cs "$PTAU_FINAL" compliance_corridor_0000.zkey

echo "=== Step 5/5: Contribute to zkey ==="
snarkjs zkey contribute compliance_corridor_0000.zkey compliance_corridor_final.zkey \
  --name="wisp phase2" -v -e="$(date +%s%N)"

echo "=== Done ==="
ls -lh compliance_corridor_final.zkey
