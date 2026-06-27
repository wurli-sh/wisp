import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import type { ProofSettledData } from "@wisp_/compliance";
import type { ChainClientConfig } from "./types.js";
import {
  clampStartLedger,
  DEFAULT_EVENT_SCAN_LEDGERS,
  isLedgerRangeError,
  parseOldestLedgerFromError,
  resolveEventStartLedger,
} from "./ledger-window.js";

export interface ProofSettledEvent {
  txHash: string;
  ledger: number;
  ledgerClosedAt: string;
  data: ProofSettledData;
}

function settledTopicFilter(): string[] {
  return [xdr.ScVal.scvSymbol("settled").toXDR("base64")];
}

function parseProofSettledValue(value: xdr.ScVal): ProofSettledData {
  return scValToNative(value) as ProofSettledData;
}

function topicIsSettled(topic: xdr.ScVal | undefined): boolean {
  if (!topic) return false;
  const native = scValToNative(topic);
  return native === "settled";
}

function parseTxContractEvent(
  event: xdr.ContractEvent,
  ledger: number,
  ledgerClosedAt: string,
  txHash: string,
): ProofSettledEvent | null {
  let v0: { topics: () => xdr.ScVal[]; data: () => xdr.ScVal };
  try {
    v0 = event.body().v0();
  } catch {
    return null;
  }

  const topics = v0.topics();
  if (!topicIsSettled(topics.at(0))) return null;

  return {
    txHash,
    ledger,
    ledgerClosedAt,
    data: parseProofSettledValue(v0.data()),
  };
}

async function pagedProofSettledEvents(
  cfg: ChainClientConfig,
  opts: { limit?: number; startLedger?: number; endLedger?: number; maxPages?: number } = {},
): Promise<ProofSettledEvent[]> {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");

  const server = new rpc.Server(cfg.rpcUrl);
  const latest = await server.getLatestLedger();
  const requested = await resolveEventStartLedger(server, cfg, opts.startLedger);
  // The configured validateStartLedger is often the contract deploy ledger,
  // which can fall outside the RPC's event retention window. Clamp it so the
  // first query stays in range (mirrors pageContractEvents in roots.ts).
  let startLedger = clampStartLedger(requested, latest.sequence);
  const pageSize = Math.min(opts.limit ?? 100, 200);
  const maxPages = opts.maxPages ?? 10;

  let cursor: string | null = null;
  const events: ProofSettledEvent[] = [];

  const fetchPage = (start: number, pageCursor: string | null): Promise<rpc.Api.GetEventsResponse> =>
    pageCursor
      ? server.getEvents({
          cursor: pageCursor,
          filters: [
            {
              type: "contract",
              contractIds: [cfg.complianceId!],
              topics: [settledTopicFilter()],
            },
          ],
          limit: pageSize,
        })
      : server.getEvents({
          startLedger: start,
          endLedger: opts.endLedger,
          filters: [
            {
              type: "contract",
              contractIds: [cfg.complianceId!],
              topics: [settledTopicFilter()],
            },
          ],
          limit: pageSize,
        });

  for (let page = 0; page < maxPages; page += 1) {
    let resp: rpc.Api.GetEventsResponse;
    try {
      resp = await fetchPage(startLedger, cursor);
    } catch (err) {
      if (!isLedgerRangeError(err)) throw err;
      // A range error on a cursor page means pagination has walked to the edge
      // of the RPC's event-retention window — the cursor now references a
      // ledger at/after the tip. Every matching event up to here has already
      // been collected, so stop instead of failing the entire scan.
      if (page !== 0 || cursor != null) break;
      // First page: the configured start ledger predates the retention window.
      // Re-clamp to the oldest retained ledger and retry once.
      const parsed = parseOldestLedgerFromError(err);
      startLedger = clampStartLedger(
        parsed ?? Math.max(1, latest.sequence - DEFAULT_EVENT_SCAN_LEDGERS),
        latest.sequence,
      );
      try {
        resp = await fetchPage(startLedger, null);
      } catch (retryErr) {
        if (isLedgerRangeError(retryErr)) break;
        throw retryErr;
      }
    }

    events.push(
      ...resp.events
        .filter((e: rpc.Api.EventResponse) => e.inSuccessfulContractCall)
        .map((e: rpc.Api.EventResponse) => ({
          txHash: e.txHash,
          ledger: e.ledger,
          ledgerClosedAt: e.ledgerClosedAt,
          data: parseProofSettledValue(e.value),
        })),
    );

    if (resp.events.length < pageSize || !resp.cursor || resp.cursor === cursor) break;
    cursor = resp.cursor;
  }

  return events;
}

export async function listProofSettledEvents(
  cfg: ChainClientConfig,
  opts: { limit?: number; startLedger?: number; endLedger?: number } = {},
): Promise<ProofSettledEvent[]> {
  return pagedProofSettledEvents(cfg, {
    limit: opts.limit,
    startLedger: opts.startLedger,
    endLedger: opts.endLedger,
    maxPages: 1,
  });
}

export async function getProofSettledByTxHash(
  cfg: ChainClientConfig,
  txHash: string,
): Promise<ProofSettledEvent | null> {
  const server = new rpc.Server(cfg.rpcUrl);
  const tx = await server.getTransaction(txHash);

  if (tx.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    return null;
  }

  const ledgerClosedAt = new Date(tx.createdAt * 1000).toISOString();
  for (const group of tx.events.contractEventsXdr) {
    for (const event of group) {
      const parsed = parseTxContractEvent(event, tx.ledger, ledgerClosedAt, tx.txHash);
      if (parsed) return parsed;
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

export async function getProofSettledByNullifier(
  cfg: ChainClientConfig,
  nullifierHex: string,
): Promise<ProofSettledEvent | null> {
  const needle = nullifierHex.replace(/^0x/i, "").toLowerCase();
  const events = await pagedProofSettledEvents(cfg, { limit: 100, maxPages: 10 });
  return (
    events.find((e) => e.data.nullifier.toString("hex").toLowerCase() === needle) ??
    null
  );
}
