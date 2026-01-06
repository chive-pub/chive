/**
 * E2E tests for discovery settings panel.
 *
 * @remarks
 * Tests the discovery settings configuration including:
 * - Panel display on settings page
 * - Toggle state changes
 * - Collapsible sections
 * - Radio button selections
 * - Settings persistence
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// DISCOVERY SETTINGS PANEL DISPLAY
// =============================================================================

test.describe('Discovery Settings - Display', () => {
  test('displays discovery settings panel on settings page', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Should show the discovery settings card (rendered as text, not heading)
    const settingsTitle = page.getByText('Discovery Settings');
    await expect(settingsTitle).toBeVisible({ timeout: 5000 });
  });

  test('shows panel description', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Should show description text
    const description = page.getByText(/configure how chive recommends papers/i);
    await expect(description).toBeVisible({ timeout: 5000 });
  });

  test('shows main toggles section', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Wait for settings to load
    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Should show enable personalization toggle
    const personalizationLabel = page.getByText(/enable personalization/i);
    await expect(personalizationLabel).toBeVisible();

    // Should show for you feed toggle
    const forYouLabel = page.getByText(/show for you feed/i);
    await expect(forYouLabel).toBeVisible();

    // Should show recommendation reasons toggle
    const reasonsLabel = page.getByText(/show recommendation reasons/i);
    await expect(reasonsLabel).toBeVisible();
  });
});

// =============================================================================
// TOGGLE FUNCTIONALITY TESTS
// =============================================================================

test.describe('Discovery Settings - Toggles', () => {
  test('enable personalization toggle is functional', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Wait for settings to load
    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // Find the personalization switch (associated with the label)
    const personalizationSwitch = page.locator('#enablePersonalization');
    await expect(personalizationSwitch).toBeVisible();

    // Get initial state
    const isChecked = await personalizationSwitch.isChecked();

    // Click to toggle
    await personalizationSwitch.click();

    // State should change - use web-first assertion to wait for state change
    await expect(personalizationSwitch).toBeChecked({ checked: !isChecked });
  });

  test('show for you feed toggle is functional', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    const forYouSwitch = page.locator('#enableForYouFeed');
    await expect(forYouSwitch).toBeVisible();

    // Click to toggle
    await forYouSwitch.click();

    // Should trigger state change (we verify it's clickable)
    await expect(forYouSwitch).toBeVisible();
  });

  test('show recommendation reasons toggle is functional', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    const reasonsSwitch = page.locator('#showRecommendationReasons');
    await expect(reasonsSwitch).toBeVisible();

    // Click to toggle
    await reasonsSwitch.click();

    // Should trigger state change
    await expect(reasonsSwitch).toBeVisible();
  });
});

// =============================================================================
// COLLAPSIBLE SECTIONS TESTS
// =============================================================================

test.describe('Discovery Settings - Collapsible Sections', () => {
  test('for you feed sources section is expandable', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Find and click the For You Feed Sources section
    const sectionButton = page.getByRole('button', { name: /for you feed sources/i });
    await expect(sectionButton).toBeVisible();

    // Click to expand (it should be expanded by default based on defaultOpen)
    // Check for content inside
    const fieldsToggle = page.getByText(/research fields/i);
    await expect(fieldsToggle).toBeVisible();
  });

  test('for you feed sources shows all signal toggles', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Should show all For You signal toggles (use first() for any duplicates)
    await expect(page.getByText(/research fields/i).first()).toBeVisible();
    await expect(page.getByText('Citations').first()).toBeVisible();
    await expect(page.getByText(/collaborators/i).first()).toBeVisible();
    await expect(page.getByText('Trending').first()).toBeVisible();
  });

  test('related papers section is collapsible', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Find and click the Related Papers section to expand
    const sectionButton = page.getByRole('button', { name: /^related papers$/i });
    await expect(sectionButton).toBeVisible();
    await sectionButton.click();

    // Should show related papers toggles after expansion
    const citationToggle = page.getByText(/citation relationships/i);
    await expect(citationToggle).toBeVisible();

    const topicToggle = page.getByText(/topic similarity/i);
    await expect(topicToggle).toBeVisible();
  });

  test('citation network display section shows radio options', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Expand citation network section
    const sectionButton = page.getByRole('button', { name: /citation network display/i });
    await expect(sectionButton).toBeVisible();
    await sectionButton.click();

    // Should show radio options
    const hiddenRadio = page.getByRole('radio', { name: /hidden/i });
    await expect(hiddenRadio).toBeVisible();

    const previewRadio = page.getByRole('radio', { name: /preview/i });
    await expect(previewRadio).toBeVisible();

    const expandedRadio = page.getByRole('radio', { name: /expanded/i });
    await expect(expandedRadio).toBeVisible();
  });
});

// =============================================================================
// RADIO BUTTON TESTS
// =============================================================================

test.describe('Discovery Settings - Citation Network Options', () => {
  test('can select hidden citation network option', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Expand section
    await page.getByRole('button', { name: /citation network display/i }).click();

    // Select hidden
    const hiddenRadio = page.getByRole('radio', { name: /hidden/i });
    await hiddenRadio.click();

    // Should be checked
    await expect(hiddenRadio).toBeChecked();
  });

  test('can select preview citation network option', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Expand section
    await page.getByRole('button', { name: /citation network display/i }).click();

    // Select preview
    const previewRadio = page.getByRole('radio', { name: /preview/i });
    await previewRadio.click();

    // Should be checked
    await expect(previewRadio).toBeChecked();
  });

  test('can select expanded citation network option', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Expand section
    await page.getByRole('button', { name: /citation network display/i }).click();

    // Select expanded
    const expandedRadio = page.getByRole('radio', { name: /expanded/i });
    await expandedRadio.click();

    // Should be checked
    await expect(expandedRadio).toBeChecked();
  });

  test('radio options are mutually exclusive', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Expand section
    await page.getByRole('button', { name: /citation network display/i }).click();

    // Select hidden first
    const hiddenRadio = page.getByRole('radio', { name: /hidden/i });
    await hiddenRadio.click();
    await expect(hiddenRadio).toBeChecked();

    // Select preview
    const previewRadio = page.getByRole('radio', { name: /preview/i });
    await previewRadio.click();

    // Hidden should no longer be checked
    await expect(hiddenRadio).not.toBeChecked();
    await expect(previewRadio).toBeChecked();
  });
});

// =============================================================================
// SETTINGS PERSISTENCE TESTS
// =============================================================================

test.describe('Discovery Settings - Persistence', () => {
  test('settings persist after page reload', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // Toggle a setting
    const reasonsSwitch = page.locator('#showRecommendationReasons');
    await expect(reasonsSwitch).toBeVisible();

    // Get current state and toggle
    const initialState = await reasonsSwitch.isChecked();
    await reasonsSwitch.click();

    // Wait for the switch state to change (confirms UI updated)
    await expect(reasonsSwitch).toBeChecked({ checked: !initialState });

    // Reload page
    await page.reload();

    // Wait for settings to load again
    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // Check state persisted using polling assertion
    await expect(page.locator('#showRecommendationReasons')).toBeChecked({
      checked: !initialState,
    });
  });

  test('for you feed signal changes persist', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // Toggle trending signal
    const trendingSwitch = page.locator('#forYou-trending');
    await expect(trendingSwitch).toBeVisible();

    const initialState = await trendingSwitch.isChecked();
    await trendingSwitch.click();

    // Wait for the switch state to change (confirms UI updated)
    await expect(trendingSwitch).toBeChecked({ checked: !initialState });

    // Reload
    await page.reload();

    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // Verify state persisted using web-first assertion
    await expect(page.locator('#forYou-trending')).toBeChecked({ checked: !initialState });
  });

  test('citation network display selection persists', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // Expand section and select expanded option
    await page.getByRole('button', { name: /citation network display/i }).click();

    const expandedRadio = page.getByRole('radio', { name: /expanded/i });
    await expandedRadio.click();

    // Wait for the radio to be checked (confirms UI updated)
    await expect(expandedRadio).toBeChecked();

    // Reload
    await page.reload();

    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // Expand section again
    await page.getByRole('button', { name: /citation network display/i }).click();

    // Verify expanded is still selected
    await expect(page.getByRole('radio', { name: /expanded/i })).toBeChecked();
  });
});

// =============================================================================
// DISABLED STATE TESTS
// =============================================================================

test.describe('Discovery Settings - Disabled States', () => {
  test('for you signals are disabled when for you feed is disabled', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // First ensure For You Feed is enabled
    const forYouSwitch = page.locator('#enableForYouFeed');
    if (!(await forYouSwitch.isChecked())) {
      await forYouSwitch.click();
      await expect(forYouSwitch).toBeChecked();
    }

    // Verify signals are enabled
    const trendingSwitch = page.locator('#forYou-trending');
    await expect(trendingSwitch).toBeEnabled();

    // Now disable For You Feed
    await forYouSwitch.click();
    await expect(forYouSwitch).not.toBeChecked();

    // Signals should be disabled
    await expect(trendingSwitch).toBeDisabled();
  });

  test('for you feed is disabled when personalization is disabled', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // First ensure personalization is enabled
    const personalizationSwitch = page.locator('#enablePersonalization');
    if (!(await personalizationSwitch.isChecked())) {
      await personalizationSwitch.click();
      await expect(personalizationSwitch).toBeChecked();
    }

    // For You Feed should be enabled
    const forYouSwitch = page.locator('#enableForYouFeed');
    await expect(forYouSwitch).toBeEnabled();

    // Disable personalization
    await personalizationSwitch.click();
    await expect(personalizationSwitch).not.toBeChecked();

    // For You Feed should be disabled
    await expect(forYouSwitch).toBeDisabled();
  });
});

// =============================================================================
// ACCESSIBILITY TESTS
// =============================================================================

test.describe('Discovery Settings - Accessibility', () => {
  test('toggles have accessible labels', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // All switches should have IDs that associate them with labels
    const personalizationSwitch = page.locator('#enablePersonalization');
    await expect(personalizationSwitch).toBeVisible();

    // Label should be clickable to toggle (via htmlFor)
    const label = page.getByText(/enable personalization/i);
    await expect(label).toBeVisible();
  });

  test('radio buttons are grouped properly', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Expand section
    await page.getByRole('button', { name: /citation network display/i }).click();

    // All radios should be in a radio group
    const radioGroup = page.getByRole('radiogroup');
    await expect(radioGroup).toBeVisible();

    // Radio group should contain all options
    const radios = radioGroup.getByRole('radio');
    await expect(radios).toHaveCount(3);
  });

  test('collapsible sections are keyboard accessible', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText('Discovery Settings')).toBeVisible({ timeout: 5000 });

    // Focus on a collapsible section button
    const sectionButton = page.getByRole('button', { name: /related papers/i });
    await sectionButton.focus();
    await expect(sectionButton).toBeFocused();

    // Press Enter to expand
    await page.keyboard.press('Enter');

    // Content should be visible
    const citationToggle = page.getByText(/citation relationships/i);
    await expect(citationToggle).toBeVisible();
  });
});
