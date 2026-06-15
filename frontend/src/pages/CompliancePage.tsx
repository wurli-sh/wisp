import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProofSettledEvent } from "@amoeba/sdk";
import { COPY } from "@/content/copy";
import { stellarExplorerTx } from "@/config/env";
import { useAmoebaClient } from "@/hooks/useAmoebaClient";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const CORRIDORS = [
  {
    id: 1,
    name: "US-MX",
    enabled: true,
    source_jurisdiction_root: "published via issuer",
    dest_address_root: "published via issuer",
    config_hash: "3326516550954763686359727686701117193470825508192979130172170637867331195228",
  },
] as const;

function shorten(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function CompliancePage() {
  const client = useAmoebaClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "proofs";

  const [events, setEvents] = useState<ProofSettledEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [txQuery, setTxQuery] = useState(() => params.get("tx") ?? "");
  const [nullifierQuery, setNullifierQuery] = useState(
    () => params.get("nullifier") ?? "",
  );
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
        onChange={(key) => setParams({ tab: key })}
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
            {CORRIDORS.map((corridor) => (
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
                    <dt className="text-[10px] uppercase text-muted-foreground">Config hash</dt>
                    <dd className="text-xs break-all">{corridor.config_hash}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">
                      Source jurisdiction root
                    </dt>
                    <dd className="text-sm">{corridor.source_jurisdiction_root}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">
                      Destination address root
                    </dt>
                    <dd className="text-sm">{corridor.dest_address_root}</dd>
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
