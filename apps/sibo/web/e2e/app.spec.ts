import { test, expect } from '@playwright/test';

test.describe('SIBO Food Guide', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SIBO|Food Guide/i);
  });

  test('should display food categories', async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    // Check that filter tabs are visible
    const filterSection = page.locator('[class*="filter"], [class*="tab"], nav');
    await expect(filterSection.first()).toBeVisible();
  });

  test('should have a search bar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });

  test('should filter foods when searching', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('chicken');

    // Wait for results to filter
    await page.waitForTimeout(300);

    // Check that results are shown
    const results = page.locator('[class*="food"], [class*="card"], [class*="item"]');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App should still be functional on mobile
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });
});

test.describe('Chat Feature', () => {
  test('should have a chat interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for chat button or chat window
    const chatElement = page.locator('[class*="chat"], button:has-text("chat"), [aria-label*="chat"]');
    const isVisible = await chatElement.first().isVisible().catch(() => false);

    // Chat feature should exist (either visible or accessible)
    expect(isVisible || await chatElement.count() > 0).toBeTruthy();
  });
});
