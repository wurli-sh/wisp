# backend/crates/issuer-service

Off-chain issuer backend service — manages identity trees, generates Merkle proofs, serves proof packages via HTTP.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | None |
| GET | `/v1/fixtures/demo-transfer` | None |
| GET | `/v1/credential/:wallet` | None |
| GET | `/v1/merkle-path/:wallet` | None |
| GET | `/v1/jurisdiction-path/:jurisdiction` | None |
| GET | `/v1/sanctions-path/:wallet` | None |
| GET | `/v1/dest-path/:corridor_id/:address` | None |
| GET | `/v1/corridor/:id` | None |
| POST | `/v1/credentials` | Bearer token |
| POST | `/v1/admin/roots/publish` | Bearer token |
| GET | `/v1/admin/roots/computed` | Bearer token (`?corridor_id=`) |
| GET | `/v1/admin/roots/latest` | Bearer token |

## Env

| Variable | Default | Description |
|----------|---------|-------------|
| `ISSUER_LISTEN_ADDR` | `127.0.0.1:3000` | HTTP listen address |
| `ISSUER_REQUIRE_DB` | — | When `1` (or `AMOEBA_ENV=production`), fail startup if Postgres is unset or unreachable |
| `AMOEBA_ENV` | — | Set to `production` on Render/deployed hosts |
| `ISSUER_STATE_PATH` | `.amoeba/issuer-state.json` | JSON snapshot for memory store (users, KYC, roots) |
| `SUPABASE_DB_URL` | — | Postgres persistence (preferred over file snapshot) |
| `DATABASE_URL` | — | Alias for `SUPABASE_DB_URL` |
| `ISSUER_API_TOKEN` | — | Bearer token for root publishing |
| `ISSUER_PUBLIC_KEY` | — | Issuer Stellar public key |
| `ADMIN_PUBLIC_KEY` | — | Admin Stellar public key (for admin-signed root publish) |
| `ADMIN_SECRET_KEY` | — | Admin Stellar secret key |
| `ISSUER_SECRET_KEY` | — | Issuer Stellar secret key |
| `PUBLISH_SOURCE_ACCOUNT` | — | Stellar CLI `--source-account` identity name or S-key |
| `STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Network passphrase |
| `COMPLIANCE_CONTRACT_ID` | — | Deployed compliance contract ID |
| `AMOEBA_FIXTURES_DIR` | `../../../bindings/fixtures` (relative to crate) | Fixture directory path |
| `AMOEBA_FIXTURE_PROFILE` | `local` | Fixture profile (`local` / `testnet`) |

## Modules

| Module | Description |
|--------|-------------|
| `routes` | Axum route handlers |
| `state` | Store layer: Postgres > file snapshot (`ISSUER_STATE_PATH`) > memory |
| `memory_snapshot` | Atomic JSON load/save for local memory store |
| `trees` | Identity/SMT merkle tree management |
| `auth` | Bearer token middleware |
| `stellar` | Soroban contract interaction |
| `config` | Env-based configuration |
| `mock_kyc` | Mock KYC challenge/response for demo flows |
| `log_util` | Logging utilities and structured event emission |

## Migrations

| File | Purpose |
|------|---------|
| `migrations/001_supabase_issuer.sql` | Supabase schema for issuer state persistence |
| `migrations/002_mock_kyc_challenges.sql` | Mock KYC challenge table for demo |
| `migrations/003_root_snapshots_compliance_contract.sql` | Root snapshots with compliance contract ID tracking |
