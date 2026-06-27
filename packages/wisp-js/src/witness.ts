import {
  addressToLimbs,
  computeCorridorConfigHash,
  computeCredentialCommitment,
  computeNullifier,
} from "./protocol.js";
import {
  fieldToJson,
  fieldsToJson,
  getMerklePathForIndex,
  merkleRootForLeafAtIndex,
  sparseSanctionsPath,
} from "./merkle.js";
import { poseidon2Hash1, poseidon2Hash2 } from "./poseidon2.js";
import type {
  DemoFixture,
  DemoParams,
  ProofPackage,
  ProtocolConfig,
  WitnessInput,
} from "./types.js";

export const EPOCH_LEN_SECS = 86400;

/**
 * Build internal demo params from bindings fixture JSON.
 */
export function demoFromFixture(fixture: DemoFixture): DemoParams {
  return {
    credential_secret: BigInt(fixture.credential_secret),
    transfer_nonce: BigInt(fixture.transfer_nonce ?? 0),
    sender: Buffer.from(fixture.sender_hex, "hex"),
    recipient: Buffer.from(fixture.recipient_hex, "hex"),
    asset: Buffer.from(fixture.asset_hex, "hex"),
    amount: BigInt(fixture.amount),
    epoch: BigInt(fixture.epoch),
    jurisdiction: BigInt(fixture.jurisdiction),
    credential_expiry: BigInt(fixture.credential_expiry),
    corridor_id: fixture.corridor_id != null ? BigInt(fixture.corridor_id) : undefined,
  };
}

/**
 * Build full Circom witness JSON from demo params (same logic as gen-fixture.ts).
 */
export function buildWitnessInput(
  demo: DemoParams,
  overrides: Partial<DemoParams> = {},
  protocol: ProtocolConfig = {},
): WitnessInput {
  const corridorIdDefault = protocol.CORRIDOR_ID ?? 1n;
  const d = { ...demo, ...overrides };
  const senderLimbs = addressToLimbs(d.sender);
  const recipientLimbs = addressToLimbs(d.recipient);
  const assetLimbs = addressToLimbs(d.asset);
  const issuerLimbs = addressToLimbs(d.issuer ?? d.sender);
  const timestamp = d.epoch * BigInt(protocol.EPOCH_LEN_SECS ?? EPOCH_LEN_SECS);

  const senderLeaf = computeCredentialCommitment({
    issuerLo: issuerLimbs.lo,
    issuerHi: issuerLimbs.hi,
    senderLo: senderLimbs.lo,
    senderHi: senderLimbs.hi,
    credentialSecret: d.credential_secret,
    jurisdiction: d.jurisdiction,
    credentialExpiry: d.credential_expiry,
  });
  const membershipPath = getMerklePathForIndex(0);
  const merkleRoot = merkleRootForLeafAtIndex(senderLeaf, 0);

  const jurisdictionLeaf = poseidon2Hash1(d.jurisdiction);
  const jurisdictionPath = getMerklePathForIndex(0);
  const jurisdictionRoot = merkleRootForLeafAtIndex(jurisdictionLeaf, 0);

  const sourcePath = getMerklePathForIndex(0);
  const sourceJurisdictionRoot = merkleRootForLeafAtIndex(jurisdictionLeaf, 0);

  const destLeaf = poseidon2Hash2(recipientLimbs.lo, recipientLimbs.hi);
  const destPath = getMerklePathForIndex(0);
  const destAddressRoot = merkleRootForLeafAtIndex(destLeaf, 0);

  const sanctions = sparseSanctionsPath(senderLimbs.lo, senderLimbs.hi);

  const corridorId = d.corridor_id ?? corridorIdDefault;

  const nullifier = computeNullifier({
      credentialSecret: d.credential_secret,
    issuerLo: issuerLimbs.lo,
    issuerHi: issuerLimbs.hi,
    senderLo: senderLimbs.lo,
    senderHi: senderLimbs.hi,
    assetLo: assetLimbs.lo,
    assetHi: assetLimbs.hi,
    epoch: d.epoch,
    recipientLo: recipientLimbs.lo,
    recipientHi: recipientLimbs.hi,
      amount: d.amount,
      corridorId,
      transferNonce: d.transfer_nonce,
    });

  const corridorConfigHash = computeCorridorConfigHash({
    corridorId,
    sourceJurisdictionRoot,
    destAddressRoot,
  });

  return {
    merkle_root: fieldToJson(merkleRoot),
    nullifier: fieldToJson(nullifier),
    asset_lo: fieldToJson(assetLimbs.lo),
    asset_hi: fieldToJson(assetLimbs.hi),
    sender_lo: fieldToJson(senderLimbs.lo),
    sender_hi: fieldToJson(senderLimbs.hi),
    epoch: fieldToJson(d.epoch),
    recipient_lo: fieldToJson(recipientLimbs.lo),
    recipient_hi: fieldToJson(recipientLimbs.hi),
    amount: fieldToJson(d.amount),
    sanctions_root: fieldToJson(sanctions.root),
    jurisdiction_root: fieldToJson(jurisdictionRoot),
    timestamp: fieldToJson(timestamp),
    corridor_id: fieldToJson(corridorId),
    corridor_config_hash: fieldToJson(corridorConfigHash),
    source_jurisdiction_root: fieldToJson(sourceJurisdictionRoot),
    dest_address_root: fieldToJson(destAddressRoot),
    issuer_lo: fieldToJson(issuerLimbs.lo),
    issuer_hi: fieldToJson(issuerLimbs.hi),
    credential_secret: fieldToJson(d.credential_secret),
    transfer_nonce: fieldToJson(d.transfer_nonce),
    path: fieldsToJson(membershipPath.path),
    path_indices: membershipPath.pathIndices,
    jurisdiction: fieldToJson(d.jurisdiction),
    jurisdiction_path: fieldsToJson(jurisdictionPath.path),
    jurisdiction_path_indices: jurisdictionPath.pathIndices,
    credential_expiry: fieldToJson(d.credential_expiry),
    source_jurisdiction_path: fieldsToJson(sourcePath.path),
    source_jurisdiction_path_indices: sourcePath.pathIndices,
    dest_address_path: fieldsToJson(destPath.path),
    dest_address_path_indices: destPath.pathIndices,
    sanctions_path: fieldsToJson(sanctions.path),
    sanctions_path_indices: sanctions.pathIndices,
    sanctions_leaf_value: "0",
  };
}

