# bindings

Canonical source of truth for the Amoeba 17-field public input ABI. Includes generated TypeScript/Rust contract clients, shared JSON fixtures, and drift-check scripts.

## Contents

| Path | Description |
|------|-------------|
| `public-inputs.json` | Canonical 17-field ABI spec |
| `protocol.json` | Protocol constants (domain tags, corridor config) |
| `contracts.json` | Deployed contract address registry |
| `fixtures/` | Demo identities, transfer params, crypto test vectors |
| `schemas/` | JSON Schema files for ABI validation |
| `scripts/` | `generate.ts`, `gen-crypto-fixtures.ts`, `gen-addresses.ts` |
| `test/` | ABI roundtrip + circuit-abi consistency + proof-package schema tests |
| `generated/` | Auto-generated TypeScript (compliance, verifier) + Rust `public_inputs.rs` |

## Regeneration

```bash
pnpm gen:bindings       # regenerate generated/ from bindings source
pnpm gen:crypto-fixtures # regenerate crypto + address fixtures
```

ABI edits must be made in `public-inputs.json` — all generated code is derived from it.
