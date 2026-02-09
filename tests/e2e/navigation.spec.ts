import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('sidebar has all navigation items', async ({ page }) => {
        // Check for key navigation links
        const navItems = [
            'Dashboard',
            'Calendar',
            'Patients',
            'Call History',
            'Tasks',
            'Analytics',
            'Settings'
        ];

        for (const item of navItems) {
            await expect(page.locator(`text=${item}`).first()).toBeVisible();
        }
    });

    test('clicking nav items changes page', async ({ page }) => {
        // Click Calendar
        await page.click('text=Calendar');
        await expect(page).toHaveURL(/calendar/);

        // Click Patients
        await page.click('text=Patients');
        await expect(page).toHaveURL(/patients/);
    });

    test('sidebar collapse works', async ({ page }) => {
        // Find collapse button
        const collapseBtn = page.locator('text=Collapse').first();

        if (await collapseBtn.isVisible()) {
            await collapseBtn.click();
            // After collapse, text should be hidden
            await expect(page.locator('text=Dashboard')).not.toBeVisible();
        }
    });
});
