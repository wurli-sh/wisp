import type {
  CorridorOption,
  ProofPackageRequest,
  ActivateCredentialRequest,
  ActivateCredentialResponse,
  ActivationChallengeRequest,
  ChallengeResponse,
  CredentialInfo,
  ProofPackageDraft,
  SignedProofPackageRequest,
} from "@wisp_/js";
import type { CorridorDetail, IssuerAdapter, IssuerCapabilities, IssuerWellKnown } from "./adapter.js";

const RETRY_STATUSES = new Set([408, 429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (err instanceof Error && /fetch failed|network|failed to fetch/i.test(err.message))
  );
}

export async function issuerFetch(
  url: string,
  init?: RequestInit,
  opts: { retries?: number } = {},
): Promise<Response> {
  const retries = opts.retries ?? 2;
  if (!Number.isSafeInteger(retries) || retries < 0) {
    throw new Error("issuerFetch retries must be a non-negative safe integer");
  }
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (!RETRY_STATUSES.has(res.status) || attempt === retries) {
        return res;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (!isNetworkError(err) || attempt === retries) {
        throw err;
      }
      lastErr = err;
    }
    await sleep(250 * 2 ** attempt);
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export class HttpIssuerAdapter implements IssuerAdapter {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    if (!this.baseUrl) {
      throw new Error("issuer base URL is required");
    }
  }

  get baseURL(): string {
    return this.baseUrl;
  }

  capabilities(): IssuerCapabilities {
    return {
      proofPackages: true,
      corridors: true,
      wellKnown: true,
      kyc: false,
      admin: false,
    };
  }

  async createActivationChallenge(
    input: ActivationChallengeRequest,
  ): Promise<ChallengeResponse> {
    const res = await issuerFetch(`${this.baseUrl}/credentials/activation-challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer activation-challenge: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
    }
    return res.json() as Promise<ChallengeResponse>;
  }

  async activateCredential(
    input: ActivateCredentialRequest,
  ): Promise<ActivateCredentialResponse> {
    const res = await issuerFetch(`${this.baseUrl}/credentials/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer activate: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
    }
    return res.json() as Promise<ActivateCredentialResponse>;
  }

  async createProofPackageChallenge(
    input: ProofPackageRequest,
  ): Promise<ChallengeResponse> {
    const res = await issuerFetch(`${this.baseUrl}/proof-packages/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer proof challenge: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
    }
    return res.json() as Promise<ChallengeResponse>;
  }

  async createProofPackage(input: SignedProofPackageRequest): Promise<ProofPackageDraft> {
    const res = await issuerFetch(`${this.baseUrl}/proof-packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer proof-packages: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
    }
    return res.json() as Promise<ProofPackageDraft>;
  }

  async getCredential(wallet: string): Promise<CredentialInfo> {
    const res = await issuerFetch(
      `${this.baseUrl}/credentials/${encodeURIComponent(wallet)}`,
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`issuer credential: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
    }
    return res.json() as Promise<CredentialInfo>;
  }

  async listCorridors(): Promise<CorridorOption[]> {
    const res = await issuerFetch(`${this.baseUrl}/corridors`);
    if (!res.ok) throw new Error(`issuer corridors: HTTP ${res.status}`);
    return res.json() as Promise<CorridorOption[]>;
  }

  async getCorridor(id: number): Promise<CorridorDetail> {
    const res = await issuerFetch(`${this.baseUrl}/corridors/${id}`);
    if (!res.ok) throw new Error(`issuer corridor: HTTP ${res.status}`);
    return res.json() as Promise<CorridorDetail>;
  }

  async getWellKnown(): Promise<IssuerWellKnown> {
    const res = await issuerFetch(`${this.baseUrl}/.well-known/wisp-issuer.json`);
    if (!res.ok) throw new Error(`issuer well-known: HTTP ${res.status}`);
    return res.json() as Promise<IssuerWellKnown>;
  }

}

/** @deprecated Use HttpIssuerAdapter */
export const IssuerClient = HttpIssuerAdapter;

export type { CorridorDetail, IssuerWellKnown };
