# bindings/scripts

Scripts to regenerate ABI bindings and crypto/address fixtures from canonical sources.

## Scripts

| Script | Description |
|--------|-------------|
| `generate.ts` | Generates TypeScript contract clients + Rust `public_inputs.rs` from `public-inputs.json` and `contracts.json` |
| `gen-crypto-fixtures.ts` | Regenerates Poseidon2 + Merkle test vectors into `fixtures/crypto.json` |
| `gen-addresses.ts` | Regenerates StrKey addresses into `fixtures/addresses.json` |

Run via root `pnpm gen:bindings` and `pnpm gen:crypto-fixtures` (`tsx`).
