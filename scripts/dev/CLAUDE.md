# scripts/dev

Development and testnet verification scripts.

## Scripts

| Script | Purpose |
|--------|---------|
| `demo-e2e.sh` | Full local E2E: fixtures -> compile -> setup -> prove -> verify -> export -> test -> build |
| `demo-phase2.sh` | Full Phase 2 pipeline: gen bindings -> gen fixtures -> crate tests -> binding tests -> issuer service |
| `demo-phase3.sh` | Full Phase 3 local demo (blocker gate + SDK prove + settle + audit) |
| `bootstrap-testnet-demo.sh` | Generate testnet fixture + deploy contracts + bootstrap issuer |
| `verify-testnet.sh` | Phase 0 gate: minimal Groth16 proof on testnet |
| `verify-compliance-testnet.sh` | Phase 1 gate: compliance proof on testnet + tampered rejection |
| `verify-phase3-blockers.sh` | Phase 3 stage 1: blocker checks (strkey, env, binary) |
| `verify-phase3-testnet.sh` | Phase 3 gate: full `compliant_transfer` via SDK on testnet |
| `ensure-testnet-vk.sh` | Ensure VK exists and matches verifier contract |
| `serialize-compliance-proof.mjs` | Convert snarkjs proof/public.json to Stellar CLI format |
| `assert-public-inputs.mjs` | Verify a proof package matches Phase 1 golden fixture |
| `publish-roots-via-service.sh` | Publish issuer + corridor roots via issuer service API |
| `gen-testnet-fixture.mjs` | Generate testnet-specific proof fixture JSON |
| `write-testnet-golden.mjs` | Write golden serialized proof for testnet |
| `load-amoeba-env.mjs` | Load `.amoeba/*.env` files into process env |
