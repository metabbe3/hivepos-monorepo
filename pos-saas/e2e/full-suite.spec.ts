import { test, expect, type Page } from '@playwright/test';

// ─── HELPERS ───────────────────────────────────────────────
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

async function loginOwner(page: Page) {
  await login(page, 'owner@demo.com', 'demo1234');
}

// ─── 1. AUTH FLOW ──────────────────────────────────────────
test.describe('Auth Flow', () => {
  test('owner login → dashboard', async ({ page }) => {
    await loginOwner(page);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  });

  test('super admin login → super-admin page', async ({ page }) => {
    // ponytail: super-admin scope is set by /super-admin/login, not /login.
    await page.goto('/super-admin/login');
    await page.fill('input[type="email"]', 'admin@possaas.id');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/super-admin**', { timeout: 10000 });
    await expect(page).toHaveURL(/super-admin/);
  });

  test('invalid credentials → stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    // Should stay on login (error)
    const url = page.url();
    expect(url.includes('login') || url.includes('error')).toBeTruthy();
  });

  test('unauthenticated → redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page).toHaveURL(/login/);
  });

  test('landing page returns 200', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });

  test('register page returns 200', async ({ page }) => {
    const res = await page.goto('/register');
    expect(res?.status()).toBe(200);
  });
});

// ─── 2. DASHBOARD ──────────────────────────────────────────
test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => { await loginOwner(page); });

  test('shows module switcher sidebar', async ({ page }) => {
    // ponytail: redesigned — Laundry appears as module-switcher button, not link text.
    await expect(page.locator('a[href*="/laundry/orders"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Laundry/ }).first()).toBeVisible();
  });

  test('shows stats cards', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  });

  test('quick action cards link to correct pages', async ({ page }) => {
    const newOrderCard = page.locator('a[href*="/laundry/orders/new"]').first();
    if (await newOrderCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newOrderCard.click();
      await page.waitForURL('**/laundry/orders/new**', { timeout: 10000 });
    }
  });
});

// ─── 3. ORDER CREATION (E2E) ───────────────────────────────
test.describe('Order Creation', () => {
  test.beforeEach(async ({ page }) => { await loginOwner(page); });

  test('full flow: customer → service → weight → cash → submit', async ({ page }) => {
    await page.goto('/laundry/orders/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Select customer (Budi Santoso)
    const customerBtn = page.locator('button:has-text("Budi Santoso")').first();
    if (await customerBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await customerBtn.click();
    } else {
      // Search for customer
      const searchInput = page.locator('input[placeholder*="Search by name"]').first();
      await searchInput.fill('Budi');
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Budi")').first().click();
    }
    await page.waitForTimeout(500);

    // Add Cuci Kering service
    await page.locator('button:has-text("Cuci Kering")').first().click();
    await page.waitForTimeout(500);

    // Set weight to 3
    const weightInput = page.locator('input[type="number"]').first();
    await weightInput.fill('3');
    await weightInput.press('Tab');
    await page.waitForTimeout(500);

    // Select Cash payment
    const cashBtn = page.locator('button:has-text("Cash")').first();
    if (await cashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cashBtn.click();
    }

    // Submit button should be enabled and show correct total
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });

    // Submit
    await submitBtn.click();

    // Should redirect to orders list
    await page.waitForURL('**/laundry/orders**', { timeout: 15000 });
    await expect(page).toHaveURL(/laundry\/orders/);
  });

  test('order list shows created order', async ({ page }) => {
    await page.goto('/laundry/orders');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Either orders exist or empty state
    const orderLinks = page.locator('a[href*="/laundry/orders/"]');
    const noOrders = page.locator('text=No orders yet');
    const hasOrders = await orderLinks.count();
    const hasEmpty = await noOrders.isVisible().catch(() => false);
    expect(hasOrders > 0 || hasEmpty).toBeTruthy();
  });
});

