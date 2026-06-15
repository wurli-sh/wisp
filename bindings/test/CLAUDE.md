# bindings/test

Verification tests for binding correctness and cross-repo consistency.

## Tests

| Test | Description |
|------|-------------|
| `public-inputs.test.mjs` | Validates public input JSON against canonical schema and field count |
| `circuit-abi.test.mjs` | Ensures circuit witness JSON keys match the ABI field order — detects drift between circuit and bindings |