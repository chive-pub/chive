/**
 * E2E tests for related papers panel.
 *
 * @remarks
 * Tests the related papers sidebar on eprint pages including:
 * - Related papers display
 * - Relationship badges
 * - Citation summary
 * - Navigation to related papers
 */

import { test, expect, type Page } from '@playwright/test';
import { SEEDED_EPRINTS } from './fixtures/test-data.js';

/**
 * Mock related papers API response.
 */
const MOCK_SIMILAR_RESPONSE = {
  eprint: {
    uri: SEEDED_EPRINTS.white.uri,
    title: SEEDED_EPRINTS.white.title,
  },
  related: [
    {
      uri: 'at://did:plc:test/pub.chive.eprint/related1',
      title: 'A Semantically Related Paper on Clause Embedding',
      relationshipType: 'semantically-similar',
      score: 0.92,
      explanation: 'Similar topic coverage in formal semantics',
      authors: [{ name: 'Jane Researcher', did: 'did:plc:jane' }],
      publicationDate: '2024-03-15',
      categories: ['Linguistics'],
    },
    {
      uri: 'at://did:plc:test/pub.chive.eprint/related2',
      title: 'Citation Analysis of Acceptability Judgments',
      relationshipType: 'cites',
      score: 0.88,
      explanation: 'Cites this paper for methodology',
      authors: [{ name: 'Bob Scientist', did: 'did:plc:bob' }],
      publicationDate: '2024-05-20',
      categories: ['Psycholinguistics'],
    },
    {
      uri: 'at://did:plc:test/pub.chive.eprint/related3',
      title: 'Corpus Studies in Computational Linguistics',
      relationshipType: 'cited-by',
      score: 0.85,
      explanation: 'Referenced by this paper',
      authors: [{ name: 'Alice Smith', did: 'did:plc:alice' }],
      publicationDate: '2023-11-10',
      categories: ['Computational Linguistics'],
    },
    {
      uri: 'at://did:plc:test/pub.chive.eprint/related4',
      title: 'Syntax-Semantics Interface in Natural Language',
      relationshipType: 'same-topic',
      score: 0.82,
      explanation: 'Shares similar research topics',
      authors: [{ name: 'Carol Davis', did: 'did:plc:carol' }],
      publicationDate: '2024-01-08',
      categories: ['Linguistics'],
    },
    {
      uri: 'at://did:plc:test/pub.chive.eprint/related5',
      title: 'Collaborative Research in Linguistic Theory',
      relationshipType: 'same-author',
      score: 0.78,
      explanation: 'By the same author',
      authors: [{ name: 'David Lee', did: 'did:plc:david' }],
      publicationDate: '2023-09-25',
      categories: ['Linguistics'],
    },
  ],
};

const MOCK_EMPTY_SIMILAR_RESPONSE = {
  eprint: {
    uri: SEEDED_EPRINTS.white.uri,
    title: SEEDED_EPRINTS.white.title,
  },
  related: [],
};

const MOCK_CITATIONS_RESPONSE = {
  eprint: {
    uri: SEEDED_EPRINTS.white.uri,
    title: SEEDED_EPRINTS.white.title,
  },
  counts: {
    citedByCount: 15,
    referencesCount: 28,
    influentialCitedByCount: 3,
  },
  citations: [
    {
      citingUri: 'at://did:plc:test/pub.chive.eprint/citing1',
      citedUri: SEEDED_EPRINTS.white.uri,
      isInfluential: true,
      source: 'semantic-scholar',
    },
    {
      citingUri: 'at://did:plc:test/pub.chive.eprint/citing2',
      citedUri: SEEDED_EPRINTS.white.uri,
      isInfluential: false,
      source: 'semantic-scholar',
    },
    {
      citingUri: SEEDED_EPRINTS.white.uri,
      citedUri: 'at://did:plc:test/pub.chive.eprint/reference1',
      isInfluential: false,
      source: 'semantic-scholar',
    },
  ],
  hasMore: true,
};

/**
 * Set up API route mocking for discovery endpoints.
 */
async function mockDiscoveryApis(
  page: Page,
  options: {
    similar?: object;
    citations?: object;
  } = {}
) {
  const { similar = MOCK_SIMILAR_RESPONSE, citations = MOCK_CITATIONS_RESPONSE } = options;

  await page.route('**/xrpc/pub.chive.discovery.getSimilar*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(similar),
    });
  });

  await page.route('**/xrpc/pub.chive.discovery.getCitations*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(citations),
    });
  });
}

