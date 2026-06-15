import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAmoebaEnv } from "../../scripts/dev/load-amoeba-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.join(__dirname, "../..");

export function loadConfig(overrides = {}) {
  const env = { ...loadAmoebaEnv(), ...process.env, ...overrides };
  const profile = env.AMOEBA_FIXTURE_PROFILE ?? "local";

  return {
    profile,
    rpcUrl: env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
    networkPassphrase:
      env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
    verifierId: env.VERIFIER_CONTRACT_ID ?? env.VERIFIER_ID,
    complianceId: env.COMPLIANCE_CONTRACT_ID ?? env.COMPLIANCE_ID,
    assetId: env.SAC_CONTRACT_ID ?? env.ASSET_ID,
    issuerPublicKey: env.ISSUER_PUBLIC_KEY,
    issuerUrl: env.ISSUER_URL ?? "http://127.0.0.1:3000",
    artifactDir: env.AMOEBA_ARTIFACT_DIR ?? path.join(REPO_ROOT, "circuits/circom/artifacts"),
    zkeyPath:
      env.AMOEBA_ZKEY_PATH ??
      path.join(REPO_ROOT, "circuits/circom/artifacts/compliance_corridor_final.zkey"),
    wasmPath:
      env.AMOEBA_WASM_PATH ??
      path.join(
        REPO_ROOT,
        "circuits/circom/artifacts/compliance_corridor_js/compliance_corridor.wasm",
      ),
    witnessGen:
      env.AMOEBA_WITNESS_GEN ??
      path.join(
        REPO_ROOT,
        "circuits/circom/artifacts/compliance_corridor_js/generate_witness.js",
      ),
  };
}
