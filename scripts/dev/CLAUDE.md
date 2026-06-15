# scripts/dev

Development and testnet verification scripts.

## Scripts

| Script | Purpose |
|--------|---------|
| `demo-e2e.sh` | Full local E2E: fixtures -> compile -> setup -> prove -> verify -> export -> test -> build |
| `demo-phase2.sh` | Full Phase 2 pipeline: gen bindings -> gen fixtures -> crate tests -> binding tests -> issuer service |
| `verify-testnet.sh` | Phase 0 gate: minimal Groth16 proof on testnet |
| `verify-compliance-testnet.sh` | Phase 1 gate: compliance proof on testnet + tampered rejection |
| `serialize-compliance-proof.mjs` | Convert snarkjs proof/public.json to Stellar CLI format |
| `assert-public-inputs.mjs` | Verify a proof package matches Phase 1 golden fixture |
| `publish-roots-via-service.sh` | Publish issuer + corridor roots via issuer service API |
