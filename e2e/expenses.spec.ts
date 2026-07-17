import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// Tenant Dashboard — /laundry/expenses. Form: Jumlah(amount,req>0), Kategori(select req),
// Tanggal(date, default today), Catatan. Category select loads via apiFetch (fix #6).
// Legacy parity (pos-saas): amount>0, category req, date req.

const API = "http://localhost:8099/api";
const CAT = "E2E Cat";

async function tok(request: APIRequestContext): Promise<string> {
  return (await (await request.post(`${API}/auth/login`, { data: { email: "qa@hivepos.local", password: "Pass1234!" } })).json()).data.token;
}
async function ensureCategory(request: APIRequestContext) {
  const t = await tok(request);
  const list = await request.get(`${API}/expense-categories`, { headers: { Authorization: `Bearer ${t}` } });
  const cats: any[] = (await list.json()).data ?? [];
  if (!cats.some((c) => c.name === CAT)) {
    await request.post(`${API}/expense-categories`, { headers: { Authorization: `Bearer ${t}` }, data: { name: CAT } });
  }
}
async function cleanup(request: APIRequestContext) {
  const t = await tok(request);
  const list = await request.get(`${API}/expenses`, { headers: { Authorization: `Bearer ${t}` } });
  const items: any[] = (await list.json()).data ?? [];
  await Promise.all(
    items.filter((e) => /E2E/.test(e.description ?? "")).map((e) => request.delete(`${API}/expenses/${e.id}`, { headers: { Authorization: `Bearer ${t}` } })),
  );
}
async function pickSelect(page: Page, dialog: import("@playwright/test").Locator, label: RegExp, option: string) {
  await dialog.getByLabel(label).click();
  await page.getByRole("option", { name: option }).click();
}

test.describe("/laundry/expenses CRUD", () => {
  test.beforeEach(async ({ page, request }) => {
    await ensureCategory(request);
    await cleanup(request);
    await page.goto("/laundry/expenses");
  });
  test.afterEach(async ({ request }) => { await cleanup(request); });

  test("renders Expenses heading + Add Expense", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: /expense/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add expense/i }).first()).toBeVisible();
  });

  test("validation: amount>0 + category required (category uses custom CategoryField)", async ({ page }) => {
    await page.getByRole("button", { name: /add expense/i }).first().click();
    const dialog = page.getByRole("dialog");
    // empty → required; 0 → must be > 0
    await page.getByRole("button", { name: /simpan pengeluaran/i }).click();
    await expect(dialog.getByText(/is required|wajib|harus lebih dari 0/i).first()).toBeVisible();
    await dialog.getByLabel(/jumlah|amount/i).fill("0");
    await page.getByRole("button", { name: /simpan pengeluaran/i }).click();
    await expect(dialog.getByText(/harus lebih dari 0/i)).toBeVisible();
    // NOTE: full Insert needs driving the custom CategoryField (Popover, not base-ui Select);
    // amount/date/notes inputs + validation covered here.
  });

  test("Cancel dismisses create dialog without saving", async ({ page }) => {
    await page.getByRole("button", { name: /add expense/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/jumlah|amount/i).fill("9999");
    await dialog.getByRole("button", { name: /cancel|batal/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("Insert: create expense with category (custom CategoryField select)", async ({ page }) => {
    await page.getByRole("button", { name: /add expense/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/jumlah|amount/i).fill("15000");
    // CategoryField renders a base-ui Select (combobox has no aria-name → it's the only one)
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: CAT }).click();
    await dialog.getByLabel(/catatan|notes/i).fill("E2E created");
    await page.getByRole("button", { name: /simpan pengeluaran/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("E2E created").first()).toBeVisible();
  });
});
