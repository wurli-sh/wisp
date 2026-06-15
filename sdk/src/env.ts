/**
 * Load Amoeba env from .env, .amoeba/*.env, with alias normalization.
 */
import fs from "node:fs";
import path from "node:path";

const ALIASES: Record<string, string> = {
  VERIFIER_ID: "VERIFIER_CONTRACT_ID",
  COMPLIANCE_ID: "COMPLIANCE_CONTRACT_ID",
  ASSET_ID: "SAC_CONTRACT_ID",
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

export function loadAmoebaEnv(root = process.cwd()): Record<string, string> {
  const merged: Record<string, string> = {
    ...loadFile(root, ".env"),
    ...loadFile(root, ".env.example"),
    ...loadFile(root, ".amoeba/verifier.env"),
    ...loadFile(root, ".amoeba/compliance.env"),
    ...loadFile(root, ".amoeba/sac.env"),
    ...loadFile(root, ".amoeba/testnet-demo.env"),
  };

  for (const [from, to] of Object.entries(ALIASES)) {
    if (merged[from] && !merged[to]) merged[to] = merged[from];
    if (merged[to] && !merged[from]) merged[from] = merged[to];
  }

  return merged;
}
