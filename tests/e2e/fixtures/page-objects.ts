/**
 * Page object models for E2E tests.
 *
 * @remarks
 * Page objects encapsulate page-specific selectors and actions,
 * making tests more maintainable and readable.
 */

import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Header component present on all pages.
 */
export class HeaderComponent {
  readonly page: Page;
  readonly logo: Locator;
  readonly searchInput: Locator;
  readonly signInButton: Locator;
  readonly userMenu: Locator;
  readonly submitButton: Locator;
  readonly themeToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.getByRole('link', { name: /chive/i }).first();
    // Use specific name for header search (not page search)
    this.searchInput = page.getByRole('searchbox', { name: /search for preprints/i });
    this.signInButton = page.getByRole('link', { name: /sign in|log in/i });
    // User menu button shows initials or avatar when authenticated
    this.userMenu = page.getByRole('button').filter({ hasText: /^[A-Z]{1,2}$/ });
    this.submitButton = page.getByRole('link', { name: /submit/i });
    this.themeToggle = page.getByRole('button', { name: /toggle theme/i });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    const submitButton = this.page.getByRole('button', { name: /submit search/i });
    await Promise.all([this.page.waitForURL(/\/search\?q=/), submitButton.click()]);
  }

  async goToHome(): Promise<void> {
    await this.logo.click();
  }
}

/**
 * Home page.
 */
export class HomePage {
  readonly page: Page;
  readonly header: HeaderComponent;
  readonly heroTitle: Locator;
  readonly heroSubtitle: Locator;
  readonly searchCta: Locator;
  readonly submitCta: Locator;
  readonly featuredPreprints: Locator;
  readonly recentPreprints: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new HeaderComponent(page);
    this.heroTitle = page.getByRole('heading', { level: 1 });
    // Use role-based selectors for resilience
    this.heroSubtitle = page
      .getByRole('heading', { level: 2 })
      .first()
      .or(page.locator('p').first());
    this.searchCta = page.getByRole('link', { name: /explore|browse|search/i }).first();
    this.submitCta = page.getByRole('link', { name: /submit/i }).first();
    this.featuredPreprints = page.getByRole('region', { name: /featured/i });
    this.recentPreprints = page.getByRole('region', { name: /recent/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }
}

/**
 * Search page.
 */
export class SearchPage {
  readonly page: Page;
  readonly header: HeaderComponent;
  readonly searchInput: Locator;
  readonly resultsHeading: Locator;
  readonly resultsList: Locator;
  readonly resultItems: Locator;
  readonly filtersButton: Locator;
  readonly filtersPanel: Locator;
  readonly sortDropdown: Locator;
  readonly pagination: Locator;
  readonly emptyState: Locator;
  readonly resultCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new HeaderComponent(page);
    // Use the main search input (not header search), targeting by exact aria-label
    this.searchInput = page.getByRole('searchbox', { name: 'Search', exact: true });
    this.resultsHeading = page.getByRole('heading', { name: /results/i });
    // Use role-based selectors for resilience
    this.resultsList = page.getByRole('list').first();
    this.resultItems = page.getByRole('article').or(page.getByRole('listitem'));
    this.filtersButton = page.getByRole('button', { name: /filters/i });
    this.filtersPanel = page.getByRole('region', { name: /filters/i }).or(page.getByRole('dialog'));
    this.sortDropdown = page.getByRole('combobox', { name: /sort/i });
    this.pagination = page
      .getByRole('navigation', { name: /pagination/i })
      .or(page.getByRole('navigation').last());
    this.emptyState = page.getByText(/no results found|no preprints|nothing found/i);
    this.resultCount = page.getByText(/\d+\s*(results?|preprints?|items?)/i);
  }

  async goto(): Promise<void> {
    await this.page.goto('/search');
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Use form.requestSubmit() for reliable cross-browser form submission
    await Promise.all([
      this.page.waitForURL(/q=/),
      this.searchInput.evaluate((input) => input.closest('form')?.requestSubmit()),
    ]);
  }

  async openFilters(): Promise<void> {
    await this.filtersButton.click();
  }

  async selectSort(option: string): Promise<void> {
    await this.sortDropdown.selectOption(option);
  }
}

/**
 * Preprint detail page.
 */
