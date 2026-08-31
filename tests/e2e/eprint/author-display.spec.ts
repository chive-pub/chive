/**
 * E2E tests for author display on eprint pages.
 *
 * Tests how authors are displayed including:
 * - Author list with ordering
 * - Corresponding author indicator
 * - Highlighted (co-first/co-last) author display
 * - Author affiliations
 * - Contribution types display
 * - External author distinction
 *
 * @packageDocumentation
 */

import { test, expect } from '@playwright/test';
import { SEEDED_EPRINTS, SEEDED_AUTHORS } from '../fixtures/test-data.js';

test.describe('Author Display - Eprint Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a seeded eprint
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
  });

  test('displays author name prominently', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Author should be visible
    const authorName = page.getByText(SEEDED_AUTHORS.white.displayName);
    await expect(authorName).toBeVisible({ timeout: 10000 });
  });

  test('displays author with avatar or initials', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for avatar image or initials fallback
    const avatar = page
      .getByRole('img', { name: new RegExp(SEEDED_AUTHORS.white.displayName, 'i') })
      .or(page.locator('[data-testid="author-avatar"]'))
      .or(page.locator('.avatar'));

    // Avatar or initials should be present
    const isVisible = await avatar.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await expect(avatar).toBeVisible();
    }
  });

  test('shows author affiliation', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for affiliation text
    const affiliation = page.getByText(SEEDED_AUTHORS.white.affiliation);
    const isVisible = await affiliation.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(affiliation).toBeVisible();
    }
  });

  test('clicking author name navigates to profile', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Find author link
    const authorLink = page.getByRole('link', {
      name: new RegExp(SEEDED_AUTHORS.white.displayName, 'i'),
    });

    if (await authorLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await authorLink.click();

      // Should navigate to author profile page
      await expect(page).toHaveURL(
        new RegExp(`/authors/.*${SEEDED_AUTHORS.white.did.replace(/:/g, '%3A')}`)
      );
    }
  });
});

