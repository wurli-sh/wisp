# Amoeba

ZK compliance infrastructure for Stellar stablecoins and RWAs.

## Prerequisites

- Rust 1.94+
- Node 25+
- stellar CLI 25+
- circom 2.2.3
- snarkjs 0.7+

## Quick Start

```bash
# Install deps
pnpm install

# Build contracts
stellar contract build
```

## Phase 0 — Gate Check

A minimal Groth16 proof must verify in a Soroban contract before Phase 1 begins.

See `scripts/dev/verify-testnet.sh` for the gate sequence.
