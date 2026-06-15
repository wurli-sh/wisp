# packages/amoeba-crypto

Shared JS implementation of Amoeba cryptographic primitives — consumed by both circuit scripts and bindings.

## Modules

| Module | Description |
|--------|-------------|
| `field.mjs` | BN254 scalar field via ffjavascript |
| `poseidon2.mjs` | Poseidon2 t=4 permutation, hash1/hash2/hash10/hash11 |
| `merkle.mjs` | Merkle root, path derivation, zero hashes, SMT sanctions path |
| `protocol.mjs` | Domain tags, corridor config hash, nullifier, address-to-limbs |
| `witness.mjs` | `buildWitnessInput`, `proofPackageToWitnessInput`, demo fixture assembly |
| `strkey.mjs` | Stellar StrKey decode (G/A/M addresses to raw bytes) |
| `index.mjs` | Unified re-exports |