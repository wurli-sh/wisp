import fs from "node:fs";
import path from "node:path";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { Client } from "compliance";
import type { ProofPackage } from "@amoeba/js";
import type { AmoebaConfig } from "../config.js";
import { REPO_ROOT } from "../config.js";
import type { ProvenTransfer } from "../prove/prover.js";
import { fieldDecimalToBytes32, fieldDecimalToU256String } from "./encoding.js";

interface DemoFixture {
  issuer_strkey?: string;
  asset_strkey?: string;
  sender_strkey?: string;
  recipient_strkey?: string;
}

let cachedRemoteFixture: DemoFixture | null = null;

async function loadDemoFixture(cfg: AmoebaConfig): Promise<DemoFixture> {
  if (cfg.demoStrkeys) return cfg.demoStrkeys;
  if (cfg.demoFixtureUrl) {
    if (!cachedRemoteFixture) {
      const res = await fetch(cfg.demoFixtureUrl);
      if (!res.ok) throw new Error(`demo fixture fetch failed: ${res.status}`);
      cachedRemoteFixture = (await res.json()) as DemoFixture;
    }
    return cachedRemoteFixture;
  }
  const name =
    cfg.profile === "testnet"
      ? "demo-transfer-testnet.json"
      : "demo-transfer.json";
  const raw = fs.readFileSync(
    path.join(REPO_ROOT, "bindings/fixtures", name),
    "utf8",
  );
  return JSON.parse(raw) as DemoFixture;
}

async function transferArgs(proven: ProvenTransfer, pkg: ProofPackage, cfg: AmoebaConfig) {
  const fixture = await loadDemoFixture(cfg);
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
    amount: BigInt(String(pkg.transfer!.amount!)),
    corridor_id: Number(pkg.transfer!.corridor_id!),
    epoch: BigInt(String(pkg.transfer!.epoch)),
    nullifier: fieldDecimalToBytes32(proven.nullifier),
  };
}

function publicInputsVector(proven: ProvenTransfer): bigint[] {
  return proven.publicSignals.map((d) => BigInt(fieldDecimalToU256String(d)));
}

export interface WalletSigner {
  publicKey: string;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
}

export async function settleWithKeypair(
  proven: ProvenTransfer,
  pkg: ProofPackage,
  cfg: AmoebaConfig,
  secret: string,
) {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");
  const kp = Keypair.fromSecret(secret);
  const client = new Client({
    contractId: cfg.complianceId,
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    publicKey: kp.publicKey(),
  });

  const assembled = await client.compliant_transfer({
    args: await transferArgs(proven, pkg, cfg),
    proof: proven.proof,
    public_inputs: publicInputsVector(proven),
  });

  return assembled.signAndSend({
    signTransaction: async (xdr: string) => {
      const tx = TransactionBuilder.fromXDR(xdr, cfg.networkPassphrase);
      tx.sign(kp);
      return { signedTxXdr: tx.toXDR() };
    },
  });
}

export async function settleWithWallet(
  proven: ProvenTransfer,
  pkg: ProofPackage,
  cfg: AmoebaConfig,
  wallet: WalletSigner,
) {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");
  const client = new Client({
    contractId: cfg.complianceId,
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    publicKey: wallet.publicKey,
  });

  const assembled = await client.compliant_transfer({
    args: await transferArgs(proven, pkg, cfg),
    proof: proven.proof,
    public_inputs: publicInputsVector(proven),
  });

  return assembled.signAndSend({
    signTransaction: wallet.signTransaction,
  });
}

export async function simulateSettle(
  proven: ProvenTransfer,
  pkg: ProofPackage,
  cfg: AmoebaConfig,
  publicKey: string,
) {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");
  const client = new Client({
    contractId: cfg.complianceId,
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    publicKey,
  });

  const assembled = await client.compliant_transfer({
    args: await transferArgs(proven, pkg, cfg),
    proof: proven.proof,
    public_inputs: publicInputsVector(proven),
  });

  return assembled.simulate();
}

export type SettleResult = Awaited<ReturnType<typeof settleWithKeypair>>;
