<img src="docs/wisp-banner.png" width="100%" alt="Wisp" />


Verify users once with a trusted issuer, publish compliance roots on-chain, and generate client-side Groth16 proofs per transfer. Soroban verifies the proof, records the nullifier, and gates settlement — no customer documents on-chain.

---

## Deployments

| Resource | Value |
| -------- | ----- |
| Frontend | [wisp-zk.vercel.app](https://wisp-zk.vercel.app/) — `/` · `/wisp-pay` · `/demo` |
| Issuer API | [wisp-issuer-vekn.onrender.com](https://wisp-issuer-vekn.onrender.com) |
| Network | `Test SDF Network ; September 2015` |
| RPC | `https://soroban-testnet.stellar.org` |
| Explorer | [stellar.expert/testnet](https://stellar.expert/explorer/testnet) |
| Verifier | `CBOQVGV7SIFNBDM26GFFAHWQ6DKUBAX4K2OR44KEWJJCYQH4SJL3G2AG` |
| Compliance | `CBN7EJWN6BDGBAKT3MMSHLMTXCKDLXRSPD2XMQYSR3KWCUBRU5PT5CH4` |
| Circle USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| VK hash | `3325bfff94f2c530d199c35575dc45cd3e27f752d9402d17e6d64341d3f3f6ae` |
| Deploy ledger | `3188535` |

Contract IDs → `.wisp/*.env` · redeploy [`scripts/deploy/`](scripts/deploy/) · config [`frontend/.env.example`](frontend/.env.example)

---

## Published Packages

<img src="docs/portable-sdk.png" width="100%" alt="Wisp works alongside your issuer." />

Plug-and-play npm packages — install, configure env, run.

| Package | Version | Purpose | README |
| ------- | ------- | ------- | ------ |
| `@wisp_/js` | `0.2.0` | Poseidon2, Merkle, nullifier, witness builder | [`packages/wisp-js/README.md`](packages/wisp-js/README.md) |
| `@wisp_/compliance` | `0.2.0` | Generated client for the compliance contract | [`bindings/README.md`](bindings/README.md) |
| `@wisp_/verifier` | `0.2.0` | Generated client for the Groth16 verifier contract | [`bindings/README.md`](bindings/README.md) |
| `@wisp_/bindings` | `0.2.0` | Canonical proof package + public input ABI | [`bindings/README.md`](bindings/README.md) |
| `@wisp_/sdk` | `0.2.0` | Prove, settle, audit compliant transfers | [`sdk/README.md`](sdk/README.md) |
| `@wisp_/issuer-sdk` | `0.2.0` | Register issuers, publish roots on-chain | [`issuer-sdk/README.md`](issuer-sdk/README.md) |

Install: `npm install @wisp_/sdk @wisp_/js` · demo UI: [`frontend/`](frontend/) (workspace-only) · dry-run: `./scripts/publish/publish-packages.sh --dry-run`

## Core Architecture

```
Issuer (off-chain KYC)
  → publishes merkle / sanctions / jurisdiction / corridor roots on-chain
Browser / Node prover
  → fetches proof package → witness (@wisp_/js) → Groth16 (17 public inputs)
Soroban compliance contract
  → rebinds public inputs → verifies via verifier → nullifier → SAC transfer
```

```
frontend/          React demo UI (landing, Wisp Pay, technical demo)
  ↓
@wisp_/sdk       issuer client · prove · settle · audit
  ↓
issuer-service     proof packages · merkle paths · root publish
  ↓
Soroban            verifier (Groth16) → compliance (nullifier + SAC gate)
```

```
wisp/
├── backend/           Soroban contracts + issuer-service
├── circuits/circom/   Circom circuit + ceremony
├── bindings/          Canonical ABI + generated clients
├── packages/wisp-js/
├── sdk/
├── issuer-sdk/
├── frontend/
└── scripts/           dev · deploy · ceremony
```

---

## ZK Implementation

**Stack:** Groth16 · BN254 · Poseidon2 t=4 · 20-level Merkle/SMT · **17 public inputs**

```
circuits/circom/compliance_corridor.circom
┌──────────────────────────────────────────────────────────────────────────┐
│                           ComplianceCorridor()                           │
│  PUBLIC (17)               │  PRIVATE                                    │
│  roots · nullifier         │  credential_secret · transfer_nonce         │
│  sender/recipient/asset    │  merkle paths + indices (×5 trees)          │
│  amount · epoch · corridor │  jurisdiction · sanctions_leaf              │
├──────────────────────────────────────────────────────────────────────────┤
│  components/  poseidon2 · merkle · smt.circom                            │
├──────────────────────────────────────────────────────────────────────────┤
│ Merkle membership          │ Poseidon2(sender) → MerklePath → root       │
│ Nullifier binding          │ Poseidon2Hash12(domain+transfer ctx)        │
│ Sanctions exclusion        │ SparseMerkleExclusion(sender) → root        │
│ Jurisdiction               │ Poseidon2(jurisdiction) → MerklePath        │
│ Credential expiry          │ timestamp ≤ credential_expiry               │
│ Corridor source            │ jurisdiction → source_jurisdiction_root     │
│ Corridor destination       │ Poseidon2(recipient) → dest_address_root    │
│ Corridor binding           │ corridor_config_hash ↔ on-chain corridor    │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
          proof package ───────────────────────┼─────── @wisp_/js buildWitnessInput
                                     ▼
               witness.json → compliance_corridor.wasm + zkey
                                     │
                                     ▼ snarkjs Groth16.prove (BN254)
                     π_a, π_b, π_c  +  17 public signals
                                     │
                                     ▼ Soroban verifier.verify_proof()
               compliance.compliant_transfer → nullifier → SAC settle
```

Canonical field order: [`bindings/public-inputs.json`](bindings/public-inputs.json) · [`bindings/README.md`](bindings/README.md)

---

## Key Features

- **Wisp Pay** — compliant payment links (fixed payee, any KYC wallet pays); portable `?d=` links; on-chain receipt audit
- **Verify once, prove per transfer** — KYC tree + client-side Groth16; no PII on-chain
- **8-in-1 circuit** — sanctions, jurisdiction, expiry, corridor binding in one proof
- **Soroban-native verifier** — Groth16 in-contract; nullifier anti-replay
- **Travel-rule corridors** — US→MX and extensible corridor config hashes
- **Full TypeScript stack** — `@wisp_/js`, `@wisp_/sdk`, `@wisp_/issuer-sdk`
- **Ceremony-ready** — multi-party setup scripts + VK drift checks in CI

---

## Tech Stack

| Layer | Stack |
| ----- | ----- |
| Frontend | Vite 6, React 19, Tailwind 4, framer-motion, GSAP |
| Contracts | Soroban SDK 25, Rust `no_std`, release LTO |
| ZK | Circom 2.2.3, snarkjs, Groth16, BN254, Poseidon2 |
| Backend | Rust issuer-service (Axum) |
| SDKs | `@wisp_/js`, `@wisp_/sdk`, `@wisp_/issuer-sdk` |
| Settlement | Stellar SAC + `compliant_transfer` |
| Design | Space Grotesk · `#141812` · `#B7E7FF` |

---

## Local Development

**Prerequisites:** Rust 1.94+ · Node 25+ · pnpm · Stellar CLI 25+ · circom 2.2.3 · snarkjs 0.7+ · `cargo install soroban-verifier-gen`

| Command | Description |
| ------- | ----------- |
| `pnpm compile:circuit` | Compile Circom circuit |
| `pnpm setup:circuit` | One-person trusted setup |
| `pnpm build:js` | Build all publishable TypeScript packages |
| `pnpm gen:bindings` | Regenerate ABI bindings |
| `pnpm prove` / `pnpm verify` | Local prove + verify |
| `pnpm dev:frontend` | Demo UI dev server (`/` · `/wisp-pay` Pay Links · `/demo`) |
| `pnpm test:e2e:frontend` | Playwright e2e (Pay Links + demo smoke) |
| `pnpm demo:phase4` | Frontend gate: artifacts + build + e2e |
| `pnpm test:js` | JS test suite |
| `cargo test -p verifier -p compliance` | Contract tests |
| `cargo run -p issuer-service` | Issuer API |
| `./scripts/dev/demo-e2e.sh` | Full local E2E |

---

## Env Setup

Shared deploy state lives in `.wisp/*.env`. SDKs load via `loadWispEnv()`.

**Frontend** — copy [`frontend/.env.example`](frontend/.env.example) → `frontend/.env`:

```bash
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_VERIFIER_CONTRACT_ID=
VITE_COMPLIANCE_CONTRACT_ID=
VITE_SAC_CONTRACT_ID=
VITE_ISSUER_PUBLIC_KEY=
VITE_ISSUER_URL=/issuer          # dev proxy → localhost:3000
```

**SDK / scripts** — key vars:

```bash
STELLAR_RPC_URL=...
COMPLIANCE_CONTRACT_ID=...
VERIFIER_CONTRACT_ID=...
SAC_CONTRACT_ID=...
ISSUER_PUBLIC_KEY=...
ISSUER_URL=http://127.0.0.1:3000
WISP_FIXTURE_PROFILE=testnet    # or local
```

**Testnet deploy** (funded `amoeba-admin` identity):

```bash
export NETWORK=testnet SOURCE=amoeba-admin
./scripts/deploy/deploy-verifier.sh
./scripts/deploy/deploy-compliance.sh
./scripts/deploy/setup-sac.sh
./scripts/deploy/publish-roots.sh
```

---

## Issuer Setup

**Run locally:**

```bash
export ISSUER_STATE_PATH=.wisp/issuer-state.json
export ISSUER_API_TOKEN=demo-token
export COMPLIANCE_CONTRACT_ID=<from .wisp/compliance.env>
export ISSUER_PUBLIC_KEY=<issuer G-address>
cargo run -p issuer-service
```

**Key endpoints:**

| Method | Path |
| ------ | ---- |
| GET | `/health` |
| GET | `/v1/fixtures/demo-transfer` |
| GET | `/v1/merkle-path/:wallet` |
| POST | `/v1/admin/roots/publish` (Bearer) |

**Publish roots:**

```bash
export ISSUER_API_TOKEN=...
./scripts/dev/publish-roots-via-service.sh
```

**On-chain issuer ops** (register issuer, publish roots via contract): see [`issuer-sdk/README.md`](issuer-sdk/README.md).

Production: set `SUPABASE_DB_URL`, `WISP_ENV=production`, `ISSUER_REQUIRE_DB=1`.

---

## Trust & Security

- **Regulated compliance, not privacy** — parties and amounts are public; proof attests compliance without PII
- **Nullifier anti-replay** — unique nullifier recorded on-chain per proof
- **VK drift checks** — CI verifies verifier hash matches ceremony artifacts
- **Admin-guarded contracts** — pausable, event-emitting Soroban programs
- **SAC bypass caveat** — direct SAC transfers can bypass Wisp unless issuer authorization is enforced; demo uses approve + `transfer_from`
- **Mainnet ceremony gate** — requires multi-party phase 2 with `published: true` and `verifier_contract_synced: true` in ceremony manifest

Runbooks: [`scripts/deploy/`](scripts/deploy/) · [`scripts/dev/`](scripts/dev/)
