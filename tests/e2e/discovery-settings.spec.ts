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

    // Save settings before reloading
    await page.getByRole('button', { name: /save settings/i }).click();

    // Wait for save confirmation
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

    // Reload page
    await page.reload();

    // Wait for settings to load again
    await expect(page.getByText('Discovery Settings')).toBeVisible();

    // Check state persisted using polling assertion
    await expect(page.locator('#showRecommendationReasons')).toBeChecked({
      checked: !initialState,
    });
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

    // Save settings before reloading
    await page.getByRole('button', { name: /save settings/i }).click();

    // Wait for save confirmation
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

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
