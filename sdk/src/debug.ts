export function sdkCheckpoint(label: string, data: Record<string, unknown>): void {
  const g = globalThis as { __AMOEBA_DEBUG__?: boolean };
  const enabled =
    g.__AMOEBA_DEBUG__ === true ||
    (typeof process !== "undefined" && process.env?.AMOEBA_DEBUG === "1");
  if (!enabled) return;
  console.info("[amoeba:sdk]", label, data);
}
