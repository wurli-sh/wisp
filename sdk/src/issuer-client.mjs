export class IssuerClient {
  /** @param {string} baseUrl */
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getDemoTransfer() {
    const res = await fetch(`${this.baseUrl}/v1/fixtures/demo-transfer`);
    if (!res.ok) throw new Error(`issuer demo-transfer: HTTP ${res.status}`);
    return res.json();
  }

  async getMerklePath(wallet) {
    const res = await fetch(`${this.baseUrl}/v1/merkle-path/${wallet}`);
    if (!res.ok) throw new Error(`issuer merkle-path: HTTP ${res.status}`);
    return res.json();
  }
}
