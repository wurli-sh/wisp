import { loadWispEnv } from "@wisp_/sdk";
import type { WispIssuerConfig } from "./types.js";

export function loadIssuerConfig(
  overrides: Record<string, string | undefined> = {},
): WispIssuerConfig {
  const env = { ...loadWispEnv(), ...process.env, ...overrides };
  const complianceId = env.COMPLIANCE_CONTRACT_ID ?? env.COMPLIANCE_ID;
  const operatorPublicKey = env.OPERATOR_PUBLIC_KEY ?? env.ISSUER_PUBLIC_KEY;

  if (!complianceId) {
    throw new Error("COMPLIANCE_CONTRACT_ID required");
  }
  if (!operatorPublicKey) {
    throw new Error("OPERATOR_PUBLIC_KEY or ISSUER_PUBLIC_KEY required");
  }

  return {
    rpcUrl: env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
    networkPassphrase: env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
    complianceId,
    operatorPublicKey,
    issuerPublicKey: env.ISSUER_PUBLIC_KEY,
  };
}
