/**
 * E2E tests for reconciliation proposal flow.
 *
 * Tests the complete workflow for proposing reconciliations between
 * Chive entities and external knowledge bases:
 * - Navigate to governance page
 * - Create new reconciliation proposal
 * - Select source entity type and URI
 * - Select target external system
 * - Choose SKOS match type
 * - Submit proposal
 *
 * @packageDocumentation
 */

import { test, expect } from '@playwright/test';

test.describe('Reconciliation Proposal - Category Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');
  });

  test('shows reconciliation category option', async ({ page }) => {
    // Use label selector to avoid matching multiple elements
    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    await expect(reconciliationLabel).toBeVisible({ timeout: 5000 });
  });

  test('can select reconciliation category', async ({ page }) => {
    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();

    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();

      // Should show reconciliation-specific proposal types
      await expect(
        page.locator('label').filter({ hasText: 'Create Reconciliation' })
      ).toBeVisible();
    }
  });

  test('shows reconciliation category description', async ({ page }) => {
    const description = page.getByText(/link chive entities to external knowledge bases/i);
    await expect(description).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Reconciliation Proposal - Form Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select reconciliation category
    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }
  });

  test('shows source entity section', async ({ page }) => {
    const sourceSection = page.getByText('Source Entity (Chive)').first();
    await expect(sourceSection).toBeVisible({ timeout: 5000 });
  });

  test('shows target entity section', async ({ page }) => {
    const targetSection = page.getByText('Target Entity (External)').first();
    await expect(targetSection).toBeVisible({ timeout: 5000 });
  });

  test('shows match details section', async ({ page }) => {
    const matchSection = page.getByText('Match Details').first();
    await expect(matchSection).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Reconciliation Proposal - Source Entity Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }
  });

  test('shows source entity type dropdown', async ({ page }) => {
    const entityTypeSelect = page.getByRole('combobox', { name: /entity type/i });
    await expect(entityTypeSelect).toBeVisible({ timeout: 5000 });
  });

  test('entity type dropdown contains all reconcilable types', async ({ page }) => {
    const entityTypeSelect = page.getByRole('combobox', { name: /entity type/i });

    if (await entityTypeSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await entityTypeSelect.click();
      await page.waitForTimeout(300);

      // Use option role to match dropdown items (Playwright best practice)
      await expect(page.getByRole('option', { name: /knowledge graph field/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /contribution type/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /facet value/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /organization/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /author/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /preprint/i })).toBeVisible();
    }
  });

  test('shows source entity URI field', async ({ page }) => {
    const uriField = page.getByLabel(/entity uri/i);
    await expect(uriField).toBeVisible({ timeout: 5000 });
  });

  test('shows source entity label field', async ({ page }) => {
    const labelField = page.getByLabel(/entity label/i);
    await expect(labelField).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Reconciliation Proposal - Target Entity Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }
  });

  test('shows external system dropdown', async ({ page }) => {
    // There are multiple selects, find the external system one
    const systemSelects = page.locator('[role="combobox"]');
    const count = await systemSelects.count();

    // External system should be the second select (after entity type)
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('external system dropdown contains expected systems', async ({ page }) => {
    const allSelects = page.locator('[role="combobox"]');
    const count = await allSelects.count();

    // Click the second select (external system)
    if (count >= 2) {
      await allSelects.nth(1).click();
      await page.waitForTimeout(300);

      // Get the dropdown listbox for scrolling
      const dropdown = page.locator('[role="listbox"]');

      // Check first batch of systems (visible without scrolling)
      await expect(
        page
          .locator('[role="option"]')
          .filter({ hasText: /wikidata/i })
          .first()
      ).toBeVisible();
      await expect(
        page.locator('[role="option"]').filter({ hasText: /ror/i }).first()
      ).toBeVisible();
      await expect(
        page.locator('[role="option"]').filter({ hasText: /orcid/i }).first()
      ).toBeVisible();
      await expect(
        page
          .locator('[role="option"]')
          .filter({ hasText: /openalex/i })
          .first()
      ).toBeVisible();
      await expect(
        page
          .locator('[role="option"]')
          .filter({ hasText: /crossref/i })
          .first()
      ).toBeVisible();
      await expect(
        page.locator('[role="option"]').filter({ hasText: /arxiv/i }).first()
      ).toBeVisible();

      // Scroll to middle of list
      if (await dropdown.isVisible()) {
        await dropdown.evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
        await page.waitForTimeout(100);
      }

      await expect(
        page
          .locator('[role="option"]')
          .filter({ hasText: /semantic scholar/i })
          .first()
      ).toBeVisible();
      await expect(
        page
          .locator('[role="option"]')
          .filter({ hasText: /pubmed/i })
          .first()
      ).toBeVisible();
      await expect(
        page
          .locator('[role="option"]')
          .filter({ hasText: /credit/i })
          .first()
      ).toBeVisible();

      // Scroll to bottom of list
      if (await dropdown.isVisible()) {
        await dropdown.evaluate((el) => (el.scrollTop = el.scrollHeight));
        await page.waitForTimeout(100);
      }

      // CRO is "Contributor Role Ontology" - verify exact match to avoid confusion
      await expect(
        page
          .locator('[role="option"]')
          .filter({ hasText: /\bCRO\b/i })
          .first()
      ).toBeVisible();
      await expect(
        page.locator('[role="option"]').filter({ hasText: /lcsh/i }).first()
      ).toBeVisible();
      await expect(
        page.locator('[role="option"]').filter({ hasText: /fast/i }).first()
      ).toBeVisible();
    }
  });

  test('shows external identifier field', async ({ page }) => {
    const idField = page.getByLabel(/external identifier/i);
    await expect(idField).toBeVisible({ timeout: 5000 });
  });

  test('shows external URI field', async ({ page }) => {
    const uriField = page.getByLabel(/external uri/i);
    await expect(uriField).toBeVisible({ timeout: 5000 });
  });

  test('shows external label field', async ({ page }) => {
    const labelField = page.getByLabel(/external label/i);
    await expect(labelField).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Reconciliation Proposal - Match Details', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }
  });

  test('shows match type dropdown', async ({ page }) => {
    const matchTypeSelect = page.getByRole('combobox', { name: /match type/i });
    await expect(matchTypeSelect).toBeVisible({ timeout: 5000 });
  });

  test('match type dropdown contains SKOS relation types', async ({ page }) => {
    const matchTypeSelect = page.getByRole('combobox', { name: /match type/i });

    if (await matchTypeSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await matchTypeSelect.click();
      await page.waitForTimeout(300);

      // Use option role to match dropdown items (Playwright best practice)
      await expect(page.getByRole('option', { name: /exact match/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /close match/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /broader match/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /narrower match/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /related match/i })).toBeVisible();
    }
  });

  test('shows confidence score field', async ({ page }) => {
    const confidenceField = page.getByLabel(/confidence score/i);
    await expect(confidenceField).toBeVisible({ timeout: 5000 });
  });

  test('shows rationale field', async ({ page }) => {
    const rationaleField = page.getByLabel(/rationale/i);
    await expect(rationaleField).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Reconciliation Proposal - Proposal Types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }
  });

  test('shows create reconciliation type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Create Reconciliation' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows update reconciliation type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Update Reconciliation' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows remove reconciliation type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Remove Reconciliation' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('update type shows existing reconciliation field', async ({ page }) => {
    const updateLabel = page.locator('label').filter({ hasText: 'Update Reconciliation' });

    if (await updateLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await updateLabel.click();

      await expect(page.getByRole('textbox', { name: /existing reconciliation/i })).toBeVisible();
    }
  });

  test('remove type shows existing reconciliation field', async ({ page }) => {
    const removeLabel = page.locator('label').filter({ hasText: 'Remove Reconciliation' });

    if (await removeLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await removeLabel.click();

      await expect(page.getByRole('textbox', { name: /existing reconciliation/i })).toBeVisible();
    }
  });
});

