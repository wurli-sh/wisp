# @wisp_/demo

Demo issuer helpers and mock KYC clients for Wisp. Use these to fetch demo proof packages and exercise a mock KYC lifecycle against the reference issuer-service — useful for local development, walkthroughs, and tests.

> Demo / development helper only. Production integrations use [`@wisp_/client`](../wisp-client/README.md)'s `HttpIssuerAdapter` against a real issuer API.

## Install

```bash
npm install @wisp_/demo@0.2.0
```

## Quick start

```ts
import { DemoIssuerClient } from "@wisp_/demo";

const issuer = new DemoIssuerClient("http://127.0.0.1:3000");

// Fetch a ready-to-prove demo transfer package
const pkg = await issuer.getDemoTransfer();

// Drive the mock KYC lifecycle
const challenge = await issuer.requestMockKycChallenge(wallet);
const submitted = await issuer.submitMockKyc({ /* … */ });
const status = await issuer.getMockKycStatus(wallet);
```

## API surface

| Export | Purpose |
| ------ | ------- |
| `DemoIssuerClient` | Demo proof packages + mock KYC lifecycle client |

Methods: `getDemoTransfer`, `createDemoTransfer`, `requestMockKycChallenge`, `submitMockKyc`, `getMockKycStatus`, `addCorridorDestination`, `publishIssuerRoots`.

Types: `MockKycChallengeResponse`, `MockKycStatusResponse`, `MockKycSubmitRequest`, `MockKycSubmitResponse`, `MockKycLifecycleStatus`, `PublishRootsResponse`, `CorridorDestinationRecord`, …

## HTTP issuer service

Run the Rust issuer-service alongside this client:

```bash
export ISSUER_API_TOKEN=demo-token
export ISSUER_PUBLIC_URL=http://127.0.0.1:3000
export COMPLIANCE_CONTRACT_ID=…
export ISSUER_PUBLIC_KEY=…
cargo run -p issuer-service
```

This package expects the demo fixture and mock-KYC endpoints from the reference issuer-service. It is not a production issuer client.

## Build from source

```bash
pnpm build:js
pnpm --filter @wisp_/demo typecheck
```

## Related

- Production transports: [`@wisp_/client`](../wisp-client/README.md)
- Transfer orchestration: [`@wisp_/flows`](../wisp-flows/README.md)
- Umbrella SDK: [`@wisp_/sdk`](../../sdk/README.md) (also `@wisp_/sdk/demo`)
- Issuer HTTP service: [`backend/crates/issuer-service/`](../../backend/crates/issuer-service/)
