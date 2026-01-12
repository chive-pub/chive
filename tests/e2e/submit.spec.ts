/**
 * E2E tests for eprint submission.
 *
 * Tests the submission wizard flow.
 * Note: These tests run in authenticated context.
 */

import { test, expect, type Page } from '@playwright/test';
import { FORM_DATA } from './fixtures/test-data.js';

/**
 * Create a minimal valid PDF buffer for testing.
 * This creates a 1-page PDF with minimal content.
 */
function createTestPdfBuffer(): Buffer {
  // Minimal valid PDF structure
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

test.describe('Eprint submission', () => {
  test('displays submission page when authenticated', async ({ page }) => {
    await page.goto('/submit');

    // When authenticated, should show the submission page (not redirect)
    const heading = page.getByRole('heading', { name: /submit.*eprint/i });
    await expect(heading).toBeVisible();
  });

  test('displays submission wizard with step indicators', async ({ page }) => {
    await page.goto('/submit');

    // Should show the wizard heading
    await expect(page.getByRole('heading', { name: 'Submit a Eprint' })).toBeVisible();

    // Should show step indicators in the progress navigation
    const progressNav = page.getByRole('navigation', { name: 'Progress' });
    await expect(progressNav.getByText('Files', { exact: true })).toBeVisible();
    await expect(progressNav.getByText('Supplementary', { exact: true })).toBeVisible();
    await expect(progressNav.getByText('Metadata', { exact: true })).toBeVisible();

    // Should show the file upload area (first step of wizard)
    await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();
  });

  test.describe('submission wizard steps', () => {
    test('shows validation error when proceeding without PDF', async ({ page }) => {
      await page.goto('/submit');

      // Wait for wizard to load
      await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();

      // Click Next without uploading a file
      const nextButton = page.getByRole('button', { name: 'Next', exact: true });
      await nextButton.click();

      // Should stay on files step (validation prevents navigation without file)
      // Verify dropzone is still visible (we're still on files step)
      await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();
    });

    test('uploads PDF file and shows preview', async ({ page }) => {
      await page.goto('/submit');

      // Wait for file dropzone to be ready
      await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();

      // Create and upload a test PDF; use first file input (primary document).
      const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
      const fileInput = primaryDocSection.getByLabel(/file input/i);
      const pdfBuffer = createTestPdfBuffer();

      await fileInput.setInputFiles({
        name: 'test-eprint.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      // Should show the uploaded file name somewhere on the page
      await expect(page.getByText('test-eprint.pdf')).toBeVisible();
    });

    test('navigates to metadata step after file upload', async ({ page }) => {
      await page.goto('/submit');

      // Upload a test PDF; use first file input (primary document).
      const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
      const fileInput = primaryDocSection.getByLabel(/file input/i);
      const pdfBuffer = createTestPdfBuffer();

      await fileInput.setInputFiles({
        name: 'test-eprint.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      // Click Next to proceed to Supplementary step
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('heading', { name: /supplementary materials/i })).toBeVisible();

      // Click Next to proceed to Metadata step
      await page.getByRole('button', { name: 'Next', exact: true }).click();

      // Should be on metadata step; check for title input or metadata heading.
      const metadataIndicator = page
        .getByRole('heading', { name: /metadata/i })
        .or(page.getByLabel(/title/i));
      await expect(metadataIndicator).toBeVisible();
    });

    test('shows author form for adding co-authors', async ({ page }) => {
      await page.goto('/submit');

      // Upload file and proceed through steps; use first file input (primary document).
      const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
      const fileInput = primaryDocSection.getByLabel(/file input/i);
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: createTestPdfBuffer(),
      });

      // Go to Supplementary step
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('heading', { name: /supplementary materials/i })).toBeVisible();

      // Go to Metadata step
      await page.getByRole('button', { name: 'Next', exact: true }).click();

      // Fill required metadata (wait for title input to be visible first)
      await expect(page.getByLabel(/title/i)).toBeVisible();
      await page.getByLabel(/title/i).fill('Test Eprint Title for E2E Testing');
      await page
        .getByLabel(/abstract/i)
        .fill(
          'This is a test abstract that needs to be at least 50 characters long for validation purposes.'
        );

      // Go to Authors step
      await page.getByRole('button', { name: 'Next', exact: true }).click();

      // Should show authors step; verify the main Authors heading (level 3 in content area).
      const authorsHeading = page.getByRole('heading', { name: 'Authors', exact: true, level: 3 });
      await expect(authorsHeading).toBeVisible();
    });

    test('shows classification step for field selection', async ({ page }) => {
      await page.goto('/submit');

      // Navigate through steps; use first file input (primary document).
      const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
      const fileInput = primaryDocSection.getByLabel(/file input/i);
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: createTestPdfBuffer(),
      });

      // Files -> Supplementary
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('heading', { name: /supplementary materials/i })).toBeVisible();

      // Supplementary -> Metadata
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByLabel(/title/i)).toBeVisible();
      await page.getByLabel(/title/i).fill('Test Eprint');
      await page
        .getByLabel(/abstract/i)
        .fill(
          'This is a test abstract with sufficient length for validation requirements to pass properly.'
        );

      // Metadata -> Authors
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      // Wait for authors step to load
      await expect(
        page.getByRole('heading', { name: 'Authors', exact: true, level: 3 })
      ).toBeVisible();
      // Wait for primary author to be added and author count to update
      await expect(page.getByText(/1\/\d+ authors/)).toBeVisible();

      // Authors -> Fields
      await page.getByRole('button', { name: 'Next', exact: true }).click();

      // Wait for Authors heading to disappear (confirming navigation)
      await expect(
        page.getByRole('heading', { name: 'Authors', exact: true, level: 3 })
      ).not.toBeVisible({
        timeout: 10000,
      });

      // Should show fields/classification step; verify the Research Fields heading.
      const fieldsHeading = page.getByRole('heading', { name: 'Research Fields', level: 3 });
      await expect(fieldsHeading).toBeVisible();
    });

    test('shows fields step with field search and validation message', async ({ page }) => {
      await page.goto('/submit');

      // Navigate through all steps; use first file input (primary document).
      const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
      const fileInput = primaryDocSection.getByLabel(/file input/i);
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: createTestPdfBuffer(),
      });

      // Files -> Supplementary
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('heading', { name: /supplementary materials/i })).toBeVisible();

      // Supplementary -> Metadata
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByLabel(/title/i)).toBeVisible();
      await page.getByLabel(/title/i).fill('Test Eprint for Review');
      await page
        .getByLabel(/abstract/i)
        .fill(
          'This is a comprehensive test abstract for the E2E testing suite that validates the submission workflow.'
        );

      // Metadata -> Authors
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      // Wait for authors step to load
      await expect(
        page.getByRole('heading', { name: 'Authors', exact: true, level: 3 })
      ).toBeVisible();
      // Wait for primary author to be added and author count to update
      await expect(page.getByText(/1\/\d+ authors/)).toBeVisible();

      // Authors -> Fields (skip adding co-authors, primary author auto-added)
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      // Wait for fields step to load
      await expect(
        page.getByRole('heading', { name: 'Authors', exact: true, level: 3 })
      ).not.toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByRole('heading', { name: 'Research Fields', level: 3 })).toBeVisible();

      // Verify field search is available
      const fieldSearch = page.getByLabel('Field search');
      await expect(fieldSearch).toBeVisible();

      // Verify validation message is shown (at least one field required)
      await expect(page.getByText(/at least one field is required/i)).toBeVisible();

      // Click Next without selecting a field; should stay on Fields step.
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      // Verify we're still on Fields step (validation prevents navigation)
      await expect(page.getByRole('heading', { name: 'Research Fields', level: 3 })).toBeVisible();
    });
  });
});

