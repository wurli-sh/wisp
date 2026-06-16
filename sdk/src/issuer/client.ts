import type { CorridorOption, DemoTransferRequest, ProofPackage } from "@amoeba/js";

export class IssuerClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getDemoTransfer(): Promise<ProofPackage> {
    const res = await fetch(`${this.baseUrl}/v1/fixtures/demo-transfer`);
    if (!res.ok) throw new Error(`issuer demo-transfer: HTTP ${res.status}`);
    return res.json() as Promise<ProofPackage>;
  }

  async createDemoTransfer(input: DemoTransferRequest): Promise<ProofPackage> {
    const res = await fetch(`${this.baseUrl}/v1/fixtures/demo-transfer`, {
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

  async createProofPackage(input: {
    sender_wallet: string;
    recipient_wallet: string;
    amount: string;
    corridor_id: number;
  }): Promise<ProofPackage> {
    const res = await fetch(`${this.baseUrl}/v1/proof-packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer proof-packages: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
    }
    return res.json() as Promise<ProofPackage>;
  }

  async listCorridors(): Promise<CorridorOption[]> {
    const res = await fetch(`${this.baseUrl}/v1/corridors`);
    if (!res.ok) throw new Error(`issuer corridors: HTTP ${res.status}`);
    return res.json() as Promise<CorridorOption[]>;
  }

  async getMerklePath(wallet: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/v1/merkle-path/${wallet}`);
    if (!res.ok) throw new Error(`issuer merkle-path: HTTP ${res.status}`);
    return res.json();
  }

  async requestMockKycChallenge(wallet: string): Promise<MockKycChallengeResponse> {
    const res = await fetch(`${this.baseUrl}/v1/mock-kyc/challenge`, {
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
    const res = await fetch(`${this.baseUrl}/v1/mock-kyc/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer mock-kyc submit: HTTP ${res.status} ${text}`);
    }
    return res.json() as Promise<MockKycSubmitResponse>;
  }

  async getMockKycStatus(wallet: string): Promise<MockKycStatusResponse> {
    const res = await fetch(
      `${this.baseUrl}/v1/mock-kyc/status/${encodeURIComponent(wallet)}`,
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer mock-kyc status: HTTP ${res.status} ${text}`);
    }
    return res.json() as Promise<MockKycStatusResponse>;
  }
}

export interface MockKycChallengeResponse {
  challenge_id: string;
  challenge_xdr: string;
  expires_at: number;
}

export interface MockKycSubmitRequest {
  challenge_id: string;
  signed_challenge_xdr: string;
  name: string;
  country: string;
  dob: string;
  sanctions_clear: boolean;
}

export type MockKycSubmitStatus = "approved" | "rejected" | "already_approved";

export interface MockKycSubmitResponse {
  status: MockKycSubmitStatus;
  reason?: string;
}

export type MockKycLifecycleStatus = "none" | "approved" | "rejected" | "revoked";

export type MockKycMissing = "kyc" | "destination" | "roots_published" | "corridor";

export interface MockKycStatusResponse {
  wallet: string;
  kyc_status: MockKycLifecycleStatus;
  eligible_for_proof: boolean;
  missing: MockKycMissing[];
  rejection_reason?: string;
}
