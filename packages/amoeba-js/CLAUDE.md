# packages/amoeba-js

TypeScript implementation of Amoeba cryptographic primitives (`@amoeba/js`). Compiled to `dist/` via `tsc`.

## Modules

| Module | Description |
|--------|-------------|
| `field.ts` | BN254 scalar field ops via ffjavascript |
| `poseidon2.ts` | Poseidon2 t=4 permutation, hash1/hash2/hash10/hash11 |
| `merkle.ts` | Merkle root, path derivation, zero hashes, SMT sanctions |
| `protocol.ts` | Domain tags, corridor config hash, nullifier, address-to-limbs |
| `strkey.ts` | Stellar StrKey decode (G/A/M addresses to raw bytes) |
| `witness.ts` | `buildWitnessInput`, `proofPackageToWitnessInput`, demo fixture assembly |
| `types.ts` | Shared TypeScript types (ProofPackage, PublicInputs, WitnessInput, etc.) |
| `index.ts` | Unified re-exports |
