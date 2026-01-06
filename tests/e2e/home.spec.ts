/**
 * E2E tests for home page.
 *
 * Tests hero section, features, and CTAs.
 */

import { test, expect } from '@playwright/test';
import { HomePage } from './fixtures/page-objects.js';

test.describe('Home page', () => {
  test('displays hero section with title', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.heroTitle).toBeVisible();
    await expect(homePage.heroTitle).toContainText(/decentralized|preprints/i);
  });

  test('displays browse preprints button', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const browseButton = page.getByRole('link', { name: /browse preprints/i });
    await expect(browseButton).toBeVisible();
  });

  test('browse button navigates to preprints page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const browseButton = page.getByRole('link', { name: /browse preprints/i });
    await browseButton.click();

    await expect(page).toHaveURL(/\/preprints/);
  });

  test('displays submit preprint CTA', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // The home page has "Submit a Preprint" link in the CTA section or Quick Access
    const submitButton = page
      .getByRole('link', { name: /submit.*preprint/i })
      .first()
      .or(page.getByRole('link', { name: /submit preprint/i }).first());
    await expect(submitButton).toBeVisible();
  });

  test('displays features section with Why Chive heading', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const featuresHeading = page.getByRole('heading', { name: /why chive/i });
    await expect(featuresHeading).toBeVisible();
  });

  test('displays feature cards', async ({ page }) => {
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

    // Check for h2 sections
    const h2Count = await page.locator('h2').count();
    expect(h2Count).toBeGreaterThan(0);
  });

  test('page has meta description', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);
  });
});
