import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import type { ProofSettledData } from "compliance";
import type { AmoebaConfig } from "../config.js";

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
  const native = scValToNative(value) as ProofSettledData;
  return native;
}

export async function listProofSettledEvents(
  cfg: AmoebaConfig,
  opts: { limit?: number; startLedger?: number } = {},
): Promise<ProofSettledEvent[]> {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");

  const server = new rpc.Server(cfg.rpcUrl);
  const latest = await server.getLatestLedger();
  const startLedger = opts.startLedger ?? Math.max(1, latest.sequence - 50_000);

  const resp = await server.getEvents({
    startLedger,
    filters: [
      {
        type: "contract",
        contractIds: [cfg.complianceId],
        topics: [settledTopicFilter()],
      },
    ],
    limit: opts.limit ?? 50,
  });

  return resp.events
    .filter((e) => e.inSuccessfulContractCall)
    .map((e) => ({
      txHash: e.txHash,
      ledger: e.ledger,
      ledgerClosedAt: e.ledgerClosedAt,
      data: parseProofSettledValue(e.value),
    }));
}

export async function getProofSettledByTxHash(
  cfg: AmoebaConfig,
  txHash: string,
): Promise<ProofSettledEvent | null> {
  const events = await listProofSettledEvents(cfg, { limit: 200 });
  return events.find((e) => e.txHash === txHash) ?? null;
}

export async function getProofSettledByNullifier(
  cfg: AmoebaConfig,
  nullifierHex: string,
): Promise<ProofSettledEvent | null> {
  const needle = nullifierHex.replace(/^0x/i, "").toLowerCase();
  const events = await listProofSettledEvents(cfg, { limit: 200 });
  return (
    events.find((e) => e.data.nullifier.toString("hex").toLowerCase() === needle) ??
    null
  );
}
