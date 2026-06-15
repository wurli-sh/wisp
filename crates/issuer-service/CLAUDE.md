# crates/issuer-service

Off-chain issuer backend service — manages identity trees, generates Merkle proofs, serves proof packages via HTTP.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | None |
| GET | `/v1/fixtures/demo-transfer` | None |
| GET | `/v1/merkle-path/:wallet` | None |
| POST | `/v1/roots/publish` | Bearer token |

## Env

| Variable | Default | Description |
|----------|---------|-------------|
| `ISSUER_LISTEN_ADDR` | `127.0.0.1:3000` | HTTP listen address |
| `ISSUER_STATE_PATH` | `.amoeba/issuer-state.json` | Persistent tree state |
| `ISSUER_API_TOKEN` | — | Bearer token for root publishing |
| `ISSUER_PUBLIC_KEY` | — | Issuer Stellar public key |

## Modules

| Module | Description |
|--------|-------------|
| `routes` | Axum route handlers |
| `state` | In-memory + persisted tree state |
| `trees` | Identity/SMT merkle tree management |
| `auth` | Bearer token middleware |
| `stellar` | Soroban contract interaction |
| `config` | Env-based configuration |
