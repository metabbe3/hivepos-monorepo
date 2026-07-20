import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiToken } from "./lib/token";

// End-to-end order lifecycle — API contract layer + UI layer.
// API: create (satuan + kg + garment), discount variants (none/percentage/fixed),
//      payment (partial→paid), status flow (RECEIVED→IN_PROGRESS→READY→DELIVERED).
// UI:  drive /laundry/orders/new → success → /laundry/orders/[id] → pay → advance status.

const API = "http://localhost:8099/api";

let custId = "";
let satuanId = ""; // PER_ITEM, basePrice 5000
let kiloanId = ""; // PER_KG, basePrice 7000
const createdOrderIds: string[] = [];

async function authHeaders(request: APIRequestContext) {
  return { Authorization: `Bearer ${await apiToken()}`, "Content-Type": "application/json" };
}

async function createOrder(request: APIRequestContext, body: object) {
  const h = await authHeaders(request);
  const r = await request.post(`${API}/orders`, { headers: h, data: body });
  const json = await r.json();
  if (!json?.data?.id) throw new Error(`createOrder failed: ${r.status()} ${JSON.stringify(json)}`);
  createdOrderIds.push(json.data.id);
  return json.data;
}

async function getDetail(request: APIRequestContext, id: string) {
  const h = await authHeaders(request);
  const r = await request.get(`${API}/orders/${id}`, { headers: h });
  return (await r.json()).data;
}

test.beforeAll(async ({ request }) => {
  const h = await authHeaders(request);
  const s = Date.now();
  const cust = await (await request.post(`${API}/customers`, { headers: h, data: { name: `E2E FlowCust ${s}` } })).json();
  custId = cust.data.id;
  const sat = await (await request.post(`${API}/services`, { headers: h, data: { name: `E2E Satuan ${s}`, pricingType: "PER_ITEM", basePrice: 5000 } })).json();
  satuanId = sat.data.id;
  const kil = await (await request.post(`${API}/services`, { headers: h, data: { name: `E2E Kiloan ${s}`, pricingType: "PER_KG", basePrice: 7000 } })).json();
  kiloanId = kil.data.id;
});

test.afterAll(async ({ request }) => {
  const h = { Authorization: `Bearer ${await apiToken()}` };
  for (const id of createdOrderIds) await request.delete(`${API}/orders/${id}`, { headers: h }).catch(() => {});
  if (satuanId) await request.delete(`${API}/services/${satuanId}`, { headers: h }).catch(() => {});
  if (kiloanId) await request.delete(`${API}/services/${kiloanId}`, { headers: h }).catch(() => {});
  if (custId) await request.delete(`${API}/customers/${custId}`, { headers: h }).catch(() => {});
});

// ───────────────────────── API contract layer ─────────────────────────

