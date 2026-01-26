/**
 * Navigation Flow End-to-End Tests (Playwright)
 *
 * Validates the complete navigation architecture in a real browser:
 * - FloatingLogo displays at top with gradient blur
 * - BottomTabBar handles all navigation
 * - All pages accessible via BottomTabBar
 * - No broken navigation links
 * - Active route highlighting works
 *
 * Run with: npx playwright test tests/e2e/navigation-flow.playwright.ts
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Helper to set up auth bypass for authenticated pages
 */
async function setupAuthBypass(page: Page) {
  await page.setExtraHTTPHeaders({
    'X-Auth-Bypass': 'test@playwright.local',
  });
}

test.describe('Navigation Flow (Playwright)', () => {
  test.beforeEach(async ({ page }) => {
    // Enable auth bypass for protected routes
    await setupAuthBypass(page);
  });

  test.describe('Layout Architecture', () => {
    test('renders complete layout with FloatingLogo and BottomTabBar', async ({ page }) => {
      await page.goto('/');

      // FloatingLogo should be visible
      const logo = page.locator('header[data-testid="floating-logo"]');
      await expect(logo).toBeVisible();
      await expect(logo).toContainText('Clack Track');
      await expect(logo).toContainText('BY HOUSEBOY');

      // BottomTabBar should be visible
      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();

      // Check navigation has iOS-style pill design
      await expect(nav).toHaveClass(/rounded-full/);
      await expect(nav).toHaveClass(/backdrop-blur-xl/);
    });

    test('FloatingLogo is fixed at top of viewport', async ({ page }) => {
      await page.goto('/');

      const logo = page.locator('header[data-testid="floating-logo"]');
      await expect(logo).toBeVisible();

      // Check fixed positioning
      await expect(logo).toHaveClass(/fixed/);
      await expect(logo).toHaveClass(/top-0/);

      // Scroll down and verify logo stays fixed
      await page.evaluate(() => window.scrollBy(0, 500));
      await expect(logo).toBeVisible();
    });

    test('BottomTabBar is fixed at bottom center', async ({ page }) => {
      await page.goto('/');

      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();

      // Check fixed positioning at bottom
      await expect(nav).toHaveClass(/fixed/);
      await expect(nav).toHaveClass(/bottom-4/);

      // Scroll down and verify nav stays fixed
      await page.evaluate(() => window.scrollBy(0, 500));
      await expect(nav).toBeVisible();
    });

    test('does NOT render old Navigation component (hamburger menu)', async ({ page }) => {
      await page.goto('/');

      // Old Navigation had a Sheet trigger button with hamburger icon
      // BottomTabBar should NOT have these
      const sheetTriggers = page.locator('[role="button"][aria-haspopup="dialog"]');
      await expect(sheetTriggers).toHaveCount(0);

      // Check for hamburger menu icons (old Navigation)
      const hamburgerIcons = page.locator('text=/[☰≡]/');
      await expect(hamburgerIcons).toHaveCount(0);
    });
  });

  test.describe('Navigation Routes - Authenticated', () => {
    test('shows all navigation tabs when authenticated', async ({ page }) => {
      await page.goto('/');

      // Wait for auth state to load
      await page.waitForSelector('text=Admin');

      // Check all tabs are visible
      await expect(page.locator('a[href="/"]')).toBeVisible(); // Home
      await expect(page.locator('a[href="/flipside"]')).toBeVisible(); // History
      await expect(page.locator('a[href="/account"]')).toBeVisible(); // Account
      await expect(page.locator('a[href="/admin"]')).toBeVisible(); // Admin

      // Logout button should be visible
      await expect(page.locator('button:has-text("Logout")')).toBeVisible();

      // Login link should NOT be visible when authenticated
      const loginLinks = page.locator('a[href="/login"]:has-text("Login")');
      await expect(loginLinks).toHaveCount(0);
    });

    test('navigates to Home route via BottomTabBar', async ({ page }) => {
      await page.goto('/flipside');
      await page.waitForLoadState('networkidle');

      // Click Home link in BottomTabBar
      await page.click('a[href="/"]');
      await page.waitForURL('/');

      expect(page.url()).toContain('/');
    });

    test('navigates to History route via BottomTabBar', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Click History link in BottomTabBar
      await page.click('a[href="/flipside"]');
      await page.waitForURL('/flipside');

      expect(page.url()).toContain('/flipside');
    });

    test('navigates to Account route via BottomTabBar', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for Admin tab to confirm auth loaded
      await page.waitForSelector('text=Admin');

      // Click Account link in BottomTabBar
      await page.click('a[href="/account"]');
      await page.waitForURL('/account');

      expect(page.url()).toContain('/account');
    });

    test('navigates to Admin route via BottomTabBar', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for Admin tab to appear
      await page.waitForSelector('text=Admin');

      // Click Admin link in BottomTabBar
      await page.click('a[href="/admin"]');
      await page.waitForURL('/admin');

      expect(page.url()).toContain('/admin');
    });
  });

  test.describe('Active Route Highlighting', () => {
    test('highlights Home tab when on home route', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Home link should have active styling (amber color)
      const homeLink = page.locator('a[href="/"]');
      await expect(homeLink).toHaveClass(/text-amber-600/);
    });

    test('highlights History tab when on flipside route', async ({ page }) => {
      await page.goto('/flipside');
      await page.waitForLoadState('networkidle');

      // History link should have active styling
      const historyLink = page.locator('a[href="/flipside"]');
      await expect(historyLink).toHaveClass(/text-amber-600/);
    });

    test('highlights Account tab when on account route', async ({ page }) => {
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      // Account link should have active styling
      const accountLink = page.locator('a[href="/account"]');
      await expect(accountLink).toHaveClass(/text-amber-600/);
    });

    test('highlights Admin tab when on admin route', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Admin link should have active styling
      const adminLink = page.locator('a[href="/admin"]');
      await expect(adminLink).toHaveClass(/text-amber-600/);
    });

    test('shows inactive tabs with muted color', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for auth state
      await page.waitForSelector('text=Admin');

      // History and Account should be inactive (gray)
      const historyLink = page.locator('a[href="/flipside"]');
      const accountLink = page.locator('a[href="/account"]');

      await expect(historyLink).toHaveClass(/text-gray-500/);
      await expect(accountLink).toHaveClass(/text-gray-500/);
    });
  });

  test.describe('Complete Navigation Flow', () => {
    test('provides complete navigation flow through all routes', async ({ page }) => {
      // Start at home
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('text=Admin');

      // Navigate to History
      await page.click('a[href="/flipside"]');
      await page.waitForURL('/flipside');
      expect(page.url()).toContain('/flipside');

      // Navigate to Account
      await page.click('a[href="/account"]');
      await page.waitForURL('/account');
      expect(page.url()).toContain('/account');

      // Navigate to Admin
      await page.click('a[href="/admin"]');
      await page.waitForURL('/admin');
      expect(page.url()).toContain('/admin');

      // Navigate back to Home
      await page.click('a[href="/"]');
      await page.waitForURL('/');
      expect(page.url()).toMatch(/\/$/);

      // Verify FloatingLogo visible on all routes
      const logo = page.locator('header[data-testid="floating-logo"]');
      await expect(logo).toBeVisible();
      await expect(logo).toContainText('Clack Track');
    });
  });

  test.describe('FloatingLogo Integration', () => {
    test('displays FloatingLogo with gradient blur effect', async ({ page }) => {
      await page.goto('/');

      const logo = page.locator('header[data-testid="floating-logo"]');
      await expect(logo).toBeVisible();

      // Check gradient and blur classes
      await expect(logo).toHaveClass(/bg-gradient-to-b/);
      await expect(logo).toHaveClass(/backdrop-blur-md/);
    });

    test('FloatingLogo text has correct typography', async ({ page }) => {
      await page.goto('/');

      // Main heading with brush script font
      const heading = page.locator('h1:has-text("Clack Track")');
      await expect(heading).toBeVisible();
      await expect(heading).toHaveClass(/font-brush/);

      // Byline with display font
      const byline = page.locator('text=BY HOUSEBOY');
      await expect(byline).toBeVisible();
    });

    test('FloatingLogo is visible on all pages', async ({ page }) => {
      const routes = ['/', '/flipside', '/account', '/admin'];

      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const logo = page.locator('header[data-testid="floating-logo"]');
        await expect(logo).toBeVisible();
        await expect(logo).toContainText('Clack Track');
      }
    });
  });

  test.describe('BottomTabBar Integration', () => {
    test('BottomTabBar has iOS-style floating pill design', async ({ page }) => {
      await page.goto('/');

      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();

      // Check pill design classes
      await expect(nav).toHaveClass(/rounded-full/);
      await expect(nav).toHaveClass(/backdrop-blur-xl/);
      await expect(nav).toHaveClass(/shadow-lg/);
    });

    test('BottomTabBar is visible on all screen sizes', async ({ page }) => {
      await page.goto('/');

      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();

      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(nav).toBeVisible();

      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(nav).toBeVisible();

      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(nav).toBeVisible();
    });

    test('BottomTabBar tabs meet minimum touch target size', async ({ page }) => {
      await page.goto('/');

      const links = page.locator('nav[aria-label="Main navigation"] a');
      const count = await links.count();

      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const box = await link.boundingBox();

        // Minimum 44px touch target (11 * 4px = 44px in Tailwind)
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('has proper landmark roles', async ({ page }) => {
      await page.goto('/');

      // Banner for FloatingLogo
      const banner = page.locator('header[role="banner"]');
      await expect(banner).toBeVisible();

      // Navigation for BottomTabBar
      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();

      // Main content area
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('has proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      // h1 should be in FloatingLogo
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      await expect(h1).toContainText('Clack Track');
    });

    test('navigation tabs are keyboard accessible', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Admin');

      // Tab through navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Check focus is on a navigation link
      const focusedElement = await page.locator(':focus');
      await expect(focusedElement).toHaveAttribute('href');
    });

    test('navigation tabs have visible focus states', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Admin');

      const homeLink = page.locator('a[href="/"]');

      // Focus the link
      await homeLink.focus();

      // Should have focus-visible ring class
      await expect(homeLink).toHaveClass(/focus-visible:ring-2/);
    });
  });

  test.describe('No Broken Navigation Links', () => {
    test('all navigation links are valid and load successfully', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Admin');

      // Get all navigation links
      const links = await page.locator('nav[aria-label="Main navigation"] a').all();

      for (const link of links) {
        const href = await link.getAttribute('href');

        if (href) {
          // Click link and verify page loads
          await link.click();
          await page.waitForLoadState('networkidle');

          // Check no error pages
          const errorText = page.locator('text=/404|not found|error/i');
          await expect(errorText).toHaveCount(0);

          // Navigate back to home for next iteration
          await page.goto('/');
          await page.waitForSelector('text=Admin');
        }
      }
    });

    test('FloatingLogo is present on all routes', async ({ page }) => {
      const routes = ['/', '/flipside', '/account', '/admin'];

      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const logo = page.locator('header[data-testid="floating-logo"]');
        await expect(logo).toBeVisible();
        await expect(logo).toContainText('Clack Track');
      }
    });

    test('BottomTabBar is present on all routes', async ({ page }) => {
      const routes = ['/', '/flipside', '/account', '/admin'];

      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const nav = page.locator('nav[aria-label="Main navigation"]');
        await expect(nav).toBeVisible();
      }
    });
  });
});
