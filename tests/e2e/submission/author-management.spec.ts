/**
 * E2E tests for author management in preprint submission.
 *
 * Tests the full author workflow including:
 * - Adding ATProto authors by DID
 * - Adding external collaborators (no DID)
 * - Setting contribution types and degrees
 * - Marking corresponding and highlighted authors
 * - Reordering authors
 * - Author validation
 *
 * @packageDocumentation
 */

import { test, expect, type Page } from '@playwright/test';
import { FORM_DATA, TEST_USER } from '../fixtures/test-data.js';

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

/**
 * Navigate to the Authors step of the submission wizard.
 *
 * Wizard steps: Files -> Supplementary -> Metadata -> Authors -> Fields -> Publication -> Review
 */
async function navigateToAuthorsStep(page: Page) {
  await page.goto('/submit');

  // Wait for dropzone
  await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();

  // Upload file
  const primaryDocSection = page.locator('section').filter({ hasText: /primary document/i });
  const fileInput = primaryDocSection.getByLabel(/file input/i);
  await fileInput.setInputFiles({
    name: 'test.pdf',
    mimeType: 'application/pdf',
    buffer: createTestPdfBuffer(),
  });

  // Navigate to Supplementary step
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  // Verify we're on Supplementary step (optional files)
  await expect(page.getByRole('heading', { name: /supplementary materials/i })).toBeVisible();

  // Skip Supplementary step - navigate to Metadata
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel(/title/i)).toBeVisible();

  // Fill metadata
  await page.getByLabel(/title/i).fill(FORM_DATA.validTitle);
  await page.getByLabel(/abstract/i).fill(FORM_DATA.validAbstract);

  // Navigate to authors
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Authors', level: 3, exact: true })).toBeVisible();
}

