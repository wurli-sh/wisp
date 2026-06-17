import { mod, toString } from "./field.js";
import type { FieldElement } from "./types.js";
import {
  poseidon2Hash1,
  poseidon2Hash2,
  poseidon2Hash10,
  poseidon2Hash12,
} from "./poseidon2.js";

export const NULLIFIER_DOMAIN_TAG = 1204609112206068373041n;
export const CORRIDOR_DOMAIN_TAG = 0x414d4f4542415f5631n;

export function addressToLimbs(bytes32: Buffer): { lo: FieldElement; hi: FieldElement } {
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

export function computeNullifier({
  credentialSecret,
  senderLo,
  senderHi,
  assetLo,
  assetHi,
  epoch,
  recipientLo,
  recipientHi,
  amount,
  corridorId,
  transferNonce,
}: {
  credentialSecret: bigint | FieldElement;
  senderLo: FieldElement;
  senderHi: FieldElement;
  assetLo: FieldElement;
  assetHi: FieldElement;
  epoch: bigint | FieldElement;
  recipientLo: FieldElement;
  recipientHi: FieldElement;
  amount: bigint | FieldElement;
  corridorId: bigint | FieldElement;
  transferNonce: bigint | FieldElement;
}): FieldElement {
  const nullifierDomain = poseidon2Hash1(mod(NULLIFIER_DOMAIN_TAG));
  return poseidon2Hash12([
    nullifierDomain,
    mod(credentialSecret),
    mod(senderLo),
    mod(senderHi),
    mod(assetLo),
    mod(assetHi),
    mod(epoch),
    mod(recipientLo),
    mod(recipientHi),
    mod(amount),
    mod(corridorId),
    mod(transferNonce),
  ]);
}

export function computeCredentialCommitment({
  credentialSecret,
  jurisdiction,
  credentialExpiry,
}: {
  credentialSecret: bigint | FieldElement;
  jurisdiction: bigint | FieldElement;
  credentialExpiry: bigint | FieldElement;
}): FieldElement {
  const inner = poseidon2Hash2(mod(credentialSecret), mod(jurisdiction));
  return poseidon2Hash2(inner, mod(credentialExpiry));
}
