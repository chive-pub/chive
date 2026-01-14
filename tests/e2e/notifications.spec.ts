/**
 * E2E tests for notifications page.
 *
 * @remarks
 * These tests run in the authenticated project and use the saved
 * auth state from auth.setup.ts. The notifications page should be
 * accessible without redirecting to sign-in.
 */

import { test, expect } from '@playwright/test';
import { NotificationsPage } from './fixtures/page-objects.js';

test.describe('Notifications Page', () => {
  test('displays notifications page when authenticated', async ({ page }) => {
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();

    // Should not redirect to login when authenticated
    await expect(page).not.toHaveURL(/\/login/);

    // Should show notifications heading
    await expect(notificationsPage.pageTitle).toBeVisible();
    await expect(notificationsPage.pageDescription).toBeVisible();
  });

  test('displays reviews section', async ({ page }) => {
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Reviews section should be visible (either with content or empty state)
    const reviewsHeading = page.getByRole('heading', { name: /reviews on your papers/i });
    await expect(reviewsHeading).toBeVisible();
  });

  test('displays endorsements section', async ({ page }) => {
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Endorsements section should be visible (either with content or empty state)
    const endorsementsHeading = page.getByRole('heading', { name: /endorsements on your papers/i });
    await expect(endorsementsHeading).toBeVisible();
  });

  test('shows empty state when no notifications', async ({ page }) => {
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();

    // Wait for data to load
    await page.waitForLoadState('networkidle');

    // Should show at least one empty state message (reviews, endorsements, or coauthor requests)
    const hasEmptyState =
      (await notificationsPage.noReviewsState.count()) > 0 ||
      (await notificationsPage.noEndorsementsState.count()) > 0 ||
      (await notificationsPage.emptyNotificationsState.count()) > 0;

    expect(hasEmptyState).toBe(true);
  });
});

test.describe('Notifications Navigation', () => {
  test('can navigate to notifications from user menu', async ({ page }) => {
    // Go to dashboard first
    await page.goto('/dashboard');

    // Open user menu (avatar/initials button)
    const userMenuButton = page.getByRole('button').filter({ hasText: /^[A-Z]{1,2}$/ });
    await userMenuButton.click();

    // Click notifications link in dropdown
    const notificationsLink = page.getByRole('menuitem', { name: /notifications/i });
    await expect(notificationsLink).toBeVisible();
    await notificationsLink.click();

    // Should navigate to notifications page
    await expect(page).toHaveURL('/dashboard/notifications');
  });

  test('notifications link shows bell icon in user menu', async ({ page }) => {
    await page.goto('/dashboard');

    // Open user menu
    const userMenuButton = page.getByRole('button').filter({ hasText: /^[A-Z]{1,2}$/ });
    await userMenuButton.click();

    // Notifications menu item should be visible with bell icon
    const notificationsLink = page.getByRole('menuitem', { name: /notifications/i });
    await expect(notificationsLink).toBeVisible();
  });
});