test.describe("order lifecycle (API)", () => {
  test("satuan only, no discount", async ({ request }) => {
    const o = await createOrder(request, {
      customerId: custId,
      module: "laundry",
      items: [{ serviceId: satuanId, quantity: 2 }],
    });
    expect(o.totalAmount).toBe(10000);
    expect(o.discountAmount).toBe(0);
  });

  test("kg only + garment breakdown", async ({ request }) => {
    const o = await createOrder(request, {
      customerId: custId,
      module: "laundry",
      items: [{
        serviceId: kiloanId,
        quantity: 1,
        weightKg: 3,
        garmentBreakdown: [{ name: "Baju", qty: 3 }, { name: "Celana", qty: 2 }],
      }],
    });
    expect(o.totalAmount).toBe(21000); // 7000 * 3kg
    const d = await getDetail(request, o.id);
    const gb = d.orderItems?.[0]?.garmentBreakdown;
    expect(gb).toBeTruthy();
    expect(Array.isArray(gb) ? gb.length : JSON.parse(gb).length).toBe(2);
  });

  test("mixed satuan + kg, no discount", async ({ request }) => {
    const o = await createOrder(request, {
      customerId: custId,
      module: "laundry",
      items: [
        { serviceId: satuanId, quantity: 2 },
        { serviceId: kiloanId, quantity: 1, weightKg: 3 },
      ],
    });
    expect(o.totalAmount).toBe(31000);
  });

  test("percentage discount 10%", async ({ request }) => {
    const o = await createOrder(request, {
      customerId: custId,
      module: "laundry",
      discountType: "PERCENTAGE",
      discountAmount: 10,
      items: [
        { serviceId: satuanId, quantity: 2 },
        { serviceId: kiloanId, quantity: 1, weightKg: 3 },
      ],
    });
    expect(o.discountAmount).toBe(3100); // 10% of 31000
    expect(o.totalAmount).toBe(27900);
  });

  test("fixed discount 5000", async ({ request }) => {
    const o = await createOrder(request, {
      customerId: custId,
      module: "laundry",
      discountType: "FIXED",
      discountAmount: 5000,
      items: [
        { serviceId: satuanId, quantity: 2 },
        { serviceId: kiloanId, quantity: 1, weightKg: 3 },
      ],
    });
    expect(o.discountAmount).toBe(5000);
    expect(o.totalAmount).toBe(26000);
  });

  test("payment flow: partial → paid", async ({ request }) => {
    const h = await authHeaders(request);
    const o = await createOrder(request, {
      customerId: custId,
      module: "laundry",
      items: [{ serviceId: satuanId, quantity: 2 }], // total 10000
    });
    // recordPayment returns FindByID (no paidAmount col) → verify via GET detail (FindDetailByID).
    await request.post(`${API}/orders/${o.id}/payments`, { headers: h, data: { amount: 4000, paymentMethod: "CASH" } });
    const d1 = await getDetail(request, o.id);
    expect(d1.paidAmount).toBe(4000);
    expect(d1.paymentStatus).toBe("PARTIAL");
    await request.post(`${API}/orders/${o.id}/payments`, { headers: h, data: { amount: 6000, paymentMethod: "CASH" } });
    const d2 = await getDetail(request, o.id);
    expect(d2.paidAmount).toBe(10000);
    expect(d2.paymentStatus).toBe("PAID");
  });

  test("status flow RECEIVED→DELIVERED + illegal back-transition rejected", async ({ request }) => {
    const h = await authHeaders(request);
    const o = await createOrder(request, {
      customerId: custId,
      module: "laundry",
      items: [{ serviceId: satuanId, quantity: 1 }],
    });
    for (const status of ["IN_PROGRESS", "READY", "DELIVERED"]) {
      const r = await request.patch(`${API}/orders/${o.id}/status`, { headers: h, data: { status } });
      expect(r.status(), `→ ${status}`).toBe(200);
      const d = await getDetail(request, o.id);
      expect(d.status).toBe(status);
    }
    // illegal back-transition DELIVERED→RECEIVED must be rejected (400)
    const back = await request.patch(`${API}/orders/${o.id}/status`, { headers: h, data: { status: "RECEIVED" } });
    expect(back.status()).toBe(400);
  });
});

// ───────────────────────── UI layer ─────────────────────────

