import type { ChainClientConfig } from "./types.js";
import type { ChainIssuerPage, ChainIssuerRecord } from "./roots.js";
import type { IssuerWellKnown } from "./adapter.js";
export interface ResolvedIssuer {
    issuerPublicKey: string;
    metadataUri: string;
    serviceUrl: string;
    complianceId?: string;
    verifierId?: string;
    vkHash?: string;
    updatedAtLedger: number;
    enabled: boolean;
    wellKnown: IssuerWellKnown;
}
export interface ResolveIssuerOptions {
    fetchImpl?: typeof fetch;
    startLedger?: number;
    registryEntry?: ChainIssuerRecord;
}
export declare function resolveIssuer(cfg: ChainClientConfig, issuerPublicKey: string, opts?: ResolveIssuerOptions): Promise<ResolvedIssuer>;
export declare function resolveIssuerFromUrl(cfg: ChainClientConfig, url: string, opts?: ResolveIssuerOptions): Promise<ResolvedIssuer>;
export declare function listIssuers(cfg: ChainClientConfig, opts?: {
    cursor?: number;
    limit?: number;
    startLedger?: number;
}): Promise<ChainIssuerPage>;
//# sourceMappingURL=resolve.d.ts.map