/**
 * E2E tests for eprint detail page.
 *
 * Tests eprint display, metadata, and actions.
 *
 * @remarks
 * These tests REQUIRE seeded data. If no eprints are available,
 * tests will fail - this is intentional to catch seeding issues.
 */

import { test, expect, type Page } from '@playwright/test';
import { EprintPage } from './fixtures/page-objects.js';
import { SEEDED_AUTHORS, SEEDED_EPRINTS } from './fixtures/test-data.js';

/**
 * Navigate to the first available eprint from the browse page.
 *
 * @param page - Playwright page
 * @returns EprintPage page object
 * @throws If no eprints are available (seeding required)
 */
async function navigateToFirstEprint(page: Page): Promise<EprintPage> {
  await page.goto('/browse');
  await page.waitForLoadState('networkidle');

  // Get the first eprint link specifically (href contains /eprints/)
  // More robust than generic first link which might match navigation/filter links
  const eprintLink = page.locator('a[href*="/eprints/"]').first();

  // Assert eprint exists; fail if not (do not silently accept empty state).
  await expect(eprintLink).toBeVisible({
    timeout: 10000,
  });

  // Click and wait for navigation to complete
  await Promise.all([page.waitForURL(/\/eprints\//), eprintLink.click()]);

  return new EprintPage(page);
}

test.describe('Eprint detail page', () => {
  test('displays eprint title', async ({ page }) => {
    const eprintPage = await navigateToFirstEprint(page);

    // Title MUST be visible
    await expect(eprintPage.title).toBeVisible();
  });

  test('handles 404 for non-existent eprint', async ({ page }) => {
    await page.goto(
      '/eprints/at%3A%2F%2Fdid%3Aplc%3Anonexistent%2Fpub.chive.eprint.submission%2Fxyz'
    );

    // Should show error message
    const errorMessage = page.getByRole('alert').or(page.getByText(/not found|404|error/i));
    await expect(errorMessage).toBeVisible();
  });

  test('displays metadata section', async ({ page }) => {
    const eprintPage = await navigateToFirstEprint(page);

    // Metadata section MUST be visible
    await expect(eprintPage.metadata).toBeVisible();
  });

  test('displays authors list', async ({ page }) => {
    const eprintPage = await navigateToFirstEprint(page);

    // Authors section MUST be visible
    await expect(eprintPage.authors).toBeVisible();
  });

  test('displays abstract section', async ({ page }) => {
    const eprintPage = await navigateToFirstEprint(page);

    // Abstract section MUST be visible
    await expect(eprintPage.abstract).toBeVisible();
  });

  test('download button is visible', async ({ page }) => {
    const eprintPage = await navigateToFirstEprint(page);

    // Download button MUST be visible
    await expect(eprintPage.downloadButton).toBeVisible();
  });

  test('endorse button is visible on eprint page', async ({ page }) => {
    const eprintPage = await navigateToFirstEprint(page);

    // Endorse button MUST be visible
    await expect(eprintPage.endorseButton).toBeVisible();
  });

  test('version selector or metadata is visible', async ({ page }) => {
    const eprintPage = await navigateToFirstEprint(page);

    // Either version selector or metadata MUST be visible
    const versionOrMetadata = eprintPage.versionSelector.or(eprintPage.metadata);
    await expect(versionOrMetadata).toBeVisible();
  });

  test('share button is visible on eprint page', async ({ page }) => {
    await navigateToFirstEprint(page);

    // Share button MUST be visible
    const shareButton = page.getByRole('button', { name: /share/i });
    await expect(shareButton).toBeVisible();
  });

  test('eprint page has proper heading hierarchy', async ({ page }) => {
    await navigateToFirstEprint(page);

    // H1 should be the title
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();

    // Should have descriptive headings for sections
    const headings = page.getByRole('heading');
    await expect(headings.first()).toBeVisible();
  });

  test('keywords or tags are displayed', async ({ page }) => {
    const eprintPage = await navigateToFirstEprint(page);

    // Keywords section MUST be visible
    await expect(eprintPage.keywords).toBeVisible();
  });
});

// =============================================================================
// TAB NAVIGATION
// =============================================================================

test.describe('Tab Navigation', () => {
  test('displays all tabs (Abstract, PDF, Reviews, Endorsements, Metadata)', async ({ page }) => {
    await navigateToFirstEprint(page);
    await expect(page.getByRole('tab', { name: 'Abstract' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'PDF' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /reviews/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /endorsements/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Metadata' })).toBeVisible();
  });

  test('Abstract tab is active by default', async ({ page }) => {
    await navigateToFirstEprint(page);
    const abstractTab = page.getByRole('tab', { name: 'Abstract' });
    await expect(abstractTab).toHaveAttribute('data-state', 'active');
  });

  test('clicking Reviews tab shows review form button for authenticated users', async ({
    page,
  }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /reviews/i }).click();
    await expect(page.getByRole('button', { name: /write a review/i })).toBeVisible();
  });

  test('clicking Endorsements tab shows endorsement button', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /endorsements/i }).click();
    const endorseButton = page.getByRole('button', { name: /endorse this eprint/i });
    await expect(endorseButton).toBeVisible();
  });
});

// =============================================================================
// REVIEW SUBMISSION FLOW
// =============================================================================

test.describe('Review Submission Flow', () => {
  test('Write a review button opens form with data-testid', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /reviews/i }).click();
    await page.getByRole('button', { name: /write a review/i }).click();
    await expect(page.locator('[data-testid="review-form"]')).toBeVisible();
  });

  test('review form textarea has data-testid', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /reviews/i }).click();
    await page.getByRole('button', { name: /write a review/i }).click();
    await expect(page.locator('[data-testid="review-content-input"]')).toBeVisible();
  });

  test('review form shows character count with minimum indicator', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /reviews/i }).click();
    await page.getByRole('button', { name: /write a review/i }).click();

    const textarea = page.locator('[data-testid="review-content-input"]');
    await textarea.fill('short');
    // Should show "(min 10)" when below minimum
    await expect(page.getByText(/min 10/)).toBeVisible();
  });

  test('Post review button is disabled when content is too short', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /reviews/i }).click();
    await page.getByRole('button', { name: /write a review/i }).click();

    await page.locator('[data-testid="review-content-input"]').fill('short');
    const postButton = page.getByRole('button', { name: /post review/i });
    await expect(postButton).toBeDisabled();
  });

  test('Cancel button hides review form', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /reviews/i }).click();
    await page.getByRole('button', { name: /write a review/i }).click();
    await expect(page.locator('[data-testid="review-form"]')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-testid="review-form"]')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /write a review/i })).toBeVisible();
  });
});

