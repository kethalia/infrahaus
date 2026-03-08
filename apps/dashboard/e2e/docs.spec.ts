import { test, expect } from "@playwright/test";

// Docs smoke tests — Phase 09
// Unauthenticated tests run in CI. Authenticated tests require a wallet session
// and are skipped headlessly — run manually after deployment.

test.describe("Docs routing (unauthenticated)", () => {
  test("/docs redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto("/docs");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/docs/any-slug redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/docs/getting-started");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Docs routing (authenticated — manual)", () => {
  test.skip(
    true,
    "Requires authenticated session — run manually after deployment"
  );

  test("/docs renders DocsPage without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/docs");
    await expect(page.locator("body")).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("Documentation link is present in dashboard sidebar", async ({
    page,
  }) => {
    await page.goto("/");
    const docsLink = page.getByRole("link", { name: /documentation/i });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute("href", "/docs");
  });

  test("Documentation sidebar link is active on /docs/* paths", async ({
    page,
  }) => {
    await page.goto("/docs");
    const docsLink = page.getByRole("link", { name: /documentation/i });
    // SidebarMenuButton sets aria-current="page" or data-active when isActive
    await expect(docsLink).toHaveAttribute("data-active", "true");
  });

  test("dark/light mode toggle works on /docs", async ({ page }) => {
    await page.goto("/docs");
    // Fumadocs RootProvider renders a theme toggle button
    const themeToggle = page.getByRole("button", { name: /theme|dark|light/i });
    await expect(themeToggle.first()).toBeVisible();
  });
});
