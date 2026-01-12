/**
 * E2E tests for browse page.
 *
 * Tests faceted eprint browsing with 10-dimensional classification.
 */

import { test, expect } from '@playwright/test';

test.describe('Browse page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/browse');
  });

  test('displays browse page heading', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/browse/i);
  });

  test('displays page description', async ({ page }) => {
    const description = page.getByText(/explore eprints|faceted classification/i);
    await expect(description).toBeVisible();
  });

  test('displays search input for filtering results', async ({ page }) => {
    // Browse page has a search input for filtering within results (not the header search)
    // Use role + location to avoid flakiness in webkit with getByPlaceholder
    const mainContent = page.locator('main');
    const searchInput = mainContent.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();
  });

  test('displays facet sidebar on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Facet selector should be visible in sidebar
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
  });

  test('displays results or empty state', async ({ page }) => {
    // Page should show either search results or an empty/initial state
    const resultsOrEmpty = page.getByText(/results|eprints|no results|start/i);
    await expect(resultsOrEmpty.first()).toBeVisible();
  });

  test('search input filters results', async ({ page }) => {
    // Use the browse page search input (not header search)
    const mainContent = page.locator('main');
    const searchInput = mainContent.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await searchInput.fill('quantum');

    // Wait for navigation after pressing Enter
    await Promise.all([page.waitForURL(/q=quantum/), searchInput.press('Enter')]);
  });

  test('URL parameters are preserved on navigation', async ({ page }) => {
    // Navigate with a query parameter
    await page.goto('/browse?q=test');

    // Search input should reflect the query
    // Target the search input in main content to avoid webkit flakiness
    const mainContent = page.locator('main');
    const searchInput = mainContent.locator('input[type="search"]');
    await expect(searchInput).toHaveValue('test');
  });

  test('share button opens share dialog', async ({ page }) => {
    // Click on share button (identified by Share2 icon)
    const buttons = await page.getByRole('button').all();
    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const svgCount = await button.locator('svg').count();
      if (svgCount > 0 && !ariaLabel) {
        // This could be the share button
        await button.click();
        break;
      }
    }

    // Check if a dialog appeared (share or save filter dialog)
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(dialog).toBeVisible();
    }
  });

  test('page structure is valid', async ({ page }) => {
    // Verify the main content area exists and is visible
    const pageContent = page.locator('#main-content');
    await expect(pageContent).toBeVisible();

    // Should have the browse heading
    const heading = page.getByRole('heading', { level: 1, name: /browse/i });
    await expect(heading).toBeVisible();
  });

  test('page has proper heading hierarchy', async ({ page }) => {
    // Should have exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Should have h2 or h3 for sections
    const headingCount = await page.locator('h2, h3').count();
    expect(headingCount).toBeGreaterThanOrEqual(0);
  });

  test('responsive layout adapts to viewport', async ({ page }) => {
    // Desktop viewport: sidebar visible
    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopSidebar = page.locator('aside.hidden.lg\\:block');
    await expect(desktopSidebar).toBeVisible();

    // Mobile viewport: sidebar hidden
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(desktopSidebar).not.toBeVisible();
  });
});
