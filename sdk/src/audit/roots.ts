import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { normalizeField } from "@amoeba/js";
import type { AmoebaConfig } from "../config.js";

export interface ChainIssuerRoots {
  issuer: string;
  merkle_root: string;
  sanctions_root: string;
  jurisdiction_root: string;
  ledger: number;
  txHash: string;
  eventTopic: string;
}

export interface ChainCorridorRoots {
  corridor_id: number;
  corridor_config_hash: string;
  source_jurisdiction_root: string;
  dest_address_root: string;
  enabled: boolean;
  ledger: number;
  txHash: string;
  eventTopic: string;
}

function topicSymbol(topic: xdr.ScVal): string | null {
  try {
    const native = scValToNative(topic);
    return typeof native === "string" ? native : null;
  } catch {
    return null;
  }
}

function asBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    const hex = value.replace(/^0x/, "");
    if (/^[0-9a-f]+$/i.test(hex)) {
      return Buffer.from(hex.padStart(64, "0"), "hex");
    }
  }
  throw new Error(`expected bytes32, got ${typeof value}`);
}

function bytes32ToFieldDecimal(bytes: Buffer): string {
  const padded =
    bytes.length === 32
      ? bytes
      : Buffer.from(bytes.toString("hex").padStart(64, "0"), "hex");
  return normalizeField(BigInt(`0x${padded.toString("hex")}`).toString()).toString();
}

function addressToStrkey(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "toString" in value) {
    const rendered = String(value);
    if (/^[GC]/.test(rendered)) return rendered;
  }
  throw new Error(`unsupported address value: ${typeof value}`);
}

interface ParsedChainEvent {
  ledger: number;
  txHash: string;
  topics: string[];
  data: unknown;
}

async function pageContractEvents(
  cfg: AmoebaConfig,
  topicFilter: string[],
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ParsedChainEvent[]> {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");

  const server = new rpc.Server(cfg.rpcUrl);
  const latest = await server.getLatestLedger();
  const startLedger = opts.startLedger ?? Math.max(1, latest.sequence - 50_000);
  const maxPages = opts.maxPages ?? 20;
  const pageSize = 200;

  let cursor: string | null = null;
  const events: ParsedChainEvent[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const resp: rpc.Api.GetEventsResponse = cursor
      ? await server.getEvents({
          cursor,
          filters: [
            {
              type: "contract",
              contractIds: [cfg.complianceId],
              topics: [topicFilter],
            },
          ],
          limit: pageSize,
        })
      : await server.getEvents({
          startLedger,
          filters: [
            {
              type: "contract",
              contractIds: [cfg.complianceId],
              topics: [topicFilter],
            },
          ],
          limit: pageSize,
        });

    for (const event of resp.events) {
      if (!event.inSuccessfulContractCall) continue;
      const topics = (event.topic ?? [])
        .map((topic) => topicSymbol(topic))
        .filter((topic): topic is string => Boolean(topic));
      events.push({
        ledger: event.ledger,
        txHash: event.txHash,
        topics,
        data: scValToNative(event.value),
      });
    }

    if (resp.events.length < pageSize || !resp.cursor || resp.cursor === cursor) break;
    cursor = resp.cursor;
  }

  return events.sort((a, b) => b.ledger - a.ledger);
}

function issuerTopicFilters(): string[][] {
  return [
    [
      xdr.ScVal.scvSymbol("issuer").toXDR("base64"),
      xdr.ScVal.scvSymbol("root").toXDR("base64"),
    ],
    [
      xdr.ScVal.scvSymbol("issuer").toXDR("base64"),
      xdr.ScVal.scvSymbol("registered").toXDR("base64"),
    ],
  ];
}

function corridorTopicFilters(): string[][] {
  return [
    [
      xdr.ScVal.scvSymbol("corridor").toXDR("base64"),
      xdr.ScVal.scvSymbol("updated").toXDR("base64"),
    ],
    [
      xdr.ScVal.scvSymbol("corridor").toXDR("base64"),
      xdr.ScVal.scvSymbol("registered").toXDR("base64"),
    ],
  ];
}

function parseIssuerRootsEvent(
  event: ParsedChainEvent,
  issuerStrkey: string,
): ChainIssuerRoots | null {
  const kind = event.topics[1];
  if (kind !== "root" && kind !== "registered") return null;
  const data = event.data as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;

  const issuer = addressToStrkey(data.issuer);
  if (issuer !== issuerStrkey) return null;

  return {
    issuer,
    merkle_root: bytes32ToFieldDecimal(asBuffer(data.merkle_root)),
    sanctions_root: bytes32ToFieldDecimal(asBuffer(data.sanctions_root)),
    jurisdiction_root: bytes32ToFieldDecimal(asBuffer(data.jurisdiction_root)),
    ledger: event.ledger,
    txHash: event.txHash,
    eventTopic: kind,
  };
}

function parseCorridorRootsEvent(
  event: ParsedChainEvent,
  corridorId: number,
): ChainCorridorRoots | null {
  const kind = event.topics[1];
  if (kind !== "updated" && kind !== "registered") return null;
  const data = event.data as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;

  const id = Number(data.corridor_id);
  if (id !== corridorId) return null;

  return {
    corridor_id: id,
    corridor_config_hash: bytes32ToFieldDecimal(asBuffer(data.corridor_config_hash)),
    source_jurisdiction_root: bytes32ToFieldDecimal(asBuffer(data.source_jurisdiction_root)),
    dest_address_root: bytes32ToFieldDecimal(asBuffer(data.dest_address_root)),
    enabled: kind === "registered" ? true : Boolean(data.enabled),
    ledger: event.ledger,
    txHash: event.txHash,
    eventTopic: kind,
  };
}

async function pageIssuerEvents(
  cfg: AmoebaConfig,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ParsedChainEvent[]> {
  const batches = await Promise.all(
    issuerTopicFilters().map((filter) => pageContractEvents(cfg, filter, opts)),
  );
  return batches.flat().sort((a, b) => b.ledger - a.ledger);
}

async function pageCorridorEvents(
  cfg: AmoebaConfig,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ParsedChainEvent[]> {
  const batches = await Promise.all(
    corridorTopicFilters().map((filter) => pageContractEvents(cfg, filter, opts)),
  );
  return batches.flat().sort((a, b) => b.ledger - a.ledger);
}

export async function getLatestIssuerRoots(
  cfg: AmoebaConfig,
  issuerStrkey: string,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ChainIssuerRoots | null> {
  const events = await pageIssuerEvents(cfg, opts);
  for (const event of events) {
    const parsed = parseIssuerRootsEvent(event, issuerStrkey);
    if (parsed) return parsed;
  }
  return null;
}

export async function getLatestCorridorRoots(
  cfg: AmoebaConfig,
  corridorId: number,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ChainCorridorRoots | null> {
  const events = await pageCorridorEvents(cfg, opts);
  for (const event of events) {
    const parsed = parseCorridorRootsEvent(event, corridorId);
    if (parsed) return parsed;
  }
  return null;
}

export interface ChainRootsBundle {
  issuer: ChainIssuerRoots;
  corridor: ChainCorridorRoots;
}

export async function getLatestChainRoots(
  cfg: AmoebaConfig,
  issuerStrkey: string,
  corridorId: number,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ChainRootsBundle | null> {
  const [issuer, corridor] = await Promise.all([
    getLatestIssuerRoots(cfg, issuerStrkey, opts),
    getLatestCorridorRoots(cfg, corridorId, opts),
  ]);
  if (!issuer || !corridor) return null;
  return { issuer, corridor };
}
