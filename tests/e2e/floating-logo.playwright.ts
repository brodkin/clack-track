/**
 * Playwright E2E Tests for FloatingLogo Component
 *
 * Visual validation tests for the sticky glassmorphism header.
 * Run these tests with the web server running:
 *   npm run dev (in one terminal)
 *   npx playwright test tests/e2e/floating-logo.playwright.ts (in another)
 */

import { test, expect } from '@playwright/test';

test.describe('FloatingLogo Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page (uses baseURL from playwright.config.ts)
    await page.goto('/');
    // Wait for logo to render
    await page.waitForSelector('[data-testid="floating-logo"]');
  });

  test('renders logo with correct text content', async ({ page }) => {
    // Check main logo text
    const mainText = await page.locator('h1:has-text("Clack Track")');
    await expect(mainText).toBeVisible();

    // Check byline text
    const byline = await page.locator('text=BY HOUSEBOY');
    await expect(byline).toBeVisible();
  });

  test('logo remains at top during scroll (sticky behavior)', async ({ page }) => {
    const logo = page.locator('[data-testid="floating-logo"]');

    // Get initial position
    const initialBox = await logo.boundingBox();
    expect(initialBox).toBeTruthy();
    const initialTop = initialBox!.y;

    // Scroll down the page
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(100); // Allow scroll to settle

    // Logo should remain at same position (sticky sticks to top)
    const scrolledBox = await logo.boundingBox();
    expect(scrolledBox).toBeTruthy();
    expect(scrolledBox!.y).toBe(initialTop);
  });

  test('logo is positioned at top of viewport', async ({ page }) => {
    const logo = page.locator('[data-testid="floating-logo"]');
    const box = await logo.boundingBox();

    expect(box).toBeTruthy();
    // Should be at or very near the top (within 5px tolerance)
    expect(box!.y).toBeLessThanOrEqual(5);
  });

  test('glassmorphism effect is visible', async ({ page }) => {
    const logo = page.locator('[data-testid="floating-logo"]');

    // Check for glassmorphism classes (heavy blur + saturation + semi-transparent bg)
    const classList = await logo.getAttribute('class');
    expect(classList).toContain('backdrop-blur-2xl');
    expect(classList).toContain('backdrop-saturate-150');
    expect(classList).toContain('bg-white/60');
  });

  test('dark mode styling works correctly', async ({ page }) => {
    // Enable dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await page.waitForSelector('[data-testid="floating-logo"]');

    const logo = page.locator('[data-testid="floating-logo"]');
    const classList = await logo.getAttribute('class');

    // Should have dark mode glassmorphism background
    expect(classList).toContain('dark:bg-gray-950/50');
  });

  test('logo has proper z-index layering', async ({ page }) => {
    const logo = page.locator('[data-testid="floating-logo"]');

    // Check z-index class
    const classList = await logo.getAttribute('class');
    expect(classList).toContain('z-40');

    // Verify computed z-index
    const zIndex = await logo.evaluate(el => window.getComputedStyle(el).zIndex);
    expect(parseInt(zIndex)).toBeGreaterThan(0);
  });

  test('logo is interactive (sticky header accepts pointer events)', async ({ page }) => {
    const logo = page.locator('[data-testid="floating-logo"]');
    const classList = await logo.getAttribute('class');

    // Sticky header participates in layout and accepts pointer events
    // (unlike the old fixed header which used pointer-events-none)
    expect(classList).toContain('sticky');
    expect(classList).not.toContain('pointer-events-none');
  });

  test('typography fonts are applied', async ({ page }) => {
    // Check main text has brush font class
    const mainText = page.locator('h1:has-text("Clack Track")');
    const mainClass = await mainText.getAttribute('class');
    expect(mainClass).toContain('font-brush');

    // Check byline has display font class
    const byline = page.locator('text=BY HOUSEBOY');
    const bylineClass = await byline.getAttribute('class');
    expect(bylineClass).toContain('font-display');
  });

  test('responsive typography on different viewport sizes', async ({ page }) => {
    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForSelector('[data-testid="floating-logo"]');

    const mainTextMobile = page.locator('h1:has-text("Clack Track")');
    const mobileClass = await mainTextMobile.getAttribute('class');
    expect(mobileClass).toContain('text-4xl');

    // Test desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    await page.waitForSelector('[data-testid="floating-logo"]');

    const mainTextDesktop = page.locator('h1:has-text("Clack Track")');
    const desktopClass = await mainTextDesktop.getAttribute('class');
    expect(desktopClass).toContain('md:text-5xl');
  });

  test('visual regression - logo appearance', async ({ page }) => {
    // Take screenshot for visual regression testing
    const logo = page.locator('[data-testid="floating-logo"]');
    await expect(logo).toHaveScreenshot('floating-logo-light.png');
  });

  test('visual regression - dark mode', async ({ page }) => {
    // Enable dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await page.waitForSelector('[data-testid="floating-logo"]');

    // Take screenshot for visual regression testing
    const logo = page.locator('[data-testid="floating-logo"]');
    await expect(logo).toHaveScreenshot('floating-logo-dark.png');
  });
});
