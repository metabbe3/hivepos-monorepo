import { defineConfig, devices } from "@playwright/test";

// ponytail: tests run hivepos-web dev on 3008 — 3007 is held by the legacy
// pos-saas Docker container (comparison reference), which we leave running.
// Auth: global-setup logs in via hivepos-api (8099) and writes a storageState
// with the JWT in localStorage["hivepos_token"]; restored per context.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: 0, // clear pass/fail signal for the autonomous fix loop
  fullyParallel: false,
  workers: 1, // next dev compiles routes on demand — serial avoids contention/reload flake
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3008",
    storageState: ".e2e/auth.json",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 10000,
  },
  webServer: {
    // dev mode — a corrupted .next (Turbopack) cache caused a reload loop earlier;
    // `rm -rf .next` resolved it. reuseExistingServer so `next dev` isn't double-started.
    command: "npx next dev -p 3008",
    port: 3008,
    timeout: 120000,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
