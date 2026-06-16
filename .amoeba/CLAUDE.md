# .amoeba

Deployment state files for Amoeba contracts on Stellar testnet.

## Files

| File | Contents |
|------|----------|
| `verifier.env` | `VERIFIER_ID` — deployed Groth16 verifier contract address |
| `compliance.env` | `VERIFIER_ID`, `COMPLIANCE_ID`, `VK_HASH` — deployed compliance contract address and expected VK fingerprint |
| `sac.env` | `SAC_ID` — deployed mock SAC contract address |
| `testnet-demo.env` | Combined testnet env (verifier + compliance + SAC + issuer) |
| `issuer-service-testnet.log` | Issuer service testnet runtime log |
| `issuer-state-testnet.json` | Issuer tree state snapshot (testnet deployment) |
