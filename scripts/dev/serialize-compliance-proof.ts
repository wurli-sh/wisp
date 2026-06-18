#!/usr/bin/env tsx
/**
 * Convert snarkjs proof.json + public.json into Stellar CLI-friendly JSON.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeSnarkjsProof, type SnarkjsProof } from "@amoeba_/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const artifacts = join(root, "circuits/circom/artifacts");

const proof = JSON.parse(readFileSync(join(artifacts, "proof.json"), "utf8")) as SnarkjsProof;
const publicSignals = JSON.parse(
  readFileSync(join(artifacts, "public.json"), "utf8"),
) as string[];

const stellarProof = serializeSnarkjsProof(proof);

const outDir = join(root, "scripts/fixtures/compliance-testnet");
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, "proof.json"),
  JSON.stringify(
    {
      proof: {
        a: stellarProof.a.toString("hex"),
        b: stellarProof.b.toString("hex"),
        c: stellarProof.c.toString("hex"),
      },
      pub_signals: publicSignals,
    },
    null,
    2,
  ),
);
console.log(`Wrote ${join(outDir, "proof.json")}`);
