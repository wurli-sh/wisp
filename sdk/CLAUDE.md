# sdk/

TypeScript SDK (`@amoeba/sdk`) — prove, settle, audit compliant transfers on Stellar.

## Layout

| Path | Purpose |
|------|---------|
| `src/prove/` | Groth16 prover + snarkjs proof serialization |
| `src/issuer/` | Issuer HTTP client |
| `src/settle/` | `compliant_transfer` via generated compliance client + SAC approve |
| `src/audit/` | Nullifier attestation checks + root event parsing |
| `src/config.ts` | Env-backed config (`loadConfig`) |
| `src/env.ts` | `.env` / `.amoeba/*.env` loader (`loadAmoebaEnv`) |
| `src/debug.ts` | Debug/diagnostic helpers |
| `src/index.ts` | `AmoebaClient` facade |

Build: `pnpm --filter @amoeba/sdk run build` (requires compliance client + `@amoeba/js` built first).

`REPO_ROOT` resolves from package location (not cwd), so tests work via `pnpm --filter @amoeba/sdk`.

Tests: `pnpm test:sdk` — integration test skips if issuer-service is not on `:3000`; `./scripts/dev/demo-phase3.sh` starts issuer and runs the full prove path.
