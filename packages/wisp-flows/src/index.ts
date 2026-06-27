import type { DemoTransferRequest, ProofPackage, ProofPackageRequest } from "@wisp_/js";

export type TransferStage =
  | "fetch"
  | "validate"
  | "prove"
  | "duplicate-check"
  | "approve"
  | "simulate"
  | "settle";

export interface WalletSigner {
  publicKey: string;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
}

export interface ProvenTransfer {
  nullifier: string;
}

export interface TransferClientLike {
  validatePackage(
    pkg: ProofPackage,
    opts: { issuerPublicKey: string; corridorId: number },
  ): Promise<unknown>;
  prove(input: {
    package: ProofPackage;
    browser?: boolean;
    wasmUrl?: string;
    zkeyUrl?: string;
  }): Promise<ProvenTransfer>;
  audit(
    nullifierDecimal: string,
    publicKey: string,
  ): Promise<{ attested: boolean }>;
  approveSacForCompliance(pkg: ProofPackage, wallet: WalletSigner): Promise<unknown>;
  simulateSettle(
    proven: ProvenTransfer,
    pkg: ProofPackage,
    publicKey: string,
  ): Promise<unknown>;
  settleWithWallet(
    proven: ProvenTransfer,
    pkg: ProofPackage,
    wallet: WalletSigner,
  ): Promise<unknown>;
}

export interface ProofPackageSource {
  createProofPackage?(req: ProofPackageRequest): Promise<ProofPackage>;
  createDemoTransfer?(req: DemoTransferRequest): Promise<ProofPackage>;
}

export interface BrowserProofOptions {
  browser: true;
  wasmUrl: string;
  zkeyUrl: string;
}

export interface TransferValidationOptions {
  issuerPublicKey: string;
  corridorId: number;
}

export interface CreateAndSettleTransferInput {
  client: TransferClientLike;
  issuer: ProofPackageSource;
  request: DemoTransferRequest;
  validation: TransferValidationOptions;
  walletSigner: WalletSigner;
  senderAddress: string;
  proof?: Partial<BrowserProofOptions>;
  onStage?: (stage: TransferStage, payload: Record<string, unknown>) => void;
  skipDuplicateCheck?: boolean;
}

export interface CreateAndSettleTransferResult {
  package: ProofPackage;
  validation: unknown;
  proven: ProvenTransfer;
  approval: unknown;
  simulation: unknown;
  settlement: unknown;
  nullifier: string;
}

export class DuplicateNullifierError extends Error {
  constructor() {
    super("DUPLICATE_NULLIFIER");
    this.name = "DuplicateNullifierError";
  }
}

function emitStage(
  onStage: CreateAndSettleTransferInput["onStage"],
  stage: TransferStage,
  payload: Record<string, unknown> = {},
) {
  onStage?.(stage, payload);
}

export async function validateTransferPackage(
  client: TransferClientLike,
  pkg: ProofPackage,
  validation: TransferValidationOptions,
): Promise<unknown> {
  return client.validatePackage(pkg, {
    issuerPublicKey: validation.issuerPublicKey,
    corridorId: Number(pkg.transfer?.corridor_id ?? validation.corridorId),
  });
}

async function createProofPackageFromIssuer(
  issuer: ProofPackageSource,
  request: DemoTransferRequest,
): Promise<ProofPackage> {
  if (issuer.createDemoTransfer) {
    return issuer.createDemoTransfer(request);
  }
  if (issuer.createProofPackage) {
    return issuer.createProofPackage({
      sender_wallet: request.sender_strkey,
      recipient_wallet: request.recipient_strkey,
      amount: request.amount,
      corridor_id: request.corridor_id,
    });
  }
  throw new Error("issuer source does not support proof package creation");
}

export async function fetchTransferPackage(input: {
  client: TransferClientLike;
  issuer: ProofPackageSource;
  request: DemoTransferRequest;
  validation: TransferValidationOptions;
}): Promise<{ package: ProofPackage; validation: unknown }> {
  const pkg = await createProofPackageFromIssuer(input.issuer, input.request);
  const validation = await validateTransferPackage(input.client, pkg, input.validation);
  return { package: pkg, validation };
}

export async function proveTransferPackage(
  client: TransferClientLike,
  pkg: ProofPackage,
  opts?: Partial<BrowserProofOptions>,
): Promise<ProvenTransfer> {
  return client.prove({
    package: pkg,
    browser: opts?.browser,
    wasmUrl: opts?.wasmUrl,
    zkeyUrl: opts?.zkeyUrl,
  });
}

export async function createAndSettleTransfer(
  input: CreateAndSettleTransferInput,
): Promise<CreateAndSettleTransferResult> {
  emitStage(input.onStage, "fetch", { request: input.request });
  const pkg = await createProofPackageFromIssuer(input.issuer, input.request);

  emitStage(input.onStage, "validate", { corridorId: input.validation.corridorId });
  const validation = await validateTransferPackage(input.client, pkg, input.validation);

  emitStage(input.onStage, "prove", {});
  const proven = await proveTransferPackage(input.client, pkg, input.proof);

  emitStage(input.onStage, "duplicate-check", {});
  if (!input.skipDuplicateCheck) {
    const audit = await input.client.audit(proven.nullifier, input.senderAddress);
    if (audit.attested) {
      throw new DuplicateNullifierError();
    }
  }

  emitStage(input.onStage, "approve", {});
  const approval = await input.client.approveSacForCompliance(
    pkg,
    input.walletSigner,
  );

  emitStage(input.onStage, "simulate", {});
  const simulation = await input.client.simulateSettle(
    proven,
    pkg,
    input.walletSigner.publicKey,
  );

  emitStage(input.onStage, "settle", {});
  const settlement = await input.client.settleWithWallet(
    proven,
    pkg,
    input.walletSigner,
  );

  return {
    package: pkg,
    validation,
    proven,
    approval,
    simulation,
    settlement,
    nullifier: proven.nullifier,
  };
}

export async function createAndSettleTransferWithRetry(
  input: CreateAndSettleTransferInput,
): Promise<CreateAndSettleTransferResult> {
  try {
    return await createAndSettleTransfer(input);
  } catch (error) {
    if (!(error instanceof DuplicateNullifierError)) {
      throw error;
    }
    return createAndSettleTransfer(input);
  }
}
