/**
 * E2E tests for enrichment and backlinks panels on preprint pages.
 *
 * Tests external data display (Semantic Scholar, OpenAlex) and
 * backlinks from ATProto ecosystem apps (Semble, Bluesky, WhiteWind, Leaflet).
 *
 * @remarks
 * These tests use seeded test data from global.setup.ts. The first test preprint
 * (White's "Frequency, Acceptability, and Selection") has both enrichment data
 * and backlinks seeded.
 */

import { test, expect, type Page } from '@playwright/test';
import { PreprintPage } from './fixtures/page-objects.js';

/**
 * URI components for the test preprint with enrichment and backlinks.
 * This preprint has both enrichment data (S2/OpenAlex) and backlinks (Semble, Bluesky).
 */
const TEST_PREPRINT = {
  authorDid: 'did:plc:aswhite123abc',
  rkey: '3jt7k9xyzab01',
  title: 'Frequency, Acceptability, and Selection',
};

/**
 * Navigate to a specific preprint by searching for its title.
 */
async function navigateToPreprintWithData(page: Page): Promise<PreprintPage> {
  // Go to browse and wait for content
  await page.goto('/browse');

  // Wait for preprint links to be visible
  const preprintLinks = page.locator('a[href*="/preprints/"]');
  await expect(preprintLinks.first()).toBeVisible();

  // Find the test preprint link by title
  const preprintLink = preprintLinks.filter({
    hasText: TEST_PREPRINT.title,
  });

  // Fall back to first preprint if specific one not found
  const hasTestPreprint = (await preprintLink.count()) > 0;

  if (hasTestPreprint) {
    await preprintLink.first().click();
  } else {
    // Fallback: click any preprint
    await preprintLinks.first().click();
  }

  await page.waitForURL(/\/preprints\//);

  return new PreprintPage(page);
}

/**
 * Navigate to the first available preprint from the browse page.
 */
async function navigateToFirstPreprint(page: Page): Promise<PreprintPage> {
  await page.goto('/browse');

  // Wait for preprint links to be visible
  const preprintLink = page.locator('a[href*="/preprints/"]').first();
  await expect(preprintLink).toBeVisible();

  await preprintLink.click();
  await page.waitForURL(/\/preprints\//);

  return new PreprintPage(page);
}

// =============================================================================
// ENRICHMENT PANEL TESTS
// =============================================================================

test.describe('Enrichment Panel', () => {
  test('Metadata tab is navigable and displays content', async ({ page }) => {
    await navigateToFirstPreprint(page);

    // Navigate to Metadata tab
    const metadataTab = page.getByRole('tab', { name: 'Metadata' });
    await metadataTab.click();
    await expect(metadataTab).toHaveAttribute('data-state', 'active');

    // Metadata tabpanel must be visible
    const tabContent = page.getByRole('tabpanel', { name: 'Metadata' });
    await expect(tabContent).toBeVisible();

    // Tags section must always be present in Metadata tab
    const tagsHeading = page.getByText(/tags/i);
    await expect(tagsHeading.first()).toBeVisible();
  });

  test('enrichment panel shows "External Data" heading with seeded data', async ({ page }) => {
    await navigateToPreprintWithData(page);

    const metadataTab = page.getByRole('tab', { name: 'Metadata' });
    await metadataTab.click();
    await expect(metadataTab).toHaveAttribute('data-state', 'active');

    // Enrichment panel MUST be visible for preprints with seeded enrichment data
    const enrichmentHeading = page.getByText('External Data');
    await expect(enrichmentHeading).toBeVisible();

    // Verify it's in a Card component structure
    const card = page.locator('[class*="card"]').filter({ hasText: 'External Data' });
    await expect(card).toBeVisible();
  });

  test('external ID badges link to Semantic Scholar and OpenAlex', async ({ page }) => {
    await navigateToPreprintWithData(page);

    const metadataTab = page.getByRole('tab', { name: 'Metadata' });
    await metadataTab.click();
    await expect(metadataTab).toHaveAttribute('data-state', 'active');

    // S2 badge MUST be visible and link to Semantic Scholar
    const s2Link = page.locator('a[href*="semanticscholar.org"]').first();
    await expect(s2Link).toBeVisible();
    await expect(s2Link).toHaveAttribute('target', '_blank');
    await expect(s2Link).toHaveAttribute('rel', /noopener/);

    // OA badge MUST be visible and link to OpenAlex
    const oaLink = page.locator('a[href*="openalex.org"]').first();
    await expect(oaLink).toBeVisible();
    await expect(oaLink).toHaveAttribute('target', '_blank');
    await expect(oaLink).toHaveAttribute('rel', /noopener/);
  });

  test('topics section displays badges with hierarchical data', async ({ page }) => {
    await navigateToPreprintWithData(page);

    const metadataTab = page.getByRole('tab', { name: 'Metadata' });
    await metadataTab.click();
    await expect(metadataTab).toHaveAttribute('data-state', 'active');

    // Topics section MUST exist with seeded data
    const topicsLabel = page.getByText('Topics');
    await expect(topicsLabel).toBeVisible();

    // Topic badges MUST be present (using data-testid for reliable selection)
    const topicBadges = page.getByTestId('topic-badge');
    await expect(topicBadges.first()).toBeVisible();
  });

  test('concepts with Wikidata have external links', async ({ page }) => {
    await navigateToPreprintWithData(page);

    const metadataTab = page.getByRole('tab', { name: 'Metadata' });
    await metadataTab.click();
    await expect(metadataTab).toHaveAttribute('data-state', 'active');

    // Wikidata links MUST exist for concepts (seeded data has wikidataId)
    const wikidataLinks = page.locator('a[href*="wikidata.org"]');
    const linkCount = await wikidataLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    // All Wikidata links MUST open in new tab with noopener
    for (let i = 0; i < Math.min(linkCount, 3); i++) {
      const link = wikidataLinks.nth(i);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });
});

// =============================================================================
// BACKLINKS PANEL TESTS
// =============================================================================

test.describe('Backlinks Panel', () => {
  test('Related tab is navigable and displays content', async ({ page }) => {
    await navigateToFirstPreprint(page);

    // Navigate to Related tab
    const relatedTab = page.getByRole('tab', { name: 'Related' });
    await relatedTab.click();
    await expect(relatedTab).toHaveAttribute('data-state', 'active');

    // Related tabpanel must be visible
    const tabContent = page.getByRole('tabpanel', { name: 'Related' });
    await expect(tabContent).toBeVisible();

    // Related papers section must always be present
    const relatedPapersHeading = page.getByText(/related papers|similar/i);
    await expect(relatedPapersHeading.first()).toBeVisible();
  });

  test('backlinks panel shows count badge with seeded data', async ({ page }) => {
    await navigateToPreprintWithData(page);

    const relatedTab = page.getByRole('tab', { name: 'Related' });
    await relatedTab.click();
    await expect(relatedTab).toHaveAttribute('data-state', 'active');

    // Backlinks panel MUST be visible for preprints with seeded backlinks
    const backlinksHeading = page.getByText('Backlinks').first();
    await expect(backlinksHeading).toBeVisible();

    // Badge with count MUST be visible (uses data-testid for reliable selection)
    const countBadge = page.getByTestId('backlinks-count');
    await expect(countBadge).toBeVisible();

    // Badge MUST contain a number (at least 1 since we have seeded backlinks)
    const badgeText = await countBadge.textContent();
    expect(badgeText).toMatch(/^\d+$/);
    expect(parseInt(badgeText ?? '0', 10)).toBeGreaterThanOrEqual(1);
  });

  test('backlinks sections are expandable buttons', async ({ page }) => {
    await navigateToPreprintWithData(page);

    const relatedTab = page.getByRole('tab', { name: 'Related' });
    await relatedTab.click();
    await expect(relatedTab).toHaveAttribute('data-state', 'active');

    // At least one section MUST be visible (we have Semble and Bluesky backlinks for first preprint)
    const sectionButtons = page
      .locator('button')
      .filter({ hasText: /(Semble|Bluesky|WhiteWind|Leaflet)/i });

    await expect(sectionButtons.first()).toBeVisible();

    // Each section button MUST be clickable
    const firstButton = sectionButtons.first();
    await expect(firstButton).toBeEnabled();
  });

  test('expanded backlink section shows items with context', async ({ page }) => {
    await navigateToPreprintWithData(page);

    const relatedTab = page.getByRole('tab', { name: 'Related' });
    await relatedTab.click();
    await expect(relatedTab).toHaveAttribute('data-state', 'active');

    // Find and click first section button
    const sectionButtons = page
      .locator('button')
      .filter({ hasText: /(Semble|Bluesky|WhiteWind|Leaflet)/i });

    await expect(sectionButtons.first()).toBeVisible();

    // Click first section to expand
    await sectionButtons.first().click();

    // After expansion, backlink items MUST be visible with timestamps
    const backlinkItem = page.getByTestId('backlink-item').first();
    await expect(backlinkItem).toBeVisible();

    // Backlink item MUST have a timestamp
    const timestamp = page.getByTestId('backlink-timestamp').first();
    await expect(timestamp).toBeVisible();
  });

  test('backlink external links have correct security attributes', async ({ page }) => {
    await navigateToPreprintWithData(page);

    const relatedTab = page.getByRole('tab', { name: 'Related' });
    await relatedTab.click();
    await expect(relatedTab).toHaveAttribute('data-state', 'active');

    // Expand a section to show backlinks
    const sectionButtons = page
      .locator('button')
      .filter({ hasText: /(Semble|Bluesky|WhiteWind|Leaflet)/i });

    if ((await sectionButtons.count()) > 0) {
      await sectionButtons.first().click();
      // Wait for backlink items to appear after expansion
      await expect(page.getByTestId('backlink-item').first()).toBeVisible();
    }

    // All external backlink links MUST have target="_blank" and rel="noopener"
    const externalDomains = ['semble.app', 'bsky.app', 'whitewind.blog', 'leaflet.pub'];

    for (const domain of externalDomains) {
      const links = page.locator(`a[href*="${domain}"]`);
      const linkCount = await links.count();

      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /noopener/);
      }
    }

    // Verify tab is functional
    await expect(page.getByRole('tabpanel', { name: 'Related' })).toBeVisible();
  });
});

// =============================================================================
// TAB STRUCTURE TESTS
// =============================================================================

test.describe('Tab Structure Integration', () => {
  test('Metadata tab contains required sections in correct order', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const metadataTab = page.getByRole('tab', { name: 'Metadata' });
    await metadataTab.click();

    const tabContent = page.getByRole('tabpanel', { name: 'Metadata' });
    await expect(tabContent).toBeVisible();

    // Tags section MUST exist
    const tagsHeading = tabContent.getByText(/tags/i);
    await expect(tagsHeading.first()).toBeVisible();

    // ATProto source section MUST exist
    const sourceSection = tabContent.getByText(/source|pds|atproto/i);
    await expect(sourceSection.first()).toBeVisible();
  });

  test('Related tab contains related papers panel', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const relatedTab = page.getByRole('tab', { name: 'Related' });
    await relatedTab.click();

    const tabContent = page.getByRole('tabpanel', { name: 'Related' });
    await expect(tabContent).toBeVisible();

    // Related papers panel MUST exist
    const relatedPapersHeading = page.getByText(/related papers|similar/i);
    await expect(relatedPapersHeading.first()).toBeVisible();
  });

  test('all preprint tabs are accessible', async ({ page }) => {
    await navigateToFirstPreprint(page);

    // All tabs must be visible
    const tabs = ['Abstract', 'PDF', 'Reviews', 'Endorsements', 'Related', 'Metadata'];

    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
      await expect(tab).toBeVisible();
    }

    // Each tab must be clickable and show content
    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
      await tab.click();
      await expect(tab).toHaveAttribute('data-state', 'active');
    }
  });
});
