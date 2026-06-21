import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export type WispPayMode = "create" | "pay" | "receipt";

function parseMode(value: string | null): WispPayMode {
  if (value === "pay" || value === "receipt" || value === "create") return value;
  return "create";
}

export function useWispPayUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = parseMode(searchParams.get("mode"));
  const invoiceId = searchParams.get("id")?.trim() || null;
  const txHash = searchParams.get("tx")?.trim() || null;
  const encodedPayload = searchParams.get("d")?.trim() || null;

  const setMode = useCallback(
    (nextMode: WispPayMode, preserve: { id?: string | null; tx?: string | null; d?: string | null } = {}) => {
      setSearchParams(
        () => {
          const params = new URLSearchParams();
          if (nextMode === "create") {
            params.delete("mode");
          } else {
            params.set("mode", nextMode);
          }

          const id = preserve.id ?? null;
          const tx = preserve.tx ?? null;
          const d = preserve.d ?? null;

          if (id) params.set("id", id);
          else params.delete("id");

          if (tx) params.set("tx", tx);
          else params.delete("tx");

          if (d) params.set("d", d);
          else params.delete("d");

          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const loadPayInvoice = useCallback(
    (id: string, d?: string | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("mode", "pay");
          params.set("id", id);
          if (d) params.set("d", d);
          else params.delete("d");
          params.delete("tx");
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const openReceipt = useCallback(
    (opts: { id?: string | null; tx?: string | null }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("mode", "receipt");
          if (opts.id) params.set("id", opts.id);
          else params.delete("id");
          if (opts.tx) params.set("tx", opts.tx);
          else params.delete("tx");
          params.delete("d");
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return {
    mode,
    invoiceId,
    txHash,
    encodedPayload,
    setMode,
    loadPayInvoice,
    openReceipt,
  };
}