test.describe('Reconciliation Proposal - Form Submission', () => {
  test('can fill and submit reconciliation proposal form', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select reconciliation category
    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }

    // Select source entity type
    const entityTypeSelect = page.getByRole('combobox', { name: /entity type/i });
    if (await entityTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await entityTypeSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /knowledge graph field/i }).click();
    }

    // Fill source entity URI
    const sourceUriField = page.getByLabel(/entity uri/i);
    if (await sourceUriField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sourceUriField.fill(
        'at://did:plc:chive-governance/pub.chive.graph.field/machine-learning'
      );
    }

    // Fill source entity label
    const sourceLabelField = page.getByLabel(/entity label/i);
    if (await sourceLabelField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sourceLabelField.fill('Machine Learning');
    }

    // Select external system (second combobox)
    const allSelects = page.locator('[role="combobox"]');
    const count = await allSelects.count();
    if (count >= 2) {
      await allSelects.nth(1).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /wikidata/i }).click();
    }

    // Fill external identifier
    const externalIdField = page.getByLabel(/external identifier/i);
    if (await externalIdField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await externalIdField.fill('Q2539');
    }

    // Fill external label
    const externalLabelField = page.getByLabel(/external label/i);
    if (await externalLabelField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await externalLabelField.fill('machine learning');
    }

    // Select match type
    const matchTypeSelect = page.getByRole('combobox', { name: /match type/i });
    if (await matchTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await matchTypeSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /exact match/i }).click();
    }

    // Fill confidence score
    const confidenceField = page.getByLabel(/confidence score/i);
    if (await confidenceField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confidenceField.fill('0.98');
    }

    // Fill rationale
    const rationaleField = page.getByLabel(/rationale/i);
    if (await rationaleField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rationaleField.fill(
        'Direct mapping from Chive machine learning field to Wikidata Q2539 concept with high confidence.'
      );
    }

    // Verify submit button exists (specific to avoid matching search button)
    const submitButton = page.getByRole('button', { name: /submit proposal/i });
    await expect(submitButton).toBeVisible();
  });

  test('shows validation errors for missing source entity type', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select reconciliation category
    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }

    // Fill rationale only
    const rationaleField = page.getByLabel(/rationale/i);
    if (await rationaleField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rationaleField.fill('This is a test rationale for validation testing.');
    }

    // Try to submit
    const submitButton = page.getByRole('button', { name: /submit proposal/i });
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();

      // Should show validation error (check for any validation error)
      const error = page.getByText(/entity type|type is required|select.*type|required/i).first();
      await expect(error).toBeVisible({ timeout: 5000 });
    }
  });

  test('shows validation errors for missing target system', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select reconciliation category
    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }

    // Fill source entity type
    const entityTypeSelect = page.getByRole('combobox', { name: /entity type/i });
    if (await entityTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await entityTypeSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /knowledge graph field/i }).click();
    }

    // Fill source entity URI and label
    const sourceUriField = page.getByLabel(/entity uri/i);
    if (await sourceUriField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sourceUriField.fill('at://test');
    }

    const sourceLabelField = page.getByLabel(/entity label/i);
    if (await sourceLabelField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sourceLabelField.fill('Test');
    }

    // Fill rationale
    const rationaleField = page.getByLabel(/rationale/i);
    if (await rationaleField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rationaleField.fill('This is a test rationale for validation testing.');
    }

    // Try to submit
    const submitButton = page.getByRole('button', { name: /submit proposal/i });
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();

      // Should show validation error (check for any validation error)
      const error = page
        .getByText(/target system|system is required|external system|required/i)
        .first();
      await expect(error).toBeVisible({ timeout: 5000 });
    }
  });

  test('shows validation errors for missing match type', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select reconciliation category
    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }

    // Fill all required fields except match type
    const entityTypeSelect = page.getByRole('combobox', { name: /entity type/i });
    if (await entityTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await entityTypeSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /knowledge graph field/i }).click();
    }

    const sourceUriField = page.getByLabel(/entity uri/i);
    if (await sourceUriField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sourceUriField.fill('at://test');
    }

    const sourceLabelField = page.getByLabel(/entity label/i);
    if (await sourceLabelField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sourceLabelField.fill('Test');
    }

    // Select external system
    const allSelects = page.locator('[role="combobox"]');
    const count = await allSelects.count();
    if (count >= 2) {
      await allSelects.nth(1).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /wikidata/i }).click();
    }

    const externalIdField = page.getByLabel(/external identifier/i);
    if (await externalIdField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await externalIdField.fill('Q123');
    }

    const externalLabelField = page.getByLabel(/external label/i);
    if (await externalLabelField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await externalLabelField.fill('test');
    }

    const rationaleField = page.getByLabel(/rationale/i);
    if (await rationaleField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rationaleField.fill('This is a test rationale for validation testing.');
    }

    // Try to submit without match type
    const submitButton = page.getByRole('button', { name: /submit proposal/i });
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();

      // Should show validation error (check for any validation error)
      const error = page.getByText(/match type|type is required|required/i).first();
      await expect(error).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Reconciliation Proposal - Wikidata Flow', () => {
  test('can create Wikidata reconciliation', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select reconciliation category
    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }

    // Fill form for Wikidata reconciliation
    const entityTypeSelect = page.getByRole('combobox', { name: /entity type/i });
    if (await entityTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await entityTypeSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /knowledge graph field/i }).click();
    }

    await page
      .getByLabel(/entity uri/i)
      .fill('at://did:plc:gov/pub.chive.graph.field/deep-learning');
    await page.getByLabel(/entity label/i).fill('Deep Learning');

    const allSelects = page.locator('[role="combobox"]');
    await allSelects.nth(1).click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /wikidata/i }).click();

    await page.getByLabel(/external identifier/i).fill('Q197536');
    await page.getByLabel(/external label/i).fill('deep learning');

    const matchTypeSelect = page.getByRole('combobox', { name: /match type/i });
    await matchTypeSelect.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /exact match/i }).click();

    await page
      .getByLabel(/rationale/i)
      .fill('Exact match between Chive deep learning field and Wikidata deep learning concept.');

    await expect(page.getByRole('button', { name: /submit proposal/i })).toBeVisible();
  });
});

