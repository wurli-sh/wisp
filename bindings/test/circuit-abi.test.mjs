import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { PUBLIC_INPUT_FIELDS } from "../generated/publicInputs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

test("generated order matches compliance_corridor.circom public signals", () => {
  const circom = fs.readFileSync(
    path.join(ROOT, "circuits/circom/compliance_corridor.circom"),
    "utf8",
  );
  const match = circom.match(/component main \{public \[([\s\S]*?)\]\}/);
  assert.ok(match, "public signal block not found");
  const names = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  assert.deepEqual(names, [...PUBLIC_INPUT_FIELDS]);
});

test("generated order matches snarkjs public.json golden", () => {
  const publicSignals = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "circuits/circom/artifacts/public.json"),
      "utf8",
    ),
  );
  const valid = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "fixtures", "public-inputs.valid.json"), "utf8"),
  );
  assert.equal(publicSignals.length, PUBLIC_INPUT_FIELDS.length);
  for (let i = 0; i < PUBLIC_INPUT_FIELDS.length; i++) {
    const field = PUBLIC_INPUT_FIELDS[i];
    assert.equal(publicSignals[i], valid[field], `mismatch at ${field}`);
  }
});
