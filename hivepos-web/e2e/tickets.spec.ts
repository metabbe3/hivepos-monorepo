import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// Tenant Dashboard — /tickets/new. DynamicForm: Subject(req), Category(select req),
// Priority(select req), Description. Legacy parity: subject/category/priority required.
const API = "http://localhost:8099/api";

async function tok(request: APIRequestContext) {
  return (await (await request.post(`${API}/auth/login`, { data: { email: "qa@hivepos.local", password: "Pass1234!" } })).json()).data.token;
}
async function cleanup(request: APIRequestContext) {
  const t = await tok(request);
  const list = await request.get(`${API}/tickets`, { headers: { Authorization: `Bearer ${t}` } });
  const items: any[] = (await list.json()).data ?? [];
  await Promise.all(
    items.filter((x: any) => /^E2E/.test(x.subject ?? "")).map((x) => request.delete(`${API}/tickets/${x.id}`, { headers: { Authorization: `Bearer ${t}` } }).catch(() => {})),
  );
}
async function pick(page: Page, dialog: import("@playwright/test").Locator, label: RegExp, option: string) {
  await dialog.getByLabel(label).click();
  await page.getByRole("option", { name: option }).click();
}

test.describe("/tickets/new", () => {
  test.beforeEach(async ({ page, request }) => { await cleanup(request); await page.goto("/tickets/new"); });
  test.afterEach(async ({ request }) => { await cleanup(request); });

  test("Insert: create a support ticket", async ({ page }) => {
    await page.getByLabel(/subject/i).fill(`E2E Ticket ${Date.now()}`);
    await pick(page, page.locator("body"), /category/i, "Technical");
    await pick(page, page.locator("body"), /priority/i, "Low");
    await page.getByLabel(/description/i).fill("E2E test ticket description");
    await page.getByRole("button", { name: /submit ticket/i }).click();
    // success → navigate away from the create page
    await expect(page).not.toHaveURL(/\/tickets\/new$/, { timeout: 15000 });
  });

  test("validation: required fields enforced", async ({ page }) => {
    await page.getByRole("button", { name: /submit ticket/i }).click();
    await expect(page.getByText(/is required|wajib/i).first()).toBeVisible();
  });
});