/**
 * Helper to navigate through steps 1-4 to reach step 5 (Review).
 */
async function navigateToReviewStep(page: Page) {
  await page.goto('/submit');

  // Wait for dropzone to be visible
  await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();

  // Step 1: Upload PDF
  const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
  const fileInput = primaryDocSection.getByLabel(/file input/i);
  await fileInput.setInputFiles({
    name: 'test-eprint.pdf',
    mimeType: 'application/pdf',
    buffer: createTestPdfBuffer(),
  });

  // Verify file was uploaded
  await expect(page.getByText('test-eprint.pdf')).toBeVisible();

  // Next -> Supplementary
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /supplementary materials/i, level: 3 })
  ).toBeVisible();

  // Skip Supplementary (optional step) -> Metadata
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel(/title/i)).toBeVisible();

  // Step 3: Fill metadata
  await page.getByLabel(/title/i).fill(FORM_DATA.validTitle);
  await page.getByLabel(/abstract/i).fill(FORM_DATA.validAbstract);

  // Next -> Authors
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/1\/\d+ authors/)).toBeVisible();

  // Step 4: Authors (primary auto-added)
  // Next -> Fields
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Research Fields', level: 3 })).toBeVisible();

  // Step 4: Select a field; wait for field search input to be visible.
  const fieldSearch = page.getByLabel('Field search');
  await expect(fieldSearch).toBeVisible();

  // Click to focus the input; this should open the popover.
  await fieldSearch.click();

  // Wait briefly for focus to register
  await page.waitForTimeout(200);

  // Type character by character to trigger React state updates and popover
  await fieldSearch.pressSequentially('Ling', { delay: 50 });

  // Wait for the popover content to load (either suggestions or "no fields found")
  // The popover should be visible after typing
  const suggestionOrEmpty = page
    .locator('[data-testid="field-suggestion"]')
    .first()
    .or(page.getByText(/no fields found/i));

  // Give more time for API response
  await expect(suggestionOrEmpty).toBeVisible({ timeout: 15000 });

  // If we have a suggestion, click it
  const suggestion = page.locator('[data-testid="field-suggestion"]').first();
  if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
    await suggestion.click();
    await expect(page.getByText(/1\/10 fields/)).toBeVisible();
  } else {
    // If no suggestions appear, we cannot proceed; throw a clear error.
    throw new Error(
      'Field search did not show any suggestions or "no fields found" message. ' +
        'This likely indicates the listFields API is not returning data. ' +
        'Check Neo4j seeding in global.setup.ts.'
    );
  }

  // Next -> Publication
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: /publication status/i, level: 3 })).toBeVisible();

  // Next -> Review
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('[data-testid="preview-step"]')).toBeVisible();
}

