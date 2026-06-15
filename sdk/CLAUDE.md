# sdk

Node `@amoeba/sdk` — prove, settle, and audit compliant transfers.

## Usage

```javascript
import { AmoebaClient } from "@amoeba/sdk";

const client = AmoebaClient.fromEnv();
const pkg = await client.issuer.getDemoTransfer();
const proven = await client.prove({ package: pkg });
const result = await client.settleWithKeypair(proven, pkg, senderSecret);
const audit = await client.audit(proven.nullifier, senderPublicKey);
```

## Scripts

| Command | Description |
|---------|-------------|
| `./scripts/dev/demo-phase3.sh` | Local Phase 3 gate (blockers + SDK prove) |
| `./scripts/dev/verify-phase3-blockers.sh` | Stage 1 blocker gate |
| `./scripts/dev/bootstrap-testnet-demo.sh` | Testnet fixture + deploy bootstrap |
| `./scripts/dev/verify-phase3-testnet.sh` | Full testnet `compliant_transfer` |
