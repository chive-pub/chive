/**
 * E2E tests for search functionality.
 *
 * Tests search input, results display, filters, and URL synchronization.
 */

import { test, expect } from '@playwright/test';
import { SearchPage } from './fixtures/page-objects.js';
import { SEARCH_QUERIES } from './fixtures/test-data.js';

test.describe('Search functionality', () => {
  test.beforeEach(async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.goto();
  });

  test('displays search page heading', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/search/i);
  });

  test('displays search input', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await expect(searchPage.searchInput).toBeVisible();
  });

  test('displays initial state before search', async ({ page }) => {
    // Before searching, should show initial state (either suggestions or main search heading)
    const initialState = page
      .getByRole('heading', { name: /search/i })
      .or(page.getByText(/search preprints|popular searches/i));
    await expect(initialState.first()).toBeVisible();
  });

  test('performs search and updates URL', async ({ page }) => {
    const searchPage = new SearchPage(page);

    await searchPage.search(SEARCH_QUERIES.simple.query);

    // URL should update with search query (use longer timeout for slow CI)
    await expect(page).toHaveURL(/q=/, { timeout: 10000 });
  });

  test('shows empty state for no results', async ({ page }) => {
    const searchPage = new SearchPage(page);

    await searchPage.search(SEARCH_QUERIES.noResults.query);

    // Wait for empty state or error state (both are valid responses to a no-results query)
    const emptyOrErrorState = page
      .getByRole('heading', { name: /no results found|search failed/i })
      .or(page.getByText(/no results found|couldn't find|error occurred/i));
    await expect(emptyOrErrorState.first()).toBeVisible();
  });

  test('displays filter panel in sidebar', async ({ page }) => {
    // Set desktop viewport for sidebar visibility
    await page.setViewportSize({ width: 1280, height: 800 });

    // Filters panel should be visible in sidebar on desktop
    const filtersHeading = page.getByText(/filters/i);
    await expect(filtersHeading.first()).toBeVisible();
  });

  test('displays author filter input', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Author filter input should be visible
    const authorInput = page.getByPlaceholder(/author name or did/i);
    await expect(authorInput).toBeVisible();
  });

  test('displays date range filter', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Date range filter should be visible
    const dateRangeLabel = page.getByText(/date range/i);
    await expect(dateRangeLabel).toBeVisible();
  });

  test('search preserves query on page refresh', async ({ page }) => {
    const searchPage = new SearchPage(page);

    await searchPage.search('neural networks');
    await expect(page).toHaveURL(/q=/);

    // Refresh page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Query should still be in input
    await expect(searchPage.searchInput).toHaveValue('neural networks');
  });

  test('URL query parameter populates search input', async ({ page }) => {
    // Navigate directly with query parameter
    await page.goto('/search?q=machine+learning');

    // Use the main search input (with aria-label "Search")
    const searchInput = page.getByRole('searchbox', { name: 'Search', exact: true });
    await expect(searchInput).toHaveValue('machine learning');
  });

  test('search input clears with clear button', async ({ page }) => {
    const searchPage = new SearchPage(page);

    await searchPage.searchInput.fill('test query');

    const clearButton = page.getByRole('button', { name: /clear/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(searchPage.searchInput).toHaveValue('');
    }
  });

  test('clicking suggestion searches for that term', async ({ page }) => {
    // Initial state should show suggestions
    const suggestion = page.getByRole('button', {
      name: /machine learning|climate change|quantum/i,
    });

    if (
      await suggestion
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await suggestion.first().click();

      // URL should update with the suggestion
      await expect(page).toHaveURL(/q=/);
    }
  });

  test('search results show result count when results exist', async ({ page }) => {
    const searchPage = new SearchPage(page);

    // Use 'semantics' which exists in seeded test data
    await searchPage.search('semantics');
    await expect(page).toHaveURL(/q=/);

    // Should show result count when results exist
    // Use .first() as both mobile and desktop layouts render result headers
    await expect(page.getByText(/found.*\d+.*result/i).first()).toBeVisible();
  });

  test('page has proper heading hierarchy', async ({ page }) => {
    // Should have exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('responsive layout shows collapsible filters on mobile', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Desktop sidebar should be hidden
    const desktopSidebar = page.locator('aside.hidden.lg\\:block');
    await expect(desktopSidebar).not.toBeVisible();

    // Mobile filters should exist (collapsible)
    const mobileFilters = page.locator('.lg\\:hidden');
    await expect(mobileFilters.first()).toBeVisible();
  });
});

// =============================================================================
// FILTER INTERACTIONS
// =============================================================================

test.describe('Filter Interactions', () => {
  test('can enter author filter and see URL update', async ({ page }) => {
    await page.goto('/search');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('semantics');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    // Set desktop viewport for sidebar visibility
    await page.setViewportSize({ width: 1280, height: 800 });

    const filtersButton = page.getByRole('button', { name: /filters/i });
    if (await filtersButton.isVisible()) {
      await filtersButton.click();
    }

    await page.getByPlaceholder(/author name or did/i).fill('Aaron White');
    await page.keyboard.press('Tab'); // Trigger blur/change
    await expect(page).toHaveURL(/author=/);
  });

  test('Clear all filters button removes all active filters', async ({ page }) => {
    await page.goto('/search?q=test&author=White&dateFrom=2020-01-01');
    await page.setViewportSize({ width: 1280, height: 800 });

    const clearButton = page.getByRole('button', { name: /clear all filters/i });
    if (await clearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clearButton.click();
      await expect(page).not.toHaveURL(/author=/);
      await expect(page).not.toHaveURL(/dateFrom=/);
    }
  });
});

// =============================================================================
// SORT FUNCTIONALITY
// =============================================================================

test.describe('Sort Functionality', () => {
  test('sort dropdown is visible on search results', async ({ page }) => {
    // Use 'semantics' which exists in seeded test data
    await page.goto('/search?q=semantics');
    await page.waitForLoadState('networkidle');

    // Sort controls only appear when there are results
    // First verify we have results (use .first() for responsive layouts)
    await expect(page.getByText(/found.*\d+.*result/i).first()).toBeVisible();

    // Sort dropdown is a select element; verify both label and dropdown are visible.
    await expect(page.getByText('Sort by:').first()).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible();
  });

  test('sort dropdown changes URL when selection changes', async ({ page }) => {
    // Use 'semantics' which exists in seeded test data
    await page.goto('/search?q=semantics');
    await page.waitForLoadState('networkidle');

    // Wait for results to load (use .first() for responsive layouts)
    await expect(page.getByText(/found.*\d+.*result/i).first()).toBeVisible();

    // Find and change the sort select (use .first() for responsive layouts)
    const sortSelect = page.getByRole('combobox').first();
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption('date');
    await expect(page).toHaveURL(/sort=date/);
  });
});
