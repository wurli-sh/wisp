import type { CorridorOption, ProofPackageRequest, ActivateCredentialRequest, ActivateCredentialResponse, ActivationChallengeRequest, ChallengeResponse, CredentialInfo, ProofPackageDraft, SignedProofPackageRequest } from "@wisp_/js";
export interface IssuerWellKnown {
    issuer_stellar_address: string;
    metadata_uri?: string;
    service_url?: string;
    compliance_contract_id?: string;
    verifier_contract_id?: string;
    circuit_vk_hash?: string;
    issuer_mode?: "production" | "demo";
    issuance_available?: boolean;
    network_passphrase?: string;
}
export interface CorridorDetail {
    corridor_id: number;
    name: string;
    source_country: string;
    dest_country: string;
    enabled: boolean;
    asset_hex: string;
    latest_root_snapshot?: unknown;
}
export interface IssuerCapabilities {
    proofPackages: true;
    corridors: boolean;
    wellKnown: boolean;
    kyc: boolean;
    admin: boolean;
}
/** Minimal issuer surface for plug-and-play SDK integration. */
export interface IssuerAdapter {
    createActivationChallenge(req: ActivationChallengeRequest): Promise<ChallengeResponse>;
    activateCredential(req: ActivateCredentialRequest): Promise<ActivateCredentialResponse>;
    createProofPackageChallenge(req: ProofPackageRequest): Promise<ChallengeResponse>;
    createProofPackage(req: SignedProofPackageRequest): Promise<ProofPackageDraft>;
    getCredential(wallet: string): Promise<CredentialInfo>;
    listCorridors?(): Promise<CorridorOption[]>;
    getCorridor?(id: number): Promise<CorridorDetail>;
    getWellKnown?(): Promise<IssuerWellKnown>;
    capabilities?(): IssuerCapabilities;
}
export type { CorridorOption, ProofPackageRequest, ActivateCredentialRequest, ActivateCredentialResponse, ActivationChallengeRequest, ChallengeResponse, CredentialInfo, ProofPackageDraft, SignedProofPackageRequest, };
//# sourceMappingURL=adapter.d.ts.map