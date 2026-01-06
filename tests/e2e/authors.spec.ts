/**
 * E2E tests for authors pages.
 *
 * Tests author discovery, search, and profile viewing.
 */

import { test, expect } from '@playwright/test';

test.describe('Authors index page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/authors');
  });

  test('displays authors page heading', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/authors/i);
  });

  test('displays page description', async ({ page }) => {
    const description = page.getByText(/discover researchers|sharing their work/i);
    await expect(description).toBeVisible();
  });

  test('displays find an author card', async ({ page }) => {
    const findAuthorCard = page.getByText('Find an Author');
    await expect(findAuthorCard).toBeVisible();
  });

  test('displays author search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/handle.*or did/i);
    await expect(searchInput).toBeVisible();
  });

  test('displays search button in form', async ({ page }) => {
    // The form has a specific Search button (not the header search)
    const searchButton = page.getByRole('button', { name: 'Search', exact: true });
    await expect(searchButton).toBeVisible();
  });

  test('displays info cards about decentralized identity', async ({ page }) => {
    const identityCard = page.getByText('Decentralized Identity', { exact: true });
    await expect(identityCard).toBeVisible();
  });

  test('displays info cards about author profiles', async ({ page }) => {
    const profilesCard = page.getByText('Author Profiles', { exact: true });
    await expect(profilesCard).toBeVisible();
  });

  test('displays featured authors section (coming soon)', async ({ page }) => {
    const featuredSection = page.getByText('Featured Authors', { exact: true });
    await expect(featuredSection).toBeVisible();

    const comingSoon = page.getByText(/coming soon/i);
    await expect(comingSoon).toBeVisible();
  });

  test('search with DID shows profile link', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/handle.*or did/i);
    await searchInput.fill('did:plc:test123');

    // Use exact match for the form's Search button
    const searchButton = page.getByRole('button', { name: 'Search', exact: true });
    await searchButton.click();

    // Should show a link to view the profile
    const viewProfileLink = page.getByRole('link', { name: /view profile/i });
    await expect(viewProfileLink).toBeVisible();
  });
});

test.describe('Author profile page', () => {
  test('handles 404 for non-existent author', async ({ page }) => {
    await page.goto('/authors/did%3Aplc%3Anonexistent');

    // Page should show error state (use heading which is more specific)
    const errorHeading = page.getByRole('heading', { name: /failed|error|not found/i });
    await expect(errorHeading).toBeVisible();
  });

  test('handles invalid DID format', async ({ page }) => {
    await page.goto('/authors/invalid-not-a-did');

    // Page should show not found (Next.js 404 page)
    const notFoundIndicator = page.getByText('404').or(page.getByText(/not found/i));
    await expect(notFoundIndicator.first()).toBeVisible();
  });

  test('page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/authors/did%3Aplc%3Atest');

    // Should have at least one heading (even if error page)
    const headings = page.locator('h1, h2, h3');
    await expect(headings.first()).toBeVisible();
  });
});
