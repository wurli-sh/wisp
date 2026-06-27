import { normalizeField } from "@wisp_/js";
import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import type { ChainClientConfig } from "./types.js";
import {
  clampStartLedger,
  DEFAULT_EVENT_SCAN_LEDGERS,
  isLedgerRangeError,
  parseOldestLedgerFromError,
  resolveEventStartLedger,
} from "./ledger-window.js";

export interface ChainIssuerRecord {
  issuer: string;
  metadata_uri: string;
  enabled: boolean;
  registered_at_ledger: number;
  updated_at_ledger: number;
  registration_seq: number;
  ledger: number;
  txHash: string;
  eventTopic: string;
}

export interface ChainIssuerRoots {
  issuer: string;
  merkle_root: string;
  sanctions_root: string;
  jurisdiction_root: string;
  ledger: number;
  txHash: string;
  eventTopic: string;
  enabled?: boolean;
}

export interface ChainCorridorRoots {
  issuer: string;
  corridor_id: number;
  corridor_config_hash: string;
  source_jurisdiction_root: string;
  dest_address_root: string;
  enabled: boolean;
  ledger: number;
  txHash: string;
  eventTopic: string;
}

export interface ChainRootsBundle {
  issuer: ChainIssuerRoots;
  corridor: ChainCorridorRoots;
}

export interface ChainIssuerPage {
  issuers: ChainIssuerRecord[];
  nextCursor: number | null;
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
  if (typeof value === "string") return value;
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

interface IssuerMetadataPatch {
  issuer: string;
  metadata_uri: string;
  updated_at_ledger: number;
}

interface IssuerEnabledPatch {
  issuer: string;
  enabled: boolean;
}

async function pageContractEvents(
  cfg: ChainClientConfig,
  topicFilter: string[],
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ParsedChainEvent[]> {
  if (!cfg.complianceId) throw new Error("COMPLIANCE_CONTRACT_ID not set");

  const server = new rpc.Server(cfg.rpcUrl);
  const explicitStart = await resolveEventStartLedger(server, cfg, opts.startLedger);
  const latest = await server.getLatestLedger();
  const hasDeployLedger = opts.startLedger != null || cfg.validateStartLedger != null;
  let startLedger = hasDeployLedger
    ? explicitStart
    : Math.max(explicitStart, latest.sequence - DEFAULT_EVENT_SCAN_LEDGERS);
  startLedger = clampStartLedger(startLedger, latest.sequence);
  const maxPages = opts.maxPages ?? 40;
  const pageSize = 200;

  let cursor: string | null = null;
  const events: ParsedChainEvent[] = [];

  const fetchPage = async (start: number, pageCursor: string | null) => {
    if (pageCursor) {
      return server.getEvents({
        cursor: pageCursor,
        filters: [{ type: "contract", contractIds: [cfg.complianceId!], topics: [topicFilter] }],
        limit: pageSize,
      });
    }
    return server.getEvents({
      startLedger: start,
      filters: [{ type: "contract", contractIds: [cfg.complianceId!], topics: [topicFilter] }],
      limit: pageSize,
    });
  };

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

    if (!resp.cursor || resp.cursor === cursor) break;
    cursor = resp.cursor;
  }

  return events.sort((a, b) => b.ledger - a.ledger);
}

function issuerTopicFilters(): string[][] {
  return [
    [xdr.ScVal.scvSymbol("issuer").toXDR("base64"), xdr.ScVal.scvSymbol("registered").toXDR("base64")],
    [xdr.ScVal.scvSymbol("issuer").toXDR("base64"), xdr.ScVal.scvSymbol("metadata").toXDR("base64")],
    [xdr.ScVal.scvSymbol("issuer").toXDR("base64"), xdr.ScVal.scvSymbol("enabled").toXDR("base64")],
    [xdr.ScVal.scvSymbol("issuer").toXDR("base64"), xdr.ScVal.scvSymbol("root").toXDR("base64")],
  ];
}

function corridorTopicFilters(): string[][] {
  return [
    [xdr.ScVal.scvSymbol("corridor").toXDR("base64"), xdr.ScVal.scvSymbol("registered").toXDR("base64")],
    [xdr.ScVal.scvSymbol("corridor").toXDR("base64"), xdr.ScVal.scvSymbol("updated").toXDR("base64")],
  ];
}

function parseIssuerRecordEvent(event: ParsedChainEvent): ChainIssuerRecord | null {
  if (event.topics[1] !== "registered") return null;
  const data = event.data as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;
  return {
    issuer: addressToStrkey(data.issuer),
    metadata_uri: String(data.metadata_uri ?? ""),
    enabled: Boolean(data.enabled),
    registered_at_ledger: Number(data.registered_at_ledger ?? event.ledger),
    updated_at_ledger: Number(data.updated_at_ledger ?? event.ledger),
    registration_seq: Number(data.registration_seq ?? 0),
    ledger: event.ledger,
    txHash: event.txHash,
    eventTopic: "registered",
  };
}

function parseIssuerMetadataEvent(event: ParsedChainEvent): IssuerMetadataPatch | null {
  if (event.topics[1] !== "metadata") return null;
  const data = event.data as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;
  return {
    issuer: addressToStrkey(data.issuer),
    metadata_uri: String(data.new_metadata_uri ?? ""),
    updated_at_ledger: Number(data.updated_at_ledger ?? event.ledger),
  };
}

function parseIssuerEnabledEvent(event: ParsedChainEvent): IssuerEnabledPatch | null {
  if (event.topics[1] !== "enabled") return null;
  const data = event.data as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;
  return {
    issuer: addressToStrkey(data.issuer),
    enabled: Boolean(data.enabled),
  };
}

function parseIssuerRootsEvent(
  event: ParsedChainEvent,
  issuerStrkey: string,
): ChainIssuerRoots | null {
  if (event.topics[1] !== "root") return null;
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
    eventTopic: "root",
  };
}

