/**
 * E2E tests for error handling.
 *
 * Tests 404 pages, form validation errors, and graceful error states.
 */

import { test, expect, type Page } from '@playwright/test';

// =============================================================================
// 404 HANDLING
// =============================================================================

test.describe('404 Handling', () => {
  test('non-existent preprint shows error message', async ({ page }) => {
    await page.goto('/preprints/at%3A%2F%2Fdid%3Aplc%3Anonexistent%2Ftest%2F123');
    const errorMessage = page.getByRole('alert').or(page.getByText(/not found|404|error/i));
    await expect(errorMessage).toBeVisible();
  });

  test('non-existent author shows error message', async ({ page }) => {
    await page.goto('/authors/did%3Aplc%3Anonexistent999');
    const errorMessage = page.getByRole('alert').or(page.getByText(/not found|404|error/i));
    await expect(errorMessage).toBeVisible();
  });

  test('non-existent governance proposal shows error message', async ({ page }) => {
    await page.goto('/governance/proposals/nonexistent-proposal-id');
    const errorMessage = page.getByRole('alert').or(page.getByText(/not found|404|error/i));
    await expect(errorMessage).toBeVisible();
  });
});

// =============================================================================
// FORM VALIDATION
// =============================================================================

test.describe('Form Validation', () => {
  test('submit wizard prevents navigation without required fields', async ({ page }) => {
    await page.goto('/submit');
    await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();

    // Try clicking Next without uploading a file
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Should stay on files step; dropzone still visible.
    await expect(page.getByRole('button', { name: /drop your document/i })).toBeVisible();
  });
});