/**
 * Map issuer ProofPackage JSON → Circom witness input (no Merkle re-derivation).
 */
export function proofPackageToWitnessInput(
  pkg: ProofPackage,
  credentialSecret?: string | number | bigint,
): WitnessInput {
  const wp = pkg.witness_private;
  if (!wp) {
    throw new Error("ProofPackage missing witness_private");
  }
  const pi = pkg.public_inputs ?? {};
  const resolvedCredentialSecret = credentialSecret ?? wp.credential_secret;
  if (resolvedCredentialSecret == null) {
    throw new Error("credential_secret must be supplied locally");
  }
  const pick = (name: string, fallback?: string | number | null): string => {
    const v = pi[name];
    if (v != null) return String(v);
    if (fallback != null) return String(fallback);
    throw new Error(`missing public input or path field: ${name}`);
  };

  return {
    merkle_root: pick("merkle_root", pkg.roots?.merkle_root),
    nullifier: pick("nullifier"),
    asset_lo: pick("asset_lo"),
    asset_hi: pick("asset_hi"),
    sender_lo: pick("sender_lo"),
    sender_hi: pick("sender_hi"),
    epoch: pick("epoch", pkg.transfer?.epoch),
    recipient_lo: pick("recipient_lo"),
    recipient_hi: pick("recipient_hi"),
    amount: pick("amount", pkg.transfer?.amount),
    sanctions_root: pick("sanctions_root", pkg.roots?.sanctions_root),
    jurisdiction_root: pick("jurisdiction_root", pkg.roots?.jurisdiction_root),
    timestamp: pick("timestamp", pkg.transfer?.timestamp),
    corridor_id: pick("corridor_id", pkg.transfer?.corridor_id),
    corridor_config_hash: pick(
      "corridor_config_hash",
      pkg.roots?.corridor_config_hash,
    ),
    source_jurisdiction_root: pick(
      "source_jurisdiction_root",
      pkg.roots?.source_jurisdiction_root,
    ),
    dest_address_root: pick("dest_address_root", pkg.roots?.dest_address_root),
    issuer_lo: pick("issuer_lo"),
    issuer_hi: pick("issuer_hi"),
    credential_secret: String(resolvedCredentialSecret),
    transfer_nonce: String(wp.transfer_nonce ?? 0),
    path: pkg.paths.membership,
    path_indices: pkg.paths.membership_indices,
    jurisdiction: String(wp.jurisdiction),
    jurisdiction_path: pkg.paths.jurisdiction,
    jurisdiction_path_indices: pkg.paths.jurisdiction_indices,
    credential_expiry: String(wp.credential_expiry),
    source_jurisdiction_path: pkg.paths.source_jurisdiction,
    source_jurisdiction_path_indices: pkg.paths.source_jurisdiction_indices,
    dest_address_path: pkg.paths.dest_address,
    dest_address_path_indices: pkg.paths.dest_address_indices,
    sanctions_path: pkg.paths.sanctions,
    sanctions_path_indices: pkg.paths.sanctions_indices,
    sanctions_leaf_value: wp.sanctions_leaf_value ?? "0",
  };
}
