import { rpc } from "@stellar/stellar-sdk";
import type { ChainClientConfig } from "./types.js";

export const DEFAULT_EVENT_SCAN_LEDGERS = 10_000;
export const MAX_EVENT_SCAN_LEDGERS = 120_000;

export function clampStartLedger(start: number, latestSeq: number): number {
  const oldestRetained = Math.max(1, latestSeq - MAX_EVENT_SCAN_LEDGERS);
  return Math.max(start, oldestRetained);
}

export function parseOldestLedgerFromError(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const rangeMatch = msg.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    if (!Number.isNaN(low) && low > 0) return low;
  }
  const oldestMatch = msg.match(/(?:oldest|minimum|start)\s*(?:ledger\s*)?(?:is\s*)?(\d+)/i);
  if (oldestMatch) {
    const n = Number(oldestMatch[1]);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const olderThanMatch = msg.match(/older\s+than\s+(\d+)/i);
  if (olderThanMatch) {
    const n = Number(olderThanMatch[1]);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

export function isLedgerRangeError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ledger|startLedger|oldest|retention|range|invalid.*start/i.test(msg);
}

export async function resolveEventStartLedger(
  server: rpc.Server,
  cfg: ChainClientConfig,
  explicit?: number,
): Promise<number> {
  if (explicit != null) return explicit;
  if (cfg.validateStartLedger != null) return cfg.validateStartLedger;
  const latest = await server.getLatestLedger();
  return Math.max(1, latest.sequence - DEFAULT_EVENT_SCAN_LEDGERS);
}
