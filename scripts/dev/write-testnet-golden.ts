#!/usr/bin/env tsx
/**
 * Write bindings/fixtures/public-inputs.testnet.json from snarkjs public.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_INPUT_FIELDS } from "@amoeba/bindings/publicInputs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const publicPath = path.join(ROOT, "circuits/circom/artifacts/public.json");
const outPath = path.join(ROOT, "bindings/fixtures/public-inputs.testnet.json");

if (!fs.existsSync(publicPath)) {
  console.error(`Missing ${publicPath} — run prove.sh for testnet fixture first`);
  process.exit(1);
}

const signals = JSON.parse(fs.readFileSync(publicPath, "utf8")) as string[];
if (signals.length !== PUBLIC_INPUT_FIELDS.length) {
  console.error(
    `Expected ${PUBLIC_INPUT_FIELDS.length} public signals, got ${signals.length}`,
  );
  process.exit(1);
}

const out = Object.fromEntries(
  PUBLIC_INPUT_FIELDS.map((name, i) => [name, signals[i]]),
);

fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
