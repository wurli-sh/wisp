import type { CorridorOption } from "@wisp_/js";
import type { WispClient } from "@wisp_/sdk";

const STELLAR_ASSET_DECIMALS = 7;
const STELLAR_ASSET_SCALE = 10_000_000n;

export function extractTxHash(
  result: Awaited<ReturnType<WispClient["settleWithWallet"]>>,
): string {
  return result.getTransactionResponse?.txHash ?? result.sendTransactionResponse?.hash ?? "";
}

export function parseUsdcAmount(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,7})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const normalized = `${whole}${frac.padEnd(STELLAR_ASSET_DECIMALS, "0")}`.replace(
    /^0+(?=\d)/,
    "",
  );
  return normalized.length > 0 ? normalized : "0";
}

export function formatUsdcDisplay(micro: string): string {
  const value = BigInt(micro);
  const whole = value / STELLAR_ASSET_SCALE;
  const frac = value % STELLAR_ASSET_SCALE;
  const fracStr = frac.toString().padStart(STELLAR_ASSET_DECIMALS, "0").replace(/0+$/, "");
  return fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString();
}

export function bumpAmountMicro(micro: string): string {
  return (BigInt(micro) + 1n).toString();
}

export function defaultCountries(corridors: CorridorOption[]): {
  sourceCountry: string;
  destCountry: string;
} {
  const first = corridors.find((corridor) => corridor.enabled);
  return {
    sourceCountry: first?.source_country ?? "",
    destCountry: first?.dest_country ?? "",
  };
}

export function reconcileCorridorSelection(
  corridors: CorridorOption[],
  source: string,
  dest: string,
): { sourceCountry: string; destCountry: string } {
  const enabled = corridors.filter((corridor) => corridor.enabled);
  if (enabled.length === 0) {
    return { sourceCountry: source, destCountry: dest };
  }

  const exact = enabled.find(
    (corridor) => corridor.source_country === source && corridor.dest_country === dest,
  );
  if (exact) {
    return { sourceCountry: source, destCountry: dest };
  }

  const destsForSource = enabled
    .filter((corridor) => corridor.source_country === source)
    .map((corridor) => corridor.dest_country);
  if (destsForSource.length > 0) {
    return {
      sourceCountry: source,
      destCountry: destsForSource.includes(dest) ? dest : destsForSource[0]!,
    };
  }

  const first = enabled[0]!;
  return { sourceCountry: first.source_country, destCountry: first.dest_country };
}

export function findCorridor(
  corridors: CorridorOption[],
  sourceCountry: string,
  destCountry: string,
): CorridorOption | null {
  return (
    corridors.find(
      (corridor) =>
        corridor.enabled &&
        corridor.source_country === sourceCountry &&
        corridor.dest_country === destCountry,
    ) ?? null
  );
}

/**
 * Reconcile corridor selection without reverting an intentional swap to an
 * invalid (no enabled corridor) source/dest pair. Keeps the pair when the
 * source has no enabled corridors; otherwise fixes dest only.
 */
export function relaxCorridorReconcile(
  corridors: CorridorOption[],
  source: string,
  dest: string,
): { sourceCountry: string; destCountry: string } | null {
  if (!corridors.length || !source || !dest) return null;
  if (findCorridor(corridors, source, dest)) return null;

  const enabled = corridors.filter((corridor) => corridor.enabled);
  const hasSource = enabled.some((corridor) => corridor.source_country === source);
  if (!hasSource) return null;

  const destsForSource = enabled
    .filter((corridor) => corridor.source_country === source)
    .map((corridor) => corridor.dest_country);
  const nextDest = destsForSource.includes(dest) ? dest : destsForSource[0]!;
  if (nextDest === dest) return null;
  return { sourceCountry: source, destCountry: nextDest };
}
