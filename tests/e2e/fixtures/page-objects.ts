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
    this.searchInput = page.getByRole('searchbox', { name: /search for eprints/i });
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
 * Alpha landing page (simple page with handle input).
 *
 * @remarks
 * The landing page is a simple page matching the static landing.html design,
 * with a handle input field for Bluesky/ATProto login.
 */
export class AlphaLandingPage {
  readonly page: Page;
  readonly logo: Locator;
  readonly title: Locator;
  readonly tagline: Locator;
  readonly description: Locator;
  readonly handleInput: Locator;
  readonly signInButton: Locator;
  readonly errorMessage: Locator;
  readonly docsLink: Locator;
  readonly githubLink: Locator;
  readonly blueskyLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.getByRole('img', { name: /chive/i });
    this.title = page.getByRole('heading', { level: 1 });
    this.tagline = page.getByText(/decentralized eprints/i);
    this.description = page.getByText(/next-generation eprint server/i);
    this.handleInput = page.getByRole('textbox', { name: /bsky\.social/i });
    this.signInButton = page.getByRole('button', { name: /sign in with bluesky/i });
    this.errorMessage = page.locator('.text-destructive');
    this.docsLink = page.getByRole('link', { name: /read the docs/i });
    this.githubLink = page.getByRole('link', { name: /github/i });
    this.blueskyLink = page.getByRole('link', { name: /bluesky/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async enterHandle(handle: string): Promise<void> {
    await this.handleInput.fill(handle);
  }

  async signIn(handle: string): Promise<void> {
    await this.enterHandle(handle);
    await this.signInButton.click();
  }
}

/**
 * Home page (alias for AlphaLandingPage for backwards compatibility).
 */
export class HomePage extends AlphaLandingPage {
  // Backwards compatibility aliases
  readonly heroTitle: Locator;
  readonly heroSubtitle: Locator;
  readonly searchCta: Locator;
  readonly submitCta: Locator;
  readonly header: HeaderComponent;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderComponent(page);
    this.heroTitle = this.title;
    this.heroSubtitle = this.tagline;
    // These don't exist on the new landing page but provide stubs
    this.searchCta = page.getByRole('link', { name: /explore|browse|search/i }).first();
    this.submitCta = page.getByRole('link', { name: /submit/i }).first();
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
    this.emptyState = page.getByText(/no results found|no eprints|nothing found/i);
    this.resultCount = page.getByText(/\d+\s*(results?|eprints?|items?)/i);
  }

  async goto(): Promise<void> {
    await this.page.goto('/search');
  }

  async search(query: string): Promise<void> {
    // Navigate directly to search URL for reliable cross-browser behavior
    const encodedQuery = encodeURIComponent(query);
    await this.page.goto(`/search?q=${encodedQuery}`);
    await expect(this.searchInput).toHaveValue(query);
  }

  async openFilters(): Promise<void> {
    await this.filtersButton.click();
  }

  async selectSort(option: string): Promise<void> {
    await this.sortDropdown.selectOption(option);
  }
}

/**
 * Eprint detail page.
 */
export class EprintPage {
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
    this.authors = page.getByRole('list', { name: 'Authors' });
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
    await this.page.goto(`/eprints/${encodeURIComponent(uri)}`);
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
  readonly eprintsList: Locator;
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
    this.eprintsList = page
      .getByRole('list', { name: /eprints|publications/i })
      .or(page.getByRole('list').first());
    this.stats = page
      .getByRole('region', { name: /stats|statistics/i })
      .or(page.getByText(/publications|eprints/i).first());
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
  readonly eprintsList: Locator;
  readonly activityFeed: Locator;
  readonly quickActions: Locator;
  readonly stats: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new HeaderComponent(page);
    this.welcomeMessage = page.getByRole('heading', { level: 1 });
    // Use role-based selectors for resilience
    this.eprintsList = page
      .getByRole('list', { name: /eprints|submissions/i })
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

/**
 * Alpha signup form page (authenticated but not yet an alpha tester).
 *
 * @remarks
 * Simple application form at /apply for users without an existing application.
 */
export class AlphaSignupPage {
  readonly page: Page;
  readonly logo: Locator;
  readonly formTitle: Locator;
  readonly emailInput: Locator;
  readonly sectorSelect: Locator;
  readonly sectorOtherInput: Locator;
  readonly careerStageSelect: Locator;
  readonly careerStageOtherInput: Locator;
  readonly affiliationInput: Locator;
  readonly affiliationSuggestions: Locator;
  readonly researchFieldInput: Locator;
  readonly motivationInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.getByRole('img', { name: /chive/i });
    this.formTitle = page.getByRole('heading', { name: /join.*alpha|alpha.*sign|apply/i });
    this.emailInput = page.getByRole('textbox', { name: /email/i });
    this.sectorSelect = page.getByRole('combobox', { name: /sector|organization/i });
    this.sectorOtherInput = page.getByRole('textbox', { name: /specify.*sector/i });
    this.careerStageSelect = page.getByRole('combobox', { name: /career|position|stage/i });
    this.careerStageOtherInput = page.getByRole('textbox', {
      name: /specify.*career|describe.*role/i,
    });
    this.affiliationInput = page.getByRole('textbox', { name: /affiliation|institution/i });
    this.affiliationSuggestions = page.getByRole('listbox');
    this.researchFieldInput = page.getByRole('textbox', {
      name: /research.*field|area.*research/i,
    });
    this.motivationInput = page.getByRole('textbox', { name: /motivation|why/i });
    this.submitButton = page.getByRole('button', { name: /submit|apply|join/i });
    this.errorMessage = page.getByRole('alert');
    this.successMessage = page.getByText(/submitted|pending|thank you/i);
  }

