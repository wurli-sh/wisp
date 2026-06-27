# @wisp_/issuer-sdk quickstart

Copy-paste starting point for an **issuer operator** integrating
`@wisp_/issuer-sdk`. This is a server-side / CLI tool: it signs on-chain
mutations with an operator keypair, so there is no browser build (and you should
not put operator keys in a browser).

| File | Purpose |
|------|---------|
| `src/issuer-quickstart.ts` | Compute roots from KYC (optional) · register issuer · publish roots · register corridor · (optional) conformance test |

## Install

```bash
npm install @wisp_/issuer-sdk @wisp_/sdk @wisp_/js
```

## What it does

```ts
import { WispIssuerClient, loadIssuerConfig } from "@wisp_/issuer-sdk";

const issuer = new WispIssuerClient(loadIssuerConfig());

// Orchestrated: registers issuer (if needed) → publishes issuer roots →
// registers/updates the corridor, all signed by the operator.
await issuer.publishRoots(
  {
    corridorId: 1,
    metadataUri: "https://issuer.example/.well-known/wisp-issuer.json",
    merkleRoot, sanctionsRoot, jurisdictionRoot,           // issuer roots
    sourceJurisdictionRoot, destAddressRoot, corridorConfigHash, // corridor roots
    enabled: true,
  },
  operatorSigner, // { publicKey, signTransaction(xdr) }
);
```

Prefer step-by-step? Use `registerIssuerAndSend`, `publishIssuerRootsAndSend`,
and `registerCorridorAndSend` (see `manual()` in the source).

## Run

**Bring-your-own-KYC** — derive the roots in-process, no Rust service:

```bash
COMPLIANCE_CONTRACT_ID=C... ISSUER_PUBLIC_KEY=G... OPERATOR_SECRET=S... \
ROOTS_SOURCE=kyc SOURCE_COUNTRY=US \
SENDER_PUBLIC_KEY=G... SENDER_CREDENTIAL_COMMITMENT=123... SENDER_JURISDICTION_CODE=840 \
RECIPIENT_PUBLIC_KEY=G... \
pnpm --filter @wisp_/issuer-quickstart node
```

**Pre-computed roots** — supply canonical field decimals via env:

```bash
COMPLIANCE_CONTRACT_ID=C... ISSUER_PUBLIC_KEY=G... OPERATOR_SECRET=S... \
MERKLE_ROOT=... SANCTIONS_ROOT=... JURISDICTION_ROOT=... \
SOURCE_JURISDICTION_ROOT=... DEST_ADDRESS_ROOT=... CORRIDOR_CONFIG_HASH=... \
# optional conformance test of your HTTP API:
ISSUER_URL=http://127.0.0.1:3000 SENDER_PUBLIC_KEY=G... RECIPIENT_PUBLIC_KEY=G... \
pnpm --filter @wisp_/issuer-quickstart node
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `COMPLIANCE_CONTRACT_ID` | yes | Compliance contract id |
| `OPERATOR_SECRET` | yes | Operator signing key (`S...`) |
| `ISSUER_PUBLIC_KEY` | — | Issuer identity on-chain (defaults to operator) |
| `STELLAR_RPC_URL` / `NETWORK_PASSPHRASE` | — | Soroban network |
| `ROOTS_SOURCE` | — | `kyc` to derive roots via `computeIssuerRoots`; otherwise read from env |
| `SENDER_CREDENTIAL_COMMITMENT` / `SENDER_JURISDICTION_CODE` / `SOURCE_COUNTRY` | for `kyc` | KYC inputs for root derivation |
| `ISSUER_URL` | — | If set, runs `runIssuerConformance` against your HTTP API |

## What you swap for production

- `keypairSigner` → your wallet/HSM/KMS `IssuerTransactionSigner`.
- Feed `computeIssuerRoots` your full KYC set (all activated members + the
  corridor's destination registry) instead of the single-member sample, or
  supply roots you computed elsewhere.
- Wire a real sanctions screening provider into the sanctions tree — the helper
  emits the empty-tree sanctions root.
- Keep any KYC stack you like — Wisp only consumes the published roots.

## Typecheck

```bash
pnpm --filter @wisp_/issuer-quickstart typecheck
```
