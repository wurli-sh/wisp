import { test, expect } from "@playwright/test";
import {
  INVOICE_STORAGE_KEY,
  payLinkPath,
  sampleInvoicePayload,
  sampleStoredInvoice,
} from "./helpers/wispPay";
import { installIssuerMocks } from "./helpers/mockRoutes";

test.describe("Wisp Pay Links", () => {
  test.beforeEach(async ({ page }) => {
    await installIssuerMocks(page);
  });

  test("nav routes to wisp-pay", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Wisp Pay", exact: true }).click();
    await expect(page).toHaveURL(/\/wisp-pay$/);
    await expect(page.getByRole("heading", { name: /Compliant payment links/i })).toBeVisible();
  });

  test("wisp-pay page shows create form and tabs", async ({ page }) => {
    await page.goto("/wisp-pay");
    await expect(page.getByRole("button", { name: "Create", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Receipt", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create pay link" })).toBeVisible();
  });

  test("creates invoice and lists it locally", async ({ page }) => {
    await page.goto("/wisp-pay");
    await page.locator('input[inputmode="decimal"]').fill("25.00");
    await page.getByPlaceholder("Vendor payout, Q2 retainer…").fill("Acme retainer");
    await page.getByRole("button", { name: "Create pay link" }).click();

    await expect(page.getByRole("main").getByText("Invoice created")).toBeVisible();
    await expect(page.getByRole("main").getByText(/inv_/).first()).toBeVisible();
    await expect(page.getByRole("main").getByText("Acme retainer").first()).toBeVisible();
    await expect(page.getByRole("main").getByText("Pending").first()).toBeVisible();

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as unknown[]) : [];
    }, INVOICE_STORAGE_KEY);
    expect(stored.length).toBeGreaterThan(0);
  });

  test("remove pending invoice from list; portable pay link still works", async ({ page }) => {
    await page.goto("/wisp-pay");
    await page.locator('input[inputmode="decimal"]').fill("25.00");
    await page.getByRole("button", { name: "Create pay link" }).click();
    await expect(page.getByRole("main").getByText("Invoice created")).toBeVisible();

    const invoice = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { id: string }[];
      return parsed[0] ?? null;
    }, INVOICE_STORAGE_KEY);
    expect(invoice).not.toBeNull();

    const id = invoice!.id;
    await page
      .getByRole("listitem")
      .filter({ hasText: id })
      .getByRole("button", { name: "Remove", exact: true })
      .click();

    await expect(page.getByText("Your invoices")).not.toBeVisible();

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as unknown[]) : [];
    }, INVOICE_STORAGE_KEY);
    expect(stored).toEqual([]);

    await page.goto(payLinkPath(id, sampleInvoicePayload()));
    await expect(page).toHaveURL(new RegExp(`/wisp-pay\\?mode=pay&id=${id}`));
    await expect(page.getByRole("main").getByText(/^25$/)).toBeVisible();
    await expect(page.getByRole("main").getByText("USDC", { exact: true })).toBeVisible();
  });

  test("portable pay link hydrates checkout without localStorage", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installIssuerMocks(page);

    const id = "inv_e2e_portable";
    const path = payLinkPath(id, sampleInvoicePayload());
    await page.goto(path);

    await expect(page).toHaveURL(new RegExp(`/wisp-pay\\?mode=pay&id=${id}`));
    await expect(page.getByRole("button", { name: "Pay", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByText(/^25$/)).toBeVisible();
    await expect(page.getByRole("main").getByText("USDC", { exact: true })).toBeVisible();
    await expect(page.getByText("United States")).toBeVisible();
    await expect(page.getByText("Mexico")).toBeVisible();
    await expect(page.getByText(id)).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Freighter" })).toBeVisible();

    const stored = await page.evaluate((key) => localStorage.getItem(key), INVOICE_STORAGE_KEY);
    expect(stored).toBeNull();

    await context.close();
  });

  test("pay redirect preserves mode, id, and d payload", async ({ page }) => {
    const id = "inv_test123";
    const d = payLinkPath(id, sampleInvoicePayload()).split("d=")[1]!;
    await page.goto(`/pay/${id}?d=${d}`);
    await expect(page).toHaveURL(new RegExp(`/wisp-pay\\?mode=pay&id=${id}`));
    await expect(page.getByRole("button", { name: "Pay", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByText(/^25$/)).toBeVisible();
    await expect(page.getByRole("main").getByText("USDC", { exact: true })).toBeVisible();
  });

  test("invalid pay link shows error state", async ({ page }) => {
    await page.goto("/wisp-pay?mode=pay&id=inv_bad&d=not-valid-base64");
    await expect(page.getByText("Invalid pay link")).toBeVisible();
  });

  test("pay tab loads invoice from localStorage via paste", async ({ page }) => {
    const invoice = sampleStoredInvoice("inv_e2e_paste");
    await page.goto("/wisp-pay");
    await page.evaluate(
      ({ key, value }) => {
        localStorage.setItem(key, JSON.stringify([value]));
      },
      { key: INVOICE_STORAGE_KEY, value: invoice },
    );
    await page.reload();

    await page.getByRole("button", { name: "Pay", exact: true }).click();
    await page.getByPlaceholder("inv_…").fill(invoice.id);
    await page.getByRole("button", { name: "Load", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`mode=pay&id=${invoice.id}`));
    await expect(page.getByRole("main").getByText(/^25$/)).toBeVisible();
    await expect(page.getByRole("main").getByText("USDC", { exact: true })).toBeVisible();
  });

  test("receipt tab shows empty state without tx", async ({ page }) => {
    await page.goto("/wisp-pay?mode=receipt");
    await expect(page.getByText(/Paste an invoice ID or transaction hash/i)).toBeVisible();
  });

  test("receipt shows unpaid state for pending invoice id", async ({ page }) => {
    const invoice = sampleStoredInvoice("inv_e2e_unpaid");
    await page.goto("/wisp-pay");
    await page.evaluate(
      ({ key, value }) => {
        localStorage.setItem(key, JSON.stringify([value]));
      },
      { key: INVOICE_STORAGE_KEY, value: invoice },
    );

    await page.goto("/wisp-pay?mode=receipt&id=inv_e2e_unpaid");
    await expect(page.getByText("No receipt yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Go to Pay" })).toBeVisible();
  });

  test("receipt redirect preserves tx hash", async ({ page }) => {
    await page.goto("/receipt/abc123tx");
    await expect(page).toHaveURL(/\/wisp-pay\?mode=receipt&tx=abc123tx/);
  });

  test("unknown tx hash shows not found on receipt", async ({ page }) => {
    await page.route("**/soroban-testnet.stellar.org/**", async (route) => {
      const payload = route.request().postDataJSON() as { method?: string; id?: number };
      if (payload.method === "getTransaction") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: payload.id ?? 1,
            result: { status: "NOT_FOUND" },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(
      "/wisp-pay?mode=receipt&tx=e2e00000000000000000000000000000000000000000000000000000000000000",
    );
    await expect(page.getByText("Transaction not found")).toBeVisible();
  });

  test("wisp-pay page links to technical demo", async ({ page }) => {
    await page.goto("/wisp-pay");
    await expect(page.getByRole("link", { name: /Open technical demo/i })).toHaveAttribute(
      "href",
      "/demo",
    );
  });
});
