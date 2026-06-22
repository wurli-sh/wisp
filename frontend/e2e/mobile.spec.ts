import { test, expect } from "@playwright/test";
import { installIssuerMocks } from "./helpers/mockRoutes";
import { payLinkPath, sampleInvoicePayload } from "./helpers/wispPay";

test.describe("Mobile layout smoke", () => {
  test.beforeEach(async ({ page }) => {
    await installIssuerMocks(page);
  });

  test("bottom tab bar navigates between Home, Wisp Pay, and Demo", async ({ page }) => {
    await page.goto("/");

    const tabNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(tabNav).toBeVisible();

    await tabNav.getByRole("link", { name: "Wisp Pay", exact: true }).click();
    await expect(page).toHaveURL(/\/wisp-pay/);
    await expect(page.getByRole("heading", { name: /Compliant payment links/i })).toBeVisible();

    await tabNav.getByRole("link", { name: "Demo", exact: true }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText("Transfer", { exact: true })).toBeVisible();

    await tabNav.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /Stealth rails for/i })).toBeVisible();
  });

  test("wisp-pay create tab is usable on mobile", async ({ page }) => {
    await page.goto("/wisp-pay");
    await expect(page.getByRole("button", { name: "Create", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create pay link" })).toBeVisible();
  });

  test("demo page shows connect action on mobile", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("button", { name: "Connect Freighter" })).toBeVisible();
    await expect(page.getByText("Transfer", { exact: true })).toBeVisible();
  });

  test("portable pay link renders checkout without horizontal overflow", async ({ page }) => {
    const id = "inv_e2e_mobile_pay";
    await page.goto(payLinkPath(id, sampleInvoicePayload()));

    await expect(page).toHaveURL(new RegExp(`/wisp-pay\\?mode=pay&id=${id}`));
    await expect(page.getByRole("main").getByText(/^25$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Freighter" })).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
