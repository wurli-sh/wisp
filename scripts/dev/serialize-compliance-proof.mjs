#!/usr/bin/env node
/**
 * Convert snarkjs proof.json + public.json into Stellar CLI-friendly JSON.
 * G1/G2 encoding matches Soroban BN254 host format (big-endian, G2 c1|c0).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const artifacts = join(root, "circuits/circom/artifacts");

const proof = JSON.parse(readFileSync(join(artifacts, "proof.json"), "utf8"));
const publicSignals = JSON.parse(
  readFileSync(join(artifacts, "public.json"), "utf8"),
);

function decimalToBeHex(decimal) {
  const n = BigInt(decimal);
  if (n < 0n) throw new Error(`negative field element: ${decimal}`);
  return n.toString(16).padStart(64, "0");
}

function serializeG1(coords) {
  return decimalToBeHex(coords[0]) + decimalToBeHex(coords[1]);
}

function serializeG2(piB) {
  const xC0 = piB[0][0];
  const xC1 = piB[0][1];
  const yC0 = piB[1][0];
  const yC1 = piB[1][1];
  return (
    decimalToBeHex(xC1) +
    decimalToBeHex(xC0) +
    decimalToBeHex(yC1) +
    decimalToBeHex(yC0)
  );
}

const stellarProof = {
  a: serializeG1(proof.pi_a),
  b: serializeG2(proof.pi_b),
  c: serializeG1(proof.pi_c),
};

const outDir = join(root, "scripts/fixtures/compliance-testnet");
import { mkdirSync } from "node:fs";
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, "proof.json"),
  JSON.stringify({ proof: stellarProof, pub_signals: publicSignals }, null, 2),
);
console.log(`Wrote ${join(outDir, "proof.json")}`);
