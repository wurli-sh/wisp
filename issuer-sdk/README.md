# @wisp_/issuer-sdk

TypeScript SDK for operating an Wisp issuer — register on-chain, manage corridors, publish compliance roots.

## Install

```bash
npm install @wisp_/issuer-sdk@0.2.0 @wisp_/sdk@0.2.0 @wisp_/js@0.2.0
```

## Quick start

```ts
import { WispIssuerClient, loadIssuerConfig } from "@wisp_/issuer-sdk";

const cfg = loadIssuerConfig();
const issuer = new WispIssuerClient(cfg);

// Register issuer on compliance contract
await issuer.registerIssuerAndSend(
  { metadataUri: "https://issuer.example/.well-known/wisp-issuer.json" },
  operatorSigner,
);

// Publish merkle + sanctions + jurisdiction roots
await issuer.publishIssuerRootsAndSend(
  {
    merkleRoot: "0x…",
    sanctionsRoot: "0x…",
    jurisdictionRoot: "0x…",
  },
  operatorSigner,
);

// Register a travel-rule corridor (e.g. US → MX)
await issuer.registerCorridorAndSend(
  {
    corridorId: 1,
    sourceJurisdictionRoot: "0x…",
    destAddressRoot: "0x…",
    corridorConfigHash: "0x…",
  },
  operatorSigner,
);
```

## Environment

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `COMPLIANCE_CONTRACT_ID` | yes | Compliance contract ID |
| `OPERATOR_PUBLIC_KEY` | yes | Signing operator (or `ISSUER_PUBLIC_KEY`) |
| `ISSUER_PUBLIC_KEY` | — | Issuer identity on-chain |
| `STELLAR_RPC_URL` | — | Soroban RPC |
| `NETWORK_PASSPHRASE` | — | Network passphrase |

Uses `loadWispEnv()` from `@wisp_/sdk` — reads `.wisp/*.env`.

## Signer

Pass a Stellar keypair or wallet adapter:

```ts
const signer = {
  publicKey: "G…",
  signTransaction: async (tx) => { /* sign + return */ },
};
```

## Conformance testing

Validate your issuer HTTP API against the Wisp spec:

```ts
import { runIssuerConformance } from "@wisp_/issuer-sdk";

const result = await runIssuerConformance({
  baseUrl: "http://127.0.0.1:3000",
  apiToken: process.env.ISSUER_API_TOKEN,
});
```

CLI: `pnpm test:issuer-conformance` (from repo root).

## HTTP issuer service

For off-chain proof packages and merkle paths, run the Rust issuer-service alongside this SDK:

```bash
export ISSUER_API_TOKEN=demo-token
export COMPLIANCE_CONTRACT_ID=…
cargo run -p issuer-service
```

Then use `@wisp_/sdk` (`DemoIssuerClient`, `HttpIssuerAdapter`) to fetch packages for client-side proving.

## API surface

| Export | Purpose |
| ------ | ------- |
| `WispIssuerClient` | On-chain issuer/corridor/roots mutations |
| `loadIssuerConfig` | Env-backed config |
| `normalizeRootHashToBytes` | Root hash encoding for contract calls |
| `runIssuerConformance` | HTTP API conformance suite |

## Build from source

```bash
pnpm build:js
pnpm --filter @wisp_/issuer-sdk test
```

## Related

- End-user prove/settle: [`@wisp_/sdk`](../sdk/README.md)
- Witness/crypto: [`@wisp_/js`](../packages/wisp-js/README.md)
- Contract clients: `@wisp_/compliance@0.2.0`, `@wisp_/verifier@0.2.0`
- Issuer HTTP service: [`backend/crates/issuer-service/`](../backend/crates/issuer-service/)
