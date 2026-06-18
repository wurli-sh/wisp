<div align="center">
  <img src="./docs/amoeba-banner.png" width="100%" alt="Amoeba banner" />
</div>

# Amoeba

ZK compliance infrastructure for Stellar stablecoins and RWAs.

Amoeba lets issuers verify users once, publish compliance roots on-chain, and let apps generate fresh client-side Groth16 proofs for each transfer. Soroban verifies the proof, records the nullifier, and gates settlement without putting customer documents on-chain.

> Amoeba is not an anonymity rail. Sender, recipient, asset, and amount remain public on-chain. The proof shows the transfer is compliant without exposing the user’s identity data.

---

## What Amoeba Proves

One proof covers 8 checks:

| # | Check | Purpose |
|---|---|---|
| 1 | Merkle membership | Sender is in the issuer KYC tree |
| 2 | Nullifier binding | Each transfer is anti-replay bound |
| 3 | Sanctions exclusion | Sender is not in the sanctions tree |
| 4 | Jurisdiction | Sender jurisdiction is allowed |
| 5 | Credential expiry | KYC credential is still valid |
| 6 | Corridor source | Sender fits the corridor source rules |
| 7 | Corridor destination | Recipient is in the corridor destination registry |
| 8 | Corridor binding | Proof matches the on-chain corridor config |

## Architecture

```text
Trusted issuer
  -> verifies user once
  -> publishes issuer / sanctions / jurisdiction / corridor roots on-chain

Browser prover
  -> receives proof package from issuer-service
  -> generates Groth16 proof for sender + recipient + asset + amount + corridor

Soroban compliance contract
  -> rebinds 17 public inputs
  -> verifies Groth16 proof
  -> records nullifier
  -> executes compliant SAC transfer
```

## Repository Structure

```text
amoeba/
├── backend/              # Soroban contracts + Rust issuer/compliance crates
│   ├── programs/         # verifier + compliance contracts
│   └── crates/           # amoeba-crypto, amoeba-types, issuer-service
├── circuits/             # Circom circuit, fixtures, setup, ceremony tooling
├── bindings/             # Canonical ABI, generated clients, JSON fixtures
├── packages/amoeba-js/   # Shared JS crypto + witness generation
├── sdk/                  # TypeScript SDK for prove, settle, audit
├── issuer-sdk/           # Issuer-side JS client
├── frontend/             # Vite + React landing, demo, compliance hub
├── scripts/              # Dev, deploy, ceremony, publish scripts
└── docs/                 # Banner, plans, and supporting docs
```

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Vite 6, React 19, Tailwind 4 |
| Contracts | Soroban SDK 25, Rust `no_std` |
| ZK | Circom 2.2.3, snarkjs, Groth16, BN254, Poseidon2 |
| Backend | Rust issuer-service |
| SDKs | TypeScript (`@amoeba_/js`, `@amoeba_/sdk`, `@amoeba_/issuer-sdk`) |
| Settlement | Stellar SAC + Soroban |

## Prerequisites

- Rust 1.94+
- Node 25+
- `pnpm`
- Stellar CLI 25+
- circom 2.2.3
- snarkjs 0.7+
- `soroban-verifier-gen` via `cargo install soroban-verifier-gen`

## Quick Start

```bash
pnpm install
stellar contract build
./scripts/dev/demo-phase4.sh
pnpm dev:frontend
```

## Key Commands

| Command | Description |
|---|---|
| `pnpm build:js` | Build shared JS packages |
| `pnpm gen:bindings` | Regenerate ABI bindings |
| `pnpm gen:crypto-fixtures` | Regenerate crypto/address fixtures |
| `pnpm test:witness` | Witness and crypto tests |
| `pnpm test:sdk` | SDK tests |
| `pnpm build:frontend` | Frontend production build |
| `./scripts/dev/demo-e2e.sh` | Full local ZK + contracts pipeline |
| `./scripts/dev/demo-phase2.sh` | Bindings + issuer-service pipeline |
| `./scripts/dev/demo-phase3.sh` | SDK prove/settle local demo |
| `./scripts/dev/demo-phase4.sh` | Copy circuit artifacts + frontend build gate |
| `./scripts/dev/verify-testnet.sh` | Phase 0 testnet verifier gate |
| `./scripts/dev/verify-compliance-testnet.sh` | Phase 1 compliance gate |
| `./scripts/dev/verify-phase3-testnet.sh` | Full prove -> settle -> audit testnet flow |

