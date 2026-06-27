# @wisp_/issuer-sdk

TypeScript SDK for operating a Wisp issuer — register on-chain, manage corridors, publish compliance roots, and conformance-test your issuer API.

> Beta / demo release only. Intended for evaluation and testnet issuer integrations; not production compliance infrastructure.

Pairs with the portable Wisp layers: read on-chain state with [`@wisp_/client`](../packages/wisp-client/README.md), validate packages with [`@wisp_/core`](../packages/wisp-core/README.md), and keep your KYC stack of choice — Wisp only consumes the published roots.

## Install

```bash
npm install @wisp_/issuer-sdk@0.2.1 @wisp_/sdk@0.2.1 @wisp_/js@0.2.1
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

A runnable, typechecked operator example (orchestrated `publishRoots` + keypair signer + conformance) lives in [`examples/issuer-quickstart`](../examples/issuer-quickstart/README.md).

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
  issuerUrl: "http://127.0.0.1:3000",
  issuerPublicKey: process.env.ISSUER_PUBLIC_KEY!,
  sender: "G...",
  recipient: "G...",
  corridorId: 1,
  simulateSettle: false,
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

Then use `HttpIssuerAdapter` for real issuer APIs and `DemoIssuerClient` only for the demo fixture + mock-KYC flow.

## API surface

| Export | Purpose |
| ------ | ------- |
| `WispIssuerClient` | On-chain issuer/corridor/roots mutations |
| `loadIssuerConfig` | Env-backed config |
| `normalizeRootHashToBytes` | Root hash encoding for contract calls |
| `runIssuerConformance` | HTTP API conformance suite |

Root inputs may be a 32-byte `Buffer`/`Uint8Array`, 64-character hex, or a canonical
non-negative BN254 field decimal. Decimal values greater than or equal to the field
modulus are rejected instead of silently wrapping. `publishRoots(input)` only plans
transactions; pass a signer as the second argument to build, sign, and submit them
sequentially.

For CI, `pnpm test:issuer-sdk` covers encoding boundaries, generated contract `Option`
shapes, signer propagation, transaction ordering, stale planning races, and concurrent
publish planning. Run `pnpm test:issuer-conformance` separately against each live
issuer deployment.

For the reference issuer, `pnpm test:issuer-conformance -- --seed` forwards the
loaded `.wisp/*.env` configuration to its seed subprocess, publishes current roots
when required, then validates and proves a package.

## Build from source

```bash
pnpm build:js
pnpm --filter @wisp_/issuer-sdk test
```

## Related

- Issuer operator quickstart: [`examples/issuer-quickstart`](../examples/issuer-quickstart/README.md)
- End-user prove/settle: [`@wisp_/sdk`](../sdk/README.md)
- Protocol validation + types: [`@wisp_/core`](../packages/wisp-core/README.md)
- Issuer transports + chain reads: [`@wisp_/client`](../packages/wisp-client/README.md)
- Witness/crypto: [`@wisp_/js`](../packages/wisp-js/README.md)
- Contract clients: `@wisp_/compliance@0.2.1`, `@wisp_/verifier@0.2.1`
- Issuer HTTP service: [`backend/crates/issuer-service/`](../backend/crates/issuer-service/)
