import { test, expect } from "@playwright/test";

test.describe("Wisp demo UI", () => {
  test("landing page renders hero copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Stealth rails for/i })).toBeVisible();
    await expect(page.getByText(/stablecoin compliance/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Walkthrough" }).first()).toBeVisible();
  });

  test("landing page shows how it works", async ({ page }) => {
    await page.goto("/#how-it-works");
    await expect(page.getByRole("heading", { name: /From issuer root/i })).toBeVisible();
    await expect(page.getByText("Trusted Issuer").first()).toBeVisible();
  });

  test("nav routes to demo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Demo", exact: true }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText("Transfer", { exact: true })).toBeVisible();
  });

  test("demo page shows stepper and action buttons", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByText("Wallet connected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Freighter" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try invalid proof" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Replay last proof" })).toBeDisabled();
  });

  test("legacy compliance route redirects to demo", async ({ page }) => {
    await page.goto("/compliance?tab=corridors");
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText("Transfer", { exact: true })).toBeVisible();
  });
});
