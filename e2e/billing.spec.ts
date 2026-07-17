import { test, expect } from "@playwright/test";

// Tenant Dashboard — /billing. Read-mostly (subscription status from /api/billing/status).
// Asserts authenticated load + heading render (legacy parity: page wired + reachable).

test.describe("/billing", () => {
  test("renders authenticated with a heading", async ({ page }) => {
    await page.goto("/billing");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
});
