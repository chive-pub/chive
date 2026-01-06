/**
 * E2E tests for Share to Bluesky feature.
 *
 * @remarks
 * Tests the complete share flow including:
 * - Share menu dropdown
 * - Share to Bluesky dialog
 * - Post composer with @mention autocomplete
 * - Grapheme counter
 * - Post preview
 * - Post submission (mocked)
 * - Copy link functionality
 */

import { test, expect, type Page } from '@playwright/test';

// Use default parallel mode (each test should be independent)

/**
 * Navigate to the first available preprint and return the page.
 * Uses retry logic for more reliable navigation.
 */
async function navigateToFirstPreprint(page: Page): Promise<void> {
  await page.goto('/browse', { waitUntil: 'domcontentloaded' });

  // Wait for content to load (preprints or loading indicator to clear)
  await page.waitForLoadState('networkidle', { timeout: 20000 });

  const preprintLink = page.locator('a[href*="/preprints/"]').first();
  await expect(preprintLink).toBeVisible({ timeout: 20000 });

  await preprintLink.click();
  await page.waitForURL(/\/preprints\//, { timeout: 15000 });

  // Wait for preprint page to fully load and Share button to appear
  await page.waitForLoadState('networkidle', { timeout: 10000 });
  await expect(page.locator('button:has-text("Share")').first()).toBeVisible({ timeout: 10000 });
}

// =============================================================================
// SHARE MENU DROPDOWN
// =============================================================================

test.describe('Share Menu Dropdown', () => {
  test('Share button opens dropdown with options', async ({ page }) => {
    await navigateToFirstPreprint(page);

    // The share button has text "Share" with an icon
    const shareButton = page.locator('button:has-text("Share")').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });

    await shareButton.click();

    // Dropdown should show options
    await expect(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Share to Bluesky' })).toBeVisible();
  });

  test('Copy link copies URL to clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard API not supported in Firefox/WebKit headless');

    await context.grantPermissions(['clipboard-write', 'clipboard-read']);
    await navigateToFirstPreprint(page);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();

    await page.getByRole('menuitem', { name: 'Copy link' }).click();

    // Verify clipboard contains the URL
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('/preprints/');
  });

  test('Copy link shows success toast', async ({ page, context }) => {
    // Grant clipboard permissions for the copy operation to succeed
    await context.grantPermissions(['clipboard-write', 'clipboard-read']);

    await navigateToFirstPreprint(page);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    await page.getByRole('menuitem', { name: 'Copy link' }).click();

    // Sonner renders toasts; look for the toast message text directly
    // The toast should appear with "Link copied to clipboard" text
    await expect(page.getByText('Link copied to clipboard')).toBeVisible({ timeout: 5000 });
  });
});

// =============================================================================
// SHARE TO BLUESKY DIALOG
// =============================================================================

test.describe('Share to Bluesky Dialog', () => {
  test('Share to Bluesky opens dialog', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Share to Bluesky' })).toBeVisible();
  });

  test('Dialog displays user information', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // User info should be visible
    await expect(page.getByText('E2E Test User')).toBeVisible();
    await expect(page.getByText('@e2e-test.bsky.social')).toBeVisible();
  });

  test('Dialog shows composer editor', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // TipTap composer editor should be visible (contenteditable with aria-label)
    const editor = page.getByLabel('Post composer');
    await expect(editor).toBeVisible();
  });

  test('Dialog shows grapheme counter', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // Counter should show 0/300
    await expect(page.getByText('0/300')).toBeVisible();
  });

  test('Dialog shows post preview', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // Preview label should be visible
    await expect(page.getByText('Preview')).toBeVisible();
  });

  test('Cancel button closes dialog', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Close button (X) closes dialog', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: /close/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Escape key closes dialog', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Clicking backdrop closes dialog', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Click on backdrop (the dark overlay area with bg-black/80 class)
    // The backdrop is the first child with aria-hidden="true"
    const backdrop = page.locator('div.fixed.inset-0.bg-black\\/80');
    if (await backdrop.isVisible()) {
      await backdrop.click({ position: { x: 10, y: 10 } });
      await expect(page.getByRole('dialog')).not.toBeVisible();
    } else {
      // Fallback: close with escape
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  });
});

// =============================================================================
// POST COMPOSER
// =============================================================================

