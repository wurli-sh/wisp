import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProofSettledEvent } from "@amoeba/sdk";
import { COPY } from "@/content/copy";
import { stellarExplorerTx } from "@/config/env";
import { useAmoebaClient } from "@/hooks/useAmoebaClient";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

import circleUsdc from "@/config/circle-testnet-usdc.json";

const CORRIDOR_USDC_SAC = circleUsdc.sac_contract_id;
const CORRIDOR_USDC_ISSUER = circleUsdc.usdc_issuer;

interface CorridorView {
  id: number;
  name: string;
  enabled: boolean;
  source_country: string;
  dest_country: string;
  asset_hex?: string;
  latest_root_snapshot?: { publish_status?: string } | null;
}

function shorten(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

interface ComplianceHubProps {
  tab: string;
  onTabChange: (tab: string) => void;
  initialNullifier?: string;
  initialTx?: string;
}

export function ComplianceHub({
  tab,
  onTabChange,
  initialNullifier = "",
  initialTx = "",
}: ComplianceHubProps) {
  const client = useAmoebaClient();

  const [corridors, setCorridors] = useState<CorridorView[]>([]);
  const [loadingCorridors, setLoadingCorridors] = useState(false);

  const loadCorridors = useCallback(async () => {
    setLoadingCorridors(true);
    try {
      const list = await client.issuer.listCorridors();
      const details = await Promise.all(
        list.map(async (corridor) => {
          const detail = await client.issuer.getCorridor(corridor.id);
          return {
            id: corridor.id,
            name: corridor.name,
            enabled: corridor.enabled,
            source_country: corridor.source_country,
            dest_country: corridor.dest_country,
            asset_hex: detail.asset_hex,
            latest_root_snapshot: detail.latest_root_snapshot as CorridorView["latest_root_snapshot"],
          };
        }),
      );
      setCorridors(details);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load corridors");
    } finally {
      setLoadingCorridors(false);
    }
  }, [client]);
  const [events, setEvents] = useState<ProofSettledEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [txQuery, setTxQuery] = useState(initialTx);
  const [nullifierQuery, setNullifierQuery] = useState(initialNullifier);
  const [auditResult, setAuditResult] = useState<ProofSettledEvent | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const list = await client.listProofSettledEvents({ limit: 50 });
      setEvents(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoadingEvents(false);
    }
  }, [client]);

  useEffect(() => {
    if (tab === "proofs") void loadEvents();
  }, [tab, loadEvents]);

  useEffect(() => {
    if (tab === "corridors") void loadCorridors();
  }, [tab, loadCorridors]);

  useEffect(() => {
    if (!initialNullifier && !initialTx) return;
    onTabChange("audit");
    if (initialNullifier) setNullifierQuery(initialNullifier);
    if (initialTx) setTxQuery(initialTx);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed audit fields once from URL
  }, []);

  useEffect(() => {
    if (tab !== "audit") return;
    if (!initialNullifier && !initialTx) return;

    void (async () => {
      setAuditBusy(true);
      setAuditResult(null);
      try {
        if (initialTx.trim()) {
          const hit = await client.getProofSettledByTxHash(initialTx.trim());
          setAuditResult(hit);
          return;
        }
        if (initialNullifier.trim()) {
          const hit = await client.getProofSettledByNullifier(
            initialNullifier.trim().replace(/^0x/i, ""),
          );
          setAuditResult(hit);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Audit search failed");
      } finally {
        setAuditBusy(false);
      }
    })();
  }, [client, initialNullifier, initialTx, tab]);

  const runAuditSearch = async () => {
    setAuditBusy(true);
    setAuditResult(null);
    try {
      if (txQuery.trim()) {
        const hit = await client.getProofSettledByTxHash(txQuery.trim());
        setAuditResult(hit);
        if (!hit) toast.message("No event for that transaction hash");
        return;
      }
      if (nullifierQuery.trim()) {
        const hit = await client.getProofSettledByNullifier(
          nullifierQuery.trim().replace(/^0x/i, ""),
        );
        setAuditResult(hit);
        if (!hit) toast.message("No event for that nullifier");
        return;
      }
      toast.error("Enter a transaction hash or nullifier");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Audit search failed");
    } finally {
      setAuditBusy(false);
    }
  };

  return (
    <div>
      <Tabs
        layoutId="complianceTab"
        active={tab}
        onChange={onTabChange}
        items={[
          { key: "proofs", label: "Proofs" },
          { key: "audit", label: "Audit" },
          { key: "corridors", label: "Corridors" },
        ]}
        trailing={
          tab === "proofs" ? (
            <Button size="sm" variant="outline" onClick={() => void loadEvents()}>
              Refresh
            </Button>
          ) : null
        }
      />

      {tab === "proofs" && (
        <section className="mt-6">
          <h2 className="text-xl font-bold text-primary">{COPY.compliance.proofs.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {COPY.compliance.proofs.subtitle}
          </p>

          {loadingEvents ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              Loading events…
            </div>
          ) : events.length === 0 ? (
            <p className="mt-8 text-sm text-muted-foreground">
              No ProofSettled events yet. Complete a demo transfer first.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto border border-border">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider">Tx</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider">Corridor</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider">Nullifier</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider">Ledger</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.txHash} className="border-b border-border">
                      <td className="px-3 py-2">
                        <a
                          href={stellarExplorerTx(event.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-bright hover:underline"
                        >
                          {shorten(event.txHash)}
                        </a>
                      </td>
                      <td className="px-3 py-2">{event.data.corridor_id}</td>
                      <td className="px-3 py-2">{event.data.amount.toString()}</td>
                      <td className="px-3 py-2">
                        {shorten(event.data.nullifier.toString("hex"))}
                      </td>
                      <td className="px-3 py-2">{event.ledger}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "audit" && (
        <section className="mt-6">
          <h2 className="text-xl font-bold text-primary">{COPY.compliance.audit.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {COPY.compliance.audit.subtitle}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {COPY.compliance.audit.txPlaceholder}
              </span>
              <input
                value={txQuery}
                onChange={(e) => setTxQuery(e.target.value)}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-xs shadow-soft outline-none focus-visible:shadow-glow"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {COPY.compliance.audit.nullifierPlaceholder}
              </span>
              <input
                value={nullifierQuery}
                onChange={(e) => setNullifierQuery(e.target.value)}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-xs shadow-soft outline-none focus-visible:shadow-glow"
              />
            </label>
          </div>

          <Button className="mt-4" disabled={auditBusy} onClick={() => void runAuditSearch()}>
            {auditBusy && <Loader2 size={14} className="animate-spin" />}
            {COPY.compliance.audit.search}
          </Button>

          {auditResult && (
            <div className="mt-6 border border-border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Proof settled</Badge>
                <Badge>Ledger {auditResult.ledger}</Badge>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">Tx hash</dt>
                  <dd className="text-xs">{auditResult.txHash}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">Corridor</dt>
                  <dd>{auditResult.data.corridor_id}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">Amount</dt>
                  <dd className="text-xs">{auditResult.data.amount.toString()}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">Nullifier</dt>
                  <dd className="text-xs break-all">
                    {auditResult.data.nullifier.toString("hex")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">Config hash</dt>
                  <dd className="text-xs break-all">
                    {auditResult.data.corridor_config_hash.toString("hex")}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      )}

      {tab === "corridors" && (
        <section className="mt-6">
          <h2 className="text-xl font-bold text-primary">{COPY.compliance.corridors.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {COPY.compliance.corridors.subtitle}
          </p>

          <div className="mt-6 grid gap-4">
            {loadingCorridors && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                Loading corridors…
              </p>
            )}
            {corridors.map((corridor) => (
              <article
                key={corridor.id}
                className="border border-border bg-card p-5 shadow-soft"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-primary">{corridor.name}</h3>
                  <Badge variant={corridor.enabled ? "success" : "warning"}>
                    {corridor.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">Corridor id</dt>
                    <dd>{corridor.id}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">Route</dt>
                    <dd>
                      {corridor.source_country} → {corridor.dest_country}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">Asset (USDC SAC)</dt>
                    <dd className="text-xs break-all">{CORRIDOR_USDC_SAC}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">Circle issuer</dt>
                    <dd className="text-xs break-all">{CORRIDOR_USDC_ISSUER}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">Roots published</dt>
                    <dd>
                      {corridor.latest_root_snapshot?.publish_status === "active"
                        ? "Active"
                        : "Pending"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
