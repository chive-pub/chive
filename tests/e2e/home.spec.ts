/**
 * E2E tests for home page.
 *
 * @remarks
 * Tests the alpha landing page. Some tests are skipped during alpha
 * and will be re-enabled when the full marketing page is restored.
 */

import { test, expect } from '@playwright/test';
import { HomePage } from './fixtures/page-objects.js';

test.describe('Home page', () => {
  test('displays hero section with title', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.heroTitle).toBeVisible();
    // Alpha landing page has "Chive" as title and "Decentralized Eprints" as tagline
    await expect(homePage.heroTitle).toContainText(/chive/i);
  });

  test('displays tagline with decentralized eprints', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Check tagline is visible
    await expect(homePage.heroSubtitle).toBeVisible();
    await expect(homePage.heroSubtitle).toContainText(/decentralized eprints/i);
  });

  // Skip: Browse button not present during alpha - will be restored post-alpha
  test.skip('displays browse eprints button', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const browseButton = page.getByRole('link', { name: /browse eprints/i });
    await expect(browseButton).toBeVisible();
  });

  // Skip: Browse button not present during alpha - will be restored post-alpha
  test.skip('browse button navigates to eprints page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const browseButton = page.getByRole('link', { name: /browse eprints/i });
    await browseButton.click();

    await expect(page).toHaveURL(/\/eprints/);
  });

  // Skip: Submit CTA not present during alpha - will be restored post-alpha
  test.skip('displays submit eprint CTA', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // The home page has "Submit a Eprint" link in the CTA section or Quick Access
    const submitButton = page
      .getByRole('link', { name: /submit.*eprint/i })
      .first()
      .or(page.getByRole('link', { name: /submit eprint/i }).first());
    await expect(submitButton).toBeVisible();
  });

  // Skip: Features section not present during alpha - will be restored post-alpha
  test.skip('displays features section with Why Chive heading', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const featuresHeading = page.getByRole('heading', { name: /why chive/i });
    await expect(featuresHeading).toBeVisible();
  });

  // Skip: Feature cards not present during alpha - will be restored post-alpha
  test.skip('displays feature cards', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Check for at least one feature card
    const dataCard = page.getByText(/data sovereignty/i);
    await expect(dataCard).toBeVisible();

    const communityCard = page.getByText(/open community/i);
    await expect(communityCard).toBeVisible();

    const academicCard = page.getByText(/academic focus/i);
    await expect(academicCard).toBeVisible();
  });

  test('hero section is responsive', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(homePage.heroTitle).toBeVisible();

    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(homePage.heroTitle).toBeVisible();

    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(homePage.heroTitle).toBeVisible();
  });

  test('page has proper heading hierarchy', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Check for single h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Alpha landing page has no h2 sections - just a simple sign-in page
    // h2 sections will be present post-alpha when full marketing page is restored
  });

  test('page has meta description', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);
  });

  test('displays sign in button', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const signInButton = page.getByRole('button', { name: /sign in with bluesky/i });
    await expect(signInButton).toBeVisible();
  });

  test('displays external links', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Check for documentation link
    const docsLink = page.getByRole('link', { name: /read the docs/i });
    await expect(docsLink).toBeVisible();

    // Check for GitHub link
    const githubLink = page.getByRole('link', { name: /github/i });
    await expect(githubLink).toBeVisible();

    // Check for Bluesky link
    const blueskyLink = page.getByRole('link', { name: /bluesky/i });
    await expect(blueskyLink).toBeVisible();
  });
});
