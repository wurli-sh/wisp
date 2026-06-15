import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(__dirname, "..");
const ARTIFACTS = join(DIR, "artifacts");
const WASM = join(ARTIFACTS, "compliance_corridor_js", "compliance_corridor.wasm");
const WITNESS_CALCULATOR = join(
  ARTIFACTS,
  "compliance_corridor_js",
  "witness_calculator.js",
);
const buildWitnessCalculator = require(WITNESS_CALCULATOR);

async function witnessSucceeds(inputPath, outPath) {
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  const wasm = readFileSync(WASM);
  const witnessCalculator = await buildWitnessCalculator(wasm);
  const witness = await witnessCalculator.calculateWTNSBin(input, 0);
  writeFileSync(outPath, witness);
}

async function witnessFails(inputPath, outPath) {
  try {
    await witnessSucceeds(inputPath, outPath);
    return false;
  } catch {
    return true;
  }
}

test("valid.us-mx.json generates a witness", async () => {
  await witnessSucceeds(
    join(DIR, "inputs", "valid.us-mx.json"),
    "/tmp/amoeba-test-valid.wtns",
  );
});

test("invalid fixtures fail witness generation", async () => {
  const invalid = [
    "invalid.amount.json",
    "invalid.recipient.json",
    "invalid.expired.json",
    "invalid.sanctioned.json",
    "invalid.corridor.json",
  ];
  for (const fixture of invalid) {
    const ok = await witnessFails(
      join(DIR, "inputs", fixture),
      `/tmp/amoeba-test-${fixture}`,
    );
    assert.ok(ok, `${fixture} should be rejected by the circuit`);
  }
});

test("fixture files exist on disk", () => {
  const names = [
    "valid.us-mx.json",
    "invalid.amount.json",
    "invalid.recipient.json",
    "invalid.corridor.json",
    "invalid.expired.json",
    "invalid.sanctioned.json",
  ];
  for (const name of names) {
    const body = readFileSync(join(DIR, "inputs", name), "utf8");
    assert.ok(body.includes("merkle_root"));
  }
});
