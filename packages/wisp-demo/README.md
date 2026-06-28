# @wisp_/demo

Mock KYC and demo administration helpers for the reference Wisp issuer service.

> Demo / development helper only. Production integrations use [`@wisp_/client`](../wisp-client/README.md)'s `HttpIssuerAdapter` against a real issuer API.
>
> Beta / demo release only. Intended for evaluation and local or testnet walkthroughs.

## Install

```bash
npm install @wisp_/demo@0.3.0
```

## Quick start

```ts
import { DemoIssuerClient } from "@wisp_/demo";

const issuer = new DemoIssuerClient("http://127.0.0.1:3000");

// Drive the mock KYC lifecycle
const challenge = await issuer.requestMockKycChallenge(wallet);
const submitted = await issuer.submitMockKyc({ /* … */ });
const status = await issuer.getMockKycStatus(wallet);
```

## API surface

| Export | Purpose |
| ------ | ------- |
| `DemoIssuerClient` | Mock KYC + demo administration client |

Methods: `requestMockKycChallenge`, `submitMockKyc`, `getMockKycStatus`, `addCorridorDestination`, `publishIssuerRoots`.

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

This package expects the mock-KYC endpoints from the reference issuer-service. Mock-KYC is **only available in non-production mode** (`ISSUER_MODE` ≠ `production`). In production mode the issuer returns `503 SERVICE_UNAVAILABLE` for mock-KYC and provider webhook routes.

Proof issuance uses the inherited canonical `HttpIssuerAdapter` methods (credential activation + challenged proof packages).

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
