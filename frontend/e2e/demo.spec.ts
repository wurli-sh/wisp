import { test, expect } from "@playwright/test";

test.describe("Amoeba demo UI", () => {
  test("landing page renders hero copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Prove without showing." })).toBeVisible();
    await expect(page.getByRole("link", { name: "See a live proof →" })).toBeVisible();
  });

  test("nav routes to demo and compliance", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Demo", exact: true }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText("Generate a compliant transfer")).toBeVisible();

    await page.getByRole("link", { name: "Compliance", exact: true }).click();
    await expect(page).toHaveURL(/\/compliance$/);
    await expect(page.getByText("Proof settlements")).toBeVisible();
  });

  test("demo page shows stepper and action buttons", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByText("Wallet connected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate proof" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit compliant transfer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try invalid proof" })).toBeDisabled();
  });

  test("compliance tabs switch", async ({ page }) => {
    await page.goto("/compliance");
    await page.getByRole("button", { name: "Audit" }).click();
    await expect(page.getByText("Audit lookup")).toBeVisible();
    await page.getByRole("button", { name: "Corridors" }).click();
    await expect(page.getByText("US-MX")).toBeVisible();
  });
});
