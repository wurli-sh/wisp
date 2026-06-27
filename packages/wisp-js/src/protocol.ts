import { mod, toString } from "./field.js";
import type { FieldElement } from "./types.js";
import {
  poseidon2Hash1,
  poseidon2Hash2,
  poseidon2Hash10,
  poseidon2Hash12,
} from "./poseidon2.js";

export const NULLIFIER_DOMAIN_TAG = 24568945153365555n;
export const CORRIDOR_DOMAIN_TAG = 0x574953505f5631n;
export const CREDENTIAL_DOMAIN_TAG = 24568945153365555n;

export function addressToLimbs(bytes32: Buffer): { lo: FieldElement; hi: FieldElement } {
  if (bytes32.length !== 32) {
    throw new Error(`address must be exactly 32 bytes, received ${bytes32.length}`);
  }
  const hi = BigInt("0x" + bytes32.subarray(0, 16).toString("hex"));
  const lo = BigInt("0x" + bytes32.subarray(16, 32).toString("hex"));
  return { lo: mod(lo), hi: mod(hi) };
}

export function computeCorridorConfigHash({
  corridorId,
  sourceJurisdictionRoot,
  destAddressRoot,
  enabled = 1n,
  travelRuleThreshold = 0n,
}: {
  corridorId: bigint | FieldElement;
  sourceJurisdictionRoot: bigint | FieldElement;
  destAddressRoot: bigint | FieldElement;
  enabled?: bigint;
  travelRuleThreshold?: bigint;
}): FieldElement {
  const label = poseidon2Hash1(mod(CORRIDOR_DOMAIN_TAG));
  return poseidon2Hash10([
    label,
    mod(corridorId),
    mod(sourceJurisdictionRoot),
    mod(destAddressRoot),
    mod(travelRuleThreshold),
    mod(enabled),
    mod(0),
    mod(0),
    mod(0),
    mod(0),
  ]);
}

export function computeCredentialCommitment({
  issuerLo,
  issuerHi,
  senderLo,
  senderHi,
  credentialSecret,
  jurisdiction,
  credentialExpiry,
}: {
  issuerLo: FieldElement;
  issuerHi: FieldElement;
  senderLo: FieldElement;
  senderHi: FieldElement;
  credentialSecret: bigint | FieldElement;
  jurisdiction: bigint | FieldElement;
  credentialExpiry: bigint | FieldElement;
}): FieldElement {
  const domain = poseidon2Hash1(mod(CREDENTIAL_DOMAIN_TAG));
  return poseidon2Hash10([
    domain,
    mod(issuerLo),
    mod(issuerHi),
    mod(senderLo),
    mod(senderHi),
    mod(credentialSecret),
    mod(jurisdiction),
    mod(credentialExpiry),
    mod(0),
    mod(0),
  ]);
}

export function computeNullifier(input: {
  credentialSecret: bigint | FieldElement;
  issuerLo: FieldElement;
  issuerHi: FieldElement;
  senderLo: FieldElement;
  senderHi: FieldElement;
  assetLo: FieldElement;
  assetHi: FieldElement;
  epoch: bigint | FieldElement;
  recipientLo: FieldElement;
  recipientHi: FieldElement;
  amount: bigint | FieldElement;
  corridorId: bigint | FieldElement;
  transferNonce?: bigint | FieldElement;
}): FieldElement {
  const domain = poseidon2Hash1(mod(NULLIFIER_DOMAIN_TAG));
  const issuer = poseidon2Hash2(mod(input.issuerLo), mod(input.issuerHi));
  const sender = poseidon2Hash2(mod(input.senderLo), mod(input.senderHi));
  return poseidon2Hash12([
    domain,
    mod(input.credentialSecret),
    issuer,
    sender,
    mod(input.assetLo),
    mod(input.assetHi),
    mod(input.epoch),
    mod(input.recipientLo),
    mod(input.recipientHi),
    mod(input.amount),
    mod(input.corridorId),
    mod(input.transferNonce ?? 0n),
  ]);
}