// =============================================================================
// RELATED PAPERS PANEL TESTS
// =============================================================================

/**
 * Helper to navigate to eprint page and click Related tab.
 */
async function navigateToRelatedTab(page: import('@playwright/test').Page, uri: string) {
  await page.goto(`/eprints/${encodeURIComponent(uri)}`);

  // Wait for eprint page to load (look for Abstract tab which is default)
  await page.waitForLoadState('domcontentloaded');

  // Click the Related tab to show RelatedPapersPanel
  const relatedTab = page.getByRole('tab', { name: /related/i });
  await expect(relatedTab).toBeVisible({ timeout: 10000 });
  await relatedTab.click();
}

test.describe('Related Papers Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockDiscoveryApis(page);
  });

  test('displays related papers heading on eprint page', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Wait for the related papers panel to load (CardTitle renders as text, not heading)
    const heading = page.getByText('Related Papers').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('shows related paper cards with titles', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Wait for related papers to load
    const relatedHeading = page.getByText('Related Papers').first();
    await expect(relatedHeading).toBeVisible({ timeout: 10000 });

    // Check that related paper titles are visible
    const firstRelatedPaper = page.getByText(/semantically related paper/i);
    await expect(firstRelatedPaper).toBeVisible();

    const secondRelatedPaper = page.getByText(/citation analysis/i);
    await expect(secondRelatedPaper).toBeVisible();
  });

  test('displays relationship badges', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Wait for related papers to load
    await expect(page.getByText('Related Papers').first()).toBeVisible({
      timeout: 10000,
    });

    // Check for relationship type badges - use locator to target the badge text
    // Badges are inside span elements with the badge text
    const similarBadge = page.locator('span:has-text("Similar")').first();
    await expect(similarBadge).toBeVisible();

    const citesBadge = page.locator('span:has-text("Cites")').first();
    await expect(citesBadge).toBeVisible();
  });

  test('shows author names on related paper cards', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Wait for related papers to load
    await expect(page.getByText('Related Papers').first()).toBeVisible({
      timeout: 10000,
    });

    // Check author is visible
    const authorName = page.getByText('Jane Researcher');
    await expect(authorName).toBeVisible();
  });

  test('shows publication year on related paper cards', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Wait for related papers to load
    await expect(page.getByText('Related Papers').first()).toBeVisible({
      timeout: 10000,
    });

    // Check year is visible (2024 from mock data)
    const year = page.getByText('2024').first();
    await expect(year).toBeVisible();
  });

  test('clicking related paper navigates to its page', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Wait for related papers to load
    await expect(page.getByText('Related Papers').first()).toBeVisible({
      timeout: 10000,
    });

    // Click on a related paper
    const relatedPaperLink = page.getByText(/semantically related paper/i);
    await relatedPaperLink.click();

    // Should navigate to that eprint's page
    await expect(page).toHaveURL(/\/eprints\//);
  });

  test('shows view all related papers link when more papers exist', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Wait for related papers to load (mock returns 5 papers, meeting limit=5)
    await expect(page.getByText('Related Papers').first()).toBeVisible({
      timeout: 10000,
    });

    // Should show "View all related papers" button (appears when related.length >= limit)
    const viewAllLink = page.getByRole('link', { name: /view all related papers/i });
    await expect(viewAllLink).toBeVisible({ timeout: 5000 });
  });
});

// =============================================================================
// RELATED PAPERS - EMPTY STATE
// =============================================================================

test.describe('Related Papers - Empty State', () => {
  test('shows empty state when no related papers found', async ({ page }) => {
    await mockDiscoveryApis(page, {
      similar: MOCK_EMPTY_SIMILAR_RESPONSE,
    });

    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Wait for the panel to load
    await expect(page.getByText('Related Papers').first()).toBeVisible({
      timeout: 10000,
    });

    // Should show empty state message
    const emptyMessage = page.getByText(/no related papers found yet/i);
    await expect(emptyMessage).toBeVisible();
  });
});

// =============================================================================
// RELATED PAPERS - ERROR STATE
// =============================================================================

