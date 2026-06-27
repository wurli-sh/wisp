# sdk/

TypeScript SDK (`@wisp_/sdk`) — prove, settle, audit compliant transfers on Stellar.

## Layout

| Path | Purpose |
|------|---------|
| `src/prove/` | Groth16 prover + snarkjs proof serialization |
| `src/issuer/` | Issuer HTTP client + adapter pattern + resolution |
| `src/settle/` | `compliant_transfer` via generated compliance client + SAC approve |
| `src/audit/` | Nullifier attestation checks, root event parsing, ledger window, verifier queries |
| `src/demo/` | Demo-specific flows and helpers |
| `src/validate/` | Input validation for transfer parameters |
| `src/config.ts` | Env-backed config (`loadConfig`, Node fs/path) |
| `src/config-browser.ts` | Browser config (`loadConfigBrowser`, overrides only, no fs) |
| `src/env.ts` | `.env` / `.wisp/*.env` loader (`loadWispEnv`) |
| `src/debug.ts` | Debug/diagnostic helpers |
| `src/errors.ts` | Typed error classes |
| `src/wisp-client.ts` | Browser-safe `WispClient` base (browser-only `prove`, no `node:*`) |
| `src/index.ts` | Node entry: `WispClient` + `fromEnv` + Node prover override |
| `src/browser.ts` | Browser entry (`@wisp_/sdk/browser`): node-free graph |

Build: `pnpm --filter @wisp_/sdk run build` (requires compliance client + `@wisp_/js` built first).

`REPO_ROOT` resolves from package location (not cwd), so tests work via `pnpm --filter @wisp_/sdk`.

Tests: `pnpm test:sdk` — integration test skips if issuer-service is not on `:3000`; `./scripts/dev/demo-phase3.sh` starts issuer and runs the full prove path.

npm: published as `@wisp_/sdk` — see [scripts/publish/CLAUDE.md](../scripts/publish/CLAUDE.md).
