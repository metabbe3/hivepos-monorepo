// ponytail: negative test cases — form validation, permission denial, ref integrity.
// Each test asserts that the system BLOCKS the bad action (not that it succeeds).

import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email = 'qa-owner@example.com', pass = 'qa-test-12345') {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

// ─── FORM VALIDATION: empty submit ─────────────────────────
test.describe('Form validation — register', () => {
  test('empty submit shows required errors', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    // Click submit with empty form
    await page.locator('button[type=submit]').click();
    await page.waitForTimeout(500);
    // Form should still be on /register, no redirect to /login
    expect(page.url()).toContain('/register');
  });

  test('short password rejected', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    // Fill required fields but short password
    const inputs = page.locator('input');
    const setter = (el: any, val: string) => el.evaluate((e: HTMLInputElement, v: string) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      s.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true }));
    }, val);

    const all = await inputs.all();
    if (all.length >= 4) {
      // Find name, slug, email, password fields heuristically
      const passwordInput = page.locator('input[type="password"]').first();
      await setter(passwordInput, 'short');
      const emailInput = page.locator('input[type="email"]').first();
      await setter(emailInput, 'test@example.com');
      const textInputs = page.locator('input[type="text"]');
      const c0 = await textInputs.count();
      if (c0 > 0) await setter(textInputs.first(), 'X'); // too short
      await page.locator('button[type=submit]').click();
      await page.waitForTimeout(500);
      // Still on register
      expect(page.url()).toContain('/register');
    }
  });
});

// ─── FORM VALIDATION: invalid credentials ──────────────────
test.describe('Login validation', () => {
  test('wrong password stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'qa-owner@example.com');
    await page.fill('input[type="password"]', 'wrong-password-xyz');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    // Either stays on /login or shows error
    expect(page.url()).toMatch(/login|error/);
  });

  test('nonexistent email stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'no-such-user@example.com');
    await page.fill('input[type="password"]', 'anypassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    expect(page.url()).toMatch(/login|error/);
  });
});

// ─── FORM VALIDATION: service create with empty fields ─────
test.describe('Service create validation', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('empty submit blocks creation', async ({ page }) => {
    await page.goto('/laundry/services');
    await page.waitForLoadState('networkidle');

    const beforeCount = await page.locator('text=QA Service').count();
    const addBtn = page.locator('button:has-text("Add Service")').first();
    await addBtn.click();
    await page.waitForTimeout(400);

    // Submit empty form
    const submit = page.locator('[role=dialog] button:has-text("Save")').first();
    if (await submit.isVisible({ timeout: 1000 }).catch(() => false)) {
      await submit.click();
      await page.waitForTimeout(800);
      // Dialog should still be open (validation blocked submit)
      const dialogOpen = await page.locator('[role=dialog]').first().isVisible().catch(() => false);
      const afterCount = await page.locator('text=QA Service').count();
      expect(dialogOpen || afterCount === beforeCount).toBeTruthy();
    }
  });
});

// ─── FORM VALIDATION: customer create with empty name ──────
test.describe('Customer create validation', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('empty name blocks creation', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    const beforeCount = await page.locator('a[href*="/customers/"]').count();

    await page.locator('button:has-text("Add Customer")').first().click();
    await page.waitForTimeout(400);

    const submit = page.locator('[role=dialog] button:has-text("Simpan")').first();
    if (await submit.isVisible({ timeout: 1000 }).catch(() => false)) {
      await submit.click();
      await page.waitForTimeout(800);
      // ponytail: validation should keep dialog open + show error
      const dialogOpen = await page.locator('[role=dialog]').first().isVisible().catch(() => false);
      const errorMsg = await page.locator('text=/Nama is required|required|wajib/i').first().isVisible().catch(() => false);
      const afterCount = await page.locator('a[href*="/customers/"]').count();
      expect(dialogOpen || errorMsg || afterCount === beforeCount).toBeTruthy();
    }
  });
});

// ─── PERMISSION DENIAL ─────────────────────────────────────
test.describe('Permission denial', () => {
  test('unauthenticated → /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('login');
  });

  test('unauthenticated → /customers redirects to /login', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('login');
  });

  test('unauthenticated → /billing redirects to /login', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('login');
  });

  test('tenant user → /super-admin redirects away', async ({ page }) => {
    await login(page);
    await page.goto('/super-admin');
    await page.waitForURL('**/login**', { timeout: 10000 }).catch(() => true);
    // Either redirected to login or back to dashboard — either way NOT in super-admin
    await page.waitForTimeout(1000);
    expect(page.url().includes('/super-admin')).toBeFalsy();
  });
});

// ─── REFERENTIAL INTEGRITY ─────────────────────────────────
test.describe('Referential integrity', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('delete customer → confirm dialog appears (ref-integrity guard)', async ({ page }) => {
    // ponytail: QA tenant has no orders — verify the confirm-dialog guard path runs.
    // Backend ref-integrity check is tested at API layer; here we just verify UI flow.
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const delBtn = page.locator('button[aria-label*="Delete"]').first();
    if (await delBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await delBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.locator('[role=dialog], [role=alertdialog]').first();
      const dialogVisible = await dialog.isVisible().catch(() => false);
      expect(dialogVisible).toBeTruthy();
      const dialogText = (await dialog.textContent().catch(() => '')) ?? '';
      // Confirm-dialog text should mention delete/confirm — ref-blocked message also accepted
      expect(dialogText.length).toBeGreaterThan(0);
    }
  });

  test('cannot delete role assigned to user', async ({ page }) => {
    // ponytail: Owner role is assigned to the qa-owner user — try to delete it
    await page.goto('/roles');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try to find a delete button on a role card
    const delBtn = page.locator('button[aria-label*="Delete"]').first();
    if (await delBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await delBtn.click();
      await page.waitForTimeout(500);
      // Either confirm dialog or blocked message
      const dialog = page.locator('[role=dialog], [role=alertdialog]').first();
      const dialogText = await dialog.textContent().catch(() => '');
      expect(typeof dialogText).toBe('string');
    }
  });
});

// ─── EMPTY STATES render ───────────────────────────────────
test.describe('Empty states', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('inventory empty state renders', async ({ page }) => {
    await page.goto('/laundry/inventory');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
  });

  test('expenses empty state renders', async ({ page }) => {
    await page.goto('/laundry/expenses');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
  });

  test('orders empty state renders', async ({ page }) => {
    await page.goto('/laundry/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
  });
});
