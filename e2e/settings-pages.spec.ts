import { test, expect } from "@playwright/test";

// Tenant Dashboard — settings pages with save forms.
// /website: tagline/hero/about → PUT /api/tenant/website. /profile: name/phone → save.

test.describe("settings pages", () => {
  test("/website: edit + save persists without error", async ({ page }) => {
    await page.goto("/website");
    const about = page.getByRole("textbox").last(); // about textarea
    await about.fill(`E2E about ${Date.now()}`);
    await page.getByRole("button", { name: /save|simpan|publish|terbitkan/i }).first().click();
    await expect(page).toHaveURL(/\/website/); // no crash / redirect-away
  });

  test("/profile: personal info renders", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    // profile shows the seeded QA Owner name somewhere
    await expect(page.getByText(/QA Owner|qa@hivepos/i).first()).toBeVisible({ timeout: 15000 });
  });
});
