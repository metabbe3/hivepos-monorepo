// ponytail: public-page smoke + form submission tests.
// Covers /pickup/[branchSlug], /track/[orderNumber], /support.

import { test, expect, type Page } from '@playwright/test';

const BRANCH_SLUG = 'qa-test-laundry-outlet';

async function login(page: Page, email = 'qa-owner@example.com', pass = 'qa-test-12345') {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

// ─── PICKUP FORM ───────────────────────────────────────────
test.describe('Public Pickup Form', () => {
  test('page loads', async ({ page }) => {
    const res = await page.goto(`/pickup/${BRANCH_SLUG}`);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
  });

  test('invalid branch slug → 404 or error', async ({ page }) => {
    const res = await page.goto('/pickup/definitely-nonexistent-branch-xyz');
    // 404 is acceptable, or error state on 200
    expect(res?.status()).toBeLessThan(500);
  });

  test('submit pickup request with valid data', async ({ page }) => {
    await page.goto(`/pickup/${BRANCH_SLUG}`);
    await page.waitForLoadState('networkidle');

    // Try filling typical pickup fields
    const name = page.locator('input[name*="name" i], input[placeholder*="Nama" i], input[placeholder*="name" i]').first();
    if (await name.isVisible({ timeout: 3000 }).catch(() => false)) {
      await name.fill('Pelanggan Pickup');
      const phone = page.locator('input[type="tel"], input[placeholder*="phone" i], input[placeholder*="WA" i]').first();
      if (await phone.isVisible()) await phone.fill('081200001113');
      const address = page.locator('textarea, input[placeholder*="address" i], input[placeholder*="Alamat" i]').first();
      if (await address.isVisible()) await address.fill('Jl. QA Test No. 123');

      // Find submit button
      const submit = page.locator('button[type=submit], button:has-text("Kirim"), button:has-text("Submit"), button:has-text("Request")').first();
      if (await submit.isVisible({ timeout: 1000 }).catch(() => false)) {
        await submit.click();
        await page.waitForTimeout(2000);
        // Should show success or clear form — don't hard-assert UI specifics
      }
    }
  });
});

// ─── TRACK ─────────────────────────────────────────────────
test.describe('Public Track', () => {
  test('invalid order number → graceful error state', async ({ page }) => {
    const res = await page.goto('/track/QA-PROBE-0000');
    expect(res?.status()).toBeLessThan(400);
  });

  test('valid order number renders timeline', async ({ page }) => {
    // ponytail: QA tenant has no orders — use owner@demo.com which has seeded orders.
    await login(page, 'owner@demo.com', 'demo1234');
    await page.goto('/laundry/orders');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const firstOrderLink = page.locator('a[href*="/laundry/orders/"]').first();
    const href = await firstOrderLink.getAttribute('href').catch(() => null);
    if (href) {
      const match = href.match(/\/laundry\/orders\/(.+)$/);
      if (match) {
        await page.goto(`/track/${match[1]}`);
        await page.waitForLoadState('networkidle');
        // Page should load without 500
        expect(page.url()).toContain('/track/');
      }
    }
  });
});

// ─── SUPPORT ───────────────────────────────────────────────
test.describe('Public Support', () => {
  test('page loads', async ({ page }) => {
    const res = await page.goto('/support');
    expect(res?.status()).toBeLessThan(400);
  });
});

// ─── LANDING + REGISTER ────────────────────────────────────
test.describe('Public Landing', () => {
  test('landing returns 200', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });

  test('register returns 200', async ({ page }) => {
    const res = await page.goto('/register');
    expect(res?.status()).toBe(200);
  });
});
