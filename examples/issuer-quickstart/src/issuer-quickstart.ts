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
  loadIssuerConfig,
  runIssuerConformance,
  type IssuerTransactionSigner,
} from "@wisp_/issuer-sdk";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env: ${name}`);
  return v;
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

  // Root hashes you computed off-chain (hex strings, Buffers, or Uint8Arrays).
  // Replace these with your real Merkle/sanctions/jurisdiction + corridor roots.
  const roots = {
    merkleRoot: required("MERKLE_ROOT"),
    sanctionsRoot: required("SANCTIONS_ROOT"),
    jurisdictionRoot: required("JURISDICTION_ROOT"),
    sourceJurisdictionRoot: required("SOURCE_JURISDICTION_ROOT"),
    destAddressRoot: required("DEST_ADDRESS_ROOT"),
    corridorConfigHash: required("CORRIDOR_CONFIG_HASH"),
  };

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
