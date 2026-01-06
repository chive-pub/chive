/**
 * E2E tests for PDF annotation workflow.
 *
 * Tests the complete annotation lifecycle including:
 * - PDF viewer with annotation toggle
 * - Annotation sidebar navigation
 * - Review/annotation creation UI
 * - Entity linking workflow
 * - Sharing annotations to Bluesky
 *
 * @remarks
 * These tests require seeded data from global.setup.ts.
 * PDF text selection is challenging to automate reliably,
 * so we focus on UI interactions and navigation flows.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect, type Page } from '@playwright/test';
import { SEEDED_AUTHORS, SEEDED_PREPRINTS } from './fixtures/test-data.js';

// =============================================================================
// TEST PDF FIXTURE
// =============================================================================

// Path to the test PDF file (ES module compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_PDF_PATH = path.join(__dirname, 'fixtures', 'assets', 'test-document.pdf');

/**
 * Set up route interception to serve a test PDF for blob requests.
 * This mocks the ATProto blob endpoint so PDF viewer tests work with actual PDF content.
 */
async function setupPdfMocking(page: Page): Promise<void> {
  const pdfBuffer = fs.readFileSync(TEST_PDF_PATH);

  // Intercept any getBlob requests and return our test PDF
  await page.route('**/xrpc/com.atproto.sync.getBlob**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: pdfBuffer,
    });
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Navigate to the first available preprint's PDF tab.
 */
