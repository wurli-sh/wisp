# circuits/circom/test

Circuit tests — both Node unit tests and shell-level fixture validation.

## Files

| File | Purpose |
|------|---------|
| `compliance_corridor.test.ts` | Public input keys, nullifier binding, corridor_config_hash computation |
| `fixtures.test.ts` | Valid witness generation, invalid fixture rejection, fixture existence |
| `verify-fixtures.sh` | Shell: valid fixture must produce witness, invalid fixtures must fail |
