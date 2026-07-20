import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiToken } from "./lib/token";

// Tenant Dashboard — /laundry/pickup-requests. PageHeader action "Buat Pickup",
// search "Cari nama / telepon...", status tabs, card→detail dialog, create dialog.

const API = "http://localhost:8099/api";
let pickupName = "";
let pickupId = "";

async function cleanup(request: APIRequestContext) {
  const t = await apiToken();
  const h = { Authorization: `Bearer ${t}` };
  const list = await request.get(`${API}/pickup-requests`, { headers: h });
  const items: any[] = (await list.json()).data ?? [];
  await Promise.all(
    items.filter((p) => /^E2E/.test(p.customerName ?? "")).map((p) => request.delete(`${API}/pickup-requests/${p.id}`, { headers: h }).catch(() => {})),
  );
}

test.beforeAll(async ({ request }) => {
  await cleanup(request);
  const t = await apiToken();
  pickupName = `E2E Pickup ${Date.now()}`;
  const r = await request.post(`${API}/pickup-requests`, {
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    data: { customerName: pickupName },
  });
  pickupId = (await r.json()).data?.id ?? "";
});

test.afterAll(async ({ request }) => { await cleanup(request); });

test.describe("/laundry/pickup-requests", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/laundry/pickup-requests"); });

  test("renders heading + Buat Pickup + search", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /buat pickup/i })).toBeVisible();
    await expect(page.getByPlaceholder(/cari nama|telepon/i)).toBeVisible();
  });

  test("seeded pickup appears in the list", async ({ page }) => {
    await expect(page.getByText(pickupName).first()).toBeVisible({ timeout: 15000 });
  });

  test("search filters the list", async ({ page }) => {
    await expect(page.getByText(pickupName).first()).toBeVisible({ timeout: 15000 });
    const search = page.getByPlaceholder(/cari nama|telepon/i);
    await search.fill("ZZZ_NOPE_ZZZ");
    await expect(page.getByText(pickupName)).toHaveCount(0, { timeout: 10000 });
    await search.fill("");
    await expect(page.getByText(pickupName).first()).toBeVisible({ timeout: 10000 });
  });

  test("card click opens the detail dialog", async ({ page }) => {
    await expect(page.getByText(pickupName).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(pickupName).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("Buat Pickup opens the create dialog; cancel closes it", async ({ page }) => {
    await page.getByRole("button", { name: /buat pickup/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /cancel|batal|tutup|close/i }).first().click();
    await expect(dialog).toHaveCount(0);
  });
});
