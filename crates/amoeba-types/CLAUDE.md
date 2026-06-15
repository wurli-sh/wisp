# crates/amoeba-types

Shared type definitions shared across the Amoeba Rust ecosystem.

## Types

| Type | Description |
|------|-------------|
| `PublicInputs` | 17-field Groth16 public input struct with serde + default |
| `ProofPackage` | Full transfer package: proof, public inputs, identity metadata |
| `VerificationKey` | Groth16 VK struct matching snarkjs output format |
