import { rpc } from "@stellar/stellar-sdk";
import type { WispConfig } from "../config.js";

/**
 * Soroban RPC returns zero contract events when startLedger predates the
 * contract's first emitted event. Keep the default scan window tight.
 */
export const DEFAULT_EVENT_SCAN_LEDGERS = 10_000;

export async function resolveEventStartLedger(
  server: rpc.Server,
  cfg: WispConfig,
  explicit?: number,
): Promise<number> {
  if (explicit != null) return explicit;
  if (cfg.validateStartLedger != null) return cfg.validateStartLedger;
  const latest = await server.getLatestLedger();
  return Math.max(1, latest.sequence - DEFAULT_EVENT_SCAN_LEDGERS);
}
