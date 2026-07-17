import { test, expect, type APIRequestContext } from "@playwright/test";

// Tenant Dashboard — /branches. Locale "en": labels Name/Address/Phone/"Invoice Footer / T&C",
// submit "Save", static validation "Nama wajib diisi", success "Branch berhasil disimpan".
// Legacy parity (pos-saas): name required; add/edit. qa-tenant ships with a "Main" branch.

const API = "http://localhost:8099/api";

async function token(request: APIRequestContext): Promise<string> {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: "qa@hivepos.local", password: "Pass1234!" },
  });
  return (await r.json()).data.token;
}

async function cleanupBranches(request: APIRequestContext) {
  const tok = await token(request);
  const list = await request.get(`${API}/branches`, { headers: { Authorization: `Bearer ${tok}` } });
  const branches: any[] = (await list.json()).data ?? [];
  await Promise.all(
    branches
      .filter((b) => /^E2E/.test(b.name ?? ""))
      .map((b) => request.delete(`${API}/branches/${b.id}`, { headers: { Authorization: `Bearer ${tok}` } })),
  );
}

test.describe("/branches CRUD", () => {
  test.beforeEach(async ({ page, request }) => {
    await cleanupBranches(request);
    await page.goto("/branches");
  });
  test.afterEach(async ({ request }) => {
    await cleanupBranches(request);
  });

  test("renders heading, Add Branch, and the seeded Main branch", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Branches" })).toBeVisible();
    await expect(page.getByRole("button", { name: /add branch/i }).first()).toBeVisible();
    await expect(page.getByText("Main").first()).toBeVisible();
  });

  test("create: empty-name validation, then create branch", async ({ page }) => {
    await page.getByRole("button", { name: /add branch/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // empty submit → required validation (legacy: name mandatory)
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog.getByText(/nama wajib diisi|name is required/i)).toBeVisible();

    const name = `E2E Branch ${Date.now()}`;
    await dialog.getByLabel(/name/i).fill(name);
    await dialog.getByLabel(/address/i).fill("Jl. Test 123");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("cancel dismisses create dialog without saving", async ({ page }) => {
    await page.getByRole("button", { name: /add branch/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/name/i).fill("E2E Should Vanish");
    await dialog.getByRole("button", { name: /cancel|batal/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("E2E Should Vanish")).toHaveCount(0);
  });

  test("Delete: not exposed by design (branches are non-deletable)", async ({ page }) => {
    // legacy parity: the branches page exposes only Edit (no Delete) — assert no delete control.
    await expect(page.getByRole("button", { name: /delete branch|hapus cabang|delete/i })).toHaveCount(0);
  });

  test("edit: rename a branch", async ({ page }) => {
    // seed one E2E branch (cleanup leaves only it → unambiguous edit button)
    const name1 = `E2E BrOrig ${Date.now()}`;
    await page.getByRole("button", { name: /add branch/i }).first().click();
    await page.getByRole("dialog").getByLabel(/name/i).fill(name1);
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(name1).first()).toBeVisible();

    const name2 = `E2E BrNew ${Date.now()}`;
    await page.getByRole("button", { name: "Edit Branch" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/name/i).fill(name2);
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name2).first()).toBeVisible();
    await expect(page.getByText(name1)).toHaveCount(0);
  });
});
