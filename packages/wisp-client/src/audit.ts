import { Client } from "@wisp_/compliance";
import type { ChainClientConfig } from "./types.js";

export async function auditNullifier(
  nullifierBytes: Buffer,
  cfg: ChainClientConfig,
  publicKey: string,
): Promise<boolean> {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");
  const client = new Client({
    contractId: cfg.complianceId,
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    publicKey,
  });

  const tx = await client.check_attestation({ nullifier: nullifierBytes });
  const sim = await tx.simulate();
  return Boolean(sim.result);
}
