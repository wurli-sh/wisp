# @wisp_/client

Wisp client transports and chain access — issuer HTTP adapter plus typed reads of on-chain issuer registry, compliance roots, corridor config, `ProofSettled` events, and verifier VK hash. This is the portable I/O layer that issuer and compliance integrations embed without the prover or demo issuer.

> Beta / demo release only. Intended for evaluation and testnet integrations; interfaces may change.

## Install

```bash
npm install @wisp_/client@0.2.1
```

## Quick start

```ts
import {
  HttpIssuerAdapter,
  resolveIssuer,
  getLatestChainRoots,
  auditNullifier,
  getVerifierVkHash,
} from "@wisp_/client";

// Fetch proof packages / merkle paths from an issuer HTTP API
const issuer = new HttpIssuerAdapter("https://issuer.example");

// Read current issuer + corridor roots straight from chain events
const roots = await getLatestChainRoots(chain, issuerPublicKey, 1);

// Confirm a transfer settled (nullifier attestation)
const audit = await auditNullifier(nullifierBytes, chain, senderPublicKey);
```

## API surface

| Export | Purpose |
| ------ | ------- |
| `HttpIssuerAdapter` · `IssuerClient` · `issuerFetch` | Issuer HTTP transport + adapter |
| `resolveIssuer` · `resolveIssuerFromUrl` · `listIssuers` | Issuer discovery / well-known resolution |
| `getLatestChainRoots` · `getLatestIssuerRoots` · `getLatestCorridorRoots` | On-chain root reads |
| `getLatestIssuerRecord` · `getLatestIssuerEnabled` · `listIssuerRegistryEntries` | Issuer registry reads |
| `listProofSettledEvents` · `getProofSettledByNullifier` · `getProofSettledByTxHash` | Settlement event queries |
| `auditNullifier` | Nullifier attestation check |
| `getVerifierVkHash` · `vkHashesMatch` | Verifier VK hash drift check |

Types: `ChainClientConfig`, `IssuerAdapter`, `IssuerCapabilities`, `IssuerWellKnown`, `ProofPackageRequest`, `CorridorDetail`, `ChainIssuerRecord`, `ChainRootsBundle`, `ProofSettledEvent`, `ResolvedIssuer`, …

## Environment

Reads Soroban config (`STELLAR_RPC_URL`, `COMPLIANCE_CONTRACT_ID`, `VERIFIER_CONTRACT_ID`) via the host app's config. Pair with [`@wisp_/sdk`](../../sdk/README.md)'s `loadWispEnv()` for `.wisp/*.env` loading.

## Build from source

```bash
pnpm build:js
pnpm --filter @wisp_/client typecheck
```

## Related

- Protocol validation + types: [`@wisp_/core`](../wisp-core/README.md)
- Transfer orchestration: [`@wisp_/flows`](../wisp-flows/README.md)
- Crypto primitives: [`@wisp_/js`](../wisp-js/README.md)
- On-chain issuer ops: [`@wisp_/issuer-sdk`](../../issuer-sdk/README.md)
- Umbrella SDK: [`@wisp_/sdk`](../../sdk/README.md) (also `@wisp_/sdk/client`)
