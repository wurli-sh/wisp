import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWispEnv } from "./env.js";

function defaultRepoRoot(): string {
  // sdk/src or sdk/dist → repo root (one level up from package root).
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "../..");
}

/** Repo root for artifact/env paths; override with WISP_REPO_ROOT. */
export const REPO_ROOT = process.env.WISP_REPO_ROOT ?? defaultRepoRoot();

export interface WispConfig {
  profile: string;
  rpcUrl: string;
  networkPassphrase: string;
  verifierId?: string;
  complianceId?: string;
  assetId?: string;
  issuerPublicKey?: string;
  issuerUrl: string;
  artifactDir: string;
  zkeyPath: string;
  wasmPath: string;
  witnessGen: string;
  /** Browser proving artifact URLs (frontend). */
  wasmUrl?: string;
  zkeyUrl?: string;
  /** JSON URL or inline demo strkeys for browser settle (no fs). */
  demoFixtureUrl?: string;
  demoStrkeys?: DemoStrkeys;
  /** Event scan start ledger for validatePackage / chain root reads. */
  validateStartLedger?: number;
}

export interface DemoStrkeys {
  issuer_strkey?: string;
  asset_strkey?: string;
  sender_strkey?: string;
  recipient_strkey?: string;
}

function optionalLedger(value: string | undefined, name: string): number | undefined {
  if (value == null || value === "") return undefined;
  const ledger = Number(value);
  if (!Number.isSafeInteger(ledger) || ledger < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return ledger;
}

export function loadConfig(overrides: Record<string, string | undefined> = {}): WispConfig {
  const env = { ...loadWispEnv(REPO_ROOT), ...process.env, ...overrides };
  const profile = env.WISP_FIXTURE_PROFILE ?? "local";

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
    artifactDir: env.WISP_ARTIFACT_DIR ?? path.join(REPO_ROOT, "circuits/circom/artifacts"),
    zkeyPath:
      env.WISP_ZKEY_PATH ??
      path.join(REPO_ROOT, "circuits/circom/artifacts/compliance_corridor_final.zkey"),
    wasmPath:
      env.WISP_WASM_PATH ??
      path.join(
        REPO_ROOT,
        "circuits/circom/artifacts/compliance_corridor_js/compliance_corridor.wasm",
      ),
    witnessGen:
      env.WISP_WITNESS_GEN ??
      path.join(
        REPO_ROOT,
        "circuits/circom/artifacts/compliance_corridor_js/generate_witness.js",
      ),
    wasmUrl: env.WISP_WASM_URL ?? env.VITE_WISP_WASM_URL,
    zkeyUrl: env.WISP_ZKEY_URL ?? env.VITE_WISP_ZKEY_URL,
    demoFixtureUrl: env.WISP_DEMO_FIXTURE_URL ?? env.VITE_WISP_DEMO_FIXTURE_URL,
    validateStartLedger: env.VALIDATE_START_LEDGER
      ? optionalLedger(env.VALIDATE_START_LEDGER, "VALIDATE_START_LEDGER")
      : optionalLedger(env.COMPLIANCE_DEPLOY_LEDGER, "COMPLIANCE_DEPLOY_LEDGER"),
  };
}
