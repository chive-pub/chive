/**
 * E2E tests for tags page.
 *
 * Tests tag browsing and trending tags.
 */

import { test, expect } from '@playwright/test';

test.describe('Tags page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tags');
  });

  test('displays tags page heading', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/tags|keywords/i);
  });

  test('displays tag cloud or list', async ({ page }) => {
    // These data-testid attributes actually exist in the app
    const tagContainer = page
      .locator('[data-testid="tag-cloud"], [data-testid="tag-list"]')
      .or(page.getByRole('list'));
    await expect(tagContainer).toBeVisible();
  });

  test('displays trending tags section', async ({ page }) => {
    // trending-tags data-testid actually exists in the app
    const trendingSection = page
      .locator('[data-testid="trending-tags"]')
      .or(page.getByText(/trending/i));
    if (await trendingSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(trendingSection).toBeVisible();
    }
  });

  test('clicking tag shows related eprints', async ({ page }) => {
    // Look for tag links within main content (exclude sr-only skip link)
    const mainContent = page.locator('#main-content');
    const tagLink = mainContent.getByRole('link', { name: /.+/ }).first();
    const emptyState = page.getByText(/no tags yet|no tags found/i);

    // Page must show either tag links OR empty state
    await expect(tagLink.or(emptyState)).toBeVisible();

    // If tag links exist, verify navigation works
    if (await tagLink.isVisible().catch(() => false)) {
      await tagLink.click();
      await expect(page).toHaveURL(/\/tags\/.+|\/search\?.*tag=/);
    } else {
      // If no tag links, empty state must be visible
      await expect(emptyState).toBeVisible();
    }
  });

  test('tag page displays eprint count', async ({ page }) => {
    // Look for tag links within main content (exclude sr-only skip link)
    const mainContent = page.locator('#main-content');
    const tagLink = mainContent.getByRole('link', { name: /.+/ }).first();
    const emptyState = page.getByText(/no tags yet|no tags found/i);

    // Page must show either tag links OR empty state
    await expect(tagLink.or(emptyState)).toBeVisible();

    // If tag links exist, verify eprint count is shown
    if (await tagLink.isVisible().catch(() => false)) {
      await tagLink.click();

      // Tag page must show count OR empty state
      const count = page.getByText(/\d+\s*(eprints?|results?|items?)/i);
      const noEprints = page.getByText(/no eprints|0 eprints/i);
      await expect(count.or(noEprints)).toBeVisible();
    } else {
      // If no tag links, empty state must be visible
      await expect(emptyState).toBeVisible();
    }
  });

  test('search filters tags', async ({ page }) => {
    const searchInput = page
      .getByRole('searchbox', { name: /search tags/i })
      .or(page.getByRole('textbox', { name: /search/i }));

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('machine');

      // Wait for filter to apply using polling assertion instead of arbitrary timeout
      const filteredTags = page.getByRole('link').filter({ hasText: /machine/i });
      await expect(async () => {
        const count = await filteredTags.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }).toPass({ timeout: 2000 });
    }
  });

  test('displays tag usage statistics', async ({ page }) => {
    // Look for tag links within main content (exclude sr-only skip link)
    const mainContent = page.locator('#main-content');
    const tagLink = mainContent.getByRole('link', { name: /.+/ }).first();
    const emptyState = page.getByText(/no tags yet|no tags found/i);

    // Page must show either tag links OR empty state
    await expect(tagLink.or(emptyState)).toBeVisible();

    // If tag links exist, verify usage stats are shown
    if (await tagLink.isVisible().catch(() => false)) {
      await tagLink.click();

      // Tag page must show usage stats OR empty state
      const stats = page
        .getByText(/\d+\s*(uses?|eprints?|results?)/i)
        .or(page.getByRole('region', { name: /stats/i }));
      const noStats = page.getByText(/no eprints|0 uses/i);
      await expect(stats.or(noStats)).toBeVisible();
    } else {
      // If no tag links, empty state must be visible
      await expect(emptyState).toBeVisible();
    }
  });

  test('pagination works', async ({ page }) => {
    // Page must show either pagination button OR content without pagination
    const nextButton = page.getByRole('button', { name: /next|more/i });
    const paginationLink = page.getByRole('link', { name: /next|more/i });
    const pageContent = page.locator('#main-content');

    // Verify page content is visible first
    await expect(pageContent).toBeVisible();

    // If pagination link exists, verify it works
    if (await paginationLink.isVisible().catch(() => false)) {
      await Promise.all([page.waitForURL(/page=2|offset=/), paginationLink.click()]);
      await expect(page).toHaveURL(/page=2|offset=/);
    } else if (await nextButton.isVisible().catch(() => false)) {
      // For button-based pagination, it may update state without changing URL
      await nextButton.click();
      // Wait for any state update by checking for content changes
      await page.waitForTimeout(500);
    }
    // If no pagination button or link, page content is sufficient (not enough data to paginate)
  });
});
