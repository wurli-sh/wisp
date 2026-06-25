import type { DemoTransferRequest, ProofPackage } from "@wisp_/js";
import { HttpIssuerAdapter, issuerFetch } from "@wisp_/client";

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

export type MockKycMissing =
  | "kyc"
  | "destination"
  | "roots_published"
  | "corridor"
  | "sender_corridor";

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
export class DemoIssuerClient extends HttpIssuerAdapter {
  override capabilities() {
    return {
      ...super.capabilities(),
      kyc: true,
      admin: true,
    };
  }

  async getDemoTransfer(): Promise<ProofPackage> {
    const res = await issuerFetch(`${this.baseURL}/v1/fixtures/demo-transfer`);
    if (!res.ok) throw new Error(`issuer demo-transfer: HTTP ${res.status}`);
    return res.json() as Promise<ProofPackage>;
  }

  async createDemoTransfer(input: DemoTransferRequest): Promise<ProofPackage> {
    const res = await issuerFetch(`${this.baseURL}/v1/fixtures/demo-transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `issuer create demo-transfer: HTTP ${res.status}${text ? ` — ${text}` : ""}`,
      );
    }
    return res.json() as Promise<ProofPackage>;
  }

  async requestMockKycChallenge(wallet: string): Promise<MockKycChallengeResponse> {
    const res = await issuerFetch(`${this.baseURL}/v1/mock-kyc/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer mock-kyc challenge: HTTP ${res.status} ${text}`);
    }
    return res.json() as Promise<MockKycChallengeResponse>;
  }

  async submitMockKyc(input: MockKycSubmitRequest): Promise<MockKycSubmitResponse> {
    const res = await issuerFetch(
      `${this.baseURL}/v1/mock-kyc/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { retries: 0 },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer mock-kyc submit: HTTP ${res.status} ${text}`);
    }
    return res.json() as Promise<MockKycSubmitResponse>;
  }

  async addCorridorDestination(
    corridorId: number,
    address: string,
    adminToken: string,
  ): Promise<CorridorDestinationRecord> {
    const res = await issuerFetch(
      `${this.baseURL}/v1/admin/corridors/${corridorId}/destinations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ address, enabled: true }),
      },
      { retries: 0 },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer add destination: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
    }
    return res.json() as Promise<CorridorDestinationRecord>;
  }

  async publishIssuerRoots(
    adminToken: string,
    corridorId?: number,
  ): Promise<PublishRootsResponse> {
    const res = await issuerFetch(
      `${this.baseURL}/v1/admin/roots/publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(corridorId != null ? { corridor_id: corridorId } : {}),
      },
      { retries: 0 },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer publish roots: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
    }
    return res.json() as Promise<PublishRootsResponse>;
  }

  async getMockKycStatus(
    wallet: string,
    opts?: { corridor_id?: number; recipient?: string },
  ): Promise<MockKycStatusResponse> {
    const params = new URLSearchParams();
    if (opts?.corridor_id != null) {
      params.set("corridor_id", String(opts.corridor_id));
    }
    if (opts?.recipient) {
      params.set("recipient", opts.recipient);
    }
    const query = params.toString();
    const res = await issuerFetch(
      `${this.baseURL}/v1/mock-kyc/status/${encodeURIComponent(wallet)}${query ? `?${query}` : ""}`,
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer mock-kyc status: HTTP ${res.status} ${text}`);
    }
    return res.json() as Promise<MockKycStatusResponse>;
  }
}
