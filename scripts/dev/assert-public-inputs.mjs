#!/usr/bin/env node
/**
 * Compare proof package public inputs against public-inputs.valid.json using mod-BN254 equality.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BN254_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function normalize(decimal) {
  let n = BigInt(decimal);
  n = ((n % BN254_R) + BN254_R) % BN254_R;
  return n.toString();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const golden = JSON.parse(
  fs.readFileSync(path.join(ROOT, "bindings/fixtures/public-inputs.valid.json"), "utf8"),
);

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const input = await readInput();
const publicInputs = input.public_inputs ?? input;

for (const [field, expected] of Object.entries(golden)) {
  const got = publicInputs[field];
  assert.ok(got != null, `missing ${field}`);
  assert.equal(
    normalize(String(got)),
    normalize(String(expected)),
    `${field} mismatch: got ${got} expected ${expected}`,
  );
}

console.log("assert-public-inputs: OK");
