import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for e2e tests.
 *
 * Starts the Vite dev server automatically and runs tests against it.
 * Auth bypass is enabled via extraHTTPHeaders for authenticated routes.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.playwright.ts',

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Reporter */
  reporter: 'list',

  /* Shared settings for all tests */
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the Vite dev server before running tests */
  webServer: {
    command: 'npx vite --host 0.0.0.0 --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      NODE_ENV: 'development',
      AUTH_BYPASS_ENABLED: 'true',
      RATE_LIMIT_ENABLED: 'false',
    },
  },
});
