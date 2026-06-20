export function sdkCheckpoint(label: string, data: Record<string, unknown>): void {
  const g = globalThis as { __WISP_DEBUG__?: boolean };
  const enabled =
    g.__WISP_DEBUG__ === true ||
    (typeof process !== "undefined" && process.env?.WISP_DEBUG === "1");
  if (!enabled) return;
  console.info("[wisp:sdk]", label, data);
}