## Frontend Routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/demo` | Prove -> settle -> audit console |
| `/compliance` | Proofs, audit, and corridor views |

---

## Phase 0 — Gate Check

A minimal Groth16 proof must verify in a Soroban contract before Phase 1 begins.

```bash
./scripts/dev/verify-testnet.sh
```

## Phase 1 — ZK + Contracts

End-to-end path: Circom proof -> Soroban verifier -> compliance contract -> SAC transfer.

### Local command sequence

```bash
# Full local pipeline (compile, prove, verify, contract tests)
./scripts/dev/demo-e2e.sh
```

Or step by step:

```bash
cd circuits/circom
pnpm gen:fixtures
./scripts/compile.sh
./scripts/setup.sh
./scripts/prove.sh inputs/valid.us-mx.json
./scripts/verify-local.sh
./scripts/export-vk.sh

cd ../..
cargo test -p verifier -p compliance
stellar contract build
```

### Public inputs (17 fields)

| Index | Field |
|------:|-------|
| 0 | merkle_root |
| 1 | nullifier |
| 2–3 | asset_lo, asset_hi |
| 4–5 | sender_lo, sender_hi |
| 6 | epoch |
| 7–8 | recipient_lo, recipient_hi |
| 9 | amount |
| 10 | sanctions_root |
| 11 | jurisdiction_root |
| 12 | timestamp (= epoch × 86400) |
| 13 | corridor_id |
| 14 | corridor_config_hash |
| 15 | source_jurisdiction_root |
| 16 | dest_address_root |

Address limbs: `hi = bytes[0..16]`, `lo = bytes[16..32]` as big-endian field elements.

### snarkjs -> Soroban proof encoding

G1 points use 32-byte big-endian `x || y` with no ark serialization flags. G2 uses `x_c1 || x_c0 || y_c1 || y_c0` per snarkjs `pi_b` rows. The verifier negates `pi_a` internally.

### Testnet deploy (optional)

Requires funded `amoeba-admin` identity on testnet:

```bash
export NETWORK=testnet
export SOURCE=amoeba-admin
./scripts/deploy/deploy-verifier.sh
./scripts/deploy/deploy-compliance.sh
./scripts/deploy/setup-sac.sh
./scripts/deploy/publish-roots.sh

./scripts/dev/verify-compliance-testnet.sh
```

Deployed contract IDs are written to `.amoeba/*.env`.

### SAC bypass caveat

Direct SAC transfers can bypass Amoeba unless issuer authorization is configured. The demo uses approve + `transfer_from` via the compliance contract; Circle testnet USDC does not support on-chain router blocking.

### Mainnet ceremony gate

`circuits/circom/scripts/setup.sh` is not a mainnet ceremony. Mainnet requires a completed, published multi-party phase 2 ceremony with verifier sync.

- Canonical evidence package: `circuits/circom/artifacts/ceremony/`
- Required flags in `manifest.json`: `published: true`, `verifier_contract_synced: true`
- The final zkey must remain locally available for strict deploy-time verification and is not committed to git
- Flow: `ceremony:init` -> contribute (>=3) -> finalize -> `ceremony:sync` -> `ceremony:publish`

Use the `ceremony:*` npm scripts plus the manifests under `circuits/circom/artifacts/ceremony/`.

### Launch runbooks

The executable source of truth in this repo is the deploy/testnet script set under `scripts/deploy/` and `scripts/dev/`.

