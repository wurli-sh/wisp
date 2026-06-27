import type { Page } from "@playwright/test";
import { E2E_CORRIDORS } from "./wispPay";

/** Mock issuer API for preview/e2e (no Vite dev proxy). */
export async function installIssuerMocks(page: Page): Promise<void> {
  await page.route("**/issuer/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/corridors")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(E2E_CORRIDORS),
      });
      return;
    }

    if (url.includes("/mock-kyc/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          wallet: "GTEST",
          kyc_status: "none",
          eligible_for_proof: false,
          missing: ["kyc"],
          roots_status: "active",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "e2e mock: unhandled issuer route" }),
    });
  });
}