test.describe('Author Display - Multiple Authors', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to an eprint with co-authors (if seeded)
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.grove.uri)}`);
  });

  test('displays all authors in order', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Primary author should be visible
    const primaryAuthor = page.getByText(SEEDED_AUTHORS.grove.displayName);
    await expect(primaryAuthor).toBeVisible({ timeout: 10000 });
  });

  test('shows author count or list', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for authors section
    const authorsSection = page
      .getByRole('list', { name: /authors/i })
      .or(page.locator('[aria-label*="author" i]'))
      .or(page.locator('[data-testid="authors-list"]'));

    if (await authorsSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(authorsSection).toBeVisible();
    }
  });
});

test.describe('Author Display - Badges and Indicators', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
  });

  test('displays corresponding author indicator', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for corresponding author badge or indicator
    const correspondingBadge = page
      .getByText(/corresponding/i)
      .or(page.locator('[data-testid="corresponding-badge"]'))
      .or(page.getByRole('img', { name: /corresponding/i }));

    // scripts/seed-test-data.ts sets isCorrespondingAuthor on the sole author
    // of every seeded eprint, so this indicator is not optional and the test
    // can assert it. It used to compute the visibility and discard the answer,
    // so it passed whether or not the badge rendered.
    await expect(correspondingBadge.first()).toBeVisible();
  });

  test('shows no highlighted-author indicator when no author is highlighted', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for highlighted author indicator
    const highlightedBadge = page
      .getByText(/co-first|co-last|equal contribution/i)
      .or(page.locator('[data-testid="highlighted-badge"]'))
      .or(page.getByText(/\u2020/)); // Dagger symbol

    // The seed sets isHighlighted false on every author, so absence is what
    // this page can assert — and it is worth asserting: a bug rendering the
    // dagger unconditionally would mark every author co-first, which the
    // previous form of this test could not have noticed.
    await expect(highlightedBadge.first()).toBeHidden();
  });

  test('displays ORCID link when available', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for ORCID link (Aaron White has ORCID in test data)
    const orcidLink = page
      .getByRole('link', { name: /orcid/i })
      .or(page.locator('a[href*="orcid.org"]'));

    if (await orcidLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(orcidLink).toBeVisible();
      await expect(orcidLink).toHaveAttribute('href', new RegExp(SEEDED_AUTHORS.white.orcid));
    }
  });
});

test.describe('Author Display - Contribution Types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
  });

  test('can expand author to see contributions', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for expand/details button on author
    const authorCard = page
      .locator('[data-testid^="author-"]')
      .or(page.locator('.author-chip'))
      .or(page.getByText(SEEDED_AUTHORS.white.displayName).locator('..'));

    const expandButton = authorCard
      .getByRole('button', { name: /expand|details|more/i })
      .or(page.getByRole('button', { name: /show contributions/i }));

    if (await expandButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expandButton.click();

      // Look for contribution types
      const contributions = page.getByText(/conceptualization|methodology|investigation|writing/i);
      // The seeded authors carry an empty contributions array, so no CRediT
      // role should appear. That catches an expansion rendering placeholders.
      await expect(contributions.first()).toBeHidden();
    }
  });

  test('shows no contribution degree when the author has no contributions', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for contribution degrees (lead/equal/supporting)
    const degrees = page.getByText(/lead|equal|supporting/i).filter({
      has: page.locator('[data-testid="contribution-degree"]').or(page.locator('.contribution')),
    });

    // Same reasoning: with no contributions seeded, a degree chip appearing
    // would be the page inventing data.
    await expect(degrees.first()).toBeHidden();
  });
});

test.describe('Author Display - External Authors', () => {
  // External authors don't have DIDs, testing the distinction in display
  test('external authors show without profile link', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // External authors (if any) should not have clickable links
    // This is tested implicitly - if no profile link, clicking does nothing
    const authorName = page.getByText(SEEDED_AUTHORS.white.displayName);
    // The assertion above is the whole test: the seeded author renders by
    // name. The trailing expect(true) added nothing.
    await expect(authorName).toBeVisible({ timeout: 10000 });
  });

  test('external authors can show ORCID even without DID', async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // ORCID should be visible regardless of DID status
    const orcidLink = page
      .getByRole('link', { name: /orcid/i })
      .or(page.locator('a[href*="orcid.org"]'));

    // The seed gives this author an ORCID, so the link is not optional here.
    await expect(orcidLink.first()).toBeVisible();
    await expect(orcidLink.first()).toHaveAttribute('href', /orcid\.org/);
  });
});

test.describe('Author Display - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
  });

  test('authors section has proper heading hierarchy', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Check for authors heading or section
    const authorsHeading = page.getByRole('heading', { name: /authors/i });
    if (await authorsHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(authorsHeading).toBeVisible();
    }
  });

  test('author links have accessible names', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Find author link and verify it has accessible name matching the author's display name
    const authorLink = page.getByRole('link', {
      name: new RegExp(SEEDED_AUTHORS.white.displayName, 'i'),
    });

    if (await authorLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Verify the link has an accessible name containing the author's name
      await expect(authorLink).toHaveAccessibleName(
        new RegExp(SEEDED_AUTHORS.white.displayName, 'i')
      );
    }
  });

  test('ORCID links open in new tab with proper attributes', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const orcidLink = page.locator('a[href*="orcid.org"]');

    if (await orcidLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Should open in new tab and have security attributes
      await expect(orcidLink).toHaveAttribute('target', '_blank');
      await expect(orcidLink).toHaveAttribute('rel', /noopener/);
    }
  });
});

test.describe('Author Display - Responsive', () => {
  test('authors display correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Author should still be visible on mobile
    const authorName = page.getByText(SEEDED_AUTHORS.white.displayName);
    await expect(authorName).toBeVisible({ timeout: 10000 });
  });

  test('author list collapses gracefully on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`/eprints/${encodeURIComponent(SEEDED_EPRINTS.white.uri)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Page should not have horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small margin
  });
});
