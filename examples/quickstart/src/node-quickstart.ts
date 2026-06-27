/**
 * Node quickstart for `@wisp_/sdk`.
 *
 * The default `@wisp_/sdk` entry is the Node build: it adds `WispClient.fromEnv()`
 * (reads `.env` / `.wisp/*.env` / `process.env`) and a `circom`/`snarkjs` CLI
 * prover, so `prove()` works server-side without browser wasm/zkey URLs.
 *
 * Run:
 *   ISSUER_URL=... ISSUER_PUBLIC_KEY=G... COMPLIANCE_CONTRACT_ID=C... \
 *   SAC_CONTRACT_ID=C... SENDER_PUBLIC_KEY=G... SENDER_SECRET=S... \
 *   RECIPIENT_PUBLIC_KEY=G... WISP_ZKEY_PATH=... WISP_WASM_PATH=... \
 *   WISP_WITNESS_GEN=... pnpm --filter @wisp_/quickstart node
 */
import { WispClient, HttpIssuerAdapter, DuplicateNullifierError } from "@wisp_/sdk";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  // Config is pulled from the environment; pass overrides to fromEnv() if you
  // prefer to inject values explicitly.
  const client = WispClient.fromEnv();

  const issuerPublicKey = required("ISSUER_PUBLIC_KEY");
  const senderPublicKey = required("SENDER_PUBLIC_KEY");
  const senderSecret = required("SENDER_SECRET");
  const recipient = required("RECIPIENT_PUBLIC_KEY");
  const amount = process.env.AMOUNT ?? "1000000";
  const corridorId = Number(process.env.CORRIDOR_ID ?? "1");

  // Production issuer adapter (HTTP). Swap for your own `IssuerAdapter` impl.
  const issuer = new HttpIssuerAdapter(client.cfg.issuerUrl);

  // 1. Fetch a compliance proof package.
  const pkg = await issuer.createProofPackage({
    sender_wallet: senderPublicKey,
    recipient_wallet: recipient,
    amount,
    corridor_id: corridorId,
  });

  // 2. Validate against on-chain roots.
  await client.validatePackage(pkg, { issuerPublicKey, corridorId });

  // 3. Prove (Node CLI prover — uses WISP_ZKEY_PATH / WISP_WASM_PATH / WISP_WITNESS_GEN).
  const proven = await client.prove({ package: pkg });

  // 4. Anti-replay check.
  const { attested } = await client.audit(proven.nullifier, senderPublicKey);
  if (attested) throw new DuplicateNullifierError();

  // 5. Approve + settle using a keypair (server-side signer).
  await client.approveSacForComplianceWithKeypair(pkg, senderSecret);
  const tx = await client.settleWithKeypair(proven, pkg, senderSecret);

  console.log("settled — nullifier:", proven.nullifier);
  console.log("tx:", tx);
}

main().catch((e) => {
  if (e instanceof DuplicateNullifierError) {
    console.warn("already settled (nullifier spent)");
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
