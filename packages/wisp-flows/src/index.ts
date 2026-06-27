import {
  addressToLimbs,
  computeCredentialCommitment,
  credentialDerivationMessage,
  credentialSecretFromSignature,
  finalizeProofPackageDraft,
  strKeyToPayload,
  type ActivateCredentialRequest,
  type ActivateCredentialResponse,
  type ActivationChallengeRequest,
  type ChallengeResponse,
  type CredentialInfo,
  type DemoTransferRequest,
  type ProofPackage,
  type ProofPackageDraft,
  type ProofPackageRequest,
  type SignedProofPackageRequest,
} from "@wisp_/js";

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
  signMessage?: (message: string) => Promise<{ signedMessage: Uint8Array }>;
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
    credentialSecret: bigint;
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
  getCredential(wallet: string): Promise<CredentialInfo>;
  createActivationChallenge(req: ActivationChallengeRequest): Promise<ChallengeResponse>;
  activateCredential(req: ActivateCredentialRequest): Promise<ActivateCredentialResponse>;
  createProofPackageChallenge(req: ProofPackageRequest): Promise<ChallengeResponse>;
  createProofPackage(req: SignedProofPackageRequest): Promise<ProofPackageDraft>;
}

export interface BrowserProofOptions {
  browser: true;
  wasmUrl: string;
  zkeyUrl: string;
}

export interface TransferValidationOptions {
  issuerPublicKey: string;
  corridorId: number;
  networkPassphrase: string;
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
  wallet: WalletSigner,
  validation: TransferValidationOptions,
): Promise<{ package: ProofPackage; credentialSecret: bigint }> {
  if (!wallet.signMessage) throw new Error("signMessage is required by Wisp");
  const credential = await issuer.getCredential(wallet.publicKey);
  const derivation = credentialDerivationMessage({
    networkPassphrase: validation.networkPassphrase,
    issuer: validation.issuerPublicKey,
    wallet: wallet.publicKey,
  });
  const secretSignature = await wallet.signMessage(derivation);
  const credentialSecret = BigInt(
    String(await credentialSecretFromSignature(secretSignature.signedMessage)),
  );
  const issuerLimbs = addressToLimbs(addressPayload(validation.issuerPublicKey));
  const walletLimbs = addressToLimbs(addressPayload(wallet.publicKey));
  const commitment = computeCredentialCommitment({
    issuerLo: issuerLimbs.lo,
    issuerHi: issuerLimbs.hi,
    senderLo: walletLimbs.lo,
    senderHi: walletLimbs.hi,
    credentialSecret,
    jurisdiction: BigInt(credential.jurisdiction_code),
    credentialExpiry: BigInt(credential.credential_expiry),
  });
  const activation = await issuer.createActivationChallenge({
    wallet: wallet.publicKey,
    credential_commitment: String(commitment),
  });
  const activationSignature = await wallet.signMessage(activation.message);
  await issuer.activateCredential({
    challenge_id: activation.challenge_id,
    signed_message: encodeBase64(activationSignature.signedMessage),
  });
  const proofRequest = {
    sender_wallet: request.sender_strkey,
    recipient_wallet: request.recipient_strkey,
    amount: request.amount,
    corridor_id: request.corridor_id,
  };
  const challenge = await issuer.createProofPackageChallenge(proofRequest);
  const proofSignature = await wallet.signMessage(challenge.message);
  const draft = await issuer.createProofPackage({
    challenge_id: challenge.challenge_id,
    signed_message: encodeBase64(proofSignature.signedMessage),
  });
  return {
    package: finalizeProofPackageDraft(draft, credentialSecret),
    credentialSecret,
  };
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function addressPayload(address: string): Buffer {
  const trimmed = address.trim();
  if (/^[GC][A-Z2-7]{55}$/i.test(trimmed)) return strKeyToPayload(trimmed);
  const hex = trimmed.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("address must be a valid Stellar G/C StrKey or exactly 32-byte hex");
  }
  return Buffer.from(hex, "hex");
}

export async function fetchTransferPackage(input: {
  client: TransferClientLike;
  issuer: ProofPackageSource;
  request: DemoTransferRequest;
  validation: TransferValidationOptions;
  walletSigner: WalletSigner;
}): Promise<{ package: ProofPackage; validation: unknown }> {
  const { package: pkg } = await createProofPackageFromIssuer(
    input.issuer,
    input.request,
    input.walletSigner,
    input.validation,
  );
  const validation = await validateTransferPackage(input.client, pkg, input.validation);
  return { package: pkg, validation };
}

export async function proveTransferPackage(
  client: TransferClientLike,
  pkg: ProofPackage,
  credentialSecret: bigint,
  opts?: Partial<BrowserProofOptions>,
): Promise<ProvenTransfer> {
  return client.prove({
    package: pkg,
    browser: opts?.browser,
    wasmUrl: opts?.wasmUrl,
    zkeyUrl: opts?.zkeyUrl,
    credentialSecret,
  });
}

export async function createAndSettleTransfer(
  input: CreateAndSettleTransferInput,
): Promise<CreateAndSettleTransferResult> {
  emitStage(input.onStage, "fetch", { request: input.request });
  const { package: pkg, credentialSecret } = await createProofPackageFromIssuer(
    input.issuer,
    input.request,
    input.walletSigner,
    input.validation,
  );

  emitStage(input.onStage, "validate", { corridorId: input.validation.corridorId });
  const validation = await validateTransferPackage(input.client, pkg, input.validation);

  emitStage(input.onStage, "prove", {});
  const proven = await proveTransferPackage(
    input.client,
    pkg,
    credentialSecret,
    input.proof,
  );

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
