/**
 * E2E tests for home page.
 *
 * @remarks
 * Tests the alpha landing page. Some tests are skipped during alpha
 * and will be re-enabled when the full marketing page is restored.
 */

import { test, expect } from '@playwright/test';
import { AlphaLandingPage } from './fixtures/page-objects.js';

test.describe('Home page', () => {
  test('displays hero section with title', async ({ page }) => {
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    await expect(landingPage.title).toBeVisible();
    // Alpha landing page has "Chive" as title and "Decentralized Eprints" as tagline
    await expect(landingPage.title).toContainText(/chive/i);
  });

  test('displays tagline with decentralized eprints', async ({ page }) => {
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    // Check tagline is visible
    await expect(landingPage.tagline).toBeVisible();
    await expect(landingPage.tagline).toContainText(/decentralized eprints/i);
  });

  test('displays browse eprints button', async ({ page }) => {
    test.skip(true, 'Browse button is not on the alpha landing page; restore post-alpha');
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    const browseButton = page.getByRole('link', { name: /browse eprints/i });
    await expect(browseButton).toBeVisible();
  });

  test('browse button navigates to eprints page', async ({ page }) => {
    test.skip(true, 'Browse button is not on the alpha landing page; restore post-alpha');
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    const browseButton = page.getByRole('link', { name: /browse eprints/i });
    await browseButton.click();

    await expect(page).toHaveURL(/\/eprints/);
  });

  test('displays submit eprint CTA', async ({ page }) => {
    test.skip(true, 'Submit CTA is not on the alpha landing page; restore post-alpha');
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    // The home page has "Submit an Eprint" link in the CTA section or Quick Access
    const submitButton = page
      .getByRole('link', { name: /submit.*eprint/i })
      .first()
      .or(page.getByRole('link', { name: /submit eprint/i }).first());
    await expect(submitButton).toBeVisible();
  });

  test('displays features section with Why Chive heading', async ({ page }) => {
    test.skip(true, 'Features section is not on the alpha landing page; restore post-alpha');
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    const featuresHeading = page.getByRole('heading', { name: /why chive/i });
    await expect(featuresHeading).toBeVisible();
  });

  test('displays feature cards', async ({ page }) => {
    test.skip(true, 'Feature cards are not on the alpha landing page; restore post-alpha');
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    // Check for at least one feature card
    const dataCard = page.getByText(/data sovereignty/i);
    await expect(dataCard).toBeVisible();

    const communityCard = page.getByText(/open community/i);
    await expect(communityCard).toBeVisible();

    const academicCard = page.getByText(/academic focus/i);
    await expect(academicCard).toBeVisible();
  });

  test('hero section is responsive', async ({ page }) => {
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(landingPage.title).toBeVisible();

    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(landingPage.title).toBeVisible();

    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(landingPage.title).toBeVisible();
  });

  test('page has proper heading hierarchy', async ({ page }) => {
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    // Check for single h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Alpha landing page has no h2 sections - just a simple sign-in page
    // h2 sections will be present post-alpha when full marketing page is restored
  });

  test('page has meta description', async ({ page }) => {
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);
  });

  test('displays sign in button', async ({ page }) => {
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    // The button says ATProto, not Bluesky: Chive signs in any ATProto
    // identity, and naming one PDS operator in the button was wrong about the
    // product as well as about the markup.
    const signInButton = page.getByRole('button', { name: /sign in with atproto/i });
    await expect(signInButton).toBeVisible();
  });

  test('offers a handle field to sign in with', async ({ page }) => {
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    // Sign-in begins by resolving a handle. Nothing covered that this field
    // renders, and it is the first thing a user touches.
    const handleInput = page.getByRole('textbox');
    await expect(handleInput.first()).toBeVisible();
  });

  test('displays external links', async ({ page }) => {
    const landingPage = new AlphaLandingPage(page);
    await landingPage.goto();

    // Check for documentation link
    const docsLink = page.getByRole('link', { name: /read the docs/i });
    await expect(docsLink).toBeVisible();

    // Check for GitHub link
    const githubLink = page.getByRole('link', { name: /github/i });
    await expect(githubLink).toBeVisible();

    // The third link is ATProto. There is no Bluesky link on this page, and
    // asserting one had been failing rather than protecting anything.
    const atprotoLink = page.getByRole('link', { name: /^atproto$/i });
    await expect(atprotoLink).toBeVisible();
  });
});
