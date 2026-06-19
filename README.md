<img src="docs/amoeba-banner.png" width="100%" alt="Amoeba" />

ZK compliance infrastructure for Stellar stablecoins and RWAs.

Verify users once with a trusted issuer, publish compliance roots on-chain, and let apps generate fresh client-side Groth16 proofs for every transfer. Soroban verifies the proof, records the nullifier, and gates settlement — without putting customer documents on-chain.

> **Amoeba is not an anonymity rail.** Sender, recipient, asset, and amount remain public on-chain. The ZK proof shows the transfer is *compliant* without exposing the sender's identity data.

---

## Deployed on Stellar Testnet

| Resource | Value |
| -------- | ----- |
| **Network** | Stellar Testnet (`Test SDF Network ; September 2015`) |
| **RPC** | `https://soroban-testnet.stellar.org` |
| **Explorer** | [stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet) |
| **Verifier** | `CDOGTUWS2UUAO3QEPDTCJTITSICBFRHRYUO7NH54YYIQXJFELARPW6UQ` |
| **Compliance** | `CDRMPTRCZWP5BHYDKCHTCVNN4Y7MOYQ6MEGKY2DWX5N4GLZJWUZ6DCVL` |
| **Circle USDC SAC** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| **VK hash** | `c127f452225fb4101464e2dc7e54ab3940ccf17197654dc1a0e95fef65c94875` |

Contract IDs are written to `.amoeba/*.env` after deploy. See [`scripts/deploy/`](scripts/deploy/) for redeploy.

---

## Architecture

### Compliance Proof Flow

```
Trusted issuer
  |-- verifies user once (off-chain KYC)
  |-- publishes merkle / sanctions / jurisdiction / corridor roots on-chain
  v
Browser prover
  |-- fetches proof package from issuer-service
  |-- builds witness via @amoeba_/js
  |-- generates Groth16 proof (BN254, 17 public inputs)
  v
Soroban compliance contract
  |-- rebinds 17 public inputs to transfer params
  |-- verifies Groth16 proof via verifier contract
  |-- records nullifier (anti-replay)
  |-- executes compliant SAC transfer
```

### Frontend → SDK → Contracts

```
Frontend (React 19 + Vite + Tailwind 4)
  |  /           landing — prove once, settle forever
  |  /demo       11-step prove → settle → audit console
  |  /compliance Proofs · Audit · Corridors tabs
  v
@amoeba_/sdk (TypeScript)
  |-- issuer client → proof package + merkle paths
  |-- witness + Groth16 prove (snarkjs, browser or Node)
  |-- SAC approve + compliant_transfer settle
  |-- nullifier audit + root event parsing
  v
issuer-service (Rust, :3000)
  |-- GET  /v1/fixtures/demo-transfer
  |-- GET  /v1/merkle-path/:wallet
  |-- POST /v1/admin/roots/publish
  v
Soroban contracts (Rust no_std)
  verifier (Groth16 verify) → compliance (nullifier + SAC gate)
```

### What One Proof Covers (8 checks)

| # | Check | Purpose |
|---|-------|---------|
| 1 | Merkle membership | Sender is in the issuer KYC tree |
| 2 | Nullifier binding | Each transfer is anti-replay bound |
| 3 | Sanctions exclusion | Sender is not in the sanctions tree |
| 4 | Jurisdiction | Sender jurisdiction is allowed |
| 5 | Credential expiry | KYC credential is still valid |
| 6 | Corridor source | Sender fits corridor source rules (e.g. US) |
| 7 | Corridor destination | Recipient is in corridor destination registry (e.g. MX) |
| 8 | Corridor binding | Corridor config hash matches on-chain state |

### Proof Cascade

```
issuer-service.getDemoTransfer()
     |
     v
@amoeba_/js buildWitnessInput (Poseidon2, Merkle, nullifier)
     |
     v
snarkjs Groth16 prove (compliance_corridor.wasm + zkey)
     |
     v
compliance.compliant_transfer(proof, 17 public inputs)
     |-- verifier.verify_proof()
     |-- nullifier.insert(nullifier)  [reject if seen]
     |-- sac.transfer_from(sender, recipient, amount)
     |
     v
audit(nullifier) — on-chain attestation lookup
```

**8 compliance checks** · **17 public inputs** · **Groth16 BN254** · **Poseidon2 t=4** · **20-level Merkle/SMT**

### Directory Structure

```
amoeba/
├── backend/
│   ├── programs/         # Soroban verifier + compliance contracts
│   └── crates/           # amoeba-crypto, amoeba-types, issuer-service
├── circuits/circom/      # Circom circuit, fixtures, ceremony tooling
├── bindings/             # Canonical ABI, generated clients, JSON fixtures
├── packages/amoeba-js/   # @amoeba_/js — Poseidon2, Merkle, witness
├── sdk/                  # @amoeba_/sdk — prove, settle, audit
├── issuer-sdk/           # @amoeba_/issuer-sdk — issuer-side client
├── frontend/             # @amoeba_/web — landing, demo, compliance hub
├── scripts/              # dev, deploy, ceremony, publish
└── docs/                 # Banner and design docs
```

---

## Key Features

