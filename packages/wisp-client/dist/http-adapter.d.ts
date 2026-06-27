import type { CorridorOption, ProofPackageRequest, ActivateCredentialRequest, ActivateCredentialResponse, ActivationChallengeRequest, ChallengeResponse, CredentialInfo, ProofPackageDraft, SignedProofPackageRequest } from "@wisp_/js";
import type { CorridorDetail, IssuerAdapter, IssuerCapabilities, IssuerWellKnown } from "./adapter.js";
export declare function issuerFetch(url: string, init?: RequestInit, opts?: {
    retries?: number;
}): Promise<Response>;
export declare class HttpIssuerAdapter implements IssuerAdapter {
    private readonly baseUrl;
    constructor(baseUrl: string);
    get baseURL(): string;
    capabilities(): IssuerCapabilities;
    createActivationChallenge(input: ActivationChallengeRequest): Promise<ChallengeResponse>;
    activateCredential(input: ActivateCredentialRequest): Promise<ActivateCredentialResponse>;
    createProofPackageChallenge(input: ProofPackageRequest): Promise<ChallengeResponse>;
    createProofPackage(input: SignedProofPackageRequest): Promise<ProofPackageDraft>;
    getCredential(wallet: string): Promise<CredentialInfo>;
    listCorridors(): Promise<CorridorOption[]>;
    getCorridor(id: number): Promise<CorridorDetail>;
    getWellKnown(): Promise<IssuerWellKnown>;
}
/** @deprecated Use HttpIssuerAdapter */
export declare const IssuerClient: typeof HttpIssuerAdapter;
export type { CorridorDetail, IssuerWellKnown };
//# sourceMappingURL=http-adapter.d.ts.map