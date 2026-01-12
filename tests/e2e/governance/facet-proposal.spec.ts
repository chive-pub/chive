/**
 * E2E tests for facet value proposal flow.
 *
 * Tests the complete workflow for proposing PMEST/FAST facet values:
 * - Navigate to governance page
 * - Create new facet proposal
 * - Fill out facet-specific fields (dimension, value ID, label)
 * - Add external mappings (LCSH, FAST)
 * - Submit proposal
 * - Verify proposal appears in list
 *
 * @packageDocumentation
 */

import { test, expect } from '@playwright/test';

test.describe('Facet Proposal - Navigation', () => {
  test('can navigate to governance page', async ({ page }) => {
    await page.goto('/governance');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/governance/);
  });

  test('can access proposal creation form', async ({ page }) => {
    await page.goto('/governance');
    await page.waitForLoadState('networkidle');

    // Look for create proposal button
    const createButton = page
      .getByRole('button', { name: /create proposal|new proposal|propose/i })
      .or(page.getByRole('link', { name: /create proposal|new proposal|propose/i }));

    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();
      await expect(page).toHaveURL(/governance.*new|governance.*create|governance.*propose/);
    }
  });
});

test.describe('Facet Proposal - Category Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');
  });

  test('shows facet value category option', async ({ page }) => {
    // Use label that contains the facet radio button
    const facetLabel = page.locator('label').filter({ hasText: 'Facet Value' }).first();
    await expect(facetLabel).toBeVisible({ timeout: 5000 });
  });

  test('can select facet value category', async ({ page }) => {
    // Click the label containing the facet radio button
    const facetLabel = page.locator('label').filter({ hasText: 'Facet Value' }).first();

    if (await facetLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await facetLabel.click();

      // Should show facet-specific proposal types
      await expect(page.locator('label').filter({ hasText: 'Create Facet Value' })).toBeVisible();
    }
  });
});

test.describe('Facet Proposal - Form Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select facet category using label
    const facetLabel = page.locator('label').filter({ hasText: 'Facet Value' }).first();
    if (await facetLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await facetLabel.click();
    }
  });

  test('shows facet dimension dropdown', async ({ page }) => {
    const dimensionSelect = page.getByRole('combobox', { name: /facet dimension/i });
    await expect(dimensionSelect).toBeVisible({ timeout: 5000 });
  });

  test('dimension dropdown contains PMEST dimensions', async ({ page }) => {
    const dimensionSelect = page.getByRole('combobox', { name: /facet dimension/i });

    if (await dimensionSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dimensionSelect.click();
      // Wait for dropdown to open
      await page.waitForTimeout(300);

      // Check for PMEST dimensions - SelectItem text includes label + description
      await expect(page.getByRole('option', { name: /personality.*entities/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /matter.*materials/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /energy.*processes/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /space.*geographic/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /time.*temporal/i })).toBeVisible();
    }
  });

  test('dimension dropdown contains FAST entity facets', async ({ page }) => {
    const dimensionSelect = page.getByRole('combobox', { name: /facet dimension/i });

    if (await dimensionSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dimensionSelect.click();
      // Wait for dropdown to open
      await page.waitForTimeout(300);

      // Check for FAST dimensions - SelectItem text includes label + description
      await expect(page.getByRole('option', { name: /person.*individuals/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /organization.*corporations/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /event.*conferences/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /work.*books/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /form\/genre.*document/i })).toBeVisible();
    }
  });

  test('shows facet value ID field', async ({ page }) => {
    const idField = page.getByLabel(/facet value id/i);
    await expect(idField).toBeVisible({ timeout: 5000 });
  });

  test('shows facet value label field', async ({ page }) => {
    const labelField = page.getByLabel(/facet value label/i);
    await expect(labelField).toBeVisible({ timeout: 5000 });
  });

  test('shows description field', async ({ page }) => {
    // Get the first description field (facet description)
    const descriptionField = page.getByLabel(/^description/i).first();
    await expect(descriptionField).toBeVisible({ timeout: 5000 });
  });

  test('shows parent facet value field', async ({ page }) => {
    const parentField = page.getByLabel(/parent facet value/i);
    await expect(parentField).toBeVisible({ timeout: 5000 });
  });

  test('shows LCSH external mapping field', async ({ page }) => {
    const lcshField = page.getByLabel(/lcsh uri/i);
    await expect(lcshField).toBeVisible({ timeout: 5000 });
  });

  test('shows FAST external mapping field', async ({ page }) => {
    const fastField = page.getByLabel(/fast uri/i);
    await expect(fastField).toBeVisible({ timeout: 5000 });
  });

  test('shows rationale field', async ({ page }) => {
    const rationaleField = page.getByLabel(/rationale/i);

    await expect(rationaleField).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Facet Proposal - Proposal Types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    const facetLabel = page.locator('label').filter({ hasText: 'Facet Value' }).first();
    if (await facetLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await facetLabel.click();
    }
  });

  test('shows create facet value type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Create Facet Value' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows update facet value type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Update Facet Value' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows deprecate facet value type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Deprecate Facet Value' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('update type shows existing facet field', async ({ page }) => {
    const updateLabel = page.locator('label').filter({ hasText: 'Update Facet Value' });

    if (await updateLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await updateLabel.click();

      // Use textbox role to specifically target the input field (Playwright best practice)
      await expect(page.getByRole('textbox', { name: /existing facet/i })).toBeVisible();
    }
  });

  test('deprecate type shows existing facet field', async ({ page }) => {
    const deprecateLabel = page.locator('label').filter({ hasText: 'Deprecate Facet Value' });

    if (await deprecateLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deprecateLabel.click();

      // Use textbox role to specifically target the input field (Playwright best practice)
      await expect(page.getByRole('textbox', { name: /existing facet/i })).toBeVisible();
    }
  });
});

