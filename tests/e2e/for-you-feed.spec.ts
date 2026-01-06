/**
 * E2E tests for the For You feed.
 *
 * @remarks
 * Tests the personalized recommendations feed including:
 * - Loading states
 * - Empty states for various user conditions
 * - Feed display with recommendations
 * - Dismiss functionality
 * - Infinite scroll
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * Mock discovery API responses.
 */
const MOCK_RECOMMENDATIONS = {
  recommendations: [
    {
      uri: 'at://did:plc:test/pub.chive.preprint/1',
      title: 'Test Preprint: Machine Learning Applications',
      abstract: 'This paper explores novel ML techniques.',
      score: 0.95,
      explanation: {
        type: 'semantic',
        text: 'Based on your research in computational linguistics',
        weight: 0.8,
      },
      authors: [{ name: 'Test Author', did: 'did:plc:author1' }],
      publicationDate: '2024-01-15',
    },
    {
      uri: 'at://did:plc:test/pub.chive.preprint/2',
      title: 'Natural Language Processing Advances',
      abstract: 'Recent advances in NLP methodologies.',
      score: 0.88,
      explanation: {
        type: 'citation',
        text: 'Cites your recent work',
        weight: 0.7,
      },
      authors: [{ name: 'Another Author', did: 'did:plc:author2' }],
      publicationDate: '2024-02-20',
    },
  ],
  hasMore: true,
  cursor: 'cursor123',
};

const MOCK_EMPTY_RECOMMENDATIONS = {
  recommendations: [],
  hasMore: false,
  cursor: undefined,
};

/**
 * Set up API route mocking for discovery endpoints.
 */
async function mockDiscoveryApi(page: Page, response: object, statusCode = 200) {
  await page.route('**/xrpc/pub.chive.discovery.getRecommendations*', async (route) => {
    await route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Set up localStorage with user profile state.
 */
async function setUserProfileState(
  page: Page,
  options: { hasLinkedAccounts?: boolean; hasClaimedPapers?: boolean } = {}
) {
  const { hasLinkedAccounts = false, hasClaimedPapers = false } = options;
  await page.evaluate(
    ({ linked, claimed }) => {
      // Mock profile state - the ForYouFeed component uses these flags
      localStorage.setItem(
        'chive:userProfile',
        JSON.stringify({
          hasLinkedAccounts: linked,
          hasClaimedPapers: claimed,
          orcid: linked ? '0000-0002-1234-5678' : null,
          semanticScholarId: linked ? 's2-123' : null,
        })
      );
    },
    { linked: hasLinkedAccounts, claimed: hasClaimedPapers }
  );
}

/**
 * Wait for the For You section to be visible.
 */
async function waitForForYouSection(page: Page) {
  // Look for the "For You" heading on the authenticated home page
  await expect(page.getByRole('heading', { name: 'For You' })).toBeVisible({ timeout: 5000 });
}

// =============================================================================
// UNAUTHENTICATED TESTS
// =============================================================================

test.describe('For You Feed - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('does not show For You feed for unauthenticated users', async ({ page }) => {
    await page.goto('/');

    // Unauthenticated users should not see the For You section
    // The section only renders when isAuthenticated is true
    const forYouSection = page.getByRole('region', { name: 'For You recommendations' });
    await expect(forYouSection).not.toBeVisible();
  });
});

// =============================================================================
// AUTHENTICATED TESTS - EMPTY STATES
// =============================================================================

test.describe('For You Feed - Empty States', () => {
  test.beforeEach(async ({ page }) => {
    // Set up API mocking for empty recommendations
    await mockDiscoveryApi(page, MOCK_EMPTY_RECOMMENDATIONS);
  });

  test('shows link accounts prompt when no linked accounts', async ({ page }) => {
    // Navigate and set profile state
    await page.goto('/');
    await setUserProfileState(page, { hasLinkedAccounts: false, hasClaimedPapers: false });
    await page.reload();

    // Wait for For You section
    await waitForForYouSection(page);

    // Should show the "Link Your Research Profile" empty state (CardTitle renders as text)
    const linkCard = page.getByText('Link Your Research Profile');
    await expect(linkCard).toBeVisible({ timeout: 5000 });

    // Should explain benefits
    const benefitText = page.getByText(/discover papers related to your published work/i);
    await expect(benefitText).toBeVisible();

    // Should have link to settings
    const linkAccountsButton = page.getByRole('link', { name: /link accounts/i });
    await expect(linkAccountsButton).toBeVisible();
    await expect(linkAccountsButton).toHaveAttribute('href', '/dashboard/settings');
  });

  test('shows claim papers prompt when accounts linked but no papers claimed', async ({ page }) => {
    await page.goto('/');
    await setUserProfileState(page, { hasLinkedAccounts: true, hasClaimedPapers: false });
    await page.reload();

    // Wait for For You section
    await waitForForYouSection(page);

    // Should show the "Claim Your Papers" empty state
    const claimCard = page.getByText('Claim Your Papers');
    await expect(claimCard).toBeVisible({ timeout: 5000 });

    // Should explain the next step
    const explanationText = page.getByText(/import your published papers/i);
    await expect(explanationText).toBeVisible();

    // Should have link to claiming page
    const reviewButton = page.getByRole('link', { name: /review papers/i });
    await expect(reviewButton).toBeVisible();
    await expect(reviewButton).toHaveAttribute('href', '/dashboard/claiming');
  });

  test('shows building feed state when fully configured but cold start', async ({ page }) => {
    await page.goto('/');
    await setUserProfileState(page, { hasLinkedAccounts: true, hasClaimedPapers: true });
    await page.reload();

    // Wait for For You section
    await waitForForYouSection(page);

    // Should show the cold start "Building Your Feed" state
    const buildingCard = page.getByText('Building Your Feed');
    await expect(buildingCard).toBeVisible({ timeout: 5000 });

    // Should explain wait time
    const waitText = page.getByText(/may take a few minutes/i);
    await expect(waitText).toBeVisible();

    // Should offer alternatives
    const trendingLink = page.getByRole('link', { name: /browse trending/i });
    await expect(trendingLink).toBeVisible();

    const searchLink = page.getByRole('link', { name: /search papers/i });
    await expect(searchLink).toBeVisible();
  });
});

