import { test, expect, type APIRequestContext } from "@playwright/test";

// Tenant Dashboard — /customers. Locale defaults to "en" (UI labels),
// DynamicForm field labels are static Indonesian (Nama/Telepon/Email/Catatan),
// submit label static "Simpan Pelanggan". Web-first locators only.
// Legacy parity (pos-saas): name required ≥2 chars, phone optional regex, CRUD + search.

const API = "http://localhost:8099/api";

// Clean E2E-created customers between tests (qa-tenant shared DB).
async function cleanupCustomers(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: "qa@hivepos.local", password: "Pass1234!" },
  });
  const token = (await login.json()).data?.token;
  const list = await request.get(`${API}/customers`, { headers: { Authorization: `Bearer ${token}` } });
  const customers: any[] = (await list.json()).data ?? [];
  await Promise.all(
    customers
      .filter((c) => /^(E2E|Searchable|Should)/.test(c.name ?? ""))
      .map((c) => request.delete(`${API}/customers/${c.id}`, { headers: { Authorization: `Bearer ${token}` } })),
  );
}

test.describe("/customers CRUD", () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanupCustomers(request);
    // prod build (`next start`) — `next dev` shows a spurious reload loop in
    // Next 16 dev mode (hydration-error recovery) that is NOT present in prod.
    await page.goto("/customers");
  });

  test.afterEach(async ({ request }) => {
    await cleanupCustomers(request);
  });

  test("page renders with Add Customer button (auth + fetch healthy)", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
    await expect(page.getByRole("button", { name: /add customer/i }).first()).toBeVisible();
  });

  test("create: validation rejects empty name, then creates customer", async ({ page }) => {
    await page.getByRole("button", { name: /add customer/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // submit empty → required-field validation error (legacy: name mandatory)
    await page.getByRole("button", { name: /simpan pelanggan/i }).click();
    await expect(dialog.getByText(/nama is required|nama wajib diisi|nama minimal 2 karakter/i)).toBeVisible();
    // 1-char name → legacy "min 2 chars" rule
    await dialog.getByLabel(/nama/i).fill("x");
    await page.getByRole("button", { name: /simpan pelanggan/i }).click();
    await expect(dialog.getByText(/nama minimal 2 karakter/i)).toBeVisible();

    // fill valid
    const name = `E2E Cust ${Date.now()}`;
    await dialog.getByLabel(/nama/i).fill(name);
    await dialog.getByLabel(/telepon/i).fill("081234567890");
    await dialog.getByLabel(/email/i).fill(`e2e${Date.now()}@test.local`);
    await page.getByRole("button", { name: /simpan pelanggan/i }).click();

    // success → dialog closes (onSuccess) + new customer appears in list
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("cancel dismisses create dialog without saving", async ({ page }) => {
    await page.getByRole("button", { name: /add customer/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/nama/i).fill("Should Not Persist");
    await dialog.getByRole("button", { name: /cancel|batal/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Should Not Persist")).toHaveCount(0);
  });

  test("search filters the customer list", async ({ page }) => {
    // create a known customer first
    const name = `Searchable ${Date.now()}`;
    await page.getByRole("button", { name: /add customer/i }).first().click();
    await page.getByRole("dialog").getByLabel(/nama/i).fill(name);
    await page.getByRole("button", { name: /simpan pelanggan/i }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.getByPlaceholder(/search by name or phone/i).fill("ZZZ_NOPE_ZZZ");
    await expect(page.getByText(name)).toHaveCount(0);
    await page.getByPlaceholder(/search by name or phone/i).fill("");
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("edit: update a customer's name", async ({ page }) => {
    // seed one customer (cleanup leaves only this card → unambiguous edit button)
    const name1 = `E2E Orig ${Date.now()}`;
    await page.getByRole("button", { name: /add customer/i }).first().click();
    await page.getByRole("dialog").getByLabel(/nama/i).fill(name1);
    await page.getByRole("button", { name: /simpan pelanggan/i }).click();
    await expect(page.getByText(name1).first()).toBeVisible();

    const name2 = `E2E Renamed ${Date.now()}`;
    await page.getByRole("button", { name: "Edit Customer" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/nama/i).fill(name2);
    await page.getByRole("button", { name: /simpan pelanggan/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name2).first()).toBeVisible();
    await expect(page.getByText(name1)).toHaveCount(0);
  });

  test("delete: remove a customer via confirm dialog", async ({ page }) => {
    const name = `E2E Del ${Date.now()}`;
    await page.getByRole("button", { name: /add customer/i }).first().click();
    await page.getByRole("dialog").getByLabel(/nama/i).fill(name);
    await page.getByRole("button", { name: /simpan pelanggan/i }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.getByRole("button", { name: "Delete Customer" }).first().click();
    // confirm dialog (scoped — card also has a "Delete Customer" button)
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: "Delete Customer" }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
