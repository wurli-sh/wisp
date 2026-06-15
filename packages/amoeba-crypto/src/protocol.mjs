import { mod, toString } from "./field.mjs";
import {
  poseidon2Hash1,
  poseidon2Hash2,
  poseidon2Hash10,
  poseidon2Hash11,
} from "./poseidon2.mjs";

export const NULLIFIER_DOMAIN_TAG = 1204609112206068373041n;
export const CORRIDOR_DOMAIN_TAG = 0x414d4f4542415f5631n;

export function addressToLimbs(bytes32) {
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
}) {
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
}) {
  const nullifierDomain = poseidon2Hash1(mod(NULLIFIER_DOMAIN_TAG));
  return poseidon2Hash11([
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
  ]);
}

export function computeCredentialCommitment({
  credentialSecret,
  jurisdiction,
  credentialExpiry,
}) {
  const inner = poseidon2Hash2(mod(credentialSecret), mod(jurisdiction));
  return poseidon2Hash2(inner, mod(credentialExpiry));
}
