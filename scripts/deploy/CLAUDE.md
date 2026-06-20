# scripts/deploy

Stellar contract deployment scripts.

## Scripts

| Script | Purpose |
|--------|---------|
| `deploy-verifier.sh` | Build + deploy Groth16 verifier. Writes `.amoeba/verifier.env`. |
| `deploy-compliance.sh` | Build + deploy compliance contract, `initialize()`. Reads verifier env, writes `.amoeba/compliance.env`. |
| `setup-sac.sh` | Circle testnet USDC SAC (trustlines + `.amoeba/sac.env`) |
| `setup-circle-usdc-testnet.sh` | Circle USDC trustline helper + pinned SAC env |
| `ensure-circle-usdc-trustlines.sh` | Idempotent Circle USDC trustlines for CLI identities |
| `publish-roots.sh` | Register issuer + corridor on deployed compliance contract from fixture data |
| `ceremony-mainnet-gate.sh` | Gate check before mainnet ceremony publish |
| `migrate-issuer-db.sh` | Run issuer Postgres migrations |
