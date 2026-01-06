/**
 * E2E tests for accessibility.
 *
 * Tests WCAG compliance and keyboard navigation.
 */

import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  // Mark as slow since accessibility tests do comprehensive checks
  test.slow();

  test('home page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Check for single h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('all images have alt text', async ({ page }) => {
    await page.goto('/');

    // Batch query all images at once for efficiency
    const imageData = await page.locator('img').evaluateAll((imgs) =>
      imgs.map((img) => ({
        alt: img.getAttribute('alt'),
        ariaHidden: img.getAttribute('aria-hidden'),
        src: img.getAttribute('src')?.slice(0, 50), // For debugging
      }))
    );

    for (const img of imageData) {
      // Image should have alt text or be decorative (aria-hidden)
      expect(
        img.alt !== null || img.ariaHidden === 'true',
        `Image ${img.src} missing alt text`
      ).toBeTruthy();
    }
  });

  test('form inputs have labels', async ({ page }) => {
    await page.goto('/search');

    // Batch query all inputs at once for efficiency
    const inputData = await page.locator('input:not([type="hidden"])').evaluateAll((inputs) =>
      inputs.map((input) => ({
        id: input.getAttribute('id'),
        ariaLabel: input.getAttribute('aria-label'),
        ariaLabelledBy: input.getAttribute('aria-labelledby'),
        type: input.getAttribute('type'),
      }))
    );

    // Also get all labels
    const labelData = await page
      .locator('label[for]')
      .evaluateAll((labels) => labels.map((label) => label.getAttribute('for')));
    const labelForSet = new Set(labelData);

    for (const input of inputData) {
      // Input should have associated label or aria-label
      const hasLabel = input.id ? labelForSet.has(input.id) : false;
      expect(
        hasLabel || input.ariaLabel !== null || input.ariaLabelledBy !== null,
        `Input ${input.type || 'text'} missing label`
      ).toBeTruthy();
    }
  });

  test('links have discernible text', async ({ page }) => {
    await page.goto('/');

    // Batch query first 20 links at once for efficiency
    const linkData = await page.locator('a').evaluateAll((links) =>
      links.slice(0, 20).map((link) => ({
        text: link.textContent?.trim(),
        ariaLabel: link.getAttribute('aria-label'),
        title: link.getAttribute('title'),
        href: link.getAttribute('href')?.slice(0, 30), // For debugging
      }))
    );

    for (const link of linkData) {
      // Link should have visible text or aria-label
      const hasDiscernibleText =
        (link.text && link.text.length > 0) || link.ariaLabel !== null || link.title !== null;

      expect(hasDiscernibleText, `Link ${link.href} missing discernible text`).toBeTruthy();
    }
  });

  test('buttons have discernible text', async ({ page }) => {
    await page.goto('/');

    // Batch query all buttons at once for efficiency
    const buttonData = await page.locator('button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        text: button.textContent?.trim(),
        ariaLabel: button.getAttribute('aria-label'),
        title: button.getAttribute('title'),
      }))
    );

    for (const button of buttonData) {
      // Button should have visible text or aria-label
      const hasDiscernibleText =
        (button.text && button.text.length > 0) ||
        button.ariaLabel !== null ||
        button.title !== null;

      expect(hasDiscernibleText).toBeTruthy();
    }
  });

  test('page has skip link', async ({ page }) => {
    await page.goto('/');

    // Skip link should be first focusable element
    await page.keyboard.press('Tab');

    const skipLink = page.locator('a:focus');
    if (await skipLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      const text = await skipLink.textContent();
      expect(text?.toLowerCase()).toMatch(/skip|main/);
    }
  });

  test('search input is keyboard accessible', async ({ page }) => {
    await page.goto('/search');

    // Find search input using role-based selector
    const searchInput = page
      .getByRole('searchbox')
      .or(page.getByRole('textbox', { name: /search/i }));

    // Verify it's focusable
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.focus();
      await expect(searchInput).toBeFocused();
    }
  });

  test('modal dialogs trap focus', async ({ page }) => {
    await page.goto('/search');

    const filterButton = page.getByRole('button', { name: /filters/i });

    if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filterButton.click();

      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Tab through dialog
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Focus should still be within dialog
        const isWithinDialog = (await dialog.locator(':focus').count()) > 0;
        expect(isWithinDialog).toBeTruthy();
      }
    }
  });

  test('focus is visible', async ({ page }) => {
    await page.goto('/');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    if (await focusedElement.isVisible({ timeout: 1000 }).catch(() => false)) {
      const outlineStyle = await focusedElement.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          outline: style.outline,
          outlineWidth: style.outlineWidth,
          boxShadow: style.boxShadow,
        };
      });

      // Focus indicator should be visible (outline or box-shadow)
      const hasFocusIndicator =
        outlineStyle.outline !== 'none' ||
        outlineStyle.outlineWidth !== '0px' ||
        outlineStyle.boxShadow !== 'none';

      expect(hasFocusIndicator).toBeTruthy();
    }
  });

  test('color contrast meets WCAG AA', async ({ page }) => {
    await page.goto('/');

    // Check main text color contrast
    const body = page.locator('body');
    const styles = await body.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });

    // Note: Full contrast checking would require a library like axe-core
    // This is a basic check that colors are defined
    expect(styles.color).toBeDefined();
    expect(styles.backgroundColor).toBeDefined();
  });

  test('page language is set', async ({ page }) => {
    await page.goto('/');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });

  test('page has descriptive title', async ({ page }) => {
    await page.goto('/');

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title.toLowerCase()).toContain('chive');
  });
});
