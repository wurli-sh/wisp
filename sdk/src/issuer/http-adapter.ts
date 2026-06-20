import type { CorridorOption, ProofPackage, ProofPackageRequest } from "@wisp_/js";
import type { CorridorDetail, IssuerAdapter, IssuerWellKnown } from "./adapter.js";

export class HttpIssuerAdapter implements IssuerAdapter {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  get baseURL(): string {
    return this.baseUrl;
  }

  async createProofPackage(input: ProofPackageRequest): Promise<ProofPackage> {
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

  async getCorridor(id: number): Promise<CorridorDetail> {
    const res = await fetch(`${this.baseUrl}/v1/corridor/${id}`);
    if (!res.ok) throw new Error(`issuer corridor: HTTP ${res.status}`);
    return res.json() as Promise<CorridorDetail>;
  }

  async getWellKnown(): Promise<IssuerWellKnown> {
    const res = await fetch(`${this.baseUrl}/.well-known/wisp-issuer.json`);
    if (!res.ok) throw new Error(`issuer well-known: HTTP ${res.status}`);
    return res.json() as Promise<IssuerWellKnown>;
  }

  async getMerklePath(wallet: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/v1/merkle-path/${wallet}`);
    if (!res.ok) throw new Error(`issuer merkle-path: HTTP ${res.status}`);
    return res.json();
  }
}

/** @deprecated Use HttpIssuerAdapter */
export const IssuerClient = HttpIssuerAdapter;

export type { CorridorDetail, IssuerWellKnown };
