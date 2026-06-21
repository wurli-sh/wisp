import { AlertTriangle } from "lucide-react";
import { COPY } from "@/content/copy";
import { missingRequiredConfig } from "@/config/env";

/**
 * Pre-flight warning shown on /demo and /wisp-pay when required VITE_* config is
 * missing, so misconfiguration is caught before going live instead of failing
 * mid-flow at fetch/settle.
 */
export function ConfigBanner() {
  const missing = missingRequiredConfig();
  if (missing.length === 0) return null;

  return (
    <section className="flex items-start gap-3 border-2 border-destructive/40 bg-destructive/5 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-destructive">
          {COPY.common.configErrorTitle}
        </p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          {COPY.common.configErrorBody.replace("{keys}", missing.join(", "))}
        </p>
      </div>
    </section>
  );
}
