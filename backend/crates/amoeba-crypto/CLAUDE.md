# backend/crates/amoeba-crypto

Off-chain cryptographic utilities — Rust port of Poseidon2 (t=4, BN254), field arithmetic, Merkle tree helpers, nullifier computation, and protocol constants.

## Modules

| Module | Description |
|--------|-------------|
| `field` | BN254 scalar field ops via ark-bn254 |
| `poseidon2` | Poseidon2 permutation with 64 rounds (4 external + 56 partial + 4 external) |
| `merkle` | Merkle path, root computation, zero hashes, SMT sanctions path |
| `protocol` | Domain tags, corridor config hash, nullifier computation |
| `lib` | Re-exports and convenience wrappers |
