import { rpc } from "@stellar/stellar-sdk";
import type { WispConfig } from "../config.js";

/**
 * Soroban RPC returns zero contract events when startLedger predates the
 * contract's first emitted event. Keep the default scan window tight.
 */
export const DEFAULT_EVENT_SCAN_LEDGERS = 10_000;

/** Conservative upper bound on Soroban RPC event retention (~7 days on testnet). */
export const MAX_EVENT_SCAN_LEDGERS = 120_000;

export function clampStartLedger(start: number, latestSeq: number): number {
  const oldestRetained = Math.max(1, latestSeq - MAX_EVENT_SCAN_LEDGERS);
  return Math.max(start, oldestRetained);
}

/**
 * Soroban RPC rejections are often plain objects (`{ code, message }`) rather
 * than `Error` instances, so `String(err)` would yield "[object Object]" and
 * lose the message. Dig the human-readable text out of whatever shape arrives.
 */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
    const nested = (err as { error?: { message?: unknown } }).error?.message;
    if (typeof nested === "string" && nested) return nested;
  }
  return String(err);
}

/** Extract the oldest valid ledger from Soroban RPC range error messages. */
export function parseOldestLedgerFromError(err: unknown): number | null {
  const msg = errorMessage(err);
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
  const msg = errorMessage(err);
  return /ledger|startLedger|oldest|retention|range|invalid.*start/i.test(msg);
}

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
