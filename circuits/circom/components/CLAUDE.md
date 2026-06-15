# circuits/circom/components

Circom circuit templates used by `compliance_corridor.circom`.

## Templates

| File | Purpose |
|------|---------|
| `poseidon2.circom` | Poseidon2 permutation + hash wrappers (Hash1, Hash2, Hash10, Hash11), BN254 t=4, 64 rounds |
| `merkle.circom` | Merkle path proof, depth 20, Poseidon2Hash2 |
| `smt.circom` | Sparse Merkle Tree exclusion proof |
| `constants.circom` | Poseidon2 diagonal + round constants (64x4) |
