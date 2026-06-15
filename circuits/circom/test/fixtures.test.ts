import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "..");
const ARTIFACTS = join(DIR, "artifacts");
const WASM = join(ARTIFACTS, "compliance_corridor_js", "compliance_corridor.wasm");
const GEN_WITNESS = join(ARTIFACTS, "compliance_corridor_js", "generate_witness.js");

async function witnessSucceeds(inputPath, outPath) {
  const { default: builder } = await import(GEN_WITNESS);
  await builder(WASM, inputPath, outPath);
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
