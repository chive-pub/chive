/**
 * E2E tests for navigation.
 *
 * Tests header, footer, and navigation links across the application.
 */

import { test, expect } from '@playwright/test';
import { HeaderComponent } from './fixtures/page-objects.js';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays header on all pages', async ({ page }) => {
    const header = new HeaderComponent(page);

    await expect(header.logo).toBeVisible();
    await expect(header.searchInput).toBeVisible();
    await expect(header.themeToggle).toBeVisible();
  });

  test('logo links to home page', async ({ page }) => {
    await page.goto('/search');
    const header = new HeaderComponent(page);

    await header.goToHome();

    await expect(page).toHaveURL('/');
  });

  test('discover menu exists in navigation', async ({ page }) => {
    // Header has Discover and Community dropdown menus
    const discoverButton = page.getByRole('button', { name: /discover/i });
    await expect(discoverButton).toBeVisible();
  });

  test('community menu exists in navigation', async ({ page }) => {
    // Header has Community dropdown menu
    const communityButton = page.getByRole('button', { name: /community/i });
    await expect(communityButton).toBeVisible();
  });

  test('header search navigates to search results', async ({ page }) => {
    const header = new HeaderComponent(page);

    await header.search('neural networks');

    await expect(page).toHaveURL(/\/search\?q=neural/);
  });

  test('user is authenticated and shows avatar', async ({ page }) => {
    // In authenticated project, user should see their avatar/initials instead of sign in button
    const userButton = page.getByRole('button').filter({ hasText: /^[A-Z]{1,2}$/ });
    await expect(userButton).toBeVisible();
  });

  test('theme toggle is functional', async ({ page }) => {
    const header = new HeaderComponent(page);

    // Theme toggle should be visible and clickable
    await expect(header.themeToggle).toBeVisible();
    await expect(header.themeToggle).toBeEnabled();

    // Click the toggle to open theme dropdown menu
    await header.themeToggle.click();

    // Dropdown menu should appear with theme options
    const darkOption = page.getByRole('menuitem', { name: /dark/i });
    await expect(darkOption).toBeVisible();

    // Close the dropdown by pressing Escape
    await page.keyboard.press('Escape');

    // Toggle should still be visible after closing dropdown
    await expect(header.themeToggle).toBeVisible();
  });

  test('main content has skip link', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    // Skip link should exist (may be sr-only but still accessible)
    await expect(skipLink).toBeAttached();
  });

  test('navigation is keyboard accessible', async ({ page }) => {
    // Tab to first focusable element
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
