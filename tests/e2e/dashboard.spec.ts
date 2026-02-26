import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app (will redirect to login if not authenticated)
    await page.goto('/');
  });

  test('shows login page when not authenticated', async ({ page }) => {
    // Should redirect to login or show login UI
    await expect(page).toHaveURL(/login|auth/);
  });
});

test.describe('Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Add proper authentication mock/fixture
    // For now, we test unauthenticated flows
  });

  test('displays practice overview header', async ({ page }) => {
    // After auth, should show dashboard
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for key dashboard elements (when authenticated)
    const header = page.locator('h1');
    await expect(header).toBeVisible({ timeout: 10000 });
  });
});
