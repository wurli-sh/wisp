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
| `audit-backend-paths.sh` | Fail if `backend/` Rust crates use stale `../../bindings` paths |
| `serialize-compliance-proof.ts` | Convert snarkjs proof/public.json to Stellar CLI format |
| `assert-public-inputs.ts` | Verify a proof package matches Phase 1 golden fixture |
| `publish-roots-via-service.sh` | Publish issuer + corridor roots via issuer service API |
| `gen-testnet-fixture.ts` | Generate testnet-specific proof fixture JSON |
| `write-testnet-golden.ts` | Write golden serialized proof for testnet |
| `phase3-testnet-settle.ts` | SDK settle + double-publish checks on testnet |
| `load-amoeba-env.ts` | Load `.amoeba/*.env` files into process env (superseded by `@amoeba/sdk` `env.ts`) |

Dev `.ts` helpers run via `pnpm exec tsx scripts/dev/<name>.ts` from repo root.
