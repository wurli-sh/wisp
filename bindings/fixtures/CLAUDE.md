# bindings/fixtures

Shared JSON fixtures used across the Amoeba stack (circuit scripts, bindings tests, Rust tests, dev scripts).

## Files

| File | Description |
|------|-------------|
| `demo-transfer.json` | Demo transfer params (sender, recipient, asset, amount, epoch) |
| `demo-transfer-testnet.json` | Testnet-specific demo transfer params |
| `demo-users.json` | Demo wallet identities for testing |
| `crypto.json` | Poseidon2 + Merkle test vectors |
| `addresses.json` | StrKey encoded addresses for accounts |
| `public-inputs.valid.json` | Golden 17-field public inputs for a valid proof |
| `public-inputs.testnet.json` | Testnet-specific public inputs |
| `circle-testnet-usdc.json` | Circle testnet USDC asset config (SAC ID, decimals, contract) |