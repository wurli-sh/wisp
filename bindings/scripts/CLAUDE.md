# bindings/scripts

Scripts to regenerate ABI bindings and crypto/address fixtures from canonical sources.

## Scripts

| Script | Description |
|--------|-------------|
| `generate.mjs` | Generates TypeScript contract clients + Rust `public_inputs.rs` from `public-inputs.json` and `contracts.json` |
| `gen-crypto-fixtures.mjs` | Regenerates Poseidon2 + Merkle test vectors into `fixtures/crypto.json` |
| `gen-addresses.mjs` | Regenerates StrKey addresses into `fixtures/addresses.json` |