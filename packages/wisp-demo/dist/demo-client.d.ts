import { HttpIssuerAdapter } from "@wisp_/client";
export interface MockKycChallengeResponse {
    challenge_id: string;
    challenge_xdr: string;
    expires_at: number;
}
export interface MockKycSubmitRequest {
    challenge_id: string;
    signed_challenge_xdr: string;
    corridor_id?: number;
    recipient?: string;
}
export type MockKycSubmitStatus = "approved" | "rejected" | "already_approved";
export type MockKycRootsStatus = "missing" | "publishing" | "active" | "failed";
export interface MockKycSubmitResponse {
    status: MockKycSubmitStatus;
    kyc_status: MockKycLifecycleStatus;
    eligible_for_proof: boolean;
    missing: MockKycMissing[];
    roots_status: MockKycRootsStatus;
    roots_message?: string;
    rejection_reason?: string;
    reason?: string;
    publish_warning?: string;
}
export type MockKycLifecycleStatus = "none" | "approved" | "rejected" | "revoked";
export type MockKycMissing = "kyc" | "destination" | "roots_published" | "corridor" | "sender_corridor";
export interface MockKycStatusResponse {
    wallet: string;
    kyc_status: MockKycLifecycleStatus;
    eligible_for_proof: boolean;
    missing: MockKycMissing[];
    roots_status: MockKycRootsStatus;
    roots_message?: string;
    rejection_reason?: string;
    publish_warning?: string;
}
export interface CorridorDestinationRecord {
    id: number;
    corridor_id: number;
    address: string;
    enabled: boolean;
}
export interface PublishRootsResult {
    snapshot_id: number;
    corridor_id: number;
    status: string;
    message?: string;
}
export interface PublishRootsResponse {
    status: string;
    results: PublishRootsResult[];
}
/** Reference-issuer demo client: mock KYC + fixture proof packages. */
export declare class DemoIssuerClient extends HttpIssuerAdapter {
    capabilities(): {
        kyc: boolean;
        admin: boolean;
        proofPackages: true;
        corridors: boolean;
        wellKnown: boolean;
    };
    requestMockKycChallenge(wallet: string): Promise<MockKycChallengeResponse>;
    submitMockKyc(input: MockKycSubmitRequest): Promise<MockKycSubmitResponse>;
    addCorridorDestination(corridorId: number, address: string, adminToken: string): Promise<CorridorDestinationRecord>;
    publishIssuerRoots(adminToken: string, corridorId?: number): Promise<PublishRootsResponse>;
    getMockKycStatus(wallet: string, opts?: {
        corridor_id?: number;
        recipient?: string;
    }): Promise<MockKycStatusResponse>;
}
//# sourceMappingURL=demo-client.d.ts.map