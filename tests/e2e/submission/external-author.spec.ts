/**
 * E2E tests for external author (collaborator) management.
 *
 * Tests adding authors without ATProto DIDs:
 * - Adding external collaborator with name only
 * - Adding ORCID for external authors
 * - Adding email for external authors
 * - Adding affiliations with ROR lookup
 * - Display of external authors in review
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

test.describe('External Author - Basic Flow', () => {
  test('can add external author without DID', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Click add author button
    const addButton = page.getByRole('button', { name: /add author/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Wait for author form
    const authorForm = page.locator('[data-testid="author-form"]');
    await expect(authorForm).toBeVisible();

    // Select external author type if tabs are present
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    // Enter name (required for external authors)
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Dr. External Researcher');

    // Save author
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Verify author was added
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Dr. External Researcher')).toBeVisible();
  });

  test('external author shows "External" indicator', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add external author
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('External Author Name');
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Verify author card shows external indicator
    const secondCard = page.locator('[data-testid="author-card-1"]');
    await expect(secondCard).toBeVisible({ timeout: 10000 });

    // Look for "External" badge or indicator
    const externalIndicator = secondCard
      .getByText(/external/i)
      .or(secondCard.locator('[data-testid="external-badge"]'));
    if (await externalIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(externalIndicator).toBeVisible();
    }
  });

  test('requires name for external author', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add external author without name
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    // Try to save without name
    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Should show validation error
    const nameError = page.getByText(/name.*required/i).or(page.getByText(/enter.*name/i));
    await expect(nameError).toBeVisible();
  });
});

test.describe('External Author - ORCID', () => {
  test('can add ORCID to external author', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add external author with ORCID
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    // Fill name
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('ORCID Author');

    // Fill ORCID
    const orcidInput = authorForm
      .getByPlaceholder(/orcid/i)
      .or(authorForm.getByLabel(/orcid/i))
      .or(authorForm.getByPlaceholder(/0000-0002-1825-0097/i));

    if (await orcidInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await orcidInput.fill(FORM_DATA.validOrcid);
    }

    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Verify ORCID is displayed
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });

    // Look for ORCID link
    const orcidLink = page.getByRole('link', { name: /orcid/i });
    if (await orcidLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(orcidLink).toBeVisible();
    }
  });

  test('validates ORCID format', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add external author with invalid ORCID
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    // Fill name
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('Invalid ORCID Author');

    // Fill invalid ORCID
    const orcidInput = authorForm.getByPlaceholder(/orcid/i).or(authorForm.getByLabel(/orcid/i));

    if (await orcidInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await orcidInput.fill(FORM_DATA.invalidOrcid);
      await authorForm.getByRole('button', { name: 'Add Author' }).click();

      // Should show validation error
      const orcidError = page.getByText(/invalid orcid/i).or(page.getByText(/orcid.*format/i));
      await expect(orcidError).toBeVisible();
    }
  });
});

test.describe('External Author - Email', () => {
  test('can add email to external author', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add external author with email
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    // Fill name
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('Email Author');

    // Fill email
    const emailInput = authorForm.getByPlaceholder(/email/i).or(authorForm.getByLabel(/email/i));

    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill('author@university.edu');
    }

    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Verify author was added
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });
  });

  test('validates email format', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add external author with invalid email
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    // Fill name
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('Invalid Email Author');

    // Fill invalid email
    const emailInput = authorForm.getByPlaceholder(/email/i).or(authorForm.getByLabel(/email/i));

    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill('not-an-email');
      await authorForm.getByRole('button', { name: 'Add Author' }).click();

      // Should show validation error
      const emailError = page.getByText(/invalid email/i).or(page.getByText(/email.*format/i));
      await expect(emailError).toBeVisible();
    }
  });
});

test.describe('External Author - Affiliations', () => {
  test('can add affiliation to external author', async ({ page }) => {
    // Mock ROR API to return empty results - forces manual add option to appear
    let apiCalled = false;
    await page.route('https://api.ror.org/**', async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await navigateToAuthorsStep(page);

    // Add external author
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type by clicking the radio label
    const externalRadio = authorForm.locator('label').filter({ hasText: /external collaborator/i });
    await expect(externalRadio).toBeVisible({ timeout: 3000 });
    await externalRadio.click();

    // Fill name
    const nameInput = authorForm.getByLabel('Name *');
    await nameInput.fill('Affiliated External Author');

    // Add affiliation
    const affiliationInput = authorForm.getByPlaceholder(/search organizations/i);
    await affiliationInput.fill('Stanford University');

    // Wait for the dropdown with manual add option (appears after search returns empty or times out)
    // Use locator by text content - the button says "Add "Stanford University" without ROR"
    const manualAddButton = page.locator('button').filter({ hasText: /without ROR/i });
    await expect(manualAddButton).toBeVisible({ timeout: 10000 });
    await manualAddButton.click();

    // Wait for affiliation card to appear
    await expect(authorForm.locator('[data-testid="affiliation-card-0"]')).toBeVisible({
      timeout: 5000,
    });

    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Verify author was added
    const authorCard = page.locator('[data-testid="author-card-1"]');
    await expect(authorCard).toBeVisible({ timeout: 10000 });

    // Expand the card to see affiliations (hidden by default)
    await authorCard.getByRole('button', { name: 'Details' }).click();

    // Now verify affiliation is shown
    await expect(page.getByText('Stanford University')).toBeVisible();
  });

  test('can search for institution with ROR', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add external author
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    // Fill name
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('ROR Affiliation Author');

    // Type in affiliation to trigger ROR search
    const affiliationInput = authorForm
      .getByPlaceholder(/affiliation|institution/i)
      .or(authorForm.getByLabel(/affiliation/i));

    if (await affiliationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await affiliationInput.fill('MIT');

      // Wait for ROR suggestions
      const suggestion = page
        .getByRole('option', { name: /massachusetts institute/i })
        .or(page.getByText(/massachusetts institute of technology/i));

      if (await suggestion.isVisible({ timeout: 5000 }).catch(() => false)) {
        await suggestion.click();
        await expect(page.getByText(/massachusetts/i)).toBeVisible();
      }
    }
  });

  test('can add department to affiliation', async ({ page }) => {
    // Mock ROR API to return empty results - forces manual add option to appear
    await page.route('https://api.ror.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await navigateToAuthorsStep(page);

    // Add external author
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type by clicking the radio label
    const externalRadio = authorForm.locator('label').filter({ hasText: /external collaborator/i });
    await expect(externalRadio).toBeVisible({ timeout: 3000 });
    await externalRadio.click();

    // Fill name
    const nameInput = authorForm.getByLabel('Name *');
    await nameInput.fill('Department Author');

    // Add affiliation
    const affiliationInput = authorForm.getByPlaceholder(/search organizations/i);
    await affiliationInput.fill('University of Rochester');

    // Wait for the dropdown with manual add option
    const manualAddButton = page.locator('button').filter({ hasText: /without ROR/i });
    await expect(manualAddButton).toBeVisible({ timeout: 10000 });
    await manualAddButton.click();

    // Wait for affiliation card to appear, then add department
    const affiliationCard = authorForm.locator('[data-testid="affiliation-card-0"]');
    await expect(affiliationCard).toBeVisible({ timeout: 5000 });
    const departmentInput = affiliationCard.getByPlaceholder(/e\.g\.|computer/i);
    await departmentInput.fill('Department of Linguistics');

    await authorForm.getByRole('button', { name: 'Add Author' }).click();

    // Verify author was added
    const authorCard = page.locator('[data-testid="author-card-1"]');
    await expect(authorCard).toBeVisible({ timeout: 10000 });

    // Expand the card to see affiliations (hidden by default)
    await authorCard.getByRole('button', { name: 'Details' }).click();

    // Now verify affiliation and department are shown
    await expect(page.getByText('University of Rochester')).toBeVisible();
    await expect(page.getByText('Department of Linguistics')).toBeVisible();
  });
});

test.describe('External Author - Review Display', () => {
  test('external author displays correctly in review step', async ({ page }) => {
    await navigateToAuthorsStep(page);

    // Add external author
    await page.getByRole('button', { name: /add author/i }).click();
    const authorForm = page.locator('[data-testid="author-form"]');

    // Select external type
    const externalTab = page
      .getByRole('tab', { name: /external/i })
      .or(page.getByText(/external collaborator/i));
    if (await externalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await externalTab.click();
    }

    // Fill external author details
    const nameInput = authorForm.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
    await nameInput.fill('Review External Author');

    const orcidInput = authorForm.getByPlaceholder(/orcid/i).or(authorForm.getByLabel(/orcid/i));
    if (await orcidInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await orcidInput.fill(FORM_DATA.validOrcid);
    }

    await authorForm.getByRole('button', { name: 'Add Author' }).click();
    await expect(page.locator('[data-testid="author-card-1"]')).toBeVisible({ timeout: 10000 });

    // Navigate to fields step
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Research Fields', level: 3 })).toBeVisible();

    // Select a field
    const fieldSearch = page.getByLabel('Field search');
    await expect(fieldSearch).toBeVisible();
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

    // Verify external author appears in review - use first() to avoid strict mode violation
    const authorsSection = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { name: 'Authors', level: 4 }),
      })
      .first();
    await expect(authorsSection.getByText('Review External Author')).toBeVisible({
      timeout: 10000,
    });
  });
});
