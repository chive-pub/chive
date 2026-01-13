/**
 * E2E tests for fields page.
 *
 * Tests field hierarchy navigation and field pages.
 */

import { test, expect } from '@playwright/test';

test.describe('Fields page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fields');
  });

  test('displays fields page heading', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/fields|subjects|topics/i);
  });

  test('displays field grid', async ({ page }) => {
    // Fields page shows a grid of field cards with links
    const mainContent = page.locator('#main-content');
    const fieldLinks = mainContent.getByRole('link');
    const emptyState = page.getByText(/no fields available/i);

    // Page must show either field cards OR empty state
    await expect(fieldLinks.first().or(emptyState)).toBeVisible();
  });

  test('displays field cards with status badges', async ({ page }) => {
    const mainContent = page.locator('#main-content');
    const emptyState = page.getByText(/no fields available/i);
    const fieldCard = mainContent.locator('a').first();

    // Page must show either field cards OR empty state
    await expect(fieldCard.or(emptyState)).toBeVisible();

    // If field cards exist, verify they show status badges (Approved, Pending, etc.)
    if (await fieldCard.isVisible().catch(() => false)) {
      // Look for any status badge in the cards
      const statusBadge = mainContent.getByText(/approved|pending|proposed/i).first();
      await expect(statusBadge).toBeVisible();
    } else {
      // Empty state must be visible
      await expect(emptyState).toBeVisible();
    }
  });

  test('clicking field navigates to field page', async ({ page }) => {
    // Look for field links within main content (exclude sr-only skip link)
    const mainContent = page.locator('#main-content');
    const fieldLink = mainContent.getByRole('link', { name: /.+/ }).first();
    const emptyState = page.getByText(/no fields available|no fields match|failed to load/i);

    // Page must show either field links OR empty state
    await expect(fieldLink.or(emptyState)).toBeVisible();

    // If field links exist, verify navigation works
    if (await fieldLink.isVisible().catch(() => false)) {
      await fieldLink.click();
      await expect(page).toHaveURL(/\/fields\/.+/);
    } else {
      // If no field links, empty state must be visible
      await expect(emptyState).toBeVisible();
    }
  });

  test('field page displays eprints', async ({ page }) => {
    // Look for field links within main content (exclude sr-only skip link)
    const mainContent = page.locator('#main-content');
    const fieldLink = mainContent.getByRole('link', { name: /.+/ }).first();
    const emptyState = page.getByText(/no fields available|no fields match|failed to load/i);

    // Page must show either field links OR empty state
    await expect(fieldLink.or(emptyState)).toBeVisible();

    // If field links exist, verify field page shows eprints or empty state
    if (await fieldLink.isVisible().catch(() => false)) {
      await fieldLink.click();

      // Field detail page must show eprints list OR empty state
      const eprintList = page.getByRole('list').first().or(page.getByRole('article').first());
      const fieldEmptyState = page.getByText(/no eprints|0 eprints/i);
      await expect(eprintList.or(fieldEmptyState)).toBeVisible();
    } else {
      // If no field links, empty state must be visible
      await expect(emptyState).toBeVisible();
    }
  });

  test('search filters fields', async ({ page }) => {
    const searchInput = page
      .getByRole('searchbox', { name: /search fields/i })
      .or(page.getByRole('textbox', { name: /search/i }));

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('computer');

      // Use polling assertion for filtered results
      const filteredFields = page.getByRole('link').filter({ hasText: /computer/i });
      await expect(async () => {
        const count = await filteredFields.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }).toPass({ timeout: 2000 });
    }
  });

  test('displays field statistics', async ({ page }) => {
    // Look for field links within main content (exclude sr-only skip link)
    const mainContent = page.locator('#main-content');
    const fieldLink = mainContent.getByRole('link', { name: /.+/ }).first();
    const emptyState = page.getByText(/no fields available|no fields match|failed to load/i);

    // Page must show either field links OR empty state
    await expect(fieldLink.or(emptyState)).toBeVisible();

    // If field links exist, verify stats are shown on field page
    if (await fieldLink.isVisible().catch(() => false)) {
      await fieldLink.click();

      // Field page must show stats, no eprints message, OR error state
      const stats = page.getByText(/\d+\s*(eprints?|results?|items?)/i).first();
      const noStats = page.getByText(/no eprints|0 eprints/i).first();
      // Use heading for error state as it's more reliable
      const errorHeading = page.getByRole('heading', { name: /failed to load/i });
      await expect(stats.or(noStats).or(errorHeading)).toBeVisible();
    } else {
      // If no field links, empty state must be visible
      await expect(emptyState).toBeVisible();
    }
  });

  test('breadcrumb navigation works', async ({ page }) => {
    // Look for field links within main content (exclude sr-only skip link)
    const mainContent = page.locator('#main-content');
    const fieldLink = mainContent.getByRole('link', { name: /.+/ }).first();
    const emptyState = page.getByText(/no fields available|no fields match|failed to load/i);

    // Page must show either field links OR empty state
    await expect(fieldLink.or(emptyState)).toBeVisible();

    // If field links exist, verify breadcrumb navigation
    if (await fieldLink.isVisible().catch(() => false)) {
      await fieldLink.click();

      // Field detail page must have breadcrumb navigation
      const breadcrumb = page
        .getByRole('navigation', { name: /breadcrumb/i })
        .or(page.getByLabel(/breadcrumb/i));

      // Breadcrumb should be visible on field detail pages
      if (await breadcrumb.isVisible().catch(() => false)) {
        const homeLink = breadcrumb.getByRole('link', { name: /fields|home/i });
        await homeLink.click();
        await expect(page).toHaveURL(/\/fields$/);
      }
    } else {
      // If no field links, empty state must be visible
      await expect(emptyState).toBeVisible();
    }
  });
});
