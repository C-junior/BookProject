import { test, expect } from '@playwright/test';

test.describe('Navigation and Appearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate through bottom tabs', async ({ page }) => {
    // 1. Initial view should be Library
    await expect(page.locator('h1')).toContainText('Library');

    // 2. Click Store
    await page.click('button:has-text("Store")');
    await expect(page.locator('h1')).toContainText('Store');

    // 3. Click Skins
    await page.click('button:has-text("Skins")');
    await expect(page.locator('h1')).toContainText('Skins');
  });

  test('should switch to magic skin and persist', async ({ page }) => {
    // 1. Go to Skins
    await page.click('button:has-text("Skins")');
    
    // 2. Select Magic
    await page.click('text=Magic');
    
    // 3. Verify magic skin is active on root
    const root = page.locator('#root');
    await expect(root).toHaveAttribute('data-skin', 'magic');
    
    // 4. Navigate away to Store and confirm it persists
    await page.click('button:has-text("Store")');
    await expect(root).toHaveAttribute('data-skin', 'magic');
  });

  test('should display pro status in store', async ({ page }) => {
    // Navigate to Store
    await page.click('button:has-text("Store")');
    
    // Check if the store content is rendered (look for Synthborne)
    await expect(page.locator('text=Synthborne')).toBeVisible();
  });
});
