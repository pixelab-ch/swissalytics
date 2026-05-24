import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'E2E=1 pnpm build && E2E=1 PORT=3001 pnpm start',
    url: 'http://localhost:3001',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      E2E: '1',
      PORT: '3001',
    },
  },
});
