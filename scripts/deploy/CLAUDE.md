# scripts/deploy

Stellar contract deployment scripts.

## Scripts

| Script | Purpose |
|--------|---------|
| `deploy-verifier.sh` | Build + deploy Groth16 verifier. Writes `.amoeba/verifier.env`. |
| `deploy-compliance.sh` | Build + deploy compliance contract, `initialize()`. Reads verifier env, writes `.amoeba/compliance.env`. |
| `deploy-mock-sac.sh` | Build + deploy mock Stellar Asset Contract for testing |
| `setup-sac.sh` | Configure SAC (classic asset wrapping, trustlines, admin) |
| `publish-roots.sh` | Register issuer + corridor on deployed compliance contract from fixture data |
| `ceremony-mainnet-gate.sh` | Gate check before mainnet ceremony publish |
