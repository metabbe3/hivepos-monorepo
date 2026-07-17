import { test, expect } from "@playwright/test";

// Breadth: assert every remaining Tenant Dashboard route loads authenticated (no /login
// redirect) and renders an h1. Legacy parity = page wired + reachable from hivepos-api.

const ROUTES = [
  "/roles",
  "/billing",
  "/laundry/inventory",
  "/laundry/pickup-requests",
  "/attendance/clock",
  "/attendance/manage",
  "/tickets",
  "/profile",
  "/printer-settings",
  "/reporting",
  "/website",
  "/whatsapp-templates",
];

test.describe("dashboard routes render authenticated", () => {
  for (const path of ROUTES) {
    test(`${path} loads + renders h1`, async ({ page }) => {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20000 });
    });
  }
});
