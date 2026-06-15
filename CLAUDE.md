# Amoeba

ZK compliance infrastructure for Stellar stablecoins and RWAs. Groth16 proofs verified in Soroban contracts.

## Architecture

- **circuits/circom/** — BN254 Groth16 circuit with Poseidon2, 7 compliance checks, 17 public inputs
- **contracts/** — Soroban smart contracts (verifier, compliance, mock-sac)
- **scripts/** — deploy, dev, fixture, and ceremony tooling
- **crates/** — Rust crates for off-chain crypto, types, and issuer service
- **sdk/** — TypeScript SDK (scaffold)
- **frontend/** — UI (scaffold)

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm compile:circuit` | Compile Circom circuit |
| `pnpm setup:circuit` | One-person trusted setup |
| `pnpm gen:fixtures` | Generate witness fixtures |
| `pnpm prove` | Generate proof from input |
| `pnpm verify` | Snarkjs local verification |
| `pnpm test:circuit` | Node circuit tests |
| `cargo test -p verifier -p compliance -p mock-sac` | Contract unit tests |
| `./scripts/dev/demo-e2e.sh` | Full local E2E pipeline |
| `./scripts/dev/verify-testnet.sh` | Phase 0 gate check |
| `./scripts/dev/verify-compliance-testnet.sh` | Phase 1 testnet gate |

## Conventions

- Rust: `#![no_std]`, Soroban SDK 25.1.0, release profile with LTO
- Circom: BN254, Poseidon2 t=4, 20-level Merkle/SMT depth
- Tests: Rust doc tests + snapshot tests, Node .test.ts, shell fixture validation
- Git: meaningful commits, no build artifacts committed
- Contracts: admin-guarded, pausable, event-emitting
