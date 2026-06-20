/**
 * Load Wisp env from .env, .wisp/*.env (legacy .amoeba/*.env), with alias normalization.
 */
import fs from "node:fs";
import path from "node:path";

const ALIASES: Record<string, string> = {
  VERIFIER_ID: "VERIFIER_CONTRACT_ID",
  COMPLIANCE_ID: "COMPLIANCE_CONTRACT_ID",
  ASSET_ID: "SAC_CONTRACT_ID",
};

/** Legacy AMOEBA_* → WISP_* for one-release cutover. */
const ENV_LEGACY: Record<string, string> = {
  AMOEBA_REPO_ROOT: "WISP_REPO_ROOT",
  AMOEBA_ENV: "WISP_ENV",
  AMOEBA_FIXTURE_PROFILE: "WISP_FIXTURE_PROFILE",
  AMOEBA_FIXTURES_DIR: "WISP_FIXTURES_DIR",
  AMOEBA_ARTIFACT_DIR: "WISP_ARTIFACT_DIR",
  AMOEBA_ZKEY_PATH: "WISP_ZKEY_PATH",
  AMOEBA_WASM_PATH: "WISP_WASM_PATH",
  AMOEBA_WITNESS_GEN: "WISP_WITNESS_GEN",
  AMOEBA_WASM_URL: "WISP_WASM_URL",
  AMOEBA_ZKEY_URL: "WISP_ZKEY_URL",
  AMOEBA_DEMO_FIXTURE_URL: "WISP_DEMO_FIXTURE_URL",
  AMOEBA_MAINNET_APPROVED: "WISP_MAINNET_APPROVED",
};

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadFile(root: string, rel: string): Record<string, string> {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return {};
  return parseEnvFile(fs.readFileSync(p, "utf8"));
}

function applyLegacyEnvAliases(env: Record<string, string>): void {
  for (const [legacy, modern] of Object.entries(ENV_LEGACY)) {
    if (env[modern] === undefined && env[legacy] !== undefined) {
      env[modern] = env[legacy];
    }
  }
}

export function loadWispEnv(root = process.cwd()): Record<string, string> {
  const merged: Record<string, string> = {
    ...loadFile(root, ".env"),
    ...loadFile(root, ".env.example"),
    ...loadFile(root, ".wisp/verifier.env"),
    ...loadFile(root, ".wisp/compliance.env"),
    ...loadFile(root, ".wisp/sac.env"),
    ...loadFile(root, ".wisp/testnet-demo.env"),
    ...loadFile(root, ".amoeba/verifier.env"),
    ...loadFile(root, ".amoeba/compliance.env"),
    ...loadFile(root, ".amoeba/sac.env"),
    ...loadFile(root, ".amoeba/testnet-demo.env"),
  };

  applyLegacyEnvAliases(merged);

  for (const [from, to] of Object.entries(ALIASES)) {
    if (merged[from] && !merged[to]) merged[to] = merged[from];
    if (merged[to] && !merged[from]) merged[from] = merged[to];
  }

  return merged;
}

/** @deprecated use loadWispEnv */
export const loadAmoebaEnv = loadWispEnv;
