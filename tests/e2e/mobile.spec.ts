/**
 * E2E tests for mobile responsiveness.
 *
 * Tests responsive layouts and mobile-specific interactions.
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// MOBILE NAVIGATION
// =============================================================================

test.describe('Mobile Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('mobile header shows hamburger menu', async ({ page }) => {
    await page.goto('/');
    // On mobile, navigation is accessed via hamburger menu (Toggle menu button)
    const hamburgerMenu = page.getByRole('button', { name: 'Toggle menu' });
    await expect(hamburgerMenu).toBeVisible();
  });
});

// =============================================================================
// MOBILE FORMS
// =============================================================================

test.describe('Mobile Forms', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('submission wizard shows step progress on mobile', async ({ page }) => {
    await page.goto('/submit');
    // On mobile, should show step indicator like "Step 1 of 5: Files"
    const stepIndicator = page.getByText(/step\s*1/i).or(page.getByText(/1\s*of\s*5/i));
    await expect(stepIndicator).toBeVisible();
  });
});

// =============================================================================
// MOBILE SEARCH
// =============================================================================

test.describe('Mobile Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('filters collapsible is present on mobile search', async ({ page }) => {
    // Use 'semantics' which exists in seeded test data
    await page.goto('/search?q=semantics');
    await page.waitForLoadState('networkidle');

    // On mobile, filters are shown in a collapsible (not the aside which is hidden)
    // The mobile filters panel is inside a div with lg:hidden class
    const mobileFilters = page.locator('.lg\\:hidden').getByText('Filters');
    await expect(mobileFilters).toBeVisible();
  });

  test('search results are displayed on mobile', async ({ page }) => {
    // Use 'semantics' which exists in seeded test data
    await page.goto('/search?q=semantics');
    await page.waitForLoadState('networkidle');

    // On mobile, search results should be visible with result count
    await expect(page.getByText(/found.*\d+.*result/i).first()).toBeVisible();
  });
});
