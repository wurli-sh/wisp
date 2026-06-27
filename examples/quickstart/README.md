# @wisp_/sdk quickstart

Copy-paste integration examples for a new consumer of `@wisp_/sdk`. Two entries,
same prove → validate → settle → audit flow:

| File | Entry | Use case |
|------|-------|----------|
| `src/browser-quickstart.ts` | `@wisp_/sdk/browser` | React/Vite/webpack/Next apps — client-side proving + wallet settle |
| `src/node-quickstart.ts` | `@wisp_/sdk` | servers/scripts — `fromEnv()` + CLI prover + keypair settle |

## Install

```bash
npm install @wisp_/sdk @wisp_/js
```

You also need the circuit artifacts (WASM + zkey). Serve them as static assets
(browser) or point env vars at them (Node).

## Browser

`@wisp_/sdk/browser` has a **node-free import graph** — no `node:*` shims and no
prover aliasing needed in your bundler. The only browser prerequisite is a
global `Buffer` polyfill (Stellar/snarkjs expect it):

```ts
import { Buffer } from "buffer";
globalThis.Buffer ??= Buffer;
```

Then the whole flow is one call:

```ts
import { WispClient, HttpIssuerAdapter } from "@wisp_/sdk/browser";

const client = new WispClient({ /* rpcUrl, complianceId, assetId, issuerUrl, issuerPublicKey, wasmUrl, zkeyUrl, ... */ });
const result = await client.createAndSettleTransfer({
  issuer: new HttpIssuerAdapter(client.cfg.issuerUrl),
  request: { sender_strkey, recipient_strkey, amount, corridor_id, source_country, dest_country },
  validation: { issuerPublicKey: client.cfg.issuerPublicKey!, corridorId: corridor_id },
  walletSigner,                 // { publicKey, signTransaction(xdr) }
  senderAddress: walletSigner.publicKey,
  proof: { browser: true, wasmUrl: client.cfg.wasmUrl!, zkeyUrl: client.cfg.zkeyUrl! },
});
```

See `src/browser-quickstart.ts` for the Freighter wallet adapter and the
step-by-step variant.

## Node

```bash
ISSUER_URL=... ISSUER_PUBLIC_KEY=G... COMPLIANCE_CONTRACT_ID=C... SAC_CONTRACT_ID=C... \
SENDER_PUBLIC_KEY=G... SENDER_SECRET=S... RECIPIENT_PUBLIC_KEY=G... \
WISP_ZKEY_PATH=... WISP_WASM_PATH=... WISP_WITNESS_GEN=... \
pnpm --filter @wisp_/quickstart node
```

## What you swap for production

- `HttpIssuerAdapter` → your own `IssuerAdapter` (or keep HTTP). The bundled
  `DemoIssuerClient` (`@wisp_/sdk/demo`) is only for the mock-KYC demo.
- Real contract IDs / issuer URL / RPC via config or env.
- Your own wallet/keypair signer.

## Typecheck

```bash
pnpm --filter @wisp_/quickstart typecheck
```
