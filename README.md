# Amoeba

ZK compliance infrastructure for Stellar stablecoins and RWAs.

## Prerequisites

- Rust 1.94+
- Node 25+
- stellar CLI 25+
- circom 2.2.3
- snarkjs 0.7+
- soroban-verifier-gen (`cargo install soroban-verifier-gen`)

## Quick Start

```bash
pnpm install
stellar contract build
```

## Phase 0 — Gate Check

A minimal Groth16 proof must verify in a Soroban contract before Phase 1 begins.

```bash
./scripts/dev/verify-testnet.sh
```

## Phase 1 — ZK + Contracts

End-to-end path: Circom proof → Soroban verifier → compliance contract → SAC transfer.

### Local command sequence

```bash
# Full local pipeline (compile, prove, verify, contract tests)
./scripts/dev/demo-e2e.sh
```

Or step by step:

```bash
cd circuits/circom
node scripts/gen-fixture.mjs          # valid + invalid witness inputs
./scripts/compile.sh
./scripts/setup.sh                    # local/testnet-only one-person setup (POWER=17)
./scripts/prove.sh inputs/valid.us-mx.json
./scripts/verify-local.sh
./scripts/export-vk.sh                # exports VK + regenerates contracts/verifier

cd ../..
cargo test -p verifier -p compliance
stellar contract build
```

### Public inputs (17 fields)

| Index | Field |
|------:|-------|
| 0 | merkle_root |
| 1 | nullifier |
| 2–3 | asset_lo, asset_hi |
| 4–5 | sender_lo, sender_hi |
| 6 | epoch |
| 7–8 | recipient_lo, recipient_hi |
| 9 | amount |
| 10 | sanctions_root |
| 11 | jurisdiction_root |
| 12 | timestamp (= epoch × 86400) |
| 13 | corridor_id |
| 14 | corridor_config_hash |
| 15 | source_jurisdiction_root |
| 16 | dest_address_root |

Address limbs: `hi = bytes[0..16]`, `lo = bytes[16..32]` as big-endian field elements.

### snarkjs → Soroban proof encoding

G1 points use 32-byte big-endian `x || y` (no ark serialization flags). G2 uses `x_c1 || x_c0 || y_c1 || y_c0` per snarkjs `pi_b` rows. The verifier negates `pi_a` internally.

### Testnet deploy (optional)

Requires funded `amoeba-admin` identity on testnet:

```bash
export NETWORK=testnet
export SOURCE=amoeba-admin
./scripts/deploy/deploy-verifier.sh
./scripts/deploy/deploy-compliance.sh
./scripts/deploy/setup-sac.sh
./scripts/deploy/publish-roots.sh

# On-chain compliance proof verification
./scripts/dev/verify-compliance-testnet.sh
```

Deployed contract IDs are written to `.amoeba/*.env` (current compliance verifier on testnet: check `.amoeba/verifier.env`).

### SAC bypass caveat

Direct SAC transfers can bypass Amoeba unless issuer authorization is configured. The MVP demo proves a **compliant transfer rail**; production hardening uses issuer-controlled authorization settings.

### Mainnet ceremony gate

`circuits/circom/scripts/setup.sh` is not a mainnet ceremony. A guarded mainnet pilot using the current Groth16 circuit requires a completed and published multi-party phase 2 ceremony. See `CEREMONY_RUNBOOK.md` and the `ceremony:*` scripts.

### Launch runbooks

- `TESTNET_RUNBOOK.md` — full testnet deploy and verification flow.
- `CEREMONY_RUNBOOK.md` — multi-party Groth16 phase 2 ceremony.
- `MAINNET_BLOCKERS.md` — hard gates before mainnet.
- `MAINNET_RUNBOOK.md` — guarded mainnet pilot procedure.
