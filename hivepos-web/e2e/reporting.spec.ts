import { test, expect } from "@playwright/test";

// Tenant Dashboard — /reporting (laporan). All tabs must mount + fetch their report
// without a console error or a 4xx/5xx on /api. Tabs are role="tab" (locale-agnostic —
// iterate by position, not label). 10 tabs always; +Attendance when staffAttendance is on.
// One test = one cold compile in next dev (splitting per-tab recompiles + flakes).

test.describe("/reporting — all laporan tabs", () => {
  test("every tab mounts, fetches cleanly, Export bar shows only on range tabs", async ({ page }) => {
    test.setTimeout(90000);
    // warm hydration on a cheap route first; reporting's permission guard returns
    // shouldRender=false until permissions hydrate, and a cold first-nav stalls.
    await page.goto("/dashboard");
    await page.goto("/reporting");
    await expect(page.getByRole("tab").first()).toBeVisible({ timeout: 30000 });

    const consoleErrors: string[] = [];
    const badApi: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().includes("/api/")) badApi.push(`${r.status()} ${r.url()}`);
    });

    // tab order from reporting/page.tsx; piutang(8) + monthlyPnl(9) ignore the from/to
    // range → Export All bar hidden there. attendance(10) only when the flag is on.
    const tabs = page.getByRole("tab");
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(10);

    // Phase 1: every tab mounts + its report fetches without a console error / 4xx-5xx.
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    expect(consoleErrors, `console errors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(badApi, `bad /api responses: ${JSON.stringify(badApi)}`).toEqual([]);

    // Phase 2: Export All bar visibility — present on a range tab, hidden on piutang.
    await tabs.nth(0).click(); // revenue (range-based)
    await expect(page.getByRole("button", { name: /export all|ekspor semua/i })).toBeVisible();
    await tabs.nth(8).click(); // piutang (ignores range)
    await expect(page.getByRole("button", { name: /export all|ekspor semua/i })).toHaveCount(0);
  });
});