test.describe("order flow (UI)", () => {
  test("create mixed order + garment + discount → pay → advance status", async ({ page, request }) => {
    test.setTimeout(120000);
    const consoleErrors: string[] = [];
    const badApi: string[] = [];
    page.on("console", (m) => {
      // ignore generic "Failed to load resource" network 404s (tracked via badApi) — keep real JS errors.
      if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) consoleErrors.push(m.text());
    });
    page.on("response", (r) => {
      // /api/orders/{id}/photos is a not-yet-implemented Pro endpoint (always 404, non-fatal) — exclude.
      if (r.status() >= 400 && r.url().includes("/api/orders") && !r.url().includes("/photos")) badApi.push(`${r.status()} ${r.url()}`);
    });

    await page.goto("/laundry/orders/new");
    // dismiss draft recovery if present
    const startFresh = page.getByRole("button", { name: /start fresh/i });
    if (await startFresh.isVisible().catch(() => false)) await startFresh.click();

    // 1. customer — search the seeded FlowCust (name only → phone null, exercises the fix)
    await page.getByPlaceholder(/search by name or phone/i).fill("E2E FlowCust");
    await page.getByText(/E2E FlowCust/).first().click();

    // 2. add satuan service + set qty 2
    await page.getByText("E2E Satuan", { exact: false }).first().click();
    // 3. add kg service
    await page.getByText("E2E Kiloan", { exact: false }).first().click();

    // open garment editor on the kg row + add two garments
    const garmentBtn = page.getByRole("button", { name: /clothing details/i }).first();
    await garmentBtn.click();
    const garmentGrid = page.locator(".animate-in.fade-in-0.slide-in-from-bottom-2").first();
    await garmentGrid.getByRole("button").nth(0).click();
    await garmentGrid.getByRole("button").nth(1).click();
    await page.getByRole("button", { name: /hide details/i }).first().click();

    // 4. percentage discount 10
    await page.getByRole("button", { name: /^percentage$/i }).click();
    await page.getByPlaceholder("0").first().fill("10");

    // 5. submit (Pay Later → just create). Capture the orderId from the POST response
    // (deterministic) — the success screen's "View order" button should navigate to it.
    const createRespPromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/orders") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /create order|complete payment/i }).click();
    await expect(page.getByText(/order created/i)).toBeVisible({ timeout: 30000 });
    const orderId = ((await (await createRespPromise).json()).data.id) as string;
    expect(orderId).toBeTruthy();

    // 6. detail + pay (read the real total via API — don't hardcode, UI math varies with defaults)
    await page.getByRole("button", { name: /view order/i }).click();
    await expect(page).toHaveURL(new RegExp(`/laundry/orders/${orderId}$`));

    const detail = await getDetail(request, orderId);
    const total = detail.totalAmount as number;

    await page.getByRole("button", { name: /record payment/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/\d/).first().fill(String(total));
    await dialog.getByRole("button", { name: /record payment/i }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15000 });
    // verify PAID via API (authoritative; the page also shows a "Paid:" amount row that
    // would false-match a /paid/i text assert).
    await expect.poll(async () => (await getDetail(request, orderId)).paymentStatus, { timeout: 15000 }).toBe("PAID");

    // 7. advance status RECEIVED→IN_PROGRESS→READY→DELIVERED. Button text is
    // "Mark <NextStatus>". A post-payment toast can briefly overlay the button, so
    // force-click + verify each transition via API (the math is API-tested elsewhere).
    for (const want of ["IN_PROGRESS", "READY", "DELIVERED"]) {
      await page.waitForTimeout(300);
      const mark = page.getByRole("button", { name: /^mark/i }).first();
      await mark.click({ force: true });
      await expect.poll(async () => (await getDetail(request, orderId)).status, { timeout: 15000 }).toBe(want);
    }

    expect(consoleErrors, `console errors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(badApi, `bad /api/orders responses: ${JSON.stringify(badApi)}`).toEqual([]);
  });

  test("delete order from list dropdown (hapus pesanan)", async ({ page, request }) => {
    // Regression: the row dropdown called deleteOrder(order, {} as MouseEvent) and the
    // handler did e.preventDefault() unconditionally → TypeError → silent abort
    // ("nothing happened"). Verify the row-menu Delete now fires DELETE + removes the row.
    test.setTimeout(90000);
    const o = await createOrder(request, {
      customerId: custId,
      module: "laundry",
      items: [{ serviceId: satuanId, quantity: 1 }],
    });

    let deleted = false;
    page.on("response", (r) => {
      if (r.request().method() === "DELETE" && r.url().includes(`/api/orders/${o.id}`)) deleted = true;
    });
    // useConfirm falls back to native window.confirm (ConfirmProvider isn't mounted in the
    // app shell) → auto-accept the native dialog so DELETE fires.
    page.on("dialog", (d) => d.accept());

    await page.goto("/laundry/orders");
    await expect(page.getByText(o.orderNumber).first()).toBeVisible({ timeout: 15000 });

    // open THIS row's overflow menu (aria-label="More"), scoped via the orderNumber's row
    const row = page.getByText(o.orderNumber).first()
      .locator("xpath=ancestor::*[.//button[@aria-label='More']][1]");
    await row.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: /delete|hapus/i }).click();

    // native confirm auto-accepted → DELETE sent → row removed
    await expect(page.getByText(o.orderNumber)).toHaveCount(0, { timeout: 10000 });
    expect(deleted, "DELETE /api/orders/{id} was sent").toBe(true);
  });
});