export class PreprintPage {
  readonly page: Page;
  readonly header: HeaderComponent;
  readonly title: Locator;
  readonly abstract: Locator;
  readonly authors: Locator;
  readonly keywords: Locator;
  readonly pdfViewer: Locator;
  readonly downloadButton: Locator;
  readonly endorseButton: Locator;
  readonly reviewButton: Locator;
  readonly versionSelector: Locator;
  readonly metadata: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new HeaderComponent(page);
    this.title = page.getByRole('heading', { level: 1 });
    // Use role-based selectors for resilience
    this.abstract = page.getByRole('region', { name: /abstract/i });
    this.authors = page
      .getByRole('list', { name: /authors/i })
      .or(page.locator('[aria-label*="author" i]'));
    this.keywords = page
      .getByRole('list', { name: /keywords|tags/i })
      .or(page.locator('[aria-label*="keyword" i]'));
    this.pdfViewer = page.getByRole('document').or(page.locator('iframe[src*="pdf"]'));
    this.downloadButton = page
      .getByRole('button', { name: /download/i })
      .or(page.getByRole('link', { name: /download/i }));
    this.endorseButton = page.getByRole('button', { name: /endorse/i });
    this.reviewButton = page.getByRole('button', { name: /review/i });
    this.versionSelector = page
      .getByRole('combobox', { name: /version/i })
      .or(page.getByLabel(/version/i));
    this.metadata = page
      .getByRole('region', { name: /details|metadata/i })
      .or(page.locator('dl, [role="definition"]'));
  }

  async goto(uri: string): Promise<void> {
    await this.page.goto(`/preprints/${encodeURIComponent(uri)}`);
  }
}

/**
 * Author profile page.
 */
export class AuthorPage {
  readonly page: Page;
  readonly header: HeaderComponent;
  readonly displayName: Locator;
  readonly bio: Locator;
  readonly avatar: Locator;
  readonly preprintsList: Locator;
  readonly stats: Locator;
  readonly identifiers: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new HeaderComponent(page);
    this.displayName = page.getByRole('heading', { level: 1 });
    // Use role-based selectors for resilience
    this.bio = page.getByRole('region', { name: /bio|about/i });
    this.avatar = page
      .getByRole('img', { name: /avatar|profile/i })
      .or(page.locator('img[alt*="avatar" i], img[alt*="profile" i]'));
    this.preprintsList = page
      .getByRole('list', { name: /preprints|publications/i })
      .or(page.getByRole('list').first());
    this.stats = page
      .getByRole('region', { name: /stats|statistics/i })
      .or(page.getByText(/publications|preprints/i).first());
    this.identifiers = page.getByRole('list', { name: /identifiers|orcid/i });
  }

  async goto(did: string): Promise<void> {
    await this.page.goto(`/authors/${encodeURIComponent(did)}`);
  }
}

/**
 * Login page.
 *
 * @remarks
 * ATProto OAuth login page for Chive.
 * Users can sign in with their Bluesky handle or any AT Protocol identity.
 */
export class SignInPage {
  readonly page: Page;
  readonly handleInput: Locator;
  readonly pdsInput: Locator; // Alias for backwards compatibility
  readonly continueButton: Locator;
  readonly errorMessage: Locator;
  readonly validationError: Locator;
  readonly termsLink: Locator;
  readonly privacyLink: Locator;

  constructor(page: Page) {
    this.page = page;
    // The login form uses a handle/DID input (accessible name comes from placeholder)
    this.handleInput = page.getByRole('textbox', { name: /bsky\.social/i });
    this.pdsInput = this.handleInput; // Alias
    this.continueButton = page.getByRole('button', { name: /continue with at protocol/i });
    // Server-side errors shown in Alert (exclude Next.js route announcer)
    this.errorMessage = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    // Client-side form validation errors shown via FormMessage
    // Uses text-destructive class or contains validation error text
    this.validationError = page
      .locator('.text-destructive')
      .or(page.getByText(/enter a valid handle/i));
    this.termsLink = page.getByRole('link', { name: /terms/i });
    this.privacyLink = page.getByRole('link', { name: /privacy/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
  }

  async enterPds(pds: string): Promise<void> {
    await this.enterHandle(pds);
  }

  async enterHandle(handle: string): Promise<void> {
    // Use standard fill() which works with HandleInput's onInput handler.
    await this.handleInput.fill(handle);
  }
}

/**
 * Dashboard page (authenticated).
 */
export class DashboardPage {
  readonly page: Page;
  readonly header: HeaderComponent;
  readonly welcomeMessage: Locator;
  readonly preprintsList: Locator;
  readonly activityFeed: Locator;
  readonly quickActions: Locator;
  readonly stats: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new HeaderComponent(page);
    this.welcomeMessage = page.getByRole('heading', { level: 1 });
    // Use role-based selectors for resilience
    this.preprintsList = page
      .getByRole('list', { name: /preprints|submissions/i })
      .or(page.getByRole('list').first());
    this.activityFeed = page.getByRole('feed', { name: /activity/i });
    this.quickActions = page
      .getByRole('group', { name: /actions/i })
      .or(page.getByRole('navigation', { name: /actions/i }));
    this.stats = page.getByRole('region', { name: /stats|statistics/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }
}
