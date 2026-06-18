import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PUBLIC_INPUT_FIELDS } from "@amoeba/bindings/publicInputs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

const proofPackageSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "schemas", "proof-package.v1.json"), "utf8"),
) as {
  required: string[];
  properties: Record<
    string,
    {
      required?: string[];
      properties?: Record<string, unknown>;
      const?: number;
    }
  >;
};

function rustStructFields(source: string, structName: string): string[] {
  const re = new RegExp(`pub struct ${structName}\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = source.match(re);
  assert.ok(match, `Rust struct ${structName} not found`);
  const fields: string[] = [];
  for (const line of match[1].split("\n")) {
    const fieldMatch = line.match(/^\s*pub\s+(\w+):/);
    if (fieldMatch) fields.push(fieldMatch[1]);
  }
  return fields;
}

function tsInterfaceFields(source: string, interfaceName: string): string[] {
  const lines = source.split("\n");
  const start = lines.findIndex((line) =>
    new RegExp(`export interface ${interfaceName}\\b`).test(line),
  );
  assert.ok(start >= 0, `TS interface ${interfaceName} not found`);
  const fields: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^}/.test(line)) break;
    const fieldMatch = line.match(/^  (\w+)\??:/);
    if (fieldMatch) fields.push(fieldMatch[1]);
  }
  return fields;
}

const rustSource = fs.readFileSync(
  path.join(ROOT, "backend/crates/amoeba-types/src/proof_package.rs"),
  "utf8",
);
const tsSource = fs.readFileSync(
  path.join(ROOT, "packages/amoeba-js/src/types.ts"),
  "utf8",
);

const schemaTopLevel = Object.keys(proofPackageSchema.properties);
const rustProofPackage = rustStructFields(rustSource, "ProofPackage");
const tsProofPackage = tsInterfaceFields(tsSource, "ProofPackage");

test("proof-package schema public_inputs match ABI", () => {
  const schemaFields = proofPackageSchema.properties.public_inputs.required!;
  assert.deepEqual(schemaFields, [...PUBLIC_INPUT_FIELDS]);
});

test("proof-package schema roots cover compliance rebuild fields", () => {
  const roots = proofPackageSchema.properties.roots.required!;
  for (const field of [
    "merkle_root",
    "sanctions_root",
    "jurisdiction_root",
    "source_jurisdiction_root",
    "dest_address_root",
    "corridor_config_hash",
  ]) {
    assert.ok(roots.includes(field), `schema roots missing ${field}`);
  }
});

test("proof-package schema paths include five Merkle trees", () => {
  const paths = proofPackageSchema.properties.paths.required!;
  for (const prefix of [
    "membership",
    "sanctions",
    "jurisdiction",
    "source_jurisdiction",
    "dest_address",
  ]) {
    assert.ok(paths.includes(prefix), `schema paths missing ${prefix}`);
    assert.ok(paths.includes(`${prefix}_indices`), `schema paths missing ${prefix}_indices`);
  }
});

test("proof-package schema version is 1", () => {
  assert.equal(proofPackageSchema.properties.schema_version.const, 1);
});

test("ProofPackage top-level fields match Rust amoeba-types", () => {
  assert.deepEqual([...rustProofPackage].sort(), [...schemaTopLevel].sort());
});

test("ProofPackage top-level fields match @amoeba/js types", () => {
  assert.deepEqual([...tsProofPackage].sort(), [...schemaTopLevel].sort());
});

test("nested ProofPackage sections match Rust structs", () => {
  const nested: Array<[string, string]> = [
    ["credential", "Credential"],
    ["transfer", "TransferParams"],
    ["roots", "Roots"],
    ["paths", "MerklePaths"],
    ["witness_private", "WitnessPrivate"],
    ["demo", "DemoPackageMetadata"],
  ];
  for (const [schemaKey, rustStruct] of nested) {
    const schemaFields = Object.keys(proofPackageSchema.properties[schemaKey].properties ?? {});
    const rustFields = rustStructFields(rustSource, rustStruct);
    assert.deepEqual(
      [...schemaFields].sort(),
      [...rustFields].sort(),
      `${schemaKey} vs ${rustStruct}`,
    );
  }
});

test("ProofPackagePaths matches schema paths keys", () => {
  const schemaPaths = proofPackageSchema.properties.paths.required!;
  const tsPaths = tsInterfaceFields(tsSource, "ProofPackagePaths");
  assert.deepEqual([...tsPaths].sort(), [...schemaPaths].sort());
});
