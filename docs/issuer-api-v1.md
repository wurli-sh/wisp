# Amoeba Issuer API v2

Interoperability spec for off-chain compliance issuers. `v2` is a clean break: issuers self-register on-chain, corridor identity is always `(issuer, corridor_id)`, and wallets discover issuers through the on-chain registry plus issuer-hosted well-known metadata.

## Required endpoints

### `POST /v1/proof-packages`

Build a proof package for a compliant transfer.

**Request body:**

```json
{
  "sender_wallet": "64-char-hex-or-G-strkey",
  "recipient_wallet": "64-char-hex-or-G-strkey",
  "amount": "10000000",
  "corridor_id": 1
}
```

**Wallet encoding (v1):**

- **Canonical:** 64-character lowercase hex (32-byte Stellar account payload).
- **Reference issuer:** also accepts `G…` strkeys; normalizes to hex before DB lookup.
- Third-party issuers MUST document which encodings they accept; conformance tests use hex.

**Response:** `ProofPackage` (see [proof-package.v1.json](../bindings/schemas/proof-package.v1.json)).

**Errors (plain text body):**

| Message | Meaning |
|---------|---------|
| `approved sender not found` | Sender not KYC-approved |
| `active credential not found` | Missing credential |
| `sender is not sanctions clear` | Sanctions block |
| `recipient not approved for corridor` | Destination registry miss |
| `unknown corridor id` | Invalid corridor |

### `GET /v1/corridors`

Returns `[{ id, name, source_country, dest_country, enabled }]`.

### `GET /.well-known/amoeba-issuer.json`

Discovery metadata ([schema](../bindings/schemas/issuer-well-known.v1.json)):

```json
{
  "api_version": "2",
  "protocol_version": "2",
  "issuer_stellar_address": "G…",
  "metadata_uri": "https://issuer.example/.well-known/amoeba-issuer.json",
  "service_url": "https://issuer.example",
  "compliance_contract_id": "C…",
  "verifier_contract_id": "C…",
  "circuit_vk_hash": "hex",
  "proof_package_schema": 1,
  "network_passphrase": "Test SDF Network ; September 2015"
}
```

## ProofPackage (required fields)

| Section | Purpose |
|---------|---------|
| `schema_version` | Always `1` for this spec |
| `credential` | Sender eligibility metadata |
| `transfer` | Asset, parties, amount, corridor, epoch |
| `roots` | Six Merkle roots (must match on-chain issuer + corridor state) |
| `paths` | Five Merkle paths + indices |
| `witness_private` | ZK witness secrets (`credential_secret`, etc.) |
| `public_inputs` | 17 Groth16 public inputs ([ABI](../bindings/public-inputs.json)) |
| `demo` | Optional strkeys for wallet settle UX |

Clients run `validatePackage()` before browser proving to compare `roots` against the issuer-specific on-chain roots for `(issuer, corridor_id)`.

## Optional endpoints (reference issuer only)

Not required for plug-and-play SDK core:

- `/v1/mock-kyc/*` — demo wallet verification
- `/v1/fixtures/demo-transfer` — demo proof package shortcut
- `/v1/provider/webhooks/{provider}` — production KYC vendor ingestion
- `/v1/admin/*` — operator root publish and diagnostics

## Production KYC onboarding

Issuers ingest vendor webhooks at `POST /v1/provider/webhooks/{provider}` with header `x-webhook-secret`. Payload is normalized to user + credential + Merkle membership, then roots are published on-chain.

SDK wallets do **not** call webhook endpoints; onboarding is issuer-operated.

## Canonical discovery

Wallet resolution flow:

1. Obtain issuer address from trusted selection or chain-backed issuer listing.
2. Read the on-chain registry entry for that issuer.
3. Fetch `metadata_uri` from the registry.
4. Verify well-known fields match the on-chain issuer address, compliance contract, verifier contract, and protocol version.
5. Use the verified `service_url` to fetch proof packages.

URL-first flows are allowed only if the fetched URL canonicalizes back to the same on-chain `metadata_uri`.

## On-chain bootstrap

1. Deploy the issuer service publicly.
2. Call `register_issuer(issuer, metadata_uri)` from the issuer address and pay the fixed registration fee.
3. Call `register_corridor(issuer, corridor_id, ...)` for each issuer-scoped corridor.
4. Publish issuer roots with `update_issuer_root(issuer, ...)`.
5. Start serving proof packages.

`POST /v1/proof-packages` must fail until both issuer roots and the issuer-scoped corridor roots exist on-chain.

## Conformance

```bash
ISSUER_URL=https://your-issuer.example.com pnpm test:issuer-conformance
```

Requires a seeded KYC-approved sender, corridor destination, and published on-chain roots matching env `COMPLIANCE_CONTRACT_ID` + `ISSUER_PUBLIC_KEY`. Reference issuer: `pnpm test:issuer-conformance -- --seed`.
