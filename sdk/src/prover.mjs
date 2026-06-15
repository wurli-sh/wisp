import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { proofPackageToWitnessInput } from "../../packages/amoeba-crypto/src/witness.mjs";
import { serializeSnarkjsProof } from "./serialize.mjs";
import { PUBLIC_INPUT_FIELDS } from "../../bindings/generated/publicInputs.mjs";
import { REPO_ROOT } from "./config.mjs";

export async function proveFromPackage(pkg, cfg) {
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

  const snarkjsBin = path.join(
    REPO_ROOT,
    "node_modules",
    ".bin",
    "snarkjs",
  );
  execFileSync(
    snarkjsBin,
    ["groth16", "prove", cfg.zkeyPath, witnessPath, proofPath, publicPath],
    { stdio: "inherit", cwd: REPO_ROOT },
  );

  const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  const publicSignals = JSON.parse(fs.readFileSync(publicPath, "utf8"));

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
