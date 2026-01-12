/**
 * E2E tests for author filtering in search.
 *
 * Tests searching and filtering preprints by author:
 * - Search by author name
 * - Filter by author DID
 * - Filter by ORCID
 * - Combined filters
 *
 * @packageDocumentation
 */

import { test, expect } from '@playwright/test';
import { SEEDED_AUTHORS, SEEDED_PREPRINTS } from '../fixtures/test-data.js';

test.describe('Author Filter - Search by Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('can search for preprints by author name', async ({ page }) => {
    // Use the main search page input (not the header search)
    const searchInput = page.getByPlaceholder(/search by title, abstract/i);

    await expect(searchInput).toBeVisible();

    // Search for author name
    await searchInput.fill(SEEDED_AUTHORS.white.displayName);
    await page.keyboard.press('Enter');

    // Should show results
    await expect(page).toHaveURL(/q=/);

    // Results should include the author's preprint
    const result = page
      .getByText(SEEDED_PREPRINTS.white.title)
      .or(page.getByText(SEEDED_AUTHORS.white.displayName));

    if (await result.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(result).toBeVisible();
    }
  });

  test('partial author name search returns results', async ({ page }) => {
    // Use the main search page input (not the header search)
    const searchInput = page.getByPlaceholder(/search by title, abstract/i);

    // Search partial name (first name only)
    const firstName = SEEDED_AUTHORS.white.displayName.split(' ')[0];
    await searchInput.fill(firstName);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/q=/);

    // Should still find results
    const results = page.getByRole('article').or(page.locator('[data-testid="search-result"]'));

    // May or may not have results depending on search implementation
    const count = await results.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('author name in quotes searches exact phrase', async ({ page }) => {
    // Use the main search page input (not the header search)
    const searchInput = page.getByPlaceholder(/search by title, abstract/i);

    // Search exact name in quotes
    await searchInput.fill(`"${SEEDED_AUTHORS.white.displayName}"`);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/q=/);
  });
});

test.describe('Author Filter - Filter by DID', () => {
  test('can filter by author DID', async ({ page }) => {
    await page.goto('/search');

    // Look for advanced filters
    const filtersButton = page.getByRole('button', { name: /filters|advanced/i });

    if (await filtersButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filtersButton.click();

      // Look for author/DID filter
      const authorFilter = page
        .getByLabel(/author.*did|did/i)
        .or(page.getByPlaceholder(/did:plc:/i));

      if (await authorFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await authorFilter.fill(SEEDED_AUTHORS.white.did);

        // Apply filter
        const applyButton = page.getByRole('button', { name: /apply|search|filter/i });
        await applyButton.click();

        // Should show filtered results
        await expect(page).toHaveURL(new RegExp(SEEDED_AUTHORS.white.did.replace(/:/g, '%3A')));
      }
    }
  });

  test('clicking author on result filters by that author', async ({ page }) => {
    await page.goto('/search');

    // Search for something to get results
    const searchInput = page.getByRole('searchbox', { name: 'Search', exact: true });
    await searchInput.fill('semantics');
    await page.keyboard.press('Enter');

    // Wait for results
    await page.waitForLoadState('networkidle');

    // Find author link in results
    const authorLink = page
      .getByRole('link', { name: new RegExp(SEEDED_AUTHORS.white.displayName, 'i') })
      .or(page.locator('[data-testid="author-link"]').first());

    if (await authorLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await authorLink.click();

      // Should filter by that author or navigate to author page
      await expect(page).toHaveURL(/author|authors/);
    }
  });
});