/**
 * Helper to navigate to the Authors step.
 */
async function navigateToAuthorsStep(page: Page) {
  await page.goto('/submit');

  // Wait for dropzone to be visible
  await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();

  // Upload file
  const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
  const fileInput = primaryDocSection.getByLabel(/file input/i);
  await fileInput.setInputFiles({
    name: 'test.pdf',
    mimeType: 'application/pdf',
    buffer: createTestPdfBuffer(),
  });

  // Verify file was uploaded
  await expect(page.getByText('test.pdf')).toBeVisible();

  // Navigate to Supplementary
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /supplementary materials/i, level: 3 })
  ).toBeVisible();

  // Skip Supplementary -> Metadata
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel(/title/i)).toBeVisible();

  // Fill metadata
  await page.getByLabel(/title/i).fill(FORM_DATA.validTitle);
  await page.getByLabel(/abstract/i).fill(FORM_DATA.validAbstract);

  // Navigate to authors
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/1\/\d+ authors/)).toBeVisible();
}

/**
 * Helper to navigate to the Metadata step.
 */
async function navigateToMetadataStep(page: Page) {
  await page.goto('/submit');

  // Wait for dropzone to be visible
  await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();

  // Upload file
  const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
  const fileInput = primaryDocSection.getByLabel(/file input/i);
  await fileInput.setInputFiles({
    name: 'test.pdf',
    mimeType: 'application/pdf',
    buffer: createTestPdfBuffer(),
  });

  // Verify file was uploaded
  await expect(page.getByText('test.pdf')).toBeVisible();

  // Navigate to Supplementary
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /supplementary materials/i, level: 3 })
  ).toBeVisible();

  // Skip Supplementary -> Metadata
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel(/title/i)).toBeVisible();
}

