import type { ProofSettledData } from "@wisp_/compliance";
import type { ChainClientConfig } from "./types.js";
export interface ProofSettledEvent {
    txHash: string;
    ledger: number;
    ledgerClosedAt: string;
    data: ProofSettledData;
}
export declare function listProofSettledEvents(cfg: ChainClientConfig, opts?: {
    limit?: number;
    startLedger?: number;
    endLedger?: number;
}): Promise<ProofSettledEvent[]>;
export declare function getProofSettledByTxHash(cfg: ChainClientConfig, txHash: string): Promise<ProofSettledEvent | null>;
export declare function getProofSettledByNullifier(cfg: ChainClientConfig, nullifierHex: string): Promise<ProofSettledEvent | null>;
//# sourceMappingURL=events.d.ts.map