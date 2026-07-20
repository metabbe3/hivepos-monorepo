import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { apiToken } from "./lib/token";

// Tenant Dashboard — /users (staff). Form: Nama, Email(req), Telepon, Role(select req),
// Outlet(select req), Password(req on create, ≥8). Fixes applied: SelectItem role=option,
// options via apiFetch (authed), edit/delete aria-labels, transform sends role:EMPLOYEE.
// Legacy parity (pos-saas): email req w/ @, password ≥8, role+branch required.

const API = "http://localhost:8099/api";

async function tok(_request: APIRequestContext): Promise<string> {
  return apiToken();
}
async function seedUser(request: APIRequestContext, name: string, email: string): Promise<string> {
  const t = await tok(request);
  const r = await request.post(`${API}/users`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { name, email, role: "EMPLOYEE", roleId: "qa-role-staff", branchId: "qa-branch-1", password: "Pass1234!" },
  });
  return (await r.json()).data?.id;
}
async function cleanup(request: APIRequestContext) {
  const t = await tok(request);
  const list = await request.get(`${API}/users`, { headers: { Authorization: `Bearer ${t}` } });
  const users: any[] = (await list.json()).data ?? [];
  await Promise.all(
    users.filter((u) => /^E2E/.test(u.name ?? "")).map((u) => request.delete(`${API}/users/${u.id}`, { headers: { Authorization: `Bearer ${t}` } })),
  );
}
async function pickSelect(page: Page, dialog: import("@playwright/test").Locator, label: RegExp, option: string) {
  await dialog.getByLabel(label).click();
  await page.getByRole("option", { name: option }).click();
}

test.describe("/users CRUD", () => {
  test.beforeEach(async ({ page, request }) => { await cleanup(request); await page.goto("/users"); });
  test.afterEach(async ({ request }) => { await cleanup(request); });

  test("renders Users heading + Add User", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: /^users/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add user|add staff/i }).first()).toBeVisible();
  });

  test("Insert: create staff with role + outlet selects", async ({ page }) => {
    await page.getByRole("button", { name: /add user|add staff/i }).first().click();
    const dialog = page.getByRole("dialog");
    const stamp = Date.now();
    await dialog.getByLabel(/nama/i).fill(`E2E User ${stamp}`);
    await dialog.getByLabel(/email/i).fill(`e2e${stamp}@test.local`);
    await dialog.getByLabel(/telepon/i).fill("08123456789");
    await pickSelect(page, dialog, /role/i, "Staff");
    await pickSelect(page, dialog, /outlet/i, "Main");
    await dialog.getByLabel(/^password$/i).fill("Pass1234!");
    await page.getByRole("button", { name: /simpan staff/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(`E2E User ${stamp}`).first()).toBeVisible();
  });

  test("validation: required + password ≥8", async ({ page }) => {
    await page.getByRole("button", { name: /add user|add staff/i }).first().click();
    const dialog = page.getByRole("dialog");
    await page.getByRole("button", { name: /simpan staff/i }).click();
    await expect(dialog.getByText(/is required|wajib/i).first()).toBeVisible();
    await dialog.getByLabel(/nama/i).fill("E2E User");
    await dialog.getByLabel(/email/i).fill(`e2e-${Date.now()}@test.local`);
    await dialog.getByLabel(/^password$/i).fill("123");
    await page.getByRole("button", { name: /simpan staff/i }).click();
    await expect(dialog.getByText(/kata sandi minimal 8 karakter|password.*8/i)).toBeVisible();
  });

  test("Cancel dismisses create dialog without saving", async ({ page }) => {
    await page.getByRole("button", { name: /add user|add staff/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/nama/i).fill("E2E Should Vanish");
    await dialog.getByRole("button", { name: /cancel|batal/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("E2E Should Vanish")).toHaveCount(0);
  });

  test("Edit: rename a staff member", async ({ page, request }) => {
    const stamp = Date.now();
    const name1 = `E2E Orig ${stamp}`;
    await seedUser(request, name1, `e2eorig${stamp}@test.local`);
    await page.reload();
    await expect(page.getByText(name1).first()).toBeVisible();
    // scope the edit button to THIS user's card (no data-testid → name→ancestor)
    const card = page.getByText(name1).first().locator("xpath=ancestor::*[.//button[@aria-label='Edit']][1]");
    const name2 = `E2E New ${stamp}`;
    await card.getByRole("button", { name: /^edit$/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/nama/i).fill(name2);
    await page.getByRole("button", { name: /simpan staff/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name2).first()).toBeVisible();
  });

  test("Delete: remove a staff member", async ({ page, request }) => {
    const stamp = Date.now();
    await seedUser(request, `E2E Del ${stamp}`, `e2edel${stamp}@test.local`);
    await page.reload();
    await expect(page.getByText(`E2E Del ${stamp}`).first()).toBeVisible();
    page.on("dialog", (d) => d.accept()); // confirmAndDelete uses window.confirm
    await page.getByRole("button", { name: /^delete$/i }).first().click();
    await expect(page.getByText(`E2E Del ${stamp}`)).toHaveCount(0);
  });
});