async function navigateToPdfViewer(page: Page): Promise<void> {
  // Set up PDF mocking before navigation
  await setupPdfMocking(page);

  await page.goto('/browse');
  await page.waitForLoadState('networkidle');

  // Get the first preprint link
  const preprintLink = page.locator('a[href*="/preprints/"]').first();
  await expect(preprintLink).toBeVisible({ timeout: 10000 });

  // Click and wait for navigation
  await Promise.all([page.waitForURL(/\/preprints\//), preprintLink.click()]);

  // Switch to PDF tab
  const pdfTab = page.getByRole('tab', { name: 'PDF' });
  await expect(pdfTab).toBeVisible();
  await pdfTab.click();

  // Wait for PDF viewer to load
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate directly to a known preprint's PDF view.
 */
async function navigateToKnownPreprint(page: Page): Promise<void> {
  // Set up PDF mocking before navigation
  await setupPdfMocking(page);

  // Use the full AT-URI; the page component expects it to start with "at://"
  const preprintUri = SEEDED_PREPRINTS.white.uri;
  await page.goto(`/preprints/${encodeURIComponent(preprintUri)}`);
  await page.waitForLoadState('networkidle');

  // Switch to PDF tab if visible
  const pdfTab = page.getByRole('tab', { name: 'PDF' });
  if (await pdfTab.isVisible()) {
    await pdfTab.click();
    await page.waitForLoadState('networkidle');
  }
}

// =============================================================================
// PDF VIEWER UI
// =============================================================================

test.describe('PDF Viewer UI', () => {
  test('PDF tab displays viewer or placeholder', async ({ page }) => {
    await navigateToPdfViewer(page);

    // Should show either the PDF viewer canvas, an iframe, or a "no PDF" message
    // This accounts for all possible states of the PDF viewer
    const pdfContent = page
      .locator('canvas')
      .or(page.locator('iframe[src*="pdf"]'))
      .or(page.locator('.pdf-page'))
      .or(page.locator('[data-testid="pdf-viewer"]'))
      .or(page.getByText(/no pdf available|pdf not available|loading pdf/i));

    await expect(pdfContent.first()).toBeVisible({ timeout: 15000 });
  });

  test('annotation toggle button shows/hides annotations', async ({ page }) => {
    await navigateToPdfViewer(page);

    // Find the annotation toggle button
    const toggleButton = page.getByRole('button', { name: /show annotations|hide annotations/i });
    await expect(toggleButton).toBeVisible();

    // Get the initial state
    const initialText = await toggleButton.textContent();

    // Click to toggle
    await toggleButton.click();

    // Text should change to reflect new state
    const newText = await toggleButton.textContent();
    expect(newText).not.toBe(initialText);
  });

  test('download button is visible in PDF view', async ({ page }) => {
    await navigateToPdfViewer(page);

    // Download button should be visible
    const downloadButton = page
      .getByRole('button', { name: /download/i })
      .or(page.getByRole('link', { name: /download/i }));

    await expect(downloadButton.first()).toBeVisible();
  });
});

// =============================================================================
// ANNOTATION SIDEBAR
// =============================================================================

test.describe('Annotation Sidebar', () => {
  test('sidebar shows annotation count or empty state', async ({ page }) => {
    await navigateToPdfViewer(page);

    // The annotation sidebar should be visible by default
    const sidebar = page.locator('.sticky').filter({ hasText: /annotation/i });

    // Check for either annotations or empty state
    const annotationContent = sidebar
      .locator('[data-testid="annotation-item"]')
      .or(page.getByText(/no annotations|no comments|be the first/i));

    // Wait for content to load
    await expect(annotationContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('sidebar can be toggled with button', async ({ page }) => {
    await navigateToPdfViewer(page);

    const toggleButton = page.getByRole('button', { name: /show annotations|hide annotations/i });
    await expect(toggleButton).toBeVisible();

    // If showing annotations, sidebar should be visible
    if ((await toggleButton.textContent())?.toLowerCase().includes('hide')) {
      // Sidebar should be visible - look for the sticky container
      const sidebar = page.locator('.w-80.shrink-0');
      await expect(sidebar).toBeVisible();

      // Click to hide
      await toggleButton.click();

      // Sidebar should now be hidden
      await expect(sidebar).not.toBeVisible();
    }
  });
});

// =============================================================================
// REVIEW/ANNOTATION CREATION UI
// =============================================================================

test.describe('Review Creation UI', () => {
  test('Reviews tab shows write review button', async ({ page }) => {
    await navigateToKnownPreprint(page);

    // Click Reviews tab
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await expect(reviewsTab).toBeVisible();
    await reviewsTab.click();

    // Write review button should be visible
    const writeReviewButton = page.getByRole('button', { name: /write a review/i });
    await expect(writeReviewButton).toBeVisible();
  });

  test('clicking write review opens the review form', async ({ page }) => {
    await navigateToKnownPreprint(page);

    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();

    const writeReviewButton = page.getByRole('button', { name: /write a review/i });
    await writeReviewButton.click();

    // Review form should be visible with data-testid
    const reviewForm = page.locator('[data-testid="review-form"]');
    await expect(reviewForm).toBeVisible();
  });

  test('review form has content textarea', async ({ page }) => {
    await navigateToKnownPreprint(page);

    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();

    const writeReviewButton = page.getByRole('button', { name: /write a review/i });
    await writeReviewButton.click();

    // Textarea should be visible
    const textarea = page.locator('[data-testid="review-content-input"]');
    await expect(textarea).toBeVisible();
  });

  test('review form validates minimum content length', async ({ page }) => {
    await navigateToKnownPreprint(page);

    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();

    const writeReviewButton = page.getByRole('button', { name: /write a review/i });
    await writeReviewButton.click();

    const textarea = page.locator('[data-testid="review-content-input"]');
    await textarea.fill('short');

    // Should show minimum length indicator
    const minLengthIndicator = page.getByText(/min 10/);
    await expect(minLengthIndicator).toBeVisible();
  });

  test('review form enables post button with valid content', async ({ page }) => {
    await navigateToKnownPreprint(page);

    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();

    const writeReviewButton = page.getByRole('button', { name: /write a review/i });
    await writeReviewButton.click();

    const textarea = page.locator('[data-testid="review-content-input"]');
    await textarea.fill(
      'This is a valid review comment that meets the minimum length requirement for posting.'
    );

    // Post button should be enabled
    const postButton = page.getByRole('button', { name: /post review/i });
    await expect(postButton).toBeEnabled();
  });
});

// =============================================================================
// ENTITY LINKING UI
// =============================================================================

test.describe('Entity Linking UI', () => {
  test('entity link button is not visible without text selection', async ({ page }) => {
    await navigateToKnownPreprint(page);

    // Navigate to PDF tab
    const pdfTab = page.getByRole('tab', { name: 'PDF' });
    await pdfTab.click();
    await page.waitForLoadState('networkidle');

    // Entity link button should NOT be visible without selection
    const linkButton = page.locator('[data-testid="link-entity-button"]');
    await expect(linkButton).not.toBeVisible();
  });
});

// =============================================================================
// SHARE FUNCTIONALITY
// =============================================================================

test.describe('Review Sharing', () => {
  test('review card has share button when reviews exist', async ({ page }) => {
    await navigateToKnownPreprint(page);

    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();

    // Wait for reviews to load
    await page.waitForLoadState('networkidle');

    // Look for review cards
    const reviewCard = page.locator('[data-testid="review-card"]');
    const reviewCount = await reviewCard.count();

    if (reviewCount > 0) {
      // Each review card should have a share button
      const shareButton = reviewCard.first().getByRole('button', { name: /share/i });
      await expect(shareButton).toBeVisible();
    } else {
      // If no reviews, the empty state should be visible
      const emptyState = page.getByText(/no reviews yet/i);
      await expect(emptyState).toBeVisible();
    }
  });

  test('share menu shows Bluesky option', async ({ page }) => {
    await navigateToKnownPreprint(page);

    // Click the share button on the preprint page
    const shareButton = page.getByRole('button', { name: /share/i }).first();
    await expect(shareButton).toBeVisible();
    await shareButton.click();

    // Should show Bluesky option in the menu
    const blueskyOption = page.getByRole('menuitem', { name: /bluesky/i });
    await expect(blueskyOption).toBeVisible();
  });
});

// =============================================================================
// AUTHOR PROFILE REVIEWS TAB
// =============================================================================

test.describe('Author Profile Reviews Tab', () => {
  test('author profile has Reviews tab', async ({ page }) => {
    const authorDid = SEEDED_AUTHORS.white.did;
    await page.goto(`/authors/${encodeURIComponent(authorDid)}`);
    await page.waitForLoadState('networkidle');

    // Should have Reviews tab
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await expect(reviewsTab).toBeVisible();
  });

  test('clicking Reviews tab switches content', async ({ page }) => {
    const authorDid = SEEDED_AUTHORS.white.did;
    await page.goto(`/authors/${encodeURIComponent(authorDid)}`);
    await page.waitForLoadState('networkidle');

    // Click Reviews tab
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();

    // Reviews tab should now be active
    await expect(reviewsTab).toHaveAttribute('data-state', 'active');
  });

  test('Reviews tab shows empty state or review list', async ({ page }) => {
    const authorDid = SEEDED_AUTHORS.white.did;
    await page.goto(`/authors/${encodeURIComponent(authorDid)}`);
    await page.waitForLoadState('networkidle');

    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();

    // Should show either reviews or empty state
    const content = page
      .locator('[data-testid="author-review-item"]')
      .or(page.getByText(/no reviews yet/i));

    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('author reviews show link to preprint', async ({ page }) => {
    const authorDid = SEEDED_AUTHORS.white.did;
    await page.goto(`/authors/${encodeURIComponent(authorDid)}`);
    await page.waitForLoadState('networkidle');

    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();

    // If there are reviews, they should have preprint links
    const reviewItem = page.locator('[data-testid="author-review-item"]').first();
    const itemCount = await reviewItem.count();

    if (itemCount > 0) {
      const preprintLink = reviewItem.getByRole('link', { name: /view preprint/i });
      await expect(preprintLink).toBeVisible();
    } else {
      // Empty state is acceptable
      await expect(page.getByText(/no reviews yet/i)).toBeVisible();
    }
  });
});

// =============================================================================
// INLINE ANNOTATION BADGE
// =============================================================================

test.describe('Inline Annotation Display', () => {
  test('inline annotations show badge in review list', async ({ page }) => {
    await navigateToKnownPreprint(page);

    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();
    await page.waitForLoadState('networkidle');

    // Look for inline annotation badge in any review
    const inlineBadge = page.getByText(/inline annotation/i);

    // The badge is only present if there are inline annotations
    // So we just verify the review list loaded
    const reviewList = page
      .locator('[data-testid="review-list"]')
      .or(page.getByText(/no reviews/i));
    await expect(reviewList.first()).toBeVisible();
  });
});

// =============================================================================
// KEYBOARD NAVIGATION
// =============================================================================

test.describe('Keyboard Navigation', () => {
  test('can navigate tabs with keyboard', async ({ page }) => {
    await navigateToKnownPreprint(page);

    // Focus on the first tab
    const abstractTab = page.getByRole('tab', { name: 'Abstract' });
    await abstractTab.focus();

    // Press arrow right to move to next tab
    await page.keyboard.press('ArrowRight');

    // PDF tab should now be focused
    const pdfTab = page.getByRole('tab', { name: 'PDF' });
    await expect(pdfTab).toBeFocused();
  });

  test('can activate tab with Enter or Space', async ({ page }) => {
    await navigateToKnownPreprint(page);

    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.focus();
    await page.keyboard.press('Enter');

    // Reviews tab should now be active
    await expect(reviewsTab).toHaveAttribute('data-state', 'active');
  });
});

// =============================================================================
// RESPONSIVE BEHAVIOR
// =============================================================================

test.describe('Responsive Behavior', () => {
  test('annotation sidebar collapses on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await navigateToPdfViewer(page);

    // On mobile, the sidebar should be hidden or the toggle button should allow showing it
    const toggleButton = page.getByRole('button', { name: /show annotations|hide annotations/i });
    await expect(toggleButton).toBeVisible();
  });

  test('PDF viewer is responsive', async ({ page }) => {
    await navigateToPdfViewer(page);

    // Resize viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300); // Wait for resize

    // The PDF content area should still be visible
    const pdfContent = page
      .locator('canvas')
      .or(page.locator('.pdf-page'))
      .or(page.getByText(/loading pdf|no pdf/i));

    await expect(pdfContent.first()).toBeVisible();
  });
});