- **Verify once, prove per transfer** — issuer KYC tree + client-side Groth16; no PII on-chain
- **8-in-1 compliance circuit** — sanctions, jurisdiction, expiry, corridor binding in one proof
- **Soroban-native verifier** — Groth16 verified in-contract; nullifier anti-replay
- **Travel-rule corridors** — US→MX and extensible corridor config hashes
- **Full TypeScript stack** — `@amoeba_/js`, `@amoeba_/sdk`, `@amoeba_/issuer-sdk`
- **Ceremony-ready** — multi-party trusted setup scripts + VK drift checks in CI

---

## Tech Stack

| Layer | Stack |
| ----- | ----- |
| **Frontend** | Vite 6, React 19, Tailwind 4, framer-motion, GSAP |
| **Contracts** | Soroban SDK 25, Rust `no_std`, release LTO |
| **ZK** | Circom 2.2.3, snarkjs, Groth16, BN254, Poseidon2 |
| **Backend** | Rust issuer-service (Axum) |
| **SDKs** | `@amoeba_/js`, `@amoeba_/sdk`, `@amoeba_/issuer-sdk` |
| **Settlement** | Stellar SAC + Soroban `compliant_transfer` |
| **Design** | Font: Space Grotesk. Primary: `#141812`, Accent: `#B7E7FF` |

---

## Local Development

### Prerequisites

- Rust 1.94+
- Node 25+
- `pnpm`
- Stellar CLI 25+
- circom 2.2.3
- snarkjs 0.7+
- `cargo install soroban-verifier-gen`

### Key commands

| Command | Description |
| ------- | ----------- |
| `pnpm compile:circuit` | Compile Circom circuit |
| `pnpm setup:circuit` | One-person trusted setup |
| `pnpm gen:bindings` | Regenerate ABI bindings |
| `pnpm gen:crypto-fixtures` | Regenerate crypto/address fixtures |
| `pnpm prove` / `pnpm verify` | Local prove + snarkjs verify |
| `pnpm build:frontend` | Production frontend build |
| `pnpm ceremony:init` | Initialize multi-party ceremony |

### Environment

**Frontend** (`frontend/.env` — copy from `frontend/.env.example`):

```bash
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_VERIFIER_CONTRACT_ID=
VITE_COMPLIANCE_CONTRACT_ID=
VITE_SAC_CONTRACT_ID=
VITE_ISSUER_PUBLIC_KEY=
VITE_ISSUER_URL=/issuer          # dev proxy → localhost:3000
```

**Issuer service**:

```bash
export ISSUER_STATE_PATH=.amoeba/issuer-state.json
export ISSUER_API_TOKEN=demo-token
cargo run -p issuer-service       # :3000
```

**Testnet deploy** (requires funded `amoeba-admin` identity):

```bash
export NETWORK=testnet
export SOURCE=amoeba-admin
./scripts/deploy/deploy-verifier.sh
./scripts/deploy/deploy-compliance.sh
./scripts/deploy/setup-sac.sh
./scripts/deploy/publish-roots.sh
```

---

## SDK Usage

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

Testnet fixtures: `AMOEBA_FIXTURE_PROFILE=testnet` and `bindings/fixtures/demo-transfer-testnet.json`.

---

## Public Inputs (17 fields)

Canonical ABI: [`bindings/public-inputs.json`](bindings/public-inputs.json). See [`bindings/README.md`](bindings/README.md).

| Index | Field |
| ----: | ----- |
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

**snarkjs → Soroban encoding:** G1 uses 32-byte big-endian `x || y` (no ark flags). G2 uses `x_c1 || x_c0 || y_c1 || y_c0` per snarkjs `pi_b` rows. Verifier negates `pi_a` internally.

---

## Issuer Service

| Method | Path |
| ------ | ---- |
| GET | `/health` |
| GET | `/v1/fixtures/demo-transfer` |
| GET | `/v1/merkle-path/:wallet` |
| POST | `/v1/admin/roots/publish` (Bearer token) |

```bash
export ISSUER_API_TOKEN=...
./scripts/dev/publish-roots-via-service.sh
```

---

## Trust & Security

- **Regulated compliance, not privacy** — transfer parties and amounts are public; proof attests compliance without PII
- **Nullifier anti-replay** — each proof binds a unique nullifier recorded on-chain
- **VK drift checks** — CI verifies verifier hash matches ceremony artifacts
- **Admin-guarded contracts** — pausable, event-emitting Soroban programs
- **SAC bypass caveat** — direct SAC transfers can bypass Amoeba unless issuer authorization is configured; demo uses approve + `transfer_from` via compliance contract
- **Mainnet ceremony gate** — `setup.sh` is not a mainnet ceremony; requires multi-party phase 2 with `published: true` and `verifier_contract_synced: true` in `circuits/circom/artifacts/ceremony/manifest.json`

Launch runbooks: [`scripts/deploy/`](scripts/deploy/) and [`scripts/dev/`](scripts/dev/).

---

## Packages

| Package | Description |
| ------- | ----------- |
| [`@amoeba_/js`](packages/amoeba-js/) | Poseidon2, Merkle, nullifier, witness builder |
| [`@amoeba_/sdk`](sdk/) | Prove, settle, audit on Stellar |
| [`@amoeba_/issuer-sdk`](issuer-sdk/) | Issuer-side HTTP client |
| [`@amoeba_/web`](frontend/) | Demo UI (private workspace package) |

```bash
./scripts/publish/publish-packages.sh --dry-run
```

---

## License

MIT — see [LICENSE](LICENSE).