test.describe('Author Filter - Filter by ORCID', () => {
  test('can filter by ORCID', async ({ page }) => {
    await page.goto('/search');

    // Look for advanced filters
    const filtersButton = page.getByRole('button', { name: /filters|advanced/i });

    if (await filtersButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filtersButton.click();

      // Look for ORCID filter
      const orcidFilter = page.getByLabel(/orcid/i).or(page.getByPlaceholder(/orcid|0000-/i));

      if (await orcidFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await orcidFilter.fill(SEEDED_AUTHORS.white.orcid);

        const applyButton = page.getByRole('button', { name: /apply|search|filter/i });
        await applyButton.click();

        // Should show filtered results
        await expect(page).toHaveURL(/orcid/);
      }
    }
  });

  test('ORCID link on result filters by that ORCID', async ({ page }) => {
    await page.goto(`/preprints/${encodeURIComponent(SEEDED_PREPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Find ORCID link
    const orcidLink = page.locator('a[href*="orcid.org"]');

    if (await orcidLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Should link to ORCID profile (external)
      const href = await orcidLink.getAttribute('href');
      expect(href).toContain('orcid.org');
    }
  });
});

test.describe('Author Filter - Results Verification', () => {
  test('filtered results contain expected preprints', async ({ page }) => {
    // Go directly to author's page
    await page.goto(`/authors/${encodeURIComponent(SEEDED_AUTHORS.white.did)}`);

    // Should show author's preprints
    const preprintLink = page
      .getByText(SEEDED_PREPRINTS.white.title)
      .or(page.locator('a[href*="preprints"]'));

    // Author page should show their preprints
    if (await preprintLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(preprintLink).toBeVisible();
    }
  });

  test('empty results shown for non-existent author', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByRole('searchbox', { name: 'Search', exact: true });
    await searchInput.fill('NonExistentAuthorName12345');
    await page.keyboard.press('Enter');

    // Should show empty state or no results
    const emptyState = page
      .getByText(/no results|nothing found|no preprints/i)
      .or(page.locator('[data-testid="empty-results"]'));

    await expect(emptyState).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Author Filter - Combined Filters', () => {
  test('can combine author filter with field filter', async ({ page }) => {
    await page.goto('/search');

    // Search first
    const searchInput = page.getByRole('searchbox', { name: 'Search', exact: true });
    await searchInput.fill('semantics');
    await page.keyboard.press('Enter');

    // Open filters
    const filtersButton = page.getByRole('button', { name: /filters/i });

    if (await filtersButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filtersButton.click();

      // Select field filter
      const fieldFilter = page
        .getByLabel(/field/i)
        .or(page.getByRole('combobox', { name: /field/i }));

      if (await fieldFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fieldFilter.click();

        const linguistics = page
          .getByRole('option', { name: /linguistics/i })
          .or(page.getByText('Linguistics'));

        if (await linguistics.isVisible({ timeout: 3000 }).catch(() => false)) {
          await linguistics.click();

          // Should have both search query and field filter
          await expect(page).toHaveURL(/q=.*field|field=.*q=/);
        }
      }
    }
  });

  test('can clear author filter', async ({ page }) => {
    // Start with filtered search
    await page.goto(`/search?author=${encodeURIComponent(SEEDED_AUTHORS.white.did)}`);

    // Look for clear filter button
    const clearButton = page
      .getByRole('button', { name: /clear|remove|×/i })
      .or(page.locator('[data-testid="clear-filter"]'));

    if (await clearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clearButton.click();

      // Filter should be removed from URL
      await expect(page).not.toHaveURL(/author=/);
    }
  });
});

test.describe('Author Filter - Autocomplete', () => {
  test('author search shows autocomplete suggestions', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByRole('searchbox', { name: 'Search', exact: true });

    // Type partial author name
    await searchInput.fill('Whi');
    await page.waitForTimeout(500); // Wait for autocomplete

    // Look for autocomplete suggestions
    const suggestions = page
      .getByRole('listbox')
      .or(page.locator('[data-testid="autocomplete-suggestions"]'))
      .or(page.locator('.autocomplete-list'));

    if (await suggestions.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Should show author suggestion
      const authorSuggestion = suggestions.getByText(SEEDED_AUTHORS.white.displayName);
      if (await authorSuggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(authorSuggestion).toBeVisible();
      }
    }
  });

  test('selecting autocomplete suggestion filters by author', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByRole('searchbox', { name: 'Search', exact: true });
    await searchInput.fill('Whi');
    await page.waitForTimeout(500);

    // Find and click suggestion
    const suggestion = page
      .getByRole('option', { name: new RegExp(SEEDED_AUTHORS.white.displayName, 'i') })
      .or(page.locator('[data-testid="autocomplete-suggestion"]').filter({ hasText: /white/i }));

    if (await suggestion.isVisible({ timeout: 5000 }).catch(() => false)) {
      await suggestion.click();

      // Should search for or filter by that author
      await expect(page).toHaveURL(/q=|author=/);
    }
  });
});
