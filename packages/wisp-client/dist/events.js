import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { resolveEventStartLedger } from "./ledger-window.js";
function settledTopicFilter() {
    return [xdr.ScVal.scvSymbol("settled").toXDR("base64")];
}
function parseProofSettledValue(value) {
    return scValToNative(value);
}
function topicIsSettled(topic) {
    if (!topic)
        return false;
    const native = scValToNative(topic);
    return native === "settled";
}
function parseTxContractEvent(event, ledger, ledgerClosedAt, txHash) {
    let v0;
    try {
        v0 = event.body().v0();
    }
    catch {
        return null;
    }
    const topics = v0.topics();
    if (!topicIsSettled(topics.at(0)))
        return null;
    return {
        txHash,
        ledger,
        ledgerClosedAt,
        data: parseProofSettledValue(v0.data()),
    };
}
async function pagedProofSettledEvents(cfg, opts = {}) {
    if (!cfg.complianceId)
        throw new Error("COMPLIANCE_CONTRACT_ID not set");
    const server = new rpc.Server(cfg.rpcUrl);
    const startLedger = await resolveEventStartLedger(server, cfg, opts.startLedger);
    const pageSize = Math.min(opts.limit ?? 100, 200);
    const maxPages = opts.maxPages ?? 10;
    let cursor = null;
    const events = [];
    for (let page = 0; page < maxPages; page += 1) {
        const resp = cursor
            ? await server.getEvents({
                cursor,
                filters: [
                    {
                        type: "contract",
                        contractIds: [cfg.complianceId],
                        topics: [settledTopicFilter()],
                    },
                ],
                limit: pageSize,
            })
            : await server.getEvents({
                startLedger,
                endLedger: opts.endLedger,
                filters: [
                    {
                        type: "contract",
                        contractIds: [cfg.complianceId],
                        topics: [settledTopicFilter()],
                    },
                ],
                limit: pageSize,
            });
        events.push(...resp.events
            .filter((e) => e.inSuccessfulContractCall)
            .map((e) => ({
            txHash: e.txHash,
            ledger: e.ledger,
            ledgerClosedAt: e.ledgerClosedAt,
            data: parseProofSettledValue(e.value),
        })));
        if (resp.events.length < pageSize || !resp.cursor || resp.cursor === cursor)
            break;
        cursor = resp.cursor;
    }
    return events;
}
export async function listProofSettledEvents(cfg, opts = {}) {
    return pagedProofSettledEvents(cfg, {
        limit: opts.limit,
        startLedger: opts.startLedger,
        endLedger: opts.endLedger,
        maxPages: 1,
    });
}
export async function getProofSettledByTxHash(cfg, txHash) {
    const server = new rpc.Server(cfg.rpcUrl);
    const tx = await server.getTransaction(txHash);
    if (tx.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
        return null;
    }
    const ledgerClosedAt = new Date(tx.createdAt * 1000).toISOString();
    for (const group of tx.events.contractEventsXdr) {
        for (const event of group) {
            const parsed = parseTxContractEvent(event, tx.ledger, ledgerClosedAt, tx.txHash);
            if (parsed)
                return parsed;
        }
    }
    const indexed = await pagedProofSettledEvents(cfg, {
        startLedger: tx.ledger,
        endLedger: tx.ledger,
        limit: 100,
        maxPages: 3,
    });
    return indexed.find((event) => event.txHash === txHash) ?? null;
}
export async function getProofSettledByNullifier(cfg, nullifierHex) {
    const needle = nullifierHex.replace(/^0x/i, "").toLowerCase();
    const events = await pagedProofSettledEvents(cfg, { limit: 100, maxPages: 10 });
    return (events.find((e) => e.data.nullifier.toString("hex").toLowerCase() === needle) ??
        null);
}
//# sourceMappingURL=events.js.map