import { Client } from "@wisp_/verifier";
import type { WispConfig } from "../config.js";

export async function getVerifierVkHash(cfg: WispConfig): Promise<string> {
  if (!cfg.verifierId) {
    throw new Error("VERIFIER_CONTRACT_ID required for vk_hash check");
  }
  const client = new Client({
    contractId: cfg.verifierId,
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    publicKey: cfg.issuerPublicKey ?? cfg.complianceId ?? cfg.verifierId,
  });
  const tx = await client.vk_hash();
  const sim = await tx.simulate();
  const hash = sim.result;
  if (!hash || !Buffer.isBuffer(hash)) {
    throw new Error("verifier vk_hash simulation returned no result");
  }
  return hash.toString("hex");
}

export function vkHashesMatch(wellKnown: string, onChainHex: string): boolean {
  const a = wellKnown.replace(/^0x/i, "").toLowerCase();
  const b = onChainHex.replace(/^0x/i, "").toLowerCase();
  return a.length > 0 && a === b;
}
