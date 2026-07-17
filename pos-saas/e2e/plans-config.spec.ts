// Verifies the configurable multi-plan system: the three tiers (incl. a real Pro
// plan) exist, a plan's price is editable + persists (→ drives billing via
// getTierUnitPrice), and the Pro-no-downgrade guard still blocks (now tier-based).

import { test, expect, type Page } from '@playwright/test';

async function login(p: Page) {
  await p.goto('/super-admin/login');
  await p.fill('input[type="email"]', 'admin@possaas.id');
  await p.fill('input[type="password"]', 'admin123');
  await p.click('button[type="submit"]');
  await p.waitForURL('**/super-admin', { timeout: 10000 });
}

test('plans: tiers incl. Pro + configurable price + downgrade guard', async ({ page }) => {
  await login(page);

  // 1. Three tiers present, incl. PRO.
  const list = await (await page.request.get('/api/super-admin/plans')).json();
  const plans = list.data.plans;
  const tiers = plans.map((p: any) => p.tier).filter(Boolean).sort();
  expect(tiers).toEqual(['FREE', 'GROWTH', 'PRO']);
  const pro = plans.find((p: any) => p.tier === 'PRO');
  expect(pro).toBeTruthy();
  expect(pro.priceMonthly).toBe(79000);

  // 2. Configurable price: edit Pro's priceMonthly → custom value, persists.
  await page.request.patch(`/api/super-admin/plans/${pro.id}`, { data: { priceMonthly: 88000 } });
  const list2 = await (await page.request.get('/api/super-admin/plans')).json();
  const pro2 = list2.data.plans.find((p: any) => p.id === pro.id);
  expect(pro2.priceMonthly).toBe(88000);

  // 3. Restore the canonical price.
  await page.request.patch(`/api/super-admin/plans/${pro.id}`, { data: { priceMonthly: 79000 } });

  // 4. Downgrade guard still blocks PRO → GROWTH (now tier-based, not name-based).
  const growth = plans.find((p: any) => p.tier === 'GROWTH');
  const dg = await page.request.patch('/api/super-admin/tenants/tenant-honey-bee/subscription', {
    data: { op: 'change_plan', planId: growth.id, reason: 'tier-based downgrade guard test' },
  });
  expect(dg.status()).toBe(400);
});
