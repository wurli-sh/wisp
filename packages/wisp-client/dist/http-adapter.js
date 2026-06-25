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
        this.baseUrl = baseUrl.replace(/\/$/, "");
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
    async createProofPackage(input) {
        const res = await issuerFetch(`${this.baseUrl}/v1/proof-packages`, {
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
    async listCorridors() {
        const res = await issuerFetch(`${this.baseUrl}/v1/corridors`);
        if (!res.ok)
            throw new Error(`issuer corridors: HTTP ${res.status}`);
        return res.json();
    }
    async getCorridor(id) {
        const res = await issuerFetch(`${this.baseUrl}/v1/corridor/${id}`);
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
    async getMerklePath(wallet) {
        const res = await issuerFetch(`${this.baseUrl}/v1/merkle-path/${wallet}`);
        if (!res.ok)
            throw new Error(`issuer merkle-path: HTTP ${res.status}`);
        return res.json();
    }
}
/** @deprecated Use HttpIssuerAdapter */
export const IssuerClient = HttpIssuerAdapter;
//# sourceMappingURL=http-adapter.js.map