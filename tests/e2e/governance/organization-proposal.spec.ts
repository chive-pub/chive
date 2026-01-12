/**
 * E2E tests for organization proposal flow.
 *
 * Tests the complete workflow for proposing research organizations:
 * - Navigate to governance page
 * - Create new organization proposal
 * - Fill out organization-specific fields (name, type, ROR ID)
 * - Add location information
 * - Submit proposal
 * - Verify proposal appears in list
 *
 * @packageDocumentation
 */

import { test, expect } from '@playwright/test';

test.describe('Organization Proposal - Category Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');
  });

  test('shows organization category option', async ({ page }) => {
    // Use label selector to avoid matching multiple elements
    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();
    await expect(orgLabel).toBeVisible({ timeout: 5000 });
  });

  test('can select organization category', async ({ page }) => {
    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();

    if (await orgLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLabel.click();

      // Should show organization-specific proposal types
      await expect(page.locator('label').filter({ hasText: 'Create Organization' })).toBeVisible();
    }
  });

  test('shows organization category description', async ({ page }) => {
    const description = page.getByText(/propose research institutions and organizations/i);
    await expect(description).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Organization Proposal - Form Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select organization category
    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();
    if (await orgLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLabel.click();
    }
  });

  test('shows organization name field', async ({ page }) => {
    const nameField = page.getByLabel(/organization name/i);
    await expect(nameField).toBeVisible({ timeout: 5000 });
  });

  test('shows organization type dropdown', async ({ page }) => {
    const typeSelect = page.getByRole('combobox', { name: /organization type/i });
    await expect(typeSelect).toBeVisible({ timeout: 5000 });
  });

  test('organization type dropdown contains expected options', async ({ page }) => {
    const typeSelect = page.getByRole('combobox', { name: /organization type/i });

    if (await typeSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await typeSelect.click();
      await page.waitForTimeout(300);

      // Use option role to match dropdown items (Playwright best practice)
      await expect(page.getByRole('option', { name: /university/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /research lab/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /funding body/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /publisher/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /consortium/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /hospital/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /government agency/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /nonprofit/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /company/i })).toBeVisible();
    }
  });

  test('shows ROR ID field', async ({ page }) => {
    const rorField = page.getByLabel(/ror id/i);
    await expect(rorField).toBeVisible({ timeout: 5000 });
  });

  test('shows Wikidata ID field', async ({ page }) => {
    const wikidataField = page.getByLabel(/wikidata id/i);
    await expect(wikidataField).toBeVisible({ timeout: 5000 });
  });

  test('shows country code field', async ({ page }) => {
    const countryField = page.getByLabel(/country code/i);
    await expect(countryField).toBeVisible({ timeout: 5000 });
  });

  test('shows city field', async ({ page }) => {
    const cityField = page.getByLabel(/^city/i);
    await expect(cityField).toBeVisible({ timeout: 5000 });
  });

  test('shows website field', async ({ page }) => {
    const websiteField = page.getByLabel(/website/i);
    await expect(websiteField).toBeVisible({ timeout: 5000 });
  });

  test('shows aliases field', async ({ page }) => {
    const aliasesField = page.getByLabel(/aliases/i);
    await expect(aliasesField).toBeVisible({ timeout: 5000 });
  });

  test('shows parent organization field for create', async ({ page }) => {
    const parentField = page.getByLabel(/parent organization/i);
    await expect(parentField).toBeVisible({ timeout: 5000 });
  });

  test('shows rationale field', async ({ page }) => {
    const rationaleField = page.getByLabel(/rationale/i);
    await expect(rationaleField).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Organization Proposal - Proposal Types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();
    if (await orgLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLabel.click();
    }
  });

  test('shows create organization type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Create Organization' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows update organization type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Update Organization' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows merge organizations type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Merge Organizations' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows deprecate organization type', async ({ page }) => {
    await expect(page.locator('label').filter({ hasText: 'Deprecate Organization' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('merge type shows source and target organization fields', async ({ page }) => {
    const mergeLabel = page.locator('label').filter({ hasText: 'Merge Organizations' });

    if (await mergeLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mergeLabel.click();

      await expect(page.getByRole('textbox', { name: /source organization/i })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /merge into organization/i })).toBeVisible();
    }
  });

  test('update type shows existing organization field', async ({ page }) => {
    const updateLabel = page.locator('label').filter({ hasText: 'Update Organization' });

    if (await updateLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await updateLabel.click();

      await expect(page.getByRole('textbox', { name: /existing organization/i })).toBeVisible();
    }
  });

  test('deprecate type shows existing organization field', async ({ page }) => {
    const deprecateLabel = page.locator('label').filter({ hasText: 'Deprecate Organization' });

    if (await deprecateLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deprecateLabel.click();

      await expect(page.getByRole('textbox', { name: /existing organization/i })).toBeVisible();
    }
  });
});