## Phase 2 — Bindings + Backend

Freeze the 17-field public input ABI and run the issuer HTTP service that serves proof packages and publishes roots.

### Local command sequence

```bash
./scripts/dev/demo-phase2.sh
```

Or step by step:

```bash
pnpm gen:bindings
pnpm gen:crypto-fixtures
cargo test -p amoeba-crypto -p amoeba-types -p issuer-service
pnpm test:bindings

export ISSUER_STATE_PATH=.amoeba/issuer-state.json
export ISSUER_API_TOKEN=demo-token
cargo run -p issuer-service

curl -sf localhost:3000/v1/fixtures/demo-transfer
curl -sf localhost:3000/v1/fixtures/demo-transfer | node --import tsx scripts/dev/assert-public-inputs.ts
```

### Bindings

Canonical ABI: [`bindings/public-inputs.json`](bindings/public-inputs.json). See [`bindings/README.md`](bindings/README.md) for encoding rules.

Regenerate after ABI edits:

```bash
pnpm gen:bindings
pnpm gen:crypto-fixtures
```

### Issuer service endpoints

| Method | Path |
|---|---|
| GET | `/health` |
| GET | `/v1/fixtures/demo-transfer` |
| GET | `/v1/merkle-path/:wallet` |
| POST | `/v1/admin/roots/publish` (Bearer token) |

Publish roots via service on testnet:

```bash
export ISSUER_API_TOKEN=...
./scripts/dev/publish-roots-via-service.sh
```

## Phase 3 — SDK + Testnet Settlement

Node SDK orchestrates issuer paths -> witness -> Groth16 prove -> Soroban `compliant_transfer`.

### Stage 1 — Blocker gate

```bash
./scripts/dev/verify-phase3-blockers.sh
AMOEBA_RUN_TESTNET_BLOCKERS=1 ./scripts/dev/verify-phase3-blockers.sh
```

### Stage 2 — Local SDK demo

```bash
./scripts/dev/demo-phase3.sh
```

Or:

```bash
pnpm test:sdk
```

with `issuer-service` running.

### Testnet settlement

```bash
./scripts/dev/bootstrap-testnet-demo.sh
./scripts/dev/check-circle-usdc-testnet.sh
./scripts/dev/verify-phase3-testnet.sh
```

### SDK API

```ts
import { AmoebaClient, DemoIssuerClient } from "@amoeba_/sdk";

const client = AmoebaClient.fromEnv();
const demoIssuer = new DemoIssuerClient(client.cfg.issuerUrl);
const pkg = await demoIssuer.getDemoTransfer();

await client.validatePackage(pkg, {
  issuerPublicKey: process.env.ISSUER_PUBLIC_KEY!,
  corridorId: Number(pkg.transfer?.corridor_id ?? 1),
});

const proven = await client.prove({ package: pkg });
await client.approveSacForComplianceWithKeypair(pkg, senderSecret);
await client.settleWithKeypair(proven, pkg, senderSecret);
await client.audit(proven.nullifier, senderPublicKey);
```

Testnet fixtures use `AMOEBA_FIXTURE_PROFILE=testnet` and `bindings/fixtures/demo-transfer-testnet.json`.

## Phase 4 — Frontend

Vite + React demo UI over `@amoeba_/sdk`: landing (`/`), interactive console (`/demo`), compliance hub (`/compliance`).

### Local command sequence

```bash
./scripts/dev/demo-phase4.sh
pnpm dev:frontend
```

Set contract IDs in `frontend/.env` per `frontend/.env.example`. Browser proving serves wasm/zkey from `frontend/public/circuits/`, copied by `demo-phase4.sh`.

### Routes

| Route | Purpose |
|---|---|
| `/` | Marketing landing |
| `/demo` | 11-step prove -> settle -> audit console |
| `/compliance` | Tabs: Proofs · Audit · Corridors |

### E2E

```bash
cd frontend && pnpm build && pnpm test:e2e
```
