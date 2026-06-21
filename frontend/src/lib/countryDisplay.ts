const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const ISO_ALPHA2 = /^[A-Za-z]{2}$/;

export function normalizeCountryCode(code: string): string | null {
  const trimmed = code.trim();
  if (!ISO_ALPHA2.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

export function getCountryDisplayName(code: string): string {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return code;
  return regionNames.of(normalized) ?? normalized;
}

export function formatCountryLabel(code: string): string {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return code;
  const name = getCountryDisplayName(normalized);
  return name === normalized ? normalized : `${name} (${normalized})`;
}
