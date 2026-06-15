# circuits/circom/scripts

Circom pipeline scripts.

## Scripts

| Script | Purpose |
|--------|---------|
| `compile.sh` | `circom compliance_corridor.circom --r1cs --wasm --sym` |
| `setup.sh` | One-person trusted setup (POW=17). Refuses `MAINNET=1`. |
| `prove.sh` | Witness generation + Groth16 proof. Usage: `./prove.sh inputs/valid.us-mx.json` |
| `verify-local.sh` | `snarkjs groth16 verify` |
| `export-vk.sh` | Export VK from zkey -> soroban-verifier-gen -> patch |
| `gen-fixture.mjs` | Generate valid + invalid witness fixture JSON files |
| `ceremony-init.sh` | Initialize multi-party phase 2 ceremony |
| `ceremony-contribute.sh` | Apply entropy contribution to ceremony zkey |
| `ceremony-verify.sh` | Verify ceremony zkey against R1CS and PTAU |
| `ceremony-finalize.sh` | Apply beacon, produce final zkey + VK |
