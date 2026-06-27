/**
 * Issuer operator quickstart for `@wisp_/issuer-sdk`.
 *
 * This is a **server-side / operator** tool (it signs on-chain mutations with an
 * operator keypair), so it uses the Node entry — there is no browser build and
 * you should not put operator keys in a browser.
 *
 * Flow: load config → build client → register issuer + publish roots + register
 * corridor (one orchestrated call) → optionally conformance-test your HTTP API.
 *
 * Run:
 *   COMPLIANCE_CONTRACT_ID=C... ISSUER_PUBLIC_KEY=G... \
 *   OPERATOR_SECRET=S... ISSUER_URL=http://127.0.0.1:3000 \
 *   pnpm --filter @wisp_/issuer-quickstart node
 */
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  WispIssuerClient,
  computeIssuerRoots,
  loadIssuerConfig,
  runIssuerConformance,
  type IssuerRoots,
  type IssuerTransactionSigner,
} from "@wisp_/issuer-sdk";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env: ${name}`);
  return v;
}

/**
 * Bring-your-own-KYC: derive the six roots from your KYC dataset entirely in
 * TypeScript — no Rust issuer-service required. In a real deployment `members`
 * comes from your KYC store (each activated wallet + the credential commitment
 * it registered + its jurisdiction code) and `destinations` is your corridor's
 * approved recipient registry.
 *
 * Activate with `ROOTS_SOURCE=kyc`. Otherwise the example expects the roots as
 * env vars (the "I already computed roots elsewhere" path).
 */
function rootsFromKyc(corridorId: number): IssuerRoots {
  return computeIssuerRoots({
    members: [
      {
        wallet: required("SENDER_PUBLIC_KEY"),
        credentialCommitment: required("SENDER_CREDENTIAL_COMMITMENT"),
        jurisdictionCode: Number(process.env.SENDER_JURISDICTION_CODE ?? "840"),
      },
    ],
    destinations: [required("RECIPIENT_PUBLIC_KEY")],
    corridor: {
      id: corridorId,
      sourceCountry: process.env.SOURCE_COUNTRY ?? "US",
      enabled: true,
      travelRuleThreshold: process.env.TRAVEL_RULE_THRESHOLD ?? 0,
    },
  });
}

function rootsFromEnv(): IssuerRoots {
  return {
    merkleRoot: required("MERKLE_ROOT"),
    sanctionsRoot: required("SANCTIONS_ROOT"),
    jurisdictionRoot: required("JURISDICTION_ROOT"),
    sourceJurisdictionRoot: required("SOURCE_JURISDICTION_ROOT"),
    destAddressRoot: required("DEST_ADDRESS_ROOT"),
    corridorConfigHash: required("CORRIDOR_CONFIG_HASH"),
  };
}

/** Operator keypair → `IssuerTransactionSigner`. Swap for a wallet/HSM adapter. */
function keypairSigner(secret: string, networkPassphrase: string): IssuerTransactionSigner {
  const kp = Keypair.fromSecret(secret);
  return {
    publicKey: kp.publicKey(),
    signTransaction: async (xdr: string) => {
      const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
      tx.sign(kp);
      return { signedTxXdr: tx.toXDR() };
    },
  };
}

async function main(): Promise<void> {
  // Config from env (COMPLIANCE_CONTRACT_ID, OPERATOR_PUBLIC_KEY/ISSUER_PUBLIC_KEY,
  // STELLAR_RPC_URL, NETWORK_PASSPHRASE). Pass overrides if you prefer.
  const operator = keypairSigner(
    required("OPERATOR_SECRET"),
    process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  );
  const cfg = loadIssuerConfig({ OPERATOR_PUBLIC_KEY: operator.publicKey });
  const issuer = new WispIssuerClient(cfg);

  const corridorId = Number(process.env.CORRIDOR_ID ?? "1");
  const metadataUri =
    process.env.METADATA_URI ?? "https://issuer.example/.well-known/wisp-issuer.json";

  // Roots either derived from your KYC dataset in-process (ROOTS_SOURCE=kyc) or
  // supplied as pre-computed canonical field decimals via env.
  const roots =
    (process.env.ROOTS_SOURCE ?? "env") === "kyc" ? rootsFromKyc(corridorId) : rootsFromEnv();
  console.log("roots:", roots);

  // One-call orchestration: registers the issuer (if not yet registered),
  // publishes issuer roots, then registers or updates the corridor — all signed
  // by the operator. Idempotent re-runs are handled internally.
  const result = await issuer.publishRoots(
    { corridorId, metadataUri, enabled: true, ...roots },
    operator,
  );
  console.log("published roots:", result);

  // Optional: validate your issuer HTTP API end-to-end against the Wisp spec.
  if (process.env.ISSUER_URL) {
    const conformance = await runIssuerConformance({
      issuerUrl: process.env.ISSUER_URL,
      issuerPublicKey: cfg.issuerPublicKey ?? operator.publicKey,
      sender: required("SENDER_PUBLIC_KEY"),
      recipient: required("RECIPIENT_PUBLIC_KEY"),
      corridorId,
      simulateSettle: false,
    });
    console.log("conformance OK — well-known:", conformance.wellKnown.issuer_stellar_address);
  }
}

/**
 * The same on-chain steps done individually, if you don't want the orchestrated
 * `publishRoots` helper.
 */
export async function manual(operator: IssuerTransactionSigner): Promise<void> {
  const cfg = loadIssuerConfig({ OPERATOR_PUBLIC_KEY: operator.publicKey });
  const issuer = new WispIssuerClient(cfg);

  await issuer.registerIssuerAndSend(
    { metadataUri: "https://issuer.example/.well-known/wisp-issuer.json" },
    operator,
  );

  await issuer.publishIssuerRootsAndSend(
    { merkleRoot: "0x…", sanctionsRoot: "0x…", jurisdictionRoot: "0x…" },
    operator,
  );

  await issuer.registerCorridorAndSend(
    {
      corridorId: 1,
      sourceJurisdictionRoot: "0x…",
      destAddressRoot: "0x…",
      corridorConfigHash: "0x…",
    },
    operator,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