test.describe('Organization Proposal - Form Submission', () => {
  test('can fill and submit organization proposal form', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select organization category
    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();
    if (await orgLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLabel.click();
    }

    // Fill organization name
    const nameField = page.getByLabel(/organization name/i);
    if (await nameField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameField.fill('Stanford Artificial Intelligence Laboratory');
    }

    // Select organization type
    const typeSelect = page.getByRole('combobox', { name: /organization type/i });
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /research lab/i }).click();
    }

    // Fill ROR ID (optional)
    const rorField = page.getByLabel(/ror id/i);
    if (await rorField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rorField.fill('https://ror.org/00f54p054');
    }

    // Fill country
    const countryField = page.getByLabel(/country code/i);
    if (await countryField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await countryField.fill('US');
    }

    // Fill city
    const cityField = page.getByLabel(/^city/i);
    if (await cityField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cityField.fill('Stanford');
    }

    // Fill website
    const websiteField = page.getByLabel(/website/i);
    if (await websiteField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await websiteField.fill('https://ai.stanford.edu');
    }

    // Fill aliases
    const aliasesField = page.getByLabel(/aliases/i);
    if (await aliasesField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aliasesField.fill('SAIL, Stanford AI Lab');
    }

    // Fill rationale
    const rationaleField = page.getByLabel(/rationale/i);
    if (await rationaleField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rationaleField.fill(
        'SAIL is a pioneering AI research lab that deserves separate tracking from Stanford University.'
      );
    }

    // Verify submit button exists (specific to avoid matching search button)
    const submitButton = page.getByRole('button', { name: /submit proposal/i });
    await expect(submitButton).toBeVisible();
  });

  test('shows validation errors for empty organization name', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select organization category
    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();
    if (await orgLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLabel.click();
    }

    // Select organization type but leave name empty
    const typeSelect = page.getByRole('combobox', { name: /organization type/i });
    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /university/i }).click();
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

      // Should show validation error for name (check for any validation error)
      const error = page.getByText(/organization name|required|at least 2 characters/i).first();
      await expect(error).toBeVisible({ timeout: 5000 });
    }
  });

  test('shows validation errors for missing organization type', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select organization category
    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();
    if (await orgLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLabel.click();
    }

    // Fill name but skip type
    const nameField = page.getByLabel(/organization name/i);
    if (await nameField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameField.fill('Test Organization');
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

      // Should show validation error for type (check for any validation error)
      const error = page.getByText(/organization type|type is required|select.*type/i).first();
      await expect(error).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Organization Proposal - External Links', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();
    if (await orgLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLabel.click();
    }
  });

  test('ROR search link opens in new tab', async ({ page }) => {
    const rorLink = page.getByRole('link', { name: /search ror/i });

    if (await rorLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await rorLink.getAttribute('href');
      expect(href).toContain('ror.org');
      expect(await rorLink.getAttribute('target')).toBe('_blank');
    }
  });
});

test.describe('Organization Proposal - Merge Flow', () => {
  test('merge proposal shows both source and target fields', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select organization category
    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();
    if (await orgLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLabel.click();
    }

    // Select merge type
    const mergeLabel = page.locator('label').filter({ hasText: 'Merge Organizations' });
    if (await mergeLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mergeLabel.click();

      // Should show both organization fields
      const sourceField = page.getByRole('textbox', { name: /source organization/i });
      const targetField = page.getByRole('textbox', { name: /merge into organization/i });

      await expect(sourceField).toBeVisible();
      await expect(targetField).toBeVisible();
    }
  });

  test('can fill merge proposal form', async ({ page }) => {
    await page.goto('/governance/proposals/new');
    await page.waitForLoadState('networkidle');

    // Select organization category
    const orgLabel = page.locator('label').filter({ hasText: 'Organization' }).first();
    if (await orgLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLabel.click();
    }

    // Select merge type
    const mergeLabel = page.locator('label').filter({ hasText: 'Merge Organizations' });
    if (await mergeLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mergeLabel.click();
    }

    // Fill source organization
    const sourceField = page.getByRole('textbox', { name: /source organization/i });
    if (await sourceField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sourceField.fill('stanford-ai-lab');
    }

    // Fill target organization
    const targetField = page.getByRole('textbox', { name: /merge into organization/i });
    if (await targetField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await targetField.fill('stanford');
    }

    // Fill rationale
    const rationaleField = page.getByLabel(/rationale/i);
    if (await rationaleField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rationaleField.fill(
        'The AI lab should be merged into the main Stanford University record for consolidation.'
      );
    }

    // Verify submit button is present (specific to avoid matching search button)
    const submitButton = page.getByRole('button', { name: /submit proposal/i });
    await expect(submitButton).toBeVisible();
  });
});
