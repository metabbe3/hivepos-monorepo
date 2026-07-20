import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiToken } from "./lib/token";

// Tenant Dashboard — /roles. PageHeader "Create Role" → RoleEditDialog (name-only required:
// "Nama Role"). qa-tenant has a seeded "Staff" role. Legacy parity: role name required.
const API = "http://localhost:8099/api";

async function tok(_request: APIRequestContext) {
  return apiToken();
}
async function cleanup(request: APIRequestContext) {
  const t = await tok(request);
  const list = await request.get(`${API}/roles`, { headers: { Authorization: `Bearer ${t}` } });
  const roles: any[] = (await list.json()).data ?? [];
  await Promise.all(
    roles.filter((r) => /^E2E/.test(r.name ?? "")).map((r) => request.delete(`${API}/roles/${r.id}`, { headers: { Authorization: `Bearer ${t}` } })),
  );
}

test.describe("/roles", () => {
  test.beforeEach(async ({ page, request }) => { await cleanup(request); await page.goto("/roles"); });
  test.afterEach(async ({ request }) => { await cleanup(request); });

  test("renders heading, Create Role, and the seeded Staff role", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: /roles/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create role/i }).first()).toBeVisible();
    await expect(page.getByText("Staff").first()).toBeVisible();
  });

  test("Insert: create a role (name required)", async ({ page }) => {
    await page.getByRole("button", { name: /create role/i }).first().click();
    const dialog = page.getByRole("dialog");
    const name = `E2E Role ${Date.now()}`;
    await dialog.getByLabel(/nama role/i).fill(name);
    await dialog.getByRole("button", { name: /buat role|simpan perubahan|save|simpan/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("Cancel closes the create dialog", async ({ page }) => {
    await page.getByRole("button", { name: /create role/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /cancel|batal/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("Edit: rename a role", async ({ page }) => {
    const name1 = `E2E RoleEdit ${Date.now()}`;
    await page.getByRole("button", { name: /create role/i }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/nama role/i).fill(name1);
    await dialog.getByRole("button", { name: /buat role/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name1).first()).toBeVisible();

    const name2 = `E2E RoleRenamed ${Date.now()}`;
    // scope to THIS role's card (the seeded Staff role's name field is disabled)
    const card = page.getByText(name1).first().locator("xpath=ancestor::*[.//button[@aria-label='Edit role']][1]");
    await card.getByRole("button", { name: /edit role/i }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/nama role/i).fill(name2);
    await dialog.getByRole("button", { name: /simpan perubahan/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name2).first()).toBeVisible();
  });

  test("Delete: remove a role via confirm dialog", async ({ page }) => {
    const name = `E2E RoleDel ${Date.now()}`;
    await page.getByRole("button", { name: /create role/i }).first().click();
    const create = page.getByRole("dialog");
    await create.getByLabel(/nama role/i).fill(name);
    await create.getByRole("button", { name: /buat role/i }).click();
    await expect(create).toBeHidden();
    await expect(page.getByText(name).first()).toBeVisible();

    // scope delete to THIS role's card (seeded Staff role delete is blocked)
    const card = page.getByText(name).first().locator("xpath=ancestor::*[.//button[@aria-label='Edit role']][1]");
    await card.getByRole("button", { name: /delete role|hapus role/i }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: /^delete$|^hapus$|delete role|hapus role|confirm|konfirmasi/i }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