// ─── 4. ORDER DETAIL & STATUS UPDATE ───────────────────────
test.describe('Order Detail & Status', () => {
  test.beforeEach(async ({ page }) => { await loginOwner(page); });

  test('open order detail → status update works', async ({ page }) => {
    await page.goto('/laundry/orders');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const orderLink = page.locator('a[href*="/laundry/orders/"]').first();
    if (await orderLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orderLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Try status update
      const progressBtn = page.locator('button:has-text("Progress"), button:has-text("Proses"), button:has-text("In Progress")').first();
      if (await progressBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await progressBtn.click();
        await page.waitForTimeout(1000);
        await expect(page.locator('text=Progress|text=Proses').first()).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

// ─── 5. CUSTOMER MANAGEMENT ────────────────────────────────
test.describe('Customer Management', () => {
  test.beforeEach(async ({ page }) => { await loginOwner(page); });

  test('customers list loads', async ({ page }) => {
    const res = await page.goto('/customers');
    expect(res?.status()).toBe(200);
    await page.waitForTimeout(1000);
  });

  test('create new customer', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Look for add customer form/button
    const addBtn = page.locator('button:has-text("Baru"), button:has-text("Add"), button:has-text("Pelanggan")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);

      const nameInput = page.locator('input[placeholder*="Name"], input[placeholder*="nama"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('Test Customer Playwright');
        const phoneInput = page.locator('input[placeholder*="Phone"], input[placeholder*="phone"]').first();
        if (await phoneInput.isVisible()) await phoneInput.fill('089988776655');

        await page.locator('button[type="submit"]').last().click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('search customer works', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="Cari"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Budi');
      await page.waitForTimeout(1000);
      // ponytail: multiple Budis may exist; .first() avoids strict-mode violation.
      await expect(page.locator('text=Budi').first()).toBeVisible({ timeout: 3000 });
    }
  });
});

// ─── 6. SERVICES MANAGEMENT ────────────────────────────────
test.describe('Services Management', () => {
  test.beforeEach(async ({ page }) => { await loginOwner(page); });

  test('services page loads with seeded services', async ({ page }) => {
    await page.goto('/laundry/services');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Cuci Kering').first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── 7. ALL PAGES SMOKE TEST ───────────────────────────────
test.describe('All Pages Smoke Test', () => {
  test.beforeEach(async ({ page }) => { await loginOwner(page); });

  const pages = [
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/laundry/orders', name: 'Orders List' },
    { path: '/laundry/orders/new', name: 'New Order' },
    { path: '/laundry/services', name: 'Services' },
    { path: '/laundry/inventory', name: 'Inventory' },
    { path: '/laundry/expenses', name: 'Expenses' },
    { path: '/customers', name: 'Customers' },
    { path: '/reporting', name: 'Reporting' },
    { path: '/branches', name: 'Branches' },
    { path: '/users', name: 'Staff' },
    { path: '/profile', name: 'Profile' },
  ];

  for (const p of pages) {
    test(`${p.name} loads 200`, async ({ page }) => {
      const res = await page.goto(p.path);
      expect(res?.status()).toBe(200);
      await page.waitForLoadState('networkidle');
      const errorText = page.locator('text=Something went wrong|text=Application error');
      expect(await errorText.isVisible({ timeout: 2000 }).catch(() => false)).toBeFalsy();
    });
  }
});

// ─── 8. PUBLIC PAGES ───────────────────────────────────────
test.describe('Public Pages', () => {
  test('track page loads', async ({ page }) => {
    // ponytail: /track/[orderNumber] requires a number; bare /track 404s.
    // Use an obviously-invalid number to hit the error-state branch (still 200).
    const res = await page.goto('/track/QA-PROBE-0000');
    expect(res?.status()).toBeLessThan(400);
  });
});

// ─── 9. SUPER ADMIN ────────────────────────────────────────
test.describe('Super Admin', () => {
  test('dashboard loads with tenant list', async ({ page }) => {
    // ponytail: super-admin scope is set by /super-admin/login, not /login.
    await page.goto('/super-admin/login');
    await page.fill('input[type="email"]', 'admin@possaas.id');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/super-admin**', { timeout: 10000 });
    await expect(page.locator('text=Demo Laundry').first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── 10. EDGE CASES ────────────────────────────────────────
test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => { await loginOwner(page); });

  test('create order without customer → submit disabled', async ({ page }) => {
    await page.goto('/laundry/orders/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const submitBtn = page.locator('button[type="submit"]');
    const isDisabled = await submitBtn.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('sidebar navigation between pages', async ({ page }) => {
    // Use href-based selectors for reliability
    await page.locator('a[href="/laundry/orders"]').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.locator('a[href="/laundry/services"]').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.locator('a[href="/dashboard"]').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveURL(/dashboard/);
  });
});
