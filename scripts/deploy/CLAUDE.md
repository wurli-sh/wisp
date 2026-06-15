# scripts/deploy

Stellar contract deployment scripts.

## Scripts

| Script | Purpose |
|--------|---------|
| `deploy-verifier.sh` | Build + deploy Groth16 verifier. Writes `.amoeba/verifier.env`. |
| `deploy-compliance.sh` | Build + deploy compliance contract, `initialize()`. Reads verifier env, writes `.amoeba/compliance.env`. |
| `setup-sac.sh` | Manual SAC setup (placeholder — needs ASSET_ID config) |
| `publish-roots.sh` | Register issuer + corridor on deployed compliance contract from fixture data |