test.describe('Related Papers - Error State', () => {
  test('shows error message when API fails', async ({ page }) => {
    await page.route('**/xrpc/pub.chive.discovery.getSimilar*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' }),
      });
    });

    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Should show error message
    const errorMessage = page.getByText(/failed to load related papers/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});

// =============================================================================
// CITATION SUMMARY TESTS
// =============================================================================

test.describe('Citation Summary', () => {
  test.beforeEach(async ({ page }) => {
    await mockDiscoveryApis(page);
  });

  test('displays citation network collapsible on eprint page', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Citation network trigger button should be visible
    const citationTrigger = page.getByRole('button', { name: /citation network/i });
    await expect(citationTrigger).toBeVisible({ timeout: 15000 });
  });

  test('shows citation counts in collapsed state', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    // Wait for citation summary to load
    const citationTrigger = page.getByRole('button', { name: /citation network/i });
    await expect(citationTrigger).toBeVisible({ timeout: 15000 });

    // Click to expand and load citation data
    await citationTrigger.click();

    // Should show citation counts after loading
    const citationCounts = page.getByText(/15 citations/i);
    await expect(citationCounts).toBeVisible({ timeout: 10000 });

    const referenceCounts = page.getByText(/28 references/i);
    await expect(referenceCounts).toBeVisible();
  });

  test('shows influential citations indicator', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    const citationTrigger = page.getByRole('button', { name: /citation network/i });
    await expect(citationTrigger).toBeVisible({ timeout: 15000 });

    await citationTrigger.click();

    // Should show influential count (3 in mock data)
    const influentialText = page.getByText(/3 influential/i);
    await expect(influentialText).toBeVisible({ timeout: 10000 });
  });

  test('expands to show citation sections', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    const citationTrigger = page.getByRole('button', { name: /citation network/i });
    await expect(citationTrigger).toBeVisible({ timeout: 15000 });

    // Click to expand
    await citationTrigger.click();

    // Should show "Cited by" section
    const citedBySection = page.getByText(/cited by \(\d+\)/i);
    await expect(citedBySection).toBeVisible({ timeout: 10000 });

    // Should show "References" section
    const referencesSection = page.getByText(/references \(\d+\)/i);
    await expect(referencesSection).toBeVisible();
  });

  test('shows view full citation network link when more citations exist', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    const citationTrigger = page.getByRole('button', { name: /citation network/i });
    await expect(citationTrigger).toBeVisible({ timeout: 15000 });

    await citationTrigger.click();

    // Should show "View full citation network" link (hasMore is true in mock)
    const viewFullLink = page.getByRole('link', { name: /view full citation network/i });
    await expect(viewFullLink).toBeVisible({ timeout: 10000 });
  });

  test('collapses when clicked again', async ({ page }) => {
    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    const citationTrigger = page.getByRole('button', { name: /citation network/i });
    await expect(citationTrigger).toBeVisible({ timeout: 15000 });

    // Expand
    await citationTrigger.click();
    const citedBySection = page.getByText(/cited by \(\d+\)/i);
    await expect(citedBySection).toBeVisible({ timeout: 10000 });

    // Collapse
    await citationTrigger.click();

    // Content should be hidden
    await expect(citedBySection).not.toBeVisible();
  });
});

// =============================================================================
// CITATION SUMMARY - EMPTY STATE
// =============================================================================

test.describe('Citation Summary - Empty State', () => {
  test('shows empty state when no citation data', async ({ page }) => {
    await mockDiscoveryApis(page, {
      citations: {
        eprint: {
          uri: SEEDED_EPRINTS.white.uri,
          title: SEEDED_EPRINTS.white.title,
        },
        counts: {
          citedByCount: 0,
          referencesCount: 0,
          influentialCitedByCount: 0,
        },
        citations: [],
        hasMore: false,
      },
    });

    await navigateToRelatedTab(page, SEEDED_EPRINTS.white.uri);

    const citationTrigger = page.getByRole('button', { name: /citation network/i });
    await expect(citationTrigger).toBeVisible({ timeout: 15000 });

    await citationTrigger.click();

    // Should show empty message
    const emptyMessage = page.getByText(/no citation data available/i);
    await expect(emptyMessage).toBeVisible({ timeout: 10000 });
  });
});
