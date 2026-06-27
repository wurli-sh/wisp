# backend/crates/issuer-service

Off-chain issuer backend service — manages identity trees, generates Merkle proofs, serves proof packages via HTTP.

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | None | |
| GET | `/.well-known/wisp-issuer.json` | None | Canonical metadata (no `api_version`/`proof_package_schema` — use `issuer_mode` + `issuance_available`) |
| GET | `/credentials/:wallet` | None | Credential lookup |
| POST | `/credentials/activation-challenges` | None | Wallet-bound activation challenge |
| POST | `/credentials/activate` | None | Activate credential with signed challenge |
| POST | `/proof-packages/challenges` | None | Per-transfer proof challenge |
| POST | `/proof-packages` | None | Returns `ProofPackageDraft` (no nullifier) from signed challenge |
| GET | `/corridors` | None | List all corridors |
| GET | `/corridors/:id` | None | Corridor detail |
| POST | `/admin/roots/publish` | Bearer token | Publish roots on-chain |
| GET | `/admin/roots/computed` | Bearer token (`?corridor_id=`) | Computed roots |
| GET | `/admin/roots/latest` | Bearer token | Latest on-chain root snapshot |

Production mode (`ISSUER_MODE=production`): mock-KYC, provider webhooks, and SEP-10 auth routes return 503. Only canonical issuance endpoints are mounted.

## Env

| Variable | Default | Description |
|----------|---------|-------------|
| `ISSUER_LISTEN_ADDR` | `127.0.0.1:3000` | HTTP listen address |
| `ISSUER_REQUIRE_DB` | — | When `1` (or `WISP_ENV=production`), fail startup if Postgres is unset or unreachable |
| `WISP_ENV` | — | Set to `production` on Render/deployed hosts |
| `ISSUER_STATE_PATH` | `.wisp/issuer-state.json` | JSON snapshot for memory store (users, KYC, roots) |
| `SUPABASE_DB_URL` | — | Postgres persistence (preferred over file snapshot) |
| `DATABASE_URL` | — | Alias for `SUPABASE_DB_URL` |
| `ISSUER_API_TOKEN` | — | Bearer token for root publishing |
| `ISSUER_MODE` | — | `demo` or `production` (disables mock-KYC and provider webhooks) |
| `ISSUER_PUBLIC_KEY` | — | Issuer Stellar public key |
| `ISSUER_PUBLIC_URL` | — | Public base URL for `metadata_uri` in well-known endpoint |
| `KYC_MODE` | `sep10` | `sep10` (default) or `mock` (local demo only) |
| `WEB_AUTH_DOMAIN` | — | SEP-10 challenge auth domain (must match wallet expectations) |
| `HORIZON_URL` | `https://horizon-testnet.stellar.org` | Horizon endpoint for SEP-10 account-sequence lookups |
| `EXPECTED_VK_HASH` | — | Optional CI drift guard: verify VK hash on startup |
| `ADMIN_PUBLIC_KEY` | — | Admin Stellar public key (for admin-signed root publish) |
| `ADMIN_SECRET_KEY` | — | Admin Stellar secret key |
| `ISSUER_SECRET_KEY` | — | Issuer Stellar secret key |
| `PUBLISH_SOURCE_ACCOUNT` | — | Stellar CLI `--source-account` identity name or S-key |
| `STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Network passphrase |
| `COMPLIANCE_CONTRACT_ID` | — | Deployed compliance contract ID |
| `WISP_FIXTURES_DIR` | `../../../bindings/fixtures` (relative to crate) | Fixture directory path |
| `WISP_FIXTURE_PROFILE` | `local` | Fixture profile (`local` / `testnet`) |

## Modules

| Module | Description |
|--------|-------------|
| `routes` | Axum route handlers (v1-less paths, credential activation, proof challenges) |
| `state` | Store layer: Postgres > file snapshot (`ISSUER_STATE_PATH`) > memory |
| `memory_snapshot` | Atomic JSON load/save for local memory store |
| `trees` | Identity/SMT merkle tree management |
| `issuance` | Wallet-bound credential activation, challenge-based proof package drafts |
| `auth` | Bearer token middleware |
| `stellar` | Soroban contract interaction |
| `config` | Env-based configuration |
| `mock_kyc` | Mock KYC challenge/response for demo flows (disabled in production) |
| `log_util` | Logging utilities and structured event emission |

## Migrations

| File | Purpose |
|------|---------|
| `migrations/001_supabase_issuer.sql` | Supabase schema for issuer state persistence |
| `migrations/002_mock_kyc_challenges.sql` | Mock KYC challenge table for demo |
| `migrations/003_root_snapshots_compliance_contract.sql` | Root snapshots with compliance contract ID tracking |
| `migrations/004_credential_activation.sql` | Activated credentials + issuance challenge tables |