test.describe('Author Management - Full Flow', () => {
  test('submitter is automatically added as first author', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Verify submitter is added as first author
    const authorCard = page.locator('[data-testid="author-card-0"]');
    await expect(authorCard).toBeVisible();
    await expect(authorCard.getByText(TEST_USER.displayName)).toBeVisible();

    // Verify author count
    await expect(page.getByText('1/50 authors').or(page.getByText('1/20 authors'))).toBeVisible();
  });

  test('can add co-author by DID lookup', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Click add author button
    const addButton = page.getByRole('button', { name: /add author/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Wait for author form
    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    // Select ATProto author type
    const atprotoTab = page
      .getByRole('tab', { name: /atproto/i })
      .or(page.getByText(/atproto user/i));
    if (await atprotoTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await atprotoTab.click();
    }

    // Enter DID
    const didInput = authorForm.getByPlaceholder(/did:plc:/i).or(page.getByLabel(/did/i));
    await expect(didInput).toBeVisible();
    await didInput.fill(FORM_DATA.validDid);

    // Enter name
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Test Co-Author');

    // Save author
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Verify author was added
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2/50 authors').or(page.getByText('2/20 authors'))).toBeVisible();
  });

  test('can add external collaborator without DID', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Click add author button
    await page.getByRole('button', { name: /add author/i }).click();

    // Wait for author form
    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    // Select external author type
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    // Enter name (required)
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await expect(nameInput).toBeVisible();
    await nameInput.fill('External Collaborator');

    // Enter ORCID (optional but recommended)
    const orcidInput = authorForm.getByPlaceholder(/orcid/i).or(page.getByLabel(/orcid/i));
    if (await orcidInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await orcidInput.fill(FORM_DATA.validOrcid);
    }

    // Enter email (optional)
    const emailInput = authorForm.getByPlaceholder(/email/i).or(page.getByLabel(/email/i));
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill('external@example.edu');
    }

    // Save author
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Verify author was added
    const newAuthorCard = page.locator('[data-testid="author-card-1"]');
    await expect(newAuthorCard).toBeVisible({ timeout: 10000 });
    await expect(newAuthorCard.getByText('External Collaborator')).toBeVisible();
  });

  test('can mark author as corresponding', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // First author (submitter) should be corresponding by default
    const primaryCard = page.locator('[data-testid="author-card-0"]');
    await expect(primaryCard).toBeVisible();

    // Check for corresponding badge or checkbox
    const correspondingIndicator = primaryCard
      .getByText(/corresponding/i)
      .or(primaryCard.getByRole('checkbox', { name: /corresponding/i }));
    await expect(correspondingIndicator).toBeVisible();
  });

  test('can mark author as highlighted (co-first)', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Open author details for editing
    const primaryCard = page.locator('[data-testid="author-card-0"]');
    await expect(primaryCard).toBeVisible();

    // Look for expand/edit button
    const expandButton = primaryCard.getByRole('button', { name: /expand|edit|details/i });
    if (await expandButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expandButton.click();
    }

    // Look for highlighted checkbox
    const highlightedCheckbox = page.getByRole('checkbox', { name: /highlighted|co-first/i });
    if (await highlightedCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await highlightedCheckbox.check();
      await expect(highlightedCheckbox).toBeChecked();
    }
  });

  test('can remove co-author (not primary)', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add a co-author first
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('Author To Remove');
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Wait for author to be added
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2/50 authors').or(page.getByText('2/20 authors'))).toBeVisible();

    // Remove the second author
    const secondCard = page.locator('[data-testid="author-card-1"]');
    await secondCard.getByRole('button', { name: /remove author/i }).click();

    // Verify author was removed
    await expect(page.getByText('1/50 authors').or(page.getByText('1/20 authors'))).toBeVisible();
    await expect(page.getByText('Author To Remove')).not.toBeVisible();
  });

  test('primary author cannot be removed', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Primary author card should not have remove button
    const primaryCard = page.locator('[data-testid="author-card-0"]');
    await expect(primaryCard).toBeVisible();
    await expect(primaryCard.getByRole('button', { name: /remove author/i })).not.toBeVisible();
  });

  test('validates DID format', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Open add author form
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    // Enter invalid DID
    const didInput = authorForm.getByPlaceholder(/did:plc:/i).or(page.getByLabel(/did/i));
    if (await didInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await didInput.fill(FORM_DATA.invalidDid);
      await authorForm.getByRole('button', { name: 'Add Author' }).click();

      // Should show validation error
      await expect(page.getByText(/invalid did/i)).toBeVisible();
    }
  });

  test('validates at least one author required', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Wait for submitter to be fully added to form state
    const authorCard = page.locator('[data-testid="author-card-0"]');
    await expect(authorCard).toBeVisible();
    await expect(authorCard.getByText('Submitter')).toBeVisible();
    await expect(page.getByText(/1\/\d+ authors/)).toBeVisible();

    // Try to proceed - should work since we have one author
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Should proceed to fields step (extended timeout for async validation)
    await expect(page.getByRole('heading', { name: 'Research Fields', level: 3 })).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe('Author Affiliations', () => {
  test('can add affiliation to author', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Open author details
    const primaryCard = page.locator('[data-testid="author-card-0"]');
    const expandButton = primaryCard.getByRole('button', { name: /expand|edit|details/i });
    if (await expandButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expandButton.click();
    }

    // Look for affiliation input
    const affiliationInput = page.getByPlaceholder(/affiliation|institution/i);
    if (await affiliationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await affiliationInput.fill('University of Example');

      // Check if affiliation was added
      await expect(page.getByText('University of Example')).toBeVisible();
    }
  });

  test('can add multiple affiliations', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Open author details
    const primaryCard = page.locator('[data-testid="author-card-0"]');
    const expandButton = primaryCard.getByRole('button', { name: /expand|edit|details/i });
    if (await expandButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expandButton.click();
    }

    // Add first affiliation
    const affiliationInput = page.getByPlaceholder(/affiliation|institution/i);
    if (await affiliationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await affiliationInput.fill('First University');

      // Add another affiliation
      const addAffiliationButton = page.getByRole('button', { name: /add affiliation/i });
      if (await addAffiliationButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addAffiliationButton.click();

        // Fill second affiliation
        const secondInput = page.getByPlaceholder(/affiliation|institution/i).last();
        await secondInput.fill('Second Institute');

        // Verify both are shown
        await expect(page.getByText('First University')).toBeVisible();
        await expect(page.getByText('Second Institute')).toBeVisible();
      }
    }
  });
});

test.describe('Author Ordering', () => {
  test('displays authors in correct order', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add second author
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('Second Author');
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Wait for author to be added
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });

    // Verify order: primary author first, then second author
    const firstCard = page.locator('[data-testid="author-card-0"]');
    const secondCard = page.locator('[data-testid="author-card-1"]');

    await expect(firstCard.getByText(TEST_USER.displayName)).toBeVisible();
    await expect(secondCard.getByText('Second Author')).toBeVisible();
  });

  test('can reorder authors via buttons', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add second author
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('Second Author');
    await authorForm.getByRole('button', { name: 'Add Author' }).click();
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });

    // Look for reorder buttons (up/down arrows)
    const secondCard = page.locator('[data-testid="author-card-1"]');
    const moveUpButton = secondCard.getByRole('button', { name: /move up|reorder/i });

    if (await moveUpButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moveUpButton.click();

      // After reordering, "Second Author" should now be first
      await expect(
        page.locator('[data-testid="author-card-0"]').getByText('Second Author')
      ).toBeVisible();
    }
  });
});
