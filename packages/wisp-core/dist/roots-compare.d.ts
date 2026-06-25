export interface RootsRecord {
    merkle_root: string;
    sanctions_root: string;
    jurisdiction_root: string;
    corridor_config_hash: string;
    source_jurisdiction_root: string;
    dest_address_root: string;
}
export declare function rootsMatch(a: RootsRecord, b: RootsRecord): boolean;
export declare function issuerRootsMatch(pkg: RootsRecord, chain: Pick<RootsRecord, "merkle_root" | "sanctions_root" | "jurisdiction_root">): boolean;
export declare function corridorRootsMatch(pkg: RootsRecord, chain: Pick<RootsRecord, "corridor_config_hash" | "source_jurisdiction_root" | "dest_address_root">): boolean;
export declare function publicInputsRecordMatch(pkg: Record<string, string | number | undefined>, expected: Record<string, string>): boolean;
//# sourceMappingURL=roots-compare.d.ts.map