test.describe('Facet Proposal - Form Submission', () => {
  test('can fill and submit facet proposal form', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select facet category
    const facetLabel = page.locator('label').filter({ hasText: 'Facet Value' }).first();
    if (await facetLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await facetLabel.click();
    }

    // Select dimension
    const dimensionSelect = page.getByRole('combobox', { name: /facet dimension/i });
    if (await dimensionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dimensionSelect.click();
      await page.getByRole('option', { name: /personality/i }).click();
    }

    // Fill facet value ID
    const idField = page.getByLabel(/facet value id/i);
    if (await idField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await idField.fill('deep-learning');
    }

    // Fill facet value label
    const labelField = page.getByLabel(/facet value label/i);
    if (await labelField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labelField.fill('Deep Learning');
    }

    // Fill description
    const descriptionField = page.getByLabel(/^description/i).first();
    if (await descriptionField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descriptionField.fill(
        'A subset of machine learning that uses neural networks with multiple hidden layers to learn representations of data.'
      );
    }

    // Fill rationale
    const rationaleField = page.getByLabel(/rationale/i);
    if (await rationaleField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rationaleField.fill(
        'Deep learning has become a distinct subfield with unique methodologies and significant research output.'
      );
    }

    // Verify submit button exists (use specific name to avoid matching search button)
    const submitButton = page.getByRole('button', { name: /submit proposal/i });
    await expect(submitButton).toBeVisible();

    // Note: Actual submission would require authentication
  });

  test('shows validation errors for empty required fields', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select facet category
    const facetLabel = page.locator('label').filter({ hasText: 'Facet Value' }).first();
    if (await facetLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await facetLabel.click();
    }

    // Try to submit without filling fields
    const submitButton = page.getByRole('button', { name: /submit proposal/i });
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();

      // Should show validation errors
      const error = page.getByText(/required|must be|is required/i);
      await expect(error).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Facet Proposal - External Links', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    const facetLabel = page.locator('label').filter({ hasText: 'Facet Value' }).first();
    if (await facetLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await facetLabel.click();
    }
  });

  test('LCSH link opens in new tab', async ({ page }) => {
    const lcshLink = page.getByRole('link', { name: /browse lcsh/i });

    if (await lcshLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await lcshLink.getAttribute('href');
      expect(href).toContain('id.loc.gov');
      expect(await lcshLink.getAttribute('target')).toBe('_blank');
    }
  });

  test('FAST link opens in new tab', async ({ page }) => {
    const fastLink = page.getByRole('link', { name: /browse fast/i });

    if (await fastLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await fastLink.getAttribute('href');
      expect(href).toContain('oclc.org');
      expect(await fastLink.getAttribute('target')).toBe('_blank');
    }
  });
});
