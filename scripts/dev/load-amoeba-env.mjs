/**
 * Load Amoeba env from .env, .amoeba/*.env, with alias normalization.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

const ALIASES = {
  VERIFIER_ID: "VERIFIER_CONTRACT_ID",
  COMPLIANCE_ID: "COMPLIANCE_CONTRACT_ID",
  ASSET_ID: "SAC_CONTRACT_ID",
};

function parseEnvFile(content) {
  const out = {};
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

function loadFile(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return {};
  return parseEnvFile(fs.readFileSync(p, "utf8"));
}

export function loadAmoebaEnv() {
  const merged = {
    ...loadFile(".env"),
    ...loadFile(".env.example"),
    ...loadFile(".amoeba/verifier.env"),
    ...loadFile(".amoeba/compliance.env"),
    ...loadFile(".amoeba/sac.env"),
    ...loadFile(".amoeba/testnet-demo.env"),
  };

  for (const [from, to] of Object.entries(ALIASES)) {
    if (merged[from] && !merged[to]) merged[to] = merged[from];
    if (merged[to] && !merged[from]) merged[from] = merged[to];
  }

  return merged;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(loadAmoebaEnv(), null, 2));
}
