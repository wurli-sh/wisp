import {
  addressToLimbs,
  computeCredentialCommitment,
  finalizeProofPackageDraft,
  credentialDerivationMessage,
  credentialSecretFromSignature,
  strKeyToPayload,
} from "@wisp_/js";
import type { ProofPackage, ProofPackageRequest } from "@wisp_/js";
import type { IssuerAdapter } from "@wisp_/client";
import type { WalletSigner } from "./settle/compliant-transfer.js";

export { finalizeProofPackageDraft } from "@wisp_/js";

export class UnsupportedWalletCapabilityError extends Error {
  constructor() {
    super("UNSUPPORTED_WALLET_CAPABILITY: signMessage is required by Wisp");
    this.name = "UnsupportedWalletCapabilityError";
  }
}

export async function deriveCredentialSecret(
  wallet: WalletSigner,
  input: { networkPassphrase: string; issuer: string },
): Promise<bigint> {
  if (!wallet.signMessage) throw new UnsupportedWalletCapabilityError();
  const message = credentialDerivationMessage({
    networkPassphrase: input.networkPassphrase,
    issuer: input.issuer,
    wallet: wallet.publicKey,
  });
  const { signedMessage } = await wallet.signMessage(message);
  return (await credentialSecretFromSignature(signedMessage)) as bigint;
}

export function encodeSignedMessageBase64(signedMessage: Uint8Array): string {
  return Buffer.from(signedMessage).toString("base64");
}

export async function activateWalletCredential(
  issuer: IssuerAdapter,
  wallet: WalletSigner,
  input: { networkPassphrase: string; issuerPublicKey: string },
): Promise<bigint> {
  if (!wallet.signMessage) throw new UnsupportedWalletCapabilityError();
  const credential = await issuer.getCredential(wallet.publicKey);
  const credentialSecret = await deriveCredentialSecret(wallet, {
    networkPassphrase: input.networkPassphrase,
    issuer: input.issuerPublicKey,
  });
  const issuerLimbs = addressToLimbs(addressPayload(input.issuerPublicKey));
  const walletLimbs = addressToLimbs(addressPayload(wallet.publicKey));
  const credentialCommitment = computeCredentialCommitment({
    issuerLo: issuerLimbs.lo,
    issuerHi: issuerLimbs.hi,
    senderLo: walletLimbs.lo,
    senderHi: walletLimbs.hi,
    credentialSecret,
    jurisdiction: BigInt(credential.jurisdiction_code),
    credentialExpiry: BigInt(credential.credential_expiry),
  });
  const challenge = await issuer.createActivationChallenge({
    wallet: wallet.publicKey,
    credential_commitment: String(credentialCommitment),
  });
  const signed = await wallet.signMessage(challenge.message);
  await issuer.activateCredential({
    challenge_id: challenge.challenge_id,
    signed_message: encodeSignedMessageBase64(signed.signedMessage),
  });
  return credentialSecret;
}

export async function requestProofPackage(
  issuer: IssuerAdapter,
  wallet: WalletSigner,
  credentialSecret: bigint,
  request: ProofPackageRequest,
): Promise<ProofPackage> {
  if (!wallet.signMessage) throw new UnsupportedWalletCapabilityError();
  const challenge = await issuer.createProofPackageChallenge(request);
  const signed = await wallet.signMessage(challenge.message);
  const draft = await issuer.createProofPackage({
    challenge_id: challenge.challenge_id,
    signed_message: encodeSignedMessageBase64(signed.signedMessage),
  });
  return finalizeProofPackageDraft(draft, credentialSecret);
}

function addressPayload(address: string): Buffer {
  const trimmed = address.trim();
  if (/^[GC][A-Z2-7]{55}$/i.test(trimmed)) {
    return strKeyToPayload(trimmed);
  }
  const hex = trimmed.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("address must be a valid Stellar G/C StrKey or exactly 32-byte hex");
  }
  return Buffer.from(hex, "hex");
}
