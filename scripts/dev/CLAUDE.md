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
| `diff-public-inputs.ts` | Field-by-field diff of proven/package roots vs issuer + on-chain compliance state (diagnose `PublicInputMismatch` #13) |
| `publish-roots-via-service.sh` | Publish issuer + corridor roots via issuer service API |
| `gen-testnet-fixture.ts` | Generate testnet-specific proof fixture JSON |
| `write-testnet-golden.ts` | Write golden serialized proof for testnet |
| `check-circle-usdc-testnet.sh` | Circle USDC trustline + balance gate for demo settle |
| `patch-corridor-circle-asset.sh` | PATCH corridor `asset_hex` to Circle SAC via issuer API |
| `phase3-testnet-settle.ts` | SDK settle + double-publish checks on testnet |
| `load-wisp-env.ts` | Load `.wisp/*.env` files into process env (superseded by `@wisp_/sdk` `env.ts`) |
| `compliance-deploy-ledger.sh` | Deploy compliance contract with ledger key scan |
| `issuer-conformance.ts` | Issuer API conformance test suite |
| `bru.sh` | Quick bootstrap/reset utility |
| `publish-roots-testnet-via-issuer.sh` | Publish roots to testnet via issuer API |
| `seed-testnet-issuer.sh` | Seed issuer state on testnet |

Dev `.ts` helpers run via `node --import tsx scripts/dev/<name>.ts` from repo root.

### `diff-public-inputs.ts`

Diagnose `Error(Contract, #13)` (`PublicInputMismatch`) by comparing the 17 Groth16 public inputs across:

- **proven** — browser/snarkjs `publicSignals` (optional `--proven`)
- **package** — roots embedded in the proof package (`--package` or `--fetch`)
- **issuer** — freshly computed Merkle roots from issuer DB (`GET /v1/admin/roots/computed`)
- **chain** — latest `IssuerRootUpdated` / `CorridorUpdated` events on the compliance contract

```bash
node --import tsx scripts/dev/diff-public-inputs.ts \
  --proven /tmp/proven.json \
  --fetch \
  --sender GAN3SJKZ7GNHVYCFX7Y3XTDIPZJW6PHMRUL7UDAUHMQ7FIUPDKBFARBC \
  --recipient GAYDCK6WLSO3CEOINAUXLPIK75V4Z65THQ77TBRQWSLIWEOMA4JMUEZJ \
  --amount 10000000 \
  --corridor-id 1
```

Requires issuer-service on `ISSUER_URL` (default `http://127.0.0.1:3000`) and `ISSUER_API_TOKEN` for the computed-roots admin endpoint. Exits `1` when `--proven` does not match the on-chain rebuild.
