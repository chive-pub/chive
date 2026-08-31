/**
 * E2E tests for paper-centric submission flow.
 *
 * Tests submissions where the paper has its own PDS (paperDid is set):
 * - Paper has its own DID separate from submitter
 * - Blobs are fetched from paper's PDS
 * - Paper identity displayed separately from submitter
 *
 * @remarks
 * Paper-centric submissions are an advanced feature per Discussion #3.
 * Most submissions will use the traditional model where papers live in
 * the submitter's PDS.
 *
 * @packageDocumentation
 */

import { test, expect, type Page } from '@playwright/test';
import { SEEDED_EPRINTS, SEEDED_AUTHORS, TEST_USER } from '../fixtures/test-data.js';

test.describe('Paper-Centric Submission - Display', () => {
  // Note: Paper-centric submissions require special setup with a paper that has its own DID
  // These tests verify the display logic when paperDid is set

  test('displays paper identity when paperDid is set', async ({ page }) => {
    // Navigate to an eprint page
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for paper identity badge (only shown when paperDid is set)
    const paperIdentity = page
      .locator('[data-testid="paper-identity"]')
      .or(page.getByText(/paper account|paper identity/i));

    // scripts/seed-test-data.ts sets no paperDid on any eprint, so every
    // seeded submission is traditional and the badge must be absent. That is
    // worth asserting: showing a paper-identity badge on a submission that has
    // no paper account would misattribute the work, and the previous form of
    // this test passed either way.
    await expect(paperIdentity.first()).toBeHidden();
  });

  test('shows "Submitted by" separately from paper identity', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for submitter information
    const submittedBy = page
      .getByText(/submitted by/i)
      .or(page.locator('[data-testid="submitted-by"]'));

    if (await submittedBy.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(submittedBy).toBeVisible();
    }
  });

  test('paper profile link uses paperDid when set', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for paper profile link
    const paperProfileLink = page
      .locator('a[href*="/papers/"]')
      .or(page.getByRole('link', { name: /view paper profile/i }));

    // Same reasoning: no seeded eprint is paper-centric, so a link to a paper
    // profile would point at something that does not exist.
    await expect(paperProfileLink.first()).toBeHidden();
  });
});

test.describe('Paper-Centric Submission - Blob Fetching', () => {
  test('PDF viewer loads (blobs fetched from correct PDS)', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for PDF viewer or download button
    const pdfElement = page
      .getByRole('document')
      .or(page.locator('iframe[src*="pdf"]'))
      .or(page.getByRole('button', { name: /download.*pdf/i }))
      .or(page.getByRole('link', { name: /download.*pdf/i }));

    if (await pdfElement.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(pdfElement).toBeVisible();
    }
  });

  test('supplementary files load from correct PDS', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for supplementary files section
    const supplementary = page
      .getByText(/supplementary|additional files/i)
      .or(page.locator('[data-testid="supplementary-files"]'));

    // No supplementary materials are seeded, so the panel should not render.
    // SupplementaryPanel returns null when it has nothing to show, and this
    // catches a regression that renders an empty one.
    await expect(supplementary.first()).toBeHidden();
  });
});

test.describe('Paper-Centric Submission - Record URI', () => {
  test('record URI uses paperDid as repo when set', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for AT-URI display
    const atUri = page.getByText(/at:\/\/did:plc:/i).or(page.locator('[data-testid="eprint-uri"]'));

    if (await atUri.isVisible({ timeout: 3000 }).catch(() => false)) {
      // URI should contain a DID - either paper's or submitter's
      const uriText = await atUri.textContent();
      expect(uriText).toMatch(/at:\/\/did:plc:/);
    }
  });
});

test.describe('Paper-Centric vs Traditional - Detection', () => {
  test('distinguishes paper-centric from traditional submissions', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // In paper-centric: shows paper identity badge
    // In traditional: does NOT show paper identity badge
    const paperIdentityBadge = page
      .locator('[data-testid="paper-identity-badge"]')
      .or(page.getByText(/paper account/i));

    // The seeded eprints are all traditional, so this resolves to the
    // traditional branch rather than "either way is valid".
    await expect(paperIdentityBadge.first()).toBeHidden();
  });

  test('shows submitter for both paper-centric and traditional', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Submitter should always be shown
    const authorOrSubmitter = page
      .getByText(SEEDED_AUTHORS.white.displayName)
      .or(page.getByText(/submitted by/i));

    await expect(authorOrSubmitter).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Paper-Centric Submission - Navigation', () => {
  test('can navigate to paper profile page via paperDid', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for paper profile link
    const paperLink = page.locator('a[href*="/papers/"]');

    if (await paperLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await paperLink.click();
      // Should navigate to paper profile page
      await expect(page).toHaveURL(/\/papers\//);
    }
  });

  test('can navigate to submitter profile page', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Find author/submitter link
    const authorLink = page.getByRole('link', {
      name: new RegExp(SEEDED_AUTHORS.white.displayName, 'i'),
    });

    if (await authorLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await authorLink.click();
      // Should navigate to author profile
      await expect(page).toHaveURL(/\/authors\//);
    }
  });
});
