# Wisp

ZK compliance infrastructure for Stellar stablecoins and RWAs. Groth16 proofs verified in Soroban contracts.

Users complete KYC once with a trusted issuer, then generate client-side Groth16 proofs that simultaneously prove: KYC completion, non-sanctions status, jurisdiction eligibility, credential validity, corridor-specific travel rule conformance (e.g. US→MX), and recipient eligibility — all without exposing any PII on-chain.

**This is NOT anonymous/private transfers.** Wisp enforces regulated compliance. The sender, recipient, asset, and amount are public on-chain. The ZK proof shows these parameters are *compliant* without revealing the sender's identity data. Optional privacy pools add hidden amounts/addresses after compliance is proven.

## What Wisp Proves (8 checks in one circuit)

| # | Check | Purpose |
|---|-------|---------|
| 1 | Merkle membership | Sender's address is in the issuer's KYC'd-user tree |
| 2 | Nullifier binding | Each transfer gets a unique nullifier (anti-replay) |
| 3 | Sanctions exclusion | Sender is NOT in the OFAC sanctions tree |
| 4 | Jurisdiction | Sender's KYC'd jurisdiction is allowed |
| 5 | Credential expiry | KYC credential hasn't expired |
| 6 | Corridor source | Sender's jurisdiction matches corridor source (e.g. US) |
| 7 | Corridor destination | Recipient is in corridor's destination registry (e.g. MX) |
| 8 | Corridor binding | Corridor config hash matches on-chain state |

## Architecture

- **circuits/circom/** — BN254 Groth16 circuit with Poseidon2, 8 compliance checks, 17 public inputs
- **backend/programs/** — Soroban smart contracts (verifier, compliance, mock-sac)
- **backend/crates/** — Rust crates for off-chain crypto, types, and issuer service
- **bindings/** — Canonical ABI, generated contract clients, shared JSON fixtures
- **packages/wisp-js/** — Shared JS crypto (`@wisp_/js`: Poseidon2, Merkle, field ops, nullifier, witness)
- **sdk/** — TypeScript SDK (`@wisp_/sdk`) for proving, settling, and auditing compliant transfers
- **issuer-sdk/** — Issuer-side TypeScript SDK (`@wisp_/issuer-sdk`) for integration
- **scripts/** — deploy, dev, fixture, and ceremony tooling
- **frontend/** — Vite demo UI (`@wisp_/web`: landing, `/demo`, `/compliance`)
- **docs/** — Design notes, gap analyses, and planning documents

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm compile:circuit` | Compile Circom circuit |
| `pnpm setup:circuit` | One-person trusted setup |
| `pnpm build:js` | Build compliance client, `@wisp_/js`, `@wisp_/sdk` |
| `pnpm gen:fixtures` | Generate witness fixtures |
| `pnpm gen:bindings` | Regenerate ABI bindings from source |
| `pnpm gen:crypto-fixtures` | Regenerate crypto/address fixtures |
| `pnpm gen:testnet-fixture` | Generate testnet-specific fixture |
| `pnpm prove` | Generate proof from input |
| `pnpm verify` | Snarkjs local verification |
| `pnpm test:circuit` | Node circuit tests |
| `pnpm test:bindings` | Binding ABI + circuit-abi drift tests |
| `pnpm test:witness` | `@wisp_/js` witness tests |
| `pnpm test:sdk` | SDK unit tests |
| `pnpm test:js` | All JS tests (witness + sdk + bindings + issuer-sdk) |
| `pnpm test:issuer-sdk` | Issuer SDK unit tests |
| `pnpm test:issuer-conformance` | Issuer API conformance test suite |
| `pnpm test:ceremony` | Ceremony gate tests |
| `pnpm verify:phase3-blockers` | Phase 3 pre-flight blocker checks |
| `pnpm demo:phase3` | Phase 3 demo (blockers + SDK prove) |
| `pnpm demo:phase4` | Phase 4 gate: circuit artifacts + frontend build + Pay Links e2e |
| `./scripts/publish/publish-packages.sh --dry-run` | npm publish dry-run for all `@wisp_/*` packages |
| `./scripts/publish/publish-packages.sh` | npm publish (see `scripts/publish/CLAUDE.md`) |
| `cargo test -p verifier -p compliance` | Contract unit tests |
| `cargo test -p wisp-crypto -p wisp-types -p issuer-service` | Backend crate tests |
| `./scripts/dev/demo-e2e.sh` | Full local E2E pipeline |
| `./scripts/dev/demo-phase2.sh` | Full Phase 2 pipeline (bindings + issuer) |
| `./scripts/dev/verify-testnet.sh` | Phase 0 gate check |
| `./scripts/dev/verify-compliance-testnet.sh` | Phase 1 testnet gate |
| `./scripts/dev/verify-phase3-testnet.sh` | Full Phase 3 testnet gate check |
| `pnpm dev:frontend` | Wisp demo UI dev server |
| `pnpm ceremony:init` | Initialize multi-party ceremony |
| `pnpm ceremony:verify` | Verify ceremony transcript |
| `pnpm ceremony:sync` | Sync verifier from ceremony final zkey |
| `pnpm ceremony:publish` | Publish ceremony evidence |
| `./circuits/circom/scripts/compute-vk-hash.py` | Compute VK hash for drift check |

## Conventions

- Rust: `#![no_std]`, Soroban SDK 25.1.0, release profile with LTO
- Circom: BN254, Poseidon2 t=4, 20-level Merkle/SMT depth
- TypeScript: strict `tsc` → `dist/` for `@wisp_/js` and `@wisp_/sdk`; dev scripts via `tsx`
- Node 25 for CI and local JS builds (see `.nvmrc`)
- Tests: Rust doc tests + snapshot tests, Node `.test.ts`, shell fixture validation
- Git: meaningful commits, no build artifacts committed
- Contracts: admin-guarded, pausable, event-emitting
- Bindings: ABI frozen in `bindings/public-inputs.json`, drift-checked in CI
