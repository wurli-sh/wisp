export interface FrontendEnv {
  profile: string;
  rpcUrl: string;
  networkPassphrase: string;
  verifierId?: string;
  complianceId?: string;
  assetId?: string;
  issuerPublicKey?: string;
  issuerUrl: string;
  validateStartLedger?: number;
  wasmUrl: string;
  zkeyUrl: string;
  demoFixtureUrl: string;
}

function read(key: string): string | undefined {
  const value = import.meta.env[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const env: FrontendEnv = {
  profile: read("VITE_WISP_FIXTURE_PROFILE") ?? "testnet",
  rpcUrl: read("VITE_STELLAR_RPC_URL") ?? "https://soroban-testnet.stellar.org",
  networkPassphrase:
    read("VITE_NETWORK_PASSPHRASE") ?? "Test SDF Network ; September 2015",
  verifierId: read("VITE_VERIFIER_CONTRACT_ID"),
  complianceId: read("VITE_COMPLIANCE_CONTRACT_ID"),
  assetId: read("VITE_SAC_CONTRACT_ID"),
  issuerPublicKey: read("VITE_ISSUER_PUBLIC_KEY"),
  issuerUrl: read("VITE_ISSUER_URL") ?? "/issuer",
  validateStartLedger: read("VITE_VALIDATE_START_LEDGER")
    ? Number(read("VITE_VALIDATE_START_LEDGER"))
    : read("VITE_COMPLIANCE_DEPLOY_LEDGER")
      ? Number(read("VITE_COMPLIANCE_DEPLOY_LEDGER"))
      : undefined,
  wasmUrl: read("VITE_WISP_WASM_URL") ?? "/circuits/compliance_corridor.wasm",
  zkeyUrl:
    read("VITE_WISP_ZKEY_URL") ?? "/circuits/compliance_corridor_final.zkey",
  demoFixtureUrl:
    read("VITE_WISP_DEMO_FIXTURE_URL") ?? "/fixtures/demo-transfer-testnet.json",
};

export function getWispConfigOverrides(): Record<string, string | undefined> {
  return {
    WISP_FIXTURE_PROFILE: env.profile,
    STELLAR_RPC_URL: env.rpcUrl,
    NETWORK_PASSPHRASE: env.networkPassphrase,
    VERIFIER_CONTRACT_ID: env.verifierId,
    COMPLIANCE_CONTRACT_ID: env.complianceId,
    SAC_CONTRACT_ID: env.assetId,
    ISSUER_PUBLIC_KEY: env.issuerPublicKey,
    ISSUER_URL: env.issuerUrl,
    VALIDATE_START_LEDGER:
      env.validateStartLedger != null ? String(env.validateStartLedger) : undefined,
    WISP_WASM_URL: env.wasmUrl,
    WISP_ZKEY_URL: env.zkeyUrl,
    WISP_DEMO_FIXTURE_URL: env.demoFixtureUrl,
    WISP_ARTIFACT_DIR: "/circuits",
    WISP_ZKEY_PATH: env.zkeyUrl,
    WISP_WASM_PATH: env.wasmUrl,
    WISP_WITNESS_GEN: "",
  };
}

export function stellarExplorerAccount(publicKey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}

export function stellarExplorerTx(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}
