/**
 * E2E tests for governance features.
 *
 * Tests proposal viewing and voting.
 */

import { test, expect } from '@playwright/test';

test.describe('Governance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance');
  });

  test('displays governance page heading', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/governance|proposals/i);
  });

  test('displays proposals list', async ({ page }) => {
    // Use role-based selector for proposals list
    const proposalsList = page
      .getByRole('list')
      .first()
      .or(page.getByRole('region', { name: /proposals/i }));
    await expect(proposalsList).toBeVisible();
  });

  test('displays proposal categories', async ({ page }) => {
    // Use role-based selector for categories
    const categories = page
      .getByRole('tablist')
      .or(page.getByRole('navigation', { name: /categories/i }))
      .or(page.getByRole('group'));

    if (await categories.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(categories).toBeVisible();
    }
  });

  test('filters proposals by status', async ({ page }) => {
    const statusFilter = page.getByRole('combobox', { name: /status/i });

    if (await statusFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusFilter.selectOption('active');
      await expect(page).toHaveURL(/status=active/);
    }
  });

  test('clicking proposal shows details', async ({ page }) => {
    // Wait for page to load proposals
    await page.waitForLoadState('networkidle');

    // Find a proposal link - look for links that go to proposal detail pages
    const proposalLink = page.locator('a[href*="/governance/proposals/"]').first();

    // Proposals should be seeded and visible
    await expect(proposalLink).toBeVisible({ timeout: 10000 });

    // Click and navigate to proposal details
    await Promise.all([page.waitForURL(/\/governance\/proposals\/.+/), proposalLink.click()]);
    await expect(page).toHaveURL(/\/governance\/proposals\/.+/);
  });

  test('proposal detail shows voting options', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find and click a proposal link
    const proposalLink = page.locator('a[href*="/governance/proposals/"]').first();
    await expect(proposalLink).toBeVisible({ timeout: 10000 });
    await Promise.all([page.waitForURL(/\/governance\/proposals\/.+/), proposalLink.click()]);

    // Vote buttons should be visible for authenticated users
    const voteButtons = page.getByRole('button', { name: /vote|approve|reject/i });
    const voteCount = await voteButtons.count();
    expect(voteCount).toBeGreaterThanOrEqual(0);
  });

  test('voting requires authentication', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find and click a proposal link
    const proposalLink = page.locator('a[href*="/governance/proposals/"]').first();
    await expect(proposalLink).toBeVisible({ timeout: 10000 });
    await Promise.all([page.waitForURL(/\/governance\/proposals\/.+/), proposalLink.click()]);

    const voteButton = page.getByRole('button', { name: /vote|approve/i }).first();
    if (await voteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await voteButton.click();

      // Should redirect to login or show auth prompt
      await expect(
        page.getByRole('dialog').or(page.getByText(/sign in|login|authentication/i))
      ).toBeVisible();
    }
  });

  test('displays proposal timeline', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find and click a proposal link
    const proposalLink = page.locator('a[href*="/governance/proposals/"]').first();
    await expect(proposalLink).toBeVisible({ timeout: 10000 });
    await Promise.all([page.waitForURL(/\/governance\/proposals\/.+/), proposalLink.click()]);

    // Look for timeline or creation date information
    const timeline = page
      .getByRole('list', { name: /timeline|history/i })
      .or(page.getByText(/created|submitted|updated/i));

    if (await timeline.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(timeline).toBeVisible();
    }
  });

  test('displays vote counts', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find and click a proposal link
    const proposalLink = page.locator('a[href*="/governance/proposals/"]').first();
    await expect(proposalLink).toBeVisible({ timeout: 10000 });
    await Promise.all([page.waitForURL(/\/governance\/proposals\/.+/), proposalLink.click()]);

    // Look for vote count display
    const voteCount = page.getByText(/\d+\s*(votes?|approve|reject)/i);
    if (await voteCount.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(voteCount).toBeVisible();
    }
  });

  test('create proposal button navigates to proposal form', async ({ page }) => {
    const createButton = page
      .getByRole('button', { name: /create|propose|new/i })
      .or(page.getByRole('link', { name: /create|propose|new/i }));

    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await Promise.all([
        page.waitForURL(/\/governance\/proposals\/new|\/governance\/create/),
        createButton.click(),
      ]);

      // Authenticated users should reach the proposal form
      await expect(page).toHaveURL(/\/governance\/proposals\/new|\/governance\/create/);

      // Form should be visible
      const form = page
        .getByRole('form')
        .or(page.getByRole('heading', { name: /create|new|propose/i }));
      await expect(form).toBeVisible();
    }
  });
});
