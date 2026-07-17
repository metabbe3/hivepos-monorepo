// Verifies the login pages expose the attributes iOS/desktop password managers
// need to save + Face-ID-autofill (autocomplete + name), the "Remember me"
// checkbox is present + default-checked, and that login still succeeds.
// Same for the super-admin login.

import { test, expect } from '@playwright/test';

test('tenant login: Face ID attributes + remember-me + login works', async ({ page }) => {
  await page.goto('/login?cb=r1');

  const email = page.locator('input[name="email"]');
  const pass = page.locator('input[name="password"]');
  await expect(email).toHaveAttribute('autocomplete', 'email');
  await expect(pass).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.locator('#remember')).toBeChecked();

  await email.fill('qa-owner@example.com');
  await pass.fill('qa-test-12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
});

test('super-admin login: Face ID attributes + remember-me', async ({ page }) => {
  await page.goto('/super-admin/login?cb=r1');
  await expect(page.locator('input[name="email"]')).toHaveAttribute('autocomplete', 'email');
  await expect(page.locator('input[name="password"]')).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.locator('#remember')).toBeChecked();
});
