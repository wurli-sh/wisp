import type { ProofPackage } from "@amoeba/js";

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

  async getMerklePath(wallet: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/v1/merkle-path/${wallet}`);
    if (!res.ok) throw new Error(`issuer merkle-path: HTTP ${res.status}`);
    return res.json();
  }
}
