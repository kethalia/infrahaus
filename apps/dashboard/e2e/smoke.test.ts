import { test, expect } from "@playwright/test";

// Smoke tests: verify the app starts and unauthenticated routing works.
// SIWE/RainbowKit wallet auth cannot be tested headlessly in CI —
// these tests deliberately avoid any authenticated route.

test.describe("Unauthenticated routing", () => {
  test("root path redirects to /login", async ({ page }) => {
    await page.goto("/");
    // Middleware should redirect unauthenticated users to /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);

    // Page should have rendered content (not blank)
    await expect(page.locator("body")).toBeVisible();

    // No JS errors on initial load
    expect(errors).toHaveLength(0);
  });

  test("login page contains wallet connect UI", async ({ page }) => {
    await page.goto("/login");
    // RainbowKit WalletButton renders a button — check for its presence
    // The exact text may vary but a button must exist
    const connectButton = page.getByRole("button");
    await expect(connectButton.first()).toBeVisible();
  });
});
