import type { CorridorOption, ProofPackage, ProofPackageRequest } from "@wisp_/js";
import type { CorridorDetail, IssuerAdapter, IssuerCapabilities, IssuerWellKnown } from "./adapter.js";
export declare function issuerFetch(url: string, init?: RequestInit, opts?: {
    retries?: number;
}): Promise<Response>;
export declare class HttpIssuerAdapter implements IssuerAdapter {
    private readonly baseUrl;
    constructor(baseUrl: string);
    get baseURL(): string;
    capabilities(): IssuerCapabilities;
    createProofPackage(input: ProofPackageRequest): Promise<ProofPackage>;
    listCorridors(): Promise<CorridorOption[]>;
    getCorridor(id: number): Promise<CorridorDetail>;
    getWellKnown(): Promise<IssuerWellKnown>;
    getMerklePath(wallet: string): Promise<unknown>;
}
/** @deprecated Use HttpIssuerAdapter */
export declare const IssuerClient: typeof HttpIssuerAdapter;
export type { CorridorDetail, IssuerWellKnown };
//# sourceMappingURL=http-adapter.d.ts.map