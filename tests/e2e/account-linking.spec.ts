/**
 * E2E tests for account linking wizard.
 *
 * @remarks
 * Tests the onboarding flow for linking academic accounts including:
 * - Step navigation
 * - ORCID input
 * - Author ID discovery
 * - Completion state
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// WIZARD DISPLAY TESTS
// =============================================================================

test.describe('Account Linking Wizard - Display', () => {
  test('displays wizard on onboarding page', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Should show the wizard card title (CardTitle renders as text, not heading)
    const wizardTitle = page.getByText('Link Your Academic Accounts');
    await expect(wizardTitle).toBeVisible({ timeout: 5000 });
  });

  test('shows step indicators', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Should show all step labels (in step indicator section)
    await expect(page.getByText('Start', { exact: true })).toBeVisible();
    await expect(page.getByText('ORCID', { exact: true })).toBeVisible();
    await expect(page.getByText('Discover', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Done', { exact: true })).toBeVisible();
  });

  test('start step shows benefits list', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Wait for wizard to load
    await expect(page.getByText('Link Your Academic Accounts')).toBeVisible({ timeout: 5000 });

    // Should show benefits section (h3 element)
    const benefitsHeading = page.getByRole('heading', { name: /why link your accounts/i });
    await expect(benefitsHeading).toBeVisible();

    // Should list benefits
    await expect(page.getByText(/personalized recommendations/i)).toBeVisible();
    await expect(page.getByText(/citation alerts/i)).toBeVisible();
    await expect(page.getByText(/automatic paper matching/i)).toBeVisible();
  });

  test('start step shows get started button', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    const getStartedButton = page.getByRole('button', { name: /get started/i });
    await expect(getStartedButton).toBeVisible({ timeout: 5000 });
  });

  test('start step shows skip button', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    const skipButton = page.getByRole('button', { name: /skip for now/i });
    await expect(skipButton).toBeVisible({ timeout: 5000 });
  });
});

// =============================================================================
// WIZARD NAVIGATION TESTS
// =============================================================================

test.describe('Account Linking Wizard - Navigation', () => {
  test('clicking get started advances to ORCID step', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Click get started
    const getStartedButton = page.getByRole('button', { name: /get started/i });
    await expect(getStartedButton).toBeVisible({ timeout: 5000 });
    await getStartedButton.click();

    // Should show ORCID step content
    const orcidHeading = page.getByRole('heading', { name: /connect your orcid/i });
    await expect(orcidHeading).toBeVisible();
  });

  test('ORCID step shows input field', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate to ORCID step
    await page.getByRole('button', { name: /get started/i }).click();

    // Should show ORCID input
    const orcidInput = page.getByRole('textbox', { name: /orcid/i });
    await expect(orcidInput).toBeVisible();
    await expect(orcidInput).toHaveAttribute('placeholder', '0000-0002-1825-0097');
  });

  test('ORCID step shows OAuth button (disabled)', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate to ORCID step
    await page.getByRole('button', { name: /get started/i }).click();

    // OAuth button should be visible but disabled
    const oauthButton = page.getByRole('button', { name: /sign in with orcid/i });
    await expect(oauthButton).toBeVisible();
    await expect(oauthButton).toBeDisabled();
  });

  test('ORCID step shows external links', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate to ORCID step
    await page.getByRole('button', { name: /get started/i }).click();

    // Should show link to find ORCID
    const findOrcidLink = page.getByRole('link', { name: /find your orcid/i });
    await expect(findOrcidLink).toBeVisible();

    // Should show link to create ORCID
    const createOrcidLink = page.getByRole('link', { name: /create one for free/i });
    await expect(createOrcidLink).toBeVisible();
  });

  test('can enter ORCID and continue', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate to ORCID step
    await page.getByRole('button', { name: /get started/i }).click();

    // Enter ORCID
    const orcidInput = page.getByRole('textbox', { name: /orcid/i });
    await orcidInput.fill('0000-0002-1825-0097');

    // Click continue
    const continueButton = page.getByRole('button', { name: /continue/i });
    await expect(continueButton).toBeVisible();
    await continueButton.click();

    // Should advance to discover step
    const discoverHeading = page.getByRole('heading', { name: /discover your author ids/i });
    await expect(discoverHeading).toBeVisible();
  });

  test('can skip ORCID step', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate to ORCID step
    await page.getByRole('button', { name: /get started/i }).click();

    // Skip ORCID
    const skipButton = page.getByRole('button', { name: /skip orcid/i });
    await expect(skipButton).toBeVisible();
    await skipButton.click();

    // Should advance to discover step
    const discoverHeading = page.getByRole('heading', { name: /discover your author ids/i });
    await expect(discoverHeading).toBeVisible();
  });

  test('can go back from ORCID step', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate to ORCID step
    await page.getByRole('button', { name: /get started/i }).click();

    // Go back
    const backButton = page.getByRole('button', { name: /back/i });
    await backButton.click();

    // Should return to start step
    const benefitsHeading = page.getByRole('heading', { name: /why link your accounts/i });
    await expect(benefitsHeading).toBeVisible();
  });

  test('discover step shows author ID discovery component', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Wait for wizard to load first
    await expect(page.getByText('Link Your Academic Accounts')).toBeVisible({ timeout: 5000 });

    // Navigate through steps
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /skip orcid/i }).click();

    // Should show discover heading (use first() since AuthorIdDiscovery also has this heading)
    const discoverHeading = page
      .getByRole('heading', { name: /discover your author ids/i })
      .first();
    await expect(discoverHeading).toBeVisible();

    // Should show search interface (AuthorIdDiscovery component).
    // The component should have a search input. Using first() for duplicate text.
    const searchExplanation = page.getByText(/search academic databases/i).first();
    await expect(searchExplanation).toBeVisible();
  });

  test('can complete setup from discover step', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate through steps
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /skip orcid/i }).click();

    // Complete setup (without selecting any IDs)
    const skipButton = page.getByRole('button', { name: /skip for now/i });
    await expect(skipButton).toBeVisible();
    await skipButton.click();

    // Should show completion state
    const completeHeading = page.getByRole('heading', { name: /you're all set/i });
    await expect(completeHeading).toBeVisible();
  });

  test('complete step shows success message', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate through all steps
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /skip orcid/i }).click();
    await page.getByRole('button', { name: /skip for now/i }).click();

    // Should show completion message
    const successMessage = page.getByText(/you can link your accounts anytime/i);
    await expect(successMessage).toBeVisible();

    // Should show view recommendations button
    const viewButton = page.getByRole('button', { name: /view recommendations/i });
    await expect(viewButton).toBeVisible();
  });
});

// =============================================================================
// WIZARD WITH ORCID INPUT TESTS
// =============================================================================

test.describe('Account Linking Wizard - With ORCID', () => {
  test('entered ORCID shows in linked accounts section', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate to ORCID step
    await page.getByRole('button', { name: /get started/i }).click();

    // Enter ORCID
    await page.getByRole('textbox', { name: /orcid/i }).fill('0000-0002-1825-0097');

    // Continue to discover step
    await page.getByRole('button', { name: /continue/i }).click();

    // Should show ORCID in linked accounts section
    const orcidBadge = page.getByText(/orcid: 0000-0002-1825-0097/i);
    await expect(orcidBadge).toBeVisible();
  });

  test('completing with ORCID shows success with linked badge', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate through steps with ORCID
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('textbox', { name: /orcid/i }).fill('0000-0002-1825-0097');
    await page.getByRole('button', { name: /continue/i }).click();

    // Complete setup
    await page.getByRole('button', { name: /complete setup/i }).click();

    // Should show linked badge in completion
    const linkedBadge = page.getByText(/orcid linked/i);
    await expect(linkedBadge).toBeVisible();
  });
});

// =============================================================================
// WIZARD SKIP FLOW TESTS
// =============================================================================

test.describe('Account Linking Wizard - Skip Flow', () => {
  test('skipping from start navigates to dashboard', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Click skip
    const skipButton = page.getByRole('button', { name: /skip for now/i });
    await expect(skipButton).toBeVisible({ timeout: 5000 });
    await skipButton.click();

    // Should navigate to dashboard
    await expect(page).toHaveURL('/dashboard');
  });
});

// =============================================================================
// WIZARD ACCESSIBILITY TESTS
// =============================================================================

test.describe('Account Linking Wizard - Accessibility', () => {
  test('wizard has accessible heading structure', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Main title should be visible (CardTitle renders as text, not heading)
    const mainTitle = page.getByText('Link Your Academic Accounts');
    await expect(mainTitle).toBeVisible({ timeout: 5000 });

    // Step content should have its own heading (h3 element)
    const stepHeading = page.getByRole('heading', { name: /why link your accounts/i });
    await expect(stepHeading).toBeVisible();
  });

  test('ORCID input has associated label', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Navigate to ORCID step
    await page.getByRole('button', { name: /get started/i }).click();

    // Input should have a label
    const label = page.getByText('ORCID iD', { exact: true });
    await expect(label).toBeVisible();

    // Input should be associated with label (via id)
    const input = page.getByRole('textbox', { name: /orcid/i });
    await expect(input).toBeVisible();
  });

  test('buttons are focusable and have accessible names', async ({ page }) => {
    await page.goto('/onboarding/link-accounts');

    // Get started button should be focusable
    const getStartedButton = page.getByRole('button', { name: /get started/i });
    await expect(getStartedButton).toBeVisible({ timeout: 5000 });

    await getStartedButton.focus();
    await expect(getStartedButton).toBeFocused();
  });
});
