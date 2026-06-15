# Amoeba

ZK compliance infrastructure for Stellar stablecoins and RWAs.

## Prerequisites

- Rust 1.94+
- Node 25+
- stellar CLI 25+
- circom 2.2.3
- snarkjs 0.7+
- soroban-verifier-gen (`cargo install soroban-verifier-gen`)

## Quick Start

```bash
pnpm install
stellar contract build
```

## Phase 0 — Gate Check

A minimal Groth16 proof must verify in a Soroban contract before Phase 1 begins.

```bash
./scripts/dev/verify-testnet.sh
```

## Phase 1 — ZK + Contracts

End-to-end path: Circom proof → Soroban verifier → compliance contract → SAC transfer.

### Local command sequence

```bash
# Full local pipeline (compile, prove, verify, contract tests)
./scripts/dev/demo-e2e.sh
```

Or step by step:

```bash
cd circuits/circom
pnpm gen:fixtures                     # valid + invalid witness inputs
./scripts/compile.sh
./scripts/setup.sh                    # local/testnet-only one-person setup (POWER=17)
./scripts/prove.sh inputs/valid.us-mx.json
./scripts/verify-local.sh
./circuits/circom/scripts/export-vk.sh  # exports VK + regenerates backend/programs/verifier

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

### snarkjs → Soroban proof encoding

G1 points use 32-byte big-endian `x || y` (no ark serialization flags). G2 uses `x_c1 || x_c0 || y_c1 || y_c0` per snarkjs `pi_b` rows. The verifier negates `pi_a` internally.

### Testnet deploy (optional)

Requires funded `amoeba-admin` identity on testnet:

```bash
export NETWORK=testnet
export SOURCE=amoeba-admin
./scripts/deploy/deploy-verifier.sh
./scripts/deploy/deploy-compliance.sh
./scripts/deploy/setup-sac.sh
./scripts/deploy/publish-roots.sh

# On-chain compliance proof verification
./scripts/dev/verify-compliance-testnet.sh
```

Deployed contract IDs are written to `.amoeba/*.env` (current compliance verifier on testnet: check `.amoeba/verifier.env`).

### SAC bypass caveat

Direct SAC transfers can bypass Amoeba unless issuer authorization is configured. The MVP demo proves a **compliant transfer rail**; production hardening uses issuer-controlled authorization settings.

### Mainnet ceremony gate

`circuits/circom/scripts/setup.sh` is not a mainnet ceremony. Mainnet requires a completed, published multi-party phase 2 ceremony with verifier sync.

- Canonical evidence package: `circuits/circom/artifacts/ceremony/`
- Required flags in `manifest.json`: `published: true`, `verifier_contract_synced: true`
- The final zkey must remain locally available for strict deploy-time verification (not committed to git)
- Flow: `ceremony:init` → contribute (≥3) → finalize → `ceremony:sync` → `ceremony:publish`

Use the `ceremony:*` npm scripts plus the manifests under `circuits/circom/artifacts/ceremony/`; the older top-level runbook docs are not part of this repo layout anymore.

### Launch runbooks

The executable source of truth in this repo is the deploy/testnet script set under `scripts/deploy/` and `scripts/dev/`. Older top-level runbook markdown filenames referenced in previous layouts are not checked into this repo.

## Phase 2 — Bindings + Backend

Freeze the 17-field public input ABI and run the issuer HTTP service that serves proof packages and publishes roots.

### Local command sequence

```bash
# Full Phase 2 pipeline
./scripts/dev/demo-phase2.sh
```

Or step by step:

```bash
pnpm gen:bindings
pnpm gen:crypto-fixtures
cargo test -p amoeba-crypto -p amoeba-types -p issuer-service
pnpm test:bindings

# Start issuer service (copy .env.example → .env first)
export ISSUER_STATE_PATH=.amoeba/issuer-state.json
export ISSUER_API_TOKEN=demo-token
cargo run -p issuer-service

# Fetch demo proof package
curl -sf localhost:3000/v1/fixtures/demo-transfer

# Verify public inputs match Phase 1 golden fixture
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
|--------|------|
| GET | `/health` |
| GET | `/v1/fixtures/demo-transfer` |
| GET | `/v1/merkle-path/:wallet` |
| POST | `/v1/roots/publish` (Bearer token) |

Publish roots via service (testnet):

```bash
export ISSUER_API_TOKEN=...
./scripts/dev/publish-roots-via-service.sh
```

## Phase 3 — SDK + Testnet Settlement

Node SDK orchestrates issuer paths → witness → Groth16 prove → Soroban `compliant_transfer`.

### Stage 1 — Blocker gate (run first)

```bash
./scripts/dev/verify-phase3-blockers.sh
# Optional testnet checks (requires funded keys + deploy):
AMOEBA_RUN_TESTNET_BLOCKERS=1 ./scripts/dev/verify-phase3-blockers.sh
```

### Stage 2 — Local SDK demo

```bash
./scripts/dev/demo-phase3.sh
# or: pnpm test:sdk  (with issuer-service running)
```

### Testnet settlement

```bash
./scripts/dev/bootstrap-testnet-demo.sh      # once: keys, mock SAC, fixture, prove, deploy
./scripts/dev/verify-phase3-testnet.sh       # prove → settle → audit → replay rejection
```

### SDK API

```javascript
import { AmoebaClient } from "@amoeba/sdk";

const client = AmoebaClient.fromEnv();
const pkg = await client.issuer.getDemoTransfer();
const proven = await client.prove({ package: pkg });
await client.settleWithKeypair(proven, pkg, senderSecret);
await client.audit(proven.nullifier, senderPublicKey);
```

Testnet fixtures use `AMOEBA_FIXTURE_PROFILE=testnet` and `bindings/fixtures/demo-transfer-testnet.json` (StrKeys + hex payloads).

## Phase 4 — Frontend

Vite + React demo UI over `@amoeba/sdk`: landing (`/`), interactive console (`/demo`), compliance hub (`/compliance`).

### Local command sequence

```bash
# Gate: copy circuit artifacts, build SDK + frontend
./scripts/dev/demo-phase4.sh

# Dev server (proxies /issuer → localhost:3000)
pnpm dev:frontend
```

Set contract IDs in `frontend/.env` (see `frontend/.env.example`). Browser proving serves wasm/zkey from `frontend/public/circuits/` (copied by `demo-phase4.sh`).

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing (zksettle copy, twiin layout) |
| `/demo` | 11-step prove → settle → audit console |
| `/compliance` | Tabs: Proofs · Audit · Corridors |

### E2E

```bash
cd frontend && pnpm build && pnpm test:e2e
```
