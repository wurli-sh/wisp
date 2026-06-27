import type { ProofPackage } from "@wisp_/js";

/**
 * Node-only JSON Schema validation. Statically imports `ajv` plus `node:fs`/
 * `node:path`/`node:url` and reads the schema from disk, so it is loaded lazily
 * via a non-analyzable dynamic import from {@link import("./structure.js")} and
 * never enters a browser bundle.
 */
export async function runStrictSchemaValidation(pkg: ProofPackage): Promise<void> {
  const { default: Ajv } = await import("ajv");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { REPO_ROOT } = await import("../config.js");
  const schemaPath = path.join(REPO_ROOT, "bindings/schemas/proof-package.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as object;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(pkg)) {
    const detail = ajv.errorsText(validate.errors);
    throw new Error(`ProofPackage JSON Schema validation failed: ${detail}`);
  }
}
