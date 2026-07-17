import { test, expect, type APIRequestContext } from "@playwright/test";

// Tenant Dashboard — /laundry/orders. Seeds a real order (customer + service + order) via API,
// then asserts the table columns populate from hivepos-api: orderNumber, customerName, status,
// totalAmount, paymentStatus (legacy parity). Card/row layout — assert field text.

const API = "http://localhost:8099/api";

async function tok(request: APIRequestContext) {
  return (await (await request.post(`${API}/auth/login`, { data: { email: "qa@hivepos.local", password: "Pass1234!" } })).json()).data.token;
}

let orderNumber = "";
let orderId = "";
let custId = "";
let custName = "";
let svcId = "";

test.beforeAll(async ({ request }) => {
  const t = await tok(request);
  const h = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
  const s = Date.now();
  custName = `E2E OrdCust ${s}`;
  custId = (await (await request.post(`${API}/customers`, { headers: h, data: { name: custName } })).json()).data?.id;
  svcId = (await (await request.post(`${API}/services`, { headers: h, data: { name: `E2E OrdSvc ${s}`, pricingType: "PER_ITEM", basePrice: 5000 } })).json()).data?.id;
  const ord = (await (await request.post(`${API}/orders`, { headers: h, data: { customerId: custId, items: [{ serviceId: svcId, quantity: 2 }], module: "laundry" } })).json()).data;
  orderId = ord?.id;
  orderNumber = ord?.orderNumber ?? "";
  if (!orderNumber) throw new Error(`[orders] seed failed: cust=${custId} svc=${svcId} ord=${JSON.stringify(ord)}`);
});

test.afterAll(async ({ request }) => {
  const t = await tok(request);
  const h = { Authorization: `Bearer ${t}` };
  if (orderId) await request.delete(`${API}/orders/${orderId}`, { headers: h });
  if (custId) await request.delete(`${API}/customers/${custId}`, { headers: h });
  if (svcId) await request.delete(`${API}/services/${svcId}`, { headers: h });
});

test.describe("/laundry/orders", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/laundry/orders"); });

  test("renders Orders heading + New Order + search", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: /orders/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /new order/i }).or(page.getByRole("button", { name: /new order/i })).first()).toBeVisible();
    await expect(page.getByPlaceholder(/search orders/i)).toBeVisible();
  });

  test("table columns populate from API for seeded order", async ({ page }) => {
    // all 5 legacy columns asserted from real hivepos-api data
    await expect(page.getByText(orderNumber).first()).toBeVisible({ timeout: 15000 });     // orderNumber
    await expect(page.getByText(custName).first()).toBeVisible();                          // customerName
    await expect(page.getByText(/received/i).first()).toBeVisible();                       // status badge
    await expect(page.getByText(/10[.,]000/).first()).toBeVisible();                       // totalAmount
    await expect(page.getByRole("button", { name: /record payment|catat pembayaran/i }).first()).toBeVisible(); // payment (Pay action, unpaid)
  });

  test("New Order navigates to the create page", async ({ page }) => {
    await page.getByRole("link", { name: /new order/i }).or(page.getByRole("button", { name: /new order/i })).first().click();
    await expect(page).toHaveURL(/\/laundry\/orders\/new/);
  });
});
