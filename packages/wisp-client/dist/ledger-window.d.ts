import { rpc } from "@stellar/stellar-sdk";
import type { ChainClientConfig } from "./types.js";
export declare const DEFAULT_EVENT_SCAN_LEDGERS = 10000;
export declare const MAX_EVENT_SCAN_LEDGERS = 120000;
export declare function clampStartLedger(start: number, latestSeq: number): number;
export declare function parseOldestLedgerFromError(err: unknown): number | null;
export declare function isLedgerRangeError(err: unknown): boolean;
export declare function resolveEventStartLedger(server: rpc.Server, cfg: ChainClientConfig, explicit?: number): Promise<number>;
//# sourceMappingURL=ledger-window.d.ts.map