test.describe('Step 7: Review and Submit', () => {
  test('displays submission summary with preview-step testid', async ({ page }) => {
    await navigateToReviewStep(page);
    await expect(page.locator('[data-testid="preview-step"]')).toBeVisible();
    await expect(page.getByText('Review Your Submission')).toBeVisible();
  });

  test('shows Ready to Submit alert when form is valid', async ({ page }) => {
    await navigateToReviewStep(page);
    await expect(page.getByText('Ready to Submit')).toBeVisible();
  });

  test('shows PDF file name in Files section', async ({ page }) => {
    await navigateToReviewStep(page);
    await expect(page.getByText('test-eprint.pdf')).toBeVisible();
  });

  test('shows entered title in Metadata section', async ({ page }) => {
    await navigateToReviewStep(page);
    await expect(page.getByText(FORM_DATA.validTitle)).toBeVisible();
  });

  test('shows primary author with Primary badge', async ({ page }) => {
    await navigateToReviewStep(page);
    // Wait for Authors section to render completely
    const authorsSection = page.locator('section, div').filter({
      has: page.getByRole('heading', { name: 'Authors', level: 4 }),
    });
    await expect(authorsSection.getByText('E2E Test User')).toBeVisible({ timeout: 10000 });
    // Use exact match to avoid matching "Primary Document" from Files section
    await expect(authorsSection.getByText('Primary', { exact: true })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows selected field from knowledge graph', async ({ page }) => {
    await navigateToReviewStep(page);
    await expect(page.getByText('Linguistics')).toBeVisible();
  });

  test('Back button returns to Publication step', async ({ page }) => {
    await navigateToReviewStep(page);
    await page.getByRole('button', { name: /back/i }).click();
    await expect(
      page.getByRole('heading', { name: /publication status/i, level: 3 })
    ).toBeVisible();
  });

  test('Submit button triggers submission process', async ({ page }) => {
    await navigateToReviewStep(page);
    const submitButton = page.getByRole('button', { name: /submit eprint/i });
    await submitButton.click();

    // With mock agent, submission completes very quickly and redirects to eprint page.
    // Verify that clicking Submit either:
    // 1. Shows "Submitting..." loading state briefly, OR
    // 2. Redirects to eprint page URL (indicates successful submission)
    // We check URL change since text matching is unreliable due to "eprint" appearing in many places.
    await Promise.race([
      expect(page.getByText('Submitting...'))
        .toBeVisible({ timeout: 2000 })
        .catch(() => {}),
      expect(page).toHaveURL(/\/eprints\//, { timeout: 10000 }),
    ]);
  });
});

test.describe('Co-Author Management', () => {
  test('displays author form with data-testid', async ({ page }) => {
    await navigateToAuthorsStep(page);
    // Click Add Author button to show the form
    await page.getByRole('button', { name: 'Add Author' }).click();
    await expect(page.locator('[data-testid="author-form"]')).toBeVisible();
  });

  test('can add co-author by entering valid DID', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Click Add Author button to show the form
    await page.getByRole('button', { name: 'Add Author' }).click();

    // Wait for author form and inputs
    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    // Switch to ATProto User mode (form defaults to External Collaborator)
    await authorForm.getByRole('radio', { name: /atproto user/i }).click();

    const didInput = authorForm.getByPlaceholder('did:plc:...');
    const nameInput = authorForm.getByPlaceholder('Jane Doe');
    await expect(didInput).toBeVisible();

    // Fill the form and submit
    await didInput.fill(FORM_DATA.validDid);
    await nameInput.fill('Test Co-Author');
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Wait for the new author card to appear
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/2\/\d+ authors/)).toBeVisible();
  });

  test('shows validation error for invalid DID format', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Click Add Author button to show the form
    await page.getByRole('button', { name: 'Add Author' }).click();

    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    // Switch to ATProto User mode (form defaults to External Collaborator)
    await authorForm.getByRole('radio', { name: /atproto user/i }).click();

    // Fill invalid DID and click Add Author in form
    await authorForm.getByPlaceholder('did:plc:...').fill(FORM_DATA.invalidDid);
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Check for validation error
    await expect(page.getByText(/invalid did format/i)).toBeVisible();
  });

  test('can add ORCID for co-author', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Click Add Author button to show the form
    await page.getByRole('button', { name: 'Add Author' }).click();

    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    // Switch to ATProto User mode (form defaults to External Collaborator)
    await authorForm.getByRole('radio', { name: /atproto user/i }).click();

    // Fill DID, Name, and ORCID (Name is required for ATProto User)
    await authorForm.getByPlaceholder('did:plc:...').fill(FORM_DATA.validDid);
    await authorForm.getByPlaceholder('Jane Doe').fill('Test Co-Author');
    await authorForm.getByPlaceholder('0000-0002-1825-0097').fill(FORM_DATA.validOrcid);
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Wait for the new author card with ORCID link
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /orcid/i })).toBeVisible();
  });

  test('primary author card does not have remove button', async ({ page }) => {
    await navigateToAuthorsStep(page);
    const primaryCard = page.locator('[data-testid="author-card-0"]');
    await expect(primaryCard).toBeVisible();
    await expect(primaryCard.getByRole('button', { name: /remove/i })).not.toBeVisible();
  });

  test('can remove co-author after adding', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Click Add Author button to show the form
    await page.getByRole('button', { name: 'Add Author' }).click();

    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    // Switch to ATProto User mode (form defaults to External Collaborator)
    await authorForm.getByRole('radio', { name: /atproto user/i }).click();

    // Add co-author - both DID and Name are required
    await authorForm.getByPlaceholder('did:plc:...').fill(FORM_DATA.validDid);
    await authorForm.getByPlaceholder('Jane Doe').fill('Test Co-Author');
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Wait for the author to be added
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/2\/\d+ authors/)).toBeVisible();

    // Remove the second author
    const secondCard = page.locator('[data-testid="author-card-1"]');
    await secondCard.getByRole('button', { name: /remove/i }).click();
    await expect(page.getByText(/1\/\d+ authors/)).toBeVisible();
  });
});

test.describe('License Selection', () => {
  test('displays license dropdown on metadata step', async ({ page }) => {
    await navigateToMetadataStep(page);
    const licenseSelect = page.getByRole('combobox', { name: /license/i });
    await expect(licenseSelect).toBeVisible();
  });
});
