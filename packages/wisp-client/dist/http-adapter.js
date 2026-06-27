const RETRY_STATUSES = new Set([408, 429, 502, 503, 504]);
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isNetworkError(err) {
    return (err instanceof TypeError ||
        (err instanceof Error && /fetch failed|network|failed to fetch/i.test(err.message)));
}
export async function issuerFetch(url, init, opts = {}) {
    const retries = opts.retries ?? 2;
    if (!Number.isSafeInteger(retries) || retries < 0) {
        throw new Error("issuerFetch retries must be a non-negative safe integer");
    }
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const res = await fetch(url, init);
            if (!RETRY_STATUSES.has(res.status) || attempt === retries) {
                return res;
            }
            lastErr = new Error(`HTTP ${res.status}`);
        }
        catch (err) {
            if (!isNetworkError(err) || attempt === retries) {
                throw err;
            }
            lastErr = err;
        }
        await sleep(250 * 2 ** attempt);
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
export class HttpIssuerAdapter {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        if (!this.baseUrl) {
            throw new Error("issuer base URL is required");
        }
    }
    get baseURL() {
        return this.baseUrl;
    }
    capabilities() {
        return {
            proofPackages: true,
            corridors: true,
            wellKnown: true,
            kyc: false,
            admin: false,
        };
    }
    async createActivationChallenge(input) {
        const res = await issuerFetch(`${this.baseUrl}/credentials/activation-challenges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer activation-challenge: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
        }
        return res.json();
    }
    async activateCredential(input) {
        const res = await issuerFetch(`${this.baseUrl}/credentials/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer activate: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
        }
        return res.json();
    }
    async createProofPackageChallenge(input) {
        const res = await issuerFetch(`${this.baseUrl}/proof-packages/challenges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer proof challenge: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
        }
        return res.json();
    }
    async createProofPackage(input) {
        const res = await issuerFetch(`${this.baseUrl}/proof-packages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer proof-packages: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
        }
        return res.json();
    }
    async getCredential(wallet) {
        const res = await issuerFetch(`${this.baseUrl}/credentials/${encodeURIComponent(wallet)}`);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer credential: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
        }
        return res.json();
    }
    async listCorridors() {
        const res = await issuerFetch(`${this.baseUrl}/corridors`);
        if (!res.ok)
            throw new Error(`issuer corridors: HTTP ${res.status}`);
        return res.json();
    }
    async getCorridor(id) {
        const res = await issuerFetch(`${this.baseUrl}/corridors/${id}`);
        if (!res.ok)
            throw new Error(`issuer corridor: HTTP ${res.status}`);
        return res.json();
    }
    async getWellKnown() {
        const res = await issuerFetch(`${this.baseUrl}/.well-known/wisp-issuer.json`);
        if (!res.ok)
            throw new Error(`issuer well-known: HTTP ${res.status}`);
        return res.json();
    }
}
/** @deprecated Use HttpIssuerAdapter */
export const IssuerClient = HttpIssuerAdapter;
//# sourceMappingURL=http-adapter.js.map