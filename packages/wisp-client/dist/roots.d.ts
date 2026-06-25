import type { ChainClientConfig } from "./types.js";
export interface ChainIssuerRecord {
    issuer: string;
    metadata_uri: string;
    enabled: boolean;
    registered_at_ledger: number;
    updated_at_ledger: number;
    registration_seq: number;
    ledger: number;
    txHash: string;
    eventTopic: string;
}
export interface ChainIssuerRoots {
    issuer: string;
    merkle_root: string;
    sanctions_root: string;
    jurisdiction_root: string;
    ledger: number;
    txHash: string;
    eventTopic: string;
    enabled?: boolean;
}
export interface ChainCorridorRoots {
    issuer: string;
    corridor_id: number;
    corridor_config_hash: string;
    source_jurisdiction_root: string;
    dest_address_root: string;
    enabled: boolean;
    ledger: number;
    txHash: string;
    eventTopic: string;
}
export interface ChainRootsBundle {
    issuer: ChainIssuerRoots;
    corridor: ChainCorridorRoots;
}
export interface ChainIssuerPage {
    issuers: ChainIssuerRecord[];
    nextCursor: number | null;
}
export declare function getLatestIssuerRecord(cfg: ChainClientConfig, issuerStrkey: string, opts?: {
    startLedger?: number;
    maxPages?: number;
}): Promise<ChainIssuerRecord | null>;
export declare function listIssuerRegistryEntries(cfg: ChainClientConfig, opts?: {
    cursor?: number;
    limit?: number;
    startLedger?: number;
}): Promise<ChainIssuerPage>;
export declare function getLatestIssuerRoots(cfg: ChainClientConfig, issuerStrkey: string, opts?: {
    startLedger?: number;
    maxPages?: number;
}): Promise<ChainIssuerRoots | null>;
export declare function getLatestCorridorRoots(cfg: ChainClientConfig, issuerStrkey: string, corridorId: number, opts?: {
    startLedger?: number;
    maxPages?: number;
}): Promise<ChainCorridorRoots | null>;
export declare function getLatestChainRoots(cfg: ChainClientConfig, issuerStrkey: string, corridorId: number, opts?: {
    startLedger?: number;
    maxPages?: number;
}): Promise<ChainRootsBundle | null>;
export declare function getLatestIssuerEnabled(cfg: ChainClientConfig, issuerStrkey: string, opts?: {
    startLedger?: number;
    maxPages?: number;
}): Promise<boolean | null>;
//# sourceMappingURL=roots.d.ts.map