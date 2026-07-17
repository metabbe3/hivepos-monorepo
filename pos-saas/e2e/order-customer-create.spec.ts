// Regression for the inline customer-create bug on /laundry/orders/new.
//
// Root cause: the customer-create UI was a <form> nested inside the outer order
// <form>. Its submit bubbled up to the order's handleSubmit — which, on an empty
// cart, fired the "Add at least one item" error and (depending on browser) could
// reload/submit and wipe the page. The fix removed the nesting (a <div> + a
// type="button" trigger). This test asserts the order submit no longer fires:
// the success toast appears, the customer is auto-selected, the page does not
// navigate, and crucially the empty-cart error toast does NOT appear.

import { test, expect, type Page } from '@playwright/test';

const QA_EMAIL = 'qa-owner@example.com';
const QA_PASS = 'qa-test-12345';
const TS = Date.now().toString().slice(-6);

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', QA_EMAIL);
  await page.fill('input[type="password"]', QA_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

test('inline customer create does not trigger the order submit', async ({ page }) => {
  await login(page);
  await page.goto('/laundry/orders/new');
  await page.waitForLoadState('networkidle');

  const custName = `QACust${TS}`;

  // Open the inline "new customer" form.
  await page.getByRole('button', { name: 'New', exact: true }).click();

  // Fill the name input and submit via the "Create & Select" button.
  const nameInput = page.getByPlaceholder('Customer name');
  await nameInput.waitFor({ state: 'visible' });
  await nameInput.fill(custName);
  await page.getByRole('button', { name: 'Create & Select' }).click();

  // 1. handleCreateCustomer completed → success toast.
  await expect(page.getByText('Customer created').first()).toBeVisible({ timeout: 8000 });

  // 2. Discriminating assertion: handleSubmit must NOT have fired. With the old
  //    nested form, the empty-cart path showed "Add at least one item".
  await page.waitForTimeout(1500); // give any erroneous toast time to render
  await expect(page.getByText('Add at least one item')).toHaveCount(0);

  // 3. No navigation — still composing the order.
  await expect(page).toHaveURL(/\/laundry\/orders\/new$/);

  // 4. The new customer is auto-selected (picker switched to the selected card).
  await expect(page.getByText(custName, { exact: true }).first()).toBeVisible({ timeout: 5000 });
});
