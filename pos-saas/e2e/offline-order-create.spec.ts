import { test, expect, type Page } from '@playwright/test';

// ─── HELPERS ───────────────────────────────────────────────
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'owner@demo.com');
  await page.fill('input[type="password"]', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

// Read all pendingOrders rows from the browser's IndexedDB. Runs raw IDB
// API inside page.evaluate — simulates what DevTools sees.
async function idbReadPendingOrders(page: Page): Promise<any[]> {
  return await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('hivepos-offline');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction('pendingOrders', 'readonly');
      const r = tx.objectStore('pendingOrders').getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  });
}

// ponytail: happy-path test covers the highest-risk surface (IDB write →
// PENDING toast → redirect → reconnect drain). Concurrency + phone-dedup
// matrix is already covered by unit tests in lib/offline/offline.test.ts.

test.describe('Offline Order Create', () => {
  test('kasir creates order offline → syncs on reconnect', async ({ page, context }) => {
    await login(page);
    await page.goto('/laundry/orders/new');
    await expect(page.getByText(/Tambah|Add Service|Layanan/i).first()).toBeVisible({ timeout: 10000 });

    // Go offline BEFORE submitting. navigator.onLine flips, the offline
    // banner mounts, and the submit handler branches into createOrderOffline.
    await context.setOffline(true);

    // Banner appears (match by text, not role — more specific)
    await expect(page.getByText(/Anda offline|You're offline/i)).toBeVisible({ timeout: 5000 });

    // Walk-in customer via the "+ Baru" button
    await page.getByRole('button', { name: /\+ Baru/i }).click();
    const dialog = page.getByRole('dialog');
    const suffix = Date.now().toString().slice(-6);
    await dialog.getByPlaceholder(/Customer name|Nama pelanggan/i).fill(`E2E Offline ${suffix}`);
    await dialog.getByPlaceholder(/Phone number|Nomor telepon/i).fill(`0812${suffix}`);
    await dialog.getByRole('button', { name: /Buat & Pilih|Create & Select/i }).click();

    // Wait for the offline-customer toast — confirms handler completed +
    // setCustModalOpen(false) fired. Then the dialog unmounts.
    await expect(page.getByText(/Disimpan offline|Saved offline/i)).toBeVisible({ timeout: 5000 });
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Pick the first service card
    const servicesGrid = page.locator('[class*="grid"]').filter({ hasText: /Rp/ }).first();
    await servicesGrid.locator('button').first().click();

    // Submit — button text flips to completePayment once customer selected
    await page.getByRole('button', { name: /Selesaikan Pembayaran|Complete Payment|Buat Pesanan|Create Order/i }).click();

    // ponytail: the handleSubmit offline branch writes to IDB, then calls
    // router.push('/laundry/orders') which fails offline (Chrome shows its
    // dino game, unmounting the sync manager). Give the IDB write a moment
    // to land, reconnect, then manually re-mount the dashboard route so the
    // sync manager can drain. This tests the full flow without depending on
    // the offline-blocked navigation.
    await page.waitForTimeout(800);

    // Reconnect — navigation may have landed on the dino game, so navigate
    // back to a dashboard route to re-mount the OfflineSyncManager.
    await context.setOffline(false);
    await page.goto('/laundry/orders');
    await expect(page.getByRole('heading', { name: /Pesanan|Orders/i }).first()).toBeVisible({ timeout: 10000 });

    // The 'online' event fires on the new page load → OfflineSyncManager
    // calls drainOutbox. Poll for "synced".
    await expect.poll(
      async () => {
        const rows = await idbReadPendingOrders(page);
        return rows.length > 0 ? rows[0].status : null;
      },
      { timeout: 15000, message: 'offline order should drain to synced' },
    ).toBe('synced');
  });

  test('offline banner appears/disappears with connectivity', async ({ page, context }) => {
    await login(page);
    await page.goto('/laundry/orders');

    // Fresh context → no IDB rows → banner text not present
    await expect(page.getByText(/Anda offline|You're offline/i)).toBeHidden({ timeout: 5000 });

    // Flipping offline mounts the banner immediately
    await context.setOffline(true);
    await expect(page.getByText(/Anda offline|You're offline/i)).toBeVisible({ timeout: 10000 });

    // Back online hides it again
    await context.setOffline(false);
    await expect(page.getByText(/Anda offline|You're offline/i)).toBeHidden({ timeout: 10000 });
  });

  // ponytail: anti-tamper guard test. A kasir (or anyone with DevTools) can
  // edit the IndexedDB row before sync fires. The server must reject at the
  // trust boundary. We write a pendingOrders row DIRECTLY to IDB (bypassing
  // the UI) with a tampered discount — this is exactly what a DevTools
  // attacker does. Server-side guard in create-order.service.ts must reject.
  //
  // Going through the UI form for setup, then mutating post-redirect, races
  // with the Next.js dev-mode hot-reload of /laundry/orders and destroys the
  // JS execution context mid-evaluate. Direct IDB write sidesteps that
  // entirely and tests the actual security boundary cleanly.
  test('tampered IDB payload (discount > 100%) is rejected by server', async ({ page, context }) => {
    await login(page);

    // Mount the dashboard layout so the OfflineSyncManager is alive.
    await page.goto('/laundry/orders');
    await expect(page.getByRole('heading', { name: /Pesanan|Orders/i }).first()).toBeVisible({ timeout: 10000 });

    // Fetch a real customer + service from this tenant. The tampered payload
    // must pass the customer-belongs-to-branch guard so it actually reaches
    // the discount guard (otherwise we'd be testing the wrong layer).
    const customerId = await page.evaluate(async () => {
      const res = await fetch('/api/customers?limit=1');
      const json = await res.json();
      return json.data?.[0]?.id;
    });
    if (!customerId) throw new Error('no customer in demo tenant — seed the DB');
    const serviceId = await page.evaluate(async () => {
      const res = await fetch('/api/services?limit=1');
      const json = await res.json();
      const active = (json.data as any[]).find((s) => s.isActive);
      return active?.id;
    });
    if (!serviceId) throw new Error('no active service in demo tenant');

    // Go offline. The sync manager stays mounted (layout), banner appears.
    await context.setOffline(true);
    await expect(page.getByText(/Anda offline|You're offline/i)).toBeVisible({ timeout: 5000 });

    // ── Tamper: write a pendingOrders row with discount=200% ──
    // This is what an attacker with DevTools does. Row shape matches what
    // lib/offline/offline-order-create.ts writes so the sync engine can
    // drain it normally.
    const tamperedClientId = `e2e-tamper-${Date.now()}`;
    await page.evaluate(async (args) => {
      const { clientId, customerId, serviceId } = args;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('hivepos-offline');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('pendingOrders', 'readwrite');
      const store = tx.objectStore('pendingOrders');
      store.put({
        clientId,
        status: 'pending',
        customerId,
        payload: {
          items: [{ serviceId, quantity: 1 }],
          discountType: 'PERCENTAGE',
          discountAmount: 200, // ← invalid: > 100
        },
        pricedItems: [{ serviceName: 'E2E Tamper', quantity: 1, weightKg: null, pricePerUnit: 10000, subtotal: 10000 }],
        totalAmount: 0,
        discountAmount: 200,
        branchId: 'pending',
        module: 'LAUNDRY',
        createdAt: new Date().toISOString(),
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }, { clientId: tamperedClientId, customerId, serviceId });

    // Reconnect — sync engine picks up the tampered row + POSTs it. Server
    // should bounce it with a 4xx (ForbiddenError from the discount guard),
    // postWithRetry skips retry on 4xx, row parks as status:"error".
    await context.setOffline(false);

    await expect.poll(
      async () => {
        const rows = await idbReadPendingOrders(page);
        const errored = rows.filter((r) => r.status === 'error');
        return errored.length > 0 ? errored[0].lastError : null;
      },
      { timeout: 15000, message: 'tampered row should land in error state' },
    ).toMatch(/discount|Percentage|100/i);
  });
});