  async goto(): Promise<void> {
    await this.page.goto('/apply');
  }

  async fillForm(data: {
    email: string;
    sector: string;
    sectorOther?: string;
    careerStage: string;
    careerStageOther?: string;
    affiliation?: string;
    researchField: string;
    motivation?: string;
  }): Promise<void> {
    await this.emailInput.fill(data.email);
    await this.sectorSelect.selectOption(data.sector);
    if (data.sectorOther && data.sector === 'other') {
      await this.sectorOtherInput.fill(data.sectorOther);
    }
    await this.careerStageSelect.selectOption(data.careerStage);
    if (data.careerStageOther && data.careerStage === 'other') {
      await this.careerStageOtherInput.fill(data.careerStageOther);
    }
    if (data.affiliation) {
      await this.affiliationInput.fill(data.affiliation);
    }
    await this.researchFieldInput.fill(data.researchField);
    if (data.motivation) {
      await this.motivationInput.fill(data.motivation);
    }
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}

/**
 * Alpha pending status page.
 *
 * @remarks
 * Simple page at /pending showing application under review status.
 * Both pending AND rejected users see this page (rejected is never shown).
 */
export class AlphaStatusPage {
  readonly page: Page;
  readonly logo: Locator;
  readonly statusIcon: Locator;
  readonly statusHeading: Locator;
  readonly appliedDate: Locator;
  readonly statusMessage: Locator;
  readonly signOutButton: Locator;
  readonly blueskyLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.getByRole('img', { name: /chive/i });
    this.statusIcon = page.locator('svg').first(); // Clock icon
    this.statusHeading = page.getByRole('heading', { name: /under review|application/i });
    this.appliedDate = page.getByText(/applied on/i);
    this.statusMessage = page.getByText(/reviewing applications/i);
    this.signOutButton = page.getByRole('button', { name: /sign out/i });
    this.blueskyLink = page.getByRole('link', { name: /bluesky/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/pending');
  }

  async signOut(): Promise<void> {
    await this.signOutButton.click();
  }
}
