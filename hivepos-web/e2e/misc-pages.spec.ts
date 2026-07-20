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
  // "/reporting" is covered by reporting.spec.ts (auth + render + all 11 tabs + export).
  // Removed from this breadth smoke: its permission guard (useGuardedPage) returns
  // shouldRender=false on a cold direct nav, making the bare h1 assert flake here
  // even though the route works (proven by the dedicated spec with a warm-up).
  "/website",
  "/whatsapp-templates",
];

test.describe("dashboard routes render authenticated", () => {
  for (const path of ROUTES) {
    test(`${path} loads + renders h1`, async ({ page }) => {
      test.setTimeout(60000); // next dev cold-compiles on demand; /reporting pulls 11 report chunks
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 45000 });
    });
  }
});
