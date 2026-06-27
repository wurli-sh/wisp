import type { WispConfig } from "./config.js";

function browserEnv(): Record<string, string | undefined> {
  // Vite/webpack replace `process.env.X` at build time; guard for runtimes
  // where `process` is not defined at all.
  if (typeof process !== "undefined" && process.env) {
    return process.env as Record<string, string | undefined>;
  }
  return {};
}

function optionalLedger(value: string | undefined, name: string): number | undefined {
  if (value == null || value === "") return undefined;
  const ledger = Number(value);
  if (!Number.isSafeInteger(ledger) || ledger < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return ledger;
}

/**
 * Browser-safe config loader. Unlike {@link import("./config.js").loadConfig},
 * this reads only from `overrides` (and `process.env` when a bundler injects
 * it) — it never touches the filesystem, `node:path`, or `node:url`. Artifact
 * paths default to empty strings because browser proving uses `wasmUrl`/`zkeyUrl`.
 */
export function loadConfigBrowser(
  overrides: Record<string, string | undefined> = {},
): WispConfig {
  const env = { ...browserEnv(), ...overrides };
  const profile = env.WISP_FIXTURE_PROFILE ?? "testnet";

  return {
    profile,
    rpcUrl: env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
    networkPassphrase: env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
    verifierId: env.VERIFIER_CONTRACT_ID ?? env.VERIFIER_ID,
    complianceId: env.COMPLIANCE_CONTRACT_ID ?? env.COMPLIANCE_ID,
    assetId: env.SAC_CONTRACT_ID ?? env.ASSET_ID,
    issuerPublicKey: env.ISSUER_PUBLIC_KEY,
    issuerUrl: env.ISSUER_URL ?? "http://127.0.0.1:3000",
    artifactDir: env.WISP_ARTIFACT_DIR ?? "",
    zkeyPath: env.WISP_ZKEY_PATH ?? "",
    wasmPath: env.WISP_WASM_PATH ?? "",
    witnessGen: env.WISP_WITNESS_GEN ?? "",
    wasmUrl: env.WISP_WASM_URL ?? env.VITE_WISP_WASM_URL,
    zkeyUrl: env.WISP_ZKEY_URL ?? env.VITE_WISP_ZKEY_URL,
    demoFixtureUrl: env.WISP_DEMO_FIXTURE_URL ?? env.VITE_WISP_DEMO_FIXTURE_URL,
    validateStartLedger: env.VALIDATE_START_LEDGER
      ? optionalLedger(env.VALIDATE_START_LEDGER, "VALIDATE_START_LEDGER")
      : optionalLedger(env.COMPLIANCE_DEPLOY_LEDGER, "COMPLIANCE_DEPLOY_LEDGER"),
  };
}
