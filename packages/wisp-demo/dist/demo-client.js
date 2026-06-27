import { HttpIssuerAdapter, issuerFetch } from "@wisp_/client";
/** Reference-issuer demo client: mock KYC + fixture proof packages. */
export class DemoIssuerClient extends HttpIssuerAdapter {
    capabilities() {
        return {
            ...super.capabilities(),
            kyc: true,
            admin: true,
        };
    }
    async requestMockKycChallenge(wallet) {
        const res = await issuerFetch(`${this.baseURL}/mock-kyc/challenge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet }),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer mock-kyc challenge: HTTP ${res.status} ${text}`);
        }
        return res.json();
    }
    async submitMockKyc(input) {
        const res = await issuerFetch(`${this.baseURL}/mock-kyc/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        }, { retries: 0 });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer mock-kyc submit: HTTP ${res.status} ${text}`);
        }
        return res.json();
    }
    async addCorridorDestination(corridorId, address, adminToken) {
        const res = await issuerFetch(`${this.baseURL}/admin/corridors/${corridorId}/destinations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ address, enabled: true }),
        }, { retries: 0 });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer add destination: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
        }
        return res.json();
    }
    async publishIssuerRoots(adminToken, corridorId) {
        const res = await issuerFetch(`${this.baseURL}/admin/roots/publish`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(corridorId != null ? { corridor_id: corridorId } : {}),
        }, { retries: 0 });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer publish roots: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
        }
        return res.json();
    }
    async getMockKycStatus(wallet, opts) {
        const params = new URLSearchParams();
        if (opts?.corridor_id != null) {
            params.set("corridor_id", String(opts.corridor_id));
        }
        if (opts?.recipient) {
            params.set("recipient", opts.recipient);
        }
        const query = params.toString();
        const res = await issuerFetch(`${this.baseURL}/mock-kyc/status/${encodeURIComponent(wallet)}${query ? `?${query}` : ""}`);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`issuer mock-kyc status: HTTP ${res.status} ${text}`);
        }
        return res.json();
    }
}
//# sourceMappingURL=demo-client.js.map