# Wisp Bindings

Canonical ABI and encoding rules for the compliance corridor Groth16 circuit.

## Published packages

```bash
npm install @wisp_/bindings@0.2.0
npm install @wisp_/compliance@0.2.0
npm install @wisp_/verifier@0.2.0
```

| Package | Purpose |
| ------- | ------- |
| `@wisp_/bindings` | Canonical proof package schema + public input helpers |
| `@wisp_/compliance` | Generated Soroban client for the compliance contract |
| `@wisp_/verifier` | Generated Soroban client for the verifier contract |

`@wisp_/bindings` is exposed via subpaths:

```ts
import type { ProofPackage } from "@wisp_/bindings/proofPackage";
import { PUBLIC_INPUTS } from "@wisp_/bindings/publicInputs";
```

## Public inputs (17 fields)

Field order is defined in [`public-inputs.json`](public-inputs.json) and generated into:

- `generated/publicInputs.ts` (TypeScript)
- `generated/public_inputs.rs` (Rust)

Run `pnpm gen:bindings` after editing the JSON sources.

## Encoding rules

### Address limbs

Stellar `Address` payloads are 32 bytes:

- `hi = bytes[0..16]` as big-endian field element
- `lo = bytes[16..32]` as big-endian field element

### Timestamp

`timestamp = epoch × EPOCH_LEN_SECS` (86400)

### Field decimal normalization

BN254 field elements may appear as negative decimal strings in Circom fixtures and positive decimals in snarkjs output. Compare cross-layer using `mod BN254_R`, not raw string equality.

### Groth16 proof (Soroban)

G1: 32-byte big-endian `x || y`. G2: `x_c1 || x_c0 || y_c1 || y_c0` per snarkjs `pi_b` rows. Verifier negates `pi_a` internally.

### Domain-separated hashes

See `@wisp_/js` (`computeNullifier`, `computeCorridorConfigHash`).

## Fixtures

| File | Purpose |
|------|---------|
| `fixtures/demo-transfer.json` | Demo identity bytes and transfer params |
| `fixtures/demo-users.json` | Mock credentials and corridors |
| `fixtures/public-inputs.valid.json` | Golden public inputs (snarkjs-normalized) |
| `fixtures/crypto.json` | Generated crypto test vectors (`pnpm gen:crypto-fixtures`) |
| `fixtures/addresses.json` | G-address and C-contract limb encoding samples |

## Trust boundary (issuer service)

The issuer service maintains demo Merkle trees and publishes roots. Settlement still verifies proofs, roots, corridor config, and bindings on-chain.