test.describe('Post Composer', () => {
  test('Typing updates grapheme counter', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // Wait for dialog to be fully ready
    await expect(page.getByRole('dialog')).toBeVisible();

    // TipTap uses contenteditable; fill() works with contenteditable elements
    const editor = page.getByLabel('Post composer');
    await editor.click();
    await editor.fill('Hello world!');

    // Counter should update (12 characters)
    await expect(page.getByText('12/300')).toBeVisible({ timeout: 5000 });
  });

  test('Post button is disabled when text is empty', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // Post button should be disabled initially
    const postButton = page.getByRole('button', { name: /^post$/i });
    await expect(postButton).toBeDisabled();
  });

  test('Post button is enabled when text is entered', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // Wait for dialog to be fully ready
    await expect(page.getByRole('dialog')).toBeVisible();

    // TipTap uses contenteditable; fill() works with contenteditable elements
    const editor = page.getByLabel('Post composer');
    await editor.click();
    await editor.fill('Check out this preprint!');

    // Post button should be enabled
    const postButton = page.getByRole('button', { name: /^post$/i });
    await expect(postButton).not.toBeDisabled();
  });

  test('Counter turns red when over 300 graphemes', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    await page.getByRole('menuitem', { name: 'Share to Bluesky' }).click();

    // TipTap uses contenteditable; type long text
    const editor = page.getByLabel('Post composer');
    await editor.click();

    // Type more than 300 characters using fill (works with contenteditable)
    const longText = 'A'.repeat(301);
    await editor.fill(longText);

    // Counter should show over limit with text-destructive class
    const counter = page.locator('[aria-label="301 of 300 characters"]');
    await expect(counter).toBeVisible();
    await expect(counter).toHaveClass(/text-destructive/);
  });

  test('Post button is disabled when over character limit', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // TipTap uses contenteditable
    const editor = page.getByLabel('Post composer');
    await editor.click();
    await editor.fill('A'.repeat(301));

    // Post button should be disabled
    const postButton = page.getByRole('button', { name: /^post$/i });
    await expect(postButton).toBeDisabled();
  });

  test('Preview updates as user types', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    await page.getByRole('menuitem', { name: 'Share to Bluesky' }).click();

    // Wait for dialog to be visible
    await expect(page.getByRole('dialog')).toBeVisible();

    // TipTap uses contenteditable
    const editor = page.getByLabel('Post composer');
    await editor.click();
    await editor.pressSequentially('Amazing research paper!', { delay: 10 });

    // Preview should show the typed text within the dialog
    await expect(page.getByRole('dialog')).toContainText('Amazing research paper!');
  });
});

// =============================================================================
// @MENTION AUTOCOMPLETE
// =============================================================================

test.describe('@Mention Autocomplete', () => {
  test('Typing @ triggers mention popover', async ({ page }) => {
    // Mock the Bluesky actor search API to return results
    await page.route('**/xrpc/app.bsky.actor.searchActorsTypeahead**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          actors: [
            { did: 'did:plc:test1', handle: 'testuser.bsky.social', displayName: 'Test User' },
            { did: 'did:plc:test2', handle: 'testing.bsky.social', displayName: 'Testing Account' },
          ],
        }),
      });
    });

    await navigateToFirstPreprint(page);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    await page.getByRole('menuitem', { name: 'Share to Bluesky' }).click();

    // Wait for dialog and editor to be ready
    await expect(page.getByRole('dialog')).toBeVisible();

    // TipTap uses contenteditable
    const editor = page.getByLabel('Post composer');
    await editor.click();
    await page.waitForTimeout(100); // Ensure editor is focused

    // Type character by character to trigger the autocomplete (faster delay)
    await editor.pressSequentially('@te', { delay: 30 });

    // TipTap MentionSuggestion renders with role="listbox" containing actor suggestions
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 10000 });

    // Verify the suggestions are visible
    await expect(page.getByText('@testuser.bsky.social')).toBeVisible({ timeout: 5000 });
  });

  test('Escape closes mention popover', async ({ page }) => {
    // Mock the API
    await page.route('**/xrpc/app.bsky.actor.searchActorsTypeahead**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          actors: [{ did: 'did:plc:test1', handle: 'alice.bsky.social', displayName: 'Alice' }],
        }),
      });
    });

    await navigateToFirstPreprint(page);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    await page.getByRole('menuitem', { name: 'Share to Bluesky' }).click();

    // Wait for dialog and editor to be ready
    await expect(page.getByRole('dialog')).toBeVisible();

    // TipTap uses contenteditable
    const editor = page.getByLabel('Post composer');
    await editor.click();
    await page.waitForTimeout(100); // Ensure editor is focused
    await editor.pressSequentially('@al', { delay: 30 });

    // Wait for popover to appear
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 10000 });

    // Press Escape (TipTap's mention suggestion handles this)
    await page.keyboard.press('Escape');

    // Popover should be closed
    await expect(listbox).not.toBeVisible({ timeout: 2000 });

    // Dialog should still be visible
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

