export const LOGO_SRC = "/wisp-logo.svg";

export const BRAND_IMAGES = {
  portableSdk: {
    src: "/portable-sdk.webp",
    width: 1200,
    height: 800,
    alt: "Wisp works alongside your issuer.",
  },
  stableCoins: {
    src: "/stable-coins.webp",
    width: 1080,
    height: 800,
    alt: "Compliant stablecoin settlement across cross-border corridors.",
  },
  footer: {
    src: "/footer.webp",
    width: 1920,
    height: 1080,
    alt: "",
  },
  heroBanner: {
    src: "/hero-banner.webp",
    width: 1920,
    height: 1080,
    alt: "",
  },
} as const;

/** @deprecated Use BRAND_IMAGES.portableSdk.src */
export const PORTABLE_SDK_SRC = BRAND_IMAGES.portableSdk.src;
/** @deprecated Use BRAND_IMAGES.stableCoins.src */
export const STABLE_COINS_SRC = BRAND_IMAGES.stableCoins.src;
