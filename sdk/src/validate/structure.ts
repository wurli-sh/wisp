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
  }

  for (const key of PUBLIC_INPUT_KEYS) {
    if (pkg.public_inputs[key] == null) {
      throw new Error(`ProofPackage public_inputs missing ${key}`);
    }
  }

  if (pkg.schema_version != null && pkg.schema_version !== 1) {
    throw new Error(`unsupported ProofPackage schema_version: ${pkg.schema_version}`);
  }
}

export async function validatePackageStrict(pkg: ProofPackage): Promise<void> {
  validatePackageStructure(pkg);
  const { default: Ajv } = await import("ajv");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { REPO_ROOT } = await import("../config.js");
  const schemaPath = path.join(REPO_ROOT, "bindings/schemas/proof-package.v1.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as object;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(pkg)) {
    const detail = ajv.errorsText(validate.errors);
    throw new Error(`ProofPackage JSON Schema validation failed: ${detail}`);
  }
}
