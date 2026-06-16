# Frontend-Driven Mock KYC for Stellar Wallets

## Summary
Implement a single-phase mock KYC system for demos where a frontend user completes KYC once for their Stellar wallet, the backend verifies wallet ownership, stores the canonical KYC result in Supabase, and then uses that backend state for issuer eligibility, root publication, and proof-package creation.

This phase replaces external KYC-provider work with a demo-safe `mock` provider while preserving the real issuer architecture:
- frontend initiates KYC
- backend verifies wallet ownership with a minimal SEP-10-shaped challenge (see §2)
- backend stores canonical issuer user + credential records in Supabase
- proof eligibility reads only backend state
- root publication remains a manual operator step

## Locked decisions
- **wallet auth:** minimal SEP-10-shaped challenge tx + Ed25519 signature verify in Rust (`stellar-xdr` + `ed25519-dalek`); not full SEP-10 spec compliance in this phase
- **wallet format:** public API accepts/returns G-address strkeys; DB stores 32-byte hex via existing `strkey_to_payload` / `payload_to_hex`
- **frontend form:** name, country, DOB, sanctions checkbox
- **approval rules:** country must be `US`; sanctions checkbox must be clear; DOB must be ≥ 18 years (server UTC); `credential_expiry` = `now + 1 year`
- **credential secret:** fixed `424242` for all mock users; never rotated after first approval (nullifier stability)
- **one-time semantics:** first approval persists until revoked; re-submit returns `already_approved` without DB write
- **rejection semantics:** insert `issuer_users` with `enabled=false`, no `issuer_credentials` row; audit payload in `metadata` + `webhook_events`
- **fixture seed:** seed corridors and destinations only on empty DB; no pre-approved fixture users when mock KYC is active
- **root publish:** manual operator action after approval
- **challenge TTL:** 5 minutes, single-use; bound to `NETWORK_PASSPHRASE` from config
- **do not** use `POST /v1/provider/webhooks/mock` as a demo shortcut — no wallet verification on that path

## Key Changes

### 1. Mock KYC provider model
- Treat mock KYC as a first-class provider source with `provider = "mock"`.
- Store the result in the existing canonical issuer tables:
  - `issuer_users`
  - `issuer_credentials` (approved only)
  - `webhook_events` for mock submit audit (`event_key` = challenge id)
- Persist mock metadata in `issuer_users.metadata` jsonb:
  - `wallet_strkey` (original G-address)
  - `full_name`
  - `country`
  - `date_of_birth`
  - `sanctions_declaration`
  - `kyc_status` (`approved` | `rejected`)
  - `corridor_eligibility` (e.g. `[1]` for US-MX demo)
  - `submitted_at`, `approved_at` / `rejected_at`
- On approval, set `jurisdiction = "US"`, `jurisdiction_code = 840`, `sanctions_clear = true`, `enabled = true`.
- Keep the backend as the system of record; frontend never becomes the source of truth.

### 2. Wallet ownership verification
- Add a public challenge flow for Stellar/Freighter:
  - `POST /v1/mock-kyc/challenge`
  - `POST /v1/mock-kyc/submit`
  - `GET /v1/mock-kyc/status/:wallet`
- **Implementation approach (Option A — minimal demo challenge):**
  - backend builds a Stellar transaction envelope with a `ManageData` op bound to wallet + nonce
  - challenge bound to `NETWORK_PASSPHRASE`, wallet strkey, and short expiry
  - frontend asks Freighter to sign the XDR
  - backend verifies Ed25519 signature over tx hash, expiry, replay protection, and wallet binding
  - production would upgrade to full SEP-10; this phase is SEP-10-shaped only
- **Challenge persistence** — new table `mock_kyc_challenges` (and equivalent `MemoryStore` map for dev):
  - `id`, `wallet_hex`, `challenge_xdr`, `nonce`, `expires_at`, `consumed_at`, `created_at`
  - lookup by `nonce` or `id`; mark `consumed_at` on successful submit
- Challenge records are short-lived (5 min) and single-use.
- Replayed, expired, or mismatched signatures return `401` / `409`.
- Basic rate limiting on challenge + submit endpoints (per-wallet throttle).

### 3. Frontend mock KYC UX
- Add a KYC section to the demo frontend as **step 0**, before transfer prove/settle.
- Flow:
  1. connect wallet
  2. `GET /v1/mock-kyc/status/:wallet` — show current state
  3. if not approved: request challenge → sign in Freighter → submit form
  4. form fields: `name`, `country`, `dob`, `sanctions_clear`
  5. receive immediate `approved` / `rejected` / `already_approved`
  6. gate "Fetch package" until status shows KYC approved
- If wallet is already approved, show persistent approved state; skip onboarding form.
- After KYC approved, `createDemoTransfer` / `createProofPackage` uses **connected wallet** as `sender_strkey` (not fixture sender).
- Show operator checklist when proof is blocked: destination approved? roots published?
- SDK additions: `requestMockKycChallenge`, `submitMockKyc`, `getMockKycStatus` on `IssuerClient`.
- No admin token or backend secret is ever exposed to the frontend.

### 4. Approval and persistence rules
- **One time:**
  - submit handler looks up existing user by `wallet_hex`
  - if `enabled && sanctions_clear && provider == "mock"` → return `{ status: "already_approved" }` with no DB write
  - first successful approval persists until admin revocation
  - `credential_secret` is never updated on conflict for approved wallets
- **Deterministic approval rules (all must pass):**
  - `country` (case-insensitive) must be `US` — required for US-MX corridor circuit witness
  - `sanctions_clear` must be `true`
  - `dob` must indicate age ≥ 18 (computed vs server UTC date)
