# @wisp_/core

Portable Wisp protocol core — package validation, public-input rebinding, root comparison, typed errors, and shared types. **Zero chain dependencies** (only `@wisp_/js` + `@wisp_/bindings`), so it drops straight into any issuer or compliance integration.

> Beta / demo release only. Intended for evaluation and testnet integrations; interfaces may change.

Use this when you need to validate proof packages or compare on-chain roots without pulling in Stellar transports, the prover, or the demo issuer.

## Install

```bash
npm install @wisp_/core@0.2.1
```

## Quick start

```ts
import {
  validateProofPackage,
  assertProofPackagePublicInputsMatch,
  validationPolicies,
  rootsMatch,
  issuerRootsMatch,
} from "@wisp_/core";

// Structural + public-input validation of an issuer proof package
const result = validateProofPackage(pkg, {
  policy: validationPolicies.strict,
});

// Compare expected vs on-chain roots before settling
if (!issuerRootsMatch(expectedRoots, chainRoots)) {
  throw new Error("issuer roots drifted");
}
```

## API surface

| Export | Purpose |
| ------ | ------- |
| `validateProofPackage` | Structural + public-input validation against a policy |
| `validatePackageStructure` | Shape-only checks on a proof package |
| `rebuildProofPackagePublicInputs` | Recompute the 19 public inputs from a package |
| `assertProofPackagePublicInputsMatch` | Assert package fields rebind to expected inputs |
| `validationPolicies` | Preset strict / lenient policies |
| `rootsMatch` · `issuerRootsMatch` · `corridorRootsMatch` | Root drift comparison helpers |
| `publicInputsRecordMatch` | Compare public-input records |
| `IssuerNotRegisteredError`, `CorridorDisabledForIssuerError`, … | Typed protocol errors |

Re-exports the canonical types `ProofPackage`, `Credential`, `TransferParams`, `MerklePaths`, `Roots`, `WitnessPrivate` from `@wisp_/bindings`.

`validatePackageStructure` rejects non-decimal roots/public inputs, non-decimal
Merkle siblings, path lengths other than 20, and direction bits other than `0`/`1`.
Treat a structural error as an issuer integration failure; do not coerce the package
and continue.

## Build from source

```bash
pnpm build:js                       # from repo root (builds deps first)
pnpm --filter @wisp_/core test
```

## Related

- Crypto primitives: [`@wisp_/js`](../wisp-js/README.md)
- Transports + chain reads: [`@wisp_/client`](../wisp-client/README.md)
- Transfer orchestration: [`@wisp_/flows`](../wisp-flows/README.md)
- Public input ABI: [`@wisp_/bindings`](../../bindings/README.md)
- Umbrella SDK: [`@wisp_/sdk`](../../sdk/README.md) (also `@wisp_/sdk/core`)
