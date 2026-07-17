import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3007',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx next dev -p 3007',
    port: 3007,
    timeout: 30000,
    reuseExistingServer: true,
  },
});