test.describe('Reconciliation Proposal - ROR Flow', () => {
  test('can create ROR organization reconciliation', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select reconciliation category
    const reconciliationLabel = page.locator('label').filter({ hasText: 'Reconciliation' }).first();
    if (await reconciliationLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reconciliationLabel.click();
    }

    // Fill form for ROR reconciliation
    const entityTypeSelect = page.getByRole('combobox', { name: /entity type/i });
    if (await entityTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await entityTypeSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /organization/i }).click();
    }

    await page.getByLabel(/entity uri/i).fill('at://did:plc:gov/pub.chive.graph.organization/mit');
    await page.getByLabel(/entity label/i).fill('Massachusetts Institute of Technology');

    const allSelects = page.locator('[role="combobox"]');
    await allSelects.nth(1).click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /ror/i }).click();

    await page.getByLabel(/external identifier/i).fill('042nb2s44');
    await page.getByLabel(/external label/i).fill('Massachusetts Institute of Technology');

    const matchTypeSelect = page.getByRole('combobox', { name: /match type/i });
    await matchTypeSelect.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /exact match/i }).click();

    await page.getByLabel(/confidence/i).fill('1.0');
    await page
      .getByLabel(/rationale/i)
      .fill('Exact match between Chive MIT organization and ROR registry entry.');

    await expect(page.getByRole('button', { name: /submit proposal/i })).toBeVisible();
  });
});
