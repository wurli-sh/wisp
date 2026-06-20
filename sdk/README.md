# @wisp_/sdk

TypeScript SDK for proving, settling, and auditing Wisp compliant transfers on Stellar.

## Install

```bash
npm install @wisp_/sdk @wisp_/js
```

Peer deps are bundled; you also need circuit artifacts (WASM + zkey) for proving.

## Quick start

```ts
import { WispClient, DemoIssuerClient } from "@wisp_/sdk";

const client = WispClient.fromEnv();
const issuer = new DemoIssuerClient(client.cfg.issuerUrl);
const pkg = await issuer.getDemoTransfer();

await client.validatePackage(pkg, {
  issuerPublicKey: process.env.ISSUER_PUBLIC_KEY!,
  corridorId: Number(pkg.transfer?.corridor_id ?? 1),
});

const proven = await client.prove({ package: pkg });
await client.approveSacForComplianceWithKeypair(pkg, senderSecret);
const tx = await client.settleWithKeypair(proven, pkg, senderSecret);
const audit = await client.audit(proven.nullifier, senderPublicKey);
```

## Environment

Loaded from `.wisp/*.env`, repo `.env`, or `process.env` via `loadWispEnv()`.

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `STELLAR_RPC_URL` | — | Soroban RPC (default: testnet) |
| `COMPLIANCE_CONTRACT_ID` | yes* | Compliance contract |
| `VERIFIER_CONTRACT_ID` | — | Verifier contract |
| `SAC_CONTRACT_ID` | yes* | Asset SAC for settlement |
| `ISSUER_PUBLIC_KEY` | yes* | Issuer G-address |
| `ISSUER_URL` | — | Issuer HTTP base (default: `http://127.0.0.1:3000`) |
| `WISP_FIXTURE_PROFILE` | — | `local` or `testnet` |
| `WISP_ARTIFACT_DIR` | — | Circuit artifacts dir |
| `VALIDATE_START_LEDGER` | — | Event scan start for root validation |

\*Required for settle/validate on testnet.

## Browser proving

```ts
const proven = await client.prove({
  package: pkg,
  browser: true,
  wasmUrl: "/circuits/compliance_corridor.wasm",
  zkeyUrl: "/circuits/compliance_corridor_final.zkey",
});
```

## Wallet settle (Freighter)

```ts
import type { WalletSigner } from "@wisp_/sdk";

await client.approveSacForCompliance(pkg, wallet);
await client.settleWithWallet(proven, pkg, wallet);
```

## API surface

| Export | Purpose |
| ------ | ------- |
| `WispClient` | Facade: prove · validate · settle · audit |
| `DemoIssuerClient` | Fetch demo proof packages |
| `HttpIssuerAdapter` | Custom issuer HTTP client |
| `validatePackage` | Pre-flight package + on-chain root checks |
| `loadConfig` / `loadWispEnv` | Config from env |
| `getLatestChainRoots` | Read issuer/corridor roots from chain events |

## Testnet fixtures

```bash
export WISP_FIXTURE_PROFILE=testnet
# fixture: bindings/fixtures/demo-transfer-testnet.json
```

## Build from source

```bash
pnpm build:js          # from repo root
pnpm --filter @wisp_/sdk test
```

## Related

- Crypto primitives: [`@wisp_/js`](../packages/wisp-js/README.md)
- Issuer operations: [`@wisp_/issuer-sdk`](../issuer-sdk/README.md)
- Public input ABI: [`bindings/README.md`](../bindings/README.md)
