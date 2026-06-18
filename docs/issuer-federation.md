# Issuer federation on Amoeba

How multiple trusted issuers share one compliance protocol.

## Current model (v2)

```
Compliance contract (shared registry + verifier anchor)
├── Issuer GA…Amoeba   ← self-registered
├── Issuer GA…BankB    ← self-registered
└── Issuer GA…FintechC ← self-registered

Each issuer runs:
  issuer-service + DB + KYC webhooks
  → self-registers with metadata_uri on-chain
  → publishes issuer roots + issuer-scoped corridor roots on-chain
  → serves ProofPackage at POST /v1/proof-packages

Wallets resolve issuers through:
  on-chain issuer address → metadata_uri → verified service_url
```

## Bootstrapping a new issuer

1. **Issuer operator** deploys `issuer-service` (or reimplements [Issuer API v2](./issuer-api-v1.md)).

2. **Issuer operator** calls `register_issuer(issuer, metadata_uri)` from the issuer Stellar address and pays the fixed registration fee.

3. **Issuer operator** registers issuer-scoped corridors with `register_corridor(issuer, corridor_id, ...)`.

4. **Issuer operator** configures KYC webhooks and publishes roots via `update_issuer_root` or `POST /v1/admin/roots/publish`.

5. **Wallet integrator** resolves the issuer dynamically:
   ```ts
   const resolved = await client.resolveIssuer("G...");
   const issuer = new HttpIssuerAdapter(resolved.serviceUrl);
   ```

6. **Conformance check:**
   ```bash
   ISSUER_URL=https://issuer.bank.com pnpm test:issuer-conformance
   ```

## Trust boundaries

| Layer | Who vouches |
|-------|-------------|
| ProofPackage shape | Amoeba JSON Schema + `validatePackage()` |
| Merkle roots | On-chain issuer roots + issuer-scoped corridor events |
| Issuer identity | On-chain registry entry + verified well-known metadata |
| KYC truth | Issuer operator (regulated entity) |

## Boundaries

- Issuer admission is permissionless, but bounded by a fixed registration fee.
- `corridor_id` is only unique inside one issuer namespace.
- Governance still controls `set_issuer_enabled`; joining is permissionless, staying enabled is not unbounded.

## Related docs

- [Issuer API v1](./issuer-api-v1.md) — HTTP + ProofPackage spec
- [bindings/schemas/proof-package.v1.json](../bindings/schemas/proof-package.v1.json) — machine-readable package schema
