export interface FrontendEnv {
  profile: string;
  rpcUrl: string;
  networkPassphrase: string;
  verifierId?: string;
  complianceId?: string;
  assetId?: string;
  issuerPublicKey?: string;
  issuerUrl: string;
  wasmUrl: string;
  zkeyUrl: string;
  demoFixtureUrl: string;
}

function read(key: string): string | undefined {
  const value = import.meta.env[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const env: FrontendEnv = {
  profile: read("VITE_AMOEBA_FIXTURE_PROFILE") ?? "testnet",
  rpcUrl: read("VITE_STELLAR_RPC_URL") ?? "https://soroban-testnet.stellar.org",
  networkPassphrase:
    read("VITE_NETWORK_PASSPHRASE") ?? "Test SDF Network ; September 2015",
  verifierId: read("VITE_VERIFIER_CONTRACT_ID"),
  complianceId: read("VITE_COMPLIANCE_CONTRACT_ID"),
  assetId: read("VITE_SAC_CONTRACT_ID"),
  issuerPublicKey: read("VITE_ISSUER_PUBLIC_KEY"),
  issuerUrl: read("VITE_ISSUER_URL") ?? "/issuer",
  wasmUrl: read("VITE_AMOEBA_WASM_URL") ?? "/circuits/compliance_corridor.wasm",
  zkeyUrl:
    read("VITE_AMOEBA_ZKEY_URL") ?? "/circuits/compliance_corridor_final.zkey",
  demoFixtureUrl:
    read("VITE_AMOEBA_DEMO_FIXTURE_URL") ?? "/fixtures/demo-transfer-testnet.json",
};

export function getAmoebaConfigOverrides(): Record<string, string | undefined> {
  return {
    AMOEBA_FIXTURE_PROFILE: env.profile,
    STELLAR_RPC_URL: env.rpcUrl,
    NETWORK_PASSPHRASE: env.networkPassphrase,
    VERIFIER_CONTRACT_ID: env.verifierId,
    COMPLIANCE_CONTRACT_ID: env.complianceId,
    SAC_CONTRACT_ID: env.assetId,
    ISSUER_PUBLIC_KEY: env.issuerPublicKey,
    ISSUER_URL: env.issuerUrl,
    AMOEBA_WASM_URL: env.wasmUrl,
    AMOEBA_ZKEY_URL: env.zkeyUrl,
    AMOEBA_DEMO_FIXTURE_URL: env.demoFixtureUrl,
    AMOEBA_ARTIFACT_DIR: "/circuits",
    AMOEBA_ZKEY_PATH: env.zkeyUrl,
    AMOEBA_WASM_PATH: env.wasmUrl,
    AMOEBA_WITNESS_GEN: "",
  };
}

export function stellarExplorerAccount(publicKey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}

export function stellarExplorerTx(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}
