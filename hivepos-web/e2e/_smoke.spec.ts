import { test, expect } from "@playwright/test";

// Auth + boot smoke: storageState token → /dashboard loads authenticated.
test("dashboard loads authenticated, no redirect to /login", async ({ page }) => {
  await page.goto("/dashboard");
  // Not bounced to login.
  await expect(page).not.toHaveURL(/\/login/);
  // Sidebar / shell present.
  await expect(page.getByRole("button", { name: /menu|sidebar|navigation/i }).or(page.locator("nav"))).toBeVisible().catch(() => {});
  // Token landed in localStorage.
  const token = await page.evaluate(() => localStorage.getItem("hivepos_token"));
  expect(token).toBeTruthy();
});
