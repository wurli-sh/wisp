import type { DemoTransferRequest, ProofPackage } from "@wisp_/js";
import {
  activateWalletCredential,
  requestProofPackage,
  type DemoIssuerClient,
  type ProvenTransfer,
  type WispClient,
} from "@wisp_/sdk/browser";
import type { WalletSigner } from "@wisp_/sdk/browser";
import { env } from "@/config/env";
import { demoLog, packageCheckpoint, provenCheckpoint } from "@/lib/demoLog";
import { extractTxHash } from "@/lib/transferUtils";

export type TransferStage = "fetch" | "prove" | "approve" | "settle";

export class DuplicateNullifierError extends Error {
  constructor() {
    super("DUPLICATE_NULLIFIER");
    this.name = "DuplicateNullifierError";
  }
}

export async function validateTransferPackage(
  client: WispClient,
  pkg: ProofPackage,
  corridorId: number,
): Promise<void> {
  if (!env.issuerPublicKey) {
    throw new Error("VITE_ISSUER_PUBLIC_KEY is not configured — cannot validate package roots");
  }
  if (!env.complianceId) {
    throw new Error(
      "VITE_COMPLIANCE_CONTRACT_ID is not configured — cannot validate package roots",
    );
  }
  await client.validatePackage(pkg, {
    issuerPublicKey: env.issuerPublicKey,
    corridorId: Number(pkg.transfer?.corridor_id ?? corridorId),
  });
}

export async function fetchTransferPackage(
  demoIssuer: DemoIssuerClient,
  client: WispClient,
  walletSigner: WalletSigner,
  request: DemoTransferRequest,
  corridorId: number,
): Promise<{ package: ProofPackage; credentialSecret: bigint }> {
  if (!env.issuerPublicKey) {
    throw new Error("VITE_ISSUER_PUBLIC_KEY is required for credential activation");
  }
  const credentialSecret = await activateWalletCredential(demoIssuer, walletSigner, {
    networkPassphrase: env.networkPassphrase,
    issuerPublicKey: env.issuerPublicKey,
  });
  const pkg = await requestProofPackage(demoIssuer, walletSigner, credentialSecret, {
    sender_wallet: request.sender_strkey,
    recipient_wallet: request.recipient_strkey,
    amount: request.amount,
    corridor_id: request.corridor_id,
  });
  await validateTransferPackage(client, pkg, corridorId);
  return { package: pkg, credentialSecret };
}

export async function proveTransferPackage(
  client: WispClient,
  pkg: ProofPackage,
  credentialSecret: bigint,
): Promise<ProvenTransfer> {
  return client.prove({
    package: pkg,
    browser: true,
    wasmUrl: client.cfg.wasmUrl,
    zkeyUrl: client.cfg.zkeyUrl,
    credentialSecret,
  });
}

export async function proveAndPayTransfer(deps: {
  client: WispClient;
  demoIssuer: DemoIssuerClient;
  walletSigner: WalletSigner;
  senderAddress: string;
  request: DemoTransferRequest;
  corridorId: number;
  onStage?: (stage: TransferStage) => void;
  skipDuplicateCheck?: boolean;
}): Promise<{ txHash: string; nullifier: string }> {
  const {
    client,
    demoIssuer,
    walletSigner,
    senderAddress,
    request,
    corridorId,
    onStage,
    skipDuplicateCheck = false,
  } = deps;

  onStage?.("fetch");
  const { package: pkg, credentialSecret } = await fetchTransferPackage(
    demoIssuer,
    client,
    walletSigner,
    request,
    corridorId,
  );
  demoLog("transfer.fetch.ok", packageCheckpoint(pkg));

  onStage?.("prove");
  const proven = await proveTransferPackage(client, pkg, credentialSecret);
  demoLog("transfer.prove.ok", provenCheckpoint(proven, pkg));

  if (!skipDuplicateCheck) {
    const audit = await client.audit(proven.nullifier, senderAddress);
    if (audit.attested) {
      throw new DuplicateNullifierError();
    }
  }

  onStage?.("approve");
  await client.approveSacForCompliance(pkg, walletSigner);

  onStage?.("settle");
  await client.simulateSettle(proven, pkg, walletSigner.publicKey);
  const result = await client.settleWithWallet(proven, pkg, walletSigner);
  const txHash = extractTxHash(result);
  if (!txHash) throw new Error("Transaction submitted but hash missing");

  return { txHash, nullifier: proven.nullifier };
}

export async function proveAndPayWithRetry(deps: {
  client: WispClient;
  demoIssuer: DemoIssuerClient;
  walletSigner: WalletSigner;
  senderAddress: string;
  request: DemoTransferRequest;
  corridorId: number;
  onStage?: (stage: TransferStage) => void;
}): Promise<{ txHash: string; nullifier: string }> {
  try {
    return await proveAndPayTransfer(deps);
  } catch (e) {
    if (e instanceof DuplicateNullifierError) {
      demoLog("transfer.retry", { reason: "duplicate_nullifier" });
      return proveAndPayTransfer({ ...deps, skipDuplicateCheck: true });
    }
    throw e;
  }
}
