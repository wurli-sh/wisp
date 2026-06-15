# Amoeba

ZK compliance infrastructure for Stellar stablecoins and RWAs. Groth16 proofs verified in Soroban contracts.

## Architecture

- **circuits/circom/** — BN254 Groth16 circuit with Poseidon2, 7 compliance checks, 17 public inputs
- **contracts/** — Soroban smart contracts (verifier, compliance, mock-sac)
- **bindings/** — Canonical ABI, generated contract clients, shared JSON fixtures
- **crates/** — Rust crates for off-chain crypto, types, and issuer service
- **packages/amoeba-crypto/** — Shared JS crypto (Poseidon2, Merkle, field ops, nullifier)
- **scripts/** — deploy, dev, fixture, and ceremony tooling
- **sdk/** — TypeScript SDK (scaffold)
- **frontend/** — UI (scaffold)

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm compile:circuit` | Compile Circom circuit |
| `pnpm setup:circuit` | One-person trusted setup |
| `pnpm gen:fixtures` | Generate witness fixtures |
| `pnpm gen:bindings` | Regenerate ABI bindings from source |
| `pnpm gen:crypto-fixtures` | Regenerate crypto/address fixtures |
| `pnpm prove` | Generate proof from input |
| `pnpm verify` | Snarkjs local verification |
| `pnpm test:circuit` | Node circuit tests |
| `pnpm test:bindings` | Binding ABI + circuit-abi drift tests |
| `cargo test -p verifier -p compliance -p mock-sac` | Contract unit tests |
| `cargo test -p amoeba-crypto -p amoeba-types -p issuer-service` | Phase 2 crate tests |
| `./scripts/dev/demo-e2e.sh` | Full local E2E pipeline |
| `./scripts/dev/demo-phase2.sh` | Full Phase 2 pipeline (bindings + issuer) |
| `./scripts/dev/verify-testnet.sh` | Phase 0 gate check |
| `./scripts/dev/verify-compliance-testnet.sh` | Phase 1 testnet gate |

## Conventions

- Rust: `#![no_std]`, Soroban SDK 25.1.0, release profile with LTO
- Circom: BN254, Poseidon2 t=4, 20-level Merkle/SMT depth
- Tests: Rust doc tests + snapshot tests, Node .test.ts, shell fixture validation
- Git: meaningful commits, no build artifacts committed
- Contracts: admin-guarded, pausable, event-emitting
- Bindings: ABI frozen in `bindings/public-inputs.json`, drift-checked in CI