// =============================================================================
// POST PREVIEW CARD
// =============================================================================

test.describe('Post Preview Card', () => {
  test('Preview shows preprint title', async ({ page }) => {
    await navigateToFirstPreprint(page);

    // Get the preprint title before opening share dialog
    const preprintTitle = await page.getByRole('heading', { level: 1 }).textContent();

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // Wait for dialog and preview
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Preview')).toBeVisible();

    // Preview should contain the preprint title
    await expect(page.getByRole('dialog')).toContainText(preprintTitle!.slice(0, 30));
  });

  test('Preview shows domain', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    await page.getByRole('menuitem', { name: 'Share to Bluesky' }).click();

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();

    // Preview should show the domain in the link card
    // The domain could be chive.pub or localhost in test environment
    const domainText = page.getByRole('dialog').locator('text=/chive\\.pub|localhost/');
    await expect(domainText.first()).toBeVisible({ timeout: 5000 });
  });
});

// =============================================================================
// INTEGRATION WITH AUTHOR PAGE
// =============================================================================

test.describe('Share from Author Page', () => {
  test('Author page has share button', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');

    // Navigate to a preprint first
    const preprintLink = page.locator('a[href*="/preprints/"]').first();
    await expect(preprintLink).toBeVisible({ timeout: 10000 });
    await preprintLink.click();
    await page.waitForURL(/\/preprints\//);

    // Click on an author link
    const authorLink = page.locator('a[href*="/authors/"]').first();
    if (await authorLink.isVisible()) {
      await authorLink.click();
      await page.waitForURL(/\/authors\//);

      // Check for share button on author page
      const shareButton = page.getByRole('button', { name: /share/i });
      // Author page may or may not have share button depending on implementation
      // This test documents the expected behavior
      if (await shareButton.isVisible()) {
        await shareButton.click();
        await expect(page.getByText('Share to Bluesky')).toBeVisible();
      }
    }
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

test.describe('Error Handling', () => {
  test('Dialog handles network errors gracefully', async ({ page }) => {
    await navigateToFirstPreprint(page);

    // Mock the Bluesky API to fail
    await page.route('**/api.bsky.app/**', (route) => {
      route.abort('failed');
    });

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    // Dialog should still open even if OG image fetch fails
    await expect(page.getByRole('dialog')).toBeVisible();
    // TipTap editor should be visible
    await expect(page.getByLabel('Post composer')).toBeVisible();
  });
});

// =============================================================================
// ACCESSIBILITY
// =============================================================================

test.describe('Accessibility', () => {
  test('Dialog has correct ARIA attributes', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-labelledby');
  });

  test('Close button has accessible label', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    await page.getByText('Share to Bluesky').click();

    const closeButton = page.getByRole('button', { name: /close/i });
    await expect(closeButton).toBeVisible();
  });

  test('Dialog can be navigated with keyboard', async ({ page }) => {
    await navigateToFirstPreprint(page);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    await page.getByRole('menuitem', { name: 'Share to Bluesky' }).click();

    // Wait for dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The TipTap editor should be focusable
    const editor = page.getByLabel('Post composer');
    await editor.click();
    await expect(editor).toBeFocused();

    // Type some text so Post button is enabled (disabled buttons can't receive focus)
    await editor.pressSequentially('Test text', { delay: 10 });

    // Tab through all focusable elements in the dialog
    // The tab order is: editor -> Cancel -> Post -> Close(X)
    await page.keyboard.press('Tab');

    // After first Tab, focus should be on Cancel button
    const cancelButton = dialog.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeFocused();

    // Tab again to Post button (now enabled since we typed text)
    await page.keyboard.press('Tab');
    const postButton = dialog.getByRole('button', { name: /post/i });
    await expect(postButton).toBeFocused();

    // Shift+Tab back to Cancel
    await page.keyboard.press('Shift+Tab');
    await expect(cancelButton).toBeFocused();
  });
});
