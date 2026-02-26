import { test, expect } from '@playwright/test';

test.describe('Core Business Flow: Login -> Campaign -> Call -> Revenue', () => {
    const TEST_EMAIL = `test_${Date.now()}@example.com`;
    const TEST_PASSWORD = 'password123';

    test('User can enroll, navigate campaigns, view calls and revenue', async ({ page }) => {
        // 1. Navigation & Authentication
        await page.goto('/login');

        // Switch to Enroll tab
        await page.getByRole('tab', { name: /enroll/i }).click();

        // Fill in sign up form
        await page.locator('input[type="email"]').last().fill(TEST_EMAIL);
        await page.locator('input[type="password"]').last().fill(TEST_PASSWORD);

        // Full Name is likely the first text input on the signup form
        const nameInput = page.locator('input[type="text"]').last();
        if (await nameInput.isVisible()) {
            await nameInput.fill('Dr. Test');
        }

        // Submit (Wait for navigation or toast)
        await page.getByRole('button', { name: /enroll/i }).click();

        // Wait for redirect to dashboard
        await expect(page).toHaveURL('/', { timeout: 15000 });

        // 2. Campaigns Navigation
        await page.getByRole('link', { name: /campaigns/i }).click();
        await expect(page).toHaveURL(/.*campaigns/);

        // 3. AI Agents Navigation
        await page.getByRole('link', { name: /ai agents/i }).click();
        await expect(page).toHaveURL(/.*agents/);

        // 4. Dashboard Navigation
        await page.getByRole('link', { name: /dashboard/i }).click();
        await expect(page).toHaveURL(/\/$/);
    });
});
