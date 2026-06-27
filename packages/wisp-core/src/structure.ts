import type { ProofPackage } from "@wisp_/js";

const MERKLE_DEPTH = 20;

const PATH_KEYS = [
  "membership",
  "sanctions",
  "jurisdiction",
  "source_jurisdiction",
  "dest_address",
] as const;

const ROOT_KEYS = [
  "merkle_root",
  "sanctions_root",
  "jurisdiction_root",
  "source_jurisdiction_root",
  "dest_address_root",
  "corridor_config_hash",
] as const;

const PUBLIC_INPUT_KEYS = [
  "merkle_root",
  "nullifier",
  "asset_lo",
  "asset_hi",
  "sender_lo",
  "sender_hi",
  "epoch",
  "recipient_lo",
  "recipient_hi",
  "amount",
  "sanctions_root",
  "jurisdiction_root",
  "timestamp",
  "corridor_id",
  "corridor_config_hash",
  "source_jurisdiction_root",
  "dest_address_root",
  "issuer_lo",
  "issuer_hi",
] as const;

export function validatePackageStructure(pkg: ProofPackage): void {
  if (!pkg.paths) {
    throw new Error("ProofPackage missing paths");
  }
  if (!pkg.witness_private) {
    throw new Error("ProofPackage missing witness_private");
  }
  if (!pkg.roots) {
    throw new Error("ProofPackage missing roots");
  }
  if (!pkg.transfer) {
    throw new Error("ProofPackage missing transfer");
  }
  if (!pkg.public_inputs) {
    throw new Error("ProofPackage missing public_inputs");
  }

  for (const key of ROOT_KEYS) {
    const value = pkg.roots[key];
    if (value == null || String(value).length === 0) {
      throw new Error(`ProofPackage roots missing ${key}`);
    }
    if (!/^-?\d+$/.test(String(value))) {
      throw new Error(`ProofPackage roots.${key} must be a decimal field element`);
    }
  }

  for (const key of PATH_KEYS) {
    const path = pkg.paths[key];
    const indices = pkg.paths[`${key}_indices` as keyof typeof pkg.paths];
    if (!Array.isArray(path) || path.length !== MERKLE_DEPTH) {
      throw new Error(`ProofPackage paths.${key} must have length ${MERKLE_DEPTH}`);
    }
    if (!Array.isArray(indices) || indices.length !== MERKLE_DEPTH) {
      throw new Error(`ProofPackage paths.${key}_indices must have length ${MERKLE_DEPTH}`);
    }
    if (path.some((value) => !/^-?\d+$/.test(String(value)))) {
      throw new Error(`ProofPackage paths.${key} must contain decimal field elements`);
    }
    if (indices.some((value) => value !== 0 && value !== 1)) {
      throw new Error(`ProofPackage paths.${key}_indices must contain only 0 or 1`);
    }
  }

  for (const key of PUBLIC_INPUT_KEYS) {
    if (pkg.public_inputs[key] == null) {
      throw new Error(`ProofPackage public_inputs missing ${key}`);
    }
    if (!/^-?\d+$/.test(String(pkg.public_inputs[key]))) {
      throw new Error(`ProofPackage public_inputs.${key} must be a decimal field element`);
    }
  }

  if (pkg.witness_private.credential_secret != null) {
    throw new Error("ProofPackage must not contain credential_secret");
  }
}
