# backend/programs/compliance

Orchestrates compliant transfers on Stellar. The main entry point is `compliant_transfer()`.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib.rs` | Contract entry points — initialize, admin ops, issuer ops, corridor ops, `compliant_transfer` |
| `src/storage.rs` | Data model: Config, IssuerRoots, CorridorConfig, DataKey enum |
| `src/error.rs` | 22 error variants (AlreadyInitialized, Unauthorized, UnknownIssuer, DuplicateNullifier, InvalidProof, etc.) |
| `src/events.rs` | Events: ProofSettled, PauseChanged, AdminProposed, etc. |
| `src/public_inputs.rs` | 19-field public input reconstruction and validation |
| `src/test.rs` | Comprehensive tests covering all validation gates |
| `src/test_sac.rs` | Mock SAC contract embedded in compliance test suite (replaces standalone mock-sac) |

## compliant_transfer Flow

1. Validate amount > 0, public input length = 19
2. Check not paused, issuer exists/enabled, corridor exists/enabled
3. Check issuer roots not stale (>172800 ledgers)
4. Check epoch not future or >1 stale
5. Check nullifier not reused
6. Cross-check VK hash against verifier
7. Rebuild expected public inputs from state, compare with supplied
8. Verify Groth16 proof via verifier contract
9. Record nullifier, emit event, call SAC `transfer_from()` (compliance contract as spender)
