import { test, expect, type APIRequestContext } from "@playwright/test";

// Tenant Dashboard — /laundry/services. Selects have defaults (PER_KG / NONE / no group),
// so a basic create needs only Name + Price. Locale "en": submit "Save".
// Legacy parity (pos-saas): name req, price > 0, pricingType PER_KG|PER_ITEM.

const API = "http://localhost:8099/api";

async function tok(request: APIRequestContext): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email: "qa@hivepos.local", password: "Pass1234!" } })).json()).data.token;
}
async function cleanup(request: APIRequestContext) {
  const t = await tok(request);
  const list = await request.get(`${API}/services?includeInactive=true`, { headers: { Authorization: `Bearer ${t}` } });
  const items: any[] = (await list.json()).data ?? [];
  await Promise.all(
    items.filter((s) => /^E2E/.test(s.name ?? "")).map((s) => request.delete(`${API}/services/${s.id}`, { headers: { Authorization: `Bearer ${t}` } })),
  );
}

test.describe("/laundry/services CRUD", () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanup(request);
    await page.goto("/laundry/services");
  });
  test.afterEach(async ({ request }) => { await cleanup(request); });

  test("renders Services heading + Add Service", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: /services/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add service/i }).first()).toBeVisible();
  });

  test("create: name/price validation, then create service", async ({ page }) => {
    await page.getByRole("button", { name: /add service/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // empty submit → name + price required validation
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog.getByText(/nama wajib diisi|name is required/i)).toBeVisible();

    const name = `E2E Svc ${Date.now()}`;
    await dialog.getByLabel(/name/i).fill(name);
    await dialog.getByLabel(/price|harga/i).fill("5000");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("cancel dismisses create dialog without saving", async ({ page }) => {
    await page.getByRole("button", { name: /add service/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/name/i).fill("E2E Should Vanish");
    await dialog.getByRole("button", { name: /cancel|batal/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("E2E Should Vanish")).toHaveCount(0);
  });

  test("Edit: rename a service", async ({ page }) => {
    const name1 = `E2E SvcEdit ${Date.now()}`;
    await page.getByRole("button", { name: /add service/i }).first().click();
    await page.getByRole("dialog").getByLabel(/name/i).fill(name1);
    await page.getByLabel(/price|harga/i).fill("5000");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(name1).first()).toBeVisible();

    const name2 = `E2E SvcRenamed ${Date.now()}`;
    await page.getByText(name1).first().click(); // expand the service group to reveal actions
    await page.getByRole("button", { name: /^edit$/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/name/i).fill(name2);
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name2).first()).toBeVisible();
  });

  test("Delete (deactivate): toggle a service inactive", async ({ page }) => {
    const name = `E2E SvcDel ${Date.now()}`;
    await page.getByRole("button", { name: /add service/i }).first().click();
    await page.getByRole("dialog").getByLabel(/name/i).fill(name);
    await page.getByLabel(/price|harga/i).fill("5000");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(name).first()).toBeVisible();
    await page.getByText(name).first().click(); // expand the service group to reveal actions
    // deactivate (Trash icon button) → service removed from active list
    await page.getByRole("button", { name: /deactivate|nonaktifkan/i }).first().click();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