function parseCorridorRootsEvent(
  event: ParsedChainEvent,
  issuerStrkey: string,
  corridorId: number,
): ChainCorridorRoots | null {
  const kind = event.topics[1];
  if (kind !== "registered" && kind !== "updated") return null;
  const data = event.data as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;
  const issuer = addressToStrkey(data.issuer);
  const id = Number(data.corridor_id);
  if (issuer !== issuerStrkey || id !== corridorId) return null;
  return {
    issuer,
    corridor_id: id,
    corridor_config_hash: bytes32ToFieldDecimal(asBuffer(data.corridor_config_hash)),
    source_jurisdiction_root: bytes32ToFieldDecimal(asBuffer(data.source_jurisdiction_root)),
    dest_address_root: bytes32ToFieldDecimal(asBuffer(data.dest_address_root)),
    enabled: Boolean(data.enabled),
    ledger: event.ledger,
    txHash: event.txHash,
    eventTopic: kind,
  };
}

async function pageIssuerEvents(
  cfg: ChainClientConfig,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ParsedChainEvent[]> {
  const batches = await Promise.all(
    issuerTopicFilters().map((filter) => pageContractEvents(cfg, filter, opts)),
  );
  return batches.flat().sort((a, b) => b.ledger - a.ledger);
}

async function pageCorridorEvents(
  cfg: ChainClientConfig,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ParsedChainEvent[]> {
  const batches = await Promise.all(
    corridorTopicFilters().map((filter) => pageContractEvents(cfg, filter, opts)),
  );
  return batches.flat().sort((a, b) => b.ledger - a.ledger);
}

export async function getLatestIssuerRecord(
  cfg: ChainClientConfig,
  issuerStrkey: string,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ChainIssuerRecord | null> {
  const events = await pageIssuerEvents(cfg, opts);
  let record: ChainIssuerRecord | null = null;
  let metadata: IssuerMetadataPatch | null = null;
  let enabled: IssuerEnabledPatch | null = null;

  for (const event of events) {
    if (!metadata) {
      const patch = parseIssuerMetadataEvent(event);
      if (patch?.issuer === issuerStrkey) metadata = patch;
    }
    if (!enabled) {
      const patch = parseIssuerEnabledEvent(event);
      if (patch?.issuer === issuerStrkey) enabled = patch;
    }
    if (!record) {
      const parsed = parseIssuerRecordEvent(event);
      if (parsed?.issuer === issuerStrkey) record = parsed;
    }
    if (record && metadata && enabled) break;
  }

  if (!record) return null;
  if (metadata) {
    record.metadata_uri = metadata.metadata_uri;
    record.updated_at_ledger = metadata.updated_at_ledger;
  }
  if (enabled) {
    record.enabled = enabled.enabled;
  }
  return record;
}

export async function listIssuerRegistryEntries(
  cfg: ChainClientConfig,
  opts: { cursor?: number; limit?: number; startLedger?: number } = {},
): Promise<ChainIssuerPage> {
  const events = await pageIssuerEvents(cfg, { startLedger: opts.startLedger });
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const cursor = Math.max(0, opts.cursor ?? 0);

  const byIssuer = new Map<string, ChainIssuerRecord>();
  for (const event of events) {
    const record = parseIssuerRecordEvent(event);
    if (!record) continue;
    if (byIssuer.has(record.issuer)) continue;
    byIssuer.set(record.issuer, record);
  }

  const issuers = [...byIssuer.values()]
    .sort((a, b) => b.updated_at_ledger - a.updated_at_ledger)
    .slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < byIssuer.size ? cursor + limit : null;

  return { issuers, nextCursor };
}

export async function getLatestIssuerRoots(
  cfg: ChainClientConfig,
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
  cfg: ChainClientConfig,
  issuerStrkey: string,
  corridorId: number,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ChainCorridorRoots | null> {
  const events = await pageCorridorEvents(cfg, opts);
  for (const event of events) {
    const parsed = parseCorridorRootsEvent(event, issuerStrkey, corridorId);
    if (parsed) return parsed;
  }
  return null;
}

export async function getLatestChainRoots(
  cfg: ChainClientConfig,
  issuerStrkey: string,
  corridorId: number,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<ChainRootsBundle | null> {
  const [issuer, corridor] = await Promise.all([
    getLatestIssuerRoots(cfg, issuerStrkey, opts),
    getLatestCorridorRoots(cfg, issuerStrkey, corridorId, opts),
  ]);
  if (!issuer || !corridor) return null;
  return { issuer, corridor };
}

export async function getLatestIssuerEnabled(
  cfg: ChainClientConfig,
  issuerStrkey: string,
  opts: { startLedger?: number; maxPages?: number } = {},
): Promise<boolean | null> {
  const record = await getLatestIssuerRecord(cfg, issuerStrkey, opts);
  return record?.enabled ?? null;
}
