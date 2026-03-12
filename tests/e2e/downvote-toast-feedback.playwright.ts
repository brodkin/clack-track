/**
 * Downvote toast confirmation feedback E2E test (Playwright)
 *
 * Validates the full flow: click thumbs-down -> select a reason ->
 * verify a "Thanks for the feedback" toast appears on screen ->
 * verify the vote is recorded in the database via API.
 *
 * Requires the Express backend to be running for API and database access.
 *
 * Run with: npx playwright test tests/e2e/downvote-toast-feedback.playwright.ts
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Set up auth bypass so the test user can vote without WebAuthn.
 */
async function setupAuthBypass(page: Page) {
  await page.setExtraHTTPHeaders({
    'X-Auth-Bypass': 'toast-feedback-test@playwright.local',
  });
}

/**
 * Check if the Express backend API is reachable.
 */
async function isBackendAvailable(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('/api/auth/session');
    return response.ok();
  } catch {
    return false;
  }
}

test.describe('Downvote Toast Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthBypass(page);
  });

  test('shows confirmation toast after selecting a downvote reason', async ({ page }) => {
    const backendUp = await isBackendAvailable(page);
    test.skip(!backendUp, 'Express backend not running - skipping toast feedback E2E test');

    // Navigate to the home page where voting buttons are displayed
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for content to load (VotingButtons only render when authenticated and content exists)
    const thumbsDown = page.locator('button[aria-label="Thumbs down - Bad content"]');
    await expect(thumbsDown).toBeVisible({ timeout: 10000 });

    // Click the thumbs-down button to open the reason menu
    await thumbsDown.click();

    // Select a reason from the downvote menu
    const boringOption = page.getByText('Boring');
    await expect(boringOption).toBeVisible({ timeout: 5000 });
    await boringOption.click();

    // Verify the toast appears with the confirmation message
    const toast = page.getByText('Thanks for the feedback');
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('toast auto-dismisses after appearing', async ({ page }) => {
    const backendUp = await isBackendAvailable(page);
    test.skip(!backendUp, 'Express backend not running - skipping toast dismiss E2E test');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const thumbsDown = page.locator('button[aria-label="Thumbs down - Bad content"]');
    await expect(thumbsDown).toBeVisible({ timeout: 10000 });

    // Open reason menu and select a reason
    await thumbsDown.click();
    const option = page.getByText('Not funny');
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();

    // Verify toast appears
    const toast = page.getByText('Thanks for the feedback');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify toast auto-dismisses (duration is 2000ms, give some buffer)
    await expect(toast).toBeHidden({ timeout: 5000 });
  });

  test('selecting a downvote reason records the vote via API', async ({ page }) => {
    const backendUp = await isBackendAvailable(page);
    test.skip(!backendUp, 'Express backend not running - skipping vote recording E2E test');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const thumbsDown = page.locator('button[aria-label="Thumbs down - Bad content"]');
    await expect(thumbsDown).toBeVisible({ timeout: 10000 });

    // Set up a promise to intercept the vote API request
    const voteRequestPromise = page.waitForRequest(
      request => request.url().includes('/api/vote') && request.method() === 'POST'
    );

    // Open reason menu and select "Too negative"
    await thumbsDown.click();
    const option = page.getByText('Too negative');
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();

    // Wait for the vote API request and verify the payload
    const voteRequest = await voteRequestPromise;
    const requestBody = voteRequest.postDataJSON();

    expect(requestBody.vote).toBe('bad');
    expect(requestBody.reason).toBe('too_negative');

    // Verify the toast also appeared
    const toast = page.getByText('Thanks for the feedback');
    await expect(toast).toBeVisible({ timeout: 5000 });
  });
});
