#!/usr/bin/env tsx
/**
 * Compare proof package public inputs against public-inputs.valid.json using mod-BN254 equality.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeField } from "../../packages/wisp-js/src/field.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const golden = JSON.parse(
  fs.readFileSync(path.join(ROOT, "bindings/fixtures/public-inputs.valid.json"), "utf8"),
) as Record<string, string>;

async function readInput(): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const input = await readInput();
  const publicInputs = (input.public_inputs ?? input) as Record<string, unknown>;

  for (const [field, expected] of Object.entries(golden)) {
    const got = publicInputs[field];
    assert.ok(got != null, `missing ${field}`);
    assert.equal(
      normalizeField(String(got)).toString(),
      normalizeField(String(expected)).toString(),
      `${field} mismatch: got ${got} expected ${expected}`,
    );
  }

  console.log("assert-public-inputs: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
