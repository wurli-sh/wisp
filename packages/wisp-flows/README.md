# @wisp_/flows

High-level, **client-agnostic** orchestration for Wisp transfers: fetch package → validate → prove → duplicate-check → approve → simulate → settle, with staged progress callbacks and duplicate-nullifier retry.

> Beta / demo release only. Intended for evaluation and testnet integrations; interfaces may change.

Flows depend only on `@wisp_/js` and program against a `TransferClientLike` interface — so you can drive them with `@wisp_/sdk`'s `WispClient`, a custom client, or a test double. Ideal for embedding the full transfer pipeline into your own UI or service.

## Install

```bash
npm install @wisp_/flows@0.2.1
```

## Quick start

```ts
import {
  createAndSettleTransferWithRetry,
  type TransferStage,
} from "@wisp_/flows";

const result = await createAndSettleTransferWithRetry({
  client,        // any TransferClientLike (e.g. WispClient from @wisp_/sdk)
  issuer,        // ProofPackageSource (DemoIssuerClient or HttpIssuerAdapter)
  request,       // DemoTransferRequest
  validation: { issuerPublicKey, corridorId: 1 },
  walletSigner,  // { publicKey, signTransaction }
  senderAddress,
  onStage: (stage: TransferStage, payload) => console.log(stage, payload),
});

console.log("settled nullifier:", result.nullifier);
```

`DemoIssuerClient` drives the fixture route for local demos. `HttpIssuerAdapter` uses the canonical issuer API (`/.well-known/wisp-issuer.json`, `POST /v1/proof-packages`) for real integrations.

## API surface

| Export | Purpose |
| ------ | ------- |
| `createAndSettleTransfer` | Full staged fetch → settle pipeline |
| `createAndSettleTransferWithRetry` | Retries once on duplicate nullifier |
| `fetchTransferPackage` | Create + validate a proof package |
| `validateTransferPackage` | Validate a package against issuer + corridor |
| `proveTransferPackage` | Prove (node or browser) |
| `DuplicateNullifierError` | Thrown when a nullifier is already attested |

Interfaces: `TransferClientLike`, `ProofPackageSource`, `WalletSigner`, `CreateAndSettleTransferInput`, `CreateAndSettleTransferResult`, `BrowserProofOptions`, `TransferStage`.

## Stages

`fetch` → `validate` → `prove` → `duplicate-check` → `approve` → `simulate` → `settle`

Subscribe via `onStage` to drive progress UI.

`createAndSettleTransferWithRetry` requests and proves a fresh package once after a
duplicate. The retry performs the duplicate check again; it never bypasses replay
protection. If the issuer returns the same nullifier twice, the flow throws
`DuplicateNullifierError` before approval or settlement.

## Build from source

```bash
pnpm build:js
pnpm --filter @wisp_/flows test
```

## Related

- Default client: [`@wisp_/sdk`](../../sdk/README.md) (`WispClient` satisfies `TransferClientLike`; also `@wisp_/sdk/flows`)
- Transports + chain reads: [`@wisp_/client`](../wisp-client/README.md)
- Protocol validation: [`@wisp_/core`](../wisp-core/README.md)
- Crypto primitives: [`@wisp_/js`](../wisp-js/README.md)
