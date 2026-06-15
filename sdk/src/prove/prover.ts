import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { proofPackageToWitnessInput } from "@amoeba/js/witness";
import type { ProofPackage } from "@amoeba/js";
import { PUBLIC_INPUT_FIELDS } from "@amoeba/bindings/publicInputs";
import type { AmoebaConfig } from "../config.js";
import { REPO_ROOT } from "../config.js";
import { serializeSnarkjsProof, type SnarkjsProof } from "./serialize.js";

export interface ProvenTransfer {
  proof: ReturnType<typeof serializeSnarkjsProof>;
  snarkjsProof: SnarkjsProof;
  publicSignals: string[];
  publicInputs: Record<string, string>;
  nullifier: string;
}

export async function proveFromPackage(
  pkg: ProofPackage,
  cfg: AmoebaConfig,
): Promise<ProvenTransfer> {
  const witnessInput = proofPackageToWitnessInput(pkg);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "amoeba-prove-"));
  const inputPath = path.join(tmpDir, "input.json");
  const witnessPath = path.join(tmpDir, "witness.wtns");
  const proofPath = path.join(tmpDir, "proof.json");
  const publicPath = path.join(tmpDir, "public.json");

  fs.writeFileSync(inputPath, JSON.stringify(witnessInput, null, 2));

  execFileSync(
    process.execPath,
    [cfg.witnessGen, cfg.wasmPath, inputPath, witnessPath],
    { stdio: "inherit" },
  );

  const snarkjsBin = path.join(REPO_ROOT, "node_modules", ".bin", "snarkjs");
  execFileSync(
    snarkjsBin,
    ["groth16", "prove", cfg.zkeyPath, witnessPath, proofPath, publicPath],
    { stdio: "inherit", cwd: REPO_ROOT },
  );

  const proof = JSON.parse(fs.readFileSync(proofPath, "utf8")) as SnarkjsProof;
  const publicSignals = JSON.parse(fs.readFileSync(publicPath, "utf8")) as string[];

  const publicInputs = Object.fromEntries(
    PUBLIC_INPUT_FIELDS.map((name, i) => [name, publicSignals[i]]),
  );

  return {
    proof: serializeSnarkjsProof(proof),
    snarkjsProof: proof,
    publicSignals,
    publicInputs,
    nullifier: publicInputs.nullifier,
  };
}
