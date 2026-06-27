# circuits/circom

BN254 Groth16 compliance corridor circuit with Poseidon2 hashing.

## Circuit Checks (8 in one snark)

| # | Check | Description |
|---|-------|-------------|
| 1 | Credential membership | Wallet's issuer-scoped credential commitment in issuer's identity tree |
| 2 | Nullifier binding | Domain-separated hash binding entire transfer context |
| 3 | Sanctions exclusion | Sender NOT in sanctions SMT |
| 4 | Jurisdiction membership | Sender's jurisdiction in issuer's jurisdiction tree |
| 5 | Expiry | `timestamp <= credential_expiry` |
| 6 | Corridor source jurisdiction | Sender's jurisdiction in corridor's source tree |
| 7 | Corridor destination address | Recipient in corridor's destination tree |
| 8 | Corridor binding | On-chain `corridor_config_hash` matches circuit input |

## Public Inputs (19)

merkle_root, nullifier, asset_lo/hi, sender_lo/hi, epoch, recipient_lo/hi, amount, sanctions_root, jurisdiction_root, timestamp, corridor_id, corridor_config_hash, source_jurisdiction_root, dest_address_root, issuer_lo, issuer_hi

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `components/` | Circom templates: poseidon2, merkle, smt, constants |
| `lib/` | JS helpers: poseidon2, merkle, field arithmetic |
| `scripts/` | Compile, setup, prove, verify, ceremony, export |
| `test/` | Node .test.ts files + shell fixture check |
| `inputs/` | Valid + invalid witness fixture JSON files |
| `artifacts/` | Build artifacts (gitignored) |
