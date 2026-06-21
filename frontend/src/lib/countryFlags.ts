import { normalizeCountryCode } from "./countryDisplay";

type FlagModule = { default: string };

const flagLoaders: Record<string, () => Promise<FlagModule>> = {
  US: () => import("country-flag-icons/string/3x2/US"),
  MX: () => import("country-flag-icons/string/3x2/MX"),
};

export async function loadFlagSvg(code: string): Promise<string | null> {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return null;

  const loader = flagLoaders[normalized];
  if (!loader) return null;

  try {
    const mod = await loader();
    return mod.default;
  } catch {
    return null;
  }
}

/**
 * Register a flag loader when a new corridor country is added to the issuer.
 * Each loader adds ~1 KB to the build as a separate async chunk.
 */
export function registerFlagLoader(code: string, loader: () => Promise<FlagModule>): void {
  const normalized = normalizeCountryCode(code);
  if (normalized) {
    flagLoaders[normalized] = loader;
  }
}
