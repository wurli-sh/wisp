import { mod } from "./field.js";
import { addressToLimbs, computeNullifier } from "./protocol.js";
import { strKeyToPayload } from "./strkey.js";
import type { FieldElement, ProofPackage, ProofPackageDraft } from "./types.js";

export const CREDENTIAL_DERIVATION_PREFIX = "WISP_CREDENTIAL_SECRET";

export function credentialDerivationMessage(input: {
  networkPassphrase: string;
  issuer: string;
  wallet: string;
}): string {
  for (const [name, value] of Object.entries(input)) {
    if (!value || value.includes("\n")) {
      throw new Error(`${name} must be non-empty and contain no newlines`);
    }
  }
  return [
    CREDENTIAL_DERIVATION_PREFIX,
    `network=${input.networkPassphrase}`,
    `issuer=${input.issuer}`,
    `wallet=${input.wallet}`,
  ].join("\n");
}

export async function credentialSecretFromSignature(
  signature: Uint8Array,
): Promise<FieldElement> {
  if (signature.byteLength === 0) throw new Error("wallet returned an empty message signature");
  const bytes = Uint8Array.from(signature);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  return mod(BigInt(`0x${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`));
}

export function finalizeProofPackageDraft(
  draft: ProofPackageDraft,
  credentialSecret: bigint,
): ProofPackage {
  const transfer = draft.transfer;
  const publicInputs = { ...draft.public_inputs };
  const sender = addressToLimbs(addressPayload(String(transfer?.sender ?? "")));
  const recipient = addressToLimbs(addressPayload(String(transfer?.recipient ?? "")));
  const asset = addressToLimbs(addressPayload(String(transfer?.asset ?? "")));
  publicInputs.nullifier = String(
    computeNullifier({
      credentialSecret,
      issuerLo: BigInt(String(publicInputs.issuer_lo ?? "0")),
      issuerHi: BigInt(String(publicInputs.issuer_hi ?? "0")),
      senderLo: sender.lo,
      senderHi: sender.hi,
      assetLo: asset.lo,
      assetHi: asset.hi,
      epoch: BigInt(String(transfer?.epoch ?? "0")),
      recipientLo: recipient.lo,
      recipientHi: recipient.hi,
      amount: BigInt(String(transfer?.amount ?? "0")),
      corridorId: BigInt(String(transfer?.corridor_id ?? "0")),
      transferNonce: BigInt(String(draft.witness_private.transfer_nonce ?? "0")),
    }),
  );
  return { ...draft, public_inputs: publicInputs };
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
