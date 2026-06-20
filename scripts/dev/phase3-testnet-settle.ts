#!/usr/bin/env tsx
/**
 * Phase 3 testnet: prove → settle → audit → replay rejection.
 */
import { WispClient, DemoIssuerClient, loadWispEnv } from "@wisp_/sdk";

async function main() {
  const env = loadWispEnv();
  const client = WispClient.fromEnv({
    WISP_FIXTURE_PROFILE: "testnet",
    ISSUER_PUBLIC_KEY: env.ISSUER_PUBLIC_KEY,
    COMPLIANCE_CONTRACT_ID: env.COMPLIANCE_ID ?? env.COMPLIANCE_CONTRACT_ID,
  });

  const demoIssuer = new DemoIssuerClient(client.cfg.issuerUrl);
  const pkg = await demoIssuer.getDemoTransfer();
  const issuerPk = env.ISSUER_PUBLIC_KEY;
  if (!issuerPk) throw new Error("ISSUER_PUBLIC_KEY missing");
  const corridorId = Number(pkg.transfer?.corridor_id ?? 1);
  await client.validatePackage(pkg, { issuerPublicKey: issuerPk, corridorId });
  console.log("Package validated against chain roots");
  console.log("Proving (epoch=%s)...", pkg.transfer?.epoch);
  const proven = await client.prove({ package: pkg });
  const secret = process.env.SENDER_SECRET;
  if (!secret) throw new Error("SENDER_SECRET not set");
  console.log("Approving SAC allowance for compliance contract...");
  const approve = await client.approveSacForComplianceWithKeypair(pkg, secret);
  console.log("Approve tx:", approve.hash);
  console.log("Settling on testnet...");
  const result = await client.settleWithKeypair(proven, pkg, secret);
  console.log(
    "Tx:",
    result.getTransactionResponse?.txHash ??
      result.sendTransactionResponse?.hash ??
      result,
  );

  const senderPk = env.SENDER_PUBLIC_KEY;
  if (!senderPk) throw new Error("SENDER_PUBLIC_KEY missing from testnet-demo.env");
  const audit = await client.audit(proven.nullifier, senderPk);
  console.log("Attestation:", audit.attested);
  if (!audit.attested) process.exit(1);

  console.log("Replay check (expect failure)...");
  try {
    await client.settleWithKeypair(proven, pkg, secret);
    console.error("ERROR: duplicate settle succeeded");
    process.exit(1);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("Duplicate settle rejected as expected:", msg.slice(0, 120));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
