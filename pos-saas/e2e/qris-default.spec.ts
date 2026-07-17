// Verifies Part C: clicking the money (record-payment) icon on the order list
// opens the dialog with the payment method defaulting to QRIS.

import { test, expect, type Page } from '@playwright/test';

async function login(p: Page) {
  await p.goto('/login?cb=q');
  await p.fill('input[name="email"]', 'qa-owner@example.com');
  await p.fill('input[name="password"]', 'qa-test-12345');
  await p.click('button[type="submit"]');
  await p.waitForURL('**/dashboard**', { timeout: 10000 });
}

test('order list money icon → record payment defaults to QRIS', async ({ page }) => {
  await login(page);
  await page.goto('/laundry/orders?cb=q');
  await page.waitForLoadState('networkidle');

  // The money-icon record-payment action (Banknote) on the first order row.
  const payBtn = page.getByRole('button', { name: /catat pembayaran|record payment/i }).first();
  await payBtn.click();

  // The payment-method combobox should display QRIS (the new default).
  await expect(page.getByRole('combobox').first()).toContainText('QRIS', { timeout: 5000 });
});
