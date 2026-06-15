import fs from "node:fs";
import path from "node:path";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { Client } from "../../bindings/generated/compliance/dist/index.js";
import { fieldDecimalToBytes32, fieldDecimalToU256String } from "./field.mjs";
import { REPO_ROOT } from "./config.mjs";

function loadDemoFixture(cfg) {
  const name =
    cfg.profile === "testnet"
      ? "demo-transfer-testnet.json"
      : "demo-transfer.json";
  const raw = fs.readFileSync(
    path.join(REPO_ROOT, "bindings/fixtures", name),
    "utf8",
  );
  return JSON.parse(raw);
}

function transferArgs(proven, pkg, cfg) {
  const fixture = loadDemoFixture(cfg);
  const issuer = cfg.issuerPublicKey ?? fixture.issuer_strkey;
  if (!issuer) throw new Error("ISSUER_PUBLIC_KEY or fixture issuer_strkey required");

  const asset = fixture.asset_strkey;
  const sender = fixture.sender_strkey;
  const recipient = fixture.recipient_strkey;
  if (!asset || !sender || !recipient) {
    throw new Error(
      "Settle requires strkeys in demo-transfer fixture (testnet profile)",
    );
  }

  return {
    issuer,
    asset,
    sender,
    recipient,
    amount: pkg.transfer.amount,
    corridor_id: pkg.transfer.corridor_id,
    epoch: String(pkg.transfer.epoch),
    nullifier: fieldDecimalToBytes32(proven.nullifier),
  };
}

function publicInputsVector(proven) {
  return proven.publicSignals.map((d) => fieldDecimalToU256String(d));
}

export async function settleWithKeypair(proven, pkg, cfg, secret) {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");
  const kp = Keypair.fromSecret(secret);
  const client = new Client({
    contractId: cfg.complianceId,
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    publicKey: kp.publicKey(),
  });

  const assembled = await client.compliant_transfer({
    args: transferArgs(proven, pkg, cfg),
    proof: proven.proof,
    public_inputs: publicInputsVector(proven),
  });

  return assembled.signAndSend({
    signTransaction: async (xdr) => {
      const tx = TransactionBuilder.fromXDR(xdr, cfg.networkPassphrase);
      tx.sign(kp);
      return { signedTxXdr: tx.toXDR() };
    },
  });
}

export async function settleWithWallet(proven, pkg, cfg, wallet) {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");
  const client = new Client({
    contractId: cfg.complianceId,
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    publicKey: wallet.publicKey,
  });

  const assembled = await client.compliant_transfer({
    args: transferArgs(proven, pkg, cfg),
    proof: proven.proof,
    public_inputs: publicInputsVector(proven),
  });

  return assembled.signAndSend({
    signTransaction: wallet.signTransaction,
  });
}

export async function simulateSettle(proven, pkg, cfg, publicKey) {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");
  const client = new Client({
    contractId: cfg.complianceId,
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    publicKey,
  });

  const assembled = await client.compliant_transfer({
    args: transferArgs(proven, pkg, cfg),
    proof: proven.proof,
    public_inputs: publicInputsVector(proven),
  });

  return assembled.simulate();
}