- **Rejected submission:**
  - upsert `issuer_users` with `enabled=false`, `sanctions_clear=false`, `provider="mock"`
  - do **not** create or update `issuer_credentials`
  - write audit row to `webhook_events` with full form payload
  - return `{ status: "rejected", reason: "..." }`
- Revocation remains `PATCH /v1/admin/users/{id}` with `enabled: false` — not frontend self-service.

### 5. Issuer eligibility and root flow
- Proof-package generation continues to read only canonical backend state via `create_proof_package`.
- Successful mock KYC alone is not enough for settlement; all conditions still apply:
  - enabled user + active credential
  - enabled corridor
  - recipient in `corridor_destinations` (operator adds via admin API)
  - on-chain roots published (`POST /v1/admin/roots/publish`)
- **API does not pre-check** credential expiry or jurisdiction-vs-corridor match; circuit enforces these at prove time. Status endpoint may surface warnings in `missing[]`.
- Root publication stays manual; no auto-publish on mock KYC approval.
- Revoked wallets fail proof-package generation after state update and next publish cycle.

### 6. Fixture seed strategy
- On empty DB boot: seed **corridors** and **corridor_destinations** from `demo-users.json`; do **not** seed `issuer_users` or `issuer_credentials`.
- Remove reliance on hardcoded fixture hex wallet for demo sender; users onboard via mock KYC.
- CI/tests may still insert fixture users directly in test setup (not via boot seed).

## Public Interfaces

### New endpoints
| Method | Path | Auth |
|--------|------|------|
| POST | `/v1/mock-kyc/challenge` | None |
| POST | `/v1/mock-kyc/submit` | None |
| GET | `/v1/mock-kyc/status/:wallet` | None |

### Unchanged
- `GET /v1/corridors`, `POST /v1/proof-packages`
- `GET /v1/credential/:wallet` — witness/credential fields only; not KYC lifecycle
- Admin: users, corridors, destinations, roots

**Do not** route mock KYC through `POST /v1/provider/webhooks/{provider}`.

### Request / response contracts

`POST /v1/mock-kyc/challenge`
```json
// request
{ "wallet": "G..." }

// response
{ "challenge_id": "uuid", "challenge_xdr": "...", "expires_at": 1718650000 }
```

`POST /v1/mock-kyc/submit`
```json
// request
{
  "challenge_id": "uuid",
  "signed_challenge_xdr": "...",
  "name": "Jane Doe",
  "country": "US",
  "dob": "1990-01-15",
  "sanctions_clear": true
}

// response
{ "status": "approved" | "rejected" | "already_approved", "reason": "optional string" }
```

`GET /v1/mock-kyc/status/:wallet` (`:wallet` = G-address strkey)
```json
{
  "wallet": "G...",
  "kyc_status": "none" | "approved" | "rejected" | "revoked",
  "eligible_for_proof": false,
  "missing": ["kyc", "destination", "roots_published"]
}
```

`missing` values:
- `kyc` — no approved mock KYC user/credential
- `destination` — recipient not in corridor destinations
- `roots_published` — no successful root snapshot (best-effort check)
- `corridor` — no enabled corridor configured

## Database migration

Add to `001_supabase_issuer.sql` (or `002_mock_kyc_challenges.sql`):

```sql
create table if not exists mock_kyc_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_hex text not null,
  challenge_xdr text not null,
  nonce text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mock_kyc_challenges_wallet_hex_idx on mock_kyc_challenges (wallet_hex);
```

## Test Plan

### Wallet auth
- valid challenge signature succeeds
- invalid signature → 401
- expired challenge → 401
- replayed challenge (second submit) → 409
- wallet mismatch (signer ≠ requested wallet) → 401
- strkey checksum / invalid G-address → 400

### Mock KYC state
- first approved submission creates `issuer_users` + `issuer_credentials` with `credential_secret = "424242"`
- re-submit after approval returns `already_approved`; `credential_secret` unchanged
- rejected submission: user row `enabled=false`, no credential row
- revoked wallet (`enabled=false` via admin) → `kyc_status: revoked`, proof-package fails
- US country approved; non-US (e.g. `MX` as sender country) → rejected

### API behavior
- `GET /v1/mock-kyc/status/:wallet` reflects backend truth; `missing[]` accurate
- `POST /v1/proof-packages` fails before approval
- succeeds only after approval + destination + roots published
- `GET /v1/credential/:wallet` still returns witness fields for approved users

### Memory store parity
- challenge create/consume/replay rejection works without Supabase

### Integration / manual
- connect → challenge → Freighter sign → submit mock KYC → Supabase record → operator adds destination → manual root publish → proof package → prove → settle
- revoke wallet → proof-package fails after state change and publish cycle

## Implementation order
1. Migration: `mock_kyc_challenges` + adjust fixture seed (corridors only)
2. Rust: SEP-10-shaped challenge builder + Ed25519 verify module
3. Routes: challenge → submit → status with one-time approval logic
4. SDK: `IssuerClient` mock-KYC methods
5. Frontend: KYC panel (step 0) + gate transfer on status
6. Tests: wallet auth unit tests, then state/API integration

## Assumptions
- Wallet type is Stellar/Freighter only for this phase.
- Mock KYC replaces real provider integration for the demo path.
- Admin auth remains bearer-token based for operational endpoints.
- Corridor destination approval remains separately managed by issuer/admin APIs.
- Supabase (direct Postgres URL) remains the canonical persistence layer; memory mode is dev fallback with equivalent challenge storage.
- `001_supabase_issuer.sql` must be applied in all environments before mock KYC ships.
