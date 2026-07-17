// Verifies the reported BETATESTER bug is fixed end-to-end via the tenant
// billing API: BETATESTER is now a Pro-only FREE_MONTH × 12 promo. At PRO tier
// it validates and grants 12 free months at 79k pricing; at GROWTH tier it is
// rejected by the new plan-restriction check.

import { test, expect, type Page } from '@playwright/test';

async function login(p: Page) {
  await p.goto('/login');
  await p.fill('input[type="email"]', 'qa-owner@example.com');
  await p.fill('input[type="password"]', 'qa-test-12345');
  await p.click('button[type="submit"]');
  await p.waitForURL('**/dashboard**', { timeout: 10000 });
}

test('BETATESTER: Pro-only, 12 free months at Pro pricing; rejected at Growth', async ({ page }) => {
  await login(page);

  // PRO tier → valid, 12 free months, 79k unit price.
  const proRes = await page.request.post('/api/billing/promo/validate', {
    data: { code: 'BETATESTER', planTier: 'PRO', months: 12, branchIds: [] },
  });
  const pro = (await proRes.json()).data;
  expect(pro.valid).toBe(true);
  expect(pro.calculation.unitPrice).toBe(79000);
  expect(pro.calculation.freeMonths).toBe(12);

  // GROWTH tier → rejected by the plan-restriction check (Pro-only).
  const growthRes = await page.request.post('/api/billing/promo/validate', {
    data: { code: 'BETATESTER', planTier: 'GROWTH', months: 1, branchIds: [] },
  });
  const growth = (await growthRes.json()).data;
  expect(growth.valid).toBe(false);
  expect(/Pro/i.test(growth.error ?? '')).toBe(true);
});
