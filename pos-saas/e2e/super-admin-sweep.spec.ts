// Super-admin sweep: log in, visit every panel route, report per-route
// console errors + API 5xx + visible error pages. Read-only (no mutations).
// Drives the find-then-fix loop for "broken super-admin features".

import { test, type Page } from '@playwright/test';

const ROUTES = [
  ['', 'Overview'],
  ['/performance', 'Performance'],
  ['/health', 'Health'],
  ['/pickup-insights', 'Pickup Insights'],
  ['/peripherals', 'Peripherals'],
  ['/tenants', 'Tenants'],
  ['/plans', 'Plans'],
  ['/promo-codes', 'Promo Codes'],
  ['/billing', 'Billing'],
  ['/users', 'Users'],
  ['/tickets', 'Tickets'],
  ['/error-logs', 'Error Logs'],
  ['/audit-log', 'Audit Log'],
  ['/admins', 'Admins'],
  ['/feature-flags', 'Feature Flags'],
  ['/settings', 'Settings'],
] as const;

async function login(p: Page) {
  await p.goto('/super-admin/login');
  await p.fill('input[type="email"]', 'admin@possaas.id');
  await p.fill('input[type="password"]', 'admin123');
  await p.click('button[type="submit"]');
  await p.waitForURL('**/super-admin', { timeout: 10000 });
}

test('super-admin: every route loads without 5xx/console errors', async ({ page }) => {
  await login(page);

  const results: string[] = [];
  for (const [path, label] of ROUTES) {
    const consoleErrs: string[] = [];
    const apiFails: string[] = [];
    const onConsole = (m: { type: () => string; text: () => string }) => {
      if (m.type() === 'error') consoleErrs.push(m.text());
    };
    const onResponse = (r: { status: () => number; url: () => string }) => {
      if (r.status() >= 500) apiFails.push(`${r.status()} ${r.url()}`);
    };
    page.on('console', onConsole);
    page.on('response', onResponse);

    await page.goto(`/super-admin${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(800); // let API calls settle

    const bodyText = (await page.locator('body').innerText().catch(() => '')) ?? '';
    const errorPage = /Application error|Internal Server Error|Unhandled Runtime|something went wrong/i.test(bodyText);

    results.push(
      `[${errorPage || apiFails.length || consoleErrs.length ? 'FAIL' : ' ok '}] ${label} (${path || '/'}): ` +
        `console=${consoleErrs.length} api5xx=${apiFails.length} errorPage=${errorPage}` +
        (consoleErrs.length ? ` :: ${consoleErrs.slice(0, 2).join(' | ')}` : '') +
        (apiFails.length ? ` :: ${apiFails.slice(0, 2).join(' | ')}` : ''),
    );

    page.off('console', onConsole);
    page.off('response', onResponse);
  }

  console.log('\n===== SUPER-ADMIN SWEEP RESULTS =====\n' + results.join('\n') + '\n');
});
