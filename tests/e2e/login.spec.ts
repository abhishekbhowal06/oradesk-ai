import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
    test('shows login form', async ({ page }) => {
        await page.goto('/login');

        // Check for login form elements
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('shows error on invalid credentials', async ({ page }) => {
        await page.goto('/login');

        // Fill in invalid credentials
        await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
        await page.fill('input[type="password"]', 'wrongpassword');

        // Submit form
        await page.click('button[type="submit"]');

        // Should show error message
        await expect(page.locator('text=/error|invalid|incorrect/i')).toBeVisible({ timeout: 5000 });
    });

    test('password field masks input', async ({ page }) => {
        await page.goto('/login');

        const passwordInput = page.locator('input[type="password"]');
        await expect(passwordInput).toHaveAttribute('type', 'password');
    });
});
