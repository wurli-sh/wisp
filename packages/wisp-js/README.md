# @wisp_/js

Wisp cryptographic primitives — Poseidon2, Merkle trees, nullifiers, and Circom witness builder.

> Beta / demo release only. Intended for evaluation and testnet integrations; interfaces may change.

Low-level building block; most apps should use [`@wisp_/sdk`](../../sdk/README.md) for the full prove/settle flow.

## Install

```bash
npm install @wisp_/js@0.2.1
```

## Quick start

```ts
import {
  buildWitnessInput,
  proofPackageToWitnessInput,
  computeNullifier,
  merkleRootForLeafAtIndex,
} from "@wisp_/js";

// From a demo fixture or issuer proof package
const witness = proofPackageToWitnessInput(proofPackage);

// Or build from params directly
const input = buildWitnessInput(demoParams);

// Standalone primitives
const nullifier = computeNullifier({ /* … */ });
const root = merkleRootForLeafAtIndex(leaves, index);
```

## Subpath exports

```ts
import { buildWitnessInput } from "@wisp_/js/witness";
import { decodeStrKey } from "@wisp_/js/strkey";
```

## Modules

| Module | Exports |
| ------ | ------- |
| `field` | BN254 scalar field ops |
| `poseidon2` | Poseidon2 t=4 hash |
| `merkle` | Merkle root, paths, SMT sanctions |
| `protocol` | Nullifier, corridor config hash, address limbs |
| `witness` | `buildWitnessInput`, `proofPackageToWitnessInput` |
| `publicInputs` | 17-field public input helpers |
| `strkey` | Stellar address decode |

## Public inputs

17 fields in canonical order — see [`bindings/public-inputs.json`](../../bindings/public-inputs.json).

Address limbs: `hi = bytes[0..16]`, `lo = bytes[16..32]` as big-endian field elements.

Address inputs are deliberately strict: pass a checksum-valid Stellar `G...`/`C...`
StrKey or exactly 64 hexadecimal characters (an optional `0x` prefix is accepted).
Short hex, invalid checksums, and non-32-byte buffers throw instead of being padded or
truncated. Merkle indices must be within the selected tree depth and path directions
must be `0` or `1`.

## Test vectors

```bash
pnpm --filter @wisp_/js test       # vectors + malformed input + repeated-load tests
pnpm test:witness                  # from repo root
```

Fixtures: [`bindings/fixtures/`](../../bindings/fixtures/).

## Build from source

```bash
pnpm --filter @wisp_/js build
```

## Related

- Full SDK: [`@wisp_/sdk`](../../sdk/README.md)
- Protocol validation + types: [`@wisp_/core`](../wisp-core/README.md)
- Transports + chain reads: [`@wisp_/client`](../wisp-client/README.md)
- Transfer orchestration: [`@wisp_/flows`](../wisp-flows/README.md)
- ABI spec: [`bindings/README.md`](../../bindings/README.md)
- Rust crypto: `backend/crates/wisp-crypto`
