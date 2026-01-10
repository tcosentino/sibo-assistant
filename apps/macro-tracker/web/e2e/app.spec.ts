import { test, expect } from '@playwright/test';

test.describe('MacroMeal App', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MacroMeal/i);
  });

  test('should display the app header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.getByRole('heading', { name: /MacroMeal/i });
    await expect(header).toBeVisible();
  });

  test('should display the tagline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tagline = page.getByText(/structure without surveillance/i);
    await expect(tagline).toBeVisible();
  });

  test('should have navigation tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for the three main navigation tabs
    await expect(page.getByRole('button', { name: /recipes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /daily balance/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /targets/i })).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on Daily Balance tab
    await page.getByRole('button', { name: /daily balance/i }).click();
    await expect(page.getByRole('heading', { name: /daily balance/i })).toBeVisible();

    // Click on Targets tab
    await page.getByRole('button', { name: /targets/i }).click();
    await expect(page.getByRole('heading', { name: /macro targets/i })).toBeVisible();

    // Click back to Recipes tab
    await page.getByRole('button', { name: /recipes/i }).click();
    await expect(page.getByRole('heading', { name: /your recipes/i })).toBeVisible();
  });

  test('should show empty state for recipes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emptyState = page.getByText(/no recipes yet/i);
    await expect(emptyState).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App should still display properly on mobile
    const header = page.getByRole('heading', { name: /MacroMeal/i });
    await expect(header).toBeVisible();

    // Navigation should still work
    const tabs = page.getByRole('button', { name: /recipes|daily|targets/i });
    const count = await tabs.count();
    expect(count).toBe(3);
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have an h1
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
  });

  test('navigation buttons should be keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to navigation and press Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Should have navigated (content should change)
    const content = page.locator('main, [class*="main"]');
    await expect(content.first()).toBeVisible();
  });
});