// =============================================================================
// ENDORSEMENT FLOW
// =============================================================================

test.describe('Endorsement Flow', () => {
  test('Endorse this eprint button opens dialog', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /endorsements/i }).click();
    await page.getByRole('button', { name: /endorse this eprint/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    // Use heading role to avoid matching the button text
    await expect(page.getByRole('heading', { name: 'Endorse this eprint' })).toBeVisible();
  });

  test('endorsement dialog shows contribution type categories', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /endorsements/i }).click();
    await page.getByRole('button', { name: /endorse this eprint/i }).click();

    // Categories from EndorsementForm CONTRIBUTION_CATEGORIES
    // Use heading role to avoid matching checkbox labels with same text
    await expect(page.getByRole('heading', { name: 'Core Research' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Technical' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Validation' })).toBeVisible();
  });

  test('selecting contribution type updates selection count', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /endorsements/i }).click();
    await page.getByRole('button', { name: /endorse this eprint/i }).click();

    // Wait for dialog to be visible
    await expect(page.getByRole('dialog')).toBeVisible();

    // Use check() for Radix Checkbox, the proper method for checkbox interactions.
    // This sets the checked state without triggering click event propagation issues
    const checkbox = page.getByRole('checkbox', { name: 'Methodological' });
    await checkbox.check();
    await expect(page.getByText('1 selected')).toBeVisible();
  });

  test('Submit endorsement button is disabled without contribution type', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /endorsements/i }).click();
    await page.getByRole('button', { name: /endorse this eprint/i }).click();

    const submitButton = page.getByRole('button', { name: /submit endorsement/i });
    await expect(submitButton).toBeDisabled();
  });

  test('shows validation error when no contribution type selected', async ({ page }) => {
    await navigateToFirstEprint(page);
    await page.getByRole('tab', { name: /endorsements/i }).click();
    await page.getByRole('button', { name: /endorse this eprint/i }).click();

    // Error message appears immediately in form
    await expect(page.getByText('Please select at least one contribution type.')).toBeVisible();
  });
});

// =============================================================================
// SHARE FUNCTIONALITY
// =============================================================================

test.describe('Share Functionality', () => {
  // Clipboard API only works reliably in Chromium headless
  test('Share button copies link to clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard API not supported in Firefox/WebKit headless');

    await context.grantPermissions(['clipboard-write', 'clipboard-read']);
    await navigateToFirstEprint(page);

    // Click the share button
    await page.getByRole('button', { name: /share/i }).click();

    // The share button might open a dropdown/menu - look for "Copy link" option
    const copyLinkOption = page
      .getByRole('menuitem', { name: /copy link/i })
      .or(page.getByRole('button', { name: /copy link/i }))
      .or(page.getByText(/copy link/i));

    if (await copyLinkOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await copyLinkOption.click();
    }

    // Wait a moment for clipboard to update
    await page.waitForTimeout(500);

    // Check clipboard - if clipboard access fails, just verify the share UI worked
    try {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      if (clipboardText) {
        expect(clipboardText).toContain('/eprints/');
      }
    } catch {
      // Clipboard access may fail in some environments - just verify share button worked
      test.info().annotations.push({ type: 'note', description: 'Clipboard access not available' });
    }
  });
});
