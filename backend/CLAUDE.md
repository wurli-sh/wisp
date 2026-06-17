# backend

Single Rust workspace root for Soroban programs and off-chain crates.

## Layout

| Path | Purpose |
|------|---------|
| `programs/verifier` | On-chain Groth16 BN254 verifier |
| `programs/compliance` | Compliant transfer orchestration |
| `crates/amoeba-crypto` | Off-chain Poseidon2, Merkle, nullifier (Rust) |
| `crates/amoeba-types` | Shared types + generated public inputs |
| `crates/issuer-service` | Axum issuer HTTP service |

Workspace members are listed in root [`Cargo.toml`](../Cargo.toml).
