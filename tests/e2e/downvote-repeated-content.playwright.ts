/**
 * Downvote "Repeated content" reason E2E test (Playwright)
 *
 * Validates the full flow: click thumbs-down -> select "Repeated content" ->
 * verify the vote is recorded with reason='repeated_content'.
 *
 * Requires the Express backend to be running for API and database access.
 *
 * Run with: npx playwright test tests/e2e/downvote-repeated-content.playwright.ts
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Set up auth bypass so the test user can vote without WebAuthn.
 */
async function setupAuthBypass(page: Page) {
  await page.setExtraHTTPHeaders({
    'X-Auth-Bypass': 'repeated-content-test@playwright.local',
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

test.describe('Downvote Repeated Content Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthBypass(page);
  });

  test('selecting "Repeated content" records vote with reason=repeated_content', async ({
    page,
  }) => {
    // This test requires the Express backend for voting API and database
    const backendUp = await isBackendAvailable(page);
    test.skip(!backendUp, 'Express backend not running - skipping voting E2E test');

    // Navigate to the home page where voting buttons are displayed
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for content to load (VotingButtons only render when authenticated and content exists)
    const thumbsDown = page.locator('button[aria-label="Thumbs down - Bad content"]');
    await expect(thumbsDown).toBeVisible({ timeout: 10000 });

    // Set up a promise to intercept the vote API request
    const voteRequestPromise = page.waitForRequest(
      request => request.url().includes('/api/vote') && request.method() === 'POST'
    );

    // Click the thumbs-down button to open the reason menu
    await thumbsDown.click();

    // The DownvoteReasonMenu popover should appear with "Repeated content" option
    const repeatedContentOption = page.getByText('Repeated content');
    await expect(repeatedContentOption).toBeVisible({ timeout: 5000 });

    // Click "Repeated content"
    await repeatedContentOption.click();

    // Wait for the vote API request and verify the payload
    const voteRequest = await voteRequestPromise;
    const requestBody = voteRequest.postDataJSON();

    expect(requestBody.vote).toBe('bad');
    expect(requestBody.reason).toBe('repeated_content');
  });

  test('renders "Repeated content" option in the downvote reason menu before "Other"', async ({
    page,
  }) => {
    // This test only needs the frontend, but auth is needed for voting buttons
    const backendUp = await isBackendAvailable(page);
    test.skip(!backendUp, 'Express backend not running - skipping voting UI test');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the thumbs-down button
    const thumbsDown = page.locator('button[aria-label="Thumbs down - Bad content"]');
    await expect(thumbsDown).toBeVisible({ timeout: 10000 });

    // Open the reason menu
    await thumbsDown.click();

    // Verify "Repeated content" is visible
    const repeatedOption = page.getByText('Repeated content');
    await expect(repeatedOption).toBeVisible();

    // Verify "Other" is also visible (it should come after)
    const otherOption = page.getByText('Other');
    await expect(otherOption).toBeVisible();

    // Verify DOM ordering: "Repeated content" appears before "Other"
    const allButtons = await page.locator('button').allTextContents();
    const repeatedIndex = allButtons.indexOf('Repeated content');
    const otherIndex = allButtons.indexOf('Other');

    expect(repeatedIndex).toBeGreaterThan(-1);
    expect(otherIndex).toBeGreaterThan(-1);
    expect(repeatedIndex).toBeLessThan(otherIndex);
  });
});
