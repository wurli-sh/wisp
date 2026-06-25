import { Client } from "@wisp_/compliance";
export async function auditNullifier(nullifierBytes, cfg, publicKey) {
    if (!cfg.complianceId)
        throw new Error("COMPLIANCE_CONTRACT_ID not set");
    const client = new Client({
        contractId: cfg.complianceId,
        rpcUrl: cfg.rpcUrl,
        networkPassphrase: cfg.networkPassphrase,
        publicKey,
    });
    const tx = await client.check_attestation({ nullifier: nullifierBytes });
    const sim = await tx.simulate();
    return Boolean(sim.result);
}
//# sourceMappingURL=audit.js.map