// =============================================================================
// AUTHENTICATED TESTS - FEED WITH RECOMMENDATIONS
// =============================================================================

test.describe('For You Feed - With Recommendations', () => {
  test.beforeEach(async ({ page }) => {
    // Set up API mocking for recommendations
    await mockDiscoveryApi(page, MOCK_RECOMMENDATIONS);
    await page.goto('/');
    await setUserProfileState(page, { hasLinkedAccounts: true, hasClaimedPapers: true });
    await page.reload();
  });

  test('displays recommendation cards', async ({ page }) => {
    // Wait for For You section
    await waitForForYouSection(page);

    // Wait for recommendations to load - look for title as h3
    const firstCard = page.getByRole('heading', {
      name: /machine learning applications/i,
      level: 3,
    });
    await expect(firstCard).toBeVisible({ timeout: 5000 });

    // Second recommendation should also be visible
    const secondCard = page.getByRole('heading', {
      name: /natural language processing/i,
      level: 3,
    });
    await expect(secondCard).toBeVisible();
  });

  test('recommendation cards show title and authors', async ({ page }) => {
    // Wait for For You section
    await waitForForYouSection(page);

    // Wait for first card
    const cardTitle = page.getByRole('heading', {
      name: /machine learning applications/i,
      level: 3,
    });
    await expect(cardTitle).toBeVisible({ timeout: 5000 });

    // Author name should be visible
    const authorName = page.getByText('Test Author');
    await expect(authorName).toBeVisible();
  });

  test('recommendation cards show explanation badges', async ({ page }) => {
    // Wait for For You section and cards
    await waitForForYouSection(page);
    await expect(
      page.getByRole('heading', { name: /machine learning applications/i, level: 3 })
    ).toBeVisible({ timeout: 5000 });

    // Badge shows "Similar content" for semantic type (from typeLabels mapping)
    const badge = page.getByText('Similar content');
    await expect(badge).toBeVisible();
  });

  test('dismiss button is accessible', async ({ page }) => {
    // Wait for For You section and cards
    await waitForForYouSection(page);
    await expect(
      page.getByRole('heading', { name: /machine learning applications/i, level: 3 })
    ).toBeVisible({ timeout: 5000 });

    // Hover over the first Card in the For You section
    const forYouSection = page.getByRole('region', { name: 'For You recommendations' });
    const card = forYouSection.locator('[class*="group"]').first();
    await card.hover();

    // Dismiss button should be visible with proper aria-label
    const dismissButton = page.getByRole('button', { name: /dismiss recommendation/i }).first();
    await expect(dismissButton).toBeVisible({ timeout: 3000 });
  });

  test('card title links to preprint page', async ({ page }) => {
    // Wait for For You section and cards
    await waitForForYouSection(page);
    const cardLink = page.getByRole('link', { name: /machine learning applications/i });
    await expect(cardLink).toBeVisible({ timeout: 5000 });

    // Verify link has correct href pointing to preprints page
    const href = await cardLink.getAttribute('href');
    expect(href).toMatch(/\/preprints\//);
    expect(href).toContain('at%3A%2F%2F'); // Encoded AT URI
  });
});

// =============================================================================
// AUTHENTICATED TESTS - ERROR STATES
// =============================================================================

test.describe('For You Feed - Error States', () => {
  test('shows error state when API fails', async ({ page }) => {
    // Mock API to return error
    await mockDiscoveryApi(page, { message: 'Internal server error' }, 500);
    await page.goto('/');
    await setUserProfileState(page, { hasLinkedAccounts: true, hasClaimedPapers: true });
    await page.reload();

    // Wait for For You section
    await waitForForYouSection(page);

    // Should show error message
    const errorText = page.getByText(/failed to load recommendations/i);
    await expect(errorText).toBeVisible({ timeout: 5000 });

    // Should show try again button
    const retryButton = page.getByRole('button', { name: /try again/i });
    await expect(retryButton).toBeVisible();
  });
});

// =============================================================================
// AUTHENTICATED TESTS - LOADING STATE
// =============================================================================

test.describe('For You Feed - Loading State', () => {
  test('shows loading skeletons while fetching', async ({ page }) => {
    // Delay the API response to observe loading state
    await page.route('**/xrpc/pub.chive.discovery.getRecommendations*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RECOMMENDATIONS),
      });
    });

    await page.goto('/');
    await setUserProfileState(page, { hasLinkedAccounts: true, hasClaimedPapers: true });

    // Navigate to page that shows for-you feed (e.g., dashboard or home with auth)
    await page.reload();

    // Wait for For You section
    await expect(page.getByRole('heading', { name: 'For You' })).toBeVisible({ timeout: 5000 });

    // Skeleton elements should be visible during loading
    // The FeedPreprintCardSkeleton uses Skeleton components with animate-pulse
    const skeletons = page.locator('[class*="animate-pulse"]');

    // Should see at least one skeleton while loading
    // Note: This may be flaky depending on timing; adjust timeout if needed
    await expect(skeletons.first()).toBeVisible({ timeout: 2000 });
  });
});
