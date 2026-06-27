# @wisp_/sdk

TypeScript SDK for proving, settling, and auditing Wisp compliant transfers on Stellar.

> Beta / demo release only. Intended for evaluation and testnet flows; expect API and protocol changes before production use.

This is the **umbrella** package. It bundles the modular Wisp layers and re-exports each via a subpath, so you can install everything here or embed just the layer you need:

| Import | Re-exports | Standalone package |
| ------ | ---------- | ------------------ |
| `@wisp_/sdk` | full prove/settle/audit facade (Node prover + `fromEnv`) | — |
| `@wisp_/sdk/browser` | same facade, **browser-safe** (no `node:*` in graph) | — |
| `@wisp_/sdk/core` | validation, root compare, types | [`@wisp_/core`](../packages/wisp-core/README.md) |
| `@wisp_/sdk/client` | issuer adapter + chain reads | [`@wisp_/client`](../packages/wisp-client/README.md) |
| `@wisp_/sdk/flows` | transfer orchestration | [`@wisp_/flows`](../packages/wisp-flows/README.md) |
| `@wisp_/sdk/demo` | demo issuer + mock KYC | [`@wisp_/demo`](../packages/wisp-demo/README.md) |

Issuer and compliance integrations that don't need the prover can depend on the standalone packages directly and skip the rest of the bundle.

## Install

```bash
npm install @wisp_/sdk@0.2.1 @wisp_/js@0.2.1
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

For a real issuer API, swap `DemoIssuerClient` for `HttpIssuerAdapter` and fetch a package from `POST /v1/proof-packages`.

Runnable, typechecked starting points (browser + Node) live in [`examples/quickstart`](../examples/quickstart/README.md).

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

Use `DemoIssuerClient` only for the demo fixture + mock-KYC flow. Production issuer integrations should use `HttpIssuerAdapter` or a custom `IssuerAdapter`.

## Browser proving

Import from `@wisp_/sdk/browser` in browser/bundler targets. Its reachable
import graph contains **no `node:*` references**, so it bundles without aliasing
the Node prover or shimming `node:fs`/`path`/`os`/`url`/`child_process`:

```ts
import { WispClient } from "@wisp_/sdk/browser";

const client = new WispClient({
  rpcUrl: import.meta.env.VITE_STELLAR_RPC_URL,
  complianceId: import.meta.env.VITE_COMPLIANCE_CONTRACT_ID,
  issuerUrl: import.meta.env.VITE_ISSUER_URL,
  issuerPublicKey: import.meta.env.VITE_ISSUER_PUBLIC_KEY,
  wasmUrl: "/circuits/compliance_corridor.wasm",
  zkeyUrl: "/circuits/compliance_corridor_final.zkey",
  // ...remaining WispConfig fields
});
// or: WispClient.fromEnv({ ...overrides }) — reads overrides only, never the fs

const proven = await client.prove({
  package: pkg,
  browser: true,
  wasmUrl: "/circuits/compliance_corridor.wasm",
  zkeyUrl: "/circuits/compliance_corridor_final.zkey",
});
```

The default `@wisp_/sdk` entry stays Node-only (it statically wires the
`circom`/`snarkjs` CLI prover and `.env`-file loading); calling `prove()`
without `browser: true` from the browser entry throws. Stellar/snarkjs still
expect a global `Buffer`, so provide a `Buffer` polyfill in your app entry — a
standard browser concern, not a Wisp one.

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

- Quickstart examples (browser + Node): [`examples/quickstart`](../examples/quickstart/README.md)
- Protocol core (no chain deps): [`@wisp_/core`](../packages/wisp-core/README.md)
- Transports + chain reads: [`@wisp_/client`](../packages/wisp-client/README.md)
- Transfer orchestration: [`@wisp_/flows`](../packages/wisp-flows/README.md)
- Demo issuer + mock KYC: [`@wisp_/demo`](../packages/wisp-demo/README.md)
- Crypto primitives: [`@wisp_/js`](../packages/wisp-js/README.md)
- Issuer operations: [`@wisp_/issuer-sdk`](../issuer-sdk/README.md)
- Public input ABI: [`@wisp_/bindings`](../bindings/README.md)
- Contract clients: `@wisp_/compliance@0.2.1`, `@wisp_/verifier@0.2.1`
