import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Run tests serially — smoke tests are fast and sequential is simpler for CI
  fullyParallel: false,
  // Fail the build on CI if test.only() is accidentally committed
  forbidOnly: !!process.env.CI,
  // No retries — flaky smoke tests should be investigated, not silently retried
  retries: 0,
  // Single worker for smoke tests
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    // Dashboard runs on port 3002 in dev
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3002",
    // Capture trace on failure for debugging
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Start Next.js dev server for local runs; CI starts the server separately
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm --filter dashboard dev",
        url: "http://localhost:3002",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
