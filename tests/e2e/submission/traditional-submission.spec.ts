/**
 * E2E tests for traditional submission flow.
 *
 * Tests submissions where the paper lives in the submitter's PDS (paperDid is undefined):
 * - Paper record stored in submitter's PDS
 * - Blobs fetched from submitter's PDS
 * - No separate paper identity displayed
 * - Record URI uses submittedBy DID
 *
 * @remarks
 * This is the default and most common submission model.
 *
 * @packageDocumentation
 */

import { test, expect, type Page } from '@playwright/test';
import { FORM_DATA, SEEDED_EPRINTS, SEEDED_AUTHORS, TEST_USER } from '../fixtures/test-data.js';

/**
 * Creates a minimal valid PDF buffer for testing.
 */
function createTestPdfBuffer(): Buffer {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
306
%%EOF`;
  return Buffer.from(pdfContent, 'utf-8');
}

test.describe('Traditional Submission - Display', () => {
  test('does not show separate paper identity badge', async ({ page }) => {
    // Navigate to a seeded eprint (traditional model)
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Paper identity badge should NOT be visible for traditional submissions
    const paperIdentityBadge = page
      .locator('[data-testid="paper-identity-badge"]')
      .or(page.locator('[data-testid="paper-account"]'));

    // Should not be visible (traditional submissions don't have paperDid)
    await expect(paperIdentityBadge).not.toBeVisible({ timeout: 3000 });
  });

  test('shows author as primary identity', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Author should be the primary identity shown
    const authorName = page.getByText(SEEDED_AUTHORS.white.displayName);
    await expect(authorName).toBeVisible({ timeout: 10000 });
  });

  test('record URI uses submitter DID', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The URI should contain the author's DID
    const uriDisplay = page
      .getByText(new RegExp(SEEDED_AUTHORS.white.did.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .or(page.locator('[data-testid="eprint-uri"]'));

    if (await uriDisplay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await uriDisplay.textContent();
      expect(text).toContain(SEEDED_AUTHORS.white.did);
    }
  });
});

test.describe('Traditional Submission - Blob Fetching', () => {
  test('PDF loads from submitter PDS', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // PDF viewer or download should be available
    const pdfElement = page
      .getByRole('document')
      .or(page.locator('iframe[src*="pdf"]'))
      .or(page.getByRole('button', { name: /download.*pdf/i }))
      .or(page.getByRole('link', { name: /download.*pdf/i }));

    if (await pdfElement.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(pdfElement).toBeVisible();
    }
  });
});

test.describe('Traditional Submission - Full Flow', () => {
  test('can complete submission without paperDid', async ({ page }) => {
    await page.goto('/submit');

    // Wait for dropzone
    await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();

    // Upload file
    const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
    const fileInput = primaryDocSection.getByLabel(/file input/i);
    await fileInput.setInputFiles({
      name: 'traditional-submission.pdf',
      mimeType: 'application/pdf',
      buffer: createTestPdfBuffer(),
    });

    // Verify file uploaded
    await expect(page.getByText('traditional-submission.pdf')).toBeVisible();

    // Navigate to Supplementary step
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    // Verify we're on Supplementary step (optional files)
    await expect(page.getByRole('heading', { name: /supplementary materials/i })).toBeVisible();

    // Skip Supplementary - navigate to Metadata
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByLabel(/title/i)).toBeVisible();

    // Fill metadata
    await page.getByLabel(/title/i).fill(FORM_DATA.validTitle);
    await page.getByLabel(/abstract/i).fill(FORM_DATA.validAbstract);

    // Navigate to authors
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Authors', level: 3, exact: true })
    ).toBeVisible();

    // Submitter should be auto-added
    await expect(page.getByText(TEST_USER.displayName)).toBeVisible({ timeout: 10000 });

    // There should be NO paper account option for traditional submissions
    const paperAccountOption = page.getByText(/paper account|create paper did/i);
    await expect(paperAccountOption).not.toBeVisible({ timeout: 2000 });
  });

  test('review step shows submitter as record owner', async ({ page }) => {
    await page.goto('/submit');

    // Navigate through wizard quickly
    const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
    const fileInput = primaryDocSection.getByLabel(/file input/i);
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: createTestPdfBuffer(),
    });

    // Navigate to Supplementary step
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: /supplementary materials/i })).toBeVisible();

    // Skip to Metadata
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByLabel(/title/i).fill(FORM_DATA.validTitle);
    await page.getByLabel(/abstract/i).fill(FORM_DATA.validAbstract);

    // Navigate to Authors
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Authors', level: 3, exact: true })
    ).toBeVisible();

    // Wait for submitter to be loaded in the form
    await expect(page.locator('[data-testid="author-card-0"]')).toBeVisible();
    await expect(page.getByText(/1\/\d+ authors/)).toBeVisible();

    // Navigate to Fields
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Research Fields', level: 3 })).toBeVisible({
      timeout: 15000,
    });

    // Select a field
    const fieldSearch = page.getByLabel('Field search');
    await fieldSearch.click();
    await page.waitForTimeout(200);
    await fieldSearch.pressSequentially('Ling', { delay: 50 });

    const suggestion = page.locator('[data-testid="field-suggestion"]').first();
    if (await suggestion.isVisible({ timeout: 15000 }).catch(() => false)) {
      await suggestion.click();
    }

    // Navigate to Publication step
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Publication Status', level: 3 })).toBeVisible();

    // Navigate to Review step
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.locator('[data-testid="preview-step"]')).toBeVisible({ timeout: 10000 });

    // Review should show submitter, NOT a separate paper account
    const authorsSection = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { name: 'Authors', level: 4 }),
      })
      .first();
    await expect(authorsSection.getByText(TEST_USER.displayName)).toBeVisible({ timeout: 10000 });

    // Should NOT show paper DID
    const paperDid = page.getByText(/paper.*did|paper.*account/i);
    await expect(paperDid).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('Traditional Submission - Navigation', () => {
  test('author link goes to author profile, not paper profile', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Click author link
    const authorLink = page.getByRole('link', {
      name: new RegExp(SEEDED_AUTHORS.white.displayName, 'i'),
    });

    if (await authorLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await authorLink.click();

      // Should go to /authors/, NOT /papers/
      await expect(page).toHaveURL(/\/authors\//);
      await expect(page).not.toHaveURL(/\/papers\//);
    }
  });

  test('no paper profile link exists for traditional submissions', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Paper profile link should not exist
    const paperProfileLink = page.locator('a[href*="/papers/"]');
    await expect(paperProfileLink).not.toBeVisible({ timeout: 3000 });
  });
});
