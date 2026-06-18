import fs from "node:fs";
import path from "node:path";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { Client } from "@amoeba_/compliance";
import type { ProofPackage } from "@amoeba_/js";
import type { AmoebaConfig } from "../config.js";
import { REPO_ROOT } from "../config.js";
import type { ProvenTransfer } from "../prove/prover.js";
import { sdkCheckpoint } from "../debug.js";
import { fieldDecimalToBytes32, fieldDecimalToU256String } from "./encoding.js";
import { approveSacAllowance, approveSacAllowanceWithKeypair } from "./sac-approve.js";

interface DemoFixture {
  issuer_strkey?: string;
  asset_strkey?: string;
  sender_strkey?: string;
  recipient_strkey?: string;
}

function packageStrkeys(pkg: ProofPackage): DemoFixture {
  return {
    issuer_strkey: pkg.demo?.issuer_strkey,
    asset_strkey: pkg.demo?.asset_strkey,
    sender_strkey: pkg.demo?.sender_strkey,
    recipient_strkey: pkg.demo?.recipient_strkey,
  };
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

async function resolveSettleParties(proven: ProvenTransfer | null, pkg: ProofPackage, cfg: AmoebaConfig) {
  const fixture = await loadDemoFixture(cfg);
  const pkgFixture = packageStrkeys(pkg);
  const issuer = cfg.issuerPublicKey ?? pkgFixture.issuer_strkey ?? fixture.issuer_strkey;
  if (!issuer) throw new Error("ISSUER_PUBLIC_KEY or fixture issuer_strkey required");

  const asset = pkgFixture.asset_strkey ?? fixture.asset_strkey;
  const sender = pkgFixture.sender_strkey ?? fixture.sender_strkey;
  const recipient = pkgFixture.recipient_strkey ?? fixture.recipient_strkey;
  if (!asset || !sender || !recipient) {
    throw new Error(
      "Settle requires sender/recipient/asset strkeys from the package or demo fixture",
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
    nullifier: proven
      ? fieldDecimalToBytes32(proven.nullifier)
      : Buffer.alloc(32),
  };
}

async function transferArgs(proven: ProvenTransfer, pkg: ProofPackage, cfg: AmoebaConfig) {
  const parties = await resolveSettleParties(proven, pkg, cfg);
  return {
    ...parties,
    nullifier: fieldDecimalToBytes32(proven.nullifier),
  };
}

function logSettleCheckpoint(
  cfg: AmoebaConfig,
  proven: ProvenTransfer,
  pkg: ProofPackage,
  args: Awaited<ReturnType<typeof transferArgs>>,
  walletPublicKey?: string,
): void {
  sdkCheckpoint("settle.checkpoint", {
    compliance_id: cfg.complianceId,
    freighter: walletPublicKey,
    fixture_sender: args.sender,
    wallet_matches_sender: walletPublicKey ? walletPublicKey === args.sender : undefined,
    epoch: String(args.epoch),
    nullifier: proven.nullifier,
    amount: String(args.amount),
    corridor_id: args.corridor_id,
    merkle_root: pkg.roots?.merkle_root,
  });
}

function publicInputsVector(proven: ProvenTransfer): bigint[] {
  return proven.publicSignals.map((d) => BigInt(fieldDecimalToU256String(d)));
}

export interface WalletSigner {
  publicKey: string;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
}

export async function approveSacForCompliance(
  pkg: ProofPackage,
  cfg: AmoebaConfig,
  wallet: WalletSigner,
) {
  const parties = await resolveSettleParties(null, pkg, cfg);
  return approveSacAllowance(cfg, wallet, parties.asset, parties.amount);
}

export async function approveSacForComplianceWithKeypair(
  pkg: ProofPackage,
  cfg: AmoebaConfig,
  secret: string,
) {
  const parties = await resolveSettleParties(null, pkg, cfg);
  return approveSacAllowanceWithKeypair(cfg, secret, parties.asset, parties.amount);
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

  const args = await transferArgs(proven, pkg, cfg);
  logSettleCheckpoint(cfg, proven, pkg, args, kp.publicKey());

  const assembled = await client.compliant_transfer({
    args,
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

  const args = await transferArgs(proven, pkg, cfg);
  logSettleCheckpoint(cfg, proven, pkg, args, wallet.publicKey);

  const assembled = await client.compliant_transfer({
    args,
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

  const args = await transferArgs(proven, pkg, cfg);
  logSettleCheckpoint(cfg, proven, pkg, args, publicKey);
  sdkCheckpoint("settle.simulate", { freighter: publicKey });

  const assembled = await client.compliant_transfer({
    args,
    proof: proven.proof,
    public_inputs: publicInputsVector(proven),
  });

  return assembled.simulate();
}

export type SettleResult = Awaited<ReturnType<typeof settleWithKeypair>>;
