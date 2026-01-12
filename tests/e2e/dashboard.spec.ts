/**
 * E2E tests for user dashboard.
 *
 * @remarks
 * These tests run in the authenticated project and use the saved
 * auth state from auth.setup.ts. The dashboard should be accessible
 * without redirecting to sign-in.
 */

import { test, expect } from '@playwright/test';
import { DashboardPage } from './fixtures/page-objects.js';
import { TEST_USER } from './fixtures/test-data.js';

test.describe('Dashboard', () => {
  test('displays dashboard page when authenticated', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Should not redirect to login when authenticated
    await expect(page).not.toHaveURL(/\/login/);

    // Should show dashboard heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/welcome/i);
  });

  test('displays welcome message with user name', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Dashboard heading MUST contain welcome message
    const welcomeHeading = page.getByRole('heading', { level: 1 });
    await expect(welcomeHeading).toBeVisible();
    // The heading format is "Welcome back, {displayName}" or just "Welcome back"
    await expect(welcomeHeading).toContainText(/welcome back/i);
  });

  test('displays stats cards section', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Stats section MUST be visible with statistics region
    const statsRegion = page.getByRole('region', { name: /statistics/i });
    await expect(statsRegion).toBeVisible();

    // Should show preprints stats card
    await expect(page.getByText(/preprints/i).first()).toBeVisible();
  });

  test('displays For You recommendations section', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // For You recommendations section should be present
    const forYouSection = page.getByRole('region', { name: /for you recommendations/i });
    await expect(forYouSection).toBeVisible();

    // Should show "For You" heading
    await expect(forYouSection.getByRole('heading', { name: /for you/i })).toBeVisible();
  });

  test('displays quick actions with submit button', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Quick actions section MUST be visible
    const quickActions = page.getByRole('region', { name: /quick actions/i });
    await expect(quickActions).toBeVisible();

    // Submit preprint link MUST be visible and functional
    const submitLink = page.getByRole('link', { name: /submit preprint/i });
    await expect(submitLink).toBeVisible();
    await expect(submitLink).toHaveAttribute('href', '/submit');
  });

  test('submit link navigates to submission page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Click submit link
    const submitLink = page.getByRole('link', { name: /submit preprint/i });
    await expect(submitLink).toBeVisible();
    await Promise.all([page.waitForURL('/submit'), submitLink.click()]);

    // Should navigate to submit page
    await expect(page).toHaveURL('/submit');
    await expect(page.getByRole('heading', { name: /submit.*preprint/i })).toBeVisible();
  });

  test('browse link navigates to browse page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Click browse link
    const browseLink = page.getByRole('link', { name: /browse preprints/i });
    await expect(browseLink).toBeVisible();
    await Promise.all([page.waitForURL('/preprints'), browseLink.click()]);

    // Should navigate to preprints page
    await expect(page).toHaveURL('/preprints');
  });

  test('faceted search link navigates to browse page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Click faceted search link
    const facetedLink = page.getByRole('link', { name: /faceted search/i });
    await expect(facetedLink).toBeVisible();
    await facetedLink.click();

    // Should navigate to browse page
    await expect(page).toHaveURL('/browse');
  });
});

// =============================================================================
// SETTINGS PAGE
// =============================================================================

test.describe('Settings Page', () => {
  test('can navigate to settings page', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('displays user DID on settings page', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByText(TEST_USER.did)).toBeVisible();
  });

  test('displays user display name', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByText(TEST_USER.displayName)).toBeVisible();
  });

  test('shows Edit on Bluesky external link', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('link', { name: /edit on bluesky/i })).toBeVisible();
  });
});
